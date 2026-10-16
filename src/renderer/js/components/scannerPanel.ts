function _scT(id, fallback) {
    return typeof window.t === 'function' ? window.t(id, fallback) : fallback;
}

function _scEl(tag, classe?, testo?) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (testo !== undefined) el.textContent = testo;
    return el;
}

function _scPagine(n) {
    return n === 1 ? _scT('scan_page_one', '1 pagina') : _scT('scan_pages', '{var0} pagine').replace('{var0}', String(n));
}

const _SC_MINIATURE = 12;

let _scOccupato = false;
let _scDrive = null;
const _scImportate = new Map();
let _scPdf = false;

function _scStato(testo) {
    const el = document.getElementById('scan-stato');
    if (el) el.textContent = testo || '';
}

function _scErrore(codice) {
    const noti = {
        ricezione_in_corso: _scT('scan_err_busy', 'Una ricezione è già in corso.'),
        nessun_archivio_aperto: _scT('scan_err_no_vault', 'Nessun archivio aperto.'),
        file_esistente: _scT('scan_err_exists', 'Queste foto sono già tra gli allegati della scheda.'),
        archivio_non_creato: _scT('scan_err_vault', 'Archivio non creato: nome di cartella non valido o posizione non scrivibile.')
    };
    return _scT('scan_error', 'Operazione non riuscita: {var0}').replace('{var0}', noti[codice] || String(codice || '?'));
}

window.apriScansioni = async function() {
    const modal = document.getElementById('scanner-modal');
    if (!modal) return;
    _scStato('');
    modal.classList.remove('hidden-tab');
    document.getElementById('scan-chiudi')?.focus();
    try {
        _scPdf = (await window.apiSettings.get()).scannerPdf === true;
    } catch (e) {
        console.warn('[scanner] impostazioni non lette, importo come foto:', e);
    }
    _scDisegnaDrive();
    await window.disegnaScansioni();
    await _scControllaDrive(true);
};

window.chiudiScansioni = function() {
    document.getElementById('scanner-modal')?.classList.add('hidden-tab');
    if (_scWifiAttivo) window.attivaWifiScansioni();
};

async function _scControllaDrive(scarica) {
    if (!window.apiScanner || !window.apiScanner.controllaDrive) return null;
    let r;
    try {
        r = await window.apiScanner.controllaDrive();
    } catch (e) {
        console.warn('[scanner] controllo di Drive non riuscito:', e);
        return null;
    }
    if (!r || !r.success) { console.warn('[scanner] controllo di Drive non riuscito:', r && r.error); return null; }
    _scDrive = { collegato: !!r.collegato, qui: r.qui || [], altri: r.altri || [], ora: new Date() };
    _scDisegnaDrive();
    if (scarica && _scDrive.collegato && _scDrive.qui.length) await window.riceviScansioni();
    return _scDrive;
}

function _scDisegnaDrive() {
    const testo = document.getElementById('scan-drive-testo');
    const etichetta = document.getElementById('scan-ricevi-label');
    if (testo && etichetta) {
        if (_scDrive && _scDrive.collegato) {
            const ora = _scDrive.ora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            testo.textContent = _scT('scan_drive_checked', 'Drive controllato alle {var0} ·').replace('{var0}', ora);
            etichetta.textContent = _scT('scan_check_again', 'Controlla di nuovo');
        } else {
            testo.textContent = _scDrive ? _scT('scan_drive_off', 'Drive non collegato ·') : '';
            etichetta.textContent = _scT('scan_receive', 'Ricevi da Drive');
        }
    }

    const box = document.getElementById('scan-altri');
    const lista = document.getElementById('scan-altri-lista');
    if (!box || !lista) return;
    const altri = (_scDrive && _scDrive.altri) || [];
    box.classList.toggle('hidden-tab', !altri.length);
    lista.replaceChildren(...altri.map(a => {
        const riga = _scEl('li', 'scan-riga');
        const testoRiga = _scEl('span', 'scan-riga-testo');
        testoRiga.append(_scEl('span', 'scan-serif', a.nome), ' ');
        if (a.nuovo) testoRiga.append(_scEl('span', 'stato-badge is-info', _scT('scan_new_badge', 'nuovo')), ' ');
        testoRiga.append(_scEl('span', 'scan-sotto', '· ' + _scPagine(a.pagine)));
        riga.appendChild(testoRiga);
        const btn = _scEl('button', 'btn btn-secondary');
        btn.type = 'button';
        if (a.percorso) {
            btn.textContent = _scT('scan_open_vault', 'Apri archivio');
            btn.onclick = () => _scApriArchivio(a.percorso);
            riga.appendChild(btn);
        } else if (a.nuovo) {
            btn.textContent = _scT('scan_create_vault', 'Crea archivio…');
            btn.onclick = () => _scCreaArchivio(a.nome);
            riga.appendChild(btn);
        } else {
            riga.appendChild(_scEl('span', 'scan-sotto', _scT('scan_other_hint', 'si importano aprendo quell\'archivio')));
        }
        return riga;
    }));
}

