async function spostaManoscritto(idManoscritto, nuovoPathCartella) {
    const m = appData.manoscritti.find(x => x.id === idManoscritto);
    if (m && m.cartella !== nuovoPathCartella) {
        await window.Store.updateManoscritto(idManoscritto, { cartella: nuovoPathCartella });
    }
}


function primoErroreCampi(definizioni, valori) {
    const frasi = {
        obbligatorio: window.t('err_field_required', 'Il campo "{var0}" è obbligatorio.'),
        numero: window.t('err_field_number', 'Il campo "{var0}" deve contenere un numero.'),
        url: window.t('err_field_url', 'Il campo "{var0}" deve essere un indirizzo web (https://…).'),
        opzione: window.t('err_field_option', 'Il valore del campo "{var0}" non è fra quelli previsti.')
    };
    for (const def of definizioni) {
        const codice = window.Model.validaValore(def, valori[def.id]);
        if (!codice) continue;
        if (codice === 'opzione') continue;
        const etichetta = typeof window.etichettaCampo === 'function' ? window.etichettaCampo(def.id) : def.id;
        return { campo: def.id, codice, messaggio: (frasi[codice] || codice).replace('{var0}', etichetta) };
    }
    return null;
}

function avvisaDuplicati(definizioni, valori, idCorrente, segnatura) {
    const doppie = window.Model.duplicatiCampo(appData.manoscritti, 'segnatura', segnatura, idCorrente);
    if (doppie.length) {
        mostraMessaggio(
            window.t('warn_signature_duplicate', 'Attenzione: la segnatura "{var0}" è già usata da un\'altra scheda ({var1} in tutto).')
                .replace('{var0}', String(segnatura))
                .replace('{var1}', String(doppie.length + 1)),
            'warning');
        return;
    }
    for (const def of definizioni) {
        if (!def.unico) continue;
        const duplicati = window.Model.duplicatiCampo(appData.manoscritti, def.id, valori[def.id], idCorrente);
        if (!duplicati.length) continue;
        const etichetta = typeof window.etichettaCampo === 'function' ? window.etichettaCampo(def.id) : def.id;
        const altra = appData.manoscritti.find(m => String(m.id) === String(duplicati[0]));
        mostraMessaggio(
            window.t('warn_field_duplicate', 'Attenzione: "{var0}" ha lo stesso valore di un altra scheda ({var1}).')
                .replace('{var0}', etichetta)
                .replace('{var1}', (altra && altra.segnatura) || String(duplicati.length)),
            'warning');
        return;
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (window.moduloInTrascrizione && window.moduloInTrascrizione()) {
        window.salvaSchedaTrascrizioneOra();
        return;
    }
    const esito = await salvaSchedaDalForm(false);
    if (!esito.ok) return;
    window.isFormDirty = false;
    resetForm();
    switchTab('list');
}

async function caricaFileInAttesa(files, documentoId) {
    const UPLOAD_CONCURRENCY = 3;
    const results: any[] = new Array(files.length).fill(null);

    const uploadOne = async (i: number) => {
        const file = files[i];
        try {
            const filePath = window.apiBrowser.getPathForFile ? window.apiBrowser.getPathForFile(file) : file.path;
            const risultato = await window.apiBrowser.salvaAllegato(filePath, documentoId);
            if (risultato) {
                results[i] = {
                    nome: risultato.fileName,
                    tipo: risultato.ext === '.pdf' ? 'pdf' : 'immagine',
                    originalName: file.name,
                    hash: risultato.hash
                };
            }
        } catch (error) {
            console.error("Errore durante il salvataggio dell'allegato:", error);
            mostraMessaggio(window.t("msg_file_save_error"), "error");
        }
    };

    const queue = Array.from({ length: files.length }, (_, i) => i);
    const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, async () => {
        while (queue.length) await uploadOne(queue.shift()!);
    });
    await Promise.all(workers);
    return results.filter(Boolean);
}

