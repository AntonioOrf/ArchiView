window.filtriVuoti = function() {
    return { tipo: '', sottocartelle: false, daData: '', aData: '', daAnno: '', aAnno: '', allegati: '', trascrizione: '', ocr: '', collegamenti: '', statoCarte: '' };
};

window.filtriValidi = function(salvati) {
    const f = window.filtriVuoti();
    if (!salvati || typeof salvati !== 'object') return f;
    const siNo = (v) => (v === 'si' || v === 'no' ? v : '');
    const anno = (v) => (/^\d{3,4}$/.test(String(v || '')) ? String(v) : '');
    f.tipo = typeof salvati.tipo === 'string' ? salvati.tipo : '';
    f.sottocartelle = !!salvati.sottocartelle;
    f.daData = typeof salvati.daData === 'string' ? salvati.daData : '';
    f.aData = typeof salvati.aData === 'string' ? salvati.aData : '';
    f.daAnno = anno(salvati.daAnno);
    f.aAnno = anno(salvati.aAnno);
    f.allegati = siNo(salvati.allegati);
    f.trascrizione = siNo(salvati.trascrizione);
    f.ocr = siNo(salvati.ocr);
    f.collegamenti = siNo(salvati.collegamenti);
    f.statoCarte = (window.STATI_CARTA || []).includes(salvati.statoCarte) ? salvati.statoCarte : '';
    return f;
};

window.filtriAvanzati = window.filtriAvanzati || window.filtriVuoti();

window.ricercheSalvate = window.ricercheSalvate || [];

let _pannello = null;
let _ancoraFiltri = null;

function _chiudiSuPointerDown(e) {
    if (_pannello && _pannello.contains(e.target)) return;
    if (_ancoraFiltri && _ancoraFiltri.contains(e.target)) return;
    window.chiudiPannelloFiltri(false);
}

function _chiudiSuScroll(e) {
    if (_pannello && e && e.target && e.target.nodeType === 1 && _pannello.contains(e.target)) return;
    if (_ancoraFiltri && !_ancoraFiltri.isConnected && _ancoraFiltri.id) {
        const nuova = document.getElementById(_ancoraFiltri.id);
        if (nuova) { nuova.setAttribute('aria-expanded', 'true'); _ancoraFiltri = nuova; }
    }
    if (_ancoraFiltri && _ancoraFiltri.isConnected) {
        const r = _ancoraFiltri.getBoundingClientRect();
        if (r.width > 0 && r.bottom > 0 && r.top < window.innerHeight) { _posizionaPannello(); return; }
    }
    window.chiudiPannelloFiltri(false);
}

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

window.applicaFiltriAvanzati = function(patch) {
    window.filtriAvanzati = Object.assign({}, window.filtriAvanzati, patch || {});
    if (typeof renderMain === 'function') renderMain();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
    if (_pannello) _riempiPannello();
};

window.azzeraFiltriAvanzati = function(ridisegna = true) {
    window.filtriAvanzati = window.filtriVuoti();
    if (ridisegna) {
        if (typeof renderMain === 'function') renderMain();
        if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
        if (_pannello) _riempiPannello();
    }
};

function _idRicerca() {
    return 'rs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

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
        cartella: typeof window.cartellaAttuale === 'string' ? window.cartellaAttuale : ''
    };
    window.ricercheSalvate = [voce].concat((window.ricercheSalvate || []).filter(r => r.nome !== voce.nome));
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
    if (_pannello) _riempiPannello();
    window.renderSezioniSidebar?.();
    return voce;
};

window.applicaRicercaSalvata = function(id) {
    const voce = (window.ricercheSalvate || []).find(r => r.id === id);
    if (!voce) return;

    const destinazione = typeof voce.cartella === 'string' ? voce.cartella : '';
    if (destinazione && destinazione !== window.cartellaAttuale && typeof window.vaiACartella === 'function') {
        window.vaiACartella(destinazione);
    } else if (!destinazione) {
        window.cartellaAttuale = '';
    }

    const input = document.getElementById('search-input');
    if (input) input.value = voce.ricerca || '';
    window.activeTags = new Set(Array.isArray(voce.tag) ? voce.tag : []);
    window.filtriAvanzati = window.filtriValidi(voce.filtri);

    if (typeof renderTagList === 'function') renderTagList();
    if (typeof renderSearchSuggestions === 'function') renderSearchSuggestions();
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderMain === 'function') renderMain();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
    window.chiudiPannelloFiltri(false);
};

window.eliminaRicercaSalvata = function(id) {
    const elenco = window.ricercheSalvate || [];
    const posizione = elenco.findIndex(r => r.id === id);
    if (posizione < 0) return;
    const tolta = elenco[posizione];
    window.ricercheSalvate = elenco.filter(r => r.id !== id);
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
    if (_pannello) _riempiPannello();
    window.renderSezioniSidebar?.();
    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(window.t('msg_saved_search_deleted', 'Ricerca salvata eliminata.'), 'info', () => {
            const ora = window.ricercheSalvate || [];
            if (ora.some(r => r.id === tolta.id)) return;
            ora.splice(Math.min(posizione, ora.length), 0, tolta);
            window.ricercheSalvate = ora;
            if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
            if (_pannello) _riempiPannello();
            window.renderSezioniSidebar?.();
        });
    }
};

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
        opt.textContent = o.label;
        sel.appendChild(opt);
    }
    sel.value = valore || '';
    sel.onchange = () => onChange(sel.value);
    return sel;
}

