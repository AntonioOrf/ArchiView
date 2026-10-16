function campiPropriForm() {
    const el = document.getElementById('form-campi-propri');
    if (!el) return [];
    try {
        return window.Model.campiPropri({ campiPropri: JSON.parse(el.value || '[]') });
    } catch (err) {
        console.error('Campo campiPropri illeggibile, la scheda prosegue senza:', err);
        return [];
    }
}
window.campiPropriForm = campiPropriForm;

function scriviCampiPropriForm(definizioni) {
    const el = document.getElementById('form-campi-propri');
    if (!el) return;
    el.value = JSON.stringify(window.Model.campiPropri({ campiPropri: definizioni || [] }));
}
window.scriviCampiPropriForm = scriviCampiPropriForm;

function _tipoDelForm() {
    const sel = document.getElementById('form-tipo-documento');
    const id = sel ? sel.value : '';
    return (appData.tipiDocumento || []).find(t => t.id === id) || (appData.tipiDocumento || [])[0] || null;
}

function _ridisegnaConservandoValori() {
    const valori = window.leggiCampiDinamici(window.campiDefinitiDelForm());
    window.renderDynamicFields();
    window.popolaCampiDinamici(window.campiDefinitiDelForm(), valori);
}
window.ridisegnaCampiConservandoValori = _ridisegnaConservandoValori;

window.apriCampoProprioModal = function() {
    const modal = document.getElementById('campo-proprio-modal');
    if (!modal) return;

    document.getElementById('campo-proprio-nome').value = '';
    document.getElementById('campo-proprio-opzioni').value = '';

    const sel = document.getElementById('campo-proprio-tipo');
    sel.innerHTML = '';
    for (const tipo of window.Model.TIPI_CAMPO_SCEGLIBILI) {
        const opt = document.createElement('option');
        opt.value = tipo;
        opt.textContent = window.t('field_type_' + tipo, tipo);
        sel.appendChild(opt);
    }

    const selVoc = document.getElementById('campo-proprio-vocabolario');
    selVoc.innerHTML = '';
    const propri = document.createElement('option');
    propri.value = '';
    propri.textContent = window.t('vocab_own_values', '— valori scritti qui sotto —');
    selVoc.appendChild(propri);
    for (const voc of (window.elencoVocabolari ? window.elencoVocabolari() : [])) {
        const opt = document.createElement('option');
        opt.value = voc.id;
        opt.textContent = voc.nome;
        selVoc.appendChild(opt);
    }

    const selAuth = document.getElementById('campo-proprio-authority');
    selAuth.innerHTML = '';
    for (const scelta of [''].concat(window.Model.TIPI_AUTHORITY)) {
        const opt = document.createElement('option');
        opt.value = scelta;
        opt.textContent = scelta ? window.t('auth_type_' + scelta, scelta) : window.t('auth_type_none', 'Nessuna');
        selAuth.appendChild(opt);
    }

    const lista = document.getElementById('campo-proprio-suggerimenti');
    lista.innerHTML = '';
    for (const nome of window.nomiCampiPropriUsati()) {
        const opt = document.createElement('option');
        opt.value = nome;
        lista.appendChild(opt);
    }

    window.aggiornaCampoProprio();
    modal.classList.remove('hidden-tab');
    document.getElementById('campo-proprio-nome').focus();
};

window.chiudiCampoProprioModal = function() {
    const modal = document.getElementById('campo-proprio-modal');
    if (modal) modal.classList.add('hidden-tab');
};

window.aggiornaCampoProprio = function() {
    const tipo = document.getElementById('campo-proprio-tipo').value;
    const vocabolario = document.getElementById('campo-proprio-vocabolario').value;
    document.getElementById('campo-proprio-vocabolario-riga').classList.toggle('hidden', tipo !== 'enum');
    document.getElementById('campo-proprio-opzioni-riga').classList.toggle('hidden', tipo !== 'enum' || !!vocabolario);
    const authUtile = tipo === 'text' || tipo === 'enum' || tipo === 'dynamic_list';
    document.getElementById('campo-proprio-authority-riga').classList.toggle('hidden', !authUtile);
    if (!authUtile) document.getElementById('campo-proprio-authority').value = '';
};

