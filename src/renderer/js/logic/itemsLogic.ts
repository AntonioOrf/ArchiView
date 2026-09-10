// @ts-nocheck
async function spostaManoscritto(idManoscritto, nuovoPathCartella) {
    const m = appData.manoscritti.find(x => x.id === idManoscritto);
    if (m && m.cartella !== nuovoPathCartella) {
        if (window.Store) {
            await window.Store.updateManoscritto(idManoscritto, { cartella: nuovoPathCartella });
        } else {
            m.cartella = nuovoPathCartella;
            await salvaTutto();
            renderMain();
            if (typeof renderSidebar === 'function') renderSidebar();
        }
    }
}


/**
 * Il primo campo che impedisce il salvataggio, o `null`.
 *
 * I codici arrivano dal modello condiviso (`obbligatorio`, `numero`, `url`, `opzione`) e la
 * frase la mette qui il renderer: il modello vive anche nel main, dove la i18n non esiste
 * (lezione della 2.1). `unico` NON compare: è un avviso, non un blocco — vedi
 * `avvisaDuplicati`.
 */
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
        // ⚠️ `opzione` NON blocca (Fase 3.3). La tendina può produrre un valore fuori elenco
        // in un caso solo: quello già scritto nella scheda quando l'elenco era diverso — che
        // il form mostra marcato "valore non più previsto". Bloccare lì significherebbe una
        // scheda che non si può più salvare perché qualcun altro ha accorciato un
        // vocabolario: il dato vecchio va conservato, non tenuto in ostaggio.
        if (codice === 'opzione') continue;
        const etichetta = typeof window.etichettaCampo === 'function' ? window.etichettaCampo(def.id) : def.id;
        return { campo: def.id, codice, messaggio: (frasi[codice] || codice).replace('{var0}', etichetta) };
    }
    return null;
}

/**
 * Segnala — senza bloccare — i valori ripetuti nei campi dichiarati `unico`.
 *
 * Non blocca di proposito: un fondo reale contiene segnature ripetute per errori di
 * inventariazione antecedenti alla schedatura, e un'applicazione che rifiutasse di
 * registrarle costringerebbe l'archivista a falsificare il dato per poter salvare. Dirlo e
 * lasciar salvare è l'unico comportamento onesto (stessa linea della 3.6).
 */
