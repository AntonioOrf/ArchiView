const SEARCH_FIELDS_BASE = ['segnatura', 'titolo', 'autore', 'datazione', 'supporto', 'incipit', 'explicit', 'note', 'tags', 'trascrizione', 'descrizione', 'provenienza', 'contenuto', 'lingua'];

const SNIPPET_SKIP_FIELDS = new Set(['id', 'cartella', 'allegati', 'tipoDocumento']);
let searchCacheGen = 0;
let searchCache = new WeakMap();

window.invalidaCacheRicerca = function() {
    searchCacheGen++;
};

let searchFieldsCache = null;
let searchFieldsGen = -1;
function getSearchFields() {
    if (searchFieldsCache && searchFieldsGen === searchCacheGen) return searchFieldsCache;
    const set = new Set(SEARCH_FIELDS_BASE);
    const tipi = (typeof appData !== 'undefined' && appData.tipiDocumento) || [];
    for (const t of tipi) {
        for (const c of (t.campi || [])) {
            const id = typeof c === 'string' ? c : (c as any)?.id;
            if (id) set.add(id);
        }
    }
    for (const m of (typeof appData !== 'undefined' && appData.manoscritti) || []) {
        for (const d of window.Model.campiPropri(m)) set.add(d.id);
    }
    searchFieldsCache = Array.from(set);
    searchFieldsGen = searchCacheGen;
    return searchFieldsCache;
}

const testoIndicizzabile = (v) => window.testoIndicizzabile(v);

function getSearchIndex(m) {
    const cached = searchCache.get(m);
    if (cached && cached.gen === searchCacheGen) return cached;

    const fields = [];
    for (const key of Object.keys(m)) {
        if (SNIPPET_SKIP_FIELDS.has(key)) continue;
        const v = m[key];
        if (v === null || v === undefined) continue;
        if (typeof v !== 'string' && typeof v !== 'number') continue;
        const clean = String(v).replace(/<[^>]*>/g, '');
        if (!clean) continue;
        fields.push({
            key,
            readable: key.charAt(0).toUpperCase() + key.slice(1),
            clean,
            lower: clean.toLowerCase(),
            norm: window.normalizzaTesto(clean)
        });
    }
    const priority = (k) => (k === 'segnatura' ? 0 : k === 'titolo' ? 1 : 2);
    fields.sort((a, b) => priority(a.key) - priority(b.key));

    let hay = '';
    for (const k of getSearchFields()) {
        const t = testoIndicizzabile(m[k]);
        if (t) hay += t.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ') + '\n';
    }
    if (window.testoOcrRecord) {
        const ocr = window.testoOcrRecord(m);
        if (ocr) hay += ocr + '\n';
    }
    if (window.Model) hay += window.Model.testoAnnotazioni(m);
    hay = window.normalizzaTesto(hay);

    const entry = { gen: searchCacheGen, fields, hay };
    searchCache.set(m, entry);
    return entry;
}

function objectMatchesTokens(m, tokens) {
    const hay = getSearchIndex(m).hay;
    for (const t of tokens) {
        if (!hay.includes(t)) return false;
    }
    return true;
}
window.objectMatchesTokens = objectMatchesTokens;

window.sortState = window.sortState || { campo: 'segnatura', dir: 'asc' };

function defCampoDi(m, campo) {
    if (!window.Model) return { id: campo, tipo: 'text' };
    const tipo = appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'));
    return window.Model.definizioneCampo(tipo, campo, CONFIG_CAMPI, appData);
}

function valoreMancante(m, campo) {
    if (campo === 'lastModified' || campo === 'allegati') return false;
    const v = m[campo];
    if (v === null || v === undefined || String(v).trim() === '') return true;
    if (window.DataStorica && defCampoDi(m, campo).tipo === 'date') {
        return window.DataStorica.chiaveOrdinamento(v) === null;
    }
    return false;
}

function campoEDataStorica(a, b, campo) {
    if (!window.Model || !window.DataStorica) return false;
    return defCampoDi(a, campo).tipo === 'date' || defCampoDi(b, campo).tipo === 'date';
}

function confrontaCampo(a, b, campo) {
    if (campo === 'lastModified') return (a.lastModified || 0) - (b.lastModified || 0);
    if (campo === 'allegati') return carteDi(a).length - carteDi(b).length;
    if (campoEDataStorica(a, b, campo)) {
        const ka = window.DataStorica.chiaveOrdinamento(a[campo]);
        const kb = window.DataStorica.chiaveOrdinamento(b[campo]);
        if (ka === null && kb === null) return window.confrontaNaturale(a[campo], b[campo]);
        if (ka === null) return 1;
        if (kb === null) return -1;
        return ka - kb;
    }
    return window.confrontaNaturale(a[campo], b[campo]);
}

function ordinaManoscritti(lista) {
    const campo = (window.sortState && window.sortState.campo) || 'segnatura';
    const segno = (window.sortState && window.sortState.dir === 'desc') ? -1 : 1;

    return lista.sort((a, b) => {
        const aVuoto = valoreMancante(a, campo);
        const bVuoto = valoreMancante(b, campo);
        if (aVuoto !== bVuoto) return aVuoto ? 1 : -1;

        const primario = confrontaCampo(a, b, campo) * segno;
        if (primario !== 0) return primario;
        return campo === 'segnatura' ? 0 : window.confrontaNaturale(a.segnatura, b.segnatura);
    });
}

window.impostaOrdinamento = function(campo, dir) {
    if (typeof campo !== 'string' || !campo) return;
    const stato = window.sortState;
    window.sortState = {
        campo,
        dir: dir || (stato.campo === campo && stato.dir === 'asc' ? 'desc' : 'asc')
    };
    renderMain();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
};

window.currentPage = 0;
const PAGE_SIZE_STANDARD = 50;
const PAGE_SIZE_RIDOTTO = 25;
function pageSize() {
    return window.modalitaPrestazioniRidotte ? PAGE_SIZE_RIDOTTO : PAGE_SIZE_STANDARD;
}

window.getManoscrittiFiltrati = function() {
    const query = window.analizzaQuery(document.getElementById('search-input').value);
    const tokens = query.testo;
    window.activeTags = window.activeTags || new Set();
    const filtri = window.filtriAvanzati || {};
    const nAvanzati = window.contaFiltriAvanzati(filtri);

    const isGlobalSearch = tokens.length > 0 || query.campi.length > 0 || window.activeTags.size > 0;

    const tagsNorm = window.activeTags.size > 0
        ? Array.from(window.activeTags).map(t => window.Model.chiaveTag(t)).filter(Boolean)
        : null;

    if (filtri.collegamenti === 'si' || filtri.collegamenti === 'no') {
        const collegati = new Set();
        for (const m of appData.manoscritti) {
            const uscenti = window.Model.relazioni(m);
            if (uscenti.length === 0) continue;
            collegati.add(String(m.id));
            for (const r of uscenti) collegati.add(r.id);
        }
        window.__idsCollegati = collegati;
    } else {
        window.__idsCollegati = null;
    }

    const filtrati = appData.manoscritti.filter(m => {
        let matchCartella;
        if (isGlobalSearch) matchCartella = true;
        else if (filtri.sottocartelle) matchCartella = window.cartellaNelSottoalbero(m.cartella, window.cartellaAttuale);
        else matchCartella = m.cartella === window.cartellaAttuale;

        const matchSearch = tokens.length === 0 || objectMatchesTokens(m, tokens);

        let matchTag = true;
        if (tagsNorm) {
            const chiavi = window.Model.tags(m).map(t => window.Model.chiaveTag(t));
            for (const tag of tagsNorm) {
                if (chiavi.indexOf(tag) === -1) {
                    matchTag = false;
                    break;
                }
            }
        }

        if (!(matchCartella && matchSearch && matchTag)) return false;
        if (query.campi.length > 0 && !window.recordPassaCampi(m, query.campi)) return false;
        if (nAvanzati > 0 && !window.recordPassaFiltri(m, filtri)) return false;
        return true;
    });

    return ordinaManoscritti(filtrati);
};

