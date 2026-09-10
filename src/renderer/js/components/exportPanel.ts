// @ts-nocheck
// Fasi 2.5 e 2.6 — Esportazione della trascrizione e citazioni bibliografiche: superficie.
//
// UN SOLO modale per cinque formati (HTML, Markdown, RTF, BibTeX, RIS) e non due, perché la
// domanda dell'utente è una sola — "porta fuori questa scheda" — e cambia solo la
// destinazione: un editor di testo o Zotero. Due modali significherebbero due volte l'ambito
// da scegliere, due volte le impostazioni da tenere allineate e due voci in ogni menu.
//
// Qui non si genera nulla: i documenti nascono in `src/main/export/{transcriptExport,
// citations}.ts`, moduli puri, e il file lo scrive `ipc/textExportIpc.ts`. È la divisione
// della 2.1, della 2.2 e della 2.3.
//
// NOMI PRIVATI COL PREFISSO `_x`: il bundle di produzione concatena TUTTI gli script del
// renderer in un unico scope (scripts/build-renderer-bundle.js), quindi una `function _riga`
// qui sostituirebbe l'omonima di un altro file per l'intero bundle, senza errori in console.

const _xFORMATI = [
    { id: 'html', gruppo: 'trascrizione', chiave: 'tx_fmt_html', label: 'HTML', desc: 'Pagina autonoma, apribile in qualsiasi browser e allegabile a un messaggio.' },
    { id: 'md', gruppo: 'trascrizione', chiave: 'tx_fmt_md', label: 'Markdown', desc: 'Testo semplice con la formattazione conservata: per Obsidian, Pandoc, GitHub.' },
    { id: 'rtf', gruppo: 'trascrizione', chiave: 'tx_fmt_rtf', label: 'RTF', desc: 'Si apre in Word e LibreOffice mantenendo corsivi, grassetti e note.' },
    { id: 'bibtex', gruppo: 'citazione', chiave: 'tx_fmt_bibtex', label: 'BibTeX', desc: 'Voce @misc per LaTeX, Zotero e JabRef.' },
    { id: 'ris', gruppo: 'citazione', chiave: 'tx_fmt_ris', label: 'RIS', desc: 'Formato di scambio di Zotero, EndNote e Mendeley.' }
];

function _xTipoFormato(id) {
    const f = _xFORMATI.find(x => x.id === id);
    return f ? f.gruppo : 'trascrizione';
}

// --- Impostazioni persistenti -------------------------------------------------
//
// Il nome del fondo, l'autore e la data NON sono duplicati qui: si leggono da
// `window.impostazioniStampa` (2.2). Sono lo stesso dato — chi ha schedato e quale fondo —
// e una seconda copia divergerebbe al primo cambio, con la stampa che dice un fondo e il
// file BibTeX un altro. Qui restano solo le due scelte proprie di questi export.

const _xDEFAULT = { formato: 'html', intestazione: true };

window.impostazioniExportTesto = Object.assign({}, _xDEFAULT);

/** Ripristino chiave per chiave: un appState scritto da una versione futura non entra. */
window.ripristinaImpostazioniExportTesto = function(salvate) {
    if (!salvate || typeof salvate !== 'object') return;
    const o = window.impostazioniExportTesto;
    if (_xFORMATI.some(f => f.id === salvate.formato)) o.formato = salvate.formato;
    if (typeof salvate.intestazione === 'boolean') o.intestazione = salvate.intestazione;
};

function _xT(k, d) { return window.t(k, d); }

function _xSalvaImpostazioni() {
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
}

// --- Ambito -------------------------------------------------------------------

/**
 * Gli ambiti sono ESATTAMENTE quelli della stampa (`window.ambitiSelezione`, esposta da
 * printPanel): selezione, scheda aperta, risultati dei filtri, cartella corrente. Ricalcolarli
 * qui significherebbe due definizioni di "risultati correnti" da tenere allineate, e la
 * seconda sbaglierebbe il giorno in cui i filtri cambiano.
 */
