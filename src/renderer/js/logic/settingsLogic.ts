// Pannello Impostazioni: popolamento (apriImpostazioni) e salvataggio di ogni preferenza.
// Il markup sta in components/modals/settingsModal.ts. Ogni salvataggio scrive SOLO la sua
// chiave con apiSettings.patch e passa da notificaSalvataggio per il riscontro.

// Predefiniti delle preferenze nuove: un solo posto nel renderer (il main valida i limiti).
const PREDEFINITI_IMPOSTAZIONI = Object.freeze({
    zoomInterfaccia: 100,
    fontTrascrizione: 'serif',
    dimensioneTrascrizione: 18,
    pdfRisoluzione: 3200,
    pdfZoomIniziale: 'pagina'
});
window.PREDEFINITI_IMPOSTAZIONI = PREDEFINITI_IMPOSTAZIONI;

const _FAMIGLIE_TRASCRIZIONE = {
    serif: "Georgia, 'Segoe UI Historic', serif",
    sans: "'Segoe UI', 'Segoe UI Historic', system-ui, sans-serif",
    mono: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
    junicode: "'Junicode', 'Segoe UI Historic', Georgia, serif"
};

/**
 * Esito unico di ogni salvataggio: toast breve (il contenitore dei toast è già aria-live).
 * `esito` è la risposta di apiSettings.patch, o un errore.
 */
window.notificaSalvataggio = function(esito?: any) {
    if (esito instanceof Error || (esito && esito.ok === false)) {
        const dettaglio = esito instanceof Error ? esito.message : (esito.rifiutate || []).join(', ');
        mostraMessaggio(window.t('msg_cross_save_failed', 'Preferenza non salvata: {var0}').replace('{var0}', dettaglio), 'error');
        return false;
    }
    mostraMessaggio(window.t('msg_cross_saved', 'Preferenza salvata.'), 'success');
    return true;
};

/** patch + riscontro; mai lancia. true se salvata. */
async function _salvaPreferenze(parziale: any) {
    if (!window.apiSettings) return false;
    try {
        return window.notificaSalvataggio(await window.apiSettings.patch(parziale));
    } catch (e) {
        console.error('Salvataggio preferenze non riuscito:', parziale, e);
        return window.notificaSalvataggio(e instanceof Error ? e : new Error(String(e)));
    }
}

/** Applica le preferenze di aspetto e documenti (all'avvio e a ogni cambio). */
window.applicaPreferenzeTesto = function(s: any) {
    const P = PREDEFINITI_IMPOSTAZIONI;
    const radice = document.documentElement.style;
    radice.setProperty('--font-trascrizione', _FAMIGLIE_TRASCRIZIONE[s.fontTrascrizione] || _FAMIGLIE_TRASCRIZIONE[P.fontTrascrizione]);
    radice.setProperty('--dim-trascrizione', (s.dimensioneTrascrizione || P.dimensioneTrascrizione) + 'px');
    window.pdfRisoluzioneMassima = s.pdfRisoluzione || P.pdfRisoluzione;
    window.pdfZoomIniziale = s.pdfZoomIniziale || P.pdfZoomIniziale;
};

window.initPreferenzeTesto = async function() {
    try {
        window.applicaPreferenzeTesto(window.apiSettings ? await window.apiSettings.get() : {});
    } catch (e) {
        console.error('Preferenze di testo non lette, restano i predefiniti:', e);
        window.applicaPreferenzeTesto({});
    }
};

function _campo<T extends HTMLElement = HTMLInputElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

