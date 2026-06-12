// @ts-nocheck
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.modalsHtml) {
            document.body.insertAdjacentHTML('afterbegin', window.modalsHtml);
        }

        if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
            const workspace = await window.apiBrowser.getWorkspacePath();
            
            if (!workspace) {
                if (typeof mostraWelcomeModal === 'function') {
                    await mostraWelcomeModal();
                } else {
                    const modal = document.getElementById('welcome-modal');
                    if (modal) {
                        modal.classList.remove('hidden-tab');
                        modal.style.setProperty('display', 'flex', 'important');
                    }
                }
                return;
            } else {
                if (typeof aggiornaListaVault === 'function') {
                    aggiornaListaVault();
                }
            }
        }
        
        if (window.initTheme) await window.initTheme();
        if (window.initLang) await window.initLang();
        
        await avviaApp();

        // Controllo Changelog
        if (window.apiSettings && window.apiBrowser && window.apiBrowser.getVersion) {
            const currentVersion = await window.apiBrowser.getVersion();
            const settings = await window.apiSettings.get();
            if (settings.lastSeenVersion !== currentVersion) {
                if (window.apriChangelogModal) {
                    window.apriChangelogModal();
                }
                settings.lastSeenVersion = currentVersion;
                await window.apiSettings.save(settings);
            }
        }
    } catch (error) {
        console.error("FATAL ERROR", error);
    }
});

window.selezionaCartellaIniziale = async function() {
    if (window.apiBrowser && window.apiBrowser.changeWorkspace) {
        const newPath = await window.apiBrowser.changeWorkspace();
        if (newPath) {
            document.getElementById('welcome-modal').classList.add('hidden-tab');
        }
    }
};

window.aggiornaVisibilitaCloud = async function() {
    let isCloud = false;
    
    if (window.hubConfig) {
        isCloud = true;
    }
    
    if (!isCloud && window.apiSettings) {
        try {
            const settings = await window.apiSettings.get();
            if (settings.isSharedVault || settings.isPersonalCloud) {
                isCloud = true;
            }
        } catch (e) {
            console.error("Errore lettura settings per visibilità cloud", e);
        }
    }

    const btnSourceControl = document.getElementById('btn-tab-source-control');
    const cloudButtonsContainer = document.getElementById('cloud-buttons-container');
    
    if (isCloud) {
        if (btnSourceControl) btnSourceControl.classList.remove('hidden-tab', 'hidden');
        if (cloudButtonsContainer) {
            cloudButtonsContainer.classList.remove('hidden');
            cloudButtonsContainer.classList.add('md:flex');
        }
    } else {
        if (btnSourceControl) btnSourceControl.classList.add('hidden-tab');
        if (cloudButtonsContainer) {
            cloudButtonsContainer.classList.add('hidden');
            cloudButtonsContainer.classList.remove('md:flex');
            
            // Se eravamo nel tab source-control, passiamo al default (list) per evitare UI vuota
            const activeSidebar = document.querySelector('.sidebar-content:not(.hidden-tab)');
            if (activeSidebar && activeSidebar.id === 'sidebar-source-control' && typeof switchSidebarTab === 'function') {
                switchSidebarTab('folders');
            }
        }
    }
};

