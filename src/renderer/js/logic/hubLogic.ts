// @ts-nocheck

window.hubConfig = null;
window.hubAutofetchTimer = null;

// Carica la configurazione del repository all'avvio
async function inizializzaHubConfig() {
    if (window.apiBrowser && window.apiBrowser.loadHubConfig) {
        window.hubConfig = await window.apiBrowser.loadHubConfig();
        window.aggiornaStatoWidgetHub();
        window.avviaAutofetchHub();
    }
}
document.addEventListener('DOMContentLoaded', inizializzaHubConfig);

window.aggiornaStatoWidgetHub = function() {
    const widget = document.getElementById('hub-sync-widget');
    const repoNameSpan = document.getElementById('hub-repo-name');
    if (widget && repoNameSpan) {
        if (window.hubConfig) {
            repoNameSpan.textContent = window.hubConfig.repoId.substring(5); // taglia "repo_"
            widget.classList.remove('hidden');
            widget.classList.add('flex');
            if (window.lucide) lucide.createIcons({ nodes: [widget] });
        } else {
            widget.classList.add('hidden');
            widget.classList.remove('flex');
        }
    }
};

window.avviaAutofetchHub = async function() {
    if (window.hubAutofetchTimer) {
        clearInterval(window.hubAutofetchTimer);
        window.hubAutofetchTimer = null;
    }
    
    if (!window.hubConfig || !window.apiSettings) return;
    
    const settings = await window.apiSettings.get();
    const enabled = settings.autofetchEnabled !== false; // Default true
    const intervalMinutes = settings.autofetchInterval || 5;
    
    if (enabled) {
        window.hubAutofetchTimer = setInterval(() => {
            window.riceviModificheHub(true);
        }, intervalMinutes * 60 * 1000);
    }
};

