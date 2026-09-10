// @ts-nocheck
// Fase 1.5 — Azioni in massa e selezione dell'intero risultato.
//
// La barra di selezione offriva esporta/copia/taglia/elimina: tutto ciò che riguarda
// il CONTENUTO delle schede (cartella, tipo, tag, testo di un campo) si poteva cambiare
// solo aprendo una scheda per volta. Su una revisione di segnature o su una campagna di
// ritag di un fondo intero è la differenza fra un minuto e un pomeriggio.
//
// Tre strati, separati apposta:
//  1. funzioni PURE (`regexSostituzione`, `sostituisciTesto`, `contaOccorrenze`,
//     `aggiungiTagCsv`, `rimuoviTagCsv`, `anteprimaSostituzione`) — nessun DOM, nessun
//     appData: sono ciò che test/bulkActions.test.js esercita senza avviare Electron;
//  2. `applicaInMassa`, unico punto che muta i record, salva UNA volta e registra l'undo;
//  3. il modale, che raccoglie i parametri e non conosce né lo stato né il salvataggio.
//
// PERCHÉ NON `Store.updateManoscritto` IN CICLO: quella commit-a ogni chiamata, cioè
// re-render della sidebar, della griglia e riscrittura dell'intero DB per OGNI record.
// Su 300 schede selezionate sono 300 render e 300 scritture. Qui si muta l'array in
// memoria e si chiama `Store.commit()` una volta sola, che è esattamente il contratto
// del salvataggio coalescente introdotto nella 2.4.2.

// NOMI PRIVATI COL PREFISSO `_b`: gli script del renderer non sono moduli e il bundle di
// produzione li concatena in UN UNICO scope (scripts/build-renderer-bundle.js). Una
// `function _select` qui dentro SOSTITUISCE quella di filtersPanel.ts per l'intero
// bundle — con le firme diverse che hanno, il pannello dei filtri smetteva di agganciare
// gli onchange e i filtri diventavano inerti, senza un solo errore in console. È il
// motivo per cui ogni helper di questo file ha un nome che non può collidere.

// --- Funzioni pure ------------------------------------------------------------

/**
 * Espressione della ricerca per trova&sostituisci.
 *
 * `intere` usa i lookaround Unicode e NON `\b`: la sua definizione di "parola" è
 * [A-Za-z0-9_], quindi su testo medievale `più` o `Perùgia` verrebbero spezzati a metà
 * e "notaio" troverebbe anche "notaio-" ma non "d'notaio". Con \p{L}\p{N} il confine è
 * quello linguistico, che è ciò che l'utente intende.
 */
window.regexSostituzione = function(cerca, opzioni) {
    const o = opzioni || {};
    const ago = String(cerca == null ? '' : cerca);
    if (!ago) return null;
    const escapato = ago.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const corpo = o.intere
        ? '(?<![\\p{L}\\p{N}])' + escapato + '(?![\\p{L}\\p{N}])'
        : escapato;
    return new RegExp(corpo, o.maiuscole ? 'gu' : 'giu');
};

/** Sostituisce nel solo valore passato. Non tocca record né DOM: è testo dentro, testo fuori. */
window.sostituisciTesto = function(valore, cerca, sostituisci, opzioni) {
    if (typeof valore !== 'string' || valore === '') return valore;
    const re = window.regexSostituzione(cerca, opzioni);
    if (!re) return valore;
    // `$&`, `$1`… nella stringa di sostituzione sarebbero interpretati da String.replace:
    // qui l'utente digita testo, non un modello, e un prezzo come "$5" non deve sparire.
    return valore.replace(re, () => String(sostituisci == null ? '' : sostituisci));
};

window.contaOccorrenze = function(valore, cerca, opzioni) {
    if (typeof valore !== 'string' || valore === '') return 0;
    const re = window.regexSostituzione(cerca, opzioni);
    if (!re) return 0;
    const trovate = valore.match(re);
    return trovate ? trovate.length : 0;
};

/**
 * Conto a secco (dry-run) mostrato sotto i campi del modale: quante schede e quante
 * occorrenze verrebbero toccate. Una sostituzione in massa senza anteprima è una
 * scommessa su un archivio, e l'undo — che pure c'è — si scopre solo dopo il danno.
 */
window.anteprimaSostituzione = function(records, campo, cerca, opzioni) {
    let schede = 0;
    let occorrenze = 0;
    for (const m of (records || [])) {
        const n = window.contaOccorrenze(m ? m[campo] : '', cerca, opzioni);
        if (n > 0) { schede++; occorrenze += n; }
    }
    return { schede, occorrenze };
};

