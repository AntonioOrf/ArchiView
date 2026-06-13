// @ts-nocheck
window.avviaTutorial = async function() {
    // Verifichiamo che la libreria sia stata caricata
    if (typeof window.driver === 'undefined') {
        if (typeof window.driver !== 'undefined' && window.driver.js) {
             window.driver = window.driver.js; // iife version places it here sometimes
        } else if (typeof window.driver !== 'undefined' && window.driver.driver) {
             window.driver = window.driver.driver;
        } else {
             console.error("Driver.js non caricato!");
             return;
        }
    }
    
    // Il modulo driver è caricato globalmente come window.driver.js.driver o window.driver
    const driverObj = window.driver.js ? window.driver.js.driver : (window.driver.driver ? window.driver.driver : window.driver);

    // Controlliamo se i bottoni cloud sono visibili
    const cloudButtons = document.getElementById('cloud-buttons-container');
    const isCloud = cloudButtons && !cloudButtons.classList.contains('hidden');

    // Controlliamo se stiamo già nel workspace del tutorial
    let isTutorialWorkspace = false;
    if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
        const wp = await window.apiBrowser.getWorkspacePath();
        if (wp && wp.endsWith('Tutorial_Archive')) {
            isTutorialWorkspace = true;
        }
    }

    // Se l'archivio è vuoto e non siamo nel workspace tutorial, proponiamo di caricare l'ambiente tutorial
    if (typeof appData !== 'undefined' && !isTutorialWorkspace) {
        if (!appData.manoscritti) appData.manoscritti = [];
        const isEmptyOrFake = appData.manoscritti.length === 0 || 
                              (appData.manoscritti.length === 1 && appData.manoscritti[0].id === 'test-doc-tutorial');
        
        if (isEmptyOrFake) {
            if (window.mostraBottomConfirm && window.apiBrowser && window.apiBrowser.loadTutorialWorkspace) {
                window.mostraBottomConfirm(
                    "L'archivio è vuoto. Vuoi caricare l'Archivio Tutorial preimpostato (con file PDF e schede d'esempio) per seguire al meglio la guida?",
                    async () => {
                        localStorage.setItem('startTutorialOnBoot', 'true');
                        const res = await window.apiBrowser.loadTutorialWorkspace();
                        if (!res.success) {
                            alert("Errore nel caricamento del Tutorial: " + res.error);
                            localStorage.removeItem('startTutorialOnBoot');
                        }
                    }
                );
                return; // Stop current execution, wait for confirm/reload
            } else {
                // Fallback: crea record fittizio
                if (!appData.cartelle) appData.cartelle = [];
                if (!appData.cartelle.find(c => c.nome === 'Tutorial')) {
                    appData.cartelle.push({ id: 'cartella-tutorial', nome: 'Tutorial', createdAt: new Date().toISOString() });
                }
                appData.manoscritti.push({
                    id: 'test-doc-tutorial',
                    cartella: 'cartella-tutorial',
                    tipo: 'Manoscritto',
                    titolo: 'Esempio di Scheda',
                    segnatura: 'Documento di Esempio',
                    tags: 'tutorial, esempio',
                    note: 'Questo è un documento generato automaticamente per farti esplorare le funzionalità di ArchiView.',
                    allegati: [],
                    text: '<p>Benvenuto nell\'editor di trascrizione! Qui puoi annotare i tuoi documenti in modo strutturato.</p>'
                });
                if (window.salvaDatiApp) await window.salvaDatiApp();
                if (window.renderMain) window.renderMain();
            }
        }
    }

    // Se stiamo nel workspace del tutorial (o c'è un file di test), assicuriamoci di aprire la cartella in cui si trovano le schede
    if (typeof appData !== 'undefined' && appData.manoscritti && appData.manoscritti.length > 0) {
        const testRecord = appData.manoscritti.find(m => m.id === 'TUTORIAL_1' || m.id === 'test-doc-tutorial');
        if (testRecord && testRecord.cartella) {
            if (window.cartellaAttuale !== testRecord.cartella) {
                window.cartellaAttuale = testRecord.cartella;
                // Espandi la cartella se non lo è
                if (!window.cartelleEspanse) window.cartelleEspanse = new Set();
                window.cartelleEspanse.add(testRecord.cartella);
                // Espandi anche le parent
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

    const steps = [
        {
            element: 'body',
            popover: {
                title: window.t('tut_welcome_title', 'Benvenuto in ArchiView'),
                description: window.t('tut_welcome_desc', 'Questo tour guidato ti illustrerà le funzionalità principali del sistema. Clicca su "Avanti" per iniziare la presentazione.'),
                side: "over",
                align: 'start'
            }
        },
        {
            element: 'header',
            popover: {
                title: window.t('tut_toolbar_title', 'Barra degli Strumenti Globale'),
                description: window.t('tut_toolbar_desc', 'Quest\'area consente la navigazione rapida tra le sezioni principali e l\'accesso alle funzioni di gestione dell\'archivio.'),
                side: "bottom",
                align: 'start'
            }
        },
        {
            element: 'button[onclick="apriNewTypeModal()"]',
            popover: {
                title: window.t('tut_models_title', 'Gestione Modelli'),
                description: window.t('tut_models_desc', 'Clicca su questo pulsante per creare o personalizzare i modelli di documento. Un modello definisce quali campi (es. Data, Autore, Note) saranno disponibili per la compilazione della scheda.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => {
                if (el) el.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 300), { once: true });
            }
        },
        {
            element: '#new-type-modal .modal-window',
            popover: {
                title: window.t('tut_new_model_title', 'Creazione Modello'),
                description: window.t('tut_new_model_desc', 'In questa finestra puoi selezionare un modello predefinito o crearne uno completamente personalizzato aggiungendo i tuoi campi. Chiudi la finestra (con la X o Annulla) per procedere.'),
                side: "left",
                align: 'start',
                showButtons: []
            },
            onHighlighted: (el) => {
                const advanceTutorial = () => {
                    setTimeout(() => {
                        if (window.dInstance) window.dInstance.moveNext();
                    }, 300);
                };
                const btns = document.querySelectorAll('#new-type-modal button');
                btns.forEach(btn => {
                    const clickAttr = btn.getAttribute('onclick');
                    if (clickAttr === 'chiudiNewTypeModal()' || clickAttr === 'confermaCreaTipo()') {
                        btn.addEventListener('click', advanceTutorial, { once: true });
                    }
                });
            },
            onPrevClick: () => {
                if (window.chiudiNewTypeModal) window.chiudiNewTypeModal();
                setTimeout(() => window.dInstance.movePrevious(), 150);
            }
        },
        {
            element: '[data-tab="search"]',
            popover: {
                title: window.t('tut_search_title', 'Ricerca Globale'),
                description: window.t('tut_search_desc', 'Per esplorare gli strumenti di ricerca avanzata, clicca sull\'icona della lente d\'ingrandimento.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => {
                if (el) el.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 150), { once: true });
            }
        },
        {
            element: '#sidebar-search',
            popover: {
                title: window.t('tut_search_engine_title', 'Motore di Ricerca Avanzato'),
                description: window.t('tut_search_engine_desc', 'Il sistema indicizza e ricerca le parole chiave all\'interno dei metadati, dei titoli e del corpo delle trascrizioni in tempo reale.'),
                side: "right",
                align: 'start'
            }
        },
        {
            element: '[data-tab="tags"]',
            popover: {
                title: window.t('tut_tags_title', 'Sistema di Catalogazione'),
                description: window.t('tut_tags_desc', 'Per accedere alle funzionalità di classificazione tramite tag, seleziona l\'icona a forma di segnalibro.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => {
                if (el) el.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 150), { once: true });
            }
        },
        {
            element: '#sidebar-tags',
            popover: {
                title: window.t('tut_tags_filter_title', 'Filtri Semantici e Tag'),
                description: window.t('tut_tags_filter_desc', 'Questa sezione permette di organizzare il patrimonio documentario attraverso etichette personalizzabili. La selezione di un tag applica un filtro immediato all\'intero archivio.'),
                side: "right",
                align: 'start'
            }
        }
    ];

    if (isCloud) {
        steps.push({
            element: '#cloud-buttons-container',
            popover: {
                title: window.t('tut_cloud_sync_title', 'Sincronizzazione Remota'),
                description: window.t('tut_cloud_sync_desc', 'Strumenti per la gestione del repository Cloud: utilizza "Fetch" per verificare la presenza di aggiornamenti, "Scarica" per allineare il database locale e "Carica" per pubblicare le tue revisioni.'),
                side: "bottom",
                align: 'start'
            }
        });
        steps.push({
            element: '#btn-tab-source-control',
            popover: {
                title: window.t('tut_source_control_title', 'Gestione Versioni'),
                description: window.t('tut_source_control_desc', 'Per analizzare lo stato delle revisioni non ancora sincronizzate, seleziona l\'icona del Controllo Modifiche.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => {
                if (el) el.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 150), { once: true });
            }
        });
        steps.push({
            element: '#sidebar-source-control',
            popover: {
                title: window.t('tut_source_status_title', 'Stato delle Revisioni'),
                description: window.t('tut_source_status_desc', 'Questa vista riepiloga le modifiche effettuate in locale. Prima della sincronizzazione, è possibile revisionare o annullare ciascuna operazione in modo selettivo.'),
                side: "right",
                align: 'start'
            }
        });
        steps.push({
            element: '#btn-tab-history',
            popover: {
                title: window.t('tut_history_title', 'Storico Versioni Cloud'),
                description: window.t('tut_history_desc', 'Clicca qui per visualizzare lo storico delle revisioni salvate sul Cloud.'),
                side: "bottom",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => {
                if (el) el.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 150), { once: true });
            }
        });
        steps.push({
            element: '#sidebar-history',
            popover: {
                title: window.t('tut_history_panel_title', 'Pannello Storico'),
                description: window.t('tut_history_panel_desc', 'Da questo pannello puoi sfogliare le vecchie versioni del database, aprirle in sola lettura, e ripristinare il tuo archivio a una versione precedente.'),
                side: "right",
                align: 'start'
            }
        });
    } else {
        steps.push({
            element: '#sidebar-cloud-btn',
            popover: {
                title: window.t('tut_cloud_integration_title', 'Integrazione Cloud'),
                description: window.t('tut_cloud_integration_desc', 'L\'archivio corrente è configurato in modalità locale. Seleziona l\'icona Cloud nell\'angolo in basso a sinistra per esplorare le opzioni di connettività.'),
                side: "right",
                align: 'start',
                showButtons: ['close']
            },
            onHighlighted: (el) => {
                if (el) el.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 300), { once: true });
            }
        });
        steps.push({
            element: '#cloud-modal',
            popover: {
                title: window.t('tut_cloud_panel_title', 'Pannello di Configurazione Remota'),
                description: window.t('tut_cloud_panel_desc', 'Da questa interfaccia è possibile convertire l\'archivio locale in un database Condiviso (ottimizzato per team di lavoro) o in uno Personale (con backup automatico integrato). Chiudi la finestra per proseguire.'),
                side: "left",
                align: 'start',
                showButtons: []
            },
            onHighlighted: (el) => {
                const advanceTutorial = () => {
                    setTimeout(() => {
                        if (window.dInstance) window.dInstance.moveNext();
                    }, 300);
                };
                const btns = document.querySelectorAll('#cloud-modal button');
                btns.forEach(btn => {
                    const clickAttr = btn.getAttribute('onclick');
                    if (clickAttr === 'chiudiCloudModal()') {
                        btn.addEventListener('click', advanceTutorial, { once: true });
                    }
                });
            },
            onPrevClick: () => {
                if (window.chiudiCloudModal) window.chiudiCloudModal();
                setTimeout(() => window.dInstance.movePrevious(), 150);
            }
        });
    }

    steps.push({
        element: 'button[onclick="toggleVaultSwitcher(event)"]',
        popover: {
            title: window.t('tut_vaults_title', 'Gestione Multi-Archivio'),
            description: window.t('tut_vaults_desc', 'ArchiView ti permette di creare e gestire un numero illimitato di archivi (vault) separati. Cliccando su questo pulsante potrai passare rapidamente da un archivio all\'altro, creare nuovi archivi locali, collegarne di Cloud o gestire Archivi Condivisi per collaborare col tuo team.'),
            side: "right",
            align: 'start'
        }
    });

    steps.push({
        element: '[data-tab="folders"]',
        popover: {
            title: window.t('tut_nav_return_title', 'Ritorno alla Navigazione'),
            description: window.t('tut_nav_return_desc', 'Per ripristinare la vista principale e sfogliare i record, seleziona l\'icona a forma di cartella.'),
            side: "bottom",
            align: 'start',
            showButtons: ['close']
        },
        onHighlightStarted: () => {
            if (window.chiudiCloudModal) window.chiudiCloudModal();
        },
        onHighlighted: (el) => {
            if (el) el.addEventListener('click', () => {
                const vList = document.getElementById('view-list');
                if (vList && vList.classList.contains('hidden-tab') && window.switchTab) {
                    window.switchTab('list');
                }
                setTimeout(() => window.dInstance.moveNext(), 150);
            }, { once: true });
        }
    });
    steps.push({
        element: '.tutorial-modifica-btn',
        popover: {
            title: window.t('tut_card_edit_title', 'Accesso alla Schedatura'),
            description: window.t('tut_card_edit_desc', 'Per consultare o aggiornare i metadati di un documento, seleziona il pulsante "Modifica" posizionato sulla relativa scheda.'),
            side: "bottom",
            align: 'start',
            showButtons: ['close']
        },
        onHighlighted: (el) => {
            if (el) el.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 150), { once: true });
        }
    });
    steps.push({
        element: '#view-add',
        popover: {
            title: window.t('tut_editor_title', 'Editor della Schedatura'),
            description: window.t('tut_editor_desc', 'Questo pannello consente la catalogazione estesa del documento e la gestione dei relativi allegati digitali. L\'interfaccia mantiene i comandi di salvataggio sempre accessibili. Clicca sulla freccia in alto a sinistra per tornare all\'archivio.'),
            side: "left",
            align: 'start',
            showButtons: ['close']
        },
        onHighlighted: (el) => {
            setTimeout(() => {
                const main = document.querySelector('main');
                if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
            }, 50);
            const backBtn = document.getElementById('btn-back-to-list');
            if (backBtn) backBtn.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 150), { once: true });
        },
        onPrevClick: () => {
            const vList = document.getElementById('view-list');
            if (vList && vList.classList.contains('hidden-tab') && window.switchTab) {
                window.switchTab('list');
            }
            setTimeout(() => window.dInstance.movePrevious(), 150);
        }
    });
    steps.push({
        element: '.tutorial-trascrivi-btn',
        popover: {
            title: window.t('tut_transcribe_title', 'Modulo di Trascrizione'),
            description: window.t('tut_transcribe_desc', 'Seleziona ora il pulsante "Trascrivi" su una scheda per avviare l\'ambiente dedicato all\'analisi e alla trascrizione del documento originale.'),
            side: "bottom",
            align: 'start',
            showButtons: ['close']
        },
        onHighlighted: (el) => {
            if (el) el.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 200), { once: true });
        },
        onPrevClick: () => {
            if (window.switchTab) window.switchTab('add');
            setTimeout(() => window.dInstance.movePrevious(), 150);
        }
    });
    steps.push({
        element: '#view-trascrizione',
        popover: {
            title: window.t('tut_transcribe_env_title', 'Ambiente di Trascrizione Integrato'),
            description: window.t('tut_transcribe_env_desc', 'Quest\'area presenta l\'immagine del manoscritto affiancata all\'editor testuale avanzato. Si consiglia l\'utilizzo della combinazione Ctrl+S per il salvataggio rapido. Clicca sulla freccia in alto a sinistra per tornare all\'archivio.'),
            side: "over",
            align: 'start',
            showButtons: ['close']
        },
        onHighlighted: (el) => {
            const backBtn = document.getElementById('btn-back-to-list-trasc');
            if (backBtn) backBtn.addEventListener('click', () => setTimeout(() => window.dInstance.moveNext(), 150), { once: true });
        },
        onPrevClick: () => {
            const vList = document.getElementById('view-list');
            if (vList && vList.classList.contains('hidden-tab') && window.switchTab) {
                window.switchTab('list');
            }
            setTimeout(() => window.dInstance.movePrevious(), 150);
        }
    });


    steps.push({
        element: '#sidebar',
        popover: {
            title: window.t('tut_context_menu_title', 'Operazioni Contestuali'),
            description: window.t('tut_context_menu_desc', 'La piattaforma supporta menù contestuali (tasto destro del mouse) sugli elementi dell\'archivio per l\'accesso rapido alle funzioni di esportazione, duplicazione e rimozione.'),
            side: "right",
            align: 'start'
        },
        onHighlightStarted: () => {
            return new Promise((resolve) => {
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
            title: window.t('tut_done_title', 'Configurazione Completata'),
            description: window.t('tut_done_desc', 'Il sistema è ora pronto per l\'utilizzo. È possibile rieseguire questa presentazione formativa in qualsiasi momento selezionando l\'icona (?).'),
            side: "over",
            align: 'start'
        }
    });

    window.dInstance = driverObj({
        showProgress: true,
        allowClose: false,
        showButtons: ['next', 'close'],
        onPopoverRender: (popover) => {
            if (popover.closeButton) {
                popover.closeButton.style.display = 'block';
            }
        },
        steps: steps,
        nextBtnText: window.t('tut_btn_next', 'Avanti'),
        prevBtnText: window.t('tut_btn_prev', 'Indietro'),
        doneBtnText: window.t('tut_btn_done', 'Fine')
    });

    window.dInstance.drive();

    // Segniamo come completato
    if (window.apiSettings) {
        try {
            const settings = await window.apiSettings.get();
            if (!settings.tutorialCompleted) {
                settings.tutorialCompleted = true;
                await window.apiSettings.save(settings);
            }
        } catch(e) {}
    }
};
