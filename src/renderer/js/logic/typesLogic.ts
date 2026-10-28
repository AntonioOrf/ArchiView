let editingTypeId: any = null;

function sbloccaFormTipo() {
    const inputNome = document.getElementById('custom-type-name') as HTMLInputElement;
    if (inputNome) { inputNome.disabled = false; inputNome.title = ''; }
    document.querySelectorAll<HTMLInputElement>('.custom-type-field').forEach(cb => { cb.disabled = false; });
    const nota = document.getElementById('type-locked-note');
    if (nota) nota.classList.add('hidden');
}

function apriNewTypeModal() {
    editingTypeId = null;
    _lavoroPersonalizzato = null;
    _modelloPrecedente = null;
    sbloccaFormTipo();
    (document.getElementById('new-type-select') as HTMLInputElement).value = 'custom';
    (document.getElementById('new-type-select') as HTMLSelectElement).disabled = false;
    (document.getElementById('btn-salva-tipo') as HTMLInputElement).textContent = window.t("btn_create", "Create");
    (document.querySelector('#new-type-modal .modal-title') as HTMLElement).textContent = window.t("modal_create_type", "Create Document Type");
    document.getElementById('type-used-by')?.classList.add('hidden');
    applicaModello();
    (document.getElementById('new-type-modal') as HTMLInputElement).classList.remove('hidden-tab');
}

function chiudiNewTypeModal() {
    (document.getElementById('new-type-modal') as HTMLInputElement).classList.add('hidden-tab');
    editingTypeId = null;
}

function modelloPredefinito(id) {
    return window.Model.modelloPredefinito(id);
}

let _lavoroPersonalizzato: any = null;
let _modelloPrecedente: any = null;

function applicaModello() {
    const sel = (document.getElementById('new-type-select') as HTMLInputElement).value;
    const nameInput = document.getElementById('custom-type-name') as HTMLInputElement;
    const extraInput = document.getElementById('custom-type-extra-input');

    if (_modelloPrecedente === 'custom' && sel !== 'custom') {
        const pill = Array.from(document.querySelectorAll('.custom-field-item'));
        if (nameInput.value.trim() || pill.length) _lavoroPersonalizzato = { nome: nameInput.value, pill };
    }
    _modelloPrecedente = sel;
    
    nameInput.value = '';
    if (extraInput) extraInput.value = '';
    
    if (typeof window.chiudiEditorCampo === 'function') window.chiudiEditorCampo();
    document.querySelectorAll('.custom-field-item').forEach(el => el.remove());
    _aggiornaElencoCampi();

    document.querySelectorAll('.custom-type-field').forEach(cb => cb.checked = false);

    if (sel === 'custom' && _lavoroPersonalizzato) {
        const lista = document.getElementById('custom-fields-list') as HTMLInputElement;
        nameInput.value = _lavoroPersonalizzato.nome;
        for (const p of _lavoroPersonalizzato.pill) {
            lista.appendChild(p);
            const cb = document.querySelector(`.custom-type-field[value="${CSS.escape(p.dataset.val)}"]`);
            if (cb) cb.checked = true;
        }
        _aggiornaElencoCampi();
        _lavoroPersonalizzato = null;
        return;
    }

    if (sel !== 'custom') {
        const modello = modelloPredefinito(sel);
        if (!modello) return;
        const tNome = window.t('model_' + sel);
        nameInput.value = tNome !== 'model_' + sel ? tNome : modello.nome;
        modello.campi.forEach(campoId => {
            const cb = document.querySelector(`.custom-type-field[value="${CSS.escape(campoId)}"]`);
            if (cb) {
                cb.checked = true;
                aggiungiPill(campoId, cb.dataset.label || campoId, true);
            } else {
                aggiungiPill(campoId, campoId, false);
            }
        });
    }
}