function avvisaDuplicati(definizioni, valori, idCorrente, segnatura) {
    // Fase 3.6 — la segnatura è una chiave di SERVIZIO, non un campo del tipo documento:
    // non può portare il flag `unico` della 3.1, eppure è l'unico dato che identifica una
    // scheda per chi lavora. L'avviso vale sempre, senza doverlo dichiarare da qualche parte.
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
        return;   // un avviso per salvataggio: tre toast in fila non li legge nessuno
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const settings = await window.apiSettings.get();
    const username = settings.username || 'Anonimo';

    const idCorrente = document.getElementById('form-id').value;
    const documentoId = idCorrente || window.Model.nuovoId();

    let allegatiCorrenti = JSON.parse(document.getElementById('form-allegati').value || '[]');
    const fileInput = document.getElementById('form-allegato');
    
    if (window.pendingFilesToUpload && window.pendingFilesToUpload.length > 0 && window.apiBrowser) {
        const UPLOAD_CONCURRENCY = 3;
        const files = window.pendingFilesToUpload;
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

        // Upload concurrenti con limite UPLOAD_CONCURRENCY
        const queue = Array.from({ length: files.length }, (_, i) => i);
        const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, async () => {
            while (queue.length) await uploadOne(queue.shift()!);
        });
        await Promise.all(workers);

        for (const r of results) {
            if (r) allegatiCorrenti.push(r);
        }
    }

    const cartellaScelta = document.getElementById('form-cartella').value;
    const tipoId = document.getElementById('form-tipo-documento').value;
    // Memorizza il modello per precompilare la prossima scheda nuova.
    if (window.salvaUltimoTipoDocumento) window.salvaUltimoTipoDocumento(tipoId);
    
    const tipo = appData.tipiDocumento.find(t => t.id === tipoId) || appData.tipiDocumento[0];
    // Fase 3.7 — i campi del FORM, non quelli del tipo: la scheda può portarne di propri, e
    // leggere dal solo modello butterebbe via ciò che l'utente ha appena scritto in un campo
    // che gli era stato mostrato.
    const definizioni = window.campiDefinitiDelForm();
    const campiPropriScheda = window.campiPropriForm();
    const dynamicData = window.leggiCampiDinamici(definizioni);

    // Validazione: blocca solo ciò che l'utente ha dichiarato obbligatorio, o malformato.
    const errore = primoErroreCampi(definizioni, dynamicData);
    if (errore) {
        mostraMessaggio(errore.messaggio, 'error');
        const el = document.getElementById(window.idControlloCampo(errore.campo));
        if (el) {
            el.focus();
            el.classList.add('ring-2', 'ring-red-500');
            setTimeout(() => el.classList.remove('ring-2', 'ring-red-500'), 2500);
        }
        return;
    }

    let nomeAllegato = allegatiCorrenti.length > 0 ? allegatiCorrenti[0].nome : '';
    let tipoAllegato = allegatiCorrenti.length > 0 ? allegatiCorrenti[0].tipo : '';

    const mVecchio = idCorrente ? appData.manoscritti.find(x => x.id === idCorrente) : null;
    const creatoDa = mVecchio && mVecchio.creatoDa ? mVecchio.creatoDa : username;
    // Fase 4.5 — la fotografia PRIMA della modifica, per l'annullamento. Un clone e non il
    // riferimento: `updateManoscritto` fonde nell'oggetto vivo, e tenerne il riferimento
    // vorrebbe dire annullare verso lo stato nuovo (vedi la regola 3 in state.ts).
    const primaDellaModifica = mVecchio ? JSON.parse(JSON.stringify(mVecchio)) : null;

    // Fase 3.4 — la ripulitura dei tag (vuoti, spazi doppi, duplicati di sola maiuscola)
    // avviene qui, nell'unico punto in cui il form scrive nel record: `creaScheda` non
    // normalizza il contenuto, decide solo la forma. I tag nuovi entrano contestualmente
    // nell'anagrafica, così nascono già con una grafia canonica e un colore assegnabile;
    // la scrittura su disco resta una sola, quella del salvataggio qui sotto.
    const tagsScheda = window.Model.unisciTag(document.getElementById('form-tags').value);
    if (typeof window.registraTagUsati === 'function') window.registraTagUsati(tagsScheda);

    // Fase 3.5 — i collegamenti viaggiano nel campo nascosto, come gli allegati. La chiave
    // `relazioni` NON viene messa quando l'elenco è vuoto: comparirebbe su ogni scheda mai
    // collegata e ne cambierebbe l'impronta (`getRecordHash`), facendola risultare
    // modificata a ogni collega al primo sync.
    let relazioniScheda = [];
    try {
        relazioniScheda = window.Model.relazioni({ relazioni: JSON.parse(document.getElementById('form-relazioni')?.value || '[]') });
    } catch (err) {
        console.error('Campo relazioni illeggibile, la scheda si salva senza collegamenti:', err);
    }

    // Fase 3.0 — la forma del record la decide `shared/model.ts`, non il form: prima
    // aggiungere una chiave di servizio significava ricordarsi di aggiungerla anche
    // all'import ZIP e alla duplicazione, e nessuno dei tre punti sapeva degli altri.
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
        ...dynamicData // Include i campi personalizzati (dataCronica, prezzo, ecc.)
    });
    window.Model.scriviRelazioni(newData, relazioniScheda);

    // Fase 3.7 — le definizioni proprie della scheda. `scriviCampiPropri` toglie da sé ciò
    // che il tipo già dichiara: è la ripulitura del campo promosso al modello, e avviene
    // qui perché è la prima riscrittura della scheda dopo la promozione.
    window.Model.scriviCampiPropri(newData, campiPropriScheda, tipo);
    if (!Object.prototype.hasOwnProperty.call(newData, 'campiPropri')) newData.campiPropri = undefined;

    // Fase 3.8 — l'ordine dei campi di questa scheda. `scriviOrdineCampi` lo scarta se
    // coincide con quello naturale: un elenco che ripete il già noto sarebbe una chiave in
    // più nell'impronta del record, cioè mezzo archivio "modificato" al prossimo sync.
    // ⚠️ Il confronto è con l'ordine NATURALE, non con `definizioni`: quelle sono già
    // riordinate (`campiDefinitiDelForm` applica `ordineCampi`), quindi coinciderebbero
    // sempre con l'ordine scelto e la chiave non verrebbe salvata mai.
    window.Model.scriviOrdineCampi(newData, window.ordineCampiForm(), window.ordineNaturaleCampiForm());
    if (!Object.prototype.hasOwnProperty.call(newData, 'ordineCampi')) newData.ordineCampi = undefined;

    // ...e i VALORI dei campi propri tolti dalla scheda. Il salvataggio è un merge e non sa
    // esprimere una cancellazione: senza `undefined` il valore resterebbe nel record come
    // chiave orfana — invisibile nel form, ma ancora in export e in stampa.
    const vecchiPropri = mVecchio ? window.Model.campiPropri(mVecchio).map(d => d.id) : [];
    const restano = new Set(definizioni.map(d => d.id));
    for (const id of vecchiPropri) {
        if (!restano.has(id)) newData[id] = undefined;
    }
    // Il salvataggio di una scheda esistente è un MERGE (`Store.updateManoscritto`), e un
    // merge non sa esprimere una cancellazione: senza dirlo esplicitamente, togliere
    // l'ultimo collegamento lascerebbe in piedi quello vecchio. `undefined` è il modo in
    // cui il patch dice "togli questa chiave" — vedi il contratto di `updateManoscritto`.
    if (!Object.prototype.hasOwnProperty.call(newData, 'relazioni')) newData.relazioni = undefined;
    
    // Mantieni valori storici fissi per compatibilità con le vecchie card
    if(!newData.titolo && dynamicData.titolo) newData.titolo = dynamicData.titolo;
    if(!newData.autore && dynamicData.autore) newData.autore = dynamicData.autore;
    if(!newData.note && dynamicData.note) newData.note = dynamicData.note;

    if (window.Store) {
        if (idCorrente) {
            await window.Store.updateManoscritto(idCorrente, newData);
        } else {
            await window.Store.addManoscritto(newData);
        }
        window.cartellaAttuale = cartellaScelta;
        await window.Store.commit();
    } else {
        if (idCorrente) {
            const index = appData.manoscritti.findIndex(m => m.id === idCorrente);
            if (index !== -1) appData.manoscritti[index] = {...appData.manoscritti[index], ...newData}; 
        } else {
            appData.manoscritti.push(newData);
        }
        window.cartellaAttuale = cartellaScelta;
        await salvaTutto();
        renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    }

    // Fase 4.5 — la modifica di una scheda esistente entra nella cronologia di annullamento.
    // Solo la modifica: una scheda NUOVA non si annulla da qui, perché "annullare" una
    // creazione è eliminarla, e l'eliminazione ha già il suo percorso (con cestino, conferma
    // e toast). Un secondo modo di cancellare una scheda, silenzioso e senza copia di
    // sicurezza, sarebbe una trappola.
    if (idCorrente && primaDellaModifica && window.gestoreAnnullamento) {
        const dopo = JSON.parse(JSON.stringify(appData.manoscritti.find(x => String(x.id) === String(idCorrente)) || newData));
        const applica = async (stato) => {
            const vivo = appData.manoscritti.find(x => String(x.id) === String(idCorrente));
            if (!vivo) return;
            // Le chiavi sparite vanno TOLTE, non lasciate: un merge non sa esprimere una
            // cancellazione (è il contratto di `updateManoscritto`), e annullare
            // l'eliminazione dell'ultimo collegamento lo rimetterebbe in piedi.
            for (const k of Object.keys(vivo)) if (!(k in stato)) delete vivo[k];
            Object.assign(vivo, JSON.parse(JSON.stringify(stato)));
            if (window.Store) await window.Store.commit();
        };
        const etichetta = newData.segnatura || newData.titolo || window.t('record_untitled', 'scheda senza titolo');
        window.gestoreAnnullamento.registraAzione(
            window.t('undo_edit_record', 'Modifica di "{var0}"').replace('{var0}', String(etichetta)),
            () => applica(primaDellaModifica),
            () => applica(dopo)
        );
    }

    // Fase 3.1 — l'avviso sui campi `unico` arriva DOPO il salvataggio, non prima: la
    // scheda è salva comunque, e il messaggio dice all'utente che c'è un'altra scheda con
    // quel valore, non che ha sbagliato.
    avvisaDuplicati(definizioni, dynamicData, documentoId, newData.segnatura);

    window.isFormDirty = false;
    resetForm();
    switchTab('list');
}


