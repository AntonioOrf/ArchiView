// @ts-nocheck

let editingTypeId = null;

/**
 * Toglie i divieti lasciati dalla modifica di un modello predefinito. Vanno tolti
 * ESPLICITAMENTE: il modale è uno solo e vive nel DOM per tutta la sessione, quindi senza
 * questa ripulitura il nome resterebbe non scrivibile e metà delle caselle spente anche
 * aprendolo per creare un modello nuovo — un blocco senza più un motivo visibile.
 */
function sbloccaFormTipo() {
    const inputNome = document.getElementById('custom-type-name');
    if (inputNome) { inputNome.disabled = false; inputNome.title = ''; }
    document.querySelectorAll('.custom-type-field').forEach(cb => { cb.disabled = false; });
    const nota = document.getElementById('type-locked-note');
    if (nota) nota.classList.add('hidden');
}

function apriNewTypeModal() {
    editingTypeId = null;
    sbloccaFormTipo();
    document.getElementById('new-type-select').value = 'custom';
    document.getElementById('new-type-select').disabled = false;
    document.getElementById('btn-salva-tipo').textContent = window.t("btn_create", "Create");
    document.querySelector('#new-type-modal .modal-title').textContent = window.t("modal_create_type", "Create Document Type");
    applicaModello();
    document.getElementById('new-type-modal').classList.remove('hidden-tab');
}

function chiudiNewTypeModal() {
    document.getElementById('new-type-modal').classList.add('hidden-tab');
    editingTypeId = null;
}

// Fase 3.1 — i modelli predefiniti stanno in `shared/model.ts`. Qui c'era la terza copia
// dell'elenco: bastava aggiungere un campo a un modello e dimenticare questa perché il tipo
// creato dalla tendina avesse campi diversi dal tipo che l'app installa da sola, con lo
// stesso nome e senza alcun errore.
function modelloPredefinito(id) {
    return window.Model.modelloPredefinito(id);
}