function toggleCampoBase(cb) {
    if (cb.checked) {
        aggiungiPill(cb.value, cb.dataset.label || cb.value, true);
    } else {
        rimuoviPill(cb.value);
    }
}

function aggiungiCampoCustom() {
    const input = document.getElementById('custom-type-extra-input') as HTMLInputElement;
    if (!input.value.trim()) return;
    const esistenti = Array.from(document.querySelectorAll<HTMLElement>('.custom-field-item, .custom-type-field'))
        .map(el => ({ chiave: el.dataset.val || (el as HTMLInputElement).value }));
    const val = window.CsvImport.idCampoNuovo(input.value, esistenti);
    if (!val) {
        mostraMessaggio(window.t('type_field_bad_name', 'Nome non valido: è già un campo del modello o una chiave riservata della scheda.'), 'error');
        return;
    }
    aggiungiPill(val, val, false);
    input.value = '';
}

function _aggiornaElencoCampi() {
    const n = document.querySelectorAll('.custom-field-item').length;
    document.getElementById('empty-fields-placeholder')?.classList.toggle('hidden', n > 0);
    const conto = document.getElementById('modello-campi-conto');
    if (conto) conto.textContent = String(n);
    _disegnaAnteprimaScheda();
}

function _disegnaAnteprimaScheda() {
    const box = document.getElementById('scheda-anteprima-campi');
    if (!box) return;
    const pills = Array.from(document.querySelectorAll<HTMLElement>('.custom-field-item'));
    box.replaceChildren(...pills.map(pill => {
        const def = definizioneDaPillola(pill);
        const voc = def.vocabolario ? window.elencoVocabolari().find(v => v.id === def.vocabolario) : null;
        const riga = document.createElement('div');
        riga.className = 'scheda-anteprima-riga';
        const etichetta = document.createElement('span');
        etichetta.className = 'scheda-anteprima-etichetta';
        etichetta.textContent = pill.querySelector('.pill-nome')?.textContent || def.id;
        riga.append(etichetta, _controlloAnteprima(def.tipo, voc ? voc.valori : (def.opzioni || [])));
        return riga;
    }));
    document.getElementById('scheda-anteprima-vuota')?.classList.toggle('hidden', pills.length > 0);
    document.getElementById('scheda-anteprima-aiuto')?.classList.toggle('hidden', !document.querySelector('.custom-field-item.configurabile'));
}

function definizioneDaPillola(pill) {
    const def: Record<string, any> = { id: pill.dataset.val, tipo: pill.dataset.tipo || 'text' };
    if (pill.dataset.obbligatorio === '1') def.obbligatorio = true;
    if (pill.dataset.unico === '1') def.unico = true;
    if (pill.dataset.opzioni) {
        try { def.opzioni = JSON.parse(pill.dataset.opzioni); } catch (e) {}
    }
    if (pill.dataset.vocabolario) def.vocabolario = pill.dataset.vocabolario;
    if (pill.dataset.authority) def.authority = pill.dataset.authority;
    return def;
}

function scriviDefinizioneSuPillola(pill, def) {
    pill.dataset.tipo = def.tipo || 'text';
    if (def.obbligatorio) pill.dataset.obbligatorio = '1'; else delete pill.dataset.obbligatorio;
    if (def.unico) pill.dataset.unico = '1'; else delete pill.dataset.unico;
    if (def.opzioni && def.opzioni.length) pill.dataset.opzioni = JSON.stringify(def.opzioni);
    else delete pill.dataset.opzioni;
    if (def.vocabolario) pill.dataset.vocabolario = def.vocabolario; else delete pill.dataset.vocabolario;
    if (def.authority) pill.dataset.authority = def.authority; else delete pill.dataset.authority;
    const badge = pill.querySelector('.pill-tipo');
    if (badge) {
        badge.textContent = window.t('field_type_' + pill.dataset.tipo, pill.dataset.tipo);
        badge.title = def.obbligatorio ? window.t('field_required', 'Campo obbligatorio') : '';
    }
    pill.classList.toggle('campo-obbligatorio', !!def.obbligatorio);
}