function _xAmbiti() {
    if (typeof window.ambitiSelezione === 'function') return window.ambitiSelezione();
    const ids = (typeof window.getManoscrittiFiltrati === 'function' ? window.getManoscrittiFiltrati() : []).map(m => m.id);
    return [{ id: 'risultati', label: _xT('print_scope_results', 'Risultati correnti'), ids }];
}

function _xIdsAmbito(id) {
    const voce = _xAmbiti().find(a => a.id === id);
    return voce ? voce.ids : [];
}

/** Quante delle schede scelte hanno davvero del testo: è l'unico numero che conta qui. */
function _xConTrascrizione(ids) {
    const indice = new Map((appData.manoscritti || []).map(m => [String(m.id), m]));
    let n = 0;
    for (const id of ids) {
        const m = indice.get(String(id));
        if (!m) continue;
        const allegati = Array.isArray(m.allegati) ? m.allegati : [];
        const carte = allegati.some(a => a && window.trascrizioneHaTesto(a.trascrizione));
        if (carte || window.trascrizioneHaTesto(m.trascrizione)) n++;
    }
    return n;
}

// --- Controlli ----------------------------------------------------------------

function _xRiga(etichetta, controllo) {
    const wrap = document.createElement('label');
    wrap.className = 'flex flex-col gap-1';
    const span = document.createElement('span');
    span.className = 'form-label mb-0';
    span.textContent = etichetta;
    wrap.append(span, controllo);
    return wrap;
}

function _xSelect(id, opzioni, valore) {
    const sel = document.createElement('select');
    sel.id = id;
    sel.className = 'form-input';
    for (const o of opzioni) {
        const opt = document.createElement('option');
        opt.value = String(o.value);
        opt.textContent = o.label;   // textContent: i nomi delle cartelle sono dati utente
        if (String(o.value) === String(valore)) opt.selected = true;
        sel.appendChild(opt);
    }
    return sel;
}

function _xBloccoFormati(scelto) {
    const box = document.createElement('div');
    box.className = 'flex flex-col gap-3';
    for (const gruppo of ['trascrizione', 'citazione']) {
        const titoloGruppo = document.createElement('span');
        titoloGruppo.className = 'form-label mb-0';
        titoloGruppo.textContent = gruppo === 'trascrizione'
            ? _xT('tx_group_text', 'Il testo della trascrizione')
            : _xT('tx_group_citation', 'La citazione bibliografica');
        box.appendChild(titoloGruppo);

        const griglia = document.createElement('div');
        griglia.className = 'flex flex-col gap-2';
        for (const f of _xFORMATI.filter(x => x.gruppo === gruppo)) {
            const wrap = document.createElement('label');
            wrap.className = 'flex gap-2 items-start cursor-pointer p-2 rounded-lg border border-stone-200 dark:border-stone-700';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'tx-format';
            radio.value = f.id;
            radio.id = 'tx-format-' + f.id;
            radio.className = 'accent-amber-700 mt-1';
            radio.checked = f.id === scelto;
            radio.addEventListener('change', () => {
                window.impostazioniExportTesto.formato = f.id;
                _xRiempi();
            });
            const testo = document.createElement('span');
            const titolo = document.createElement('span');
            titolo.className = 'block text-sm font-medium';
            titolo.textContent = f.label;
            const desc = document.createElement('span');
            desc.className = 'block text-xs text-stone-500 dark:text-stone-400 leading-relaxed';
            desc.textContent = _xT(f.chiave + '_desc', f.desc);
            testo.append(titolo, desc);
            wrap.append(radio, testo);
            griglia.appendChild(wrap);
        }
        box.appendChild(griglia);
    }
    return box;
}