function _posizionaPannello() {
    if (!_pannello) return;
    const box = _pannello;
    const btn = _ancoraFiltri;
    const margine = 8;
    const l = box.offsetWidth;
    const h = box.offsetHeight;
    let x = margine;
    let y = margine;
    if (btn && btn.isConnected) {
        const r = btn.getBoundingClientRect();
        x = r.right - l;
        y = r.bottom + 4;
        if (y + h > window.innerHeight - margine) y = Math.max(margine, r.top - h - 4);
    }
    box.style.left = Math.max(margine, Math.min(x, window.innerWidth - l - margine)) + 'px';
    box.style.top = Math.max(margine, Math.min(y, window.innerHeight - h - margine)) + 'px';
}

function _riempiPannello() {
    if (!_pannello) return;
    const f = window.filtriAvanzati || {};
    const corpo = _pannello.querySelector('[data-corpo]');
    const idAttivo = document.activeElement && corpo.contains(document.activeElement)
        ? document.activeElement.id
        : null;
    corpo.innerHTML = '';

    const T = (k, d) => window.t(k, d);

    const tipi = [{ value: '', label: T('filter_any', 'Qualsiasi') }];
    for (const t of ((typeof appData !== 'undefined' && appData.tipiDocumento) || [])) {
        const nome = window.t('model_' + t.id) !== 'model_' + t.id ? window.t('model_' + t.id) : t.nome;
        tipi.push({ value: t.id, label: nome });
    }
    const selTipo = _select(f.tipo, tipi, v => window.applicaFiltriAvanzati({ tipo: v }));
    selTipo.id = 'filtro-tipo';
    corpo.appendChild(_riga(T('filter_type', 'Tipo'), selTipo));

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = 'filtro-sottocartelle';
    chk.className = 'w-4 h-4 accent-amber-700';
    chk.checked = !!f.sottocartelle;
    chk.onchange = () => window.applicaFiltriAvanzati({ sottocartelle: chk.checked });
    corpo.appendChild(_riga(T('filter_subfolders', 'Includi sottoarchivi'), chk));

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

    const titoloPeriodo = document.createElement('div');
    titoloPeriodo.className = 'form-label mt-2 pt-2 border-t';
    titoloPeriodo.style.borderColor = 'var(--color-border-light)';
    titoloPeriodo.textContent = T('filter_period', 'Periodo del documento');
    corpo.appendChild(titoloPeriodo);

    const mkAnno = (id, valore, chiave, segnaposto) => {
        const el = document.createElement('input');
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

    const selOcr = _select(f.ocr, treStati, v => window.applicaFiltriAvanzati({ ocr: v }));
    selOcr.id = 'filtro-ocr';
    corpo.appendChild(_riga(T('filter_ocr', 'Testo OCR'), selOcr));

    const selColl = _select(f.collegamenti, treStati, v => window.applicaFiltriAvanzati({ collegamenti: v }));
    selColl.id = 'filtro-collegamenti';
    corpo.appendChild(_riga(T('filter_links', 'Collegamenti'), selColl));

    const stati = [{ value: '', label: T('filter_any', 'Qualsiasi') }]
        .concat(window.STATI_CARTA.map(s => ({ value: s, label: T('stato_carta_' + s, s) })));
    const selStato = _select(f.statoCarte, stati, v => window.applicaFiltriAvanzati({ statoCarte: v }));
    selStato.id = 'filtro-stato-carte';
    corpo.appendChild(_riga(T('filter_sheet_status', 'Carte'), selStato));

    const hint = document.createElement('p');
    hint.className = 'text-xs text-stone-500 dark:text-stone-400 leading-relaxed border-t border-stone-200 dark:border-stone-700 pt-2';
    hint.textContent = T('filter_query_hint', 'Nella ricerca puoi scrivere campo:valore, per esempio notaio:rossi, tag:pergamena, oppure "frase esatta".');
    corpo.appendChild(hint);

    const azzera = document.createElement('button');
    azzera.type = 'button';
    azzera.id = 'btn-azzera-filtri-avanzati';
    azzera.className = 'btn btn-ghost w-full justify-center text-sm';
    azzera.textContent = T('btn_clear_advanced', 'Azzera i filtri');
    azzera.disabled = window.contaFiltriAvanzati(f) === 0;
    azzera.onclick = () => window.azzeraFiltriAvanzati();
    corpo.appendChild(azzera);

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
        applica.textContent = r.nome;
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
    _posizionaPannello();

    if (idAttivo) {
        const tornato = corpo.querySelector('#' + CSS.escape(idAttivo));
        if (tornato) tornato.focus();
    }
}

window.apriPannelloFiltri = function(ancora) {
    if (_pannello) { window.chiudiPannelloFiltri(true); return; }

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

    const primo = box.querySelector<HTMLElement>('select, input, button');
    if (primo) primo.focus();

    document.addEventListener('mousedown', _chiudiSuPointerDown, true);
    document.addEventListener('keydown', _onKeyDownFiltri, true);
    window.addEventListener('scroll', _chiudiSuScroll, true);
    window.addEventListener('resize', _chiudiSuScroll);
};
