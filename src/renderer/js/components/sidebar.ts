function nomeArchivioCorrente() {
    if (window.hubConfig && window.hubConfig.name) return String(window.hubConfig.name);
    const percorso = window.percorsoWorkspace || '';
    const base = percorso.split(/[\\/]/).filter(Boolean).pop();
    return base || '';
}
window.nomeArchivioCorrente = nomeArchivioCorrente;

function etichettaRadice() {
    return nomeArchivioCorrente() || window.t('folder_root_label', 'Radice');
}
window.etichettaRadice = etichettaRadice;

let _sidebarSignature = null;

const SEP_CAMPO = String.fromCharCode(1);
const SEP_RIGA = String.fromCharCode(2);
const SEP_BLOCCO = String.fromCharCode(3);

window.invalidaCacheSidebar = function() {
    _sidebarSignature = null;
};

window.alberoSecondario = window.alberoSecondario || { modo: 'nessuno', campo: '', ordina: 'segnatura' };

const AV_AUTO_SECONDARIO = ['dichiarante', 'Notaio', 'autore', 'attori_dinamici', 'titolo'];

let _cacheSecondario = new Map();

function _tipoDiSchedaSidebar(m) {
    if (typeof window.tipoDiScheda === 'function') return window.tipoDiScheda(m);
    return (appData.tipiDocumento || []).find(t => t.id === (m.tipoDocumento || 'manoscritto'))
        || { campi: ['titolo', 'autore', 'note'] };
}

function _definizioniScheda(m) {
    return window.Model.campiDellaScheda(m, _tipoDiSchedaSidebar(m), window.CONFIG_CAMPI, appData);
}

function _testoSecondario(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return window.testoBooleano(v);
    if (Array.isArray(v)) {
        for (const el of v) {
            if (!el) continue;
            if (typeof el === 'string' || typeof el === 'number') {
                const s = String(el).trim();
                if (s) return s;
                continue;
            }
            if (typeof el === 'object') {
                const s = String(el.v || el.nome || el.k || el.ruolo || '').trim();
                if (s) return s;
            }
        }
        return '';
    }
    return String(v).replace(/<[^>]*>/g, '').trim();
}

function _calcolaSecondario(m, pref) {
    if (pref.modo === 'campo') return pref.campo ? _testoSecondario(m[pref.campo]) : '';
    for (const campo of AV_AUTO_SECONDARIO) {
        const t = _testoSecondario(m[campo]);
        if (t) return t;
    }
    try {
        for (const def of _definizioniScheda(m)) {
            if (def.authority !== 'persona') continue;
            const t = _testoSecondario(m[def.id]);
            if (t) return t;
        }
    } catch (e) {}
    return '';
}

window.titoloScheda = (m) => _calcolaSecondario(m, { modo: 'auto' });

function etichettaSecondaria(m) {
    const pref = window.alberoSecondario || {};
    if (pref.modo !== 'auto' && pref.modo !== 'campo') return '';
    const chiave = m.id + SEP_CAMPO + (m.lastModified || 0) + SEP_CAMPO + pref.modo + SEP_CAMPO + (pref.campo || '');
    const memo = _cacheSecondario.get(chiave);
    if (memo !== undefined) return memo;
    if (_cacheSecondario.size > 4000) _cacheSecondario.clear();
    const val = _calcolaSecondario(m, pref) || '';
    _cacheSecondario.set(chiave, val);
    return val;
}

function calcolaFirmaSidebar() {
    const parti = [
        window.linguaAttuale || '',
        nomeArchivioCorrente(),
        window.cartellaAttuale || '',
        (appData.cartelle || []).join('|'),
        Array.from(window.cartelleEspanse || []).join('|'),
        (window.selectedRecords || []).join('|'),
        (window.alberoSecondario && window.alberoSecondario.modo) || 'nessuno',
        (window.alberoSecondario && window.alberoSecondario.campo) || '',
        (window.alberoSecondario && window.alberoSecondario.ordina) || 'segnatura',
        String(window.carteDalTelefono ? window.carteDalTelefono.versione : 0)
    ];
    let righe = '';
    for (const m of (appData.manoscritti || [])) {
        righe += m.id + SEP_CAMPO + (m.cartella || '') + SEP_CAMPO + (m.segnatura || m.titolo || '')
            + SEP_CAMPO + etichettaSecondaria(m) + SEP_RIGA;
    }
    parti.push(righe);
    return parti.join(SEP_BLOCCO);
}

function _vaiAPercorso(percorso) {
    if (percorso) return window.vaiACartella(percorso);
    window.cartellaAttuale = '';
    window.azzeraFiltriRicerca();
    if (typeof switchTab === 'function') switchTab('list');
    renderSidebar();
    renderMain();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
}

function aggiornaPercorsoTestata() {
    const nav = document.getElementById('percorso-testata');
    if (!nav) return;
    const cartella = window.cartellaAttuale || '';
    const tappe = [{ nome: etichettaRadice(), percorso: '' }];
    if (cartella) {
        const parti = cartella.split('/');
        parti.forEach((p, i) => tappe.push({ nome: p, percorso: parti.slice(0, i + 1).join('/') }));
    }
    const firma = tappe.map(t => t.percorso + SEP_CAMPO + t.nome).join(SEP_RIGA);
    if (nav.dataset.firma === firma) return;
    nav.dataset.firma = firma;
    nav.replaceChildren();
    tappe.forEach((t, i) => {
        const ultima = i === tappe.length - 1;
        if (i > 0) {
            const sep = document.createElement('span');
            sep.className = 'testata-percorso-sep';
            sep.setAttribute('aria-hidden', 'true');
            sep.textContent = '/';
            nav.appendChild(sep);
        }
        const el = document.createElement(ultima ? 'span' : 'button');
        el.className = ultima ? 'testata-percorso-attuale truncate' : 'testata-percorso-tappa truncate';
        el.textContent = t.nome;
        el.setAttribute('translate', 'no');
        if (ultima) el.setAttribute('aria-current', 'location');
        else {
            (el as HTMLButtonElement).type = 'button';
            el.addEventListener('click', () => _vaiAPercorso(t.percorso));
        }
        nav.appendChild(el);
    });
}
window.aggiornaPercorsoTestata = aggiornaPercorsoTestata;

