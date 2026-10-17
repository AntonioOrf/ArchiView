let _taRecordCorrente: any = null;
let _taIndiceCorrente = 0;
let _taPaginaCorrente = 0;
let _taGenerazioneCarta = 0;

let _taFoto: any = null;

function _taFotografaCarte(m) {
    const copia = (v) => (Array.isArray(v) ? v.slice() : v);
    _taFoto = m ? {
        id: String(m.id),
        trascrizione: m.trascrizione,
        carte: (Array.isArray(m.allegati) ? m.allegati : []).filter(a => a && a.nome)
            .map(a => ({ nome: a.nome, trascrizione: a.trascrizione, pagine: copia(a.pagine) }))
    } : null;
}

function _taRipristinaFoto() {
    if (!_taFoto) return false;
    const m = appData.manoscritti.find(x => String(x.id) === _taFoto.id);
    if (!m) return false;
    const rimetti = (o, chiave, valore) => { if (valore === undefined) delete o[chiave]; else o[chiave] = valore; };
    rimetti(m, 'trascrizione', _taFoto.trascrizione);
    for (const f of _taFoto.carte) {
        const a = (Array.isArray(m.allegati) ? m.allegati : []).find(x => x && x.nome === f.nome);
        if (!a) continue;
        rimetti(a, 'trascrizione', f.trascrizione);
        rimetti(a, 'pagine', Array.isArray(f.pagine) ? f.pagine.slice() : f.pagine);
    }
    return true;
}

function _taSalvaEditorInMemoria() {
    if (_taRecordCorrente === null) return;
    const editor = document.getElementById('trascrizione-editor') as HTMLInputElement;
    if (!editor) return;
    const m = appData.manoscritti.find(x => String(x.id) === String(_taRecordCorrente));
    if (!m) return;
    window.scriviTrascrizioneAllegato(m, _taIndiceCorrente, editor.innerHTML, _taPaginaCorrente);
}

let _taFuocoPrimaDelBlocco = false;
function _taBloccaEditor(bloccato) {
    const editor = document.getElementById('trascrizione-editor') as HTMLInputElement;
    if (!editor) return;
    if (bloccato && editor.getAttribute('contenteditable') !== 'false') {
        _taFuocoPrimaDelBlocco = document.activeElement === editor;
    }
    editor.setAttribute('contenteditable', bloccato ? 'false' : 'true');
    if (bloccato) editor.setAttribute('aria-busy', 'true');
    else editor.removeAttribute('aria-busy');
}

function _taCaricaEditor(m, indice, pagina = 0) {
    const editor = document.getElementById('trascrizione-editor') as HTMLInputElement;
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
    if (avevaFuoco) editor.focus();
    _taAggiornaEtichetta(m, indice);
}

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

window.ricaricaEditorTrascrizione = function(m, indice) {
    if (!m || String(_taRecordCorrente) !== String(m.id)) return false;
    _taCaricaEditor(m, typeof indice === 'number' ? indice : _taIndiceCorrente, _taPaginaCorrente);
    return true;
};

window.salvaEditorTrascrizioneInMemoria = _taSalvaEditorInMemoria;
window.indiceCartaCorrente = function() { return _taIndiceCorrente; };

const _TA_CHIAVE_TAB = 'trascrizioneTab';
const _TA_PAUSA_SALVATAGGIO = 800;
let _taTimerScheda: any = null;
let _taSalvataggioScheda: any = null;
let _taSporco = false;
let _taSenzaProgramma = false;

Object.defineProperty(window, 'isFormDirty', {
    configurable: true,
    get: () => _taSporco,
    set: (v) => {
        _taSporco = !!v;
        if (_taSporco && !_taSenzaProgramma && window.moduloInTrascrizione()) _taProgrammaSalvataggio();
    }
});

window.moduloInTrascrizione = function() {
    const form = document.getElementById('manoscritto-form');
    return !!form && form.parentElement?.id === 'trasc-pannello-scheda';
};

function _taStatoScheda(testo, classe?) {
    const el = document.getElementById('trasc-scheda-stato');
    if (!el) return;
    el.textContent = testo;
    el.className = 'text-xs truncate' + (classe ? ' ' + classe : '');
}