// Fase 3.4 — questi quattro erano l'implementazione dei tag; ora sono la FACCIATA di
// `shared/model.ts`, che è l'unico posto in cui i tag si spezzano, si confrontano e si
// riscrivono (main compreso: prima esistevano tre parser diversi). I nomi restano perché
// sono l'API che il resto del renderer già chiama, e perché `test/bulkActions.test.js` li
// esercita da qui.

window.dividiTag = function(csv) {
    return window.Model.listaTag(csv);
};

window.unisciTag = function(lista) {
    return window.Model.unisciTag(lista);
};

/**
 * Unione senza duplicati. Il confronto è NORMALIZZATO (accenti, maiuscole, spazi doppi):
 * aggiungere "Pergamena" a una scheda che ha già "pergamena" deve essere un'operazione
 * nulla, non creare due etichette che l'utente vede come una. Il tag esistente vince: è
 * quello già scritto in tutto l'archivio.
 */
window.aggiungiTagCsv = function(csv, daAggiungere) {
    return window.Model.unisciTag(window.Model.listaTag(csv).concat(window.Model.listaTag(daAggiungere)));
};

/** Rimozione per corrispondenza ESATTA (normalizzata): togliere `not` non deve togliere `notaio`. */
window.rimuoviTagCsv = function(csv, daRimuovere) {
    const fuori = new Set(window.Model.listaTag(daRimuovere).map(t => window.Model.chiaveTag(t)));
    if (fuori.size === 0) return window.Model.unisciTag(csv);
    return window.Model.unisciTag(window.Model.listaTag(csv).filter(t => !fuori.has(window.Model.chiaveTag(t))));
};

// --- Selezione ----------------------------------------------------------------

/**
 * "Seleziona tutti i risultati" e non "tutte le schede a schermo": lo shift-click resta
 * limitato alla pagina corrente (è `selectItem` a leggere le card renderizzate), quindi
 * su un filtro che produce 300 schede in 6 pagine non c'era modo di prenderle tutte.
 * La fonte è `getManoscrittiFiltrati`, cioè ESATTAMENTE l'elenco filtrato e ordinato che
 * l'utente sta guardando: un secondo criterio qui selezionerebbe schede che non vede.
 */
window.selezionaTuttiIRisultati = function() {
    if (typeof window.getManoscrittiFiltrati !== 'function') return 0;
    const ids = window.getManoscrittiFiltrati().map(m => m.id);
    window.selectedRecords = ids;
    window.lastSelectedId = ids.length > 0 ? ids[ids.length - 1] : null;
    if (typeof renderMain === 'function') renderMain();
    if (typeof renderSidebar === 'function') renderSidebar();
    window.aggiornaStatoSelezione();
    if (typeof mostraMessaggio === 'function' && ids.length > 0) {
        mostraMessaggio(
            window.t('msg_selected_all', '{var0} schede selezionate.').replace('{var0}', String(ids.length)),
            'info'
        );
    }
    return ids.length;
};

// --- Motore delle modifiche in massa ------------------------------------------

function _bRecordSelezionati() {
    const ids = window.selectedRecords || [];
    if (ids.length === 0) return [];
    const set = new Set(ids.map(String));
    return appData.manoscritti.filter(m => set.has(String(m.id)));
}

async function _bSalva() {
    if (window.Store) {
        await window.Store.commit();
    } else {
        await window.apiBrowser.salvaDati(appData);
        if (typeof renderMain === 'function') renderMain();
        if (typeof renderSidebar === 'function') renderSidebar();
    }
}

/**
 * Applica `mutatore(record)` a ogni scheda selezionata. Il mutatore restituisce un patch
 * (oggetto di campi da scrivere) oppure null/undefined per lasciare la scheda intatta:
 * è ciò che permette di NON marcare come modificate schede che la sostituzione non ha
 * toccato — altrimenti un trova&sostituisci senza corrispondenze cambierebbe comunque
 * `lastModified` su tutta la selezione, e il primo sync dopo lo propagherebbe ai colleghi.
 *
 * @returns il numero di schede effettivamente modificate.
 */
