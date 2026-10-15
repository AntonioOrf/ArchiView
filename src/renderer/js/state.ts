// La forma del database vuoto la decide `shared/model.ts`, non questo file. Era un letterale
// qui, e un archivio NUOVO non passa dalle migrazioni: tutto ciò che una migrazione installa
// — i vocabolari controllati della v4, per dirne una — su un archivio nuovo non esisteva mai,
// e il bug si vedeva solo alla prima apertura di un vault appena creato (Fase 3.3).
let appData = window.Model ? window.Model.databaseVuoto()
    : { cartelle: [], manoscritti: [], tipiDocumento: [], trascrizioneEditorWidth: '50%', schemaVersion: 1 };
// Esposto su `window` per gli e2e (Playwright legge/imposta lo stato da `page.evaluate`):
// `appData` viene riassegnato (ripristino, migrazioni), quindi serve un getter, non una copia.
Object.defineProperty(window, 'appData', {
    get: () => appData,
    set: (v) => { appData = v; },
    configurable: true
});
window.cartellaAttuale = '';

// Unico punto di lettura del DB: `leggi-dati` restituisce il testo del file (O4), si analizza
// qui. Un file illeggibile vale `null` come quando lo analizzava il main.
window.leggiDatiArchivio = async function() {
    const testo = await window.apiBrowser.leggiDati();
    if (typeof testo !== 'string') return testo ?? null;
    try {
        return JSON.parse(testo);
    } catch (err) {
        console.error('[Dati] database_manoscritti.json non è JSON valido:', err);
        return null;
    }
};

async function initData() {
    if (window.apiBrowser) {
        const datiSalvati = await window.leggiDatiArchivio();
        const datiBaseSalvati = await window.apiBrowser.leggiDatiBase();
        if (datiSalvati) {
            // Fase 3.0 — la catena di migrazioni ha preso il posto delle due migrazioni
            // implicite che stavano qui (lista piatta e tipo `manoscritto`). Lo snapshot di
            // base entra PRIMA di migrare: va migrato insieme ai record, o il merge a tre vie
            // confronterebbe una scheda migrata con la sua base non migrata e dichiarerebbe
            // modificato un archivio che nessuno ha toccato.
            // La "lista piatta" delle primissime versioni si avvolge qui nella forma a oggetto
            // (la stessa che produrrebbe `migraDatabase`) solo per potervi agganciare la base:
            // su un array nudo andrebbe persa, e senza base ogni scheda diversa dal cloud
            // diventerebbe un conflitto.
            let grezzo = datiSalvati;
            if (datiBaseSalvati && Array.isArray(grezzo)) {
                grezzo = { cartelle: [], manoscritti: grezzo, tipiDocumento: [] };
            }
            if (datiBaseSalvati && grezzo && typeof grezzo === 'object' && !Array.isArray(grezzo)) {
                grezzo.baseObjects = datiBaseSalvati;
            }
            const esito = window.Model.migraDatabase(grezzo);
            appData = esito.db;
            // DB scritto prima che la base uscisse dal file: la si sposta nel suo file prima
            // che il primo salvataggio la tolga dal DB.
            if (!datiBaseSalvati && appData.baseObjects && Object.keys(appData.baseObjects).length) {
                try {
                    await window.apiBrowser.salvaDatiBase(appData.baseObjects);
                } catch (err) {
                    console.error('[Dati] Spostamento della base del merge non riuscito:', err);
                }
            }
            if (esito.futuro) {
                // File scritto da una versione più recente: si apre com'è. Migrarlo
                // all'indietro distruggerebbe dati che questa versione non sa di avere.
                console.warn('[Schema] Il database dichiara la versione', appData.schemaVersion,
                    '> di quella supportata (' + window.Model.SCHEMA_VERSION + '): aperto senza migrazioni.');
                window.schemaDalFuturo = true;
            } else if (esito.applicate.length) {
                console.info('[Schema] Migrazioni applicate:', esito.applicate.join(' | '));
                // Si scrive subito: una migrazione che resta in memoria verrebbe rifatta a
                // ogni apertura, e nel frattempo il file su disco resterebbe nel formato
                // vecchio per chiunque altro lo legga (export, stampa, sync).
                // Un fallimento non deve impedire l'apertura: la migrazione resta in memoria
                // e il prossimo salvataggio la scrive.
                try {
                    await salvaTutto({ pendenti: false });
                } catch (err) {
                    console.error('[Schema] Salvataggio dopo la migrazione non riuscito:', err);
                }
            }
        } else if (datiBaseSalvati) {
            appData.baseObjects = datiBaseSalvati;
        }
    }
    // L'albero può restare vuoto: i record senza cartella vivono nella radice virtuale ('')
    if (!appData.cartelle) {
        appData.cartelle = [];
    }

    if (!appData.tipiDocumento) {
        appData.tipiDocumento = [];
    }
    
    if (!appData.manoscritti) {
        appData.manoscritti = [];
    }
    
    // Fase 3.1 — modelli predefiniti: presenza, ordine e campi li impone `shared/model.ts`.
    // I campi dei predefiniti NON sono modificabili dall'utente (il modale li marca "non
    // modificabile"), quindi una differenza è sempre un archivio scritto da una versione
    // precedente, mai una scelta da rispettare. Il `nome`, invece, non si sovrascrive: è
    // l'unica cosa di quei tipi che si vede tradotta.
    // ⚠️ Non su un database dal futuro: là i modelli potrebbero avere campi che questa
    // versione non conosce, e imporre i nostri li cancellerebbe (stessa regola della 3.0).
    if (!window.schemaDalFuturo) window.Model.applicaModelliPredefiniti(appData);

    if (!appData.trascrizioneEditorWidth) appData.trascrizioneEditorWidth = '50%';
    
    if (window.apiSettings) {
        const settings = await window.apiSettings.get();
        window.ultimoCaricamento = settings.lastSyncTime || 0;
    } else {
        window.ultimoCaricamento = 0;
    }

    // ⚠️ Nessuna base creata dai dati locali: le modifiche non ancora sincronizzate diventerebbero
    // "antenato comune" e il merge a tre vie le scarterebbe a favore del remoto. Senza base la
    // prima sync passa dal modale dei conflitti (`rilevaConflitti`, ramo senza `baseHash`).
    if (!appData.baseObjects) appData.baseObjects = {};
    
    appData.baseHashes = {};
    if (appData.baseObjects && typeof window.getRecordHash === 'function') {
        for (const [id, m] of Object.entries(appData.baseObjects)) {
            appData.baseHashes[id] = window.getRecordHash(m);
        }
    }
}

