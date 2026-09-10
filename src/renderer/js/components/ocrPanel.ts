// @ts-nocheck
// Fase 2.3 — OCR degli allegati: superficie utente.
//
// Qui non c'è nessun motore: tesseract e pdf.js vivono nel Main (`src/main/ocr/`) e questo
// file parla solo con `window.apiOcr`. È la stessa divisione della 1.3 (`filtersPanel.ts` è
// solo superficie, i predicati stanno in `utils.ts`) e della 2.1 (la generazione del CSV è
// un modulo puro nel main): la logica che si può sbagliare deve stare dove si può testare.
//
// NOMI PRIVATI COL PREFISSO `_o`: il bundle di produzione concatena TUTTI gli script del
// renderer in un unico scope (scripts/build-renderer-bundle.js). Una `function _riga` qui
// dentro sostituirebbe l'omonima di un altro file per l'intero bundle, senza un errore in
// console — è già successo nella 1.5 con `_select`, e sette E2E dei filtri sono diventati
// rossi per quella riga.

// --- Lettura del testo riconosciuto -------------------------------------------

/**
 * Testo OCR di una scheda: la concatenazione di quello dei suoi allegati.
 *
 * È la funzione che rende il riconoscimento *cercabile*. Vive qui e non nell'indice di
 * `mainView.ts` perché la usano tre consumatori — l'indice della griglia, il vincolo
 * `ocr:` della query e la colonna di stato — e tre copie divergerebbero al primo cambio
 * di forma del record.
 */
window.testoOcrRecord = function(m) {
    if (!m || !Array.isArray(m.allegati)) return '';
    let out = '';
    for (const a of m.allegati) {
        if (a && a.ocr && typeof a.ocr.testo === 'string' && a.ocr.testo) out += a.ocr.testo + '\n';
    }
    return out;
};

/** Quanti allegati della scheda hanno già un testo riconosciuto. */
window.contaAllegatiConOcr = function(m) {
    if (!m || !Array.isArray(m.allegati)) return 0;
    return m.allegati.filter(a => a && a.ocr && a.ocr.testo).length;
};

// --- Stato del pannello -------------------------------------------------------

const _oStato = {
    recordId: null,
    indice: 0,
    inCorso: false,
    risultato: null,
    lingue: []
};

function _oT(k, d) { return window.t(k, d); }

function _oRecord() {
    if (!_oStato.recordId) return null;
    return appData.manoscritti.find(x => String(x.id) === String(_oStato.recordId)) || null;
}

function _oAllegati(m) {
    return (m && Array.isArray(m.allegati)) ? m.allegati : [];
}

async function _oSalva() {
    if (window.Store) {
        await window.Store.commit();
    } else {
        await window.apiBrowser.salvaDati(appData);
        if (typeof renderMain === 'function') renderMain();
    }
}

/** Lingue installate, in ordine, con l'italiano davanti: è la lingua di chi usa il programma. */
async function _oCaricaLingue() {
    try {
        const r = await window.apiOcr.lingue();
        _oStato.lingue = (r && r.lingue) || [];
    } catch (errore) {
        console.error('[OCR] Elenco lingue non leggibile:', errore);
        _oStato.lingue = [];
    }
    return _oStato.lingue;
}

function _oLingueInstallate() {
    return _oStato.lingue.filter(l => l.installata && l.codice !== 'osd');
}

/**
 * Lingue preselezionate: quelle usate l'ultima volta su questo workspace, altrimenti
 * l'italiano se installato. La scelta va ricordata perché in un fondo si lavora per mesi
 * sulla stessa lingua, e ripeterla a ogni carta è la definizione di attrito.
 */
function _oLinguePredefinite() {
    const installate = _oLingueInstallate().map(l => l.codice);
    // La preferenza sta in localStorage e NON in `appData`: finirebbe nel database, quindi
    // nel sync, e imporrebbe ai colleghi una scelta che dipende dalle lingue installate
    // sulla LORO macchina — cioè un valore che da loro può non esistere affatto.
    let salvate = [];
    try {
        salvate = String(localStorage.getItem('archiview.ocr.lingue') || '').split('+').filter(Boolean);
    } catch (errore) {
        console.error('[OCR] localStorage non leggibile:', errore);
    }
    const valide = salvate.filter(c => installate.includes(c));
    if (valide.length) return valide;
    if (installate.includes('ita')) return ['ita'];
    return installate.slice(0, 1);
}

function _oRicordaLingue(lingue) {
    try {
        localStorage.setItem('archiview.ocr.lingue', lingue.join('+'));
    } catch (errore) {
        console.error('[OCR] localStorage non scrivibile:', errore);
    }
}