window.applicaInMassa = async function(descrizione, mutatore, messaggio) {
    const records = _bRecordSelezionati();
    if (records.length === 0) return 0;

    let username = 'Anonimo';
    try {
        const settings = await window.apiSettings.get();
        username = settings.username || 'Anonimo';
    } catch (err) {
        console.error('Impostazioni non leggibili, uso "Anonimo" come autore:', err);
    }

    // Fotografia PRIMA della mutazione: è l'unica cosa che l'undo può ripristinare, e
    // deve essere una copia profonda (allegati e liste dinamiche sono array condivisi).
    const primaDi = [];
    const adesso = Date.now();
    let toccati = 0;

    for (const m of records) {
        let patch;
        try {
            patch = mutatore(m);
        } catch (err) {
            console.error('Mutatore fallito sul record', m.id, err);
            continue;
        }
        if (!patch) continue;
        primaDi.push(JSON.parse(JSON.stringify(m)));
        Object.assign(m, patch, { lastModified: adesso, modificatoDa: username });
        toccati++;
    }

    if (toccati === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(window.t('msg_bulk_nothing', 'Nessuna scheda è stata modificata.'), 'info');
        }
        return 0;
    }

    await _bSalva();

    const ripristina = async () => {
        for (const vecchio of primaDi) {
            const i = appData.manoscritti.findIndex(m => String(m.id) === String(vecchio.id));
            // Se nel frattempo la scheda è stata eliminata (o è arrivata una sync che
            // l'ha rimossa) non la si resuscita: l'undo annulla una modifica, non una
            // cancellazione altrui.
            if (i !== -1) appData.manoscritti[i] = JSON.parse(JSON.stringify(vecchio));
        }
        await _bSalva();
    };

    const testo = (messaggio || window.t('msg_bulk_done', '{var0} schede modificate.')).replace('{var0}', String(toccati));
    if (window.gestoreAnnullamento) {
        window.gestoreAnnullamento.registraAzione(descrizione, ripristina);
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(testo, 'success', () => window.gestoreAnnullamento.annullaUltimaAzione());
        }
    } else if (typeof mostraMessaggio === 'function') {
        mostraMessaggio(testo, 'success');
    }
    return toccati;
};

// --- Le quattro azioni --------------------------------------------------------

window.spostaSelezionatiInCartella = function(cartella) {
    const destinazione = cartella || '';
    return window.applicaInMassa(
        window.t('undo_bulk_move', 'Spostamento di schede'),
        (m) => (m.cartella === destinazione ? null : { cartella: destinazione }),
        window.t('msg_bulk_moved', '{var0} schede spostate.')
    );
};

window.cambiaTipoSelezionati = function(tipoId) {
    if (!tipoId) return Promise.resolve(0);
    return window.applicaInMassa(
        window.t('undo_bulk_type', 'Cambio di tipo documento'),
        (m) => ((m.tipoDocumento || 'manoscritto') === tipoId ? null : { tipoDocumento: tipoId }),
        window.t('msg_bulk_type', 'Tipo cambiato su {var0} schede.')
    );
};

/** @param modo 'aggiungi' | 'rimuovi' */
window.tagSelezionati = function(tags, modo) {
    const lista = window.dividiTag(tags);
    if (lista.length === 0) return Promise.resolve(0);
    const aggiunge = modo !== 'rimuovi';
    // Fase 3.4: un tag nuovo entra nell'anagrafica anche da qui, o resterebbe senza voce —
    // e quindi senza colore e senza grafia canonica — finché qualcuno non lo riscrive dal
    // form. La scrittura su disco la fa `applicaInMassa` subito dopo, in un colpo solo.
    if (aggiunge && typeof window.registraTagUsati === 'function') window.registraTagUsati(lista);
    return window.applicaInMassa(
        aggiunge ? window.t('undo_bulk_tag_add', 'Aggiunta di tag') : window.t('undo_bulk_tag_del', 'Rimozione di tag'),
        (m) => {
            const attuali = m.tags || '';
            const nuovi = aggiunge ? window.aggiungiTagCsv(attuali, lista) : window.rimuoviTagCsv(attuali, lista);
            return nuovi === attuali ? null : { tags: nuovi };
        },
        aggiunge ? window.t('msg_bulk_tag_add', 'Tag aggiunti a {var0} schede.') : window.t('msg_bulk_tag_del', 'Tag rimossi da {var0} schede.')
    );
};

window.sostituisciNeiSelezionati = function(campo, cerca, sostituisci, opzioni) {
    if (!campo || !cerca) return Promise.resolve(0);
    return window.applicaInMassa(
        window.t('undo_bulk_replace', 'Trova e sostituisci'),
        (m) => {
            const valore = m[campo];
            if (typeof valore !== 'string' || valore === '') return null;
            const nuovo = window.sostituisciTesto(valore, cerca, sostituisci, opzioni);
            return nuovo === valore ? null : { [campo]: nuovo };
        },
        window.t('msg_bulk_replaced', 'Sostituzione applicata a {var0} schede.')
    );
};

