// Pannello Impostazioni. Il markup nasce da SCHEDE: una tab = una voce, una preferenza = una
// sezione dentro `sezioni`. Popolamento e salvataggio stanno in logic/settingsLogic.ts.
//
// Tab con la semantica ARIA del pattern "tabs" verticale: tablist, roving tabindex (solo la
// tab attiva è nel giro del Tab), frecce su/giù, Home/End.
(function() {
    const CHIAVE_ULTIMA_TAB = 'archiview.impostazioni.tab';

    const VALORE = { $: 'value' };
    const SPUNTA = { $: 'checked' };
    const CAMPO = 'form-input w-full p-2 bg-stone-50 border border-stone-200 rounded-sm text-stone-800';
    const opzione = (valore: string, chiave: string, testo: string) =>
        `<option value="${valore}" data-i18n="${chiave}">${testo}</option>`;

    /** Blocco standard: titolo (etichetta del controllo), descrizione, corpo. */
    function sezione(id: string, icona: string, titolo: [string, string], desc: [string, string] | null, corpo: string) {
        return `
            <section class="sezione-impostazioni" aria-labelledby="${id}-title">
                <h4 id="${id}-title" class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="${icona}" class="w-4 h-4 text-amber-700"></i> <span data-i18n="${titolo[0]}">${titolo[1]}</span></h4>
                ${desc ? `<p id="${id}-desc" class="text-sm text-stone-600 mb-3" data-i18n="${desc[0]}">${desc[1]}</p>` : ''}
                ${corpo}
            </section>`;
    }

    /** Campo numerico con messaggio d'errore collegato (aria-describedby/aria-invalid). */
    function numero(id: string, chiave: string, testo: string, min: number, max: number, azione: string) {
        return `
            <label class="text-xs text-stone-600 flex flex-col gap-1">
                <span data-i18n="${chiave}">${testo}</span>
                <input type="number" min="${min}" max="${max}" id="${id}" class="form-input" aria-describedby="${id}-errore" ${window.azione('change', azione)}>
                <span id="${id}-errore" class="campo-errore hidden" aria-live="polite"></span>
            </label>`;
    }

    const SCHEDE = [
        {
            id: 'tab-general', icona: 'sliders', titolo: ['settings_tab_general', 'Generali'],
            sezioni: [
                sezione('settings-username', 'user', ['settings_username_title', 'Nome Collaboratore / Utente'],
                    ['settings_username_desc', 'Imposta il tuo nome per identificare chi inserisce o modifica le schede ed i testi.'],
                    `<input type="text" id="settings-username" maxlength="200" aria-labelledby="settings-username-title" aria-describedby="settings-username-desc" ${window.azione('change', 'salvaNomeCollaboratore', VALORE)} data-i18n-placeholder="settings_username_placeholder" placeholder="Es. Antonio" class="${CAMPO} focus:outline-none focus:border-amber-500">`),
                sezione('settings-lang', 'globe', ['settings_lang', 'Lingua / Language'], ['settings_lang_desc', "Scegli la lingua dell'applicazione."],
                    `<select id="settings-language" aria-labelledby="settings-lang-title" aria-describedby="settings-lang-desc" ${window.azione('change', 'cambiaLingua', VALORE)} class="${CAMPO}">
                        <option value="it" lang="it">Italiano</option>
                        <option value="en" lang="en">English</option>
                    </select>`)
            ]
        },
        {
            id: 'tab-appearance', icona: 'palette', titolo: ['settings_tab_appearance', 'Aspetto'],
            sezioni: [
                sezione('settings-theme-sez', 'moon', ['settings_theme', 'Tema / Aspetto'], ['settings_theme_desc', "Scegli il tema dell'applicazione."],
                    `<select id="settings-theme" aria-labelledby="settings-theme-sez-title" aria-describedby="settings-theme-sez-desc" ${window.azione('change', 'cambiaTemaSelezionato', VALORE)} class="${CAMPO}">
                        ${opzione('system', 'settings_theme_system', 'Sistema (Predefinito)')}
                        <optgroup label="Temi Chiari" data-i18n-label="settings_theme_group_light">
                            ${opzione('light', 'settings_theme_light', 'Clear Blue')}
                            ${opzione('amber-light', 'settings_theme_amber_light', 'Vanilla Amber')}
                        </optgroup>
                        <optgroup label="Temi Scuri" data-i18n-label="settings_theme_group_dark">
                            ${opzione('dark', 'settings_theme_dark', 'Obsidian Orange')}
                            ${opzione('blue-dark', 'settings_theme_blue_dark', 'Midnight Blue')}
                        </optgroup>
                    </select>`),
                sezione('settings-zoom', 'zoom-in', ['settings_zoom_title', "Zoom dell'interfaccia"],
                    ['settings_zoom_desc', 'Ingrandisce o riduce tutto il programma. Anche con Ctrl + e Ctrl − (Ctrl 0 torna al 100%).'],
                    `<select id="settings-zoom-select" aria-labelledby="settings-zoom-title" aria-describedby="settings-zoom-desc" ${window.azione('change', 'cambiaZoomInterfaccia', VALORE)} class="${CAMPO}">
                        ${[80, 90, 100, 110, 120, 130, 140, 150].map(v => `<option value="${v}">${v}%</option>`).join('')}
                    </select>`),
                sezione('settings-font', 'type', ['settings_font_title', 'Testo della trascrizione'],
                    ['settings_font_desc', "Carattere e dimensione dell'editor di trascrizione. Junicode copre le abbreviazioni e i segni medievali (MUFI)."],
                    `<div class="grid grid-cols-2 gap-3">
                        <label class="text-xs text-stone-600 flex flex-col gap-1">
                            <span data-i18n="settings_font_family">Carattere</span>
                            <select id="settings-font-trascrizione" aria-describedby="settings-font-desc" ${window.azione('change', 'salvaTestoTrascrizione')} class="${CAMPO}">
                                ${opzione('serif', 'settings_font_serif', 'Con grazie (Georgia)')}
                                ${opzione('sans', 'settings_font_sans', 'Senza grazie')}
                                ${opzione('mono', 'settings_font_mono', 'Monospaziato')}
                                <option value="junicode">Junicode</option>
                            </select>
                        </label>
                        ${numero('settings-dim-trascrizione', 'settings_font_size', 'Dimensione (px)', 12, 32, 'salvaTestoTrascrizione')}
                    </div>
                    <p id="settings-font-anteprima" class="anteprima-trascrizione mt-3 p-3 border border-stone-200 rounded-sm text-stone-800" lang="la" translate="no">Incipit liber primus · ꝑ ꝓ ꝗ ę ⁊ ſ ꝯ</p>`)
            ]
        },
        {
            id: 'tab-documents', icona: 'file-text', titolo: ['settings_tab_documents', 'Documenti'],
            sezioni: [
                sezione('settings-ocr', 'languages', ['ocr_langs_title', 'Lingue del riconoscimento'],
                    ['settings_ocr_desc', 'Il riconoscimento del testo (OCR) funziona senza connessione, ma ogni lingua va installata una volta. I dati restano su questo computer e non vengono sincronizzati.'],
                    `<fieldset aria-describedby="settings-ocr-desc" class="mb-3">
                        <legend class="text-xs font-semibold text-stone-600 mb-1" data-i18n="settings_ocr_default">Lingue preselezionate</legend>
                        <ul id="settings-ocr-lingue" class="space-y-1" ${window.azione('change', 'salvaLingueOcrPredefinite')}></ul>
                    </fieldset>
                    <button type="button" ${window.azione('click', 'apriGestioneLingueOcr')} id="btn-settings-ocr-langs" class="btn btn-secondary">
                        <i data-lucide="download" class="w-4 h-4 text-stone-500"></i> <span data-i18n="ocr_manage_langs">Gestisci lingue…</span>
                    </button>`),
                sezione('settings-pdf', 'file-image', ['settings_pdf_title', 'PDF'],
                    ['settings_pdf_desc', 'Come si aprono le pagine dei PDF nella trascrizione. Una risoluzione più alta è più nitida allo zoom ma più lenta.'],
                    `<div class="grid grid-cols-2 gap-3">
                        <label class="text-xs text-stone-600 flex flex-col gap-1">
                            <span data-i18n="settings_pdf_resolution">Risoluzione massima</span>
                            <select id="settings-pdf-risoluzione" aria-describedby="settings-pdf-desc" ${window.azione('change', 'salvaPreferenzePdf')} class="${CAMPO}">
                                ${[1600, 2000, 2400, 2800, 3200].map(v => `<option value="${v}">${v} px</option>`).join('')}
                            </select>
                        </label>
                        <label class="text-xs text-stone-600 flex flex-col gap-1">
                            <span data-i18n="settings_pdf_zoom">Zoom iniziale</span>
                            <select id="settings-pdf-zoom" aria-describedby="settings-pdf-desc" ${window.azione('change', 'salvaPreferenzePdf')} class="${CAMPO}">
                                ${opzione('pagina', 'settings_pdf_zoom_page', 'Pagina intera')}
                                ${opzione('larghezza', 'settings_pdf_zoom_width', 'Larghezza')}
                            </select>
                        </label>
                    </div>`),
                sezione('settings-scanner', 'smartphone', ['settings_scanner_title', 'Scansioni dal telefono'],
                    ['settings_scanner_desc', 'Come entrano nelle schede le pagine che arrivano da ArchiScanner.'],
                    `<label class="flex items-center gap-2 text-sm mb-2">
                        <input type="checkbox" id="settings-scanner-pdf" aria-describedby="settings-scanner-desc" ${window.azione('change', 'salvaPreferenzeScanner')}>
                        <span data-i18n="settings_scanner_pdf">Unisci le pagine di ogni scansione in un solo PDF</span>
                    </label>
                    <label class="flex items-center gap-2 text-sm">
                        <input type="checkbox" id="settings-scanner-sempre" aria-describedby="settings-scanner-desc" ${window.azione('change', 'salvaPreferenzeScanner')}>
                        <span data-i18n="settings_scanner_always">All'apertura dell'archivio importa senza chiedere</span>
                    </label>`)
            ]
        },
        {
            id: 'tab-data', icona: 'database', titolo: ['settings_tab_data', 'Archivio Dati'],
            sezioni: [
                sezione('settings-workspace', 'folder-tree', ['settings_workspace', 'Cartella di Lavoro (Archivio)'],
                    ['settings_workspace_desc', 'Questa cartella contiene il tuo database e tutti gli allegati copiati.'],
                    `<div class="flex items-center gap-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm font-mono text-stone-700 break-all" id="settings-workspace-path">
                        <span data-i18n="label_loading">Loading…</span>
                    </div>
                    <button type="button" ${window.azione('click', 'cambiaCartellaLavoro')} class="btn btn-secondary mt-3">
                        <i data-lucide="folder-search" class="w-4 h-4 text-stone-500"></i> <span data-i18n="btn_change_folder">Cambia Cartella…</span></button>
                    <p class="text-xs text-amber-700 mt-2 font-medium flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> <span data-i18n="settings_workspace_restart">L'app verrà riavviata se cambi la cartella.</span></p>`),
                sezione('settings-attachments', 'image', ['settings_local_attachments_title', 'Cartella Allegati Locale (Opzionale)'],
                    ['settings_local_attachments_desc', 'Consente di salvare le immagini localmente sul PC, escludendole dal cloud condiviso per risparmiare spazio.'],
                    `<div class="flex items-center gap-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm font-mono text-stone-700 break-all" id="settings-attachments-path">
                        <span data-i18n="label_loading">Loading…</span>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button type="button" ${window.azione('click', 'cambiaCartellaAllegati')} class="btn btn-secondary">
                            <i data-lucide="folder-search" class="w-4 h-4 text-stone-500"></i> <span data-i18n="btn_select_folder">Seleziona Cartella…</span>
                        </button>
                        <button type="button" ${window.azione('click', 'ripristinaCartellaAllegatiPredefinita')} id="btn-restore-attachments" class="btn btn-danger-ghost flex items-center gap-1 hidden-tab">
                            <i data-lucide="rotate-ccw" class="w-4 h-4"></i> <span data-i18n="btn_restore_default">Ripristina di default</span>
                        </button>
                    </div>`),
                // Cestino e snapshot stanno fra i DATI: file che occupano spazio su questo
                // computer e non si sincronizzano, come la cartella allegati.
                sezione('settings-safety', 'shield-check', ['settings_safety_title', 'Cestino e snapshot'],
                    ['settings_safety_desc', "L'archivio viene fotografato periodicamente su questo computer, e le schede eliminate restano nel cestino prima di sparire. Nulla di tutto ciò viene sincronizzato."],
                    `<label class="flex items-center gap-2 text-sm mb-3">
                        <input type="checkbox" id="settings-snapshot-auto" ${window.azione('change', 'salvaImpostazioniSicurezza')}>
                        <span data-i18n="settings_snapshot_auto">Crea snapshot automatici mentre lavoro</span>
                    </label>
                    <div class="grid grid-cols-3 gap-3">
                        ${numero('settings-snapshot-recenti', 'settings_snapshot_recenti', 'Snapshot recenti', 0, 100, 'salvaImpostazioniSicurezza')}
                        ${numero('settings-snapshot-giorni', 'settings_snapshot_giorni', 'Giorni di cronologia', 0, 3650, 'salvaImpostazioniSicurezza')}
                        ${numero('settings-cestino-giorni', 'settings_cestino_giorni', 'Giorni nel cestino', 0, 3650, 'salvaImpostazioniSicurezza')}
                    </div>
                    <button type="button" ${window.azione('click', 'inSequenza', 'chiudiImpostazioni', 'apriCestino')} class="btn btn-secondary mt-3">
                        <i data-lucide="trash-2" class="w-4 h-4 text-stone-500"></i> <span data-i18n="trash_title">Cestino</span>
                    </button>`),
                // Ricerca tra archivi: preferenze di QUESTO computer. L'elenco lo riempie popolaArchiviRicerca.
                sezione('settings-cross', 'library', ['settings_cross_title', 'Ricerca tra archivi'],
                    ['settings_cross_desc', 'Gli archivi aperti almeno una volta su questo computer in cui cercare con "Cerca anche negli altri archivi". Vengono soltanto letti, mai modificati.'],
                    `<label class="flex items-center gap-2 text-sm mb-3">
                        <input type="checkbox" id="settings-cross-suggerimenti" ${window.azione('change', 'salvaSuggerimentiAltriArchivi')}>
                        <span data-i18n="settings_cross_hint_toggle">Avvisami quando scrivo un nome che compare in altri archivi</span>
                    </label>
                    <fieldset aria-describedby="settings-cross-desc">
                        <legend class="text-xs font-semibold text-stone-600 mb-1" data-i18n="settings_cross_list_title">Archivi in cui cercare</legend>
                        <ul id="settings-cross-archivi" class="space-y-1" ${window.azione('change', 'salvaArchiviRicerca')}></ul>
                    </fieldset>`),
                sezione('settings-backup', 'archive', ['settings_backup', 'Backup Dati'],
                    ['settings_backup_desc', "Crea un file compresso contenente l'intero archivio e tutti gli allegati."],
                    `<button type="button" ${window.azione('click', 'esportaBackupZip')} class="btn btn-backup w-full justify-center shadow-sm">
                        <i data-lucide="file-archive" class="w-4 h-4"></i> <span data-i18n="btn_export_zip">Esporta Backup in ZIP</span>
                    </button>`)
            ]
        },
        {
            id: 'tab-sync', icona: 'cloud', titolo: ['settings_tab_sync', 'Sincronizzazione'],
            sezioni: [`
                <div id="settings-hub-section" class="hidden">
                    <h4 class="font-semibold mb-1 flex items-center gap-2"><i data-lucide="cloud" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_hub_title">Stato Collegamento Hub</span></h4>
                    <p class="text-sm text-stone-600 mb-3" data-i18n="settings_hub_desc">Questo archivio locale è collegato ad un repository condiviso online.</p>
                    <div class="space-y-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-xs font-mono text-stone-700 break-all mb-4">
                        <div><b data-i18n="settings_hub_url">URL Server:</b> <span id="settings-hub-url" data-i18n="settings_not_defined">Non definito</span></div>
                        <div><b data-i18n="settings_hub_repoid">ID Repository:</b> <span id="settings-hub-repoid" data-i18n="settings_not_defined">Non definito</span></div>
                        <div><b data-i18n="settings_hub_key">Chiave di Scrittura:</b> <span id="settings-hub-key" data-i18n="settings_hub_key_masked">•••••••• (condividi tramite invito)</span></div>
                    </div>
                    <p class="text-xs text-stone-500 mb-3" data-i18n="settings_hub_manage_hint">Inviti, collaboratori, allegati e sincronizzazione automatica si gestiscono dal pannello Condivisione.</p>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" ${window.azione('click', 'inSequenza', 'chiudiImpostazioni', 'apriShareModal')} class="btn btn-primary text-sm"><i data-lucide="users-round" class="w-4 h-4 mr-1.5"></i> <span data-i18n="btn_open_share">Apri Condivisione</span></button>
                    </div>

                    <div class="border-t border-stone-200 mt-5 pt-5">
                        <h4 class="font-semibold mb-1 flex items-center gap-2 text-sm"><i data-lucide="cloud-lightning" class="w-4 h-4 text-amber-700"></i> <span data-i18n="settings_hub_drive_title">Google Drive personale (per gli allegati)</span></h4>
                        <p class="text-xs text-stone-500 mb-3" data-i18n="settings_hub_drive_desc">Collega il tuo account Google Drive per caricare i tuoi allegati (scansioni) e condividerli con gli altri collaboratori.</p>
                        <div class="space-y-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm text-stone-700">
                            <div><b data-i18n="settings_drive_status">Stato:</b> <span id="settings-hub-drive-status">...</span></div>
                            <div class="flex gap-2 mt-2">
                                <button type="button" id="btn-hub-drive-login" class="btn btn-primary" ${window.azione('click', 'loginGoogleDrive')} data-i18n="btn_drive_login">Accedi a Drive</button>
                                <button type="button" id="btn-hub-drive-logout" class="btn btn-danger hidden" ${window.azione('click', 'logoutGoogleDrive')} data-i18n="btn_drive_logout">Disconnetti</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="settings-drive-section" class="hidden space-y-4">
                    <h4 class="font-semibold flex items-center gap-2"><i data-lucide="cloud-lightning" class="w-4 h-4 text-amber-700"></i> <span id="settings-drive-title" data-i18n="settings_drive_title">Sincronizzazione Google Drive</span></h4>
                    <p class="text-sm text-stone-600" id="settings-drive-desc" data-i18n="settings_drive_desc">Questo archivio locale è configurato come Archivio Condiviso tramite Google Drive.</p>
                    <div class="space-y-2 p-2.5 bg-stone-100 border border-stone-200 rounded-sm text-sm text-stone-700">
                        <div><b data-i18n="settings_drive_status">Stato:</b> <span id="settings-drive-status">...</span></div>
                        <div class="flex gap-2 mt-2">
                            <button type="button" id="btn-drive-login" class="btn btn-primary" ${window.azione('click', 'loginGoogleDrive')} data-i18n="btn_drive_login">Accedi a Drive</button>
                            <button type="button" id="btn-drive-logout" class="btn btn-danger hidden" ${window.azione('click', 'logoutGoogleDrive')} data-i18n="btn_drive_logout">Disconnetti</button>
                            <button type="button" id="btn-drive-sync" class="btn btn-secondary hidden" ${window.azione('click', 'sincronizzaGoogleDrive')} data-i18n="btn_drive_sync">Sincronizza Ora</button>
                        </div>
                    </div>
                    <div class="p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-800">
                        <i data-lucide="info" class="w-4 h-4 inline-block mr-1"></i> <span data-i18n="settings_drive_hint">Per gestire la sincronizzazione, gli inviti o disconnetterti, utilizza il menu <b>Cloud</b> nella barra superiore dell'applicazione.</span>
                    </div>
                </div>

                <div id="settings-hub-disabled" class="text-sm text-stone-500 italic p-4 bg-stone-50 border border-stone-200 rounded-sm" data-i18n="settings_sync_none">
                    Nessuna sincronizzazione cloud (Hub o Google Drive) configurata per questa cartella di lavoro.
                </div>`]
        },
        {
            id: 'tab-system', icona: 'info', titolo: ['settings_tab_system', 'Sistema & Info'],
            sezioni: [
                sezione('settings-updates', 'refresh-cw', ['settings_updates', 'Aggiornamenti'],
                    ['settings_updates_desc', 'Controlla se è disponibile una nuova versione del programma su GitHub.'],
                    `<label class="flex items-center gap-2 text-sm mb-3">
                        <input type="checkbox" id="settings-aggiornamenti-auto" ${window.azione('change', 'cambiaAggiornamentiAutomatici', SPUNTA)}>
                        <span data-i18n="settings_updates_auto">Controlla da solo all'avvio e ogni 4 ore</span>
                    </label>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" ${window.azione('click', 'controllaAggiornamenti', true)} class="btn btn-secondary">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i> <span data-i18n="btn_check_updates">Controlla Aggiornamenti</span>
                        </button>
                        <button type="button" ${window.azione('click', 'inSequenza', 'chiudiImpostazioni', 'apriChangelogModal')} class="btn btn-ghost">
                            <i data-lucide="sparkles" class="w-4 h-4 text-amber-800"></i> <span data-i18n="btn_whats_new">Scopri novità</span>
                        </button>
                    </div>
                    <p class="text-xs text-stone-500 mt-3"><span data-i18n="settings_version">Versione installata:</span> <span id="settings-versione" translate="no">—</span></p>`),
                sezione('settings-perf', 'gauge', ['settings_perf_title', 'Prestazioni ridotte'],
                    ['settings_perf_desc', "Per computer poco potenti: disattiva animazioni e accelerazione hardware e mostra meno schede per pagina. L'accelerazione hardware cambia al riavvio."],
                    `<label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="settings-low-perf" aria-describedby="settings-perf-desc" ${window.azione('change', 'cambiaModalitaPrestazioni', SPUNTA)} class="w-4 h-4 accent-amber-600">
                        <span class="text-sm text-stone-700" data-i18n="settings_perf_toggle">Attiva modalità prestazioni ridotte</span>
                    </label>`),
                sezione('settings-support', 'help-circle', ['settings_support', 'Supporto'],
                    ['settings_support_desc', 'Hai riscontrato dei problemi o hai dei suggerimenti? Segnalalo su GitHub.'],
                    `<button type="button" ${window.azione('click', 'inSequenza', 'apriIssueModal', 'chiudiImpostazioni')} class="btn btn-secondary">
                        <i data-lucide="alert-circle" class="w-4 h-4"></i> <span data-i18n="btn_report_issue">Segnala problema</span></button>`)
            ]
        }
    ];

    window.SCHEDE_IMPOSTAZIONI = SCHEDE.map(s => ({ id: s.id, icona: s.icona, chiave: s.titolo[0], testo: s.titolo[1] }));

    function bottoneTab(s, i) {
        return `<button type="button" role="tab" id="${s.id}-btn" aria-controls="${s.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"
                    class="settings-tab-btn w-full text-left px-3 py-2 rounded-sm font-medium transition-colors" data-target="${s.id}" ${window.azione('click', 'cambiaTabImpostazioni', s.id)}>
                    <i data-lucide="${s.icona}" class="w-4 h-4 inline-block mr-2 text-stone-500"></i> <span data-i18n="${s.titolo[0]}">${s.titolo[1]}</span></button>`;
    }

    function pannello(s, i) {
        return `<div id="${s.id}" role="tabpanel" aria-labelledby="${s.id}-btn" tabindex="0" class="settings-tab-content space-y-8${i === 0 ? '' : ' hidden'}">
                    ${s.sezioni.join('')}
                </div>`;
    }

    window.cambiaTabImpostazioni = function(targetId: string, fuoco = false) {
        if (!document.getElementById(targetId)) targetId = SCHEDE[0].id;
        document.querySelectorAll('#settings-modal .settings-tab-content').forEach(el => {
            el.classList.toggle('hidden', el.id !== targetId);
        });
        document.querySelectorAll<HTMLElement>('#settings-modal .settings-tab-btn').forEach(btn => {
            const attiva = btn.dataset.target === targetId;
            btn.setAttribute('aria-selected', String(attiva));
            btn.tabIndex = attiva ? 0 : -1;
            if (attiva && fuoco) btn.focus();
        });
        try { localStorage.setItem(CHIAVE_ULTIMA_TAB, targetId); } catch (e) { /* solo comodità */ }
    };

    window.ultimaTabImpostazioni = function() {
        try { return localStorage.getItem(CHIAVE_ULTIMA_TAB) || SCHEDE[0].id; } catch (e) { return SCHEDE[0].id; }
    };

    // Frecce su/giù (e sinistra/destra a finestra stretta, dove la lista va in orizzontale),
    // Home/End: si sposta e si attiva insieme (attivazione automatica, pannelli già nel DOM).
    window.tastieraTabImpostazioni = function(e: KeyboardEvent) {
        const ids = SCHEDE.map(s => s.id);
        const corrente = (e.target as HTMLElement).closest<HTMLElement>('.settings-tab-btn');
        if (!corrente) return;
        const i = ids.indexOf(corrente.dataset.target);
        const mosse: Record<string, number> = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: ids.length - 1 };
        if (!(e.key in mosse)) return;
        e.preventDefault();
        window.cambiaTabImpostazioni(ids[(mosse[e.key] + ids.length) % ids.length], true);
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('settings-modal')) return;
        const html = `
    <div id="settings-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-3xl h-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <div class="modal-header shrink-0 p-4 px-6 border-b border-stone-200 flex justify-between items-center">
                <h3 class="modal-title text-stone-800 m-0 flex items-center gap-2"><i data-lucide="settings" class="w-5 h-5 text-stone-600"></i> <span data-i18n="modal_settings">Impostazioni</span></h3>
                <button type="button" ${window.azione('click', 'chiudiImpostazioni')} class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row bg-white">
                <div class="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 p-4 overflow-y-auto shrink-0">
                    <div role="tablist" aria-orientation="vertical" data-i18n-aria-label="modal_settings" aria-label="Impostazioni" class="space-y-1" ${window.azione('keydown', 'tastieraTabImpostazioni', { $: 'event' })}>
                        ${SCHEDE.map(bottoneTab).join('')}
                    </div>
                </div>
                <div class="w-full md:w-2/3 p-6 overflow-y-auto">
                    ${SCHEDE.map(pannello).join('')}
                </div>
            </div>
            <div class="modal-header shrink-0 p-4 px-6 justify-end border-t border-stone-200">
                <button type="button" ${window.azione('click', 'chiudiImpostazioni')} class="btn btn-primary" data-i18n="btn_close">Chiudi</button>
            </div>
        </div>
    </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
    });
})();
