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

                // Per i vault condivisi: blocca accesso se l'account Google non è autorizzato
                try {
                    const vc = await window.apiBrowser.getVaultConfig();
                    if (vc.vaultType === 'shared' && vc.sync && vc.sync.sharedVaultId && window.apiDrive) {
                        const statusResult = await window.apiDrive.status();
                        if (statusResult && statusResult.unauthorizedVault) {
                            mostraErroreAccessoNegato(statusResult.user);
                            return;
                        }
                    }
                } catch (e) {
                    console.warn("Controllo accesso vault fallito, proseguo normalmente:", e);
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
    } finally {
        // Segnale di "app pronta": l'HTML statico (header, sidebar, welcome modal) è nel
        // documento fin dal primo frame, quindi la sua comparsa non dice nulla su quali
        // script siano già stati eseguiti. Chi automatizza l'app deve poter distinguere
        // le due cose invece di dedurle da un elemento visibile.
        // Nel finally: anche un avvio andato male è "finito", e restare in attesa per
        // sempre nasconderebbe l'errore vero dietro un timeout.
        window.__appPronta = true;
        document.dispatchEvent(new CustomEvent('archiview:pronta'));
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
    
    if (!isCloud && window.apiBrowser && window.apiBrowser.getVaultConfig) {
        try {
            const vc = await window.apiBrowser.getVaultConfig();
            if (vc.vaultType !== 'local') {
                isCloud = true;
            }
        } catch (e) {
            console.error("Errore lettura vault config per visibilità cloud", e);
        }
    }

    const btnSourceControl = document.getElementById('btn-tab-source-control');
    const btnHistory = document.getElementById('btn-tab-history');

    // Fase 3.1 — il gruppo Fetch/Scarica/Carica non esiste più: le tre azioni stanno nel
    // popover del bottone di stato, che resta visibile anche su vault locale (3.5).
    window.statoCloud.vaultCloud = isCloud;
    if (window.hubConfig) window.statoCloud.autenticato = true;
    if (typeof window.aggiornaCloudStatus === 'function') window.aggiornaCloudStatus();

    if (isCloud) {
        if (btnSourceControl) btnSourceControl.classList.remove('hidden-tab', 'hidden');
        if (btnHistory) btnHistory.classList.remove('hidden-tab', 'hidden');
    } else {
        if (btnSourceControl) btnSourceControl.classList.add('hidden-tab');
        if (btnHistory) btnHistory.classList.add('hidden-tab');

        // Se eravamo nel tab source-control o history, passiamo al default (list) per evitare UI vuota
        const activeSidebar = document.querySelector('.sidebar-content:not(.hidden-tab)');
        if (activeSidebar && (activeSidebar.id === 'sidebar-source-control' || activeSidebar.id === 'sidebar-history') && typeof switchSidebarTab === 'function') {
            switchSidebarTab('folders');
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
                mostraMessaggio(window.t("msg_l_archivio_stato_sincroni", "L'archivio è stato sincronizzato in tempo reale."), "info");
            }
        });
    }

    // Un allegato Hub scaricato in background (post-pull/push, o su richiesta dal pannello
    // "non disponibile") è ora presente su disco: se è quello attualmente in visualizzazione
    // nella trascrizione, ri-renderizza per uscire dallo stato "non trovato localmente".
    if (window.apiBrowser && window.apiBrowser.onAllegatoScaricato) {
        window.apiBrowser.onAllegatoScaricato((fileName) => {
            const idInput = document.getElementById('trascrizione-id');
            if (!idInput || !fileName) return;
            const m = appData.manoscritti.find(x => x.id === idInput.value);
            const idx = window.currentAllegatoIndex || 0;
            const allegatoCorrente = m && m.allegati && m.allegati[idx];
            if (allegatoCorrente && allegatoCorrente.nome === fileName && typeof window.cambiaAllegatoTrascrizione === 'function') {
                window.cambiaAllegatoTrascrizione(fileName, allegatoCorrente.tipo, idx);
            }
        });
    }

    const settings = await window.apiSettings.get();
    const statoSalvato = settings.appState;
    if (statoSalvato) {
        try {
            const stato = statoSalvato;
            // typeof e non truthiness: '' è la radice, uno stato salvato legittimo
            if (typeof stato.cartella === 'string') {
                window.cartellaAttuale = stato.cartella;
            }
            if (stato.cartelleEspanse) {
                window.cartelleEspanse = new Set(stato.cartelleEspanse);
            }
            window.statoIniziale = stato;
        } catch (e) {}
    }

    // Creazione Hub da welcome: il workspace locale è appena stato creato, ora lo si pubblica.
    if (settings && settings.autoStartCreaHub) {
        settings.autoStartCreaHub = false;
        await window.apiSettings.save(settings);
        setTimeout(async () => {
            if (typeof window.creaRepositoryHub === 'function') {
                // null → creaRepositoryHub usa il basename della cartella come nome vault.
                await window.creaRepositoryHub(null);
            }
        }, 400);
    }

    // Primo render per popolare l'interfaccia all'avvio
    if (settings && (settings.autoStartTrasformaCondiviso || settings.autoStartTrasformaPersonale)) {
        const isCondiviso = settings.autoStartTrasformaCondiviso;
        const isPersonale = settings.autoStartTrasformaPersonale;

        settings.autoStartTrasformaCondiviso = false;
        settings.autoStartTrasformaPersonale = false;
        await window.apiSettings.save(settings);

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_prep_title", "Preparazione in corso"), window.t("prog_prep_cloud", "Avvio configurazione cloud..."));
        }

        setTimeout(async () => {
            if (window.driveAuthPromise) {
                try { await window.driveAuthPromise; } catch (e) { console.error(e); }
            }
            // apriCloudModal() rimossa da qui: chiedeva login prima che trasformaIn*
            // gestisse la propria auth, causando una doppia richiesta di accesso.
            // trasformaIn* chiama apriCloudModal() al termine, quindi il modal si apre
            // correttamente dopo il completamento del setup.
            if (isCondiviso && typeof trasformaInCondiviso === 'function') await trasformaInCondiviso();
            else if (isPersonale && typeof trasformaInPersonale === 'function') await trasformaInPersonale();
        }, 300);
    }

    if (settings && settings.hubJustCreated) {
        settings.hubJustCreated = false;
        await window.apiSettings.save(settings);
        setTimeout(() => {
            if (typeof window.apriShareModal === 'function') window.apriShareModal();
        }, 800);
    }

    if (settings && settings.hubJustMigrated) {
        settings.hubJustMigrated = false;
        await window.apiSettings.save(settings);
        setTimeout(() => {
            if (typeof mostraMessaggio === 'function') {
                mostraMessaggio(window.t("msg_hub_migrato_reinvita", "Migrazione su Hub completata! Ricorda di re-invitare i collaboratori: genera un nuovo invito dal pannello Condivisione (i permessi di Google Drive non sono trasferibili)."), "info");
            }
            if (typeof window.apriShareModal === 'function') window.apriShareModal();
        }, 1000);
    }

    if (settings && settings.promptCloudAuth) {
        settings.promptCloudAuth = false;
        await window.apiSettings.save(settings);
        
        setTimeout(() => {
            if (typeof apriCloudModal === 'function') {
                apriCloudModal();
                if (typeof mostraMessaggio === 'function') {
                    mostraMessaggio(window.t("msg_benvenuto_nell_archivio_c", "Benvenuto nell'Archivio Condiviso! Effettua l'accesso a Google Drive per scaricare i dati."), "info");
                }
            }
        }, 800);
    }

    if (typeof aggiornaSelectTipiDocumento === 'function') aggiornaSelectTipiDocumento();
    renderSidebar();
    renderMain();
    
    // Inizializza tutte le icone statiche dell'HTML
    if (window.lucide) lucide.createIcons();

    switchTab('list');

    // Un unico debounce sincronizzato per renderMain + renderSearchSuggestions
    const debouncedSearch = debounce(() => { renderMain(); renderSearchSuggestions(); }, 150);
    const debouncedRenderMain = debounce(renderMain, 150);

    // Controlla aggiornamenti in background all'avvio senza mostrare popup se è già aggiornato.
    // Salta il check se offline (l'utente potrebbe aprire l'app in aereo/senza rete): evita una
    // chiamata di rete destinata a fallire e un log 'error' inutile.
    const controllaAggiornamentiSeOnline = () => {
        if (typeof window.controllaAggiornamenti === 'function' && navigator.onLine !== false) {
            window.controllaAggiornamenti(false);
        }
    };
    setTimeout(controllaAggiornamentiSeOnline, 2000);
    // Re-check periodico ogni 4h: le sessioni lunghe (app mai riavviata) altrimenti non vedrebbero
    // mai un aggiornamento pubblicato dopo l'avvio. La cache/dedup lato main (updaterIpc.ts) evita
    // comunque richieste ravvicinate se l'utente controlla anche manualmente dalle Impostazioni.
    setInterval(controllaAggiornamentiSeOnline, 4 * 60 * 60 * 1000);

    /**
     * Propone il tutorial senza bloccare: banner in coda alla pagina, non un overlay.
     * Un modal aperto a tempo dopo l'avvio si sovrappone a quello che l'utente ha gia'
     * iniziato a fare e ne mangia i click; per lo stesso motivo l'invito non compare se
     * l'utente e' gia' dentro una scheda o nella trascrizione.
     */
    function mostraInvitoTutorial(settings) {
        const banner = document.getElementById('tutorial-banner');
        const vList = document.getElementById('view-list');
        if (!banner || !vList || vList.classList.contains('hidden-tab')) return;

        const chiudiEDimentica = async () => {
            banner.classList.add('hidden-tab');
            try {
                settings.tutorialCompleted = true;
                await window.apiSettings.save(settings);
            } catch (err) {
                console.error('Salvataggio stato tutorial fallito:', err);
            }
        };

        window.avviaTutorialDaInvito = async () => {
            await chiudiEDimentica();
            if (window.avviaTutorial) window.avviaTutorial();
        };
        window.rifiutaInvitoTutorial = chiudiEDimentica;

        banner.classList.remove('hidden-tab');
        if (window.lucide) lucide.createIcons({ nodes: [banner] });
    }

    setTimeout(() => {
        if (localStorage.getItem('startTutorialOnBoot') === 'true') {
            localStorage.removeItem('startTutorialOnBoot');
            if (window.avviaTutorial) window.avviaTutorial();
        } else if (settings && settings.tutorialCompleted !== true) {
            mostraInvitoTutorial(settings);
        }
    }, 1500);

    // Guard: assicuriamoci di bindare gli eventi globali una sola volta
    if (!window._eventsBound) {
        window._eventsBound = true;

        document.getElementById('search-input').addEventListener('input', debouncedSearch);
        document.getElementById('global-tag-search').addEventListener('input', () => { if (typeof renderTagList === 'function') renderTagList(); });
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

    // Mappa id-modale → funzione di chiusura dedicata (cleanup: reset iframe, callback, ecc.)
    // Overlay che NON vanno chiusi né con Esc né cliccando lo sfondo: sono in mezzo a
    // un'operazione (progresso di sync, finestra di autenticazione).
    const modaliNonChiudibili = ['cloud-progress-overlay', 'cloud-auth-modal', 'email-prompt-modal'];

    const modalClosers = {
        'image-modal': 'chiudiModal',
        'docs-modal': 'chiudiModalDocumenti',
        'rename-modal': 'chiudiRenameModal',
        'settings-modal': 'chiudiImpostazioni',
        'folder-modal': 'chiudiFolderModal',
        'new-type-modal': 'chiudiNewTypeModal',
        'manage-types-modal': 'chiudiManageTypesModal',
        'delete-modal': 'chiudiDeleteModal',
        'unsaved-modal': 'chiudiUnsavedModal',
        'cloud-modal': 'chiudiCloudModal',
        'share-modal': 'chiudiShareModal',
        'changelog-modal': 'chiudiChangelogModal',
        'issue-modal': 'chiudiIssueModal',
        // Fase 5.3 — prima mancavano: Esc li nascondeva con il fallback `hidden-tab`,
        // che sui modali creati e rimossi al volo lasciava il nodo nel DOM, e sui
        // conflitti di sync abbandonava la callback di risoluzione senza annullarla.
        'diff-modal': 'chiudiDiffModal',
        'history-diff-modal': 'chiudiHistoryDiffModal',
        'release-notes-modal': 'chiudiNoteRilascio',
        'merge-conflict-modal': 'annullaSincronizzazioneConflitto',
        'deletion-conflict-modal': 'annullaSincronizzazioneDeletions',
    };

    // Chiusura centralizzata del modale in cima allo stack (riusata da Esc e click sul backdrop).
    // Ritorna false se la chiusura è stata bloccata (es. welcome-modal obbligatorio).
    function chiudiModaleTop(top) {
        if (modaliNonChiudibili.includes(top.id)) return false;

        // Il welcome-modal è chiudibile solo se un workspace esiste già (pulsante chiusura visibile);
        // durante la scelta iniziale è obbligatorio.
        if (top.id === 'welcome-modal') {
            const closeBtn = document.getElementById('welcome-close-btn');
            if (closeBtn && !closeBtn.classList.contains('hidden') && window.chiudiWelcomeModal) {
                window.chiudiWelcomeModal();
                return true;
            }
            return false;
        }

        if (top.id === 'bottom-confirm-banner') {
            const btnCancel = top.querySelector('.btn-ghost');
            if (btnCancel) btnCancel.click();
            else if (window.chiudiBottomConfirm) window.chiudiBottomConfirm();
        } else if (top.id === 'info-confirm-banner') {
            const btnNo = document.getElementById('btn-info-confirm-no');
            if (btnNo) btnNo.click();
            else if (window.chiudiInfoConfirm) window.chiudiInfoConfirm();
        } else {
            const fnName = modalClosers[top.id];
            // I modali costruiti al volo (es. vault-delete-modal) espongono il proprio
            // annulla con data-modal-cancel: cliccarlo esegue anche il resolve della promise.
            const btnAnnulla = top.querySelector('[data-modal-cancel]');
            if (fnName && typeof window[fnName] === 'function') window[fnName]();
            else if (btnAnnulla) btnAnnulla.click();
            else top.classList.add('hidden-tab'); // fallback per modali senza handler dedicato
        }

        if (typeof editingTypeId !== 'undefined') editingTypeId = null;
        return true;
    }

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
                // Il campo vive nel pannello 'search' della sidebar: se e' chiuso o
                // sostituito da un altro tab, il focus finiva su un elemento nascosto.
                if (typeof window.apriSidebarTab === 'function') window.apriSidebarTab('search');
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

        // Esc -> Chiudi SOLO il modale in primo piano (non tutti in blocco) oppure
        // pulisci la barra di ricerca. La chiusura passa per gli handler dedicati così
        // da eseguire i cleanup (reset iframe PDF, callback di annullamento, ecc.).
        if (e.key === 'Escape') {
            const aperti = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden-tab)'));
            if (aperti.length > 0) {
                // Determina il modale in cima allo stack (z-index più alto)
                let top = aperti[0];
                let topZ = -1;
                for (const m of aperti) {
                    const z = parseInt(window.getComputedStyle(m).zIndex) || 0;
                    if (z >= topZ) { topZ = z; top = m; }
                }

                chiudiModaleTop(top);
                return;
            }

            const searchInput = document.getElementById('search-input');
            if (searchInput && document.activeElement === searchInput) {
                searchInput.value = '';
                searchInput.blur();
                if (typeof renderMain === 'function') renderMain();
                if (typeof renderSearchSuggestions === 'function') renderSearchSuggestions();
            }
        }
    });

    window.trascrizioneNonSalvata = false;
    document.getElementById('trascrizione-editor').addEventListener('input', () => {
        window.trascrizioneNonSalvata = true;
    });

    if (window.apiBrowser && window.apiBrowser.onRequestClose) {
        window.apiBrowser.onRequestClose(() => {
            const isEditingRecord = window.isFormDirty && !document.getElementById('view-add')?.classList.contains('hidden-tab');
            
            if (window.trascrizioneNonSalvata) {
                window.isClosingApp = true;
                const modal = document.getElementById('unsaved-modal');
                if (modal) modal.classList.remove('hidden-tab');
            } else if (isEditingRecord && window.mostraBottomConfirm) {
                window.mostraBottomConfirm(window.t('unsaved_prompt') || "Ci sono modifiche non salvate alla scheda. Sei sicuro di voler uscire perdendo le modifiche?", () => {
                    window.apiBrowser.confirmClose();
                });
            } else {
                window.apiBrowser.confirmClose();
            }
        });
    }
    

    // Drag to resize Trascrizione panels
    const resizer = document.getElementById('trascrizione-resizer');
    const leftPanel = document.getElementById('trascrizione-editor-panel');
    const container = document.getElementById('trascrizione-container');

    // Chiusura automatica modali cliccando sullo sfondo (solo sull'overlay, non sul contenuto)
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            // Instrada alle funzioni chiudi* dedicate (cleanup) come il dispatcher Esc;
            // gli overlay non chiudibili sono filtrati dentro chiudiModaleTop, un elenco solo.
            chiudiModaleTop(e.target);
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