async function _scApriArchivio(percorso) {
    try {
        await window.salvaTutto();
        if (!(await window.apiBrowser.openRecentWorkspace(percorso))) window.archivioRecenteNonTrovato(percorso);
    } catch (e) {
        console.error('[scanner] archivio non aperto:', percorso, e);
        mostraMessaggio(_scErrore(e && e.message), 'error');
    }
}

async function _scCreaArchivio(nome) {
    try {
        const base = await window.apiBrowser.selectBaseDirectory(_scT('dialog_select_folder', 'Seleziona la posizione per la nuova cartella'));
        if (!base) return;
        await window.salvaTutto();
        if (!await window.apiBrowser.createWorkspaceInPath(base, nome, null)) throw new Error('archivio_non_creato');
    } catch (e) {
        console.error('[scanner] archivio non creato:', nome, e);
        mostraMessaggio(_scErrore(e && e.message), 'error');
    }
}

let _scWifiAttivo = false;

window.attivaWifiScansioni = async function() {
    const box = document.getElementById('scan-wifi-box');
    const btn = document.getElementById('scan-wifi') as HTMLButtonElement;
    const etichetta = document.getElementById('scan-wifi-label');
    if (_scWifiAttivo) {
        _scWifiAttivo = false;
        box?.classList.add('hidden-tab');
        if (etichetta) etichetta.textContent = _scT('scan_wifi', 'Ricevi via Wi-Fi, senza Drive…');
        try {
            await window.apiScanner.fermaWifi();
        } catch (e) {
            console.error('[scanner] arresto Wi-Fi fallito:', e);
        }
        return;
    }
    if (btn) btn.disabled = true;
    try {
        const r = await window.apiScanner.avviaWifi();
        if (!r || !r.success) {
            _scStato(r && r.error === 'nessuna_rete_locale'
                ? _scT('scan_wifi_no_lan', 'Il computer non è collegato a una rete locale.')
                : _scErrore(r && r.error));
            return;
        }
        _scWifiAttivo = true;
        const qr = document.createElement('img');
        qr.src = r.qr;
        qr.alt = _scT('scan_wifi_qr', 'Codice QR di abbinamento');
        qr.width = qr.height = 180;
        document.getElementById('scan-wifi-qr').replaceChildren(qr);
        document.getElementById('scan-wifi-info').textContent = _scT('scan_wifi_info', 'Dal telefono: «Abbina col computer» e inquadra il codice. Telefono e computer sulla stessa rete. Indirizzo: {var0}')
            .replace('{var0}', r.indirizzi.map(i => i + ':' + r.porta).join(', '));
        box?.classList.remove('hidden-tab');
        if (etichetta) etichetta.textContent = _scT('scan_wifi_stop', 'Ferma il Wi-Fi');
    } catch (e) {
        console.error('[scanner] Wi-Fi non avviato:', e);
        _scStato(_scErrore(e && e.message));
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.riceviScansioni = async function() {
    if (_scOccupato) return;
    _scOccupato = true;
    const btn = document.getElementById('scan-ricevi') as HTMLButtonElement;
    if (btn) btn.disabled = true;
    _scStato(_scT('scan_receiving', 'Ricezione in corso…'));
    _scInRicezione(true);
    try {
        const r = await window.apiScanner.riceviDaDrive();
        if (!r || !r.success) { _scStato(_scErrore(r && r.error)); return; }
        const parti = [];
        if (r.inCaricamento.length) parti.push(_scT('scan_uploading', 'Ancora in caricamento dal telefono: {var0}.').replace('{var0}', String(r.inCaricamento.length)));
        if (r.falliti.length) parti.push(_scT('scan_failed', 'Non ricevuti: {var0} (dettagli nel log).').replace('{var0}', String(r.falliti.length)));
        _scStato(parti.join(' '));
        const titolo = m => String((typeof window.titoloScheda === 'function' && window.titoloScheda(m)) || '').slice(0, 500);
        const schede = appData.manoscritti.map(m => ({ id: String(m.id), segnatura: String(m.segnatura || ''), cartella: String(m.cartella || ''), titolo: titolo(m), tags: m.tags }));
        window.apiScanner.pubblicaSchede(schede, (appData.cartelle || []).filter(c => typeof c === 'string' && c && c.length <= 500))
            .then(p => { if (!p || !p.success) console.warn('[scanner] elenco schede non pubblicato:', p && p.error); })
            .catch(e => console.warn('[scanner] elenco schede non pubblicato:', e));
    } catch (e) {
        console.error('[scanner] ricezione fallita:', e);
        _scStato(_scErrore(e && e.message));
    } finally {
        _scOccupato = false;
        if (btn) btn.disabled = false;
        _scInRicezione(false);
    }
    await window.disegnaScansioni();
    await _scControllaDrive(false);
};

function _scInRicezione(attiva) {
    const lista = document.getElementById('scan-lista');
    if (!lista) return;
    lista.querySelector('.scan-vuoto')?.remove();
    lista.querySelector('.scan-ricezione')?.remove();
    if (!attiva) return;
    lista.prepend(_scEl('p', 'scan-ricezione scan-sotto italic', _scT('scan_receiving_list', 'Ricezione da Drive in corso: le scansioni compaiono qui appena scaricate.')));
}

function _scDestinazione(lotto) {
    const trova = (id) => appData.manoscritti.find(m => String(m.id) === String(id));
    if (lotto.destinazione && lotto.destinazione.tipo === 'esistente') {
        const m = trova(lotto.destinazione.schedaId);
        if (m) return m;
    }
    const sel = window.selectedRecords || [];
    return sel.length === 1 ? trova(sel[0]) || null : null;
}

window.disegnaScansioni = async function() {
    const lista = document.getElementById('scan-lista');
    if (!lista) return;
    let r;
    try {
        r = await window.apiScanner.elenca();
    } catch (e) {
        console.error('[scanner] elenco non letto:', e);
        r = { success: false, error: e && e.message };
    }
    if (r && r.success && await _scImportaAutomatici(r.lotti)) return window.disegnaScansioni();
    _scDisegnaImportate();
    lista.replaceChildren();
    const titolo = document.getElementById('scan-da-smistare-titolo');
    if (!r || !r.success) { _scStato(_scErrore(r && r.error)); return; }
    if (titolo) titolo.textContent = _scT('scan_to_sort', 'Da smistare · {var0}').replace('{var0}', String(r.lotti.length));
    if (!r.lotti.length) {
        const niente = !_scImportate.size && !(_scDrive && _scDrive.altri.length);
        lista.appendChild(_scEl('p', 'scan-vuoto scan-sotto', niente
            ? _scT('scan_empty', 'Nessuna scansione dal telefono. Sul telefono: ArchiScanner → scegli questo archivio e scansiona; le pagine arrivano qui da sole.')
            : _scT('scan_empty_sort', 'Niente da smistare.')));
        return;
    }
    _scPreparaSchede(lista);
    for (const lotto of r.lotti) lista.appendChild(_scScheda(lotto));
};

function _scDisegnaImportate() {
    const box = document.getElementById('scan-importate');
    const lista = document.getElementById('scan-importate-lista');
    if (!box || !lista) return;
    box.classList.toggle('hidden-tab', !_scImportate.size);
    lista.replaceChildren(...[..._scImportate].map(([id, info]) => {
        const m = appData.manoscritti.find(x => String(x.id) === id);
        const segnatura = (m && m.segnatura) || id;
        const riga = _scEl('li', 'scan-riga');
        riga.appendChild(_scEl('span', 'testo-successo', '✓'));
        riga.appendChild(_scEl('span', 'scan-riga-testo', (info.nuova
            ? _scT('scan_imported_new', '{var0} nella scheda nuova «{var1}»')
            : _scT('scan_imported_in', '{var0} in «{var1}»')).replace('{var0}', _scPagine(info.pagine)).replace('{var1}', segnatura)));
        if (m) {
            const apri = _scEl('button', 'scan-link', _scT('scan_open', 'Apri'));
            apri.type = 'button';
            apri.setAttribute('aria-label', _scT('scan_open_record', 'Apri «{var0}»').replace('{var0}', segnatura));
            apri.onclick = () => { window.chiudiScansioni(); if (typeof window.editItem === 'function') window.editItem(id); };
            riga.appendChild(apri);
        }
        return riga;
    }));
}

function _scSegnaImportate(id, pagine, nuova) {
    const prima = _scImportate.get(id);
    _scImportate.set(id, { pagine: (prima ? prima.pagine : 0) + pagine, nuova: (prima ? prima.nuova : false) || nuova });
    window.carteDalTelefono.versione++;
    if (typeof renderSidebar === 'function') renderSidebar();
}

window.carteDalTelefono = Object.assign((id) => (_scImportate.get(String(id)) || { pagine: 0 }).pagine, { versione: 0 });

let _scVociSchede = new Map();

function _scPreparaSchede(lista) {
    _scVociSchede = new Map();
    const dl = document.createElement('datalist');
    dl.id = 'scan-schede';
    for (const m of appData.manoscritti) {
        const base = String(m.segnatura || m.id);
        const voce = m.cartella ? base + ' — ' + m.cartella : base;
        if (_scVociSchede.has(voce)) continue;
        _scVociSchede.set(voce, String(m.id));
        const opt = document.createElement('option');
        opt.value = voce;
        dl.appendChild(opt);
    }
    lista.appendChild(dl);
}

function _scScheda(lotto) {
    const box = _scEl('section', 'scan-lotto');
    const primaRiga = (lotto.nota || '').split('\n')[0].trim();
    const nome = lotto.titolo || primaRiga.slice(0, 120) || lotto.id;
    box.setAttribute('aria-label', nome);

    const testa = _scEl('div', 'scan-lotto-testa');
    const quando = new Date(lotto.creatoIl);
    testa.append(
        _scEl('h5', 'scan-lotto-titolo', nome),
        _scEl('span', 'scan-meta', [_scPagine(lotto.pagine.length), isNaN(quando.getTime()) ? lotto.creatoIl : quando.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })].join(' · '))
    );
    box.appendChild(testa);
    if (lotto.nota && (lotto.titolo || lotto.nota.trim() !== primaRiga)) box.appendChild(_scEl('p', 'scan-nota', lotto.nota));

    const miniature = _scEl('div', 'scan-miniature');
    for (const pg of lotto.pagine.slice(0, _SC_MINIATURE)) {
        const fig = document.createElement('figure');
        const img = document.createElement('img');
        img.alt = pg.etichetta || pg.file;
        img.decoding = 'async';
        fig.append(img, _scEl('figcaption', '', pg.etichetta || pg.file));
        miniature.appendChild(fig);
        window.apiScanner.miniatura(lotto.id, pg.file)
            .then(m => { if (m && m.success && m.dataUrl) img.src = m.dataUrl; })
            .catch(e => console.warn('[scanner] miniatura non disponibile:', pg.file, e));
    }
    if (lotto.pagine.length > _SC_MINIATURE) miniature.appendChild(_scEl('span', 'scan-sotto self-center', '+' + (lotto.pagine.length - _SC_MINIATURE)));
    box.appendChild(miniature);

    const azioni = _scEl('div', 'scan-azioni');
    const dest = _scDestinazione(lotto);
    const aggiungi = _scEl('button', 'btn btn-primary') as HTMLButtonElement;
    aggiungi.type = 'button';
    if (dest) {
        aggiungi.textContent = _scT('scan_add_to', 'Aggiungi a «{var0}»').replace('{var0}', dest.segnatura || String(dest.id));
        aggiungi.onclick = () => _scAssegna(lotto, dest, box);
    } else {
        const cerca = _scEl('input', 'form-input text-xs') as HTMLInputElement;
        cerca.type = 'search';
        cerca.setAttribute('list', 'scan-schede');
        cerca.placeholder = _scT('scan_search', 'Cerca la scheda…');
        cerca.setAttribute('aria-label', _scT('scan_add_search', 'Aggiungi a una scheda'));
        aggiungi.textContent = _scT('scan_add', 'Aggiungi');
        aggiungi.disabled = true;
        cerca.oninput = () => { aggiungi.disabled = !_scVociSchede.has(cerca.value); };
        aggiungi.onclick = () => {
            const scelta = appData.manoscritti.find(m => String(m.id) === _scVociSchede.get(cerca.value));
            if (scelta) _scAssegna(lotto, scelta, box);
        };
        azioni.appendChild(cerca);
    }

    const crea = _scEl('button', 'btn btn-secondary', _scT('scan_new', 'Nuova scheda'));
    crea.type = 'button';
    crea.onclick = () => _scAssegna(lotto, null, box);

    const scarta = _scEl('button', 'btn btn-danger-ghost', _scT('scan_discard', 'Scarta'));
    scarta.type = 'button';
    scarta.onclick = () => _scScarta(lotto);

    azioni.append(aggiungi, crea, scarta);
    box.appendChild(azioni);
    return box;
}

