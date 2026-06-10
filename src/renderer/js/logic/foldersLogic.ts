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
            if (appData.deletedCartelle) appData.deletedCartelle = appData.deletedCartelle.filter(c => c !== percorsoPulito);
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
    if (!appData.deletedCartelle) appData.deletedCartelle = [];
    appData.cartelle = appData.cartelle.map(c => {
        let nuovoC = c;
        if (c === pathSorgente) nuovoC = nuovoPath;
        else if (c.startsWith(prefix)) nuovoC = c.replace(pathSorgente, nuovoPath);
        
        if (nuovoC !== c) {
            if (!appData.deletedCartelle.includes(c)) appData.deletedCartelle.push(c);
            appData.deletedCartelle = appData.deletedCartelle.filter(x => x !== nuovoC);
        }
        return nuovoC;
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
    const manoscrittiDaEliminare = appData.manoscritti.filter(m => m.cartella === pathDaEliminare || (m.cartella && m.cartella.startsWith(prefix)));
    const haManoscritti = manoscrittiDaEliminare.length > 0;

    const nomeVisivo = pathDaEliminare.split('/').pop();

    let messaggioConferma = `Sei sicuro di voler eliminare l'archivio "${nomeVisivo}"? Tutti i sotto-archivi vuoti verranno rimossi.`;
    if (haManoscritti) {
        messaggioConferma = `L'archivio "${nomeVisivo}" contiene ${manoscrittiDaEliminare.length} documenti. Eliminandolo, verranno eliminati anche tutti i documenti al suo interno. Vuoi procedere?`;
    }

    window.mostraBottomConfirm(messaggioConferma, async () => {
        // Salviamo lo stato per l'undo
        const cartelleDaEliminare = appData.cartelle.filter(c => c === pathDaEliminare || c.startsWith(prefix));
        const recordSalvati = JSON.parse(JSON.stringify(manoscrittiDaEliminare));

        // Elimina anche tutte le sottocartelle
        const foldersToDel = appData.cartelle.filter(c => c === pathDaEliminare || c.startsWith(prefix));
        appData.cartelle = appData.cartelle.filter(c => !foldersToDel.includes(c));
        
        if (!appData.deletedCartelle) appData.deletedCartelle = [];
        for (let fd of foldersToDel) {
             if (!appData.deletedCartelle.includes(fd)) appData.deletedCartelle.push(fd);
        }
        
        // Se c'erano manoscritti, eliminali e metti l'ID nei tombstone per la sync
        if (haManoscritti) {
            if (!appData.deletedIds) appData.deletedIds = [];
            const idsToRemove = manoscrittiDaEliminare.map(m => m.id);
            for (let id of idsToRemove) {
                if (!appData.deletedIds.includes(id)) appData.deletedIds.push(id);
            }
            appData.manoscritti = appData.manoscritti.filter(m => !idsToRemove.includes(m.id));
        }

        if (window.cartellaAttuale === pathDaEliminare || window.cartellaAttuale.startsWith(prefix)) {
            window.cartellaAttuale = appData.cartelle[0] || 'Generale';
            if (typeof switchTab === 'function') switchTab('list');
        }
        await salvaTutto();
        renderSidebar();
        renderMain();
        aggiornaSelectCartelle();
        
        const ripristinaFn = async () => {
            const cartelleSet = new Set([...appData.cartelle, ...cartelleDaEliminare]);
            appData.cartelle = Array.from(cartelleSet).sort();
            
            if (appData.deletedCartelle) {
                appData.deletedCartelle = appData.deletedCartelle.filter(c => !cartelleDaEliminare.includes(c));
            }
            
            if (haManoscritti) {
                const idsRipristinati = recordSalvati.map(r => r.id);
                if (appData.deletedIds) {
                    appData.deletedIds = appData.deletedIds.filter(x => !idsRipristinati.includes(x));
                }
                appData.manoscritti.push(...recordSalvati);
            }
            await salvaTutto();
            renderSidebar();
            renderMain();
            aggiornaSelectCartelle();
        };

        if (window.gestoreAnnullamento) {
            window.gestoreAnnullamento.registraAzione(`Eliminazione archivio "${nomeVisivo}"`, ripristinaFn);
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t ? window.t("msg_folder_deleted") : "Archivio eliminato.", "success", () => window.gestoreAnnullamento.annullaUltimaAzione());
        } else {
            if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t ? window.t("msg_folder_deleted") : "Archivio eliminato.", "success");
        }
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
        if (!appData.deletedCartelle) appData.deletedCartelle = [];
        appData.cartelle = appData.cartelle.map(c => {
            let nuovoC = c;
            if (c === vecchioPath) nuovoC = nuovoPath;
            else if (c.startsWith(prefixVecchia)) nuovoC = c.replace(vecchioPath, nuovoPath);
            
            if (nuovoC !== c) {
                if (!appData.deletedCartelle.includes(c)) appData.deletedCartelle.push(c);
                appData.deletedCartelle = appData.deletedCartelle.filter(x => x !== nuovoC);
            }
            return nuovoC;
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