async function avviaApp() {
    await initData();
    if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();

    if (window.apiBrowser && window.apiBrowser.onDatabaseModificatoEsterno) {
        window.apiBrowser.onDatabaseModificatoEsterno(async () => {
            const nuovoDati = await window.apiBrowser.leggiDati();
            if (nuovoDati) {
                await window.sincronizzaEUnisciDati(nuovoDati);
                mostraMessaggio("L'archivio è stato sincronizzato in tempo reale.", "info");
            }
        });
    }

    const settings = await window.apiSettings.get();
    const statoSalvato = settings.appState;
    if (statoSalvato) {
        try {
            const stato = statoSalvato;
            if (stato.cartella) {
                window.cartellaAttuale = stato.cartella;
            }
            if (stato.cartelleEspanse) {
                window.cartelleEspanse = new Set(stato.cartelleEspanse);
            }
            window.statoIniziale = stato;
        } catch (e) {}
    }

    // Primo render per popolare l'interfaccia all'avvio
    if (settings && (settings.autoStartTrasformaCondiviso || settings.autoStartTrasformaPersonale)) {
        const isCondiviso = settings.autoStartTrasformaCondiviso;
        const isPersonale = settings.autoStartTrasformaPersonale;
        
        settings.autoStartTrasformaCondiviso = false;
        settings.autoStartTrasformaPersonale = false;
        await window.apiSettings.save(settings);
        
        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud("Preparazione in corso", "Avvio configurazione cloud...");
        }

        setTimeout(async () => {
            if (window.driveAuthPromise) {
                try { await window.driveAuthPromise; } catch (e) { console.error(e); }
            }
            if (typeof apriCloudModal === 'function') {
                await apriCloudModal();
            }
            if (isCondiviso && typeof trasformaInCondiviso === 'function') trasformaInCondiviso();
            else if (isPersonale && typeof trasformaInPersonale === 'function') trasformaInPersonale();
        }, 300);
    }

    if (settings && settings.promptCloudAuth) {
        settings.promptCloudAuth = false;
        await window.apiSettings.save(settings);
        
        setTimeout(() => {
            if (typeof apriCloudModal === 'function') {
                apriCloudModal();
                if (typeof mostraMessaggio === 'function') {
                    mostraMessaggio("Benvenuto nell'Archivio Condiviso! Effettua l'accesso a Google Drive per scaricare i dati.", "info");
                }
            }
        }, 800);
    }

    if (typeof aggiornaSelectTipiDocumento === 'function') aggiornaSelectTipiDocumento();
    renderSidebar();
    renderMain();
    
    // Inizializza tutte le icone statiche dell'HTML
    if (window.lucide) lucide.createIcons();

    if (window.statoIniziale) {
        if (window.statoIniziale.tab === 'add') {
            switchTab('add');
        } else if (window.statoIniziale.tab === 'trascrizione' && window.statoIniziale.trascrizioneId) {
            // Verifica che il manoscritto esista ancora prima di aprire la trascrizione
            const esiste = appData.manoscritti.some(m => String(m.id) === String(window.statoIniziale.trascrizioneId));
            if (esiste && typeof apriTrascrizione === 'function') {
                apriTrascrizione(window.statoIniziale.trascrizioneId);
            } else {
                switchTab('list');
            }
        } else {
            switchTab('list');
        }
    } else {
        switchTab('list');
    }

    // Debounce sulla ricerca: renderMain e renderSearchSuggestions vengono
    // chiamate max 1 volta ogni 150ms invece che ad ogni singolo tasto
    const debouncedRenderMain = debounce(renderMain, 150);
    const debouncedRenderSuggestions = debounce(renderSearchSuggestions, 150);

    // Controlla aggiornamenti in background all'avvio senza mostrare popup se è già aggiornato
    setTimeout(() => { if (typeof window.controllaAggiornamenti === 'function') window.controllaAggiornamenti(false); }, 2000);

    // Guard: assicuriamoci di bindare gli eventi globali una sola volta
    if (!window._eventsBound) {
        window._eventsBound = true;

        document.getElementById('search-input').addEventListener('input', () => {
            debouncedRenderMain();
            debouncedRenderSuggestions();
        });
        document.getElementById('global-tag-search').addEventListener('input', debouncedRenderMain);
        document.getElementById('manoscritto-form').addEventListener('submit', handleFormSubmit);

    // Tracciamento modifiche non salvate form
    document.getElementById('manoscritto-form').addEventListener('input', () => { window.isFormDirty = true; });
    document.getElementById('manoscritto-form').addEventListener('change', () => { window.isFormDirty = true; });

    // Gestione Anteprime file
    window.pendingFilesToUpload = window.pendingFilesToUpload || [];
    
    window.renderPendingFiles = function() {
        const previewNew = document.getElementById('form-allegati-new-preview');
        if (!previewNew) return;
        
        if (window.pendingFilesToUpload && window.pendingFilesToUpload.length > 0) {
            previewNew.classList.remove('hidden');
            let html = '<div class="text-xs text-amber-700 font-medium mb-2">File pronti per il caricamento:</div>';
            html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">';
            window.pendingFilesToUpload.forEach((file, index) => {
                html += `
                    <div class="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-sm">
                        <span class="text-xs truncate text-amber-900 font-semibold" title="${escapeHTML(file.name)}">
                            <i data-lucide="file" class="w-3 h-3 inline-block mr-1"></i>${escapeHTML(file.name)}
                        </span>
                        <button type="button" onclick="window.rimuoviPendingFile(${index})" class="text-amber-600 hover:text-red-600 p-1 bg-white border border-amber-200 rounded shadow-sm">
                            <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                    </div>
                `;
            });
            html += '</div>';
            previewNew.innerHTML = html;
            if (window.lucide) lucide.createIcons({ nodes: [previewNew] });
        } else {
            previewNew.classList.add('hidden');
            previewNew.innerHTML = '';
        }
    };

    window.rimuoviPendingFile = function(index) {
        if (window.pendingFilesToUpload) {
            window.pendingFilesToUpload.splice(index, 1);
            window.renderPendingFiles();
        }
    };

    document.getElementById('form-allegato').addEventListener('change', function(e) {
        const fileList = e.target.files;
        if (fileList.length > 0) {
            for (let i = 0; i < fileList.length; i++) {
                window.pendingFilesToUpload.push(fileList[i]);
            }
        }
        e.target.value = ''; // Reset per poter selezionare di nuovo
        window.renderPendingFiles();
    });

    // Scorciatoie da tastiera
    document.addEventListener('keydown', function(e) {
        const vTrascrizione = document.getElementById('view-trascrizione');

        // Salva trascrizione con Ctrl+S o sfoglia
        if (vTrascrizione && !vTrascrizione.classList.contains('hidden-tab')) {
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                if (typeof cambiaAllegatoRelativo === 'function') cambiaAllegatoRelativo(-1);
            } else if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                if (typeof cambiaAllegatoRelativo === 'function') cambiaAllegatoRelativo(1);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (typeof salvaTrascrizione === 'function') salvaTrascrizione();
            }
            if (e.altKey && e.key === 'f') {
                e.preventDefault();
                if (typeof toggleFullscreenAllegato === 'function') toggleFullscreenAllegato();
            }
            return; // Interrompe qui se siamo in modalità trascrizione
        }

        // --- SCORCIATOIE GLOBALI ---
        // Ctrl+F -> Cerca
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                if (typeof switchTab === 'function') switchTab('list');
                searchInput.focus();
                searchInput.select();
            }
        }
        
        // Ctrl+N -> Nuovo Documento
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            if (typeof switchTab === 'function') switchTab('add');
            const segInput = document.getElementById('form-segnatura');
            if (segInput) segInput.focus();
        }

        // Ctrl+S -> Salva Scheda (se siamo nel tab di inserimento)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            const vAdd = document.getElementById('view-add');
            if (vAdd && !vAdd.classList.contains('hidden-tab')) {
                e.preventDefault();
                // trigger form submit per sfruttare la validazione
                const form = document.getElementById('manoscritto-form');
                if (form) {
                    const event = new Event('submit', { cancelable: true });
                    form.dispatchEvent(event);
                }
            }
        }

        // Esc -> Chiudi modali aperte o pulisci la barra di ricerca
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal-overlay:not(.hidden-tab)');
            if (modals.length > 0) {
                modals.forEach(m => m.classList.add('hidden-tab'));
                // Eventuali cleanup
                if (typeof editingTypeId !== 'undefined') editingTypeId = null;
            } else {
                const searchInput = document.getElementById('search-input');
                if (searchInput && document.activeElement === searchInput) {
                    searchInput.value = '';
                    searchInput.blur();
                    if (typeof renderMain === 'function') renderMain();
                    if (typeof renderSearchSuggestions === 'function') renderSearchSuggestions();
                }
            }
        }
    });

    window.trascrizioneNonSalvata = false;
    document.getElementById('trascrizione-editor').addEventListener('input', () => {
        window.trascrizioneNonSalvata = true;
    });

    window.addEventListener('beforeunload', (e) => {
        if (window.trascrizioneNonSalvata) {
            e.preventDefault();
            e.returnValue = ''; 
        }
    });
    

    // Drag to resize Trascrizione panels
    const resizer = document.getElementById('trascrizione-resizer');
    const leftPanel = document.getElementById('trascrizione-editor-panel');
    const container = document.getElementById('trascrizione-container');

    // Chiusura automatica modali cliccando sullo sfondo
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            const preventCloseIds = ['cloud-progress-overlay', 'cloud-auth-modal', 'email-prompt-modal'];
            if (preventCloseIds.includes(e.target.id)) return;
            
            e.target.classList.add('hidden-tab');
            // Gestione specifica per reset stato se necessario
            if (e.target.id === 'new-type-modal' && typeof editingTypeId !== 'undefined') {
                editingTypeId = null;
            }
        }
    });

    let isResizing = false;

    if (resizer && leftPanel && container) {
        resizer.addEventListener('mousedown', () => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            leftPanel.style.transition = 'none';
            // Disabilita pointer events su iframe durante il drag
            const iframe = document.getElementById('trasc-pdf-preview');
            if (iframe) iframe.style.pointerEvents = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const containerRect = container.getBoundingClientRect();
            let newWidth = e.clientX - containerRect.left;

            if (newWidth < 250) newWidth = 250;
            if (newWidth > containerRect.width - 250) newWidth = containerRect.width - 250;

            const percentage = (newWidth / containerRect.width) * 100;
            leftPanel.style.width = `${percentage}%`;
        });

        document.addEventListener('mouseup', async () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                leftPanel.style.transition = '';
                const iframe = document.getElementById('trasc-pdf-preview');
                if (iframe) iframe.style.pointerEvents = '';

                appData.trascrizioneEditorWidth = leftPanel.style.width;
                if (typeof salvaTutto === 'function') await salvaTutto();
            }
        });
    }
    } // End of if (!window._eventsBound)
}

