function _chiaveUltimoTipo() {
    return 'ultimoTipoDocumento:' + (window.percorsoWorkspace || '');
}

function leggiUltimoTipoDocumento() {
    try {
        return localStorage.getItem(_chiaveUltimoTipo()) || null;
    } catch (e) {
        return null;
    }
}

window.salvaUltimoTipoDocumento = function(tipoId) {
    if (!tipoId) return;
    try {
        localStorage.setItem(_chiaveUltimoTipo(), tipoId);
    } catch (e) {}
};

function applicaUltimoTipoDocumento() {
    const select = document.getElementById('form-tipo-documento');
    if (!select) return false;
    const ultimo = leggiUltimoTipoDocumento();
    if (!ultimo || select.value === ultimo) return false;
    if (!appData.tipiDocumento.some(t => t.id === ultimo)) return false;
    select.value = ultimo;
    return true;
}

function aggiornaSelectTipiDocumento() {
    const select = document.getElementById('form-tipo-documento');
    if (!select) return;
    if (!select.dataset.memoriaTipo) {
        select.dataset.memoriaTipo = '1';
        select.addEventListener('change', () => window.salvaUltimoTipoDocumento(select.value));
    }
    select.innerHTML = '';
    appData.tipiDocumento.forEach(tipo => {
        const opt = document.createElement('option');
        opt.value = tipo.id;
        const tNome = window.t('model_' + tipo.id);
        opt.textContent = tNome !== 'model_' + tipo.id ? tNome : tipo.nome;
        select.appendChild(opt);
    });
    if (appData.tipiDocumento.length > 0) {
        if (!document.getElementById('form-id').value) applicaUltimoTipoDocumento();
        renderDynamicFields();
    }
}

function campiDefinitiDelTipo(tipo) {
    return window.Model.campiDelTipo(tipo, CONFIG_CAMPI, appData);
}
window.campiDefinitiDelTipo = campiDefinitiDelTipo;

function campiDefinitiDelForm() {
    const tipoId = document.getElementById('form-tipo-documento').value;
    const tipo = appData.tipiDocumento.find(t => t.id === tipoId) || appData.tipiDocumento[0];
    const propri = window.campiPropriForm ? window.campiPropriForm() : [];
    const ordine = window.ordineCampiForm ? window.ordineCampiForm() : [];
    return window.Model.campiDellaScheda({ campiPropri: propri, ordineCampi: ordine }, tipo, CONFIG_CAMPI, appData);
}
window.campiDefinitiDelForm = campiDefinitiDelForm;

function _idCampiPropriForm() {
    return new Set((window.campiPropriForm ? window.campiPropriForm() : []).map(d => d.id));
}

window.focusCampoDinamico = function(campoId) {
    const el = document.getElementById(idControlloCampo(campoId));
    if (el && el.focus) el.focus();
    else document.getElementById('container-' + campoId)?.querySelector('input')?.focus();
};

function idControlloCampo(campoId) {
    return 'dyn-' + String(campoId).replace(/\s+/g, '_');
}
window.idControlloCampo = idControlloCampo;

function collegaEtichettaCampo(gruppo, label, campoId, def) {
    const idCtrl = idControlloCampo(campoId);
    const idTesto = 'lbl-' + idCtrl;
    const testo = label.firstChild;
    if (testo && testo.nodeType === Node.TEXT_NODE) {
        const span = document.createElement('span');
        span.id = idTesto;
        span.textContent = testo.textContent;
        label.replaceChild(span, testo);
    }
    const controllo = gruppo.querySelector('#' + CSS.escape(idCtrl));
    if (controllo) {
        label.htmlFor = idCtrl;
        controllo.setAttribute('aria-labelledby', idTesto);
        if (def.obbligatorio) controllo.setAttribute('aria-required', 'true');
        return;
    }
    const lista = gruppo.querySelector('.dynamic-list-container');
    if (lista) {
        lista.setAttribute('role', 'group');
        lista.setAttribute('aria-labelledby', idTesto);
    }
}

function _togliDaDescrittori(el, id) {
    const resto = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(x => x && x !== id);
    if (resto.length) el.setAttribute('aria-describedby', resto.join(' '));
    else el.removeAttribute('aria-describedby');
}

