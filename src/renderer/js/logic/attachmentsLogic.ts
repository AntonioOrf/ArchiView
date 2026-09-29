// --- Trascrizione per allegato (Fase 2.3-bis) --------------------------------
//
// L'editor di sinistra è agganciato all'allegato mostrato a destra, non più alla scheda:
// cambiando carta il testo segue. Lo stato di aggancio vive qui, in due variabili sole.
//
// ⚠️ Il record va memorizzato INSIEME all'indice. Con il solo indice, aprire la scheda B
// dopo aver lasciato la scheda A sull'allegato 2 scriverebbe il testo di A dentro
// l'allegato 2 di B: `window.currentAllegatoIndex` sopravvive al cambio di scheda.
// Il prefisso `_ta` è obbligatorio come altrove: il bundle di produzione concatena tutti
// gli script del renderer in un unico scope.
let _taRecordCorrente = null;
let _taIndiceCorrente = 0;
// Pagina del PDF agganciata all'editor, da 1. Zero quando la carta non è un PDF — o è un PDF
// che non si è potuto aprire, e allora l'editor lavora sul testo dell'allegato intero.
let _taPaginaCorrente = 0;
// Cambiare carta è asincrono (verifica dell'hash, apertura del PDF): cliccando in fretta,
// la continuazione di una richiesta vecchia NON deve agganciare l'editor alla sua carta
// dopo che quella nuova lo ha già fatto. Ogni richiesta prende un numero; vince l'ultimo.
let _taGenerazioneCarta = 0;

/**
 * Travasa ciò che è nell'editor nell'allegato a cui è agganciato. Va chiamata PRIMA di
 * ogni cambio di carta e prima del salvataggio: senza, passare da una carta all'altra
 * butterebbe via quanto appena battuto, che è il modo più rapido di rendere inutilizzabile
 * una funzione pensata per lavorare su più carte.
 */
function _taSalvaEditorInMemoria() {
    if (_taRecordCorrente === null) return;
    const editor = document.getElementById('trascrizione-editor');
    if (!editor) return;
    const m = appData.manoscritti.find(x => String(x.id) === String(_taRecordCorrente));
    if (!m) return;
    window.scriviTrascrizioneAllegato(m, _taIndiceCorrente, editor.innerHTML, _taPaginaCorrente);
}

/**
 * Mentre un PDF si apre l'editor mostra ancora la carta precedente: se accettasse testo,
 * quanto battuto in quell'istante verrebbe sostituito dalla pagina nuova e perso. Lo si
 * blocca finché l'aggancio non è deciso; `_taCaricaEditor` lo sblocca sempre.
 */
let _taFuocoPrimaDelBlocco = false;
function _taBloccaEditor(bloccato) {
    const editor = document.getElementById('trascrizione-editor');
    if (!editor) return;
    if (bloccato && editor.getAttribute('contenteditable') !== 'false') {
        _taFuocoPrimaDelBlocco = document.activeElement === editor;
    }
    editor.setAttribute('contenteditable', bloccato ? 'false' : 'true');
    if (bloccato) editor.setAttribute('aria-busy', 'true');
    else editor.removeAttribute('aria-busy');
}

/**
 * Carica nell'editor il testo della carta `indice` (e della pagina `pagina`, se PDF). NON
 * tocca `trascrizioneNonSalvata`: le modifiche pendenti su un'altra carta restano pendenti,
 * e il flag deve continuare a dire la verità finché non si salva davvero.
 */
function _taCaricaEditor(m, indice, pagina = 0) {
    const editor = document.getElementById('trascrizione-editor');
    if (!editor || !m) return;
    const testo = window.leggiTrascrizioneAllegato(m, indice, pagina);
    const bloccato = editor.getAttribute('contenteditable') === 'false';
    const avevaFuoco = bloccato ? _taFuocoPrimaDelBlocco : document.activeElement === editor;
    editor.innerHTML = window.sanitizeHTML(testo || '<p><br></p>');
    _taRecordCorrente = m.id;
    _taIndiceCorrente = indice;
    _taPaginaCorrente = pagina;
    _taBloccaEditor(false);
    _taFuocoPrimaDelBlocco = false;
    // Il blocco durante l'apertura del PDF toglie il fuoco all'editor: chi sfogliava con
    // Alt+freccia deve poter continuare a scrivere senza tornare a cliccare nel testo.
    if (avevaFuoco) editor.focus();
    _taAggiornaEtichetta(m, indice);
}

/** Dice QUALE carta si sta trascrivendo: senza, con più allegati non si sa dove si scrive. */
function _taAggiornaEtichetta(m, indice) {
    const barra = document.getElementById('trascrizione-carta');
    if (!barra) return;
    const allegati = (m && Array.isArray(m.allegati)) ? m.allegati : [];
    const totPagine = _taPaginaCorrente > 0 ? window.PdfViewer.numeroPagine() : 0;
    if (allegati.length < 2 && totPagine < 2) {
        barra.classList.add('hidden-tab');
        return;
    }
    const a = allegati[indice];
    const nome = (a && (a.originalName || a.nome)) || String(indice + 1);
    let testo = allegati.length < 2 ? nome : window.t('trasc_current_sheet', 'Carta {var0} di {var1} — {var2}')
        .replace('{var0}', String(indice + 1))
        .replace('{var1}', String(allegati.length))
        .replace('{var2}', nome);
    if (totPagine > 1) {
        testo += ', ' + window.t('trasc_page_of', 'p. {var0} di {var1}')
            .replace('{var0}', String(_taPaginaCorrente))
            .replace('{var1}', String(totPagine));
    }
    barra.textContent = testo;
    barra.classList.remove('hidden-tab');
}