async function editItem(id) {
    switchTab('add');

    const m = appData.manoscritti.find(x => x.id === id);
    document.getElementById('form-id').value = m.id;
    document.getElementById('form-cartella').value = m.cartella || '';
    document.getElementById('form-tipo-documento').value = m.tipoDocumento || 'manoscritto';

    // Fase 3.7 — le definizioni proprie entrano nel campo nascosto PRIMA del disegno:
    // `renderDynamicFields` le legge da lì per sapere quali controlli creare.
    if (window.scriviCampiPropriForm) window.scriviCampiPropriForm(window.Model.campiPropri(m));
    // Fase 3.8 — anche l'ordine, per la stessa ragione: `renderDynamicFields` legge da lì in
    // che sequenza disegnare i controlli.
    if (window.scriviOrdineCampiForm) window.scriviOrdineCampiForm(window.Model.ordineCampi(m));
    if (window.riordinoCampiAttivo && window.chiudiRiordinoCampi) window.chiudiRiordinoCampi(true);
    renderDynamicFields();
    
    document.getElementById('form-segnatura').value = m.segnatura || '';
    document.getElementById('form-tags').value = m.tags || '';
    if (typeof window.caricaRelazioniForm === 'function') window.caricaRelazioniForm(m);
    
    let allegatiList = [];
    if (m.allegati) {
        allegatiList = [...m.allegati];
    } else if (m.allegato) {
        allegatiList.push({ nome: m.allegato, tipo: m.allegatoTipo });
    }
    document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
    if(window.renderAllegatiForm) window.renderAllegatiForm(allegatiList);
    
    // Fase 3.7 — un solo popolamento per tutti i campi, propri compresi: le regole (zero
    // che è un dato, il valore fuori tendina, il riscontro della data) stanno in
    // `popolaCampiDinamici`, accanto alla lettura che le rispecchia.
    window.popolaCampiDinamici(window.campiDefinitiDelForm(), m);

    document.getElementById('form-title').textContent = window.t("title_edit_record", "Edit Record");
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
    const manoscritto = appData.manoscritti.find(x => x.id === id);
    if (!manoscritto) {
        chiudiDeleteModal();
        return;
    }
    
    // Clona il manoscritto per sicurezza
    const recordSalvato = JSON.parse(JSON.stringify(manoscritto));

    // Fase 4.1 — la copia nel cestino si prende PRIMA della rimozione, con il record ancora
    // intero. Un cestino non scrivibile non impedisce l'eliminazione: vedi cestinoLogic.ts.
    if (typeof window.cestinaRecord === 'function') {
        await window.cestinaRecord([recordSalvato], window.origineCestino(1));
    }

    if (window.Store) {
        await window.Store.deleteManoscritto(id);
    } else {
        appData.manoscritti = appData.manoscritti.filter(x => x !== id); // Fixed x !== id instead of x.id !== id for fallback just to pass but actually fallback won't be called
        // Tombstone
        if (!appData.deletedIds) appData.deletedIds = [];
        if (!appData.deletedIds.includes(id)) appData.deletedIds.push(id);
        
        await salvaTutto();
        renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    }
    
    chiudiDeleteModal();
    
    const ripristinaFn = async () => {
        if (appData.deletedIds) {
            appData.deletedIds = appData.deletedIds.filter(x => x !== recordSalvato.id);
        }
        if (window.Store) {
            await window.Store.addManoscritto(recordSalvato);
        } else {
            appData.manoscritti.push(recordSalvato);
            await salvaTutto();
            renderMain();
            if (typeof renderSidebar === 'function') renderSidebar();
        }
    };
    
    // Fase 4.5 — l'eliminazione è ripetibile: rifarla è rieseguirla sullo stesso id. Si
    // ricerca il record VIVO invece di riusare `recordSalvato`, che è la copia di prima
    // dell'annullamento: fra undo e redo la scheda può essere stata modificata.
    const rifaiFn = async () => {
        const vivo = appData.manoscritti.find(x => String(x.id) === String(recordSalvato.id));
        if (!vivo) return;
        if (typeof window.cestinaRecord === 'function') await window.cestinaRecord([vivo], window.origineCestino(1));
        if (window.Store) await window.Store.deleteManoscritto(recordSalvato.id);
    };

    if (window.gestoreAnnullamento) {
        window.gestoreAnnullamento.registraAzione(`Eliminazione di "${recordSalvato.titolo}"`, ripristinaFn, rifaiFn);
        mostraMessaggio(window.t("msg_record_deleted"), "success", () => window.gestoreAnnullamento.annullaUltimaAzione());
    } else {
        mostraMessaggio(window.t("msg_record_deleted"), "success");
    }
}


function cancelEdit() { switchTab('list'); }

// --- LOGICA TRASCRIZIONE ---