window.segnalaErroreCampo = function(campoId, messaggio) {
    const el = document.getElementById(idControlloCampo(campoId));
    if (!el) return null;
    const idMsg = el.id + '-errore';
    let msg = document.getElementById(idMsg);
    if (!msg) {
        msg = document.createElement('p');
        msg.id = idMsg;
        msg.className = 'campo-errore';
        (el.closest('.form-group') || el.parentElement).appendChild(msg);
    }
    msg.replaceChildren();
    const icona = document.createElement('i');
    icona.setAttribute('data-lucide', 'alert-circle');
    icona.className = 'w-3.5 h-3.5 shrink-0';
    const testo = document.createElement('span');
    testo.textContent = messaggio;
    msg.append(icona, testo);
    if (window.lucide) lucide.createIcons({ nodes: [msg] });

    el.setAttribute('aria-invalid', 'true');
    const descr = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!descr.includes(idMsg)) el.setAttribute('aria-describedby', descr.concat(idMsg).join(' '));

    const pulisci = () => {
        el.removeAttribute('aria-invalid');
        _togliDaDescrittori(el, idMsg);
        msg.remove();
        el.removeEventListener('input', pulisci);
        el.removeEventListener('change', pulisci);
    };
    el.addEventListener('input', pulisci);
    el.addEventListener('change', pulisci);
    return el;
};

window.pulisciErroriCampi = function() {
    const form = document.getElementById('manoscritto-form');
    if (!form) return;
    form.querySelectorAll('.campo-errore').forEach(m => {
        const el = document.getElementById(m.id.replace(/-errore$/, ''));
        if (el) { el.removeAttribute('aria-invalid'); _togliDaDescrittori(el, m.id); }
        m.remove();
    });
};

function leggiCampiDinamici(definizioni) {
    const valori = {};
    (definizioni || []).forEach(def => {
        const campoId = def.id;
        if (def.tipo === 'dynamic_list') {
            const rows = document.querySelectorAll('#container-' + campoId + ' .dynamic-list-row');
            const items = [];
            rows.forEach(row => {
                const k = row.querySelector('.list-key').value.trim();
                const v = row.querySelector('.list-val').value.trim();
                if (k || v) items.push({ k, v });
            });
            valori[campoId] = items;
            return;
        }
        const el = document.getElementById(idControlloCampo(campoId));
        if (!el) return;
        valori[campoId] = window.Model.normalizzaValore(def, def.tipo === 'boolean' ? el.checked : el.value);
    });
    return valori;
}
window.leggiCampiDinamici = leggiCampiDinamici;

function popolaCampiDinamici(definizioni, valori) {
    const m = valori || {};
    (definizioni || []).forEach(def => {
        const campoId = def.id;
        const conf = CONFIG_CAMPI[campoId] || {};
        if (def.tipo === 'dynamic_list') {
            const items = m[campoId] || [];
            const contenitore = document.getElementById('container-' + campoId);
            if (contenitore) contenitore.innerHTML = '';
            if (items.length > 0) {
                items.forEach(item => window.aggiungiElementoDinamico(campoId, conf.keyPlaceholder, conf.valPlaceholder, item.k || item.ruolo || '', item.v || item.nome || ''));
            } else {
                window.aggiungiElementoDinamico(campoId, conf.keyPlaceholder, conf.valPlaceholder, '', '');
            }
            return;
        }
        const el = document.getElementById(idControlloCampo(campoId));
        if (!el) return;
        if (def.tipo === 'boolean') el.checked = m[campoId] === true || m[campoId] === 'true';
        else if (def.tipo === 'number') el.value = (m[campoId] === 0 ? '0' : (m[campoId] || ''));
        else el.value = m[campoId] || '';
        if (def.tipo === 'date' && typeof window.aggiornaRiscontroData === 'function') {
            window.aggiornaRiscontroData(el.id);
        }
        if (def.tipo === 'enum' && m[campoId] && el.value !== String(m[campoId])) {
            const opt = document.createElement('option');
            opt.value = String(m[campoId]);
            opt.textContent = String(m[campoId]) + ' (' + window.t('field_value_removed', 'valore non più previsto') + ')';
            el.appendChild(opt);
            el.value = String(m[campoId]);
        }
    });
}
window.popolaCampiDinamici = popolaCampiDinamici;

