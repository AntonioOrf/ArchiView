// @ts-nocheck

window.hubConfig = null;
window.hubAutofetchTimer = null;

// Ultima versione remota già notificata dall'autofetch silenzioso: evita di ripetere il
// toast "Ci sono aggiornamenti" a ogni tick finché l'utente non riceve o cambia versione.
let _ultimaVersioneAutofetchNotificata = null;

// Nome cartella workspace sicuro per il filesystem a partire dal nome vault condiviso.
function sanitizeVaultFolderName(name) {
    let sanitized = (name || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 80);
    if (/^\.+$/.test(sanitized)) return '';
    return sanitized;
}

// Nome di default per un vault = basename della cartella workspace (ciò che l'utente ha scelto
// creandola), non il fantasma appData.nomeArchivio che ripiega sempre su "ArchiView".
window.nomeVaultDefault = async function() {
    try {
        const p = window.apiBrowser?.getWorkspacePath ? await window.apiBrowser.getWorkspacePath() : '';
        const base = (p || '').split(/[\/\\]/).filter(Boolean).pop();
        return (base && base.trim()) || (window.appData && window.appData.nomeArchivio) || 'Hub';
    } catch {
        return (window.appData && window.appData.nomeArchivio) || 'Hub';
    }
};

// Carica la configurazione del repository all'avvio
async function inizializzaHubConfig() {
    if (window.apiBrowser && window.apiBrowser.loadHubConfig) {
        window.hubConfig = await window.apiBrowser.loadHubConfig();
        window.avviaAutofetchHub();
        if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
        // Un membro che entra da invito riceve il DB già alla versione corrente: senza questo
        // hook la sync allegati (agganciata solo ai pull "con novità") non partirebbe mai.
        if (window.hubConfig) window.sincronizzaAllegatiHub(true);
    }
}
document.addEventListener('DOMContentLoaded', inizializzaHubConfig);

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
        // Autofetch = solo controllo/notifica (come Drive), non scarica: accende l'indicatore
        // "modifiche in entrata" e lascia il pull all'utente. Evita merge silenziosi.
        window.hubAutofetchTimer = setInterval(() => {
            window.controllaModificheHub(false);
        }, intervalMinutes * 60 * 1000);
    }
};

// Azzera badge/contatore "modifiche in entrata" (usato dopo un pull riuscito o quando risulta
// non esserci nulla da scaricare, per non lasciare l'indicatore acceso fino al fetch successivo).
window.pulisciModificheInEntrataHub = function() {
    window.impostaModificheInEntrata(false);
    window.incomingChanges = [];
    window.incomingStructuralChanges = [];
    window.incomingAuthor = null;
    _ultimaVersioneAutofetchNotificata = null;
    if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
};