async function _scApplica(lotto, id, comePdf, datiNuova) {
    const notePagine = _scNotePagine(lotto);
    const r = await window.apiScanner.assegna(lotto.id, id, { pdf: !!comePdf });
    if (!r || !r.success) throw new Error(r && r.error);

    let username = 'Anonimo';
    try {
        username = (await window.apiSettings.get()).username || 'Anonimo';
    } catch (err) {
        console.error('Impostazioni non leggibili, uso "Anonimo" come autore:', err);
    }

    const vivo = appData.manoscritti.find(m => String(m.id) === id);
    if (!vivo) {
        if (!datiNuova) throw new Error('scheda_non_trovata');
        appData.manoscritti.push(window.Model.creaScheda(Object.assign({}, datiNuova, {
            id,
            note: _scUnisciNote(datiNuova.note, notePagine),
            allegati: r.allegati,
            allegato: r.allegati[0].nome,
            allegatoTipo: r.allegati[0].tipo,
            creatoDa: username
        })));
        window.Store.togliTombstone([id]);
        if (datiNuova.cartella && !appData.cartelle.includes(datiNuova.cartella)) appData.cartelle.push(datiNuova.cartella);
    } else {
        if (!vivo.allegati) vivo.allegati = [];
        if (vivo.allegato && vivo.allegati.length === 0) {
            vivo.allegati.push({ nome: vivo.allegato, tipo: vivo.allegatoTipo, originalName: 'Allegato' });
        }
        vivo.allegati.push(...r.allegati);
        const note = _scUnisciNote(vivo.note, lotto.nota, notePagine);
        if (note !== (vivo.note || '')) vivo.note = note;
        if (!vivo.allegato) {
            vivo.allegato = r.allegati[0].nome;
            vivo.allegatoTipo = r.allegati[0].tipo;
        }
        vivo.lastModified = Date.now();
        vivo.modificatoDa = username;
    }
    await window.Store.commit();
    await window.salvaTutto();
    const t = await window.apiScanner.togli(lotto.id);
    if (!t || !t.success) console.warn('[scanner] lotto assegnato ma rimasto in arrivo:', lotto.id, t && t.error);
    _scSegnaImportate(id, lotto.pagine.length, !vivo);
    return { allegati: r.allegati, creata: !vivo };
}