// Dispatcher unico per gli inviti: riconosce sia i codici Hub (HUB1|...) sia quelli
// Google Drive legacy. È il punto d'ingresso di deep-link (archiview://join/...) e incolla
// manuale. Il ramo Hub non richiede alcun accesso Google (nessun Picker).
window.handleInviteCode = function(code, isManualInput = false) {
    const procedi = async () => {
        // Chiudi altri modali
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(m => m.classList.add('hidden-tab'));

        // Apri il welcome modal + form di join
        const welcome = document.getElementById('welcome-modal');
        if (welcome) {
            welcome.classList.remove('hidden-tab');
            welcome.style.setProperty('display', 'flex', 'important');
        }
        if (typeof mostraJoinForm === 'function') await mostraJoinForm();

        // Precompila il campo codice e lascia che handleJoinCodeInput (welcomeModal)
        // discrimini Hub vs Drive e imposti gli step corretti.
        setTimeout(() => {
            const input = document.getElementById('welcome-join-code') as HTMLInputElement;
            if (input) {
                input.value = code;
                if (typeof window.handleJoinCodeInput === 'function') window.handleJoinCodeInput(code);
            }
        }, 250);
    };

    const welcome = document.getElementById('welcome-modal');
    if (welcome && welcome.classList.contains('hidden-tab')) {
        if (typeof mostraBottomConfirm === 'function') {
            mostraBottomConfirm(window.t("confirm_join_shared", "Vuoi chiudere l\'Archivio corrente per unirti a un nuovo Archivio Condiviso? Le modifiche locali non salvate potrebbero andare perse."), procedi);
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
        if (typeof mostraMessaggio === 'function', window.t("dialog_export_zip", "Esporta Backup in ZIP")) mostraMessaggio(window.t("msg_esportazione_completata_c", "Esportazione completata con successo!"), "success");
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_esportazione", "Errore in esportazione: ") + res.error, "error");
    }
};

window.esportaCartellaAttuale = async function() {
    window.esportaSpecificaCartella(window.cartellaAttuale);
};

window.esportaSpecificaCartella = async function(folderName) {
    if (!window.apiBrowser || !window.apiBrowser.exportZip) return;
    // Radice ('') = intero vault: esporta tutto, non solo le schede non archiviate.
    const manoscrittiInCartella = folderName
        ? appData.manoscritti.filter(m => m.cartella === folderName || (m.cartella || '').startsWith(folderName + '/'))
        : appData.manoscritti.slice();
    if (manoscrittiInCartella.length === 0) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_l_archivio_vuoto_nulla_da", "L'archivio è vuoto, nulla da esportare."), "warning");
        return;
    }
    const ids = manoscrittiInCartella.map(m => m.id);
    const res = await window.apiBrowser.exportZip(ids);
    if (res.success) {
        if (typeof mostraMessaggio === 'function', window.t("dialog_export_zip", "Esporta Backup in ZIP")) mostraMessaggio(window.t("msg_esportazione_di_var_recor", "Esportazione di {var0} record completata con successo!").replace("{var0}", String(res.count)), "success");
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_esportazione", "Errore in esportazione: ") + res.error, "error");
    }
};

