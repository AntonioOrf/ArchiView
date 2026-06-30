// @ts-nocheck
window.avviaTutorial = async function () {
    // Distruggi istanza precedente prima di crearne una nuova
    if (window.dInstance) {
        try { window.dInstance.destroy(); } catch (_) { /* già distrutta */ }
        window.dInstance = null;
    }

    // Risolvi il costruttore driver.js indipendentemente dal formato del bundle
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

    const cloudButtons = document.getElementById('cloud-buttons-container');
    // isCloud viene riletto dopo gli await per evitare race con aggiornaVisibilitaCloud()
    let isTutorialWorkspace = false;
    if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
        const wp = await window.apiBrowser.getWorkspacePath();
        if (wp && wp.endsWith('Tutorial_Archive')) {
            isTutorialWorkspace = true;
        }
    }
    // Rileggiamo isCloud e isAuthenticated dopo l'await, quando il DOM è sicuramente aggiornato
    const isCloud = cloudButtons && !cloudButtons.classList.contains('hidden');
    const isAuthenticated = !!(window.driveStatus && window.driveStatus.isAuthenticated);

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
                        try {
                            const res = await window.apiBrowser.loadTutorialWorkspace();
                            if (!res.success) {
                                console.error("Errore caricamento Tutorial:", res.error);
                                localStorage.removeItem('startTutorialOnBoot');
                                if (window.mostraMessaggio) window.mostraMessaggio("Errore nel caricamento del Tutorial: " + res.error, 'error');
                            }
                        } catch (e) {
                            console.error("Eccezione caricamento Tutorial:", e);
                            localStorage.removeItem('startTutorialOnBoot');
                            if (window.mostraMessaggio) window.mostraMessaggio("Errore imprevisto nel caricamento del Tutorial.", 'error');
                        }
                    }
                );
                return;
            } else {
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
                if (window.salvaDatiApp) {
                    try {
                        await window.salvaDatiApp();
                    } catch (e) {
                        console.error("Errore salvataggio dati tutorial:", e);
                    }
                }
                if (window.renderMain) window.renderMain();
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

    // AbortController condiviso per lo step corrente: annulla i listener del visit precedente
    // prima di registrarne di nuovi, evitando accumulo su navigazione prev→next.
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
            if (clickAttrs.includes(btn.getAttribute('onclick'))) {
                btn.addEventListener('click', advance, { once: true, signal: stepAC.signal });
            }
        });
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
            onHighlighted: (el) => attachOnce(el, 300)
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
            onHighlighted: () => attachModalButtons('#new-type-modal button', ['chiudiNewTypeModal()', 'confermaCreaTipo()']),
            onPrevClick: () => {
                if (window.chiudiNewTypeModal) window.chiudiNewTypeModal();
                setTimeout(() => window.dInstance?.movePrevious(), 150);
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
            onHighlighted: (el) => attachOnce(el)
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
            onHighlighted: (el) => attachOnce(el)
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
            onHighlighted: (el) => attachOnce(el)
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
            onHighlighted: (el) => attachOnce(el)
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
            onHighlighted: (el) => attachOnce(el, 300)
        });
        if (isAuthenticated) {
            // Utente loggato: #cloud-modal viene aperto normalmente da apriCloudModal().
            // Aspettiamo che chiuda il modal per avanzare.
            steps.push({
                element: '#cloud-modal',
                popover: {
                    title: window.t('tut_cloud_panel_title', 'Pannello di Configurazione Remota'),
                    description: window.t('tut_cloud_panel_desc', 'Da questa interfaccia è possibile convertire l\'archivio locale in un database Condiviso (ottimizzato per team di lavoro) o in uno Personale (con backup automatico integrato). Chiudi la finestra per proseguire.'),
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
                            for (const node of m.addedNodes) {
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
            // Utente NON loggato: apriCloudModal() mostra #cloud-auth-modal (z-150) invece di #cloud-modal.
            // Il popover di driver.js è z-1000000000, quindi i suoi bottoni stanno SOPRA il modal auth
            // e sono cliccabili. CRITICO: driver.js legge i click-hook da `popover.onNextClick` /
            // `popover.onPrevClick` (NON dallo step). Messi nello step venivano ignorati e partiva la
            // navigazione default (movePrevious → tornava a "Integrazione Cloud" senza chiudere il modal).
            let cloudStepDone = false;
            const advanceOnce = () => {
                if (cloudStepDone) return;
                cloudStepDone = true;
                window.dInstance?.moveNext();
            };
            steps.push({
                // Agganciamo il popover alla finestra di login (non a 'body') con side 'right':
                // così il tutorial appare ACCANTO al modal auth, non sopra, e lo spotlight
                // evidenzia il box di accesso. Il modal viene creato (sincrono) al click sul
                // bottone Cloud dello step precedente, quindi è già nel DOM a questo punto.
                element: '#cloud-auth-modal .modal-window',
                popover: {
                    title: window.t('tut_cloud_panel_title', 'Pannello di Configurazione Remota'),
                    description: window.t('tut_cloud_no_auth_desc', 'Non sei ancora autenticato con Google. Puoi accedere ora per esplorare le funzionalità Cloud, oppure proseguire il tutorial senza configurare il Cloud.'),
                    side: "right",
                    align: 'center',
                    showButtons: ['next', 'previous'],
                    nextBtnText: window.t('btn_login_google', 'Accedi con Google'),
                    prevBtnText: window.t('tut_btn_prosegui', 'Prosegui'),
                    // "Prosegui" (bottone sinistro): chiude il modal auth e AVANZA (non torna indietro).
                    onPrevClick: () => {
                        const cancelBtn = document.getElementById('btn-cloud-auth-no');
                        if (cancelBtn) cancelBtn.click();
                        else document.getElementById('cloud-auth-modal')?.remove();
                        advanceOnce();
                    },
                    // "Accedi con Google" (bottone destro): avvia OAuth tramite il bottone reale del
                    // modal; quando #cloud-modal diventa visibile, avanza.
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
                    // Rete di sicurezza: se l'utente clicca direttamente i bottoni del modal auth
                    // reale invece di quelli del popover, avanza comunque il tutorial.
                    const realCancel = document.getElementById('btn-cloud-auth-no');
                    if (realCancel) realCancel.addEventListener('click', () => advanceOnce(), { once: true, signal: stepAC.signal });
                }
            });
        }
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
        element: '.tutorial-modifica-btn',
        popover: {
            title: window.t('tut_card_edit_title', 'Accesso alla Schedatura'),
            description: window.t('tut_card_edit_desc', 'Per consultare o aggiornare i metadati di un documento, seleziona il pulsante "Modifica" posizionato sulla relativa scheda.'),
            side: "bottom",
            align: 'start',
            showButtons: ['close']
        },
        onHighlighted: (el) => attachOnce(el)
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
        onHighlighted: () => {
            setTimeout(() => {
                const main = document.querySelector('main');
                if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
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
            title: window.t('tut_transcribe_title', 'Modulo di Trascrizione'),
            description: window.t('tut_transcribe_desc', 'Seleziona ora il pulsante "Trascrivi" su una scheda per avviare l\'ambiente dedicato all\'analisi e alla trascrizione del documento originale.'),
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
        element: '#view-trascrizione',
        popover: {
            title: window.t('tut_transcribe_env_title', 'Ambiente di Trascrizione Integrato'),
            description: window.t('tut_transcribe_env_desc', 'Quest\'area presenta l\'immagine del manoscritto affiancata all\'editor testuale avanzato. Si consiglia l\'utilizzo della combinazione Ctrl+S per il salvataggio rapido. Clicca sulla freccia in alto a sinistra per tornare all\'archivio.'),
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
            const vList = document.getElementById('view-list');
            if (vList && vList.classList.contains('hidden-tab') && window.switchTab) {
                window.switchTab('list');
            }
            setTimeout(() => window.dInstance?.movePrevious(), 150);
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
        // Con allowClose:false driver.js gate la X sull'evento "closeClick" (allowClose && destroy),
        // perciò il pulsante non chiuderebbe il tour. Configuriamo onCloseClick per distruggere
        // esplicitamente, mantenendo allowClose:false così Esc/click sull'overlay non chiudono il tour per sbaglio.
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
                settings.tutorialCompleted = true;
                await window.apiSettings.save(settings);
            }
        } catch (e) {
            console.error("Errore persistenza tutorialCompleted:", e);
        }
    }
};
