// @ts-nocheck
// Fase 2.2 — Stampa e PDF: superficie utente.
//
// Qui non si genera nulla: il documento nasce in `src/main/print/printTemplate.ts` (modulo
// puro) e viene reso da `printHost.ts`. Questo file sceglie COSA stampare e con quali
// opzioni, esattamente come `ocrPanel.ts` sceglie cosa riconoscere. La divisione è la
// stessa della 1.3, della 2.1 e della 2.3: la logica che si può sbagliare sta dove si può
// testare a freddo.
//
// NOMI PRIVATI COL PREFISSO `_s`: il bundle di produzione concatena TUTTI gli script del
// renderer in un unico scope (scripts/build-renderer-bundle.js). Una `function _riga` qui
// dentro sostituirebbe l'omonima di un altro file per l'intero bundle, senza un errore in
// console — è già successo nella 1.5 con `_select`.

// --- Impostazioni persistenti -------------------------------------------------
//
// Nome del fondo, autore della schedatura e opzioni di layout stanno in `appState` (cioè
// nel settings.json del workspace) e NON in `appData`: finirebbero nel database e quindi
// nel sync, e il nome di chi ha schedato è di chi ha schedato — propagarlo ai colleghi
// significherebbe firmare le loro stampe col nome di un altro.
// È la stessa ragione per cui la lingua dell'OCR sta in localStorage (2.3), applicata a un
// dato che invece è per archivio e non per macchina.

const _sDEFAULT = {
    layout: 'scheda',
    fondo: '',
    autore: '',
    data: '',
    frontespizio: false,
    miniature: true,
    trascrizione: true,
    campiVuoti: false,
    numeriPagina: true,
    orientamento: 'portrait'
};

window.impostazioniStampa = Object.assign({}, _sDEFAULT);

/** Ripristino dallo stato salvato: chiave per chiave, così un appState scritto da una
 *  versione precedente non introduce campi ignoti (stessa cautela dei filtri della 1.3). */
window.ripristinaImpostazioniStampa = function(salvate) {
    if (!salvate || typeof salvate !== 'object') return;
    const o = window.impostazioniStampa;
    if (salvate.layout === 'scheda' || salvate.layout === 'regesto' || salvate.layout === 'tabella') o.layout = salvate.layout;
    if (salvate.orientamento === 'portrait' || salvate.orientamento === 'landscape') o.orientamento = salvate.orientamento;
    for (const k of ['fondo', 'autore', 'data']) {
        if (typeof salvate[k] === 'string') o[k] = salvate[k].slice(0, 200);
    }
    for (const k of ['frontespizio', 'miniature', 'trascrizione', 'campiVuoti', 'numeriPagina']) {
        if (typeof salvate[k] === 'boolean') o[k] = salvate[k];
    }
};

function _sSalvaImpostazioni() {
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
}

// --- Ambito della stampa ------------------------------------------------------

function _sT(k, d) { return window.t(k, d); }

function _sRecordCorrente() {
    // La scheda aperta in modifica o in trascrizione: è l'ambito più naturale quando si
    // stampa mentre si sta lavorando su una carta sola.
    const vAdd = document.getElementById('view-add');
    const vTrasc = document.getElementById('view-trascrizione');
    if (vTrasc && !vTrasc.classList.contains('hidden-tab')) {
        const id = document.getElementById('trascrizione-id');
        if (id && id.value) return id.value;
    }
    if (vAdd && !vAdd.classList.contains('hidden-tab')) {
        const id = document.getElementById('manoscritto-id');
        if (id && id.value) return id.value;
    }
    return null;
}

/**
 * Gli ambiti disponibili, con il conteggio. "Risultati" è quello dei filtri correnti e non
 * la cartella: dopo una ricerca l'utente vuole stampare ciò che vede, non ciò che c'è.
 */