// Theme Selection Logic
window.applicaTema = function(theme) {
    let activeTheme = theme;
    if (theme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    document.documentElement.classList.remove('dark-theme', 'amber-light-theme', 'blue-dark-theme');
    
    if (activeTheme === 'dark') {
        document.documentElement.classList.add('dark-theme');
    } else if (activeTheme === 'amber-light') {
        document.documentElement.classList.add('amber-light-theme');
    } else if (activeTheme === 'blue-dark') {
        document.documentElement.classList.add('blue-dark-theme');
    }
};

window.cambiaTemaSelezionato = async function(theme) {
    const settings = await window.apiSettings.get();
    settings.theme = theme;
    await window.apiSettings.save(settings);
    localStorage.setItem('theme', theme);
    window.applicaTema(theme);
};

// Initialize Theme
window.initTheme = async function() {
    const settings = await window.apiSettings.get();
    const savedTheme = settings.theme || 'system';
    
    // Set the select element if it's already in the DOM (unlikely since it's in a modal, but safe)
    const sel = document.getElementById('settings-theme');
    if (sel) sel.value = savedTheme;
    
    window.applicaTema(savedTheme);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async e => {
        const s = await window.apiSettings.get();
        const currentPref = s.theme || 'system';
        if (currentPref === 'system') {
            window.applicaTema('system');
        }
    });
};

