function aggiungiCartella() {
    document.getElementById('folder-name-input').value = '';
    document.getElementById('folder-modal').classList.remove('hidden-tab');
    setTimeout(() => document.getElementById('folder-name-input').focus(), 100);
}

function chiudiFolderModal() {
    document.getElementById('folder-modal').classList.add('hidden-tab');
}

function confermaAggiungiCartella() {
    const nome = document.getElementById('folder-name-input').value;
    if (nome) {
        const percorsoPulito = nome.trim().replace(/\/+$/, "");
        
        if (percorsoPulito === '') {
            mostraMessaggio("Il nome della cartella non può essere vuoto.", "error");
            return;
        }

        if (!appData.cartelle.includes(percorsoPulito)) {
            appData.cartelle.push(percorsoPulito);
            salvaTutto();
            renderSidebar();
            aggiornaSelectCartelle();
            chiudiFolderModal();
        } else {
            mostraMessaggio("Questa cartella esiste già.", "error");
        }
    }
}


async function spostaCartella(pathSorgente, pathDestinazioneBase) {
    if (pathSorgente === 'Generale') return; // Generale non si sposta
    if (pathSorgente === pathDestinazioneBase || pathDestinazioneBase.startsWith(pathSorgente + '/')) {
        // Impossibile spostare una cartella dentro se stessa o dentro una sua sottocartella
        return;
    }

    const nomeCartella = pathSorgente.split('/').pop();
    const nuovoPath = pathDestinazioneBase === 'ROOT' ? nomeCartella : `${pathDestinazioneBase}/${nomeCartella}`;
    
    if (appData.cartelle.includes(nuovoPath)) {
        mostraMessaggio("Esiste già una cartella con questo nome nella destinazione.", "error");
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
        if (m.cartella === pathSorgente) m.cartella = nuovoPath;
        else if (m.cartella && m.cartella.startsWith(prefix)) m.cartella = m.cartella.replace(pathSorgente, nuovoPath);
    });

    await salvaTutto();
    renderSidebar();
    aggiornaSelectCartelle();
    renderMain();
}


async function eliminaCartellaAttuale() {
    if (cartellaAttuale === 'Generale') {
        mostraMessaggio("La cartella 'Generale' non può essere eliminata.", "error");
        return;
    }
    
    // Controlla se ci sono manoscritti dentro
    const haManoscritti = appData.manoscritti.some(m => m.cartella === cartellaAttuale);
    if (haManoscritti) {
        mostraMessaggio("Impossibile eliminare: la cartella contiene ancora dei manoscritti.", "error");
        return;
    }

    if(confirm(`Sei sicuro di voler eliminare la cartella "${cartellaAttuale}"?`)) {
        appData.cartelle = appData.cartelle.filter(c => c !== cartellaAttuale);
        cartellaAttuale = 'Generale';
        await salvaTutto();
        renderSidebar();
        renderMain();
        aggiornaSelectCartelle();
    }
}