function _sAmbiti() {
    const voci = [];
    const selezionati = (window.selectedRecords || []).slice();
    if (selezionati.length) {
        voci.push({ id: 'selezione', label: _sT('print_scope_selection', 'Schede selezionate'), ids: selezionati });
    }
    const corrente = _sRecordCorrente();
    if (corrente) {
        voci.push({ id: 'corrente', label: _sT('print_scope_current', 'Scheda aperta'), ids: [corrente] });
    }
    const risultati = typeof window.getManoscrittiFiltrati === 'function'
        ? window.getManoscrittiFiltrati().map(m => m.id)
        : [];
    voci.push({ id: 'risultati', label: _sT('print_scope_results', 'Risultati correnti'), ids: risultati });

    const cartella = window.cartellaAttuale || '';
    const inCartella = (appData.manoscritti || [])
        .filter(m => !cartella || m.cartella === cartella || (m.cartella || '').startsWith(cartella + '/'))
        .map(m => m.id);
    voci.push({
        id: 'cartella',
        label: cartella
            ? _sT('print_scope_folder', 'Archivio corrente') + ' — ' + cartella
            : _sT('print_scope_all', 'Tutto l\'archivio'),
        ids: inCartella
    });
    return voci;
}

// Gli ambiti servono anche all'export testuale (2.5/2.6): una seconda definizione di
// "risultati correnti" divergerebbe dalla prima al primo cambio dei filtri.
window.ambitiSelezione = _sAmbiti;

function _sIdsAmbito(id) {
    const voce = _sAmbiti().find(a => a.id === id);
    return voce ? voce.ids : [];
}

// --- Costruzione del corpo ----------------------------------------------------

function _sRiga(etichetta, controllo) {
    const wrap = document.createElement('label');
    wrap.className = 'flex flex-col gap-1';
    const span = document.createElement('span');
    span.className = 'form-label mb-0';
    span.textContent = etichetta;
    wrap.append(span, controllo);
    return wrap;
}

function _sCheckbox(id, etichetta, spuntato) {
    const wrap = document.createElement('label');
    wrap.className = 'flex items-center gap-2 text-sm cursor-pointer';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = !!spuntato;
    input.className = 'accent-amber-700';
    const span = document.createElement('span');
    span.textContent = etichetta;
    wrap.append(input, span);
    return wrap;
}

function _sInput(id, valore, placeholder) {
    const el = document.createElement('input');
    el.type = 'text';
    el.id = id;
    el.className = 'form-input';
    el.value = valore || '';
    el.placeholder = placeholder || '';
    return el;
}

