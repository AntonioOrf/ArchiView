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
    } catch (error) {
        console.error("FATAL ERROR", error);
    }
});

window.selezionaCartellaIniziale = async function() {
    if (window.apiBrowser && window.apiBrowser.changeWorkspace) {
        const newPath = await window.apiBrowser.changeWorkspace();
        if (newPath) {
            document.getElementById('welcome-modal').classList.add('hidden-tab');
            await avviaApp();
        }
    }
};

async function avviaApp() {
    await initData();

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
    if (typeof aggiornaSelectTipiDocumento === 'function') aggiornaSelectTipiDocumento();
    renderSidebar();
    renderMain();
    
    // Inizializza tutte le icone statiche dell'HTML
    if (window.lucide) lucide.createIcons();

    if (window.statoIniziale) {
        if (window.statoIniziale.tab === 'add') {
            switchTab('add');
        } else if (window.statoIniziale.tab === 'trascrizione' && window.statoIniziale.trascrizioneId) {
            if (typeof apriTrascrizione === 'function') apriTrascrizione(window.statoIniziale.trascrizioneId);
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

    document.getElementById('search-input').addEventListener('input', () => {
        debouncedRenderMain();
        debouncedRenderSuggestions();
    });
    document.getElementById('global-tag-search').addEventListener('input', debouncedRenderMain);
    document.getElementById('manoscritto-form').addEventListener('submit', handleFormSubmit);

    // Gestione Anteprime file
    document.getElementById('form-allegato').addEventListener('change', function(e) {
        const fileList = e.target.files;
        const previewNew = document.getElementById('form-allegati-new-preview');
        if (previewNew) {
            if (fileList.length > 0) {
                previewNew.textContent = `${fileList.length} nuovi file pronti per il salvataggio.`;
                previewNew.classList.remove('hidden');
            } else {
                previewNew.classList.add('hidden');
            }
        }
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
}

// Theme Selection Logic
window.applicaTema = function(theme) {
    let activeTheme = theme;
    if (theme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    if (activeTheme === 'dark') {
        document.documentElement.classList.add('dark-theme');
    } else {
        document.documentElement.classList.remove('dark-theme');
    }
};

window.cambiaTemaSelezionato = async function(theme) {
    const settings = await window.apiSettings.get();
    settings.theme = theme;
    await window.apiSettings.save(settings);
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

