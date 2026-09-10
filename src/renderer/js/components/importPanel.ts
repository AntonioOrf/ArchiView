// @ts-nocheck

// Fase 2.4 — Il wizard di import CSV.
//
// Tre strati, come per i tag (3.4), le azioni in massa (1.5) e il cestino (4.1): l'analisi e
// la costruzione delle schede stanno in `shared/csvImport.ts` (pura, condivisa, unit-testata),
// il main legge il file, e questo file raccoglie le scelte e disegna.
//
// ⚠️ L'ANTEPRIMA È L'IMPORT. `_ipRicalcola` chiama `CsvImport.costruisciSchede`, e la conferma
// inserisce esattamente l'array che l'anteprima ha appena mostrato — non lo ricostruisce con
// altri parametri. È l'unica forma di dry-run che significhi qualcosa: due percorsi diversi
// divergerebbero proprio sui casi storti, che sono quelli per cui il dry-run esiste.
//
// PREFISSO `_ip` sugli helper privati: gli script del renderer non sono moduli e il bundle
// li concatena in UN UNICO scope.

function _ipT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

/** Lo stato del wizard: vive finché il modale è aperto. */
let _ipStato = null;

/** L'ultimo modello usato, se esiste ancora; altrimenti il primo dell'archivio. */
function _ipTipoPredefinito() {
    const tipi = appData.tipiDocumento || [];
    const ultimo = typeof leggiUltimoTipoDocumento === 'function' ? leggiUltimoTipoDocumento() : null;
    if (ultimo && tipi.some(t => t.id === ultimo)) return ultimo;
    return (tipi[0] || {}).id || '';
}

/** Il nome del tipo come lo si vede altrove: tradotto per i predefiniti, proprio per gli altri. */
function _ipNomeTipo(t) {
    const chiave = 'model_' + t.id;
    const tradotto = window.t(chiave);
    return tradotto !== chiave ? tradotto : (t.nome || t.id);
}

/** I codici di problema di `csvImport.ts` tradotti. Il modello non parla italiano (2.1). */
function _ipMotivo(p) {
    const campo = p.campo ? p.campo + ': ' : '';
    switch (p.codice) {
        case 'obbligatorio': return campo + _ipT('imp_err_required', 'campo obbligatorio mancante');
        case 'numero': return campo + _ipT('imp_err_number', 'non è un numero');
        case 'url': return campo + _ipT('imp_err_url', 'non è un indirizzo valido');
        case 'opzione': return campo + _ipT('imp_err_option', 'valore non fra quelli previsti');
        case 'booleano': return campo + _ipT('imp_err_boolean', 'non è un sì/no riconoscibile');
        case 'tipo_sconosciuto': return _ipT('imp_err_type', 'tipo di documento sconosciuto, si usa quello predefinito');
        case 'riga_corta': return _ipT('imp_err_short', 'la riga ha meno celle dell\'intestazione');
        case 'doppione': return _ipT('imp_err_dup', 'segnatura già presente in archivio');
        case 'doppione_file': return _ipT('imp_err_dup_file', 'segnatura ripetuta dentro il file');
        default: return campo + p.codice;
    }
}

window.apriImportCsv = async function() {
    if (!window.apiBrowser || !window.apiBrowser.importCsvLeggi) return;

    const res = await window.apiBrowser.importCsvLeggi(_ipT('dialog_import_csv', 'Importa da CSV'));
    if (!res || res.canceled) return;
    if (!res.success) {
        mostraMessaggio(_ipT('imp_read_error', 'File non leggibile: ') + (res.error || ''), 'error');
        return;
    }

    const analisi = window.CsvImport.analizzaCsv(res.testo);
    if (!analisi.intestazioni.length || !analisi.righe.length) {
        mostraMessaggio(_ipT('imp_empty', 'Il file non contiene righe da importare.'), 'warning');
        return;
    }

    _ipStato = {
        nome: res.nome || 'CSV',
        testo: res.testo,
        analisi,
        // Il tipo predefinito è quello con cui l'utente lavora di solito: la STESSA memoria
        // che precompila la scheda nuova (`leggiUltimoTipoDocumento`, form.ts). Proporre
        // sempre il primo dell'elenco costringerebbe a cambiarlo a ogni import.
        tipo: _ipTipoPredefinito(),
        cartella: window.cartellaAttuale || '',
        aggiorna: false,
        /** 'modello' → 'mappatura': la scelta del modello è il PRIMO passo, non una tendina. */
        passo: 'modello',
        /** Il modello inventato qui: esiste solo nel wizard finché non si conferma. */
        modelloNuovo: null,
        /** I campi inventati qui dentro: esistono solo nel wizard finché non si conferma. */
        campiNuovi: [],
        colonne: [],
        mappatura: [],
        esito: null
    };
    _ipAggiornaColonne(true);

    document.getElementById('import-csv-modal').classList.remove('hidden-tab');
    _ipDisegna();
};