window.importaManoscritto = async function() {
    if (!window.apiBrowser || !window.apiBrowser.importZip) return;
    const res = await window.apiBrowser.importZip(window.t("dialog_import_zip", "Importa Archivio JSON"));
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

        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_importati_var_record_con_", "Importati {var0} record con successo!").replace("{var0}", String(addedCount)), "success");
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
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_importazione", "Errore in importazione: ") + res.error, "error");
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
    const n = (window.selectedRecords && window.selectedRecords.length) || 0;
    // 'hidden' e 'flex' insieme: hidden vince su display:flex solo se flex non c'è.
    bar.classList.toggle('hidden', n === 0);
    bar.classList.toggle('flex', n > 0);
    if (n > 0) {
        const etichetta = n === 1
            ? window.t('selection_count_one', '1 scheda selezionata')
            : window.t('selection_count_many', '{var0} schede selezionate').replace('{var0}', String(n));
        document.getElementById('selection-count').innerText = etichetta;
    }
};

window.azzeraSelezione = function() {
    window.selectedRecords = [];
    window.lastSelectedId = null;
    window.aggiornaSelectionBar();
    if (typeof renderMain === 'function') renderMain();
    if (typeof renderSidebar === 'function') renderSidebar();
};

window.esportaSelezionati = async function() {
    if (window.selectedRecords.length === 0) return;
    if (!window.apiBrowser || !window.apiBrowser.exportZip) return;
    const res = await window.apiBrowser.exportZip(window.selectedRecords);
    if (res.success) {
        if (typeof mostraMessaggio === 'function', window.t("dialog_export_zip", "Esporta Backup in ZIP")) mostraMessaggio(window.t("msg_esportazione_di_var_recor", "Esportazione di {var0} record completata con successo!").replace("{var0}", String(res.count)), "success");
        window.selectedRecords = [];
        window.aggiornaSelectionBar();
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    } else if (!res.canceled) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_esportazione", "Errore in esportazione: ") + res.error, "error");
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
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_eliminati", "{var0} record eliminati.").replace("{var0}", String(count)), "success", () => window.gestoreAnnullamento.annullaUltimaAzione());
        }
    };

    if (typeof window.mostraBottomConfirm === 'function') {
        const msg = count > 1 
            ? window.t("confirm_delete_multiple", "Sei sicuro di voler eliminare {var0} record selezionati? L\'operazione è irreversibile.").replace("{var0}", String(count))
            : window.t("confirm_delete_single", "Sei sicuro di voler eliminare questo record? L\'operazione è irreversibile.");
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
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_copiati_negli_", "{var0} record copiati negli appunti di ArchiView. Tasto destro per incollarli in un altro archivio.").replace("{var0}", String(count)), "info");
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
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_tagliati_tasto", "{var0} record tagliati. Tasto destro per spostarli in un altro archivio.").replace("{var0}", String(count)), "info");
    window.selectedRecords = [];
    window.aggiornaSelectionBar();
    setTimeout(() => {
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    }, 50);
};