function applicaModello() {
    const sel = document.getElementById('new-type-select').value;
    const nameInput = document.getElementById('custom-type-name');
    const extraInput = document.getElementById('custom-type-extra-input');
    const placeholder = document.getElementById('empty-fields-placeholder');
    
    // Pulisce il form
    nameInput.value = '';
    if (extraInput) extraInput.value = '';
    
    // Rimuove pillole
    if (typeof window.chiudiEditorCampo === 'function') window.chiudiEditorCampo();
    document.querySelectorAll('.custom-field-item').forEach(el => el.remove());
    if (placeholder) placeholder.classList.remove('hidden');

    document.querySelectorAll('.custom-type-field').forEach(cb => cb.checked = false);

    // Seleziona campi in base al modello
    if (sel !== 'custom') {
        const modello = modelloPredefinito(sel);
        if (!modello) return;
        const tNome = window.t('model_' + sel);
        nameInput.value = tNome !== 'model_' + sel ? tNome : modello.nome;
        modello.campi.forEach(campoId => {
            const cb = document.querySelector(`.custom-type-field[value="${campoId}"]`);
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
    const input = document.getElementById('custom-type-extra-input');
    const val = input.value.trim();
    if (val) {
        aggiungiPill(val, val, false);
        input.value = '';
    }
}

// --- Fase 3.1: la definizione del campo vive sulla pillola ---------------------
//
// La pillola è già l'oggetto che l'utente trascina, aggiunge e toglie: il tipo, l'obbligo e
// i valori dell'elenco stanno nei suoi `dataset`, e `confermaCreaTipo` li rilegge da lì.
// Una struttura parallela in memoria dovrebbe restare allineata a un DOM che l'utente
// riordina col mouse, ed è esattamente il genere di disallineamento che non dà errori.

/** Icona/sigla del tipo, mostrata sulla pillola: senza, il tipo si vede solo riaprendo. */
const SIGLE_TIPO = {
    text: 'Aa', textarea: '¶', number: '123', boolean: 'Sì/No',
    enum: '▾', url: '🔗', date: '📅', dynamic_list: '⋮⋮', attachments: '📎'
};

function definizioneDaPillola(pill) {
    const def = { id: pill.dataset.val, tipo: pill.dataset.tipo || 'text' };
    if (pill.dataset.obbligatorio === '1') def.obbligatorio = true;
    if (pill.dataset.unico === '1') def.unico = true;
    if (pill.dataset.opzioni) {
        try { def.opzioni = JSON.parse(pill.dataset.opzioni); } catch (e) { /* pillola manomessa: ignora */ }
    }
    // Fasi 3.3 e 3.5: il legame a un vocabolario d'archivio e la semantica d'anagrafica
    // viaggiano sulla pillola come tutto il resto — la pillola È la definizione finché il
    // tipo non viene salvato.
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
        badge.textContent = SIGLE_TIPO[pill.dataset.tipo] || pill.dataset.tipo;
        badge.title = window.t('field_type_' + pill.dataset.tipo, pill.dataset.tipo) +
            (def.obbligatorio ? ' • ' + window.t('field_required', 'Campo obbligatorio') : '');
    }
}

/**
 * @param bloccato campo d'origine di un modello predefinito: si vede ma non si tocca. Non è
 *                 pignoleria — `applicaModelliPredefiniti` rimette quei campi al loro posto a
 *                 ogni avvio, quindi togliere o riordinare una di queste pillole sarebbe una
 *                 modifica che si disfa da sola, cioè un comando che mente.
 */
function aggiungiPill(val, label, isBase, bloccato) {
    const existing = Array.from(document.querySelectorAll('.custom-field-item')).map(el => el.dataset.val.toLowerCase());
    if (existing.includes(val.toLowerCase())) return;
    
    const list = document.getElementById('custom-fields-list');
    const placeholder = document.getElementById('empty-fields-placeholder');
    if (placeholder) placeholder.classList.add('hidden');

    let finalLabel = label;
    if (window.t('field_' + val) !== 'field_' + val) {
        finalLabel = window.t('field_' + val);
    } else if (CONFIG_CAMPI[val]) {
        finalLabel = CONFIG_CAMPI[val].label;
    }

    const pill = document.createElement('div');
    pill.className = "custom-field-item flex items-center gap-1 px-2 py-1.5 bg-white border border-stone-300 text-stone-800 rounded-sm text-sm font-medium shadow-sm cursor-grab active:cursor-grabbing transition-transform";
    pill.dataset.val = val;
    pill.draggable = true;

    pill.ondragstart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', val);
        setTimeout(() => pill.classList.add('opacity-40'), 0);
        window._draggedPill = pill;
    };
    
    pill.ondragend = (e) => {
        pill.classList.remove('opacity-40');
        window._draggedPill = null;
        document.querySelectorAll('.custom-field-item').forEach(p => p.style.transform = '');
    };
    
    pill.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = pill.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        
        document.querySelectorAll('.custom-field-item').forEach(p => {
            if (p !== pill && p !== window._draggedPill) p.style.transform = '';
        });
        
        if (window._draggedPill && window._draggedPill !== pill) {
            pill.style.transform = e.clientX < mid ? 'translateX(10px)' : 'translateX(-10px)';
        }
    };
    
    pill.ondragleave = (e) => pill.style.transform = '';
    
    pill.ondrop = (e) => {
        e.preventDefault();
        pill.style.transform = '';
        if (window._draggedPill && window._draggedPill !== pill) {
            const rect = pill.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            if (e.clientX < mid) list.insertBefore(window._draggedPill, pill);
            else list.insertBefore(window._draggedPill, pill.nextSibling);
        }
    };

    // I campi BASE non sono tipizzabili dall'utente: il loro tipo appartiene ai modelli
    // predefiniti e alla i18n (`attori_dinamici` è una lista chiave-valore ovunque). Il
    // pulsante di configurazione compare quindi solo sui campi inventati qui.
    const configurabile = !isBase && !CONFIG_CAMPI[val] && !bloccato;
    const titoloConfig = escapeHTML(window.t('field_configure', 'Configura il campo'));
    const btnConfig = configurabile
        ? `<button type="button" class="pill-config text-stone-400 hover:text-amber-700 focus:outline-none ml-1 transition-colors" title="${titoloConfig}" aria-label="${titoloConfig}"><i data-lucide="settings-2" class="w-3 h-3"></i></button>`
        : '';
    const btnRimuoviHtml = bloccato
        ? `<i data-lucide="lock" class="w-3 h-3 text-stone-400 ml-1" aria-hidden="true"></i>`
        : `<button type="button" class="pill-rimuovi text-stone-400 hover:text-red-600 focus:outline-none ml-1 transition-colors" aria-label="${escapeHTML(window.t('tooltip_remove', 'Rimuovi'))}"><i data-lucide="x" class="w-3 h-3"></i></button>`;
    if (bloccato) {
        pill.draggable = false;
        pill.classList.remove('cursor-grab', 'active:cursor-grabbing');
        pill.title = window.t('field_locked', 'Campo del modello predefinito: non si può togliere né cambiare.');
    }

    // ⚠️ NIENTE `onclick` inline qui dentro: il markup passa da `sanitizeHTML` (DOMPurify),
    // che rimuove gli attributi di evento — la "X" di questa pillola era inerte da sempre,
    // e un campo aggiunto per errore non si poteva più togliere se non ricominciando.
    // Gli handler si agganciano dopo l'inserimento, sugli elementi veri.
    pill.innerHTML = window.sanitizeHTML(`
        <i data-lucide="grip-horizontal" class="w-3 h-3 text-stone-400 mr-1"></i>
        <span>${escapeHTML(finalLabel)}</span>
        <span class="pill-tipo"></span>
        ${btnConfig}
        ${btnRimuoviHtml}
    `);
    const btnRimuovi = pill.querySelector('.pill-rimuovi');
    if (btnRimuovi) btnRimuovi.onclick = () => rimuoviPillDalPulsante(btnRimuovi, val);
    const btnCfg = pill.querySelector('.pill-config');
    if (btnCfg) btnCfg.onclick = () => window.apriEditorCampo(btnCfg);
    // Il tipo di partenza: quello del campo base se esiste, altrimenti testo.
    scriviDefinizioneSuPillola(pill, window.Model.definizioneCampo(null, val, CONFIG_CAMPI));
    list.appendChild(pill);
    if (window.lucide) lucide.createIcons({ nodes: [pill] });
    
    if (isBase) {
        const cb = document.querySelector(`.custom-type-field[value="${val}"]`);
        if (cb) cb.checked = true;
    }
}