function _scNotePagine(lotto) {
    return lotto.pagine.map((pg, i) => pg.nota ? `${pg.etichetta || 'p. ' + (i + 1)}: ${pg.nota}` : '').filter(Boolean).join('\n');
}

function _scUnisciNote(...testi) {
    return testi.filter(t => t && String(t).trim()).join('\n\n');
}

function _scDatiNuova(lotto) {
    const d = lotto.destinazione || {};
    const campi = d.campi || {};
    return Object.assign({}, campi, {
        segnatura: campi.segnatura || lotto.titolo || '',
        note: campi.note || lotto.nota || '',
        tipoDocumento: d.tipoDocumento,
        cartella: d.cartella || ''
    });
}

function _scAutomatico(lotto) {
    const d = lotto.destinazione;
    if (!lotto.archivio || !d) return false;
    if (d.tipo === 'nuova') return !!d.schedaId;
    return d.tipo === 'esistente' && appData.manoscritti.some(m => String(m.id) === String(d.schedaId));
}

const _scAutoFalliti = new Set();

async function _scImportaAutomatici(lotti) {
    const auto = lotti.filter(l => !_scAutoFalliti.has(l.id) && _scAutomatico(l)).sort((a, b) => a.id < b.id ? -1 : 1);
    if (!auto.length || _scOccupato) return false;
    _scOccupato = true;
    let pagine = 0;
    const schede = new Set();
    try {
        for (const lotto of auto) {
            const d = lotto.destinazione;
            try {
                const esito = await _scApplica(lotto, String(d.schedaId), _scPdf, d.tipo === 'nuova' ? _scDatiNuova(lotto) : null);
                pagine += lotto.pagine.length;
                schede.add(String(d.schedaId));
                if (esito.creata && typeof window.renderBarraCarte === 'function') window.renderBarraCarte(String(d.schedaId));
            } catch (e) {
                console.error('[scanner] importazione automatica fallita:', lotto.id, e);
                _scAutoFalliti.add(lotto.id);
            }
        }
    } finally {
        _scOccupato = false;
    }
    if (pagine) {
        if (typeof renderMain === 'function') renderMain();
        mostraMessaggio(_scT('scan_auto_imported', 'Importate dal telefono {var0} pagine in {var1} schede.')
            .replace('{var0}', String(pagine)).replace('{var1}', String(schede.size)), 'success');
    }
    return true;
}