window.riceviModificheHub = async function(isSilent = false) {
    if (!window.hubConfig) {
        if (!isSilent) mostraMessaggio(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."), "error");
        return;
    }

    // if (!isSilent) mostraMessaggio(window.t("msg_ricezione_modifiche_dall_", "Ricezione modifiche dall'Hub in corso..."), "info");
    
    try {
        const repoId = window.hubConfig.repoId;
        const key = window.hubConfig.repoKey;
        const url = window.hubConfig.hubUrl;
        const lastLoadedAt = window.hubConfig.lastLoadedAt || 0;
        const localVersion = window.hubConfig.version;

        // Fast-path autofetch: `?ifVersionNot=N` costa 1 sola lettura D1 se nulla è cambiato.
        const qs = (isSilent && typeof localVersion === 'number') ? `?ifVersionNot=${localVersion}` : '';
        const resPull = await fetch(`${url}/api/repos/${repoId}/pull${qs}`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if (!resPull.ok) {
            if (resPull.status === 401 || resPull.status === 403) {
                // 403 = membro revocato dall'owner: messaggio dedicato, niente retry.
                if (isSilent) return;
                throw new Error(resPull.status === 403
                    ? "Il tuo accesso a questo repository è stato revocato dall'amministratore."
                    : "Chiave di accesso non valida per questo repository.");
            }
            // If silent, just ignore network errors (might be offline)
            if (isSilent) return;
            throw new Error("Impossibile scaricare i dati dal server.");
        }

        const dataPull = await resPull.json();
        if (dataPull.unchanged === true) {
            window.pulisciModificheInEntrataHub();
            // DB invariato ma gli allegati possono essere ancora arretrati (join, race con l'upload
            // dell'owner, link non ancora pubblicati): riallinea al click manuale o se resta lavoro in sospeso.
            if (!isSilent || _hubAttachmentsPending) window.sincronizzaAllegatiHub(isSilent);
            return;
        } // fast-path: già allineati

        const esterniDati = dataPull.database;
        const serverVersion = dataPull.version;

        if (serverVersion === window.hubConfig.version) {
            window.pulisciModificheInEntrataHub();
            if (!isSilent || _hubAttachmentsPending) window.sincronizzaAllegatiHub(isSilent);
            if (!isSilent) mostraMessaggio(window.t("msg_nessuna_nuova_modifica_su", "Nessuna nuova modifica sul server. Sei aggiornato."), "success");
            return;
        }

        // RILEVAMENTO CONFLITTI E CANCELLAZIONI
        const conflitti = window.rilevaConflitti(appData.manoscritti, esterniDati.manoscritti, lastLoadedAt, appData.baseHashes || {});
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
            window.pulisciModificheInEntrataHub();

            window.sincronizzaAllegatiHub(isSilent); // fire-and-forget: scarica gli allegati nuovi via link

            if (typeof normalizzaCartelle === 'function') normalizzaCartelle();
            if (typeof renderSidebar === 'function') renderSidebar();
            if (typeof renderMain === 'function') renderMain();

            if (!isSilent) mostraMessaggio(window.t("msg_dati_scaricati_e_fusi_con", "Dati scaricati e fusi con successo in locale."), "success");
        };

        if (conflitti.length > 0) {
            if (isSilent) {
                mostraMessaggio(window.t("msg_attenzione_rilevati_confl", "Attenzione: rilevati conflitti di sincronizzazione dal server. Clicca 'Ricevi' per risolverli."), "warning");
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
                mostraMessaggio(window.t("msg_attenzione_alcuni_file_so", "Attenzione: alcuni file sono stati eliminati sul server. Clicca 'Ricevi' per verificare."), "warning");
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
                if (isSilent) mostraMessaggio(window.t("msg_dati_sincronizzati_automa", "Dati sincronizzati automaticamente dal server."), "info");
            }
        }

    } catch (error) {
        if (!isSilent) {
            console.error("Errore di ricezione:", error);
            mostraMessaggio(error.message || "Errore durante la ricezione dall'Hub.", "error");
        }
    }
};

// Controllo SOLO-NOTIFICA per l'Hub (equivalente al "fetch" Drive): interroga il server e,
// se la versione remota è più recente, accende l'indicatore + popola i badge di anteprima,
// SENZA toccare appData. Lo scaricamento effettivo (merge/salvataggio) resta a scaricaDalCloud
// → riceviModificheHub ("pull"). Usato dal pulsante Fetch e dall'autofetch.
window.controllaModificheHub = async function(manual = false) {
    if (!window.hubConfig) return;
    try {
        const { repoId, repoKey: key, hubUrl: url } = window.hubConfig;
        const localVersion = window.hubConfig.version;
        const loadedAt = window.hubConfig.lastLoadedAt || 0;

        // Fast-path: se nulla è cambiato costa 1 sola lettura D1.
        const qs = (typeof localVersion === 'number') ? `?ifVersionNot=${localVersion}` : '';
        const res = await fetch(`${url}/api/repos/${repoId}/pull${qs}`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if (!res.ok) {
            if (manual) mostraMessaggio(res.status === 403
                ? "Il tuo accesso a questo repository è stato revocato dall'amministratore."
                : (res.status === 401 ? "Chiave di accesso non valida per questo repository."
                : "Impossibile contattare il server."), "error");
            return;
        }

        const data = await res.json();
        const noChanges = data.unchanged === true || data.version === localVersion;

        if (noChanges) {
            window.pulisciModificheInEntrataHub();
            if (manual) mostraMessaggio(window.t("msg_nessun_nuovo_aggiornament", "Nessun nuovo aggiornamento trovato."), "success");
            return;
        }

        // Anteprima senza applicare: badge di record/cartelle/tipi nuovi rispetto all'ultimo pull.
        const remote = data.database || {};
        window.incomingChanges = (remote.manoscritti || []).filter(m => (m.lastModified || 0) > loadedAt);
        window.incomingAuthor = window.t("hub_generic_author", "Collaboratore");

        const structural = [];
        const localCartelle = appData.cartelle || [];
        const newFolders = (remote.cartelle || []).filter(c => !localCartelle.includes(c));
        if (newFolders.length > 0) {
            structural.push({ icon: 'folder-plus', label: `+ ${newFolders.length} Cartell${newFolders.length > 1 ? 'e' : 'a'}` });
        }
        const localTipiMap = new Map((appData.tipiDocumento || []).map(t => [t.id, JSON.stringify(t)]));
        const totTipi = (remote.tipiDocumento || []).filter(rt => localTipiMap.get(rt.id) !== JSON.stringify(rt)).length;
        if (totTipi > 0) {
            structural.push({ icon: 'file-type-2', label: `${totTipi} Modell${totTipi > 1 ? 'i' : 'o'}` });
        }
        window.incomingStructuralChanges = structural;

        window.impostaModificheInEntrata(true);
        if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
        if (manual) {
            mostraMessaggio(window.t("msg_ci_sono_nuovi_aggiornamen", "Ci sono nuovi aggiornamenti da scaricare!"), "success");
        } else if (data.version !== _ultimaVersioneAutofetchNotificata) {
            // Autofetch silenzioso: notifica una sola volta per versione remota, con
            // un'azione diretta ("Ricevi adesso") invece di lasciare solo l'indicatore acceso.
            _ultimaVersioneAutofetchNotificata = data.version;
            mostraMessaggio(
                window.t("msg_ci_sono_nuovi_aggiornamen", "Ci sono nuovi aggiornamenti da scaricare!"), "info", null,
                { label: window.t("hub_widget_receive", "Ricevi"), onClick: () => window.riceviModificheHub() }
            );
        }
    } catch (e) {
        if (manual) { console.error("Errore controllo Hub:", e); mostraMessaggio(window.t("msg_errore_durante_il_fetch", "Errore durante il fetch: ") + (e.message || ''), "error"); }
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
        mostraMessaggio(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."), "error");
        return;
    }

    mostraMessaggio(window.t("msg_invio_modifiche_al_server", "Invio modifiche al server..."), "info");
    
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
                mostraMessaggio(
                    window.t("msg_il_server_contiene_modifi_action", "Un collega ha appena salvato delle modifiche. Ricevile e poi riprova a inviare."),
                    "warning", null,
                    { label: window.t("share_conflict_action_label", "Ricevi ora"), onClick: () => window.riceviModificheHub() }
                );
                return;
            }
            throw new Error("Errore durante l'invio delle modifiche al server.");
        }

        const dataPush = await resPush.json();
        
        window.hubConfig.version = dataPush.version;
        window.hubConfig.lastLoadedAt = Date.now();
        await window.apiBrowser.saveHubConfig(window.hubConfig);

        window.sincronizzaAllegatiHub(false); // carica i chunk mancanti sul proprio Drive + pubblica indice

        mostraMessaggio(window.t("msg_modifiche_inviate_con_suc", "Modifiche inviate con successo!"), "success");

    } catch (e) {
        console.error("Errore invio sync:", e);
        mostraMessaggio(e.message || "Errore durante l'invio all'Hub.", "error");
    }
};