// --- CONTEXT MENU ---
// Le voci sono dichiarative; disegno, tastiera e posizionamento stanno in
// components/contextMenu.ts (Fase 4.3). Gli stessi array alimentano il tasto destro
// e i pulsanti overflow "⋯" di card e cartelle, così le due strade non divergono.

// Il tasto destro (o il "⋯") su un record fuori selezione lavora su quel solo record.
window.assicuraSelezioneRecord = function(id) {
    if (!window.selectedRecords.includes(id)) {
        window.selectedRecords = [id];
        window.lastSelectedId = id;
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
        window.aggiornaSelectionBar();
    }
};

window.vociMenuRecord = function(id) {
    const selCount = window.selectedRecords.length;
    const suffisso = selCount > 1 ? ` (${selCount})` : '';
    const voci = [];
    if (selCount === 1) {
        voci.push({ label: window.t('menu_edit_record', 'Rinomina / Modifica'), icon: 'edit-3', onSelect: () => window.editItem(id) });
        voci.push({ label: window.t('btn_transcribe', 'Trascrivi'), icon: 'pen-line', onSelect: () => window.apriTrascrizione(id) });
        voci.push({ separator: true });
    }
    voci.push({ label: window.t('menu_copy', 'Copia') + suffisso, icon: 'copy', onSelect: () => window.copiaSelezionati() });
    voci.push({ label: window.t('menu_cut', 'Taglia') + suffisso, icon: 'scissors', onSelect: () => window.tagliaSelezionati() });
    voci.push({ label: window.t('tooltip_export', 'Esporta') + suffisso, icon: 'upload', onSelect: () => window.esportaSelezionati() });
    voci.push({ separator: true });
    voci.push({ label: window.t('tooltip_delete', 'Elimina') + suffisso, icon: 'trash-2', danger: true, onSelect: () => window.eliminaSelezionati() });
    return voci;
};