window.riceviModificheHub = async function(isSilent = false) {
    if (!window.hubConfig) {
        if (!isSilent) mostraMessaggio("Questo archivio non è collegato ad un repository Hub.", "error");
        return;
    }

    if (!isSilent) mostraMessaggio("Ricezione modifiche dall'Hub in corso...", "info");
    
    try {
        const repoId = window.hubConfig.repoId;
        const key = window.hubConfig.repoKey;
        const url = window.hubConfig.hubUrl;
        const lastLoadedAt = window.hubConfig.lastLoadedAt || 0;

        const resPull = await fetch(`${url}/api/repos/${repoId}/pull`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if (!resPull.ok) {
            if (resPull.status === 401) throw new Error("Chiave di accesso non valida per questo repository.");
            // If silent, just ignore network errors (might be offline)
            if (isSilent) return;
            throw new Error("Impossibile scaricare i dati dal server.");
        }

        const dataPull = await resPull.json();
        const esterniDati = dataPull.database;
        const serverVersion = dataPull.version;

        if (serverVersion === window.hubConfig.version) {
            if (!isSilent) mostraMessaggio("Nessuna nuova modifica sul server. Sei aggiornato.", "success");
            return;
        }

        // RILEVAMENTO CONFLITTI E CANCELLAZIONI
        const conflitti = window.rilevaConflitti(appData.manoscritti, esterniDati.manoscritti, lastLoadedAt);
        const { mergedManoscritti, deletions } = rilevaCancellazioniEMergeParziale(esterniDati, lastLoadedAt);

        const applyMergeAndSave = async (finalCards) => {
            appData.manoscritti = finalCards;
            
            // Unisci cartelle
            const cartelleSet = new Set([...(appData.cartelle || []), ...(esterniDati.cartelle || [])]);
            appData.cartelle = Array.from(cartelleSet).sort();

            // Unisci tipiDocumento
            const tipiMap = new Map();
            (esterniDati.tipiDocumento || []).forEach(t => tipiMap.set(t.id, t));
            (appData.tipiDocumento || []).forEach(t => {
                if (!tipiMap.has(t.id)) tipiMap.set(t.id, t);
            });
            appData.tipiDocumento = Array.from(tipiMap.values());

            await salvaTutto();

            window.hubConfig.version = serverVersion;
            window.hubConfig.lastLoadedAt = Date.now();
            await window.apiBrowser.saveHubConfig(window.hubConfig);

            if (typeof normalizzaCartelle === 'function') normalizzaCartelle();
            if (typeof renderSidebar === 'function') renderSidebar();
            if (typeof renderMain === 'function') renderMain();

            if (!isSilent) mostraMessaggio("Dati scaricati e fusi con successo in locale.", "success");
        };

        if (conflitti.length > 0) {
            if (isSilent) {
                mostraMessaggio("Attenzione: rilevati conflitti di sincronizzazione dal server. Clicca 'Ricevi' per risolverli.", "warning");
                return;
            }
            window.apriMergeConflictModal(conflitti, (resolvedConflicts) => {
                if (!resolvedConflicts) return; // Annullato
                
                // Aggiorna mergedManoscritti con i conflitti risolti
                resolvedConflicts.forEach(rc => {
                    const idx = mergedManoscritti.findIndex(m => m.id === rc.id);
                    if (idx !== -1) mergedManoscritti[idx] = rc;
                    else mergedManoscritti.push(rc);
                });

                // Dopo i conflitti, controlliamo le cancellazioni
                if (deletions.length > 0) {
                    window.apriDeletionConflictModal(deletions, (deletionResolutions) => {
                        if (!deletionResolutions) return; // Annullato
                        applicaRisoluzioneCancellazioni(mergedManoscritti, deletions, deletionResolutions);
                        applyMergeAndSave(mergedManoscritti);
                    });
                } else {
                    applyMergeAndSave(mergedManoscritti);
                }
            });
        } else if (deletions.length > 0) {
            if (isSilent) {
                mostraMessaggio("Attenzione: alcuni file sono stati eliminati sul server. Clicca 'Ricevi' per verificare.", "warning");
                return;
            }
            window.apriDeletionConflictModal(deletions, (deletionResolutions) => {
                if (!deletionResolutions) return; // Annullato
                applicaRisoluzioneCancellazioni(mergedManoscritti, deletions, deletionResolutions);
                applyMergeAndSave(mergedManoscritti);
            });
        } else {
            // Nessun conflitto, nessuna cancellazione dubbia, merge liscio
            if (!isSilent || serverVersion !== window.hubConfig.version) {
                await applyMergeAndSave(mergedManoscritti);
                if (isSilent) mostraMessaggio("Dati sincronizzati automaticamente dal server.", "info");
            }
        }

    } catch (error) {
        if (!isSilent) {
            console.error("Errore di ricezione:", error);
            mostraMessaggio(error.message || "Errore durante la ricezione dall'Hub.", "error");
        }
    }
};

function rilevaCancellazioniEMergeParziale(esterniDati, lastLoadedAt) {
    const localMap = new Map((appData.manoscritti || []).map(m => [m.id, m]));
    const externalMap = new Map((esterniDati.manoscritti || []).map(m => [m.id, m]));
    
    const mergedManoscritti = [];
    const deletions = [];
    const tuttiIds = new Set([...localMap.keys(), ...externalMap.keys()]);

    for (const id of tuttiIds) {
        const local = localMap.get(id);
        const external = externalMap.get(id);

        if (local && external) {
            const tLocal = local.lastModified || 0;
            const tExternal = external.lastModified || 0;
            if (tLocal >= tExternal) mergedManoscritti.push(local);
            else mergedManoscritti.push(external);
        } else if (local) {
            const tLocal = local.lastModified || 0;
            if (tLocal > lastLoadedAt) {
                // Modificato localmente dopo l'ultimo sync, lo teniamo
                mergedManoscritti.push(local);
            } else {
                // Cancellato sul server
                deletions.push(local);
            }
        } else if (external) {
            const tExternal = external.lastModified || 0;
            if (tExternal > lastLoadedAt || lastLoadedAt === 0) {
                // Creato/modificato all'esterno
                mergedManoscritti.push(external);
            }
        }
    }
    
    return { mergedManoscritti, deletions };
}

function applicaRisoluzioneCancellazioni(merged, deletions, resolutions) {
    deletions.forEach(card => {
        if (resolutions[card.id] === 'keep') {
            card.lastModified = Date.now(); // Marca come modificato per poterlo inviare
            merged.push(card);
        }
        // Se 'delete', non lo inseriamo nell'array merged, quindi viene effettivamente cancellato
    });
}

window.inviaModificheHub = async function() {
    if (!window.hubConfig) {
        mostraMessaggio("Questo archivio non è collegato ad un repository Hub.", "error");
        return;
    }

    mostraMessaggio("Invio modifiche al server...", "info");
    
    try {
        const repoId = window.hubConfig.repoId;
        const key = window.hubConfig.repoKey;
        const url = window.hubConfig.hubUrl;
        const serverVersion = window.hubConfig.version;

        const resPush = await fetch(`${url}/api/repos/${repoId}/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                parentVersion: serverVersion,
                database: appData
            })
        });

        if (!resPush.ok) {
            if (resPush.status === 409) {
                mostraMessaggio("Il server contiene modifiche più recenti. Usa 'Ricevi' per aggiornare il tuo archivio prima di inviare.", "warning");
                return;
            }
            throw new Error("Errore durante l'invio delle modifiche al server.");
        }

        const dataPush = await resPush.json();
        
        window.hubConfig.version = dataPush.version;
        window.hubConfig.lastLoadedAt = Date.now();
        await window.apiBrowser.saveHubConfig(window.hubConfig);

        mostraMessaggio("Modifiche inviate con successo!", "success");

    } catch (e) {
        console.error("Errore invio sync:", e);
        mostraMessaggio(e.message || "Errore durante l'invio all'Hub.", "error");
    }
};

window.sincronizzaConHub = async function() {
    // Deprecata: per compatibilità, esegue prima pull e poi push (se non ci sono conflitti bloccanti)
    mostraMessaggio("Sincronizzazione...", "info");
    await window.riceviModificheHub(true);
    await window.inviaModificheHub();
};

window.clonaRepositoryHub = async function(url, repoId, key) {
    mostraMessaggio("Connessione al repository...", "info");
    
    try {
        const res = await fetch(`${url}/api/repos/${repoId}/pull`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if (!res.ok) {
            if (res.status === 401) throw new Error("Chiave di accesso errata.");
            throw new Error("Impossibile connettersi al repository remoto.");
        }

        const data = await res.json();
        
        if (window.apiBrowser && window.apiBrowser.selectBaseDirectory && window.apiBrowser.cloneWorkspaceHub) {
            mostraMessaggio("Seleziona la cartella in cui scaricare l'archivio.", "info");
            const basePath = await window.apiBrowser.selectBaseDirectory();
            if (basePath) {
                const hubConfigObj = {
                    hubUrl: url,
                    repoId: repoId,
                    repoKey: key,
                    version: data.version,
                    lastLoadedAt: Date.now()
                };
                
                const folderName = `Vault_${repoId}`;
                const success = await window.apiBrowser.cloneWorkspaceHub(basePath, folderName, hubConfigObj, data.database);
                if (success) {
                    mostraMessaggio("Archivio clonato con successo! Riavvio in corso...", "success");
                } else {
                    throw new Error("Errore durante la creazione dei file locali.");
                }
            }
        }
    } catch (e) {
        mostraMessaggio(e.message, "error");
        return false;
    }
};
