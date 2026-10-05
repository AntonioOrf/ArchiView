// Ricerca tra archivi — Fase 2 di PIANO-RICERCA-ARCHIVI.md: interruttore nella ricerca,
// risultati degli altri archivi sotto la griglia, anteprima in sola lettura.
//
// ⚠️ Le schede degli altri archivi NON entrano mai in `appData.manoscritti`: vivono solo qui,
// in `_caStato`, e nel DOM di questa sezione. Una scheda esterna nell'array dell'archivio
// aperto finirebbe in sync, export, cestino e conteggi come se fosse sua.
//
// Tutto il testo che arriva dagli altri archivi va nel DOM via `textContent`; l'unico HTML
// (la trascrizione) passa da `sanitizeHTML`: il database di un archivio condiviso lo
// scrivono anche altri.
//
// PREFISSO `_ca` sugli helper privati: il bundle concatena tutti gli script in UNO scope.

function _caT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

const _CA_CHIAVE_LS = 'archiview.ricercaAltriArchivi';
const _CA_DEBOUNCE_MS = 300;
/** Stessa query entro questo intervallo: niente nuova richiesta (renderMain gira spesso). */
const _CA_VALIDITA_MS = 30_000;
const _CA_PAGINA = 30;

let _caTimer = null;
let _caSeq = 0;
let _caUltima = { chiave: '', quando: 0 };
let _caStato = null; // { testo, archivi, risultati, cursore, totale, troncato }
let _caUrlAnteprima = [];

function _caAttiva() {
    try { return localStorage.getItem(_CA_CHIAVE_LS) === '1'; } catch (e) { return false; }
}

function _caTestoRicerca() {
    const input = document.getElementById('search-input') as HTMLInputElement;
    return input ? input.value.trim() : '';
}

function _caEl(tag, classe?, testo?) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (testo !== undefined && testo !== null) el.textContent = String(testo);
    return el;
}

/** Etichetta leggibile del campo che ha dato il risultato. */
function _caEtichettaCampo(r) {
    if (r.campo === '#trascrizione') return _caT('cross_field_transcription', 'Trascrizione');
    if (r.campo === '#ocr') return _caT('cross_field_ocr', 'Testo riconosciuto (OCR)');
    if (r.campo === '#tags') return _caT('th_tags', 'Tag');
    if (r.campo === 'segnatura') return _caT('field_segnatura', 'Segnatura');
    if (r.campo === 'anagrafica') return _caT('auth_title', 'Persone e luoghi');
    if (r.campoLabel) return r.campoLabel;
    return typeof window.etichettaCampo === 'function' ? window.etichettaCampo(r.campo) : r.campo;
}

// --- Interruttore ---------------------------------------------------------------

window.impostaRicercaAltriArchivi = function(attiva) {
    try { localStorage.setItem(_CA_CHIAVE_LS, attiva ? '1' : '0'); } catch (e) { /* solo comodità */ }
    const box = document.getElementById('search-altri-archivi') as HTMLInputElement;
    if (box) box.checked = !!attiva;
    window.aggiornaRicercaAltriArchivi(true);
};

/**
 * Chiamata da `renderMain` a ogni ridisegno e dall'interruttore. Decide da sé se serve una
 * richiesta: la sezione si vede solo con l'interruttore acceso e un testo da cercare, e la
 * stessa query non si ripete prima di `_CA_VALIDITA_MS`.
 */
window.aggiornaRicercaAltriArchivi = function(forza) {
    const sezione = document.getElementById('altri-archivi');
    if (!sezione || !window.apiBrowser || typeof window.apiBrowser.crossArchiveSearch !== 'function') return;
    const testo = _caTestoRicerca();
    if (!_caAttiva() || !testo) {
        clearTimeout(_caTimer);
        _caSeq++; // una risposta in volo non deve più disegnare
        _caUltima = { chiave: '', quando: 0 };
        _caStato = null;
        sezione.classList.add('hidden');
        return;
    }
    sezione.classList.remove('hidden');
    if (!forza && _caUltima.chiave === testo && Date.now() - _caUltima.quando < _CA_VALIDITA_MS) return;
    clearTimeout(_caTimer);
    _caTimer = setTimeout(() => _caCerca(testo, null), forza ? 0 : _CA_DEBOUNCE_MS);
};

async function _caCerca(testo, cursore, ripetuta = false) {
    const seq = ++_caSeq;
    _caUltima = { chiave: testo, quando: Date.now() };
    if (!cursore) _caImpostaStato(_caT('cross_searching', 'Ricerca negli altri archivi…'), true);
    let r;
    try {
        r = await window.apiBrowser.crossArchiveSearch({ testo, cursore, limite: _CA_PAGINA });
    } catch (e) {
        r = { ok: false, error: e && e.message ? e.message : String(e) };
    }
    // Una risposta arrivata dopo una ricerca più recente non deve sovrascriverla.
    if (seq !== _caSeq) return;
    if (!r || !r.ok) {
        // Annullata dal main ma nessuna ricerca più recente è partita da qui (seq invariato):
        // l'ha annullata un altro chiamante sullo stesso canale. Senza ripetere, la sezione
        // resterebbe ferma su "Ricerca…" per sempre.
        if (r && r.annullata) { if (!ripetuta) return _caCerca(testo, cursore, true); return; }
        _caUltima = { chiave: '', quando: 0 };
        _caImpostaStato(_caT('cross_error', 'Ricerca negli altri archivi non riuscita: {var0}').replace('{var0}', (r && r.error) || '?'));
        return;
    }
    if (r.cursoreScaduto) return _caCerca(testo, null);

    if (cursore && _caStato && _caStato.testo === testo) {
        _caStato.risultati = _caStato.risultati.concat(r.risultati);
        _caStato.cursore = r.cursore;
        _caStato.archivi = r.archivi;
    } else {
        _caStato = { testo, archivi: r.archivi, risultati: r.risultati.slice(), cursore: r.cursore, totale: r.totale, troncato: r.totaleTroncato };
    }
    _caDisegna();
}

window.altriRisultatiAltriArchivi = function() {
    if (_caStato && _caStato.cursore) _caCerca(_caStato.testo, _caStato.cursore);
};

function _caImpostaStato(testo, inCorso?) {
    const stato = document.getElementById('altri-archivi-stato');
    if (stato) {
        stato.textContent = testo;
        stato.classList.toggle('italic', !!inCorso);
    }
    if (inCorso) {
        const lista = document.getElementById('altri-archivi-lista');
        if (lista) lista.setAttribute('aria-busy', 'true');
    }
}

// --- Risultati ------------------------------------------------------------------

function _caDisegna() {
    const lista = document.getElementById('altri-archivi-lista');
    const altri = document.getElementById('altri-archivi-altri');
    if (!lista || !_caStato) return;
    lista.removeAttribute('aria-busy');
    lista.innerHTML = '';

    const s = _caStato;
    const consultabili = s.archivi.filter(a => a.raggiungibile);
    const perArchivio = new Map();
    for (const r of s.risultati) {
        if (!perArchivio.has(r.archivioId)) perArchivio.set(r.archivioId, []);
        perArchivio.get(r.archivioId).push(r);
    }

    if (s.archivi.length === 0) {
        _caImpostaStato(_caT('cross_no_archives', 'Nessun altro archivio recente: gli archivi aperti almeno una volta in ArchiView compaiono qui.'));
    } else if (s.totale === 0) {
        _caImpostaStato(_caT('cross_none', 'Nessuna scheda negli altri archivi ({var0} consultati).').replace('{var0}', String(consultabili.length)));
    } else {
        const testo = s.totale === 1
            ? _caT('cross_found_one', '1 scheda in un altro archivio')
            : _caT('cross_found_many', '{var0} schede in {var1} altri archivi')
                .replace('{var0}', String(s.totale)).replace('{var1}', String(perArchivio.size));
        _caImpostaStato(testo + (s.troncato ? ' — ' + _caT('cross_truncated', 'troppi risultati, restringi la ricerca') : ''));
    }

    const frammento = document.createDocumentFragment();
    for (const a of s.archivi) {
        const risultati = perArchivio.get(a.id);
        if (!risultati) continue;
        frammento.appendChild(_caGruppo(a, risultati));
    }

    // Gli archivi irraggiungibili si dicono, ma in coda e in piccolo: non sono un errore
    // della ricerca, sono un disco staccato o una cartella spostata.
    const assenti = s.archivi.filter(a => !a.raggiungibile);
    if (assenti.length) {
        const p = _caEl('p', 'altri-archivi-assenti text-xs text-stone-500 dark:text-stone-400 mt-3');
        p.textContent = _caT('cross_unreachable', 'Non raggiungibili (cartella spostata o disco scollegato): {var0}')
            .replace('{var0}', assenti.map(a => a.nome).join(', '));
        frammento.appendChild(p);
    }
    lista.appendChild(frammento);
    if (window.lucide) lucide.createIcons({ nodes: [lista] });

    if (altri) altri.classList.toggle('hidden', !s.cursore);
}

