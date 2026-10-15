document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Finestra staccata (scheda o documento, finestraStaccata.ts): non è un'altra app, non
        // apre l'archivio né il cloud. Si ferma qui.
        if (window.avviaFinestraStaccata && await window.avviaFinestraStaccata()) return;

        // Prima di qualunque render: decide se animazioni e pagine lunghe sono ammesse.
        if (window.initModalitaPrestazioni) await window.initModalitaPrestazioni();

        if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
            const workspace = await window.apiBrowser.getWorkspacePath();
            // Chiave per le preferenze locali per-archivio (es. ultimo modello usato).
            window.percorsoWorkspace = workspace || '';
            
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
        if (window.initPreferenzeTesto) await window.initPreferenzeTesto();
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
                await window.apiSettings.patch({ lastSeenVersion: currentVersion });
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
        // Il mark dà il tempo dall'inizio della navigazione: lo legge scripts/misura-prestazioni.js.
        performance.mark('archiview:pronta');
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

/**
 * Eventi del modulo della scheda: invio, "modificato", file in attesa di caricamento. Fuori
 * dall'avvio perché li registra anche la finestra staccata (finestraStaccata.ts), che non avvia l'app.
 */
window.collegaEventiModulo = function() {
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
                        <button type="button" ${window.azione('click', 'rimuoviPendingFile', index)} class="text-amber-600 hover:text-red-600 p-1 bg-white border border-amber-200 rounded shadow-sm">
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
        (e.target as HTMLInputElement).value = ''; // Reset per poter selezionare di nuovo
        window.renderPendingFiles();
    });
};

