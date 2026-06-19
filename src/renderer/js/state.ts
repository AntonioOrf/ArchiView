// @ts-nocheck
let appData = {
    cartelle: ['Generale'], 
    manoscritti: [],
    tipiDocumento: [
        { id: 'imbreviature', nome: 'Imbreviature Notarili', campi: ['Marginalia', 'Notaio', 'dataCronica', 'dataTopica', 'attori_dinamici', 'tipo_di_atto', 'oggetto', 'elementi_economici'] },
        { id: 'atti', nome: 'Atti Giudiziari', campi: ['dataCronica', 'magistratura', 'attori_dinamici', 'tipo_di_atto_giur', 'motivazione_processo', 'condanne', 'note'] },
        { id: 'fiscali', nome: 'Documenti Fiscali', campi: ['dichiarante', 'beni_dinamici', 'debiti_dinamici', 'crediti_dinamici', 'famiglia_dinamici', 'note'] }
    ],
    trascrizioneEditorWidth: '50%'
};
window.cartellaAttuale = 'Generale';

async function initData() {
    if (window.apiBrowser) {
        const datiSalvati = await window.apiBrowser.leggiDati();
        if (datiSalvati) {
            // Migrazione: Se il file vecchio era solo un array (lista piatta), lo converte nel nuovo formato
            if (Array.isArray(datiSalvati)) {
                appData.manoscritti = datiSalvati.map(m => ({...m, cartella: 'Generale', tipoDocumento: 'manoscritto'}));
                await window.apiBrowser.salvaDati(appData); // Salva subito il nuovo formato
            } else {
                // Formato già corretto
                appData = datiSalvati; 
            }
        }
        const datiBaseSalvati = await window.apiBrowser.leggiDatiBase();
        if (datiBaseSalvati) {
            appData.baseObjects = datiBaseSalvati;
        }
    }
    // Assicuriamoci che esista sempre almeno una cartella
    if (!appData.cartelle || appData.cartelle.length === 0) {
        appData.cartelle = ['Generale'];
    }
    
    if (!appData.tipiDocumento) {
        appData.tipiDocumento = [];
    }
    
    if (!appData.manoscritti) {
        appData.manoscritti = [];
    }
    
    // Rimuovi 'manoscritto' e assicurati che i modelli base siano presenti
    appData.tipiDocumento = appData.tipiDocumento.filter(t => t.id !== 'manoscritto');
    
    const predefiniti = [
        { id: 'imbreviature', nome: 'Imbreviature Notarili', campi: ['Marginalia', 'Notaio', 'dataCronica', 'dataTopica', 'attori_dinamici', 'tipo_di_atto', 'oggetto', 'elementi_economici'] },
        { id: 'atti', nome: 'Atti Giudiziari', campi: ['dataCronica', 'magistratura', 'attori_dinamici', 'tipo_di_atto_giur', 'motivazione_processo', 'condanne', 'note'] },
        { id: 'fiscali', nome: 'Documenti Fiscali', campi: ['dichiarante', 'beni_dinamici', 'debiti_dinamici', 'crediti_dinamici', 'famiglia_dinamici', 'note'] }
    ];
    
    predefiniti.forEach(pref => {
        const index = appData.tipiDocumento.findIndex(t => t.id === pref.id);
        if (index === -1) {
            appData.tipiDocumento.unshift(pref); // Aggiunge all'inizio se mancante
        } else {
            // Forza l'aggiornamento dei campi per i modelli predefiniti (che non sono modificabili dall'utente)
            appData.tipiDocumento[index].campi = pref.campi;
        }
    });

    appData.manoscritti.forEach(m => {
        // Se un record vecchio usava 'manoscritto', lo passiamo a un modello compatibile o al primo
        if (!m.tipoDocumento || m.tipoDocumento === 'manoscritto') m.tipoDocumento = 'imbreviature';
        if (!m.cartella) m.cartella = 'Generale';
    });
    
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
    const ind = document.getElementById('pending-changes-indicator');
    if (ind) {
        if (stato) ind.classList.remove('hidden');
        else ind.classList.add('hidden');
        ind.classList.add('flex'); // Assicura che diventi flex se visibile
        if (!stato) ind.classList.remove('flex'); // Rimuove flex se nascosto
    }
};

// Gestore Annullamento (Undo)
window.gestoreAnnullamento = {
    stack: [],
    
    registraAzione(descrizione, ripristinaFn) {
        this.stack.push({
            descrizione,
            ripristinaFn
        });
        // Limitiamo la cronologia a 50 azioni per non consumare troppa memoria
        if (this.stack.length > 50) {
            this.stack.shift();
        }
    },
    
    async annullaUltimaAzione() {
        if (this.stack.length === 0) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_nessuna_azione_da_annulla", "Nessuna azione da annullare."), "info");
            return;
        }
        
        const azione = this.stack.pop();
        try {
            await azione.ripristinaFn();
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_annullato_var", "Annullato: {var0}").replace("{var0}", String(azione.descrizione)), "success");
        } catch (err) {
            console.error("Errore durante l'annullamento:", err);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_durante_l_annullam", "Errore durante l'annullamento dell'azione."), "error");
        }
    }
};

async function salvaTutto() {
    if (window.apiBrowser) {
        await window.apiBrowser.salvaDati(appData);
        
        // Segnala modifiche pendenti se siamo connessi al cloud
        if (window.driveStatus && window.driveStatus.isAuthenticated) {
            if (typeof window.impostaModifichePendenti === 'function') {
                window.impostaModifichePendenti(true);
            }
        }
        
    }
}
window.sincronizzaEUnisciDati = async function(nuovoDati) {
    if (!nuovoDati) return;
    
    return new Promise((resolve) => {
        const loadedAt = window.ultimoCaricamento || 0;
        let conflitti = [];
        if (typeof window.rilevaConflitti === 'function') {
            conflitti = window.rilevaConflitti(appData.manoscritti, nuovoDati.manoscritti, loadedAt, appData.baseHashes || {});
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