async function _scAssegna(lotto, scheda, box) {
    if (_scOccupato) { mostraMessaggio(_scErrore('ricezione_in_corso'), 'warning'); return; }
    _scOccupato = true;
    box.querySelectorAll('button, input').forEach(el => { el.disabled = true; });
    try {
        const nuova = !scheda;
        const id = nuova ? window.Model.nuovoId() : String(scheda.id);
        const r = await _scApplica(lotto, id, _scPdf, nuova ? { segnatura: lotto.titolo || '', note: lotto.nota || '' } : null);

        mostraMessaggio(nuova
            ? _scT('scan_created', 'Scheda creata con {var0} carte.').replace('{var0}', String(r.allegati.length))
            : _scT('scan_added', 'Aggiunte {var0} carte a «{var1}».').replace('{var0}', String(r.allegati.length)).replace('{var1}', scheda.segnatura || id),
            'success');
        if (typeof window.renderBarraCarte === 'function') window.renderBarraCarte(id);
        if (typeof renderMain === 'function') renderMain();
        if (nuova && typeof window.editItem === 'function') {
            window.chiudiScansioni();
            window.editItem(id);
        }
    } catch (e) {
        console.error('[scanner] assegnazione fallita:', lotto.id, e);
        mostraMessaggio(_scErrore(e && e.message), 'error');
    } finally {
        _scOccupato = false;
        await window.disegnaScansioni();
    }
}

