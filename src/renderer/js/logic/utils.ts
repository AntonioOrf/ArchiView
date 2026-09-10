// @ts-nocheck
// Stato globale per le cartelle espansive
// '' = radice virtuale, espansa di default
window.cartelleEspanse = window.cartelleEspanse || new Set(['']);

window.escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

window.sanitizeHTML = function(html) {
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file|archiview|local-asset):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i });
    }
    return window.escapeHTML(html); // Fallback to escape if DOMPurify is not loaded
};

// Annuncio per screen reader. Unico punto d'ingresso alle due live region di toasts-bars.html:
// sempre textContent (nessuna superficie XSS) e mai focus rubato.
// Il doppio passaggio svuota/riscrive serve perché una live region che riceve lo stesso identico
// testo due volte di fila non genera un secondo annuncio: senza reset, "Sincronizzazione completata"
// ripetuta resterebbe muta.
window.annunciaA11y = function(testo, priorita = 'polite') {
    if (!testo) return;
    const el = document.getElementById(priorita === 'assertive' ? 'a11y-live-assertive' : 'a11y-live-polite');
    if (!el) return; // parziali HTML non ancora montati (test unitari, boot precoce)
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = String(testo); });
};

/**
 * Normalizzazione del testo per la ricerca: minuscole, diacritici rimossi, varianti
 * tipografiche dell'apostrofo unificate.
 * Su testo medievale e latino la stessa parola ricorre accentata e non ("Perugia"/"Perùgia",
 * "podesta"/"podestà") e gli apostrofi curvi incollati da Word non corrispondono a quello
 * che l'utente digita: senza questa normalizzazione la ricerca manca sistematicamente
 * i record trascritti da un'altra fonte.
 *
 * Nota: preserva la lunghezza sul testo precomposto (NFD scompone il carattere accentato
 * in base + segno, la strip lo ricompatta a 1 carattere), proprietà su cui si appoggiano
 * gli offset degli snippet dei suggerimenti di ricerca.
 */
window.normalizzaTesto = function(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2018\u2019\u02bc\u02b9\u2032]/g, "'");
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
    archivio: 'cartella',
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
    return n;
};

/**
 * Confronto naturale per le segnature: "MS 2" viene prima di "MS 10", non dopo.
 * Un ordinamento lessicografico su segnature con numeri (cioè su quasi tutte) produce
 * sequenze inutilizzabili, ed è la ragione per cui l'ordinamento alfabetico semplice
 * non basta in un archivio.
 *
 * Delega a localeCompare con `numeric: true`, la stessa collazione già usata per le
 * cartelle nella sidebar, ma normalizza prima gli accenti: senza, "Perùgia" e "Perugia"
 * finiscono in due punti diversi della lista.
 *
 * I valori vuoti vanno SEMPRE in coda, in entrambe le direzioni: sono record incompleti,
 * e vederseli in testa quando si inverte l'ordine è rumore, non informazione.
 */
window.confrontaNaturale = function(a, b) {
    const sa = window.normalizzaTesto(a).trim();
    const sb = window.normalizzaTesto(b).trim();
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
};

