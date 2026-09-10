// @ts-nocheck
// Fase 1.3 — Pannello filtri avanzati e ricerche salvate.
//
// Fino alla 2.4.6 i filtri erano esattamente tre (cartella, testo, tag) e vivevano in tre
// punti diversi dell'interfaccia. Qui si aggiungono tipo documento, cartella con
// sottoarchivi, intervallo di data modifica, presenza di allegati e di trascrizione, più
// le combinazioni salvate con un nome.
//
// I predicati NON stanno qui: sono funzioni pure in logic/utils.ts (`recordPassaFiltri`,
// `recordPassaCampi`, `cartellaNelSottoalbero`), applicate da `getManoscrittiFiltrati`.
// Questo file è solo la superficie: stato, pannello, persistenza.

window.filtriAvanzati = window.filtriAvanzati || {
    tipo: '',
    sottocartelle: false,
    daData: '',
    aData: '',
    // Fase 3.2 — periodo STORICO del documento (anni), da non confondere con daData/aData,
    // che sono la data di ultima modifica della scheda.
    daAnno: '',
    aAnno: '',
    allegati: '',       // '' | 'si' | 'no'
    trascrizione: '',   // '' | 'si' | 'no'
    ocr: '',            // '' | 'si' | 'no' — Fase 2.3
    collegamenti: ''    // '' | 'si' | 'no' — Fase 3.5
};

window.ricercheSalvate = window.ricercheSalvate || [];

let _pannello = null;
let _ancoraFiltri = null;

function _chiudiSuPointerDown(e) {
    if (_pannello && _pannello.contains(e.target)) return;
    if (_ancoraFiltri && _ancoraFiltri.contains(e.target)) return;   // il click sull'ancora fa toggle
    window.chiudiPannelloFiltri(false);
}

function _chiudiSuScroll(e) {
    // Lo scroll DENTRO il pannello (elenco di ricerche salvate lungo) non deve chiuderlo.
    if (_pannello && e.target && e.target.nodeType === 1 && _pannello.contains(e.target)) return;
    window.chiudiPannelloFiltri(false);
}

/**
 * Esc è agganciato al DOCUMENTO, non al pannello. Cambiare un filtro ricostruisce il
 * corpo (`_riempiPannello`), quindi il controllo che aveva il fuoco sparisce e il fuoco
 * torna al body: un handler agganciato al solo pannello smetterebbe di ricevere i tasti
 * proprio dopo la prima interazione, lasciando il pannello aperto e senza via d'uscita
 * da tastiera. `_riempiPannello` rimette comunque il fuoco dov'era (vedi sotto): questo
 * è la rete di sicurezza per i casi in cui non ci riesce.
 */
function _onKeyDownFiltri(e) {
    if (!_pannello) return;
    if (e.key === 'Escape') {
        e.stopPropagation();
        window.chiudiPannelloFiltri(true);
    }
}

window.chiudiPannelloFiltri = function(ripristinaFuoco = false) {
    if (!_pannello) return;
    document.removeEventListener('mousedown', _chiudiSuPointerDown, true);
    document.removeEventListener('keydown', _onKeyDownFiltri, true);
    window.removeEventListener('scroll', _chiudiSuScroll, true);
    window.removeEventListener('resize', _chiudiSuScroll);
    _pannello.remove();
    _pannello = null;
    const ancora = _ancoraFiltri;
    _ancoraFiltri = null;
    if (ancora) {
        ancora.setAttribute('aria-expanded', 'false');
        if (ripristinaFuoco && document.contains(ancora)) ancora.focus();
    }
};

/**
 * Applica una modifica parziale ai filtri e ridisegna. Passa sempre da qui: è l'unico
 * punto che ricorda di ridisegnare la lista E di persistere lo stato, ed è ciò che
 * permette ai chip dei filtri attivi di rimuovere un filtro con la stessa chiamata dei
 * controlli del pannello.
 */
window.applicaFiltriAvanzati = function(patch) {
    window.filtriAvanzati = Object.assign({}, window.filtriAvanzati, patch || {});
    if (typeof renderMain === 'function') renderMain();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
    if (_pannello) _riempiPannello();
};