/**
 * Ricalcola le destinazioni offerte e, se richiesto, la mappatura proposta.
 *
 * `riproponi` è vero quando cambia ciò da cui la proposta dipende — l'apertura del file e la
 * riga di intestazione — e falso quando cambia solo l'elenco dei campi disponibili: lì
 * riproporre butterebbe via le scelte già fatte a mano dall'utente.
 */
function _ipAggiornaColonne(riproponi) {
    const s = _ipStato;
    const etichette = window.etichetteColonneExport ? window.etichetteColonneExport() : {};
    // Fase 3.7 — anche i campi propri già usati in archivio, o un CSV appena esportato non
    // sarebbe reimportabile: le loro colonne resterebbero senza destinazione.
    const propri = window.campiPropriArchivio ? window.campiPropriArchivio() : [];
    s.colonne = window.CsvImport.colonneImportabili(_ipTipiConNuovo(), etichette, s.campiNuovi, propri);
    if (riproponi) {
        s.mappatura = window.CsvImport.proponiMappatura(s.analisi.intestazioni, s.colonne);
    } else {
        // Le colonne del file possono essere cambiate di numero (altra riga d'intestazione):
        // la mappatura si allinea invece di restare più corta o più lunga.
        s.mappatura = s.analisi.intestazioni.map((h, i) => s.mappatura[i] || '');
    }
}

/** Rilegge il file scegliendo un'altra riga come intestazione. */
window.impostaRigaIntestazioniImport = function(indice) {
    const s = _ipStato;
    if (!s) return;
    s.analisi = window.CsvImport.analizzaCsv(s.testo, { rigaIntestazioni: Number(indice) });
    _ipAggiornaColonne(true);
    _ipDisegna();
};

window.chiudiImportCsv = function() {
    const modal = document.getElementById('import-csv-modal');
    if (modal) modal.classList.add('hidden-tab');
    _ipStato = null;
};


// --- Passo 1: il modello (Fase 2.4) ------------------------------------------
//
// Il wizard comincia da QUI e non dalla mappatura. La ragione è che il modello decide tutto
// il resto — quali campi si possono scegliere, come si convertono i valori, quali sono
// obbligatori — e trovarlo come una tendina fra le altre, già riempita con l'ultimo usato,
// significa che nove import su dieci finiscono nel modello sbagliato senza che nessuno abbia
// deciso niente. Una domanda esplicita, prima, costa un clic e toglie quel silenzio.
//
// Il modello nuovo NON viene creato qui: come i campi nuovi, esiste solo nel wizard finché
// non si conferma l'import. È la stessa promessa dell'anteprima.

/** Il tipo "in prova", cioè quello che il wizard userà anche se non esiste ancora. */
function _ipTipiConNuovo() {
    const s = _ipStato;
    const tipi = (appData.tipiDocumento || []).slice();
    if (s.modelloNuovo) tipi.push({ id: s.modelloNuovo.id, nome: s.modelloNuovo.nome, campi: [] });
    return tipi;
}

function _ipDisegnaPassoModello() {
    const s = _ipStato;
    const cont = document.getElementById('import-csv-step-modello');
    if (!cont) return;
    cont.innerHTML = '';

    const scelta = (valore, titolo, sotto, attiva, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'import-scelta' + (attiva ? ' is-active' : '');
        b.dataset.valore = valore;
        const t = document.createElement('strong');
        t.textContent = titolo;
        const d = document.createElement('span');
        d.textContent = sotto;
        b.appendChild(t);
        b.appendChild(d);
        b.onclick = onClick;
        return b;
    };

    for (const t of appData.tipiDocumento || []) {
        const campi = window.Model.campiDelTipo(t, window.CONFIG_CAMPI || {}, appData).map(d => d.id);
        cont.appendChild(scelta(t.id, _ipNomeTipo(t),
            campi.slice(0, 6).join(', ') + (campi.length > 6 ? '…' : ''),
            !s.modelloNuovo && s.tipo === t.id,
            () => { s.modelloNuovo = null; s.tipo = t.id; _ipAggiornaColonne(false); _ipDisegna(); }));
    }

    // Il nome proposto è quello del file senza estensione: è come l'utente chiama già quel
    // materiale, e riscriverlo a mano è il primo attrito di chi arriva da un foglio di calcolo.
    const nomeProposto = String(s.nome || '').replace(/\.[^.]+$/, '') || _ipT('imp_model_new', 'Nuovo modello');
    cont.appendChild(scelta('__nuovo__', _ipT('imp_model_new', 'Crea un modello nuovo'),
        _ipT('imp_model_new_desc', 'I campi li costruisci dalle colonne del file, al passo successivo.'),
        !!s.modelloNuovo,
        () => {
            if (!s.modelloNuovo) {
                s.modelloNuovo = { id: 'custom_' + Date.now(), nome: nomeProposto };
                s.tipo = s.modelloNuovo.id;
                _ipAggiornaColonne(false);
            }
            _ipDisegna();
        }));

    if (s.modelloNuovo) {
        const riga = document.createElement('div');
        riga.className = 'import-nuovo-modello';
        const et = document.createElement('label');
        et.textContent = _ipT('imp_model_name', 'Nome del modello');
        et.setAttribute('for', 'import-csv-nome-modello');
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.id = 'import-csv-nome-modello';
        inp.className = 'form-input';
        inp.value = s.modelloNuovo.nome;
        // `oninput` e non `onchange`: ridisegnare a ogni tasto perderebbe il fuoco, ma il
        // valore va tenuto aggiornato o "Continua" premuto senza sfocare userebbe il vecchio.
        inp.oninput = () => { s.modelloNuovo.nome = inp.value; };
        riga.appendChild(et);
        riga.appendChild(inp);
        cont.appendChild(riga);
    }
}

