// @ts-nocheck
// --- Memoria dell'ultimo modello usato ---------------------------------------
// Preferenza puramente locale (per-macchina, per-workspace): NON entra in appData,
// altrimenti finirebbe nel file sincronizzato generando diff inutili fra collaboratori.
function _chiaveUltimoTipo() {
    return 'ultimoTipoDocumento:' + (window.percorsoWorkspace || '');
}

function leggiUltimoTipoDocumento() {
    try {
        return localStorage.getItem(_chiaveUltimoTipo()) || null;
    } catch (e) {
        // localStorage puo' lanciare (storage disabilitato/quota): la memoria e' opzionale.
        return null;
    }
}

window.salvaUltimoTipoDocumento = function(tipoId) {
    if (!tipoId) return;
    try {
        localStorage.setItem(_chiaveUltimoTipo(), tipoId);
    } catch (e) { /* preferenza non critica: ignora */ }
};

// Riporta la select sull'ultimo modello usato, se esiste ancora fra i tipi disponibili.
// Ritorna true se il valore e' cambiato (il chiamante decide quando ridisegnare i campi).
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
    // 'change' non scatta sulle assegnazioni programmatiche: qui arriva solo la scelta
    // esplicita dell'utente, che va memorizzata subito (anche se poi non salva la scheda).
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
        // Solo su scheda nuova: in modifica il tipo lo imposta editItem().
        if (!document.getElementById('form-id').value) applicaUltimoTipoDocumento();
        renderDynamicFields();
    }
}

/**
 * Fase 3.1 — le definizioni dei campi del tipo, sempre complete.
 * `CONFIG_CAMPI` porta i campi predefiniti (etichetta e tipo), `campiDef` del tipo porta
 * quelli dichiarati dall'utente. La fusione la fa il modello condiviso: qui non si decide
 * niente, o il form direbbe una cosa e l'export un'altra.
 */
function campiDefinitiDelTipo(tipo) {
    // Fase 3.3 — `appData` come terzo argomento: è da lì che il modello risolve i valori
    // di un `enum` legato a un vocabolario d'archivio. Ometterlo qui non darebbe errore,
    // darebbe una tendina vuota.
    return window.Model.campiDelTipo(tipo, CONFIG_CAMPI, appData);
}
window.campiDefinitiDelTipo = campiDefinitiDelTipo;

/**
 * Fase 3.7 — i campi che il FORM sta compilando: quelli del tipo scelto più quelli propri
 * della scheda, che vivono nel campo nascosto `#form-campi-propri` finché non si salva.
 *
 * ⚠️ È l'unico lettore da usare nel form. `campiDefinitiDelTipo` dice cosa prevede il
 * MODELLO, che non è più la stessa cosa: usarla qui farebbe sparire i campi propri dal
 * salvataggio pur avendoli mostrati, cioè butterebbe via ciò che l'utente ha appena scritto.
 */
function campiDefinitiDelForm() {
    const tipoId = document.getElementById('form-tipo-documento').value;
    const tipo = appData.tipiDocumento.find(t => t.id === tipoId) || appData.tipiDocumento[0];
    const propri = window.campiPropriForm ? window.campiPropriForm() : [];
    // Fase 3.8 — l'ordine scelto su questa scheda viaggia con le definizioni proprie: il
    // form mostra i campi come li vedrà chi riaprirà la scheda, non in un ordine suo.
    const ordine = window.ordineCampiForm ? window.ordineCampiForm() : [];
    return window.Model.campiDellaScheda({ campiPropri: propri, ordineCampi: ordine }, tipo, CONFIG_CAMPI, appData);
}
window.campiDefinitiDelForm = campiDefinitiDelForm;

/** Gli id dei campi propri in composizione: servono a marcarli nel form. */
function _idCampiPropriForm() {
    return new Set((window.campiPropriForm ? window.campiPropriForm() : []).map(d => d.id));
}

/** Porta il cursore su un campo appena aggiunto (l'utente lo ha creato per riempirlo). */
window.focusCampoDinamico = function(campoId) {
    const el = document.getElementById(idControlloCampo(campoId));
    if (el && el.focus) el.focus();
    else document.getElementById('container-' + campoId)?.querySelector('input')?.focus();
};

/** L'id del controllo del campo: unico punto in cui si costruisce (lo leggono in tre). */
function idControlloCampo(campoId) {
    return 'dyn-' + String(campoId).replace(/\s+/g, '_');
}
window.idControlloCampo = idControlloCampo;

