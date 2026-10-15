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

/**
 * Locale per Intl/toLocale*: segue la lingua scelta nell'app. Prima le date erano scritte
 * con 'it-IT' fisso in otto punti, quindi un utente con l'interfaccia in inglese leggeva
 * "21/09/2026" e i mesi in italiano; altrove si passava `undefined` (locale del sistema),
 * cioè un terzo formato ancora. Unico punto di verità.
 */
window.localeAttuale = function() {
    return window.linguaAttuale === 'en' ? 'en-US' : 'it-IT';
};

// DOMPurify ammette gli attributi data-*, e fra questi ci sono i data-on-*/data-args-* che
// logic/azioni.ts trasforma in chiamate: da un HTML condiviso (una trascrizione) diventerebbero
// comandi. Vanno tolti come prima si toglievano gli onclick, che DOMPurify scarta da sé: nessun
// template con azioni passa da sanitizeHTML, quindi nessun pulsante dell'interfaccia ne perde.
const ATTR_AZIONE = /^data-(on|args)-/i;
let _hookAzioniRegistrato = false;

window.sanitizeHTML = function(html) {
    if (typeof DOMPurify !== 'undefined') {
        if (!_hookAzioniRegistrato) {
            DOMPurify.addHook('uponSanitizeAttribute', (_nodo, dati) => {
                if (ATTR_AZIONE.test(dati.attrName)) dati.keepAttr = false;
            });
            _hookAzioniRegistrato = true;
        }
        // Niente `file:`: `file://host/x` in un HTML condiviso fa partire una connessione SMB
        // con l'hash NTLM dell'utente (N1). Il main blocca comunque quelle richieste.
        return DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|archiview|local-asset|iiif-img):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i });
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
 * P3 — e le varianti grafiche del testo medievale: u/v, i/j, ſ→s, ꝛ→r, ꝺ→d, æ→ae, œ→oe.
 * "vita" trova "uita". Solo per la ricerca: l'ordinamento non passa di qui (v→u metterebbe
 * "Venezia" fra le U).
 *
 * ⚠️ æ e œ ALLUNGANO il testo: un indice trovato sul normalizzato va riportato sull'originale
 * con `posizioneOriginale`. Stesse regole di `normalizza` in main/crossArchive/testo.ts
 * (guardia: test/crossArchiveIndex.test.js).
 */
window.normalizzaTesto = function(s) {
    if (s === null || s === undefined) return '';
    const varianti = { v: 'u', j: 'i', 'ſ': 's', 'ꝛ': 'r', 'ꝺ': 'd', 'æ': 'ae', 'œ': 'oe' };
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[vjſꝛꝺæœ]/g, c => varianti[c])
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2018\u2019\u02bc\u02b9\u2032]/g, "'");
};


/** P2 — stati di lavorazione di una carta, nell'ordine in cui si mostrano. */
window.STATI_CARTA = ['daTrascrivere', 'trascritta', 'rivista', 'dubbio'];

/**
 * Carte trascritte o riviste sul totale. `null` se nessuna carta ha uno stato: la barra di
 * avanzamento compare solo dove la si sta usando.
 */