window.azzeraFiltriAvanzati = function(ridisegna = true) {
    window.filtriAvanzati = { tipo: '', sottocartelle: false, daData: '', aData: '', daAnno: '', aAnno: '', allegati: '', trascrizione: '', ocr: '', collegamenti: '' };
    if (ridisegna) {
        if (typeof renderMain === 'function') renderMain();
        if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
        if (_pannello) _riempiPannello();
    }
};

// --- Ricerche salvate --------------------------------------------------------

function _idRicerca() {
    return 'rs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/** Fotografia completa del contesto di ricerca: query, tag, filtri avanzati e cartella. */
window.salvaRicercaCorrente = function(nome) {
    const etichetta = String(nome || '').trim();
    if (!etichetta) return null;
    const input = document.getElementById('search-input');
    const voce = {
        id: _idRicerca(),
        nome: etichetta.slice(0, 60),
        ricerca: input ? input.value : '',
        tag: window.activeTags ? Array.from(window.activeTags) : [],
        filtri: Object.assign({}, window.filtriAvanzati),
        // La cartella fa parte della ricerca: "Notarile con allegati" senza il ramo di
        // partenza sarebbe una ricerca diversa a ogni richiamo.
        cartella: typeof window.cartellaAttuale === 'string' ? window.cartellaAttuale : ''
    };
    // Ri-salvare con lo stesso nome aggiorna, non duplica: due voci identiche nell'elenco
    // sarebbero indistinguibili e la seconda non si potrebbe più scegliere di proposito.
    window.ricercheSalvate = [voce].concat((window.ricercheSalvate || []).filter(r => r.nome !== voce.nome));
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
    if (_pannello) _riempiPannello();
    return voce;
};

window.applicaRicercaSalvata = function(id) {
    const voce = (window.ricercheSalvate || []).find(r => r.id === id);
    if (!voce) return;

    // ORDINE OBBLIGATORIO: prima la cartella, poi il resto. `vaiACartella` chiama
    // `azzeraFiltriRicerca`, che azzera ricerca, tag E filtri avanzati: invertire i due
    // passi cancellerebbe la ricerca appena applicata.
    const destinazione = typeof voce.cartella === 'string' ? voce.cartella : '';
    if (destinazione && destinazione !== window.cartellaAttuale && typeof window.vaiACartella === 'function') {
        window.vaiACartella(destinazione);
    } else if (!destinazione) {
        window.cartellaAttuale = '';
    }

    const input = document.getElementById('search-input');
    if (input) input.value = voce.ricerca || '';
    window.activeTags = new Set(Array.isArray(voce.tag) ? voce.tag : []);
    window.filtriAvanzati = Object.assign(
        { tipo: '', sottocartelle: false, daData: '', aData: '', daAnno: '', aAnno: '', allegati: '', trascrizione: '', ocr: '', collegamenti: '' },
        voce.filtri || {}
    );

    if (typeof renderTagList === 'function') renderTagList();
    if (typeof renderSearchSuggestions === 'function') renderSearchSuggestions();
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderMain === 'function') renderMain();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
    window.chiudiPannelloFiltri(false);
};

window.eliminaRicercaSalvata = function(id) {
    window.ricercheSalvate = (window.ricercheSalvate || []).filter(r => r.id !== id);
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
    if (_pannello) _riempiPannello();
};

// --- Pannello ----------------------------------------------------------------

function _riga(etichetta, controllo) {
    const wrap = document.createElement('label');
    wrap.className = 'flex items-center justify-between gap-3 text-sm';
    const span = document.createElement('span');
    span.className = 'text-stone-600 dark:text-stone-300 shrink-0';
    span.textContent = etichetta;
    wrap.append(span, controllo);
    return wrap;
}

function _select(valore, opzioni, onChange) {
    const sel = document.createElement('select');
    sel.className = 'form-input py-1 text-sm min-w-[9rem] max-w-[11rem]';
    for (const o of opzioni) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;   // textContent: i nomi dei tipi sono dati dell'utente
        sel.appendChild(opt);
    }
    sel.value = valore || '';
    sel.onchange = () => onChange(sel.value);
    return sel;
}

