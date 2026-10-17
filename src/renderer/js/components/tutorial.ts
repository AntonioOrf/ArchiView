window.avviaTutorial = async function () {
    if (window.dInstance) {
        try { window.dInstance.destroy(); } catch (_) {}
        window.dInstance = null;
    }

    const rawDriver = window.driver;
    if (!rawDriver) {
        console.error("Driver.js non caricato!");
        return;
    }
    const driverObj = rawDriver?.js?.driver ?? rawDriver?.driver ?? rawDriver;
    if (typeof driverObj !== 'function') {
        console.error("Driver.js: costruttore non trovato nel namespace:", rawDriver);
        return;
    }

    let isTutorialWorkspace = false;
    if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
        const wp = await window.apiBrowser.getWorkspacePath();
        if (wp && wp.endsWith('Tutorial_Archive')) {
            isTutorialWorkspace = true;
        }
    }
    const isCloud = !!(window.statoCloud && window.statoCloud.vaultCloud);
    const isAuthenticated = !!(window.driveStatus && window.driveStatus.isAuthenticated);

    if (typeof appData !== 'undefined' && !isTutorialWorkspace) {
        if (!appData.manoscritti) appData.manoscritti = [];
        const isEmptyOrFake = appData.manoscritti.length === 0 ||
            (appData.manoscritti.length === 1 && appData.manoscritti[0].id === 'test-doc-tutorial');

        if (isEmptyOrFake) {
            if (window.mostraBottomConfirm && window.apiBrowser && window.apiBrowser.loadTutorialWorkspace) {
                window.mostraBottomConfirm(
                    window.t('tutorial_offri_archivio', "L'archivio è vuoto. Vuoi caricare l'Archivio Tutorial preimpostato (con file PDF e schede d'esempio) per seguire al meglio la guida?"),
                    async () => {
                        localStorage.setItem('startTutorialOnBoot', 'true');
                        try {
                            const res = await window.apiBrowser.loadTutorialWorkspace();
                            if (!res.success) {
                                console.error("Errore caricamento Tutorial:", res.error);
                                localStorage.removeItem('startTutorialOnBoot');
                                if (window.mostraMessaggio) window.mostraMessaggio(window.t('tutorial_err_caricamento', "Errore nel caricamento del Tutorial: ") + res.error, 'error');
                            }
                        } catch (e) {
                            console.error("Eccezione caricamento Tutorial:", e);
                            localStorage.removeItem('startTutorialOnBoot');
                            if (window.mostraMessaggio) window.mostraMessaggio(window.t('tutorial_err_imprevisto', "Errore imprevisto nel caricamento del Tutorial."), 'error');
                        }
                    }
                );
                return;
            } else {
                if (!appData.cartelle) appData.cartelle = [];
                if (!appData.cartelle.includes('Tutorial')) {
                    appData.cartelle.push('Tutorial');
                }
                appData.manoscritti.push({
                    id: 'test-doc-tutorial',
                    cartella: 'Tutorial',
                    tipoDocumento: 'manoscritto',
                    titolo: 'Esempio di Scheda',
                    segnatura: 'Documento di Esempio',
                    tags: 'tutorial, esempio',
                    note: 'Questo è un documento generato automaticamente per farti esplorare le funzionalità di ArchiView.',
                    allegati: [],
                    trascrizione: '<p>Benvenuto nell\'editor di trascrizione! Qui puoi annotare i tuoi documenti in modo strutturato.</p>'
                });
                try {
                    await window.Store.commit();
                } catch (e) {
                    console.error("Errore salvataggio dati tutorial:", e);
                }
            }
        }
    }

    if (typeof appData !== 'undefined' && appData.manoscritti && appData.manoscritti.length > 0) {
        const testRecord = appData.manoscritti.find(m => m.id === 'TUTORIAL_1' || m.id === 'test-doc-tutorial');
        if (testRecord && testRecord.cartella) {
            if (window.cartellaAttuale !== testRecord.cartella) {
                window.cartellaAttuale = testRecord.cartella;
                if (!window.cartelleEspanse) window.cartelleEspanse = new Set();
                window.cartelleEspanse.add(testRecord.cartella);
                let parentPath = testRecord.cartella;
                while (parentPath.includes('/')) {
                    parentPath = parentPath.substring(0, parentPath.lastIndexOf('/'));
                    window.cartelleEspanse.add(parentPath);
                }
                if (window.renderSidebar) window.renderSidebar();
                if (window.renderMain) window.renderMain();
            }
        }
    }

    let stepAC = null;

    function attachOnce(el, delay = 150) {
        stepAC?.abort();
        stepAC = new AbortController();
        if (el) el.addEventListener('click', () => setTimeout(() => window.dInstance?.moveNext(), delay), { once: true, signal: stepAC.signal });
    }

    function attachModalButtons(selector, clickAttrs, delay = 300) {
        stepAC?.abort();
        stepAC = new AbortController();
        const advance = () => setTimeout(() => window.dInstance?.moveNext(), delay);
        document.querySelectorAll(selector).forEach(btn => {
            if (clickAttrs.includes(btn.getAttribute('data-on-click'))) {
                btn.addEventListener('click', advance, { once: true, signal: stepAC.signal });
            }
        });
    }

    const steps: any[] = [
        {
            element: 'body',
            popover: {
                title: window.t('tut_welcome_title', 'Benvenuto in ArchiView'),
                description: window.t('tut_welcome_desc', 'Una visita veloce ai comandi principali. Premi "Avanti" per cominciare.'),
                side: "over",
                align: 'start'
            }
        },
        {
            element: 'header',
            popover: {
                title: window.t('tut_toolbar_title', 'Barra degli strumenti'),
                description: window.t('tut_toolbar_desc', 'A sinistra i pannelli di navigazione (cartelle, ricerca, tag, modifiche, storico); a destra lo stato della sincronizzazione cloud. Le azioni sui documenti sono nella barra sopra l\'elenco.'),
                side: "bottom",
                align: 'start'
            }
        },
        {
            element: 'button[data-on-click="apriNewTypeModal"]',
            popover: {
                title: window.t('tut_models_title', 'Modelli di documento'),
                description: window.t('tut_models_desc', 'Da qui crei o modifichi i modelli di documento. Un modello stabilisce quali campi (per esempio Data, Autore, Note) compaiono nella scheda.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => attachOnce(el, 300)
        },
        {
            element: '#new-type-modal .modal-window',
            popover: {
                title: window.t('tut_new_model_title', 'Nuovo modello'),
                description: window.t('tut_new_model_desc', 'Qui scegli un modello predefinito o ne costruisci uno con i tuoi campi. Chiudi la finestra (X o Annulla) per proseguire.'),
                side: "left",
                align: 'start',
                showButtons: []
            },
            onHighlighted: () => attachModalButtons('#new-type-modal button', ['chiudiNewTypeModal', 'confermaCreaTipo']),
            onPrevClick: () => {
                if (window.chiudiNewTypeModal) window.chiudiNewTypeModal();
                setTimeout(() => window.dInstance?.movePrevious(), 150);
            }
        },
        {
            element: '[data-tab="search"]',
            popover: {
                title: window.t('tut_search_title', 'Ricerca'),
                description: window.t('tut_search_desc', 'Clicca sulla lente per aprire la ricerca.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => attachOnce(el)
        },
        {
            element: '#sidebar-search',
            popover: {
                title: window.t('tut_search_engine_title', 'Cercare nell\'archivio'),
                description: window.t('tut_search_engine_desc', 'La ricerca guarda nei metadati, nei titoli e nelle trascrizioni, e aggiorna i risultati mentre scrivi.'),
                side: "right",
                align: 'start'
            }
        },
        {
            element: '[data-tab="tags"]',
            popover: {
                title: window.t('tut_tags_title', 'Tag'),
                description: window.t('tut_tags_desc', 'Clicca sull\'icona a segnalibro per aprire i tag.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => attachOnce(el)
        },
        {
            element: '#sidebar-tags',
            popover: {
                title: window.t('tut_tags_filter_title', 'Filtrare per tag'),
                description: window.t('tut_tags_filter_desc', 'Qui trovi tutte le etichette usate nell\'archivio. Un clic su un tag filtra l\'elenco.'),
                side: "right",
                align: 'start'
            }
        }
    ];

    if (isCloud) {
        steps.push({
            element: '#cloud-status-btn',
            popover: {
                title: window.t('tut_cloud_sync_title', 'Stato della sincronizzazione'),
                description: window.t('tut_cloud_sync_desc', 'Qui vedi in una riga lo stato dell\'archivio remoto: sincronizzato, aggiornamenti in entrata o modifiche locali da inviare. Il clic apre Fetch, Scarica, Carica e il collegamento al Controllo Modifiche.'),
                side: "bottom",
                align: 'start'
            }
        });
        steps.push({
            element: '#btn-tab-source-control',
            popover: {
                title: window.t('tut_source_control_title', 'Controllo modifiche'),
                description: window.t('tut_source_control_desc', 'Clicca sull\'icona del Controllo modifiche per vedere che cosa non hai ancora inviato.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => attachOnce(el)
        });
        steps.push({
            element: '#sidebar-source-control',
            popover: {
                title: window.t('tut_source_status_title', 'Modifiche da inviare'),
                description: window.t('tut_source_status_desc', 'Qui compaiono le modifiche fatte su questo computer. Prima di sincronizzare puoi rivederle e annullare quelle che non vuoi tenere.'),
                side: "right",
                align: 'start'
            }
        });
        steps.push({
            element: '#btn-tab-history',
            popover: {
                title: window.t('tut_history_title', 'Storico delle versioni'),
                description: window.t('tut_history_desc', 'Clicca qui per vedere le versioni dell\'archivio salvate sul cloud.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => attachOnce(el)
        });
        steps.push({
            element: '#sidebar-history',
            popover: {
                title: window.t('tut_history_panel_title', 'Storico'),
                description: window.t('tut_history_panel_desc', 'Da qui sfogli le versioni precedenti dell\'archivio, le apri in sola lettura e puoi ripristinare l\'archivio a una di esse.'),
                side: "right",
                align: 'start'
            }
        });
    } else {
        steps.push({
            element: '#sidebar-cloud-btn',
            popover: {
                title: window.t('tut_cloud_integration_title', 'Condivisione e cloud'),
                description: window.t('tut_cloud_integration_desc', 'Questo archivio è solo locale. Clicca sull\'icona Condivisione in basso a sinistra per vedere come condividerlo o farne il backup.'),
                side: "right",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => attachOnce(el, 300)
        });
        if (isAuthenticated) {
            steps.push({
                element: '#cloud-modal',
                popover: {
                    title: window.t('tut_cloud_panel_title', 'Condividere l\'archivio'),
                    description: window.t('tut_cloud_panel_desc', 'Da qui l\'archivio locale diventa Condiviso, per lavorare in gruppo, o Personale, con backup automatico. Chiudi la finestra per proseguire.'),
                    side: "left",
                    align: 'start',
                    showButtons: []
                },
                onHighlighted: () => {
                    stepAC?.abort();
                    stepAC = new AbortController();
                    const cloudModal = document.getElementById('cloud-modal');
                    let cloudObs = null;
                    const advanceNext = () => { cloudObs?.disconnect(); authObs.disconnect(); setTimeout(() => window.dInstance?.moveNext(), 300); };
                    if (cloudModal && !cloudModal.classList.contains('hidden-tab')) {
                        cloudObs = new MutationObserver(() => { if (cloudModal.classList.contains('hidden-tab')) advanceNext(); });
                        cloudObs.observe(cloudModal, { attributes: true, attributeFilter: ['class'] });
                    }
                    const authObs = new MutationObserver((mutations) => {
                        for (const m of mutations) {
                            for (const node of Array.from(m.addedNodes) as HTMLElement[]) {
                                if (node.id === 'cloud-auth-modal') {
                                    const cancelBtn = node.querySelector('#btn-cloud-auth-no');
                                    if (cancelBtn) cancelBtn.addEventListener('click', () => setTimeout(() => { if (window.chiudiCloudModal) window.chiudiCloudModal(); }, 350), { once: true });
                                }
                            }
                        }
                    });
                    authObs.observe(document.body, { childList: true });
                    stepAC.signal.addEventListener('abort', () => { cloudObs?.disconnect(); authObs.disconnect(); });
                },
                onPrevClick: () => {
                    if (window.chiudiCloudModal) window.chiudiCloudModal();
                    setTimeout(() => window.dInstance?.movePrevious(), 150);
                }
            });
        } else {
            let cloudStepDone = false;
            const advanceOnce = () => {
                if (cloudStepDone) return;
                cloudStepDone = true;
                window.dInstance?.moveNext();
            };
            steps.push({
                element: '#cloud-auth-modal .modal-window',
                popover: {
                    title: window.t('tut_cloud_panel_title', 'Condividere l\'archivio'),
                    description: window.t('tut_cloud_no_auth_desc', 'Non hai ancora fatto l\'accesso a Google. Puoi farlo ora per provare le funzioni cloud, oppure proseguire la visita senza.'),
                    side: "right",
                    align: 'center',
                    showButtons: ['next', 'previous'],
                    nextBtnText: window.t('btn_login_google', 'Accedi con Google'),
                    prevBtnText: window.t('tut_btn_prosegui', 'Prosegui'),
                    onPrevClick: () => {
                        const cancelBtn = document.getElementById('btn-cloud-auth-no');
                        if (cancelBtn) cancelBtn.click();
                        else document.getElementById('cloud-auth-modal')?.remove();
                        advanceOnce();
                    },
                    onNextClick: () => {
                        const googleBtn = document.getElementById('btn-cloud-auth-google');
                        if (!googleBtn) { advanceOnce(); return; }
                        googleBtn.click();
                        const cloudModal = document.getElementById('cloud-modal');
                        if (!cloudModal) { advanceOnce(); return; }
                        const obs = new MutationObserver(() => {
                            if (!cloudModal.classList.contains('hidden-tab')) {
                                obs.disconnect();
                                advanceOnce();
                            }
                        });
                        obs.observe(cloudModal, { attributes: true, attributeFilter: ['class'] });
                        stepAC?.signal.addEventListener('abort', () => obs.disconnect());
                    },
                },
                onHighlighted: () => {
                    stepAC?.abort();
                    stepAC = new AbortController();
                    cloudStepDone = false;
                    const realCancel = document.getElementById('btn-cloud-auth-no');
                    if (realCancel) realCancel.addEventListener('click', () => advanceOnce(), { once: true, signal: stepAC.signal });
                }
            });
        }
    }

    steps.push({
        element: 'button[data-on-click="toggleVaultSwitcher"]',
        popover: {
            title: window.t('tut_vaults_title', 'Archivi'),
            description: window.t('tut_vaults_desc', 'Puoi tenere quanti archivi vuoi, separati fra loro. Da questo pulsante passi da uno all\'altro, ne crei di nuovi in locale, ne colleghi uno remoto o entri in un archivio condiviso.'),
            side: "right",
            align: 'start'
        }
    });

    steps.push({
        element: '[data-tab="folders"]',
        popover: {
            title: window.t('tut_nav_return_title', 'Torna alle cartelle'),
            description: window.t('tut_nav_return_desc', 'Clicca sull\'icona a forma di cartella per tornare all\'elenco delle schede.'),
            side: "bottom",
            align: 'start',
            showButtons: ['close']
        },
        onHighlightStarted: () => {
            if (window.chiudiCloudModal) window.chiudiCloudModal();
        },
        onHighlighted: (el) => {
            stepAC?.abort();
            stepAC = new AbortController();
            if (el) el.addEventListener('click', () => {
                const vList = document.getElementById('view-list');
                if (vList && vList.classList.contains('hidden-tab') && window.switchTab) {
                    window.switchTab('list');
                }
                setTimeout(() => window.dInstance?.moveNext(), 150);
            }, { once: true, signal: stepAC.signal });
        }
    });

    steps.push({
        element: '#btn-vista-tabella',
        popover: {
            title: window.t('tut_sort_title', 'Ordinamento e tabella'),
            description: window.t('tut_sort_desc', 'L\'elenco si ordina per segnatura, per un campo del tipo di documento, per data di modifica o per numero di allegati. Questo comando alterna la griglia di schede alla tabella: lì ogni intestazione di colonna ordina, e le colonne visibili si scelgono per tipo di documento.'),
            side: "bottom",
            align: 'end'
        }
    });

    steps.push({
        element: '#btn-filtri',
        popover: {
            title: window.t('tut_filters_title', 'Filtri e ricerche salvate'),
            description: window.t('tut_filters_desc', 'Oltre alla ricerca testuale puoi restringere l\'elenco per tipo di documento, sottocartelle, data di modifica, presenza di allegati o di trascrizione. La ricerca accetta anche campo:valore (per esempio notaio:rossi). Una combinazione di filtri si salva con un nome e si richiama in seguito.'),
            side: "bottom",
            align: 'end'
        }
    });

    steps.push({
        element: '#context-overflow-slot button',
        popover: {
            title: window.t('tut_palette_title', 'Comandi rapidi'),
            description: window.t('tut_palette_desc', 'Ctrl+K apre l\'elenco dei comandi: da un unico campo raggiungi una scheda, una cartella, una nuova scheda di un tipo preciso o qualunque altra azione. Il tasto ? mostra tutte le scorciatoie. Entrambi sono anche in questo menu.'),
            side: "bottom",
            align: 'end'
        }
    });

    steps.push({
        element: '.card-scheda',
        popover: {
            title: window.t('tut_bulk_title', 'Azioni su più schede'),
            description: window.t('tut_bulk_desc', 'Ctrl+clic e Maiusc+clic selezionano più schede; Ctrl+A prende tutti i risultati del filtro, anche delle pagine successive. Il menu del tasto destro applica l\'azione a tutta la selezione: spostare in una cartella, cambiare tipo di documento, aggiungere o togliere tag, sostituire testo in un campo. Prima di confermare vedi quante schede cambiano, e puoi annullare.'),
            side: 'bottom',
            align: 'start'
        }
    });

    steps.push({
        element: '.tutorial-modifica-btn',
        popover: {
            title: window.t('tut_card_edit_title', 'Aprire una scheda'),
            description: window.t('tut_card_edit_desc', 'Il pulsante "Modifica" su una scheda apre i suoi metadati.'),
            side: "bottom",
            align: 'start',
            showButtons: ['close']
        },
        onHighlighted: (el) => attachOnce(el)
    });

    steps.push({
        element: '#view-add',
        popover: {
            title: window.t('tut_editor_title', 'Modulo della scheda'),
            description: window.t('tut_editor_desc', 'Qui compili i campi della scheda e gestisci i suoi allegati. I comandi di salvataggio restano sempre visibili. La freccia in alto a sinistra riporta all\'archivio.'),
            side: "left",
            align: 'start',
            showButtons: ['close']
        },
        onHighlighted: () => {
            setTimeout(() => {
                const main = document.querySelector('main');
                if (main) main.scrollTo({ top: 0, behavior: window.comportamentoScroll() });
            }, 50);
            stepAC?.abort();
            stepAC = new AbortController();
            const backBtn = document.getElementById('btn-back-to-list');
            if (backBtn) backBtn.addEventListener('click', () => setTimeout(() => window.dInstance?.moveNext(), 150), { once: true, signal: stepAC.signal });
        },
        onPrevClick: () => {
            const vList = document.getElementById('view-list');
            if (vList && vList.classList.contains('hidden-tab') && window.switchTab) {
                window.switchTab('list');
            }
            setTimeout(() => window.dInstance?.movePrevious(), 150);
        }
    });

    steps.push({
        element: '.tutorial-trascrivi-btn',
        popover: {
            title: window.t('tut_transcribe_title', 'Trascrizione'),
            description: window.t('tut_transcribe_desc', 'Ora clicca su "Trascrivi" in una scheda per aprire l\'ambiente di trascrizione.'),
            side: "bottom",
            align: 'start',
            showButtons: ['close']
        },
        onHighlighted: (el) => attachOnce(el, 200),
        onPrevClick: () => {
            if (window.switchTab) window.switchTab('add');
            setTimeout(() => window.dInstance?.movePrevious(), 150);
        }
    });

    steps.push({
        element: '#trascrizione-allegato-panel:not(.hidden-tab)',
        popover: {
            title: window.t('tut_viewer_title', 'Il visore delle immagini'),
            description: window.t('tut_viewer_desc', 'Nel visore puoi ingrandire (rotella o tasti + e −), spostare l\'immagine, ruotarla di 90° (tasto R) e adattarla alla pagina o alla larghezza. Luminosità, contrasto e negativo aiutano con le scritture difficili. Alt+← e Alt+→ passano da un allegato all\'altro della scheda.'),
            side: "right",
            align: 'start'
        },
        onPrevClick: () => {
            const vList = document.getElementById('view-list');
            if (vList && vList.classList.contains('hidden-tab') && window.switchTab) {
                window.switchTab('list');
            }
            setTimeout(() => window.dInstance?.movePrevious(), 150);
        }
    });

    steps.push({
        element: '#view-trascrizione',
        popover: {
            title: window.t('tut_transcribe_env_title', 'Ambiente di trascrizione'),
            description: window.t('tut_transcribe_env_desc', 'L\'immagine del documento sta accanto all\'editor. Salva spesso con Ctrl+S. La freccia in alto a sinistra riporta all\'archivio.'),
            side: "over",
            align: 'start',
            showButtons: ['close']
        },
        onHighlighted: () => {
            stepAC?.abort();
            stepAC = new AbortController();
            const backBtn = document.getElementById('btn-back-to-list-trasc');
            if (backBtn) backBtn.addEventListener('click', () => setTimeout(() => window.dInstance?.moveNext(), 150), { once: true, signal: stepAC.signal });
        },
        onPrevClick: () => {
            setTimeout(() => window.dInstance?.movePrevious(), 150);
        }
    });

    steps.push({
        element: '#sidebar',
        popover: {
            title: window.t('tut_context_menu_title', 'Il tasto destro'),
            description: window.t('tut_context_menu_desc', 'Il tasto destro su schede, cartelle e archivi apre un menu con esportazione, duplicazione, eliminazione e le altre azioni.'),
            side: "right",
            align: 'start'
        },
        onHighlightStarted: () => {
            return new Promise<void>((resolve) => {
                if (window.switchTab) {
                    window.switchTab('list');
                    setTimeout(resolve, 100);
                } else {
                    resolve();
                }
            });
        }
    });

    steps.push({
        element: 'body',
        popover: {
            title: window.t('tut_done_title', 'Fatto'),
            description: window.t('tut_done_desc', 'Puoi rifare questa visita quando vuoi dall\'icona (?).'),
            side: "over",
            align: 'start'
        }
    });

    window.dInstance = driverObj({
        showProgress: true,
        allowClose: false,
        onCloseClick: () => { if (window.dInstance) window.dInstance.destroy(); },
        showButtons: ['next', 'close'],
        onPopoverRender: (popover) => {
            if (popover.closeButton) {
                popover.closeButton.style.display = 'block';
            }
        },
        onDestroyStarted: () => {
            stepAC?.abort();
            stepAC = null;
        },
        steps: steps,
        nextBtnText: window.t('tut_btn_next', 'Avanti'),
        prevBtnText: window.t('tut_btn_prev', 'Indietro'),
        doneBtnText: window.t('tut_btn_done', 'Fine')
    });

    window.dInstance.drive();

    if (window.apiSettings) {
        try {
            const settings = await window.apiSettings.get();
            if (!settings.tutorialCompleted) {
                await window.apiSettings.patch({ tutorialCompleted: true });
            }
        } catch (e) {
            console.error("Errore persistenza tutorialCompleted:", e);
        }
    }
};