window.importCsvContinua = function() {
    const s = _ipStato;
    if (!s) return;
    if (s.modelloNuovo && !String(s.modelloNuovo.nome || '').trim()) {
        mostraMessaggio(_ipT('imp_model_name_missing', 'Dai un nome al modello prima di continuare.'), 'error');
        return;
    }
    s.passo = 'mappatura';
    _ipDisegna();
};

window.importCsvIndietro = function() {
    const s = _ipStato;
    if (!s) return;
    s.passo = 'modello';
    _ipDisegna();
};

/** Ricostruisce le schede con la mappatura corrente. È anche ciò che verrà importato. */
function _ipRicalcola() {
    const s = _ipStato;
    if (!s) return;
    s.esito = window.CsvImport.costruisciSchede(s.analisi.righe, s.mappatura, {
        tipiDocumento: _ipTipiConNuovo(),
        campiBase: window.CONFIG_CAMPI || {},
        db: appData,
        tipoPredefinito: s.tipo,
        cartella: s.cartella,
        esistenti: appData.manoscritti || [],
        aggiorna: s.aggiorna,
        campiExtra: s.campiNuovi
    });
}

function _ipSelect(valore, opzioni, onChange, className) {
    const sel = document.createElement('select');
    sel.className = className || 'form-input';
    for (const o of opzioni) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if (String(o.value) === String(valore)) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.onchange = () => onChange(sel.value);
    return sel;
}

/**
 * Le destinazioni offerte per una colonna: "non importare", le colonne libere raggruppate
 * (campi della scheda / campi dei modelli / campi nuovi) e la voce che ne crea uno.
 *
 * Il raggruppamento non è decorazione: con venti campi di quattro modelli diversi, una
 * tendina piatta costringe a leggerla tutta per scoprire se ciò che si cerca esiste già —
 * ed è così che nascono i doppioni "Note"/"note"/"Annotazioni".
 */
function _ipOpzioniDestinazione(indice) {
    const s = _ipStato;
    const prese = new Set(s.mappatura.filter((m, i) => m && i !== indice));
    const base = [];
    const campi = [];
    const nuovi = [];
    for (const c of s.colonne) {
        // Una destinazione già presa non si offre due volte: due colonne sullo stesso campo
        // significherebbero che la seconda sovrascrive la prima senza dirlo.
        if (prese.has(c.chiave)) continue;
        const voce = { value: c.chiave, label: c.etichetta };
        if (c.nuovo) nuovi.push(voce);
        else if (c.base) base.push(voce);
        else campi.push(voce);
    }
    return [
        { value: '', label: _ipT('imp_skip', '— non importare —') },
        { gruppo: _ipT('imp_group_base', 'Dati della scheda'), voci: base },
        { gruppo: _ipT('imp_group_fields', 'Campi dei modelli'), voci: campi },
        { gruppo: _ipT('imp_group_new', 'Campi da creare'), voci: nuovi },
        { value: '__nuovo__', label: _ipT('imp_new_field', '＋ Crea un campo nuovo…') }
    ];
}