function statoEliminaCartella() {
    const cartella = window.cartellaAttuale;
    const vuota = !appData.manoscritti.some(m => m.cartella === cartella);
    const isRadice = !cartella;

    let motivo;
    if (isRadice) motivo = window.t('tooltip_delete_folder_root', "La radice dell'archivio non può essere eliminata");
    else if (!vuota) motivo = window.t('tooltip_delete_folder_not_empty', 'Puoi eliminare solo una cartella vuota');
    else motivo = window.t('tooltip_delete_folder', 'Elimina questa cartella');

    return { abilitato: vuota && !isRadice, motivo };
}

function renderIntestazioneVista(isGlobalSearch, search) {
    const titolo = document.getElementById('titolo-cartella-attuale');
    const crumbs = document.getElementById('breadcrumb-cartella');
    const icona = document.getElementById('icona-vista-corrente');

    if (crumbs) crumbs.innerHTML = '';

    if (isGlobalSearch) {
        titolo.textContent = window.t("search_results_title", "Risultati ricerca globale");
        if (icona) icona.setAttribute('data-lucide', 'search');
    } else if (!window.cartellaAttuale) {
        titolo.textContent = typeof window.etichettaRadice === 'function'
            ? window.etichettaRadice()
            : window.t('folder_root_label', 'Radice');
        if (icona) icona.setAttribute('data-lucide', 'library');
    } else {
        const parti = window.cartellaAttuale.split('/');
        titolo.textContent = parti[parti.length - 1];
        if (icona) icona.setAttribute('data-lucide', 'folder-open');

        if (crumbs && parti.length > 1) {
            parti.slice(0, -1).forEach((parte, i) => {
                const percorso = parti.slice(0, i + 1).join('/');
                const link = document.createElement('button');
                link.type = 'button';
                link.className = 'hover:text-amber-700 hover:underline truncate max-w-[12rem]';
                link.textContent = parte;
                link.onclick = () => window.vaiACartella(percorso);
                crumbs.appendChild(link);
                const sep = document.createElement('span');
                sep.className = 'text-stone-300 dark:text-stone-600 select-none';
                sep.textContent = '/';
                crumbs.appendChild(sep);
            });
        }
    }

    if (icona && window.lucide) lucide.createIcons({ nodes: [icona.parentElement] });
    renderFiltriAttivi(search);
}

function descriviFiltriAvanzati(filtri) {
    const out = [];
    if (!filtri) return out;
    const T = (k, d) => window.t(k, d);

    if (filtri.tipo) {
        const tipo = (appData.tipiDocumento || []).find(t => t.id === filtri.tipo);
        const nome = tipo
            ? (window.t('model_' + tipo.id) !== 'model_' + tipo.id ? window.t('model_' + tipo.id) : tipo.nome)
            : filtri.tipo;
        out.push({ chiave: 'tipo', icona: 'file-text', testo: T('filter_type', 'Tipo') + ': ' + nome });
    }
    if (filtri.sottocartelle) {
        out.push({ chiave: 'sottocartelle', icona: 'folder-tree', testo: T('filter_subfolders', 'Includi sottoarchivi') });
    }
    if (filtri.daData) {
        out.push({ chiave: 'daData', icona: 'calendar', testo: T('filter_from', 'Dal') + ' ' + filtri.daData });
    }
    if (filtri.aData) {
        out.push({ chiave: 'aData', icona: 'calendar', testo: T('filter_to', 'Al') + ' ' + filtri.aData });
    }
    if (filtri.daAnno) {
        out.push({ chiave: 'daAnno', icona: 'hourglass', testo: T('filter_year_from', "Dall'anno") + ' ' + filtri.daAnno });
    }
    if (filtri.aAnno) {
        out.push({ chiave: 'aAnno', icona: 'hourglass', testo: T('filter_year_to', "All'anno") + ' ' + filtri.aAnno });
    }
    if (filtri.allegati) {
        out.push({
            chiave: 'allegati',
            icona: 'paperclip',
            testo: filtri.allegati === 'si' ? T('filter_has_attachments', 'Con allegati') : T('filter_no_attachments', 'Senza allegati')
        });
    }
    if (filtri.trascrizione) {
        out.push({
            chiave: 'trascrizione',
            icona: 'pen-line',
            testo: filtri.trascrizione === 'si' ? T('filter_has_transcription', 'Con trascrizione') : T('filter_no_transcription', 'Senza trascrizione')
        });
    }
    if (filtri.ocr) {
        out.push({
            chiave: 'ocr',
            icona: 'scan-text',
            testo: filtri.ocr === 'si' ? T('filter_has_ocr', 'Con testo OCR') : T('filter_no_ocr', 'Senza testo OCR')
        });
    }
    if (filtri.collegamenti) {
        out.push({
            chiave: 'collegamenti',
            icona: 'link',
            testo: filtri.collegamenti === 'si' ? T('filter_has_links', 'Con collegamenti') : T('filter_no_links', 'Senza collegamenti')
        });
    }
    if (filtri.statoCarte) {
        out.push({
            chiave: 'statoCarte',
            icona: 'list-checks',
            testo: T('filter_sheet_status', 'Carte') + ': ' + T('stato_carta_' + filtri.statoCarte, filtri.statoCarte)
        });
    }
    return out;
}

function renderFiltriAttivi(search) {
    const bar = document.getElementById('active-filters');
    if (!bar) return;

    const tags = window.activeTags ? [...window.activeTags] : [];
    const filtri = window.filtriAvanzati || {};
    const avanzati = descriviFiltriAvanzati(filtri);
    bar.innerHTML = '';

    if (!search && tags.length === 0 && avanzati.length === 0) {
        bar.classList.add('hidden');
        bar.classList.remove('flex');
        return;
    }
    bar.classList.remove('hidden');
    bar.classList.add('flex');

    const label = document.createElement('span');
    label.className = 'text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500';
    label.textContent = window.t('label_active_filters', 'Filtri attivi');
    bar.appendChild(label);

    const chip = (icona, testo, titoloRimozione, onRemove) => {
        const el = document.createElement('span');
        el.className = 'inline-flex items-center gap-1.5 pl-2 pr-1 py-1 text-xs font-medium rounded-sm bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 max-w-[18rem]';
        const ico = document.createElement('i');
        ico.setAttribute('data-lucide', icona);
        ico.className = 'w-3.5 h-3.5 shrink-0';
        const txt = document.createElement('span');
        txt.className = 'truncate';
        txt.textContent = testo;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shrink-0 chip-remove-btn rounded-sm hover:bg-amber-200 dark:hover:bg-amber-800/50';
        btn.title = titoloRimozione;
        btn.setAttribute('aria-label', titoloRimozione);
        btn.innerHTML = '<i data-lucide="x" class="w-3.5 h-3.5"></i>';
        btn.onclick = onRemove;
        el.append(ico, txt, btn);
        bar.appendChild(el);
    };

    if (search) {
        const input = document.getElementById('search-input');
        chip('search', window.t('filter_search', 'Ricerca') + ': ' + input.value.trim(),
            window.t('filter_remove_search', 'Rimuovi la ricerca'), () => {
                input.value = '';
                if (typeof renderSearchSuggestions === 'function') renderSearchSuggestions();
                renderMain();
            });
    }

    tags.forEach(tag => {
        chip('bookmark', '#' + tag, window.t('filter_remove_tag', 'Rimuovi questo tag'), () => {
            window.activeTags.delete(tag);
            if (typeof renderTagList === 'function') renderTagList();
            renderMain();
        });
    });

    avanzati.forEach(f => {
        chip(f.icona, f.testo, window.t('filter_remove_advanced', 'Rimuovi questo filtro'), () => {
            window.applicaFiltriAvanzati({ [f.chiave]: f.chiave === 'sottocartelle' ? false : '' });
        });
    });

    if (search || tags.length > 1 || avanzati.length > 0) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'text-xs font-medium text-stone-500 hover:text-red-600 underline ml-1';
        clear.textContent = window.t('btn_clear_filters', 'Azzera tutti i filtri');
        clear.onclick = () => {
            window.azzeraFiltriRicerca();
            renderMain();
        };
        bar.appendChild(clear);
    }

    if (window.lucide) lucide.createIcons({ nodes: [bar] });
}