window.showRecordContextMenu = function(e, id) {
    window.assicuraSelezioneRecord(id);
    window.apriMenuContestuale(e, window.vociMenuRecord(id));
};

window.showFolderContextMenu = function(e) {
    // Mostra solo se clicchiamo nello sfondo del view-list
    if (e.target.closest('.card-scheda')) return;

    const voceIncolla = window.voceMenuIncolla(null);
    if (voceIncolla) window.apriMenuContestuale(e, [voceIncolla]);
};

// Voce "Incolla" condivisa fra sfondo lista e cartelle: null se non c'è nulla negli appunti.
window.voceMenuIncolla = function(folderPath) {
    const countRecord = (window.copiedRecordIds && window.copiedRecordIds.length) || (window.cutRecordIds && window.cutRecordIds.length) || 0;
    const hasFolderAction = !!(window.cutFolderPath || window.copiedFolderPath);
    if (countRecord === 0 && !hasFolderAction) return null;
    const isMoving = !!((window.cutRecordIds && window.cutRecordIds.length > 0) || window.cutFolderPath);
    // null = sfondo della lista ⇒ "incolla nella cartella corrente". '' e 'ROOT' sono
    // entrambi la radice virtuale, ed è una destinazione esplicita come le altre.
    const destinazione = folderPath === null || folderPath === undefined
        ? undefined
        : (folderPath === 'ROOT' ? '' : folderPath);
    const label = countRecord > 0
        ? (destinazione !== undefined
            ? window.t('menu_paste_here', 'Incolla qui') + ` (${countRecord})`
            : window.t('menu_paste', 'Incolla') + ` (${countRecord})`)
        : window.t('menu_paste_folder_here', 'Incolla cartella qui');
    return {
        label,
        icon: 'clipboard-paste',
        accent: !isMoving,
        accentWarn: isMoving,
        onSelect: () => window.incollaRecord(destinazione)
    };
};