window.apriImpostazioni = async function(tab?: string) {
    const modale = document.getElementById('settings-modal');
    modale.classList.remove('hidden-tab');
    window.cambiaTabImpostazioni(typeof tab === 'string' ? tab : window.ultimaTabImpostazioni());
    if (!window.apiBrowser || !window.apiBrowser.getWorkspacePath || !window.apiSettings) return;

    const p = await window.apiBrowser.getWorkspacePath();
    _campo('settings-workspace-path').textContent = p || window.t('no_workspace_set');

    const settings = await window.apiSettings.get();
    const vaultConfig = window.apiBrowser.getVaultConfig ? await window.apiBrowser.getVaultConfig() : { vaultType: 'local' };
    const P = PREDEFINITI_IMPOSTAZIONI;

    const username = _campo('settings-username');
    if (username) username.value = settings.username || '';

    // Aspetto
    const zoom = _campo<HTMLSelectElement>('settings-zoom-select');
    if (zoom) zoom.value = String(settings.zoomInterfaccia || P.zoomInterfaccia);
    const font = _campo<HTMLSelectElement>('settings-font-trascrizione');
    if (font) font.value = settings.fontTrascrizione || P.fontTrascrizione;
    const dim = _campo('settings-dim-trascrizione');
    if (dim) { dim.value = String(settings.dimensioneTrascrizione || P.dimensioneTrascrizione); _validoCampo(dim); }

    // Documenti
    const pdfRis = _campo<HTMLSelectElement>('settings-pdf-risoluzione');
    if (pdfRis) pdfRis.value = String(settings.pdfRisoluzione || P.pdfRisoluzione);
    const pdfZoom = _campo<HTMLSelectElement>('settings-pdf-zoom');
    if (pdfZoom) pdfZoom.value = settings.pdfZoomIniziale || P.pdfZoomIniziale;
    window.popolaLingueOcrPredefinite(settings.ocrLingue);
    const scanPdf = _campo('settings-scanner-pdf');
    if (scanPdf) scanPdf.checked = settings.scannerPdf === true;
    const scanSempre = _campo('settings-scanner-sempre');
    if (scanSempre) scanSempre.checked = settings.scannerImportaSempre === true;

    // Ricerca tra archivi: interruttore del suggerimento ed elenco degli archivi.
    const sugg = _campo('settings-cross-suggerimenti');
    if (sugg) sugg.checked = settings.suggerimentiAltriArchivi !== false;
    if (window.popolaArchiviRicerca) window.popolaArchiviRicerca();

    // Sistema
    const perfToggle = _campo('settings-low-perf');
    if (perfToggle) perfToggle.checked = !!window.modalitaPrestazioniRidotte;
    const aggAuto = _campo('settings-aggiornamenti-auto');
    if (aggAuto) aggAuto.checked = settings.aggiornamentiAutomatici !== false;
    const versione = _campo('settings-versione');
    if (versione && window.apiBrowser.getVersion) versione.textContent = await window.apiBrowser.getVersion();

    // Conservazione di snapshot e cestino. I predefiniti vengono dal modello condiviso e non
    // da letterali qui: il main applica quelli stessi quando la chiave manca.
    const M = window.Model || {};
    const auto = _campo('settings-snapshot-auto');
    if (auto) auto.checked = settings.snapshotAutomatici !== false;
    for (const [id, valore] of [
        ['settings-snapshot-recenti', settings.snapshotRecenti ?? M.SNAPSHOT_RECENTI ?? 10],
        ['settings-snapshot-giorni', settings.snapshotGiorni ?? M.SNAPSHOT_GIORNI ?? 30],
        ['settings-cestino-giorni', settings.cestinoGiorni ?? M.CESTINO_GIORNI ?? 30]
    ]) {
        const el = _campo(id as string);
        if (el) { el.value = String(valore); _validoCampo(el); }
    }

    await _mostraCartellaAllegati(settings);

    // Sezione Hub & Drive
    const hubSection = _campo('settings-hub-section');
    const driveSection = _campo('settings-drive-section');
    const disabledText = _campo('settings-hub-disabled');
    let isAnySyncActive = false;

    if (hubSection) {
        if (window.hubConfig) {
            _campo('settings-hub-url').textContent = window.hubConfig.hubUrl;
            _campo('settings-hub-repoid').textContent = window.hubConfig.repoId;
            // Google Drive personale per gli allegati: indipendente dal Drive del vault
            // condiviso (che per un vault Hub non esiste).
            if (typeof window.aggiornaStatoDriveHub === 'function') window.aggiornaStatoDriveHub();
            hubSection.classList.remove('hidden');
            isAnySyncActive = true;
        } else {
            hubSection.classList.add('hidden');
        }
    }

    if (driveSection) {
        // Un vault Hub ha vaultType='shared' ma NON è Drive: la sezione Drive non va mostrata.
        const isHubVault = !!window.hubConfig || vaultConfig.provider === 'hub';
        if (vaultConfig.vaultType !== 'local' && !isHubVault) {
            driveSection.classList.remove('hidden');
            isAnySyncActive = true;
            const driveTitle = _campo('settings-drive-title');
            const driveDesc = _campo('settings-drive-desc');
            if (vaultConfig.vaultType === 'backup') {
                if (driveTitle) driveTitle.textContent = window.t("settings_personal_backup_title", "Personal Cloud Backup");
                if (driveDesc) driveDesc.textContent = window.t("settings_personal_backup_desc", "This local archive is synced privately as a backup on your Google Drive.");
            } else {
                if (driveTitle) driveTitle.textContent = window.t("settings_drive_title");
                if (driveDesc) driveDesc.textContent = window.t("settings_drive_desc");
            }
        } else {
            driveSection.classList.add('hidden');
        }
    }

    if (disabledText) disabledText.classList.toggle('hidden', isAnySyncActive);
}