function rimuoviPillDalPulsante(btn, val) {
    btn.parentElement.remove();
    const cb = document.querySelector(`.custom-type-field[value="${val}"]`);
    if (cb) cb.checked = false;
    
    if (document.querySelectorAll('.custom-field-item').length === 0) {
        const placeholder = document.getElementById('empty-fields-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
    }
}

function rimuoviPill(val) {
    const pill = document.querySelector(`.custom-field-item[data-val="${val}"]`);
    if (pill) pill.remove();
    
    if (document.querySelectorAll('.custom-field-item').length === 0) {
        const placeholder = document.getElementById('empty-fields-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
    }
}

// --- Editor di un singolo campo (Fase 3.1) ------------------------------------

let _pillolaInModifica = null;

window.apriEditorCampo = function(btn) {
    const pill = btn.closest('.custom-field-item');
    if (!pill) return;
    _pillolaInModifica = pill;
    const def = definizioneDaPillola(pill);

    const box = document.getElementById('campo-editor');
    document.getElementById('campo-editor-nome').textContent = pill.dataset.val;
    const sel = document.getElementById('campo-editor-tipo');
    sel.innerHTML = '';
    for (const tipo of window.Model.TIPI_CAMPO_SCEGLIBILI) {
        const opt = document.createElement('option');
        opt.value = tipo;
        opt.textContent = window.t('field_type_' + tipo, tipo);
        if (tipo === def.tipo) opt.selected = true;
        sel.appendChild(opt);
    }
    document.getElementById('campo-editor-obbligatorio').checked = !!def.obbligatorio;
    document.getElementById('campo-editor-unico').checked = !!def.unico;
    document.getElementById('campo-editor-opzioni').value = (def.opzioni || []).join('\n');

    // Fase 3.3 — la tendina dei vocabolari d'archivio.
    const selVoc = document.getElementById('campo-editor-vocabolario');
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

    // Fase 3.5 — persona / luogo / nessuno.
    const selAuth = document.getElementById('campo-editor-authority');
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

/** Le opzioni riguardano solo l'elenco a scelta: mostrarle sempre sarebbe un campo inerte. */
window.aggiornaEditorCampo = function() {
    const tipo = document.getElementById('campo-editor-tipo').value;
    const vocabolario = document.getElementById('campo-editor-vocabolario').value;
    document.getElementById('campo-editor-vocabolario-riga').classList.toggle('hidden', tipo !== 'enum');
    // Le due fonti dei valori si escludono: con un vocabolario scelto, l'area di testo
    // sarebbe una seconda lista che nessuno legge e che diverge alla prima aggiunta.
    document.getElementById('campo-editor-opzioni-riga').classList.toggle('hidden', tipo !== 'enum' || !!vocabolario);
    // Un'anagrafica ha senso su ciò che contiene NOMI: un numero o un sì/no no.
    const authUtile = tipo === 'text' || tipo === 'enum' || tipo === 'dynamic_list';
    document.getElementById('campo-editor-authority-riga').classList.toggle('hidden', !authUtile);
    if (!authUtile) document.getElementById('campo-editor-authority').value = '';
    // L'unicità su una casella di spunta o su un elenco chiave-valore non vuol dire niente:
    // due schede su tre avrebbero "duplicato" il valore `no`.
    const unicoUtile = tipo !== 'boolean' && tipo !== 'dynamic_list';
    document.getElementById('campo-editor-unico-riga').classList.toggle('hidden', !unicoUtile);
    if (!unicoUtile) document.getElementById('campo-editor-unico').checked = false;
};

window.chiudiEditorCampo = function() {
    document.getElementById('campo-editor').classList.add('hidden');
    _pillolaInModifica = null;
};

window.confermaEditorCampo = function() {
    if (!_pillolaInModifica) return;
    const tipo = document.getElementById('campo-editor-tipo').value;
    const vocabolario = tipo === 'enum' ? document.getElementById('campo-editor-vocabolario').value : '';
    const opzioni = document.getElementById('campo-editor-opzioni').value
        .split('\n').map(o => o.trim()).filter(Boolean);
    if (tipo === 'enum' && !vocabolario && opzioni.length === 0) {
        // Un elenco a scelta senza valori è una tendina vuota: un campo che non si può
        // compilare. Meglio dirlo qui che scoprirlo davanti a una scheda da riempire.
        mostraMessaggio(window.t('msg_enum_no_options', 'Un elenco a scelta ha bisogno di almeno un valore.'), 'error');
        return;
    }
    scriviDefinizioneSuPillola(_pillolaInModifica, {
        tipo,
        obbligatorio: document.getElementById('campo-editor-obbligatorio').checked,
        unico: document.getElementById('campo-editor-unico').checked,
        // Con un vocabolario scelto le opzioni NON si scrivono: la lista sta in un posto
        // solo, o ogni tipo ne avrebbe una copia destinata a divergere.
        opzioni: vocabolario ? [] : opzioni,
        vocabolario,
        authority: document.getElementById('campo-editor-authority').value
    });
    window.chiudiEditorCampo();
};

function confermaCreaTipo() {
    const nome = document.getElementById('custom-type-name').value.trim();
    if (!nome) { 
        mostraMessaggio(window.t("msg_insert_type_name"), "error"); 
        return; 
    }
    
    const definizioni = [];
    document.querySelectorAll('.custom-field-item').forEach(pill => {
        definizioni.push(definizioneDaPillola(pill));
    });

    if (definizioni.length === 0) {
        mostraMessaggio(window.t("msg_add_one_field"), "error");
        return;
    }

    if (editingTypeId) {
        // Aggiorna tipo esistente
        const index = appData.tipiDocumento.findIndex(t => t.id === editingTypeId);
        if (index !== -1) {
            appData.tipiDocumento[index].nome = nome;
            // Fase 3.1 — `impostaCampi` scrive `campi` come elenco di STRINGHE e mette le
            // definizioni in `campiDef`: dentro l'array manderebbero in errore le versioni
            // precedenti alla 3.1 su un archivio condiviso (vedi shared/model.ts).
            window.Model.impostaCampi(appData.tipiDocumento[index], definizioni);
            salvaTutto();
            aggiornaSelectTipiDocumento();
            chiudiNewTypeModal();
            mostraMessaggio(window.t("msg_type_updated"), "success");
        }
    } else {
        // Crea nuovo tipo
        const sel = document.getElementById('new-type-select').value;
        const prefissoId = sel !== 'custom' ? sel : 'custom';
        const id = prefissoId + '_' + Date.now();
        
        appData.tipiDocumento.push(window.Model.impostaCampi({ id, nome }, definizioni));
        salvaTutto();
        aggiornaSelectTipiDocumento();
        chiudiNewTypeModal();
        mostraMessaggio(window.t("msg_type_created"), "success");
    }
}

function apriManageTypesModal() {
    const listContainer = document.getElementById('manage-types-list');
    listContainer.innerHTML = window.sanitizeHTML('');
    
    const defaultIds = ['imbreviature', 'atti', 'fiscali'];
    
    appData.tipiDocumento.forEach(tipo => {
        const isDefault = defaultIds.includes(tipo.id);
        const inUso = appData.manoscritti.some(m => m.tipoDocumento === tipo.id);
        
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center p-3 bg-stone-50 border border-stone-200 rounded-sm';
        
        let inUsoBadge = inUso ? '<span class="text-[10px] uppercase font-bold tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-2">In uso</span>' : '';
        let defaultBadge = isDefault ? '<span class="text-[10px] uppercase font-bold tracking-wider text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full ml-2">Predefinito</span>' : '';
        
        // Un modello predefinito si APRE come gli altri: ciò che è bloccato sono i suoi campi
        // d'origine (nome del modello compreso), non l'aggiunta di campi propri. Prima il
        // pulsante non c'era affatto, e un campo aggiunto al modello — cosa che il wizard di
        // import della 2.4 permette — non si poteva più né ritipizzare né togliere.
        // L'eliminazione resta preclusa: il modello tornerebbe da solo al riavvio
        // (`applicaModelliPredefiniti`), cioè sarebbe un pulsante che non fa nulla.
        const btnModifica = `<button type="button" onclick="modificaTipoDocumento('${tipo.id}')" class="btn btn-ghost btn-icon text-stone-600 hover:text-amber-700 hover:bg-amber-50" title="${escapeHTML(window.t('btn_edit', 'Modifica'))}" aria-label="${escapeHTML(window.t('btn_edit', 'Modifica'))}"><i data-lucide="edit-2" class="w-4 h-4"></i></button>`;
        let buttonsHTML = '';
        if (isDefault) {
            buttonsHTML = btnModifica;
        } else {
            buttonsHTML = btnModifica + `
                <button type="button" onclick="eliminaTipoDocumento('${tipo.id}')" class="btn btn-ghost btn-icon text-red-500 hover:text-red-700 hover:bg-red-50" title="${escapeHTML(window.t('tooltip_delete', 'Elimina'))}" aria-label="${escapeHTML(window.t('tooltip_delete', 'Elimina'))}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            `;
        }

        div.innerHTML = window.sanitizeHTML(`
            <div class="flex items-center">
                <span class="font-medium text-stone-800">${escapeHTML(window.t('model_' + tipo.id) !== 'model_' + tipo.id ? window.t('model_' + tipo.id) : tipo.nome)}</span>
                ${defaultBadge}
                ${inUsoBadge}
            </div>
            <div class="flex gap-1">
                ${buttonsHTML}
            </div>
        `);
        listContainer.appendChild(div);
    });
    
    if (window.lucide) lucide.createIcons({ nodes: [listContainer] });
    document.getElementById('manage-types-modal').classList.remove('hidden-tab');
}

function chiudiManageTypesModal() {
    document.getElementById('manage-types-modal').classList.add('hidden-tab');
}

window.eliminaTipoDocumento = function(id) {
    const inUso = appData.manoscritti.some(m => m.tipoDocumento === id);
    if (inUso) {
        mostraMessaggio(window.t("msg_type_in_use"), "error");
        return;
    }
    
    window.mostraBottomConfirm(window.t("confirm_delete_model", "Sei sicuro di voler eliminare questo modello?"), async () => {
        // Salva il tipo per eventuale ripristino
        const tipoSalvato = JSON.parse(JSON.stringify(appData.tipiDocumento.find(t => t.id === id)));
        
        appData.tipiDocumento = appData.tipiDocumento.filter(t => t.id !== id);
        await salvaTutto();
        aggiornaSelectTipiDocumento();
        apriManageTypesModal(); // Ricarica la lista
        
        const ripristinaFn = async () => {
            appData.tipiDocumento.push(tipoSalvato);
            await salvaTutto();
            aggiornaSelectTipiDocumento();
            apriManageTypesModal();
        };

        if (window.gestoreAnnullamento) {
            window.gestoreAnnullamento.registraAzione(`Eliminazione modello "${tipoSalvato.nome}"`, ripristinaFn);
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
    
    // Configura UI per modifica
    editingTypeId = id;
    document.getElementById('new-type-select').value = 'custom';
    document.getElementById('new-type-select').disabled = true; // Impedisce di cambiare base durante modifica
    document.getElementById('btn-salva-tipo').textContent = window.t("btn_save_changes", "Save Changes");
    document.querySelector('#new-type-modal .modal-title').textContent = window.t("type_modal_edit_title", "Edit Document Type");

    // Un modello PREDEFINITO si modifica solo nei campi aggiunti dall'utente. Il nome no: è
    // l'unica cosa di quei tipi che si vede tradotta (`model_<id>`), e riscriverlo qui
    // produrrebbe un archivio in cui il modello si chiama in italiano dentro un'app in
    // inglese. I campi d'origine nemmeno: `applicaModelliPredefiniti` li rimette al loro
    // posto a ogni avvio, quindi toglierli sarebbe una modifica che si disfa da sola.
    sbloccaFormTipo();
    const predefinito = window.Model.modelloPredefinito(id);
    const campiBloccati = new Set(predefinito ? predefinito.campi : []);
    const inputNome = document.getElementById('custom-type-name');
    inputNome.disabled = !!predefinito;
    inputNome.title = predefinito ? window.t('type_name_locked', 'Il nome di un modello predefinito non si cambia: è tradotto insieme all\'applicazione.') : '';
    const nota = document.getElementById('type-locked-note');
    if (nota) nota.classList.toggle('hidden', !predefinito);

    // Resetta UI
    document.getElementById('custom-type-name').value = tipo.nome;
    document.getElementById('custom-type-extra-input').value = '';
    document.querySelectorAll('.custom-field-item').forEach(el => el.remove());
    document.querySelectorAll('.custom-type-field').forEach(cb => cb.checked = false);
    
    // Popola campi, con le definizioni della 3.1 riportate sulle pillole: senza, riaprire
    // un tipo per rinominarlo azzererebbe i tipi dei suoi campi.
    window.Model.campiDelTipo(tipo, CONFIG_CAMPI, appData).forEach(def => {
        const campoId = def.id;
        const bloccato = campiBloccati.has(campoId);
        const checkbox = document.querySelector(`.custom-type-field[value="${campoId}"]`);
        if (checkbox) {
            checkbox.checked = true;
            // La casella va disabilitata insieme alla pillola: togliendo la spunta si
            // toglierebbe il campo per un'altra strada, e il divieto sulla pillola sarebbe
            // una porta chiusa accanto a una aperta.
            checkbox.disabled = bloccato;
            aggiungiPill(campoId, checkbox.dataset.label, false, bloccato);
        } else {
            // Campo custom
            let label = campoId;
            if (CONFIG_CAMPI[campoId]) {
                label = window.t('field_' + campoId) !== 'field_' + campoId ? window.t('field_' + campoId) : CONFIG_CAMPI[campoId].label;
            }
            aggiungiPill(campoId, label, false, bloccato);
        }
        const pill = document.querySelector(`.custom-field-item[data-val="${campoId}"]`);
        if (pill) scriviDefinizioneSuPillola(pill, def);
    });
    
    document.getElementById('new-type-modal').classList.remove('hidden-tab');
};