window.impostaModifichePendenti = function(stato) {
    if (window.statoCloud) window.statoCloud.pendenti = !!stato;
    if (typeof window.aggiornaCloudStatus === 'function') window.aggiornaCloudStatus();
};

// Gestore Annullamento (Undo) e Ripetizione (Redo) — Fase 4.5
//
// Prima della 4.5 questo stack era registrato su QUATTRO eliminazioni e nient'altro: una
// modifica sbagliata a una scheda, uno spostamento nell'archivio sbagliato o una rinomina
// non erano annullabili in alcun modo, e il redo non esisteva affatto.
//
// ⚠️ TRE REGOLE
//
// 1. **`rifaiFn` è facoltativa.** Un'azione che non sa rifarsi si annulla e basta; ciò che
//    NON può fare è restare in una catena di ripetizioni insieme ad azioni che invece la
//    sanno fare, perché rifare la terza saltando la seconda produrrebbe uno stato che non è
//    mai esistito. Annullare un'azione non ripetibile azzera quindi lo stack di redo.
// 2. **Una nuova azione azzera il redo.** È la regola universale degli editor: la storia si
//    biforca, e il ramo abbandonato non è più raggiungibile.
// 3. **Le funzioni catturano COPIE, non riferimenti.** `ripristinaFn` che tiene il record
//    vivo invece di un clone rimetterebbe in archivio l'oggetto già modificato da un'altra
//    azione — cioè annullerebbe verso uno stato che nessuno ha mai visto. Vale per chi
//    registra, non per questo file, ma è qui che il contratto va letto.
window.gestoreAnnullamento = {
    stack: [],
    stackRipetizione: [],

    /**
     * @param descrizione  testo mostrato nel toast ("Eliminazione di 3 record")
     * @param ripristinaFn riporta allo stato PRECEDENTE l'azione
     * @param rifaiFn      (facoltativa) riapplica l'azione. Senza, l'azione non è ripetibile.
     */
    registraAzione(descrizione, ripristinaFn, rifaiFn) {
        this.stack.push({ descrizione, ripristinaFn, rifaiFn });
        // Limitiamo la cronologia a 50 azioni per non consumare troppa memoria
        if (this.stack.length > 50) {
            this.stack.shift();
        }
        this.stackRipetizione = [];
    },

    puoAnnullare() { return this.stack.length > 0; },
    puoRipetere() { return this.stackRipetizione.length > 0; },

    async annullaUltimaAzione() {
        if (this.stack.length === 0) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_nessuna_azione_da_annulla", "Nessuna azione da annullare."), "info");
            return;
        }

        const azione = this.stack.pop();
        try {
            await azione.ripristinaFn();
            if (azione.rifaiFn) {
                this.stackRipetizione.push(azione);
                if (this.stackRipetizione.length > 50) this.stackRipetizione.shift();
            } else {
                // Regola 1: una catena di ripetizioni con un buco in mezzo ricostruirebbe
                // uno stato mai esistito.
                this.stackRipetizione = [];
            }
            if (typeof mostraMessaggio === 'function') {
                const testo = window.t("msg_annullato_var", "Annullato: {var0}").replace("{var0}", String(azione.descrizione));
                if (azione.rifaiFn) mostraMessaggio(testo, "success", null, { label: window.t('btn_redo', 'Ripeti'), onClick: () => window.gestoreAnnullamento.ripetiUltimaAzione() });
                else mostraMessaggio(testo, "success");
            }
        } catch (err) {
            console.error("Errore durante l'annullamento:", err);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_l_annullam", "Errore durante l'annullamento dell'azione."), "error");
        }
    },

    async ripetiUltimaAzione() {
        if (this.stackRipetizione.length === 0) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_nothing_to_redo", "Nessuna azione da ripetere."), "info");
            return;
        }

        const azione = this.stackRipetizione.pop();
        try {
            await azione.rifaiFn();
            // Torna sullo stack dell'undo SENZA passare da `registraAzione`, che azzererebbe
            // la coda delle ripetizioni ancora da fare.
            this.stack.push(azione);
            if (this.stack.length > 50) this.stack.shift();
            if (typeof mostraMessaggio === 'function') {
                mostraMessaggio(window.t("msg_ripetuto_var", "Ripetuto: {var0}").replace("{var0}", String(azione.descrizione)), "success",
                    () => window.gestoreAnnullamento.annullaUltimaAzione());
            }
        } catch (err) {
            console.error("Errore durante la ripetizione:", err);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_ripetizione", "Errore durante la ripetizione dell'azione."), "error");
        }
    }
};