/** Una tendina con i gruppi (`<optgroup>`): i gruppi vuoti non compaiono. */
function _ipSelectGruppi(valore, opzioni, onChange, className) {
    const sel = document.createElement('select');
    sel.className = className || 'form-input';
    for (const o of opzioni) {
        if (o.gruppo) {
            if (!o.voci.length) continue;
            const g = document.createElement('optgroup');
            g.label = o.gruppo;
            for (const v of o.voci) {
                const opt = document.createElement('option');
                opt.value = v.value;
                opt.textContent = v.label;
                if (String(v.value) === String(valore)) opt.selected = true;
                g.appendChild(opt);
            }
            sel.appendChild(g);
            continue;
        }
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if (String(o.value) === String(valore)) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.onchange = () => onChange(sel.value);
    return sel;
}

/**
 * Il modulo per inventare un campo, aperto DENTRO la riga della colonna.
 *
 * In riga e non in un modale sopra il modale: un secondo livello di finestra per scrivere un
 * nome è sproporzionato, e su Esc non si saprebbe quale dei due si sta chiudendo. È la stessa
 * scelta della rinomina in loco del pannello dei tag (3.4).
 */
function _ipApriNuovoCampo(riga, indice) {
    const s = _ipStato;
    if (riga.querySelector('.import-nuovo-campo')) return;

    const box = document.createElement('div');
    box.className = 'import-nuovo-campo';

    const nome = document.createElement('input');
    nome.type = 'text';
    nome.className = 'form-input';
    // Il nome della colonna è quasi sempre il nome che si vuole dare al campo: proporlo
    // risparmia la digitazione e, soprattutto, tiene il campo e la colonna chiamati uguali.
    nome.value = s.analisi.intestazioni[indice] || '';
    nome.setAttribute('aria-label', _ipT('imp_new_field_name', 'Nome del campo'));

    const tipi = ['text', 'textarea', 'number', 'boolean', 'date', 'url']
        .map(t => ({ value: t, label: _ipT('field_type_' + t, t) }));
    const tipo = document.createElement('select');
    tipo.className = 'form-input';
    for (const t of tipi) {
        const opt = document.createElement('option');
        opt.value = t.value;
        opt.textContent = t.label;
        tipo.appendChild(opt);
    }
    tipo.setAttribute('aria-label', _ipT('imp_new_field_type', 'Tipo del campo'));

    const conferma = document.createElement('button');
    conferma.type = 'button';
    conferma.className = 'btn btn-primary justify-center';
    conferma.textContent = _ipT('btn_create', 'Crea');

    const annulla = document.createElement('button');
    annulla.type = 'button';
    annulla.className = 'btn btn-ghost justify-center';
    annulla.textContent = _ipT('btn_cancel', 'Annulla');
    annulla.onclick = () => { s.mappatura[indice] = ''; _ipDisegna(); };

    const crea = () => {
        const id = window.CsvImport.idCampoNuovo(nome.value, s.colonne);
        if (!id) {
            mostraMessaggio(_ipT('imp_new_field_invalid', 'Nome non utilizzabile: è vuoto o coincide con un campo che esiste già.'), 'error');
            nome.focus();
            return;
        }
        s.campiNuovi.push({ id, tipo: tipo.value, label: id });
        _ipAggiornaColonne(false);
        s.mappatura[indice] = id;
        _ipDisegna();
    };
    conferma.onclick = crea;
    nome.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); crea(); }
        // Esc annulla la SOLA creazione: senza stopPropagation chiuderebbe anche il wizard,
        // buttando via la mappatura di venti colonne per un tasto solo.
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); annulla.onclick(); }
    };

    box.appendChild(nome);
    box.appendChild(tipo);
    box.appendChild(conferma);
    box.appendChild(annulla);
    riga.appendChild(box);
    nome.focus();
    nome.select();
}

function _ipDisegnaMappatura(contenitore) {
    const s = _ipStato;
    contenitore.innerHTML = '';

    s.analisi.intestazioni.forEach((h, i) => {
        const riga = document.createElement('div');
        riga.className = 'import-map-row' + (s.mappatura[i] ? ' is-mapped' : '');

        const sinistra = document.createElement('div');
        sinistra.className = 'import-map-source';
        const nome = document.createElement('span');
        nome.className = 'import-map-name';
        nome.textContent = h;                       // textContent: viene dal file dell'utente
        sinistra.appendChild(nome);

        // Il primo valore non vuoto della colonna, non il primo e basta: su un foglio reale
        // le prime righe sono spesso vuote, e un esempio vuoto non aiuta a decidere.
        const campione = (s.analisi.righe.find(r => String(r[i] || '').trim() !== '') || [])[i] || '';
        if (campione) {
            const esempio = document.createElement('span');
            esempio.className = 'import-map-sample';
            // "es." davanti: senza, il valore d'esempio si legge come una seconda parte del
            // nome della colonna — che è esattamente l'equivoco della prima versione.
            esempio.textContent = _ipT('imp_sample', 'es.') + ' ' + String(campione).slice(0, 48);
            sinistra.appendChild(esempio);
        }
        riga.appendChild(sinistra);

        const freccia = document.createElement('span');
        freccia.className = 'import-map-arrow';
        freccia.setAttribute('aria-hidden', 'true');
        freccia.textContent = '→';
        riga.appendChild(freccia);

        const sel = _ipSelectGruppi(s.mappatura[i], _ipOpzioniDestinazione(i), (v) => {
            if (v === '__nuovo__') {
                s.mappatura[i] = '';
                _ipApriNuovoCampo(riga, i);
                return;
            }
            s.mappatura[i] = v;
            _ipDisegna();
        }, 'form-input import-map-select');
        sel.setAttribute('aria-label', _ipT('imp_dest_for', 'Destinazione della colonna') + ': ' + h);
        riga.appendChild(sel);

        contenitore.appendChild(riga);
    });
}

