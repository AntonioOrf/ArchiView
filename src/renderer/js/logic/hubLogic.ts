window.hubConfig = null;
window.hubAutofetchTimer = null;

// Ultima versione remota già notificata dall'autofetch silenzioso: evita di ripetere il
// toast "Ci sono aggiornamenti" a ogni tick finché l'utente non riceve o cambia versione.
let _ultimaVersioneAutofetchNotificata = null;

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

// Push in corso: l'handler realtime lo attende prima di confrontare le versioni, altrimenti la
// notifica del proprio push (che può arrivare prima della risposta) sembrerebbe una novità.
window.hubPushInCorso = null;
function pushHub(parentVersion, database) {
    const p = window.apiBrowser.hubPush(parentVersion, window.databasePerDisco(database));
    window.hubPushInCorso = p;
    p.finally(() => { if (window.hubPushInCorso === p) window.hubPushInCorso = null; }).catch(() => {});
    return p;
}

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
    if (typeof window.avviaRealtimeHub === 'function') window.avviaRealtimeHub();
};

// Azzera badge/contatore "modifiche in entrata" (usato dopo un pull riuscito o quando risulta
// non esserci nulla da scaricare, per non lasciare l'indicatore acceso fino al fetch successivo).
window.pulisciModificheInEntrataHub = function() {
    window.impostaModificheInEntrata(false);
    window.azzeraErroreCloud();
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

    // if (!isSilent) mostraMessaggio(window.t("msg_ricezione_modifiche_dall_", "Ricezione modifiche dall'Hub in corso…"), "info");
    
    try {
        const localVersion = window.hubConfig.version;

        // Fast-path autofetch: `ifVersionNot` costa 1 sola lettura D1 se nulla è cambiato.
        const resPull = await window.apiBrowser.hubPull(isSilent && typeof localVersion === 'number' ? localVersion : undefined);

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
            throw new Error(resPull.error || "Impossibile scaricare i dati dal server.");
        }

        const dataPull = resPull.data;
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

        // In silenzio non si apre nessun modale: se il merge dovesse chiedere qualcosa, solo avviso.
        if (isSilent) {
            const conflitti = window.rilevaConflitti(appData.manoscritti, esterniDati.manoscritti, window.ultimoCaricamento || 0,
                appData.baseHashes || {}, appData.baseObjects || {});
            if (conflitti.length > 0) {
                mostraMessaggio(window.t("msg_attenzione_rilevati_confl", "Attenzione: rilevati conflitti di sincronizzazione dal server. Clicca 'Ricevi' per risolverli."), "warning");
                return;
            }
            const locali = new Set((appData.manoscritti || []).map(m => m.id));
            const remoti = new Set((esterniDati.manoscritti || []).map(m => m.id));
            if ((esterniDati.deletedIds || []).some(id => locali.has(id)) || (appData.deletedIds || []).some(id => remoti.has(id))) {
                mostraMessaggio(window.t("msg_attenzione_alcuni_file_so", "Attenzione: alcuni file sono stati eliminati sul server. Clicca 'Ricevi' per verificare."), "warning");
                return;
            }
        }

        // Stesso merge a tre vie di Drive (base, tombstone, vocabolari, migrazione): annullato → versione invariata.
        if (await window.sincronizzaEUnisciDati(esterniDati) === false) return;

        window.hubConfig.version = serverVersion;
        window.hubConfig.lastLoadedAt = Date.now();
        await window.apiBrowser.saveHubConfig(window.hubConfig);
        window.pulisciModificheInEntrataHub();
        window.sincronizzaAllegatiHub(isSilent); // fire-and-forget: scarica gli allegati nuovi via link

        mostraMessaggio(isSilent
            ? window.t("msg_dati_sincronizzati_automa", "Dati sincronizzati automaticamente dal server.")
            : window.t("msg_dati_scaricati_e_fusi_con", 'Dati scaricati e uniti in locale.'), isSilent ? "info" : "success");

    } catch (error) {
        window.impostaErroreCloud(error.message);
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
        const localVersion = window.hubConfig.version;
        const loadedAt = window.hubConfig.lastLoadedAt || 0;

        // Fast-path: se nulla è cambiato costa 1 sola lettura D1.
        const res = await window.apiBrowser.hubPull(typeof localVersion === 'number' ? localVersion : undefined);

        if (!res.ok) {
            if (manual) mostraMessaggio(res.status === 403
                ? "Il tuo accesso a questo repository è stato revocato dall'amministratore."
                : (res.status === 401 ? "Chiave di accesso non valida per questo repository."
                : (res.error || "Impossibile contattare il server.")), "error");
            return;
        }

        const data = res.data || {};
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
            mostraMessaggio(window.t("msg_ci_sono_nuovi_aggiornamen", 'Ci sono nuove modifiche da scaricare.'), "success");
        } else if (data.version !== _ultimaVersioneAutofetchNotificata) {
            // Autofetch silenzioso: notifica una sola volta per versione remota, con
            // un'azione diretta ("Ricevi adesso") invece di lasciare solo l'indicatore acceso.
            _ultimaVersioneAutofetchNotificata = data.version;
            mostraMessaggio(
                window.t("msg_ci_sono_nuovi_aggiornamen", 'Ci sono nuove modifiche da scaricare.'), "info", null,
                { label: window.t("hub_widget_receive", "Ricevi"), onClick: () => window.riceviModificheHub() }
            );
        }
    } catch (e) {
        window.impostaErroreCloud(e.message);
        if (manual) { console.error("Errore controllo Hub:", e); mostraMessaggio(window.t("msg_errore_durante_il_fetch", "Errore durante il fetch: ") + (e.message || ''), "error"); }
    }
};