// --- Salvataggio coalescente -------------------------------------------------
// Il DB viene riscritto per intero a ogni CRUD: su HDD lenti una raffica di operazioni
// (multi-delete, merge, rinomina cartella) bloccava l'UI per una scrittura ciascuna.
// Qui le scritture sono serializzate in catena e coalescibili: `salvaTuttoDifferito()`
// rimanda di SAVE_DEBOUNCE_MS e riparte a ogni nuova modifica, `salvaTutto()` scrive
// subito (flush), e nessuna scrittura può sovrapporsi a un'altra.
const SAVE_DEBOUNCE_MS = 400;
let saveTimer = null;
let saveDirty = false;
let saveChain = Promise.resolve();

// La base del merge sta in .archiview-base.json: nel DB lo raddoppierebbe e viaggerebbe verso
// Drive e Hub, e chi entra in un archivio erediterebbe la base di un altro.
window.databasePerDisco = function(db) {
    const { baseObjects, baseHashes, ...resto } = db;
    return resto;
};

// Dopo un invio riuscito (push Hub, upload Drive) le schede inviate SONO il server: sono la base
// certa del prossimo merge a tre vie. Senza, una scheda creata o modificata qui e poi inviata
// restava senza base fino al pull successivo, e ricevendo ogni sua differenza dal server
// diventava un conflitto. `inviate` va copiata PRIMA dell'invio: le modifiche fatte durante
// l'invio non sono sul server e non devono entrare nella base.
window.registraBaseInviata = async function(inviate) {
    appData.baseObjects = {};
    appData.baseHashes = {};
    for (const m of inviate || []) {
        appData.baseObjects[m.id] = m;
        appData.baseHashes[m.id] = window.getRecordHash(m);
    }
    try {
        if (window.apiBrowser) await window.apiBrowser.salvaDatiBase(appData.baseObjects);
    } catch (err) {
        // Base solo in memoria: al riavvio si ricade sulla base del pull precedente.
        console.error("Errore nel salvataggio della base dopo l'invio:", err);
    }
};