// --- Costruzione del corpo del modale -----------------------------------------

function _oRiga(etichetta, controllo) {
    const wrap = document.createElement('label');
    wrap.className = 'flex flex-col gap-1';
    const span = document.createElement('span');
    span.className = 'form-label mb-0';
    span.textContent = etichetta;
    wrap.append(span, controllo);
    return wrap;
}

function _oNota(testo, classe) {
    const p = document.createElement('p');
    p.className = classe || 'text-xs text-stone-500 dark:text-stone-400 leading-relaxed';
    p.textContent = testo;
    return p;
}

function _oSelect(id, opzioni, valore) {
    const sel = document.createElement('select');
    sel.id = id;
    sel.className = 'form-input';
    for (const o of opzioni) {
        const opt = document.createElement('option');
        opt.value = String(o.value);
        opt.textContent = o.label;   // textContent: i nomi degli allegati sono dati utente
        if (String(o.value) === String(valore)) opt.selected = true;
        sel.appendChild(opt);
    }
    return sel;
}

function _oCheckbox(id, etichetta, spuntato) {
    const wrap = document.createElement('label');
    wrap.className = 'flex items-center gap-2 text-sm cursor-pointer';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = !!spuntato;
    input.className = 'accent-amber-700';
    const span = document.createElement('span');
    span.textContent = etichetta;
    wrap.append(input, span);
    return wrap;
}

/** Nome leggibile di un allegato, con il suo indice: il nome su disco non dice nulla. */
function _oEtichettaAllegato(a, i) {
    const nome = (a && a.originalName) || (a && a.nome) || `${i + 1}`;
    const marca = a && a.ocr && a.ocr.testo ? ' ✓' : '';
    return `${i + 1}. ${nome}${marca}`;
}

function _oBlocccoLingue(preselezione) {
    const contenitore = document.createElement('div');
    contenitore.className = 'flex flex-col gap-2';

    const installate = _oLingueInstallate();
    if (installate.length === 0) {
        // Senza dati di lingua l'OCR non può partire, e dirlo con un messaggio d'errore a
        // riconoscimento avviato sarebbe farglielo scoprire nel modo peggiore.
        const avviso = _oNota(
            _oT('ocr_no_langs', 'Nessuna lingua installata: il riconoscimento ha bisogno almeno di una lingua.'),
            'text-sm text-amber-800 dark:text-amber-300 leading-relaxed'
        );
        contenitore.appendChild(avviso);
    } else {
        const griglia = document.createElement('div');
        griglia.className = 'flex flex-wrap gap-x-4 gap-y-1';
        griglia.id = 'ocr-langs-choice';
        for (const l of installate) {
            griglia.appendChild(_oCheckbox('ocr-lang-' + l.codice, l.nome, preselezione.includes(l.codice)));
        }
        contenitore.appendChild(griglia);
        contenitore.appendChild(_oNota(_oT('ocr_langs_hint',
            'Più lingue insieme rallentano il riconoscimento: sceglile solo se il documento le mescola davvero.')));
    }

    const gestisci = document.createElement('button');
    gestisci.type = 'button';
    gestisci.className = 'btn btn-ghost text-xs self-start px-2 py-1';
    gestisci.textContent = _oT('ocr_manage_langs', 'Gestisci lingue…');
    gestisci.onclick = () => window.apriGestioneLingueOcr();
    contenitore.appendChild(gestisci);

    return contenitore;
}

function _oLingueScelte() {
    const griglia = document.getElementById('ocr-langs-choice');
    if (!griglia) return [];
    return Array.from(griglia.querySelectorAll('input[type=checkbox]'))
        .filter(c => c.checked)
        .map(c => c.id.replace('ocr-lang-', ''));
}

// --- Modale principale --------------------------------------------------------

window.chiudiOcrModal = function() {
    const modal = document.getElementById('ocr-modal');
    if (!modal) return;
    // Un riconoscimento in corso non va lasciato orfano: chiudere la finestra senza
    // annullarlo terrebbe occupato il motore e la prossima apertura risponderebbe
    // "già in corso" senza che l'utente sappia perché.
    if (_oStato.inCorso) window.annullaOcr();
    modal.classList.add('hidden-tab');
};

/**
 * @param recordId  scheda su cui lavorare (default: quella in trascrizione)
 * @param indice    allegato preselezionato
 */
