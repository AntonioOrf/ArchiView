// @ts-nocheck

// Fase 3.5 — La vista a grafo dei collegamenti.
//
// Il pannello "Schede collegate" risponde a "con che cosa è collegata QUESTA scheda". Il
// grafo risponde a una domanda che quello non può porre: *che forma ha la rete*. In un
// archivio notarile è la domanda utile — quali documenti formano un grappolo (una filza, un
// rogito con le sue copie, una vertenza), quali restano isolati, quale scheda fa da perno.
//
// PERCHÉ SCRITTO A MANO E NON CON UNA LIBRERIA. Il renderer non carica script da CDN e non
// usa moduli: una libreria di grafi andrebbe impacchettata nel bundle, che è già 900 KB, per
// una schermata sola. La simulazione qui sotto sono sessanta righe e non ha dipendenze.
//
// PERCHÉ NON BLOCCA L'EVENT LOOP. Un layout a forze è O(n²) per iterazione: farne trecento
// in un ciclo sincrono congela la finestra per secondi proprio sugli archivi grandi, ed è
// esattamente ciò che la regola sulle prestazioni vieta. Qui gira a blocchi dentro
// `requestAnimationFrame`, quindi si vede assestarsi e resta interrompibile.
//
// PREFISSO `_gr` sugli helper privati: il bundle concatena tutti gli script in UNO scope.

function _grT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

/** Stato della schermata: nodi con posizione, archi, vista (pan/zoom) e simulazione viva. */
let _grStato = null;

/** Oltre questa soglia il disegno diventa una matassa e la simulazione un'attesa. */
const GR_MAX_NODI = 400;

window.apriGrafo = function() {
    const modal = document.getElementById('grafo-modal');
    if (!modal) return;
    modal.classList.remove('hidden-tab');
    window.costruisciGrafo();
};

window.chiudiGrafo = function() {
    const modal = document.getElementById('grafo-modal');
    if (modal) modal.classList.add('hidden-tab');
    // La simulazione va fermata alla chiusura: un rAF che continua a girare su un modale
    // invisibile è lavoro puro a vuoto, e sui portatili è batteria.
    if (_grStato) _grStato.fermo = true;
};

// --- Costruzione --------------------------------------------------------------

window.costruisciGrafo = function() {
    const svg = document.getElementById('grafo-svg');
    if (!svg) return;

    const isolate = !!document.getElementById('grafo-isolate')?.checked;
    const grafo = window.Model.grafoRelazioni(appData.manoscritti, { isolate });

    if (_grStato) _grStato.fermo = true;

    const avviso = document.getElementById('grafo-avviso');
    const riassunto = document.getElementById('grafo-riassunto');

    if (grafo.nodi.length === 0) {
        svg.innerHTML = '';
        if (riassunto) riassunto.textContent = '';
        if (avviso) {
            avviso.classList.remove('hidden');
            avviso.textContent = _grT('graph_empty', 'Nessuna scheda collegata. I collegamenti si aggiungono dal form della scheda, nel blocco "Collegamenti ad altre schede".');
        }
        return;
    }

    // Oltre la soglia si tengono i nodi PIÙ COLLEGATI: sono già in testa (avGrafoRelazioni
    // ordina per grado). Tagliare a caso darebbe un grafo diverso a ogni apertura, e
    // tagliare i più collegati toglierebbe proprio ciò che si sta cercando.
    let nodi = grafo.nodi;
    let tagliati = 0;
    if (nodi.length > GR_MAX_NODI) {
        tagliati = nodi.length - GR_MAX_NODI;
        nodi = nodi.slice(0, GR_MAX_NODI);
    }
    const dentro = new Set(nodi.map(n => n.id));
    const archi = grafo.archi.filter(a => dentro.has(a.da) && dentro.has(a.a));

    if (avviso) {
        avviso.classList.toggle('hidden', tagliati === 0);
        if (tagliati > 0) {
            avviso.textContent = _grT('graph_truncated', 'Mostrate le {var0} schede più collegate su {var1}: oltre questa soglia il grafo non si legge più.')
                .replace('{var0}', String(GR_MAX_NODI)).replace('{var1}', String(grafo.nodi.length));
        }
    }

    const componenti = window.Model.componentiGrafo({ nodi, archi });
    if (riassunto) {
        riassunto.textContent = _grT('graph_summary', '{var0} schede, {var1} collegamenti, {var2} gruppi')
            .replace('{var0}', String(nodi.length))
            .replace('{var1}', String(archi.length))
            .replace('{var2}', String(componenti.length));
    }

    // Il pulsante di ricalcolo riparte da capo, inquadratura compresa: è anche il modo di
    // tornare a vedere tutto dopo essersi persi con zoom e trascinamenti.
    // Posizioni iniziali su una circonferenza, in ordine deterministico: partire da
    // coordinate casuali darebbe un grafo diverso a ogni apertura degli stessi dati, e
    // "l'ho già visto così" è metà del valore di una vista del genere.
    const raggio = 40 + nodi.length * 3;
    const punti = nodi.map((n, i) => {
        const ang = (2 * Math.PI * i) / nodi.length;
        return { ...n, x: Math.cos(ang) * raggio, y: Math.sin(ang) * raggio, vx: 0, vy: 0, fisso: false };
    });
    const perId = new Map(punti.map(p => [p.id, p]));

    _grStato = {
        punti, perId, archi,
        vista: { x: -raggio * 1.6, y: -raggio * 1.6, w: raggio * 3.2, h: raggio * 3.2 },
        selezionato: null,
        fermo: false,
        vistaManuale: false,
        giri: 0
    };

    _grInquadra();
    _grDisegna();
    _grSimula();
};