function _xRiempi() {
    const corpo = document.getElementById('tx-body');
    if (!corpo) return;
    const o = window.impostazioniExportTesto;
    corpo.innerHTML = '';

    const ambiti = _xAmbiti();
    if (!ambiti.some(a => a.id === window.__txAmbito)) window.__txAmbito = ambiti[0].id;
    const selAmbito = _xSelect('tx-scope',
        ambiti.map(a => ({ value: a.id, label: `${a.label} (${a.ids.length})` })),
        window.__txAmbito);
    selAmbito.addEventListener('change', () => { window.__txAmbito = selAmbito.value; _xAggiornaConteggio(); });
    corpo.appendChild(_xRiga(_xT('tx_scope', 'Cosa esportare'), selAmbito));

    corpo.appendChild(_xRiga(_xT('tx_format', 'Formato'), _xBloccoFormati(o.formato)));

    // L'intestazione ha senso solo per il testo: in BibTeX e RIS i metadati SONO il file.
    if (_xTipoFormato(o.formato) === 'trascrizione') {
        const wrap = document.createElement('label');
        wrap.className = 'flex items-center gap-2 text-sm cursor-pointer';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'tx-opt-header';
        input.checked = o.intestazione;
        input.className = 'accent-amber-700';
        input.addEventListener('change', () => { o.intestazione = input.checked; });
        const span = document.createElement('span');
        span.textContent = _xT('tx_opt_header', 'Intestazione con segnatura, date e archivio');
        wrap.append(input, span);
        corpo.appendChild(wrap);
    }

    const nota = document.createElement('p');
    nota.id = 'tx-count';
    nota.className = 'text-xs text-stone-500 dark:text-stone-400';
    corpo.appendChild(nota);
    _xAggiornaConteggio();
}

/**
 * Il conteggio dice DUE numeri quando servono: quante schede e quante hanno testo. Un
 * export di venti schede di cui tre trascritte non è un errore, ma saperlo prima evita di
 * cercare per mezz'ora la trascrizione che non è mai stata scritta.
 */
function _xAggiornaConteggio() {
    const nota = document.getElementById('tx-count');
    if (!nota) return;
    const ids = _xIdsAmbito(window.__txAmbito);
    const bottone = document.getElementById('tx-export');
    if (bottone) bottone.disabled = ids.length === 0;
    if (_xTipoFormato(window.impostazioniExportTesto.formato) === 'citazione') {
        nota.textContent = _xT('tx_count_citations', '{var0} citazioni da esportare.').replace('{var0}', String(ids.length));
        return;
    }
    const conTesto = _xConTrascrizione(ids);
    nota.textContent = _xT('tx_count', '{var0} schede, di cui {var1} con trascrizione.')
        .replace('{var0}', String(ids.length)).replace('{var1}', String(conTesto));
}

// --- Apertura e chiusura ------------------------------------------------------

window.apriEsportaTesto = function(ambito, formato) {
    const modal = document.getElementById('export-text-modal');
    if (!modal) return;
    if (ambito) window.__txAmbito = ambito;
    if (formato && _xFORMATI.some(f => f.id === formato)) window.impostazioniExportTesto.formato = formato;
    _xRiempi();
    modal.classList.remove('hidden-tab');
    const primo = document.getElementById('tx-scope');
    if (primo) primo.focus();
};

window.chiudiEsportaTesto = function() {
    const modal = document.getElementById('export-text-modal');
    if (!modal) return;
    modal.classList.add('hidden-tab');
    _xSalvaImpostazioni();
};

// --- Esecuzione ---------------------------------------------------------------