window.inviaModificheHub = async function() {
    if (!window.hubConfig) {
        mostraMessaggio(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."), "error");
        return;
    }

    mostraMessaggio(window.t("msg_invio_modifiche_al_server", "Invio modifiche al server…"), "info");

    // Il push usa appData in memoria, ma la sync allegati che segue legge il DB dal disco.
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();

    try {
        const inviate = structuredClone(appData.manoscritti);
        const resPush = await pushHub(window.hubConfig.version, appData);

        if (!resPush.ok) {
            if (resPush.status === 409) {
                mostraMessaggio(
                    window.t("msg_il_server_contiene_modifi_action", "Un collega ha appena salvato delle modifiche. Ricevile e poi riprova a inviare."),
                    "warning", null,
                    { label: window.t("share_conflict_action_label", "Ricevi ora"), onClick: () => window.riceviModificheHub() }
                );
                return;
            }
            throw new Error(resPush.error || "Errore durante l'invio delle modifiche al server.");
        }

        window.hubConfig.version = resPush.data.version;
        window.hubConfig.lastLoadedAt = Date.now();
        await window.apiBrowser.saveHubConfig(window.hubConfig);
        await window.registraBaseInviata(inviate);

        window.sincronizzaAllegatiHub(false); // carica i chunk mancanti sul proprio Drive + pubblica indice

        window.azzeraErroreCloud();
        mostraMessaggio(window.t("msg_modifiche_inviate_con_suc", 'Modifiche inviate.'), "success");

    } catch (e) {
        console.error("Errore invio sync:", e);
        window.impostaErroreCloud(e.message);
        mostraMessaggio(e.message || "Errore durante l'invio all'Hub.", "error");
    }
};

// --- Cronologia versioni Hub (equivalente delle revisioni Drive) ---------------------------

// Elenco versioni conservate sul server (metadata-only: autore, data, dimensione).
window.elencaVersioniHub = async function() {
    if (!window.hubConfig) throw new Error(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."));
    const res = await window.apiBrowser.hubVersions();
    if (!res.ok) {
        const e: Error & { status?: number } = new Error(res.error || "Impossibile recuperare la cronologia dal server.");
        e.status = res.status;
        throw e;
    }
    return res.data; // { currentVersion, versions }
};

// Snapshot completo di una versione specifica (per diff o ripristino).
window.caricaVersioneHub = async function(versionNumber) {
    if (!window.hubConfig) throw new Error(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."));
    const res = await window.apiBrowser.hubVersion(versionNumber);
    if (!res.ok) {
        const e: Error & { status?: number } = new Error(res.error || "Impossibile recuperare questa versione dal server.");
        e.status = res.status;
        throw e;
    }
    return res.data; // { version, database }
};

// Ripristino "git-revert": carica lo snapshot scelto, lo sostituisce in locale, poi lo invia
// come nuova versione (la cronologia resta append-only, nessuna riscrittura del passato).
window.ripristinaVersioneHub = async function(versionNumber) {
    if (!window.hubConfig) {
        mostraMessaggio(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."), "error");
        return false;
    }
    try {
        // Pre-check: se il server è avanzato rispetto a quanto abbiamo in locale, non tocchiamo
        // nulla e chiediamo di ricevere prima (evita di ripristinare "alla cieca" su dati stantii).
        const resCheck = await window.apiBrowser.hubPull(window.hubConfig.version);
        if (!resCheck.ok) throw new Error(resCheck.error || "Impossibile contattare il server per il ripristino.");
        if (!resCheck.data || resCheck.data.unchanged !== true) {
            mostraMessaggio(window.t("msg_hub_restore_pull_first", "Il server contiene modifiche più recenti. Usa 'Ricevi' prima di ripristinare."), "warning");
            return false;
        }

        const snap = await window.caricaVersioneHub(versionNumber);
        // Stesse regole del ripristino locale: schede rifirmate e tombstone per quelle nate dopo,
        // o il merge dei colleghi riporterebbe tutto com'era (vedi `ripristinaDatabase`).
        await window.ripristinaDatabase(snap.database);

        const inviate = structuredClone(appData.manoscritti);
        const resPush = await pushHub(window.hubConfig.version, appData);

        if (!resPush.ok) {
            if (resPush.status === 409) {
                mostraMessaggio(window.t("msg_hub_restore_conflict", "Ripristino applicato in locale ma non inviato: il server è avanzato nel frattempo. Usa 'Ricevi' per riallineare e poi 'Invia'."), "warning");
                return false;
            }
            throw new Error(resPush.error || "Errore durante l'invio del ripristino al server.");
        }

        window.hubConfig.version = resPush.data.version;
        window.hubConfig.lastLoadedAt = Date.now();
        await window.apiBrowser.saveHubConfig(window.hubConfig);
        await window.registraBaseInviata(inviate);

        return true; // messaggio di successo mostrato dal chiamante (apriConfermaRipristino)
    } catch (e) {
        console.error("Errore ripristino versione Hub:", e);
        mostraMessaggio(e.message || "Errore durante il ripristino della versione.", "error");
        return false;
    }
};

window.sincronizzaConHub = async function() {
    // Deprecata: per compatibilità, esegue prima pull e poi push (se non ci sono conflitti bloccanti)
    mostraMessaggio(window.t("msg_sincronizzazione", "Sincronizzazione…"), "info");
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
    // Il main legge database_manoscritti.json per sapere quali allegati indicizzare.
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
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
                "{var0} allegato/i non decifrabile/i: la tua chiave di cifratura non corrisponde a quella usata da chi li ha caricati. Chiedi al proprietario un nuovo invito.").replace('{var0}', String(r.decryptFailed)), "error");
        }
        const unavailableGenerico = r.unavailable - (r.decryptFailed || 0);
        if (unavailableGenerico > 0) {
            mostraMessaggio(window.t("msg_allegati_non_disponibili",
                "{var0} allegato/i non disponibile/i (il proprietario non li ha ancora caricati o il link è scaduto).").replace('{var0}', String(unavailableGenerico)), "warning");
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

// --- Invito ---

// Anteprima di un invito incollato dall'utente: solo il nome, per l'interfaccia. Le chiavi
// dentro il codice le legge il main al momento del join (hubJoin).
// Convenzione pipe: HUB1|hubUrl|repoId|memberKey|encKey|pusherKey|pusherCluster|name(URI-encoded)
window.decodeHubInvite = function(rawCode) {
    let code = (rawCode || '').trim();
    if (code.startsWith('archiview://join/')) code = code.slice('archiview://join/'.length);
    let decoded;
    try {
        let s = code.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4 !== 0) s += '=';
        decoded = decodeURIComponent(escape(atob(s)));
    } catch { return null; }
    if (!decoded.startsWith('HUB1|')) return null;
    const parts = decoded.split('|');
    if (parts.length < 4 || !parts[1] || !parts[2] || !parts[3]) return null;
    let name = '';
    try { name = parts[7] ? decodeURIComponent(parts[7]) : ''; } catch { name = ''; }
    return { code: rawCode, name };
};

// Crea un nuovo repository Hub a partire dal workspace corrente (l'utente ne diventa owner).
window.creaRepositoryHub = async function(name) {
    if (!window.apiBrowser?.hubCreateRepo) return false;
    // Overlay bloccante per l'intera durata (non il solo toast, che si autonasconde dopo 3.5s
    // mentre le fetch verso l'Hub sono ancora in corso e l'utente resta senza feedback).
    if (typeof window.mostraProgressoCloud === 'function') {
        window.mostraProgressoCloud(window.t("prog_hub_prepare_title", "Preparazione dell'archivio condiviso"), window.t("msg_creazione_repository", "Creazione del repository in corso…"));
    }
    try {
        // Il nome scelto è la fonte viva condivisa: va scritto in appData.nomeArchivio PRIMA del
        // push iniziale, così owner e futuri membri (join → data.database.nomeArchivio) leggono
        // lo stesso nome. Senza nome esplicito si usa il basename della cartella (il nome che
        // l'utente vede nello switcher), non il fantasma "ArchiView".
        const finalName = (name && String(name).trim()) || await window.nomeVaultDefault();
        if (window.appData) {
            window.appData.nomeArchivio = finalName;
            await salvaTutto();
        }

        // Il main crea il repo, genera la encKey, fa il push iniziale (v0 → v1) e salva la config:
        // qui torna solo la parte pubblica.
        const r = await window.apiBrowser.hubCreateRepo(finalName, window.databasePerDisco(window.appData));
        if (!r || !r.ok) {
            if (typeof window.nascondiProgressoCloud === 'function') window.nascondiProgressoCloud();
            mostraMessaggio(r?.error || window.t("msg_errore_creazione_repo", "Errore creazione repository."), "error");
            return false;
        }
        window.hubConfig = r.config;
        // Aggiorna subito header/widget: senza questo i controlli sync sparirebbero
        // fino al reload (~1.2s).
        if (window.aggiornaVisibilitaCloud) window.aggiornaVisibilitaCloud();
        window.sincronizzaAllegatiHub(false);

        mostraMessaggio(window.t("msg_repository_creato", 'Archivio condiviso pronto: ora puoi invitare i collaboratori.'), "success");
        // Dopo il reload apri automaticamente il pannello Condivisione (l'owner deve invitare).
        try {
            if (window.apiSettings) {
                await window.apiSettings.patch({ hubJustCreated: true });
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
// Il main lo legge dalla config o lo ricava con un probe owner-only, e persiste l'esito certo.
window.getHubRole = async function() {
    if (!window.hubConfig) return 'unknown';
    if (window.hubConfig.role === 'owner' || window.hubConfig.role === 'member') return window.hubConfig.role;
    try {
        const role = await window.apiBrowser.hubRole();
        if (role === 'owner' || role === 'member') window.hubConfig.role = role;
        return role || 'unknown';
    } catch {
        return 'unknown'; // offline: UI degradata, nessun invito mostrato
    }
};

// Genera un invito HUB1: il main crea un membro revocabile e compone il codice con le chiavi.
window.generaInvitoHub = async function(label) {
    if (!window.hubConfig) { mostraMessaggio(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."), "error"); return null; }
    const memberLabel = (label && String(label).trim()) || `${window.t("hub_invite_default_label", "Invito")} ${new Date().toLocaleDateString()}`;
    try {
        const res = await window.apiBrowser.hubInvite(memberLabel, (window.appData && window.appData.nomeArchivio) || '');
        if (res.status === 403) throw new Error("Solo il proprietario può generare inviti.");
        if (!res.ok) throw new Error(res.error || "Errore generazione invito (HTTP " + res.status + ").");
        return res.data.code;
    } catch (e) {
        mostraMessaggio(e.message || "Errore generazione invito.", "error");
        return null;
    }
};

window.listaMembriHub = async function() {
    if (!window.hubConfig) return [];
    try {
        const res = await window.apiBrowser.hubMembers();
        return (res.ok && res.data && res.data.members) || [];
    } catch { return []; }
};

window.revocaMembroHub = async function(memberId) {
    if (!window.hubConfig || !memberId) return false;
    try {
        const res = await window.apiBrowser.hubRevokeMember(memberId);
        return !!res.ok;
    } catch { return false; }
};

// Join di un repository Hub da invito, con basePath già scelto (usato dal welcomeModal,
// che ha il proprio input percorso). Nessun accesso Google richiesto. Download del DB,
// creazione del workspace e salvataggio delle chiavi avvengono nel main.
window.eseguiJoinHub = async function(invite, basePath) {
    if (!invite || !invite.code || !basePath) return false;
    try {
        const res = await window.apiBrowser.hubJoin(invite.code, basePath);
        if (!res.ok) throw new Error(res.error || "Impossibile connettersi al repository remoto.");
        return true;
    } catch (e) {
        mostraMessaggio(e.message || "Errore durante il join del repository Hub.", "error");
        return false;
    }
};