// --- Simulazione a forze ------------------------------------------------------

/**
 * Molle sugli archi, repulsione fra tutti i nodi, e un richiamo debole verso il centro che
 * impedisce ai grappoli scollegati di allontanarsi all'infinito (senza, due componenti che
 * non si toccano si respingono e basta, e dopo un po' escono dallo schermo).
 */
function _grPasso() {
    const s = _grStato;
    const REPULSIONE = 9000;
    const MOLLA = 0.02;
    const LUNGHEZZA = 90;
    const ATTRITO = 0.85;
    const CENTRO = 0.002;

    for (const p of s.punti) { p.fx = 0; p.fy = 0; }

    for (let i = 0; i < s.punti.length; i++) {
        const a = s.punti[i];
        for (let j = i + 1; j < s.punti.length; j++) {
            const b = s.punti[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let d2 = dx * dx + dy * dy;
            // Due nodi esattamente sovrapposti darebbero una forza infinita: si scostano di
            // un'inezia deterministica invece che a caso, per non rendere il layout instabile.
            if (d2 < 0.01) { dx = (i - j) * 0.1 || 0.1; dy = 0.1; d2 = dx * dx + dy * dy; }
            const f = REPULSIONE / d2;
            const d = Math.sqrt(d2);
            a.fx += (dx / d) * f; a.fy += (dy / d) * f;
            b.fx -= (dx / d) * f; b.fy -= (dy / d) * f;
        }
    }

    for (const arco of s.archi) {
        const a = s.perId.get(arco.da), b = s.perId.get(arco.a);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - LUNGHEZZA) * MOLLA;
        a.fx += (dx / d) * f; a.fy += (dy / d) * f;
        b.fx -= (dx / d) * f; b.fy -= (dy / d) * f;
    }

    let movimento = 0;
    for (const p of s.punti) {
        if (p.fisso) { p.vx = 0; p.vy = 0; continue; }
        p.fx -= p.x * CENTRO;
        p.fy -= p.y * CENTRO;
        p.vx = (p.vx + p.fx) * ATTRITO;
        p.vy = (p.vy + p.fy) * ATTRITO;
        // Tetto alla velocità: senza, il primo passo su un grafo denso spara i nodi fuori
        // schermo e la simulazione impiega decine di giri a richiamarli.
        const v = Math.hypot(p.vx, p.vy);
        if (v > 30) { p.vx = (p.vx / v) * 30; p.vy = (p.vy / v) * 30; }
        p.x += p.vx; p.y += p.vy;
        movimento += Math.abs(p.vx) + Math.abs(p.vy);
    }
    return movimento / s.punti.length;
}

