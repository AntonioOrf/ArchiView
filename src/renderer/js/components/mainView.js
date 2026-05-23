// renderMain è sincrona: non usa await, non deve essere async
function renderMain() {
    const grid = document.getElementById('manoscritti-grid');
    const search = document.getElementById('search-input').value.toLowerCase();
    const tagSearch = (document.getElementById('global-tag-search').value || '').toLowerCase();

    const isGlobalSearch = search !== '' || tagSearch !== '';

    if (isGlobalSearch) {
        document.getElementById('titolo-cartella-attuale').textContent = "Risultati Ricerca Globale";
    } else {
        const partiTitolo = window.cartellaAttuale.split('/');
        document.getElementById('titolo-cartella-attuale').textContent = partiTitolo[partiTitolo.length - 1];
    }

    // Filtro per Cartella (se non globale) E per Ricerca E per Tag
    const filtered = appData.manoscritti.filter(m => {
        const matchCartella = isGlobalSearch ? true : m.cartella === window.cartellaAttuale;

        const tipoDoc = appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'));
        const campiPossibili = tipoDoc ? tipoDoc.campi : ['titolo', 'autore', 'note'];
        const matchSearch = search === '' || (m.segnatura||'').toLowerCase().includes(search) || campiPossibili.some(campo => (m[campo] || '').toString().toLowerCase().includes(search));

        const mTags = (m.tags || '').toLowerCase();
        const matchTag = tagSearch === '' || mTags.includes(tagSearch);

        return matchCartella && matchSearch && matchTag;
    });

    document.getElementById('counter-results').textContent = `Documenti trovati: ${filtered.length}`;
    grid.innerHTML = '';

    const btnDeleteFolder = document.getElementById('btn-delete-folder');

    if (filtered.length === 0) {
        grid.classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');

        const manoscrittiTotaliInCartella = appData.manoscritti.filter(m => m.cartella === window.cartellaAttuale).length;
        if (manoscrittiTotaliInCartella === 0 && window.cartellaAttuale !== 'Generale' && search === '') {
            btnDeleteFolder.classList.remove('hidden');
            btnDeleteFolder.classList.add('flex');
        } else {
            btnDeleteFolder.classList.add('hidden');
            btnDeleteFolder.classList.remove('flex');
        }
    } else {
        grid.classList.remove('hidden');
        document.getElementById('empty-state').classList.add('hidden');

        // Creazione Card con DocumentFragment per un unico reflow DOM
        const fragment = document.createDocumentFragment();

        for (const m of filtered) {
            const div = document.createElement('div');
            div.className = "card-scheda";

            // Logica Drag and Drop
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'manoscritto', id: m.id }));
                e.dataTransfer.effectAllowed = 'move';
                div.classList.add('opacity-50');
            };
            div.ondragend = () => div.classList.remove('opacity-50');

            const allegatiRender = normalizzaAllegati(m);

            let allegatoHTML = '';
            const btnTrascriviModifica = `
                <button onclick="editItem('${m.id}')" class="btn btn-secondary flex-1 text-xs uppercase tracking-wider">
                    <span class="text-xs font-bold uppercase tracking-wider">Modifica</span>
                </button>
                <button onclick="apriTrascrizione('${m.id}')" class="btn flex-1 text-xs uppercase tracking-wider" style="background-color: var(--color-primary-light); color: var(--color-primary-hover); border: 1px solid var(--color-primary-border);">
                    <span class="text-xs font-bold uppercase tracking-wider">Trascrivi</span>
                </button>
            `;

            let btnVediPdfPiccolo = '';

            if (allegatiRender.length > 0 && window.apiBrowser) {
                btnVediPdfPiccolo = `<button onclick="apriModalDocumenti('${m.id}')" class="btn btn-ghost text-xs uppercase tracking-wider"> Mostra Documenti (${allegatiRender.length})</button>`;
                allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
            } else {
                allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
            }

            let tagsHTML = '';
            if (m.tags) {
                const tagsList = m.tags.split(',').map(t => t.trim()).filter(t => t);
                if (tagsList.length > 0) {
                    tagsHTML = '<div class="flex flex-wrap gap-1 mt-2">' + tagsList.map(t => `<span class="card-tag">${t}</span>`).join('') + '</div>';
                }
            }

            let infoHTML = '';
            const tipoDoc = appData.tipiDocumento.find(t => t.id === (m.tipoDocumento || 'manoscritto'));
            const campiPossibili = tipoDoc ? tipoDoc.campi : ['titolo', 'autore', 'note'];
            campiPossibili.forEach(campo => {
                if (m[campo]) {
                    let conf = CONFIG_CAMPI[campo] || { type: 'text' };
                    if (conf.type === 'dynamic_list' && Array.isArray(m[campo])) {
                        if (m[campo].length > 0) {
                            const labelStr = conf.label || campo;
                            infoHTML += `<div class="mt-3 mb-1"><span class="font-bold text-xs uppercase tracking-wider opacity-70 border-b border-stone-200/50 pb-1">${labelStr}</span></div>`;
                            m[campo].forEach(item => {
                                const k = item.k || item.ruolo || '';
                                const v = item.v || item.nome || '';
                                if (k || v) {
                                    infoHTML += `<p class="truncate pl-2 border-l-2 border-amber-200/50 mb-0.5"><b>${k}:</b> ${v}</p>`;
                                }
                            });
                        }
                    } else {
                        const label = conf.label || campo;
                        if (campo === 'note') infoHTML += `<p class="text-stone-500 mt-2 text-xs italic line-clamp-3 leading-relaxed border-l-2 border-amber-200 pl-2" title="${m.note.replace(/"/g, '&quot;')}">${m.note}</p>`;
                        else if (campo === 'titolo') infoHTML += `<p class="truncate mt-1"><b>${label}:</b> <i>${m.titolo}</i></p>`;
                        else infoHTML += `<p class="truncate mt-1"><b>${label}:</b> ${m[campo]}</p>`;
                    }
                }
            });

            div.innerHTML = `
                <div>
                    <div class="flex justify-between items-start gap-2 mb-2">
                        <h3 class="card-title mb-0" title="${m.segnatura}">${m.segnatura}</h3>
                        <span class="card-badge shrink-0 mt-0">${tipoDoc ? tipoDoc.nome : 'Documento'}</span>
                    </div>
                    <div class="space-y-1 text-sm">
                        ${infoHTML}
                        ${tagsHTML}
                    </div>
                    ${allegatoHTML}
                </div>
                <div class="mt-3 pt-3 border-t border-amber-100 flex justify-end gap-2">
                    ${btnVediPdfPiccolo}
                    <button onclick="deleteItem('${m.id}')" class="btn btn-ghost btn-icon" style="color: var(--color-danger);"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            `;
            fragment.appendChild(div);
        }

        grid.appendChild(fragment);
    }
    // createIcons scoped solo alla grid, non all'intero documento
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
}

