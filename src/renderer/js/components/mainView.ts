// @ts-nocheck
// Campi su cui viene eseguita la ricerca testuale (whitelist esplicita)
const SEARCH_FIELDS = ['segnatura', 'titolo', 'autore', 'datazione', 'supporto', 'incipit', 'explicit', 'note', 'tags', 'trascrizione', 'descrizione', 'provenienza', 'contenuto', 'lingua'];

function objectContainsString(m, str) {
    for (const k of SEARCH_FIELDS) {
        const v = m[k];
        if (!v) continue;
        if (typeof v === 'string' && v.toLowerCase().includes(str)) return true;
        if (typeof v === 'number' && v.toString().includes(str)) return true;
    }
    return false;
}

window.currentPage = 0;
const PAGE_SIZE = 50;

// Calcola l'elenco dei manoscritti visibili nella griglia secondo gli stessi
// criteri di renderMain (cartella + ricerca + tag). Esposto su window così che
// altri componenti (es. suggerimenti di ricerca) possano localizzare un record.
window.getManoscrittiFiltrati = function() {
    const search = document.getElementById('search-input').value.trim().toLowerCase();
    window.activeTags = window.activeTags || new Set();
    const isGlobalSearch = search !== '' || window.activeTags.size > 0;

    return appData.manoscritti.filter(m => {
        const matchCartella = isGlobalSearch ? true : m.cartella === window.cartellaAttuale;
        const matchSearch = search === '' || objectContainsString(m, search);

        const mTags = (m.tags || '').toLowerCase();
        let matchTag = true;
        if (window.activeTags.size > 0) {
            for (const tag of window.activeTags) {
                if (!mTags.includes(tag)) {
                    matchTag = false;
                    break;
                }
            }
        }

        return matchCartella && matchSearch && matchTag;
    });
};

/**
 * Abilita "Elimina archivio" solo quando l'operazione è davvero possibile, spiegando
 * nel tooltip il motivo del blocco invece di far sparire il pulsante.
 */
function aggiornaStatoEliminaCartella() {
    const btn = document.getElementById('btn-delete-folder');
    if (!btn) return;

    const cartella = window.cartellaAttuale;
    const vuota = !appData.manoscritti.some(m => m.cartella === cartella);
    const isRadice = !cartella;
    const abilitato = vuota && !isRadice;

    btn.disabled = !abilitato;
    let motivo;
    if (isRadice) motivo = window.t('tooltip_delete_folder_root', "La radice dell'archivio non può essere eliminata");
    else if (!vuota) motivo = window.t('tooltip_delete_folder_not_empty', 'Puoi eliminare solo un archivio vuoto');
    else motivo = window.t('tooltip_delete_folder', 'Elimina questo archivio');
    btn.title = motivo;
    btn.setAttribute('aria-label', motivo);
}

/**
 * Intestazione della vista lista: breadcrumb del percorso + titolo + chip dei filtri
 * attivi. Serve a rendere VISIBILE lo stato che altrimenti governa la griglia in modo
 * silenzioso: ricerca globale e tag vivono in tab della sidebar che possono essere
 * chiuse, ma continuano a scavalcare la cartella selezionata in getManoscrittiFiltrati.
 */
function renderIntestazioneVista(isGlobalSearch, search) {
    const titolo = document.getElementById('titolo-cartella-attuale');
    const crumbs = document.getElementById('breadcrumb-cartella');
    const icona = document.getElementById('icona-vista-corrente');

    if (crumbs) crumbs.innerHTML = '';

    if (isGlobalSearch) {
        titolo.textContent = window.t("search_results_title", "Risultati ricerca globale");
        if (icona) icona.setAttribute('data-lucide', 'search');
    } else if (!window.cartellaAttuale) {
        // Radice virtuale: nessun breadcrumb da mostrare (non ha antenati)
        titolo.textContent = typeof window.etichettaRadice === 'function'
            ? window.etichettaRadice()
            : window.t('folder_root_label', 'Archivio');
        if (icona) icona.setAttribute('data-lucide', 'library');
    } else {
        const parti = window.cartellaAttuale.split('/');
        titolo.textContent = parti[parti.length - 1];
        if (icona) icona.setAttribute('data-lucide', 'folder-open');

        // Breadcrumb cliccabile sugli antenati: due cartelle con lo stesso nome in rami
        // diversi erano indistinguibili mostrando solo l'ultimo segmento.
        if (crumbs && parti.length > 1) {
            parti.slice(0, -1).forEach((parte, i) => {
                const percorso = parti.slice(0, i + 1).join('/');
                const link = document.createElement('button');
                link.type = 'button';
                link.className = 'hover:text-amber-700 hover:underline truncate max-w-[12rem]';
                link.textContent = parte;
                link.onclick = () => window.vaiACartella(percorso);
                crumbs.appendChild(link);
                const sep = document.createElement('span');
                sep.className = 'text-stone-300 dark:text-stone-600 select-none';
                sep.textContent = '/';
                crumbs.appendChild(sep);
            });
        }
    }

    if (icona && window.lucide) lucide.createIcons({ nodes: [icona.parentElement] });
    renderFiltriAttivi(search);
}