window.avanzamentoCarte = function(m) {
    const allegati = Array.isArray(m && m.allegati) ? m.allegati : [];
    if (!allegati.some(a => a && a.stato)) return null;
    const fatte = allegati.filter(a => a && (a.stato === 'trascritta' || a.stato === 'rivista')).length;
    return { fatte, totale: allegati.length };
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
// Un solo collator: `localeCompare` con opzioni ne costruisce uno a ogni confronto, e
// ordinare migliaia di schede ne faceva decine di migliaia (misurato nel render della sidebar).
// Per specifica `a.localeCompare(b, loc, opz)` equivale a `new Intl.Collator(loc, opz).compare(a, b)`.
// Il collator sta sulla funzione stessa: test/naturalSort.test.js ne estrae solo il corpo.
window.confrontaNaturale = function(a, b) {
    // Non normalizzaTesto: le sue varianti paleografiche (v→u) sono per la ricerca. Case e
    // accenti li ignora già il collator (`sensitivity: 'base'`); restano gli apostrofi.
    const sa = String(a ?? '').replace(/[‘’ʼʹ′]/g, "'").trim();
    const sb = String(b ?? '').replace(/[‘’ʼʹ′]/g, "'").trim();
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    const self = window.confrontaNaturale;
    if (!self.collatore) self.collatore = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return self.collatore.compare(sa, sb);
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
        // Etichetta secondaria dell'albero: preferenza locale come le colonne. In `appData`
        // citerebbe campi di tipi che sul PC del collega possono non esistere.
        alberoSecondario: window.alberoSecondario || null,
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
        await window.apiSettings.patch({ appState: stato });
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
    dichiarante: { label: 'Dichiarante', placeholder: 'Es. famiglia, istituzione…', type: 'text' },
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
function normalizzaAllegati(m): any[] {
    if (!m.allegati) m.allegati = [];
    if (m.allegati.length === 0 && m.allegato) {
        m.allegati.push({ nome: m.allegato, tipo: m.allegatoTipo, originalName: 'Allegato' });
    }
    return m.allegati;
}

/**
 * L'URL da cui prendere un allegato. UNICO punto che decide fra i due protocolli:
 * `local-asset:` per i file nella cartella allegati, `iiif-img:` per le carte importate da
 * un manifest e non ancora scaricate (`remoto: true`).
 *
 * Esiste perché la stessa riga era ripetuta in cinque punti (form, modali, pannello della
 * trascrizione): con l'import IIIF uno solo di essi dimenticato mostrerebbe un'immagine
 * mancante invece della carta, e il difetto salterebbe fuori in un punto a caso dell'interfaccia.
 *
 * `cacheBuster` serve dove l'immagine può cambiare sotto lo stesso nome — la
 * materializzazione di una carta remota è esattamente questo caso. Non si aggiunge a
 * `iiif-img:`, dove il nome è già l'hash dell'URL remoto e la cache è voluta.
 */
window.srcAllegato = function(allegato, opzioni) {
    if (!allegato) return '';
    const opt = opzioni || {};

    if (allegato.remoto && allegato.iiif && window.IiifManifest) {
        const iiif = allegato.iiif;
        if (!iiif.serviceId && !iiif.urlStatico) return '';
        // Si passa la CARTA, non un URL già pronto: se il server non sa servire la misura
        // chiesta serve sapere come ripiegare, e quella conoscenza sta in iiifManifest.ts,
        // che il main usa identica. Chiavi corte perché finiscono in un URL.
        const carta = { s: iiif.serviceId || null, v: iiif.apiVersione || 0, u: iiif.urlStatico || null, l: opt.lato || 0 };
        // base64url: il riferimento passa dentro UN segmento di path, senza che i suoi `/`,
        // `?` e `&` diventino struttura dell'URL. `btoa` lavora su byte e non su caratteri:
        // un URL con una lettera accentata lo farebbe altrimenti sollevare.
        let byte = '';
        for (const b of new TextEncoder().encode(JSON.stringify(carta))) byte += String.fromCharCode(b);
        return 'iiif-img://img/' + btoa(byte).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const nome = typeof allegato === 'string' ? allegato : allegato.nome;
    if (!nome) return '';
    let src = 'local-asset://' + encodeURIComponent(nome);
    if (opt.cacheBuster) src += '?t=' + Date.now();
    if (opt.frammento) src += opt.frammento;
    return src;
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
 * Rinomina nella riga (tag, vocabolari, anagrafica), non in un modale sopra il modale: un
 * secondo livello di finestra per cambiare una parola è sproporzionato. Sostituisce
 * l'elemento `selettore` della riga con un campo; `fine` riceve il testo confermato (Invio o
 * uscita dal campo) oppure `null` con Esc, una volta sola, e ridisegna.
 */
function rinominaInLoco(riga, selettore, valore, fine) {
    const nome = riga.querySelector(selettore);
    if (!nome || riga.querySelector('input[type="text"]')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input tag-manager-input';
    input.value = valore;
    riga.replaceChild(input, nome);
    input.focus();
    input.select();

    let chiuso = false;
    const chiudi = (conferma) => {
        if (chiuso) return;
        chiuso = true;
        fine(conferma ? input.value.trim() : null);
    };
    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); chiudi(true); }
        // Esc annulla la SOLA rinomina: senza stopPropagation chiuderebbe anche il modale.
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); chiudi(false); }
    };
    input.onblur = () => chiudi(true);
}

/**
 * Undo delle modifiche in massa (tag, vocabolari, azioni in massa): rimette le copie
 * fotografate. Una scheda sparita nel frattempo (eliminata, o tolta da una sync) non si
 * resuscita: l'undo annulla una modifica, non una cancellazione altrui.
 */