/** Percorso allegati come lo usa il main: nessun percorso composto nel renderer. */
async function _mostraCartellaAllegati(settings?: any) {
    const div = _campo('settings-attachments-path');
    const btnRestore = _campo('btn-restore-attachments');
    if (!div) return;
    if (!settings) settings = await window.apiSettings.get();
    let percorso = null;
    try {
        percorso = window.apiSettings.percorsoAllegati ? await window.apiSettings.percorsoAllegati() : null;
    } catch (e) {
        console.error('Percorso degli allegati non disponibile:', e);
    }
    div.textContent = percorso || window.t('settings_not_defined_f', 'Non definita');
    if (btnRestore) btnRestore.classList.toggle('hidden-tab', !settings.customAttachmentsPath);
}

// --- Campi numerici --------------------------------------------------------------------------
// Un numero non valido NON si salva e non si scarta in silenzio: il campo resta segnato
// (aria-invalid + messaggio sotto) e torna all'ultimo valore valido. Salvare `NaN` per il
// cestino vorrebbe dire un cestino che non conserva nulla.

function _validoCampo(el: HTMLInputElement) {
    el.dataset.ultimoValido = el.value;
    el.removeAttribute('aria-invalid');
    const errore = document.getElementById(el.id + '-errore');
    if (errore) { errore.textContent = ''; errore.classList.add('hidden'); }
}

/** Intero in [min, max] o null; il campo vuoto vale `vuoto` (undefined = non ammesso). */
function _leggiIntero(el: HTMLInputElement, vuoto?: null): number | null | undefined {
    if (el.value.trim() === '') {
        if (vuoto === null) { _validoCampo(el); return null; }
    } else {
        const n = Number(el.value);
        if (Number.isInteger(n) && n >= Number(el.min) && n <= Number(el.max)) { _validoCampo(el); return n; }
    }
    el.setAttribute('aria-invalid', 'true');
    const errore = document.getElementById(el.id + '-errore');
    if (errore) {
        errore.textContent = window.t('settings_invalid_number', 'Valore non valido: serve un numero intero da {var0} a {var1}. Ripristinato il precedente.')
            .replace('{var0}', el.min).replace('{var1}', el.max);
        errore.classList.remove('hidden');
    }
    el.value = el.dataset.ultimoValido ?? '';
    return undefined;
}

window.salvaImpostazioniSicurezza = async function() {
    const parziale: any = {};
    const auto = _campo('settings-snapshot-auto');
    if (auto) parziale.snapshotAutomatici = !!auto.checked;
    for (const [id, chiave] of [['settings-snapshot-recenti', 'snapshotRecenti'], ['settings-snapshot-giorni', 'snapshotGiorni'], ['settings-cestino-giorni', 'cestinoGiorni']]) {
        const el = _campo(id);
        if (!el) continue;
        // Vuoto = null: il main toglie la chiave e torna al predefinito del modello.
        const v = _leggiIntero(el, null);
        if (v !== undefined) parziale[chiave] = v;
    }
    await _salvaPreferenze(parziale);
};

// --- Generali --------------------------------------------------------------------------------

window.salvaNomeCollaboratore = async function(valore: string) {
    await _salvaPreferenze({ username: String(valore || '').trim() });
};