window.apriOcrModal = async function(recordId, indice) {
    if (!window.apiOcr) return;

    let id = recordId;
    if (!id) {
        const campo = document.getElementById('trascrizione-id');
        id = campo ? campo.value : null;
    }
    const m = appData.manoscritti.find(x => String(x.id) === String(id));
    if (!m) return;

    const allegati = _oAllegati(m);
    if (allegati.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_no_attachments', 'Questa scheda non ha allegati da riconoscere.'), 'info');
        }
        return;
    }

    _oStato.recordId = m.id;
    _oStato.indice = Math.min(Math.max(Number(indice) || 0, 0), allegati.length - 1);
    _oStato.risultato = null;
    _oStato.inCorso = false;

    const modal = document.getElementById('ocr-modal');
    if (!modal) return;
    const corpo = modal.querySelector('#ocr-body');
    corpo.innerHTML = '';

    await _oCaricaLingue();
    const preselezione = _oLinguePredefinite();

    modal.querySelector('#ocr-subtitle').textContent = `${m.segnatura || ''} ${m.titolo ? '— ' + m.titolo : ''}`.trim();

    // Sorgente
    corpo.appendChild(_oRiga(
        _oT('ocr_source', 'Allegato'),
        _oSelect('ocr-source', [
            ...allegati.map((a, i) => ({ value: i, label: _oEtichettaAllegato(a, i) })),
            { value: 'tutti', label: _oT('ocr_source_all', 'Tutti gli allegati della scheda') }
        ], _oStato.indice)
    ));

    // Lingue
    corpo.appendChild(_oRiga(_oT('ocr_langs', 'Lingue'), _oBlocccoLingue(preselezione)));

    // Destinazione
    const destinazione = document.createElement('div');
    destinazione.className = 'flex flex-col gap-1';
    destinazione.appendChild(_oCheckbox('ocr-dest-bozza', _oT('ocr_dest_draft', 'Inserisci come bozza nella trascrizione'), true));
    destinazione.appendChild(_oCheckbox('ocr-dest-indice', _oT('ocr_dest_index', 'Rendi il testo cercabile'), true));
    corpo.appendChild(_oRiga(_oT('ocr_destination', 'Destinazione'), destinazione));
    corpo.appendChild(_oNota(_oT('ocr_dest_hint',
        'Il testo cercabile resta legato all\'allegato e non tocca la trascrizione: serve a ritrovare la scheda, non a sostituire il lavoro di lettura.')));

    // Opzioni avanzate: chiuse, perché il valore giusto è quello predefinito.
    const avanzate = document.createElement('details');
    avanzate.className = 'text-sm';
    const riassunto = document.createElement('summary');
    riassunto.className = 'cursor-pointer text-xs text-stone-500 dark:text-stone-400';
    riassunto.textContent = _oT('ocr_advanced', 'Opzioni avanzate');
    avanzate.appendChild(riassunto);
    const corpoAvanzate = document.createElement('div');
    corpoAvanzate.className = 'flex flex-col gap-2 mt-2';
    corpoAvanzate.appendChild(_oRiga(_oT('ocr_dpi', 'Risoluzione di scansione dei PDF'), _oSelect('ocr-dpi', [
        { value: 200, label: '200 dpi — ' + _oT('ocr_dpi_fast', 'veloce') },
        { value: 300, label: '300 dpi — ' + _oT('ocr_dpi_default', 'consigliata') },
        { value: 400, label: '400 dpi — ' + _oT('ocr_dpi_slow', 'lenta, testo minuto') }
    ], 300)));
    const maxPagine = document.createElement('input');
    maxPagine.type = 'number';
    maxPagine.id = 'ocr-max-pagine';
    maxPagine.className = 'form-input';
    maxPagine.min = '1';
    maxPagine.value = '20';
    corpoAvanzate.appendChild(_oRiga(_oT('ocr_max_pages', 'Pagine massime per PDF'), maxPagine));
    corpoAvanzate.appendChild(_oNota(_oT('ocr_max_pages_hint',
        'Il limite esiste perché un PDF di trecento carte occuperebbe il programma per ore senza che nessuno lo abbia chiesto.')));
    avanzate.appendChild(corpoAvanzate);
    corpo.appendChild(avanzate);

    // Avanzamento e risultato: nascosti finché non servono.
    const avanzamento = document.createElement('div');
    avanzamento.id = 'ocr-progress';
    avanzamento.className = 'hidden-tab flex flex-col gap-2';
    avanzamento.innerHTML = window.sanitizeHTML(`
        <div class="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
            <div id="ocr-progress-bar" class="h-full bg-amber-600 transition-all" style="width:0%"></div>
        </div>
        <p id="ocr-progress-text" class="text-xs text-stone-500 dark:text-stone-400"></p>
    `);
    corpo.appendChild(avanzamento);

    const risultato = document.createElement('div');
    risultato.id = 'ocr-result';
    risultato.className = 'hidden-tab flex flex-col gap-2';
    corpo.appendChild(risultato);

    _oPreparaPulsanti(modal);
    modal.classList.remove('hidden-tab');
};