function aggiungiPill(val, label, isBase, bloccato?) {
    const existing = Array.from(document.querySelectorAll('.custom-field-item')).map(el => el.dataset.val.toLowerCase());
    if (existing.includes(val.toLowerCase())) return;
    
    const list = document.getElementById('custom-fields-list') as HTMLInputElement;

    let finalLabel = label;
    if (window.t('field_' + val) !== 'field_' + val) {
        finalLabel = window.t('field_' + val);
    } else if (CONFIG_CAMPI[val]) {
        finalLabel = CONFIG_CAMPI[val].label;
    }

    const pill = document.createElement('div');
    pill.className = 'custom-field-item';
    pill.setAttribute('role', 'listitem');
    pill.dataset.val = val;
    pill.draggable = true;

    pill.ondragstart = (e) => {
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', val);
        setTimeout(() => pill.classList.add('in-volo'), 0);
        window._draggedPill = pill;
    };

    pill.ondragend = () => {
        pill.classList.remove('in-volo');
        window._draggedPill = null;
        _disegnaAnteprimaScheda();
    };

    pill.ondragover = (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const trascinata = window._draggedPill;
        if (!trascinata || trascinata === pill) return;
        const meta = pill.getBoundingClientRect().top + pill.offsetHeight / 2;
        list.insertBefore(trascinata, e.clientY < meta ? pill : pill.nextSibling);
    };

    pill.ondrop = (e) => e.preventDefault();

    const configurabile = !isBase && !CONFIG_CAMPI[val] && !bloccato;
    const titoloConfig = escapeHTML(window.t('field_configure', 'Configura il campo'));
    const btnConfig = configurabile
        ? `<button type="button" class="pill-config" title="${titoloConfig}" aria-label="${titoloConfig}: ${escapeHTML(finalLabel)}"><i data-lucide="settings-2" class="w-3.5 h-3.5"></i></button>`
        : '';
    const btnRimuoviHtml = bloccato
        ? `<i data-lucide="lock" class="pill-lucchetto w-3.5 h-3.5" aria-hidden="true"></i>`
        : `<button type="button" class="pill-rimuovi" aria-label="${escapeHTML(window.t('tooltip_remove', 'Rimuovi'))}: ${escapeHTML(finalLabel)}"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>`;
    if (bloccato) {
        pill.draggable = false;
        pill.classList.add('bloccato');
        pill.title = window.t('field_locked', 'Campo del modello predefinito: non si può togliere né cambiare.');
    }

    pill.innerHTML = window.sanitizeHTML(`
        <i data-lucide="grip-vertical" class="pill-maniglia w-3.5 h-3.5" aria-hidden="true"></i>
        <span class="pill-numero" aria-hidden="true"></span>
        <span class="pill-nome">${escapeHTML(finalLabel)}</span>
        <span class="pill-tipo"></span>
        ${btnConfig}
        ${btnRimuoviHtml}
    `);
    const btnRimuovi = pill.querySelector<HTMLElement>('.pill-rimuovi');
    if (btnRimuovi) btnRimuovi.onclick = () => rimuoviPillDalPulsante(btnRimuovi, val);
    const btnCfg = pill.querySelector<HTMLElement>('.pill-config');
    if (btnCfg) {
        btnCfg.onclick = () => window.apriEditorCampo(btnCfg);
        pill.classList.add('configurabile');
        pill.onclick = (e) => { if (!(e.target as HTMLElement).closest('button')) window.apriEditorCampo(btnCfg); };
    }
    if (!bloccato) {
        const segnaposto = pill.querySelector('.pill-tipo');
        for (const [delta, icona, chiave, testo] of [
            [-1, 'chevron-up', 'reorder_up', 'Sposta su'],
            [1, 'chevron-down', 'reorder_down', 'Sposta giù'],
        ] as Array<[number, string, string, string]>) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'pill-sposta';
            b.title = window.t(chiave, testo);
            b.setAttribute('aria-label', b.title + ': ' + finalLabel);
            b.innerHTML = '<i data-lucide="' + escapeHTML(icona) + '" class="w-3 h-3" aria-hidden="true"></i>';
            b.onclick = () => spostaPill(pill, delta, b, finalLabel);
            segnaposto?.before(b);
        }
    }
    scriviDefinizioneSuPillola(pill, window.Model.definizioneCampo(null, val, CONFIG_CAMPI));
    list.appendChild(pill);
    _aggiornaElencoCampi();
    if (window.lucide) lucide.createIcons({ nodes: [pill] });
    
    if (isBase) {
        const cb = document.querySelector(`.custom-type-field[value="${CSS.escape(val)}"]`);
        if (cb) cb.checked = true;
    }
}