async function salvaSchedaDalForm(automatico) {
    const settings = await window.apiSettings.get();
    const username = settings.username || 'Anonimo';

    const idCorrente = document.getElementById('form-id').value;
    const documentoId = idCorrente || window.Model.nuovoId();

    let allegatiCorrenti = JSON.parse(document.getElementById('form-allegati').value || '[]');
    const caricati = (window.pendingFilesToUpload || []).length > 0;
    if (caricati && window.apiBrowser) allegatiCorrenti.push(...await caricaFileInAttesa(window.pendingFilesToUpload, documentoId));

    const cartellaScelta = document.getElementById('form-cartella').value;
    const tipoId = document.getElementById('form-tipo-documento').value;
    if (window.salvaUltimoTipoDocumento) window.salvaUltimoTipoDocumento(tipoId);
    
    const tipo = appData.tipiDocumento.find(t => t.id === tipoId) || appData.tipiDocumento[0];
    const definizioni = window.campiDefinitiDelForm();
    const campiPropriScheda = window.campiPropriForm();
    const dynamicData: Record<string, any> = window.leggiCampiDinamici(definizioni);

    if (window.pulisciErroriCampi) window.pulisciErroriCampi();
    const errore = primoErroreCampi(definizioni, dynamicData);
    if (errore) {
        if (!automatico) mostraMessaggio(errore.messaggio, 'error');
        const el = window.segnalaErroreCampo
            ? window.segnalaErroreCampo(errore.campo, errore.messaggio)
            : document.getElementById(window.idControlloCampo(errore.campo));
        if (el && !automatico) el.focus();
        return { ok: false, messaggio: errore.messaggio };
    }

    const mVecchio = idCorrente ? appData.manoscritti.find(x => x.id === idCorrente) : null;

    if (mVecchio && Array.isArray(window.allegatiBaseForm)) {
        const vivi = mVecchio.allegati || (mVecchio.allegato ? [{ nome: mVecchio.allegato, tipo: mVecchio.allegatoTipo }] : []);
        allegatiCorrenti = window.Model.fondiAllegati(window.allegatiBaseForm, allegatiCorrenti, vivi).allegati;
    }

    let nomeAllegato = allegatiCorrenti.length > 0 ? allegatiCorrenti[0].nome : '';
    let tipoAllegato = allegatiCorrenti.length > 0 ? allegatiCorrenti[0].tipo : '';

    const creatoDa = mVecchio && mVecchio.creatoDa ? mVecchio.creatoDa : username;
    const primaDellaModifica = mVecchio ? JSON.parse(JSON.stringify(mVecchio)) : null;

    const tagsScheda = window.Model.unisciTag(document.getElementById('form-tags').value);
    if (typeof window.registraTagUsati === 'function') window.registraTagUsati(tagsScheda);

    let relazioniScheda = [];
    try {
        relazioniScheda = window.Model.relazioni({ relazioni: JSON.parse(document.getElementById('form-relazioni')?.value || '[]') });
    } catch (err) {
        console.error('Campo relazioni illeggibile, la scheda si salva senza collegamenti:', err);
    }

    const newData = window.Model.creaScheda({
        id: documentoId,
        cartella: cartellaScelta,
        tipoDocumento: tipoId,
        segnatura: document.getElementById('form-segnatura').value,
        tags: tagsScheda,
        allegato: nomeAllegato,
        allegatoTipo: tipoAllegato,
        allegati: allegatiCorrenti,
        lastModified: Date.now(),
        creatoDa: creatoDa,
        modificatoDa: username,
        ...dynamicData
    });
    window.Model.scriviRelazioni(newData, relazioniScheda);

    window.Model.scriviCampiPropri(newData, campiPropriScheda, tipo);
    if (!Object.prototype.hasOwnProperty.call(newData, 'campiPropri')) newData.campiPropri = undefined;

    window.Model.scriviOrdineCampi(newData, window.ordineCampiForm(), window.ordineNaturaleCampiForm());
    if (!Object.prototype.hasOwnProperty.call(newData, 'ordineCampi')) newData.ordineCampi = undefined;

    const vecchiPropri = mVecchio ? window.Model.campiPropri(mVecchio).map(d => d.id) : [];
    const restano = new Set(definizioni.map(d => d.id));
    for (const id of vecchiPropri) {
        if (!restano.has(id)) newData[id] = undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(newData, 'relazioni')) newData.relazioni = undefined;
    if (typeof window.rimandiEsterniForm === 'function') window.Model.scriviRimandiEsterni(newData, window.rimandiEsterniForm());
    if (!Object.prototype.hasOwnProperty.call(newData, 'rimandiEsterni')) newData.rimandiEsterni = undefined;
    
    if(!newData.titolo && dynamicData.titolo) newData.titolo = dynamicData.titolo;
    if(!newData.autore && dynamicData.autore) newData.autore = dynamicData.autore;
    if(!newData.note && dynamicData.note) newData.note = dynamicData.note;

    if (idCorrente) {
        await window.Store.updateManoscritto(idCorrente, newData);
    } else {
        await window.Store.addManoscritto(newData);
    }
    const salvato = appData.manoscritti.find(x => String(x.id) === String(documentoId));
    if (salvato && window.ricomponiTrascrizioneFusa) window.ricomponiTrascrizioneFusa(salvato);
    window.cartellaAttuale = cartellaScelta;
    await window.Store.commit();

    if (idCorrente && primaDellaModifica && window.gestoreAnnullamento) {
        const dopo = JSON.parse(JSON.stringify(appData.manoscritti.find(x => String(x.id) === String(idCorrente)) || newData));
        const applica = async (stato) => {
            const vivo = appData.manoscritti.find(x => String(x.id) === String(idCorrente));
            if (!vivo) return;
            for (const k of Object.keys(vivo)) if (!(k in stato)) delete vivo[k];
            Object.assign(vivo, JSON.parse(JSON.stringify(stato)));
            await window.Store.commit();
        };
        const etichetta = newData.segnatura || newData.titolo || window.t('record_untitled', 'scheda senza titolo');
        window.gestoreAnnullamento.registraAzione(
            window.t('undo_edit_record', 'Modifica di "{var0}"').replace('{var0}', String(etichetta)),
            () => applica(primaDellaModifica),
            () => applica(dopo)
        );
    }

    // ponytail: nel salvataggio automatico l'avviso salterebbe a ogni pausa di scrittura; si
    // perde finché la scheda resta nel tab. Da rivedere se serve: avvisare una volta per valore.
    if (!automatico) avvisaDuplicati(definizioni, dynamicData, documentoId, newData.segnatura);

    if (automatico && salvato) {
        const allegatiSalvati = JSON.parse(JSON.stringify(salvato.allegati || []));
        window.allegatiBaseForm = allegatiSalvati;
        document.getElementById('form-allegati').value = JSON.stringify(allegatiSalvati);
        if (caricati) {
            window.pendingFilesToUpload = [];
            document.getElementById('form-allegato').value = '';
            document.getElementById('form-allegati-new-preview')?.classList.add('hidden');
            if (window.renderPendingFiles) window.renderPendingFiles();
            if (window.renderAllegatiForm) window.renderAllegatiForm(allegatiSalvati);
        }
    }
    return { ok: true };
}