function _riempiPannello() {
    if (!_pannello) return;
    const f = window.filtriAvanzati || {};
    const corpo = _pannello.querySelector('[data-corpo]');
    // Ogni modifica ricostruisce il corpo (serve: cambia lo stato di "Azzera", l'elenco
    // delle ricerche, i valori). Il controllo che aveva il fuoco viene però distrutto, e
    // con lui la posizione di chi naviga da tastiera: si annota l'id e lo si ridà dopo.
    const idAttivo = document.activeElement && corpo.contains(document.activeElement)
        ? document.activeElement.id
        : null;
    corpo.innerHTML = '';

    const T = (k, d) => window.t(k, d);

    // Tipo documento
    const tipi = [{ value: '', label: T('filter_any', 'Qualsiasi') }];
    for (const t of ((typeof appData !== 'undefined' && appData.tipiDocumento) || [])) {
        const nome = window.t('model_' + t.id) !== 'model_' + t.id ? window.t('model_' + t.id) : t.nome;
        tipi.push({ value: t.id, label: nome });
    }
    const selTipo = _select(f.tipo, tipi, v => window.applicaFiltriAvanzati({ tipo: v }));
    selTipo.id = 'filtro-tipo';
    corpo.appendChild(_riga(T('filter_type', 'Tipo'), selTipo));

    // Cartella con sottoarchivi
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = 'filtro-sottocartelle';
    chk.className = 'w-4 h-4 accent-amber-700';
    chk.checked = !!f.sottocartelle;
    chk.onchange = () => window.applicaFiltriAvanzati({ sottocartelle: chk.checked });
    corpo.appendChild(_riga(T('filter_subfolders', 'Includi sottoarchivi'), chk));

    // Intervallo di data modifica
    const mkData = (id, valore, chiave) => {
        const el = document.createElement('input');
        el.type = 'date';
        el.id = id;
        el.className = 'form-input py-1 text-sm';
        el.value = valore || '';
        el.onchange = () => window.applicaFiltriAvanzati({ [chiave]: el.value });
        return el;
    };
    corpo.appendChild(_riga(T('filter_from', 'Dal'), mkData('filtro-da-data', f.daData, 'daData')));
    corpo.appendChild(_riga(T('filter_to', 'Al'), mkData('filtro-a-data', f.aData, 'aData')));

    // --- Fase 3.2: periodo storico del DOCUMENTO -----------------------------------------
    // Sta sotto l'intervallo di modifica e con un'intestazione propria, perché sono due date
    // diverse che l'interfaccia ha sempre avuto il dovere di non confondere: una è quando la
    // scheda è stata toccata, l'altra è quando il documento è stato scritto.
    const titoloPeriodo = document.createElement('div');
    titoloPeriodo.className = 'form-label mt-2 pt-2 border-t';
    titoloPeriodo.style.borderColor = 'var(--color-border-light)';
    titoloPeriodo.textContent = T('filter_period', 'Periodo del documento');
    corpo.appendChild(titoloPeriodo);

    const mkAnno = (id, valore, chiave, segnaposto) => {
        const el = document.createElement('input');
        // `number` e non `date`: una datazione storica non ha giorno e mese, e un selettore
        // di calendario per il Trecento è un controllo che chiede più di quanto si sappia.
        el.type = 'number';
        el.id = id;
        el.className = 'form-input py-1 text-sm';
        el.placeholder = segnaposto;
        el.value = valore === 0 || valore ? String(valore) : '';
        el.min = String(window.DataStorica ? window.DataStorica.ANNO_MIN : 500);
        el.max = String(window.DataStorica ? window.DataStorica.ANNO_MAX : 2200);
        el.onchange = () => window.applicaFiltriAvanzati({ [chiave]: el.value });
        return el;
    };
    corpo.appendChild(_riga(T('filter_year_from', 'Dall\'anno'), mkAnno('filtro-da-anno', f.daAnno, 'daAnno', '1300')));
    corpo.appendChild(_riga(T('filter_year_to', 'All\'anno'), mkAnno('filtro-a-anno', f.aAnno, 'aAnno', '1400')));

    // Scorciatoia per secolo: "sec. XIV" è il modo in cui la domanda viene posta davvero,
    // e comporre 1301/1400 a mano ogni volta è il genere di attrito che fa smettere di
    // usare un filtro.
    const secoli = [{ value: '', label: T('filter_any_century', 'Qualsiasi secolo') }];
    for (let n = 11; n <= 20; n++) {
        const romani = ['XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'][n - 11];
        secoli.push({ value: String(n), label: 'sec. ' + romani + ' (' + ((n - 1) * 100 + 1) + '-' + (n * 100) + ')' });
    }
    const selSecolo = _select('', secoli, (v) => {
        if (!v) { window.applicaFiltriAvanzati({ daAnno: '', aAnno: '' }); return; }
        const n = Number(v);
        window.applicaFiltriAvanzati({ daAnno: String((n - 1) * 100 + 1), aAnno: String(n * 100) });
    });
    selSecolo.id = 'filtro-secolo';
    corpo.appendChild(_riga(T('filter_century', 'Secolo'), selSecolo));

    const treStati = [
        { value: '', label: T('filter_any', 'Qualsiasi') },
        { value: 'si', label: T('filter_yes', 'Sì') },
        { value: 'no', label: T('filter_no', 'No') }
    ];
    const selAllegati = _select(f.allegati, treStati, v => window.applicaFiltriAvanzati({ allegati: v }));
    selAllegati.id = 'filtro-allegati';
    corpo.appendChild(_riga(T('filter_attachments', 'Allegati'), selAllegati));

    const selTrasc = _select(f.trascrizione, treStati, v => window.applicaFiltriAvanzati({ trascrizione: v }));
    selTrasc.id = 'filtro-trascrizione';
    corpo.appendChild(_riga(T('filter_transcription', 'Trascrizione'), selTrasc));

    // Fase 2.3: "senza OCR" è la lista di lavoro di chi sta riconoscendo un fondo intero.
    const selOcr = _select(f.ocr, treStati, v => window.applicaFiltriAvanzati({ ocr: v }));
    selOcr.id = 'filtro-ocr';
    corpo.appendChild(_riga(T('filter_ocr', 'Testo OCR'), selOcr));

    // Fase 3.5: "senza collegamenti" è la domanda di chi sta tessendo i rimandi di un fondo
    // e vuole sapere che cosa gli resta da collegare.
    const selColl = _select(f.collegamenti, treStati, v => window.applicaFiltriAvanzati({ collegamenti: v }));
    selColl.id = 'filtro-collegamenti';
    corpo.appendChild(_riga(T('filter_links', 'Collegamenti'), selColl));

    // Promemoria della sintassi campo:valore, che nessuno indovinerebbe da solo.
    const hint = document.createElement('p');
    hint.className = 'text-xs text-stone-500 dark:text-stone-400 leading-relaxed border-t border-stone-200 dark:border-stone-700 pt-2';
    hint.textContent = T('filter_query_hint', 'Nella ricerca puoi scrivere campo:valore — per esempio notaio:rossi, tag:pergamena, oppure "frase esatta".');
    corpo.appendChild(hint);

    const azzera = document.createElement('button');
    azzera.type = 'button';
    azzera.id = 'btn-azzera-filtri-avanzati';
    azzera.className = 'btn btn-ghost w-full justify-center text-sm';
    azzera.textContent = T('btn_clear_advanced', 'Azzera i filtri');
    azzera.disabled = window.contaFiltriAvanzati(f) === 0;
    azzera.onclick = () => window.azzeraFiltriAvanzati();
    corpo.appendChild(azzera);

    // --- Ricerche salvate ---
    const sez = document.createElement('div');
    sez.className = 'border-t border-stone-200 dark:border-stone-700 pt-3 flex flex-col gap-2';

    const titolo = document.createElement('div');
    titolo.className = 'text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400';
    titolo.textContent = T('label_saved_searches', 'Ricerche salvate');
    sez.appendChild(titolo);

    const elenco = document.createElement('div');
    elenco.id = 'elenco-ricerche-salvate';
    elenco.className = 'flex flex-col gap-1 max-h-40 overflow-y-auto';
    const salvate = window.ricercheSalvate || [];
    if (salvate.length === 0) {
        const vuoto = document.createElement('p');
        vuoto.className = 'text-xs italic text-stone-400';
        vuoto.textContent = T('empty_saved_searches', 'Nessuna ricerca salvata.');
        elenco.appendChild(vuoto);
    }
    for (const r of salvate) {
        const riga = document.createElement('div');
        riga.className = 'flex items-center gap-1';
        const applica = document.createElement('button');
        applica.type = 'button';
        applica.className = 'flex-1 text-left text-sm px-2 py-1 rounded-sm truncate hover:bg-stone-100 dark:hover:bg-stone-800';
        applica.textContent = r.nome;      // textContent: nome scelto dall'utente
        applica.title = r.nome;
        applica.dataset.ricercaId = r.id;
        applica.onclick = () => window.applicaRicercaSalvata(r.id);
        const elimina = document.createElement('button');
        elimina.type = 'button';
        elimina.className = 'shrink-0 p-1 rounded-sm text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20';
        const etichettaElimina = T('btn_delete_saved_search', 'Elimina questa ricerca');
        elimina.title = etichettaElimina;
        elimina.setAttribute('aria-label', etichettaElimina + ': ' + r.nome);
        elimina.dataset.eliminaRicercaId = r.id;
        elimina.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
        elimina.onclick = () => window.eliminaRicercaSalvata(r.id);
        riga.append(applica, elimina);
        elenco.appendChild(riga);
    }
    sez.appendChild(elenco);

    const salvaRiga = document.createElement('div');
    salvaRiga.className = 'flex items-center gap-1';
    const nome = document.createElement('input');
    nome.type = 'text';
    nome.id = 'input-nome-ricerca';
    nome.className = 'form-input py-1 text-sm flex-1 min-w-0';
    nome.placeholder = T('placeholder_saved_search', 'Nome della ricerca');
    nome.maxLength = 60;
    const salva = document.createElement('button');
    salva.type = 'button';
    salva.id = 'btn-salva-ricerca';
    salva.className = 'btn btn-secondary text-sm shrink-0';
    salva.textContent = T('btn_save_search', 'Salva');
    const conferma = () => {
        if (!nome.value.trim()) return;
        window.salvaRicercaCorrente(nome.value);
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(T('msg_saved_search', 'Ricerca salvata.'), 'success');
        }
    };
    salva.onclick = conferma;
    nome.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); conferma(); } };
    salvaRiga.append(nome, salva);
    sez.appendChild(salvaRiga);

    corpo.appendChild(sez);

    if (window.lucide) lucide.createIcons({ nodes: [corpo] });

    if (idAttivo) {
        const tornato = corpo.querySelector('#' + CSS.escape(idAttivo));
        if (tornato) tornato.focus();
    }
}