/**
 * Inquadra il contenuto: la vista segue il grafo mentre si assesta.
 *
 * Senza, la viewBox resta quella iniziale e la simulazione spinge i nodi fuori dai bordi —
 * si apre la schermata e metà rete è oltre il margine, invisibile e non cliccabile. Il
 * riquadro si adatta finché l'utente non tocca la vista: da quel momento comanda lui, o
 * ogni fotogramma gli sposterebbe sotto il naso quello che sta guardando.
 */
function _grInquadra() {
    const s = _grStato;
    if (!s || s.vistaManuale || s.punti.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of s.punti) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    // Margine generoso: le etichette stanno SOPRA il nodo e sporgono ai lati, quindi un
    // riquadro stretto sui soli centri le taglierebbe proprio ai nodi di bordo.
    const margine = 60;
    let w = Math.max(maxX - minX, 1) + margine * 2;
    let h = Math.max(maxY - minY, 1) + margine * 2;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

    // Le proporzioni della viewBox devono seguire quelle della tela, o un grafo largo e
    // basso verrebbe schiacciato (`preserveAspectRatio` compensa, ma lasciando bande vuote
    // e uno zoom effettivo minore del necessario).
    const svg = document.getElementById('grafo-svg');
    const r = svg ? svg.getBoundingClientRect() : null;
    if (r && r.width > 0 && r.height > 0) {
        const proporzione = r.width / r.height;
        if (w / h < proporzione) w = h * proporzione;
        else h = w / proporzione;
    }
    s.vista = { x: cx - w / 2, y: cy - h / 2, w, h };
}

function _grSimula() {
    const s = _grStato;
    if (!s || s.fermo) return;
    // In modalità Prestazioni ridotte si fanno meno iterazioni per fotogramma: il grafo si
    // assesta in più tempo ma la finestra resta reattiva, che è il patto di quella modalità.
    const perFrame = window.modalitaPrestazioniRidotte ? 2 : 6;

    let quiete = 0;
    for (let i = 0; i < perFrame; i++) quiete = _grPasso();
    s.giri += perFrame;
    _grInquadra();
    _grDisegna();

    // Si smette quando è fermo, o comunque dopo un tetto di giri: una simulazione che non
    // converge non deve girare per sempre in sottofondo.
    if (quiete < 0.15 || s.giri > 900) return;
    requestAnimationFrame(_grSimula);
}

// --- Disegno ------------------------------------------------------------------

function _grVicini(id) {
    const s = _grStato;
    const set = new Set([id]);
    for (const a of s.archi) {
        if (a.da === id) set.add(a.a);
        if (a.a === id) set.add(a.da);
    }
    return set;
}

const GR_NS = 'http://www.w3.org/2000/svg';

/**
 * Un elemento SVG con i suoi attributi.
 *
 * ⚠️ Il grafo si costruisce con `createElementNS`, MAI con `innerHTML`. Un frammento
 * `<g><circle/></g>` passato a un sanificatore HTML viene letto come HTML — dove `circle` e
 * `g` non esistono — e sparisce senza un errore: la tela resta bianca e sembra un problema
 * di dati. In più qui non si concatena markup con dentro segnature scritte dall'utente,
 * quindi non c'è nessuna stringa da sanificare in partenza.
 */
function _grEl(nome, attributi) {
    const el = document.createElementNS(GR_NS, nome);
    for (const k of Object.keys(attributi || {})) el.setAttribute(k, String(attributi[k]));
    return el;
}

function _grTitolo(padre, testo) {
    const t = document.createElementNS(GR_NS, 'title');
    t.textContent = testo;          // textContent: sono segnature scritte dall'utente
    padre.appendChild(t);
    return t;
}

