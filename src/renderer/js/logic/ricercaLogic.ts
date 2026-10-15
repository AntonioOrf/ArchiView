// Ricerca e filtri della griglia: token, testo indicizzabile, query `campo:valore`, filtri
// avanzati. Spostato da utils.ts (PIANO-REFACTOR Fase 7); `normalizzaTesto` resta lì.

/** Indice del testo normalizzato riportato sull'originale, carattere per carattere. */
window.posizioneOriginale = function(originale, indiceNorm) {
    let n = 0;
    let i = 0;
    for (const ch of originale) {
        if (n >= indiceNorm) return i;
        n += window.normalizzaTesto(ch).length;
        i += ch.length;
    }
    return originale.length;
};

/**
 * Spezza la query in token normalizzati. Il filtro della griglia li richiede tutti (AND),
 * così "notaio 1340" seleziona i record che contengono entrambi, anche in campi diversi.
 */
window.tokenizzaRicerca = function(str) {
    const norm = window.normalizzaTesto(str).trim();
    if (!norm) return [];
    return norm.split(/\s+/).filter(Boolean);
};

/**
 * Riduce a testo il valore di un campo, qualunque forma abbia. Oltre a stringhe e numeri
 * gestisce le dynamic_list (attori, beni, debiti, crediti, familiari): sono coppie {k, v}
 * e contengono i nomi di persona, cioè ciò che si cerca più spesso in un archivio notarile.
 *
 * Vive qui, non in mainView, perché la usano due consumatori: l'indice della ricerca
 * testuale e il filtro `campo:valore` della 1.3. Due copie divergerebbero al primo tipo
 * di campo nuovo, e la ricerca per campo direbbe il falso proprio dove la griglia dice
 * il vero.
 */
window.testoIndicizzabile = function(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) {
        let out = '';
        for (const el of v) {
            if (el === null || el === undefined) continue;
            if (typeof el === 'string' || typeof el === 'number') out += el + ' ';
            else if (typeof el === 'object') out += (el.k || '') + ' ' + (el.v || '') + ' ';
        }
        return out;
    }
    return '';
};

/**
 * Analizza la query in tre parti: token liberi, frasi fra virgolette e vincoli
 * `campo:valore` (con `campo:"valore con spazi"`).
 *
 * `tokenizzaRicerca` resta la forma semplice — è ancora ciò che serve ai suggerimenti —
 * e non è stata estesa: la sua uscita è un array di stringhe, contratto su cui si
 * appoggia già dell'altro codice. Qui l'uscita è strutturata perché i vincoli per campo
 * non si possono applicare al "fieno" unico dell'indice: quello concatena tutti i campi,
 * quindi `notaio:rossi` vi troverebbe un Rossi citato nelle note.
 *
 * Un `campo:` senza valore (cioè la query a metà digitazione) viene ignorato invece di
 * diventare un token letterale che non corrisponde a nulla e svuota la lista.
 */
window.analizzaQuery = function(str) {
    const esito = { testo: [], campi: [] };
    const norm = window.normalizzaTesto(str);
    if (!norm || !norm.trim()) return esito;

    const re = /([\w\-]+):"([^"]*)"|([\w\-]+):(\S+)|([\w\-]+):(?=\s|$)|"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(norm)) !== null) {
        if (m[1] !== undefined) {
            const v = m[2].trim();
            if (v) esito.campi.push({ campo: m[1], valore: v });
        } else if (m[3] !== undefined) {
            esito.campi.push({ campo: m[3], valore: m[4] });
        } else if (m[5] !== undefined) {
            continue; // `campo:` ancora senza valore
        } else if (m[6] !== undefined) {
            const v = m[6].trim();
            if (v) esito.testo.push(v);
        } else if (m[7] !== undefined) {
            esito.testo.push(m[7]);
        }
    }
    return esito;
};