function _oPreparaPulsanti(modal) {
    // Clonazione per liberarsi dei listener dell'apertura precedente: è il modo già usato
    // in bulkActions.ts, e da qui in poi si usa solo il nodo nuovo.
    const vecchio = modal.querySelector('#ocr-confirm');
    const conferma = vecchio.cloneNode(true);
    vecchio.parentNode.replaceChild(conferma, vecchio);
    conferma.disabled = _oLingueInstallate().length === 0;
    conferma.querySelector('span').textContent = _oT('ocr_start', 'Riconosci');
    conferma.onclick = () => window.avviaOcr();
}

function _oAggiornaAvanzamento(dati) {
    const box = document.getElementById('ocr-progress');
    const barra = document.getElementById('ocr-progress-bar');
    const testo = document.getElementById('ocr-progress-text');
    if (!box || !barra || !testo) return;
    box.classList.remove('hidden-tab');

    const pagine = dati.pagine || 1;
    const pagina = dati.pagina || 1;
    // Avanzamento composto: la frazione di pagine fatte più la frazione della pagina in
    // corso. Con la sola percentuale del motore la barra tornerebbe a zero a ogni pagina,
    // che su un PDF di venti carte si legge come un programma che ricomincia da capo.
    const dentroPagina = typeof dati.progresso === 'number' ? dati.progresso : 0;
    const frazione = Math.min(((pagina - 1) + dentroPagina) / pagine, 1);
    barra.style.width = Math.round(frazione * 100) + '%';

    const fasi = {
        pagina: _oT('ocr_phase_page', 'Pagina'),
        rasterizzazione: _oT('ocr_phase_raster', 'Preparazione immagine'),
        riconoscimento: _oT('ocr_phase_recognize', 'Riconoscimento'),
        'recognizing text': _oT('ocr_phase_recognize', 'Riconoscimento'),
        'loading language traineddata': _oT('ocr_phase_lang', 'Caricamento lingua'),
        'initializing api': _oT('ocr_phase_init', 'Avvio del motore')
    };
    const nomeFase = fasi[dati.fase] || dati.fase || '';
    testo.textContent = pagine > 1
        ? `${nomeFase} — ${_oT('ocr_page_of', 'pagina {var0} di {var1}').replace('{var0}', pagina).replace('{var1}', pagine)}`
        : nomeFase;
}

window.annullaOcr = async function() {
    try { await window.apiOcr.annulla(); } catch (errore) { console.error('[OCR] Annullamento:', errore); }
};

/** Un solo allegato → risultato del main, già post-processato. */
async function _oEseguiSuAllegato(m, indice, lingue, opzioni) {
    const a = _oAllegati(m)[indice];
    if (!a) return null;
    const intestazione = _oT('ocr_provenance', 'Bozza generata da OCR ({var0}) il {var1} — da rivedere')
        .replace('{var0}', lingue.join('+'))
        .replace('{var1}', new Date().toLocaleDateString());
    return window.apiOcr.esegui({
        nomeFile: a.nome,
        tipo: a.tipo,
        lingue,
        dpi: opzioni.dpi,
        maxPagine: opzioni.maxPagine,
        intestazione: opzioni.bozza ? intestazione : ''
    });
}

window.avviaOcr = async function() {
    const m = _oRecord();
    if (!m || _oStato.inCorso) return;

    const lingue = _oLingueScelte();
    if (lingue.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_pick_lang', 'Scegli almeno una lingua.'), 'info');
        }
        return;
    }

    const sorgente = document.getElementById('ocr-source').value;
    const opzioni = {
        dpi: Number(document.getElementById('ocr-dpi').value) || 300,
        maxPagine: Math.max(1, Number(document.getElementById('ocr-max-pagine').value) || 20),
        bozza: document.getElementById('ocr-dest-bozza').checked,
        indice: document.getElementById('ocr-dest-indice').checked
    };
    if (!opzioni.bozza && !opzioni.indice) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_pick_dest', 'Scegli almeno una destinazione per il testo.'), 'info');
        }
        return;
    }

    // La scelta delle lingue si ricorda: in un fondo si lavora per mesi sulla stessa.
    _oRicordaLingue(lingue);

    const modal = document.getElementById('ocr-modal');
    const conferma = modal.querySelector('#ocr-confirm');
    conferma.disabled = true;
    _oStato.inCorso = true;
    document.getElementById('ocr-result').classList.add('hidden-tab');

    const indici = sorgente === 'tutti'
        ? _oAllegati(m).map((a, i) => i)
        : [Number(sorgente)];

    const esiti = [];
    try {
        for (let k = 0; k < indici.length; k++) {
            const i = indici[k];
            _oAggiornaAvanzamento({ fase: 'pagina', pagina: k + 1, pagine: indici.length });
            const r = await _oEseguiSuAllegato(m, i, lingue, opzioni);
            if (r && r.ok) {
                esiti.push({ indice: i, risultato: r });
            } else if (r && r.codice === 'annullato') {
                break;
            } else if (r) {
                console.error('[OCR] Allegato', i, 'fallito:', r);
            }
        }
    } catch (errore) {
        console.error('[OCR] Esecuzione fallita:', errore);
    } finally {
        _oStato.inCorso = false;
        conferma.disabled = false;
    }

    document.getElementById('ocr-progress').classList.add('hidden-tab');

    if (esiti.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_failed', 'Nessun testo riconosciuto.'), 'warning');
        }
        return;
    }

    await _oApplicaEsiti(m, esiti, lingue, opzioni);
};

