function aggiungiCartella() {
    const input = document.getElementById('folder-name-input') as HTMLInputElement;
    // Radice ('') → nessun prefisso: la nuova cartella nasce al primo livello
    input.value = window.cartellaAttuale ? window.cartellaAttuale + '/' : '';
    document.getElementById('folder-modal').classList.remove('hidden-tab');
    // Focus immediato: il modal è già visibile a questo punto. Con il vecchio
    // setTimeout(100) il campo restava non focalizzato per un decimo di secondo — quanto
    // basta per perdere i primi caratteri di chi digita subito, e per far cadere lo
    // spostamento del cursore in mezzo a una scrittura già in corso (il cursore tornava
    // in fondo e il testo digitato finiva accodato al prefisso).
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
}

function chiudiFolderModal() {
    document.getElementById('folder-modal').classList.add('hidden-tab');
}

async function confermaAggiungiCartella() {
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

            // Seleziona e rivela la cartella appena creata: senza espandere gli antenati
            // un percorso annidato resterebbe invisibile nell'albero.
            window.cartellaAttuale = percorsoPulito;
            window.espandiAntenati(percorsoPulito);
            window.azzeraFiltriRicerca();

            if (window.Store) await window.Store.commit();
            else {
                await salvaTutto();
                renderSidebar();
                renderMain();
            }
            aggiornaSelectCartelle();
            chiudiFolderModal();
        } else {
            mostraMessaggio(window.t("msg_folder_exists"), "error");
        }
    }
}


async function spostaCartella(pathSorgente, pathDestinazioneBase) {
    if (!pathSorgente) return; // la radice virtuale non si sposta
    if (pathSorgente === pathDestinazioneBase || pathDestinazioneBase.startsWith(pathSorgente + '/')) {
        // Impossibile spostare una cartella dentro se stessa o dentro una sua sottocartella
        return;
    }

    const settings = await window.apiSettings.get();
    const username = settings.username || 'Anonimo';

    const nomeCartella = pathSorgente.split('/').pop();
    const nuovoPath = (pathDestinazioneBase === 'ROOT' || pathDestinazioneBase === '') ? nomeCartella : `${pathDestinazioneBase}/${nomeCartella}`;
    
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

    if (window.Store) await window.Store.commit();
    else {
        await salvaTutto();
        renderSidebar();
        renderMain();
    }
    aggiornaSelectCartelle();
}


async function eliminaCartellaAttuale() {
    window.eliminaCartellaDaSidebar(window.cartellaAttuale);
}

window.eliminaCartellaDaSidebar = async function(pathDaEliminare) {
    if (!pathDaEliminare) return; // la radice virtuale non è eliminabile

    // Controlla se ci sono manoscritti dentro la cartella o nelle sue sottocartelle
    const prefix = pathDaEliminare + '/';
    const manoscrittiDaEliminare = appData.manoscritti.filter(m => m.cartella === pathDaEliminare || (m.cartella && m.cartella.startsWith(prefix)));
    const haManoscritti = manoscrittiDaEliminare.length > 0;

    const nomeVisivo = pathDaEliminare.split('/').pop();

    let messaggioConferma = window.t("confirm_delete_archive_empty", "Sei sicuro di voler eliminare l\'archivio \"{var0}\"? Tutti i sotto-archivi vuoti verranno rimossi.").replace("{var0}", String(nomeVisivo));
    if (haManoscritti) {
        messaggioConferma = window.t("confirm_delete_archive_with_docs", "L\'archivio \"{var0}\" contiene {var1} documenti. Eliminandolo, verranno eliminati anche tutti i documenti al suo interno. Vuoi procedere?").replace("{var0}", String(nomeVisivo)).replace("{var1}", String(manoscrittiDaEliminare.length));
    }

    window.mostraBottomConfirm(messaggioConferma, async () => {
        // Salviamo lo stato per l'undo
        const cartelleDaEliminare = appData.cartelle.filter(c => c === pathDaEliminare || c.startsWith(prefix));
        const recordSalvati = JSON.parse(JSON.stringify(manoscrittiDaEliminare));

        // Fase 4.1 — le schede travolte dall'eliminazione dell'archivio finiscono nel
        // cestino come quelle eliminate una per una: è anzi il caso in cui la rete serve di
        // più, perché qui l'utente ne cancella molte con un gesto solo e il conteggio nella
        // conferma è tutto ciò che ha visto di loro.
        if (typeof window.cestinaRecord === 'function' && recordSalvati.length) {
            await window.cestinaRecord(recordSalvati, nomeVisivo);
        }

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
            window.cartellaAttuale = '';
            if (typeof switchTab === 'function') switchTab('list');
        }
        if (window.Store) await window.Store.commit();
        else {
            await salvaTutto();
            renderSidebar();
            renderMain();
        }
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
            if (window.Store) await window.Store.commit();
            else {
                await salvaTutto();
                renderSidebar();
                renderMain();
            }
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

        await window.applicaRinominaCartella(vecchioPath, nuovoPath);

        // Fase 4.5 — una rinomina è la sua stessa inversa: annullarla è rinominare
        // all'indietro. È il motivo per cui il corpo dell'operazione è stato estratto in
        // `applicaRinominaCartella` invece di essere ricostruito a mano nell'undo — due
        // copie della stessa aritmetica di percorsi divergerebbero al primo caso strano
        // (i sotto-archivi, `cartellaAttuale`, i tombstone).
        if (window.gestoreAnnullamento) {
            window.gestoreAnnullamento.registraAzione(
                window.t('undo_rename_folder', 'Rinomina di "{var0}"').replace('{var0}', String(nomeAttuale)),
                () => window.applicaRinominaCartella(nuovoPath, vecchioPath),
                () => window.applicaRinominaCartella(vecchioPath, nuovoPath)
            );
        }
        mostraMessaggio(window.t("msg_folder_renamed"), "success");
    });
}