/** Il raggio del nodo, in unità di viewBox. Cresce col grado ma con la RADICE: un nodo con
 * venti rimandi non deve avere venti volte l'area di uno con un rimando solo. */
function _grRaggio(p, scala) {
    return (5 + Math.sqrt(p.grado) * 2.6) * scala;
}

function _grDisegna() {
    const s = _grStato;
    const svg = document.getElementById('grafo-svg');
    if (!s || !svg) return;

    svg.setAttribute('viewBox', `${s.vista.x} ${s.vista.y} ${s.vista.w} ${s.vista.h}`);
    // Le etichette non devono rimpicciolirsi con lo zoom out fino a sparire, né gonfiarsi
    // con lo zoom in: le misure sono in unità di viewBox, quindi vanno compensate.
    const scala = s.vista.w / 800;

    const evidenziati = s.selezionato ? _grVicini(s.selezionato) : null;
    const frammento = document.createDocumentFragment();

    // La freccia è un marker sull'estremità: senza il verso, "copia di" e "originale di"
    // avrebbero lo stesso disegno.
    const defs = _grEl('defs', {});
    const marker = _grEl('marker', {
        id: 'grafo-freccia', viewBox: '0 0 10 10', refX: 9, refY: 5,
        // `userSpaceOnUse`: senza, la punta è un multiplo dello spessore del tratto e a
        // zoom ridotto diventa invisibile proprio quando servirebbe di più.
        markerUnits: 'userSpaceOnUse',
        markerWidth: 9 * scala, markerHeight: 9 * scala, orient: 'auto-start-reverse'
    });
    marker.appendChild(_grEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'grafo-freccia-punta' }));
    defs.appendChild(marker);
    frammento.appendChild(defs);

    for (const a of s.archi) {
        const p1 = s.perId.get(a.da), p2 = s.perId.get(a.a);
        if (!p1 || !p2) continue;
        const spento = evidenziati && !(evidenziati.has(a.da) && evidenziati.has(a.a));

        // L'arco si ferma sul BORDO dei due cerchi, non al loro centro. Disegnandolo fino
        // al centro, la punta della freccia finisce sotto il nodo di arrivo e il verso —
        // cioè l'unica cosa che distingue "copia di" da "originale di" — non si vede.
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy) || 1;
        const r1 = _grRaggio(p1, scala) + 1 * scala;
        const r2 = _grRaggio(p2, scala) + 3.5 * scala;   // spazio per la punta
        const linea = _grEl('line', {
            class: 'grafo-arco' + (spento ? ' spento' : ''),
            x1: p1.x + (dx / d) * r1, y1: p1.y + (dy / d) * r1,
            x2: p2.x - (dx / d) * r2, y2: p2.y - (dy / d) * r2,
            'stroke-width': 1.2 * scala,
            'marker-end': 'url(#grafo-freccia)'
        });
        _grTitolo(linea, (p1.etichetta || '—') + ' → ' + (p2.etichetta || '—') + (a.tipo ? ' (' + a.tipo + ')' : ''));
        frammento.appendChild(linea);
    }

    for (const p of s.punti) {
        // Il raggio cresce col grado ma con la radice, non in proporzione: un nodo con venti
        // rimandi non deve avere venti volte l'area di uno con un rimando solo.
        const r = _grRaggio(p, scala);
        const spento = evidenziati && !evidenziati.has(p.id);
        const g = _grEl('g', {
            class: 'grafo-nodo' + (spento ? ' spento' : '') + (s.selezionato === p.id ? ' scelto' : '')
        });
        g.dataset.id = p.id;
        g.appendChild(_grEl('circle', { cx: p.x, cy: p.y, r }));
        const testo = _grEl('text', {
            x: p.x, y: p.y - r - 3 * scala, 'font-size': 11 * scala, 'text-anchor': 'middle'
        });
        testo.textContent = p.etichetta || '—';
        g.appendChild(testo);
        _grTitolo(g, (p.etichetta || '—') + ' · ' + p.grado);
        frammento.appendChild(g);
    }

    svg.textContent = '';
    svg.appendChild(frammento);
}

