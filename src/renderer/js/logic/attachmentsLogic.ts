// @ts-nocheck
async function apriTrascrizione(id) {
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (!m) return;
    
    document.getElementById('trascrizione-id').value = m.id;
    document.getElementById('trascrizione-subtitle').textContent = `${m.segnatura} ${m.titolo ? '- ' + m.titolo : ''}`;
    
    // Carica il testo precedente (se esiste, altrimenti inizializza con un paragrafo vuoto cliccabile)
    document.getElementById('trascrizione-editor').innerHTML = m.trascrizione || '<p><br></p>';
    window.trascrizioneNonSalvata = false;
    
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
        panelAllegato.classList.remove('hidden-tab');
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
        panelAllegato.classList.add('hidden-tab');
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
    if (window.lucide) lucide.createIcons();
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
        thumbContainer.classList.remove('hidden-tab');
        for (let i = 0; i < m.allegati.length; i++) {
            const al = m.allegati[i];
            
            const wrapper = document.createElement('div');
          wrapper.className = "flex items-center bg-white border border-stone-300 rounded-sm shadow-sm overflow-hidden shrink-0 cursor-grab active:cursor-grabbing transition-transform";
            
            const btn = document.createElement('button');
            btn.className = "btn btn-ghost rounded-none allegato-btn px-3 py-1 text-xs whitespace-nowrap truncate max-w-[150px] border-r border-stone-200";
            btn.title = al.originalName || `Allegato ${i+1}`;
            btn.innerHTML = al.tipo === 'pdf' ? `<i data-lucide="file-text" class="w-3 h-3 inline-block mr-1"></i> ${escapeHTML(al.originalName || 'PDF ' + (i+1))}` : `<i data-lucide="image" class="w-3 h-3 inline-block mr-1"></i> ${escapeHTML(al.originalName || 'Immagine ' + (i+1))}`;
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
        thumbContainer.classList.add('hidden-tab');
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

    let expectedHash = null;
    if (m && m.allegati && m.allegati[index]) {
        expectedHash = m.allegati[index].hash;
    }

    if (expectedHash && window.apiBrowser && window.apiBrowser.verificaHashAllegato) {
        const result = await window.apiBrowser.verificaHashAllegato(nome, expectedHash);
        if (result.status === 'missing') {
            noAllegato.innerHTML = `
                <div class="text-stone-400 mb-3"><i data-lucide="file-warning" class="w-12 h-12 mx-auto text-amber-500"></i></div>
                <h3 class="text-lg font-medium text-stone-300">Allegato non presente in locale</h3>
                <p class="text-sm text-stone-400 mt-2 max-w-md mx-auto">
                    Questo archivio è condiviso. Il file dell'allegato non è ancora presente sul tuo PC.
                    <br>Usa il Cloud Explorer per sincronizzare gli allegati.
                </p>
                <div class="mt-4 p-3 bg-stone-900 border border-stone-800 rounded-sm text-xs font-mono text-stone-300 select-all break-all max-w-md mx-auto">
                    File da inserire: ${nome}
                </div>
                <p class="text-xs text-stone-500 mt-3">
                    Copia il file nella tua cartella allegati:<br>
                    <span class="font-mono text-[10px] break-all select-all text-amber-600">${result.path}</span>
                </p>
            `;
            noAllegato.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
            return;
        } else if (result.status === 'corrupted') {
            mostraMessaggio("Attenzione: l'allegato potrebbe essere corrotto o modificato (Hash non corrispondente).", "error");
            noAllegato.innerHTML = `<div class="text-stone-400 mb-2"><i data-lucide="shield-alert" class="w-12 h-12 mx-auto text-red-500"></i></div><h3 class="text-lg font-medium text-stone-300">File non sicuro</h3><p class="text-sm text-stone-500 mt-1">L'hash del file non corrisponde a quello salvato nel cloud.</p>`;
            noAllegato.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
            return;
        } else {
            noAllegato.innerHTML = '<div class="text-stone-400 mb-2"><i data-lucide="image-off" class="w-12 h-12 mx-auto"></i></div><h3 class="text-lg font-medium text-stone-300" data-i18n="no_attachment">Nessun allegato disponibile per questa scheda.</h3>';
        }
    }

    if (tipo === 'pdf') {
        pdfPreview.src = 'local-asset://' + encodeURIComponent(nome) + '?t=' + Date.now() + '#pagemode=none';
        pdfPreview.classList.remove('hidden');
    } else {
        imgPreview.src = 'local-asset://' + encodeURIComponent(nome) + '?t=' + Date.now();
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
    const btnToggle = document.getElementById('btn-collapse-editor');
    const resizer = document.getElementById('trascrizione-resizer');
    const panelAllegato = document.getElementById('trascrizione-allegato-panel');
    
    if (!editorPanel) return;
    if (panelAllegato && panelAllegato.classList.contains('hidden-tab')) {
        return; // Impossibile collassare se non c'è l'allegato
    }

    if (editorPanel.classList.contains('hidden')) {
        editorPanel.classList.remove('hidden');
        if (resizer) resizer.classList.remove('hidden');
        if (btnToggle) {
            btnToggle.innerHTML = '<i data-lucide="panel-left-close" class="w-5 h-5"></i>';
            btnToggle.title = "Collassa Editor";
        }
    } else {
        editorPanel.classList.add('hidden');
        if (resizer) resizer.classList.add('hidden');
        if (btnToggle) {
            btnToggle.innerHTML = '<i data-lucide="panel-left-open" class="w-5 h-5"></i>';
            btnToggle.title = "Espandi Editor";
        }
    }
    if (window.lucide) lucide.createIcons();
};

window.chiudiUnsavedModal = function() {
    document.getElementById('unsaved-modal').classList.add('hidden-tab');
    window.isClosingApp = false;
}

window.confermaUscitaTrascrizione = function() {
    if (typeof chiudiUnsavedModal === 'function') chiudiUnsavedModal();
    window.trascrizioneNonSalvata = false;
    if (window.isClosingApp && window.apiBrowser && window.apiBrowser.confirmClose) {
        window.apiBrowser.confirmClose();
    } else {
        switchTab('list');
    }
    
    // Prima di chiudere fermiamo l'iframe
    document.getElementById('trasc-pdf-preview').src = '';
    
    // Resetta l'espansione dell'editor prima di tornare indietro
    const editorPanel = document.getElementById('trascrizione-editor-panel');
    const btnToggle = document.getElementById('btn-collapse-editor');
    const resizer = document.getElementById('trascrizione-resizer');
    if (editorPanel && editorPanel.classList.contains('hidden')) {
        editorPanel.classList.remove('hidden');
        if (resizer) resizer.classList.remove('hidden');
        if (btnToggle) {
            btnToggle.innerHTML = '<i data-lucide="panel-left-close" class="w-5 h-5"></i>';
            btnToggle.title = "Collassa Editor";
        }
    }
    
    switchTab('list');
}

function chiudiTrascrizione() {
    if (window.trascrizioneNonSalvata) {
        document.getElementById('unsaved-modal').classList.remove('hidden-tab');
        return;
    }
    window.confermaUscitaTrascrizione();
}

async function salvaTrascrizione() {
    const id = document.getElementById('trascrizione-id').value;
    const editor = document.getElementById('trascrizione-editor');
    const testo = editor.innerHTML;
    
    const settings = await window.apiSettings.get();
    const username = settings.username || 'Anonimo';
    
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (m) {
        m.trascrizione = testo;
        m.lastModified = Date.now();
        m.modificatoDa = username;
        await salvaTutto();
        window.trascrizioneNonSalvata = false;
        mostraMessaggio(window.t("msg_transcription_saved"), "success");
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
        const settings = await window.apiSettings.get();
        const username = settings.username || 'Anonimo';
        
        const filePath = window.apiBrowser.getPathForFile ? window.apiBrowser.getPathForFile(file) : file.path;
        const risultato = await window.apiBrowser.salvaAllegato(filePath, id);
        if (risultato) {
            if (!m.allegati) m.allegati = [];
            if (m.allegato && m.allegati.length === 0) {
                m.allegati.push({ nome: m.allegato, tipo: m.allegatoTipo, originalName: 'Allegato' });
            }
            m.allegati.push({
                nome: risultato.fileName,
                tipo: risultato.ext === '.pdf' ? 'pdf' : 'immagine',
                originalName: file.name,
                hash: risultato.hash
            });
            m.allegato = risultato.fileName;
            m.allegatoTipo = risultato.ext === '.pdf' ? 'pdf' : 'immagine';
            m.lastModified = Date.now();
            m.modificatoDa = username;

            await salvaTutto();
            
            // Ricarica la vista trascrizione per mostrare il nuovo file
            apriTrascrizione(id);
        }
    } catch (error) {
        console.error("Errore caricamento da trascrizione:", error);
        mostraMessaggio(window.t("msg_attachment_error"), "error");
    }
    
    // Resetta l'input
    e.target.value = '';
}