const TAG_RAPIDI_MAX = 12;

function _rigaSezione(testo, conteggio, attiva, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sidebar-voce' + (attiva ? ' attiva' : '');
    if (attiva !== null) btn.setAttribute('aria-pressed', attiva ? 'true' : 'false');
    const nome = document.createElement('span');
    nome.className = 'truncate flex-1';
    nome.setAttribute('translate', 'no');
    nome.textContent = testo;
    btn.appendChild(nome);
    if (conteggio !== null) {
        const n = document.createElement('span');
        n.className = 'sidebar-voce-n';
        n.textContent = String(conteggio);
        btn.appendChild(n);
    }
    btn.addEventListener('click', onClick);
    return btn;
}

function renderSezioniSidebar() {
    const sezRicerche = document.getElementById('sidebar-ricerche');
    const listaRicerche = document.getElementById('sidebar-ricerche-lista');
    if (sezRicerche && listaRicerche) {
        const salvate = window.ricercheSalvate || [];
        sezRicerche.classList.toggle('hidden-tab', salvate.length === 0);
        listaRicerche.replaceChildren(...salvate.map(r => _rigaSezione(r.nome, null, null, () => window.applicaRicercaSalvata(r.id))));
    }

    const sezTag = document.getElementById('sidebar-tag-rapidi');
    const listaTag = document.getElementById('sidebar-tag-rapidi-lista');
    if (!sezTag || !listaTag) return;
    const voci = window.Model.conteggiTag(appData.manoscritti || [], appData)
        .sort((a, b) => b.conteggio - a.conteggio || a.nome.localeCompare(b.nome));
    sezTag.classList.toggle('hidden-tab', voci.length === 0);
    const attive = new Set(Array.from(window.activeTags || []).map(t => window.Model.chiaveTag(t)));
    const righe = voci.slice(0, TAG_RAPIDI_MAX).map(voce => {
        const attiva = attive.has(voce.chiave);
        const riga = _rigaSezione(voce.nome, voce.conteggio, attiva, () => {
            window.activeTags = window.activeTags || new Set();
            for (const t of Array.from(window.activeTags)) {
                if (window.Model.chiaveTag(t) === voce.chiave) window.activeTags.delete(t);
            }
            if (!attiva) window.activeTags.add(voce.nome);
            renderMain();
            if (typeof renderTagList === 'function' && !document.getElementById('sidebar-tags')?.classList.contains('hidden-tab')) renderTagList();
        });
        const quadro = document.createElement('span');
        const colore = window.Model.coloreTag(appData, voce.nome);
        quadro.className = 'sidebar-tag-quadro' + (colore ? ' tag-quadro-' + colore : '');
        quadro.setAttribute('aria-hidden', 'true');
        riga.prepend(quadro);
        riga.dataset.tag = voce.nome;
        return riga;
    });
    if (voci.length > TAG_RAPIDI_MAX) {
        righe.push(_rigaSezione(window.t('sidebar_all_tags', 'Tutti i tag'), voci.length, null, () => window.apriSidebarTab('tags')));
    }
    listaTag.replaceChildren(...righe);
}
window.renderSezioniSidebar = renderSezioniSidebar;