// --- Aspetto ---------------------------------------------------------------------------------

// Lo zoom lo applica il main (webContents.setZoomFactor) quando la chiave cambia.
window.cambiaZoomInterfaccia = async function(valore: string) {
    await _salvaPreferenze({ zoomInterfaccia: parseInt(valore, 10) });
};

window.salvaTestoTrascrizione = async function() {
    const parziale: any = {};
    const font = _campo<HTMLSelectElement>('settings-font-trascrizione');
    if (font) parziale.fontTrascrizione = font.value;
    const dim = _campo('settings-dim-trascrizione');
    if (dim) {
        const v = _leggiIntero(dim);
        if (v !== undefined) parziale.dimensioneTrascrizione = v;
    }
    if (await _salvaPreferenze(parziale)) window.applicaPreferenzeTesto(await window.apiSettings.get());
};

// --- Documenti -------------------------------------------------------------------------------

/** Caselle delle lingue OCR installate; spuntate quelle preselezionate. */
window.popolaLingueOcrPredefinite = async function(preferite?: string[]) {
    const lista = _campo('settings-ocr-lingue');
    if (!lista) return;
    let lingue = [];
    try {
        const r = window.apiOcr && window.apiOcr.lingue ? await window.apiOcr.lingue() : null;
        lingue = ((r && r.lingue) || []).filter(l => l.installata && l.codice !== 'osd');
    } catch (e) {
        console.error('Elenco delle lingue OCR non disponibile:', e);
    }
    const scelte = new Set(Array.isArray(preferite) ? preferite : []);
    lista.replaceChildren();
    if (lingue.length === 0) {
        const vuoto = document.createElement('li');
        vuoto.className = 'text-xs text-stone-500 italic';
        vuoto.textContent = window.t('settings_ocr_none', 'Nessuna lingua installata.');
        lista.appendChild(vuoto);
        return;
    }
    for (const l of lingue) {
        const li = document.createElement('li');
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 text-sm';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = scelte.has(l.codice);
        box.dataset.lingua = l.codice;
        label.appendChild(box);
        const nome = document.createElement('span');
        nome.textContent = window.t('ocr_lang_name_' + l.codice, l.nome);
        label.appendChild(nome);
        li.appendChild(label);
        lista.appendChild(li);
    }
};

window.salvaLingueOcrPredefinite = async function() {
    const lista = _campo('settings-ocr-lingue');
    if (!lista) return;
    const scelte = Array.from(lista.querySelectorAll<HTMLInputElement>('input[data-lingua]'))
        .filter(c => c.checked).map(c => c.dataset.lingua);
    await _salvaPreferenze({ ocrLingue: scelte });
};

window.salvaPreferenzePdf = async function() {
    const ris = _campo<HTMLSelectElement>('settings-pdf-risoluzione');
    const zoom = _campo<HTMLSelectElement>('settings-pdf-zoom');
    const parziale: any = {};
    if (ris) parziale.pdfRisoluzione = parseInt(ris.value, 10);
    if (zoom) parziale.pdfZoomIniziale = zoom.value;
    if (await _salvaPreferenze(parziale)) window.applicaPreferenzeTesto(await window.apiSettings.get());
};

window.salvaPreferenzeScanner = async function() {
    const pdf = _campo('settings-scanner-pdf');
    const sempre = _campo('settings-scanner-sempre');
    await _salvaPreferenze({ scannerPdf: !!(pdf && pdf.checked), scannerImportaSempre: !!(sempre && sempre.checked) });
};

// --- Sistema ---------------------------------------------------------------------------------

window.cambiaAggiornamentiAutomatici = async function(attivo: boolean) {
    await _salvaPreferenze({ aggiornamentiAutomatici: !!attivo });
};

/** Il main avvisa quando cambia una preferenza fuori dal pannello (zoom da tastiera). */
if (window.apiSettings && window.apiSettings.onCambiate) {
    window.apiSettings.onCambiate((chiavi: string[]) => {
        if (!Array.isArray(chiavi) || !chiavi.includes('zoomInterfaccia')) return;
        window.apiSettings.get().then((s) => {
            const zoom = _campo<HTMLSelectElement>('settings-zoom-select');
            if (zoom) zoom.value = String(s.zoomInterfaccia || PREDEFINITI_IMPOSTAZIONI.zoomInterfaccia);
        }).catch((e) => console.error('Zoom non riletto:', e));
    });
}