/** Chip dei filtri attivi (ricerca + tag), ognuno rimovibile senza aprire la sidebar. */
function renderFiltriAttivi(search) {
    const bar = document.getElementById('active-filters');
    if (!bar) return;

    const tags = window.activeTags ? [...window.activeTags] : [];
    bar.innerHTML = '';

    if (!search && tags.length === 0) {
        bar.classList.add('hidden');
        bar.classList.remove('flex');
        return;
    }
    bar.classList.remove('hidden');
    bar.classList.add('flex');

    const label = document.createElement('span');
    label.className = 'text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500';
    label.textContent = window.t('label_active_filters', 'Filtri attivi');
    bar.appendChild(label);

    const chip = (icona, testo, titoloRimozione, onRemove) => {
        const el = document.createElement('span');
        el.className = 'inline-flex items-center gap-1.5 pl-2 pr-1 py-1 text-xs font-medium rounded-sm bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 max-w-[18rem]';
        const ico = document.createElement('i');
        ico.setAttribute('data-lucide', icona);
        ico.className = 'w-3.5 h-3.5 shrink-0';
        const txt = document.createElement('span');
        txt.className = 'truncate';
        txt.textContent = testo;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shrink-0 chip-remove-btn rounded-sm hover:bg-amber-200 dark:hover:bg-amber-800/50';
        btn.title = titoloRimozione;
        btn.setAttribute('aria-label', titoloRimozione);
        btn.innerHTML = '<i data-lucide="x" class="w-3.5 h-3.5"></i>';
        btn.onclick = onRemove;
        el.append(ico, txt, btn);
        bar.appendChild(el);
    };

    if (search) {
        const input = document.getElementById('search-input');
        chip('search', window.t('filter_search', 'Ricerca') + ': ' + input.value.trim(),
            window.t('filter_remove_search', 'Rimuovi la ricerca'), () => {
                input.value = '';
                if (typeof renderSearchSuggestions === 'function') renderSearchSuggestions();
                renderMain();
            });
    }

    tags.forEach(tag => {
        chip('bookmark', '#' + tag, window.t('filter_remove_tag', 'Rimuovi questo tag'), () => {
            window.activeTags.delete(tag);
            if (typeof renderTagList === 'function') renderTagList();
            renderMain();
        });
    });

    if (search || tags.length > 1) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'text-xs font-medium text-stone-500 hover:text-red-600 underline ml-1';
        clear.textContent = window.t('btn_clear_filters', 'Azzera tutti i filtri');
        clear.onclick = () => {
            window.azzeraFiltriRicerca();
            renderMain();
        };
        bar.appendChild(clear);
    }

    if (window.lucide) lucide.createIcons({ nodes: [bar] });
}