function renderSidebar() {
    const container = document.getElementById('folder-list');

    renderSezioniSidebar();
    aggiornaPercorsoTestata();

    const firma = calcolaFirmaSidebar();
    if (firma === _sidebarSignature && container.childElementCount > 0) {
        if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
        return;
    }
    _sidebarSignature = firma;

    container.innerHTML = window.sanitizeHTML('');

    normalizzaCartelle();

    const root = {};
    appData.cartelle.forEach(percorso => {
        const parti = percorso.split('/');
        let current = root;
        parti.forEach((part, i) => {
            const pathCompleto = parti.slice(0, i + 1).join('/');
            if (!current[part]) current[part] = { path: pathCompleto, children: {} };
            current = current[part].children;
        });
    });

    const folderIndex = new Map<string, any[]>();
    for (const m of appData.manoscritti) {
        const key = m.cartella || '';
        if (!folderIndex.has(key)) folderIndex.set(key, []);
        folderIndex.get(key)!.push(m);
    }

    const perSecondario = (window.alberoSecondario || {}).ordina === 'secondario';
    const fileOrdinati = (path) => {
        const files = (folderIndex.get(path) || []).slice();
        const chiave = (m) => m.segnatura || m.titolo || '';
        files.sort((a, b) => {
            if (perSecondario) {
                const d = window.confrontaNaturale(etichettaSecondaria(a), etichettaSecondaria(b));
                if (d !== 0) return d;
            }
            return window.confrontaNaturale(chiave(a), chiave(b));
        });
        return files;
    };

    function creaRigaFile(m, fullPath, profondita) {
        const fileRow = document.createElement('div');
        const isSelected = window.selectedRecords && window.selectedRecords.includes(m.id);

        fileRow.className = `group flex items-center gap-1.5 p-1 rounded-sm cursor-pointer transition-colors text-xs ${isSelected ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}`;
        fileRow.style.paddingLeft = `${profondita * 1.25 + 1.25}rem`;

        fileRow.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!window.selectedRecords.includes(m.id)) {
                window.selectItem(m.id, e);
            }
            if (typeof showRecordContextMenu === 'function') {
                showRecordContextMenu(e, m.id);
            }
        };

        fileRow.onclick = (e) => {
            e.stopPropagation();
            if (window.cartellaAttuale !== fullPath) {
                window.cartellaAttuale = fullPath;
                window.azzeraFiltriRicerca();
            }
            if (typeof switchTab === 'function') switchTab('list');

            if (typeof window.selectItem === 'function') {
                window.selectItem(m.id, e);
            }

            const vList = document.getElementById('view-list');
            const isListaVisibile = vList && !vList.classList.contains('hidden-tab');
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && isListaVisibile) {
                window.rivelaRecordNellaGriglia(m.id);
            }
        };

        const titoloFile = m.segnatura || m.titolo || window.t('untitled_record', 'Senza titolo');

        fileRow.draggable = true;
        fileRow.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'manoscritto', id: m.id }));
            e.dataTransfer.effectAllowed = 'move';
            fileRow.classList.add('opacity-50');
        };
        fileRow.ondragend = () => fileRow.classList.remove('opacity-50');

        const secondaria = etichettaSecondaria(m);
        const icona = document.createElement('i');
        icona.setAttribute('data-lucide', 'file-text');
        icona.className = `w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-600' : 'opacity-60'}`;
        const titolo = document.createElement('span');
        titolo.className = 'truncate';
        titolo.setAttribute('translate', 'no');
        titolo.textContent = titoloFile;
        if (secondaria) {
            fileRow.title = (m.segnatura || m.titolo || '') + ' — ' + secondaria;
            const colonna = document.createElement('span');
            colonna.className = 'flex flex-col min-w-0 flex-1 leading-tight';
            const sub = document.createElement('span');
            sub.className = 'truncate text-[11px] opacity-70 sidebar-file-sub';
            sub.textContent = secondaria;
            colonna.append(titolo, sub);
            fileRow.append(icona, colonna);
        } else {
            fileRow.append(icona, titolo);
        }
        const dalTelefono = window.carteDalTelefono ? window.carteDalTelefono(m.id) : 0;
        if (dalTelefono) {
            const segno = document.createElement('span');
            segno.className = 'sidebar-dal-telefono';
            segno.textContent = '+' + dalTelefono;
            segno.title = window.t('sidebar_from_phone', '{var0} carte arrivate dal telefono').replace('{var0}', String(dalTelefono));
            segno.setAttribute('aria-label', segno.title);
            fileRow.append(segno);
        }
        return fileRow;
    }

    function renderNode(nodeName, nodeObj, parentEl, profondita) {
        const fullPath = nodeObj.path;
        const isRadice = fullPath === '';
        const filesInFolder = fileOrdinati(fullPath);
        const hasChildren = Object.keys(nodeObj.children).length > 0 || filesInFolder.length > 0;
        const isAttuale = fullPath === window.cartellaAttuale;

        const div = document.createElement('div');
        div.className = "flex flex-col";

        const riga = document.createElement('div');
        riga.className = `group flex items-center gap-1 p-1.5 rounded-sm cursor-pointer transition-colors text-sm sidebar-row ${isAttuale ? 'active' : ''}`;
        riga.style.paddingLeft = `${profondita * 1.25 + 0.25}rem`;

        riga.oncontextmenu = (e) => {
            if (typeof window.showSidebarFolderContextMenu === 'function') {
                window.showSidebarFolderContextMenu(e, fullPath);
            }
        };

        riga.draggable = !isRadice;
        riga.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', path: fullPath }));
            e.dataTransfer.effectAllowed = 'move';
            riga.classList.add('opacity-50');
        };
        riga.ondragend = () => riga.classList.remove('opacity-50');

        riga.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            riga.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50');
        };
        riga.ondragleave = (e) => {
            e.stopPropagation();
            riga.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50');
        };
        riga.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            riga.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50');
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.type === 'folder' && typeof spostaCartella !== 'undefined') {
                    if (data.path !== fullPath) spostaCartella(data.path, fullPath);
                } else if (data.type === 'manoscritto' && typeof spostaManoscritto !== 'undefined') {
                    spostaManoscritto(data.id, fullPath);
                }
            } catch(err) { console.error(err); }
        };

        const spanToggle = document.createElement('span');
        spanToggle.className = "w-5 h-5 flex items-center justify-center shrink-0";
        if (hasChildren) {
            const isExpanded = window.cartelleEspanse.has(fullPath);
            spanToggle.innerHTML = window.sanitizeHTML(`<i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 sidebar-chevron transition-colors"></i>`);
            spanToggle.onclick = (e) => {
                e.stopPropagation();
                if (isExpanded) window.cartelleEspanse.delete(fullPath);
                else window.cartelleEspanse.add(fullPath);
                renderSidebar();
                if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
            };
        }

        const icona = isRadice ? 'library' : (isAttuale ? 'folder-open' : 'folder');
        const testo = document.createElement('span');
        testo.className = "truncate flex items-center gap-1.5 flex-1 select-none";
        testo.innerHTML = window.sanitizeHTML(`<i data-lucide="${icona}" class="w-4 h-4 shrink-0 sidebar-icon"></i> ${escapeHTML(nodeName)}`);

        riga.appendChild(spanToggle);
        riga.appendChild(testo);
        
        const actionContainer = document.createElement('div');
        actionContainer.className = "opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center transition-opacity";

        const btnOverflow = window.creaBottoneOverflow(
            () => window.vociMenuCartella(fullPath),
            {
                className: "p-1.5 rounded sidebar-action-btn rename",
                iconClass: "w-3.5 h-3.5",
                label: window.t('tooltip_folder_actions', 'Azioni cartella') + ': ' + nodeName
            }
        );
        actionContainer.appendChild(btnOverflow);

        riga.appendChild(actionContainer);

        riga.onclick = () => {
            window.cartellaAttuale = fullPath;
            window.cartelleEspanse.add(fullPath);
            window.azzeraFiltriRicerca();
            switchTab('list');
            renderSidebar();
            renderMain();
        };

        div.appendChild(riga);

        if (hasChildren && window.cartelleEspanse.has(fullPath)) {
            const childContainer = document.createElement('div');
            Object.keys(nodeObj.children).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(childName => {
                renderNode(childName, nodeObj.children[childName], childContainer, profondita + 1);
            });

            filesInFolder.forEach(m => {
                childContainer.appendChild(creaRigaFile(m, fullPath, profondita + 1));
            });

            div.appendChild(childContainer);
        }

        parentEl.appendChild(div);
    }

    const fragment = document.createDocumentFragment();

    renderNode(etichettaRadice(), { path: '', children: root }, fragment, 0);

    container.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [container] });

    container.ondragover = (e) => { e.preventDefault(); container.classList.add('bg-stone-100'); };
    container.ondragleave = () => { container.classList.remove('bg-stone-100'); };
    container.ondrop = (e) => {
        e.preventDefault();
        container.classList.remove('bg-stone-100');
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'folder' && typeof spostaCartella !== 'undefined') spostaCartella(data.path, 'ROOT');
            else if (data.type === 'manoscritto' && typeof spostaManoscritto !== 'undefined') spostaManoscritto(data.id, '');
        } catch(err) {}
    };

    const sidebarFoldersContainer = document.getElementById('sidebar-folders');
    if (sidebarFoldersContainer) {
        sidebarFoldersContainer.onclick = (e) => {
            if ((e.target as Element).closest('.sidebar-row') || (e.target as Element).closest('button')) return;
            if (window.cartellaAttuale === '') return;
            window.cartellaAttuale = '';
            window.azzeraFiltriRicerca();
            if (typeof switchTab === 'function') switchTab('list');
            renderSidebar();
            renderMain();
            if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
        };
        sidebarFoldersContainer.oncontextmenu = (e) => {
            const closestRow = (e.target as Element).closest('.sidebar-row');
            if (!closestRow) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.showSidebarFolderContextMenu === 'function') {
                    window.showSidebarFolderContextMenu(e, 'ROOT');
                }
            }
        };
    }

    if (window.lucide) lucide.createIcons({ nodes: [container] });
    if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
}