// --- Campi ammessi dal trova&sostituisci --------------------------------------

/**
 * Campi offerti: `segnatura` e `tags`, che ogni scheda ha, più i campi TESTUALI dei tipi
 * documento presenti NELLA SELEZIONE. Fuori restano le liste dinamiche e gli allegati
 * (non sono stringhe) e — deliberatamente — la trascrizione: è HTML, e una sostituzione
 * cieca su HTML può colpire un nome di tag o un attributo e corrompere il markup. Una
 * ricerca dentro la trascrizione avrà bisogno di un percorso suo (vedi 5.1).
 */
window.campiSostituibili = function(records) {
    const campi = ['segnatura', 'tags'];
    // Fase 3.7 — l'unione si fa sui RECORD selezionati: un campo proprio esiste su una
    // scheda sola, e partendo dai tipi non comparirebbe mai fra i sostituibili.
    for (const m of (records || [])) {
        // Il ripiego per le schede il cui tipo non esiste (più) è lo stesso della tabella:
        // senza, quelle schede non avrebbero nessun campo sostituibile.
        const tipo = (appData.tipiDocumento || []).find(t => t.id === (m.tipoDocumento || 'manoscritto'))
            || { campi: ['titolo', 'autore', 'note'] };
        for (const def of window.Model.campiDellaScheda(m, tipo, window.CONFIG_CAMPI, appData)) {
            if (def.tipo === 'dynamic_list' || def.tipo === 'attachments') continue;
            if (!campi.includes(def.id)) campi.push(def.id);
        }
    }
    return campi;
};

// --- Modale -------------------------------------------------------------------

function _bT(k, d) { return window.t(k, d); }

function _bEtichettaCampo(campo) {
    if (campo === 'segnatura') return _bT('bulk_field_signature', 'Segnatura');
    if (campo === 'tags') return _bT('bulk_field_tags', 'Tag');
    const conf = window.CONFIG_CAMPI[campo] || {};
    const tradotta = window.t('field_' + campo);
    return tradotta !== 'field_' + campo ? tradotta : (conf.label || campo);
}

function _bRiga(etichetta, controllo) {
    const wrap = document.createElement('label');
    wrap.className = 'flex flex-col gap-1';
    const span = document.createElement('span');
    span.className = 'form-label mb-0';
    span.textContent = etichetta;
    wrap.append(span, controllo);
    return wrap;
}

function _bSelect(id, opzioni, valore) {
    const sel = document.createElement('select');
    sel.id = id;
    sel.className = 'form-input';
    for (const o of opzioni) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;   // textContent: nomi di cartelle e tipi sono dati utente
        if (o.value === valore) opt.selected = true;
        sel.appendChild(opt);
    }
    return sel;
}

function _bNota(testo) {
    const p = document.createElement('p');
    p.className = 'text-xs text-stone-500 dark:text-stone-400 leading-relaxed';
    p.textContent = testo;
    return p;
}

window.chiudiAzioniMassa = function() {
    const modal = document.getElementById('bulk-modal');
    if (modal) modal.classList.add('hidden-tab');
};

/**
 * @param azione 'cartella' | 'tipo' | 'tag' | 'sostituisci'
 *
 * Un solo guscio di modale per le quattro azioni: cambiano il titolo, il corpo e la
 * funzione di conferma. Quattro modali distinti sarebbero quattro copie della stessa
 * intestazione, dello stesso piè di pagina e dello stesso conteggio della selezione.
 */