window.handleInviteCode = function(code) {
    const procedi = () => {
        // Chiudi altri modali
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(m => m.classList.add('hidden-tab'));
        
        // Apri il welcome modal
        const welcome = document.getElementById('welcome-modal');
        if (welcome) {
            welcome.classList.remove('hidden-tab');
            welcome.style.setProperty('display', 'flex', 'important');
        }
        
        // Vai al form di join
        if (typeof mostraJoinForm === 'function') {
            mostraJoinForm();
        }
        
        // Incolla il codice
        setTimeout(() => {
            const input = document.getElementById('welcome-join-code');
            if (input) {
                input.value = code;
                input.focus();
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, 300);
    };

    const welcome = document.getElementById('welcome-modal');
    if (welcome && welcome.classList.contains('hidden-tab')) {
        if (typeof mostraBottomConfirm === 'function') {
            mostraBottomConfirm("Vuoi chiudere l'Archivio corrente per unirti a un nuovo Archivio Condiviso? Le modifiche locali non salvate potrebbero andare perse.", procedi);
        } else {
            procedi();
        }
    } else {
        procedi();
    }
};

if (window.apiBrowser && window.apiBrowser.onInviteUrl) {
    window.apiBrowser.onInviteUrl((url) => {
        if (url.startsWith('archiview://join/')) {
            const code = url.substring(17);
            if (typeof window.handleInviteCode === 'function') {
                window.handleInviteCode(code);
            }
        }
    });
}

window.esportaManoscritto = async function(id) {
    if (!window.apiBrowser || !window.apiBrowser.exportZip) return;
    const res = await window.apiBrowser.exportZip([id]);
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio("Esportazione completata con successo!", "success");
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio("Errore in esportazione: " + res.error, "error");
    }
};

window.esportaCartellaAttuale = async function() {
    window.esportaSpecificaCartella(window.cartellaAttuale);
};

window.esportaSpecificaCartella = async function(folderName) {
    if (!window.apiBrowser || !window.apiBrowser.exportZip) return;
    const manoscrittiInCartella = appData.manoscritti.filter(m => 
        m.cartella === folderName || m.cartella.startsWith(folderName + '/')
    );
    if (manoscrittiInCartella.length === 0) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio("L'archivio è vuoto, nulla da esportare.", "warning");
        return;
    }
    const ids = manoscrittiInCartella.map(m => m.id);
    const res = await window.apiBrowser.exportZip(ids);
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(`Esportazione di ${res.count} record completata con successo!`, "success");
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio("Errore in esportazione: " + res.error, "error");
    }
};

window.importaManoscritto = async function() {
    if (!window.apiBrowser || !window.apiBrowser.importZip) return;
    const res = await window.apiBrowser.importZip();
    if (res.success && res.manoscritti) {
        let addedCount = 0;
        const existingIds = new Set(appData.manoscritti.map(m => m.id));
        
        res.manoscritti.forEach(m => {
            if (existingIds.has(m.id)) {
                m.id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
                m.titolo = m.titolo ? m.titolo + ' (Copia)' : '';
            }
            // Essenziale: se l'utente aveva cancellato l'ID, lo stiamo importando esplicitamente, quindi va rimosso dai tombstone!
            if (appData.deletedIds) {
                appData.deletedIds = appData.deletedIds.filter(id => id !== m.id);
            }
            appData.manoscritti.push(m);
            
            // Assicuriamoci che la cartella esista
            if (m.cartella && !appData.cartelle.includes(m.cartella)) {
                appData.cartelle.push(m.cartella);
            }
            
            addedCount++;
        });

        if (typeof mostraMessaggio === 'function') mostraMessaggio(`Importati ${addedCount} record con successo!`, "success");
        if (window.salvaStatoPosizione) window.salvaStatoPosizione();
        
        // Salvataggio scatena l'update chokidar ma avendo già appData aggiornato in memoria,
        // sincronizzaEUnisciDati non avrà problemi o sovrascritture.
        if (window.Store) {
            await window.Store.commit();
            if (typeof aggiornaSelectCartelle === 'function') aggiornaSelectCartelle();
        } else {
            await window.apiBrowser.salvaDati(appData);
            if (typeof normalizzaCartelle === 'function') normalizzaCartelle();
            if (typeof aggiornaSelectCartelle === 'function') aggiornaSelectCartelle();
            if (typeof renderSidebar === 'function') renderSidebar();
            if (typeof renderMain === 'function') renderMain();
        }
        if (window.ripristinaStatoPosizione) window.ripristinaStatoPosizione();
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio("Errore in importazione: " + res.error, "error");
    }
};