function campiSecondariDisponibili() {
    const campi = [];
    const visti = new Set();
    const tipiVisti = new Set();
    for (const m of (appData.manoscritti || [])) {
        const tid = m.tipoDocumento || 'manoscritto';
        const propri = window.Model.campiPropri(m);
        if (tipiVisti.has(tid) && !propri.length) continue;
        tipiVisti.add(tid);
        for (const def of _definizioniScheda(m)) {
            if (def.tipo === 'attachments' || visti.has(def.id)) continue;
            visti.add(def.id);
            campi.push(def.id);
        }
    }
    return campi;
}

function _etichettaCampoAlbero(campo) {
    if (typeof window.etichettaCampo === 'function') return window.etichettaCampo(campo);
    const conf = (window.CONFIG_CAMPI || {})[campo] || {};
    return conf.label || campo;
}

function _applicaPreferenzaAlbero(patch) {
    const pref = window.alberoSecondario || {};
    window.alberoSecondario = Object.assign({ modo: 'nessuno', campo: '', ordina: 'segnatura' }, pref, patch);
    window.invalidaCacheSidebar();
    renderSidebar();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
}

window.impostaAlberoSecondario = function(modo, campo) {
    const patch: Record<string, string> = { modo: modo, campo: modo === 'campo' ? String(campo || '') : '' };
    if (modo === 'nessuno') patch.ordina = 'segnatura';
    _applicaPreferenzaAlbero(patch);
};

window.impostaOrdineAlbero = function(ordina) {
    _applicaPreferenzaAlbero({ ordina: ordina === 'secondario' ? 'secondario' : 'segnatura' });
};

window.apriMenuEtichettaAlbero = function(ancora) {
    const pref = window.alberoSecondario || {};
    const spunta = (attiva) => attiva ? 'check' : 'minus';
    const voci: any[] = [
        { heading: true, label: window.t('tree_label_heading', 'Mostra sotto la segnatura') },
        {
            label: window.t('tree_label_none', 'Nessuna'),
            icon: spunta(pref.modo !== 'auto' && pref.modo !== 'campo'),
            onSelect: () => window.impostaAlberoSecondario('nessuno')
        },
        {
            label: window.t('tree_label_auto', 'Automatica (nome principale)'),
            icon: spunta(pref.modo === 'auto'),
            onSelect: () => window.impostaAlberoSecondario('auto')
        }
    ];

    const campi = campiSecondariDisponibili();
    if (campi.length) voci.push({ separator: true });
    for (const campo of campi) {
        voci.push({
            label: _etichettaCampoAlbero(campo),
            icon: spunta(pref.modo === 'campo' && pref.campo === campo),
            onSelect: () => window.impostaAlberoSecondario('campo', campo)
        });
    }

    voci.push({ separator: true });
    voci.push({ heading: true, label: window.t('tree_sort_heading', 'Ordina l\u2019albero per') });
    voci.push({
        label: window.t('field_segnatura', 'Segnatura'),
        icon: spunta(pref.ordina !== 'secondario'),
        onSelect: () => window.impostaOrdineAlbero('segnatura')
    });
    voci.push({
        label: window.t('tree_sort_secondary', 'Etichetta secondaria'),
        icon: spunta(pref.ordina === 'secondario'),
        disabled: pref.modo !== 'auto' && pref.modo !== 'campo',
        onSelect: () => window.impostaOrdineAlbero('secondario')
    });

    window.apriMenuContestuale(ancora || document.getElementById('btn-albero-secondario'), voci);
};

function aggiornaSelectCartelle() {
    const select = document.getElementById('form-cartella');
    select.innerHTML = window.sanitizeHTML('');

    const optRadice = document.createElement('option');
    optRadice.value = '';
    optRadice.textContent = etichettaRadice();
    if (!window.cartellaAttuale) optRadice.selected = true;
    select.appendChild(optRadice);

    [...appData.cartelle].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c.replace(/\//g, ' ⮞ ');
        if (c === window.cartellaAttuale) opt.selected = true;
        select.appendChild(opt);
    });
}

let _currentSidebarTab = 'folders';

function tabSidebar() {
    return Array.from(document.querySelectorAll<HTMLElement>('#sidebar-tablist [role="tab"]'))
        .filter(b => b.offsetParent !== null);
}