// --- Ricerca tra archivi ---------------------------------------------------------------------
//
// Due chiavi in settings.json, entrambe di QUESTO computer:
//   crossArchiveEsclusi       — id degli archivi da non interrogare (assente o [] = nessuno)
//   suggerimentiAltriArchivi  — false spegne l'avviso nel form (assente o true = attivo)

window.popolaArchiviRicerca = async function() {
    const lista = document.getElementById('settings-cross-archivi');
    if (!lista || !window.apiBrowser || !window.apiBrowser.crossArchiveArchivi) return;
    let archivi = [];
    try {
        const r = await window.apiBrowser.crossArchiveArchivi();
        if (r && r.ok) archivi = r.archivi;
    } catch (e) {
        console.error('Elenco degli archivi recenti non disponibile:', e);
    }
    lista.innerHTML = '';
    if (archivi.length === 0) {
        const vuoto = document.createElement('li');
        vuoto.className = 'text-xs text-stone-500 italic';
        vuoto.textContent = window.t('settings_cross_none', 'Nessun altro archivio aperto su questo computer.');
        lista.appendChild(vuoto);
        return;
    }
    for (const a of archivi) {
        const li = document.createElement('li');
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 text-sm';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = !a.escluso;
        box.dataset.archivio = a.id;
        // Nessun handler qui: il change sale fino a #settings-cross-archivi, che ha l'azione
        // dichiarativa (data-on-change) nel markup statico.
        label.appendChild(box);
        const nome = document.createElement('span');
        nome.textContent = a.nome;   // dato: textContent
        nome.translate = false;
        label.appendChild(nome);
        if (a.tipo === 'shared') {
            const badge = document.createElement('span');
            badge.className = 'card-badge mb-0';
            badge.textContent = window.t('cross_shared', 'condiviso');
            label.appendChild(badge);
        }
        if (a.raggiungibile === false) {
            const nota = document.createElement('span');
            nota.className = 'text-xs text-stone-500 italic';
            nota.textContent = window.t('settings_cross_unreachable', 'cartella non trovata');
            label.appendChild(nota);
        }
        li.appendChild(label);
        lista.appendChild(li);
    }
};

window.salvaArchiviRicerca = async function() {
    if (!window.apiSettings) return;
    try {
        const lista = document.getElementById('settings-cross-archivi');
        const caselle = lista ? Array.from(lista.querySelectorAll('input[type="checkbox"][data-archivio]')) as HTMLInputElement[] : [];
        const mostrati = new Set(caselle.map(c => c.dataset.archivio));
        const settings = await window.apiSettings.get();
        // Le esclusioni di archivi che ora non compaiono (usciti dai recenti) restano: se
        // l'archivio torna, torna escluso come l'aveva lasciato l'utente.
        const prima = Array.isArray(settings.crossArchiveEsclusi) ? settings.crossArchiveEsclusi.map(String) : [];
        const esclusi = prima.filter(id => !mostrati.has(id))
            .concat(caselle.filter(c => !c.checked).map(c => c.dataset.archivio));
        if (await _salvaPreferenze({ crossArchiveEsclusi: esclusi }) && typeof window.invalidaCacheAltriArchivi === 'function') {
            window.invalidaCacheAltriArchivi();
        }
    } catch (e) {
        console.error('Salvataggio degli archivi in cui cercare non riuscito:', e);
        window.notificaSalvataggio(e instanceof Error ? e : new Error(String(e)));
    }
};

window.salvaSuggerimentiAltriArchivi = async function() {
    const box = _campo('settings-cross-suggerimenti');
    if (await _salvaPreferenze({ suggerimentiAltriArchivi: !(box && !box.checked) }) && typeof window.invalidaCacheAltriArchivi === 'function') {
        window.invalidaCacheAltriArchivi();
    }
};

// --- Archivio dati ---------------------------------------------------------------------------

