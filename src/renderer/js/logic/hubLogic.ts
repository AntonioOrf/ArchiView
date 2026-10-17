window.hubConfig = null;
window.hubAutofetchTimer = null;

let _ultimaVersioneAutofetchNotificata: any = null;

window.nomeVaultDefault = async function() {
    try {
        const p = window.apiBrowser?.getWorkspacePath ? await window.apiBrowser.getWorkspacePath() : '';
        const base = (p || '').split(/[\/\\]/).filter(Boolean).pop();
        return (base && base.trim()) || (window.appData && window.appData.nomeArchivio) || 'Hub';
    } catch {
        return (window.appData && window.appData.nomeArchivio) || 'Hub';
    }
};

async function inizializzaHubConfig() {
    if (window.apiBrowser && window.apiBrowser.loadHubConfig) {
        window.hubConfig = await window.apiBrowser.loadHubConfig();
        window.avviaAutofetchHub();
        if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();
        if (window.hubConfig) window.sincronizzaAllegatiHub(true);
    }
}
document.addEventListener('DOMContentLoaded', inizializzaHubConfig);

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
    const enabled = settings.autofetchEnabled !== false;
    const intervalMinutes = settings.autofetchInterval || 5;
    
    if (enabled) {
        window.hubAutofetchTimer = setInterval(() => {
            window.controllaModificheHub(false);
        }, intervalMinutes * 60 * 1000);
    }
    if (typeof window.avviaRealtimeHub === 'function') window.avviaRealtimeHub();
};

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

    try {
        const localVersion = window.hubConfig.version;

        const resPull = await window.apiBrowser.hubPull(isSilent && typeof localVersion === 'number' ? localVersion : undefined);

        if (!resPull.ok) {
            if (resPull.status === 401 || resPull.status === 403) {
                if (isSilent) return;
                throw new Error(resPull.status === 403
                    ? window.t('hub_err_revocato', "Il tuo accesso a questo repository è stato revocato dall'amministratore.")
                    : window.t('hub_err_chiave', "Chiave di accesso non valida per questo repository."));
            }
            if (isSilent) return;
            throw new Error(resPull.error || "Impossibile scaricare i dati dal server.");
        }

        const dataPull = resPull.data;
        if (dataPull.unchanged === true) {
            window.pulisciModificheInEntrataHub();
            if (!isSilent || _hubAttachmentsPending) window.sincronizzaAllegatiHub(isSilent);
            return;
        }

        const esterniDati = dataPull.database;
        const serverVersion = dataPull.version;

        if (serverVersion === window.hubConfig.version) {
            window.pulisciModificheInEntrataHub();
            if (!isSilent || _hubAttachmentsPending) window.sincronizzaAllegatiHub(isSilent);
            if (!isSilent) mostraMessaggio(window.t("msg_nessuna_nuova_modifica_su", "Nessuna nuova modifica sul server. Sei aggiornato."), "success");
            return;
        }

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

        if (await window.sincronizzaEUnisciDati(esterniDati) === false) return;

        window.hubConfig.version = serverVersion;
        window.hubConfig.lastLoadedAt = Date.now();
        window.ultimoCaricamento = window.hubConfig.lastLoadedAt;
        if (window.apiSettings) await window.apiSettings.patch({ lastSyncTime: window.ultimoCaricamento });
        await window.apiBrowser.saveHubConfig(window.hubConfig);
        window.pulisciModificheInEntrataHub();
        window.sincronizzaAllegatiHub(isSilent);

        mostraMessaggio(isSilent
            ? window.t("msg_dati_sincronizzati_automa", "Dati sincronizzati automaticamente dal server.")
            : window.t("msg_dati_scaricati_e_fusi_con", 'Dati scaricati e uniti in locale.'), isSilent ? "info" : "success");

    } catch (error) {
        window.impostaErroreCloud(error.message);
        if (!isSilent) {
            console.error("Errore di ricezione:", error);
            mostraMessaggio(error.message || window.t('hub_err_ricezione', "Errore durante la ricezione dall'Hub."), "error");
        }
    }
};