let _valoriCompilazione = {};
let _defsDisegnate = [];
window.azzeraMemoriaCompilazione = function() { _valoriCompilazione = {}; };

window.cambiaTipoDocumentoForm = function() {
    Object.assign(_valoriCompilazione, leggiCampiDinamici(_defsDisegnate));
    renderDynamicFields();
    const defs = campiDefinitiDelForm().filter(d => Object.prototype.hasOwnProperty.call(_valoriCompilazione, d.id));
    popolaCampiDinamici(defs, _valoriCompilazione);
};

function renderDynamicFields() {
    const tipoId = document.getElementById('form-tipo-documento').value;
    const tipo = appData.tipiDocumento.find(t => t.id === tipoId) || appData.tipiDocumento[0];
    const container = document.getElementById('form-dynamic-fields');
    if (!container) return;
    container.innerHTML = '';

    const propri = _idCampiPropriForm();
    _defsDisegnate = campiDefinitiDelForm();
    _defsDisegnate.forEach(def => {
        const campoId = def.id;
        const conf = CONFIG_CAMPI[campoId] || { label: campoId, placeholder: '', type: def.tipo };
        const proprio = propri.has(campoId);

        const div = document.createElement('div');
        div.className = 'form-group';
        if (proprio) div.classList.add('campo-proprio');
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = window.t('field_' + campoId) !== 'field_' + campoId ? window.t('field_' + campoId) : (def.label || conf.label);
        if (def.obbligatorio) {
            const ast = document.createElement('span');
            ast.className = 'text-red-600 ml-1';
            ast.textContent = '*';
            ast.title = window.t('field_required', 'Campo obbligatorio');
            label.appendChild(ast);
        }

        if (proprio) {
            const segno = document.createElement('span');
            segno.className = 'campo-proprio-segno';
            segno.textContent = window.t('own_field_badge', 'solo qui');
            segno.title = window.t('own_field_badge_hint', 'Campo di questa scheda: il modello non cambia.');
            label.appendChild(segno);

            const su = document.createElement('button');
            su.type = 'button';
            su.className = 'campo-proprio-azione';
            su.title = window.t('own_field_promote', 'Aggiungi questo campo al modello');
            su.setAttribute('aria-label', su.title);
            su.innerHTML = '<i data-lucide="arrow-up-from-line" class="w-3.5 h-3.5"></i>';
            su.onclick = (e) => { e.preventDefault(); e.stopPropagation(); window.promuoviCampoProprio(campoId); };
            label.appendChild(su);

            const via = document.createElement('button');
            via.type = 'button';
            via.className = 'campo-proprio-azione';
            via.title = window.t('own_field_remove', 'Togli questo campo dalla scheda');
            via.setAttribute('aria-label', via.title);
            via.innerHTML = '<i data-lucide="x" class="w-3.5 h-3.5"></i>';
            via.onclick = (e) => { e.preventDefault(); e.stopPropagation(); window.rimuoviCampoProprio(campoId); };
            label.appendChild(via);
        }

        if (def.tipo === 'dynamic_list') {
            div.appendChild(label);
            const listContainer = document.createElement('div');
            listContainer.id = 'container-' + campoId;
            listContainer.className = 'space-y-2 mb-2 dynamic-list-container';
            div.appendChild(listContainer);
            
            const btnAdd = document.createElement('button');
            btnAdd.type = 'button';
            btnAdd.className = 'btn btn-secondary text-sm';
            const labelStr = window.t('field_' + campoId) !== 'field_' + campoId ? window.t('field_' + campoId) : conf.label;
            btnAdd.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i> ' + window.t('btn_add_dynamic') + ' ' + escapeHTML(labelStr);
            btnAdd.onclick = () => window.aggiungiElementoDinamico(campoId, conf.keyPlaceholder, conf.valPlaceholder, '', '');
            div.appendChild(btnAdd);
            
        } else if (def.tipo === 'boolean') {
            const riga = document.createElement('label');
            riga.className = 'flex items-center gap-2 cursor-pointer';
            const el = document.createElement('input');
            el.type = 'checkbox';
            el.id = idControlloCampo(campoId);
            el.className = 'w-4 h-4';
            el.style.accentColor = 'var(--color-primary)';
            label.className = 'form-label mb-0';
            riga.append(el, label);
            div.appendChild(riga);

        } else if (def.tipo === 'enum') {
            div.appendChild(label);
            const el = document.createElement('select');
            el.id = idControlloCampo(campoId);
            el.className = 'form-input';
            const vuota = document.createElement('option');
            vuota.value = '';
            vuota.textContent = def.obbligatorio ? window.t('field_choose', '— scegli —') : '';
            el.appendChild(vuota);
            for (const opzione of def.opzioni || []) {
                const opt = document.createElement('option');
                opt.value = opzione;
                opt.textContent = opzione;
                el.appendChild(opt);
            }

            if (def.vocabolario) {
                const riga = document.createElement('div');
                riga.className = 'flex gap-2 items-center';
                el.classList.add('flex-1', 'min-w-0');
                riga.appendChild(el);

                const piu = document.createElement('button');
                piu.type = 'button';
                piu.className = 'btn btn-secondary btn-icon shrink-0';
                piu.title = window.t('vocab_add_inline', 'Aggiungi un valore al vocabolario');
                piu.setAttribute('aria-label', piu.title);
                piu.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i>';
                piu.onclick = () => window.aggiungiValoreAlVolo(def.vocabolario, el.id);
                riga.appendChild(piu);
                div.appendChild(riga);
            } else {
                div.appendChild(el);
            }

        } else if (def.tipo === 'date') {
            div.appendChild(label);
            const el = document.createElement('input');
            el.type = 'text';
            el.id = idControlloCampo(campoId);
            el.className = 'form-input';
            const pStr = window.t('placeholder_' + campoId) !== 'placeholder_' + campoId ? window.t('placeholder_' + campoId) : (def.placeholder || conf.placeholder);
            el.placeholder = pStr || window.t('placeholder_data_storica', 'Es. 12 maggio 1340, c. 1340, sec. XIV in.');
            div.appendChild(el);

            const riscontro = document.createElement('p');
            riscontro.className = 'riscontro-data';
            riscontro.id = el.id + '-riscontro';
            div.appendChild(riscontro);
            const aggiorna = () => window.aggiornaRiscontroData(el.id);
            el.addEventListener('input', aggiorna);
            aggiorna();

        } else {
            div.appendChild(label);
            const el = document.createElement(def.tipo === 'textarea' ? 'textarea' : 'input') as HTMLInputElement & HTMLTextAreaElement;
            el.id = idControlloCampo(campoId);
            if (def.tipo === 'textarea') el.rows = 3;
            else if (def.tipo === 'number') {
                el.type = 'number';
                el.step = 'any';
            }
            else if (def.tipo === 'url') el.type = 'url';
            else el.type = 'text';
            el.className = 'form-input';
            const pStr = window.t('placeholder_' + campoId) !== 'placeholder_' + campoId ? window.t('placeholder_' + campoId) : (def.placeholder || conf.placeholder);
            el.placeholder = pStr || (def.tipo === 'url' ? 'https://…' : '');
            div.appendChild(el);
        }
        
        collegaEtichettaCampo(div, label, campoId, def);
        container.appendChild(div);
    });

    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

window.aggiornaRiscontroData = function(idControllo) {
    const el = document.getElementById(idControllo);
    const box = document.getElementById(idControllo + '-riscontro');
    if (!el || !box || !window.DataStorica) return;

    const testo = String(el.value || '').trim();
    if (!testo) { box.textContent = ''; box.classList.remove('non-letta'); return; }

    const d = window.DataStorica.analizza(testo);
    if (!d.riconosciuta) {
        box.textContent = window.t('date_not_read', 'Datazione non interpretata: la scheda resterà in fondo agli ordinamenti cronologici.');
        box.classList.add('non-letta');
        return;
    }
    box.classList.remove('non-letta');
    if (d.da === null && d.a === null) {
        box.textContent = window.t('date_none', 'Senza data.');
        return;
    }
    const anno = (k) => (k === null ? '…' : String(window.DataStorica.annoDi(k)));
    const intervallo = (d.da !== null && d.a !== null && window.DataStorica.annoDi(d.da) === window.DataStorica.annoDi(d.a))
        ? anno(d.da)
        : anno(d.da) + '–' + anno(d.a);
    const etichette = {
        esatta: window.t('date_q_exact', 'data esatta'),
        anno: window.t('date_q_year', 'anno'),
        circa: window.t('date_q_circa', 'circa'),
        ante: window.t('date_q_ante', 'prima del'),
        post: window.t('date_q_post', 'dopo il'),
        intervallo: window.t('date_q_range', 'intervallo'),
        secolo: window.t('date_q_century', 'secolo')
    };
    box.textContent = window.t('date_read', 'Letta come: {var0} ({var1})')
        .replace('{var0}', intervallo)
        .replace('{var1}', etichette[d.qualificatore] || d.qualificatore);
};

window.aggiungiValoreAlVolo = function(vocabolarioId, idControllo) {
    const sel = document.getElementById(idControllo) as HTMLSelectElement;
    if (!sel || sel.parentElement.querySelector('input[type="text"]')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input flex-1 min-w-0';
    input.placeholder = window.t('vocab_new_value', 'Nuovo valore…');
    sel.parentElement.replaceChild(input, sel);
    input.focus();

    let chiuso = false;
    const fine = async (conferma) => {
        if (chiuso) return;
        chiuso = true;
        const valore = input.value.trim();
        input.parentElement.replaceChild(sel, input);
        if (!conferma || !valore) return;
        await window.aggiungiValoreVocabolario(vocabolarioId, valore);
        if (!Array.from(sel.options).some(o => o.value === valore)) {
            const opt = document.createElement('option');
            opt.value = valore;
            opt.textContent = valore;
            sel.appendChild(opt);
        }
        sel.value = valore;
    };
    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); fine(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fine(false); }
    };
    input.onblur = () => fine(true);
};