window.cambiaCartellaAllegati = async function() {
    if (!window.apiSettings || !window.apiSettings.scegliCartellaAllegati) return;
    try {
        // Dialogo e salvataggio nel main: il renderer non scrive percorsi nelle impostazioni.
        const scelta = await window.apiSettings.scegliCartellaAllegati(window.t("dialog_select_folder", "Seleziona la posizione per la nuova cartella"));
        if (!scelta) return;
        await _mostraCartellaAllegati();
        mostraMessaggio(window.t("msg_directory_allegati_locale", 'Cartella locale degli allegati impostata.'), "success");
    } catch (e) {
        console.error('Scelta della cartella allegati non riuscita:', e);
        window.notificaSalvataggio(e instanceof Error ? e : new Error(String(e)));
    }
};

window.ripristinaCartellaAllegatiPredefinita = async function() {
    if (!window.apiSettings) return;
    try {
        if (!await window.apiSettings.ripristinaCartellaAllegati()) throw new Error(window.t('settings_not_defined_f', 'Non definita'));
        await _mostraCartellaAllegati();
        mostraMessaggio(window.t("msg_la_directory_degli_allega", "La directory degli allegati è stata ripristinata al percorso di default (interna all'archivio)."), "success");
    } catch (e) {
        console.error('Ripristino della cartella allegati non riuscito:', e);
        window.notificaSalvataggio(e instanceof Error ? e : new Error(String(e)));
    }
};

window.esportaBackupZip = async function() {
    if (window.apiBrowser && window.apiBrowser.exportWorkspaceZip) {
        mostraMessaggio(window.t("msg_backup_init"), "info");
        
        const progDiv = document.createElement('div');
        progDiv.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-4 rounded-sm shadow-2xl z-toast min-w-[300px] border border-stone-700 text-center flex flex-col gap-2';
        progDiv.setAttribute('role', 'status');
        progDiv.innerHTML = window.sanitizeHTML(`
            <div class="font-bold text-sm">${window.escapeHTML(window.t('export_in_progress', 'Esportazione in corso…'))}</div>
            <div class="w-full bg-stone-700 h-2 rounded-full overflow-hidden">
                <div id="export-progress-bar" class="barra-avanzamento h-full w-0 transizione-larghezza"></div>
            </div>
            <div id="export-progress-text" class="text-xs text-stone-300">${window.escapeHTML(window.t('export_calculating', 'Calcolo…'))}</div>
        `);
        document.body.appendChild(progDiv);

        if (!window._exportProgressListener && window.apiBrowser.onExportProgress) {
            window.apiBrowser.onExportProgress((progress) => {
                const bar = document.getElementById('export-progress-bar');
                const text = document.getElementById('export-progress-text');
                if (bar && text && progress.entries) {
                    const proc = progress.entries.processed;
                    const total = progress.entries.total;
                    const perc = total > 0 ? Math.round((proc / total) * 100) : 0;
                    bar.style.width = perc + '%';
                    text.textContent = window.t('export_progress_files', '{var0} di {var1} file elaborati ({var2}%)')
                        .replace('{var0}', String(proc)).replace('{var1}', String(total)).replace('{var2}', String(perc));
                }
            });
            window._exportProgressListener = true;
        }

        try {
            const result = await window.apiBrowser.invoke('export-workspace-zip', window.t('btn_export_zip'));
            progDiv.remove();

            if (result.success) {
                mostraMessaggio(window.t("msg_backup_success"), "success");
            } else if (!result.canceled) {
                mostraMessaggio(window.t("msg_backup_error") + result.error, "error");
            }
        } catch (e) {
            progDiv.remove();
            mostraMessaggio(window.t("msg_backup_error") + e.message, "error");
        }
    }
}

window.chiudiImpostazioni = function() {
    document.getElementById('settings-modal').classList.add('hidden-tab');
}

window.cambiaCartellaLavoro = async function() {
    if (typeof mostraWelcomeModal === 'function') {
        window.chiudiImpostazioni();
        await mostraWelcomeModal();
    } else if (window.apiBrowser && window.apiBrowser.changeWorkspace) {
        await window.apiBrowser.changeWorkspace(window.t('modal_new_folder'));
    }
}