window.salvaStatoPosizione = async function() {
    const vAdd = document.getElementById('view-add');
    const vTrasc = document.getElementById('view-trascrizione');
    let tabAttuale = 'list';
    if (vAdd && !vAdd.classList.contains('hidden-tab')) tabAttuale = 'add';
    else if (vTrasc && !vTrasc.classList.contains('hidden-tab')) tabAttuale = 'trascrizione';

    const stato = {
        cartella: typeof window.cartellaAttuale === 'string' ? window.cartellaAttuale : '',
        tab: tabAttuale,
        trascrizioneId: document.getElementById('trascrizione-id') ? document.getElementById('trascrizione-id').value : null,
        cartelleEspanse: Array.from(window.cartelleEspanse),
        // Ricerca e tag fanno parte del contesto di lavoro quanto la cartella: senza di
        // loro, riaprendo l'app si ricomincia sempre dall'archivio intero.
        ricerca: document.getElementById('search-input') ? document.getElementById('search-input').value : '',
        tagAttivi: window.activeTags ? Array.from(window.activeTags) : [],
        // Ordinamento e modalità di vista: sono preferenze di lavoro, non di sessione.
        // Ritrovare la lista ordinata come la si era lasciata è metà del valore di 1.1.
        sort: window.sortState ? { campo: window.sortState.campo, dir: window.sortState.dir } : null,
        vista: window.vistaLista || 'griglia',
        colonneTabella: window.colonneTabella || {},
        // Fase 1.3. I filtri avanzati sono contesto di lavoro come la ricerca; le
        // ricerche salvate sono invece una preferenza duratura, ma vivono nello stesso
        // appState perché sono per workspace e NON vanno sincronizzate: una ricerca
        // salvata cita cartelle e tipi che sull'altro PC possono non esistere.
        filtriAvanzati: window.filtriAvanzati || null,
        ricercheSalvate: Array.isArray(window.ricercheSalvate) ? window.ricercheSalvate : [],
        // Fase 2.2. Nome del fondo, autore della schedatura e opzioni di stampa: stanno qui
        // e non in `appData` perché non vanno sincronizzate — la firma di chi ha schedato è
        // di chi ha schedato, e propagarla firmerebbe col suo nome le stampe dei colleghi.
        stampa: window.impostazioniStampa || null,
        // Fasi 2.5/2.6: formato preferito degli export testuali. Fondo e autore NON
        // si ripetono qui, sono quelli di `stampa` (una sola intestazione).
        esportaTesto: window.impostazioniExportTesto || null
    };
    
    if (window.apiSettings) {
        const settings = await window.apiSettings.get();
        settings.appState = stato;
        await window.apiSettings.save(settings);
    }
};

const CONFIG_CAMPI = {
    // `date` e non `text` (Fase 3.1): oggi si comporta ancora come una stringa libera — il
    // parser della data storica fuzzy è la 3.2 — ma dichiararlo ora è ciò che permetterà a
    // quella fase di trovare i campi da convertire senza chiedere all'utente di
    // ridichiararli uno per uno. ⚠️ `dataTopica` resta testo: è un LUOGO, non una data.
    dataCronica: { label: 'Data Cronica', placeholder: 'Es. 12 Maggio 1340', type: 'date' },
    dataTopica: { label: 'Data Topica', placeholder: 'Es. Firenze', type: 'text', authority: 'luogo' },
    autore: { label: 'Autore/i', placeholder: 'Es. Anonimo / Notaio', type: 'text' },
    titolo: { label: 'Titolo / Contenuto', placeholder: 'Titolo o descrizione sintetica', type: 'text' },
    note: { label: 'Note', placeholder: 'Note testuali o codicologiche', type: 'textarea' },
    prezzo: { label: 'Prezzo', placeholder: 'Es. 12 fiorini', type: 'text' },
    Marginalia: { label: 'Marginalia', placeholder: 'Note marginali...', type: 'textarea' },
    Notaio: { label: 'Notaio', placeholder: 'Nome del notaio', type: 'text' },
    tipo_di_atto: { label: 'Tipo di Atto', placeholder: 'Es. matrimonio, vendita, testamento...', type: 'text' },
    oggetto: { label: 'Oggetto', placeholder: 'Oggetto del documento', type: 'textarea' },
    elementi_economici: { label: 'Elementi Economici', placeholder: 'Dettagli economici...', type: 'textarea' },
    magistratura: { label: 'Magistratura', placeholder: 'Es. Podestà, Capitano del Popolo...', type: 'text' },
    tipo_di_atto_giur: { label: 'Tipo di Atto', placeholder: 'Es. accusa, inquisitione, testimoni, altro', type: 'text' },
    motivazione_processo: { label: 'Motivazione del Processo', placeholder: 'Causa e ragioni del processo...', type: 'textarea' },
    condanne: { label: 'Condanne', placeholder: 'Eventuali condanne, assoluzioni o pene...', type: 'textarea' },
    // Fase 3.5 — `authority` dice che il campo alimenta l'anagrafica: su una dynamic_list
    // il nome è il VALORE della coppia (la chiave è il ruolo). La semantica sta qui, nel
    // catalogo dei campi base, per la stessa ragione del `type`: il modello condiviso non
    // conosce i campi base, e ripeterla lì sarebbero due elenchi da tenere allineati.
    attori_dinamici: { label: 'Persone / Attori', type: 'dynamic_list', authority: 'persona', keyPlaceholder: 'Ruolo (es. Venditore)', valPlaceholder: 'Nome della persona' },
    dichiarante: { label: 'Dichiarante', placeholder: 'Es. famiglia, istituzione...', type: 'text' },
    beni_dinamici: { label: 'Beni (Proprietà)', type: 'dynamic_list', keyPlaceholder: 'Bene (es. Casa, Terreno)', valPlaceholder: 'Valore (es. 10 fiorini)' },
    debiti_dinamici: { label: 'Debiti', type: 'dynamic_list', keyPlaceholder: 'Creditore / Motivo', valPlaceholder: 'Ammontare' },
    crediti_dinamici: { label: 'Crediti', type: 'dynamic_list', keyPlaceholder: 'Debitore / Motivo', valPlaceholder: 'Ammontare' },
    famiglia_dinamici: { label: 'Familiari', type: 'dynamic_list', authority: 'persona', keyPlaceholder: 'Parentela (es. Figlio, Moglie)', valPlaceholder: 'Nome' },
    allegati: { label: 'Allegati', type: 'attachments' }
};