// --- LOGICA SELEZIONE MULTIPLA E COPIA/INCOLLA ---

window.lastSelectedId = null;
window.selectedRecords = window.selectedRecords || [];
window.copiedRecordIds = window.copiedRecordIds || [];
window.cutRecordIds = window.cutRecordIds || [];

window.selectItem = function(id, event) {
    if (!event) event = window.event || {};
    
    // Lista di id renderizzati corrente
    const currentRenderedIds = Array.from(document.querySelectorAll('.card-scheda')).map(el => el.id.replace('card-', ''));
    // Se stiamo operando dalla sidebar e l'elemento non è in currentRenderedIds, non possiamo fare shift select
    const isShift = event.shiftKey;
    const isCtrl = event.ctrlKey || event.metaKey;

    if (isShift && window.lastSelectedId && currentRenderedIds.includes(window.lastSelectedId) && currentRenderedIds.includes(id)) {
        const startIdx = currentRenderedIds.indexOf(window.lastSelectedId);
        const endIdx = currentRenderedIds.indexOf(id);
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        
        if (!isCtrl) {
            window.selectedRecords = [];
        }
        
        for (let i = minIdx; i <= maxIdx; i++) {
            const sid = currentRenderedIds[i];
            if (!window.selectedRecords.includes(sid)) {
                window.selectedRecords.push(sid);
            }
        }
    } else if (isCtrl) {
        const idx = window.selectedRecords.indexOf(id);
        if (idx === -1) {
            window.selectedRecords.push(id);
        } else {
            window.selectedRecords.splice(idx, 1);
        }
        window.lastSelectedId = id;
    } else {
        if (window.selectedRecords.length === 1 && window.selectedRecords[0] === id) {
            window.selectedRecords = [];
            window.lastSelectedId = null;
        } else {
            window.selectedRecords = [id];
            window.lastSelectedId = id;
        }
    }

    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderMain === 'function') renderMain();
    window.aggiornaSelectionBar();
};

window.aggiornaSelectionBar = function() {
    const bar = document.getElementById('selection-bar');
    if (!bar) return;
    if (window.selectedRecords && window.selectedRecords.length > 0) {
        bar.classList.remove('hidden');
        document.getElementById('selection-count').innerText = `${window.selectedRecords.length} selezionati`;
    } else {
        bar.classList.add('hidden');
    }
};

window.esportaSelezionati = async function() {
    if (window.selectedRecords.length === 0) return;
    if (!window.apiBrowser || !window.apiBrowser.exportZip) return;
    const res = await window.apiBrowser.exportZip(window.selectedRecords);
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(`Esportazione di ${res.count} record completata con successo!`, "success");
        window.selectedRecords = [];
        window.aggiornaSelectionBar();
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio("Errore in esportazione: " + res.error, "error");
    }
};

window.eliminaSelezionati = async function() {
    if (window.selectedRecords.length === 0) return;
    const count = window.selectedRecords.length;
    
    const procediEliminazione = async () => {
        // Salviamo i record da eliminare
        const recordDaEliminare = appData.manoscritti.filter(m => window.selectedRecords.includes(m.id));
        const recordSalvati = JSON.parse(JSON.stringify(recordDaEliminare));
        
        appData.manoscritti = appData.manoscritti.filter(m => !window.selectedRecords.includes(m.id));
        
        // Gestione tombstones
        if (!appData.deletedIds) appData.deletedIds = [];
        window.selectedRecords.forEach(id => {
            if (!appData.deletedIds.includes(id)) appData.deletedIds.push(id);
        });
        
        if (window.Store) {
            await window.Store.commit();
        } else {
            await window.apiBrowser.salvaDati(appData);
            if (typeof renderMain === 'function') renderMain();
            if (typeof renderSidebar === 'function') renderSidebar();
        }
        window.selectedRecords = [];
        window.aggiornaSelectionBar();
        
        const ripristinaFn = async () => {
            const idsRipristinati = recordSalvati.map(r => r.id);
            if (appData.deletedIds) {
                appData.deletedIds = appData.deletedIds.filter(x => !idsRipristinati.includes(x));
            }
            appData.manoscritti.push(...recordSalvati);
            if (window.Store) {
                await window.Store.commit();
            } else {
                await window.apiBrowser.salvaDati(appData);
                if (typeof renderMain === 'function') renderMain();
            }
        };
        
        if (window.gestoreAnnullamento) {
            window.gestoreAnnullamento.registraAzione(`Eliminazione di ${count} record`, ripristinaFn);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(`${count} record eliminati.`, "success", () => window.gestoreAnnullamento.annullaUltimaAzione());
        }
    };

    if (typeof window.mostraBottomConfirm === 'function') {
        const msg = count > 1 
            ? `Sei sicuro di voler eliminare ${count} record selezionati? L'operazione è irreversibile.`
            : `Sei sicuro di voler eliminare questo record? L'operazione è irreversibile.`;
        window.mostraBottomConfirm(msg, procediEliminazione);
    } else {
        await procediEliminazione();
    }
};