function _sSelect(id, opzioni, valore) {
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

/** I tre layout, con una riga che dice a cosa serve ciascuno: "regesto" e "inventario" non
 *  sono parole ovvie per chi arriva da un foglio di calcolo. */
function _sBloccoLayout(scelto) {
    const box = document.createElement('div');
    box.className = 'flex flex-col gap-2';
    const voci = [
        { id: 'scheda', label: _sT('print_layout_card', 'Scheda singola'), desc: _sT('print_layout_card_desc', 'Una scheda per pagina, con tutti i campi, gli allegati come miniature e la trascrizione.') },
        { id: 'regesto', label: _sT('print_layout_regest', 'Regesto / inventario'), desc: _sT('print_layout_regest_desc', 'Elenco ordinato: segnatura, data e sintesi del contenuto. È il formato di un inventario a stampa.') },
        { id: 'tabella', label: _sT('print_layout_table', 'Elenco tabellare'), desc: _sT('print_layout_table_desc', 'Le colonne della vista tabella, una riga per scheda.') }
    ];
    for (const v of voci) {
        const wrap = document.createElement('label');
        wrap.className = 'flex gap-2 items-start cursor-pointer p-2 rounded-lg border border-stone-200 dark:border-stone-700';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'print-layout';
        radio.value = v.id;
        radio.id = 'print-layout-' + v.id;
        radio.className = 'accent-amber-700 mt-1';
        radio.checked = v.id === scelto;
        radio.addEventListener('change', () => {
            window.impostazioniStampa.layout = v.id;
            _sRiempi();
        });
        const testo = document.createElement('span');
        const titolo = document.createElement('span');
        titolo.className = 'block text-sm font-medium';
        titolo.textContent = v.label;
        const desc = document.createElement('span');
        desc.className = 'block text-xs text-stone-500 dark:text-stone-400 leading-relaxed';
        desc.textContent = v.desc;
        testo.append(titolo, desc);
        wrap.append(radio, testo);
        box.appendChild(wrap);
    }
    return box;
}

function _sRiempi() {
    const corpo = document.getElementById('print-body');
    if (!corpo) return;
    const o = window.impostazioniStampa;
    // Il fuoco: ricostruire il corpo lo perde, e chi sta scrivendo il nome del fondo se lo
    // vedrebbe sparire alla prima lettera se il campo fosse fra i controlli ricostruiti.
    // Da qui il ripristino per id in coda, come nel pannello filtri della 1.3.
    const attivo = document.activeElement && document.activeElement.id;
    const selezione = document.activeElement && typeof document.activeElement.selectionStart === 'number'
        ? document.activeElement.selectionStart : null;
    corpo.innerHTML = '';

    // Ambito
    const ambiti = _sAmbiti();
    if (!ambiti.some(a => a.id === window.__printAmbito)) {
        window.__printAmbito = ambiti[0].id;
    }
    const selAmbito = _sSelect('print-scope',
        ambiti.map(a => ({ value: a.id, label: `${a.label} (${a.ids.length})` })),
        window.__printAmbito);
    selAmbito.addEventListener('change', () => { window.__printAmbito = selAmbito.value; _sAggiornaConteggio(); });
    corpo.appendChild(_sRiga(_sT('print_scope', 'Cosa stampare'), selAmbito));

    // Layout
    corpo.appendChild(_sRiga(_sT('print_layout', 'Formato'), _sBloccoLayout(o.layout)));

    // Intestazione: è ciò che rende la stampa citabile in un articolo.
    const box = document.createElement('div');
    box.className = 'grid grid-cols-1 sm:grid-cols-3 gap-2';
    const fondo = _sInput('print-fondo', o.fondo, _sT('print_fund_ph', 'Es. ASP, Notarile'));
    const autore = _sInput('print-autore', o.autore, _sT('print_author_ph', 'Nome e cognome'));
    const data = _sInput('print-data', o.data, _sT('print_date_ph', 'Es. giugno 2026'));
    fondo.addEventListener('input', () => { o.fondo = fondo.value; });
    autore.addEventListener('input', () => { o.autore = autore.value; });
    data.addEventListener('input', () => { o.data = data.value; });
    box.append(
        _sRiga(_sT('print_fund', 'Fondo'), fondo),
        _sRiga(_sT('print_author', 'Schedatura di'), autore),
        _sRiga(_sT('print_date', 'Data'), data)
    );
    corpo.appendChild(box);

    // Opzioni. Miniature e trascrizione riguardano solo la scheda singola: mostrarle negli
    // altri due layout sarebbe offrire un interruttore che non accende nulla.
    const opzioni = document.createElement('div');
    opzioni.className = 'flex flex-col gap-2 pt-1';
    const aggiungi = (id, etichetta, chiave) => {
        const c = _sCheckbox(id, etichetta, o[chiave]);
        c.querySelector('input').addEventListener('change', (e) => { o[chiave] = e.target.checked; });
        opzioni.appendChild(c);
    };
    aggiungi('print-opt-cover', _sT('print_opt_cover', 'Frontespizio'), 'frontespizio');
    aggiungi('print-opt-pages', _sT('print_opt_pages', 'Numeri di pagina'), 'numeriPagina');
    if (o.layout === 'scheda') {
        aggiungi('print-opt-thumbs', _sT('print_opt_thumbs', 'Miniature degli allegati'), 'miniature');
        aggiungi('print-opt-transcription', _sT('print_opt_transcription', 'Includi la trascrizione'), 'trascrizione');
        aggiungi('print-opt-empty', _sT('print_opt_empty', 'Mostra anche i campi vuoti'), 'campiVuoti');
    }
    const orientamento = _sSelect('print-orientation', [
        { value: 'portrait', label: _sT('print_portrait', 'Verticale') },
        { value: 'landscape', label: _sT('print_landscape', 'Orizzontale') }
    ], o.orientamento);
    orientamento.addEventListener('change', () => { o.orientamento = orientamento.value; });
    opzioni.appendChild(_sRiga(_sT('print_orientation', 'Orientamento'), orientamento));
    corpo.appendChild(opzioni);

    const nota = document.createElement('p');
    nota.id = 'print-count';
    nota.className = 'text-xs text-stone-500 dark:text-stone-400';
    corpo.appendChild(nota);
    _sAggiornaConteggio();

    if (attivo) {
        const el = document.getElementById(attivo);
        if (el) {
            el.focus();
            if (selezione !== null && typeof el.setSelectionRange === 'function') {
                el.setSelectionRange(selezione, selezione);
            }
        }
    }
}

function _sAggiornaConteggio() {
    const nota = document.getElementById('print-count');
    if (!nota) return;
    const n = _sIdsAmbito(window.__printAmbito).length;
    nota.textContent = _sT('print_count', '{var0} schede da stampare.').replace('{var0}', String(n));
    for (const id of ['print-pdf', 'print-now']) {
        const b = document.getElementById(id);
        if (b) b.disabled = n === 0;
    }
}

// --- Apertura e chiusura ------------------------------------------------------

window.apriStampa = function(ambito) {
    const modal = document.getElementById('print-modal');
    if (!modal) return;
    if (ambito) window.__printAmbito = ambito;
    _sRiempi();
    modal.classList.remove('hidden-tab');
    const primo = document.getElementById('print-scope');
    if (primo) primo.focus();
};

window.chiudiStampa = function() {
    const modal = document.getElementById('print-modal');
    if (!modal) return;
    modal.classList.add('hidden-tab');
    _sSalvaImpostazioni();
};

// --- Esecuzione ---------------------------------------------------------------

/**
 * Opzioni per il main. Etichette dei campi, nomi dei tipi e testi fissi del documento
 * viaggiano nel messaggio: il main non conosce la i18n (lezione della 2.1, e qui pesa di
 * più — una stampa con le intestazioni in italiano dentro un articolo in inglese è
 * inutilizzabile).
 */
function _sOpzioniIpc() {
    const o = window.impostazioniStampa;
    return {
        layout: o.layout,
        orientamento: o.orientamento,
        frontespizio: o.frontespizio,
        numeriPagina: o.numeriPagina,
        miniature: o.layout === 'scheda' ? o.miniature : false,
        includiTrascrizione: o.layout === 'scheda' && o.trascrizione,
        includiVuoti: o.layout === 'scheda' && o.campiVuoti,
        intestazione: { fondo: o.fondo, autore: o.autore, data: o.data },
        testoIntestazione: o.fondo,
        // Le colonne del layout tabellare sono quelle VISIBILI nella vista tabella (1.1):
        // ciò che si vede a schermo è ciò che finisce sulla carta, senza una seconda
        // configurazione da tenere allineata alla prima.
        colonne: typeof window.colonneTabellaCorrenti === 'function' ? window.colonneTabellaCorrenti() : [],
        etichette: typeof window.etichetteColonneExport === 'function' ? window.etichetteColonneExport() : {},
        nomiTipi: typeof window.nomiTipiExport === 'function' ? window.nomiTipiExport() : {},
        titolo: _sT('dialog_print_pdf', 'Salva in PDF'),
        testi: {
            print_doc_title: _sT('print_doc_title', 'Schedatura'),
            print_cover_fund: _sT('print_cover_fund', 'Fondo'),
            print_cover_author: _sT('print_cover_author', 'Schedatura a cura di'),
            print_cover_date: _sT('print_cover_date', 'Data'),
            print_cover_count: _sT('print_cover_count', 'Schede'),
            print_section_transcription: _sT('print_section_transcription', 'Trascrizione'),
            print_section_attachments: _sT('print_section_attachments', 'Allegati'),
            print_field_signature: _sT('th_signature', 'Segnatura'),
            print_no_records: _sT('print_no_records', 'Nessuna scheda da stampare.'),
            print_untitled: _sT('print_untitled', 'Senza segnatura'),
            // Fase 3.1: i campi `sì/no` sulla carta.
            value_yes: _sT('value_yes', 'Sì'),
            value_no: _sT('value_no', 'No')
        }
    };
}

async function _sEsegui(modo) {
    const ids = _sIdsAmbito(window.__printAmbito);
    if (!ids.length) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_sT('print_empty', 'Non c\'è nessuna scheda da stampare.'), 'warning');
        return;
    }
    const bottoni = ['print-pdf', 'print-now'].map(id => document.getElementById(id)).filter(Boolean);
    bottoni.forEach(b => { b.disabled = true; });
    if (typeof mostraMessaggio === 'function') mostraMessaggio(_sT('print_working', 'Preparazione del documento…'), 'info');
    try {
        // Il main legge il DB dal disco: flush del salvataggio differito, o si stamperebbe
        // la versione precedente di ciò che si ha davanti (contratto della 2.4.2). Il flush
        // però non copre l'editor della trascrizione, che vive in memoria finché non si
        // salva: senza la riga qui sotto, stampare mentre si scrive darebbe la carta senza
        // l'ultima riga battuta. Stessa scelta dell'export testuale (2.5).
        if (window.trascrizioneNonSalvata && typeof window.salvaTrascrizione === 'function') {
            await window.salvaTrascrizione();
        }
        if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
        const opzioni = _sOpzioniIpc();
        const res = modo === 'stampa'
            ? await window.apiBrowser.printDirect(ids, opzioni)
            : await window.apiBrowser.printPdf(ids, opzioni);
        if (res && res.success) {
            _sSalvaImpostazioni();
            window.chiudiStampa();
            if (typeof mostraMessaggio === 'function') {
                mostraMessaggio(modo === 'stampa'
                    ? _sT('print_sent', 'Documento inviato alla stampante.')
                    : _sT('print_saved', 'PDF salvato.'), 'success');
            }
        } else if (res && !res.canceled) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(_sT('print_failed', 'Stampa non riuscita: ') + (res.error || ''), 'error');
        }
        return res;
    } catch (errore) {
        console.error('[Stampa] Esecuzione fallita:', errore);
        if (typeof mostraMessaggio === 'function') mostraMessaggio(_sT('print_failed', 'Stampa non riuscita: ') + errore.message, 'error');
        return { success: false, error: errore.message };
    } finally {
        bottoni.forEach(b => { b.disabled = false; });
        _sAggiornaConteggio();
    }
}