function _ipDisegnaAnteprima(contenitore) {
    const s = _ipStato;
    contenitore.innerHTML = '';
    const r = s.esito.riepilogo;

    // Il riepilogo come tessere e non come frase: quattro numeri in una riga di prosa si
    // leggono uno per volta, e quello che conta — gli scarti — è l'ultimo a farsi notare.
    const tessere = document.createElement('div');
    tessere.className = 'import-summary';
    const tessera = (valore, etichetta, classe) => {
        const t = document.createElement('div');
        t.className = 'import-chip ' + (classe || '');
        const n = document.createElement('strong');
        n.textContent = String(valore);
        const e = document.createElement('span');
        e.textContent = etichetta;
        t.appendChild(n);
        t.appendChild(e);
        return t;
    };
    tessere.appendChild(tessera(r.nuove, _ipT('imp_state_new_p', 'nuove'), 'is-new'));
    if (r.aggiornate) tessere.appendChild(tessera(r.aggiornate, _ipT('imp_state_updated_p', 'aggiornate'), 'is-upd'));
    if (r.scartate) tessere.appendChild(tessera(r.scartate, _ipT('imp_state_skipped_p', 'scartate'), 'is-skip'));
    if (r.conAvvisi) tessere.appendChild(tessera(r.conAvvisi, _ipT('imp_with_warnings', 'con avvisi'), 'is-warn'));
    contenitore.appendChild(tessere);

    const nuoveCartelle = (s.esito.cartelleNuove || []).filter(c => !(appData.cartelle || []).includes(c));
    if (nuoveCartelle.length) {
        const p = document.createElement('p');
        p.className = 'import-note';
        p.textContent = _ipT('imp_new_folders', 'Verranno creati {var0} archivi: ').replace('{var0}', String(nuoveCartelle.length))
            + nuoveCartelle.slice(0, 6).join(', ') + (nuoveCartelle.length > 6 ? '…' : '');
        contenitore.appendChild(p);
    }
    if (s.campiNuovi.length) {
        const p = document.createElement('p');
        p.className = 'import-note';
        p.textContent = _ipT('imp_new_fields', 'Verranno aggiunti al modello {var0} i campi: ')
            .replace('{var0}', _ipNomeTipo((appData.tipiDocumento || []).find(t => t.id === s.tipo) || { id: s.tipo }))
            + s.campiNuovi.map(c => c.id).join(', ');
        contenitore.appendChild(p);
    }

    // Le prime righe, come dice la roadmap: l'anteprima serve a riconoscere un errore di
    // mappatura, e per quello ne bastano poche. Le righe con problemi però si mostrano
    // TUTTE (fino a un tetto), perché è l'elenco su cui l'utente dovrà tornare a lavorare.
    const conProblemi = s.esito.esiti.filter(e => e.problemi.length > 0);
    const primi = s.esito.esiti.slice(0, 6);
    const daMostrare = primi.concat(conProblemi.filter(e => primi.indexOf(e) === -1)).slice(0, 40);
    daMostrare.sort((a, b) => a.riga - b.riga);

    const lista = document.createElement('div');
    lista.className = 'import-preview-list';
    for (const e of daMostrare) {
        const riga = document.createElement('div');
        riga.className = 'import-preview-row';

        const stato = document.createElement('span');
        stato.className = 'import-state is-' + e.stato;
        stato.textContent = e.stato === 'scartata' ? _ipT('imp_state_skipped', 'scartata')
            : e.stato === 'aggiornata' ? _ipT('imp_state_updated', 'aggiornata') : _ipT('imp_state_new', 'nuova');
        riga.appendChild(stato);

        const corpo = document.createElement('div');
        corpo.className = 'import-preview-body';
        const testa = document.createElement('div');
        const segn = document.createElement('strong');
        segn.textContent = e.segnatura || _ipT('record_untitled', 'scheda senza titolo');
        const numero = document.createElement('span');
        numero.className = 'import-preview-row-n';
        // +2: la riga 1 del file è l'intestazione, e l'utente conta come conta Excel.
        numero.textContent = ' · ' + _ipT('imp_row', 'riga {var0}').replace('{var0}', String(e.riga + 2 + s.analisi.rigaIntestazioni));
        testa.appendChild(segn);
        testa.appendChild(numero);
        corpo.appendChild(testa);

        if (e.problemi.length) {
            const nota = document.createElement('div');
            nota.className = 'import-preview-warn';
            nota.textContent = e.problemi.map(_ipMotivo).join(' · ');
            corpo.appendChild(nota);
        }
        riga.appendChild(corpo);
        lista.appendChild(riga);
    }
    contenitore.appendChild(lista);

    const restanti = s.esito.esiti.length - daMostrare.length;
    if (restanti > 0) {
        const p = document.createElement('p');
        p.className = 'import-note';
        p.textContent = _ipT('imp_and_more', '…e altre {var0} righe.').replace('{var0}', String(restanti));
        contenitore.appendChild(p);
    }
}

/**
 * ⚠️ La destinazione dev'essere un archivio CHE ESISTE. `cartellaAttuale` può non stare in
 * `appData.cartelle` — un record può avere una `cartella` mai registrata come archivio — e in
 * quel caso il `<select>` non trovava l'opzione, mostrava "Radice", e intanto ogni scheda
 * finiva nel percorso invisibile, che l'anteprima annunciava come archivio da creare: il
 * comando diceva una cosa e ne faceva un'altra. Va fatto PRIMA del ricalcolo, o l'anteprima
 * verrebbe costruita sulla destinazione sbagliata.
 */