window.vistaLista = window.vistaLista || 'tabella';

function mostraContenitoreLista(quale) {
    const grid = document.getElementById('manoscritti-grid');
    const wrap = document.getElementById('manoscritti-table-wrap');
    if (grid) grid.classList.toggle('hidden', quale !== 'griglia');
    if (wrap) wrap.classList.toggle('hidden', quale !== 'tabella');
}

function tipoDiScheda(m) {
    return appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'))
        || { campi: ['titolo', 'autore', 'note'] };
}
window.tipoDiScheda = tipoDiScheda;

function campiTabellaDisponibili(records) {
    const campi = [];
    const visti = new Set();
    const tipiVisti = new Set();
    for (const m of records) {
        const tid = m.tipoDocumento || 'manoscritto';
        const propri = window.Model.campiPropri(m);
        if (tipiVisti.has(tid) && !propri.length) continue;
        tipiVisti.add(tid);
        const tipo = tipoDiScheda(m);
        for (const def of window.Model.campiDellaScheda(m, tipo, CONFIG_CAMPI, appData)) {
            if (def.tipo === 'dynamic_list' || def.tipo === 'attachments') continue;
            if (visti.has(def.id)) continue;
            visti.add(def.id);
            campi.push(def.id);
        }
    }
    return campi;
}

function chiaveColonne(records) {
    const tipi = new Set(records.map(m => m.tipoDocumento || 'manoscritto'));
    return tipi.size === 1 ? Array.from(tipi)[0] : '_misto';
}

window.colonneTabella = window.colonneTabella || {};

function colonneVisibili(chiave, disponibili) {
    const salvate = window.colonneTabella[chiave];
    if (Array.isArray(salvate)) {
        const filtrate = salvate.filter(c => disponibili.includes(c));
        if (filtrate.length > 0) return filtrate;
    }
    return disponibili.slice(0, 3);
}

window.colonneTabellaCorrenti = function() {
    const paginati = window.__ultimiPaginati || [];
    const disponibili = campiTabellaDisponibili(paginati);
    if (disponibili.length === 0) return [];
    return colonneVisibili(chiaveColonne(paginati), disponibili);
};

window.toggleColonnaTabella = function(campo) {
    const paginati = window.__ultimiPaginati || [];
    const disponibili = campiTabellaDisponibili(paginati);
    const chiave = chiaveColonne(paginati) as string;
    const attuali = colonneVisibili(chiave, disponibili);
    const nuove = attuali.includes(campo)
        ? attuali.filter(c => c !== campo)
        : disponibili.filter(c => attuali.includes(c) || c === campo);
    window.colonneTabella[chiave] = nuove;
    renderMain(false);
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
};

window.vociColonneTabella = function() {
    const paginati = window.__ultimiPaginati || [];
    const disponibili = campiTabellaDisponibili(paginati);
    if (disponibili.length === 0) return [];
    const chiave = chiaveColonne(paginati) as string;
    const visibili = colonneVisibili(chiave, disponibili);

    return disponibili.map(campo => {
        const attiva = visibili.includes(campo);
        return {
            label: etichettaCampo(campo),
            icon: attiva ? 'check' : 'minus',
            disabled: attiva && visibili.length === 1,
            onSelect: () => window.toggleColonnaTabella(campo)
        };
    });
};

function etichettaCampo(campo) {
    const conf = CONFIG_CAMPI[campo] || {};
    const tradotta = window.t('field_' + campo);
    return tradotta !== 'field_' + campo ? tradotta : (conf.label || campo);
}
window.etichettaCampo = etichettaCampo;

function indicatoreOrdinamento(campo) {
    if (!window.sortState || window.sortState.campo !== campo) return '';
    return window.sortState.dir === 'asc' ? ' ▲' : ' ▼';
}

window.testoBooleano = function(v) {
    return v ? window.t('value_yes', 'Sì') : window.t('value_no', 'No');
};

function cellaTestuale(m, campo) {
    const v = m[campo];
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return '';
    if (typeof v === 'boolean') return window.testoBooleano(v);
    return String(v).replace(/<[^>]*>/g, '');
}

function _haTesto(s) {
    return String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
}

function statoTrascrizione(m) {
    const av = window.avanzamentoCarte(m);
    if (av && av.fatte >= av.totale) return { chiave: 'fatta', testo: window.t('transcr_state_done', 'Trascritta') };
    if (av && av.fatte > 0) return { chiave: 'parziale', testo: av.fatte + '/' + av.totale };
    if (!av && (_haTesto(m.trascrizione) || carteDi(m).some(a => a && (_haTesto(a.trascrizione) || (Array.isArray(a.pagine) && a.pagine.some(_haTesto)))))) {
        return { chiave: 'testo', testo: window.t('transcr_state_text', 'Con testo') };
    }
    return { chiave: 'dafare', testo: window.t('transcr_state_todo', 'Da fare') };
}
window.statoTrascrizione = statoTrascrizione;

function htmlStatoTrascrizione(m) {
    const s = statoTrascrizione(m);
    return `<span class="stato-trascr is-${escapeHTML(s.chiave)}"><span class="stato-trascr-pallino" aria-hidden="true"></span>${escapeHTML(s.testo)}</span>`;
}

function nomeModello(tipo) {
    if (!tipo) return window.t('model_generic', 'Documento');
    return window.t('model_' + tipo.id) !== 'model_' + tipo.id ? window.t('model_' + tipo.id) : tipo.nome;
}