/**
 * Scrittura sul record.
 *
 * Il testo cercabile va sempre sull'allegato: è un dato nuovo e non sovrascrive nulla.
 * La bozza invece tocca `m.trascrizione`, che può contenere ore di lettura: se c'è già
 * qualcosa si CHIEDE, e in mancanza di risposta non si scrive. È la regola che rende la
 * funzione utilizzabile su un archivio vero.
 */
async function _oApplicaEsiti(m, esiti, lingue, opzioni) {
    const adesso = Date.now();
    let username = 'Anonimo';
    try {
        const settings = await window.apiSettings.get();
        username = settings.username || 'Anonimo';
    } catch (errore) {
        console.error('[OCR] Impostazioni non leggibili:', errore);
    }

    if (opzioni.indice) {
        for (const e of esiti) {
            const a = _oAllegati(m)[e.indice];
            if (!a) continue;
            a.ocr = {
                testo: e.risultato.piano,
                lingue: lingue.join('+'),
                confidenza: e.risultato.confidenza,
                motore: e.risultato.motore,
                pagine: e.risultato.pagineElaborate,
                data: adesso
            };
        }
    }

    let bozzaInserita = false;
    if (opzioni.bozza) {
        bozzaInserita = await _oInserisciBozze(m, esiti);
    }

    m.lastModified = adesso;
    m.modificatoDa = username;
    await _oSalva();

    // La cache della ricerca è indicizzata per record e invalidata dal commit dello Store:
    // se il salvataggio è passato dalla via alternativa va invalidata a mano, altrimenti il
    // testo appena riconosciuto non si troverebbe fino al riavvio.
    if (!window.Store && window.invalidaCacheRicerca) window.invalidaCacheRicerca();

    _oMostraRisultato(esiti, bozzaInserita, opzioni);
}

/**
 * Inserisce le bozze, UNA PER CARTA (Fase 2.3-bis).
 *
 * Prima il testo di tutti gli allegati finiva in un blocco unico su `m.trascrizione`: su un
 * fascicolo di dieci carte era esattamente il problema che la trascrizione per allegato
 * risolve. Ora la bozza di ogni allegato va sulla sua carta, e un OCR su "tutti gli
 * allegati" popola dieci trascrizioni distinte in un colpo solo.
 *
 * La conferma di sovrascrittura si chiede **una volta sola** e vale per tutte le carte in
 * conflitto: un modale per carta, su dieci allegati, sarebbe dieci finestre da chiudere per
 * un'operazione che l'utente ha già deciso.
 *
 * @returns true se almeno una bozza è stata scritta.
 */
async function _oInserisciBozze(m, esiti) {
    const utili = (esiti || []).filter(e => e.risultato && e.risultato.html);
    if (utili.length === 0) return false;

    window.migraTrascrizioneSuAllegati(m);

    const inConflitto = utili.filter(e =>
        window.trascrizioneHaTesto(window.leggiTrascrizioneAllegato(m, e.indice)));

    let scelta = 'sovrascrivi';
    if (inConflitto.length > 0) {
        scelta = await _oChiediSovrascrittura();
        if (scelta === 'annulla') return false;
    }

    for (const e of utili) {
        const precedente = window.leggiTrascrizioneAllegato(m, e.indice);
        const nuovo = (scelta === 'accoda' && window.trascrizioneHaTesto(precedente))
            ? precedente + '\n' + e.risultato.html
            : e.risultato.html;
        window.scriviTrascrizioneAllegato(m, e.indice, nuovo);
    }

    // `m.trascrizione` è la forma derivata: va ricalcolata qui, perché questo percorso
    // salva il record senza passare da `salvaTrascrizione`.
    m.trascrizione = window.componiTrascrizioneRecord(m);

    // Se la vista è aperta su questa scheda, l'editor deve mostrare subito il risultato:
    // vedere il modale annunciare "bozza inserita" davanti a un editor invariato è il modo
    // più rapido di far credere che la funzione non abbia funzionato.
    if (window.ricaricaEditorTrascrizione && window.ricaricaEditorTrascrizione(m)) {
        window.trascrizioneNonSalvata = false;
    }
    return true;
}