// --- Interazione --------------------------------------------------------------

function _grPuntoSvg(evt) {
    const svg = document.getElementById('grafo-svg');
    const r = svg.getBoundingClientRect();
    const s = _grStato;
    return {
        x: s.vista.x + ((evt.clientX - r.left) / r.width) * s.vista.w,
        y: s.vista.y + ((evt.clientY - r.top) / r.height) * s.vista.h
    };
}

function _grAggancia() {
    const svg = document.getElementById('grafo-svg');
    if (!svg) return;

    let trascina = null;   // { punto } se si muove un nodo, { pan: true } se si sposta la vista

    svg.addEventListener('pointerdown', (e) => {
        if (!_grStato) return;
        const g = e.target.closest('.grafo-nodo');
        if (g) {
            const p = _grStato.perId.get(g.dataset.id);
            if (p) {
                p.fisso = true;
                trascina = { punto: p, mosso: false };
            }
        } else {
            trascina = { pan: true, da: _grPuntoSvg(e) };
        }
        svg.setPointerCapture(e.pointerId);
    });

    svg.addEventListener('pointermove', (e) => {
        if (!trascina || !_grStato) return;
        const p = _grPuntoSvg(e);
        if (trascina.punto) {
            trascina.punto.x = p.x;
            trascina.punto.y = p.y;
            trascina.mosso = true;
            // Muovere un nodo rimette in moto la simulazione: gli altri devono riassestarsi
            // intorno, o il grafo resterebbe con un buco dove il nodo stava prima.
            if (_grStato.fermo === false && _grStato.giri > 900) { _grStato.giri = 0; requestAnimationFrame(_grSimula); }
            _grDisegna();
        } else if (trascina.pan) {
            // Da qui in poi l'inquadratura è dell'utente: continuare a rincorrere il
            // contenuto gli sposterebbe sotto gli occhi ciò che sta guardando.
            _grStato.vistaManuale = true;
            _grStato.vista.x -= p.x - trascina.da.x;
            _grStato.vista.y -= p.y - trascina.da.y;
            _grDisegna();
        }
    });

    const finePointer = (e) => {
        if (!trascina || !_grStato) return;
        // Un clic senza trascinamento è una SELEZIONE, non uno spostamento: evidenzia il
        // nodo e i suoi vicini, che è il modo di leggere un grappolo dentro la matassa.
        if (trascina.punto && !trascina.mosso) {
            _grStato.selezionato = _grStato.selezionato === trascina.punto.id ? null : trascina.punto.id;
            _grAggiornaDettaglio();
            _grDisegna();
        }
        trascina = null;
        try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* puntatore già rilasciato */ }
    };
    svg.addEventListener('pointerup', finePointer);
    svg.addEventListener('pointercancel', finePointer);

    // Doppio clic: apre la scheda. È l'unica azione distruttiva-ish della schermata (si
    // cambia vista), quindi non sta sul clic singolo, che serve a esplorare.
    svg.addEventListener('dblclick', (e) => {
        const g = e.target.closest('.grafo-nodo');
        if (!g) return;
        window.chiudiGrafo();
        if (typeof editItem === 'function') editItem(g.dataset.id);
    });

    svg.addEventListener('wheel', (e) => {
        if (!_grStato) return;
        e.preventDefault();
        _grStato.vistaManuale = true;
        const fattore = e.deltaY > 0 ? 1.12 : 1 / 1.12;
        const p = _grPuntoSvg(e);
        const v = _grStato.vista;
        // Zoom ancorato al puntatore: ingrandire sempre dal centro costringe a inseguire
        // col pan quello che si sta guardando.
        v.x = p.x - (p.x - v.x) * fattore;
        v.y = p.y - (p.y - v.y) * fattore;
        v.w *= fattore;
        v.h *= fattore;
        _grDisegna();
    }, { passive: false });
}

