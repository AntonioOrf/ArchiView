// @ts-nocheck

window.hubConfig = null;

// Carica la configurazione del repository all'avvio
async function inizializzaHubConfig() {
    if (window.apiBrowser && window.apiBrowser.loadHubConfig) {
        window.hubConfig = await window.apiBrowser.loadHubConfig();
        window.aggiornaStatoWidgetHub();
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

// Esegue la sincronizzazione completa (Pull -> Merge/Conflict -> Push)
window.sincronizzaConHub = async function() {
    if (!window.hubConfig) {
        mostraMessaggio("Questo archivio non è collegato ad un repository Hub.", "error");
        return;
    }

    mostraMessaggio("Connessione all'Hub in corso...", "info");
    
    try {
        const repoId = window.hubConfig.repoId;
        const key = window.hubConfig.repoKey;
        const url = window.hubConfig.hubUrl;
        const lastLoadedAt = window.hubConfig.lastLoadedAt || 0;

        // 1. PULL: Scarica il database aggiornato dal server
        const resPull = await fetch(`${url}/api/repos/${repoId}/pull`, {
            headers: {
                'Authorization': `Bearer ${key}`
            }
        });

        if (!resPull.ok) {
            if (resPull.status === 401) throw new Error("Chiave di accesso non valida per questo repository.");
            throw new Error("Impossibile scaricare i dati dal server.");
        }

        const dataPull = await resPull.json();
        const esterniDati = dataPull.database;
        const serverVersion = dataPull.version;

        // 2. RILEVAMENTO CONFLITTI (DIFF)
        // Rileva se ci sono schede modificate contemporaneamente
        const conflitti = window.rilevaConflitti(appData.manoscritti, esterniDati.manoscritti, lastLoadedAt);

        if (conflitti.length > 0) {
            mostraMessaggio(`Rilevati ${conflitti.length} conflitti di sincronizzazione. Risoluzione richiesta.`, "warning");
            
            // Apri la modale visuale per risolvere i conflitti
            window.apriMergeConflictModal(conflitti, async (resolvedCards) => {
                if (!resolvedCards) {
                    // Risoluzione annullata dall'utente
                    return;
                }
                
                // Procedi con il merge delle restanti schede non in conflitto
                await applicaMergeSincronizzazione(esterniDati, resolvedCards, serverVersion);
            });
        } else {
            // Nessun conflitto: esegui il merge automatico
            await applicaMergeSincronizzazione(esterniDati, null, serverVersion);
        }

    } catch (error) {
        console.error("Errore di sincronizzazione:", error);
        mostraMessaggio(error.message || "Errore durante la sincronizzazione con l'Hub.", "error");
    }
};

// Applica le modifiche fuse in locale e poi effettua il PUSH al server
async function applicaMergeSincronizzazione(esterniDati, resolvedCards, serverVersion) {
    try {
        const lastLoadedAt = window.hubConfig.lastLoadedAt || 0;
        
        // 1. Unisci cartelle
        const cartelleSet = new Set([...(appData.cartelle || []), ...(esterniDati.cartelle || [])]);
        appData.cartelle = Array.from(cartelleSet).sort();

        // 2. Unisci tipiDocumento
        const tipiMap = new Map();
        (esterniDati.tipiDocumento || []).forEach(t => tipiMap.set(t.id, t));
        (appData.tipiDocumento || []).forEach(t => {
            if (!tipiMap.has(t.id)) tipiMap.set(t.id, t);
        });
        appData.tipiDocumento = Array.from(tipiMap.values());

        // 3. Unisci manoscritti (schede)
        const localMap = new Map((appData.manoscritti || []).map(m => [m.id, m]));
        const externalMap = new Map((esterniDati.manoscritti || []).map(m => [m.id, m]));
        
        const mergedManoscritti = [];
        const tuttiIds = new Set([...localMap.keys(), ...externalMap.keys()]);

        for (const id of tuttiIds) {
            // Se la scheda faceva parte dei conflitti ed è stata risolta visualmente, usiamo quella risolta
            if (resolvedCards) {
                const resolved = resolvedCards.find(x => x.id === id);
                if (resolved) {
                    mergedManoscritti.push(resolved);
                    continue;
                }
            }

            const local = localMap.get(id);
            const external = externalMap.get(id);

            if (local && external) {
                const tLocal = local.lastModified || 0;
                const tExternal = external.lastModified || 0;
                
                // Prendi il più recente (non c'è conflitto perché non sono stati modificati entrambi dopo lastLoadedAt)
                if (tLocal >= tExternal) {
                    mergedManoscritti.push(local);
                } else {
                    mergedManoscritti.push(external);
                }
            } else if (local) {
                const tLocal = local.lastModified || 0;
                if (tLocal > lastLoadedAt) {
                    // Creato/modificato da noi locali dopo l'ultimo sync: lo teniamo
                    mergedManoscritti.push(local);
                }
                // Altrimenti, significa che l'altro utente lo ha eliminato, quindi non lo aggiungiamo
            } else if (external) {
                const tExternal = external.lastModified || 0;
                if (tExternal > lastLoadedAt || lastLoadedAt === 0) {
                    // Creato/modificato all'esterno dopo l'ultimo sync: lo aggiungiamo
                    mergedManoscritti.push(external);
                }
                // Altrimenti, significa che noi lo abbiamo eliminato localmente, quindi non lo aggiungiamo
            }
        }

        appData.manoscritti = mergedManoscritti;

        // Salva localmente il database fuso
        await salvaTutto();

        // 4. PUSH: Invia il database fuso al server dell'Hub
        mostraMessaggio("Invio modifiche al server...", "info");
        
        const repoId = window.hubConfig.repoId;
        const key = window.hubConfig.repoKey;
        const url = window.hubConfig.hubUrl;

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
                // Conflitto fast-forward: qualcun altro ha fatto push in questo esatto momento!
                mostraMessaggio("Conflitto di invio: qualcun altro ha appena aggiornato il database. Riprovo la sincronizzazione...", "warning");
                // Rilancia la sincronizzazione da capo
                setTimeout(window.sincronizzaConHub, 1000);
                return;
            }
            throw new Error("Errore durante l'invio delle modifiche al server.");
        }

        const dataPush = await resPush.json();
        
        // 5. Aggiorna configurazione Hub locale con la nuova versione
        window.hubConfig.version = dataPush.version;
        window.hubConfig.lastLoadedAt = Date.now();
        await window.apiBrowser.saveHubConfig(window.hubConfig);

        // Aggiorna l'interfaccia
        if (typeof normalizzaCartelle === 'function') normalizzaCartelle();
        if (typeof renderSidebar === 'function') renderSidebar();
        if (typeof renderMain === 'function') renderMain();
        aggiornaStatoWidgetHub();

        mostraMessaggio("Sincronizzazione completata! Database locale e remoto aggiornati.", "success");

    } catch (e) {
        console.error("Errore salvataggio sync:", e);
        mostraMessaggio(e.message || "Errore durante il salvataggio dei dati sincronizzati.", "error");
    }
}

// Chiamata per la clonazione di un repository
window.clonaRepositoryHub = async function(url, repoId, key) {
    mostraMessaggio("Connessione al repository...", "info");
    
    try {
        const res = await fetch(`${url}/api/repos/${repoId}/pull`, {
            headers: {
                'Authorization': `Bearer ${key}`
            }
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
