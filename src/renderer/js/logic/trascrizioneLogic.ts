// Trascrizione per carta e per pagina di PDF, e la derivata della scheda. Funzioni pure su
// `window`. Spostato da utils.ts (PIANO-REFACTOR Fase 7).

// --- Trascrizione per allegato (Fase 2.3-bis) --------------------------------
//
// Una scheda con più carte aveva UNA sola trascrizione: cambiando allegato il pannello di
// sinistra restava fermo sul testo precedente, e chi schedava un fascicolo doveva tenere
// tutte le carte in un unico blocco. Il testo vive ora in `m.allegati[i].trascrizione`.
//
// ⚠️ `m.trascrizione` NON è stata eliminata: resta, ricalcolata a ogni salvataggio come
// concatenazione delle carte (`componiTrascrizioneRecord`). Costa una copia del testo nel
// database, e la si paga per due ragioni concrete:
//  1. i consumatori in sola lettura — indice di ricerca (`SEARCH_FIELDS_BASE`), filtro
//     "ha trascrizione", diff del merge — continuano a funzionare **senza una riga di
//     modifica**, quindi senza il rischio di dimenticarne uno;
//  2. un collega con una versione precedente dell'app, che riceve il record dalla
//     sincronizzazione, continua a vedere il testo. Con la sola forma nuova vedrebbe una
//     scheda vuota, cioè un lavoro apparentemente perduto.

/** Un contenteditable svuotato lascia `<p><br></p>`: "ha testo" non può essere `!== ''`. */
window.trascrizioneHaTesto = function(html) {
    return String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
};

/**
 * Testo dell'allegato `i`. Senza allegati la trascrizione resta quella della scheda.
 * `pagina` (da 1) conta solo per i PDF: è la pagina del documento, e ha il suo testo.
 */
window.leggiTrascrizioneAllegato = function(m, i, pagina) {
    if (!m) return '';
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) return m.trascrizione || '';
    const a = allegati[i];
    if (!a) return '';
    if (pagina > 0 && a.tipo === 'pdf') {
        window.migraTrascrizionePdfSuPagine(a);
        if (!Array.isArray(a.pagine)) return '';
        return typeof a.pagine[pagina - 1] === 'string' ? a.pagine[pagina - 1] : '';
    }
    return typeof a.trascrizione === 'string' ? a.trascrizione : '';
};

window.scriviTrascrizioneAllegato = function(m, i, html, pagina) {
    if (!m) return;
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) { m.trascrizione = html; return; }
    const a = allegati[i];
    if (!a) return;
    if (!(pagina > 0 && a.tipo === 'pdf')) { a.trascrizione = html; return; }

    window.migraTrascrizionePdfSuPagine(a);
    const pagine = Array.isArray(a.pagine) ? a.pagine : [];
    const vuota = !window.trascrizioneHaTesto(html);
    // Il travaso scrive anche le pagine solo sfogliate: senza questo, scorrere un PDF di
    // trecento carte lascerebbe trecento `<p><br></p>` nel database e nella sincronizzazione.
    if (vuota && pagina > pagine.length) return;
    for (let k = pagine.length; k < pagina - 1; k++) pagine[k] = '';
    pagine[pagina - 1] = vuota ? '' : html;
    while (pagine.length && pagine[pagine.length - 1] === '') pagine.pop();
    a.pagine = pagine;
    a.trascrizione = window.componiPagineAllegato(pagine);
};

// --- Trascrizione per pagina nei PDF -----------------------------------------
//
// Un PDF di trenta carte è UN allegato: con il solo testo per allegato, sfogliandolo il
// pannello di sinistra restava fermo. Le pagine vivono in `allegato.pagine` (indice 0 =
// p. 1), e `allegato.trascrizione` resta come forma derivata per la stessa ragione di
// `m.trascrizione`: tutto ciò che la legge (derivata della scheda, OCR, export, versioni
// precedenti dell'app) continua a funzionare senza sapere che le pagine esistono.
//
// La derivata usa lo STESSO marcatore di pagina dell'OCR multipagina (`unisciPagine` in
// ocrText.ts). È ciò che rende la conversione reversibile: una trascrizione OCR fatta prima
// di questa funzione si divide esattamente, e così la derivata modificata da un collega con
// una versione vecchia.

/** Derivata di un PDF: le pagine con testo, ciascuna col suo `[p. N]`. */
window.componiPagineAllegato = function(pagine) {
    const lista = Array.isArray(pagine) ? pagine : [];
    const conTesto = [];
    for (let k = 0; k < lista.length; k++) {
        if (window.trascrizioneHaTesto(lista[k])) conTesto.push(k);
    }
    if (conTesto.length === 0) return '';
    // Solo la prima pagina: nessun marcatore, e la derivata coincide con il testo di sempre.
    if (conTesto.length === 1 && conTesto[0] === 0) return lista[0];
    const pezzi = [];
    for (const k of conTesto) {
        pezzi.push('<p class="ocr-pagina"><strong>[p. ' + (k + 1) + ']</strong></p>');
        pezzi.push(lista[k]);
    }
    return pezzi.join('\n');
};