/**
 * Tre uscite, non due: sovrascrivi, accoda, annulla. "Accoda" è quella che serve davvero
 * su un documento a più carte, dove la trascrizione si costruisce una pagina per volta —
 * senza, l'utente dovrebbe scegliere fra perdere il lavoro fatto e rinunciare all'OCR.
 */
function _oChiediSovrascrittura() {
    return new Promise((risolvi) => {
        const modal = document.getElementById('ocr-overwrite-modal');
        if (!modal) { risolvi('sovrascrivi'); return; }

        const chiudi = (scelta) => {
            modal.classList.add('hidden-tab');
            risolvi(scelta);
        };
        modal.querySelector('#ocr-ow-replace').onclick = () => chiudi('sovrascrivi');
        modal.querySelector('#ocr-ow-append').onclick = () => chiudi('accoda');
        modal.querySelector('#ocr-ow-cancel').onclick = () => chiudi('annulla');
        modal.classList.remove('hidden-tab');
    });
}

function _oMostraRisultato(esiti, bozzaInserita, opzioni) {
    const box = document.getElementById('ocr-result');
    if (!box) return;
    box.innerHTML = '';
    box.classList.remove('hidden-tab');

    const caratteri = esiti.reduce((s, e) => s + (e.risultato.caratteri || 0), 0);
    const confidenze = esiti.map(e => e.risultato.confidenza).filter(c => typeof c === 'number');
    const media = confidenze.length ? Math.round(confidenze.reduce((s, c) => s + c, 0) / confidenze.length) : 0;

    const riepilogo = document.createElement('p');
    riepilogo.className = 'text-sm font-medium';
    riepilogo.textContent = _oT('ocr_result_summary', '{var0} caratteri riconosciuti, confidenza media {var1}%')
        .replace('{var0}', String(caratteri))
        .replace('{var1}', String(media));
    box.appendChild(riepilogo);

    // La confidenza bassa va detta a parole, non lasciata a un numero: chi non lavora con
    // l'OCR non sa che 60% significa "una parola su tre è sbagliata".
    if (media && media < 70) {
        box.appendChild(_oNota(
            _oT('ocr_low_confidence', 'Confidenza bassa: probabilmente la scrittura è corsiva o la scansione è poco leggibile. Il testo va riletto parola per parola.'),
            'text-xs text-amber-800 dark:text-amber-300 leading-relaxed'
        ));
    }

    const anteprima = document.createElement('div');
    anteprima.className = 'max-h-40 overflow-y-auto text-xs bg-stone-100 dark:bg-stone-800 p-2 rounded-sm whitespace-pre-wrap';
    // textContent e non innerHTML: è testo prodotto da un file dell'utente e non ha
    // ragione di poter introdurre markup in questa finestra.
    anteprima.textContent = esiti.map(e => e.risultato.piano).join('\n\n').slice(0, 1200);
    box.appendChild(anteprima);

    const stato = [];
    if (opzioni.indice) stato.push(_oT('ocr_saved_index', 'Testo reso cercabile.'));
    if (opzioni.bozza) {
        stato.push(bozzaInserita
            ? _oT('ocr_saved_draft', 'Bozza inserita nella trascrizione.')
            : _oT('ocr_draft_skipped', 'Trascrizione lasciata invariata.'));
    }
    box.appendChild(_oNota(stato.join(' ')));

    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(_oT('ocr_done', 'Riconoscimento completato.'), 'success');
    }
}

// --- OCR sulla selezione ------------------------------------------------------

/**
 * OCR di tutte le schede selezionate.
 *
 * NON passa da `applicaInMassa`: quel motore applica un mutatore sincrono a ogni record e
 * salva una volta, mentre qui ogni scheda richiede secondi o minuti di lavoro asincrono e
 * un annullamento a metà deve conservare ciò che è già stato riconosciuto. Il contratto
 * che invece si rispetta è lo stesso: **un solo salvataggio** alla fine, non uno per
 * scheda — su cento carte sarebbero cento riscritture dell'intero database.
 */