window.copiaSelezionati = function() {
    if (window.selectedRecords.length === 0) return;
    window.copiedRecordIds = [...window.selectedRecords];
    window.cutRecordIds = [];
    const count = window.copiedRecordIds.length;
    if (typeof mostraMessaggio === 'function') mostraMessaggio(`${count} record copiati negli appunti di ArchiView. Tasto destro per incollarli in un altro archivio.`, "info");
    window.selectedRecords = [];
    window.aggiornaSelectionBar();
    setTimeout(() => {
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    }, 50);
};

window.tagliaSelezionati = function() {
    if (window.selectedRecords.length === 0) return;
    window.cutRecordIds = [...window.selectedRecords];
    window.copiedRecordIds = [];
    const count = window.cutRecordIds.length;
    if (typeof mostraMessaggio === 'function') mostraMessaggio(`${count} record tagliati. Tasto destro per spostarli in un altro archivio.`, "info");
    window.selectedRecords = [];
    window.aggiornaSelectionBar();
    setTimeout(() => {
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    }, 50);
};

// --- CONTEXT MENU ---
function getOrCreateContextMenu() {
    let menu = document.getElementById('custom-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'custom-context-menu';
        menu.className = 'fixed bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-xl rounded-md py-1 z-[9999] min-w-[150px] text-sm hidden text-stone-800 dark:text-stone-100';
        document.body.appendChild(menu);
        
        // Chiudi click fuori
        document.addEventListener('click', () => menu.classList.add('hidden'));
        document.addEventListener('scroll', () => menu.classList.add('hidden'));
    }
    return menu;
}

