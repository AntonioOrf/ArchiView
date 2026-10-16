function _ipT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

let _ipStato = null;

function _ipTipoPredefinito() {
    const tipi = appData.tipiDocumento || [];
    const ultimo = typeof leggiUltimoTipoDocumento === 'function' ? leggiUltimoTipoDocumento() : null;
    if (ultimo && tipi.some(t => t.id === ultimo)) return ultimo;
    return (tipi[0] || {}).id || '';
}

function _ipNomeTipo(t) {
    const chiave = 'model_' + t.id;
    const tradotto = window.t(chiave);
    return tradotto !== chiave ? tradotto : (t.nome || t.id);
}

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
        tipo: _ipTipoPredefinito(),
        cartella: window.cartellaAttuale || '',
        aggiorna: false,
        passo: 'modello',
        modelloNuovo: null,
        campiNuovi: [],
        colonne: [],
        mappatura: [],
        esito: null
    };
    _ipAggiornaColonne(true);

    document.getElementById('import-csv-modal').classList.remove('hidden-tab');
    _ipDisegna();
};

function _ipAggiornaColonne(riproponi) {
    const s = _ipStato;
    const etichette = window.etichetteColonneExport ? window.etichetteColonneExport() : {};
    const propri = window.campiPropriArchivio ? window.campiPropriArchivio() : [];
    s.colonne = window.CsvImport.colonneImportabili(_ipTipiConNuovo(), etichette, s.campiNuovi, propri);
    if (riproponi) {
        s.mappatura = window.CsvImport.proponiMappatura(s.analisi.intestazioni, s.colonne);
    } else {
        s.mappatura = s.analisi.intestazioni.map((h, i) => s.mappatura[i] || '');
    }
}

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

function _ipSelect(valore, opzioni, onChange, className?) {
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

function _ipOpzioniDestinazione(indice) {
    const s = _ipStato;
    const prese = new Set(s.mappatura.filter((m, i) => m && i !== indice));
    const base = [];
    const campi = [];
    const nuovi = [];
    for (const c of s.colonne) {
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

function _ipApriNuovoCampo(riga, indice) {
    const s = _ipStato;
    if (riga.querySelector('.import-nuovo-campo')) return;

    const box = document.createElement('div');
    box.className = 'import-nuovo-campo';

    const nome = document.createElement('input');
    nome.type = 'text';
    nome.className = 'form-input';
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
    const annullaCreazione = () => { s.mappatura[indice] = ''; _ipDisegna(); };
    annulla.onclick = annullaCreazione;

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
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); annullaCreazione(); }
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
        nome.textContent = h;
        sinistra.appendChild(nome);

        const campione = (s.analisi.righe.find(r => String(r[i] || '').trim() !== '') || [])[i] || '';
        if (campione) {
            const esempio = document.createElement('span');
            esempio.className = 'import-map-sample';
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
        segn.translate = false;
        const numero = document.createElement('span');
        numero.className = 'import-preview-row-n';
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

function _ipNormalizzaCartella() {
    const s = _ipStato;
    if (s.cartella && !(appData.cartelle || []).includes(s.cartella)) s.cartella = '';
}

function _ipChiaveFuoco() {
    const a = document.activeElement as HTMLElement | null;
    const modal = document.getElementById('import-csv-modal');
    if (!a || !modal || !modal.contains(a)) return null;
    if (a.id) return { id: a.id };
    const cont = a.parentElement && a.parentElement.closest('[id]');
    if (!cont) return null;
    return { cont: cont.id, tag: a.tagName, indice: Array.from(cont.querySelectorAll(a.tagName)).indexOf(a) };
}

function _ipRipristinaFuoco(k) {
    if (!k || (document.activeElement && document.activeElement !== document.body)) return;
    const cont = k.cont ? document.getElementById(k.cont) : null;
    const el = (k.id ? document.getElementById(k.id) : cont && cont.querySelectorAll(k.tag)[k.indice]) as HTMLElement | null;
    if (el && el.getClientRects().length) el.focus();
}

function _ipDisegna() {
    const fuoco = _ipChiaveFuoco();
    _ipDisegnaPasso();
    _ipRipristinaFuoco(fuoco);
}

function _ipDisegnaPasso() {
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

    const rigaSlot = document.getElementById('import-csv-riga-slot');
    if (rigaSlot) {
        rigaSlot.innerHTML = '';
        const opzioni = (s.analisi.tutte || []).slice(0, 10).map((r, i) => ({
            value: i,
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

    const conferma = document.getElementById('import-csv-confirm') as HTMLButtonElement;
    if (conferma) {
        const quante = s.esito.riepilogo.nuove + s.esito.riepilogo.aggiornate;
        conferma.disabled = quante === 0;
        conferma.textContent = quante === 0
            ? _ipT('imp_nothing', 'Niente da importare')
            : _ipT('imp_confirm', 'Importa {var0} schede').replace('{var0}', String(quante));
    }
}

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

    const primaDi = new Map();
    for (const p of patch) {
        const vivo = appData.manoscritti.find(m => String(m.id) === String(p.id));
        if (vivo) primaDi.set(String(p.id), JSON.parse(JSON.stringify(vivo)));
    }
    const cartellePrima = (appData.cartelle || []).slice();
    const idNuovi = nuove.map(m => String(m.id));

    const modelloNuovo = s.modelloNuovo && s.tipo === s.modelloNuovo.id ? s.modelloNuovo : null;
    if (modelloNuovo && !(appData.tipiDocumento || []).some(t => t.id === modelloNuovo.id)) {
        appData.tipiDocumento.push({ id: modelloNuovo.id, nome: modelloNuovo.nome, campi: [] });
    }
    const tipoBersaglio = (appData.tipiDocumento || []).find(t => t.id === s.tipo);
    const campiPrima = tipoBersaglio ? JSON.parse(JSON.stringify({ campi: tipoBersaglio.campi || [], campiDef: tipoBersaglio.campiDef || null })) : null;
    const campiNuovi = s.campiNuovi.slice();

    const applicaCampi = () => {
        if (!tipoBersaglio || campiNuovi.length === 0) return;
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
        for (const m of nuove) appData.manoscritti.push(JSON.parse(JSON.stringify(m)));
        window.Store.togliTombstone(nuove.map(m => m.id));
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
                <button type="button" data-on-click="chiudiImportCsv" data-modal-cancel class="btn btn-ghost">
                    <span data-i18n="btn_cancel">Annulla</span>
                </button>
                <button type="button" id="import-csv-back" data-on-click="importCsvIndietro" class="btn btn-ghost hidden-tab">
                    <span data-i18n="btn_prev">Precedente</span>
                </button>
                <button type="button" id="import-csv-continua" data-on-click="importCsvContinua" class="btn btn-primary">
                    <span data-i18n="btn_next">Successiva</span>
                </button>
                <button type="button" id="import-csv-confirm" data-on-click="confermaImportCsv" class="btn btn-primary hidden-tab"></button>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('import-csv-modal')] });
    });
})();