function spostaPill(pill, delta, pulsante, etichetta) {
    const list = pill.parentElement;
    if (!list) return;
    const pills = Array.from(list.querySelectorAll('.custom-field-item')) as HTMLElement[];
    const j = pills.indexOf(pill) + delta;
    if (j < 0 || j >= pills.length) return;
    list.insertBefore(pill, delta < 0 ? pills[j] : pills[j].nextSibling);
    _disegnaAnteprimaScheda();
    pulsante.focus();
    if (window.annunciaA11y) {
        window.annunciaA11y(window.t('field_moved_pos', '{var0}: posizione {var1} di {var2}')
            .replace('{var0}', etichetta).replace('{var1}', String(j + 1)).replace('{var2}', String(pills.length)));
    }
}

function rimuoviPillDalPulsante(btn, val) {
    rimuoviPill(val, btn.closest('.custom-field-item'));
    const cb = document.querySelector(`.custom-type-field[value="${CSS.escape(val)}"]`);
    if (cb) cb.checked = false;
}

function rimuoviPill(val, pill = document.querySelector(`.custom-field-item[data-val="${CSS.escape(val)}"]`)) {
    if (pill && pill === _pillolaInModifica) window.chiudiEditorCampo();
    if (pill) pill.remove();
    _aggiornaElencoCampi();
}

let _pillolaInModifica: any = null;

window.apriEditorCampo = function(btn) {
    const pill = btn.closest('.custom-field-item');
    if (!pill) return;
    document.querySelectorAll('.custom-field-item.selezionato').forEach(p => p.classList.remove('selezionato'));
    pill.classList.add('selezionato');
    _pillolaInModifica = pill;
    const def = definizioneDaPillola(pill);

    const box = document.getElementById('campo-editor') as HTMLInputElement;
    const nome = pill.querySelector('.pill-nome')?.textContent || pill.dataset.val;
    (document.getElementById('campo-editor-nome') as HTMLElement).textContent = nome;
    (document.getElementById('campo-anteprima-etichetta') as HTMLElement).textContent = nome;
    const pills = Array.from(document.querySelectorAll('.custom-field-item'));
    (document.getElementById('campo-editor-posizione') as HTMLElement).textContent = window.t('type_field_position', 'posizione {var0} di {var1}')
        .replace('{var0}', String(pills.indexOf(pill) + 1)).replace('{var1}', String(pills.length));
    const sel = document.getElementById('campo-editor-tipo') as HTMLInputElement;
    sel.innerHTML = '';
    for (const tipo of window.Model.TIPI_CAMPO_SCEGLIBILI) {
        const opt = document.createElement('option');
        opt.value = tipo;
        opt.textContent = window.t('field_type_' + tipo, tipo);
        if (tipo === def.tipo) opt.selected = true;
        sel.appendChild(opt);
    }
    (document.getElementById('campo-editor-obbligatorio') as HTMLInputElement).checked = !!def.obbligatorio;
    (document.getElementById('campo-editor-unico') as HTMLInputElement).checked = !!def.unico;
    (document.getElementById('campo-editor-opzioni') as HTMLInputElement).value = (def.opzioni || []).join('\n');

    const selVoc = document.getElementById('campo-editor-vocabolario') as HTMLInputElement;
    selVoc.innerHTML = '';
    const propri = document.createElement('option');
    propri.value = '';
    propri.textContent = window.t('vocab_own_values', '— valori scritti qui sotto —');
    selVoc.appendChild(propri);
    for (const voc of window.elencoVocabolari()) {
        const opt = document.createElement('option');
        opt.value = voc.id;
        opt.textContent = voc.nome;
        if (voc.id === def.vocabolario) opt.selected = true;
        selVoc.appendChild(opt);
    }

    const selAuth = document.getElementById('campo-editor-authority') as HTMLInputElement;
    selAuth.innerHTML = '';
    for (const scelta of [''].concat(window.Model.TIPI_AUTHORITY)) {
        const opt = document.createElement('option');
        opt.value = scelta;
        opt.textContent = scelta ? window.t('auth_type_' + scelta, scelta) : window.t('auth_type_none', 'Nessuna');
        if (scelta === (def.authority || '')) opt.selected = true;
        selAuth.appendChild(opt);
    }

    aggiornaEditorCampo();
    box.classList.remove('hidden');
};