function _scScarta(lotto) {
    const msg = _scT('scan_discard_confirm', 'Eliminare il lotto «{var0}» ({var1} foto)? Le foto non sono in nessuna scheda e non si recuperano.')
        .replace('{var0}', lotto.titolo || lotto.id)
        .replace('{var1}', String(lotto.pagine.length));
    const esegui = async () => {
        try {
            const r = await window.apiScanner.togli(lotto.id);
            if (!r || !r.success) throw new Error(r && r.error);
        } catch (e) {
            console.error('[scanner] lotto non scartato:', lotto.id, e);
            mostraMessaggio(_scErrore(e && e.message), 'error');
        }
        await window.disegnaScansioni();
    };
    if (typeof window.mostraBottomConfirm === 'function') window.mostraBottomConfirm(msg, esegui);
    else if (confirm(msg)) esegui();
}

function _scRiepilogoQui(qui) {
    const perScheda = new Map();
    let daSmistare = 0;
    for (const l of qui) {
        const d = l.destinazione || {};
        if (!_scAutomatico({ archivio: true, destinazione: d })) { daSmistare += l.pagine; continue; }
        const id = String(d.schedaId);
        const m = appData.manoscritti.find(x => String(x.id) === id);
        const nome = (m && m.segnatura) || (d.campi && d.campi.segnatura) || '—';
        const g = perScheda.get(id) || { nome, pagine: 0 };
        g.pagine += l.pagine;
        perScheda.set(id, g);
    }
    return { perScheda: [...perScheda.values()], daSmistare };
}

function _scRigaRiepilogo(n, ...parti) {
    const riga = _scEl('div', 'scan-riepilogo-riga');
    const testo = _scEl('span');
    testo.append(...parti);
    riga.append(_scEl('span', 'scan-num', String(n)), testo);
    return riga;
}