function _taProgrammaSalvataggio() {
    clearTimeout(_taTimerScheda);
    _taStatoScheda('');
    _taTimerScheda = setTimeout(() => window.salvaSchedaTrascrizioneOra(), _TA_PAUSA_SALVATAGGIO);
}

window.salvaSchedaTrascrizioneOra = async function() {
    clearTimeout(_taTimerScheda);
    _taTimerScheda = null;
    while (_taSalvataggioScheda) await _taSalvataggioScheda;
    if (!window.isFormDirty || !window.moduloInTrascrizione()) return !window.isFormDirty;
    _taSalvataggioScheda = (async () => {
        window.isFormDirty = false;
        _taStatoScheda(window.t('trasc_record_saving', 'Salvataggio…'));
        try {
            const esito = await salvaSchedaDalForm(true);
            if (esito.ok) {
                window.trascrizioneNonSalvata = false;
                _taFotografaCarte(appData.manoscritti.find(x => String(x.id) === String(_taRecordCorrente)));
                const ora = new Date().toLocaleTimeString(window.localeAttuale(), { hour: '2-digit', minute: '2-digit' });
                _taStatoScheda(window.t('trasc_record_saved', 'Salvata alle {var0}').replace('{var0}', ora), 'testo-successo');
                window.renderBarraCarte((document.getElementById('trascrizione-id') as HTMLInputElement).value);
                return true;
            }
            _taStatoScheda(esito.messaggio, 'testo-pericolo');
        } catch (err) {
            console.error('Salvataggio automatico della scheda non riuscito:', err);
            _taStatoScheda(window.t('trasc_record_save_error', 'Scheda non salvata: riprova.'), 'testo-pericolo');
        }
        _taSenzaProgramma = true;
        window.isFormDirty = true;
        _taSenzaProgramma = false;
        return false;
    })();
    try { return await _taSalvataggioScheda; } finally { _taSalvataggioScheda = null; }
};

function _taMostraPannello(scheda) {
    (document.getElementById('trasc-pannello-testo') as HTMLInputElement).classList.toggle('hidden-tab', scheda);
    (document.getElementById('trasc-pannello-scheda') as HTMLInputElement).classList.toggle('hidden-tab', !scheda);
    (document.getElementById('tab-trasc-testo') as HTMLInputElement).setAttribute('aria-selected', String(!scheda));
    (document.getElementById('tab-trasc-scheda') as HTMLInputElement).setAttribute('aria-selected', String(scheda));
    _taApplicaLarghezza();
}

function _taChiaveLarghezza() {
    return 'larghezzaTrascrizione:' + (window.moduloInTrascrizione() ? 'scheda' : 'testo');
}

window.ricordaLarghezzaTrascrizione = function(p) {
    window.prefLocale(_taChiaveLarghezza(), p);
};

function _taApplicaLarghezza() {
    const editorPanel = document.getElementById('trascrizione-editor-panel');
    if (!editorPanel || (document.getElementById('trascrizione-allegato-panel') as HTMLInputElement).classList.contains('hidden-tab')) return;
    const salvata = window.prefLocale(_taChiaveLarghezza());
    const p = window.proporzioneSeparatore(parseFloat(salvata) || 50, false);
    editorPanel.style.width = `${p}%`;
    document.getElementById('trascrizione-resizer')?.setAttribute('aria-valuenow', String(Math.round(p)));
}

function _taRiponiModulo() {
    clearTimeout(_taTimerScheda);
    _taTimerScheda = null;
    const form = document.getElementById('manoscritto-form');
    if (form && window.moduloInTrascrizione()) {
        (document.getElementById('view-add') as HTMLInputElement).appendChild(form);
        resetForm();
    }
    _taStatoScheda('');
    _taMostraPannello(false);
}

window.riponiModuloSePulito = function() {
    if (window.isFormDirty || _taSalvataggioScheda) return false;
    _taRiponiModulo();
    return true;
};