function ripristinaSchede(copie) {
    for (const vecchio of copie) {
        const i = appData.manoscritti.findIndex(m => String(m.id) === String(vecchio.id));
        if (i !== -1) appData.manoscritti[i] = JSON.parse(JSON.stringify(vecchio));
    }
}

/** Registra l'azione annullabile e mostra `testo` con il pulsante Annulla. */
function registraAnnullabile(descrizione, testo, ripristina) {
    if (window.gestoreAnnullamento) {
        window.gestoreAnnullamento.registraAzione(descrizione, ripristina);
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(testo, 'success', () => window.gestoreAnnullamento.annullaUltimaAzione());
        }
    } else if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(testo, 'success');
    }
}

/** `<select class="form-input">` dei pannelli (Export, Stampa). `opzioni`: [{ value, label }]. */
function creaSelect(id, opzioni, valore) {
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
    document.querySelectorAll<HTMLElement>('[data-shortcut]').forEach(el => {
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
 * Proporzione di un separatore fra due colonne, in % della colonna di sinistra: limiti 25–75,
 * e vicino a 1/3, 1/2, 2/3 si aggancia (PIANO-SCHEDA-AFFIANCATA, Fase 3). `aggancia` false: la
 * tastiera, che va a passi esatti e altrimenti non uscirebbe mai da un aggancio.
 */
window.proporzioneSeparatore = function(pct, aggancia = true) {
    const n = Number(pct);
    let p = Math.min(75, Math.max(25, Number.isFinite(n) ? n : 50));
    if (aggancia) for (const s of [100 / 3, 50, 200 / 3]) if (Math.abs(p - s) < 2) p = s;
    return p;
};

/**
 * Separatore trascinabile, anche da tastiera (←/→ di 2 punti) e col doppio clic (metà).
 * `attuale()` dà la % corrente, `daPuntatore(x)` converte un clientX, `applica(p)` ridisegna,
 * `fine(p)` ricorda. Durante il trascinamento `data-percento` porta «52 % · 48 %».
 */
window.attivaSeparatore = function(sep, { attuale, daPuntatore, applica, fine }) {
    const imposta = (valore, ricorda, aggancia = true) => {
        const p = window.proporzioneSeparatore(valore, aggancia);
        sep.setAttribute('aria-valuenow', String(Math.round(p)));
        sep.dataset.percento = `${Math.round(p)} % · ${Math.round(100 - p)} %`;
        applica(p);
        if (ricorda) fine(p);
    };
    sep.setAttribute('aria-valuemin', '25');
    sep.setAttribute('aria-valuemax', '75');
    sep.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        sep.setPointerCapture(e.pointerId);
        sep.classList.add('is-trascina');
        document.body.style.cursor = 'col-resize';
    });
    sep.addEventListener('pointermove', (e) => {
        if (sep.hasPointerCapture(e.pointerId)) imposta(daPuntatore(e.clientX), false);
    });
    const lascia = (e) => {
        if (!sep.hasPointerCapture(e.pointerId)) return;
        sep.releasePointerCapture(e.pointerId);
        sep.classList.remove('is-trascina');
        document.body.style.cursor = '';
        fine(attuale());
    };
    sep.addEventListener('pointerup', lascia);
    sep.addEventListener('pointercancel', lascia);
    sep.addEventListener('dblclick', () => imposta(50, true));
    sep.addEventListener('keydown', (e) => {
        const passo = e.key === 'ArrowLeft' ? -2 : (e.key === 'ArrowRight' ? 2 : 0);
        if (!passo) return;
        e.preventDefault();
        imposta(attuale() + passo, true, false);
    });
    return imposta;
};

/** localStorage per le preferenze di comodo: può lanciare (storage disabilitato) e non è grave. */
window.prefLocale = function(chiave, valore?) {
    try {
        if (valore === undefined) return localStorage.getItem(chiave);
        localStorage.setItem(chiave, String(valore));
    } catch (e) { /* solo comodità */ }
    return null;
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
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_perf_save_failed", "Impossibile salvare la preferenza: ") + res.error, "error");
            return;
        }
    }
    if (typeof renderMain === 'function') renderMain();
    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(window.t("msg_perf_mode_saved", "Preferenza salvata. Riavvia l'app per applicare anche la disattivazione dell'accelerazione hardware."), "info");
    }
};