window.showRecordContextMenu = function(e, id) {
    const menu = getOrCreateContextMenu();

    // Se l'ID cliccato non è tra i selezionati, seleziona solo quello
    if (!window.selectedRecords.includes(id)) {
        window.selectedRecords = [id];
        window.lastSelectedId = id;
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
        window.aggiornaSelectionBar();
    }

    const selCount = window.selectedRecords.length;
    const label = selCount > 1 ? ` (${selCount})` : '';

    const renameHtml = selCount === 1 ? `<button onclick="editItem('${id}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"><i data-lucide="edit-3" class="w-4 h-4"></i> Rinomina / Modifica</button>` : '';

    menu.innerHTML = `
        ${renameHtml}
        <button onclick="window.copiaSelezionati()" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"><i data-lucide="copy" class="w-4 h-4"></i> Copia${label}</button>
        <button onclick="window.tagliaSelezionati()" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"><i data-lucide="scissors" class="w-4 h-4"></i> Taglia${label}</button>
        <button onclick="window.esportaSelezionati()" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> Esporta${label}</button>
        <div class="h-px bg-stone-200 dark:bg-stone-700 my-1"></div>
        <button onclick="window.eliminaSelezionati()" class="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-2"><i data-lucide="trash-2" class="w-4 h-4"></i> Elimina${label}</button>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [menu] });
    
    // Posizionamento
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
    menu.classList.remove('hidden');
};

window.showFolderContextMenu = function(e) {
    // Mostra solo se clicchiamo nello sfondo del view-list
    if (e.target.closest('.card-scheda')) return;
    
    const countToPaste = (window.copiedRecordIds && window.copiedRecordIds.length > 0) ? window.copiedRecordIds.length : ((window.cutRecordIds && window.cutRecordIds.length > 0) ? window.cutRecordIds.length : 0);
    const isMoving = window.cutRecordIds && window.cutRecordIds.length > 0;
    
    if (countToPaste > 0) {
        e.preventDefault();
        const menu = getOrCreateContextMenu();
        menu.innerHTML = `
            <button onclick="window.incollaRecord()" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2 ${isMoving ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'} font-medium"><i data-lucide="clipboard-paste" class="w-4 h-4"></i> Incolla (${countToPaste})</button>
        `;
        if (window.lucide) lucide.createIcons({ nodes: [menu] });
        menu.style.left = Math.min(e.clientX, window.innerWidth - 160) + 'px';
        menu.style.top = Math.min(e.clientY, window.innerHeight - 50) + 'px';
        menu.classList.remove('hidden');
    }
};

window.showSidebarFolderContextMenu = function(e, folderPath) {
    const countToPaste = (window.copiedRecordIds && window.copiedRecordIds.length > 0) ? window.copiedRecordIds.length : ((window.cutRecordIds && window.cutRecordIds.length > 0) ? window.cutRecordIds.length : 0);
    const hasFolderAction = window.cutFolderPath || window.copiedFolderPath;
    const isMoving = (window.cutRecordIds && window.cutRecordIds.length > 0) || window.cutFolderPath;
    
    e.preventDefault();
    e.stopPropagation();
    const menu = getOrCreateContextMenu();
    const escFolder = folderPath.replace(/'/g, "\\'");
    const isGenerale = folderPath === 'Generale';
    const isRoot = folderPath === 'ROOT';
    
    let html = '';
    
    if (!isRoot) {
        html += `
            <button onclick="window.creaSchedaContext('${escFolder}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"><i data-lucide="file-plus" class="w-4 h-4"></i> Crea Nuova Scheda</button>
            <button onclick="window.mostraAggiungiCartellaContext('${escFolder}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"><i data-lucide="folder-plus" class="w-4 h-4"></i> Crea Nuova Cartella</button>
            <div class="h-px bg-stone-200 dark:bg-stone-700 my-1"></div>
            <button onclick="window.rinominaCartellaDaSidebar('${escFolder}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2" ${isGenerale ? 'disabled style="opacity:0.5"' : ''}><i data-lucide="edit-2" class="w-4 h-4"></i> Rinomina Cartella</button>
            <button onclick="window.esportaSpecificaCartella('${escFolder}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"><i data-lucide="upload" class="w-4 h-4"></i> Esporta Cartella</button>
            <button onclick="window.apriCartellaInEsploraRisorse('${escFolder}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"><i data-lucide="folder-open" class="w-4 h-4"></i> Apri in Esplora Risorse</button>
            <div class="h-px bg-stone-200 dark:bg-stone-700 my-1"></div>
            <button onclick="window.copiaCartella('${escFolder}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2"><i data-lucide="copy" class="w-4 h-4"></i> Copia Cartella</button>
            <button onclick="window.tagliaCartella('${escFolder}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2" ${isGenerale ? 'disabled style="opacity:0.5"' : ''}><i data-lucide="scissors" class="w-4 h-4"></i> Taglia Cartella</button>
            <button onclick="window.eliminaCartellaDaSidebar('${escFolder}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2 text-red-600 dark:text-red-400" ${isGenerale ? 'disabled style="opacity:0.5"' : ''}><i data-lucide="trash-2" class="w-4 h-4"></i> Elimina Cartella</button>
        `;
    }
    
    if (countToPaste > 0 || hasFolderAction) {
        let label = countToPaste > 0 ? `Incolla qui (${countToPaste})` : `Incolla Cartella qui`;
        if (!isRoot) html += `<div class="h-px bg-stone-200 dark:bg-stone-700 my-1"></div>`;
        html += `
            <button onclick="window.incollaRecord('${escFolder}')" class="w-full text-left px-4 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-2 ${isMoving ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'} font-medium"><i data-lucide="clipboard-paste" class="w-4 h-4"></i> ${label}</button>
        `;
    }
    
    if (html === '') {
        html = `<div class="px-4 py-2 text-stone-500 italic text-sm">Nessuna azione</div>`;
    }
    
    menu.innerHTML = html;
    if (window.lucide) lucide.createIcons({ nodes: [menu] });
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 150) + 'px';
    menu.classList.remove('hidden');
};

window.copiaCartella = function(folderPath) {
    window.copiedFolderPath = folderPath;
    window.cutFolderPath = null;
    window.cutRecordIds = [];
    window.copiedRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(`Cartella copiata. Tasto destro su un'altra cartella per incollarla.`, "info");
};

window.apriCartellaInEsploraRisorse = async function(folderPath) {
    if (window.apiBrowser && window.apiBrowser.apriCartellaWorkspace) {
        const success = await window.apiBrowser.apriCartellaWorkspace();
        if (!success) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio("Impossibile aprire la cartella in Esplora Risorse.", "error");
        }
    }
};

window.creaSchedaContext = function(folderPath) {
    window.cartellaAttuale = folderPath;
    if (typeof window.selectItem === 'function') window.selectItem(folderPath, true);
    if (typeof switchTab === 'function') switchTab('add');
};

window.mostraAggiungiCartellaContext = function(folderPath) {
    window.cartellaAttuale = folderPath;
    if (typeof window.selectItem === 'function') window.selectItem(folderPath, true);
    if (typeof aggiungiCartella === 'function') aggiungiCartella();
};

window.tagliaCartella = function(folderPath) {
    if (folderPath === 'Generale') return;
    window.cutFolderPath = folderPath;
    window.copiedFolderPath = null;
    window.cutRecordIds = [];
    window.copiedRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(`Cartella tagliata. Tasto destro per spostarla.`, "info");
};
window.copiaRecordSingolo = function(id) {
    window.copiedRecordIds = [id];
    window.cutRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(`Record copiato. Tasto destro per incollarlo in una cartella.`, "info");
};

window.tagliaRecordSingolo = function(id) {
    window.cutRecordIds = [id];
    window.copiedRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(`Record tagliato. Tasto destro per spostarlo in un altro archivio.`, "info");
};