window.lasciaSchedaTrascrizione = async function() {
    if (!window.moduloInTrascrizione()) return true;
    if (await window.salvaSchedaTrascrizioneOra()) {
        _taRiponiModulo();
        return true;
    }
    return new Promise((risolvi) => {
        window.mostraBottomConfirm(window.t('unsaved_prompt', 'Ci sono modifiche non salvate alla scheda. Sei sicuro di voler uscire perdendo le modifiche?'), () => {
            _taRiponiModulo();
            risolvi(true);
        }, null, () => risolvi(false));
    });
};

window.mostraSchedaTrascrizione = async function(tab) {
    const scheda = tab === 'scheda';
    if (!window.finestraSatellite) window.prefLocale(_TA_CHIAVE_TAB, scheda ? 'scheda' : 'testo');
    const staccata = !!(window.schedaStaccata && window.schedaStaccata());
    (document.getElementById('trasc-scheda-staccata') as HTMLInputElement).classList.toggle('hidden-tab', !staccata);
    if (staccata) {
        _taMostraPannello(scheda);
        if (scheda) window.apiFinestre.messaggio('mostra');
        return;
    }
    if (scheda && !window.finestraSatellite && window.prefLocale('finestraStaccata:scheda') === '1' && window.staccaScheda) {
        await window.staccaScheda();
        return;
    }
    if (scheda === window.moduloInTrascrizione()) {
        _taMostraPannello(scheda);
        return;
    }
    if (!scheda) {
        if (await window.lasciaSchedaTrascrizione()) (document.getElementById('tab-trasc-testo') as HTMLInputElement).focus();
        return;
    }
    _taSalvaEditorInMemoria();
    aggiornaSelectCartelle();
    aggiornaSelectTipiDocumento();
    if (typeof window.aggiornaSelettoriRelazione === 'function') window.aggiornaSelettoriRelazione();
    (document.getElementById('trasc-pannello-scheda') as HTMLInputElement).appendChild((document.getElementById('manoscritto-form') as HTMLInputElement));
    window.caricaSchedaNelForm((document.getElementById('trascrizione-id') as HTMLInputElement).value);
    _taMostraPannello(true);
    if (window.lucide) lucide.createIcons();
};

window.caricaSchedaStaccata = async function(id) {
    if (window.moduloInTrascrizione()) window.riponiModuloSePulito();
    (document.getElementById('trascrizione-id') as HTMLInputElement).value = id;
    await window.mostraSchedaTrascrizione('scheda');
};

window.alternaSchedaTrascrizione = function() {
    window.mostraSchedaTrascrizione(window.moduloInTrascrizione() ? 'testo' : 'scheda');
};