function _ipNormalizzaCartella() {
    const s = _ipStato;
    if (s.cartella && !(appData.cartelle || []).includes(s.cartella)) s.cartella = '';
}

function _ipDisegna() {
    const s = _ipStato;
    if (!s) return;
    _ipNormalizzaCartella();
    _ipRicalcola();

    const titolo = document.getElementById('import-csv-file');
    if (titolo) {
        titolo.textContent = s.nome + '  ·  ' +
            _ipT('imp_rows_found', '{var0} righe').replace('{var0}', String(s.analisi.righe.length)) +
            '  ·  ' + _ipT('imp_delimiter', 'separatore') + ' ' +
            (s.analisi.delimitatore === '\t' ? 'TAB' : s.analisi.delimitatore);
    }

    // I due passi vivono nello stesso modale e si scambiano il posto: separarli in due
    // finestre farebbe perdere il file gia' letto a ogni passo indietro.
    const primoPasso = s.passo === 'modello';
    const blocco = (id, visibile) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden-tab', !visibile);
    };
    blocco('import-csv-step-modello', primoPasso);
    blocco('import-csv-step-modello-head', primoPasso);
    blocco('import-csv-step-mappatura', !primoPasso);

    const indietro = document.getElementById('import-csv-back');
    if (indietro) indietro.classList.toggle('hidden-tab', primoPasso);
    const continua = document.getElementById('import-csv-continua');
    if (continua) continua.classList.toggle('hidden-tab', !primoPasso);
    const bottoneConferma = document.getElementById('import-csv-confirm');
    if (bottoneConferma) bottoneConferma.classList.toggle('hidden-tab', primoPasso);

    if (primoPasso) {
        _ipDisegnaPassoModello();
        return;
    }

    const tipoSlot = document.getElementById('import-csv-tipo-slot');
    if (tipoSlot) {
        tipoSlot.innerHTML = '';
        tipoSlot.appendChild(_ipSelect(s.tipo,
            _ipTipiConNuovo().map(t => ({ value: t.id, label: _ipNomeTipo(t) })),
            (v) => { s.tipo = v; _ipDisegna(); }));
    }

    const cartellaSlot = document.getElementById('import-csv-cartella-slot');
    if (cartellaSlot) {
        cartellaSlot.innerHTML = '';
        const opzioni = [{ value: '', label: window.etichettaRadice ? window.etichettaRadice() : _ipT('folder_root_label', 'Radice') }]
            .concat((appData.cartelle || []).slice().sort().map(c => ({ value: c, label: c })));
        cartellaSlot.appendChild(_ipSelect(s.cartella, opzioni, (v) => { s.cartella = v; _ipDisegna(); }));
    }

    const aggiorna = document.getElementById('import-csv-aggiorna');
    if (aggiorna) {
        aggiorna.checked = !!s.aggiorna;
        aggiorna.onchange = () => { s.aggiorna = aggiorna.checked; _ipDisegna(); };
    }

    // La riga di intestazione è un'IPOTESI del programma (vedi `rigaIntestazioni` in
    // csvImport.ts) e va mostrata come tale: un foglio che comincia con un titolo in una
    // cella sola manderebbe altrimenti tutto storto — colonne senza nome, tendine tutte su
    // "non importare" e la vera intestazione importata come una scheda — senza dire perché.
    const rigaSlot = document.getElementById('import-csv-riga-slot');
    if (rigaSlot) {
        rigaSlot.innerHTML = '';
        const opzioni = (s.analisi.tutte || []).slice(0, 10).map((r, i) => ({
            value: i,
            // L'anteprima della riga nella tendina: si sceglie riconoscendo il contenuto,
            // non contando le righe a memoria.
            label: (i + 1) + ' · ' + r.filter(c => String(c).trim() !== '').slice(0, 4).join(' | ').slice(0, 50)
        }));
        rigaSlot.appendChild(_ipSelect(s.analisi.rigaIntestazioni, opzioni,
            (v) => window.impostaRigaIntestazioniImport(v)));
    }

    const contatore = document.getElementById('import-csv-map-count');
    if (contatore) {
        const mappate = s.mappatura.filter(Boolean).length;
        contatore.textContent = _ipT('imp_mapped_count', '{var0} di {var1} colonne importate')
            .replace('{var0}', String(mappate)).replace('{var1}', String(s.mappatura.length));
    }

    const mapSlot = document.getElementById('import-csv-map');
    if (mapSlot) _ipDisegnaMappatura(mapSlot);
    const prevSlot = document.getElementById('import-csv-preview');
    if (prevSlot) _ipDisegnaAnteprima(prevSlot);

    const conferma = document.getElementById('import-csv-confirm');
    if (conferma) {
        const quante = s.esito.riepilogo.nuove + s.esito.riepilogo.aggiornate;
        conferma.disabled = quante === 0;
        conferma.textContent = quante === 0
            ? _ipT('imp_nothing', 'Niente da importare')
            : _ipT('imp_confirm', 'Importa {var0} schede').replace('{var0}', String(quante));
    }
}