function _caGruppo(archivio, risultati) {
    const gruppo = _caEl('div', 'altri-archivi-gruppo');
    gruppo.dataset.archivio = archivio.id;
    const titolo = _caEl('h3', 'altri-archivi-gruppo-titolo');
    const icona = _caEl('i', 'w-4 h-4 shrink-0');
    icona.setAttribute('data-lucide', archivio.tipo === 'shared' ? 'users' : 'archive');
    icona.setAttribute('aria-hidden', 'true');
    titolo.appendChild(icona);
    titolo.appendChild(_caEl('span', 'truncate', archivio.nome));
    if (archivio.tipo === 'shared') titolo.appendChild(_caEl('span', 'card-badge', _caT('cross_shared', 'condiviso')));
    titolo.appendChild(_caEl('span', 'altri-archivi-conteggio tabular-nums', String(risultati.length)));
    gruppo.appendChild(titolo);

    if (archivio.futuro) {
        gruppo.appendChild(_caEl('p', 'text-xs text-stone-500 dark:text-stone-400 mb-1',
            _caT('cross_future', 'Creato con una versione più recente di ArchiView: alcuni campi potrebbero mancare.')));
    }

    const ul = _caEl('ul', 'altri-archivi-elenco');
    for (const r of risultati) ul.appendChild(_caRiga(archivio, r));
    gruppo.appendChild(ul);
    return gruppo;
}

function _caRiga(archivio, r) {
    const li = _caEl('li');
    const btn = _caEl('button', 'altri-archivi-risultato') as HTMLButtonElement;
    btn.type = 'button';
    btn.dataset.scheda = r.schedaId;

    const testa = _caEl('span', 'altri-archivi-testa');
    testa.appendChild(_caEl('span', 'altri-archivi-segnatura', r.segnatura || _caT('cross_no_shelfmark', '(senza segnatura)')));
    if (r.tipoNome) testa.appendChild(_caEl('span', 'altri-archivi-tipo', r.tipoNome));
    btn.appendChild(testa);

    const corpo = _caEl('span', 'altri-archivi-estratto');
    corpo.appendChild(_caEl('span', 'altri-archivi-campo', _caEtichettaCampo(r) + ': '));
    corpo.appendChild(document.createTextNode(r.estratto.prima));
    if (r.estratto.match) corpo.appendChild(_caEl('mark', '', r.estratto.match));
    corpo.appendChild(document.createTextNode(r.estratto.dopo));
    btn.appendChild(corpo);

    btn.setAttribute('aria-label', _caT('cross_open_preview', 'Apri l\'anteprima di {var0} ({var1})')
        .replace('{var0}', r.segnatura || r.schedaId).replace('{var1}', archivio.nome));
    btn.onclick = () => window.apriAnteprimaAltroArchivio(r.archivioId, r.schedaId);
    li.appendChild(btn);
    return li;
}

// --- Anteprima in sola lettura ----------------------------------------------------

function _caRilasciaImmagini() {
    for (const u of _caUrlAnteprima) URL.revokeObjectURL(u);
    _caUrlAnteprima = [];
}

window.chiudiAnteprimaAltroArchivio = function() {
    const modal = document.getElementById('altro-archivio-modal');
    if (modal) modal.classList.add('hidden-tab');
    _caRilasciaImmagini();
};

window.apriAnteprimaAltroArchivio = async function(archivioId, schedaId) {
    const modal = document.getElementById('altro-archivio-modal');
    const corpo = document.getElementById('altro-archivio-corpo');
    if (!modal || !corpo) return;
    _caRilasciaImmagini();
    _caAnteprima = null;
    const btnCopia = document.getElementById('altro-archivio-copia');
    if (btnCopia) btnCopia.classList.add('hidden');
    document.getElementById('altro-archivio-titolo').textContent = _caT('cross_loading', 'Caricamento…');
    document.getElementById('altro-archivio-sottotitolo').textContent = '';
    corpo.innerHTML = '';
    modal.classList.remove('hidden-tab');

    let r;
    try {
        r = await window.apiBrowser.crossArchiveGet(archivioId, schedaId);
    } catch (e) {
        r = { ok: false, error: e && e.message ? e.message : String(e) };
    }
    if (modal.classList.contains('hidden-tab')) return; // chiusa nel frattempo
    if (!r || !r.ok) {
        document.getElementById('altro-archivio-titolo').textContent = _caT('cross_preview_error', 'Anteprima non disponibile');
        corpo.appendChild(_caEl('p', 'text-sm text-stone-600 dark:text-stone-300', (r && r.error) || ''));
        return;
    }
    _caDisegnaAnteprima(r, corpo);
};

/** Un valore di campo come testo: liste dinamiche "ruolo: nome", booleani leggibili, niente HTML. */
function _caTestoValore(def, v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'boolean') return window.testoBooleano ? window.testoBooleano(v) : String(v);
    if (Array.isArray(v)) {
        return v.map(el => {
            if (el && typeof el === 'object') return [el.k, el.v !== undefined ? el.v : el.nome].filter(Boolean).join(': ');
            return el === null || el === undefined ? '' : String(el);
        }).filter(Boolean).join('\n');
    }
    if (typeof v === 'object') return '';
    return String(v).replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function _caDisegnaAnteprima(r, corpo) {
    const m = r.scheda;
    document.getElementById('altro-archivio-titolo').textContent = m.segnatura || _caT('cross_no_shelfmark', '(senza segnatura)');
    document.getElementById('altro-archivio-sottotitolo').textContent = [
        r.archivio.nome,
        r.tipo && r.tipo.nome ? r.tipo.nome : m.tipoDocumento,
        _caT('cross_read_only', 'sola lettura')
    ].filter(Boolean).join(' · ');

    // Stesse definizioni del form (campi del tipo + campi propri, nell'ordine della scheda):
    // CONFIG_CAMPI dà etichette e tipi dei campi base.
    const defs = window.Model.campiDellaScheda(m, r.tipo, typeof CONFIG_CAMPI !== 'undefined' ? CONFIG_CAMPI : undefined);
    const dl = _caEl('dl', 'altri-archivi-campi');
    const mostrati = new Set(['segnatura']);
    const formAperto = _caFormAperto();
    const aggiungi = (etichetta, testo, campoId?) => {
        if (!testo) return;
        dl.appendChild(_caEl('dt', '', etichetta));
        const dd = _caEl('dd', '');
        dd.appendChild(_caEl('span', 'altri-archivi-valore', testo));
        if (campoId) dd.appendChild(_caAzioniCampo(etichetta, testo, campoId, m[campoId], formAperto));
        dl.appendChild(dd);
    };
    for (const d of defs) {
        if (d.tipo === 'attachments') continue;
        mostrati.add(d.id);
        aggiungi(d.label || (window.etichettaCampo ? window.etichettaCampo(d.id) : d.id), _caTestoValore(d, m[d.id]), d.id);
    }
    // Campi rimasti da un tipo cambiato: sono dati scritti dal ricercatore, si mostrano.
    const servizio = new Set(window.Model.CHIAVI_SERVIZIO);
    for (const k of Object.keys(m)) {
        if (servizio.has(k) || mostrati.has(k)) continue;
        aggiungi(window.etichettaCampo ? window.etichettaCampo(k) : k, _caTestoValore(null, m[k]), k);
    }
    const tags = window.Model.tags ? window.Model.tags(m) : [];
    if (tags.length) aggiungi(_caT('th_tags', 'Tag'), tags.join(', '));
    if (dl.childNodes.length) corpo.appendChild(dl);
    else corpo.appendChild(_caEl('p', 'text-sm italic text-stone-500', _caT('cross_preview_empty', 'Nessun campo compilato.')));

    _caDisegnaAllegati(r, corpo);
    // Le icone dei pulsanti per campo nascono qui, dopo il disegno: senza, i pulsanti
    // "copia"/"inserisci" sarebbero rettangoli vuoti.
    if (window.lucide) lucide.createIcons({ nodes: [corpo] });

    _caAnteprima = r;
    const copia = document.getElementById('altro-archivio-copia');
    if (copia) copia.classList.remove('hidden');
}