window.apriAzioneMassa = function(azione) {
    const records = _bRecordSelezionati();
    if (records.length === 0) {
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_bT('msg_bulk_no_selection', 'Seleziona almeno una scheda.'), 'info');
        }
        return;
    }
    const modal = document.getElementById('bulk-modal');
    if (!modal) return;

    const corpo = modal.querySelector('#bulk-body');
    const titolo = modal.querySelector('#bulk-title');
    const conta = modal.querySelector('#bulk-count');
    corpo.innerHTML = '';

    // Il pulsante di conferma è ricreato per clonazione PRIMA di costruire il corpo — è il
    // modo già usato altrove nel renderer per liberarsi dei listener dell'apertura
    // precedente — e da qui in poi si usa solo il nodo nuovo: l'anteprima del
    // trova&sostituisci lo abilita e disabilita, e agire sul nodo staccato non si vedrebbe.
    const vecchioConferma = modal.querySelector('#bulk-confirm');
    const conferma = vecchioConferma.cloneNode(true);
    vecchioConferma.parentNode.replaceChild(conferma, vecchioConferma);
    conferma.disabled = false;

    conta.textContent = records.length === 1
        ? _bT('selection_count_one', '1 scheda selezionata')
        : _bT('selection_count_many', '{var0} schede selezionate').replace('{var0}', String(records.length));

    let esegui = null;

    if (azione === 'cartella') {
        titolo.textContent = _bT('bulk_move_title', 'Sposta in un archivio');
        const opzioni = [{ value: '', label: _bT('folder_root_label', 'Radice') }];
        for (const c of (appData.cartelle || []).slice().sort((a, b) => window.confrontaNaturale(a, b))) {
            opzioni.push({ value: c, label: c });
        }
        const sel = _bSelect('bulk-cartella', opzioni, window.cartellaAttuale || '');
        corpo.appendChild(_bRiga(_bT('bulk_label_folder', 'Archivio di destinazione'), sel));
        esegui = () => window.spostaSelezionatiInCartella(sel.value);

    } else if (azione === 'tipo') {
        titolo.textContent = _bT('bulk_type_title', 'Cambia tipo di documento');
        const opzioni = (appData.tipiDocumento || []).map(t => ({
            value: t.id,
            label: window.t('model_' + t.id) !== 'model_' + t.id ? window.t('model_' + t.id) : t.nome
        }));
        const sel = _bSelect('bulk-tipo', opzioni, records[0].tipoDocumento || 'manoscritto');
        corpo.appendChild(_bRiga(_bT('bulk_label_type', 'Nuovo tipo'), sel));
        // I campi sono spalmati flat sulla radice del record (vedi 3.0): cambiando tipo
        // NON si perde nulla, ma i campi estranei al nuovo tipo smettono di comparire nel
        // form. Dirlo qui evita la telefonata "mi sono sparite le note".
        corpo.appendChild(_bNota(_bT('bulk_type_hint', 'I valori dei campi che il nuovo tipo non prevede restano salvati nella scheda, ma non saranno più visibili nel form finché non si torna al tipo precedente.')));
        esegui = () => window.cambiaTipoSelezionati(sel.value);

    } else if (azione === 'tag') {
        titolo.textContent = _bT('bulk_tag_title', 'Aggiungi o rimuovi tag');
        const modo = _bSelect('bulk-tag-modo', [
            { value: 'aggiungi', label: _bT('bulk_tag_add', 'Aggiungi') },
            { value: 'rimuovi', label: _bT('bulk_tag_remove', 'Rimuovi') }
        ], 'aggiungi');
        corpo.appendChild(_bRiga(_bT('bulk_label_action', 'Operazione'), modo));

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'bulk-tag-input';
        input.className = 'form-input';
        input.setAttribute('list', 'bulk-tag-list');
        input.placeholder = _bT('bulk_tag_ph', 'Es. pergamena, notarile');
        corpo.appendChild(_bRiga(_bT('bulk_label_tags', 'Tag'), input));

        // Elenco dei tag già in uso: senza, un ritag in massa è l'occasione perfetta per
        // introdurre "pergamana" accanto a "pergamena" e spezzare in due un filtro.
        const datalist = document.createElement('datalist');
        datalist.id = 'bulk-tag-list';
        // Fase 3.4: l'elenco è quello dell'anagrafica, quindi con la grafia canonica e
        // già deduplicato — prima due schede con "Pergamena" e "pergamena" producevano
        // due voci identiche a occhio nel menu a tendina.
        for (const voce of window.Model.conteggiTag(appData.manoscritti, appData)) {
            const opt = document.createElement('option');
            opt.value = voce.nome;
            datalist.appendChild(opt);
        }
        corpo.appendChild(datalist);
        corpo.appendChild(_bNota(_bT('bulk_tag_hint', 'Più tag si separano con la virgola. La rimozione richiede la corrispondenza esatta del tag.')));
        esegui = () => window.tagSelezionati(input.value, modo.value);

    } else if (azione === 'sostituisci') {
        titolo.textContent = _bT('bulk_replace_title', 'Trova e sostituisci');
        const campi = window.campiSostituibili(records).map(c => ({ value: c, label: _bEtichettaCampo(c) }));
        const selCampo = _bSelect('bulk-campo', campi, 'segnatura');
        corpo.appendChild(_bRiga(_bT('bulk_label_field', 'Campo'), selCampo));

        const cerca = document.createElement('input');
        cerca.type = 'text';
        cerca.id = 'bulk-cerca';
        cerca.className = 'form-input';
        corpo.appendChild(_bRiga(_bT('bulk_label_find', 'Trova'), cerca));

        const sostituisci = document.createElement('input');
        sostituisci.type = 'text';
        sostituisci.id = 'bulk-sostituisci';
        sostituisci.className = 'form-input';
        corpo.appendChild(_bRiga(_bT('bulk_label_replace', 'Sostituisci con'), sostituisci));

        const opzioniRiga = document.createElement('div');
        opzioniRiga.className = 'flex items-center gap-4 flex-wrap';
        const mkChk = (id, etichetta) => {
            const l = document.createElement('label');
            l.className = 'flex items-center gap-2 text-sm';
            const c = document.createElement('input');
            c.type = 'checkbox';
            c.id = id;
            c.className = 'w-4 h-4 accent-amber-700';
            const s = document.createElement('span');
            s.textContent = etichetta;
            l.append(c, s);
            opzioniRiga.appendChild(l);
            return c;
        };
        const chkCaso = mkChk('bulk-maiuscole', _bT('bulk_case', 'Distingui maiuscole'));
        const chkIntere = mkChk('bulk-intere', _bT('bulk_whole', 'Solo parole intere'));
        corpo.appendChild(opzioniRiga);

        const anteprima = document.createElement('p');
        anteprima.id = 'bulk-anteprima';
        anteprima.className = 'text-sm font-medium text-stone-600 dark:text-stone-300 border-t border-stone-200 dark:border-stone-700 pt-2';
        corpo.appendChild(anteprima);

        const opz = () => ({ maiuscole: chkCaso.checked, intere: chkIntere.checked });
        const aggiornaAnteprima = () => {
            if (!cerca.value) {
                anteprima.textContent = _bT('bulk_preview_empty', 'Scrivi il testo da cercare per vedere quante schede sarebbero modificate.');
                conferma.disabled = true;
                return;
            }
            const r = window.anteprimaSostituzione(records, selCampo.value, cerca.value, opz());
            anteprima.textContent = _bT('bulk_preview', '{var0} schede, {var1} occorrenze.')
                .replace('{var0}', String(r.schede))
                .replace('{var1}', String(r.occorrenze));
            conferma.disabled = r.occorrenze === 0;
        };
        [cerca, selCampo, chkCaso, chkIntere].forEach(el => {
            el.addEventListener('input', aggiornaAnteprima);
            el.addEventListener('change', aggiornaAnteprima);
        });
        aggiornaAnteprima();

        esegui = () => window.sostituisciNeiSelezionati(selCampo.value, cerca.value, sostituisci.value, opz());
    } else {
        return;
    }

    conferma.onclick = async () => {
        conferma.disabled = true;   // niente doppio invio su archivi grandi: la commit è async
        try {
            await esegui();
        } catch (err) {
            console.error('Azione in massa fallita:', azione, err);
            if (typeof mostraMessaggio === 'function') {
                mostraMessaggio(_bT('msg_bulk_error', 'Azione non riuscita.'), 'error');
            }
        }
        window.chiudiAzioniMassa();
    };

    corpo.addEventListener('keydown', (e) => {
        // Invio conferma, ma non da un select: lì Invio è il modo di chiudere la tendina.
        if (e.key === 'Enter' && (e.target.tagName || '').toLowerCase() === 'input') {
            e.preventDefault();
            if (!conferma.disabled) conferma.click();
        }
    });

    modal.classList.remove('hidden-tab');
    const primo = corpo.querySelector('input, select');
    if (primo) primo.focus();
};

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('bulk-modal')) return;
        const html = `
    <div id="bulk-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="list-checks" class="w-5 h-5 text-amber-700"></i>
                    <span id="bulk-title"></span>
                </h3>
            </div>
            <div class="modal-body">
                <p id="bulk-count" class="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3"></p>
                <div id="bulk-body" class="flex flex-col gap-3"></div>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiAzioniMassa()" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="btn_cancel">Annulla</span>
                    </button>
                    <button type="button" id="bulk-confirm" class="btn btn-primary">
                        <span data-i18n="btn_apply">Applica</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('bulk-modal')] });
    });
})();