window.aggiungiElementoDinamico = function(campoId, placeholderKey, placeholderVal, valKey = '', valVal = '') {
    const listContainer = document.getElementById('container-' + campoId);
    if (!listContainer) return;
    
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center dynamic-list-row';
    
    const inputKey = document.createElement('input');
    inputKey.type = 'text';
    inputKey.className = 'form-input w-1/3 list-key';
    let pKey = window.t('placeholder_key_' + campoId);
    pKey = pKey !== 'placeholder_key_' + campoId ? pKey : placeholderKey;
    inputKey.placeholder = pKey || window.t("placeholder_key", "Key");
    inputKey.value = valKey;
    inputKey.style.width = '33.33%';

    const inputVal = document.createElement('input');
    inputVal.type = 'text';
    inputVal.className = 'form-input flex-1 list-val';
    let pVal = window.t('placeholder_val_' + campoId);
    pVal = pVal !== 'placeholder_val_' + campoId ? pVal : placeholderVal;
    inputVal.placeholder = pVal || window.t("placeholder_value", "Value");
    inputVal.value = valVal;
    inputVal.style.width = 'auto';
    
    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn btn-danger-ghost btn-icon';
    btnRemove.setAttribute('aria-label', window.t('tooltip_remove', 'Rimuovi'));
    btnRemove.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    btnRemove.onclick = () => row.remove();
    
    row.appendChild(inputKey);
    row.appendChild(inputVal);
    row.appendChild(btnRemove);
    
    listContainer.appendChild(row);
    if (window.lucide) lucide.createIcons({ nodes: [row] });
};