function _scAvviso(drive): Promise<{ importa: boolean; sempre: boolean }> {
    const modal = document.getElementById('scan-avviso');
    if (!modal) return Promise.resolve({ importa: false, sempre: false });
    const { perScheda, daSmistare } = _scRiepilogoQui(drive.qui);
    const totale = drive.qui.reduce((s, l) => s + l.pagine, 0) + drive.altri.reduce((s, a) => s + a.pagine, 0);
    document.getElementById('scan-avviso-testo').textContent =
        _scT('scan_check_total', 'Su Drive ci sono {var0} scansionate col telefono.').replace('{var0}', _scPagine(totale));

    const elenco = document.getElementById('scan-avviso-elenco');
    elenco.replaceChildren();
    if (drive.qui.length) {
        const g = _scEl('div', 'scan-riepilogo-gruppo is-qui');
        g.appendChild(_scEl('p', 'scan-riepilogo-titolo', _scT('scan_check_here', 'In questo archivio · {var0}').replace('{var0}', String(typeof window.nomeArchivioCorrente === 'function' ? window.nomeArchivioCorrente() : '').replace(/_ArchiView$/, ''))));
        for (const s of perScheda) {
            g.appendChild(_scRigaRiepilogo(s.pagine, _scT('scan_check_for', 'per') + ' ', _scEl('strong', 'scan-serif', s.nome), ' ', _scEl('span', 'scan-sotto', '· ' + _scT('scan_check_auto', 'entrano da sole'))));
        }
        if (daSmistare) g.appendChild(_scRigaRiepilogo(daSmistare, _scT('scan_check_sort', 'da smistare') + ' ', _scEl('span', 'scan-sotto', '· ' + _scT('scan_check_sort_hint', 'le assegni tu nel pannello'))));
        elenco.appendChild(g);
    }
    if (drive.altri.length) {
        const g = _scEl('div', 'scan-riepilogo-gruppo');
        g.appendChild(_scEl('p', 'scan-riepilogo-titolo', _scT('scan_other_title', 'Per altri archivi · restano su Drive')));
        for (const a of drive.altri) {
            const parti: any[] = [_scEl('span', 'scan-serif', a.nome)];
            if (a.nuovo) parti.push(' ', _scEl('span', 'stato-badge is-info', _scT('scan_new_badge', 'nuovo')));
            g.appendChild(_scRigaRiepilogo(a.pagine, ...parti));
        }
        elenco.appendChild(g);
    }

    const sempre = document.getElementById('scan-avviso-sempre') as HTMLInputElement;
    sempre.checked = false;
    sempre.closest('label')?.classList.toggle('hidden-tab', !drive.qui.length);
    const si = document.getElementById('scan-avviso-si');
    const no = document.getElementById('scan-avviso-no');
    si.textContent = drive.qui.length ? _scT('scan_import_now', 'Importa ora') : _scT('scan_check_show', 'Mostra');
    modal.classList.remove('hidden-tab');
    si.focus();
    return new Promise(resolve => {
        const chiudi = (importa) => {
            modal.classList.add('hidden-tab');
            si.onclick = no.onclick = null;
            resolve({ importa, sempre: importa && sempre.checked });
        };
        si.onclick = () => chiudi(true);
        no.onclick = () => chiudi(false);
    });
}