/**
 * Inversa di `componiPagineAllegato`. Il testo prima del primo marcatore è della p. 1 (lì
 * finisce anche l'intestazione dell'OCR); due marcatori della stessa pagina — un OCR accodato
 * a un altro — si sommano invece di sovrascriversi.
 */
window.dividiTrascrizionePerPagine = function(html) {
    const testo = String(html || '');
    const marcatore = /<p\b[^>]*\bclass="[^"]*\bocr-pagina\b[^"]*"[^>]*>\s*<(strong|b)>\s*\[p\.\s*(\d{1,5})\]\s*<\/\1>\s*<\/p>/gi;
    const pagine = [];
    const aggiungi = (k, pezzo) => {
        const pulito = pezzo.replace(/^\n/, '').replace(/\n$/, '');
        if (!window.trascrizioneHaTesto(pulito)) return;
        for (let j = pagine.length; j <= k; j++) pagine[j] = '';
        pagine[k] = pagine[k] ? pagine[k] + '\n' + pulito : pulito;
    };
    let paginaCorrente = 0;
    let ultimo = 0;
    let trovato;
    while ((trovato = marcatore.exec(testo)) !== null) {
        aggiungi(paginaCorrente, testo.slice(ultimo, trovato.index));
        const n = Number(trovato[2]);
        paginaCorrente = n > 0 ? n - 1 : 0;
        ultimo = marcatore.lastIndex;
    }
    aggiungi(paginaCorrente, testo.slice(ultimo));
    return pagine;
};

/**
 * Porta un allegato PDF sulla forma per pagina. Idempotente, in memoria, come la migrazione
 * sugli allegati. Rifà la divisione anche quando `pagine` esiste ma la derivata non torna:
 * vuol dire che l'ha modificata una versione dell'app che le pagine non le conosce, e il suo
 * testo è il più recente — tenere `pagine` butterebbe via il lavoro di quel collega.
 *
 * @returns true se ha (ri)costruito le pagine.
 */
window.migraTrascrizionePdfSuPagine = function(a) {
    if (!a || a.tipo !== 'pdf') return false;
    const testo = typeof a.trascrizione === 'string' ? a.trascrizione : '';
    if (Array.isArray(a.pagine)) {
        if (window.componiPagineAllegato(a.pagine) === testo) return false;
    } else if (!window.trascrizioneHaTesto(testo)) {
        return false;
    }
    a.pagine = window.dividiTrascrizionePerPagine(testo);
    return true;
};

/**
 * Migrazione idempotente, in memoria: la vecchia trascrizione unica diventa quella della
 * PRIMA carta. Non si tenta di spezzarla — non c'è modo di sapere dove finisce una carta e
 * comincia l'altra, e un taglio inventato sarebbe peggio di un blocco unico da smistare a
 * mano. Gira all'apertura della vista e si limita a leggere se è già stata fatta.
 *
 * @returns true se ha spostato qualcosa (serve ai test e al log, non al chiamante).
 */
window.migraTrascrizioneSuAllegati = function(m) {
    if (!m) return false;
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) return false;
    // Se anche una sola carta ha già il campo, la migrazione è avvenuta: rifarla
    // sovrascriverebbe il lavoro fatto dopo.
    if (allegati.some(a => a && typeof a.trascrizione === 'string')) return false;
    if (!window.trascrizioneHaTesto(m.trascrizione)) return false;
    allegati[0].trascrizione = m.trascrizione;
    return true;
};

/**
 * Forma derivata per `m.trascrizione`: le carte in ordine, ciascuna preceduta dal nome
 * dell'allegato quando ce n'è più di una. L'intestazione non è decorazione — è ciò che
 * rende leggibile il testo a chi lo riceve da una versione vecchia dell'app o lo esporta.
 */
/**
 * Dopo un merge (sync o modale dei conflitti): `Model.fondiRecord` fonde le carte una per una
 * e non tocca la trascrizione derivata, che qui si ricompone dalle carte fuse. Senza, ricerca
 * ed export leggerebbero il testo di uno solo dei due lati fino al salvataggio successivo.
 */
window.ricomponiTrascrizioneFusa = function(m) {
    if (m && window.Model && window.Model.trascrizioneDerivata(m)) m.trascrizione = window.componiTrascrizioneRecord(m);
    return m;
};

window.componiTrascrizioneRecord = function(m) {
    if (!m) return '';
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) return m.trascrizione || '';

    const pezzi = [];
    let conTesto = 0;
    for (const a of allegati) {
        if (a && window.trascrizioneHaTesto(a.trascrizione)) conTesto++;
    }
    for (let i = 0; i < allegati.length; i++) {
        const a = allegati[i];
        if (!a || !window.trascrizioneHaTesto(a.trascrizione)) continue;
        if (conTesto > 1) {
            const nome = a.originalName || a.nome || String(i + 1);
            pezzi.push('<p class="trasc-carta"><strong>' + window.escapeHTML(nome) + '</strong></p>');
        }
        pezzi.push(a.trascrizione);
    }
    return pezzi.join('\n');
};