function aggiornaStatoTab(tabName) {
    const tutti = Array.from(document.querySelectorAll<HTMLElement>('#sidebar-tablist [role="tab"]'));
    tutti.forEach(btn => {
        const attivo = btn.dataset.tab === tabName;
        btn.classList.toggle('tab-active', attivo);
        btn.setAttribute('aria-selected', attivo ? 'true' : 'false');
        btn.setAttribute('aria-expanded', attivo ? 'true' : 'false');
        btn.tabIndex = attivo ? 0 : -1;
    });
    if (!tabName) {
        const visibili = tabSidebar();
        if (visibili.length) visibili[0].tabIndex = 0;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tablist = document.getElementById('sidebar-tablist');
    if (!tablist) return;
    aggiornaStatoTab(null);
    tablist.addEventListener('keydown', (e) => {
        const visibili = tabSidebar();
        if (!visibili.length) return;
        const i = visibili.indexOf(document.activeElement as HTMLElement);
        let prossimo = -1;
        if (e.key === 'ArrowRight') prossimo = (i + 1 + visibili.length) % visibili.length;
        else if (e.key === 'ArrowLeft') prossimo = (i - 1 + visibili.length) % visibili.length;
        else if (e.key === 'Home') prossimo = 0;
        else if (e.key === 'End') prossimo = visibili.length - 1;
        else return;
        e.preventDefault();
        visibili.forEach(b => { b.tabIndex = -1; });
        visibili[prossimo].tabIndex = 0;
        visibili[prossimo].focus();
    });
});

window.apriSidebarTab = function(tabName) {
    const sidebar = document.getElementById('sidebar');
    const gia = tabName === _currentSidebarTab && !sidebar.classList.contains('hidden-tab');
    if (!gia) switchSidebarTab(tabName);
};

function switchSidebarTab(tabName) {
    const sidebar = document.getElementById('sidebar');
    const isCurrentlyHidden = sidebar.classList.contains('hidden-tab');

    if (tabName === _currentSidebarTab && !isCurrentlyHidden) {
        sidebar.classList.add('hidden-tab');
        aggiornaStatoTab(null);
        return;
    }

    sidebar.classList.remove('hidden-tab');
    _currentSidebarTab = tabName;
    aggiornaStatoTab(tabName);

    document.getElementById('sidebar-folders').classList.add('hidden-tab');
    document.getElementById('sidebar-search').classList.add('hidden-tab');
    document.getElementById('sidebar-tags').classList.add('hidden-tab');
    const sourceControl = document.getElementById('sidebar-source-control');
    if (sourceControl) sourceControl.classList.add('hidden-tab');
    const historyPanel = document.getElementById('sidebar-history');
    if (historyPanel) historyPanel.classList.add('hidden-tab');

    if (tabName === 'folders') document.getElementById('sidebar-folders').classList.remove('hidden-tab');
    if (tabName === 'search') {
        document.getElementById('sidebar-search').classList.remove('hidden-tab');
        document.getElementById('search-input').focus();
        renderSearchSuggestions();
    }
    if (tabName === 'tags') {
        document.getElementById('sidebar-tags').classList.remove('hidden-tab');
        renderTagList();
    }
    if (tabName === 'source-control') {
        if (sourceControl) {
            sourceControl.classList.remove('hidden-tab');
            if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
        }
    }
    if (tabName === 'history') {
        if (historyPanel) {
            historyPanel.classList.remove('hidden-tab');
            if (typeof window.renderHistoryList === 'function') window.renderHistoryList();
        }
    }
}