window.salvaStampaPdf = () => _sEsegui('pdf');
window.stampaOra = () => _sEsegui('stampa');

/**
 * Stampa della VISTA corrente, dal foglio `@media print` di style.css: è l'unica strada che
 * stampa esattamente ciò che si ha davanti, filtri e ordinamento compresi, senza passare da
 * un layout. Serve per una copia di lavoro veloce; per un documento da allegare a un
 * articolo servono i tre layout del modale.
 */
window.stampaVistaCorrente = function() {
    window.chiudiStampa();
    // Il tempo di far ridisegnare la lista senza il modale sopra: `window.print()` fotografa
    // il DOM com'è in quell'istante, e un overlay ancora presente finirebbe sulla carta.
    setTimeout(() => window.print(), 80);
};

// --- Attivazione --------------------------------------------------------------
//
// Ctrl+P è agganciato QUI e in capture, non fra le scorciatoie di app.ts, per la stessa
// ragione di Ctrl+K (1.4): quell'handler esce con un `return` quando la vista trascrizione
// è aperta, e stampare la carta che si sta leggendo è proprio il caso da coprire.
// In capture anche perché Chromium ha un suo Ctrl+P nativo (`window.print()` sulla finestra
// intera, con la sidebar e i pulsanti dentro la carta): senza `preventDefault` l'utente si
// troverebbe quella, che è esattamente il risultato che questa fase esiste per evitare.
document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'p') return;
    const modale = document.querySelector('.modal-overlay:not(.hidden-tab)');
    // Il modale di stampa già aperto non si riapre; sopra un ALTRO modale non si impila.
    if (modale && modale.id !== 'print-modal') return;
    e.preventDefault();
    e.stopPropagation();
    if (!modale) window.apriStampa();
}, true);

// --- Markup -------------------------------------------------------------------

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('print-modal')) return;
        const html = `
    <div id="print-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-xl">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="printer" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="print_title">Stampa e PDF</span>
                </h3>
            </div>
            <div class="modal-body">
                <div id="print-body" class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scroll pr-1"></div>
                <div class="modal-footer">
                    <button type="button" onclick="stampaVistaCorrente()" class="btn btn-ghost mr-auto" title="Stampa la lista come la vedi">
                        <span data-i18n="print_current_view">Stampa la vista</span>
                    </button>
                    <button type="button" onclick="chiudiStampa()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                    <button type="button" id="print-now" onclick="stampaOra()" class="btn btn-secondary">
                        <span data-i18n="print_send">Stampa</span>
                    </button>
                    <button type="button" id="print-pdf" onclick="salvaStampaPdf()" class="btn btn-primary">
                        <span data-i18n="print_save_pdf">Salva PDF</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('print-modal')] });
    });
})();