/** Il riquadro laterale: che cosa è il nodo scelto e a che cosa è collegato. */
function _grAggiornaDettaglio() {
    const box = document.getElementById('grafo-dettaglio');
    if (!box) return;
    const id = _grStato && _grStato.selezionato;
    box.innerHTML = '';
    if (!id) {
        const p = document.createElement('p');
        p.className = 'text-xs text-stone-400 italic';
        p.textContent = _grT('graph_hint', 'Clic su un nodo per isolarlo con i suoi vicini, doppio clic per aprire la scheda. Trascina per spostare, rotella per lo zoom.');
        box.appendChild(p);
        return;
    }
    const m = (appData.manoscritti || []).find(x => String(x.id) === id);
    if (!m) return;

    const titolo = document.createElement('strong');
    titolo.className = 'block truncate';
    titolo.textContent = m.segnatura || _grT('no_signature', 'Senza segnatura');
    box.appendChild(titolo);

    const risolte = window.relazioniRisolte(id);
    const sezione = (chiave, fallback, voci) => {
        const h = document.createElement('p');
        h.className = 'text-xs uppercase tracking-wider text-stone-500 mt-2 mb-1';
        h.textContent = _grT(chiave, fallback) + ' (' + voci.length + ')';
        box.appendChild(h);
        for (const v of voci) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rel-riga w-full text-left';
            btn.onclick = () => {
                // Saltare al vicino invece di aprirlo: si continua a esplorare il grafo,
                // che è il motivo per cui si è aperta questa schermata.
                _grStato.selezionato = String(v.scheda.id);
                _grAggiornaDettaglio();
                _grDisegna();
            };
            const t = document.createElement('span');
            t.className = 'rel-tipo';
            t.textContent = v.tipo || _grT('link_generic', 'collegata a');
            const s = document.createElement('span');
            s.className = 'truncate';
            s.textContent = v.scheda.segnatura || _grT('no_signature', 'Senza segnatura');
            btn.append(t, s);
            box.appendChild(btn);
        }
    };
    sezione('link_outgoing', 'Questa scheda rimanda a', risolte.uscenti);
    sezione('link_incoming', 'È richiamata da', risolte.entranti);

    const apri = document.createElement('button');
    apri.type = 'button';
    apri.className = 'btn btn-secondary text-sm w-full justify-center mt-3';
    apri.textContent = _grT('graph_open_record', 'Apri la scheda');
    apri.onclick = () => { window.chiudiGrafo(); if (typeof editItem === 'function') editItem(id); };
    box.appendChild(apri);
}

// --- Markup -------------------------------------------------------------------

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('grafo-modal')) return;
        const html = `
    <div id="grafo-modal" class="modal-overlay hidden-tab">
        <div class="modal-window grafo-finestra">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="git-fork" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="graph_title">Grafo dei collegamenti</span>
                </h3>
                <span id="grafo-riassunto" class="ml-auto text-xs text-stone-500 tabular-nums"></span>
            </div>
            <div class="modal-body grafo-corpo">
                <div class="grafo-barra">
                    <label class="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" id="grafo-isolate" onchange="costruisciGrafo()">
                        <span data-i18n="graph_show_isolated">Mostra anche le schede senza collegamenti</span>
                    </label>
                    <button type="button" onclick="costruisciGrafo()" class="btn btn-ghost btn-icon ml-auto" data-i18n-title="graph_relayout" data-i18n-aria-label="graph_relayout" title="Ricalcola la disposizione" aria-label="Ricalcola la disposizione">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                    </button>
                </div>
                <p id="grafo-avviso" class="hidden text-xs text-amber-800 dark:text-amber-300 mb-2"></p>
                <div class="grafo-area">
                    <svg id="grafo-svg" class="grafo-svg" role="img" aria-label="Grafo dei collegamenti fra schede"></svg>
                    <aside id="grafo-dettaglio" class="grafo-dettaglio"></aside>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiGrafo()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        _grAggancia();
        _grAggiornaDettaglio();
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('grafo-modal')] });
    });
})();