window.renderSourceControl = function() {
    const list = document.getElementById('source-control-list');
    const countLabel = document.getElementById('source-control-count');
    if (!list || !countLabel) return;

    list.innerHTML = window.sanitizeHTML('');
    
    const loadedAt = window.ultimoCaricamento || 0;
    const modificati = appData.manoscritti.filter(m => (m.lastModified || 0) > loadedAt);
    const incoming = window.incomingChanges || [];

    const hasIncomingUpdates = !!window.modificheInEntrata;

    let totalCount = modificati.length + incoming.length;
    if (hasIncomingUpdates && incoming.length === 0) totalCount += 1;

    countLabel.textContent = totalCount.toString();

    if (modificati.length === 0 && incoming.length === 0 && !hasIncomingUpdates) {
        list.innerHTML = window.sanitizeHTML(`<div class="p-4 modello-suggerimento text-center">${escapeHTML(window.t("sidebar_no_pending", "No pending changes"))}</div>`);
        return;
    }

    const fragment = document.createDocumentFragment();
    const structural = window.incomingStructuralChanges || [];

    if (hasIncomingUpdates && incoming.length === 0 && structural.length === 0) {
        const li = document.createElement('li');
        li.className = 'sc-riga cursor-default';
        li.title = window.t("sidebar_structural_hint", "There are structural changes (e.g. folders or removals). Click Download on the top right.");
        li.innerHTML = window.sanitizeHTML(`
            <div class="flex items-center gap-2 truncate">
                <span class="sc-lettera testo-info">↓</span>
                <span class="text-sm truncate text-stone-700">${window.t("sidebar_structural_updates", "Structural updates")}</span>
            </div>
            <div class="text-[11px] testo-info shrink-0">cloud</div>
        `);
        fragment.appendChild(li);
    } else if (hasIncomingUpdates && structural.length > 0) {
        const li = document.createElement('li');
        li.className = 'sc-riga flex-col items-stretch';
        
        let detailsHtml = structural.map(s => `
            <div class="text-xs text-stone-500 ml-6 mt-1.5 flex items-center gap-1.5">
                <i data-lucide="${s.icon || 'corner-down-right'}" class="w-3.5 h-3.5 text-stone-400"></i> ${escapeHTML(String(s.label || ''))}
            </div>
        `).join('');
        
        li.innerHTML = window.sanitizeHTML(`
            <details class="w-full cursor-pointer group/details">
                <summary class="flex items-center justify-between outline-none list-none select-none">
                    <div class="flex items-center gap-2 truncate">
                        <span class="sc-lettera testo-info">↓</span>
                        <span class="text-sm truncate text-stone-700">${window.t("sidebar_structural_updates", "Structural updates")}</span>
                    </div>
                    <div class="text-[11px] testo-info shrink-0 flex items-center gap-1">cloud <i data-lucide="chevron-down" class="w-3 h-3 transition-transform group-open/details:rotate-180"></i></div>
                </summary>
                <div class="mt-1 pb-1">
                    ${detailsHtml}
                </div>
            </details>
        `);
        fragment.appendChild(li);
    }

    const renderItem = (m, isIncoming) => {
        const isNew = m.lastModified === m.createdAt || (!m.createdAt && m.lastModified > loadedAt);
        let iconLetter = isNew ? 'A' : 'M';
        let colorClass = isNew ? 'testo-successo' : 'testo-avviso';
        
        if (isIncoming) {
            iconLetter = '↓';
            colorClass = 'testo-info';
        }

        const li = document.createElement('li');
        li.className = 'sc-riga group';
        
        li.title = window.t('tooltip_click_show_changes', 'Clicca per mostrare le modifiche');
        li.onclick = (e) => {
            e.stopPropagation();
            if (isIncoming) {
                const localeObj = appData.manoscritti.find(x => x.id === m.id);
                if (typeof window.apriDiffModal === 'function') {
                    window.apriDiffModal(localeObj || {}, m, window.t('diff_title_cloud', 'Diff dal Cloud: {var0}').replace('{var0}', m.titolo || m.segnatura || window.t('untitled_record', 'Senza titolo')));
                }
            } else {
                const baseObj = appData.baseObjects && appData.baseObjects[m.id];
                if (typeof window.apriDiffModal === 'function') {
                    window.apriDiffModal(baseObj || {}, m, window.t('diff_title_local', 'Modifiche locali: {var0}').replace('{var0}', m.titolo || m.segnatura || window.t('untitled_record', 'Senza titolo')));
                }
            }
        };

        if (isIncoming) {
            li.classList.add('opacity-80');
        }

        const leftDiv = document.createElement('div');
        leftDiv.className = "flex items-center gap-2 overflow-hidden";
        
        const badge = document.createElement('span');
        badge.className = 'sc-lettera ' + colorClass;
        badge.textContent = iconLetter;
        
        const textContainer = document.createElement('div');
        textContainer.className = "flex flex-col overflow-hidden";

        const titleSpan = document.createElement('span');
        titleSpan.className = 'truncate font-mono text-xs text-stone-800';
        titleSpan.textContent = m.titolo || m.segnatura || window.t('untitled_record', 'Senza titolo');
        titleSpan.translate = false;
        
        const titleRowContainer = document.createElement('div');
        titleRowContainer.className = "flex flex-col";
        titleRowContainer.appendChild(titleSpan);

        const actionHint = document.createElement('span');
        actionHint.className = 'text-[11px] text-stone-500';
        actionHint.textContent = window.t("sidebar_click_to_show", "Click to show changes");
        titleRowContainer.appendChild(actionHint);
        
        textContainer.appendChild(titleRowContainer);
        
        if (isIncoming && window.incomingAuthor) {
            const authorSpan = document.createElement('span');
            authorSpan.className = 'text-[11px] text-stone-500 truncate';
            authorSpan.textContent = window.t("sidebar_from", "from ") + window.incomingAuthor;
            textContainer.appendChild(authorSpan);
            li.title = window.t("sidebar_from_cloud_title", "Cloud change sent by {var0}. Do a Fetch/Download to see it.").replace("{var0}", window.incomingAuthor);
        }

        const autore = m.modificatoDa || m.creatoDa;
        if (autore) {
            const authorSpan = document.createElement('span');
            authorSpan.className = "text-[11px] text-stone-500 truncate leading-tight";
            authorSpan.textContent = window.t("sidebar_from_colon", "from: ") + autore;
            textContainer.appendChild(authorSpan);
        }

        leftDiv.appendChild(badge);
        leftDiv.appendChild(textContainer);

        li.appendChild(leftDiv);
        fragment.appendChild(li);
    };

    if (incoming.length > 0) {
        const header = document.createElement('div');
        header.className = 'sidebar-striscia';
        header.textContent = window.t("sidebar_incoming_cloud", "INCOMING (CLOUD)");
        fragment.appendChild(header);
        
        incoming.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        incoming.forEach(m => renderItem(m, true));
    }

    if (modificati.length > 0) {
        if (incoming.length > 0) {
            const header = document.createElement('div');
            header.className = 'sidebar-striscia mt-2';
            header.textContent = window.t("sidebar_local_label", "LOCAL");
            fragment.appendChild(header);
        }
        modificati.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        modificati.forEach(m => renderItem(m, false));
    }
    
    list.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [list] });
};

function renderTagList() {
    const container = document.getElementById('tag-list');
    container.innerHTML = window.sanitizeHTML('');

    const voci = window.Model.conteggiTag(appData.manoscritti, appData);

    if (voci.length === 0) {
        container.innerHTML = window.sanitizeHTML(`<div class="p-4 text-xs text-stone-400 italic text-center">${window.t('no_tags_found')}</div>`);
        return;
    }

    window.activeTags = window.activeTags || new Set();

    document.getElementById('btn-clear-tag').classList.toggle('hidden', window.activeTags.size === 0);

    const filtro = window.Model.chiaveTag(document.getElementById('global-tag-search')?.value || '');
    const visibili = filtro ? voci.filter(v => v.chiave.includes(filtro)) : voci;

    if (visibili.length === 0) {
        container.innerHTML = window.sanitizeHTML(`<div class="p-4 text-xs text-stone-400 italic text-center">${window.t('no_tags_found')}</div>`);
        return;
    }

    const fragment = document.createDocumentFragment();
    const attive = new Set(Array.from(window.activeTags).map(t => window.Model.chiaveTag(t)));
    visibili.forEach(voce => {
        const btn = document.createElement('button');
        const isActive = attive.has(voce.chiave);
        const colore = window.Model.coloreTag(appData, voce.nome);
        btn.className = 'sidebar-voce' + (isActive ? ' attiva' : '');
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        btn.dataset.tag = voce.nome;
        btn.onclick = () => {
            for (const t of Array.from(window.activeTags)) {
                if (window.Model.chiaveTag(t) === voce.chiave) window.activeTags.delete(t);
            }
            if (!isActive) window.activeTags.add(voce.nome);
            renderMain();
            renderTagList();
        };
        btn.innerHTML = window.sanitizeHTML(
            `<span class="sidebar-tag-quadro${colore ? ' tag-quadro-' + colore : ''}" aria-hidden="true"></span>` +
            `<span class="truncate flex-1" translate="no">${escapeHTML(voce.nome)}</span>` +
            `<span class="sidebar-voce-n">${voce.conteggio}</span>`
        );
        btn.setAttribute('aria-label', `#${voce.nome} (${voce.conteggio})`);
        fragment.appendChild(btn);
    });
    container.appendChild(fragment);
}