window.confermaCampoProprio = function() {
    const tipo = document.getElementById('campo-proprio-tipo').value;
    const vocabolario = tipo === 'enum' ? document.getElementById('campo-proprio-vocabolario').value : '';
    const opzioni = document.getElementById('campo-proprio-opzioni').value
        .split('\n').map(o => o.trim()).filter(Boolean);

    const definizioni = campiPropriForm();
    const delTipo = window.Model.campiDelTipo(_tipoDelForm(), window.CONFIG_CAMPI, appData);
    const esistenti = delTipo.map(d => ({ chiave: d.id })).concat(definizioni.map(d => ({ chiave: d.id })));
    const id = window.CsvImport.idCampoNuovo(document.getElementById('campo-proprio-nome').value, esistenti);
    if (!id) {
        mostraMessaggio(window.t('own_field_bad_name', 'Nome non valido o già usato in questa scheda.'), 'error');
        return;
    }
    if (tipo === 'enum' && !vocabolario && opzioni.length === 0) {
        mostraMessaggio(window.t('msg_enum_no_options', 'Un elenco a scelta ha bisogno di almeno un valore.'), 'error');
        return;
    }

    const def: AVCampoDef = { id, tipo, label: id };
    if (vocabolario) def.vocabolario = vocabolario;
    else if (opzioni.length) def.opzioni = opzioni;
    const authority = document.getElementById('campo-proprio-authority').value;
    if (authority) def.authority = authority;

    scriviCampiPropriForm(definizioni.concat([def]));
    window.chiudiCampoProprioModal();
    _ridisegnaConservandoValori();
    window.isFormDirty = true;
    if (window.focusCampoDinamico) window.focusCampoDinamico(id);
};

window.rimuoviCampoProprio = function(id) {
    const def = campiPropriForm().find(d => d.id === id);
    if (!def) return;
    const togli = () => {
        scriviCampiPropriForm(campiPropriForm().filter(d => d.id !== id));
        _ridisegnaConservandoValori();
        window.isFormDirty = true;
    };
    const testo = window.t('own_field_remove_confirm', 'Togliere il campo "{var0}" da questa scheda? Anche il suo valore verrà cancellato.')
        .replace('{var0}', String(def.label || id));
    window.mostraBottomConfirm(testo, togli, 'delete_own_field');
};

window.promuoviCampoProprio = async function(id) {
    const def = campiPropriForm().find(d => d.id === id);
    const tipo = _tipoDelForm();
    if (!def || !tipo) return;
    if ((tipo.campi || []).indexOf(id) !== -1) return;

    const definizioniTipo = window.Model.campiDelTipo(tipo, window.CONFIG_CAMPI, appData).concat([def]);
    window.Model.impostaCampi(tipo, definizioniTipo);
    scriviCampiPropriForm(campiPropriForm().filter(d => d.id !== id));

    try {
        await window.Store.commit();
    } catch (err) {
        console.error('Promozione del campo al modello non salvata:', err);
    }
    _ridisegnaConservandoValori();
    mostraMessaggio(window.t('own_field_promoted', 'Campo "{var0}" aggiunto al modello.').replace('{var0}', String(def.label || id)), 'success');
};

window.nomiCampiPropriUsati = function() {
    return window.campiPropriArchivio().map(d => d.label || d.id);
};

window.campiPropriArchivio = function() {
    const perId = new Map();
    for (const m of (appData.manoscritti || [])) {
        for (const d of window.Model.campiPropri(m)) if (!perId.has(d.id)) perId.set(d.id, d);
    }
    return Array.from(perId.values()).sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id)));
};
