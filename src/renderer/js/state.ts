// @ts-nocheck
// La forma del database vuoto la decide `shared/model.ts`, non questo file. Era un letterale
// qui, e un archivio NUOVO non passa dalle migrazioni: tutto ciò che una migrazione installa
// — i vocabolari controllati della v4, per dirne una — su un archivio nuovo non esisteva mai,
// e il bug si vedeva solo alla prima apertura di un vault appena creato (Fase 3.3).
let appData = window.Model ? window.Model.databaseVuoto()
    : { cartelle: [], manoscritti: [], tipiDocumento: [], trascrizioneEditorWidth: '50%', schemaVersion: 1 };
window.cartellaAttuale = '';

async function initData() {
    if (window.apiBrowser) {
        const datiSalvati = await window.apiBrowser.leggiDati();
        const datiBaseSalvati = await window.apiBrowser.leggiDatiBase();
        if (datiSalvati) {
            // Fase 3.0 — la catena di migrazioni ha preso il posto delle due migrazioni
            // implicite che stavano qui (lista piatta e tipo `manoscritto`). Lo snapshot di
            // base entra PRIMA di migrare: va migrato insieme ai record, o il merge a tre vie
            // confronterebbe una scheda migrata con la sua base non migrata e dichiarerebbe
            // modificato un archivio che nessuno ha toccato.
            if (datiBaseSalvati && !Array.isArray(datiSalvati) && typeof datiSalvati === 'object') {
                datiSalvati.baseObjects = datiBaseSalvati;
            }
            const esito = window.Model.migraDatabase(datiSalvati);
            appData = esito.db;
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
                await window.apiBrowser.salvaDati(JSON.stringify(appData));
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

    if (!appData.baseObjects) {
        appData.baseObjects = {};
        appData.manoscritti.forEach(m => {
            appData.baseObjects[m.id] = m;
        });
        if (window.apiBrowser) {
            await window.apiBrowser.salvaDatiBase(appData.baseObjects);
        }
    }
    
    appData.baseHashes = {};
    if (appData.baseObjects && typeof window.getRecordHash === 'function') {
        for (const [id, m] of Object.entries(appData.baseObjects)) {
            appData.baseHashes[id] = window.getRecordHash(m);
        }
    }
}

window.impostaModifichePendenti = function(stato) {
    window.modificheLocaliPendenti = stato;
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

async function eseguiSalvataggio() {
    // Rete di sicurezza per le mutazioni che non passano da Store.commit().
    if (typeof window.invalidaCacheRicerca === 'function') window.invalidaCacheRicerca();
    if (!window.apiBrowser) return;

    // Validazione lato renderer: il main riceve la stringa già serializzata e non la ri-parsa.
    // Il criterio è quello condiviso di `shared/model.ts` (Fase 3.0): due validazioni diverse
    // per lo stesso file darebbero due diagnosi diverse sullo stesso guasto.
    const motivo = window.Model.motivoNonValido(appData);
    if (motivo) throw new Error("Stato in memoria non valido: " + motivo + ". Salvataggio annullato.");

    // Serializzazione unica: evita structured-clone dell'intero DB via IPC + stringify nel main.
    const payload = JSON.stringify(appData);
    const res = await window.apiBrowser.salvaDati(payload);
    if (res && res.success === false) throw new Error(res.error || "Salvataggio fallito");

    // Segnala modifiche pendenti se siamo connessi al cloud
    if (window.driveStatus && window.driveStatus.isAuthenticated) {
        if (typeof window.impostaModifichePendenti === 'function') {
            window.impostaModifichePendenti(true);
        }
    }
}

function salvaTutto() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    saveDirty = false;
    const p = saveChain.then(eseguiSalvataggio, eseguiSalvataggio);
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
        salvaTutto().catch(err => {
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
            // 1. Fondi le cartelle (Unione)
            const mergedDeletedCartelle = new Set([...(appData.deletedCartelle || []), ...(nuovoDati.deletedCartelle || [])]);
            
            const cartelleSet = new Set([...(appData.cartelle || []), ...(nuovoDati.cartelle || [])]);
            for (let dc of mergedDeletedCartelle) {
                cartelleSet.delete(dc);
            }
            appData.cartelle = Array.from(cartelleSet).sort();
            appData.deletedCartelle = Array.from(mergedDeletedCartelle);
            
            // 1-bis. Fondi l'anagrafica dei tag (Fase 3.4). Non è un campo del record,
            // quindi non passa da `rilevaConflitti`: unione per chiave, e sul colore
            // vince chi l'ha cambiato per ultimo.
            const anagraficaFusa = window.Model.unisciAnagraficheTag(
                appData.tagsAnagrafica, nuovoDati.tagsAnagrafica
            );
            if (Object.keys(anagraficaFusa).length) appData.tagsAnagrafica = anagraficaFusa;

            // 1-ter. Vocabolari controllati (3.3) e anagrafica di persone e luoghi (3.5).
            // ⚠️ I vocabolari NON si fondono come i tag: l'unione è sui VALORI, non
            // last-write-wins sull'intero vocabolario — due colleghi che ne aggiungono uno
            // ciascuno nella stessa sessione perderebbero quello scritto per primo.
            const vocFusi = window.Model.unisciVocabolari(appData.vocabolari, nuovoDati.vocabolari);
            if (Object.keys(vocFusi).length) appData.vocabolari = vocFusi;
            const authFusa = window.Model.unisciAuthority(appData.authority, nuovoDati.authority);
            if (Object.keys(authFusa).length) appData.authority = authFusa;

            // 2. Fondi i tipiDocumento
            const tipiMap = new Map();
            (nuovoDati.tipiDocumento || []).forEach(t => tipiMap.set(t.id, t));
            (appData.tipiDocumento || []).forEach(t => {
                if (!tipiMap.has(t.id)) tipiMap.set(t.id, t);
            });
            appData.tipiDocumento = Array.from(tipiMap.values());
            
            // 3. Fondi i manoscritti (schede)
            const resolvedMap = new Map((resolvedCards || []).map(r => [r.id, r]));
            const localMap = new Map((appData.manoscritti || []).map(m => [m.id, m]));
            const externalMap = new Map((nuovoDati.manoscritti || []).map(m => [m.id, m]));
            
            const mergedManoscritti = [];
            const deletionsList = [];
            const localDeletionsToPush = [];
            
            const tuttiIds = new Set([...localMap.keys(), ...externalMap.keys()]);
            for (const id of tuttiIds) {
                if (resolvedMap.has(id)) {
                    mergedManoscritti.push(resolvedMap.get(id));
                    continue;
                }
                
                const local = localMap.get(id);
                const external = externalMap.get(id);
                
                if (local && external) {
                    const baseHashes = appData.baseHashes || {};
                    const baseHash = baseHashes[id];
                    const baseObj = (appData.baseObjects || {})[id];

                    // Fase 4.4 — quando c'è l'oggetto di base, la fusione è per CAMPO: due
                    // colleghi che modificano campi diversi della stessa scheda non
                    // producono più un conflitto, e nemmeno una versione che ne cancella
                    // l'altra. I conflitti veri sono già passati dal modale e stanno in
                    // `resolvedMap`, quindi qui `esito.conflitti` è vuoto salvo che
                    // l'utente abbia annullato: in quel caso vince il locale, che è ciò
                    // che `fondiRecord` lascia nei campi contesi.
                    if (baseObj && window.Model && typeof window.Model.fondiRecord === 'function') {
                        mergedManoscritti.push(window.Model.fondiRecord(baseObj, local, external).fuso);
                        continue;
                    }

                    if (!baseHash || typeof window.getRecordHash !== 'function') {
                        // Fallback timestamp: nessun baseHash (documento precedente alla migrazione hash)
                        const tLocal = local.lastModified || 0;
                        const tExternal = external.lastModified || 0;
                        
                        if (tLocal >= tExternal) {
                            mergedManoscritti.push(local);
                        } else {
                            mergedManoscritti.push(external);
                        }
                    } else {
                        // 3-Way Merge deterministico
                        const localHash = window.getRecordHash(local);
                        const externalHash = window.getRecordHash(external);
                        
                        if (localHash === externalHash) {
                            mergedManoscritti.push(external);
                        } else if (localHash === baseHash) {
                            mergedManoscritti.push(external); // Locale invariato
                        } else if (externalHash === baseHash) {
                            mergedManoscritti.push(local); // Cloud invariato
                        } else {
                            // Conflitto sfuggito, preserviamo locale
                            mergedManoscritti.push(local); 
                        }
                    }
                } else if (local) {
                    if (nuovoDati.deletedIds && nuovoDati.deletedIds.includes(id)) {
                        deletionsList.push(local);
                    } else {
                        mergedManoscritti.push(local);
                    }
                } else if (external) {
                    if (appData.deletedIds && appData.deletedIds.includes(id)) {
                        localDeletionsToPush.push(external);
                    } else {
                        mergedManoscritti.push(external);
                    }
                }
            }
            
            const concludiMerge = async (manoscrittiFinali) => {
                const tombstoneSet = new Set([...(appData.deletedIds || []), ...(nuovoDati.deletedIds || [])]);
                appData.deletedIds = Array.from(tombstoneSet);
                
                appData.manoscritti = manoscrittiFinali;
                
                // Aggiorna gli hash di base per i futuri 3-way merge
                appData.baseHashes = {};
                appData.baseObjects = {};
                if (typeof window.getRecordHash === 'function') {
                    (nuovoDati.manoscritti || []).forEach(m => {
                        appData.baseHashes[m.id] = window.getRecordHash(m);
                        appData.baseObjects[m.id] = { ...m };
                    });
                }
                
                window.ultimoCaricamento = Date.now();
                
                if (window.apiSettings) {
                    const settings = await window.apiSettings.get();
                    settings.lastSyncTime = window.ultimoCaricamento;
                    await window.apiSettings.save(settings);
                }
                if (window.apiBrowser) {
                    await window.apiBrowser.salvaDati(appData);
                    await window.apiBrowser.salvaDatiBase(appData.baseObjects || {});
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
                        if (appData.deletedIds) {
                            appData.deletedIds = appData.deletedIds.filter(x => x !== card.id);
                        }
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