// Macchina a stati esplicita per il banner aggiornamenti: idle -> available -> downloading -> downloaded -> installing,
// con 'error' raggiungibile da qualunque stato attivo. Un solo punto di rendering (renderUpdateBanner) evita che gli
// handler asincroni (progress/downloaded/error) lascino il bottone in uno stato incoerente tra loro.
window._updateState = window._updateState || { status: 'idle' };

function mapErrorCodeToMessage(errorCode, rawError) {
    switch (errorCode) {
        case 'offline': return window.t("msg_update_offline");
        case 'release-incomplete': return window.t("msg_update_release_incomplete");
        case 'no-release': return window.t("msg_update_no_release");
        case 'rate-limited': return window.t("msg_update_rate_limited");
        default: return window.t("msg_update_generic") + (rawError || '');
    }
}

function renderUpdateBanner() {
    const banner = document.getElementById('update-banner');
    const text = document.getElementById('update-banner-text');
    const btn = document.getElementById('btn-scarica-aggiornamento') as HTMLButtonElement;
    const notesBtn = document.getElementById('btn-note-rilascio');
    if (!banner || !text || !btn) return;

    const s = window._updateState;
    btn.classList.remove('bg-green-600', 'hover:bg-green-700', 'text-white', 'border-transparent');
    btn.disabled = false;
    banner.classList.remove('bg-sky-600', 'border-sky-700', 'bg-red-600', 'border-red-700');

    if (notesBtn) {
        notesBtn.classList.toggle('hidden-tab', !s.releaseNotes);
    }

    switch (s.status) {
        case 'available':
            banner.classList.add('bg-sky-600', 'border-sky-700');
            text.textContent = `${window.t("msg_new_version_avail")} ${s.latestVersion} (${window.t("msg_current_version")} ${s.currentVersion})`;
            btn.textContent = window.t("btn_download_update");
            btn.onclick = avviaDownloadAggiornamento;
            banner.classList.remove('hidden-tab');
            break;
        case 'downloading':
            banner.classList.add('bg-sky-600', 'border-sky-700');
            btn.disabled = true;
            btn.textContent = s.percent != null ? `${window.t("msg_downloading")} ${s.percent}%` : window.t("btn_download_starting");
            banner.classList.remove('hidden-tab');
            break;
        case 'downloaded':
            banner.classList.add('bg-sky-600', 'border-sky-700');
            btn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white', 'border-transparent');
            btn.textContent = window.t("btn_restart_install");
            btn.onclick = avviaInstallazioneAggiornamento;
            banner.classList.remove('hidden-tab');
            break;
        case 'installing':
            banner.classList.add('bg-sky-600', 'border-sky-700');
            btn.disabled = true;
            btn.textContent = window.t("btn_installing");
            banner.classList.remove('hidden-tab');
            break;
        case 'error':
            banner.classList.add('bg-red-600', 'border-red-700');
            text.textContent = mapErrorCodeToMessage(s.errorCode, s.errorMessage);
            // Se è fallito il CONTROLLO non c'è nulla da scaricare: "Scarica" rifaceva il controllo
            // di nascosto e, se nel frattempo la release era completa, scaricava davvero — il
            // messaggio d'errore e il download riuscito sembravano contraddirsi.
            if (s.fase === 'check') {
                btn.textContent = window.t("btn_update_retry");
                btn.onclick = () => window.controllaAggiornamenti(true);
            } else {
                btn.textContent = window.t("btn_download_update");
                btn.onclick = avviaDownloadAggiornamento;
            }
            banner.classList.remove('hidden-tab');
            break;
        default: // idle
            banner.classList.add('hidden-tab');
    }
}

async function avviaDownloadAggiornamento() {
    window._updateState = { ...window._updateState, status: 'downloading', percent: null };
    renderUpdateBanner();
    const res = await window.apiBrowser.downloadUpdate();
    if (res && !res.success) {
        window._updateState = { ...window._updateState, status: 'error', errorCode: res.errorCode, errorMessage: res.error };
        renderUpdateBanner();
    }
}

function avviaInstallazioneAggiornamento() {
    window._updateState = { ...window._updateState, status: 'installing' };
    renderUpdateBanner();
    window.apiBrowser.installUpdate();
}