// --- Cronologia versioni Hub (equivalente delle revisioni Drive) ---------------------------

// Elenco versioni conservate sul server (metadata-only: autore, data, dimensione).
window.elencaVersioniHub = async function() {
    if (!window.hubConfig) throw new Error(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."));
    const { repoId, repoKey: key, hubUrl: url } = window.hubConfig;
    const res = await fetch(`${url}/api/repos/${repoId}/versions`, {
        headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const e = new Error(body.error || "Impossibile recuperare la cronologia dal server.");
        e.status = res.status;
        throw e;
    }
    return await res.json(); // { currentVersion, versions }
};

// Snapshot completo di una versione specifica (per diff o ripristino).
window.caricaVersioneHub = async function(versionNumber) {
    if (!window.hubConfig) throw new Error(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."));
    const { repoId, repoKey: key, hubUrl: url } = window.hubConfig;
    const res = await fetch(`${url}/api/repos/${repoId}/versions/${versionNumber}`, {
        headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const e = new Error(body.error || "Impossibile recuperare questa versione dal server.");
        e.status = res.status;
        throw e;
    }
    return await res.json(); // { version, database }
};

// Ripristino "git-revert": carica lo snapshot scelto, lo sostituisce in locale, poi lo invia
// come nuova versione (la cronologia resta append-only, nessuna riscrittura del passato).
window.ripristinaVersioneHub = async function(versionNumber) {
    if (!window.hubConfig) {
        mostraMessaggio(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."), "error");
        return false;
    }
    try {
        const { repoId, repoKey: key, hubUrl: url } = window.hubConfig;

        // Pre-check: se il server è avanzato rispetto a quanto abbiamo in locale, non tocchiamo
        // nulla e chiediamo di ricevere prima (evita di ripristinare "alla cieca" su dati stantii).
        const resCheck = await fetch(`${url}/api/repos/${repoId}/pull?ifVersionNot=${window.hubConfig.version}`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        if (!resCheck.ok) throw new Error("Impossibile contattare il server per il ripristino.");
        const dataCheck = await resCheck.json();
        if (dataCheck.unchanged !== true) {
            mostraMessaggio(window.t("msg_hub_restore_pull_first", "Il server contiene modifiche più recenti. Usa 'Ricevi' prima di ripristinare."), "warning");
            return false;
        }

        const snap = await window.caricaVersioneHub(versionNumber);
        appData.manoscritti = snap.database.manoscritti || [];
        appData.cartelle = snap.database.cartelle || [];
        appData.tipiDocumento = snap.database.tipiDocumento || [];
        await salvaTutto();

        const resPush = await fetch(`${url}/api/repos/${repoId}/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ parentVersion: window.hubConfig.version, database: appData })
        });

        if (!resPush.ok) {
            if (resPush.status === 409) {
                mostraMessaggio(window.t("msg_hub_restore_conflict", "Ripristino applicato in locale ma non inviato: il server è avanzato nel frattempo. Usa 'Ricevi' per riallineare e poi 'Invia'."), "warning");
                return false;
            }
            throw new Error("Errore durante l'invio del ripristino al server.");
        }

        const dataPush = await resPush.json();
        window.hubConfig.version = dataPush.version;
        window.hubConfig.lastLoadedAt = Date.now();
        await window.apiBrowser.saveHubConfig(window.hubConfig);

        if (typeof normalizzaCartelle === 'function') normalizzaCartelle();
        if (typeof renderSidebar === 'function') renderSidebar();
        if (typeof renderMain === 'function') renderMain();

        return true; // messaggio di successo mostrato dal chiamante (apriConfermaRipristino)
    } catch (e) {
        console.error("Errore ripristino versione Hub:", e);
        mostraMessaggio(e.message || "Errore durante il ripristino della versione.", "error");
        return false;
    }
};

window.sincronizzaConHub = async function() {
    // Deprecata: per compatibilità, esegue prima pull e poi push (se non ci sono conflitti bloccanti)
    mostraMessaggio(window.t("msg_sincronizzazione", "Sincronizzazione..."), "info");
    await window.riceviModificheHub(true);
    await window.inviaModificheHub();
};

// Toast "niente Google" mostrato una sola volta per sessione (non ad ogni sync silenzioso).
let _avvisoNoGoogleMostrato = false;

// Vero finché una sync allegati lascia lavoro in sospeso (allegati non disponibili, non ancora
// pubblicati, o propri non caricati per mancanza di Google). Consente all'autofetch silenzioso di
// riprovare il download senza colpire l'indice hub ad ogni tick quando è già tutto allineato.
// Inizializzato `true`: il primo giro dopo l'avvio va sempre eseguito.
let _hubAttachmentsPending = true;

// Ultimo errore allegati mostrato: evita di ripetere lo stesso toast a ogni autofetch.
let _ultimoErroreAllegatiHub = null;

// Sincronizza gli allegati (chunk cifrati su Drive personale + indice hash→URL sull'hub).
// Non blocca il flusso di sync del DB: gli allegati non disponibili diventano badge, non errori.
window.sincronizzaAllegatiHub = async function(isSilent = true) {
    if (!window.hubConfig || !window.apiBrowser?.syncHubAttachments) return null;
    if (window.hubConfig.attachmentsMode === 'off') return null;
    try {
        const r = await window.apiBrowser.syncHubAttachments();
        if (!r || !r.ok) {
            if (!isSilent) mostraMessaggio(r?.error || "Errore sincronizzazione allegati Hub.", "error");
            return r;
        }
        // Resta "pending" (→ retry ai prossimi autofetch) finché ci sono allegati non scaricabili,
        // non ancora pubblicati dagli altri, o propri non caricati per mancanza di Google.
        _hubAttachmentsPending = !!(r.unavailable || r.notPublished || (r.skippedUpload && r.hasLocalAttachments));

        // Errori concreti (es. makeFilePublic bloccato, pubblicazione indice fallita): vanno
        // mostrati anche dopo sync automatici, altrimenti l'owner crede "tutto ok" mentre gli
        // allegati non arrivano mai agli altri. Una volta per errore-distinto per non spammare.
        if (Array.isArray(r.errors) && r.errors.length) {
            console.error("[hub-att] errori sync allegati:", r.errors);
            if (!_ultimoErroreAllegatiHub || _ultimoErroreAllegatiHub !== r.errors[0]) {
                _ultimoErroreAllegatiHub = r.errors[0];
                mostraMessaggio(r.errors[0], "error");
            }
        } else {
            _ultimoErroreAllegatiHub = null;
        }
        if (!isSilent && (r.uploaded || r.downloaded)) {
            mostraMessaggio(window.t("msg_allegati_sincronizzati", "Allegati sincronizzati."), "success");
        }
        if (r.decryptFailed > 0) {
            mostraMessaggio(window.t("msg_hub_attachments_decrypt_failed",
                `${r.decryptFailed} allegato/i non decifrabile/i: la tua chiave di cifratura non corrisponde a quella usata da chi li ha caricati. Chiedi al proprietario un nuovo invito.`), "error");
        }
        const unavailableGenerico = r.unavailable - (r.decryptFailed || 0);
        if (unavailableGenerico > 0) {
            mostraMessaggio(window.t("msg_allegati_non_disponibili",
                `${unavailableGenerico} allegato/i non disponibile/i (il proprietario non li ha ancora caricati o il link è scaduto).`), "warning");
        }
        // I propri allegati non vengono condivisi finché non si collega Google Drive: avviso
        // one-time per non ripeterlo ad ogni autofetch/pull/push silenzioso.
        if (r.skippedUpload && r.hasLocalAttachments && !_avvisoNoGoogleMostrato) {
            _avvisoNoGoogleMostrato = true;
            mostraMessaggio(window.t("msg_hub_attachments_no_google",
                "I tuoi allegati non vengono condivisi con gli altri membri: collega Google Drive dalle Impostazioni per caricarli sull'Hub."), "warning");
        }
        return r;
    } catch (e) {
        if (!isSilent) console.error("Errore sync allegati Hub:", e);
        return null;
    }
};

// --- Helper chiavi/invito ---

function randomKeyB64url() {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncode(str) {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    return decodeURIComponent(escape(atob(s)));
}

// Convenzione pipe (come sharing.ts): HUB1|hubUrl|repoId|memberKey|encKey|pusherKey|pusherCluster|name(URI-encoded)
window.decodeHubInvite = function(rawCode) {
    let code = (rawCode || '').trim();
    if (code.startsWith('archiview://join/')) code = code.slice('archiview://join/'.length);
    let decoded;
    try { decoded = b64urlDecode(code); } catch { return null; }
    if (!decoded.startsWith('HUB1|')) return null;
    const parts = decoded.split('|');
    if (parts.length < 4) return null;
    const [, hubUrl, repoId, memberKey, encKey, pusherKey, pusherCluster, nameEnc] = parts;
    if (!hubUrl || !repoId || !memberKey) return null;
    let name = '';
    try { name = nameEnc ? decodeURIComponent(nameEnc) : ''; } catch { name = ''; }
    return { hubUrl, repoId, memberKey, encKey: encKey || null, pusherKey: pusherKey || '', pusherCluster: pusherCluster || '', name };
};

// Crea un nuovo repository Hub a partire dal workspace corrente (l'utente ne diventa owner).
window.creaRepositoryHub = async function(name) {
    if (!window.apiBrowser?.hubCreateRepo) return false;
    // Overlay bloccante per l'intera durata (non il solo toast, che si autonasconde dopo 3.5s
    // mentre le fetch verso l'Hub sono ancora in corso e l'utente resta senza feedback).
    if (typeof window.mostraProgressoCloud === 'function') {
        window.mostraProgressoCloud(window.t("prog_hub_prepare_title", "Preparazione dell'archivio condiviso"), window.t("msg_creazione_repository", "Creazione del repository in corso..."));
    }
    try {
        const r = await window.apiBrowser.hubCreateRepo(name || null);
        if (!r || !r.ok) {
            if (typeof window.nascondiProgressoCloud === 'function') window.nascondiProgressoCloud();
            mostraMessaggio(r?.error || window.t("msg_errore_creazione_repo", "Errore creazione repository."), "error");
            return false;
        }

        // Il nome scelto è la fonte viva condivisa: va scritto in appData.nomeArchivio PRIMA del
        // push iniziale, così owner e futuri membri (join → data.database.nomeArchivio) leggono
        // lo stesso nome. Senza nome esplicito si usa il basename della cartella (il nome che
        // l'utente vede nello switcher), non il fantasma "ArchiView".
        const finalName = (name && String(name).trim()) || await window.nomeVaultDefault();
        if (window.appData) {
            window.appData.nomeArchivio = finalName;
            await salvaTutto();
        }

        const encKey = randomKeyB64url();
        // Push iniziale del DB locale (v0 → v1)
        const resPush = await fetch(`${r.hubUrl}/api/repos/${r.repoId}/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${r.ownerKey}` },
            body: JSON.stringify({ parentVersion: 0, database: appData }),
            signal: AbortSignal.timeout(20000)
        });
        if (!resPush.ok) throw new Error("Push iniziale fallito (HTTP " + resPush.status + ").");
        const pushData = await resPush.json();

        const hubConfig = {
            hubUrl: r.hubUrl, repoId: r.repoId, repoKey: r.ownerKey, encKey,
            version: pushData.version, lastLoadedAt: Date.now(), attachmentsMode: 'drive-links',
            role: 'owner',
            name: finalName,
            pusherKey: r.pusherKey, pusherCluster: r.pusherCluster
        };
        await window.apiBrowser.saveHubConfig(hubConfig);
        if (window.apiBrowser.setRealtimeConfig) {
            await window.apiBrowser.setRealtimeConfig({ pusherKey: r.pusherKey, pusherCluster: r.pusherCluster, pusherWebhook: r.pusherWebhook });
        }
        window.hubConfig = hubConfig;
        // Aggiorna subito header/widget: senza questo i controlli sync sparirebbero
        // fino al reload (~1.2s).
        if (window.aggiornaVisibilitaCloud) window.aggiornaVisibilitaCloud();
        window.sincronizzaAllegatiHub(false);

        mostraMessaggio(window.t("msg_repository_creato", "Repository creato! L'archivio è ora sincronizzato sull'Hub."), "success");
        // Dopo il reload apri automaticamente il pannello Condivisione (l'owner deve invitare).
        try {
            if (window.apiSettings) {
                const s = await window.apiSettings.get();
                s.hubJustCreated = true;
                await window.apiSettings.save(s);
            }
        } catch { /* flag best-effort: il reload avviene comunque */ }
        // Overlay già visibile dall'inizio dell'operazione: il reload resta necessario per
        // reinizializzare lo stato del vault, ma non deve sembrare un errore o un blocco muto.
        if (typeof window.mostraProgressoCloud === 'function') {
            window.mostraProgressoCloud(window.t("prog_hub_prepare_title", "Preparazione dell'archivio condiviso"), window.t("prog_hub_prepare_desc", "Un attimo di pazienza..."));
        }
        setTimeout(() => location.reload(), 1200);
        return true;
    } catch (e) {
        if (typeof window.nascondiProgressoCloud === 'function') window.nascondiProgressoCloud();
        const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
        mostraMessaggio(timedOut ? window.t("msg_timeout_creazione_repo", "Hub non raggiungibile (timeout). Riprova più tardi.") : (e.message || window.t("msg_errore_creazione_repo_generic", "Errore durante la creazione del repository.")), "error");
        return false;
    }
};

// Rinomina il vault Hub (solo owner). Il nome è la fonte viva: aggiorna appData.nomeArchivio +
// hubConfig.name, salva in locale, poi fa push così i membri ricevono il nuovo nome al prossimo
// pull. Serve a correggere i vault creati prima che il nome cartella diventasse il default.
window.rinominaVaultHub = async function(newName) {
    const nome = (newName || '').trim();
    if (!window.hubConfig || !nome) return false;
    if (nome === window.hubConfig.name) return false;
    try {
        if (window.appData) { window.appData.nomeArchivio = nome; await salvaTutto(); }
        window.hubConfig.name = nome;
        await window.apiBrowser.saveHubConfig(window.hubConfig);
        // Propaga ai membri (push del DB con il nuovo nomeArchivio). Best-effort: se il push
        // fallisce (conflitto/offline) il nome locale è comunque aggiornato e partirà al prossimo invio.
        if (window.inviaModificheHub) await window.inviaModificheHub();
        if (window.aggiornaListaVault) await window.aggiornaListaVault();
        mostraMessaggio(window.t("msg_vault_rinominato", "Nome dell'archivio aggiornato."), "success");
        return true;
    } catch (e) {
        mostraMessaggio(e.message || "Errore durante la rinomina.", "error");
        return false;
    }
};

// Restituisce il ruolo dell'utente sul repository Hub: 'owner' | 'member' | 'unknown'.
// Se il ruolo non è persistito (config legacy pre-redesign) esegue un probe: GET /members
// è owner-only (403 per i membri) → 200='owner', 401/403='member'. L'esito certo viene
// persistito su hubConfig per evitare richieste future.
window.getHubRole = async function() {
    if (!window.hubConfig) return 'unknown';
    if (window.hubConfig.role === 'owner' || window.hubConfig.role === 'member') return window.hubConfig.role;
    const { hubUrl, repoId, repoKey } = window.hubConfig;
    try {
        const res = await fetch(`${hubUrl}/api/repos/${repoId}/members`, { headers: { 'Authorization': `Bearer ${repoKey}` } });
        if (res.ok) {
            window.hubConfig.role = 'owner';
        } else if (res.status === 401 || res.status === 403) {
            window.hubConfig.role = 'member';
        } else {
            return 'unknown'; // errore transitorio: non persistere, ritenta alla prossima apertura
        }
        if (window.apiBrowser?.saveHubConfig) await window.apiBrowser.saveHubConfig(window.hubConfig);
        return window.hubConfig.role;
    } catch {
        return 'unknown'; // offline: UI degradata, nessun invito mostrato
    }
};

// Genera un invito HUB1 = crea un nuovo membro revocabile e ne incorpora la chiave fresca.
window.generaInvitoHub = async function(label) {
    if (!window.hubConfig) { mostraMessaggio(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."), "error"); return null; }
    const { hubUrl, repoId, repoKey, encKey, pusherKey, pusherCluster } = window.hubConfig;
    const memberLabel = (label && String(label).trim()) || `${window.t("hub_invite_default_label", "Invito")} ${new Date().toLocaleDateString()}`;
    try {
        const res = await fetch(`${hubUrl}/api/repos/${repoId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${repoKey}` },
            body: JSON.stringify({ label: memberLabel })
        });
        if (res.status === 403) throw new Error("Solo il proprietario può generare inviti.");
        if (!res.ok) throw new Error("Errore generazione invito (HTTP " + res.status + ").");
        const { memberKey } = await res.json();
        const hubName = window.hubConfig.name || (window.appData && window.appData.nomeArchivio) || '';
        const raw = ['HUB1', hubUrl, repoId, memberKey, encKey || '', pusherKey || '', pusherCluster || '', encodeURIComponent(hubName)].join('|');
        return b64urlEncode(raw);
    } catch (e) {
        mostraMessaggio(e.message || "Errore generazione invito.", "error");
        return null;
    }
};

window.listaMembriHub = async function() {
    if (!window.hubConfig) return [];
    const { hubUrl, repoId, repoKey } = window.hubConfig;
    try {
        const res = await fetch(`${hubUrl}/api/repos/${repoId}/members`, { headers: { 'Authorization': `Bearer ${repoKey}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return data.members || [];
    } catch { return []; }
};

window.revocaMembroHub = async function(memberId) {
    if (!window.hubConfig || !memberId) return false;
    const { hubUrl, repoId, repoKey } = window.hubConfig;
    try {
        const res = await fetch(`${hubUrl}/api/repos/${repoId}/members/${memberId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${repoKey}` }
        });
        return res.ok;
    } catch { return false; }
};

// Join di un repository Hub da invito, con basePath già scelto (usato dal welcomeModal,
// che ha il proprio input percorso). Nessun accesso Google richiesto.
window.eseguiJoinHub = async function(invite, basePath) {
    if (!invite || !basePath) return false;
    try {
        const res = await fetch(`${invite.hubUrl}/api/repos/${invite.repoId}/pull`, {
            headers: { 'Authorization': `Bearer ${invite.memberKey}` }
        });
        if (res.status === 401 || res.status === 403) throw new Error("Invito non valido o accesso revocato.");
        if (!res.ok) throw new Error("Impossibile connettersi al repository remoto.");
        const data = await res.json();

        const hubConfigObj = {
            hubUrl: invite.hubUrl, repoId: invite.repoId, repoKey: invite.memberKey,
            encKey: invite.encKey || null, version: data.version, lastLoadedAt: Date.now(),
            attachmentsMode: 'drive-links', role: 'member',
            name: invite.name || '',
            pusherKey: invite.pusherKey || '', pusherCluster: invite.pusherCluster || '',
            pusherWebhook: `${invite.hubUrl}/api/ping`
        };
        // Nome vault condiviso = nomeArchivio del DB scaricato (fonte viva, uguale per tutti);
        // fallback a invite.name, poi all'id opaco. Sanitizzato per il filesystem.
        const sharedName = (data.database && data.database.nomeArchivio) || invite.name || '';
        hubConfigObj.name = sharedName;
        const folderName = sanitizeVaultFolderName(sharedName) || `Vault_${invite.repoId}`;
        return await window.apiBrowser.cloneWorkspaceHub(basePath, folderName, hubConfigObj, data.database);
    } catch (e) {
        mostraMessaggio(e.message || "Errore durante il join del repository Hub.", "error");
        return false;
    }
};

window.clonaRepositoryHub = async function(url, repoId, key, encKey, pusher) {
    mostraMessaggio(window.t("msg_connessione_al_repository", "Connessione al repository..."), "info");
    
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
            mostraMessaggio(window.t("msg_seleziona_il_percorso_in_", "Seleziona il percorso in cui scaricare l'archivio."), "info");
            const basePath = await window.apiBrowser.selectBaseDirectory(window.t("dialog_select_folder", "Seleziona la posizione per la nuova cartella"));
            if (basePath) {
                const hubConfigObj = {
                    hubUrl: url,
                    repoId: repoId,
                    repoKey: key,
                    encKey: encKey || null,
                    version: data.version,
                    lastLoadedAt: Date.now(),
                    attachmentsMode: 'drive-links',
                    role: 'member',
                    pusherKey: pusher?.pusherKey || '',
                    pusherCluster: pusher?.pusherCluster || '',
                    pusherWebhook: pusher?.pusherWebhook || (url ? `${url}/api/ping` : '')
                };
                
                const sharedName = (data.database && data.database.nomeArchivio) || '';
                hubConfigObj.name = sharedName;
                const folderName = sanitizeVaultFolderName(sharedName) || `Vault_${repoId}`;
                const success = await window.apiBrowser.cloneWorkspaceHub(basePath, folderName, hubConfigObj, data.database);
                if (success) {
                    mostraMessaggio(window.t("msg_archivio_clonato_con_succ", "Archivio clonato con successo! Riavvio in corso..."), "success");
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