async function apriTrascrizione(id) {
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (!m) return;
    if (!(await window.lasciaSchedaTrascrizione())) return;

    (document.getElementById('trascrizione-id') as HTMLInputElement).value = m.id;
    (document.getElementById('trascrizione-subtitle') as HTMLInputElement).textContent = `${m.segnatura} ${m.titolo ? '- ' + m.titolo : ''}`;

    window.migraTrascrizioneSuAllegati(m);
    _taFotografaCarte(m);

    _taGenerazioneCarta++;
    _taRecordCorrente = m.id;
    _taIndiceCorrente = 0;
    _taPaginaCorrente = 0;
    _taCaricaEditor(m, 0);
    window.trascrizioneNonSalvata = false;
    
    const panelAllegato = document.getElementById('trascrizione-allegato-panel') as HTMLInputElement;
    const resizer = document.getElementById('trascrizione-resizer');
    const editorPanel = document.getElementById('trascrizione-editor-panel');
    const btnCarica = document.getElementById('btn-carica-allegato-trasc') as HTMLInputElement;
    const btnCollapse = document.getElementById('btn-collapse-editor');
    const btnOcr = document.getElementById('btn-ocr-trasc');
    
    const imgPreview = document.getElementById('trasc-img-preview') as HTMLImageElement;
    const noAllegato = document.getElementById('trasc-no-allegato') as HTMLInputElement;

    window.nascondiAnteprimaImmagine();
    _taNascondiBarraPdf();
    noAllegato.classList.add('hidden');
    imgPreview.src = '';

    (document.getElementById('trasc-carte-bar') as HTMLInputElement).classList.add('hidden-tab');
    
    const allegatiM = normalizzaAllegati(m);
    
    if (allegatiM.length > 0 && window.apiBrowser) {
        panelAllegato.classList.remove('hidden-tab');
        if (resizer) resizer.classList.remove('hidden');
        if (editorPanel) editorPanel.classList.remove('hidden');
        _taApplicaLarghezza();
        btnCarica.classList.add('hidden');
        if (btnOcr) btnOcr.classList.remove('hidden-tab');
        if (btnCollapse) {
            btnCollapse.classList.remove('hidden');
            btnCollapse.innerHTML = window.sanitizeHTML('<i data-lucide="panel-left-close" class="w-5 h-5"></i>');
            btnCollapse.title = window.t("tooltip_collapse", "Collapse Editor");
        }

        window.renderBarraCarte(m.id);
        
        if (window.cambiaAllegatoTrascrizione && m.allegati && m.allegati[0]) {
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
        if (btnOcr) btnOcr.classList.add('hidden-tab');
        if (btnCollapse) btnCollapse.classList.add('hidden');
    }

    switchTab('trascrizione');
    if (window.schedaStaccata && window.schedaStaccata()) window.apiFinestre.messaggio('carica', window.datiFinestraStaccata(m.id));
    if (window.prefLocale(_TA_CHIAVE_TAB) === 'scheda') await window.mostraSchedaTrascrizione('scheda');
    else _taMostraPannello(false);
    if (window.lucide) lucide.createIcons();
}

window.apriTrascrizioneSuCarta = async function(id, carta, pagina, parola) {
    await apriTrascrizione(id);
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    const a = m && m.allegati ? m.allegati[carta] : null;
    if (a) await window.cambiaAllegatoTrascrizione(a.nome, a.tipo, carta, pagina);
    const editor = document.getElementById('trascrizione-editor') as HTMLInputElement;
    if (!editor || !parola) return;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodi: any[] = [];
    let testo = '';
    while (walker.nextNode()) {
        nodi.push({ nodo: walker.currentNode, da: testo.length });
        testo += (walker.currentNode as Text).data;
    }
    const i = testo.indexOf(parola);
    if (i === -1) return;
    const punto = (k) => {
        const n = nodi.filter(x => x.da <= k).pop();
        return [n.nodo, k - n.da];
    };
    const range = document.createRange();
    range.setStart(...(punto(i) as [Node, number]));
    range.setEnd(...(punto(i + parola.length) as [Node, number]));
    editor.focus();
    const sel = window.getSelection();
    if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
    }
    (range.startContainer.parentElement || editor).scrollIntoView({ block: 'center', behavior: window.comportamentoScroll() });
};

function _taAggiornaBarraCarte(m, index) {
    const barra = document.getElementById('trasc-carte-bar');
    if (!barra) return;
    const allegati = (m && Array.isArray(m.allegati)) ? m.allegati : [];
    if (allegati.length < 2) {
        barra.classList.add('hidden-tab');
        return;
    }
    const i = Math.min(Math.max(0, index || 0), allegati.length - 1);
    const a = allegati[i];
    const campo = document.getElementById('trasc-carta-numero') as HTMLInputElement;
    campo.value = String(i + 1);
    campo.max = String(allegati.length);
    (document.getElementById('trasc-carte-totale') as HTMLInputElement).textContent = '/ ' + allegati.length;
    (document.getElementById('btn-carta-prec') as HTMLButtonElement).disabled = i === 0;
    (document.getElementById('btn-carta-succ') as HTMLButtonElement).disabled = i === allegati.length - 1;
    const nome = document.getElementById('trasc-carta-nome') as HTMLInputElement;
    nome.textContent = a.originalName || (a.tipo === 'pdf' ? 'PDF ' : window.t('attachment_image', 'Immagine') + ' ') + (i + 1);
    nome.title = nome.textContent;
    const stato = document.getElementById('trasc-carta-stato') as HTMLSelectElement;
    stato.replaceChildren(...[''].concat(window.STATI_CARTA).map(s => new Option(s ? window.t('stato_carta_' + s, s) : window.t('sheet_status_none', 'Nessuno stato'), s)));
    stato.value = a.stato || '';
    barra.classList.remove('hidden-tab');
}