window.toggleVaultSwitcher = function(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const popover = document.getElementById('vault-switcher-popover');
    if (popover) {
        popover.classList.toggle('hidden-tab');
        if (!popover.classList.contains('hidden-tab')) {
            window.aggiornaListaVault();
        }
    }
};

window.rimuoviVaultDallaLista = async function(event, pathToRemove) {
    event.stopPropagation();
    event.preventDefault();
    
    const vaultName = pathToRemove.split(/[\\/\\\\]/).pop();
    
    const modalHtml = `
        <div id="vault-delete-modal" class="modal-overlay z-modal-alert">
            <div class="modal-window max-w-md" role="alertdialog" aria-labelledby="vault-delete-title" aria-describedby="vault-delete-desc">
                <div class="modal-header">
                    <div class="min-w-0">
                        <h3 id="vault-delete-title" class="modal-title">${escapeHTML(window.t('modal_vault_remove_title', 'Rimuovere {var0}?').replace('{var0}', '«' + vaultName + '»'))}</h3>
                        <p class="modal-sottotitolo font-mono break-all" translate="no">${escapeHTML(pathToRemove)}</p>
                    </div>
                </div>
                <div class="modal-body">
                    <p id="vault-delete-desc" class="text-sm text-stone-600 leading-relaxed">${escapeHTML(window.t('modal_vault_remove_desc', "Dall'elenco soltanto, e la cartella resta sul disco; oppure anche i file, e schede e allegati spariscono dal computer."))}</p>
                </div>
                <div class="modal-footer modal-footer-bar">
                    <button id="btn-delete-files" class="btn btn-danger-ghost mr-auto">${escapeHTML(window.t('btn_vault_delete_files', 'Elimina anche i file'))}</button>
                    <button id="btn-cancel-delete" data-modal-cancel class="btn btn-secondary" data-i18n="btn_cancel">Annulla</button>
                    <button id="btn-remove-list" class="btn btn-primary">${escapeHTML(window.t('btn_vault_remove_list', "Rimuovi solo dall'elenco"))}</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if (window.lucide) lucide.createIcons();
    
    const modal = document.getElementById('vault-delete-modal');
    
    return new Promise<void>((resolve) => {
        const finishRemoval = async () => {
            if (await window.apiSettings.rimuoviArchivioRecente(pathToRemove)) window.aggiornaListaVault();
        };

        document.getElementById('btn-delete-files').onclick = async () => {
            modal.remove();
            if (window.apiBrowser && window.apiBrowser.deleteVaultLocal) {
                const esito = await window.apiBrowser.deleteVaultLocal(pathToRemove);
                if (esito && esito.canceled) { resolve(); return; }
            }
            await finishRemoval();
            resolve();
        };
        
        document.getElementById('btn-remove-list').onclick = async () => {
            modal.remove();
            await finishRemoval();
            resolve();
        };
        
        document.getElementById('btn-cancel-delete').onclick = () => {
            modal.remove();
            resolve();
        };
    });
};

window.archivioRecenteNonTrovato = function(percorso) {
    document.body.insertAdjacentHTML('beforeend', `
        <div id="vault-missing-modal" class="modal-overlay z-modal-alert">
            <div class="modal-window max-w-md" role="alertdialog" aria-labelledby="vault-missing-title" aria-describedby="vault-missing-desc">
                <div class="modal-header">
                    <div class="min-w-0">
                        <h3 id="vault-missing-title" class="modal-title">${escapeHTML(window.t('modal_vault_missing_title', 'Archivio non trovato'))}</h3>
                        <p class="modal-sottotitolo font-mono break-all" translate="no" title="${escapeHTML(percorso)}">${escapeHTML(percorso)}</p>
                    </div>
                </div>
                <div class="modal-body">
                    <p id="vault-missing-desc" class="text-sm text-stone-600 leading-relaxed">${escapeHTML(window.t('msg_archivio_recente_non_trovato', 'La cartella dell\'archivio non esiste più: forse è stata spostata o rinominata.'))}</p>
                    <p id="vault-missing-error" class="text-sm testo-pericolo mt-3 hidden-tab" role="alert"></p>
                </div>
                <div class="modal-footer modal-footer-bar">
                    <button id="btn-vault-missing-remove" class="btn btn-ghost mr-auto">${escapeHTML(window.t('btn_vault_remove_list', "Rimuovi solo dall'elenco"))}</button>
                    <button id="btn-vault-missing-cancel" data-modal-cancel class="btn btn-secondary">${escapeHTML(window.t('btn_cancel', 'Annulla'))}</button>
                    <button id="btn-vault-locate" class="btn btn-primary">${escapeHTML(window.t('btn_cerca_cartella_archivio', 'Cerca cartella…'))}</button>
                </div>
            </div>
        </div>
    `);
    const modal = document.getElementById('vault-missing-modal');
    if (window.lucide) lucide.createIcons({ nodes: [modal] });
    const errore = document.getElementById('vault-missing-error');
    const mostraErrore = (testo) => { errore.textContent = testo; errore.classList.remove('hidden-tab'); };

    document.getElementById('btn-vault-locate').onclick = async () => {
        try {
            const esito = await window.apiBrowser.ricollegaArchivioRecente(percorso, window.t('dialog_cerca_cartella_archivio', 'Seleziona la nuova cartella dell\'archivio'));
            if (esito?.ok) modal.remove();
            else if (esito?.motivo === 'non-archivio') mostraErrore(window.t('msg_cartella_non_archivio', 'La cartella scelta non contiene un archivio ArchiView.'));
            else if (esito?.motivo) mostraErrore(window.t('msg_errore', 'Errore: ') + esito.motivo);
        } catch (e) {
            mostraErrore(window.t('msg_errore', 'Errore: ') + e.message);
        }
    };
    document.getElementById('btn-vault-missing-remove').onclick = async () => {
        modal.remove();
        if (await window.apiSettings.rimuoviArchivioRecente(percorso)) window.aggiornaListaVault();
    };
    document.getElementById('btn-vault-missing-cancel').onclick = () => modal.remove();
    document.getElementById('btn-vault-locate').focus();
};

window.aggiornaListaVault = async function() {
    if (window.apiBrowser && window.apiBrowser.getRecentWorkspaces) {
        const recents = await window.apiBrowser.getRecentWorkspaces();
        const currentPath = await window.apiBrowser.getWorkspacePath();
        const list = document.getElementById('vault-switcher-list');
        if (list) {
            list.innerHTML = window.sanitizeHTML('');
            if (recents && recents.length > 0) {
                recents.forEach(item => {
                    const path = item.path || item;
                    const isShared = item.isShared || false;
                    const isPersonal = item.isPersonal || false;
                    const name = path.split(/[\/\\]/).pop();
                    const isCurrent = path === currentPath;
                    
                    const divContainer = document.createElement('div');
                    divContainer.className = 'archivio-voce' + (isCurrent ? ' attiva' : '');
                    
                    if (!isCurrent) {
                        divContainer.onclick = async () => {
                            if (!(await window.apiBrowser.openRecentWorkspace(path))) window.archivioRecenteNonTrovato(path);
                        };
                    } else {
                        divContainer.onclick = (e) => { e.stopPropagation(); };
                    }
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'archivio-voce-nome';
                    nameSpan.title = path;
                    
                    if (item.provider === 'hub') {
                        nameSpan.innerHTML = window.sanitizeHTML(`<i data-lucide="server" class="w-4 h-4 testo-successo shrink-0" title="${escapeHTML(window.t('vault_type_hub', 'Hub Condiviso'))}"></i> <span class="truncate">${escapeHTML(name)}</span>`);
                    } else if (isShared) {
                        nameSpan.innerHTML = window.sanitizeHTML(`<i data-lucide="cloud" class="w-4 h-4 testo-info shrink-0" title="${escapeHTML(window.t('vault_type_shared', 'Condiviso'))}"></i> <span class="truncate">${escapeHTML(name)}</span>`);
                    } else if (isPersonal) {
                        nameSpan.innerHTML = window.sanitizeHTML(`<i data-lucide="cloud" class="w-4 h-4 testo-successo shrink-0" title="${escapeHTML(window.t('vault_type_backup', 'Backup Personale'))}"></i> <span class="truncate">${escapeHTML(name)}</span>`);
                    } else {
                        nameSpan.innerHTML = window.sanitizeHTML(`<i data-lucide="folder" class="w-4 h-4 shrink-0" title="${escapeHTML(window.t('vault_type_local', 'Locale'))}"></i> <span class="truncate">${escapeHTML(name)}</span>`);
                    }
                    
                    divContainer.appendChild(nameSpan);

                    if (isCurrent) {
                        const checkIcon = document.createElement('div');
                        checkIcon.innerHTML = window.sanitizeHTML('<i data-lucide="check" class="w-4 h-4 testo-accento shrink-0"></i>');
                        divContainer.appendChild(checkIcon.firstChild);
                    } else {
                        const delBtn = document.createElement('button');
                        delBtn.className = 'btn btn-ghost btn-icon btn-mini shrink-0';
                        delBtn.setAttribute('aria-label', window.t('tooltip_remove_from_list', 'Rimuovi dalla lista') + ': ' + name);
                        delBtn.innerHTML = window.sanitizeHTML('<i data-lucide="x" class="w-3.5 h-3.5"></i>');
                        delBtn.onclick = (e) => window.rimuoviVaultDallaLista(e, path);
                        delBtn.title = window.t('tooltip_remove_from_list', 'Rimuovi dalla lista');
                        divContainer.appendChild(delBtn);
                    }
                    
                    list.appendChild(divContainer);
                });
                if (window.lucide) lucide.createIcons({ nodes: [list] });
            }
        }
        
        const nameEl = document.getElementById('current-vault-name');
        if (nameEl && currentPath) {
            let vaultName = currentPath.split(/[\\/\\\\]/).pop();
            const currentVaultInfo = recents ? recents.find(r => r.path === currentPath || r === currentPath) : null;
            const isCurrentHub = (currentVaultInfo && currentVaultInfo.provider === 'hub') || !!window.hubConfig;
            const isCurrentShared = currentVaultInfo && currentVaultInfo.isShared;
            const isCurrentPersonal = currentVaultInfo && currentVaultInfo.isPersonal;

            if (isCurrentHub) {
                const hubName = (window.hubConfig && window.hubConfig.name) || vaultName;
                nameEl.innerHTML = window.sanitizeHTML(`<div class="flex items-center gap-1.5"><i data-lucide="server" class="w-4 h-4 testo-successo shrink-0"></i> <span>${escapeHTML(hubName)}</span></div>`);
                if (window.lucide) lucide.createIcons({ nodes: [nameEl] });
            } else if (isCurrentShared) {
                nameEl.innerHTML = window.sanitizeHTML(`<div class="flex items-center gap-1.5"><i data-lucide="cloud" class="w-4 h-4 testo-info shrink-0"></i> <span>${escapeHTML(vaultName)}</span></div>`);
                if (window.lucide) lucide.createIcons({ nodes: [nameEl] });
            } else if (isCurrentPersonal) {
                nameEl.innerHTML = window.sanitizeHTML(`<div class="flex items-center gap-1.5"><i data-lucide="cloud" class="w-4 h-4 testo-successo shrink-0"></i> <span>${escapeHTML(vaultName)}</span></div>`);
                if (window.lucide) lucide.createIcons({ nodes: [nameEl] });
            } else {
                nameEl.innerHTML = window.sanitizeHTML(`<div class="flex items-center gap-1.5"><i data-lucide="folder" class="w-4 h-4 shrink-0"></i> <span>${escapeHTML(vaultName)}</span></div>`);
                if (window.lucide) lucide.createIcons({ nodes: [nameEl] });
            }
            nameEl.title = currentPath;
        }
    }
};

document.addEventListener('click', function(e) {
    const popover = document.getElementById('vault-switcher-popover');
    if (popover && !popover.classList.contains('hidden-tab')) {
        if (!(e.target as Element).closest('#vault-switcher-popover') && !(e.target as Element).closest('#btn-cambia-archivio')) {
            popover.classList.add('hidden-tab');
        }
    }
});