window.controllaModificheHub = async function(manual = false) {
    if (!window.hubConfig) return;
    try {
        const localVersion = window.hubConfig.version;
        const loadedAt = window.hubConfig.lastLoadedAt || 0;

        const res = await window.apiBrowser.hubPull(typeof localVersion === 'number' ? localVersion : undefined);

        if (!res.ok) {
            if (manual) mostraMessaggio(res.status === 403
                ? window.t('hub_err_revocato', "Il tuo accesso a questo repository è stato revocato dall'amministratore.")
                : (res.status === 401 ? window.t('hub_err_chiave', "Chiave di accesso non valida per questo repository.")
                : (res.error || window.t('hub_err_server', "Impossibile contattare il server."))), "error");
            return;
        }

        const data = res.data || {};
        const noChanges = data.unchanged === true || data.version === localVersion;

        if (noChanges) {
            window.pulisciModificheInEntrataHub();
            if (manual) mostraMessaggio(window.t("msg_nessun_nuovo_aggiornament", "Nessun nuovo aggiornamento trovato."), "success");
            return;
        }

        const remote = data.database || {};
        window.incomingChanges = (remote.manoscritti || []).filter(m => (m.lastModified || 0) > loadedAt);
        window.incomingAuthor = window.t("hub_generic_author", "Collaboratore");

        window.incomingStructuralChanges = window.riepilogoInArrivo(appData, remote, window.incomingAuthor);

        window.impostaModificheInEntrata(true);
        if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
        if (manual) {
            mostraMessaggio(window.t("msg_ci_sono_nuovi_aggiornamen", 'Ci sono nuove modifiche da scaricare.'), "success");
        } else if (data.version !== _ultimaVersioneAutofetchNotificata) {
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

    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();

    try {
        const inviate = structuredClone(appData.manoscritti);
        const strutturaInviata = window.strutturaPerBase(appData);
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
            throw new Error(resPush.error || window.t('hub_err_invio_modifiche', "Errore durante l'invio delle modifiche al server."));
        }

        window.hubConfig.version = resPush.data.version;
        window.hubConfig.lastLoadedAt = Date.now();
        await window.apiBrowser.saveHubConfig(window.hubConfig);
        await window.registraBaseInviata(inviate, strutturaInviata);

        window.sincronizzaAllegatiHub(false);

        window.azzeraErroreCloud();
        mostraMessaggio(window.t("msg_modifiche_inviate_con_suc", 'Modifiche inviate.'), "success");

    } catch (e) {
        console.error("Errore invio sync:", e);
        window.impostaErroreCloud(e.message);
        mostraMessaggio(e.message || window.t('hub_err_invio', "Errore durante l'invio all'Hub."), "error");
    }
};

window.elencaVersioniHub = async function() {
    if (!window.hubConfig) throw new Error(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."));
    const res = await window.apiBrowser.hubVersions();
    if (!res.ok) {
        const e: Error & { status?: number } = new Error(res.error || window.t('hub_err_cronologia', "Impossibile recuperare la cronologia dal server."));
        e.status = res.status;
        throw e;
    }
    return res.data;
};

window.caricaVersioneHub = async function(versionNumber) {
    if (!window.hubConfig) throw new Error(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."));
    const res = await window.apiBrowser.hubVersion(versionNumber);
    if (!res.ok) {
        const e: Error & { status?: number } = new Error(res.error || "Impossibile recuperare questa versione dal server.");
        e.status = res.status;
        throw e;
    }
    return res.data;
};

window.ripristinaVersioneHub = async function(versionNumber) {
    if (!window.hubConfig) {
        mostraMessaggio(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."), "error");
        return false;
    }
    try {
        const resCheck = await window.apiBrowser.hubPull(window.hubConfig.version);
        if (!resCheck.ok) throw new Error(resCheck.error || window.t('hub_err_server_ripristino', "Impossibile contattare il server per il ripristino."));
        if (!resCheck.data || resCheck.data.unchanged !== true) {
            mostraMessaggio(window.t("msg_hub_restore_pull_first", "Il server contiene modifiche più recenti. Usa 'Ricevi' prima di ripristinare."), "warning");
            return false;
        }

        const snap = await window.caricaVersioneHub(versionNumber);
        await window.ripristinaDatabase(snap.database);

        const inviate = structuredClone(appData.manoscritti);
        const strutturaInviata = window.strutturaPerBase(appData);
        const resPush = await pushHub(window.hubConfig.version, appData);

        if (!resPush.ok) {
            if (resPush.status === 409) {
                mostraMessaggio(window.t("msg_hub_restore_conflict", "Ripristino applicato in locale ma non inviato: il server è avanzato nel frattempo. Usa 'Ricevi' per riallineare e poi 'Invia'."), "warning");
                return false;
            }
            throw new Error(resPush.error || window.t('hub_err_invio_ripristino', "Errore durante l'invio del ripristino al server."));
        }

        window.hubConfig.version = resPush.data.version;
        window.hubConfig.lastLoadedAt = Date.now();
        await window.apiBrowser.saveHubConfig(window.hubConfig);
        await window.registraBaseInviata(inviate, strutturaInviata);

        return true;
    } catch (e) {
        console.error("Errore ripristino versione Hub:", e);
        mostraMessaggio(e.message || window.t('hub_err_ripristino', "Errore durante il ripristino della versione."), "error");
        return false;
    }
};

window.sincronizzaConHub = async function() {
    mostraMessaggio(window.t("msg_sincronizzazione", "Sincronizzazione…"), "info");
    await window.riceviModificheHub(true);
    await window.inviaModificheHub();
};

let _avvisoNoGoogleMostrato = false;

let _hubAttachmentsPending = true;

let _ultimoErroreAllegatiHub: any = null;

window.sincronizzaAllegatiHub = async function(isSilent = true) {
    if (!window.hubConfig || !window.apiBrowser?.syncHubAttachments) return null;
    if (window.hubConfig.attachmentsMode === 'off') return null;
    if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
    try {
        const r = await window.apiBrowser.syncHubAttachments();
        if (!r || !r.ok) {
            if (!isSilent) mostraMessaggio(r?.error || window.t('hub_err_allegati', "Errore sincronizzazione allegati Hub."), "error");
            return r;
        }
        _hubAttachmentsPending = !!(r.unavailable || r.notPublished || (r.skippedUpload && r.hasLocalAttachments));

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

window.creaRepositoryHub = async function(name) {
    if (!window.apiBrowser?.hubCreateRepo) return false;
    if (typeof window.mostraProgressoCloud === 'function') {
        window.mostraProgressoCloud(window.t("prog_hub_prepare_title", "Preparazione dell'archivio condiviso"), window.t("msg_creazione_repository", "Creazione del repository in corso…"));
    }
    try {
        const finalName = (name && String(name).trim()) || await window.nomeVaultDefault();
        if (window.appData) {
            window.appData.nomeArchivio = finalName;
            await salvaTutto();
        }

        const r = await window.apiBrowser.hubCreateRepo(finalName, window.databasePerDisco(window.appData));
        if (!r || !r.ok) {
            if (typeof window.nascondiProgressoCloud === 'function') window.nascondiProgressoCloud();
            mostraMessaggio(r?.error || window.t("msg_errore_creazione_repo", "Errore creazione repository."), "error");
            return false;
        }
        window.hubConfig = r.config;
        if (window.aggiornaVisibilitaCloud) window.aggiornaVisibilitaCloud();
        window.sincronizzaAllegatiHub(false);

        mostraMessaggio(window.t("msg_repository_creato", 'Archivio condiviso pronto: ora puoi invitare i collaboratori.'), "success");
        try {
            if (window.apiSettings) {
                await window.apiSettings.patch({ hubJustCreated: true });
            }
        } catch {}
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

window.rinominaVaultHub = async function(newName) {
    const nome = (newName || '').trim();
    if (!window.hubConfig || !nome) return false;
    if (nome === window.hubConfig.name) return false;
    try {
        if (window.appData) { window.appData.nomeArchivio = nome; await salvaTutto(); }
        window.hubConfig.name = nome;
        await window.apiBrowser.saveHubConfig(window.hubConfig);
        if (window.inviaModificheHub) await window.inviaModificheHub();
        if (window.aggiornaListaVault) await window.aggiornaListaVault();
        mostraMessaggio(window.t("msg_vault_rinominato", "Nome dell'archivio aggiornato."), "success");
        return true;
    } catch (e) {
        mostraMessaggio(e.message || window.t('hub_err_rinomina', "Errore durante la rinomina."), "error");
        return false;
    }
};

window.getHubRole = async function() {
    if (!window.hubConfig) return 'unknown';
    if (window.hubConfig.role === 'owner' || window.hubConfig.role === 'member') return window.hubConfig.role;
    try {
        const role = await window.apiBrowser.hubRole();
        if (role === 'owner' || role === 'member') window.hubConfig.role = role;
        return role || 'unknown';
    } catch {
        return 'unknown';
    }
};

window.generaInvitoHub = async function(label) {
    if (!window.hubConfig) { mostraMessaggio(window.t("msg_questo_archivio_non_colle", "Questo archivio non è collegato ad un repository Hub."), "error"); return null; }
    const memberLabel = (label && String(label).trim()) || `${window.t("hub_invite_default_label", "Invito")} ${new Date().toLocaleDateString()}`;
    try {
        const res = await window.apiBrowser.hubInvite(memberLabel, (window.appData && window.appData.nomeArchivio) || '');
        if (res.status === 403) throw new Error(window.t('hub_err_solo_owner', "Solo il proprietario può generare inviti."));
        if (!res.ok) throw new Error(res.error || window.t('hub_err_invito_http', "Errore generazione invito (HTTP {var0}).").replace('{var0}', String(res.status)));
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

window.eseguiJoinHub = async function(invite, basePath) {
    if (!invite || !invite.code || !basePath) return false;
    try {
        const res = await window.apiBrowser.hubJoin(invite.code, basePath);
        if (!res.ok) throw new Error(res.error || "Impossibile connettersi al repository remoto.");
        return true;
    } catch (e) {
        mostraMessaggio(e.message || window.t('hub_err_join', "Errore durante il join del repository Hub."), "error");
        return false;
    }
};