/**
 * Applica l'import: inserisce le schede NUOVE, applica le patch a quelle da aggiornare, crea
 * gli archivi mancanti e registra i tag. Un'unica azione annullabile: importare duecento
 * schede e poterle togliere solo una per una sarebbe una trappola, non una funzione.
 */
window.confermaImportCsv = async function() {
    const s = _ipStato;
    if (!s || !s.esito) return;

    const schede = s.esito.schede;
    if (schede.length === 0) return;

    const nuove = [];
    const patch = [];
    let indice = 0;
    for (const e of s.esito.esiti) {
        if (e.stato === 'scartata') continue;
        const scheda = schede[indice++];
        if (e.stato === 'aggiornata') patch.push(scheda);
        else nuove.push(scheda);
    }

    // Lo stato PRIMA, per l'annullamento: le schede aggiornate vanno fotografate intere,
    // perché la patch ne cambia solo alcune chiavi e ricostruirle a ritroso dai valori nuovi
    // sarebbe indovinare (vedi la regola 3 del gestore di annullamento in state.ts).
    const primaDi = new Map();
    for (const p of patch) {
        const vivo = appData.manoscritti.find(m => String(m.id) === String(p.id));
        if (vivo) primaDi.set(String(p.id), JSON.parse(JSON.stringify(vivo)));
    }
    const cartellePrima = (appData.cartelle || []).slice();
    const idNuovi = nuove.map(m => String(m.id));

    // I campi inventati nel wizard esistono solo qui dentro finché non si conferma: è la
    // stessa promessa dell'anteprima ("nulla viene scritto finché non premi Importa"), e un
    // campo aggiunto al modello mentre si guarda l'anteprima l'avrebbe già tradita.
    // Il modello inventato al passo 1 nasce QUI, non prima: come i campi nuovi, esiste
    // solo nel wizard finche' non si conferma l'import.
    const modelloNuovo = s.modelloNuovo && s.tipo === s.modelloNuovo.id ? s.modelloNuovo : null;
    if (modelloNuovo && !(appData.tipiDocumento || []).some(t => t.id === modelloNuovo.id)) {
        appData.tipiDocumento.push({ id: modelloNuovo.id, nome: modelloNuovo.nome, campi: [] });
    }
    const tipoBersaglio = (appData.tipiDocumento || []).find(t => t.id === s.tipo);
    const campiPrima = tipoBersaglio ? JSON.parse(JSON.stringify({ campi: tipoBersaglio.campi || [], campiDef: tipoBersaglio.campiDef || null })) : null;
    const campiNuovi = s.campiNuovi.slice();

    const applicaCampi = () => {
        if (!tipoBersaglio || campiNuovi.length === 0) return;
        // Si passa da `impostaCampi` e non si scrive `campi`/`campiDef` a mano: è l'unico
        // posto che conosce la forma su disco di un tipo (3.1), e due modi di scriverla
        // divergerebbero al primo campo con un vincolo.
        const definizioni = window.Model.campiDelTipo(tipoBersaglio, window.CONFIG_CAMPI || {}, appData);
        for (const c of campiNuovi) {
            if (definizioni.some(d => d.id === c.id)) continue;
            definizioni.push({ id: c.id, tipo: c.tipo });
        }
        window.Model.impostaCampi(tipoBersaglio, definizioni);
    };

    const applica = async () => {
        if (modelloNuovo && !(appData.tipiDocumento || []).some(t => t.id === modelloNuovo.id)) {
            appData.tipiDocumento.push({ id: modelloNuovo.id, nome: modelloNuovo.nome, campi: [] });
        }
        applicaCampi();
        for (const m of nuove) {
            appData.manoscritti.push(JSON.parse(JSON.stringify(m)));
            // La scheda importata è esplicitamente voluta: se il suo id era fra i tombstone
            // (reimport di qualcosa eliminato), toglierlo o il primo sync la ricancellerebbe.
            if (appData.deletedIds) appData.deletedIds = appData.deletedIds.filter(x => String(x) !== String(m.id));
        }
        for (const p of patch) {
            const vivo = appData.manoscritti.find(m => String(m.id) === String(p.id));
            if (!vivo) continue;
            Object.assign(vivo, p, { lastModified: Date.now() });
        }
        for (const c of s.esito.cartelleNuove) {
            if (c && !appData.cartelle.includes(c)) appData.cartelle.push(c);
            if (c && Array.isArray(appData.deletedCartelle)) {
                appData.deletedCartelle = appData.deletedCartelle.filter(x => x !== c);
            }
        }
        if (window.Model) {
            const tag = [];
            for (const m of nuove.concat(patch)) for (const t of window.Model.tags(m)) tag.push(t);
            window.Model.registraTag(appData, tag);
        }
        await window.Store.commit();
    };

    const annulla = async () => {
        if (modelloNuovo) {
            const usato = appData.manoscritti.some(m => String(m.tipoDocumento) === String(modelloNuovo.id) && !idNuovi.includes(String(m.id)));
            if (!usato) appData.tipiDocumento = appData.tipiDocumento.filter(t => t.id !== modelloNuovo.id);
        }
        if (tipoBersaglio && campiPrima) {
            tipoBersaglio.campi = campiPrima.campi.slice();
            if (campiPrima.campiDef) tipoBersaglio.campiDef = JSON.parse(JSON.stringify(campiPrima.campiDef));
            else delete tipoBersaglio.campiDef;
        }
        appData.manoscritti = appData.manoscritti.filter(m => !idNuovi.includes(String(m.id)));
        for (const [id, prima] of primaDi) {
            const i = appData.manoscritti.findIndex(m => String(m.id) === String(id));
            if (i !== -1) appData.manoscritti[i] = JSON.parse(JSON.stringify(prima));
        }
        appData.cartelle = cartellePrima.slice();
        await window.Store.commit();
    };

    await applica();
    if (window.gestoreAnnullamento) {
        window.gestoreAnnullamento.registraAzione(
            _ipT('undo_import_csv', 'Import di {var0} schede').replace('{var0}', String(nuove.length + patch.length)),
            annulla, applica
        );
    }

    window.chiudiImportCsv();
    if (typeof aggiornaSelectCartelle === 'function') aggiornaSelectCartelle();
    mostraMessaggio(
        _ipT('imp_done', 'Importate {var0} schede ({var1} aggiornate).')
            .replace('{var0}', String(nuove.length)).replace('{var1}', String(patch.length)),
        'success',
        () => window.gestoreAnnullamento && window.gestoreAnnullamento.annullaUltimaAzione()
    );
};

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('import-csv-modal')) return;
        const html = `
    <div id="import-csv-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-3xl">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="file-input" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="imp_title">Importa da CSV</span>
                </h3>
            </div>
            <div class="modal-body">
                <p id="import-csv-file" class="import-file"></p>

                <div id="import-csv-step-modello-head" class="import-section-head">
                    <h4 data-i18n="imp_step_model">Dove finiscono queste schede?</h4>
                </div>
                <div id="import-csv-step-modello" class="import-scelte"></div>

                <div id="import-csv-step-mappatura" class="hidden-tab">
                <div class="import-options">
                    <label>
                        <span data-i18n="imp_header_row">Riga con i nomi delle colonne</span>
                        <span id="import-csv-riga-slot"></span>
                    </label>
                    <label>
                        <span data-i18n="imp_default_type">Modello per le schede</span>
                        <span id="import-csv-tipo-slot"></span>
                    </label>
                    <label>
                        <span data-i18n="imp_default_folder">Cartella di destinazione</span>
                        <span id="import-csv-cartella-slot"></span>
                    </label>
                </div>
                <label class="flex items-center gap-2 text-sm mb-5">
                    <input type="checkbox" id="import-csv-aggiorna">
                    <span data-i18n="imp_update_existing">Aggiorna le schede già presenti invece di aggiungerne di nuove</span>
                </label>

                <div class="import-section-head">
                    <h4 data-i18n="imp_mapping">Colonne del file</h4>
                    <span id="import-csv-map-count"></span>
                </div>
                <div id="import-csv-map" class="import-map"></div>

                <div class="import-section-head">
                    <h4 data-i18n="imp_preview">Anteprima</h4>
                </div>
                <div id="import-csv-preview"></div>

                </div>

                <p class="import-hint" data-i18n="imp_hint">Nulla viene scritto finché non premi Importa. Le righe scartate restano nel file: correggile e reimporta soltanto quelle. L'intero import si annulla con Ctrl+Z.</p>
            </div>
            <!-- Il piede è FRATELLO del corpo, non figlio: il corpo scorre e i pulsanti no.
                 In un modale con una riga per colonna, un "Importa" che scorre via insieme
                 all'elenco costringe a scendere in fondo per fare la cosa per cui si è aperta
                 la finestra. Vedi .modal-footer-bar in style.css. -->
            <div class="modal-footer modal-footer-bar">
                <button type="button" onclick="chiudiImportCsv()" data-modal-cancel class="btn btn-ghost">
                    <span data-i18n="btn_cancel">Annulla</span>
                </button>
                <button type="button" id="import-csv-back" onclick="importCsvIndietro()" class="btn btn-ghost hidden-tab">
                    <span data-i18n="btn_prev">Precedente</span>
                </button>
                <button type="button" id="import-csv-continua" onclick="importCsvContinua()" class="btn btn-primary">
                    <span data-i18n="btn_next">Successiva</span>
                </button>
                <button type="button" id="import-csv-confirm" onclick="confermaImportCsv()" class="btn btn-primary hidden-tab"></button>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('import-csv-modal')] });
    });
})();