async function eseguiSalvataggio(pendenti = true, dopoCommit = false) {
    // Rete di sicurezza per le mutazioni che non passano da Store.commit(). Il differito segue
    // sempre un commit, che l'ha già invalidata: rifarlo costava un secondo reindex completo.
    if (!dopoCommit && typeof window.invalidaCacheRicerca === 'function') window.invalidaCacheRicerca();
    if (!window.apiBrowser) return;

    // Validazione lato renderer: il main riceve la stringa già serializzata e non la ri-parsa.
    // Il criterio è quello condiviso di `shared/model.ts` (Fase 3.0): due validazioni diverse
    // per lo stesso file darebbero due diagnosi diverse sullo stesso guasto.
    const motivo = window.Model.motivoNonValido(appData);
    if (motivo) throw new Error("Stato in memoria non valido: " + motivo + ". Salvataggio annullato.");

    // Serializzazione unica: evita structured-clone dell'intero DB via IPC + stringify nel main.
    const payload = JSON.stringify(window.databasePerDisco(appData));
    const res = await window.apiBrowser.salvaDati(payload);
    if (res && res.success === false) throw new Error(res.error || "Salvataggio fallito");

    // Segnala modifiche pendenti se siamo connessi al cloud
    if (pendenti && window.driveStatus && window.driveStatus.isAuthenticated) {
        if (typeof window.impostaModifichePendenti === 'function') {
            window.impostaModifichePendenti(true);
        }
    }
}

// `pendenti: false` per le scritture che non sono modifiche dell'utente (migrazione all'apertura,
// risultato di una sync appena scaricata): non vanno segnalate come da caricare.
// N5: ogni scrittura del DB passa da qui, anche quelle: una chiamata diretta a `salvaDati`
// scavalcava la catena e poteva sovrapporsi a un salvataggio differito.
function salvaTutto({ pendenti = true, dopoCommit = false } = {}) {
    // Un salvataggio differito ancora in attesa è una modifica dell'utente: assorbirlo qui
    // non deve togliergli il segnale "da caricare".
    const segnala = pendenti || saveDirty || !!saveTimer;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    saveDirty = false;
    const esegui = () => eseguiSalvataggio(segnala, dopoCommit);
    const p = saveChain.then(esegui, esegui);
    saveChain = p.catch(() => {});
    return p;
}
window.salvaTutto = salvaTutto;

// Salvataggio differito: usato da Store.commit(), che rende l'UI prima di toccare il disco.
window.salvaTuttoDifferito = function(delay = SAVE_DEBOUNCE_MS) {
    saveDirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        salvaTutto({ dopoCommit: true }).catch(err => {
            console.error("Errore nel salvataggio differito:", err);
            if (typeof mostraMessaggio === 'function') {
                mostraMessaggio(window.t("msg_errore_salvataggio", "Errore nel salvataggio dei dati: ") + (err.message || err), "error");
            }
        });
    }, delay);
};