window.ocrSelezionati = async function() {
    if (!window.apiOcr) return;
    const ids = window.selectedRecords || [];
    if (ids.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('msg_bulk_no_selection', 'Seleziona almeno una scheda.'), 'info');
        }
        return;
    }

    await _oCaricaLingue();
    const lingue = _oLinguePredefinite();
    if (lingue.length === 0) {
        window.apriGestioneLingueOcr();
        return;
    }

    const set = new Set(ids.map(String));
    const records = appData.manoscritti.filter(m => set.has(String(m.id)));
    const daFare = records.filter(m => _oAllegati(m).length > 0);
    if (daFare.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_oT('ocr_no_attachments_sel', 'Nessuna delle schede selezionate ha allegati.'), 'info');
        }
        return;
    }

    const modal = document.getElementById('ocr-bulk-modal');
    if (modal) modal.classList.remove('hidden-tab');
    _oStato.inCorso = true;

    let schede = 0;
    let allegatiFatti = 0;
    const adesso = Date.now();

    try {
        for (let k = 0; k < daFare.length; k++) {
            if (!_oStato.inCorso) break;
            const m = daFare[k];
            _oAggiornaBulk(k + 1, daFare.length, m.segnatura || '');

            let toccata = false;
            const allegati = _oAllegati(m);
            for (let i = 0; i < allegati.length; i++) {
                if (!_oStato.inCorso) break;
                // Le schede già riconosciute si saltano: rifare l'OCR di un fondo intero
                // per aggiungerne dieci carte è ore di lavoro senza alcun risultato nuovo.
                if (allegati[i].ocr && allegati[i].ocr.testo) continue;
                const r = await window.apiOcr.esegui({
                    nomeFile: allegati[i].nome,
                    tipo: allegati[i].tipo,
                    lingue,
                    dpi: 300,
                    maxPagine: 20,
                    intestazione: ''
                });
                if (r && r.ok && r.piano) {
                    allegati[i].ocr = {
                        testo: r.piano,
                        lingue: lingue.join('+'),
                        confidenza: r.confidenza,
                        motore: r.motore,
                        pagine: r.pagineElaborate,
                        data: adesso
                    };
                    toccata = true;
                    allegatiFatti++;
                } else if (r && r.codice === 'annullato') {
                    _oStato.inCorso = false;
                    break;
                }
            }
            if (toccata) { m.lastModified = adesso; schede++; }
        }
    } catch (errore) {
        console.error('[OCR] OCR in massa fallito:', errore);
    } finally {
        _oStato.inCorso = false;
        if (modal) modal.classList.add('hidden-tab');
    }

    // Salvataggio unico, anche su interruzione: ciò che è stato riconosciuto è costato
    // minuti di CPU e buttarlo perché l'utente ha premuto Annulla sarebbe una punizione.
    if (schede > 0) {
        await _oSalva();
        if (!window.Store && window.invalidaCacheRicerca) window.invalidaCacheRicerca();
    }

    if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(
            _oT('ocr_bulk_done', 'OCR completato: {var0} allegati in {var1} schede.')
                .replace('{var0}', String(allegatiFatti))
                .replace('{var1}', String(schede)),
            schede > 0 ? 'success' : 'info'
        );
    }
};

function _oAggiornaBulk(fatte, totale, segnatura) {
    const barra = document.getElementById('ocr-bulk-bar');
    const testo = document.getElementById('ocr-bulk-text');
    if (barra) barra.style.width = Math.round((fatte - 1) / totale * 100) + '%';
    if (testo) {
        testo.textContent = _oT('ocr_bulk_progress', 'Scheda {var0} di {var1}: {var2}')
            .replace('{var0}', String(fatte))
            .replace('{var1}', String(totale))
            .replace('{var2}', segnatura);
    }
}

window.annullaOcrMassa = function() {
    _oStato.inCorso = false;
    window.annullaOcr();
};

// --- Gestione delle lingue ----------------------------------------------------

window.chiudiGestioneLingueOcr = function() {
    const modal = document.getElementById('ocr-langs-modal');
    if (modal) modal.classList.add('hidden-tab');
};

window.apriGestioneLingueOcr = async function() {
    if (!window.apiOcr) return;
    const modal = document.getElementById('ocr-langs-modal');
    if (!modal) return;
    modal.classList.remove('hidden-tab');
    await _oRenderLingue();
};