window.CONFIG_CAMPI = CONFIG_CAMPI;

/**
 * Apre un indirizzo di un campo `url` (Fase 3.1) nel browser di sistema.
 * Solo http/https/mailto: `javascript:` e `file:` in un campo compilato da un collega e
 * arrivato via sincronizzazione sarebbero esecuzione, non un collegamento.
 */
window.apriLinkEsternoSicuro = function(url) {
    const u = String(url || '').trim();
    if (!/^(https?:\/\/|mailto:)/i.test(u)) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_link_non_valido', 'Indirizzo non valido.'), 'warning');
        return;
    }
    if (window.apiBrowser && window.apiBrowser.apriLinkEsterno) window.apiBrowser.apriLinkEsterno(u);
};

// --- UTILITY CONDIVISE ---

/**
 * Normalizza la lista allegati di un manoscritto nel formato array unificato.
 * Elimina la duplicazione di questo pattern in actions.js e ui.js.
 */
function normalizzaAllegati(m) {
    if (!m.allegati) m.allegati = [];
    if (m.allegati.length === 0 && m.allegato) {
        m.allegati.push({ nome: m.allegato, tipo: m.allegatoTipo, originalName: 'Allegato' });
    }
    return m.allegati;
}

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

/** Testo dell'allegato `i`. Senza allegati la trascrizione resta quella della scheda. */
window.leggiTrascrizioneAllegato = function(m, i) {
    if (!m) return '';
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) return m.trascrizione || '';
    const a = allegati[i];
    return (a && typeof a.trascrizione === 'string') ? a.trascrizione : '';
};