function renderPannelloScheda() {
    const pannello = document.getElementById('pannello-scheda');
    if (!pannello) return;
    const sel = window.selectedRecords || [];
    const m = window.vistaLista === 'tabella' && sel.length === 1
        ? appData.manoscritti.find(x => String(x.id) === String(sel[0]))
        : null;
    const visibile = !!m && !!document.getElementById('card-' + (m && m.id));
    pannello.classList.toggle('hidden-tab', !visibile);
    if (!visibile) { pannello.replaceChildren(); return; }

    const tipo = appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'));
    const campi: { etichetta: string; testo: string; lettura: string }[] = [];
    const liste: { etichetta: string; voci: { k: string; v: string }[] }[] = [];
    for (const def of window.Model.campiDellaScheda(m, tipoDiScheda(m), CONFIG_CAMPI, appData)) {
        const v = m[def.id];
        if (def.tipo === 'attachments' || def.id === 'segnatura') continue;
        const etichetta = String(etichettaCampo(def.id) || def.label || def.id);
        if (def.tipo === 'dynamic_list') {
            const voci = (Array.isArray(v) ? v : [])
                .map(i => ({ k: String((i && (i.k || i.ruolo)) || ''), v: String((i && (i.v || i.nome)) || '') }))
                .filter(i => i.k || i.v);
            if (voci.length) liste.push({ etichetta, voci });
            continue;
        }
        const testo = def.tipo === 'boolean' ? (typeof v === 'boolean' ? window.testoBooleano(v) : '') : cellaTestuale(m, def.id);
        if (!testo) continue;
        const lettura = def.tipo === 'date' && typeof window.letturaDataBreve === 'function' ? window.letturaDataBreve(testo) : '';
        campi.push({ etichetta, testo, lettura });
    }

    const carte = carteDi(m);
    const allegatiTesto = carte.length === 0
        ? window.t('attachment_none', 'Nessun allegato')
        : carte.length === 1
            ? window.t('attachment_count_one', '1 documento allegato')
            : window.t('attachment_count_many', '{var0} documenti allegati').replace('{var0}', String(carte.length));

    const rel = typeof window.relazioniRisolte === 'function' ? window.relazioniRisolte(m.id) : { uscenti: [], entranti: [] };
    const collegate = rel.uscenti.concat(rel.entranti);
    const tags = window.Model.tags(m);

    pannello.innerHTML = `
        <div class="pannello-scheda-testa">
            <div class="pannello-scheda-modello">${escapeHTML(nomeModello(tipo))}</div>
            <h2 id="pannello-scheda-titolo" class="pannello-scheda-titolo" translate="no">${escapeHTML(m.segnatura || window.t('untitled_record', 'Senza titolo'))}</h2>
            <div class="pannello-scheda-azioni">
                <button type="button" class="btn btn-primary tutorial-trascrivi-btn" ${window.azione('click', 'apriTrascrizione', String(m.id))}>${escapeHTML(window.t('btn_transcribe', 'Trascrivi'))}</button>
                <button type="button" class="btn btn-secondary tutorial-modifica-btn" ${window.azione('click', 'editItem', String(m.id))}>${escapeHTML(window.t('btn_edit', 'Modifica'))}</button>
                <span class="pannello-scheda-altro"></span>
            </div>
        </div>
        <dl class="pannello-scheda-campi">${campi.map(c =>
            `<dt>${escapeHTML(c.etichetta)}</dt><dd>${escapeHTML(c.testo)}${c.lettura ? ` <span class="pannello-scheda-lettura">${escapeHTML(c.lettura)}</span>` : ''}</dd>`).join('')}</dl>
        ${liste.map(l => `<div class="pannello-scheda-blocco"><div class="pannello-scheda-etichetta">${escapeHTML(l.etichetta)}</div><div class="pannello-scheda-coppie">${l.voci.map(i =>
            `<span>${escapeHTML(i.k)}</span><span class="pannello-scheda-valore">${escapeHTML(i.v)}</span>`).join('')}</div></div>`).join('')}
        <div class="pannello-scheda-blocco">
            <div class="pannello-scheda-etichetta">${escapeHTML(window.t('panel_attachments_transcription', 'Allegati e trascrizione'))}</div>
            <div>${escapeHTML(allegatiTesto)}</div>
            <div class="mt-1">${htmlStatoTrascrizione(m)}</div>
        </div>
        ${collegate.length ? `<div class="pannello-scheda-blocco"><div class="pannello-scheda-etichetta">${escapeHTML(window.t('link_panel_title', 'Schede collegate'))}</div>${collegate.map(r =>
            `<button type="button" class="pannello-scheda-link" ${window.azione('click', 'rivelaRecordNellaGriglia', String(r.scheda.id))}><span class="font-mono" translate="no">${escapeHTML(r.scheda.segnatura || '')}</span><span>${escapeHTML(r.tipo || '')}</span></button>`).join('')}</div>` : ''}
        ${tags.length ? `<div class="pannello-scheda-blocco pannello-scheda-tag">${tags.map(t => window.chipTagHTML(t)).join('')}</div>` : ''}
    `;
    const slot = pannello.querySelector('.pannello-scheda-altro');
    if (slot && typeof window.creaBottoneOverflow === 'function') {
        slot.appendChild(window.creaBottoneOverflow(() => window.vociMenuRecord(m.id), {
            className: 'btn btn-ghost btn-icon',
            label: window.t('tooltip_more_actions', 'Altre azioni')
        }));
    }
    if (window.lucide) lucide.createIcons({ nodes: [pannello] });
}
window.renderPannelloScheda = renderPannelloScheda;