async function editItem(id) {
    switchTab('add');
    window.caricaSchedaNelForm(id);
    window.aggiornaDocumentoScheda();
    document.getElementById('form-title').textContent = window.t("title_edit_record", "Edit Record");
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
}

window.caricaSchedaNelForm = function(id) {
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (!m) return;
    document.getElementById('form-id').value = m.id;
    document.getElementById('form-cartella').value = m.cartella || '';
    document.getElementById('form-tipo-documento').value = m.tipoDocumento || 'manoscritto';

    if (window.scriviCampiPropriForm) window.scriviCampiPropriForm(window.Model.campiPropri(m));
    if (window.scriviOrdineCampiForm) window.scriviOrdineCampiForm(window.Model.ordineCampi(m));
    if (window.riordinoCampiAttivo && window.chiudiRiordinoCampi) window.chiudiRiordinoCampi(true);
    if (window.azzeraMemoriaCompilazione) window.azzeraMemoriaCompilazione();
    renderDynamicFields();
    
    document.getElementById('form-segnatura').value = m.segnatura || '';
    document.getElementById('form-tags').value = m.tags || '';
    if (typeof window.caricaRelazioniForm === 'function') window.caricaRelazioniForm(m);
    if (typeof window.caricaRimandiEsterniForm === 'function') window.caricaRimandiEsterniForm(m);
    
    let allegatiList = [];
    if (m.allegati) {
        allegatiList = [...m.allegati];
    } else if (m.allegato) {
        allegatiList.push({ nome: m.allegato, tipo: m.allegatoTipo });
    }
    document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
    window.allegatiBaseForm = JSON.parse(JSON.stringify(allegatiList));
    if(window.renderAllegatiForm) window.renderAllegatiForm(allegatiList);

    window.popolaCampiDinamici(window.campiDefinitiDelForm(), m);
    window.isFormDirty = false;
};


function deleteItem(id) {
    document.getElementById('delete-item-id').value = id;
    document.getElementById('delete-modal').classList.remove('hidden-tab');
}

function chiudiDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden-tab');
}

async function confermaEliminazione() {
    const id = document.getElementById('delete-item-id').value;
    const manoscritto = appData.manoscritti.find(x => x.id === id);
    if (!manoscritto) {
        chiudiDeleteModal();
        return;
    }
    
    const recordSalvato = JSON.parse(JSON.stringify(manoscritto));

    if (typeof window.cestinaRecord === 'function') {
        await window.cestinaRecord([recordSalvato], window.origineCestino(1));
    }

    await window.Store.deleteManoscritto(id);
    chiudiDeleteModal();

    const ripristinaFn = async () => {
        window.Store.togliTombstone([recordSalvato.id]);
        await window.Store.addManoscritto(JSON.parse(JSON.stringify(recordSalvato)));
    };
    
    const rifaiFn = async () => {
        const vivo = appData.manoscritti.find(x => String(x.id) === String(recordSalvato.id));
        if (!vivo) return;
        if (typeof window.cestinaRecord === 'function') await window.cestinaRecord([vivo], window.origineCestino(1));
        await window.Store.deleteManoscritto(recordSalvato.id);
    };

    if (window.gestoreAnnullamento) {
        window.gestoreAnnullamento.registraAzione(`Eliminazione di "${recordSalvato.titolo}"`, ripristinaFn, rifaiFn);
        mostraMessaggio(window.t("msg_record_deleted"), "success", () => window.gestoreAnnullamento.annullaUltimaAzione());
    } else {
        mostraMessaggio(window.t("msg_record_deleted"), "success");
    }
}


function cancelEdit() { switchTab('list'); }