window.controllaScansioniAllApertura = async function() {
    if (navigator.onLine === false) return;
    const drive = await _scControllaDrive(false);
    if (!drive || !drive.collegato) return;
    const nuovi = drive.altri.filter(a => a.nuovo);
    if (!drive.qui.length && !nuovi.length) return;
    let s: any = {};
    try {
        s = await window.apiSettings.get();
    } catch (e) {
        console.warn('[scanner] impostazioni non lette:', e);
    }
    if (drive.qui.length && s.scannerImportaSempre === true) {
        window.apriScansioni();
        return;
    }
    const impronta = [...drive.qui.map(l => l.id), ...nuovi.map(a => '+' + a.nome)].sort().join('|').slice(0, 8000);
    if (s.scannerRimandato === impronta) return;
    const esito = await _scAvviso(drive);
    try {
        await window.apiSettings.patch(esito.sempre ? { scannerImportaSempre: true } : esito.importa ? {} : { scannerRimandato: impronta });
    } catch (e) {
        console.warn('[scanner] scelta dell\'avviso non salvata:', e);
    }
    if (esito.importa) window.apriScansioni();
};

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('scanner-modal')) return;
        const html = `
    <div id="scanner-modal" class="modal-overlay scan-overlay hidden-tab">
        <aside class="modal-window scan-laterale" role="dialog" aria-modal="false" aria-labelledby="scan-titolo">
            <div class="modal-header scan-testa">
                <div class="scan-testa-riga">
                    <h3 id="scan-titolo" class="modal-title">
                        <i data-lucide="smartphone" class="w-5 h-5"></i>
                        <span data-i18n="scan_title">Dal telefono</span>
                    </h3>
                    <button type="button" id="scan-chiudi" data-on-click="chiudiScansioni" data-modal-cancel class="btn btn-ghost btn-icon" data-i18n-title="btn_close" data-i18n-aria-label="btn_close" title="Chiudi" aria-label="Chiudi">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
                <p class="scan-drive">
                    <span id="scan-drive-testo"></span>
                    <button type="button" id="scan-ricevi" data-on-click="riceviScansioni" class="scan-link"><span id="scan-ricevi-label" data-i18n="scan_receive">Ricevi da Drive</span></button>
                </p>
                <p id="scan-stato" class="scan-stato" aria-live="polite"></p>
            </div>
            <div class="modal-body scan-corpo">
                <section id="scan-importate" class="scan-sezione hidden-tab" aria-labelledby="scan-importate-titolo">
                    <h4 id="scan-importate-titolo" class="scan-sezione-titolo" data-i18n="scan_imported_title">Importate ora</h4>
                    <ul id="scan-importate-lista" class="scan-righe"></ul>
                </section>
                <section class="scan-sezione" aria-labelledby="scan-da-smistare-titolo">
                    <h4 id="scan-da-smistare-titolo" class="scan-sezione-titolo" data-i18n="scan_to_sort_title">Da smistare</h4>
                    <div id="scan-lista" class="scan-lista"></div>
                </section>
                <section id="scan-altri" class="scan-sezione hidden-tab" aria-labelledby="scan-altri-titolo">
                    <h4 id="scan-altri-titolo" class="scan-sezione-titolo" data-i18n="scan_other_title">Per altri archivi · restano su Drive</h4>
                    <ul id="scan-altri-lista" class="scan-righe"></ul>
                </section>
                <div id="scan-wifi-box" class="scan-wifi hidden-tab">
                    <div id="scan-wifi-qr"></div>
                    <p id="scan-wifi-info" class="text-xs leading-relaxed"></p>
                </div>
            </div>
            <div class="modal-footer-bar scan-piede">
                <button type="button" id="scan-wifi" data-on-click="attivaWifiScansioni" class="scan-link">
                    <i data-lucide="wifi" class="w-4 h-4"></i>
                    <span id="scan-wifi-label" data-i18n="scan_wifi">Ricevi via Wi-Fi, senza Drive…</span>
                </button>
            </div>
        </aside>
    </div>
    <div id="scan-avviso" class="modal-overlay hidden-tab" role="dialog" aria-modal="true" aria-labelledby="scan-avviso-titolo" aria-describedby="scan-avviso-testo">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 id="scan-avviso-titolo" class="modal-title">
                    <i data-lucide="smartphone" class="w-5 h-5"></i>
                    <span data-i18n="scan_check_title">Scansioni dal telefono</span>
                </h3>
            </div>
            <div class="modal-body">
                <p id="scan-avviso-testo" class="text-sm leading-relaxed"></p>
                <div id="scan-avviso-elenco" class="scan-riepilogo"></div>
                <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" id="scan-avviso-sempre">
                    <span data-i18n="scan_check_always">Non chiedere: importa sempre da solo all'apertura</span>
                </label>
                <div class="modal-footer">
                    <button type="button" id="scan-avviso-no" data-modal-cancel class="btn btn-ghost">
                        <span data-i18n="scan_later">Più tardi</span>
                    </button>
                    <button type="button" id="scan-avviso-si" class="btn btn-primary"></button>
                </div>
            </div>
        </div>
    </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.apiScanner && window.apiScanner.onProgress) {
            window.apiScanner.onProgress((e) => {
                if (!e) return;
                _scStato(_scT('scan_progress', 'Scarico {var1}/{var2} pagine…').replace('{var1}', String(e.fatte)).replace('{var2}', String(e.totali)));
            });
        }
        if (window.apiScanner && window.apiScanner.onLottoWifi) {
            window.apiScanner.onLottoWifi(() => {
                _scStato(_scT('scan_wifi_received', 'Pagine ricevute via Wi-Fi.'));
                window.disegnaScansioni();
            });
        }
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('scanner-modal'), document.getElementById('scan-avviso')] });
    });
})();