window.aggiungiAttoreDinamico = function(ruoloVal = 'Attore', nomeVal = '') {
    window.aggiungiElementoDinamico('attori_dinamici', 'Ruolo', 'Nome', ruoloVal, nomeVal);
};

function resetForm() {
    window.isFormDirty = false;
    document.getElementById('form-segnatura').value = '';
    document.getElementById('form-tags').value = '';
    document.getElementById('form-allegato').value = '';
    document.getElementById('form-id').value = '';

    const allegatiInput = document.getElementById('form-allegati');
    if (allegatiInput) allegatiInput.value = '[]';
    window.allegatiBaseForm = null;
    if (window.aggiornaDocumentoScheda) window.aggiornaDocumentoScheda();

    if (typeof window.caricaRelazioniForm === 'function') window.caricaRelazioniForm(null);
    if (typeof window.caricaRimandiEsterniForm === 'function') window.caricaRimandiEsterniForm(null);

    if (window.scriviCampiPropriForm) window.scriviCampiPropriForm([]);
    if (window.scriviOrdineCampiForm) window.scriviOrdineCampiForm([]);
    if (window.riordinoCampiAttivo && window.chiudiRiordinoCampi) window.chiudiRiordinoCampi(true);

    const allegatiList = document.getElementById('form-allegati-list');
    if (allegatiList) allegatiList.innerHTML = '';

    const newPreview = document.getElementById('form-allegati-new-preview');
    if (newPreview) newPreview.classList.add('hidden');
    window.pendingFilesToUpload = [];
    if (window.renderPendingFiles) window.renderPendingFiles();

    const dynContainer = document.getElementById('form-dynamic-fields');
    if (dynContainer) {
        dynContainer.querySelectorAll<HTMLInputElement>('input, textarea, select').forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
            else el.value = '';
        });
    }

    document.getElementById('form-cartella').value = window.cartellaAttuale;
    applicaUltimoTipoDocumento();
    window.azzeraMemoriaCompilazione();
    renderDynamicFields();
    document.getElementById('form-title').textContent = window.t('title_new_record', 'Compila Nuova Scheda');
    
    if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('btn-cancel-edit')] });
}