// --- Copia di singoli campi ------------------------------------------------------------

/** Il form di una scheda è aperto (nuova o in modifica): i valori si possono inserire lì. */
function _caFormAperto() {
    const vista = document.getElementById('view-add');
    return !!(vista && !vista.classList.contains('hidden-tab') && !vista.classList.contains('hidden') && vista.getClientRects().length);
}

function _caAzioniCampo(etichetta, testo, campoId, valore, formAperto) {
    const box = _caEl('span', 'altri-archivi-azioni');
    const copia = _caEl('button', 'btn btn-ghost btn-icon altri-archivi-azione') as HTMLButtonElement;
    copia.type = 'button';
    copia.title = _caT('cross_copy_value', 'Copia il valore');
    copia.setAttribute('aria-label', _caT('cross_copy_value', 'Copia il valore') + ': ' + etichetta);
    copia.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i>';
    copia.onclick = async () => {
        try {
            await navigator.clipboard.writeText(testo);
            mostraMessaggio(_caT('cross_value_copied', 'Valore copiato: incollalo dove serve.'), 'success');
        } catch (e) {
            mostraMessaggio(_caT('cross_copy_failed', 'Copia negli appunti non riuscita.'), 'error');
        }
    };
    box.appendChild(copia);

    const destinazione = formAperto ? _caControlloForm(campoId) : null;
    if (destinazione) {
        const ins = _caEl('button', 'btn btn-ghost btn-icon altri-archivi-azione') as HTMLButtonElement;
        ins.type = 'button';
        ins.dataset.inserisci = campoId;
        ins.title = _caT('cross_insert_value', 'Inserisci nella scheda aperta');
        ins.setAttribute('aria-label', _caT('cross_insert_value', 'Inserisci nella scheda aperta') + ': ' + etichetta);
        ins.innerHTML = '<i data-lucide="corner-down-left" class="w-3.5 h-3.5"></i>';
        ins.onclick = () => _caInserisciNelForm(campoId, valore, testo, etichetta);
        box.appendChild(ins);
    }
    return box;
}

/** Il controllo del form per quel campo: un input/textarea/select, o il contenitore di una lista. */
function _caControlloForm(campoId) {
    const lista = document.getElementById('container-' + campoId);
    if (lista) return { tipo: 'lista', el: lista };
    const id = typeof window.idControlloCampo === 'function' ? window.idControlloCampo(campoId) : null;
    const el = id ? document.getElementById(id) as any : null;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'checkbox' && el.type !== 'file') return { tipo: 'campo', el };
    return null;
}

/**
 * Mette il valore nel form APERTO, senza salvare: la scheda si salva come sempre, quando il
 * ricercatore lo decide. Un campo già compilato non si sovrascrive senza conferma; una lista
 * (persone, beni) riceve le righe in coda, perché lì aggiungere non toglie niente.
 */
function _caInserisciNelForm(campoId, valore, testo, etichetta) {
    const c = _caControlloForm(campoId);
    if (!c) return;
    const segnaModificato = () => { window.isFormDirty = true; };
    if (c.tipo === 'lista') {
        const conf = (typeof CONFIG_CAMPI !== 'undefined' && CONFIG_CAMPI[campoId]) || {};
        const righe = Array.isArray(valore) ? valore : [];
        for (const e of righe) {
            if (!e || typeof e !== 'object') continue;
            window.aggiungiElementoDinamico(campoId, conf.keyPlaceholder || '', conf.valPlaceholder || '', e.k || '', e.v !== undefined ? e.v : (e.nome || ''));
        }
        segnaModificato();
        mostraMessaggio(_caT('cross_value_inserted', 'Inserito in "{var0}".').replace('{var0}', etichetta), 'success');
        return;
    }
    const el = c.el;
    const nuovo = typeof valore === 'string' || typeof valore === 'number' ? String(valore) : testo;
    const scrivi = () => {
        el.value = nuovo;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        segnaModificato();
        mostraMessaggio(_caT('cross_value_inserted', 'Inserito in "{var0}".').replace('{var0}', etichetta), 'success');
    };
    if (String(el.value || '').trim() && String(el.value) !== nuovo) {
        window.mostraBottomConfirm(_caT('cross_insert_overwrite', 'Il campo "{var0}" è già compilato: sostituirne il contenuto?').replace('{var0}', etichetta), scrivi);
    } else {
        scrivi();
    }
}

// --- Copia della scheda intera -------------------------------------------------------------

let _caAnteprima = null;   // ultima risposta di crossArchiveGet mostrata
let _caCopia = null;       // { tipo, allegati, inCorso }