/**
 * Fase 3.7 — legge dal DOM i valori dei campi dinamici, nel tipo dichiarato.
 *
 * Estratta da `handleFormSubmit` perché ora la leggono in due: il salvataggio e il ridisegno
 * che segue l'aggiunta o la rimozione di un campo proprio (senza, il ridisegno svuoterebbe
 * la scheda a metà compilazione). Due copie divergerebbero al primo tipo di campo nuovo.
 */
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
        // Fase 3.1 — il valore viene scritto nel TIPO dichiarato: un numero come numero, un
        // sì/no come booleano. È ciò che permette di ordinare per valore invece che per
        // stringa, ed è la ragione per cui la normalizzazione sta nel modello condiviso.
        valori[campoId] = window.Model.normalizzaValore(def, def.tipo === 'boolean' ? el.checked : el.value);
    });
    return valori;
}
window.leggiCampiDinamici = leggiCampiDinamici;

/** Rimette i valori nei controlli. È il gemello di `leggiCampiDinamici`: stesse regole. */
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
                // Uno vuoto di default, per comodità di chi compila.
                window.aggiungiElementoDinamico(campoId, conf.keyPlaceholder, conf.valPlaceholder, '', '');
            }
            return;
        }
        const el = document.getElementById(idControlloCampo(campoId));
        if (!el) return;
        // Fase 3.1 — `el.value = valore` su una casella di spunta non spunta nulla: la
        // scheda si aprirebbe sempre con il "no", e salvandola cancellerebbe il "sì".
        if (def.tipo === 'boolean') el.checked = m[campoId] === true || m[campoId] === 'true';
        // Zero è un dato: `m[campoId] || ''` lo tratterebbe come "non compilato".
        else if (def.tipo === 'number') el.value = (m[campoId] === 0 ? '0' : (m[campoId] || ''));
        else el.value = m[campoId] || '';
        // Fase 3.2: il riscontro sotto il campo data va rifatto sul valore caricato, o
        // resterebbe quello della scheda precedente.
        if (def.tipo === 'date' && typeof window.aggiornaRiscontroData === 'function') {
            window.aggiornaRiscontroData(el.id);
        }
        // Una tendina il cui valore non è fra le opzioni resta vuota e cancellerebbe il
        // dato al primo salvataggio: si aggiunge l'opzione mancante, marcata.
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

function renderDynamicFields() {
    const tipoId = document.getElementById('form-tipo-documento').value;
    const tipo = appData.tipiDocumento.find(t => t.id === tipoId) || appData.tipiDocumento[0];
    const container = document.getElementById('form-dynamic-fields');
    if (!container) return;
    container.innerHTML = '';

    const propri = _idCampiPropriForm();
    campiDefinitiDelForm().forEach(def => {
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
            // L'asterisco e' l'unico segno che l'utente cerca: il `required` del controllo
            // si manifesta solo al momento in cui blocca il salvataggio, cioe' troppo tardi.
            const ast = document.createElement('span');
            ast.className = 'text-red-600 ml-1';
            ast.textContent = '*';
            ast.title = window.t('field_required', 'Campo obbligatorio');
            label.appendChild(ast);
        }

        // Fase 3.7 — un campo proprio va DETTO: senza il segno, l'utente non distingue ciò
        // che vale per tutto l'archivio da ciò che ha appena inventato per questa scheda, e
        // scoprirebbe la differenza solo esportando.
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
            // Il "sì/no" non ha una riga sua sopra il controllo: la casella E l'etichetta
            // stanno sulla stessa riga, o mezzo form sarebbe fatto di etichette sospese
            // sopra un quadratino.
            const riga = document.createElement('label');
            riga.className = 'flex items-center gap-2 cursor-pointer';
            const el = document.createElement('input');
            el.type = 'checkbox';
            el.id = idControlloCampo(campoId);
            el.className = 'w-4 h-4';
            // L'accento e' quello del tema, non un ambra fisso: sui temi blu una casella
            // arancione e' l'unico elemento fuori tono di tutta la scheda.
            el.style.accentColor = 'var(--color-primary)';
            label.className = 'form-label mb-0';
            riga.append(el, label);
            div.appendChild(riga);

        } else if (def.tipo === 'enum') {
            div.appendChild(label);
            const el = document.createElement('select');
            el.id = idControlloCampo(campoId);
            el.className = 'form-input';
            // Prima voce vuota SEMPRE, anche su campo obbligatorio: senza, aprire una scheda
            // nuova equivarrebbe ad aver già scelto il primo valore dell'elenco.
            const vuota = document.createElement('option');
            vuota.value = '';
            vuota.textContent = def.obbligatorio ? window.t('field_choose', '— scegli —') : '';
            el.appendChild(vuota);
            for (const opzione of def.opzioni || []) {
                const opt = document.createElement('option');
                opt.value = opzione;
                opt.textContent = opzione;   // textContent: sono valori scritti dall'utente
                el.appendChild(opt);
            }

            // Fase 3.3 — un enum legato a un VOCABOLARIO d'archivio si può allargare senza
            // uscire dalla scheda. È la differenza fra una lista condivisa e una camicia di
            // forza: davanti a un supporto che l'elenco non prevede, l'alternativa sarebbe
            // lasciare il campo vuoto o interrompere la schedatura per andare a modificare
            // il tipo documento. Il valore nuovo entra nel vocabolario, quindi lo vedono
            // tutti: è un'aggiunta al vocabolario, non un'eccezione locale.
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
            // Fase 3.2 — resta un campo di TESTO: una datazione storica è "c. 1340" o
            // "sec. XIV in.", e un selettore di calendario chiederebbe un giorno che non si
            // conosce. Sotto, però, l'app dichiara come ha letto quel testo: è l'unico modo
            // di rendere affidabile un'interpretazione automatica — chi scrive vede subito
            // se l'ordinamento cronologico lo metterà dove si aspetta, e se non è stata
            // capita lo sa prima di scoprirlo fra mille schede.
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
            const el = document.createElement(def.tipo === 'textarea' ? 'textarea' : 'input');
            el.id = idControlloCampo(campoId);
            if (def.tipo === 'textarea') el.rows = 3;
            else if (def.tipo === 'number') {
                el.type = 'number';
                // `any`: un fiorino e mezzo esiste, e con lo step intero il browser
                // rifiuterebbe i decimali senza dire perché.
                el.step = 'any';
            }
            else if (def.tipo === 'url') el.type = 'url';
            else el.type = 'text';
            el.className = 'form-input';
            const pStr = window.t('placeholder_' + campoId) !== 'placeholder_' + campoId ? window.t('placeholder_' + campoId) : (def.placeholder || conf.placeholder);
            el.placeholder = pStr || (def.tipo === 'url' ? 'https://…' : '');
            div.appendChild(el);
        }
        
        container.appendChild(div);
    });

    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