/**
 * Apre il pannello ancorato al pulsante. Non riusa `apriMenuContestuale`: quello sa
 * disegnare voci cliccabili, non select, date e campi di testo — e la sua navigazione a
 * frecce fra `menuitem` sarebbe sbagliata su un modulo da compilare.
 */
window.apriPannelloFiltri = function(ancora) {
    if (_pannello) { window.chiudiPannelloFiltri(true); return; }   // toggle

    const btn = ancora || document.getElementById('btn-filtri');
    _ancoraFiltri = btn;
    if (btn) btn.setAttribute('aria-expanded', 'true');

    const box = document.createElement('div');
    box.id = 'pannello-filtri';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', window.t('tooltip_filters', 'Filtri avanzati e ricerche salvate'));
    box.className = 'fixed z-menu w-[22rem] max-w-[calc(100vw-1rem)] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-xl rounded-md p-3 text-stone-800 dark:text-stone-100';
    box.style.left = '-9999px';
    box.style.top = '0px';
    box.innerHTML = '<div data-corpo class="flex flex-col gap-3"></div>';
    document.body.appendChild(box);
    _pannello = box;
    _riempiPannello();

    // Posizionamento a dimensioni reali, come il menu contestuale: sotto l'ancora,
    // allineato a destra, ribaltato sopra se non ci sta.
    const margine = 8;
    const l = box.offsetWidth;
    const h = box.offsetHeight;
    let x = margine;
    let y = margine;
    if (btn) {
        const r = btn.getBoundingClientRect();
        x = r.right - l;
        y = r.bottom + 4;
        if (y + h > window.innerHeight - margine) y = Math.max(margine, r.top - h - 4);
    }
    box.style.left = Math.max(margine, Math.min(x, window.innerWidth - l - margine)) + 'px';
    box.style.top = Math.max(margine, Math.min(y, window.innerHeight - h - margine)) + 'px';

    const primo = box.querySelector('select, input, button');
    if (primo) primo.focus();

    document.addEventListener('mousedown', _chiudiSuPointerDown, true);
    document.addEventListener('keydown', _onKeyDownFiltri, true);
    window.addEventListener('scroll', _chiudiSuScroll, true);
    window.addEventListener('resize', _chiudiSuScroll);
};