window.aggiornaEditorCampo = function() {
    const tipo = (document.getElementById('campo-editor-tipo') as HTMLInputElement).value;
    const vocabolario = (document.getElementById('campo-editor-vocabolario') as HTMLInputElement).value;
    (document.getElementById('campo-editor-vocabolario-riga') as HTMLInputElement).classList.toggle('hidden', tipo !== 'enum');
    (document.getElementById('campo-editor-opzioni-riga') as HTMLInputElement).classList.toggle('hidden', tipo !== 'enum' || !!vocabolario);
    const authUtile = tipo === 'text' || tipo === 'enum' || tipo === 'dynamic_list';
    (document.getElementById('campo-editor-authority-riga') as HTMLInputElement).classList.toggle('hidden', !authUtile);
    if (!authUtile) (document.getElementById('campo-editor-authority') as HTMLInputElement).value = '';
    const unicoUtile = tipo !== 'boolean' && tipo !== 'dynamic_list';
    (document.getElementById('campo-editor-unico-riga') as HTMLInputElement).classList.toggle('hidden', !unicoUtile);
    if (!unicoUtile) (document.getElementById('campo-editor-unico') as HTMLInputElement).checked = false;
    const voc = vocabolario ? window.elencoVocabolari().find(v => v.id === vocabolario) : null;
    const opzioni = voc ? voc.valori : (document.getElementById('campo-editor-opzioni') as HTMLInputElement).value
        .split('\n').map(o => o.trim()).filter(Boolean);
    _disegnaAnteprima(tipo, opzioni);
};

function _disegnaAnteprima(tipo: string, opzioni: string[]) {
    document.getElementById('campo-anteprima-controllo')?.replaceChildren(_controlloAnteprima(tipo, opzioni));
}

function _controlloAnteprima(tipo: string, opzioni: string[]): HTMLElement {
    if (tipo === 'dynamic_list') {
        const kv = document.createElement('div');
        kv.className = 'scheda-anteprima-kv';
        for (const [chiave, testo] of [['placeholder_key', 'Chiave'], ['placeholder_value', 'Valore']]) {
            const input = document.createElement('input');
            input.className = 'form-input';
            input.placeholder = window.t(chiave, testo);
            input.tabIndex = -1;
            kv.appendChild(input);
        }
        return kv;
    }
    let el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (tipo === 'textarea') {
        el = document.createElement('textarea');
        el.rows = 2;
    } else if (tipo === 'enum') {
        el = document.createElement('select');
        for (const o of opzioni.slice(0, 50)) el.add(new Option(String(o)));
    } else {
        el = document.createElement('input');
        el.type = tipo === 'boolean' ? 'checkbox' : tipo === 'number' ? 'number' : 'text';
        if (tipo === 'date') el.placeholder = window.t('type_preview_date', 'es. 12 marzo 1348');
        if (tipo === 'url') el.placeholder = 'https://';
    }
    if (tipo !== 'boolean') el.className = 'form-input' + (tipo === 'url' || tipo === 'number' ? '' : ' font-serif');
    el.tabIndex = -1;
    return el;
}