/** Riaggancio dall'esterno (l'OCR scrive sul record e vuole vedere l'editor aggiornato). */
window.ricaricaEditorTrascrizione = function(m, indice) {
    if (!m || String(_taRecordCorrente) !== String(m.id)) return false;
    // La pagina resta quella aperta: dopo un riordino l'indice cambia ma il PDF è lo stesso.
    _taCaricaEditor(m, typeof indice === 'number' ? indice : _taIndiceCorrente, _taPaginaCorrente);
    return true;
};

window.salvaEditorTrascrizioneInMemoria = _taSalvaEditorInMemoria;
window.indiceCartaCorrente = function() { return _taIndiceCorrente; };
window.paginaPdfCorrente = function() { return _taPaginaCorrente; };

async function apriTrascrizione(id) {
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (!m) return;
    
    document.getElementById('trascrizione-id').value = m.id;
    document.getElementById('trascrizione-subtitle').textContent = `${m.segnatura} ${m.titolo ? '- ' + m.titolo : ''}`;

    // Migrazione in memoria della vecchia trascrizione unica sulla prima carta. Si fa qui e
    // non al salvataggio perché l'editor deve mostrare subito il testo giusto; è idempotente,
    // e finisce su disco al primo salvataggio della scheda — non prima, così aprire una
    // scheda per leggerla non la marca come modificata e non innesca una sincronizzazione.
    window.migraTrascrizioneSuAllegati(m);

    // L'aggancio parte SEMPRE dalla prima carta: `cambiaAllegatoTrascrizione` più sotto
    // conferma o cambia l'indice, e senza questa riga il primo travaso finirebbe
    // sull'indice lasciato dalla scheda precedente.
    // Invalida anche un cambio di carta ancora in volo sulla scheda precedente.
    _taGenerazioneCarta++;
    _taRecordCorrente = m.id;
    _taIndiceCorrente = 0;
    _taPaginaCorrente = 0;
    _taCaricaEditor(m, 0);
    window.trascrizioneNonSalvata = false;
    
    const panelAllegato = document.getElementById('trascrizione-allegato-panel');
    const resizer = document.getElementById('trascrizione-resizer');
    const editorPanel = document.getElementById('trascrizione-editor-panel');
    const btnCarica = document.getElementById('btn-carica-allegato-trasc');
    const btnCollapse = document.getElementById('btn-collapse-editor');
    // Fase 2.3: senza allegati non c'è nulla da riconoscere, e un pulsante che apre solo
    // un avviso è peggio di un pulsante assente.
    const btnOcr = document.getElementById('btn-ocr-trasc');
    
    const imgPreview = document.getElementById('trasc-img-preview') as HTMLImageElement;
    const noAllegato = document.getElementById('trasc-no-allegato');

    window.nascondiAnteprimaImmagine();
    _taNascondiBarraPdf();
    noAllegato.classList.add('hidden');
    imgPreview.src = '';

    const thumbContainer = document.getElementById('trascrizione-thumbnails');
    if (thumbContainer) thumbContainer.innerHTML = window.sanitizeHTML('');
    
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
        if (btnOcr) btnOcr.classList.remove('hidden-tab');
        if (btnCollapse) {
            btnCollapse.classList.remove('hidden');
            btnCollapse.innerHTML = window.sanitizeHTML('<i data-lucide="panel-left-close" class="w-5 h-5"></i>');
            btnCollapse.title = window.t("tooltip_collapse", "Collapse Editor");
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
        // `hidden-tab` e non `hidden`: `.btn` imposta display:inline-flex e batte l'utility
        // Tailwind a parità di specificità (lezione della 1.1, style.css:257).
        if (btnOcr) btnOcr.classList.add('hidden-tab');
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
    
    thumbContainer.innerHTML = window.sanitizeHTML('');
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
            btn.innerHTML = al.tipo === 'pdf' ? `<i data-lucide="file-text" class="w-3 h-3 inline-block mr-1"></i> ${escapeHTML(al.originalName || 'PDF ' + (i+1))}` : `<i data-lucide="image" class="w-3 h-3 inline-block mr-1"></i> ${escapeHTML(al.originalName || window.t("attachment_image", "Image") + ' ' + (i+1))}`;
            btn.onclick = () => window.cambiaAllegatoTrascrizione(al.nome, al.tipo, i);
            
            const btnEdit = document.createElement('button');
            btnEdit.className = "btn btn-ghost btn-icon rounded-none px-2 py-1";
            btnEdit.title = window.t("btn_rename_short", "Rename");
            btnEdit.innerHTML = window.sanitizeHTML('<i data-lucide="pencil" class="w-3 h-3"></i>');
            btnEdit.onclick = (e) => {
                e.stopPropagation();
                window.apriRenameModal(al.originalName || '', async (nuovoNome) => {
                    m.allegati[i].originalName = nuovoNome;
                    await salvaTutto();
                    if(typeof renderMain === 'function') renderMain();
                    window.renderThumbnailsTrascrizione(id);
                    const ic = window.currentAllegatoIndex || 0;
                    // Rinominare non è voltare pagina: si resta dove si era.
                    window.cambiaAllegatoTrascrizione(m.allegati[ic].nome, m.allegati[ic].tipo, ic, _taPaginaCorrente || undefined);
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
                    // Fase 2.3-bis: il testo viaggia con l'oggetto allegato, quindi il
                    // riordino non lo perde. L'INDICE però sì: dopo lo spostamento
                    // `_taIndiceCorrente` punterebbe a un'altra carta e il primo travaso
                    // successivo ci scriverebbe sopra. Si travasa prima e si ritrova la
                    // carta per identità dopo.
                    _taSalvaEditorInMemoria();
                    const cartaAperta = m.allegati[window.indiceCartaCorrente()];

                    const item = m.allegati.splice(dragIndex, 1)[0];
                    let targetIndex = i;
                    const rect = wrapper.getBoundingClientRect();
                    const mid = rect.left + rect.width / 2;
                    if (e.clientX > mid) targetIndex++;
                    if (dragIndex < targetIndex) targetIndex--;
                    m.allegati.splice(targetIndex, 0, item);

                    const nuovoIndice = m.allegati.indexOf(cartaAperta);
                    if (nuovoIndice !== -1) {
                        window.currentAllegatoIndex = nuovoIndice;
                        window.ricaricaEditorTrascrizione(m, nuovoIndice);
                    }
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

/**
 * Frecce sopra l'allegato. Sono continue: dentro un PDF scorrono le pagine, al bordo passano
 * alla carta vicina — il codice si sfoglia come una sequenza sola, qualunque sia la forma in
 * cui le carte sono arrivate.
 */
function _taAggiornaNavigazione(m, index) {
    const btnPrev = document.getElementById('btn-prev-allegato');
    const btnNext = document.getElementById('btn-next-allegato');
    if (!btnPrev || !btnNext || !m) return;
    const n = (m.allegati || []).length;
    const totPagine = _taPaginaCorrente > 0 ? window.PdfViewer.numeroPagine() : 0;
    if (n > 1 || totPagine > 1) {
        btnPrev.classList.remove('hidden');
        btnNext.classList.remove('hidden');
        btnPrev.style.display = (index > 0 || _taPaginaCorrente > 1) ? 'block' : 'none';
        btnNext.style.display = (index < n - 1 || (totPagine > 0 && _taPaginaCorrente < totPagine)) ? 'block' : 'none';
    } else {
        btnPrev.classList.add('hidden');
        btnNext.classList.add('hidden');
    }
}

/**
 * `pagina` vale solo per i PDF: omessa è la prima, -1 è l'ultima (ci si arriva tornando
 * indietro dalla carta successiva).
 */
window.cambiaAllegatoTrascrizione = async function(nome, tipo, index, pagina?) {
    const generazione = ++_taGenerazioneCarta;
    const superata = () => generazione !== _taGenerazioneCarta;
    // Fase 2.3-bis: il travaso deve precedere `_taCaricaEditor`, che è ciò che sposta
    // `_taIndiceCorrente` sulla carta nuova. Senza questa riga, quanto battuto sulla carta
    // che si sta lasciando non verrebbe mai messo al sicuro e sparirebbe al primo cambio:
    // togliendola, due E2E di `trascrizione.spec.ts` diventano rossi.
    _taSalvaEditorInMemoria();

    window.currentAllegatoIndex = index;
    const id = document.getElementById('trascrizione-id').value;
    const m = appData.manoscritti.find(x => x.id === id);
    const isPdf = tipo === 'pdf';
    if (m) {
        // Un PDF si aggancia solo quando se ne conosce la pagina, cioè dopo averlo aperto.
        if (isPdf) _taBloccaEditor(true);
        else _taCaricaEditor(m, index);
        _taAggiornaNavigazione(m, index);

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

    const imgPreview = document.getElementById('trasc-img-preview') as HTMLImageElement;
    const noAllegato = document.getElementById('trasc-no-allegato');

    window.nascondiAnteprimaImmagine();
    _taNascondiBarraPdf();
    noAllegato.classList.add('hidden');
    imgPreview.src = '';

    // Se il PDF non si può mostrare, l'editor lavora sul testo dell'allegato intero: meglio
    // una trascrizione con i marcatori di pagina in vista che un editor bloccato.
    const agganciaSenzaPagine = () => { if (m && isPdf) _taCaricaEditor(m, index, 0); };

    if (!nome) {
        agganciaSenzaPagine();
        noAllegato.classList.remove('hidden');
        return;
    }

    let expectedHash = null;
    if (m && m.allegati && m.allegati[index]) {
        expectedHash = m.allegati[index].hash;
    }

    if (expectedHash && window.apiBrowser && window.apiBrowser.verificaHashAllegato) {
        const result = await window.apiBrowser.verificaHashAllegato(nome, expectedHash);
        if (superata()) return;
        if (result.status === 'missing' || result.status === 'corrupted') agganciaSenzaPagine();
        if (result.status === 'missing') {
            const hubBtn = window.hubConfig ? `
                <button id="btn-scarica-allegato-hub" class="mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-sm transition-colors">
                    <i data-lucide="cloud-download" class="w-3.5 h-3.5"></i>
                    ${window.t("attachment_download_hub_btn", "Scarica dall'Hub")}
                </button>` : '';
            noAllegato.innerHTML = window.sanitizeHTML(`
                <div class="text-stone-400 mb-3"><i data-lucide="file-warning" class="w-12 h-12 mx-auto text-amber-500"></i></div>
                <h3 class="text-lg font-medium text-stone-300">${window.t("attachment_not_local_title", "Attachment not found locally")}</h3>
                <p class="text-sm text-stone-400 mt-2 max-w-md mx-auto">
                    ${window.t("attachment_not_local_desc1", "This archive is shared. The attachment file is not yet present on your PC.")}
                    <br>${window.t("attachment_not_local_desc2", "Use Cloud Explorer to sync attachments.")}
                </p>
                <div class="mt-4 p-3 bg-stone-900 border border-stone-800 rounded-sm text-xs font-mono text-stone-300 select-all break-all max-w-md mx-auto">
                    ${window.t("attachment_file_label", "File to insert:")} ${nome}
                </div>
                <p class="text-xs text-stone-500 mt-3">
                    ${window.t("attachment_copy_hint", "Copy the file to your attachments folder:")}<br>
                    <span class="font-mono text-[10px] break-all select-all text-amber-600">${result.path}</span>
                </p>
                ${hubBtn}
            `);
            noAllegato.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();

            const btnHub = document.getElementById('btn-scarica-allegato-hub') as HTMLButtonElement;
            if (btnHub) {
                btnHub.onclick = async () => {
                    btnHub.disabled = true;
                    btnHub.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> ${window.t("attachment_downloading", "Download in corso…")}`;
                    if (window.lucide) lucide.createIcons({ nodes: [btnHub] });
                    try {
                        // sincronizzaAllegatiHub mostra già i toast aggregati (caricati/scaricati/
                        // chiave errata/non ancora pubblicato). Qui copriamo solo il caso residuo in
                        // cui non ritorna nulla (es. attachmentsMode disattivato): nessun toast
                        // sarebbe altrimenti mostrato e il pannello si richiuderebbe in silenzio.
                        const r = await window.sincronizzaAllegatiHub(false);
                        if (!r) {
                            const check = await window.apiBrowser.verificaHashAllegato(nome, expectedHash);
                            if (check.status === 'missing') {
                                mostraMessaggio(window.t("msg_hub_attachment_not_uploaded",
                                    "Impossibile scaricare: la sincronizzazione allegati Hub non è attiva per questo archivio."), "warning");
                            }
                        }
                    } catch (e) {
                        console.error("Errore download allegato Hub:", e);
                        mostraMessaggio(e.message || "Errore durante il download dall'Hub.", "error");
                    } finally {
                        // Ri-renderizza la vista: se il download è riuscito mostrerà l'anteprima,
                        // altrimenti questo stesso pannello "non disponibile".
                        window.cambiaAllegatoTrascrizione(nome, tipo, index);
                    }
                };
            }
            return;
        } else if (result.status === 'corrupted') {
            mostraMessaggio(window.t("msg_attenzione_l_allegato_pot", "Attenzione: l'allegato potrebbe essere corrotto o modificato (Hash non corrispondente)."), "error");
            noAllegato.innerHTML = window.sanitizeHTML(`<div class="text-stone-400 mb-2"><i data-lucide="shield-alert" class="w-12 h-12 mx-auto text-red-500"></i></div><h3 class="text-lg font-medium text-stone-300">${window.t("attachment_unsafe_title", "Unsafe file")}</h3><p class="text-sm text-stone-500 mt-1">${window.t("attachment_unsafe_desc", "The file hash does not match the one saved in the cloud.")}</p>`);
            noAllegato.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
            return;
        } else {
            noAllegato.innerHTML = window.sanitizeHTML('<div class="text-stone-400 mb-2"><i data-lucide="image-off" class="w-12 h-12 mx-auto"></i></div><h3 class="text-lg font-medium text-stone-300" data-i18n="no_attachment">Nessun allegato disponibile per questa scheda.</h3>');
        }
    }

    const allegato = (m && m.allegati && m.allegati[index]) || { nome, tipo };

    if (isPdf) {
        const r = await window.PdfViewer.apri(nome);
        if (superata()) return;
        if (!r.ok || !m) {
            agganciaSenzaPagine();
            _taMostraErrorePdf();
            return;
        }
        const n = pagina === -1 ? r.pagine : Math.min(Math.max(1, Number(pagina) || 1), r.pagine);
        _taCaricaEditor(m, index, n);
        _taAggiornaNavigazione(m, index);
        await _taMostraPaginaPdf(m, index, n);
    } else {
        const altName = allegato.originalName || window.t('attachment_image', 'Immagine');
        imgPreview.alt = altName;
        window.mostraAnteprimaImmagine();

        // Una carta remota puo' non arrivare: server lento, rete assente, misura che
        // quell'implementazione non sa calcolare. Senza questo, il viewport resta
        // semplicemente vuoto e non si capisce se sia un difetto dell'app o della rete.
        imgPreview.onerror = () => {
            imgPreview.onerror = null;
            if (!allegato.remoto) return;
            window.nascondiAnteprimaImmagine();
            noAllegato.innerHTML = window.sanitizeHTML(
                '<div class="text-stone-400 mb-2"><i data-lucide="cloud-off" class="w-12 h-12 mx-auto text-amber-500"></i></div>' +
                `<h3 class="text-lg font-medium text-stone-300">${escapeHTML(window.t('iiif_img_failed_title', 'Carta non raggiungibile'))}</h3>` +
                `<p class="text-sm text-stone-500 mt-1 max-w-md mx-auto">${escapeHTML(window.t('iiif_img_failed_desc', 'Il server della biblioteca non ha restituito questa carta. Riprova, oppure scaricala nell\'archivio per averla anche senza rete.'))}</p>`
            );
            noAllegato.classList.remove('hidden');
            if (window.lucide) lucide.createIcons({ nodes: [noAllegato] });
        };

        // Sorgente DOPO aver reso visibile il viewport: l'adattamento si calcola sul `load`
        // e a pannello nascosto le dimensioni di layout sono zero.
        // 2000 px di larghezza per una carta IIIF: regge lo zoom del visualizzatore senza
        // chiedere al server il facsimile intero a ogni cambio carta.
        imgPreview.src = window.srcAllegato(allegato, { cacheBuster: true, lato: 2000 });
    }

    window.aggiornaBarraIiif(m, index);
};

// --- PDF: pagina per pagina ---------------------------------------------------

function _taNascondiBarraPdf() {
    const barra = document.getElementById('trasc-pdf-bar');
    if (barra) barra.classList.add('hidden-tab');
    _taChiudiRisultatiPdf();
}

function _taMostraErrorePdf() {
    const noAllegato = document.getElementById('trasc-no-allegato');
    if (!noAllegato) return;
    window.nascondiAnteprimaImmagine();
    _taNascondiBarraPdf();
    noAllegato.innerHTML = window.sanitizeHTML(
        '<div class="text-stone-400 mb-2"><i data-lucide="file-x" class="w-12 h-12 mx-auto text-amber-500"></i></div>' +
        `<h3 class="text-lg font-medium text-stone-300">${escapeHTML(window.t('pdf_open_failed_title', 'PDF non leggibile'))}</h3>` +
        `<p class="text-sm text-stone-500 mt-1 max-w-md mx-auto">${escapeHTML(window.t('pdf_open_failed_desc', 'Il file non si apre: potrebbe essere danneggiato o protetto da password. La trascrizione resta modificabile.'))}</p>`
    );
    noAllegato.classList.remove('hidden');
    if (window.lucide) lucide.createIcons({ nodes: [noAllegato] });
}

/** Disegna la pagina `n` e allinea la barra. Il testo dell'editor lo aggancia il chiamante. */
async function _taMostraPaginaPdf(m, index, n) {
    const barra = document.getElementById('trasc-pdf-bar');
    const campo = document.getElementById('trasc-pdf-pagina') as HTMLInputElement;
    const totale = window.PdfViewer.numeroPagine();
    if (barra) barra.classList.remove('hidden-tab');
    if (campo) {
        campo.value = String(n);
        campo.max = String(totale);
    }
    const etTotale = document.getElementById('trasc-pdf-totale');
    if (etTotale) etTotale.textContent = '/ ' + totale;
    const prec = document.getElementById('btn-pdf-pagina-prec') as HTMLButtonElement;
    const succ = document.getElementById('btn-pdf-pagina-succ') as HTMLButtonElement;
    if (prec) prec.disabled = n <= 1;
    if (succ) succ.disabled = n >= totale;

    const img = document.getElementById('trasc-img-preview') as HTMLImageElement;
    const viewport = document.getElementById('trasc-img-viewport');
    const a = m && m.allegati ? m.allegati[index] : null;
    img.onerror = null;
    img.alt = ((a && (a.originalName || a.nome)) || 'PDF') + ', ' +
        window.t('trasc_page_of', 'p. {var0} di {var1}').replace('{var0}', String(n)).replace('{var1}', String(totale));
    window.mostraAnteprimaImmagine();
    try {
        await window.PdfViewer.mostraPagina(n, img, viewport);
    } catch (e) {
        console.error('[PDF] Resa della pagina fallita:', e);
        _taMostraErrorePdf();
    }
}

/**
 * Cambio di pagina dentro il PDF aperto. Stessa regola del cambio di carta: prima si mette
 * al sicuro il testo della pagina che si lascia, poi si aggancia quella nuova.
 */
window.cambiaPaginaPdf = async function(pagina) {
    const id = document.getElementById('trascrizione-id').value;
    const m = appData.manoscritti.find(x => x.id === id);
    const index = _taIndiceCorrente;
    const a = m && m.allegati ? m.allegati[index] : null;
    const totale = window.PdfViewer.numeroPagine();
    if (!a || a.tipo !== 'pdf' || !totale || _taPaginaCorrente < 1) return;
    const n = Math.min(Math.max(1, Math.floor(Number(pagina)) || 1), totale);
    if (n === _taPaginaCorrente) return;
    // Un cambio di carta ancora in volo non deve poi riagganciare l'editor sopra questo.
    _taGenerazioneCarta++;
    _taSalvaEditorInMemoria();
    _taCaricaEditor(m, index, n);
    _taAggiornaNavigazione(m, index);
    await _taMostraPaginaPdf(m, index, n);
};

window.cambiaPaginaPdfRelativa = function(dir) {
    if (_taPaginaCorrente > 0) window.cambiaPaginaPdf(_taPaginaCorrente + dir);
};

window.vaiAPaginaPdfDaCampo = function() {
    const campo = document.getElementById('trasc-pdf-pagina') as HTMLInputElement;
    if (!campo) return;
    const n = Number(campo.value);
    if (!Number.isFinite(n) || n < 1) { campo.value = String(_taPaginaCorrente || 1); return; }
    window.cambiaPaginaPdf(n);
};

// --- PDF: ricerca --------------------------------------------------------------
//
// Cerca in due testi: il livello testo del PDF (vuoto sulle scansioni non passate da un OCR)
// e le trascrizioni per pagina. Il secondo è quello che conta su un manoscritto: il PDF di
// una riproduzione non contiene parole, la trascrizione sì.

let _taTimerRicercaPdf = null;

function _taChiudiRisultatiPdf() {
    const lista = document.getElementById('trasc-pdf-risultati');
    if (lista) { lista.classList.add('hidden-tab'); lista.innerHTML = ''; }
    const campo = document.getElementById('trasc-pdf-cerca');
    if (campo) campo.setAttribute('aria-expanded', 'false');
}

function _taStatoPdf(testo) {
    const stato = document.getElementById('trasc-pdf-stato');
    if (stato) stato.textContent = testo || '';
}

/** Pagine della trascrizione che contengono `q`, con estratto. Solo testo, niente markup. */
function _taCercaNelleTrascrizioni(m, index, q) {
    const a = m && m.allegati ? m.allegati[index] : null;
    if (!a) return [];
    window.migraTrascrizionePdfSuPagine(a);
    const pagine = Array.isArray(a.pagine) ? a.pagine : [];
    const out = [];
    // <template> e non <div>: il suo contenuto è inerte, un <img> dentro una trascrizione non
    // parte a caricare solo perché la si sta cercando.
    const contenitore = document.createElement('template');
    for (let k = 0; k < pagine.length; k++) {
        if (!window.trascrizioneHaTesto(pagine[k])) continue;
        // Testo dal DOM, non regex sui tag: le entità (&amp;, &nbsp;) vanno decodificate o
        // "Pietro &amp; Paolo" non si troverebbe cercando "&".
        contenitore.innerHTML = window.sanitizeHTML(pagine[k]);
        const testo = contenitore.content.textContent || '';
        const i = window.normalizzaTesto(testo).indexOf(q);
        if (i !== -1) out.push({ pagina: k + 1, estratto: window.estrattoAttorno(testo, i, q.length) });
    }
    return out;
}

async function _taEseguiRicercaPdf(query) {
    const id = document.getElementById('trascrizione-id').value;
    const m = appData.manoscritti.find(x => x.id === id);
    const lista = document.getElementById('trasc-pdf-risultati');
    const campo = document.getElementById('trasc-pdf-cerca');
    const q = window.normalizzaTesto(query).trim();
    if (!m || !lista || !q || _taPaginaCorrente < 1) { _taChiudiRisultatiPdf(); _taStatoPdf(''); return; }

    // Il testo che l'utente sta battendo fa parte della ricerca.
    _taSalvaEditorInMemoria();
    const index = _taIndiceCorrente;
    const daTrascrizione = _taCercaNelleTrascrizioni(m, index, q);

    const risultatiPdf = await window.PdfViewer.cerca(query, (n, tot) => {
        _taStatoPdf(window.t('pdf_searching', 'Ricerca… {var0}/{var1}').replace('{var0}', String(n)).replace('{var1}', String(tot)));
    });
    if (risultatiPdf === null) return; // superata da una ricerca più recente

    const voci = [
        ...daTrascrizione.map(r => ({ ...r, fonte: 'trascrizione' })),
        ...risultatiPdf.map(r => ({ ...r, fonte: 'pdf' }))
    ].sort((x, y) => x.pagina - y.pagina || (x.fonte === 'trascrizione' ? -1 : 1));

    lista.innerHTML = '';
    const pagineTrovate = new Set(voci.map(v => v.pagina)).size;
    _taStatoPdf(pagineTrovate
        ? window.t('pdf_results', 'Trovato in {var0} pagine').replace('{var0}', String(pagineTrovate))
        : window.t('pdf_no_results', 'Nessun risultato'));
    if (!voci.length) { _taChiudiRisultatiPdf(); return; }

    const fonti = {
        trascrizione: window.t('pdf_source_transcription', 'Trascrizione'),
        pdf: window.t('pdf_source_pdf', 'Testo del PDF')
    };
    for (const v of voci) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full text-left px-2 py-1.5 border-b border-stone-100 text-xs';
        // textContent ovunque: estratti e fonti vengono da un file e da una trascrizione.
        const testa = document.createElement('span');
        testa.className = 'font-semibold';
        testa.textContent = 'p. ' + v.pagina;
        const fonte = document.createElement('span');
        fonte.className = 'ml-2 text-stone-500';
        fonte.textContent = fonti[v.fonte];
        const estratto = document.createElement('span');
        estratto.className = 'block text-stone-600 truncate';
        estratto.textContent = v.estratto;
        btn.append(testa, fonte, estratto);
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
            _taChiudiRisultatiPdf();
            window.cambiaPaginaPdf(v.pagina);
        });
        li.appendChild(btn);
        lista.appendChild(li);
    }
    lista.classList.remove('hidden-tab');
    if (campo) campo.setAttribute('aria-expanded', 'true');
}

/** Ascoltatori della barra PDF: una volta sola, la vista è creata una volta sola. */
function _taAgganciaBarraPdf() {
    const campo = document.getElementById('trasc-pdf-cerca') as HTMLInputElement;
    if (!campo || campo.dataset.agganciato) return;
    campo.dataset.agganciato = '1';
    campo.addEventListener('input', () => {
        clearTimeout(_taTimerRicercaPdf);
        _taTimerRicercaPdf = setTimeout(() => _taEseguiRicercaPdf(campo.value), 250);
    });
    campo.addEventListener('keydown', (e) => {
        const lista = document.getElementById('trasc-pdf-risultati');
        if (e.key === 'Escape') {
            if (lista && !lista.classList.contains('hidden-tab')) {
                e.preventDefault();
                e.stopPropagation();
                _taChiudiRisultatiPdf();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const primo = lista && lista.querySelector('button');
            if (primo) (primo as HTMLButtonElement).click();
        } else if (e.key === 'ArrowDown') {
            const primo = lista && lista.querySelector('button');
            if (primo) { e.preventDefault(); (primo as HTMLButtonElement).focus(); }
        }
    });
    const lista = document.getElementById('trasc-pdf-risultati');
    if (lista) {
        lista.addEventListener('keydown', (e) => {
            const voci = Array.from(lista.querySelectorAll('button'));
            const i = voci.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === 'ArrowDown' && i < voci.length - 1) { e.preventDefault(); voci[i + 1].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? voci[i - 1] : campo).focus(); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); _taChiudiRisultatiPdf(); campo.focus(); }
        });
    }
    // PagSu/PagGiù sul visualizzatore: sfogliano come le frecce, attraversando le carte.
    const viewport = document.getElementById('trasc-img-viewport');
    if (viewport) {
        viewport.addEventListener('keydown', (e) => {
            if (e.key !== 'PageDown' && e.key !== 'PageUp') return;
            e.preventDefault();
            window.cambiaAllegatoRelativo(e.key === 'PageDown' ? 1 : -1);
        });
    }
}
document.addEventListener('DOMContentLoaded', () => setTimeout(_taAgganciaBarraPdf, 0));

// --- Import IIIF: carte remote ------------------------------------------------

/**
 * La barra della carta remota. Sta sopra l'immagine e non nel pannello "allegato mancante"
 * perché la carta remota NON è un allegato mancante: si vede benissimo, semplicemente non è
 * su questo disco. Il pannello di errore direbbe il contrario di quel che succede.
 */
window.aggiornaBarraIiif = function(m, index) {
    const barra = document.getElementById('trasc-iiif-bar');
    if (!barra) return;

    const al = (m && m.allegati && m.allegati[index]) || null;
    if (!al || !al.remoto) { barra.classList.add('hidden-tab'); return; }

    const attribuzione = (m && m.iiifAttribuzione) || '';
    document.getElementById('trasc-iiif-attribuzione').textContent =
        attribuzione || window.t('iiif_remote_page', 'Carta remota (IIIF)');
    barra.classList.remove('hidden-tab');

    const restanti = (m.allegati || []).filter(a => a && a.remoto).length;
    const btnTutte = document.getElementById('btn-iiif-scarica-tutte');
    btnTutte.classList.toggle('hidden', restanti < 2);
    document.getElementById('btn-iiif-scarica-carta').onclick = () => window.materializzaCarteIiif(m.id, [index]);
    btnTutte.onclick = () => window.materializzaCarteIiif(m.id, null);

    if (window.lucide) lucide.createIcons({ nodes: [barra] });
};

/**
 * L'avanzamento arriva dal main sulla barra di sincronizzazione, che e' gia' la barra di
 * tutte le operazioni lunghe. Registrato una volta sola: `onProgress` aggiunge un listener a
 * ogni chiamata, e dopo dieci download la stessa percentuale verrebbe scritta dieci volte.
 */
let _taProgressoIiifAgganciato = false;
function _taAscoltaProgressoIiif() {
    if (_taProgressoIiifAgganciato || !window.apiIiif || !window.apiIiif.onProgress) return;
    _taProgressoIiifAgganciato = true;
    window.apiIiif.onProgress((d) => {
        if (!d) return;
        window.updateSyncProgress(d.percent || 0, d.message || '');
    });
}

/**
 * Scarica le carte indicate (o tutte le remote) e le trasforma in allegati veri.
 *
 * ⚠️ Il record si aggiorna PER IDENTITÀ dell'allegato, non per indice: fra la richiesta e la
 * risposta l'utente può riordinare le carte dalla striscia (che è drag&drop), e scrivere
 * l'hash sull'indice vecchio lo attribuirebbe alla carta sbagliata — cioè a un file che non
 * corrisponde, che è esattamente ciò che la verifica dell'hash esiste per impedire.
 */
window.materializzaCarteIiif = async function(idScheda, indici) {
    const m = appData.manoscritti.find(x => x.id === idScheda);
    if (!m || !window.apiIiif) return;

    const allegati = m.allegati || [];
    const daScaricare = (indici === null || indici === undefined)
        ? allegati.filter(a => a && a.remoto)
        : indici.map(i => allegati[i]).filter(a => a && a.remoto);
    if (!daScaricare.length) return;

    // Il lato scelto all'import viaggia con la scheda: scaricare la carta 200 a una misura
    // diversa dalla 1 darebbe un facsimile disomogeneo, e nessuno se ne accorgerebbe finche'
    // non le mette una accanto all'altra.
    // `0` e' una scelta ("massima disponibile"), non un valore mancante: un `|| 2000`
    // scaricherebbe carte piu' piccole di quelle chieste all'import, senza dirlo.
    const lato = Number.isFinite(Number(m.iiifLato)) ? Number(m.iiifLato) : 2000;
    // La catena di ripieghi, non un URL solo: se il server non sa servire la misura chiesta
    // la carta si scarica alla massima disponibile invece di non scaricarsi.
    const richieste = daScaricare.map(a => ({
        nome: a.nome,
        urls: window.IiifManifest.candidatiAllegato(a, { lato })
    }));

    _taAscoltaProgressoIiif();
    window.toggleSyncProgress(true, 'iiif_downloading');
    try {
        const esito = await window.apiIiif.materializza(richieste);
        if (!esito || !esito.ok) {
            mostraMessaggio(window.t('iiif_err_download', 'Scaricamento delle carte non riuscito.'), 'error');
            return;
        }

        let fatte = 0;
        for (const r of esito.risultati || []) {
            if (!r.ok) continue;
            const al = allegati.find(a => a && a.nome === r.nome);
            if (!al) continue;
            al.hash = r.hash;
            delete al.remoto;
            delete al.iiif;
            fatte++;
        }

        if (fatte) {
            // La scheda e' cambiata davvero: gli hash delle carte materializzate devono
            // arrivare ai collaboratori, e senza `lastModified` il merge non se ne accorge.
            m.lastModified = Date.now();
            await salvaTutto();
            if (typeof renderMain === 'function') renderMain();
            window.renderThumbnailsTrascrizione(m.id);
            const i = window.currentAllegatoIndex || 0;
            if (allegati[i]) window.cambiaAllegatoTrascrizione(allegati[i].nome, allegati[i].tipo, i);
        }

        const falliti = (esito.risultati || []).filter(r => !r.ok).length;
        if (falliti) {
            mostraMessaggio(window.t('iiif_msg_partial', 'Alcune carte non sono state scaricate.') + ` (${falliti})`, 'error');
        } else {
            mostraMessaggio(window.t('iiif_msg_downloaded', 'Carte scaricate nell\'archivio.') + ` (${fatte})`, 'success');
        }
    } catch (e) {
        console.error('[IIIF] Materializzazione fallita:', e);
        mostraMessaggio(e.message || window.t('iiif_err_download', 'Scaricamento delle carte non riuscito.'), 'error');
    } finally {
        window.toggleSyncProgress(false);
    }
};

// Visibilità dell'anteprima immagine della trascrizione. Sta qui, in un solo punto, perché
// il viewport (Fase 1.2) va commutato con `hidden-tab` e va attivato al primo uso: i tre
// call site che prima facevano `imgPreview.classList.add('hidden')` avrebbero dovuto
// ricordarsene ciascuno.
window.nascondiAnteprimaImmagine = function() {
    const viewport = document.getElementById('trasc-img-viewport') as HTMLElement & { _imageViewer?: any };
    if (!viewport) return;
    viewport.classList.add('hidden-tab');
    if (viewport._imageViewer) viewport._imageViewer.reimposta();
};

window.mostraAnteprimaImmagine = function() {
    const viewport = document.getElementById('trasc-img-viewport') as HTMLElement & { _imageViewer?: any };
    const img = document.getElementById('trasc-img-preview');
    if (!viewport || !img) return;
    viewport.classList.remove('hidden-tab');
    if (window.attivaVisualizzatoreImmagini) {
        const viewer = window.attivaVisualizzatoreImmagini(viewport, img);
        if (viewer) viewer.reimposta();
    }
};

window.cambiaAllegatoRelativo = function(dir) {
    const id = document.getElementById('trascrizione-id').value;
    const m = appData.manoscritti.find(x => x.id === id);
    if (!m) return;
    
    let allegatiRender = m.allegati || [];
    const corrente = allegatiRender[window.currentAllegatoIndex || 0];
    // Dentro un PDF si scorrono prima le pagine; al bordo si passa alla carta vicina.
    if (corrente && corrente.tipo === 'pdf' && _taPaginaCorrente > 0) {
        const n = _taPaginaCorrente + dir;
        if (n >= 1 && n <= window.PdfViewer.numeroPagine()) {
            window.cambiaPaginaPdf(n);
            return;
        }
    }
    let newIndex = (window.currentAllegatoIndex || 0) + dir;
    if (newIndex >= 0 && newIndex < allegatiRender.length) {
        const al = allegatiRender[newIndex];
        // Tornando indietro su un PDF si entra dalla sua ultima pagina, come voltando carta.
        window.cambiaAllegatoTrascrizione(al.nome, al.tipo, newIndex, dir < 0 && al.tipo === 'pdf' ? -1 : undefined);
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
            btnToggle.innerHTML = window.sanitizeHTML('<i data-lucide="panel-left-close" class="w-5 h-5"></i>');
            btnToggle.title = window.t("tooltip_collapse", "Collapse Editor");
        }
    } else {
        editorPanel.classList.add('hidden');
        if (resizer) resizer.classList.add('hidden');
        if (btnToggle) {
            btnToggle.innerHTML = window.sanitizeHTML('<i data-lucide="panel-left-open" class="w-5 h-5"></i>');
            btnToggle.title = window.t("tooltip_expand_editor", "Expand Editor");
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
    
    // Il PDF aperto tiene worker, documento e pagine disegnate: fuori dalla vista non serve.
    _taGenerazioneCarta++;
    _taNascondiBarraPdf();
    window.PdfViewer.chiudi();
    
    // Resetta l'espansione dell'editor prima di tornare indietro
    const editorPanel = document.getElementById('trascrizione-editor-panel');
    const btnToggle = document.getElementById('btn-collapse-editor');
    const resizer = document.getElementById('trascrizione-resizer');
    if (editorPanel && editorPanel.classList.contains('hidden')) {
        editorPanel.classList.remove('hidden');
        if (resizer) resizer.classList.remove('hidden');
        if (btnToggle) {
            btnToggle.innerHTML = window.sanitizeHTML('<i data-lucide="panel-left-close" class="w-5 h-5"></i>');
            btnToggle.title = window.t("tooltip_collapse", "Collapse Editor");
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

    const settings = await window.apiSettings.get();
    const username = settings.username || 'Anonimo';

    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (m) {
        // Il testo a schermo appartiene alla carta corrente; le altre carte possono avere
        // modifiche pendenti in memoria, ed è per questo che si salva l'intero record e non
        // solo ciò che si vede.
        _taSalvaEditorInMemoria();
        // `m.trascrizione` resta la forma derivata: la ricalcolano solo i salvataggi, mai
        // i cambi di carta (vedi il commento in utils.ts).
        m.trascrizione = window.componiTrascrizioneRecord(m);
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

    // Quello che è nell'editor va messo al sicuro PRIMA di aggiungere l'allegato: la scheda
    // passa da "senza allegati" (testo su `m.trascrizione`) a "con allegati" (testo sulla
    // prima carta), e `apriTrascrizione` più sotto ricarica tutto da capo.
    _taSalvaEditorInMemoria();

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


