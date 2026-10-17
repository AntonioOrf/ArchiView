window.regexSostituzione = function(cerca, opzioni) {
    const o = opzioni || {};
    const ago = String(cerca == null ? '' : cerca);
    if (!ago) return null;
    const escapato = ago.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const corpo = o.intere
        ? '(?<![\\p{L}\\p{N}])' + escapato + '(?![\\p{L}\\p{N}])'
        : escapato;
    return new RegExp(corpo, o.maiuscole ? 'gu' : 'giu');
};

window.sostituisciTesto = function(valore, cerca, sostituisci, opzioni) {
    if (typeof valore !== 'string' || valore === '') return valore;
    const re = window.regexSostituzione(cerca, opzioni);
    if (!re) return valore;
    return valore.replace(re, () => String(sostituisci == null ? '' : sostituisci));
};

window.contaOccorrenze = function(valore, cerca, opzioni) {
    if (typeof valore !== 'string' || valore === '') return 0;
    const re = window.regexSostituzione(cerca, opzioni);
    if (!re) return 0;
    const trovate = valore.match(re);
    return trovate ? trovate.length : 0;
};

window.anteprimaSostituzione = function(records, campo, cerca, opzioni) {
    let schede = 0;
    let occorrenze = 0;
    for (const m of (records || [])) {
        const n = window.contaOccorrenze(m ? m[campo] : '', cerca, opzioni);
        if (n > 0) { schede++; occorrenze += n; }
    }
    return { schede, occorrenze };
};

window.dividiTag = function(csv) {
    return window.Model.listaTag(csv);
};

window.unisciTag = function(lista) {
    return window.Model.unisciTag(lista);
};

window.aggiungiTagCsv = function(csv, daAggiungere) {
    return window.Model.unisciTag(window.Model.listaTag(csv).concat(window.Model.listaTag(daAggiungere)));
};

window.rimuoviTagCsv = function(csv, daRimuovere) {
    const fuori = new Set(window.Model.listaTag(daRimuovere).map(t => window.Model.chiaveTag(t)));
    if (fuori.size === 0) return window.Model.unisciTag(csv);
    return window.Model.unisciTag(window.Model.listaTag(csv).filter(t => !fuori.has(window.Model.chiaveTag(t))));
};

window.selezionaTuttiIRisultati = function() {
    if (typeof window.getManoscrittiFiltrati !== 'function') return 0;
    const ids = window.getManoscrittiFiltrati().map(m => m.id);
    window.selectedRecords = ids;
    window.lastSelectedId = ids.length > 0 ? ids[ids.length - 1] : null;
    if (typeof renderMain === 'function') renderMain();
    if (typeof renderSidebar === 'function') renderSidebar();
    window.aggiornaStatoSelezione();
    if (typeof mostraMessaggio === 'function' && ids.length > 0) {
        mostraMessaggio(
            window.t('msg_selected_all', '{var0} schede selezionate.').replace('{var0}', String(ids.length)),
            'info'
        );
    }
    return ids.length;
};

function _bRecordSelezionati() {
    const ids = window.selectedRecords || [];
    if (ids.length === 0) return [];
    const set = new Set(ids.map(String));
    return appData.manoscritti.filter(m => set.has(String(m.id)));
}

async function _bSalva() {
    await window.Store.commit();
}

window.applicaInMassa = async function(descrizione, mutatore, messaggio) {
    const records = _bRecordSelezionati();
    if (records.length === 0) return 0;

    let username = 'Anonimo';
    try {
        const settings = await window.apiSettings.get();
        username = settings.username || 'Anonimo';
    } catch (err) {
        console.error('Impostazioni non leggibili, uso "Anonimo" come autore:', err);
    }

    const primaDi = [];
    const adesso = Date.now();
    let toccati = 0;

    for (const m of records) {
        let patch;
        try {
            patch = mutatore(m);
        } catch (err) {
            console.error('Mutatore fallito sul record', m.id, err);
            continue;
        }
        if (!patch) continue;
        primaDi.push(JSON.parse(JSON.stringify(m)));
        Object.assign(m, patch, { lastModified: adesso, modificatoDa: username });
        toccati++;
    }

    if (toccati === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(window.t('msg_bulk_nothing', 'Nessuna scheda è stata modificata.'), 'info');
        }
        return 0;
    }

    await _bSalva();

    const ripristina = async () => {
        ripristinaSchede(primaDi);
        await _bSalva();
    };

    const testo = (messaggio || window.t('msg_bulk_done', '{var0} schede modificate.')).replace('{var0}', String(toccati));
    registraAnnullabile(descrizione, testo, ripristina);
    return toccati;
};