// renderMain è sincrona: non usa await, non deve essere async
function renderMain(resetPage = true) {
    if (resetPage) window.currentPage = 0;

    const grid = document.getElementById('manoscritti-grid');
    const search = document.getElementById('search-input').value.trim().toLowerCase();

    window.activeTags = window.activeTags || new Set();
    const isGlobalSearch = search !== '' || window.activeTags.size > 0;

    renderIntestazioneVista(isGlobalSearch, search);

    // Filtro per Cartella (se non globale) E per Ricerca Profonda E per (Multi) Tag
    const filtered = window.getManoscrittiFiltrati();

    // Etichetta diversa quando si naviga una cartella (non si sta cercando)
    const counterKey = isGlobalSearch ? 'counter_documents_found' : 'counter_documents';
    const counterFallback = isGlobalSearch ? 'Documenti trovati: {var0}' : 'Documenti: {var0}';
    document.getElementById('counter-results').textContent = window.t(counterKey, counterFallback).replace('{var0}', String(filtered.length));
    grid.innerHTML = '';

    const paginationControls = document.getElementById('pagination-controls');

    // Zona 3: "Elimina archivio" ha posizione fissa nella barra azioni e cambia solo
    // stato (prima appariva/spariva dentro l'empty state, quindi si spostava da sola).
    aggiornaStatoEliminaCartella();

    if (filtered.length === 0) {
        grid.classList.add('hidden');
        if (paginationControls) {
            paginationControls.classList.add('hidden');
            paginationControls.classList.remove('flex');
        }
        document.getElementById('empty-state').classList.remove('hidden');

        // Messaggio coerente con il motivo reale dello zero risultati: con ricerca o tag
        // attivi la cartella può essere piena, e "La cartella è vuota" è fuorviante.
        const emptyText = document.getElementById('empty-state-text');
        if (emptyText) {
            const key = isGlobalSearch ? 'no_search_match' : 'folder_empty';
            emptyText.setAttribute('data-i18n', key);
            emptyText.textContent = isGlobalSearch
                ? window.t('no_search_match', 'Nessun documento corrisponde ai filtri attivi.')
                : window.t('folder_empty', 'La cartella è vuota.');
        }

    } else {
        grid.classList.remove('hidden');
        document.getElementById('empty-state').classList.add('hidden');

        // Paginazione
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        if (window.currentPage >= totalPages) window.currentPage = Math.max(0, totalPages - 1);
        const paginated = filtered.slice(window.currentPage * PAGE_SIZE, (window.currentPage + 1) * PAGE_SIZE);

        if (paginationControls) {
            if (totalPages > 1) {
                paginationControls.classList.remove('hidden');
                paginationControls.classList.add('flex');
                document.getElementById('page-indicator').textContent = `Pagina ${window.currentPage + 1} di ${totalPages}`;
                const btnPrev = document.getElementById('btn-prev-page');
                const btnNext = document.getElementById('btn-next-page');
                if (btnPrev) btnPrev.disabled = window.currentPage === 0;
                if (btnNext) btnNext.disabled = window.currentPage === totalPages - 1;
            } else {
                paginationControls.classList.add('hidden');
                paginationControls.classList.remove('flex');
            }
        }

        // Creazione Card con DocumentFragment per un unico reflow DOM
        const fragment = document.createDocumentFragment();

        for (const m of paginated) {
            const isSelected = window.selectedRecords && window.selectedRecords.includes(m.id);
            const hasSelection = window.selectedRecords && window.selectedRecords.length > 0;
            const div = document.createElement('div');
            div.className = `card-scheda bg-white p-4 relative flex flex-col justify-between cursor-pointer group ${isSelected ? 'ring-2 ring-amber-500 bg-amber-50/20' : ''}`;
            div.id = 'card-' + m.id;
            
            div.onclick = (e) => {
                if (e.target.closest('button') || e.target.closest('a') || e.target.tagName.toLowerCase() === 'input') return;
                if (typeof window.selectItem === 'function') {
                    window.selectItem(m.id, e);
                }
            };



            // Logica Drag and Drop
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'manoscritto', id: m.id }));
                e.dataTransfer.effectAllowed = 'move';
                div.classList.add('opacity-50');
            };
            div.ondragend = () => div.classList.remove('opacity-50');
            
            // Context menu per Copia/Incolla
            div.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof showRecordContextMenu === 'function') {
                    showRecordContextMenu(e, m.id);
                }
            };

            const allegatiRender = normalizzaAllegati(m);

            let allegatoHTML = '';
            const btnTrascriviModifica = `
                <button onclick="editItem('${m.id}')" class="btn btn-secondary flex-1 text-xs uppercase tracking-wider tutorial-modifica-btn">
                    <span class="text-xs font-bold uppercase tracking-wider">${window.t('btn_edit') || 'Modifica'}</span>
                </button>
                <button onclick="apriTrascrizione('${m.id}')" class="btn flex-1 text-xs uppercase tracking-wider tutorial-trascrivi-btn" style="background-color: var(--color-primary-light); color: var(--color-primary-hover); border: 1px solid var(--color-primary-border);">
                    <span class="text-xs font-bold uppercase tracking-wider">${window.t('btn_transcribe') || 'Trascrivi'}</span>
                </button>
            `;

            let btnVediPdfPiccolo = '';

            if (allegatiRender.length > 0) {
                const textAllegati = allegatiRender.length === 1
                    ? window.t('attachment_count_one', '1 documento allegato')
                    : window.t('attachment_count_many', '{var0} documenti allegati').replace('{var0}', String(allegatiRender.length));
                btnVediPdfPiccolo = `<span class="text-xs text-stone-500 font-medium my-auto mr-auto flex items-center gap-1"><i data-lucide="paperclip" class="w-3.5 h-3.5"></i> ${textAllegati}</span>`;
                allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
            } else {
                allegatoHTML = `<div class="mt-3 flex gap-2">${btnTrascriviModifica}</div>`;
            }

            let tagsHTML = '';
            if (m.tags) {
                const tagsList = m.tags.split(',').map(t => t.trim()).filter(t => t);
                if (tagsList.length > 0) {
                    tagsHTML = '<div class="flex flex-wrap gap-1 mt-2">' + tagsList.map(t => `<span class="card-tag">${escapeHTML(t)}</span>`).join('') + '</div>';
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
                            const labelStr = window.t('field_' + campo) !== 'field_' + campo ? window.t('field_' + campo) : (conf.label || campo);
                            infoHTML += `<div class="mt-3 mb-1"><span class="font-bold text-xs uppercase tracking-wider opacity-70 border-b border-stone-200/50 pb-1">${labelStr}</span></div>`;
                            m[campo].forEach(item => {
                                const k = item.k || item.ruolo || '';
                                const v = item.v || item.nome || '';
                                if (k || v) {
                                    infoHTML += `<p class="truncate pl-2 border-l-2 border-amber-200/50 mb-0.5"><b>${escapeHTML(k)}:</b> ${escapeHTML(v)}</p>`;
                                }
                            });
                        }
                    } else {
                        const label = window.t('field_' + campo) !== 'field_' + campo ? window.t('field_' + campo) : (conf.label || campo);
                        if (campo === 'note') infoHTML += `<p class="text-stone-500 mt-2 text-xs italic line-clamp-3 leading-relaxed border-l-2 border-amber-200 pl-2" title="${escapeHTML(m.note)}">${escapeHTML(m.note)}</p>`;
                        else if (campo === 'titolo') infoHTML += `<p class="truncate mt-1"><b>${escapeHTML(label)}:</b> <i>${escapeHTML(m.titolo)}</i></p>`;
                        else infoHTML += `<p class="truncate mt-1"><b>${escapeHTML(label)}:</b> ${escapeHTML(m[campo])}</p>`;
                    }
                }
            });

            let authorBadgeHTML = '';
            if (m.creatoDa || m.modificatoDa) {
                const autore = m.modificatoDa || m.creatoDa; // Mostriamo chi ha fatto l'ultima azione
                const titoloMeta = m.modificatoDa && m.creatoDa && m.modificatoDa !== m.creatoDa 
                    ? `Creato da ${escapeHTML(m.creatoDa)} - Modificato da ${escapeHTML(m.modificatoDa)}` 
                    : `Autore: ${escapeHTML(autore)}`;

                authorBadgeHTML = `<span title="${titoloMeta}" class="flex items-center gap-1 text-[10px] font-semibold text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded-sm">
                    <i data-lucide="user" class="w-3 h-3"></i> ${escapeHTML(autore)}
                </span>`;
            }

            let dateHTML = '';
            if (m.lastModified) {
                const dataFormat = new Date(m.lastModified).toLocaleDateString('it-IT', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                });
                dateHTML = `<div class="text-[9px] text-stone-400 font-mono mt-2.5 pt-2 border-t border-dashed border-stone-200/50 text-right">${dataFormat}</div>`;
            }

            // Checkbox di selezione (visibile quando c'è almeno un record selezionato)
            const checkboxHTML = hasSelection ? `
                <div class="absolute top-2 left-2 z-10" onclick="event.stopPropagation(); window.selectItem('${m.id}', event)">
                    <div class="flex items-center justify-center w-5 h-5 rounded border-2 shadow-sm cursor-pointer transition-all duration-150
                        ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white/90 border-stone-300 text-transparent hover:border-amber-400'}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                </div>
            ` : '';

            div.innerHTML = `
                ${checkboxHTML}
                <div class="px-1 ${hasSelection ? 'pl-7' : ''}">
                    <div class="flex justify-between items-start gap-2 mb-2">
                        <h3 class="card-title mb-0" title="${escapeHTML(m.segnatura)}">${escapeHTML(m.segnatura)}</h3>
                        <div class="flex items-center gap-1.5 shrink-0 mt-0">
                            ${authorBadgeHTML}
                            <span class="card-badge shrink-0">${escapeHTML(tipoDoc ? (window.t('model_' + tipoDoc.id) !== 'model_' + tipoDoc.id ? window.t('model_' + tipoDoc.id) : tipoDoc.nome) : 'Documento')}</span>
                        </div>
                    </div>
                    <div class="space-y-1 text-sm">
                        ${infoHTML}
                        ${tagsHTML}
                    </div>
                    ${allegatoHTML}
                    ${dateHTML}
                </div>
                <div class="mt-3 pt-3 border-t border-amber-100 flex justify-end items-center gap-2">
                    ${btnVediPdfPiccolo}
                    <span class="card-overflow-slot flex"></span>
                </div>
            `;

            // Fase 4.2 — Esporta ed Elimina non stanno più come icone sempre visibili in
            // fondo alla card (competevano con Modifica/Trascrivi, le azioni vere): sono
            // nel "⋯", che è lo stesso menu del tasto destro.
            const slot = div.querySelector('.card-overflow-slot');
            if (slot && typeof window.creaBottoneOverflow === 'function') {
                slot.appendChild(window.creaBottoneOverflow(
                    () => window.vociMenuRecord(m.id),
                    {
                        className: 'btn btn-ghost btn-icon card-overflow-btn',
                        // Selezionare la scheda ri-disegna la griglia: recuperiamo il
                        // pulsante ricreato per ancorarci il menu.
                        preparaApertura: () => {
                            window.assicuraSelezioneRecord(m.id);
                            const card = document.getElementById('card-' + m.id);
                            return card ? card.querySelector('.card-overflow-btn') : null;
                        }
                    }
                ));
            }
            fragment.appendChild(div);
        }

        grid.appendChild(fragment);
    }
    // createIcons scoped solo alla grid, non all'intero documento
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
}