function setupUpdateEventListeners() {
    if (window._updateListenersSetup || !window.apiBrowser || !window.apiBrowser.onUpdateProgress) return;

    window.apiBrowser.onUpdateProgress((progressObj) => {
        if (window._updateState.status !== 'downloading') return; // Evita di sovrascrivere uno stato più recente
        window._updateState = { ...window._updateState, percent: Math.round(progressObj.percent) };
        renderUpdateBanner();
    });

    window.apiBrowser.onUpdateDownloaded(() => {
        window._updateState = { ...window._updateState, status: 'downloaded' };
        renderUpdateBanner();
    });

    if (window.apiBrowser.onUpdateError) {
        window.apiBrowser.onUpdateError((payload) => {
            // Errore asincrono (rete caduta a metà download, checksum non valido, ecc.).
            // electron-updater emette 'error' ANCHE quando fallisce il controllo, che però arriva
            // già come risultato di checkForUpdates: qui conta solo durante download/installazione,
            // altrimenti un controllo automatico fallito diventava un banner rosso con "Scarica".
            const s = window._updateState.status;
            if (s !== 'downloading' && s !== 'installing') return;
            window._updateState = { ...window._updateState, status: 'error', fase: 'download', errorCode: payload && payload.errorCode, errorMessage: payload && payload.error };
            renderUpdateBanner();
        });
    }

    window._updateListenersSetup = true;
}

window.controllaAggiornamenti = async function(mostraAvvisi = true) {
    if (!window.apiBrowser || !window.apiBrowser.checkForUpdates) return;

    setupUpdateEventListeners();

    // Un download/installazione in corso non deve essere interrotto da un ri-check silenzioso periodico
    if (window._updateState.status === 'downloading' || window._updateState.status === 'installing') return;

    if (mostraAvvisi) mostraMessaggio(window.t("msg_check_updates"), "info");

    const result = await window.apiBrowser.checkForUpdates();

    if (result.devMode) {
        return; // Build non pacchettizzata: nessun canale di update disponibile
    } else if (result.error) {
        // Nel controllo automatico gli errori passeggeri (niente rete, release in pubblicazione,
        // nessuna release) non meritano un banner rosso: il prossimo controllo li risolve da sé.
        const passeggero = ['offline', 'release-incomplete', 'no-release'].includes(result.errorCode);
        if (!mostraAvvisi && passeggero) {
            window._updateState = { status: 'idle' };
            renderUpdateBanner();
            return;
        }
        window._updateState = { status: 'error', fase: 'check', errorCode: result.errorCode, errorMessage: result.error };
        renderUpdateBanner();
        if (mostraAvvisi) mostraMessaggio(mapErrorCodeToMessage(result.errorCode, result.error), result.errorCode === 'release-incomplete' ? "info" : "error");
    } else if (result.updateAvailable) {
        window._updateState = {
            status: 'available',
            latestVersion: result.latestVersion,
            currentVersion: result.currentVersion,
            releaseNotes: result.releaseNotes || null
        };
        renderUpdateBanner();
    } else {
        window._updateState = { status: 'idle' };
        renderUpdateBanner();
        if (mostraAvvisi) mostraMessaggio(`${window.t("msg_up_to_date")} (${result.currentVersion}).`, "success");
    }
}

window.nascondiBannerAggiornamento = function() {
    document.getElementById('update-banner').classList.add('hidden-tab');
}

window.mostraNoteRilascio = function() {
    const notes = window._updateState && window._updateState.releaseNotes;
    const modal = document.getElementById('release-notes-modal');
    const body = document.getElementById('release-notes-body');
    if (!modal || !body) return;
    // releaseNotes arriva dal body della GitHub Release (contenuto remoto non fidato): sanitizzato prima dell'inserimento nel DOM.
    body.innerHTML = notes ? window.sanitizeHTML(notes) : window.escapeHTML(window.t("msg_no_release_notes"));
    modal.classList.remove('hidden-tab');
    if (window.lucide) lucide.createIcons({ nodes: [modal] });
}

window.chiudiNoteRilascio = function() {
    const modal = document.getElementById('release-notes-modal');
    if (modal) modal.classList.add('hidden-tab');
}