// Da chiamare prima di qualsiasi operazione che legga il DB dal disco (upload cloud,
// export, chiusura app): garantisce che il differito sia già finito su file.
window.flushSalvataggio = function() {
    if (saveTimer || saveDirty) return salvaTutto();
    return saveChain;
};
/**
 * Fase 4.2 — Riporta l'archivio allo stato di uno snapshot locale.
 *
 * ⚠️ NON è "sovrascrivi il file e ricarica". Un ripristino è una MODIFICA dell'utente, e
 * come tale deve poter viaggiare:
 *
 * 1. **Le schede che tornano indietro vengono rifirmate.** Con il loro `lastModified`
 *    d'origine — più vecchio di quello che i colleghi hanno già ricevuto — il primo sync
 *    rimetterebbe le cose com'erano, e il ripristino durerebbe fino al pull successivo.
 * 2. **Le schede create DOPO lo snapshot vengono eliminate con il loro tombstone.** Senza,
 *    tornerebbero dal cloud a ogni sync: sul server esistono ancora.
 * 3. **`baseObjects` e `baseHashes` NON si ripristinano.** Descrivono ciò che il cloud ha
 *    visto, non ciò che c'è in locale: sostituirli con quelli dello snapshot farebbe
 *    credere al merge a tre vie che il cloud sia tornato indietro anche lui, e ogni scheda
 *    modificata nel frattempo da un collega risulterebbe un conflitto.
 */
window.ripristinaDatabase = async function(dbSnapshot) {
    if (!dbSnapshot || typeof dbSnapshot !== 'object') throw new Error('Snapshot non valido');
    const esito = window.Model.migraDatabase(dbSnapshot);
    const nuovo = esito.db;
    if (!window.Model.databaseValido(nuovo)) throw new Error(window.Model.motivoNonValido(nuovo));

    const settings = window.apiSettings ? await window.apiSettings.get() : {};
    const username = settings.username || 'Anonimo';
    const adesso = Date.now();

    const attualiPerId = new Map((appData.manoscritti || []).map(m => [String(m.id), m]));
    const ripristinatiPerId = new Map((nuovo.manoscritti || []).map(m => [String(m.id), m]));

    for (const m of nuovo.manoscritti) {
        const attuale = attualiPerId.get(String(m.id));
        const cambiato = !attuale || (typeof window.getRecordHash === 'function'
            ? window.getRecordHash(attuale) !== window.getRecordHash(m)
            : JSON.stringify(attuale) !== JSON.stringify(m));
        if (cambiato) {
            m.lastModified = adesso;
            m.modificatoDa = username;
        }
    }

    // Punto 2: ciò che c'era e nello snapshot non c'è più è, a tutti gli effetti, eliminato.
    const tombstone = new Set((appData.deletedIds || []).map(String));
    for (const id of attualiPerId.keys()) if (!ripristinatiPerId.has(id)) tombstone.add(id);
    // …e ciò che torna in vita non è più eliminato.
    for (const id of ripristinatiPerId.keys()) tombstone.delete(id);

    // Punto 3: la memoria del sync resta quella corrente.
    const baseObjects = appData.baseObjects;
    const baseHashes = appData.baseHashes;

    appData = nuovo;
    appData.deletedIds = Array.from(tombstone);
    appData.baseObjects = baseObjects;
    appData.baseHashes = baseHashes;

    if (typeof window.normalizzaCartelle === 'function') window.normalizzaCartelle();
    await salvaTutto();
    if (typeof window.invalidaCacheRicerca === 'function') window.invalidaCacheRicerca();
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderMain === 'function') renderMain();
    return { schede: appData.manoscritti.length, eliminate: tombstone.size };
};

/**
 * Rilegge il DB dal disco dopo che il main l'ha riscritto (duplicazione delle schede).
 * Il file non contiene la base del merge (`databasePerDisco`): va conservata quella in memoria,
 * o la sync seguente tratterebbe ogni modifica dei colleghi come un conflitto.
 */
window.ricaricaDatiDaDisco = async function() {
    const dati = await window.leggiDatiArchivio();
    if (!dati) throw new Error('Database illeggibile dopo la scrittura.');
    const { baseObjects, baseHashes } = appData;
    appData = window.Model.migraDatabase(dati).db;
    appData.baseObjects = baseObjects;
    appData.baseHashes = baseHashes;
    await window.Store.commit();
};