function switchTab(tab) {
    const vList = document.getElementById('view-list');
    const vAdd = document.getElementById('view-add');
    const vTrascrizione = document.getElementById('view-trascrizione');

    vList.classList.add('hidden-tab');
    vAdd.classList.add('hidden-tab');
    if (vTrascrizione) vTrascrizione.classList.add('hidden-tab');

    if (tab === 'list') {
        vList.classList.remove('hidden-tab');
        resetForm(); renderMain();
    } else if (tab === 'add') {
        vAdd.classList.remove('hidden-tab');
        aggiornaSelectCartelle();
        aggiornaSelectTipiDocumento();
    } else if (tab === 'trascrizione') {
        if (vTrascrizione) vTrascrizione.classList.remove('hidden-tab');
    }
    
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
}

function renderSearchSuggestions() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const container = document.getElementById('search-suggestions');
    container.innerHTML = '';

    if (!search) {
        container.innerHTML = '<div class="p-4 text-xs text-stone-400 italic text-center">Digita per vedere i risultati...</div>';
        return;
    }

    const matches = appData.manoscritti.filter(m =>
        (m.segnatura||'').toLowerCase().includes(search) ||
        (m.titolo||'').toLowerCase().includes(search) ||
        (m.autore||'').toLowerCase().includes(search)
    ).slice(0, 10); // Massimo 10 suggerimenti

    if (matches.length === 0) {
        container.innerHTML = '<div class="p-4 text-xs text-stone-400 italic text-center">Nessun match esatto nei titoli/autori.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    matches.forEach(m => {
        const div = document.createElement('div');
        div.className = "p-2 border-b border-stone-200 hover:bg-amber-50 cursor-pointer transition-colors";
        div.onclick = () => {
            document.getElementById('search-input').value = m.segnatura;
            renderMain();
            renderSearchSuggestions();
        };
        div.innerHTML = `
            <div class="text-xs font-bold text-stone-700 truncate">${m.segnatura}</div>
            ${m.titolo ? `<div class="text-[10px] text-stone-500 truncate mt-0.5"><i>${m.titolo}</i></div>` : ''}
            ${m.autore ? `<div class="text-[10px] text-stone-500 truncate mt-0.5"><b>Autore:</b> ${m.autore}</div>` : ''}
        `;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
}