function _xOpzioniIpc() {
    const o = window.impostazioniExportTesto;
    const stampa = window.impostazioniStampa || {};
    return {
        formato: o.formato,
        intestazione: o.intestazione,
        // Fondo, autore e data vengono dalle impostazioni di stampa: sono la stessa
        // intestazione, compilata una volta sola (vedi la nota in testa al file).
        fondo: stampa.fondo || '',
        intestazioneDocumento: { fondo: stampa.fondo || '', autore: stampa.autore || '', data: stampa.data || '' },
        etichette: typeof window.etichetteColonneExport === 'function' ? window.etichetteColonneExport() : {},
        nomiTipi: typeof window.nomiTipiExport === 'function' ? window.nomiTipiExport() : {},
        apri: true,
        titolo: _xT('dialog_export_text', 'Esporta'),
        // Il main non conosce la i18n (lezione della 2.1): i testi fissi del documento
        // viaggiano nel messaggio, o un export in inglese conterrebbe intestazioni italiane.
        testi: {
            tx_doc_title: _xT('tx_doc_title', 'Trascrizioni'),
            tx_field_folder: _xT('th_folder', 'Archivio'),
            tx_field_type: _xT('th_type', 'Tipo documento'),
            tx_field_tags: _xT('th_tags', 'Tag'),
            tx_untitled: _xT('print_untitled', 'Senza segnatura'),
            tx_empty: _xT('tx_empty', 'Nessuna trascrizione.'),
            tx_ocr_notice: _xT('tx_ocr_notice', 'Bozza generata da OCR: testo non riletto, i tratti incerti sono segnalati.'),
            tx_author: _xT('print_cover_author', 'Schedatura a cura di'),
            tx_date: _xT('print_cover_date', 'Data'),
            cit_type: _xT('cit_type', 'Manoscritto'),
            cit_shelfmark: _xT('th_signature', 'Segnatura'),
            cit_chronic_date: _xT('field_dataCronica', 'Data cronica'),
            cit_untitled: _xT('cit_untitled', 'Senza titolo')
        }
    };
}

window.esportaTesto = async function() {
    const ids = _xIdsAmbito(window.__txAmbito);
    if (!ids.length) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_xT('tx_none', 'Non c\'è nessuna scheda da esportare.'), 'warning');
        return;
    }
    const bottone = document.getElementById('tx-export');
    if (bottone) bottone.disabled = true;
    try {
        // L'export si fa DAL DISCO, e l'editor della trascrizione vive in memoria finché non
        // si salva: senza questo, esportare mentre si scrive produrrebbe il testo di prima
        // dell'ultima riga battuta — un file che sembra giusto e non lo è. Si salva, e il
        // toast di `salvaTrascrizione` lo dice; il flush copre poi il salvataggio differito
        // di tutto il resto (contratto della 2.4.2).
        if (window.trascrizioneNonSalvata && typeof window.salvaTrascrizione === 'function') {
            await window.salvaTrascrizione();
        }
        if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
        const opzioni = _xOpzioniIpc();
        const citazione = _xTipoFormato(opzioni.formato) === 'citazione';
        const res = citazione
            ? await window.apiBrowser.exportCitations(ids, opzioni)
            : await window.apiBrowser.exportTranscript(ids, opzioni);
        if (res && res.success) {
            _xSalvaImpostazioni();
            window.chiudiEsportaTesto();
            if (typeof mostraMessaggio === 'function') {
                mostraMessaggio(_xT('tx_done', 'Esportate {var0} schede.').replace('{var0}', String(res.count)), 'success');
            }
        } else if (res && !res.canceled) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(_xT('tx_failed', 'Esportazione non riuscita: ') + (res.error || ''), 'error');
        }
        return res;
    } catch (errore) {
        console.error('[Export testo] Esecuzione fallita:', errore);
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_xT('tx_failed', 'Esportazione non riuscita: ') + errore.message, 'error');
        return { success: false, error: errore.message };
    } finally {
        if (bottone) bottone.disabled = false;
        _xAggiornaConteggio();
    }
};

// --- Markup -------------------------------------------------------------------

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('export-text-modal')) return;
        const html = `
    <div id="export-text-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-xl">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="file-output" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="tx_title">Esporta testo e citazioni</span>
                </h3>
            </div>
            <div class="modal-body">
                <div id="tx-body" class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scroll pr-1"></div>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiEsportaTesto()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                    <button type="button" id="tx-export" onclick="esportaTesto()" class="btn btn-primary">
                        <span data-i18n="tx_export">Esporta</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('export-text-modal')] });
    });
})();