window.spostaSelezionatiInCartella = function(cartella) {
    const destinazione = cartella || '';
    return window.applicaInMassa(
        window.t('undo_bulk_move', 'Spostamento di schede'),
        (m) => (m.cartella === destinazione ? null : { cartella: destinazione }),
        window.t('msg_bulk_moved', '{var0} schede spostate.')
    );
};

window.cambiaTipoSelezionati = function(tipoId) {
    if (!tipoId) return Promise.resolve(0);
    return window.applicaInMassa(
        window.t('undo_bulk_type', 'Cambio di tipo documento'),
        (m) => ((m.tipoDocumento || 'manoscritto') === tipoId ? null : { tipoDocumento: tipoId }),
        window.t('msg_bulk_type', 'Tipo cambiato su {var0} schede.')
    );
};

window.tagSelezionati = function(tags, modo) {
    const lista = window.dividiTag(tags);
    if (lista.length === 0) return Promise.resolve(0);
    const aggiunge = modo !== 'rimuovi';
    if (aggiunge && typeof window.registraTagUsati === 'function') window.registraTagUsati(lista);
    return window.applicaInMassa(
        aggiunge ? window.t('undo_bulk_tag_add', 'Aggiunta di tag') : window.t('undo_bulk_tag_del', 'Rimozione di tag'),
        (m) => {
            const attuali = m.tags || '';
            const nuovi = aggiunge ? window.aggiungiTagCsv(attuali, lista) : window.rimuoviTagCsv(attuali, lista);
            return nuovi === attuali ? null : { tags: nuovi };
        },
        aggiunge ? window.t('msg_bulk_tag_add', 'Tag aggiunti a {var0} schede.') : window.t('msg_bulk_tag_del', 'Tag rimossi da {var0} schede.')
    );
};

window.sostituisciNeiSelezionati = function(campo, cerca, sostituisci, opzioni) {
    if (!campo || !cerca) return Promise.resolve(0);
    return window.applicaInMassa(
        window.t('undo_bulk_replace', 'Trova e sostituisci'),
        (m) => {
            const valore = m[campo];
            if (typeof valore !== 'string' || valore === '') return null;
            const nuovo = window.sostituisciTesto(valore, cerca, sostituisci, opzioni);
            return nuovo === valore ? null : { [campo]: nuovo };
        },
        window.t('msg_bulk_replaced', 'Sostituzione applicata a {var0} schede.')
    );
};

window.campiSostituibili = function(records) {
    const campi = ['segnatura', 'tags'];
    for (const m of (records || [])) {
        const tipo = (appData.tipiDocumento || []).find(t => t.id === (m.tipoDocumento || 'manoscritto'))
            || { campi: ['titolo', 'autore', 'note'] };
        for (const def of window.Model.campiDellaScheda(m, tipo, window.CONFIG_CAMPI, appData)) {
            if (def.tipo === 'dynamic_list' || def.tipo === 'attachments') continue;
            if (!campi.includes(def.id)) campi.push(def.id);
        }
    }
    return campi;
};

function _bT(k, d) { return window.t(k, d); }

function _bEtichettaCampo(campo) {
    if (campo === 'segnatura') return _bT('bulk_field_signature', 'Segnatura');
    if (campo === 'tags') return _bT('bulk_field_tags', 'Tag');
    const conf = window.CONFIG_CAMPI[campo] || {};
    const tradotta = window.t('field_' + campo);
    return tradotta !== 'field_' + campo ? tradotta : (conf.label || campo);
}

function _bRiga(etichetta, controllo) {
    const wrap = document.createElement('label');
    wrap.className = 'flex flex-col gap-1';
    const span = document.createElement('span');
    span.className = 'form-label mb-0';
    span.textContent = etichetta;
    wrap.append(span, controllo);
    return wrap;
}

function _bSelect(id, opzioni, valore) {
    const sel = document.createElement('select');
    sel.id = id;
    sel.className = 'form-input';
    for (const o of opzioni) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if (o.value === valore) opt.selected = true;
        sel.appendChild(opt);
    }
    return sel;
}