window.vociMenuCartella = function(folderPath) {
    // La radice virtuale ('') non è una cartella vera: si può creare dentro e incollare,
    // ma non rinominare/copiare/eliminare. 'ROOT' = click a vuoto nell'area della sidebar,
    // che è la stessa cosa della radice: senza una riga dedicata nell'albero, quel menu è
    // l'unico posto da cui nasce la prima cartella di un archivio vuoto.
    const isRadice = folderPath === '' || folderPath === 'ROOT';
    const percorsoCreazione = isRadice ? '' : folderPath;
    const voci = [];

    voci.push({ label: window.t('menu_new_record_here', 'Crea nuova scheda'), icon: 'file-plus', onSelect: () => window.creaSchedaContext(percorsoCreazione) });
    voci.push({ label: window.t('menu_new_folder_here', 'Crea nuova cartella'), icon: 'folder-plus', onSelect: () => window.mostraAggiungiCartellaContext(percorsoCreazione) });

    if (!isRadice) {
        voci.push({ separator: true });
        voci.push({ label: window.t('menu_rename_folder', 'Rinomina cartella'), icon: 'edit-2', onSelect: () => window.rinominaCartellaDaSidebar(folderPath) });
        voci.push({ label: window.t('tooltip_export_folder', 'Esporta cartella'), icon: 'upload', onSelect: () => window.esportaSpecificaCartella(folderPath) });
        voci.push({ label: window.t('menu_open_in_explorer', 'Apri in Esplora Risorse'), icon: 'folder-open', onSelect: () => window.apriCartellaInEsploraRisorse(folderPath) });
        voci.push({ separator: true });
        voci.push({ label: window.t('menu_copy_folder', 'Copia cartella'), icon: 'copy', onSelect: () => window.copiaCartella(folderPath) });
        voci.push({ label: window.t('menu_cut_folder', 'Taglia cartella'), icon: 'scissors', onSelect: () => window.tagliaCartella(folderPath) });
        voci.push({ label: window.t('menu_delete_folder', 'Elimina cartella'), icon: 'trash-2', danger: true, onSelect: () => window.eliminaCartellaDaSidebar(folderPath) });
    }

    const voceIncolla = window.voceMenuIncolla(folderPath);
    if (voceIncolla) {
        if (voci.length > 0) voci.push({ separator: true });
        voci.push(voceIncolla);
    }
    return voci;
};

