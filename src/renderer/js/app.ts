document.addEventListener('DOMContentLoaded', async () => {
    let staccata = false;
    try {
        if (window.avviaFinestraStaccata && await window.avviaFinestraStaccata()) { staccata = true; return; }

        window.apiBrowser?.onRequestClose?.(() => window.gestisciChiusura ? window.gestisciChiusura() : window.apiBrowser.confirmClose());

        if (window.initModalitaPrestazioni) await window.initModalitaPrestazioni();

        if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
            const workspace = await window.apiBrowser.getWorkspacePath();
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
        performance.mark('archiview:pronta');
        window.__appPronta = true;
        document.dispatchEvent(new CustomEvent('archiview:pronta'));
        if (!staccata) window.apiBrowser?.prendiUrlInvito?.().then(gestisciUrlInvito).catch((e) => console.warn('Link d\'invito non letto:', e));
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

    window.statoCloud.vaultCloud = isCloud;
    if (window.hubConfig) window.statoCloud.autenticato = true;
    if (typeof window.aggiornaCloudStatus === 'function') window.aggiornaCloudStatus();

    if (isCloud) {
        if (btnSourceControl) btnSourceControl.classList.remove('hidden-tab', 'hidden');
        if (btnHistory) btnHistory.classList.remove('hidden-tab', 'hidden');
    } else {
        if (btnSourceControl) btnSourceControl.classList.add('hidden-tab');
        if (btnHistory) btnHistory.classList.add('hidden-tab');

        const activeSidebar = document.querySelector('.sidebar-content:not(.hidden-tab)');
        if (activeSidebar && (activeSidebar.id === 'sidebar-source-control' || activeSidebar.id === 'sidebar-history') && typeof switchSidebarTab === 'function') {
            switchSidebarTab('folders');
        }
    }
};

window.collegaEventiModulo = function() {
        document.getElementById('manoscritto-form').addEventListener('submit', handleFormSubmit);

    document.getElementById('manoscritto-form').addEventListener('input', () => { window.isFormDirty = true; });
    document.getElementById('manoscritto-form').addEventListener('change', () => { window.isFormDirty = true; });

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
        (e.target as HTMLInputElement).value = '';
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
    
    if (window.lucide) lucide.createIcons();

    switchTab('list');

    const debouncedSearch = debounce(() => { renderMain(); renderSearchSuggestions(); }, 150);
    pianificaControlli(settings);

    if (!window._eventsBound) {
        window._eventsBound = true;

        document.getElementById('search-input').addEventListener('input', debouncedSearch);
        document.getElementById('global-tag-search').addEventListener('input', () => { if (typeof renderTagList === 'function') renderTagList(); });
        window.collegaEventiModulo();

        collegaScorciatoie();
        collegaChiusuraModali();

    window.trascrizioneNonSalvata = false;
    document.getElementById('trascrizione-editor').addEventListener('input', () => {
        window.trascrizioneNonSalvata = true;
    });

        window.gestisciChiusura = async () => {
            if (typeof window.flushSalvataggio === 'function') {
                try { await window.flushSalvataggio(); } catch (e) { console.error("Errore nel flush di chiusura:", e); }
            }
            if (window.moduloInTrascrizione()) await window.salvaSchedaTrascrizioneOra();
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
        };
    

    const resizer = document.getElementById('trascrizione-resizer');
    const leftPanel = document.getElementById('trascrizione-editor-panel');
    const container = document.getElementById('trascrizione-container');


    if (resizer && leftPanel && container) {
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
    }
}

function collegaEventiMain() {
    if (window.apiBrowser && window.apiBrowser.onDatabaseModificatoEsterno) {
        window.apiBrowser.onDatabaseModificatoEsterno(async () => {
            const nuovoDati = await window.leggiDatiArchivio();
            if (nuovoDati) {
                if (await window.sincronizzaEUnisciDati(nuovoDati, { aggiornaBase: false }) === false) return;
                mostraMessaggio(window.t("msg_archivio_modificato_fuori", "L'archivio è stato modificato fuori dall'app: modifiche unite."), "info");
            }
        });
    }

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

function ripristinaStatoSalvato(settings) {
    const statoSalvato = settings.appState;
    if (statoSalvato) {
        try {
            const stato = statoSalvato;
            if (typeof stato.cartella === 'string') {
                window.cartellaAttuale = stato.cartella;
            }
            if (stato.cartelleEspanse) {
                window.cartelleEspanse = new Set(stato.cartelleEspanse);
            }
            window.statoIniziale = stato;
        } catch (e) {}
    }

    if (window.statoIniziale) {
        const inputRicerca = document.getElementById('search-input');
        if (inputRicerca && typeof window.statoIniziale.ricerca === 'string') {
            inputRicerca.value = window.statoIniziale.ricerca;
        }
        if (Array.isArray(window.statoIniziale.tagAttivi)) {
            window.activeTags = new Set(window.statoIniziale.tagAttivi);
        }
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
        const albSalvato = window.statoIniziale.alberoSecondario;
        if (albSalvato && typeof albSalvato === 'object') {
            const modo = albSalvato.modo === 'auto' || albSalvato.modo === 'campo' ? albSalvato.modo : 'nessuno';
            window.alberoSecondario = {
                modo: modo,
                campo: modo === 'campo' && typeof albSalvato.campo === 'string' ? albSalvato.campo : '',
                ordina: albSalvato.ordina === 'secondario' && modo !== 'nessuno' ? 'secondario' : 'segnatura'
            };
        }
        const fSalvati = window.statoIniziale.filtriAvanzati;
        if (fSalvati && typeof fSalvati === 'object') window.filtriAvanzati = window.filtriValidi(fSalvati);
        if (Array.isArray(window.statoIniziale.ricercheSalvate)) {
            window.ricercheSalvate = window.statoIniziale.ricercheSalvate.filter(r => r && r.id && r.nome);
        }
        if (typeof window.ripristinaImpostazioniStampa === 'function') {
            window.ripristinaImpostazioniStampa(window.statoIniziale.stampa);
        }
        if (typeof window.ripristinaImpostazioniExportTesto === 'function') {
            window.ripristinaImpostazioniExportTesto(window.statoIniziale.esportaTesto);
        }
    }
}

async function eseguiAzioniRimandate(settings) {
    if (settings && settings.autoStartCreaHub) {
        await window.apiSettings.patch({ autoStartCreaHub: false });
        setTimeout(async () => {
            if (typeof window.creaRepositoryHub === 'function') {
                await window.creaRepositoryHub(null);
            }
        }, 400);
    }

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

function pianificaControlli(settings) {
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
    setInterval(controllaAggiornamentiSeOnline, 4 * 60 * 60 * 1000);
    setTimeout(() => window.controllaScansioniAllApertura && window.controllaScansioniAllApertura(), 2500);

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


window.handleInviteCode = function(code, isManualInput = false) {
    const procedi = async () => {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(m => m.classList.add('hidden-tab'));

        const welcome = document.getElementById('welcome-modal');
        if (welcome) {
            welcome.classList.remove('hidden-tab');
            welcome.style.setProperty('display', 'flex', 'important');
        }
        if (typeof mostraJoinForm === 'function') await mostraJoinForm();

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

function gestisciUrlInvito(url) {
    if (typeof url === 'string' && url.startsWith('archiview://join/') && typeof window.handleInviteCode === 'function') {
        window.handleInviteCode(url.substring(17));
    }
}

if (window.apiBrowser && window.apiBrowser.onInviteUrl) {
    window.apiBrowser.onInviteUrl(gestisciUrlInvito);
}


function mostraErroreAccessoNegato(account: string) {
    const overlay = document.createElement('div');
    overlay.id = 'accesso-negato-overlay';
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
        } catch (e) {}
    });

    (overlay.querySelector('#_an_btn_back') as HTMLButtonElement).addEventListener('click', async () => {
        overlay.remove();
        if (typeof mostraWelcomeModal === 'function') await mostraWelcomeModal();
    });
}

document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const tasto = e.key.toLowerCase();
    if (tasto !== 'z' && tasto !== 'y') return;

    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isInput = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement).isContentEditable;
    if (isInput) return;
    if (!window.gestoreAnnullamento) return;

    e.preventDefault();
    if (tasto === 'y' || (tasto === 'z' && e.shiftKey)) window.gestoreAnnullamento.ripetiUltimaAzione();
    else window.gestoreAnnullamento.annullaUltimaAzione();
});
