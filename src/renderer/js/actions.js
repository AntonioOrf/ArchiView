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

// Sposta tutti i file e sottocartelle di un path in un nuovo path
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

async function spostaManoscritto(idManoscritto, nuovoPathCartella) {
    const m = appData.manoscritti.find(x => x.id === idManoscritto);
    if (m && m.cartella !== nuovoPathCartella) {
        m.cartella = nuovoPathCartella;
        await salvaTutto();
        renderMain();
    }
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

async function handleFormSubmit(e) {
    e.preventDefault();
    
    let allegatiCorrenti = JSON.parse(document.getElementById('form-allegati').value || '[]');
    const fileInput = document.getElementById('form-allegato');
    
    if (fileInput.files.length > 0 && window.apiBrowser) {
        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            try {
                const filePath = file.path;
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

async function apriTrascrizione(id) {
    const m = appData.manoscritti.find(x => x.id === id);
    if (!m) return;
    
    document.getElementById('trascrizione-id').value = m.id;
    document.getElementById('trascrizione-subtitle').textContent = `${m.segnatura} ${m.titolo ? '- ' + m.titolo : ''}`;
    
    // Carica il testo precedente (se esiste, altrimenti inizializza con un paragrafo vuoto cliccabile)
    document.getElementById('trascrizione-editor').innerHTML = m.trascrizione || '<p><br></p>';
    
    const panelAllegato = document.getElementById('trascrizione-allegato-panel');
    const resizer = document.getElementById('trascrizione-resizer');
    const editorPanel = document.getElementById('trascrizione-editor-panel');
    const btnCarica = document.getElementById('btn-carica-allegato-trasc');
    const btnCollapse = document.getElementById('btn-collapse-editor');
    
    const imgPreview = document.getElementById('trasc-img-preview');
    const pdfPreview = document.getElementById('trasc-pdf-preview');
    const noAllegato = document.getElementById('trasc-no-allegato');
    
    imgPreview.classList.add('hidden');
    pdfPreview.classList.add('hidden');
    noAllegato.classList.add('hidden');
    imgPreview.src = '';
    pdfPreview.src = '';
    
    const thumbContainer = document.getElementById('trascrizione-thumbnails');
    if (thumbContainer) thumbContainer.innerHTML = '';
    
    // Usa helper condiviso per normalizzare la lista allegati
    const allegatiM = normalizzaAllegati(m);
    
    if (allegatiM.length > 0 && window.apiBrowser) {
        panelAllegato.classList.remove('hidden');
        if (resizer) resizer.classList.remove('hidden');
        if (editorPanel) {
            editorPanel.classList.remove('hidden');
            editorPanel.style.width = appData.trascrizioneEditorWidth || '50%';
        }
        btnCarica.classList.add('hidden');
        if (btnCollapse) {
            btnCollapse.classList.remove('hidden');
            btnCollapse.innerHTML = '<i data-lucide="panel-left-close" class="w-5 h-5"></i>';
            btnCollapse.title = "Collassa Editor";
        }
        
        window.renderThumbnailsTrascrizione(m.id);
        
        if (window.cambiaAllegatoTrascrizione) {
            window.cambiaAllegatoTrascrizione(m.allegati[0].nome, m.allegati[0].tipo, 0);
        }
    } else {
        panelAllegato.classList.add('hidden');
        if (resizer) resizer.classList.add('hidden');
        if (editorPanel) {
            editorPanel.style.width = '100%';
            editorPanel.classList.remove('hidden');
        }
        btnCarica.classList.remove('hidden'); 
        btnCarica.style.display = 'flex'; 
        if (btnCollapse) btnCollapse.classList.add('hidden');
    }
    
    switchTab('trascrizione');
}

window.renderThumbnailsTrascrizione = function(id) {
    const m = appData.manoscritti.find(x => x.id === id);
    if (!m) return;
    const thumbContainer = document.getElementById('trascrizione-thumbnails');
    if (!thumbContainer) return;
    
    thumbContainer.innerHTML = '';
    // Usa helper condiviso per normalizzare la lista allegati
    normalizzaAllegati(m);
    
    if (m.allegati.length > 1) {
        thumbContainer.classList.remove('hidden');
        for (let i = 0; i < m.allegati.length; i++) {
            const al = m.allegati[i];
            
            const wrapper = document.createElement('div');
          wrapper.className = "flex items-center bg-white border border-stone-300 rounded-sm shadow-sm overflow-hidden shrink-0 cursor-grab active:cursor-grabbing transition-transform";
            
            const btn = document.createElement('button');
            btn.className = "btn btn-ghost rounded-none allegato-btn px-3 py-1 text-xs whitespace-nowrap truncate max-w-[150px] border-r border-stone-200";
            btn.title = al.originalName || `Allegato ${i+1}`;
            btn.innerHTML = al.tipo === 'pdf' ? `<i data-lucide="file-text" class="w-3 h-3 inline-block mr-1"></i> ${al.originalName || 'PDF ' + (i+1)}` : `<i data-lucide="image" class="w-3 h-3 inline-block mr-1"></i> ${al.originalName || 'Immagine ' + (i+1)}`;
            btn.onclick = () => window.cambiaAllegatoTrascrizione(al.nome, al.tipo, i);
            
            const btnEdit = document.createElement('button');
            btnEdit.className = "btn btn-ghost btn-icon rounded-none px-2 py-1";
            btnEdit.title = "Rinomina";
            btnEdit.innerHTML = '<i data-lucide="pencil" class="w-3 h-3"></i>';
            btnEdit.onclick = (e) => {
                e.stopPropagation();
                window.apriRenameModal(al.originalName || '', async (nuovoNome) => {
                    m.allegati[i].originalName = nuovoNome;
                    await salvaTutto();
                    if(typeof renderMain === 'function') renderMain();
                    window.renderThumbnailsTrascrizione(id);
                    window.cambiaAllegatoTrascrizione(m.allegati[window.currentAllegatoIndex || 0].nome, m.allegati[window.currentAllegatoIndex || 0].tipo, window.currentAllegatoIndex || 0);
                });
            };

            // Drag and Drop
            wrapper.draggable = true;
            wrapper.ondragstart = (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', i.toString());
                setTimeout(() => wrapper.classList.add('opacity-40'), 0);
                window._draggedTrascThumbIndex = i;
            };
            wrapper.ondragend = (e) => {
                wrapper.classList.remove('opacity-40');
                window._draggedTrascThumbIndex = null;
                document.querySelectorAll('#trascrizione-thumbnails > div').forEach(p => p.style.transform = '');
            };
            wrapper.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const rect = wrapper.getBoundingClientRect();
                const mid = rect.left + rect.width / 2;
                document.querySelectorAll('#trascrizione-thumbnails > div').forEach(p => {
                    if (p !== wrapper && window._draggedTrascThumbIndex !== i) p.style.transform = '';
                });
                if (window._draggedTrascThumbIndex !== null && window._draggedTrascThumbIndex !== i) {
                    wrapper.style.transform = e.clientX < mid ? 'translateX(10px)' : 'translateX(-10px)';
                }
            };
            wrapper.ondragleave = (e) => wrapper.style.transform = '';
            wrapper.ondrop = async (e) => {
                e.preventDefault();
                wrapper.style.transform = '';
                const dragIndex = window._draggedTrascThumbIndex;
                if (dragIndex !== null && dragIndex !== i) {
                    const item = m.allegati.splice(dragIndex, 1)[0];
                    let targetIndex = i;
                    const rect = wrapper.getBoundingClientRect();
                    const mid = rect.left + rect.width / 2;
                    if (e.clientX > mid) targetIndex++;
                    if (dragIndex < targetIndex) targetIndex--; 
                    m.allegati.splice(targetIndex, 0, item);
                    await salvaTutto();
                    if(typeof renderMain === 'function') renderMain();
                    window.renderThumbnailsTrascrizione(id);
                }
            };

            wrapper.appendChild(btn);
            wrapper.appendChild(btnEdit);
            thumbContainer.appendChild(wrapper);
        }
    // Aggiorna le icone Lucide solo nel thumbnail container
    if (window.lucide) lucide.createIcons({ nodes: [thumbContainer] });
    } else {
        thumbContainer.classList.add('hidden');
    }
};

window.cambiaAllegatoTrascrizione = async function(nome, tipo, index) {
    window.currentAllegatoIndex = index;
    const id = document.getElementById('trascrizione-id').value;
    const m = appData.manoscritti.find(x => x.id === id);
    if (m) {
        let allegatiRender = m.allegati || [];
        const btnPrev = document.getElementById('btn-prev-allegato');
        const btnNext = document.getElementById('btn-next-allegato');
        if (btnPrev && btnNext) {
            if (allegatiRender.length > 1) {
                btnPrev.classList.remove('hidden');
                btnNext.classList.remove('hidden');
                btnPrev.style.display = index > 0 ? 'block' : 'none';
                btnNext.style.display = index < allegatiRender.length - 1 ? 'block' : 'none';
            } else {
                btnPrev.classList.add('hidden');
                btnNext.classList.add('hidden');
            }
        }
        
        const thumbBtns = document.querySelectorAll('#trascrizione-thumbnails .allegato-btn');
        thumbBtns.forEach((btn, i) => {
            if (i === index) {
                btn.classList.add('bg-amber-100', 'text-amber-900', 'border-amber-300');
                btn.classList.remove('hover:bg-stone-50', 'bg-white');
            } else {
                btn.classList.remove('bg-amber-100', 'text-amber-900', 'border-amber-300');
                btn.classList.add('hover:bg-stone-50', 'bg-white');
            }
        });
    }

    const imgPreview = document.getElementById('trasc-img-preview');
    const pdfPreview = document.getElementById('trasc-pdf-preview');
    const noAllegato = document.getElementById('trasc-no-allegato');
    
    imgPreview.classList.add('hidden');
    pdfPreview.classList.add('hidden');
    noAllegato.classList.add('hidden');
    imgPreview.src = '';
    pdfPreview.src = '';
    
    if (!nome) {
        noAllegato.classList.remove('hidden');
        return;
    }

    if (tipo === 'pdf') {
        pdfPreview.src = 'local-asset://' + encodeURIComponent(nome);
        pdfPreview.classList.remove('hidden');
    } else {
        imgPreview.src = 'local-asset://' + encodeURIComponent(nome);
        imgPreview.classList.remove('hidden');
    }
};

window.cambiaAllegatoRelativo = function(dir) {
    const id = document.getElementById('trascrizione-id').value;
    const m = appData.manoscritti.find(x => x.id === id);
    if (!m) return;
    
    let allegatiRender = m.allegati || [];
    let newIndex = (window.currentAllegatoIndex || 0) + dir;
    if (newIndex >= 0 && newIndex < allegatiRender.length) {
        const al = allegatiRender[newIndex];
        window.cambiaAllegatoTrascrizione(al.nome, al.tipo, newIndex);
    }
};

window.toggleFullscreenAllegato = function() {
    const editorPanel = document.getElementById('trascrizione-editor-panel');
    const btnToggle = document.getElementById('btn-toggle-fullscreen');
    const resizer = document.getElementById('trascrizione-resizer');
    const panelAllegato = document.getElementById('trascrizione-allegato-panel');
    
    if (!editorPanel) return;
    if (panelAllegato && panelAllegato.classList.contains('hidden')) {
        return; // Impossibile collassare se non c'è l'allegato
    }

    if (editorPanel.classList.contains('hidden')) {
        editorPanel.classList.remove('hidden');
        if (resizer) resizer.classList.remove('hidden');
        if (btnToggle) {
            btnToggle.innerHTML = '<i data-lucide="maximize" class="w-5 h-5"></i>';
            btnToggle.title = "Espandi Allegato";
            btnToggle.classList.add('opacity-0', 'group-hover:opacity-100');
        }
    } else {
        editorPanel.classList.add('hidden');
        if (resizer) resizer.classList.add('hidden');
        if (btnToggle) {
            btnToggle.innerHTML = '<i data-lucide="minimize" class="w-5 h-5"></i>';
            btnToggle.title = "Riduci Allegato";
            btnToggle.classList.remove('opacity-0', 'group-hover:opacity-100');
        }
    }
    if (window.lucide) lucide.createIcons();
};

function chiudiTrascrizione() {
    // Prima di chiudere fermiamo l'iframe
    document.getElementById('trasc-pdf-preview').src = '';
    
    // Resetta l'espansione dell'editor prima di tornare indietro
    const editorPanel = document.getElementById('trascrizione-editor-panel');
    const btnToggle = document.getElementById('btn-toggle-fullscreen');
    const resizer = document.getElementById('trascrizione-resizer');
    if (editorPanel && editorPanel.classList.contains('hidden')) {
        editorPanel.classList.remove('hidden');
        if (resizer) resizer.classList.remove('hidden');
        if (btnToggle) {
            btnToggle.innerHTML = '<i data-lucide="maximize" class="w-5 h-5"></i>';
            btnToggle.title = "Espandi Allegato";
            btnToggle.classList.add('opacity-0', 'group-hover:opacity-100');
        }
    }
    
    switchTab('list');
}

async function salvaTrascrizione() {
    const id = document.getElementById('trascrizione-id').value;
    const editor = document.getElementById('trascrizione-editor');
    const testo = editor.innerHTML;
    
    const m = appData.manoscritti.find(x => x.id === id);
    if (m) {
        m.trascrizione = testo;
        await salvaTutto();
        mostraMessaggio("Trascrizione salvata con successo!", "success");
        editor.focus();
    }
}

async function caricaAllegatoTrascrizione(e) {
    const file = e.target.files[0];
    if (!file || !window.apiBrowser) return;
    
    const id = document.getElementById('trascrizione-id').value;
    const m = appData.manoscritti.find(x => x.id === id);
    if (!m) return;
    
    try {
        const filePath = file.path;
        const risultato = await window.apiBrowser.salvaAllegato(filePath);
        if (risultato) {
            if (!m.allegati) m.allegati = [];
            if (m.allegato && m.allegati.length === 0) {
                m.allegati.push({ nome: m.allegato, tipo: m.allegatoTipo, originalName: 'Allegato' });
            }
            m.allegati.push({
                nome: risultato.fileName,
                tipo: risultato.ext === '.pdf' ? 'pdf' : 'immagine',
                originalName: file.name
            });
            m.allegato = risultato.fileName;
            m.allegatoTipo = risultato.ext === '.pdf' ? 'pdf' : 'immagine';

            await salvaTutto();
            
            // Ricarica la vista trascrizione per mostrare il nuovo file
            apriTrascrizione(id);
        }
    } catch (error) {
        console.error("Errore caricamento da trascrizione:", error);
        mostraMessaggio("Errore nel salvataggio dell'allegato.", "error");
    }
    
    // Resetta l'input
    e.target.value = '';
}

// --- GESTIONE TIPI DOCUMENTO MODULARI ---

let editingTypeId = null;

function apriNewTypeModal() {
    editingTypeId = null;
    document.getElementById('new-type-select').value = 'custom';
    document.getElementById('new-type-select').disabled = false;
    document.getElementById('btn-salva-tipo').textContent = 'Crea';
    document.querySelector('#new-type-modal .modal-title').textContent = 'Crea Tipo Documento';
    applicaModello();
    document.getElementById('new-type-modal').classList.remove('hidden-tab');
}

function chiudiNewTypeModal() {
    document.getElementById('new-type-modal').classList.add('hidden-tab');
    editingTypeId = null;
}

const MODELLI_PREDEFINITI = {
    imbreviature: { nome: 'Imbreviature Notarili', campi: ['Marginalia', 'Notaio', 'dataCronica', 'dataTopica', 'attori_dinamici', 'tipo_di_atto', 'oggetto', 'elementi_economici'] },
    atti: { nome: 'Atti Giudiziari', campi: ['dataCronica', 'magistratura', 'attori_dinamici', 'tipo_di_atto_giur', 'motivazione_processo', 'condanne', 'note'] },
    fiscali: { nome: 'Documenti Fiscali', campi: ['dichiarante', 'beni_dinamici', 'debiti_dinamici', 'crediti_dinamici', 'famiglia_dinamici', 'note'] }
};

function applicaModello() {
    const sel = document.getElementById('new-type-select').value;
    const nameInput = document.getElementById('custom-type-name');
    const extraInput = document.getElementById('custom-type-extra-input');
    const placeholder = document.getElementById('empty-fields-placeholder');
    
    // Pulisce il form
    nameInput.value = '';
    if (extraInput) extraInput.value = '';
    
    // Rimuove pillole
    document.querySelectorAll('.custom-field-item').forEach(el => el.remove());
    if (placeholder) placeholder.classList.remove('hidden');

    document.querySelectorAll('.custom-type-field').forEach(cb => cb.checked = false);

    // Seleziona campi in base al modello
    if (sel !== 'custom') {
        const modello = MODELLI_PREDEFINITI[sel];
        nameInput.value = modello.nome;
        modello.campi.forEach(campoId => {
            const cb = document.querySelector(`.custom-type-field[value="${campoId}"]`);
            if (cb) {
                cb.checked = true;
                aggiungiPill(campoId, cb.dataset.label || campoId, true);
            } else {
                aggiungiPill(campoId, campoId, false);
            }
        });
    }
}

function toggleCampoBase(cb) {
    if (cb.checked) {
        aggiungiPill(cb.value, cb.dataset.label || cb.value, true);
    } else {
        rimuoviPill(cb.value);
    }
}

function aggiungiCampoCustom() {
    const input = document.getElementById('custom-type-extra-input');
    const val = input.value.trim();
    if (val) {
        aggiungiPill(val, val, false);
        input.value = '';
    }
}

function aggiungiPill(val, label, isBase) {
    const existing = Array.from(document.querySelectorAll('.custom-field-item')).map(el => el.dataset.val.toLowerCase());
    if (existing.includes(val.toLowerCase())) return;
    
    const list = document.getElementById('custom-fields-list');
    const placeholder = document.getElementById('empty-fields-placeholder');
    if (placeholder) placeholder.classList.add('hidden');

    const pill = document.createElement('div');
    pill.className = "custom-field-item flex items-center gap-1 px-2 py-1.5 bg-white border border-stone-300 text-stone-800 rounded-sm text-sm font-medium shadow-sm cursor-grab active:cursor-grabbing transition-transform";
    pill.dataset.val = val;
    pill.draggable = true;

    pill.ondragstart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', val);
        setTimeout(() => pill.classList.add('opacity-40'), 0);
        window._draggedPill = pill;
    };
    
    pill.ondragend = (e) => {
        pill.classList.remove('opacity-40');
        window._draggedPill = null;
        document.querySelectorAll('.custom-field-item').forEach(p => p.style.transform = '');
    };
    
    pill.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = pill.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        
        document.querySelectorAll('.custom-field-item').forEach(p => {
            if (p !== pill && p !== window._draggedPill) p.style.transform = '';
        });
        
        if (window._draggedPill && window._draggedPill !== pill) {
            pill.style.transform = e.clientX < mid ? 'translateX(10px)' : 'translateX(-10px)';
        }
    };
    
    pill.ondragleave = (e) => pill.style.transform = '';
    
    pill.ondrop = (e) => {
        e.preventDefault();
        pill.style.transform = '';
        if (window._draggedPill && window._draggedPill !== pill) {
            const rect = pill.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            if (e.clientX < mid) list.insertBefore(window._draggedPill, pill);
            else list.insertBefore(window._draggedPill, pill.nextSibling);
        }
    };

    pill.innerHTML = `
        <i data-lucide="grip-horizontal" class="w-3 h-3 text-stone-400 mr-1"></i>
        <span>${label}</span>
        <button type="button" onclick="rimuoviPillDalPulsante(this, '${val.replace(/'/g, "\\'")}')" class="text-stone-400 hover:text-red-600 focus:outline-none ml-1 transition-colors"><i data-lucide="x" class="w-3 h-3"></i></button>
    `;
    list.appendChild(pill);
    if (window.lucide) lucide.createIcons({ nodes: [pill] });
    
    if (isBase) {
        const cb = document.querySelector(`.custom-type-field[value="${val}"]`);
        if (cb) cb.checked = true;
    }
}

function rimuoviPillDalPulsante(btn, val) {
    btn.parentElement.remove();
    const cb = document.querySelector(`.custom-type-field[value="${val}"]`);
    if (cb) cb.checked = false;
    
    if (document.querySelectorAll('.custom-field-item').length === 0) {
        const placeholder = document.getElementById('empty-fields-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
    }
}

function rimuoviPill(val) {
    const pill = document.querySelector(`.custom-field-item[data-val="${val}"]`);
    if (pill) pill.remove();
    
    if (document.querySelectorAll('.custom-field-item').length === 0) {
        const placeholder = document.getElementById('empty-fields-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
    }
}

function confermaCreaTipo() {
    const nome = document.getElementById('custom-type-name').value.trim();
    if (!nome) { 
        mostraMessaggio("Inserisci un nome per il tipo di documento.", "error"); 
        return; 
    }
    
    const campi = [];
    document.querySelectorAll('.custom-field-item').forEach(pill => {
        campi.push(pill.dataset.val);
    });
    
    if (campi.length === 0) {
        mostraMessaggio("Aggiungi almeno un campo alla scheda.", "error");
        return;
    }

    if (editingTypeId) {
        // Aggiorna tipo esistente
        const index = appData.tipiDocumento.findIndex(t => t.id === editingTypeId);
        if (index !== -1) {
            appData.tipiDocumento[index].nome = nome;
            appData.tipiDocumento[index].campi = campi;
            salvaTutto();
            aggiornaSelectTipiDocumento();
            chiudiNewTypeModal();
            mostraMessaggio("Tipo di documento aggiornato con successo.", "success");
        }
    } else {
        // Crea nuovo tipo
        const sel = document.getElementById('new-type-select').value;
        const prefissoId = sel !== 'custom' ? sel : 'custom';
        const id = prefissoId + '_' + Date.now();
        
        appData.tipiDocumento.push({ id, nome, campi });
        salvaTutto();
        aggiornaSelectTipiDocumento();
        chiudiNewTypeModal();
        mostraMessaggio("Nuovo tipo di documento creato con successo.", "success");
    }
}

function apriManageTypesModal() {
    const listContainer = document.getElementById('manage-types-list');
    listContainer.innerHTML = '';
    
    const defaultIds = ['imbreviature', 'atti', 'fiscali'];
    
    appData.tipiDocumento.forEach(tipo => {
        const isDefault = defaultIds.includes(tipo.id);
        const inUso = appData.manoscritti.some(m => m.tipoDocumento === tipo.id);
        
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center p-3 bg-stone-50 border border-stone-200 rounded-sm';
        
        let inUsoBadge = inUso ? '<span class="text-[10px] uppercase font-bold tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-2">In uso</span>' : '';
        let defaultBadge = isDefault ? '<span class="text-[10px] uppercase font-bold tracking-wider text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full ml-2">Predefinito</span>' : '';
        
        let buttonsHTML = '';
        if (isDefault) {
            buttonsHTML = '<span class="text-xs text-stone-400 italic">Non modificabile</span>';
        } else {
            buttonsHTML = `
                <button type="button" onclick="modificaTipoDocumento('${tipo.id}')" class="btn btn-ghost btn-icon text-stone-600 hover:text-amber-700 hover:bg-amber-50" title="Modifica"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                <button type="button" onclick="eliminaTipoDocumento('${tipo.id}')" class="btn btn-ghost btn-icon text-red-500 hover:text-red-700 hover:bg-red-50" title="Elimina"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            `;
        }

        div.innerHTML = `
            <div class="flex items-center">
                <span class="font-medium text-stone-800">${tipo.nome}</span>
                ${defaultBadge}
                ${inUsoBadge}
            </div>
            <div class="flex gap-1">
                ${buttonsHTML}
            </div>
        `;
        listContainer.appendChild(div);
    });
    
    if (window.lucide) lucide.createIcons({ nodes: [listContainer] });
    document.getElementById('manage-types-modal').classList.remove('hidden-tab');
}

function chiudiManageTypesModal() {
    document.getElementById('manage-types-modal').classList.add('hidden-tab');
}

window.eliminaTipoDocumento = function(id) {
    const inUso = appData.manoscritti.some(m => m.tipoDocumento === id);
    if (inUso) {
        mostraMessaggio("Non puoi eliminare questo modello perché ci sono schede che lo utilizzano.", "error");
        return;
    }
    
    if (confirm("Sei sicuro di voler eliminare questo modello?")) {
        appData.tipiDocumento = appData.tipiDocumento.filter(t => t.id !== id);
        salvaTutto();
        aggiornaSelectTipiDocumento();
        apriManageTypesModal(); // Ricarica la lista
        mostraMessaggio("Modello eliminato con successo.", "success");
    }
};

window.modificaTipoDocumento = function(id) {
    const tipo = appData.tipiDocumento.find(t => t.id === id);
    if (!tipo) return;
    
    chiudiManageTypesModal();
    
    // Configura UI per modifica
    editingTypeId = id;
    document.getElementById('new-type-select').value = 'custom';
    document.getElementById('new-type-select').disabled = true; // Impedisce di cambiare base durante modifica
    document.getElementById('btn-salva-tipo').textContent = 'Salva Modifiche';
    document.querySelector('#new-type-modal .modal-title').textContent = 'Modifica Tipo Documento';
    
    // Resetta UI
    document.getElementById('custom-type-name').value = tipo.nome;
    document.getElementById('custom-type-extra-input').value = '';
    document.querySelectorAll('.custom-field-item').forEach(el => el.remove());
    document.querySelectorAll('.custom-type-field').forEach(cb => cb.checked = false);
    
    // Popola campi
    tipo.campi.forEach(campoId => {
        const checkbox = document.querySelector(`.custom-type-field[value="${campoId}"]`);
        if (checkbox) {
            checkbox.checked = true;
            aggiungiPill(campoId, checkbox.dataset.label);
        } else {
            // Campo custom
            let label = campoId;
            if (CONFIG_CAMPI[campoId]) label = CONFIG_CAMPI[campoId].label;
            aggiungiPill(campoId, label);
        }
    });
    
    document.getElementById('new-type-modal').classList.remove('hidden-tab');
};

window.apriImpostazioni = async function() {
    document.getElementById('settings-modal').classList.remove('hidden-tab');
    if (window.apiBrowser && window.apiBrowser.getWorkspacePath) {
        const p = await window.apiBrowser.getWorkspacePath();
        document.getElementById('settings-workspace-path').textContent = p || 'Nessuna cartella impostata';
    }
}

window.esportaBackupZip = async function() {
    if (window.apiBrowser && window.apiBrowser.exportWorkspaceZip) {
        mostraMessaggio("Inizializzazione backup...", "info");
        
        const progDiv = document.createElement('div');
        progDiv.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-4 rounded-sm shadow-2xl z-50 min-w-[300px] border border-stone-700 text-center flex flex-col gap-2';
        progDiv.innerHTML = `
            <div class="font-bold text-sm">Esportazione in corso...</div>
            <div class="w-full bg-stone-700 h-2 rounded-full overflow-hidden">
                <div id="export-progress-bar" class="bg-amber-500 h-full w-0 transition-all duration-300"></div>
            </div>
            <div id="export-progress-text" class="text-xs text-stone-300">Calcolo...</div>
        `;
        document.body.appendChild(progDiv);

        if (!window._exportProgressListener && window.apiBrowser.onExportProgress) {
            window.apiBrowser.onExportProgress((progress) => {
                const bar = document.getElementById('export-progress-bar');
                const text = document.getElementById('export-progress-text');
                if (bar && text && progress.entries) {
                    const proc = progress.entries.processed;
                    const total = progress.entries.total;
                    const perc = total > 0 ? Math.round((proc / total) * 100) : 0;
                    bar.style.width = perc + '%';
                    text.textContent = `${proc} di ${total} file elaborati (${perc}%)`;
                }
            });
            window._exportProgressListener = true;
        }

        const result = await window.apiBrowser.exportWorkspaceZip();
        progDiv.remove();

        if (result.success) {
            mostraMessaggio("Backup esportato con successo!", "success");
        } else if (!result.canceled) {
            mostraMessaggio("Errore durante l'esportazione: " + result.error, "error");
        }
    }
}

window.chiudiImpostazioni = function() {
    document.getElementById('settings-modal').classList.add('hidden-tab');
}

window.cambiaCartellaLavoro = async function() {
    if (window.apiBrowser && window.apiBrowser.changeWorkspace) {
        await window.apiBrowser.changeWorkspace();
    }
}

window.controllaAggiornamenti = async function(mostraAvvisi = true) {
    if (window.apiBrowser && window.apiBrowser.checkForUpdates) {
        if (mostraAvvisi) mostraMessaggio("Controllo aggiornamenti in corso...", "info");
        
        const result = await window.apiBrowser.checkForUpdates();

        if (result.error) {
            if (mostraAvvisi) mostraMessaggio("Errore: " + result.error, "error");
        } else if (result.updateAvailable) {
            // Mostra il banner non-intrusivo
            const banner = document.getElementById('update-banner');
            document.getElementById('update-banner-text').textContent = `È disponibile la nuova versione ${result.latestVersion} (attuale: ${result.currentVersion})`;
            
            document.getElementById('btn-scarica-aggiornamento').onclick = () => {
                window.apiBrowser.apriLinkEsterno(result.url);
                nascondiBannerAggiornamento();
            };
            
            banner.classList.remove('hidden');
        } else {
            if (mostraAvvisi) mostraMessaggio(`Hai già l'ultima versione (${result.currentVersion}).`, "success");
        }
    }
}

window.nascondiBannerAggiornamento = function() {
    document.getElementById('update-banner').classList.add('hidden');
}