async function avviaApp() {
    await initData();
    if (window.aggiornaVisibilitaCloud) await window.aggiornaVisibilitaCloud();

    collegaEventiMain();

    const settings = await window.apiSettings.get();
    ripristinaStatoSalvato(settings);
    await eseguiAzioniRimandate(settings);

    if (typeof aggiornaSelectTipiDocumento === 'function') aggiornaSelectTipiDocumento();

    renderSidebar();
    renderMain();
    
    // Inizializza tutte le icone statiche dell'HTML
    if (window.lucide) lucide.createIcons();

    switchTab('list');

    // Un unico debounce sincronizzato per renderMain + renderSearchSuggestions
    const debouncedSearch = debounce(() => { renderMain(); renderSearchSuggestions(); }, 150);
    pianificaControlli(settings);

    // Guard: assicuriamoci di bindare gli eventi globali una sola volta
    if (!window._eventsBound) {
        window._eventsBound = true;

        document.getElementById('search-input').addEventListener('input', debouncedSearch);
        document.getElementById('global-tag-search').addEventListener('input', () => { if (typeof renderTagList === 'function') renderTagList(); });
        window.collegaEventiModulo();

        collegaScorciatoie();      // components/scorciatoie.ts
        collegaChiusuraModali();   // components/pilaModali.ts

    window.trascrizioneNonSalvata = false;
    document.getElementById('trascrizione-editor').addEventListener('input', () => {
        window.trascrizioneNonSalvata = true;
    });

    if (window.apiBrowser && window.apiBrowser.onRequestClose) {
        window.apiBrowser.onRequestClose(async () => {
            // Chiusura: qualunque salvataggio differito deve finire su disco prima di uscire.
            if (typeof window.flushSalvataggio === 'function') {
                try { await window.flushSalvataggio(); } catch (e) { console.error("Errore nel flush di chiusura:", e); }
            }
            // Il tab «Scheda» della trascrizione: ciò che si può salvare va su disco; resta
            // sporco solo un modulo che non passa la validazione, e allora si chiede.
            if (window.moduloInTrascrizione()) await window.salvaSchedaTrascrizioneOra();
            // ...e quanto ha in sospeso la finestra staccata, che salva passando da qui.
            if (window.svuotaFinestraStaccata) await window.svuotaFinestraStaccata();
            const isEditingRecord = window.isFormDirty && (window.moduloInTrascrizione() || !document.getElementById('view-add')?.classList.contains('hidden-tab'));
            
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


    if (resizer && leftPanel && container) {
        // La proporzione è una preferenza di comodo, per tab («Testo» / «Scheda»): sta in
        // localStorage (attachmentsLogic.ts), non più nell'archivio da salvare a ogni trascinamento.
        window.attivaSeparatore(resizer, {
            attuale: () => parseFloat(leftPanel.style.width) || 50,
            daPuntatore: (x) => {
                const r = container.getBoundingClientRect();
                return ((x - r.left) / r.width) * 100;
            },
            applica: (p) => {
                leftPanel.style.transition = 'none';
                leftPanel.style.width = `${p}%`;
            },
            fine: (p) => {
                leftPanel.style.transition = '';
                window.ricordaLarghezzaTrascrizione(p);
            }
        });
    }
    } // End of if (!window._eventsBound)
}

/** Avvisi dal main: database cambiato fuori (sync, realtime) e allegato Hub appena scaricato. */
function collegaEventiMain() {
    if (window.apiBrowser && window.apiBrowser.onDatabaseModificatoEsterno) {
        window.apiBrowser.onDatabaseModificatoEsterno(async () => {
            const nuovoDati = await window.leggiDatiArchivio();
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
}

/** Stato dell'interfaccia salvato all'uscita: cartella, espansione, ricerca, filtri, vista. */
function ripristinaStatoSalvato(settings) {
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

    // Ripristina il contesto di ricerca prima del primo render: altrimenti la griglia
    // mostrerebbe l'archivio intero per un istante prima di filtrarsi. Che il filtro sia
    // attivo resta evidente dai chip in `active-filters`, che includono l'azzeramento.
    if (window.statoIniziale) {
        const inputRicerca = document.getElementById('search-input');
        if (inputRicerca && typeof window.statoIniziale.ricerca === 'string') {
            inputRicerca.value = window.statoIniziale.ricerca;
        }
        if (Array.isArray(window.statoIniziale.tagAttivi)) {
            window.activeTags = new Set(window.statoIniziale.tagAttivi);
        }
        // Ordinamento, modalità di vista e colonne della tabella: vanno ripristinati
        // PRIMA di renderMain(), che li legge già al primo render.
        // Nessuna validazione contro una lista di campi ammessi: non esiste più: si può
        // ordinare per qualsiasi campo, incluso uno del tipo documento scelto da
        // un'intestazione di tabella.
        const sortSalvato = window.statoIniziale.sort;
        if (sortSalvato && typeof sortSalvato.campo === 'string' && sortSalvato.campo) {
            window.sortState = { campo: sortSalvato.campo, dir: sortSalvato.dir === 'desc' ? 'desc' : 'asc' };
        }
        if (window.statoIniziale.vista === 'tabella' || window.statoIniziale.vista === 'griglia') {
            window.vistaLista = window.statoIniziale.vista;
        }
        if (window.statoIniziale.colonneTabella && typeof window.statoIniziale.colonneTabella === 'object') {
            window.colonneTabella = window.statoIniziale.colonneTabella;
        }
        // Etichetta secondaria dell'albero. Chiavi lette una per una e validate: un
        // appState scritto da una versione precedente non deve introdurre modi ignoti,
        // che renderSidebar tratterebbe come "attiva" mostrando righe vuote.
        const albSalvato = window.statoIniziale.alberoSecondario;
        if (albSalvato && typeof albSalvato === 'object') {
            const modo = albSalvato.modo === 'auto' || albSalvato.modo === 'campo' ? albSalvato.modo : 'nessuno';
            window.alberoSecondario = {
                modo: modo,
                campo: modo === 'campo' && typeof albSalvato.campo === 'string' ? albSalvato.campo : '',
                ordina: albSalvato.ordina === 'secondario' && modo !== 'nessuno' ? 'secondario' : 'segnatura'
            };
        }
        // Fase 1.3. I filtri avanzati vanno ripristinati insieme a ricerca e tag: sono
        // parte dello stesso contesto, e ritrovarne solo metà è peggio che non
        // ritrovarne nessuno. Le chiavi si prendono una per una dallo stato salvato,
        // così un appState scritto da una versione precedente non introduce campi ignoti.
        const fSalvati = window.statoIniziale.filtriAvanzati;
        if (fSalvati && typeof fSalvati === 'object') {
            window.filtriAvanzati = {
                tipo: typeof fSalvati.tipo === 'string' ? fSalvati.tipo : '',
                sottocartelle: !!fSalvati.sottocartelle,
                daData: typeof fSalvati.daData === 'string' ? fSalvati.daData : '',
                aData: typeof fSalvati.aData === 'string' ? fSalvati.aData : '',
                // Fase 3.2 — periodo storico. Numeri conservati come stringhe, come gli
                // altri controlli del pannello, e validati qui uno per uno.
                daAnno: /^\d{3,4}$/.test(String(fSalvati.daAnno || '')) ? String(fSalvati.daAnno) : '',
                aAnno: /^\d{3,4}$/.test(String(fSalvati.aAnno || '')) ? String(fSalvati.aAnno) : '',
                allegati: fSalvati.allegati === 'si' || fSalvati.allegati === 'no' ? fSalvati.allegati : '',
                trascrizione: fSalvati.trascrizione === 'si' || fSalvati.trascrizione === 'no' ? fSalvati.trascrizione : ''
            };
        }
        if (Array.isArray(window.statoIniziale.ricercheSalvate)) {
            window.ricercheSalvate = window.statoIniziale.ricercheSalvate.filter(r => r && r.id && r.nome);
        }
        // Fase 2.2 — intestazioni e opzioni di stampa (validate chiave per chiave dentro
        // ripristinaImpostazioniStampa, come i filtri qui sopra).
        if (typeof window.ripristinaImpostazioniStampa === 'function') {
            window.ripristinaImpostazioniStampa(window.statoIniziale.stampa);
        }
        // Fasi 2.5/2.6 — formato preferito degli export testuali.
        if (typeof window.ripristinaImpostazioniExportTesto === 'function') {
            window.ripristinaImpostazioniExportTesto(window.statoIniziale.esportaTesto);
        }
    }
}

/** Azioni chieste da un passo precedente (welcome, migrazione Hub) e da eseguire a archivio aperto. */
async function eseguiAzioniRimandate(settings) {
    // Creazione Hub da welcome: il workspace locale è appena stato creato, ora lo si pubblica.
    if (settings && settings.autoStartCreaHub) {
        await window.apiSettings.patch({ autoStartCreaHub: false });
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

        await window.apiSettings.patch({ autoStartTrasformaCondiviso: false, autoStartTrasformaPersonale: false });

        if (typeof mostraProgressoCloud === 'function') {
            mostraProgressoCloud(window.t("prog_prep_title", "Preparazione in corso"), window.t("prog_prep_cloud", "Avvio configurazione cloud…"));
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
        await window.apiSettings.patch({ hubJustCreated: false });
        setTimeout(() => {
            if (typeof window.apriShareModal === 'function') window.apriShareModal();
        }, 800);
    }

    if (settings && settings.hubJustMigrated) {
        await window.apiSettings.patch({ hubJustMigrated: false });
        setTimeout(() => {
            if (typeof mostraMessaggio === 'function') {
                mostraMessaggio(window.t("msg_hub_migrato_reinvita", 'Migrazione sull\'Hub completata. Invita di nuovo i collaboratori con un nuovo invito dal pannello Condivisione: i permessi di Google Drive non si trasferiscono.'), "info");
            }
            if (typeof window.apriShareModal === 'function') window.apriShareModal();
        }, 1000);
    }

    if (settings && settings.promptCloudAuth) {
        await window.apiSettings.patch({ promptCloudAuth: false });
        
        setTimeout(() => {
            if (typeof apriCloudModal === 'function') {
                apriCloudModal();
                if (typeof mostraMessaggio === 'function') {
                    mostraMessaggio(window.t("msg_benvenuto_nell_archivio_c", 'Benvenuto nell\'archivio condiviso. Accedi a Google Drive per scaricare i dati.'), "info");
                }
            }
        }, 800);
    }
}

/** Controllo aggiornamenti (all'avvio e ogni 4 h), scansioni dal telefono, invito al tutorial. */
function pianificaControlli(settings) {
    // Controlla aggiornamenti in background all'avvio senza mostrare popup se è già aggiornato.
    // Salta il check se offline (l'utente potrebbe aprire l'app in aereo/senza rete): evita una
    // chiamata di rete destinata a fallire e un log 'error' inutile.
    // Spento da Impostazioni → Sistema: resta solo il controllo manuale. Si rilegge a ogni giro,
    // così il cambio vale subito senza riavvio.
    const controllaAggiornamentiSeOnline = async () => {
        if (typeof window.controllaAggiornamenti !== 'function' || navigator.onLine === false) return;
        try {
            if ((await window.apiSettings.get()).aggiornamentiAutomatici === false) return;
        } catch (e) {
            console.warn('Preferenza aggiornamenti non letta, controllo comunque:', e);
        }
        window.controllaAggiornamenti(false);
    };
    setTimeout(controllaAggiornamentiSeOnline, 2000);
    // Re-check periodico ogni 4h: le sessioni lunghe (app mai riavviata) altrimenti non vedrebbero
    // mai un aggiornamento pubblicato dopo l'avvio. La cache/dedup lato main (updaterIpc.ts) evita
    // comunque richieste ravvicinate se l'utente controlla anche manualmente dalle Impostazioni.
    setInterval(controllaAggiornamentiSeOnline, 4 * 60 * 60 * 1000);
    // Scansioni dal telefono in attesa su Drive (PIANO-SCANNER Fase 10): solo con l'accesso già fatto.
    setTimeout(() => window.controllaScansioniAllApertura && window.controllaScansioniAllApertura(), 2500);

    /**
     * Propone il tutorial senza bloccare: banner in coda alla pagina, non un overlay.
     * Un modal aperto a tempo dopo l'avvio si sovrappone a quello che l'utente ha gia'
     * iniziato a fare e ne mangia i click; per lo stesso motivo l'invito non compare se
     * l'utente e' gia' dentro una scheda o nella trascrizione.
     */
    function mostraInvitoTutorial() {
        const banner = document.getElementById('tutorial-banner');
        const vList = document.getElementById('view-list');
        if (!banner || !vList || vList.classList.contains('hidden-tab')) return;

        const chiudiEDimentica = async () => {
            banner.classList.add('hidden-tab');
            try {
                await window.apiSettings.patch({ tutorialCompleted: true });
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
            mostraInvitoTutorial();
        }
    }, 1500);
}


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


function mostraErroreAccessoNegato(account: string) {
    const overlay = document.createElement('div');
    overlay.id = 'accesso-negato-overlay';
    // .modal-overlay/.modal-window: a11yModal lo aggancia dal MutationObserver sul body
    // (ruolo dialog, focus iniziale, focus-trap). Senza, il Tab arrivava all'app sotto.
    // Struttura e colori dei modali comuni (token del tema) e livello della scala z-index:
    // prima era dipinto a mano in bianco, in italiano fisso e a z-index 9999 (audit P1-4).
    overlay.className = 'modal-overlay z-modal-critical';
    const t = window.t;
    overlay.innerHTML = window.sanitizeHTML(`
        <div class="modal-window max-w-md" aria-describedby="_an_desc">
            <div class="modal-header">
                <h2 class="modal-title">
                    <svg class="w-5 h-5 testo-pericolo shrink-0" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    <span>${escapeHTML(t('access_denied_title', 'Accesso negato'))}</span>
                </h2>
            </div>
            <div class="modal-body">
                <p id="_an_desc" class="text-stone-700 leading-relaxed mb-2"></p>
                <p class="text-sm text-stone-500">${escapeHTML(t('access_denied_hint', "Accedi con l'account Google invitato dal proprietario, oppure scegli un altro archivio."))}</p>
            </div>
            <div class="modal-footer modal-footer-bar">
                <button id="_an_btn_back" type="button" class="btn btn-secondary">${escapeHTML(t('btn_choose_other_archive', 'Scegli un altro archivio'))}</button>
                <button id="_an_btn_login" type="button" class="btn btn-primary">${escapeHTML(t('btn_switch_google_account', 'Cambia account Google'))}</button>
            </div>
        </div>
    `);
    document.body.appendChild(overlay);

    // L'account arriva da Google: entra solo come testo, mai nel markup.
    const desc = overlay.querySelector('#_an_desc') as HTMLElement;
    if (account) {
        const [prima, dopo = ''] = t('access_denied_desc', "L'account {account} non è autorizzato ad accedere a questo archivio condiviso.").split('{account}');
        const strong = document.createElement('strong');
        strong.id = '_an_account';
        strong.textContent = account;
        desc.append(prima, strong, dopo);
    } else {
        desc.textContent = t('access_denied_desc_no_account', "L'account in uso non è autorizzato ad accedere a questo archivio condiviso.");
    }

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
    if (!(e.ctrlKey || e.metaKey)) return;
    const tasto = e.key.toLowerCase();
    if (tasto !== 'z' && tasto !== 'y') return;

    // Nessun undo dentro a un campo di testo: lì il comando è quello nativo del controllo,
    // e rubarglielo significherebbe annullare l'ultima azione sull'ARCHIVIO mentre l'utente
    // crede di annullare l'ultima parola che ha scritto.
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isInput = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement).isContentEditable;
    if (isInput) return;
    if (!window.gestoreAnnullamento) return;

    e.preventDefault();
    // Fase 4.5 — le due convenzioni per il redo (Ctrl+Y e Ctrl+Maiusc+Z) valgono entrambe:
    // sono abitudini diverse di ambienti diversi, e chi arriva dall'una non trova l'altra.
    if (tasto === 'y' || (tasto === 'z' && e.shiftKey)) window.gestoreAnnullamento.ripetiUltimaAzione();
    else window.gestoreAnnullamento.annullaUltimaAzione();
});