// Nomi che l'utente scrive naturalmente ma che nel record hanno un'altra chiave.
// `tipo:` è il caso che conta: nessuno digiterebbe `tipodocumento:`.
const ALIAS_CAMPI_QUERY = {
    tag: 'tags',
    tipo: 'tipodocumento',
    // Chiavi nella forma di normalizzaTesto, che è quella di `f.campo`: v→u (P3).
    archiuio: 'cartella',
    modificato: 'lastmodified'
};

/**
 * Il record soddisfa TUTTI i vincoli `campo:valore`. Il confronto sul nome del campo è
 * normalizzato (i tipi documento hanno campi come `Notaio` e `Marginalia`, con la
 * maiuscola), e un campo che il record non possiede lo esclude: `notaio:rossi` deve
 * restituire schede notarili, non tutte quelle prive di quel campo.
 */
window.recordPassaCampi = function(m, campi) {
    if (!campi || campi.length === 0) return true;
    for (const f of campi) {
        const cercato = ALIAS_CAMPI_QUERY[f.campo] || f.campo;

        // `ocr:` non è una chiave del record: il testo riconosciuto vive dentro
        // `m.allegati[].ocr.testo` (Fase 2.3). Senza questo caso il ciclo sulle chiavi non
        // lo troverebbe mai e `ocr:notaio` escluderebbe ogni scheda — il modo peggiore di
        // fallire, perché sembra "nessun risultato" e non "campo inesistente".
        if (cercato === 'ocr') {
            const testo = window.testoOcrRecord ? window.testoOcrRecord(m) : '';
            if (!testo || !window.normalizzaTesto(testo).includes(f.valore)) return false;
            continue;
        }

        let trovato = false;
        let corrisponde = false;
        for (const chiave of Object.keys(m)) {
            if (window.normalizzaTesto(chiave) !== cercato) continue;
            trovato = true;
            if (window.normalizzaTesto(window.testoIndicizzabile(m[chiave])).includes(f.valore)) {
                corrisponde = true;
                break;
            }
        }
        if (!trovato || !corrisponde) return false;
    }
    return true;
};

/**
 * Filtri avanzati (Fase 1.3): tipo documento, intervallo di data modifica, presenza di
 * allegati, presenza di trascrizione. Funzione PURA e senza effetti sul record — in
 * particolare NON usa `normalizzaAllegati`, che scriverebbe `m.allegati = []` su ogni
 * record scorso: un predicato di filtro che muta il database è un difetto, non una
 * scorciatoia.
 *
 * La cartella non è qui: dipende dalla vista corrente e resta in getManoscrittiFiltrati.
 */