window.chiudiEditorCampo = function() {
    (document.getElementById('campo-editor') as HTMLInputElement).classList.add('hidden');
    document.querySelectorAll('.custom-field-item.selezionato').forEach(p => p.classList.remove('selezionato'));
    _pillolaInModifica = null;
};

window.confermaEditorCampo = function() {
    if (!_pillolaInModifica) return;
    const tipo = (document.getElementById('campo-editor-tipo') as HTMLInputElement).value;
    const vocabolario = tipo === 'enum' ? (document.getElementById('campo-editor-vocabolario') as HTMLInputElement).value : '';
    const opzioni = (document.getElementById('campo-editor-opzioni') as HTMLInputElement).value
        .split('\n').map(o => o.trim()).filter(Boolean);
    if (tipo === 'enum' && !vocabolario && opzioni.length === 0) {
        mostraMessaggio(window.t('msg_enum_no_options', 'Un elenco a scelta ha bisogno di almeno un valore.'), 'error');
        return;
    }
    scriviDefinizioneSuPillola(_pillolaInModifica, {
        tipo,
        obbligatorio: (document.getElementById('campo-editor-obbligatorio') as HTMLInputElement).checked,
        unico: (document.getElementById('campo-editor-unico') as HTMLInputElement).checked,
        opzioni: vocabolario ? [] : opzioni,
        vocabolario,
        authority: (document.getElementById('campo-editor-authority') as HTMLInputElement).value
    });
    window.chiudiEditorCampo();
    _disegnaAnteprimaScheda();
};

async function _salvaTipi() {
    try {
        await salvaTutto();
        return true;
    } catch (e) {
        console.error('Salvataggio del modello non riuscito:', e);
        mostraMessaggio(window.t('msg_type_save_failed', 'Il modello non è stato salvato: ') + (e && e.message ? e.message : String(e)), 'error');
        return false;
    }
}

async function confermaCreaTipo() {
    const nome = (document.getElementById('custom-type-name') as HTMLInputElement).value.trim();
    if (!nome) { 
        mostraMessaggio(window.t("msg_insert_type_name"), "error"); 
        return; 
    }
    
    const definizioni: any[] = [];
    document.querySelectorAll('.custom-field-item').forEach(pill => {
        definizioni.push(definizioneDaPillola(pill));
    });

    if (definizioni.length === 0) {
        mostraMessaggio(window.t("msg_add_one_field"), "error");
        return;
    }

    if (editingTypeId) {
        const index = appData.tipiDocumento.findIndex(t => t.id === editingTypeId);
        if (index !== -1) {
            appData.tipiDocumento[index].nome = nome;
            window.Model.impostaCampi(appData.tipiDocumento[index], definizioni);
            if (!(await _salvaTipi())) return;
            aggiornaSelectTipiDocumento();
            chiudiNewTypeModal();
            mostraMessaggio(window.t("msg_type_updated"), "success");
        }
    } else {
        const sel = (document.getElementById('new-type-select') as HTMLInputElement).value;
        const prefissoId = sel !== 'custom' ? sel : 'custom';
        const id = prefissoId + '_' + Date.now();
        
        appData.tipiDocumento.push(window.Model.impostaCampi({ id, nome }, definizioni));
        if (!(await _salvaTipi())) return;
        aggiornaSelectTipiDocumento();
        chiudiNewTypeModal();
        mostraMessaggio(window.t("msg_type_created"), "success");
    }
}