window.pendingTabSwitch = null;

function switchTab(tab) {
    const vAdd = document.getElementById('view-add');
    if (!vAdd.classList.contains('hidden-tab') && window.isFormDirty && tab !== 'add') {
        window.pendingTabSwitch = tab;
        if (window.mostraBottomConfirm) {
            window.mostraBottomConfirm(window.t('unsaved_prompt') || "Ci sono modifiche non salvate alla scheda. Sei sicuro di voler uscire perdendo le modifiche?", () => {
                window.isFormDirty = false;
                switchTab(window.pendingTabSwitch);
            });
            return;
        }
    }

    const vList = document.getElementById('view-list');
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

function extractSnippet(val, search) {
    if (!val) return null;
    const strVal = val.toString();
    
    const cleanText = strVal.replace(/<[^>]*>/g, '');
    
    const lowerStr = cleanText.toLowerCase();
    const idx = lowerStr.indexOf(search);
    
    if (idx !== -1) {
        // Estrai una frase più lunga
        const start = Math.max(0, idx - 60);
        const end = Math.min(cleanText.length, idx + search.length + 80);
        let snippet = cleanText.substring(start, end).trim();
        
        if (start > 0) snippet = '...' + snippet;
        if (end < cleanText.length) snippet = snippet + '...';

        snippet = escapeHTML(snippet);
        const escapedSearch = escapeHTML(search);

        // Evidenzia la parola trovata
        const regex = new RegExp(`(${escapedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        snippet = snippet.replace(regex, '<span class="bg-amber-200 text-amber-900 font-bold px-0.5 rounded">$1</span>');
        return snippet;
    }
    return null;
}

function renderSearchSuggestions() {
    const search = document.getElementById('search-input').value.trim().toLowerCase();
    const container = document.getElementById('search-suggestions');
    container.innerHTML = '';

    if (!search) {
        container.innerHTML = '<div class="p-4 text-xs text-stone-400 italic text-center">Digita per vedere i risultati...</div>';
        return;
    }

    const matches = [];
    for (const m of appData.manoscritti) {
        let matchFound = null;
        const keys = Object.keys(m);
        
        // Ordiniamo le chiavi per dare priorità a segnatura e titolo
        keys.sort((a, b) => {
            if (a === 'segnatura') return -1;
            if (b === 'segnatura') return 1;
            if (a === 'titolo') return -1;
            if (b === 'titolo') return 1;
            return 0;
        });

        for (const key of keys) {
            if (key === 'id' || key === 'cartella' || key === 'allegati' || key === 'tipoDocumento') continue;
            const snippet = extractSnippet(m[key], search);
            if (snippet) {
                let readableKey = key.charAt(0).toUpperCase() + key.slice(1);
                matchFound = { item: m, key: readableKey, snippet: snippet };
                break; // Mostriamo solo il primo campo in cui matcha per questo documento
            }
        }
        if (matchFound) {
            matches.push(matchFound);
        }
        if (matches.length >= 15) break; // Massimo 15 suggerimenti
    }

    if (matches.length === 0) {
        container.innerHTML = `<div class="p-4 text-xs text-stone-400 italic text-center">${window.t('no_search_match')}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    matches.forEach(match => {
        const div = document.createElement('div');
        div.className = "p-2 border-b border-stone-200 hover:bg-amber-50 cursor-pointer transition-colors";
        div.onclick = () => window.rivelaRecordNellaGriglia(match.item.id);
        div.innerHTML = `
            <div class="text-xs font-bold text-stone-800 truncate mb-1">${escapeHTML(match.item.segnatura || match.item.titolo || 'Senza Titolo')}</div>
            <div class="text-[10px] text-stone-600 leading-tight">
                <span class="font-semibold text-amber-700 capitalize">${escapeHTML(match.key)}:</span> ${match.snippet}
            </div>
        `;
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
}

/**
 * Porta l'utente sulla card di un record nella griglia di destra: salta alla pagina
 * corretta (la griglia è paginata a PAGE_SIZE, altrimenti la card non è nel DOM),
 * scrolla e la evidenzia. Usata dai suggerimenti di ricerca e dall'albero a sinistra.
 */
window.rivelaRecordNellaGriglia = function(id) {
    const filtrati = window.getManoscrittiFiltrati();
    const idx = filtrati.findIndex(x => x.id === id);
    if (idx !== -1) {
        const paginaTarget = Math.floor(idx / PAGE_SIZE);
        if (window.currentPage !== paginaTarget) {
            window.currentPage = paginaTarget;
            renderMain(false);
        }
    }

    const targetCard = document.getElementById('card-' + id);
    if (!targetCard) {
        // Il record non rientra nel filtro corrente della griglia (es. suggerimento di
        // ricerca su un campo non incluso nel filtro): non c'è nulla su cui scrollare.
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(window.t('msg_record_non_in_vista', 'Documento non visibile nella vista corrente.'), 'info');
        }
        return;
    }

    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Evidenziazione temporanea per indicare quale scheda è stata raggiunta
    targetCard.style.transition = "box-shadow 0.3s ease, border-color 0.3s ease";
    const oldShadow = targetCard.style.boxShadow;
    const oldBorder = targetCard.style.borderColor;
    targetCard.style.boxShadow = "0 0 0 4px rgba(251, 191, 36, 0.4)";
    targetCard.style.borderColor = "#f59e0b";
    setTimeout(() => {
        targetCard.style.boxShadow = oldShadow;
        targetCard.style.borderColor = oldBorder;
    }, 1500);
};

window.cambiaPagina = function(dir) {
    window.currentPage += dir;
    renderMain(false);
    // Scrolla la vista all'inizio
    const viewList = document.getElementById('view-list');
    if (viewList) viewList.scrollTo({ top: 0, behavior: 'smooth' });
};