window.scriviTrascrizioneAllegato = function(m, i, html) {
    if (!m) return;
    const allegati = Array.isArray(m.allegati) ? m.allegati : [];
    if (allegati.length === 0) { m.trascrizione = html; return; }
    if (!allegati[i]) return;
    allegati[i].trascrizione = html;
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

/**
 * Debounce: esegue fn solo dopo `wait` ms dall'ultimo invocazione.
 */
function debounce(fn, wait) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Normalizza le cartelle intermedie mancanti in appData.cartelle.
 * SEPARATO da renderSidebar per evitare side-effects nel render.
 */
function normalizzaCartelle() {
    const cartelleSet = new Set(appData.cartelle);
    appData.cartelle.forEach(percorso => {
        let pathCorrente = '';
        percorso.split('/').forEach(part => {
            pathCorrente = pathCorrente ? pathCorrente + '/' + part : part;
            cartelleSet.add(pathCorrente);
        });
    });
    appData.cartelle = Array.from(cartelleSet).sort();
}

/**
 * Unico punto di uscita dalla modalità "ricerca globale" (testo E tag).
 * getManoscrittiFiltrati bypassa il filtro cartella finché uno dei due è attivo:
 * navigare l'albero deve quindi azzerarli entrambi, non solo l'input di ricerca.
 */
window.azzeraFiltriRicerca = function() {
    const input = document.getElementById('search-input');
    if (input) input.value = '';

    if (window.activeTags) window.activeTags.clear();

    // "Azzera tutti i filtri" deve azzerarli TUTTI: lasciare in piedi quelli avanzati
    // (invisibili finché non si apre il pannello) è il modo più rapido per far credere
    // all'utente che l'archivio si sia svuotato.
    if (typeof window.azzeraFiltriAvanzati === 'function') window.azzeraFiltriAvanzati(false);

    const btnClearTag = document.getElementById('btn-clear-tag');
    if (btnClearTag) btnClearTag.classList.add('hidden');

    if (typeof renderTagList === 'function') renderTagList();
    if (typeof renderSearchSuggestions === 'function') renderSearchSuggestions();
};

/**
 * Aggiunge la scorciatoia da tastiera al tooltip (e all'accessible name) di ogni
 * elemento con `data-shortcut`. Va richiamata DOPO applicaTraduzioniHtml, che riscrive
 * title/aria-label dalla chiave i18n: la base viene ricalcolata ogni volta, quindi
 * l'operazione e' idempotente e sopravvive al cambio lingua.
 */
window.applicaScorciatoieTooltip = function() {
    document.querySelectorAll('[data-shortcut]').forEach(el => {
        const sc = el.getAttribute('data-shortcut');
        if (!sc) return;
        const suffisso = ' (' + sc + ')';
        const base = (testo) => (testo || '').split(suffisso)[0].trim();

        const titolo = base(el.getAttribute('title'));
        if (titolo) el.title = titolo + suffisso;

        const aria = base(el.getAttribute('aria-label'));
        if (aria) el.setAttribute('aria-label', aria + suffisso);
    });
};

/**
 * Naviga a una cartella dall'esterno dell'albero (breadcrumb, link vari):
 * azzera i filtri globali, altrimenti la griglia continuerebbe a ignorare la cartella.
 */
window.vaiACartella = function(percorso) {
    if (!percorso) return;
    window.cartellaAttuale = percorso;
    if (typeof window.espandiAntenati === 'function') window.espandiAntenati(percorso);
    window.cartelleEspanse.add(percorso);
    window.azzeraFiltriRicerca();
    if (typeof switchTab === 'function') switchTab('list');
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderMain === 'function') renderMain();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
};

/** Espande nell'albero il percorso indicato e tutti i suoi antenati. */
window.espandiAntenati = function(percorso) {
    if (!percorso) return;
    let pathCorrente = '';
    percorso.split('/').forEach(part => {
        pathCorrente = pathCorrente ? pathCorrente + '/' + part : part;
        window.cartelleEspanse.add(pathCorrente);
    });
};

// --- Modalità "prestazioni ridotte" -------------------------------------------
// Flag globale letto dal file di configurazione in userData (vedi src/main/perfConfig.ts).
// Quando è attivo: niente animazioni/transizioni, scroll istantaneo, pagine più corte.
window.modalitaPrestazioniRidotte = false;

window.comportamentoScroll = function() {
    return window.modalitaPrestazioniRidotte ? 'auto' : 'smooth';
};

window.applicaModalitaPrestazioni = function(attiva) {
    window.modalitaPrestazioniRidotte = !!attiva;
    document.documentElement.classList.toggle('perf-low', !!attiva);
};

window.initModalitaPrestazioni = async function() {
    if (!window.apiBrowser || !window.apiBrowser.getPerfMode) return;
    try {
        const cfg = await window.apiBrowser.getPerfMode();
        window.applicaModalitaPrestazioni(cfg && cfg.lowPerf);
    } catch (e) {
        console.warn("Lettura modalità prestazioni fallita:", e);
    }
};

// Il cambio richiede il riavvio solo per l'accelerazione hardware: il resto è immediato.
window.cambiaModalitaPrestazioni = async function(attiva) {
    window.applicaModalitaPrestazioni(attiva);
    if (window.apiBrowser && window.apiBrowser.setPerfMode) {
        const res = await window.apiBrowser.setPerfMode(!!attiva);
        if (res && res.success === false) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio("Impossibile salvare la preferenza: " + res.error, "error");
            return;
        }
    }
    if (typeof renderMain === 'function') renderMain();
    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(window.t("msg_perf_mode_saved", "Preferenza salvata. Riavvia l'app per applicare anche la disattivazione dell'accelerazione hardware."), "info");
    }
};