window.renderBarraCarte = function(id) {
    const m = appData.manoscritti.find(x => x.id === id);
    if (m) _taAggiornaBarraCarte(m, window.currentAllegatoIndex || 0);
};

function _taVaiACarta(n) {
    const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
    const m = appData.manoscritti.find(x => x.id === id);
    const allegati = (m && m.allegati) || [];
    const i = Math.floor(Number(n)) - 1;
    if (!Number.isFinite(i) || i < 0 || i >= allegati.length) {
        _taAggiornaBarraCarte(m, window.currentAllegatoIndex || 0);
        return;
    }
    if (i === (window.currentAllegatoIndex || 0)) return;
    window.cambiaAllegatoTrascrizione(allegati[i].nome, allegati[i].tipo, i);
}

window.cambiaCartaRelativa = function(dir) { _taVaiACarta((window.currentAllegatoIndex || 0) + 1 + dir); };

window.vaiACartaDaCampo = function() {
    _taVaiACarta((document.getElementById('trasc-carta-numero') as HTMLInputElement).value);
};

window.rinominaCartaCorrente = function() {
    const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
    const m = appData.manoscritti.find(x => x.id === id);
    const i = window.currentAllegatoIndex || 0;
    const al = m && m.allegati ? m.allegati[i] : null;
    if (!m || !al) return;
    window.apriRenameModal(al.originalName || '', async (nuovoNome) => {
        al.originalName = nuovoNome;
        m.lastModified = Date.now();
        await salvaTutto();
        if (typeof renderMain === 'function') renderMain();
        _taAggiornaBarraCarte(m, i);
        _taAggiornaEtichetta(m, i);
    });
};

window.impostaStatoCarta = async function(valore) {
    const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
    const m = appData.manoscritti.find(x => x.id === id);
    const al = m && m.allegati ? m.allegati[window.currentAllegatoIndex || 0] : null;
    if (!m || !al) return;
    if (window.STATI_CARTA.includes(valore)) al.stato = valore;
    else delete al.stato;
    m.lastModified = Date.now();
    try {
        await salvaTutto();
    } catch (e) {
        console.error('Stato della carta non salvato:', e);
        mostraMessaggio(window.t('msg_errore_salvataggio', 'Errore nel salvataggio dei dati: ') + (e.message || e), 'error');
    }
    if (typeof renderMain === 'function') renderMain();
};

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