function _caDimensione(byte) {
    if (byte < 1024 * 1024) return Math.max(1, Math.round(byte / 1024)) + ' KB';
    return (byte / (1024 * 1024)).toFixed(byte < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
}

/** Gli allegati che si possono davvero copiare: file presenti su questo computer. */
function _caAllegatiCopiabili(r) {
    const allegati = Array.isArray(r.scheda.allegati) ? r.scheda.allegati : [];
    const dim = Array.isArray(r.dimensioniAllegati) ? r.dimensioniAllegati : [];
    const out = [];
    allegati.forEach((a, i) => { if (a && !a.remoto && typeof dim[i] === 'number') out.push({ posizione: i, byte: dim[i] }); });
    return out;
}

window.apriCopiaAltroArchivio = async function() {
    const r = _caAnteprima;
    const modal = document.getElementById('copia-archivio-modal');
    if (!r || !modal) return;
    const tipi = appData.tipiDocumento || [];
    const ultimo = typeof leggiUltimoTipoDocumento === 'function' ? leggiUltimoTipoDocumento() : null;
    const tipo = window.CopiaScheda.tipoCorrispondente(r.tipo, tipi) ||
        (ultimo && tipi.some(t => t.id === ultimo) ? ultimo : (tipi[0] && tipi[0].id));
    _caCopia = { tipo, allegati: false, inCorso: false };

    document.getElementById('copia-archivio-origine').textContent = _caT('cross_copy_from', 'Da: {var0} · {var1}')
        .replace('{var0}', r.archivio.nome).replace('{var1}', r.scheda.segnatura || _caT('cross_no_shelfmark', '(senza segnatura)'));

    const select = document.getElementById('copia-archivio-tipo') as HTMLSelectElement;
    select.innerHTML = '';
    for (const t of tipi) {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = t.nome || t.id;
        select.appendChild(o);
    }
    select.value = tipo || '';

    const copiabili = _caAllegatiCopiabili(r);
    const box = document.getElementById('copia-archivio-allegati') as HTMLInputElement;
    const etichetta = document.getElementById('copia-archivio-allegati-testo');
    box.checked = false;
    box.disabled = copiabili.length === 0;
    const byte = copiabili.reduce((s, a) => s + a.byte, 0);
    etichetta.textContent = copiabili.length
        ? _caT('cross_copy_attachments', 'Copia anche gli allegati ({var0} file, {var1})').replace('{var0}', String(copiabili.length)).replace('{var1}', _caDimensione(byte))
        : _caT('cross_copy_no_attachments', 'Nessun allegato da copiare su questo computer');

    // Avviso di visibilità: da un archivio non condiviso a uno condiviso la scheda diventa
    // visibile ai colleghi. Si dice prima, non dopo.
    const avviso = document.getElementById('copia-archivio-visibilita');
    avviso.classList.add('hidden');
    try {
        const cfg = await window.apiBrowser.getVaultConfig();
        if (cfg && cfg.vaultType === 'shared' && r.archivio.tipo !== 'shared') avviso.classList.remove('hidden');
    } catch (e) { /* senza configurazione nessun avviso: l'archivio è locale */ }

    document.getElementById('copia-archivio-progresso').textContent = '';
    _caAbilitaCopia(true);
    modal.classList.remove('hidden-tab');
    _caRiepilogoCopia();
};

window.chiudiCopiaAltroArchivio = function() {
    if (_caCopia && _caCopia.inCorso) return; // non si abbandona una copia di file a metà
    const modal = document.getElementById('copia-archivio-modal');
    if (modal) modal.classList.add('hidden-tab');
};

function _caAbilitaCopia(si) {
    for (const id of ['copia-archivio-conferma', 'copia-archivio-annulla', 'copia-archivio-tipo', 'copia-archivio-allegati']) {
        const el = document.getElementById(id) as any;
        if (!el) continue;
        if (id === 'copia-archivio-allegati' && si) el.disabled = _caAllegatiCopiabili(_caAnteprima).length === 0;
        else el.disabled = !si;
    }
}

function _caOpzioniCopia(autore, nuovoId, allegatiCopiati) {
    return {
        tipoDestinazione: _caCopia.tipo,
        cartella: window.cartellaAttuale || '',
        autore,
        ora: Date.now(),
        nuovoId,
        baseConf: typeof CONFIG_CAMPI !== 'undefined' ? CONFIG_CAMPI : undefined,
        etichetta: (id) => (window.etichettaCampo ? window.etichettaCampo(id) : id),
        copiaAllegati: _caCopia.allegati,
        allegatiCopiati
    };
}

/** Il riepilogo è il piano vero, calcolato con gli stessi parametri della copia. */
function _caRiepilogoCopia() {
    const r = _caAnteprima;
    const ul = document.getElementById('copia-archivio-riepilogo');
    if (!r || !ul || !_caCopia) return;
    // In anteprima i file non sono ancora copiati: si simula l'esito con i file presenti,
    // così i conteggi dicono ciò che succederà.
    const simulati = {};
    for (const a of _caAllegatiCopiabili(r)) simulati[a.posizione] = { nome: '…' };
    const piano = window.CopiaScheda.pianifica(r, appData, _caOpzioniCopia('', 'anteprima', simulati));

    ul.innerHTML = '';
    const voce = (testo, classe?) => ul.appendChild(_caEl('li', classe || '', testo));
    voce(_caT('cross_copy_type', 'Tipo di documento: {var0}').replace('{var0}', piano.tipo.nome));
    voce(window.cartellaAttuale
        ? _caT('cross_copy_folder', 'Cartella: {var0}').replace('{var0}', window.cartellaAttuale)
        : _caT('cross_copy_root', 'Cartella: radice dell\'archivio'));
    if (piano.campiPropri.length === 1) {
        voce(_caT('cross_copy_own_field_one', 'Un campo diventa campo proprio della scheda: {var0}').replace('{var0}', piano.campiPropri[0].label));
    } else if (piano.campiPropri.length) {
        voce(_caT('cross_copy_own_fields', '{var0} campi diventano campi propri della scheda: {var1}')
            .replace('{var0}', String(piano.campiPropri.length)).replace('{var1}', piano.campiPropri.map(c => c.label).join(', ')));
    }
    if (piano.anagrafica.length) {
        const nomi = piano.anagrafica.map(a => a.nome + ' (' + (a.esistente ? _caT('cross_copy_known', 'già in questo archivio') : _caT('cross_copy_new', 'nuovo')) + ')');
        voce(_caT('cross_copy_people', 'Persone e luoghi: {var0}').replace('{var0}', nomi.join(', ')));
    }
    if (piano.vociNuove.length) {
        voce(_caT('cross_copy_authority', 'Grafia e note dall\'anagrafica di origine: {var0}').replace('{var0}', piano.vociNuove.map(v => v.grafia).join(', ')));
    }
    if (piano.tagNuovi.length) voce(_caT('cross_copy_tags', 'Tag nuovi: {var0}').replace('{var0}', piano.tagNuovi.join(', ')));
    if (piano.rimandi) voce(_caT('cross_copy_links', '{var0} rimandi a schede dell\'archivio di origine').replace('{var0}', String(piano.rimandi)));
    const a = piano.allegati;
    if (_caCopia.allegati && (a.copiati || a.remoti || a.mancanti)) {
        voce(_caT('cross_copy_att_summary', 'Allegati: {var0} copiati, {var1} IIIF, {var2} non presenti su questo computer')
            .replace('{var0}', String(a.copiati)).replace('{var1}', String(a.remoti)).replace('{var2}', String(a.mancanti)));
    }
    if (piano.avvisi.includes('trascrizione_senza_allegati')) voce(_caT('cross_copy_transcription', 'Senza allegati la trascrizione resta sulla scheda, in un unico testo.'), 'text-stone-500');
    if (piano.avvisi.includes('trascrizioni_in_campo')) voce(_caT('cross_copy_transcriptions_field', 'Le trascrizioni delle carte non copiate vanno nel campo "Trascrizioni delle carte non copiate".'), 'text-stone-500');
    if (piano.avvisi.includes('vocabolario_esplicitato')) voce(_caT('cross_copy_vocab', 'I valori dei vocabolari di origine vengono scritti nei campi copiati: i vocabolari di questo archivio non cambiano.'), 'text-stone-500');
    voce(_caT('cross_copy_provenance', 'La copia ricorda da dove viene e non cambia se l\'originale viene modificato.'), 'text-stone-500');
}

window.confermaCopiaAltroArchivio = async function() {
    const r = _caAnteprima;
    if (!r || !_caCopia || _caCopia.inCorso) return;
    _caCopia.inCorso = true;
    _caAbilitaCopia(false);
    const progresso = document.getElementById('copia-archivio-progresso');
    let stacca = null;
    try {
        let autore = 'Anonimo';
        try { autore = (await window.apiSettings.get()).username || 'Anonimo'; } catch (e) { /* autore anonimo */ }
        const nuovoId = window.Model.nuovoId();

        const allegatiCopiati = {};
        const errori = [];
        const daCopiare = _caCopia.allegati ? _caAllegatiCopiabili(r).map(a => a.posizione) : [];
        if (daCopiare.length) {
            progresso.textContent = _caT('cross_copy_progress', 'Copia degli allegati: {var0} di {var1}…').replace('{var0}', '0').replace('{var1}', String(daCopiare.length));
            if (window.apiBrowser.onCrossArchiveCopiaProgresso) {
                stacca = window.apiBrowser.onCrossArchiveCopiaProgresso((p) => {
                    progresso.textContent = _caT('cross_copy_progress', 'Copia degli allegati: {var0} di {var1}…').replace('{var0}', String(p.fatti)).replace('{var1}', String(p.totale));
                });
            }
            const esito = await window.apiBrowser.crossArchiveCopiaAllegati(r.archivio.id, String(r.scheda.id), daCopiare, nuovoId);
            if (!esito || !esito.ok) throw new Error((esito && esito.error) || 'copia allegati');
            for (const c of esito.copiati) allegatiCopiati[c.posizione] = { nome: c.nome, hash: c.hash };
            for (const e of esito.errori) errori.push(e.errore);
        }

        const piano = window.CopiaScheda.pianifica(r, appData, _caOpzioniCopia(autore, nuovoId, allegatiCopiati));
        const applica = async () => {
            window.CopiaScheda.applica(appData, piano);
            await window.Store.commit();
        };
        // Annullare toglie la scheda; tag e voci d'anagrafica registrati restano (sono voci
        // senza schede, innocue). I file copiati diventano orfani e li toglie la pulizia
        // degli allegati non più citati.
        const annulla = async () => {
            appData.manoscritti = appData.manoscritti.filter(m => String(m.id) !== String(nuovoId));
            await window.Store.commit();
            if (typeof renderMain === 'function') renderMain(false);
        };
        await applica();
        if (window.gestoreAnnullamento) {
            window.gestoreAnnullamento.registraAzione(
                _caT('cross_copy_undo', 'Copia di {var0} da {var1}').replace('{var0}', piano.scheda.segnatura || nuovoId).replace('{var1}', r.archivio.nome),
                annulla, applica
            );
        }

        _caCopia.inCorso = false;
        window.chiudiCopiaAltroArchivio();
        window.chiudiAnteprimaAltroArchivio();
        if (typeof aggiornaSelectCartelle === 'function') aggiornaSelectCartelle();
        if (typeof renderSidebar === 'function') renderSidebar();
        if (typeof renderMain === 'function') renderMain(false);
        mostraMessaggio(
            _caT('cross_copy_done', 'Scheda copiata in questo archivio.') +
                (errori.length ? ' ' + _caT('cross_copy_some_failed', '{var0} allegati non copiati.').replace('{var0}', String(errori.length)) : ''),
            errori.length ? 'info' : 'success',
            () => window.gestoreAnnullamento && window.gestoreAnnullamento.annullaUltimaAzione()
        );
        if (window.rivelaRecordNellaGriglia) window.rivelaRecordNellaGriglia(nuovoId);
    } catch (e) {
        console.error('Copia da un altro archivio non riuscita:', e);
        progresso.textContent = '';
        mostraMessaggio(_caT('cross_copy_failed_all', 'Copia non riuscita: {var0}').replace('{var0}', e && e.message ? e.message : String(e)), 'error');
    } finally {
        if (stacca) stacca();
        if (_caCopia) _caCopia.inCorso = false;
        _caAbilitaCopia(true);
    }
};

function _caDisegnaAllegati(r, corpo) {
    const m = r.scheda;
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    const conTrascrizione = allegati.some(a => a && a.trascrizione);
    if (!allegati.length && !m.trascrizione) return;

    const sezione = _caEl('section', 'mt-4');
    sezione.appendChild(_caEl('h4', 'altri-archivi-sottotitolo', allegati.length
        ? _caT('cross_attachments', 'Allegati ({var0})').replace('{var0}', String(allegati.length))
        : _caT('cross_field_transcription', 'Trascrizione')));

    allegati.forEach((a, i) => {
        if (!a) return;
        const blocco = _caEl('div', 'altri-archivi-allegato');
        const nome = a.originalName || a.nome || '';
        blocco.appendChild(_caEl('div', 'text-xs font-semibold text-stone-600 dark:text-stone-300 truncate', nome));
        if (a.tipo === 'immagine' && !a.remoto) {
            const img = document.createElement('img');
            img.alt = nome;
            img.className = 'altri-archivi-immagine';
            blocco.appendChild(img);
            // Una per volta e solo quando serve: un fascicolo da cento carte non deve
            // caricare cento immagini per un'occhiata.
            _caCaricaImmagine(r.archivio.id, m.id, i, img, blocco);
        } else if (a.remoto && a.iiif && window.srcAllegato) {
            // Una carta IIIF non sta nella cartella di nessun archivio: il suo URL vale ovunque.
            const img = document.createElement('img');
            img.alt = nome;
            img.className = 'altri-archivi-immagine';
            img.loading = 'lazy';
            img.src = window.srcAllegato(a, { lato: 800 });
            blocco.appendChild(img);
        } else if (a.tipo === 'pdf') {
            blocco.appendChild(_caEl('p', 'text-xs text-stone-500', _caT('cross_pdf_hint', 'PDF: si apre dal suo archivio.')));
        }
        if (a.trascrizione) {
            const det = document.createElement('details');
            det.appendChild(_caEl('summary', 'text-xs cursor-pointer', _caT('cross_field_transcription', 'Trascrizione')));
            const testo = _caEl('div', 'altri-archivi-trascrizione');
            testo.innerHTML = window.sanitizeHTML(a.trascrizione);
            det.appendChild(testo);
            blocco.appendChild(det);
        }
        sezione.appendChild(blocco);
    });

    if (!conTrascrizione && m.trascrizione) {
        const testo = _caEl('div', 'altri-archivi-trascrizione');
        testo.innerHTML = window.sanitizeHTML(m.trascrizione);
        sezione.appendChild(testo);
    }
    corpo.appendChild(sezione);
}

async function _caCaricaImmagine(archivioId, schedaId, posizione, img, blocco) {
    let r;
    try {
        r = await window.apiBrowser.crossArchiveAllegato(archivioId, String(schedaId), posizione);
    } catch (e) {
        r = { ok: false, error: e && e.message ? e.message : String(e) };
    }
    if (!img.isConnected) return; // anteprima chiusa o cambiata
    if (!r || !r.ok) {
        img.remove();
        blocco.appendChild(_caEl('p', 'text-xs text-stone-500', (r && r.error) || ''));
        return;
    }
    const url = URL.createObjectURL(new Blob([r.dati], { type: r.mime }));
    _caUrlAnteprima.push(url);
    img.src = url;
}

// --- Rimandi ad altri archivi nel form (Fase 4) ----------------------------------------------
//
// Come le relazioni: l'elenco in modifica vive in un campo nascosto (#form-rimandi-esterni) e
// si scrive nel record solo al salvataggio (itemsLogic → Model.scriviRimandiEsterni).
// Un rimando a un archivio che qui non c'è NON si cancella: su un altro computer quell'archivio
// può esistere, e il rimando porta con sé nome dell'archivio e segnatura per dire di che cosa si
// tratta anche dove non si può aprire.

let _caArchiviCache = null;   // { quando, archivi }
let _caProvenienzaForm = null;
let _caSeqRimandi = 0;

async function _caArchiviConsultabili() {
    if (_caArchiviCache && Date.now() - _caArchiviCache.quando < 10_000) return _caArchiviCache.archivi;
    let archivi = [];
    try {
        const r = await window.apiBrowser.crossArchiveArchivi();
        if (r && r.ok) archivi = r.archivi.filter(a => !a.escluso && a.raggiungibile !== false);
    } catch (e) { console.warn('[ricerca-archivi] elenco archivi non disponibile:', e); }
    _caArchiviCache = { quando: Date.now(), archivi };
    return archivi;
}

/**
 * L'archivio di un rimando fra quelli consultabili: per id e, se l'id non c'è (archivio
 * clonato su un altro computer, che ha generato il suo), per nome — ma solo se il nome è
 * univoco, altrimenti si aprirebbe la scheda sbagliata.
 */
function _caRisolviArchivio(rif, archivi) {
    const perId = archivi.find(a => a.id === rif.archivioId);
    if (perId) return perId;
    const nome = window.Model.chiaveTesto(rif.archivioNome || '');
    if (!nome) return null;
    const omonimi = archivi.filter(a => window.Model.chiaveTesto(a.nome) === nome);
    return omonimi.length === 1 ? omonimi[0] : null;
}

window.rimandiEsterniForm = function() {
    const campo = document.getElementById('form-rimandi-esterni') as HTMLInputElement;
    if (!campo) return [];
    try { return window.Model.rimandiEsterni({ rimandiEsterni: JSON.parse(campo.value || '[]') }); }
    catch (e) { console.error('Campo rimandi esterni illeggibile, riparto da vuoto:', e); return []; }
};

function _caScriviRimandiForm(lista) {
    const campo = document.getElementById('form-rimandi-esterni') as HTMLInputElement;
    if (campo) campo.value = JSON.stringify(window.Model.rimandiEsterni({ rimandiEsterni: lista }));
}

window.caricaRimandiEsterniForm = function(m) {
    _caScriviRimandiForm(m ? window.Model.rimandiEsterni(m) : []);
    _caProvenienzaForm = m && m.provenienza && typeof m.provenienza === 'object' ? m.provenienza : null;
    _caArchiviCache = null; // gli archivi recenti possono essere cambiati dall'ultima apertura
    _caSuggAttivo = null;   // ...e l'impostazione del suggerimento
    _caSuggCache.clear();
    window.renderRimandiEsterniForm();
};

window.renderRimandiEsterniForm = async function() {
    const box = document.getElementById('form-rimandi-esterni-list');
    if (!box) return;
    const seq = ++_caSeqRimandi;
    const rimandi = window.rimandiEsterniForm();
    const archivi = (rimandi.length || _caProvenienzaForm) ? await _caArchiviConsultabili() : [];
    if (seq !== _caSeqRimandi) return; // nel frattempo il form è cambiato

    box.innerHTML = '';
    if (!rimandi.length) box.appendChild(_caEl('p', 'text-xs text-stone-400 italic', _caT('cross_links_none', 'Nessun rimando.')));
    for (const rif of rimandi) box.appendChild(_caRigaRimando(rif, _caRisolviArchivio(rif, archivi)));
    _caDisegnaProvenienza(archivi);
    if (window.lucide) lucide.createIcons({ nodes: [box, document.getElementById('form-provenienza')] });
};

function _caRigaRimando(rif, archivio) {
    const riga = _caEl('div', 'rel-riga');
    riga.dataset.rimando = rif.archivioId + ':' + rif.schedaId;
    riga.appendChild(_caEl('span', 'rel-tipo', rif.tipo || _caT('link_generic', 'collegata a')));
    const testo = _caEl('span', 'truncate min-w-0');
    const seg = _caEl('span', 'font-semibold', rif.segnatura || _caT('cross_no_shelfmark', '(senza segnatura)'));
    seg.translate = false;
    testo.appendChild(seg);
    testo.appendChild(document.createTextNode(' · ' + (archivio ? archivio.nome : (rif.archivioNome || rif.archivioId))));
    if (!archivio) testo.appendChild(_caEl('span', 'italic text-stone-400', ' — ' + _caT('cross_links_unavailable', 'archivio non disponibile su questo computer')));
    riga.appendChild(testo);

    const azioni = _caEl('span', 'ml-auto flex shrink-0');
    if (archivio) {
        const apri = _caEl('button', 'btn btn-ghost btn-icon') as HTMLButtonElement;
        apri.type = 'button';
        apri.dataset.apriRimando = '1';
        apri.title = _caT('cross_links_open', 'Apri l\'anteprima');
        apri.setAttribute('aria-label', _caT('cross_links_open', 'Apri l\'anteprima') + ': ' + (rif.segnatura || rif.schedaId));
        apri.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>';
        apri.onclick = () => window.apriAnteprimaAltroArchivio(archivio.id, rif.schedaId);
        azioni.appendChild(apri);
    }
    const via = _caEl('button', 'btn btn-ghost btn-icon text-red-600') as HTMLButtonElement;
    via.type = 'button';
    via.dataset.togliRimando = '1';
    via.title = _caT('cross_links_remove', 'Togli il rimando');
    via.setAttribute('aria-label', _caT('cross_links_remove', 'Togli il rimando') + ': ' + (rif.segnatura || rif.schedaId));
    via.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i>';
    via.onclick = () => {
        _caScriviRimandiForm(window.rimandiEsterniForm().filter(r => !(r.archivioId === rif.archivioId && r.schedaId === rif.schedaId)));
        window.isFormDirty = true;
        window.renderRimandiEsterniForm();
    };
    azioni.appendChild(via);
    riga.appendChild(azioni);
    return riga;
}

/** "Copiata da …": la provenienza di una scheda copiata, con il ritorno all'originale. */
function _caDisegnaProvenienza(archivi) {
    const p = document.getElementById('form-provenienza');
    if (!p) return;
    p.innerHTML = '';
    const prov = _caProvenienzaForm;
    p.classList.toggle('hidden', !prov);
    if (!prov) return;
    const quando = typeof prov.copiataIl === 'number'
        ? new Date(prov.copiataIl).toLocaleDateString(window.linguaAttuale || 'it', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
    p.appendChild(document.createTextNode(_caT('cross_provenance', 'Copiata da {var0} · {var1}, il {var2}.')
        .replace('{var0}', prov.archivioNome || prov.archivioId || '?')
        .replace('{var1}', prov.segnatura || _caT('cross_no_shelfmark', '(senza segnatura)'))
        .replace('{var2}', quando) + ' '));
    const archivio = _caRisolviArchivio(prov, archivi);
    if (archivio && prov.schedaId) {
        const btn = _caEl('button', 'underline hover:no-underline', _caT('cross_provenance_open', 'Apri l\'originale')) as HTMLButtonElement;
        btn.type = 'button';
        btn.id = 'form-provenienza-apri';
        btn.onclick = () => window.apriAnteprimaAltroArchivio(archivio.id, String(prov.schedaId));
        p.appendChild(btn);
    }
}

// --- Selettore del rimando ---------------------------------------------------------------

let _caPickerTimer = null;
let _caPickerSeq = 0;

window.apriSelettoreRimando = function() {
    const modal = document.getElementById('rimando-esterno-modal');
    if (!modal) return;
    const tipo = document.getElementById('rimando-esterno-tipo') as HTMLSelectElement;
    tipo.innerHTML = '';
    const senza = document.createElement('option');
    senza.value = '';
    senza.textContent = _caT('link_generic', 'collegata a');
    tipo.appendChild(senza);
    for (const v of window.Model.valoriVocabolario(appData, 'relazione')) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        tipo.appendChild(o);
    }
    const input = document.getElementById('rimando-esterno-cerca') as HTMLInputElement;
    input.value = '';
    document.getElementById('rimando-esterno-risultati').innerHTML = '';
    document.getElementById('rimando-esterno-stato').textContent = _caT('cross_links_picker_hint', 'Scrivi per cercare negli altri archivi.');
    modal.classList.remove('hidden-tab');
    setTimeout(() => input.focus(), 0);
};

window.chiudiSelettoreRimando = function() {
    clearTimeout(_caPickerTimer);
    _caPickerSeq++;
    const modal = document.getElementById('rimando-esterno-modal');
    if (modal) modal.classList.add('hidden-tab');
};

async function _caCercaPerRimando(testo) {
    const seq = ++_caPickerSeq;
    const stato = document.getElementById('rimando-esterno-stato');
    const lista = document.getElementById('rimando-esterno-risultati');
    if (!testo.trim()) {
        lista.innerHTML = '';
        stato.textContent = _caT('cross_links_picker_hint', 'Scrivi per cercare negli altri archivi.');
        return;
    }
    stato.textContent = _caT('cross_searching', 'Ricerca negli altri archivi…');
    let r;
    try { r = await window.apiBrowser.crossArchiveSearch({ testo, limite: 30, canale: 'rimando' }); }
    catch (e) { r = { ok: false, error: e && e.message ? e.message : String(e) }; }
    if (seq !== _caPickerSeq || (r && r.annullata)) return;
    if (!r || !r.ok) {
        stato.textContent = _caT('cross_error', 'Ricerca negli altri archivi non riuscita: {var0}').replace('{var0}', (r && r.error) || '?');
        return;
    }
    const nomi = new Map(r.archivi.map(a => [a.id, a.nome]));
    const gia = new Set(window.rimandiEsterniForm().map(x => x.archivioId + ':' + x.schedaId));
    lista.innerHTML = '';
    stato.textContent = r.totale
        ? _caT('cross_found_many', '{var0} schede in {var1} altri archivi').replace('{var0}', String(r.totale)).replace('{var1}', String(new Set(r.risultati.map(x => x.archivioId)).size))
        : _caT('cross_links_picker_none', 'Nessuna scheda trovata negli altri archivi.');
    for (const ris of r.risultati) {
        const li = _caEl('li');
        const btn = _caEl('button', 'altri-archivi-risultato') as HTMLButtonElement;
        btn.type = 'button';
        const testa = _caEl('span', 'altri-archivi-testa');
        testa.appendChild(_caEl('span', 'altri-archivi-segnatura', ris.segnatura || _caT('cross_no_shelfmark', '(senza segnatura)')));
        testa.appendChild(_caEl('span', 'altri-archivi-tipo', nomi.get(ris.archivioId) || ''));
        btn.appendChild(testa);
        const corpo = _caEl('span', 'altri-archivi-estratto');
        corpo.appendChild(document.createTextNode(ris.estratto.prima));
        if (ris.estratto.match) corpo.appendChild(_caEl('mark', '', ris.estratto.match));
        corpo.appendChild(document.createTextNode(ris.estratto.dopo));
        btn.appendChild(corpo);
        const chiave = ris.archivioId + ':' + ris.schedaId;
        if (gia.has(chiave)) {
            btn.disabled = true;
            testa.appendChild(_caEl('span', 'card-badge', _caT('cross_links_already', 'già collegata')));
        }
        btn.onclick = () => {
            const tipo = (document.getElementById('rimando-esterno-tipo') as HTMLSelectElement).value;
            const lista = window.rimandiEsterniForm();
            lista.push({ archivioId: ris.archivioId, archivioNome: nomi.get(ris.archivioId) || '', schedaId: ris.schedaId, segnatura: ris.segnatura, tipo });
            _caScriviRimandiForm(lista);
            window.isFormDirty = true;
            window.chiudiSelettoreRimando();
            window.renderRimandiEsterniForm();
        };
        li.appendChild(btn);
        lista.appendChild(li);
    }
}

/**
 * Le Impostazioni hanno cambiato archivi esclusi o suggerimento: niente risposte vecchie.
 * La sezione dei risultati, se è visibile, si ricalcola subito.
 */
window.invalidaCacheAltriArchivi = function() {
    _caArchiviCache = null;
    _caSuggAttivo = null;
    _caSuggCache.clear();
    _caUltima = { chiave: '', quando: 0 };
    window.aggiornaRicercaAltriArchivi(true);
};

// --- Suggerimento nel form (Fase 5) -------------------------------------------------------
//
// Su un campo che alimenta l'anagrafica (persona/luogo, anche dentro una lista dinamica),
// quando il ricercatore smette di scrivere o lascia il campo, si chiede al main se QUEL nome
// (stessa chiave d'anagrafica, non una somiglianza) compare negli altri archivi. Se sì,
// compare sotto il campo un pulsante discreto. Nessun popup, nessun focus rubato.
// ⚠️ Nessuna identità dichiarata (decisione del piano): il pulsante dice che il NOME esiste
// altrove; se è la stessa persona lo decide chi scheda.

const _CA_SUGG_MS = 600;
const _CA_SUGG_VALIDITA_MS = 30_000;
const _caSuggCache = new Map();   // chiave d'anagrafica → { quando, risposta }
let _caSuggAttivo = null;         // impostazione, riletta dopo _CA_SUGG_IMPOSTAZIONE_MS
let _caSuggLetta = 0;
/** Breve: chi spegne il suggerimento dalle impostazioni a form aperto deve vederlo sparire. */
const _CA_SUGG_IMPOSTAZIONE_MS = 2000;
let _caSuggTimer = null;

async function _caSuggerimentiAttivi() {
    if (_caSuggAttivo === null || Date.now() - _caSuggLetta > _CA_SUGG_IMPOSTAZIONE_MS) {
        try { _caSuggAttivo = (await window.apiSettings.get()).suggerimentiAltriArchivi !== false; }
        catch (e) { _caSuggAttivo = true; }
        _caSuggLetta = Date.now();
    }
    return _caSuggAttivo;
}

/** La definizione del campo a cui appartiene un controllo del form, se è persona/luogo. */
function _caDefAuthority(el) {
    if (!el || typeof window.campiDefinitiDelForm !== 'function') return null;
    let id = null;
    if (el.classList && el.classList.contains('list-val')) {
        const contenitore = el.closest('.dynamic-list-row') && el.closest('.dynamic-list-row').parentElement;
        if (contenitore && contenitore.id.indexOf('container-') === 0) id = contenitore.id.slice('container-'.length);
    } else if (el.id && el.id.indexOf('dyn-') === 0) {
        id = el.id;
    } else {
        return null;
    }
    const def = window.campiDefinitiDelForm().find(d => d.id === id || window.idControlloCampo(d.id) === id);
    return def && def.authority ? def : null;
}

function _caTogliSuggerimento(el) {
    if (el && el._caChip) { el._caChip.remove(); el._caChip = null; }
}

async function _caValutaSuggerimento(el) {
    const def = _caDefAuthority(el);
    if (!def || !(await _caSuggerimentiAttivi())) return;
    const nome = String(el.value || '').trim();
    const chiave = window.Model.chiaveAuthority(def.authority, nome);
    if (!chiave || window.Model.chiaveTesto(nome).length < 3) { _caTogliSuggerimento(el); el._caUltimo = null; return; }
    if (el._caUltimo === chiave) return; // già valutato, chip (o assenza di chip) già giusti
    _caTogliSuggerimento(el);
    el._caUltimo = chiave;

    let r;
    const inCache = _caSuggCache.get(chiave);
    if (inCache && Date.now() - inCache.quando < _CA_SUGG_VALIDITA_MS) {
        r = inCache.risposta;
    } else {
        try { r = await window.apiBrowser.crossArchiveSearch({ chiaveAnagrafica: chiave, limite: 50, canale: 'suggerimento' }); }
        catch (e) { r = null; }
        if (r && r.ok) _caSuggCache.set(chiave, { quando: Date.now(), risposta: r });
    }
    // Nel frattempo il valore è cambiato o il campo è sparito: questa risposta non vale più.
    if (!el.isConnected || el._caUltimo !== chiave) return;
    if (!r || !r.ok || !r.totale) return;
    _caMostraSuggerimento(el, def, nome, r);
}

function _caMostraSuggerimento(el, def, nome, r) {
    const archivi = new Set(r.risultati.map(x => x.archivioId)).size;
    const testo = r.totale === 1
        ? _caT('cross_hint_one', 'Trovato in un altro archivio')
        : archivi === 1
            ? _caT('cross_hint_many_one', 'Trovato in {var0} schede di un altro archivio').replace('{var0}', String(r.totale))
            : _caT('cross_hint_many', 'Trovato in {var0} schede di {var1} altri archivi').replace('{var0}', String(r.totale)).replace('{var1}', String(archivi));
    const chip = _caEl('button', 'suggerimento-altri-archivi') as HTMLButtonElement;
    chip.type = 'button';
    chip.dataset.suggerimento = def.id;
    chip.setAttribute('aria-label', testo + ': ' + nome);
    chip.innerHTML = '<i data-lucide="library" class="w-3.5 h-3.5" aria-hidden="true"></i>';
    chip.appendChild(_caEl('span', '', testo));
    chip.onclick = () => window.apriOmonimiAltriArchivi(nome, r);
    // In una lista dinamica il pulsante sta DENTRO la riga (che va a capo): togliendo la riga
    // se ne va anche lui, invece di restare orfano sotto la riga successiva.
    const riga = el.classList.contains('list-val') ? el.closest('.dynamic-list-row') : null;
    if (riga) { riga.classList.add('flex-wrap'); riga.appendChild(chip); }
    else el.insertAdjacentElement('afterend', chip);
    el._caChip = chip;
    if (window.lucide) lucide.createIcons({ nodes: [chip] });
    if (window.annunciaA11y) window.annunciaA11y(testo + ': ' + nome);
}

// --- Finestra delle schede con lo stesso nome ---------------------------------------------

window.apriOmonimiAltriArchivi = function(nome, r) {
    const modal = document.getElementById('omonimi-modal');
    const lista = document.getElementById('omonimi-lista');
    if (!modal || !lista) return;
    document.getElementById('omonimi-titolo').textContent = _caT('cross_namesakes_title', '{var0} negli altri archivi').replace('{var0}', nome);
    const nomi = new Map(r.archivi.map(a => [a.id, a.nome]));
    const gia = new Set(window.rimandiEsterniForm().map(x => x.archivioId + ':' + x.schedaId));
    lista.innerHTML = '';
    for (const ris of r.risultati) {
        const li = _caEl('li', 'omonimi-voce');
        const apri = _caEl('button', 'altri-archivi-risultato') as HTMLButtonElement;
        apri.type = 'button';
        const testa = _caEl('span', 'altri-archivi-testa');
        testa.appendChild(_caEl('span', 'altri-archivi-segnatura', ris.segnatura || _caT('cross_no_shelfmark', '(senza segnatura)')));
        testa.appendChild(_caEl('span', 'altri-archivi-tipo', [nomi.get(ris.archivioId), ris.tipoNome].filter(Boolean).join(' · ')));
        apri.appendChild(testa);
        const corpo = _caEl('span', 'altri-archivi-estratto');
        corpo.appendChild(_caEl('span', 'altri-archivi-campo', _caEtichettaCampo(ris) + ': '));
        corpo.appendChild(document.createTextNode(ris.estratto.prima));
        if (ris.estratto.match) corpo.appendChild(_caEl('mark', '', ris.estratto.match));
        corpo.appendChild(document.createTextNode(ris.estratto.dopo));
        apri.appendChild(corpo);
        apri.setAttribute('aria-label', _caT('cross_open_preview', 'Apri l\'anteprima di {var0} ({var1})')
            .replace('{var0}', ris.segnatura || ris.schedaId).replace('{var1}', nomi.get(ris.archivioId) || ''));
        apri.onclick = () => window.apriAnteprimaAltroArchivio(ris.archivioId, ris.schedaId);
        li.appendChild(apri);

        const collega = _caEl('button', 'btn btn-secondary shrink-0 omonimi-collega') as HTMLButtonElement;
        collega.type = 'button';
        const chiave = ris.archivioId + ':' + ris.schedaId;
        const segnaCollegata = () => {
            collega.disabled = true;
            collega.textContent = _caT('cross_links_already', 'già collegata');
        };
        collega.textContent = _caT('cross_namesakes_link', 'Collega');
        collega.title = _caT('cross_namesakes_link_title', 'Aggiungi un rimando a questa scheda');
        if (gia.has(chiave)) segnaCollegata();
        collega.onclick = () => {
            const rimandi = window.rimandiEsterniForm();
            rimandi.push({ archivioId: ris.archivioId, archivioNome: nomi.get(ris.archivioId) || '', schedaId: ris.schedaId, segnatura: ris.segnatura });
            _caScriviRimandiForm(rimandi);
            window.isFormDirty = true;
            window.renderRimandiEsterniForm();
            segnaCollegata();
        };
        li.appendChild(collega);
        lista.appendChild(li);
    }
    modal.classList.remove('hidden-tab');
};

window.chiudiOmonimiAltriArchivi = function() {
    const modal = document.getElementById('omonimi-modal');
    if (modal) modal.classList.add('hidden-tab');
};

// --- Montaggio ----------------------------------------------------------------------

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const box = document.getElementById('search-altri-archivi') as HTMLInputElement;
        if (box) {
            box.checked = _caAttiva();
            box.addEventListener('change', () => window.impostaRicercaAltriArchivi(box.checked));
        }
        const altri = document.getElementById('altri-archivi-altri');
        if (altri) altri.addEventListener('click', () => window.altriRisultatiAltriArchivi());
        const rimando = document.getElementById('btn-rimando-esterno');
        if (rimando) rimando.addEventListener('click', () => window.apriSelettoreRimando());

        // Suggerimento: delega sul form, perché le righe delle liste nascono e muoiono al volo.
        const form = document.getElementById('manoscritto-form');
        if (form) {
            form.addEventListener('input', (e) => {
                const el = e.target as any;
                if (!el || el.tagName !== 'INPUT') return;
                if (el._caUltimo && el._caChip) { _caTogliSuggerimento(el); el._caUltimo = null; }
                clearTimeout(_caSuggTimer);
                _caSuggTimer = setTimeout(() => _caValutaSuggerimento(el), _CA_SUGG_MS);
            });
            form.addEventListener('focusout', (e) => {
                const el = e.target as any;
                if (!el || el.tagName !== 'INPUT') return;
                clearTimeout(_caSuggTimer);
                _caValutaSuggerimento(el);
            });
        }

        if (document.getElementById('altro-archivio-modal')) return;
        // ⚠️ L'ordine nel DOM è l'ordine di sovrapposizione (stesso z-index): la finestra dei
        // nomi sta PRIMA dell'anteprima, che da lì si apre e deve comparirle sopra.
        const html = `
    <div id="omonimi-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-xl">
            <div class="modal-header">
                <h3 class="modal-title min-w-0">
                    <i data-lucide="library" class="w-5 h-5 text-amber-700 shrink-0"></i>
                    <span id="omonimi-titolo" class="truncate"></span>
                </h3>
            </div>
            <div class="modal-body">
                <p class="text-xs text-stone-500 dark:text-stone-400 mb-2" data-i18n="cross_namesakes_hint">Stesso nome, non per forza la stessa persona: aprile per decidere.</p>
                <ul id="omonimi-lista" class="altri-archivi-elenco max-h-[55vh] overflow-y-auto custom-scroll"></ul>
                <div class="modal-footer">
                    <button type="button" id="omonimi-chiudi" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div id="altro-archivio-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-2xl">
            <div class="modal-header">
                <h3 class="modal-title min-w-0">
                    <i data-lucide="archive" class="w-5 h-5 text-amber-700 shrink-0"></i>
                    <span class="min-w-0">
                        <span id="altro-archivio-titolo" class="block truncate"></span>
                        <span id="altro-archivio-sottotitolo" class="block text-xs font-normal text-stone-500 dark:text-stone-400 truncate"></span>
                    </span>
                </h3>
            </div>
            <div class="modal-body">
                <div id="altro-archivio-corpo" class="max-h-[65vh] overflow-y-auto custom-scroll"></div>
                <div class="modal-footer">
                    <button type="button" id="altro-archivio-chiudi" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                    <button type="button" id="altro-archivio-copia" class="hidden btn btn-primary">
                        <i data-lucide="copy-plus" class="w-4 h-4"></i>
                        <span data-i18n="cross_copy_button">Copia in questo archivio</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div id="copia-archivio-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="copy-plus" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="cross_copy_title">Copia in questo archivio</span>
                </h3>
            </div>
            <div class="modal-body">
                <p id="copia-archivio-origine" class="text-sm text-stone-600 dark:text-stone-300 mb-3"></p>
                <label for="copia-archivio-tipo" class="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1" data-i18n="cross_copy_type_label">Tipo di documento in questo archivio</label>
                <select id="copia-archivio-tipo" class="form-input w-full mb-3"></select>
                <label class="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200 mb-3 cursor-pointer">
                    <input type="checkbox" id="copia-archivio-allegati" class="shrink-0">
                    <span id="copia-archivio-allegati-testo"></span>
                </label>
                <p id="copia-archivio-visibilita" class="hidden text-sm p-2 mb-3 rounded-sm copia-archivio-avviso" role="note" data-i18n="cross_copy_shared_warning">Questo archivio è condiviso: la scheda copiata sarà visibile ai suoi membri.</p>
                <h4 class="altri-archivi-sottotitolo" data-i18n="cross_copy_summary">Che cosa succederà</h4>
                <ul id="copia-archivio-riepilogo" class="copia-archivio-riepilogo"></ul>
                <p id="copia-archivio-progresso" class="text-sm text-stone-600 dark:text-stone-300 mt-2" role="status" aria-live="polite"></p>
                <div class="modal-footer">
                    <button type="button" id="copia-archivio-annulla" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_cancel">Annulla</span>
                    </button>
                    <button type="button" id="copia-archivio-conferma" class="btn btn-primary">
                        <span data-i18n="cross_copy_confirm">Copia</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    <div id="rimando-esterno-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="library" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="cross_links_picker_title">Rimando a un altro archivio</span>
                </h3>
            </div>
            <div class="modal-body">
                <label for="rimando-esterno-tipo" class="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1" data-i18n="cross_links_type_label">Tipo di rimando</label>
                <select id="rimando-esterno-tipo" class="form-input w-full mb-3"></select>
                <label for="rimando-esterno-cerca" class="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1" data-i18n="cross_links_search_label">Scheda da collegare</label>
                <input type="text" id="rimando-esterno-cerca" class="form-input w-full" data-i18n-placeholder="cross_links_search_placeholder" placeholder="Segnatura, persona, luogo…">
                <p id="rimando-esterno-stato" class="text-xs text-stone-500 dark:text-stone-400 mt-2" role="status" aria-live="polite"></p>
                <ul id="rimando-esterno-risultati" class="altri-archivi-elenco max-h-[45vh] overflow-y-auto custom-scroll mt-1"></ul>
                <div class="modal-footer">
                    <button type="button" id="rimando-esterno-annulla" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_cancel">Annulla</span>
                    </button>
                </div>
            </div>
        </div>
    </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('altro-archivio-chiudi').addEventListener('click', () => window.chiudiAnteprimaAltroArchivio());
        document.getElementById('altro-archivio-copia').addEventListener('click', () => window.apriCopiaAltroArchivio());
        document.getElementById('copia-archivio-annulla').addEventListener('click', () => window.chiudiCopiaAltroArchivio());
        document.getElementById('copia-archivio-conferma').addEventListener('click', () => window.confermaCopiaAltroArchivio());
        document.getElementById('rimando-esterno-annulla').addEventListener('click', () => window.chiudiSelettoreRimando());
        document.getElementById('omonimi-chiudi').addEventListener('click', () => window.chiudiOmonimiAltriArchivi());
        document.getElementById('rimando-esterno-cerca').addEventListener('input', (e) => {
            const testo = (e.target as HTMLInputElement).value;
            clearTimeout(_caPickerTimer);
            _caPickerTimer = setTimeout(() => _caCercaPerRimando(testo), _CA_DEBOUNCE_MS);
        });
        document.getElementById('copia-archivio-tipo').addEventListener('change', (e) => {
            if (_caCopia) { _caCopia.tipo = (e.target as HTMLSelectElement).value; _caRiepilogoCopia(); }
        });
        document.getElementById('copia-archivio-allegati').addEventListener('change', (e) => {
            if (_caCopia) { _caCopia.allegati = (e.target as HTMLInputElement).checked; _caRiepilogoCopia(); }
        });
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: ['omonimi-modal', 'altro-archivio-modal', 'copia-archivio-modal', 'rimando-esterno-modal'].map(id => document.getElementById(id)) });
    });
})();