/**
 * Come l'applicazione ha letto la datazione scritta nel campo `date` (Fase 3.2).
 *
 * Il testo non viene MAI riscritto: si mostra solo l'intervallo dedotto, e se non è stato
 * riconosciuto lo si dice. Correggere d'ufficio "c. 1340" in "1340" sarebbe buttare via
 * l'incertezza, che in una datazione è essa stessa un dato.
 */
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

/**
 * Fase 3.3 — l'aggiunta al volo. Il campo di testo compare AL POSTO della tendina finché
 * non si conferma: un secondo modale sopra il form per battere una parola costringerebbe a
 * perdere di vista la scheda che si sta compilando.
 */
window.aggiungiValoreAlVolo = function(vocabolarioId, idControllo) {
    const sel = document.getElementById(idControllo);
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
        // La tendina si ricostruisce da sola al prossimo render dei campi; qui basta
        // aggiungere l'opzione e selezionarla, o l'utente dovrebbe ricercarla a mano.
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
    inputKey.style.width = '33.33%'; // Fix flexbox

    const inputVal = document.createElement('input');
    inputVal.type = 'text';
    inputVal.className = 'form-input flex-1 list-val';
    let pVal = window.t('placeholder_val_' + campoId);
    pVal = pVal !== 'placeholder_val_' + campoId ? pVal : placeholderVal;
    inputVal.placeholder = pVal || window.t("placeholder_value", "Value");
    inputVal.value = valVal;
    inputVal.style.width = 'auto'; // Fix flexbox crush
    
    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn btn-ghost btn-icon text-red-500 hover:bg-red-50 hover:text-red-700';
    btnRemove.setAttribute('aria-label', window.t('tooltip_remove', 'Rimuovi'));
    btnRemove.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    btnRemove.onclick = () => row.remove();
    
    row.appendChild(inputKey);
    row.appendChild(inputVal);
    row.appendChild(btnRemove);
    
    listContainer.appendChild(row);
    if (window.lucide) lucide.createIcons({ nodes: [row] });
};