window.cambiaAllegatoTrascrizione = async function(nome, tipo, index, pagina?) {
    const generazione = ++_taGenerazioneCarta;
    const superata = () => generazione !== _taGenerazioneCarta;
    _taSalvaEditorInMemoria();

    window.currentAllegatoIndex = index;
    const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
    const m = appData.manoscritti.find(x => x.id === id);
    const isPdf = tipo === 'pdf';
    if (m) {
        if (isPdf) _taBloccaEditor(true);
        else _taCaricaEditor(m, index);
        _taAggiornaNavigazione(m, index);

        _taAggiornaBarraCarte(m, index);
    }

    const imgPreview = document.getElementById('trasc-img-preview') as HTMLImageElement;
    const noAllegato = document.getElementById('trasc-no-allegato') as HTMLInputElement;

    window.nascondiAnteprimaImmagine();
    _taNascondiBarraPdf();
    noAllegato.classList.add('hidden');
    imgPreview.src = '';

    const agganciaSenzaPagine = () => { if (m && isPdf) _taCaricaEditor(m, index, 0); };

    if (!nome) {
        agganciaSenzaPagine();
        noAllegato.classList.remove('hidden');
        return;
    }

    let expectedHash: any = null;
    if (m && m.allegati && m.allegati[index]) {
        expectedHash = m.allegati[index].hash;
    }

    if (expectedHash && window.apiBrowser && window.apiBrowser.verificaHashAllegato) {
        const result = await window.apiBrowser.verificaHashAllegato(nome, expectedHash);
        if (superata()) return;
        if (result.status === 'missing' || result.status === 'corrupted') agganciaSenzaPagine();
        if (result.status === 'missing') {
            const hubBtn = window.hubConfig ? `
                <button id="btn-scarica-allegato-hub" class="btn btn-primary mt-4 text-xs">
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
                    ${window.t("attachment_file_label", "File to insert:")} ${escapeHTML(String(nome || ''))}
                </div>
                <p class="text-xs text-stone-500 mt-3">
                    ${window.t("attachment_copy_hint", "Copy the file to your attachments folder:")}<br>
                    <span class="font-mono text-[11px] break-all select-all text-amber-600">${escapeHTML(String(result.path || ''))}</span>
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

    const allegato: Partial<AVAllegato> = (m && m.allegati && m.allegati[index]) || { nome, tipo };

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
        const viewer = (document.getElementById('trasc-img-viewport') as any)?._imageViewer;
        if (viewer && m) viewer.impostaRegioni(window.Model.annotazioni(allegato), (lista) => _taSalvaRegioni(m.id, allegato.nome, lista));

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

        imgPreview.src = window.srcAllegato(allegato, { cacheBuster: true, lato: 2000 });
    }

    window.aggiornaBarraIiif(m, index);
};

function _taNascondiBarraPdf() {
    const barra = document.getElementById('trasc-pdf-bar');
    if (barra) barra.classList.add('hidden-tab');
    _taChiudiRisultatiPdf();
}

function _taMostraErrorePdf() {
    const noAllegato = document.getElementById('trasc-no-allegato') as HTMLInputElement;
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
        const mostrata = await window.PdfViewer.mostraPagina(n, img, viewport);
        if (mostrata && window.pdfZoomIniziale === 'larghezza' && (viewport as any)._imageViewer) {
            await img.decode().catch(() => {});
            (viewport as any)._imageViewer.adatta('larghezza');
        }
    } catch (e) {
        console.error('[PDF] Resa della pagina fallita:', e);
        _taMostraErrorePdf();
    }
}

window.cambiaPaginaPdf = async function(pagina) {
    const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
    const m = appData.manoscritti.find(x => x.id === id);
    const index = _taIndiceCorrente;
    const a = m && m.allegati ? m.allegati[index] : null;
    const totale = window.PdfViewer.numeroPagine();
    if (!a || a.tipo !== 'pdf' || !totale || _taPaginaCorrente < 1) return;
    const n = Math.min(Math.max(1, Math.floor(Number(pagina)) || 1), totale);
    if (n === _taPaginaCorrente) return;
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

let _taTimerRicercaPdf: any = null;

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

function _taCercaNelleTrascrizioni(m, index, q) {
    const a = m && m.allegati ? m.allegati[index] : null;
    if (!a) return [];
    window.migraTrascrizionePdfSuPagine(a);
    const pagine = Array.isArray(a.pagine) ? a.pagine : [];
    const out: any[] = [];
    const contenitore = document.createElement('template');
    for (let k = 0; k < pagine.length; k++) {
        if (!window.trascrizioneHaTesto(pagine[k])) continue;
        contenitore.innerHTML = window.sanitizeHTML(pagine[k]);
        const testo = contenitore.content.textContent || '';
        const i = window.normalizzaTesto(testo).indexOf(q);
        if (i !== -1) out.push({ pagina: k + 1, estratto: window.estrattoAttorno(testo, i, q.length) });
    }
    return out;
}

async function _taEseguiRicercaPdf(query) {
    const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
    const m = appData.manoscritti.find(x => x.id === id);
    const lista = document.getElementById('trasc-pdf-risultati');
    const campo = document.getElementById('trasc-pdf-cerca');
    const q = window.normalizzaTesto(query).trim();
    if (!m || !lista || !q || _taPaginaCorrente < 1) { _taChiudiRisultatiPdf(); _taStatoPdf(''); return; }

    _taSalvaEditorInMemoria();
    const index = _taIndiceCorrente;
    const daTrascrizione = _taCercaNelleTrascrizioni(m, index, q);

    const risultatiPdf = await window.PdfViewer.cerca(query, (n, tot) => {
        _taStatoPdf(window.t('pdf_searching', 'Ricerca… {var0}/{var1}').replace('{var0}', String(n)).replace('{var1}', String(tot)));
    });
    if (risultatiPdf === null) return;

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

window.aggiornaBarraIiif = function(m, index) {
    const barra = document.getElementById('trasc-iiif-bar');
    if (!barra) return;

    const al = (m && m.allegati && m.allegati[index]) || null;
    if (!al || !al.remoto) { barra.classList.add('hidden-tab'); return; }

    const attribuzione = (m && m.iiifAttribuzione) || '';
    (document.getElementById('trasc-iiif-attribuzione') as HTMLInputElement).textContent =
        attribuzione || window.t('iiif_remote_page', 'Carta remota (IIIF)');
    barra.classList.remove('hidden-tab');

    const restanti = (m.allegati || []).filter(a => a && a.remoto).length;
    const btnTutte = document.getElementById('btn-iiif-scarica-tutte') as HTMLInputElement;
    btnTutte.classList.toggle('hidden', restanti < 2);
    (document.getElementById('btn-iiif-scarica-carta') as HTMLInputElement).onclick = () => window.materializzaCarteIiif(m.id, [index]);
    btnTutte.onclick = () => window.materializzaCarteIiif(m.id, null);

    if (window.lucide) lucide.createIcons({ nodes: [barra] });
};

let _taProgressoIiifAgganciato = false;
function _taAscoltaProgressoIiif() {
    if (_taProgressoIiifAgganciato || !window.apiIiif || !window.apiIiif.onProgress) return;
    _taProgressoIiifAgganciato = true;
    window.apiIiif.onProgress((d) => {
        if (!d) return;
        window.updateSyncProgress(d.percent || 0, d.message || '');
    });
}

window.materializzaCarteIiif = async function(idScheda, indici) {
    const prima = appData.manoscritti.find(x => String(x.id) === String(idScheda));
    if (!prima || !window.apiIiif) return;

    const daScaricare = (indici === null || indici === undefined)
        ? (prima.allegati || []).filter(a => a && a.remoto)
        : indici.map(i => (prima.allegati || [])[i]).filter(a => a && a.remoto);
    if (!daScaricare.length) return;

    const lato = Number.isFinite(Number(prima.iiifLato)) ? Number(prima.iiifLato) : 2000;
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

        const m = appData.manoscritti.find(x => String(x.id) === String(idScheda));
        if (!m) return;
        const allegati = m.allegati || [];
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
            m.lastModified = Date.now();
            await salvaTutto();
            if (typeof renderMain === 'function') renderMain();
            window.renderBarraCarte(m.id);
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

window.nascondiAnteprimaImmagine = function() {
    const viewport = document.getElementById('trasc-img-viewport') as HTMLElement & { _imageViewer?: any };
    if (!viewport) return;
    viewport.classList.add('hidden-tab');
    if (viewport._imageViewer) {
        viewport._imageViewer.reimposta();
        viewport._imageViewer.impostaRegioni(null);
    }
};

async function _taSalvaRegioni(id, nome, lista) {
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    const al = m && Array.isArray(m.allegati) ? m.allegati.find(a => a && a.nome === nome) : null;
    if (!m || !al) return;
    if (lista.length) al.annotazioni = lista;
    else delete al.annotazioni;
    m.lastModified = Date.now();
    try {
        await salvaTutto();
    } catch (e) {
        console.error('Regioni della carta non salvate:', e);
        mostraMessaggio(window.t('msg_errore_salvataggio', 'Errore nel salvataggio dei dati: ') + (e.message || e), 'error');
    }
}

window.apriRegioneSuCarta = async function(id, carta, regione) {
    await window.apriTrascrizioneSuCarta(id, carta);
    const viewer = (document.getElementById('trasc-img-viewport') as any)?._imageViewer;
    if (viewer) viewer.scegliRegione(regione, true);
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
    const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
    const m = appData.manoscritti.find(x => x.id === id);
    if (!m) return;
    
    let allegatiRender = m.allegati || [];
    const corrente = allegatiRender[window.currentAllegatoIndex || 0];
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
        window.cambiaAllegatoTrascrizione(al.nome, al.tipo, newIndex, dir < 0 && al.tipo === 'pdf' ? -1 : undefined);
    }
};

window.toggleFullscreenAllegato = function() {
    const editorPanel = document.getElementById('trascrizione-editor-panel');
    const btnToggle = document.getElementById('btn-collapse-editor');
    const resizer = document.getElementById('trascrizione-resizer');
    const panelAllegato = document.getElementById('trascrizione-allegato-panel') as HTMLInputElement;
    
    if (!editorPanel) return;
    if (panelAllegato && panelAllegato.classList.contains('hidden-tab')) {
        return;
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
    (document.getElementById('unsaved-modal') as HTMLInputElement).classList.add('hidden-tab');
    window.isClosingApp = false;
}

window.confermaUscitaTrascrizione = async function() {
    const chiudendo = window.isClosingApp;
    if (typeof chiudiUnsavedModal === 'function') chiudiUnsavedModal();
    const scarta = window.trascrizioneNonSalvata;
    window.trascrizioneNonSalvata = false;
    if (scarta && _taRipristinaFoto()) {
        try {
            await window.Store.commit();
            if (typeof window.flushSalvataggio === 'function') await window.flushSalvataggio();
        } catch (e) {
            console.error('Ripristino della trascrizione non salvato:', e);
        }
    }
    _taFoto = null;
    window.isClosingApp = chiudendo;
    if (window.isClosingApp && window.apiBrowser && window.apiBrowser.confirmClose) {
        window.apiBrowser.confirmClose();
    } else {
        switchTab('list');
    }
    
    _taGenerazioneCarta++;
    _taNascondiBarraPdf();
    window.PdfViewer.chiudi();
    
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
        (document.getElementById('unsaved-modal') as HTMLInputElement).classList.remove('hidden-tab');
        return;
    }
    window.confermaUscitaTrascrizione();
}

async function salvaTrascrizione() {
    if (window.moduloInTrascrizione()) await window.salvaSchedaTrascrizioneOra();
    const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
    const editor = document.getElementById('trascrizione-editor') as HTMLInputElement;

    const settings = await window.apiSettings.get();
    const username = settings.username || 'Anonimo';

    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (m) {
        _taSalvaEditorInMemoria();
        m.trascrizione = window.componiTrascrizioneRecord(m);
        m.lastModified = Date.now();
        m.modificatoDa = username;
        await salvaTutto();
        window.trascrizioneNonSalvata = false;
        _taFotografaCarte(m);
        mostraMessaggio(window.t("msg_transcription_saved"), "success");
        editor.focus();
    }
}

async function caricaAllegatoTrascrizione(e) {
    const file = e.target.files[0];
    if (!file || !window.apiBrowser) return;
    
    const id = (document.getElementById('trascrizione-id') as HTMLInputElement).value;
    const m = appData.manoscritti.find(x => x.id === id);
    if (!m) return;

    _taSalvaEditorInMemoria();

    try {
        const settings = await window.apiSettings.get();
        const username = settings.username || 'Anonimo';
        
        const filePath = window.apiBrowser.getPathForFile ? window.apiBrowser.getPathForFile(file) : file.path;
        const risultato = await window.apiBrowser.salvaAllegato(filePath, id);
        if (risultato) {
            if (!m.allegati) m.allegati = [];
            if (m.allegato && m.allegati.length === 0) {
                m.allegati.push({ nome: m.allegato, tipo: m.allegatoTipo || '', originalName: 'Allegato' });
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
            
            apriTrascrizione(id);
        }
    } catch (error) {
        console.error("Errore caricamento da trascrizione:", error);
        mostraMessaggio(window.t("msg_attachment_error"), "error");
    }
    
    e.target.value = '';
}


