async function spostaManoscritto(idManoscritto, nuovoPathCartella) {
    const m = appData.manoscritti.find(x => x.id === idManoscritto);
    if (m && m.cartella !== nuovoPathCartella) {
        m.cartella = nuovoPathCartella;
        await salvaTutto();
        renderMain();
    }
}


async function handleFormSubmit(e) {
    e.preventDefault();
    
    let allegatiCorrenti = JSON.parse(document.getElementById('form-allegati').value || '[]');
    const fileInput = document.getElementById('form-allegato');
    
    if (fileInput.files.length > 0 && window.apiBrowser) {
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            try {
                const filePath = window.apiBrowser.getPathForFile ? window.apiBrowser.getPathForFile(file) : file.path;
                const risultato = await window.apiBrowser.salvaAllegato(filePath);
                if (risultato) {
                    allegatiCorrenti.push({
                        nome: risultato.fileName,
                        tipo: risultato.ext === '.pdf' ? 'pdf' : 'immagine',
                        originalName: file.name
                    });
                }
            } catch (error) {
                console.error("Errore durante il salvataggio dell'allegato:", error);
                mostraMessaggio("Errore nel salvataggio di un file.", "error");
            }
        }
    }

    const idCorrente = document.getElementById('form-id').value;
    const cartellaScelta = document.getElementById('form-cartella').value;
    const tipoId = document.getElementById('form-tipo-documento').value;
    
    const tipo = appData.tipiDocumento.find(t => t.id === tipoId) || appData.tipiDocumento[0];
    const dynamicData = {};
    tipo.campi.forEach(campoId => {
        let conf = CONFIG_CAMPI[campoId] || { type: 'text' };
        if (conf.type === 'dynamic_list') {
            const rows = document.querySelectorAll('#container-' + campoId + ' .dynamic-list-row');
            const items = [];
            rows.forEach(row => {
                const k = row.querySelector('.list-key').value.trim();
                const v = row.querySelector('.list-val').value.trim();
                if (k || v) {
                    items.push({ k, v });
                }
            });
            dynamicData[campoId] = items;
        } else {
            const el = document.getElementById('dyn-' + campoId.replace(/\s+/g, '_'));
            if (el) dynamicData[campoId] = el.value;
        }
    });

    let nomeAllegato = allegatiCorrenti.length > 0 ? allegatiCorrenti[0].nome : '';
    let tipoAllegato = allegatiCorrenti.length > 0 ? allegatiCorrenti[0].tipo : '';

    const newData = {
        id: idCorrente || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
        cartella: cartellaScelta,
        tipoDocumento: tipoId,
        segnatura: document.getElementById('form-segnatura').value,
        tags: document.getElementById('form-tags').value,
        allegato: nomeAllegato,
        allegatoTipo: tipoAllegato,
        allegati: allegatiCorrenti,
        ...dynamicData // Include i campi personalizzati (dataCronica, prezzo, ecc.)
    };
    
    // Mantieni valori storici fissi per compatibilità con le vecchie card
    if(!newData.titolo && dynamicData.titolo) newData.titolo = dynamicData.titolo;
    if(!newData.autore && dynamicData.autore) newData.autore = dynamicData.autore;
    if(!newData.note && dynamicData.note) newData.note = dynamicData.note;

    if (idCorrente) {
        const index = appData.manoscritti.findIndex(m => m.id === idCorrente);
        if (index !== -1) appData.manoscritti[index] = {...appData.manoscritti[index], ...newData}; // Merge per non perdere la trascrizione
    } else {
        appData.manoscritti.push(newData);
    }

    await salvaTutto();
    
    // Imposta la vista sulla cartella in cui abbiamo appena salvato
    cartellaAttuale = cartellaScelta; 
    renderSidebar();
    
    resetForm();
    switchTab('list');
    renderMain();
}


async function editItem(id) {
    switchTab('add');

    const m = appData.manoscritti.find(x => x.id === id);
    document.getElementById('form-id').value = m.id;
    document.getElementById('form-cartella').value = m.cartella || 'Generale';
    document.getElementById('form-tipo-documento').value = m.tipoDocumento || 'manoscritto';
    
    renderDynamicFields();
    
    document.getElementById('form-segnatura').value = m.segnatura || '';
    document.getElementById('form-tags').value = m.tags || '';
    
    let allegatiList = [];
    if (m.allegati) {
        allegatiList = [...m.allegati];
    } else if (m.allegato) {
        allegatiList.push({ nome: m.allegato, tipo: m.allegatoTipo });
    }
    document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
    if(window.renderAllegatiForm) window.renderAllegatiForm(allegatiList);
    
    const tipo = appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto')) || appData.tipiDocumento[0];
    tipo.campi.forEach(campoId => {
        let conf = CONFIG_CAMPI[campoId] || { type: 'text' };
        if (conf.type === 'dynamic_list') {
            const items = m[campoId] || [];
            if (items.length > 0) {
                items.forEach(item => window.aggiungiElementoDinamico(campoId, conf.keyPlaceholder, conf.valPlaceholder, item.k || item.ruolo || '', item.v || item.nome || ''));
            } else {
                // Aggiungine uno vuoto di default per comodità
                window.aggiungiElementoDinamico(campoId, conf.keyPlaceholder, conf.valPlaceholder, '', '');
            }
        } else {
            const el = document.getElementById('dyn-' + campoId.replace(/\s+/g, '_'));
            if (el) el.value = m[campoId] || '';
        }
    });

    document.getElementById('form-title').textContent = "Modifica Scheda";
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
}


function deleteItem(id) {
    document.getElementById('delete-item-id').value = id;
    document.getElementById('delete-modal').classList.remove('hidden-tab');
}

function chiudiDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden-tab');
}

async function confermaEliminazione() {
    const id = document.getElementById('delete-item-id').value;
    appData.manoscritti = appData.manoscritti.filter(x => x.id !== id);
    await salvaTutto();
    renderMain();
    chiudiDeleteModal();
    mostraMessaggio("Scheda eliminata.", "success");
}


function cancelEdit() { resetForm(); switchTab('list'); }

// --- LOGICA TRASCRIZIONE ---