function _idxAllegatoForm(arg) {
    if (typeof arg === 'number') return arg;
    const row = arg && arg.closest ? arg.closest('.allegato-row') : null;
    return row ? parseInt(row.dataset.idx, 10) : -1;
}

window.rimuoviAllegatoForm = function(arg) {
    const index = _idxAllegatoForm(arg);
    if (index < 0) return;
    window.isFormDirty = true;
    let allegatiList = JSON.parse(document.getElementById('form-allegati').value || '[]');
    allegatiList.splice(index, 1);
    document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
    window.renderAllegatiForm(allegatiList);
}

window.spostaAllegatoForm = function(arg, direction) {
    const index = _idxAllegatoForm(arg);
    if (index < 0) return;
    let allegatiList = JSON.parse(document.getElementById('form-allegati').value || '[]');
    const target = index + direction;
    if (target < 0 || target >= allegatiList.length) return;
    [allegatiList[index], allegatiList[target]] = [allegatiList[target], allegatiList[index]];
    window.isFormDirty = true;
    document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
    window.renderAllegatiForm(allegatiList).then(() => {
        const container = document.getElementById('form-allegati-list');
        const rows = container ? container.querySelectorAll(':scope > div') : [];
        const moved = rows[target];
        if (moved) {
            const btn = moved.querySelector(`button[data-move="${direction > 0 ? 'down' : 'up'}"]`)
                || moved.querySelector('button[data-move]');
            if (btn) btn.focus();
        }
    });
}

window.rinominaAllegatoForm = function(arg) {
    const index = _idxAllegatoForm(arg);
    if (index < 0) return;
    let allegatiList = JSON.parse(document.getElementById('form-allegati').value || '[]');
    let nomeAttuale = allegatiList[index].originalName || '';

    window.apriRenameModal(nomeAttuale, (nuovoNome) => {
        window.isFormDirty = true;
        allegatiList[index].originalName = nuovoNome;
        document.getElementById('form-allegati').value = JSON.stringify(allegatiList);
        window.renderAllegatiForm(allegatiList);
    });
}