window.sincronizzaEUnisciDati = async function(nuovoDati) {
    if (!nuovoDati) return;

    // Fase 3.0 — il database che arriva dal cloud può essere stato scritto da una versione
    // più vecchia dell'app (un collega che non ha aggiornato): va migrato PRIMA del merge,
    // o le sue schede entrerebbero nell'archivio locale nella forma vecchia e la migrazione
    // non le rivedrebbe più. Un file dal futuro resta invece intatto: si fondono i record,
    // non lo schema.
    if (window.Model) nuovoDati = window.Model.migraDatabase(nuovoDati).db;

    return new Promise((resolve) => {
        const loadedAt = window.ultimoCaricamento || 0;
        let conflitti = [];
        if (typeof window.rilevaConflitti === 'function') {
            conflitti = window.rilevaConflitti(appData.manoscritti, nuovoDati.manoscritti, loadedAt,
                appData.baseHashes || {}, appData.baseObjects || {});
        }
        
        const eseguiMergeFinale = async (resolvedCards = []) => {
            // La fusione dei dati è in `Model.fondiDatabase` (pura, provata in test/fondiDatabase.test.js).
            // Qui restano le domande all'utente sulle eliminazioni e la scrittura: niente tocca
            // `appData` finché il merge non si conclude, così un annullamento non lascia un
            // archivio fuso a metà.
            const esito = window.Model.fondiDatabase(appData, nuovoDati, resolvedCards);
            // Carte fuse diverse dalle locali: la trascrizione derivata va ricomposta.
            // Solo allora, così una scheda intatta resta identica byte per byte.
            for (const m of esito.daRicomporre) window.ricomponiTrascrizioneFusa(m);

            const mergedManoscritti = esito.schede;
            const deletionsList = esito.eliminateDalRemoto;
            const localDeletionsToPush = esito.eliminateInLocale;
            // Le schede rimesse da "Annulla" sulle eliminazioni locali: escono dai tombstone.
            const tombstoneDaTogliere = new Set();

            const applicaStruttura = () => {
                appData.cartelle = esito.cartelle;
                appData.deletedCartelle = esito.deletedCartelle;
                // Tag (3.4), vocabolari (3.3) e authority (3.5): un'unione vuota non sovrascrive.
                if (Object.keys(esito.tagsAnagrafica).length) appData.tagsAnagrafica = esito.tagsAnagrafica;
                if (Object.keys(esito.vocabolari).length) appData.vocabolari = esito.vocabolari;
                if (Object.keys(esito.authority).length) appData.authority = esito.authority;
                appData.tipiDocumento = esito.tipiDocumento;
                if (tombstoneDaTogliere.size && appData.deletedIds) {
                    appData.deletedIds = appData.deletedIds.filter(x => !tombstoneDaTogliere.has(x));
                }
            };

            const concludiMerge = async (manoscrittiFinali) => {
                applicaStruttura();
                const tombstoneSet = new Set([...(appData.deletedIds || []), ...(nuovoDati.deletedIds || [])]);
                appData.deletedIds = Array.from(tombstoneSet);
                
                appData.manoscritti = manoscrittiFinali;
                
                // Aggiorna gli hash di base per i futuri 3-way merge.
                // ⚠️ La base è la versione REMOTA appena scaricata, non lo stato fuso: è l'unico
                // antenato comune certo. La base si salva qui, il caricamento avviene dopo; se il
                // caricamento fallisce (offline, errore di rete) con base = fuso alla sync successiva
                // risulterebbe locale == base e remoto ≠ base, e `fondiRecord` darebbe ragione al
                // remoto cancellando in silenzio le modifiche locali.
                appData.baseHashes = {};
                appData.baseObjects = {};
                // Copia PROFONDA: le schede fuse riusano gli oggetti remoti (allegati, pagine), e
                // l'editor scrive la trascrizione di una carta sul posto. Con una copia superficiale
                // la base cambiava insieme alla scheda e la sync dopo dava ragione al remoto.
                if (typeof window.getRecordHash === 'function') {
                    (nuovoDati.manoscritti || []).forEach(m => {
                        appData.baseHashes[m.id] = window.getRecordHash(m);
                        appData.baseObjects[m.id] = structuredClone(m);
                    });
                }
                
                window.ultimoCaricamento = Date.now();
                
                if (window.apiSettings) {
                    await window.apiSettings.patch({ lastSyncTime: window.ultimoCaricamento });
                }
                if (window.apiBrowser) {
                    // La base si scrive solo se il DB è stato scritto: una base nuova accanto
                    // a un DB vecchio farebbe passare per modifiche locali le differenze.
                    try {
                        await salvaTutto({ pendenti: false });
                        await window.apiBrowser.salvaDatiBase(appData.baseObjects || {});
                    } catch (err) {
                        console.error("Errore nel salvataggio dopo la sincronizzazione:", err);
                        if (typeof mostraMessaggio === 'function') {
                            mostraMessaggio(window.t("msg_errore_salvataggio", "Errore nel salvataggio dei dati: ") + (err.message || err), "error");
                        }
                    }
                }
                
                if (typeof normalizzaCartelle === 'function') normalizzaCartelle();
                if (typeof renderSidebar === 'function') renderSidebar();
                if (typeof renderMain === 'function') renderMain();
                
                const vTrasc = document.getElementById('view-trascrizione');
                const isTrascrizioneOpen = vTrasc && !vTrasc.classList.contains('hidden-tab');
                
                const idInTrascrizione = document.getElementById('trascrizione-id')?.value;
                if (isTrascrizioneOpen && idInTrascrizione && !window.trascrizioneNonSalvata) {
                    const checkEsiste = appData.manoscritti.some(x => String(x.id) === String(idInTrascrizione));
                    if (checkEsiste) {
                        if (typeof apriTrascrizione === 'function') apriTrascrizione(idInTrascrizione);
                    } else {
                        mostraMessaggio(window.t("msg_il_documento_corrente_sta", "Il documento corrente è stato eliminato da un altro utente."), "warning");
                        switchTab('list');
                    }
                }
                resolve(true);
            };

            const processDeletions = async () => {
                if (deletionsList.length > 0 && typeof window.apriDeletionConflictModal === 'function') {
                    if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(false);
                    window.apriDeletionConflictModal(deletionsList, (resolutions) => {
                        if (!resolutions) {
                            resolve(false);
                            return;
                        }
                        deletionsList.forEach(card => {
                            if (resolutions[card.id] === 'keep') {
                                card.lastModified = Date.now();
                                mergedManoscritti.push(card);
                                if (nuovoDati.deletedIds) nuovoDati.deletedIds = nuovoDati.deletedIds.filter(id => id !== card.id);
                            }
                        });
                        concludiMerge(mergedManoscritti);
                    });
                } else {
                    concludiMerge(mergedManoscritti);
                }
            };
            
            if (localDeletionsToPush.length > 0 && typeof window.mostraBottomConfirm === 'function') {
                if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(false);
                const count = localDeletionsToPush.length;
                const msg = count > 1 
                    ? window.t("confirm_delete_multiple_cloud", "Hai eliminato {var0} record dal tuo archivio. Sei sicuro di volerli cancellare definitivamente anche dal cloud condiviso?").replace("{var0}", String(count)) 
                    : window.t("confirm_delete_single_cloud", "Hai eliminato un record dal tuo archivio. Sei sicuro di volerlo cancellare definitivamente anche dal cloud condiviso?");
                
                window.mostraBottomConfirm(msg, () => {
                    // Conferma: cancella anche dal cloud
                    localDeletionsToPush.forEach(card => {
                        if (!nuovoDati.deletedIds) nuovoDati.deletedIds = [];
                        if (!nuovoDati.deletedIds.includes(card.id)) nuovoDati.deletedIds.push(card.id);
                    });
                    if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(true, 'sync_in_progress');
                    processDeletions();
                }, null, () => {
                    // Annulla: non cancellare dal cloud, e rimuovili dai tombstone locali così non ci chiede più (e li ripristiniamo)
                    localDeletionsToPush.forEach(card => {
                        mergedManoscritti.push(card);
                        tombstoneDaTogliere.add(card.id);
                    });
                    if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(true, 'sync_in_progress');
                    processDeletions();
                });
            } else {
                processDeletions();
            }

        };
        
        if (conflitti && conflitti.length > 0) {
            if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(false);
            if (typeof window.apriMergeConflictModal === 'function') {
                window.apriMergeConflictModal(conflitti, (resolvedCards) => {
                    if (resolvedCards) {
                        eseguiMergeFinale(resolvedCards);
                    } else {
                        resolve(false);
                    }
                });
            } else {
                eseguiMergeFinale();
            }
        } else {
            eseguiMergeFinale();
        }
    });
};