function renderTabellaSchede(paginated) {
    const table = document.getElementById('manoscritti-table');
    if (!table) return;

    window.__ultimiPaginati = paginated;
    const disponibili = campiTabellaDisponibili(paginated);
    const chiave = chiaveColonne(paginated);
    const visibili = colonneVisibili(chiave, disponibili);
    const hasSelection = window.selectedRecords && window.selectedRecords.length > 0;

    const thSegnatura = `<th class="ordinabile" data-on-click="impostaOrdinamento" data-args-click="[&quot;segnatura&quot;]">${escapeHTML(window.t('field_segnatura', 'Segnatura'))}${indicatoreOrdinamento('segnatura')}</th>`;
    const thCampi = visibili.map(c =>
        `<th class="ordinabile" ${window.azione('click', 'impostaOrdinamento', String((c) ?? ''))}>${escapeHTML(etichettaCampo(c))}${indicatoreOrdinamento(c)}</th>`
    ).join('');

    table.innerHTML = `
        <thead>
            <tr>
                ${thSegnatura}
                ${thCampi}
                <th>${escapeHTML(window.t('th_transcription', 'Trascrizione'))}</th>
                <th class="ordinabile" data-on-click="impostaOrdinamento" data-args-click="[&quot;tags&quot;]">${escapeHTML(window.t('th_tags', 'Tag'))}${indicatoreOrdinamento('tags')}</th>
                <th class="ordinabile" data-on-click="impostaOrdinamento" data-args-click="[&quot;allegati&quot;]">${escapeHTML(window.t('th_attachments', 'Allegati'))}${indicatoreOrdinamento('allegati')}</th>
                <th class="ordinabile" data-on-click="impostaOrdinamento" data-args-click="[&quot;lastModified&quot;]">${escapeHTML(window.t('th_modified', 'Modificato'))}${indicatoreOrdinamento('lastModified')}</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    const fragment = document.createDocumentFragment();

    for (const m of paginated) {
        const isSelected = window.selectedRecords && window.selectedRecords.includes(m.id);
        const tr = document.createElement('tr');
        tr.className = 'card-scheda' + (isSelected ? ' riga-selezionata' : '');
        tr.id = 'card-' + m.id;

        tr.onclick = (e) => {
            if ((e.target as Element).closest('button') || (e.target as Element).closest('a') || (e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
            if (typeof window.selectItem === 'function') window.selectItem(m.id, e);
        };
        tr.ondblclick = () => { if (typeof editItem === 'function') editItem(m.id); };
        tr.draggable = true;
        tr.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'manoscritto', id: m.id }));
            e.dataTransfer.effectAllowed = 'move';
            tr.classList.add('opacity-50');
        };
        tr.ondragend = () => tr.classList.remove('opacity-50');
        tr.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof showRecordContextMenu === 'function') showRecordContextMenu(e, m.id);
        };

        const allegati = carteDi(m);
        const tags = window.Model.tags(m);
        const data = m.lastModified
            ? new Date(m.lastModified).toLocaleDateString(window.localeAttuale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';

        const celleCampi = visibili.map(c => {
            const testo = cellaTestuale(m, c);
            return `<td class="cella-troncata cella-contenuto" title="${escapeHTML(testo)}">${escapeHTML(testo)}</td>`;
        }).join('');

        tr.innerHTML = `
            <td class="cella-segnatura" translate="no">${hasSelection ? (isSelected ? '● ' : '○ ') : ''}${escapeHTML(m.segnatura || '')}</td>
            ${celleCampi}
            <td>${htmlStatoTrascrizione(m)}</td>
            <td>${tags.map(t => window.chipTagHTML(t)).join(' ')}</td>
            <td class="cella-numero">${allegati.length || ''}</td>
            <td class="cella-data">${escapeHTML(data)}</td>
        `;
        fragment.appendChild(tr);
    }

    tbody.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [table] });
}

window.cambiaVistaLista = function(vista) {
    const nuova = vista || (window.vistaLista === 'tabella' ? 'griglia' : 'tabella');
    if (nuova === window.vistaLista) return;
    window.vistaLista = nuova;
    renderMain(false);
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
};

window.nuovaSchedaDelTipo = function(tipoId) {
    switchTab('add');
    const select = document.getElementById('form-tipo-documento');
    if (select && tipoId) {
        select.value = tipoId;
        if (typeof renderDynamicFields === 'function') renderDynamicFields();
    }
};

window.apriMenuNuovaScheda = function(ancora) {
    const tipi = (typeof appData !== 'undefined' && appData.tipiDocumento) || [];
    const voci: any[] = [{ heading: true, label: window.t('menu_new_record_type', 'Nuova scheda di tipo') }];
    for (const t of tipi) {
        const nome = window.t('model_' + t.id) !== 'model_' + t.id ? window.t('model_' + t.id) : t.nome;
        voci.push({ label: nome, icon: 'file-text', onSelect: () => window.nuovaSchedaDelTipo(t.id) });
    }
    window.apriMenuContestuale(ancora || document.getElementById('btn-nuova-scheda-tipo'), voci);
};

function vociMenuContesto() {
    const elimina = statoEliminaCartella();
    const voci: any[] = [
        { label: window.t('btn_new_folder', 'Nuova cartella'), icon: 'folder-plus', onSelect: () => aggiungiCartella() },
        {
            label: window.t('menu_import_group', 'Importa'),
            title: window.t('menu_import_group_title', 'Backup ZIP o foglio di calcolo'),
            icon: 'download',
            submenu: [
                { label: window.t('menu_import_zip', 'Backup ZIP'), title: window.t('btn_import_zip_full', 'Importa un backup ZIP di ArchiView'), icon: 'download', onSelect: () => importaManoscritto() },
                { label: window.t('imp_menu', 'Importa CSV'), title: window.t('imp_title', 'Importa da CSV'), icon: 'file-input', onSelect: () => window.apriImportCsv() },
                { label: window.t('iiif_menu', 'Importa da IIIF'), title: window.t('iiif_title', 'Importa un manoscritto da un manifest IIIF'), icon: 'library', onSelect: () => window.apriImportIiif() }
            ]
        },
        {
            label: window.t('menu_export_group', 'Esporta'),
            title: window.t('menu_export_group_title_folder', 'ZIP, CSV, TSV, testo, stampa'),
            icon: 'share',
            submenu: [
                { label: window.t('menu_export_zip', 'Esporta ZIP'), title: window.t('btn_export_folder', 'Esporta cartella'), icon: 'upload', onSelect: () => esportaCartellaAttuale() },
                { label: window.t('menu_export_csv', 'Esporta CSV'), title: window.t('btn_export_csv', 'Esporta Cartella in CSV'), icon: 'table', onSelect: () => window.esportaCartellaCsv('csv') },
                { label: window.t('menu_export_tsv', 'Esporta TSV'), title: window.t('btn_export_tsv', 'Esporta Cartella in TSV'), icon: 'table', onSelect: () => window.esportaCartellaCsv('tsv') },
                { label: window.t('menu_export_text', 'Esporta testo'), title: window.t('tx_title', 'Esporta testo e citazioni'), icon: 'file-output', onSelect: () => window.apriEsportaTesto() },
                { label: window.t('menu_print_short', 'Stampa'), title: window.t('print_title', 'Stampa e PDF'), icon: 'printer', shortcut: 'Ctrl+P', onSelect: () => window.apriStampa() }
            ]
        },
        { separator: true },
        {
            label: window.t('cp_title', 'Comandi'),
            icon: 'terminal',
            shortcut: 'Ctrl+K',
            onSelect: () => window.apriCommandPalette()
        },
        {
            label: window.t('cp_shortcuts', 'Scorciatoie da tastiera'),
            icon: 'keyboard',
            shortcut: '?',
            onSelect: () => window.apriScorciatoie()
        },
        { separator: true },
        {
            label: window.t('trash_title', 'Cestino'),
            icon: 'trash-2',
            onSelect: () => window.apriCestino()
        },
        {
            label: window.t('btn_delete_folder', 'Elimina questa cartella'),
            icon: 'trash',
            danger: true,
            disabled: !elimina.abilitato,
            title: elimina.motivo,
            onSelect: () => eliminaCartellaAttuale()
        }
    ];
    if (window.vistaLista === 'tabella') {
        voci.splice(voci.length - 3, 0, {
            label: window.t('menu_columns', 'Colonne visibili'),
            icon: 'columns-3',
            submenu: window.vociColonneTabella()
        });
    }
    return voci;
}

window.invertiDirezioneOrdinamento = function() {
    const stato = window.sortState;
    window.impostaOrdinamento(stato.campo, stato.dir === 'asc' ? 'desc' : 'asc');
};

function criteriOrdinamento(records) {
    const criteri = ['segnatura'];
    for (const c of campiTabellaDisponibili(records || [])) {
        if (!criteri.includes(c)) criteri.push(c);
    }
    criteri.push('allegati', 'lastModified');
    return criteri;
}

function aggiornaControlliLista(records) {
    const tabellaAttiva = window.vistaLista === 'tabella';

    if (typeof window.aggiornaStatoSelezione === 'function') window.aggiornaStatoSelezione();

    const controlliOrdinamento = document.getElementById('controlli-ordinamento');
    if (controlliOrdinamento) controlliOrdinamento.classList.toggle('hidden-tab', tabellaAttiva);

    const select = document.getElementById('select-ordinamento');
    if (select) {
        const etichette = {
            segnatura: window.t('field_segnatura', 'Segnatura'),
            lastModified: window.t('th_modified', 'Modificato'),
            allegati: window.t('th_attachments', 'Allegati')
        };
        const campoAttivo = window.sortState.campo;
        const criteri = criteriOrdinamento(records);
        if (!criteri.includes(campoAttivo)) criteri.push(campoAttivo);

        const firma = criteri.join('|');
        if (select.dataset.firmaCriteri !== firma) {
            select.innerHTML = criteri
                .map(c => `<option value="${escapeHTML(c)}">${escapeHTML(etichette[c] || etichettaCampo(c))}</option>`)
                .join('');
            select.dataset.firmaCriteri = firma;
        }
        select.value = campoAttivo;
    }

    const btnDir = document.getElementById('btn-ordinamento-dir');
    if (btnDir) {
        const asc = window.sortState.dir === 'asc';
        btnDir.querySelector('i')?.setAttribute('data-lucide', asc ? 'arrow-down-a-z' : 'arrow-up-z-a');
        const label = asc
            ? window.t('tooltip_sort_asc', 'Ordine crescente: clicca per invertire')
            : window.t('tooltip_sort_desc', 'Ordine decrescente: clicca per invertire');
        btnDir.title = label;
        btnDir.setAttribute('aria-label', label);
    }

    const segmenti = [
        { el: document.getElementById('btn-vista-tabella'), attivo: tabellaAttiva },
        { el: document.getElementById('btn-vista-griglia'), attivo: !tabellaAttiva }
    ];
    for (const s of segmenti) {
        if (!s.el) continue;
        s.el.setAttribute('aria-pressed', String(s.attivo));
        s.el.classList.toggle('segmento-attivo', s.attivo);
    }

    const btnFiltri = document.getElementById('btn-filtri');
    if (btnFiltri) {
        const n = window.contaFiltriAvanzati(window.filtriAvanzati);
        const badge = document.getElementById('badge-filtri');
        if (badge) {
            badge.textContent = n > 0 ? String(n) : '';
            badge.classList.toggle('hidden', n === 0);
        }
        btnFiltri.classList.toggle('segmento-attivo', n > 0);
        const etichetta = n > 0
            ? window.t('tooltip_filters_active', 'Filtri avanzati ({var0} attivi)').replace('{var0}', String(n))
            : window.t('tooltip_filters', 'Filtri avanzati e ricerche salvate');
        btnFiltri.title = etichetta;
        btnFiltri.setAttribute('aria-label', etichetta);
    }

    const slot = document.getElementById('context-overflow-slot');
    if (slot && !slot.firstChild && typeof window.creaBottoneOverflow === 'function') {
        slot.appendChild(window.creaBottoneOverflow(vociMenuContesto, {
            className: 'btn btn-ghost border border-stone-200',
            label: window.t('tooltip_more_actions', 'Altre azioni')
        }));
    }

    const barra = document.getElementById('context-actions');
    if (barra && window.lucide) lucide.createIcons({ nodes: [barra] });
}

let _conteggioCollegamenti: Map<string, number> | null = null;
let _tipiMisti = false;

function contaCollegamenti(schede) {
    const esistenti = new Set((schede || []).map(m => String(m.id)));
    const conta = new Map<string, number>();
    const piu = (id) => conta.set(id, (conta.get(id) || 0) + 1);
    for (const m of schede || []) {
        const da = String(m.id);
        for (const r of window.Model.relazioni(m)) {
            if (!esistenti.has(r.id)) continue;
            piu(da);
            if (r.id !== da) piu(r.id);
        }
    }
    return conta;
}

function creaCardScheda(m) {
    const isSelected = window.selectedRecords && window.selectedRecords.includes(m.id);
    const hasSelection = window.selectedRecords && window.selectedRecords.length > 0;
    const div = document.createElement('div');
    div.className = `card-scheda bg-white p-4 relative flex flex-col justify-between cursor-pointer group ${isSelected ? 'ring-2 ring-amber-500' : ''}`;
    div.id = 'card-' + m.id;
    
    div.onclick = (e) => {
        if ((e.target as Element).closest('button') || (e.target as Element).closest('a') || (e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
        if (typeof window.selectItem === 'function') {
            window.selectItem(m.id, e);
        }
    };



    div.draggable = true;
    div.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'manoscritto', id: m.id }));
        e.dataTransfer.effectAllowed = 'move';
        div.classList.add('opacity-50');
    };
    div.ondragend = () => div.classList.remove('opacity-50');
    
    div.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof showRecordContextMenu === 'function') {
            showRecordContextMenu(e, m.id);
        }
    };

    const allegatiRender = carteDi(m);

    let allegatoHTML = '';
    const btnTrascriviModifica = `
        <button ${window.azione('click', 'apriTrascrizione', String((m.id) ?? ''))} class="btn btn-primary tutorial-trascrivi-btn">${window.t('btn_transcribe') || 'Trascrivi'}</button>
        <button ${window.azione('click', 'editItem', String((m.id) ?? ''))} class="btn btn-secondary tutorial-modifica-btn">${window.t('btn_edit') || 'Modifica'}</button>
    `;

    let btnVediPdfPiccolo = '';

    if (allegatiRender.length > 0) {
        const textAllegati = allegatiRender.length === 1
            ? window.t('attachment_count_one', '1 documento allegato')
            : window.t('attachment_count_many', '{var0} documenti allegati').replace('{var0}', String(allegatiRender.length));
        const av = window.avanzamentoCarte(m);
        const avTesto = av ? window.t('sheet_progress', '{var0} di {var1} carte trascritte').replace('{var0}', String(av.fatte)).replace('{var1}', String(av.totale)) : '';
        const avHTML = av ? `<progress class="card-avanzamento" max="${Number(av.totale)}" value="${Number(av.fatte)}" aria-label="${escapeHTML(avTesto)}" title="${escapeHTML(avTesto)}"></progress><span class="tabular-nums" aria-hidden="true">${Number(av.fatte)}/${Number(av.totale)}</span>` : '';
        btnVediPdfPiccolo = `<span class="card-allegati"><i data-lucide="paperclip" class="w-3.5 h-3.5"></i> ${textAllegati}${avHTML}</span>`;
        allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
    } else {
        allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
    }

    let collegamentiHTML = '';
    if (typeof window.relazioniRisolte === 'function') {
        const r = _conteggioCollegamenti ? null : window.relazioniRisolte(m.id);
        const n = Number(r ? r.uscenti.length + r.entranti.length : (_conteggioCollegamenti!.get(String(m.id)) || 0));
        if (n > 0) {
            const titolo = window.t('link_panel_title', 'Schede collegate') + ' (' + n + ')';
            collegamentiHTML = `<button type="button" class="card-badge card-badge-link shrink-0" title="${escapeHTML(titolo)}" aria-label="${escapeHTML(titolo)}" ${window.azione('click', 'fermaEChiama', "apriCollegamenti", String((m.id) ?? ''))}><i data-lucide="link" class="w-3 h-3"></i>${n}</button>`;
        }
    }

    let tagsHTML = '';
    const tagsList = window.Model.tags(m);
    if (tagsList.length > 0) {
        tagsHTML = '<div class="flex flex-wrap gap-1 mt-2">' + tagsList.map(t => window.chipTagHTML(t)).join('') + '</div>';
    }

    let infoHTML = '';
    const tipoDoc = appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'));
    const definizioniScheda = window.Model.campiDellaScheda(m, tipoDiScheda(m), CONFIG_CAMPI, appData);
    definizioniScheda.forEach(defCampo => {
        const campo = defCampo.id;
        const valorizzato = defCampo.tipo === 'boolean' ? typeof m[campo] === 'boolean' : !!m[campo];
        if (valorizzato) {
            let conf = CONFIG_CAMPI[campo] || { type: 'text' };
            if (defCampo.tipo === 'dynamic_list' && Array.isArray(m[campo])) {
                if (m[campo].length > 0) {
                    const labelStr = window.t('field_' + campo) !== 'field_' + campo ? window.t('field_' + campo) : (conf.label || defCampo.label || campo);
                    infoHTML += `<div class="card-campo-etichetta mt-2">${escapeHTML(labelStr)}</div>`;
                    m[campo].forEach(item => {
                        const k = item.k || item.ruolo || '';
                        const v = item.v || item.nome || '';
                        if (k || v) {
                            infoHTML += `<p class="card-campo truncate"><span class="card-campo-etichetta">${escapeHTML(k)}</span> <span class="card-campo-valore">${escapeHTML(v)}</span></p>`;
                        }
                    });
                }
            } else {
                const label = window.t('field_' + campo) !== 'field_' + campo ? window.t('field_' + campo) : (conf.label || defCampo.label || campo);
                if (campo === 'note') infoHTML += `<p class="card-nota line-clamp-3" title="${escapeHTML(m.note)}">${escapeHTML(m.note)}</p>`;
                else if (defCampo.tipo === 'boolean') infoHTML += `<p class="card-campo truncate"><span class="card-campo-etichetta">${escapeHTML(label)}</span> <span class="card-campo-valore">${escapeHTML(window.testoBooleano(m[campo]))}</span></p>`;
                else if (defCampo.tipo === 'url') infoHTML += `<p class="card-campo truncate"><span class="card-campo-etichetta">${escapeHTML(label)}</span> <a href="#" ${window.azione('click', 'linkEsterno', String((m[campo]) ?? ''))} class="card-campo-valore underline">${escapeHTML(m[campo])}</a></p>`;
                else infoHTML += `<p class="card-campo truncate"><span class="card-campo-etichetta">${escapeHTML(label)}</span> <span class="card-campo-valore">${escapeHTML(m[campo])}</span></p>`;
            }
        }
    });

    let authorBadgeHTML = '';
    if (m.creatoDa || m.modificatoDa) {
        const autore = m.modificatoDa || m.creatoDa;
        const titoloMeta = m.modificatoDa && m.creatoDa && m.modificatoDa !== m.creatoDa 
            ? window.t('card_creato_modificato', "Creato da {var0} - Modificato da {var1}").replace('{var0}', String(m.creatoDa)).replace('{var1}', String(m.modificatoDa))
            : window.t('card_autore', "Autore: {var0}").replace('{var0}', String(autore));

        authorBadgeHTML = `<span title="${escapeHTML(titoloMeta)}" class="card-autore">
            <i data-lucide="user" class="w-3 h-3"></i> ${escapeHTML(autore)}
        </span>`;
    }

    let dateHTML = '';
    if (m.lastModified) {
        const dataFormat = new Date(m.lastModified).toLocaleDateString(window.localeAttuale(), { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
        dateHTML = `<span class="card-data">${dataFormat}</span>`;
    }

    const checkboxHTML = hasSelection ? `
        <div class="absolute top-2 left-2 z-10" ${window.azione('click', 'fermaEChiama', "selectItem", String((m.id) ?? ''), window.ARG.evento)}>
            <div class="flex items-center justify-center w-5 h-5 rounded border-2 shadow-sm cursor-pointer transition-colors duration-150
                ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white/90 border-stone-300 text-transparent hover:border-amber-400'}">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
        </div>
    ` : '';

    div.innerHTML = `
        ${checkboxHTML}
        <div class="px-1 ${hasSelection ? 'pl-7' : ''}">
            <div class="card-intestazione flex justify-between items-start gap-2 mb-2">
                <h3 class="card-title mb-0" translate="no" title="${escapeHTML(m.segnatura)}">${escapeHTML(m.segnatura)}</h3>
                <div class="card-etichette flex items-center gap-1.5 mt-0">
                    ${collegamentiHTML}
                    ${authorBadgeHTML}
                    ${_tipiMisti ? `<span class="card-badge shrink-0">${escapeHTML(nomeModello(tipoDoc))}</span>` : ''}
                </div>
            </div>
            <div class="space-y-1 text-sm">
                ${infoHTML}
                ${tagsHTML}
            </div>
            ${allegatoHTML}
        </div>
        <div class="card-piede">
            ${btnVediPdfPiccolo}
            ${dateHTML}
            <span class="card-overflow-slot flex"></span>
        </div>
    `;

    const slot = div.querySelector('.card-overflow-slot');
    if (slot && typeof window.creaBottoneOverflow === 'function') {
        slot.appendChild(window.creaBottoneOverflow(
            () => window.vociMenuRecord(m.id),
            {
                className: 'btn btn-ghost btn-icon card-overflow-btn',
                preparaApertura: () => {
                    window.assicuraSelezioneRecord(m.id);
                    const card = document.getElementById('card-' + m.id);
                    return card ? card.querySelector('.card-overflow-btn') : null;
                }
            }
        ));
    }
    return div;
}

function renderMain(resetPage = true) {
    if (resetPage) window.currentPage = 0;

    const grid = document.getElementById('manoscritti-grid');
    const search = document.getElementById('search-input').value.trim().toLowerCase();

    window.activeTags = window.activeTags || new Set();
    const isGlobalSearch = search !== '' || window.activeTags.size > 0;

    renderIntestazioneVista(isGlobalSearch, search);
    if (typeof window.aggiornaRicercaAltriArchivi === 'function') window.aggiornaRicercaAltriArchivi();

    const filtered = window.getManoscrittiFiltrati();

    const counterKey = isGlobalSearch ? 'counter_documents_found' : 'counter_documents';
    const counterFallback = isGlobalSearch ? 'Documenti trovati: {var0}' : 'Documenti: {var0}';
    document.getElementById('counter-results').textContent = window.t(counterKey, counterFallback).replace('{var0}', String(filtered.length));
    window.conteggioInVista = filtered.length;
    if (typeof window.aggiornaBarraStato === 'function') window.aggiornaBarraStato();
    if (typeof window.renderSezioniSidebar === 'function') window.renderSezioniSidebar();
    grid.innerHTML = '';

    const paginationControls = document.getElementById('pagination-controls');

    aggiornaControlliLista(filtered);

    if (filtered.length === 0) {
        mostraContenitoreLista('nessuno');
        if (paginationControls) {
            paginationControls.classList.add('hidden');
            paginationControls.classList.remove('flex');
        }
        document.getElementById('empty-state').classList.remove('hidden');

        const emptyText = document.getElementById('empty-state-text');
        if (emptyText) {
            const filtriAttivi = window.contaFiltriAvanzati(window.filtriAvanzati || {}) > 0;
            const key = isGlobalSearch ? 'no_search_match' : filtriAttivi ? 'no_filter_match' : 'folder_empty';
            const predefinito = {
                no_search_match: 'Nessun documento corrisponde ai filtri attivi.',
                no_filter_match: 'Nessuna scheda di questa cartella corrisponde ai filtri attivi.',
                folder_empty: 'La cartella è vuota.',
            }[key];
            emptyText.setAttribute('data-i18n', key);
            emptyText.textContent = window.t(key, predefinito);
        }

    } else {
        mostraContenitoreLista(window.vistaLista === 'tabella' ? 'tabella' : 'griglia');
        document.getElementById('empty-state').classList.add('hidden');

        const dimPagina = pageSize();
        const totalPages = Math.ceil(filtered.length / dimPagina);
        if (window.currentPage >= totalPages) window.currentPage = Math.max(0, totalPages - 1);
        const paginated = filtered.slice(window.currentPage * dimPagina, (window.currentPage + 1) * dimPagina);

        if (paginationControls) {
            if (totalPages > 1) {
                paginationControls.classList.remove('hidden');
                paginationControls.classList.add('flex');
                document.getElementById('page-indicator').textContent = window.t('pagina_x_di_y', "Pagina {var0} di {var1}").replace('{var0}', String(window.currentPage + 1)).replace('{var1}', String(totalPages));
                const btnPrev = document.getElementById('btn-prev-page') as HTMLButtonElement;
                const btnNext = document.getElementById('btn-next-page') as HTMLButtonElement;
                if (btnPrev) btnPrev.disabled = window.currentPage === 0;
                if (btnNext) btnNext.disabled = window.currentPage === totalPages - 1;
            } else {
                paginationControls.classList.add('hidden');
                paginationControls.classList.remove('flex');
            }
        }

        if (window.vistaLista === 'tabella') {
            renderTabellaSchede(paginated);
            renderPannelloScheda();
            return;
        }

        const fragment = document.createDocumentFragment();

        _conteggioCollegamenti = contaCollegamenti(appData.manoscritti);
        _tipiMisti = new Set(paginated.map(m => m.tipoDocumento || 'manoscritto')).size > 1;
        try {
            for (const m of paginated) {
                fragment.appendChild(creaCardScheda(m));
            }
        } finally {
            _conteggioCollegamenti = null;
        }

        grid.appendChild(fragment);
    }
    renderPannelloScheda();
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
}

window.pendingTabSwitch = null;

function switchTab(tab) {
    if (tab !== 'trascrizione' && window.schedaStaccata && window.schedaStaccata()) window.chiudiFinestraStaccata('scheda');
    if (tab !== 'add' && window.documentoStaccato && window.documentoStaccato()) window.chiudiFinestraStaccata('documento');
    if (tab !== 'trascrizione' && window.moduloInTrascrizione && window.moduloInTrascrizione() && !window.riponiModuloSePulito()) {
        window.lasciaSchedaTrascrizione().then((ok) => { if (ok) switchTab(tab); });
        return;
    }
    const vAdd = document.getElementById('view-add');
    if (!vAdd.classList.contains('hidden-tab') && window.isFormDirty && tab !== 'add') {
        window.pendingTabSwitch = tab;
        if (window.mostraBottomConfirm) {
            window.mostraBottomConfirm(window.t('unsaved_prompt') || "Ci sono modifiche non salvate alla scheda. Sei sicuro di voler uscire perdendo le modifiche?", () => {
                window.isFormDirty = false;
                switchTab(window.pendingTabSwitch);
            });
            return;
        }
    }

    const vList = document.getElementById('view-list');
    const vTrascrizione = document.getElementById('view-trascrizione');

    vList.classList.add('hidden-tab');
    vAdd.classList.add('hidden-tab');
    if (vTrascrizione) vTrascrizione.classList.add('hidden-tab');

    if (tab === 'list') {
        vList.classList.remove('hidden-tab');
        resetForm(); renderMain();
    } else if (tab === 'add') {
        vAdd.classList.remove('hidden-tab');
        aggiornaSelectCartelle();
        aggiornaSelectTipiDocumento();
        if (typeof window.aggiornaSelettoriRelazione === 'function') window.aggiornaSelettoriRelazione();
        document.getElementById('form-segnatura')?.focus({ preventScroll: true });
    } else if (tab === 'trascrizione') {
        if (vTrascrizione) vTrascrizione.classList.remove('hidden-tab');
    }
    
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
}

function buildSnippet(clean, lower, norm, token) {
    let idx = -1;
    let len = token.length;
    const j = norm ? norm.indexOf(token) : -1;
    if (j !== -1 && norm.length === clean.length) {
        idx = j;
    } else if (j !== -1) {
        idx = window.posizioneOriginale(clean, j);
        len = window.posizioneOriginale(clean, j + token.length) - idx;
    }
    if (idx === -1) idx = lower.indexOf(token);
    if (idx === -1) return null;

    const start = Math.max(0, idx - 60);
    const end = Math.min(clean.length, idx + len + 80);
    let snippet = clean.substring(start, end).trim();

    const tagliato = clean.substring(start, end);
    const scartoTrim = tagliato.length - tagliato.replace(/^\s+/, '').length;
    const rel = idx - start - scartoTrim;

    let html;
    if (rel >= 0 && rel + len <= snippet.length) {
        html = escapeHTML(snippet.substring(0, rel))
            + '<span class="bg-amber-200 text-amber-900 font-bold px-0.5 rounded">'
            + escapeHTML(snippet.substring(rel, rel + len))
            + '</span>'
            + escapeHTML(snippet.substring(rel + len));
    } else {
        html = escapeHTML(snippet);
    }

    if (start > 0) html = '...' + html;
    if (end < clean.length) html = html + '...';
    return html;
}

function _cercaNelleCarte(m, tok) {
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    const contenitore = document.createElement('template');
    const testoDi = (html) => {
        contenitore.innerHTML = window.sanitizeHTML(String(html || ''));
        return contenitore.content.textContent || '';
    };
    for (let i = 0; i < allegati.length; i++) {
        const a = allegati[i];
        if (!a || !window.trascrizioneHaTesto(a.trascrizione)) continue;
        const pezzi = Array.isArray(a.pagine) && a.pagine.length ? a.pagine : [a.trascrizione];
        for (let p = 0; p < pezzi.length; p++) {
            const clean = testoDi(pezzi[p]);
            const norm = window.normalizzaTesto(clean);
            const j = norm.indexOf(tok);
            if (j === -1) continue;
            const da = window.posizioneOriginale(clean, j);
            const pagina = pezzi === a.pagine ? p + 1 : undefined;
            let key = window.t('search_hit_sheet', 'Trascrizione, c. {var0}').replace('{var0}', String(i + 1));
            if (pagina) key += ', ' + window.t('search_hit_page', 'p. {var0}').replace('{var0}', String(pagina));
            return {
                key,
                snippet: buildSnippet(clean, clean.toLowerCase(), norm, tok),
                carta: i,
                pagina,
                parola: clean.slice(da, window.posizioneOriginale(clean, j + tok.length))
            };
        }
    }
    return null;
}

function _cercaNelleRegioni(m, tok) {
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    for (let i = 0; i < allegati.length; i++) {
        for (const r of window.Model.annotazioni(allegati[i])) {
            if (!r.testo) continue;
            const norm = window.normalizzaTesto(r.testo);
            if (!norm.includes(tok)) continue;
            return {
                key: window.t('search_hit_region', 'Regione, c. {var0}').replace('{var0}', String(i + 1)),
                snippet: buildSnippet(r.testo, r.testo.toLowerCase(), norm, tok),
                carta: i,
                regione: r.id
            };
        }
    }
    return null;
}

function renderSearchSuggestions() {
    const tokens = window.tokenizzaRicerca(document.getElementById('search-input').value);
    const container = document.getElementById('search-suggestions');
    container.innerHTML = '';

    if (tokens.length === 0) {
        container.innerHTML = '<div class="p-4 text-xs text-stone-400 italic text-center">' + escapeHTML(window.t('search_type_to_see', 'Digita per vedere i risultati…')) + '</div>';
        return;
    }

    const matches = [];
    for (const m of appData.manoscritti) {
        if (!objectMatchesTokens(m, tokens)) continue;

        const index = getSearchIndex(m);
        let aggiunto = false;
        for (const f of index.fields) {
            for (const tok of tokens) {
                const inCarta = f.key === 'trascrizione' ? _cercaNelleCarte(m, tok) : null;
                if (inCarta) {
                    matches.push(Object.assign({ item: m }, inCarta));
                    aggiunto = true;
                    break;
                }
                const snippet = buildSnippet(f.clean, f.lower, f.norm, tok);
                if (snippet) {
                    matches.push({ item: m, key: f.readable, snippet });
                    aggiunto = true;
                    break;
                }
            }
            if (aggiunto) break;
        }
        for (const tok of aggiunto ? [] : tokens) {
            const inRegione = _cercaNelleRegioni(m, tok);
            if (inRegione) { matches.push(Object.assign({ item: m }, inRegione)); break; }
        }
        if (matches.length >= 15) break;
    }

    if (matches.length === 0) {
        container.innerHTML = `<div class="p-4 text-xs text-stone-400 italic text-center">${window.t('no_search_match')}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    matches.forEach(match => {
        const div = document.createElement('div');
        div.className = "p-2 border-b border-stone-200 hover:bg-amber-50 cursor-pointer transition-colors";
        div.onclick = () => match.regione
            ? window.apriRegioneSuCarta(match.item.id, match.carta, match.regione)
            : match.carta !== undefined
            ? window.apriTrascrizioneSuCarta(match.item.id, match.carta, match.pagina, match.parola)
            : window.rivelaRecordNellaGriglia(match.item.id);
        div.innerHTML = `
            <div class="text-xs font-bold text-stone-800 truncate mb-1" translate="no">${escapeHTML(match.item.segnatura || match.item.titolo || window.t('senza_titolo', "Senza Titolo"))}</div>
            <div class="text-[11px] text-stone-600 leading-tight">
                <span class="font-semibold text-amber-700 capitalize">${escapeHTML(match.key)}:</span> ${match.snippet}
            </div>
        `;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
}

window.rivelaRecordNellaGriglia = function(id) {
    const filtrati = window.getManoscrittiFiltrati();
    const idx = filtrati.findIndex(x => x.id === id);
    if (idx !== -1) {
        const paginaTarget = Math.floor(idx / pageSize());
        if (window.currentPage !== paginaTarget) {
            window.currentPage = paginaTarget;
            renderMain(false);
        }
    }

    const targetCard = document.getElementById('card-' + id);
    if (!targetCard) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(window.t('msg_record_non_in_vista', 'Documento non visibile nella vista corrente.'), 'info');
        }
        return;
    }

    targetCard.scrollIntoView({ behavior: window.comportamentoScroll(), block: 'center' });
    targetCard.classList.add('scheda-raggiunta');
    setTimeout(() => targetCard.classList.remove('scheda-raggiunta'), 1500);
};

window.cambiaPagina = function(dir) {
    window.currentPage += dir;
    renderMain(false);
    const viewList = document.getElementById('view-list');
    if (viewList) viewList.scrollTo({ top: 0, behavior: window.comportamentoScroll() });
};