window.renderAllegatiForm = async function(allegatiList) {
    const container = document.getElementById('form-allegati-list');
    if (!container) return;
    container.innerHTML = '';

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < allegatiList.length; i++) {
        const al = allegatiList[i];
        const div = document.createElement('div');
        div.className = "allegato-row flex items-center justify-between p-2 bg-white border border-stone-300 rounded-sm shadow-sm gap-2 cursor-grab active:cursor-grabbing transition-transform";
        div.dataset.idx = String(i);

        div.draggable = true;
        div.ondragstart = (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', div.dataset.idx);
            setTimeout(() => div.classList.add('opacity-40'), 0);
            window._draggedAttachmentRow = div;
        };
        div.ondragend = () => {
            div.classList.remove('opacity-40');
            window._draggedAttachmentRow = null;
            container.querySelectorAll(':scope > div').forEach(p => p.style.transform = '');
        };
        div.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const dragged = window._draggedAttachmentRow;
            if (!dragged || dragged === div) return;
            const rect = div.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            div.style.transform = e.clientX < mid ? 'translateX(10px)' : 'translateX(-10px)';
        };
        div.ondragleave = () => div.style.transform = '';
        div.ondrop = (e) => {
            e.preventDefault();
            div.style.transform = '';
            const dragged = window._draggedAttachmentRow;
            if (!dragged || dragged === div) return;

            const rect = div.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            if (e.clientX > mid) div.after(dragged); else div.before(dragged);

            const rows = Array.prototype.slice.call(container.children);
            const currentList = JSON.parse(document.getElementById('form-allegati').value || '[]');
            const newList = rows.map(r => currentList[parseInt(r.dataset.idx, 10)]);
            rows.forEach((r, idx) => { r.dataset.idx = String(idx); });
            window.isFormDirty = true;
            document.getElementById('form-allegati').value = JSON.stringify(newList);
        };

        let content = '';
        if (al.tipo === 'pdf') {
            content = `
                <div class="flex items-center gap-2 truncate cursor-pointer hover:text-red-700 flex-1" ${window.azione('click', 'apriPdfInterno', String((al.nome) ?? ''))}>
                    <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-400 shrink-0"></i>
                    <i data-lucide="file-text" class="w-6 h-6 text-red-600 shrink-0"></i>
                    <span class="text-xs font-semibold truncate" title="${escapeHTML(al.originalName || al.nome)}">${escapeHTML(al.originalName || 'PDF')}</span>
                </div>
            `;
        } else {
            let src = '', srcPieno = '';
            if (window.apiBrowser) {
                src = window.srcAllegato(al, { lato: 160 });
                srcPieno = window.srcAllegato(al, { lato: 2000 });
            }
            content = `
                <div class="flex items-center gap-2 truncate cursor-pointer hover:opacity-80 flex-1" ${window.azione('click', 'apriModal', String((srcPieno) ?? ''), "img")}>
                    <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-400 shrink-0"></i>
                    <img src="${escapeHTML(src)}" alt="${escapeHTML(al.originalName || window.t('attachment_image', 'Immagine'))}" class="w-8 h-8 object-cover rounded-sm border border-stone-200 shrink-0">
                    <span class="text-xs font-semibold truncate" title="${escapeHTML(al.originalName || al.nome)}">${escapeHTML(al.originalName || window.t('attachment_image', 'Immagine'))}</span>
                </div>
            `;
        }

        div.innerHTML = `
            ${content}
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-move="up" data-on-click="spostaAllegatoForm" data-args-click="[{&quot;$&quot;:&quot;this&quot;},-1]" ${i === 0 ? 'disabled' : ''} class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="${escapeHTML(window.t('tooltip_move_up', 'Sposta su'))}" title="${escapeHTML(window.t('tooltip_move_up', 'Sposta su'))}">
                    <i data-lucide="chevron-up" class="w-4 h-4"></i>
                </button>
                <button type="button" data-move="down" data-on-click="spostaAllegatoForm" data-args-click="[{&quot;$&quot;:&quot;this&quot;},1]" ${i === allegatiList.length - 1 ? 'disabled' : ''} class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="${escapeHTML(window.t('tooltip_move_down', 'Sposta giù'))}" title="${escapeHTML(window.t('tooltip_move_down', 'Sposta giù'))}">
                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                </button>
                <button type="button" data-on-click="rinominaAllegatoForm" data-args-click="[{&quot;$&quot;:&quot;this&quot;}]" class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50" aria-label="${escapeHTML(window.t('tooltip_rename', 'Rinomina'))}" title="${escapeHTML(window.t('tooltip_rename', 'Rinomina'))}">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button type="button" data-on-click="rimuoviAllegatoForm" data-args-click="[{&quot;$&quot;:&quot;this&quot;}]" class="text-stone-400 hover:text-red-600 p-1 rounded hover:bg-red-50" aria-label="${escapeHTML(window.t('tooltip_remove', 'Rimuovi'))}" title="${escapeHTML(window.t('tooltip_remove', 'Rimuovi'))}">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        fragment.appendChild(div);
    }
    container.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

