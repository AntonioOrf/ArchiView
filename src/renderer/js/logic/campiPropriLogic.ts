// @ts-nocheck

// Fase 3.7 — campi propri della scheda.
//
// Le DEFINIZIONI in composizione stanno nel campo nascosto `#form-campi-propri`, come gli
// allegati e i collegamenti: una scheda nuova non ha ancora un id quando l'utente aggiunge
// il primo campo, quindi non c'è nessun record su cui scriverle. Il record lo tocca solo
// `handleFormSubmit`, che è l'unico punto in cui il form scrive nell'archivio.
//
// I VALORI restano dove stanno tutti gli altri: nei controlli generati da
// `renderDynamicFields`. Qui non si legge e non si scrive un solo valore.

/** Le definizioni proprie in composizione nel form, sempre un array. */
function campiPropriForm() {
    const el = document.getElementById('form-campi-propri');
    if (!el) return [];
    try {
        return window.Model.campiPropri({ campiPropri: JSON.parse(el.value || '[]') });
    } catch (err) {
        // Un campo nascosto illeggibile non deve impedire di salvare la scheda: si perdono
        // le definizioni aggiunte in questa sessione, non il lavoro dell'utente.
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

/** Il tipo documento scelto nel form, cioè la base su cui i campi propri si aggiungono. */
function _tipoDelForm() {
    const sel = document.getElementById('form-tipo-documento');
    const id = sel ? sel.value : '';
    return (appData.tipiDocumento || []).find(t => t.id === id) || (appData.tipiDocumento || [])[0] || null;
}

/**
 * Ridisegna i campi dinamici SENZA perdere ciò che l'utente ha già scritto.
 *
 * `renderDynamicFields` azzera il contenitore: chiamarla dopo aver aggiunto un campo
 * svuoterebbe la scheda a metà compilazione. I valori si rileggono prima e si rimettono
 * dopo, con le stesse due funzioni che usano salvataggio e apertura in modifica — un terzo
 * modo di leggere il form divergerebbe al primo tipo di campo nuovo.
 */
function _ridisegnaConservandoValori() {
    const valori = window.leggiCampiDinamici(window.campiDefinitiDelForm());
    window.renderDynamicFields();
    window.popolaCampiDinamici(window.campiDefinitiDelForm(), valori);
}
// Lo usa anche il riordino (3.8): due copie divergerebbero al primo tipo di campo nuovo.
window.ridisegnaCampiConservandoValori = _ridisegnaConservandoValori;

// --- Modale -------------------------------------------------------------------

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

    // I nomi già usati altrove nell'archivio: senza, "Filigrana", "filigrana" e "Filigrane"
    // diventano tre campi diversi e la ricerca non li vede come uno.
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

/** Le righe che riguardano solo certi tipi: mostrarle sempre sarebbe un campo inerte. */
window.aggiornaCampoProprio = function() {
    const tipo = document.getElementById('campo-proprio-tipo').value;
    const vocabolario = document.getElementById('campo-proprio-vocabolario').value;
    document.getElementById('campo-proprio-vocabolario-riga').classList.toggle('hidden', tipo !== 'enum');
    // Le due fonti dei valori si escludono, come nell'editor dei campi del tipo (3.1).
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
    // L'id è anche una chiave del record e un'intestazione di colonna nell'export: la
    // ripulitura è quella dell'import (`idCampoNuovo`), che vieta le chiavi di servizio e
    // conserva la leggibilità ("Numero di carte", non "numerodicarte").
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

    const def = { id, tipo, label: id };
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

// --- Togliere e promuovere ----------------------------------------------------

window.rimuoviCampoProprio = function(id) {
    const def = campiPropriForm().find(d => d.id === id);
    if (!def) return;
    const togli = () => {
        scriviCampiPropriForm(campiPropriForm().filter(d => d.id !== id));
        // Il valore se ne va con il campo: lasciarlo nel record sarebbe una chiave orfana,
        // invisibile nel form ma ancora presente in export e stampa. La cancellazione vera
        // nel record la esegue `handleFormSubmit`, confrontando con le definizioni di prima.
        _ridisegnaConservandoValori();
        window.isFormDirty = true;
    };
    const testo = window.t('own_field_remove_confirm', 'Togliere il campo "{var0}" da questa scheda? Anche il suo valore verrà cancellato.')
        .replace('{var0}', String(def.label || id));
    window.mostraBottomConfirm(testo, togli, 'delete_own_field');
};

/**
 * Il campo proprio diventa un campo del MODELLO: da qui in poi vale per tutte le schede di
 * quel tipo. È il ponte fra "campo di questa scheda" e "campo del modello" — senza, l'utente
 * ricrea a mano lo stesso campo su ogni scheda e nasce un archivio con tre grafie della
 * stessa cosa.
 *
 * ⚠️ Il valore NON si tocca: è già una chiave del record con quell'id, e dopo la promozione
 * è semplicemente il valore di un campo del tipo. La definizione propria sparisce da sé alla
 * prima riscrittura della scheda (`Model.scriviCampiPropri` toglie ciò che il tipo dichiara).
 */
window.promuoviCampoProprio = async function(id) {
    const def = campiPropriForm().find(d => d.id === id);
    const tipo = _tipoDelForm();
    if (!def || !tipo) return;
    if ((tipo.campi || []).indexOf(id) !== -1) return;

    const definizioniTipo = window.Model.campiDelTipo(tipo, window.CONFIG_CAMPI, appData).concat([def]);
    window.Model.impostaCampi(tipo, definizioniTipo);
    scriviCampiPropriForm(campiPropriForm().filter(d => d.id !== id));

    try {
        if (window.Store) await window.Store.commit();
        else if (typeof salvaTutto === 'function') await salvaTutto();
    } catch (err) {
        console.error('Promozione del campo al modello non salvata:', err);
    }
    _ridisegnaConservandoValori();
    mostraMessaggio(window.t('own_field_promoted', 'Campo "{var0}" aggiunto al modello.').replace('{var0}', String(def.label || id)), 'success');
};

/**
 * I nomi dei campi propri già usati in archivio, per l'autocompletamento.
 * Sono le etichette, non gli id: è ciò che l'utente ha scritto, e per un campo proprio i due
 * coincidono salvo la ripulitura.
 */
window.nomiCampiPropriUsati = function() {
    return window.campiPropriArchivio().map(d => d.label || d.id);
};

/** Le definizioni proprie usate in archivio, una per id. Le legge anche l'import (2.4). */
window.campiPropriArchivio = function() {
    const perId = new Map();
    for (const m of (appData.manoscritti || [])) {
        for (const d of window.Model.campiPropri(m)) if (!perId.has(d.id)) perId.set(d.id, d);
    }
    return Array.from(perId.values()).sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id)));
};