async function _oRenderLingue() {
    const box = document.getElementById('ocr-langs-list');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(_oNota(_oT('ocr_langs_loading', 'Lettura in corso…')));

    await _oCaricaLingue();
    box.innerHTML = '';

    for (const l of _oStato.lingue) {
        const riga = document.createElement('div');
        riga.className = 'flex items-center justify-between gap-3 py-1.5 border-b border-stone-200 dark:border-stone-700';

        const sinistra = document.createElement('div');
        sinistra.className = 'flex flex-col';
        const nome = document.createElement('span');
        nome.className = 'text-sm';
        nome.textContent = l.nome;
        const dettaglio = document.createElement('span');
        dettaglio.className = 'text-xs text-stone-500 dark:text-stone-400';
        dettaglio.textContent = l.installata
            ? `${l.codice} — ${Math.round((l.dimensione || 0) / 1024 / 1024 * 10) / 10} MB`
            : l.codice;
        sinistra.append(nome, dettaglio);

        const azione = document.createElement('button');
        azione.type = 'button';
        azione.className = l.installata ? 'btn btn-ghost text-xs px-2 py-1' : 'btn btn-secondary text-xs px-2 py-1';
        azione.textContent = l.installata ? _oT('ocr_lang_remove', 'Rimuovi') : _oT('ocr_lang_install', 'Installa');
        azione.dataset.codice = l.codice;
        azione.onclick = async () => {
            azione.disabled = true;
            azione.textContent = l.installata
                ? _oT('ocr_lang_removing', 'Rimozione…')
                : _oT('ocr_lang_installing', 'Download…');
            const r = l.installata
                ? await window.apiOcr.rimuoviLingua(l.codice)
                : await window.apiOcr.installaLingua(l.codice);
            if (!r || !r.ok) {
                if (typeof mostraMessaggio === 'function') {
                    mostraMessaggio(
                        _oT('ocr_lang_error', 'Operazione non riuscita: serve una connessione per scaricare i dati di lingua.'),
                        'error'
                    );
                }
            }
            await _oRenderLingue();
        };

        riga.append(sinistra, azione);
        box.appendChild(riga);
    }

    box.appendChild(_oNota(_oT('ocr_langs_offline_hint',
        'I dati si scaricano una sola volta e restano su questo computer: dopo l\'installazione il riconoscimento funziona senza connessione.')));
}

// --- Markup -------------------------------------------------------------------

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('ocr-modal')) return;
        const html = `
    <div id="ocr-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="scan-text" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="ocr_title">Riconosci testo (OCR)</span>
                </h3>
            </div>
            <div class="modal-body">
                <p id="ocr-subtitle" class="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3"></p>
                <div id="ocr-body" class="flex flex-col gap-3"></div>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiOcrModal()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                    <button type="button" id="ocr-confirm" class="btn btn-primary">
                        <span data-i18n="ocr_start">Riconosci</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="ocr-langs-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="languages" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="ocr_langs_title">Lingue del riconoscimento</span>
                </h3>
            </div>
            <div class="modal-body">
                <div id="ocr-langs-list" class="flex flex-col max-h-80 overflow-y-auto"></div>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiGestioneLingueOcr()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_close">Chiudi</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="ocr-overwrite-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="file-warning" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="ocr_overwrite_title">Trascrizione già presente</span>
                </h3>
            </div>
            <div class="modal-body">
                <p class="text-sm leading-relaxed" data-i18n="ocr_overwrite_desc">Alcune carte hanno già una trascrizione. La bozza dell'OCR può sostituirla o essere aggiunta in fondo. Il testo sostituito non è recuperabile.</p>
                <div class="modal-footer">
                    <button type="button" id="ocr-ow-cancel" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_cancel">Annulla</span>
                    </button>
                    <button type="button" id="ocr-ow-append" class="btn btn-secondary">
                        <span data-i18n="ocr_overwrite_append">Aggiungi in fondo</span>
                    </button>
                    <button type="button" id="ocr-ow-replace" class="btn btn-primary">
                        <span data-i18n="ocr_overwrite_replace">Sostituisci</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="ocr-bulk-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="scan-text" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="ocr_bulk_title">OCR delle schede selezionate</span>
                </h3>
            </div>
            <div class="modal-body">
                <div class="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden mb-2">
                    <div id="ocr-bulk-bar" class="h-full bg-amber-600 transition-all" style="width:0%"></div>
                </div>
                <p id="ocr-bulk-text" class="text-xs text-stone-500 dark:text-stone-400"></p>
                <div class="modal-footer">
                    <button type="button" id="ocr-bulk-cancel" onclick="annullaOcrMassa()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_cancel">Annulla</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('ocr-modal')] });

        if (window.apiOcr && window.apiOcr.onProgress) {
            window.apiOcr.onProgress((dati) => {
                if (_oStato.inCorso) _oAggiornaAvanzamento(dati || {});
            });
        }
    });
})();