// Retrocompatibilità per appData (se qualche vecchio file chiama aggiungiAttoreDinamico, dirotta qua)
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

    // Fase 3.5: senza questo, i collegamenti della scheda appena chiusa resterebbero nel
    // form e finirebbero addosso alla prossima scheda creata.
    if (typeof window.caricaRelazioniForm === 'function') window.caricaRelazioniForm(null);

    // Fase 3.7, per la stessa ragione: i campi propri appartengono alla SCHEDA, e restare
    // nel form vorrebbe dire ritrovarseli addosso su ogni scheda creata dopo.
    if (window.scriviCampiPropriForm) window.scriviCampiPropriForm([]);
    // Fase 3.8: idem per l'ordine, e la modalità riordino si chiude — restare aperta sulla
    // scheda successiva vorrebbe dire un form senza campi visibili.
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
        // Fase 3.1: azzerare `.value` su una casella di spunta non la deseleziona e su una
        // tendina la lascia sull'ultima scelta — la scheda nuova nascerebbe con i valori
        // di quella appena salvata.
        dynContainer.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
            else el.value = '';
        });
    }

    // Reimposta la select sulla cartella in cui si stava navigando
    document.getElementById('form-cartella').value = window.cartellaAttuale;
    // ...e sul modello usato per ultimo, cosi' da non doverlo riselezionare ogni volta.
    // Fase 3.7: il ridisegno serve comunque, anche se il modello non cambia — i controlli
    // dei campi propri della scheda precedente sono ancora nel contenitore.
    applicaUltimoTipoDocumento();
    renderDynamicFields();
    document.getElementById('form-title').textContent = window.t('title_new_record', 'Compila Nuova Scheda');
    
    // Aggiorna le icone (es. arrow-left) in caso siano state resettate
    if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('btn-cancel-edit')] });
}

// Accetta sia un indice numerico (retrocompat) sia l'elemento bottone, da cui
// ricava l'indice corrente leggendo data-idx della riga (sempre allineato al DOM).
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

// P2.4 — alternativa accessibile (da tastiera) al riordino drag&drop.
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
        // Mantieni il focus sulla riga spostata per una navigazione fluida da tastiera.
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

            // Sposta il nodo nel DOM in-place: niente re-render completo, niente flicker.
            const rect = div.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            if (e.clientX > mid) div.after(dragged); else div.before(dragged);

            // Riallinea l'array degli allegati al nuovo ordine del DOM usando i
            // data-idx ancora "vecchi", poi li rinumera in base alla posizione attuale.
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
                <div class="flex items-center gap-2 truncate cursor-pointer hover:text-red-700 flex-1" onclick="apriPdfInterno('${escapeHTML(al.nome)}')">
                    <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-400 shrink-0"></i>
                    <i data-lucide="file-text" class="w-6 h-6 text-red-600 shrink-0"></i>
                    <span class="text-xs font-semibold truncate" title="${escapeHTML(al.originalName || al.nome)}">${escapeHTML(al.originalName || 'PDF')}</span>
                </div>
            `;
        } else {
            let src = '';
            if (window.apiBrowser) src = 'local-asset://' + encodeURIComponent(al.nome);
            content = `
                <div class="flex items-center gap-2 truncate cursor-pointer hover:opacity-80 flex-1" onclick="apriModal('${escapeHTML(src)}', 'img')">
                    <i data-lucide="grip-vertical" class="w-4 h-4 text-stone-400 shrink-0"></i>
                    <img src="${escapeHTML(src)}" alt="${escapeHTML(al.originalName || window.t('attachment_image', 'Immagine'))}" class="w-8 h-8 object-cover rounded-sm border border-stone-200 shrink-0">
                    <span class="text-xs font-semibold truncate" title="${escapeHTML(al.originalName || al.nome)}">${escapeHTML(al.originalName || window.t('attachment_image', 'Immagine'))}</span>
                </div>
            `;
        }

        div.innerHTML = `
            ${content}
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-move="up" onclick="spostaAllegatoForm(this, -1)" ${i === 0 ? 'disabled' : ''} class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="${escapeHTML(window.t('tooltip_move_up', 'Sposta su'))}" title="${escapeHTML(window.t('tooltip_move_up', 'Sposta su'))}">
                    <i data-lucide="chevron-up" class="w-4 h-4"></i>
                </button>
                <button type="button" data-move="down" onclick="spostaAllegatoForm(this, 1)" ${i === allegatiList.length - 1 ? 'disabled' : ''} class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="${escapeHTML(window.t('tooltip_move_down', 'Sposta giù'))}" title="${escapeHTML(window.t('tooltip_move_down', 'Sposta giù'))}">
                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                </button>
                <button type="button" onclick="rinominaAllegatoForm(this)" class="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50" aria-label="${escapeHTML(window.t('tooltip_rename', 'Rinomina'))}" title="${escapeHTML(window.t('tooltip_rename', 'Rinomina'))}">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button type="button" onclick="rimuoviAllegatoForm(this)" class="text-stone-400 hover:text-red-600 p-1 rounded hover:bg-red-50" aria-label="${escapeHTML(window.t('tooltip_remove', 'Rimuovi'))}" title="${escapeHTML(window.t('tooltip_remove', 'Rimuovi'))}">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        fragment.appendChild(div);
    }
    container.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [container] });
}