window.showSidebarFolderContextMenu = function(e, folderPath) {
    e.preventDefault();
    e.stopPropagation();
    const voci = window.vociMenuCartella(folderPath);
    if (voci.length === 0) {
        // ROOT senza appunti: niente da mostrare, ma il menu del sistema resta soppresso
        return;
    }
    window.apriMenuContestuale(e, voci);
};

window.copiaCartella = function(folderPath) {
    window.copiedFolderPath = folderPath;
    window.cutFolderPath = null;
    window.cutRecordIds = [];
    window.copiedRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_cartella_copiata_tasto_de", "Cartella copiata. Tasto destro su un'altra cartella per incollarla."), "info");
};

window.apriCartellaInEsploraRisorse = async function(folderPath) {
    if (window.apiBrowser && window.apiBrowser.apriCartellaWorkspace) {
        const success = await window.apiBrowser.apriCartellaWorkspace();
        if (!success) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_impossibile_aprire_la_car", "Impossibile aprire la cartella in Esplora Risorse."), "error");
        }
    }
};

// Nota: nessuna chiamata a selectItem qui — passava un percorso di cartella come id di
// record, sporcando window.selectedRecords. L'evidenziazione della cartella nell'albero
// dipende già da window.cartellaAttuale.
window.creaSchedaContext = function(folderPath) {
    window.cartellaAttuale = folderPath;
    if (typeof switchTab === 'function') switchTab('add');
};

window.mostraAggiungiCartellaContext = function(folderPath) {
    window.cartellaAttuale = folderPath;
    if (typeof aggiungiCartella === 'function') aggiungiCartella();
};

window.tagliaCartella = function(folderPath) {
    if (!folderPath) return; // la radice virtuale non si taglia
    window.cutFolderPath = folderPath;
    window.copiedFolderPath = null;
    window.cutRecordIds = [];
    window.copiedRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_cartella_tagliata_tasto_d", "Cartella tagliata. Tasto destro per spostarla."), "info");
};
window.copiaRecordSingolo = function(id) {
    window.copiedRecordIds = [id];
    window.cutRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_record_copiato_tasto_dest", "Record copiato. Tasto destro per incollarlo in una cartella."), "info");
};

window.tagliaRecordSingolo = function(id) {
    window.cutRecordIds = [id];
    window.copiedRecordIds = [];
    if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_record_tagliato_tasto_des", "Record tagliato. Tasto destro per spostarlo in un altro archivio."), "info");
};