window.incollaRecord = async function(targetFolderOverride) {
    const targetFolder = targetFolderOverride || window.cartellaAttuale || 'Generale';

    // Se stiamo spostando un intero archivio (Taglia Archivio)
    if (window.cutFolderPath) {
        if (typeof spostaCartella === 'function') {
            await spostaCartella(window.cutFolderPath, targetFolder);
            window.cutFolderPath = null;
            if (typeof mostraMessaggio === 'function') mostraMessaggio(`Archivio spostato con successo!`, "success");
        }
        return;
    }

    // Se stiamo copiando un intero archivio (Copia Archivio)
    if (window.copiedFolderPath) {
        // Estraiamo gli ID dei record della cartella copiata
        const prefix = window.copiedFolderPath + '/';
        const manoscrittiDaCopiare = appData.manoscritti.filter(m => m.cartella === window.copiedFolderPath || (m.cartella && m.cartella.startsWith(prefix)));
        
        if (manoscrittiDaCopiare.length === 0) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(`L'archivio copiato è vuoto.`, "warning");
            window.copiedFolderPath = null;
            return;
        }

        const idsToCopy = manoscrittiDaCopiare.map(m => m.id);
        
        // Determiniamo la cartella destinazione (sotto-cartella del target con il nome dell'archivio copiato)
        const nomeArchivioCopiato = window.copiedFolderPath.split('/').pop();
        const baseTarget = targetFolder === 'ROOT' ? nomeArchivioCopiato : `${targetFolder}/${nomeArchivioCopiato}`;

        if (!window.apiBrowser || !window.apiBrowser.duplicateRecords) return;
        const res = await window.apiBrowser.duplicateRecords(idsToCopy, baseTarget);

        if (res.success) {
            // Assicuriamoci che la nuova cartella esista nel db
            if (!appData.cartelle.includes(baseTarget)) {
                appData.cartelle.push(baseTarget);
            }
            if (typeof mostraMessaggio === 'function') mostraMessaggio(`Archivio duplicato con successo (${res.count} record)!`, "success");
            window.copiedFolderPath = null;
            // Ricarica DB
            if (window.salvaStatoPosizione) window.salvaStatoPosizione();
            await window.apiBrowser.leggiDati().then(async dati => {
                appData = dati;
                if (window.Store) {
                    await window.Store.commit();
                } else {
                    if (typeof normalizzaCartelle === 'function') normalizzaCartelle();
                    if (typeof renderSidebar === 'function') renderSidebar();
                    if (typeof renderMain === 'function') renderMain();
                }
                if (window.ripristinaStatoPosizione) window.ripristinaStatoPosizione();
            });
        } else {
            if (typeof mostraMessaggio === 'function') mostraMessaggio("Errore in duplicazione archivio: " + res.error, "error");
        }
        return;
    }

    // Se stiamo incollando record tagliati (Spostamento singolo/multiplo)
    if (window.cutRecordIds && window.cutRecordIds.length > 0) {
        let movedCount = 0;
        appData.manoscritti.forEach(m => {
            if (window.cutRecordIds.includes(m.id)) {
                m.cartella = targetFolder;
                movedCount++;
            }
        });
        if (movedCount > 0) {
            if (window.Store) {
                await window.Store.commit();
            } else {
                await window.apiBrowser.salvaDati(appData);
                if (typeof renderSidebar === 'function') renderSidebar();
                if (typeof renderMain === 'function') renderMain();
            }
            if (typeof mostraMessaggio === 'function') mostraMessaggio(`${movedCount} record spostati con successo!`, "success");
            window.cutRecordIds = []; // Reset dopo lo spostamento
        }
        return;
    }

    // Se stiamo incollando record copiati (Duplicazione singolo/multiplo)
    if (!window.copiedRecordIds || window.copiedRecordIds.length === 0) return;
    if (!window.apiBrowser || !window.apiBrowser.duplicateRecords) return;
    
    const res = await window.apiBrowser.duplicateRecords(window.copiedRecordIds, targetFolder);
    
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(`${res.count} record duplicati con successo!`, "success");
        // Ricarica DB
        if (window.salvaStatoPosizione) window.salvaStatoPosizione();
        await window.apiBrowser.leggiDati().then(async dati => {
            appData = dati;
            if (window.Store) {
                await window.Store.commit();
            } else {
                if (typeof renderSidebar === 'function') renderSidebar();
                if (typeof renderMain === 'function') renderMain();
            }
            if (window.ripristinaStatoPosizione) window.ripristinaStatoPosizione();
        });
    } else {
        if (typeof mostraMessaggio === 'function') mostraMessaggio("Errore in incolla: " + res.error, "error");
    }
};

// Listeners globali per shortcut da tastiera
document.addEventListener('keydown', (e) => {
    // Gestione Ctrl+Z o Cmd+Z per annullare
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Preveniamo l'undo se siamo in un input text nativo
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isInput = activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable;
        
        if (!isInput) {
            e.preventDefault();
            if (window.gestoreAnnullamento) {
                window.gestoreAnnullamento.annullaUltimaAzione();
            }
        }
    }
});