window.recordPassaFiltri = function(m, filtri) {
    if (!filtri) return true;

    if (filtri.tipo && (m.tipoDocumento || 'manoscritto') !== filtri.tipo) return false;

    if (filtri.allegati === 'si' || filtri.allegati === 'no') {
        const n = Array.isArray(m.allegati) ? m.allegati.length : (m.allegato ? 1 : 0);
        if (filtri.allegati === 'si' && n === 0) return false;
        if (filtri.allegati === 'no' && n > 0) return false;
    }

    if (filtri.trascrizione === 'si' || filtri.trascrizione === 'no') {
        // Un contenteditable svuotato lascia `<br>` o `<p></p>`: senza strip dei tag,
        // "ha trascrizione" sarebbe vero per ogni scheda mai aperta in trascrizione.
        const testo = String(m.trascrizione || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        if (filtri.trascrizione === 'si' && !testo) return false;
        if (filtri.trascrizione === 'no' && testo) return false;
    }

    if (filtri.collegamenti === 'si' || filtri.collegamenti === 'no') {
        // Fase 3.5. Conta ENTRAMBI i versi, e il verso entrante non è scritto nel record:
        // `__idsCollegati` è l'indice costruito una volta per render da
        // `getManoscrittiFiltrati`, perché ricavarlo qui vorrebbe dire scorrere l'intero
        // archivio per ogni scheda — N² su un vault grande, proprio dove pesa.
        const indice = window.__idsCollegati;
        const collegata = indice ? indice.has(String(m.id)) : window.Model.relazioni(m).length > 0;
        if (filtri.collegamenti === 'si' && !collegata) return false;
        if (filtri.collegamenti === 'no' && collegata) return false;
    }

    // P2 — almeno una carta in quello stato: "da trascrivere" è la lista di lavoro.
    if (filtri.statoCarte && !(Array.isArray(m.allegati) && m.allegati.some(a => a && a.stato === filtri.statoCarte))) return false;

    if (filtri.ocr === 'si' || filtri.ocr === 'no') {
        // Fase 2.3. Serve a due domande opposte e ugualmente frequenti: "quali carte ho già
        // fatto riconoscere" e — più utile — "quali mi restano", che è la lista di lavoro
        // prima di lanciare un OCR in massa.
        const n = window.testoOcrRecord ? window.testoOcrRecord(m).trim() : '';
        if (filtri.ocr === 'si' && !n) return false;
        if (filtri.ocr === 'no' && n) return false;
    }

    if (filtri.daData || filtri.aData) {
        // Un record senza `lastModified` non ha una data da confrontare: chiedere un
        // intervallo e vederselo comparire dentro sarebbe peggio che non vederlo.
        const ts = Number(m.lastModified) || 0;
        if (!ts) return false;
        if (filtri.daData) {
            const d = Date.parse(filtri.daData + 'T00:00:00');
            if (!isNaN(d) && ts < d) return false;
        }
        if (filtri.aData) {
            // Estremo superiore INCLUSIVO: 'aData' è un giorno, non un istante, e
            // "fino al 5" deve contenere le modifiche fatte il 5 alle 18:00.
            const d = Date.parse(filtri.aData + 'T23:59:59.999');
            if (!isNaN(d) && ts > d) return false;
        }
    }

    if (filtri.daAnno || filtri.aAnno) {
        // Fase 3.2 — il periodo STORICO, non la data di modifica. Si guardano tutti i campi
        // che il tipo dichiara `date` (`dataCronica` e qualunque campo tipizzato così
        // dall'utente): basta che UNO cada nel periodo, perché una scheda con due datazioni
        // — quella dell'atto e quella della copia — appartiene a entrambi i periodi.
        if (!window.DataStorica || !window.Model) return false;
        const tipo = (typeof appData !== 'undefined' && appData.tipiDocumento)
            ? appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'))
            : null;
        // Fase 3.7 — dalla SCHEDA: una datazione scritta in un campo proprio `date` è una
        // datazione come le altre, e ignorarla escluderebbe la scheda dal suo stesso secolo.
        const campiData = window.Model.campiDellaScheda(m, tipo, window.CONFIG_CAMPI, appData)
            .filter(d => d.tipo === 'date')
            .map(d => d.id);
        // Nessun campo data nel tipo: la scheda non può soddisfare un filtro di periodo, e
        // mostrarla comunque significherebbe dire che è del Trecento senza saperlo.
        if (!campiData.length) return false;
        const dentro = campiData.some(c => window.DataStorica.nelPeriodo(m[c], filtri.daAnno, filtri.aAnno));
        if (!dentro) return false;
    }

    return true;
};

/** `base` vuota = radice virtuale: il suo sottoalbero è l'archivio intero. */
window.cartellaNelSottoalbero = function(cartella, base) {
    const c = typeof cartella === 'string' ? cartella : '';
    const b = typeof base === 'string' ? base : '';
    if (!b) return true;
    return c === b || c.indexOf(b + '/') === 0;
};

/** Filtri avanzati impostati, per il badge del pulsante e per i chip. Puro. */
window.contaFiltriAvanzati = function(filtri) {
    if (!filtri) return 0;
    let n = 0;
    if (filtri.tipo) n++;
    if (filtri.sottocartelle) n++;
    if (filtri.daData) n++;
    if (filtri.aData) n++;
    if (filtri.daAnno) n++;
    if (filtri.aAnno) n++;
    if (filtri.allegati) n++;
    if (filtri.trascrizione) n++;
    if (filtri.ocr) n++;
    if (filtri.collegamenti) n++;
    if (filtri.statoCarte) n++;
    return n;
};
