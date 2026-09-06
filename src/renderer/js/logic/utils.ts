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
        colonneTabella: window.colonneTabella || {}
    };
    
    if (window.apiSettings) {
        const settings = await window.apiSettings.get();
        settings.appState = stato;
        await window.apiSettings.save(settings);
    }
};

const CONFIG_CAMPI = {
    dataCronica: { label: 'Data Cronica', placeholder: 'Es. 12 Maggio 1340', type: 'text' },
    dataTopica: { label: 'Data Topica', placeholder: 'Es. Firenze', type: 'text' },
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
    attori_dinamici: { label: 'Persone / Attori', type: 'dynamic_list', keyPlaceholder: 'Ruolo (es. Venditore)', valPlaceholder: 'Nome della persona' },
    dichiarante: { label: 'Dichiarante', placeholder: 'Es. famiglia, istituzione...', type: 'text' },
    beni_dinamici: { label: 'Beni (Proprietà)', type: 'dynamic_list', keyPlaceholder: 'Bene (es. Casa, Terreno)', valPlaceholder: 'Valore (es. 10 fiorini)' },
    debiti_dinamici: { label: 'Debiti', type: 'dynamic_list', keyPlaceholder: 'Creditore / Motivo', valPlaceholder: 'Ammontare' },
    crediti_dinamici: { label: 'Crediti', type: 'dynamic_list', keyPlaceholder: 'Debitore / Motivo', valPlaceholder: 'Ammontare' },
    famiglia_dinamici: { label: 'Familiari', type: 'dynamic_list', keyPlaceholder: 'Parentela (es. Figlio, Moglie)', valPlaceholder: 'Nome' },
    allegati: { label: 'Allegati', type: 'attachments' }
};

window.CONFIG_CAMPI = CONFIG_CAMPI;

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