function _bNota(testo) {
    const p = document.createElement('p');
    p.className = 'text-xs text-stone-500 dark:text-stone-400 leading-relaxed';
    p.textContent = testo;
    return p;
}

window.chiudiAzioniMassa = function() {
    const modal = document.getElementById('bulk-modal');
    if (modal) modal.classList.add('hidden-tab');
};

window.apriAzioneMassa = function(azione) {
    const records = _bRecordSelezionati();
    if (records.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_bT('msg_bulk_no_selection', 'Seleziona almeno una scheda.'), 'info');
        }
        return;
    }
    const modal = document.getElementById('bulk-modal');
    if (!modal) return;

    const corpo = modal.querySelector<HTMLElement>('#bulk-body');
    const titolo = modal.querySelector('#bulk-title');
    const conta = modal.querySelector('#bulk-count');
    corpo.innerHTML = '';

    const vecchioConferma = modal.querySelector('#bulk-confirm');
    const conferma = vecchioConferma.cloneNode(true) as HTMLButtonElement;
    vecchioConferma.parentNode.replaceChild(conferma, vecchioConferma);
    conferma.disabled = false;

    conta.textContent = records.length === 1
        ? _bT('selection_count_one', '1 scheda selezionata')
        : _bT('selection_count_many', '{var0} schede selezionate').replace('{var0}', String(records.length));

    let esegui = null;

    if (azione === 'cartella') {
        titolo.textContent = _bT('bulk_move_title', 'Sposta in un archivio');
        const opzioni = [{ value: '', label: _bT('folder_root_label', 'Radice') }];
        for (const c of (appData.cartelle || []).slice().sort((a, b) => window.confrontaNaturale(a, b))) {
            opzioni.push({ value: c, label: c });
        }
        const sel = _bSelect('bulk-cartella', opzioni, window.cartellaAttuale || '');
        corpo.appendChild(_bRiga(_bT('bulk_label_folder', 'Archivio di destinazione'), sel));
        esegui = () => window.spostaSelezionatiInCartella(sel.value);

    } else if (azione === 'tipo') {
        titolo.textContent = _bT('bulk_type_title', 'Cambia tipo di documento');
        const opzioni = (appData.tipiDocumento || []).map(t => ({
            value: t.id,
            label: window.t('model_' + t.id) !== 'model_' + t.id ? window.t('model_' + t.id) : t.nome
        }));
        const sel = _bSelect('bulk-tipo', opzioni, records[0].tipoDocumento || 'manoscritto');
        corpo.appendChild(_bRiga(_bT('bulk_label_type', 'Nuovo tipo'), sel));
        corpo.appendChild(_bNota(_bT('bulk_type_hint', 'I valori dei campi che il nuovo tipo non prevede restano salvati nella scheda, ma non saranno più visibili nel form finché non si torna al tipo precedente.')));
        esegui = () => window.cambiaTipoSelezionati(sel.value);

    } else if (azione === 'tag') {
        titolo.textContent = _bT('bulk_tag_title', 'Aggiungi o rimuovi tag');
        const modo = _bSelect('bulk-tag-modo', [
            { value: 'aggiungi', label: _bT('bulk_tag_add', 'Aggiungi') },
            { value: 'rimuovi', label: _bT('bulk_tag_remove', 'Rimuovi') }
        ], 'aggiungi');
        corpo.appendChild(_bRiga(_bT('bulk_label_action', 'Operazione'), modo));

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'bulk-tag-input';
        input.className = 'form-input';
        input.setAttribute('list', 'bulk-tag-list');
        input.placeholder = _bT('bulk_tag_ph', 'Es. pergamena, notarile');
        corpo.appendChild(_bRiga(_bT('bulk_label_tags', 'Tag'), input));

        const datalist = document.createElement('datalist');
        datalist.id = 'bulk-tag-list';
        for (const voce of window.Model.conteggiTag(appData.manoscritti, appData)) {
            const opt = document.createElement('option');
            opt.value = voce.nome;
            datalist.appendChild(opt);
        }
        corpo.appendChild(datalist);
        corpo.appendChild(_bNota(_bT('bulk_tag_hint', 'Più tag si separano con la virgola. La rimozione richiede la corrispondenza esatta del tag.')));
        esegui = () => window.tagSelezionati(input.value, modo.value);

    } else if (azione === 'sostituisci') {
        titolo.textContent = _bT('bulk_replace_title', 'Trova e sostituisci');
        const campi = window.campiSostituibili(records).map(c => ({ value: c, label: _bEtichettaCampo(c) }));
        const selCampo = _bSelect('bulk-campo', campi, 'segnatura');
        corpo.appendChild(_bRiga(_bT('bulk_label_field', 'Campo'), selCampo));

        const cerca = document.createElement('input');
        cerca.type = 'text';
        cerca.id = 'bulk-cerca';
        cerca.className = 'form-input';
        corpo.appendChild(_bRiga(_bT('bulk_label_find', 'Trova'), cerca));

        const sostituisci = document.createElement('input');
        sostituisci.type = 'text';
        sostituisci.id = 'bulk-sostituisci';
        sostituisci.className = 'form-input';
        corpo.appendChild(_bRiga(_bT('bulk_label_replace', 'Sostituisci con'), sostituisci));

        const opzioniRiga = document.createElement('div');
        opzioniRiga.className = 'flex items-center gap-4 flex-wrap';
        const mkChk = (id, etichetta) => {
            const l = document.createElement('label');
            l.className = 'flex items-center gap-2 text-sm';
            const c = document.createElement('input');
            c.type = 'checkbox';
            c.id = id;
            c.className = 'w-4 h-4 accent-amber-700';
            const s = document.createElement('span');
            s.textContent = etichetta;
            l.append(c, s);
            opzioniRiga.appendChild(l);
            return c;
        };
        const chkCaso = mkChk('bulk-maiuscole', _bT('bulk_case', 'Distingui maiuscole'));
        const chkIntere = mkChk('bulk-intere', _bT('bulk_whole', 'Solo parole intere'));
        corpo.appendChild(opzioniRiga);

        const anteprima = document.createElement('p');
        anteprima.id = 'bulk-anteprima';
        anteprima.className = 'text-sm font-medium text-stone-600 dark:text-stone-300 border-t border-stone-200 dark:border-stone-700 pt-2';
        corpo.appendChild(anteprima);

        const opz = () => ({ maiuscole: chkCaso.checked, intere: chkIntere.checked });
        const aggiornaAnteprima = () => {
            if (!cerca.value) {
                anteprima.textContent = _bT('bulk_preview_empty', 'Scrivi il testo da cercare per vedere quante schede sarebbero modificate.');
                conferma.disabled = true;
                return;
            }
            const r = window.anteprimaSostituzione(records, selCampo.value, cerca.value, opz());
            anteprima.textContent = _bT('bulk_preview', '{var0} schede, {var1} occorrenze.')
                .replace('{var0}', String(r.schede))
                .replace('{var1}', String(r.occorrenze));
            conferma.disabled = r.occorrenze === 0;
        };
        [cerca, selCampo, chkCaso, chkIntere].forEach(el => {
            el.addEventListener('input', aggiornaAnteprima);
            el.addEventListener('change', aggiornaAnteprima);
        });
        aggiornaAnteprima();

        esegui = () => window.sostituisciNeiSelezionati(selCampo.value, cerca.value, sostituisci.value, opz());
    } else {
        return;
    }

    conferma.onclick = async () => {
        conferma.disabled = true;
        try {
            await esegui();
        } catch (err) {
            console.error('Azione in massa fallita:', azione, err);
            if (typeof mostraMessaggio === 'function') {
                mostraMessaggio(_bT('msg_bulk_error', 'Azione non riuscita.'), 'error');
            }
        }
        window.chiudiAzioniMassa();
    };

    corpo.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && ((e.target as HTMLElement).tagName || '').toLowerCase() === 'input') {
            e.preventDefault();
            if (!conferma.disabled) conferma.click();
        }
    };

    modal.classList.remove('hidden-tab');
    const primo = corpo.querySelector<HTMLElement>('input, select');
    if (primo) primo.focus();
};

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('bulk-modal')) return;
        const html = `
    <div id="bulk-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="list-checks" class="w-5 h-5 text-amber-700"></i>
                    <span id="bulk-title"></span>
                </h3>
            </div>
            <div class="modal-body">
                <p id="bulk-count" class="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3"></p>
                <div id="bulk-body" class="flex flex-col gap-3"></div>
                <div class="modal-footer">
                    <button type="button" data-on-click="chiudiAzioniMassa" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_cancel">Annulla</span>
                    </button>
                    <button type="button" id="bulk-confirm" class="btn btn-primary">
                        <span data-i18n="btn_apply">Applica</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('bulk-modal')] });
    });
})();