/**
 * Il corpo della rinomina: percorsi, record, tombstone, cartella corrente ed espansione.
 * Separato dal modale perché è anche l'operazione inversa di se stesso (vedi sopra).
 */
window.applicaRinominaCartella = async function(vecchioPath, nuovoPath) {
    if (!vecchioPath || !nuovoPath || vecchioPath === nuovoPath) return;
    const prefixVecchia = vecchioPath + '/';

    const settings = window.apiSettings ? await window.apiSettings.get() : {};
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

    if (window.Store) await window.Store.commit();
    else {
        await salvaTutto();
        renderSidebar();
        renderMain();
    }
    aggiornaSelectCartelle();
};



// WCAG 2.5.7 — alternativa senza trascinamento allo spostamento di una cartella: prima il
// drag nell'albero era l'unico modo. Le destinazioni sono filtrate a monte (niente sé stessa,
// niente discendenti, niente genitore attuale) invece di rifiutarle dopo la scelta.
// Markup via createElement/textContent: i nomi delle cartelle sono dati utente.
window.apriSpostaCartella = function(pathSorgente) {
    if (!pathSorgente) return; // la radice non si sposta
    const esistente = document.getElementById('sposta-cartella-modal');
    if (esistente) esistente.remove();

    const genitore = pathSorgente.includes('/') ? pathSorgente.slice(0, pathSorgente.lastIndexOf('/')) : '';
    const destinazioni = [''].concat((appData.cartelle || []).slice().sort((a, b) => window.confrontaNaturale(a, b)))
        .filter(c => c !== genitore && c !== pathSorgente && !c.startsWith(pathSorgente + '/'));

    const overlay = document.createElement('div');
    overlay.id = 'sposta-cartella-modal';
    overlay.className = 'modal-overlay z-modal-nested';

    const finestra = document.createElement('div');
    finestra.className = 'modal-window max-w-sm p-6 flex flex-col gap-4';

    const titolo = document.createElement('h3');
    titolo.className = 'modal-title text-lg font-bold text-stone-800';
    titolo.textContent = window.t('folder_move_title', 'Sposta cartella');

    const nota = document.createElement('p');
    nota.className = 'text-sm text-stone-600';
    nota.textContent = window.t('folder_move_hint', 'Scegli dove spostare «{var0}» e tutto il suo contenuto.')
        .replace('{var0}', pathSorgente.split('/').pop());

    finestra.append(titolo, nota);

    const chiudi = () => overlay.remove();
    const azioni = document.createElement('div');
    azioni.className = 'flex justify-end gap-2';
    const annulla = document.createElement('button');
    annulla.type = 'button';
    annulla.className = 'btn btn-ghost';
    annulla.setAttribute('data-modal-cancel', ''); // Esc passa di qui (chiudiModaleTop)
    annulla.textContent = window.t('btn_cancel', 'Annulla');
    annulla.onclick = chiudi;

    if (destinazioni.length === 0) {
        const vuoto = document.createElement('p');
        vuoto.className = 'text-sm text-stone-600';
        vuoto.textContent = window.t('folder_move_none', 'Non ci sono altre cartelle in cui spostarla.');
        finestra.appendChild(vuoto);
        azioni.appendChild(annulla);
    } else {
        const etichetta = document.createElement('label');
        etichetta.className = 'flex flex-col gap-1 text-sm font-semibold text-stone-700';
        etichetta.textContent = window.t('folder_move_label', 'Cartella di destinazione');
        const sel = document.createElement('select');
        sel.id = 'sposta-cartella-dest';
        sel.className = 'form-input font-normal';
        for (const c of destinazioni) {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c === '' ? window.t('folder_root_label', 'Radice') : c;
            sel.appendChild(opt);
        }
        etichetta.appendChild(sel);
        finestra.appendChild(etichetta);

        const conferma = document.createElement('button');
        conferma.type = 'button';
        conferma.id = 'sposta-cartella-conferma';
        conferma.className = 'btn btn-primary';
        conferma.textContent = window.t('btn_move', 'Sposta');
        conferma.onclick = async () => {
            const dest = sel.value;
            chiudi();
            try {
                await spostaCartella(pathSorgente, dest);
            } catch (err) {
                console.error('Spostamento cartella fallito:', err);
                if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('msg_folder_move_error', 'Impossibile spostare la cartella.'), 'error');
            }
        };
        azioni.append(annulla, conferma);
    }

    finestra.appendChild(azioni);
    overlay.appendChild(finestra);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) chiudi(); });
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons({ nodes: [overlay] });
};