window.incollaRecord = async function(targetFolderOverride) {
    // ?? e non ||: '' è la radice, una destinazione valida, non un valore "assente".
    const targetFolder = targetFolderOverride ?? window.cartellaAttuale ?? '';

    // Se stiamo spostando un intero archivio (Taglia Archivio)
    if (window.cutFolderPath) {
        if (typeof spostaCartella === 'function') {
            // spostaCartella parla il dialetto 'ROOT' per la radice
            await spostaCartella(window.cutFolderPath, targetFolder === '' ? 'ROOT' : targetFolder);
            window.cutFolderPath = null;
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_archivio_spostato_con_suc", "Archivio spostato con successo!"), "success");
        }
        return;
    }

    // Se stiamo copiando un intero archivio (Copia Archivio)
    if (window.copiedFolderPath) {
        // Estraiamo gli ID dei record della cartella copiata
        const prefix = window.copiedFolderPath + '/';
        const manoscrittiDaCopiare = appData.manoscritti.filter(m => m.cartella === window.copiedFolderPath || (m.cartella && m.cartella.startsWith(prefix)));
        
        if (manoscrittiDaCopiare.length === 0) {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_l_archivio_copiato_vuoto", "L'archivio copiato è vuoto."), "warning");
            window.copiedFolderPath = null;
            return;
        }

        const idsToCopy = manoscrittiDaCopiare.map(m => m.id);
        
        // Determiniamo la cartella destinazione (sotto-cartella del target con il nome dell'archivio copiato)
        const nomeArchivioCopiato = window.copiedFolderPath.split('/').pop();
        const baseTarget = (targetFolder === 'ROOT' || targetFolder === '') ? nomeArchivioCopiato : `${targetFolder}/${nomeArchivioCopiato}`;

        if (!window.apiBrowser || !window.apiBrowser.duplicateRecords) return;
        const res = await window.apiBrowser.duplicateRecords(idsToCopy, baseTarget);

        if (res.success) {
            // Assicuriamoci che la nuova cartella esista nel db
            if (!appData.cartelle.includes(baseTarget)) {
                appData.cartelle.push(baseTarget);
            }
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_archivio_duplicato_con_su", "Archivio duplicato con successo ({var0} record)!").replace("{var0}", String(res.count)), "success");
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
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_duplicazione_ar", "Errore in duplicazione archivio: ") + res.error, "error");
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
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_spostati_con_s", "{var0} record spostati con successo!").replace("{var0}", String(movedCount)), "success");
            window.cutRecordIds = []; // Reset dopo lo spostamento
        }
        return;
    }

    // Se stiamo incollando record copiati (Duplicazione singolo/multiplo)
    if (!window.copiedRecordIds || window.copiedRecordIds.length === 0) return;
    if (!window.apiBrowser || !window.apiBrowser.duplicateRecords) return;
    
    const res = await window.apiBrowser.duplicateRecords(window.copiedRecordIds, targetFolder);
    
    if (res.success) {
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_var_record_duplicati_con_", "{var0} record duplicati con successo!").replace("{var0}", String(res.count)), "success");
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
        if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_errore_in_incolla", "Errore in incolla: ") + res.error, "error");
    }
};

function mostraErroreAccessoNegato(account: string) {
    const overlay = document.createElement('div');
    overlay.id = 'accesso-negato-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(12,10,9,0.6);backdrop-filter:blur(6px)';
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:44px 40px 36px;max-width:440px;width:90%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.25);border:1px solid #e7e5e4">
            <div style="width:64px;height:64px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
                <svg width="32" height="32" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h2 style="font-size:1.25rem;font-weight:700;color:#1c1917;margin:0 0 10px">Accesso Negato</h2>
            <p style="color:#57534e;line-height:1.6;margin:0 0 6px">L'account <strong id="_an_account"></strong> non è autorizzato ad accedere a questo Archivio Condiviso.</p>
            <p style="color:#78716c;font-size:0.875rem;margin:0 0 28px">Accedi con l'account Google invitato dal proprietario, oppure scegli un altro archivio.</p>
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
                <button id="_an_btn_login" style="background:#1c1917;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer">Cambia Account Google</button>
                <button id="_an_btn_back" style="background:#fff;color:#1c1917;border:1px solid #d6d3d1;padding:10px 22px;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer">Scegli Altro Archivio</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const accountEl = overlay.querySelector('#_an_account') as HTMLElement;
    if (accountEl) accountEl.textContent = account || 'corrente';

    (overlay.querySelector('#_an_btn_login') as HTMLButtonElement).addEventListener('click', async () => {
        try {
            await window.apiDrive.auth(true);
            overlay.remove();
            location.reload();
        } catch (e) { /* utente ha annullato il login */ }
    });

    (overlay.querySelector('#_an_btn_back') as HTMLButtonElement).addEventListener('click', async () => {
        overlay.remove();
        if (typeof mostraWelcomeModal === 'function') await mostraWelcomeModal();
    });
}

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