function apriManageTypesModal() {
    const listContainer = document.getElementById('manage-types-list') as HTMLInputElement;
    const defaultIds = ['imbreviature', 'atti', 'fiscali'];
    const t = window.t;

    const righe = appData.tipiDocumento.map(tipo => {
        const isDefault = defaultIds.includes(tipo.id);
        const schede = appData.manoscritti.filter(m => m.tipoDocumento === tipo.id).length;
        const campi = window.Model.campiDelTipo(tipo, CONFIG_CAMPI, appData).length;
        const nome = t('model_' + tipo.id) !== 'model_' + tipo.id ? t('model_' + tipo.id) : tipo.nome;
        const modifica = escapeHTML(t('btn_edit', 'Modifica') + ' ' + nome);
        const elimina = escapeHTML(t('tooltip_delete', 'Elimina') + ' ' + nome);
        const btnElimina = isDefault ? '' : `<button type="button" ${window.azione('click', 'eliminaTipoDocumento', String((tipo.id) ?? ''))} class="btn btn-danger-ghost btn-icon" title="${elimina}" aria-label="${elimina}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
        return `<tr>
            <td>${escapeHTML(nome)}${isDefault ? ` <span class="modello-suggerimento">· ${escapeHTML(t('type_badge_default', 'predefinito'))}</span>` : ''}</td>
            <td class="num">${campi}</td>
            <td class="num">${schede}</td>
            <td class="azioni"><button type="button" ${window.azione('click', 'modificaTipoDocumento', String((tipo.id) ?? ''))} class="btn btn-ghost btn-icon" title="${modifica}" aria-label="${modifica}"><i data-lucide="pencil" class="w-4 h-4"></i></button>${btnElimina}</td>
        </tr>`;
    }).join('');

    listContainer.innerHTML = window.sanitizeHTML(`<table class="tabella-modelli">
        <thead><tr>
            <th scope="col">${escapeHTML(t('types_col_model', 'Modello'))}</th>
            <th scope="col" class="num">${escapeHTML(t('types_col_fields', 'Campi'))}</th>
            <th scope="col" class="num">${escapeHTML(t('types_col_records', 'Schede'))}</th>
            <th scope="col"><span class="sr-only">${escapeHTML(t('types_col_actions', 'Azioni'))}</span></th>
        </tr></thead>
        <tbody>${righe}</tbody>
    </table>`);

    if (window.lucide) lucide.createIcons({ nodes: [listContainer] });
    (document.getElementById('manage-types-modal') as HTMLInputElement).classList.remove('hidden-tab');
}

function chiudiManageTypesModal() {
    (document.getElementById('manage-types-modal') as HTMLInputElement).classList.add('hidden-tab');
}

function nuovoModelloDaGestione() {
    chiudiManageTypesModal();
    apriNewTypeModal();
}

window.eliminaTipoDocumento = function(id) {
    const inUso = appData.manoscritti.some(m => m.tipoDocumento === id);
    if (inUso) {
        mostraMessaggio(window.t("msg_type_in_use"), "error");
        return;
    }
    
    window.mostraBottomConfirm(window.t("confirm_delete_model", "Sei sicuro di voler eliminare questo modello?"), async () => {
        const tipoSalvato = JSON.parse(JSON.stringify(appData.tipiDocumento.find(t => t.id === id)));
        
        appData.tipiDocumento = appData.tipiDocumento.filter(t => t.id !== id);
        appData.deletedTipi = [...new Set([...(appData.deletedTipi || []), id])];
        if (!(await _salvaTipi())) return;
        aggiornaSelectTipiDocumento();
        apriManageTypesModal();

        const ripristinaFn = async () => {
            appData.deletedTipi = (appData.deletedTipi || []).filter(x => x !== id);
            appData.tipiDocumento.push(tipoSalvato);
            if (!(await _salvaTipi())) return;
            aggiornaSelectTipiDocumento();
            apriManageTypesModal();
        };

        if (window.gestoreAnnullamento) {
            window.gestoreAnnullamento.registraAzione(window.t('undo_delete_type', "Eliminazione modello \"{var0}\"").replace('{var0}', tipoSalvato.nome), ripristinaFn);
            mostraMessaggio(window.t("msg_type_deleted"), "success", () => window.gestoreAnnullamento.annullaUltimaAzione());
        } else {
            mostraMessaggio(window.t("msg_type_deleted"), "success");
        }
    }, 'delete_type');
};

window.modificaTipoDocumento = function(id) {
    const tipo = appData.tipiDocumento.find(t => t.id === id);
    if (!tipo) return;
    
    chiudiManageTypesModal();
    
    editingTypeId = id;
    (document.getElementById('new-type-select') as HTMLInputElement).value = 'custom';
    (document.getElementById('new-type-select') as HTMLSelectElement).disabled = true;
    (document.getElementById('btn-salva-tipo') as HTMLInputElement).textContent = window.t("btn_save_changes", "Save Changes");
    (document.querySelector('#new-type-modal .modal-title') as HTMLElement).textContent = window.t("type_modal_edit_title", "Edit Document Type");

    sbloccaFormTipo();
    const predefinito = window.Model.modelloPredefinito(id);
    const campiBloccati = new Set(predefinito ? predefinito.campi : []);
    const inputNome = document.getElementById('custom-type-name') as HTMLInputElement;
    inputNome.disabled = !!predefinito;
    inputNome.title = predefinito ? window.t('type_name_locked', 'Il nome di un modello predefinito non si cambia: è tradotto insieme all\'applicazione.') : '';
    const nota = document.getElementById('type-locked-note');
    if (nota) nota.classList.toggle('hidden', !predefinito);
    const usatoDa = document.getElementById('type-used-by');
    if (usatoDa) {
        const n = appData.manoscritti.filter(m => m.tipoDocumento === id).length;
        usatoDa.textContent = window.t('type_used_by', 'Usato da {var0} schede · le modifiche valgono per tutte').replace('{var0}', String(n));
        usatoDa.classList.toggle('hidden', n === 0);
    }

    (document.getElementById('custom-type-name') as HTMLInputElement).value = tipo.nome;
    (document.getElementById('custom-type-extra-input') as HTMLInputElement).value = '';
    window.chiudiEditorCampo();
    document.querySelectorAll('.custom-field-item').forEach(el => el.remove());
    _aggiornaElencoCampi();
    document.querySelectorAll('.custom-type-field').forEach(cb => cb.checked = false);
    
    window.Model.campiDelTipo(tipo, CONFIG_CAMPI, appData).forEach(def => {
        const campoId = def.id;
        const bloccato = campiBloccati.has(campoId);
        const checkbox = document.querySelector<HTMLInputElement>(`.custom-type-field[value="${CSS.escape(campoId)}"]`);
        if (checkbox) {
            checkbox.checked = true;
            checkbox.disabled = bloccato;
            aggiungiPill(campoId, checkbox.dataset.label, false, bloccato);
        } else {
            let label = campoId;
            if (CONFIG_CAMPI[campoId]) {
                label = window.t('field_' + campoId) !== 'field_' + campoId ? window.t('field_' + campoId) : CONFIG_CAMPI[campoId].label;
            }
            aggiungiPill(campoId, label, false, bloccato);
        }
        const pill = document.querySelector(`.custom-field-item[data-val="${CSS.escape(campoId)}"]`);
        if (pill) scriviDefinizioneSuPillola(pill, def);
    });
    
    (document.getElementById('new-type-modal') as HTMLInputElement).classList.remove('hidden-tab');
};

