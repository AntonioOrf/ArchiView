// @ts-nocheck
function aggiungiCartella() {
    const input = document.getElementById('folder-name-input');
    if (window.cartellaAttuale && window.cartellaAttuale !== 'Generale') {
        input.value = window.cartellaAttuale + '/';
    } else {
        input.value = '';
    }
    document.getElementById('folder-modal').classList.remove('hidden-tab');
    setTimeout(() => {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
    }, 100);
}

function chiudiFolderModal() {
    document.getElementById('folder-modal').classList.add('hidden-tab');
}

function confermaAggiungiCartella() {
    const nome = document.getElementById('folder-name-input').value;
    if (nome) {
        const percorsoPulito = nome.trim().replace(/\/+$/, "");
        
        if (percorsoPulito === '') {
            mostraMessaggio(window.t("msg_folder_name_empty"), "error");
            return;
        }

        if (!appData.cartelle.includes(percorsoPulito)) {
            appData.cartelle.push(percorsoPulito);
            salvaTutto();
            renderSidebar();
            aggiornaSelectCartelle();
            chiudiFolderModal();
        } else {
            mostraMessaggio(window.t("msg_folder_exists"), "error");
        }
    }
}


async function spostaCartella(pathSorgente, pathDestinazioneBase) {
    if (pathSorgente === 'Generale') return; // Generale non si sposta
    if (pathSorgente === pathDestinazioneBase || pathDestinazioneBase.startsWith(pathSorgente + '/')) {
        // Impossibile spostare una cartella dentro se stessa o dentro una sua sottocartella
        return;
    }

    const settings = await window.apiSettings.get();
    const username = settings.username || 'Anonimo';

    const nomeCartella = pathSorgente.split('/').pop();
    const nuovoPath = pathDestinazioneBase === 'ROOT' ? nomeCartella : `${pathDestinazioneBase}/${nomeCartella}`;
    
    if (appData.cartelle.includes(nuovoPath)) {
        mostraMessaggio(window.t("msg_folder_exists_dest"), "error");
        return;
    }

    // Aggiorna cartelle
    const prefix = pathSorgente + '/';
    appData.cartelle = appData.cartelle.map(c => {
        if (c === pathSorgente) return nuovoPath;
        if (c.startsWith(prefix)) return c.replace(pathSorgente, nuovoPath);
        return c;
    });

    // Aggiorna manoscritti
    appData.manoscritti.forEach(m => {
        if (m.cartella === pathSorgente) {
            m.cartella = nuovoPath;
            m.lastModified = Date.now();
            m.modificatoDa = username;
        } else if (m.cartella && m.cartella.startsWith(prefix)) {
            m.cartella = m.cartella.replace(pathSorgente, nuovoPath);
            m.lastModified = Date.now();
            m.modificatoDa = username;
        }
    });

    await salvaTutto();
    renderSidebar();
    aggiornaSelectCartelle();
    renderMain();
}


async function eliminaCartellaAttuale() {
    window.eliminaCartellaDaSidebar(window.cartellaAttuale);
}

window.eliminaCartellaDaSidebar = async function(pathDaEliminare) {
    if (appData.cartelle.length <= 1) {
        mostraMessaggio(window.t("msg_cannot_delete_last_folder"), "error");
        return;
    }
    
    // Controlla se ci sono manoscritti dentro la cartella o nelle sue sottocartelle
    const prefix = pathDaEliminare + '/';
    const haManoscritti = appData.manoscritti.some(m => m.cartella === pathDaEliminare || (m.cartella && m.cartella.startsWith(prefix)));
    if (haManoscritti) {
        mostraMessaggio(window.t("msg_cannot_delete_not_empty"), "error");
        return;
    }

    const nomeVisivo = pathDaEliminare.split('/').pop();

    window.mostraBottomConfirm(`Sei sicuro di voler eliminare la cartella "${nomeVisivo}"? Tutte le sottocartelle vuote verranno rimosse.`, async () => {
        // Elimina anche tutte le sottocartelle
        appData.cartelle = appData.cartelle.filter(c => c !== pathDaEliminare && !c.startsWith(prefix));
        
        if (window.cartellaAttuale === pathDaEliminare || window.cartellaAttuale.startsWith(prefix)) {
            window.cartellaAttuale = appData.cartelle[0] || 'Generale';
            switchTab('list');
        }
        await salvaTutto();
        renderSidebar();
        renderMain();
        aggiornaSelectCartelle();
        mostraMessaggio(window.t("msg_folder_deleted"), "success");
    }, 'delete_folder');
}

window.rinominaCartellaDaSidebar = async function(vecchioPath) {
    const nomeAttuale = vecchioPath.split('/').pop();
    const basePath = vecchioPath.substring(0, vecchioPath.lastIndexOf('/'));
    
    window.apriRenameModal(nomeAttuale, async (nuovoNome) => {
        if (!nuovoNome || nuovoNome.trim() === '' || nuovoNome.includes('/')) {
            mostraMessaggio(window.t("msg_folder_invalid_name"), "error");
            return;
        }
        
        const nuovoPath = basePath ? `${basePath}/${nuovoNome}` : nuovoNome;
        
        if (appData.cartelle.includes(nuovoPath) && nuovoPath !== vecchioPath) {
            mostraMessaggio(window.t("msg_folder_exists_dest"), "error");
            return;
        }
        
        if (nuovoPath === vecchioPath) return;

        const prefixVecchia = vecchioPath + '/';
        const prefixNuova = nuovoPath + '/';

        const settings = await window.apiSettings.get();
        const username = settings.username || 'Anonimo';

        // Aggiorna cartelle
        appData.cartelle = appData.cartelle.map(c => {
            if (c === vecchioPath) return nuovoPath;
            if (c.startsWith(prefixVecchia)) return c.replace(vecchioPath, nuovoPath);
            return c;
        });

        // Aggiorna manoscritti
        appData.manoscritti.forEach(m => {
            if (m.cartella === vecchioPath) {
                m.cartella = nuovoPath;
                m.lastModified = Date.now();
                m.modificatoDa = username;
            } else if (m.cartella && m.cartella.startsWith(prefixVecchia)) {
                m.cartella = m.cartella.replace(vecchioPath, nuovoPath);
                m.lastModified = Date.now();
                m.modificatoDa = username;
            }
        });

        if (window.cartellaAttuale === vecchioPath) window.cartellaAttuale = nuovoPath;
        else if (window.cartellaAttuale.startsWith(prefixVecchia)) {
            window.cartellaAttuale = window.cartellaAttuale.replace(vecchioPath, nuovoPath);
        }
        
        // Aggiorna espansione
        if (window.cartelleEspanse.has(vecchioPath)) {
            window.cartelleEspanse.delete(vecchioPath);
            window.cartelleEspanse.add(nuovoPath);
        }

        await salvaTutto();
        renderSidebar();
        renderMain();
        aggiornaSelectCartelle();
        mostraMessaggio(window.t("msg_folder_renamed"), "success");
    });
}


