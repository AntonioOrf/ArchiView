let appData = window.Model ? window.Model.databaseVuoto()
    : { cartelle: [], manoscritti: [], tipiDocumento: [], trascrizioneEditorWidth: '50%', schemaVersion: 1 };
Object.defineProperty(window, 'appData', {
    get: () => appData,
    set: (v) => { appData = v; },
    configurable: true
});
window.cartellaAttuale = '';

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
            let grezzo = datiSalvati;
            if (datiBaseSalvati && Array.isArray(grezzo)) {
                grezzo = { cartelle: [], manoscritti: grezzo, tipiDocumento: [] };
            }
            if (datiBaseSalvati && grezzo && typeof grezzo === 'object' && !Array.isArray(grezzo)) {
                grezzo.baseObjects = datiBaseSalvati;
            }
            const esito = window.Model.migraDatabase(grezzo);
            appData = esito.db;
            if (!datiBaseSalvati && appData.baseObjects && Object.keys(appData.baseObjects).length) {
                try {
                    await window.apiBrowser.salvaDatiBase(appData.baseObjects);
                } catch (err) {
                    console.error('[Dati] Spostamento della base del merge non riuscito:', err);
                }
            }
            if (esito.futuro) {
                console.warn('[Schema] Il database dichiara la versione', appData.schemaVersion,
                    '> di quella supportata (' + window.Model.SCHEMA_VERSION + '): aperto senza migrazioni.');
                window.schemaDalFuturo = true;
            } else if (esito.applicate.length) {
                console.info('[Schema] Migrazioni applicate:', esito.applicate.join(' | '));
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
    if (!appData.cartelle) {
        appData.cartelle = [];
    }

    if (!appData.tipiDocumento) {
        appData.tipiDocumento = [];
    }
    
    if (!appData.manoscritti) {
        appData.manoscritti = [];
    }
    
    if (!window.schemaDalFuturo) window.Model.applicaModelliPredefiniti(appData);

    if (!appData.trascrizioneEditorWidth) appData.trascrizioneEditorWidth = '50%';
    
    if (window.apiSettings) {
        const settings = await window.apiSettings.get();
        window.ultimoCaricamento = settings.lastSyncTime || 0;
    } else {
        window.ultimoCaricamento = 0;
    }

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

window.gestoreAnnullamento = {
    stack: [],
    stackRipetizione: [],

    registraAzione(descrizione, ripristinaFn, rifaiFn) {
        this.stack.push({ descrizione, ripristinaFn, rifaiFn });
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

const SAVE_DEBOUNCE_MS = 400;
let saveTimer = null;
let saveDirty = false;
let saveChain = Promise.resolve();

window.databasePerDisco = function(db) {
    const { baseObjects, baseHashes, ...resto } = db;
    return resto;
};

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
        console.error("Errore nel salvataggio della base dopo l'invio:", err);
    }
};

async function eseguiSalvataggio(pendenti = true, dopoCommit = false) {
    if (!dopoCommit && typeof window.invalidaCacheRicerca === 'function') window.invalidaCacheRicerca();
    if (!window.apiBrowser) return;

    const motivo = window.Model.motivoNonValido(appData);
    if (motivo) throw new Error("Stato in memoria non valido: " + motivo + ". Salvataggio annullato.");

    const payload = JSON.stringify(window.databasePerDisco(appData));
    const res = await window.apiBrowser.salvaDati(payload);
    if (res && res.success === false) throw new Error(res.error || "Salvataggio fallito");

    if (pendenti && window.driveStatus && window.driveStatus.isAuthenticated) {
        if (typeof window.impostaModifichePendenti === 'function') {
            window.impostaModifichePendenti(true);
        }
    }
}

function salvaTutto({ pendenti = true, dopoCommit = false } = {}) {
    const segnala = pendenti || saveDirty || !!saveTimer;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    saveDirty = false;
    const esegui = () => eseguiSalvataggio(segnala, dopoCommit);
    const p = saveChain.then(esegui, esegui);
    saveChain = p.catch(() => {});
    return p;
}
window.salvaTutto = salvaTutto;

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

window.flushSalvataggio = function() {
    if (saveTimer || saveDirty) return salvaTutto();
    return saveChain;
};
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

    const tombstone = new Set((appData.deletedIds || []).map(String));
    for (const id of attualiPerId.keys()) if (!ripristinatiPerId.has(id)) tombstone.add(id);
    for (const id of ripristinatiPerId.keys()) tombstone.delete(id);

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

    if (window.Model) nuovoDati = window.Model.migraDatabase(nuovoDati).db;

    return new Promise((resolve) => {
        const loadedAt = window.ultimoCaricamento || 0;
        let conflitti = [];
        if (typeof window.rilevaConflitti === 'function') {
            conflitti = window.rilevaConflitti(appData.manoscritti, nuovoDati.manoscritti, loadedAt,
                appData.baseHashes || {}, appData.baseObjects || {});
        }
        
        const eseguiMergeFinale = async (resolvedCards = []) => {
            const esito = window.Model.fondiDatabase(appData, nuovoDati, resolvedCards);
            for (const m of esito.daRicomporre) window.ricomponiTrascrizioneFusa(m);

            const mergedManoscritti = esito.schede;
            const deletionsList = esito.eliminateDalRemoto;
            const localDeletionsToPush = esito.eliminateInLocale;
            const tombstoneDaTogliere = new Set();

            const applicaStruttura = () => {
                appData.cartelle = esito.cartelle;
                appData.deletedCartelle = esito.deletedCartelle;
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
                
                appData.baseHashes = {};
                appData.baseObjects = {};
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
                    localDeletionsToPush.forEach(card => {
                        if (!nuovoDati.deletedIds) nuovoDati.deletedIds = [];
                        if (!nuovoDati.deletedIds.includes(card.id)) nuovoDati.deletedIds.push(card.id);
                    });
                    if (typeof window.toggleSyncProgress === 'function') window.toggleSyncProgress(true, 'sync_in_progress');
                    processDeletions();
                }, null, () => {
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
