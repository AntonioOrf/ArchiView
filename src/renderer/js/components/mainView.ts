// @ts-nocheck
// Campi base su cui viene eseguita la ricerca testuale.
// Non è più la whitelist completa: getSearchFields() vi somma a runtime i campi dei tipi
// definiti dall'utente, che altrimenti non sarebbero cercabili nella griglia pur comparendo
// nei suggerimenti (una scheda risultava "non visibile nella vista corrente" proprio quando
// la si era trovata cercando in un campo custom).
const SEARCH_FIELDS_BASE = ['segnatura', 'titolo', 'autore', 'datazione', 'supporto', 'incipit', 'explicit', 'note', 'tags', 'trascrizione', 'descrizione', 'provenienza', 'contenuto', 'lingua'];

// --- Cache del testo indicizzato ---------------------------------------------
// La ricerca scansionava tutti i campi di tutti i record ad ogni keystroke (incluse le
// trascrizioni, con strip-HTML via regex per record): O(dimensione DB) per battuta.
// Qui il testo ripulito e in minuscolo è calcolato una volta per record e invalidato
// a ogni commit dello Store tramite un contatore di generazione.
const SNIPPET_SKIP_FIELDS = new Set(['id', 'cartella', 'allegati', 'tipoDocumento']);
let searchCacheGen = 0;
let searchCache = new WeakMap();

// Chiamata da Store.commit(): i testi cache-ati potrebbero non riflettere più i record.
window.invalidaCacheRicerca = function() {
    searchCacheGen++;
};

// Campi indicizzati = base + tutti quelli dichiarati dai tipi documento (inclusi i custom).
// Ricalcolata solo quando la cache dei testi viene invalidata: i tipi cambiano di rado.
let searchFieldsCache = null;
let searchFieldsGen = -1;
function getSearchFields() {
    if (searchFieldsCache && searchFieldsGen === searchCacheGen) return searchFieldsCache;
    const set = new Set(SEARCH_FIELDS_BASE);
    const tipi = (typeof appData !== 'undefined' && appData.tipiDocumento) || [];
    for (const t of tipi) {
        for (const c of (t.campi || [])) {
            // I campi sono id stringa; la forma a oggetto è ammessa per compatibilità futura.
            const id = typeof c === 'string' ? c : (c && c.id);
            if (id) set.add(id);
        }
    }
    searchFieldsCache = Array.from(set);
    searchFieldsGen = searchCacheGen;
    return searchFieldsCache;
}

/**
 * Riduce a testo il valore di un campo. Oltre a stringhe e numeri gestisce le
 * dynamic_list (attori, beni, debiti, crediti, familiari): sono coppie {k, v} e
 * contengono i nomi di persona, cioè proprio ciò che si cerca più spesso in un
 * archivio notarile, ma finora non finivano nell'indice.
 */
function testoIndicizzabile(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) {
        let out = '';
        for (const el of v) {
            if (el === null || el === undefined) continue;
            if (typeof el === 'string' || typeof el === 'number') out += el + ' ';
            else if (typeof el === 'object') out += (el.k || '') + ' ' + (el.v || '') + ' ';
        }
        return out;
    }
    return '';
}

function getSearchIndex(m) {
    const cached = searchCache.get(m);
    if (cached && cached.gen === searchCacheGen) return cached;

    // Campi per i suggerimenti: tutti i testuali, con segnatura/titolo in testa.
    const fields = [];
    for (const key of Object.keys(m)) {
        if (SNIPPET_SKIP_FIELDS.has(key)) continue;
        const v = m[key];
        if (v === null || v === undefined) continue;
        if (typeof v !== 'string' && typeof v !== 'number') continue;
        const clean = String(v).replace(/<[^>]*>/g, '');
        if (!clean) continue;
        fields.push({
            key,
            readable: key.charAt(0).toUpperCase() + key.slice(1),
            clean,
            lower: clean.toLowerCase(),
            norm: window.normalizzaTesto(clean)
        });
    }
    const priority = (k) => (k === 'segnatura' ? 0 : k === 'titolo' ? 1 : 2);
    fields.sort((a, b) => priority(a.key) - priority(b.key));

    // Fieno per il filtro della griglia, normalizzato una volta sola per record.
    let hay = '';
    for (const k of getSearchFields()) {
        const t = testoIndicizzabile(m[k]);
        if (t) hay += t + '\n';
    }
    hay = window.normalizzaTesto(hay);

    const entry = { gen: searchCacheGen, fields, hay };
    searchCache.set(m, entry);
    return entry;
}

/** Il record passa se contiene TUTTI i token, anche sparsi su campi diversi. */
function objectMatchesTokens(m, tokens) {
    const hay = getSearchIndex(m).hay;
    for (const t of tokens) {
        if (!hay.includes(t)) return false;
    }
    return true;
}

// --- Ordinamento -------------------------------------------------------------
// Fino alla 2.4.5 la lista non era ordinata affatto: l'ordine era quello di inserimento
// nell'array. L'ordinamento va applicato DENTRO getManoscrittiFiltrati, non in renderMain:
// rivelaRecordNellaGriglia calcola la pagina di un record con Math.floor(idx / pageSize())
// sullo stesso elenco, e se i due ordini divergessero salterebbe alla pagina sbagliata.
window.sortState = window.sortState || { campo: 'segnatura', dir: 'asc' };

// Nota: non esiste una lista fissa di campi ordinabili. I criteri del menu a tendina
// sono derivati a runtime dai tipi documento presenti nell'elenco (criteriOrdinamento),
// e in tabella si ordina per qualsiasi colonna visibile. Una whitelist statica proponeva
// criteri inesistenti fra i record mostrati (es. "Autore" fra le schede fiscali).
// `createdAt` non esiste nel modello: c'è solo lastModified.

/** Un valore "vuoto" (mancante o solo spazi) tiene il record in coda, in ogni direzione. */
function valoreMancante(m, campo) {
    if (campo === 'lastModified' || campo === 'allegati') return false;
    const v = m[campo];
    return v === null || v === undefined || String(v).trim() === '';
}

function confrontaCampo(a, b, campo) {
    if (campo === 'lastModified') return (a.lastModified || 0) - (b.lastModified || 0);
    if (campo === 'allegati') return normalizzaAllegati(a).length - normalizzaAllegati(b).length;
    return window.confrontaNaturale(a[campo], b[campo]);
}

/**
 * Ordina in place (l'array arriva da .filter(), quindi è già una copia).
 * La direzione si applica al solo criterio primario: i record senza valore restano in
 * fondo anche invertendo, e il tie-break sulla segnatura resta ascendente, così l'ordine
 * è deterministico e la paginazione non "balla" fra due render identici.
 */
function ordinaManoscritti(lista) {
    const campo = (window.sortState && window.sortState.campo) || 'segnatura';
    const segno = (window.sortState && window.sortState.dir === 'desc') ? -1 : 1;

    return lista.sort((a, b) => {
        const aVuoto = valoreMancante(a, campo);
        const bVuoto = valoreMancante(b, campo);
        if (aVuoto !== bVuoto) return aVuoto ? 1 : -1;

        const primario = confrontaCampo(a, b, campo) * segno;
        if (primario !== 0) return primario;
        return campo === 'segnatura' ? 0 : window.confrontaNaturale(a.segnatura, b.segnatura);
    });
}

/** Imposta il criterio (ri-cliccare lo stesso campo inverte la direzione) e ridisegna. */
window.impostaOrdinamento = function(campo, dir) {
    // Qualsiasi campo è ammesso, non solo quelli del menu: le intestazioni della tabella
    // includono i campi del tipo documento, che sono diversi da archivio ad archivio.
    // confrontaCampo cade sul confronto naturale per tutto ciò che non è un caso speciale.
    if (typeof campo !== 'string' || !campo) return;
    const stato = window.sortState;
    window.sortState = {
        campo,
        dir: dir || (stato.campo === campo && stato.dir === 'asc' ? 'desc' : 'asc')
    };
    // La pagina corrente non ha più senso dopo un riordino: si torna alla prima.
    renderMain();
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
};

window.currentPage = 0;
// In modalità prestazioni ridotte si dimezza la pagina: meno card in DOM per render.
const PAGE_SIZE_STANDARD = 50;
const PAGE_SIZE_RIDOTTO = 25;
function pageSize() {
    return window.modalitaPrestazioniRidotte ? PAGE_SIZE_RIDOTTO : PAGE_SIZE_STANDARD;
}

// Calcola l'elenco dei manoscritti visibili nella griglia secondo gli stessi
// criteri di renderMain (cartella + ricerca + tag). Esposto su window così che
// altri componenti (es. suggerimenti di ricerca) possano localizzare un record.
window.getManoscrittiFiltrati = function() {
    const tokens = window.tokenizzaRicerca(document.getElementById('search-input').value);
    window.activeTags = window.activeTags || new Set();
    const isGlobalSearch = tokens.length > 0 || window.activeTags.size > 0;

    // I tag attivi si normalizzano una volta sola, non per ogni record: dentro il filtro
    // sarebbero N×T normalizzazioni per render, proprio sui vault grandi dove pesa di più.
    const tagsNorm = window.activeTags.size > 0
        ? Array.from(window.activeTags).map(t => window.normalizzaTesto(t))
        : null;

    const filtrati = appData.manoscritti.filter(m => {
        const matchCartella = isGlobalSearch ? true : m.cartella === window.cartellaAttuale;
        const matchSearch = tokens.length === 0 || objectMatchesTokens(m, tokens);

        let matchTag = true;
        if (tagsNorm) {
            const mTags = window.normalizzaTesto(m.tags || '');
            for (const tag of tagsNorm) {
                if (!mTags.includes(tag)) {
                    matchTag = false;
                    break;
                }
            }
        }

        return matchCartella && matchSearch && matchTag;
    });

    return ordinaManoscritti(filtrati);
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

// --- Vista tabella -----------------------------------------------------------
window.vistaLista = window.vistaLista || 'griglia';

/** Griglia e tabella sono mutuamente esclusive; con zero risultati non si vede nessuna. */
function mostraContenitoreLista(quale) {
    const grid = document.getElementById('manoscritti-grid');
    const wrap = document.getElementById('manoscritti-table-wrap');
    if (grid) grid.classList.toggle('hidden', quale !== 'griglia');
    if (wrap) wrap.classList.toggle('hidden', quale !== 'tabella');
}

/**
 * Colonne offerte dalla tabella: le fisse più i campi testuali dei tipi presenti
 * NELL'ELENCO CORRENTE. Derivarle dai record e non dall'intero DB evita di mostrare
 * venti colonne vuote quando si sta guardando una cartella di un tipo solo.
 * dynamic_list e attachments restano fuori: non stanno in una cella.
 */
function campiTabellaDisponibili(records) {
    const tipi = new Set(records.map(m => m.tipoDocumento || 'manoscritto'));
    const campi = [];
    for (const tid of tipi) {
        const tipo = appData.tipiDocumento.find(t => t.id === tid);
        for (const c of (tipo ? tipo.campi : ['titolo', 'autore', 'note'])) {
            const conf = CONFIG_CAMPI[c] || { type: 'text' };
            if (conf.type === 'dynamic_list' || conf.type === 'attachments') continue;
            if (!campi.includes(c)) campi.push(c);
        }
    }
    return campi;
}

/** Chiave di persistenza delle colonne: per tipo, o '_misto' se l'elenco ne mescola più d'uno. */
function chiaveColonne(records) {
    const tipi = new Set(records.map(m => m.tipoDocumento || 'manoscritto'));
    return tipi.size === 1 ? Array.from(tipi)[0] : '_misto';
}

window.colonneTabella = window.colonneTabella || {};

function colonneVisibili(chiave, disponibili) {
    const salvate = window.colonneTabella[chiave];
    if (Array.isArray(salvate)) {
        const filtrate = salvate.filter(c => disponibili.includes(c));
        if (filtrate.length > 0) return filtrate;
    }
    // Default: le prime tre, abbastanza per riconoscere una scheda senza sfondare in larghezza.
    return disponibili.slice(0, 3);
}

window.toggleColonnaTabella = function(campo) {
    const paginati = window.__ultimiPaginati || [];
    const disponibili = campiTabellaDisponibili(paginati);
    const chiave = chiaveColonne(paginati);
    const attuali = colonneVisibili(chiave, disponibili);
    // Le colonne restano nell'ordine di `disponibili`: attivarne una non la manda in fondo.
    const nuove = attuali.includes(campo)
        ? attuali.filter(c => c !== campo)
        : disponibili.filter(c => attuali.includes(c) || c === campo);
    window.colonneTabella[chiave] = nuove;
    renderMain(false);
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
};

/**
 * Selettore delle colonne visibili. Riusa il menu contestuale esistente
 * (`apriMenuContestuale`, che sa già ancorarsi a un elemento, gestire frecce/Esc e
 * chiudersi al click fuori) invece di introdurre un secondo tipo di popover.
 */
window.apriSelettoreColonne = function(ancora) {
    const paginati = window.__ultimiPaginati || [];
    const disponibili = campiTabellaDisponibili(paginati);
    if (disponibili.length === 0) return;
    const chiave = chiaveColonne(paginati);
    const visibili = colonneVisibili(chiave, disponibili);

    const voci = [{ heading: true, label: window.t('menu_columns', 'Colonne visibili') }];
    for (const campo of disponibili) {
        const attiva = visibili.includes(campo);
        voci.push({
            label: etichettaCampo(campo),
            icon: attiva ? 'check' : 'minus',
            // Restare con una sola colonna è legittimo; a zero la tabella perderebbe senso,
            // quindi l'ultima attiva non è disattivabile.
            disabled: attiva && visibili.length === 1,
            onSelect: () => window.toggleColonnaTabella(campo)
        });
    }
    window.apriMenuContestuale(ancora || document.querySelector('#context-overflow-slot button'), voci);
};

function etichettaCampo(campo) {
    const conf = CONFIG_CAMPI[campo] || {};
    const tradotta = window.t('field_' + campo);
    return tradotta !== 'field_' + campo ? tradotta : (conf.label || campo);
}

/** Freccia sull'header della colonna che governa l'ordinamento corrente. */
function indicatoreOrdinamento(campo) {
    if (!window.sortState || window.sortState.campo !== campo) return '';
    return window.sortState.dir === 'asc' ? ' ▲' : ' ▼';
}

function cellaTestuale(m, campo) {
    const v = m[campo];
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return '';
    return String(v).replace(/<[^>]*>/g, '');
}

/**
 * Render della tabella. Stesse convenzioni della griglia: HTML costruito a stringa con
 * escapeHTML() su ogni valore (non DOMPurify: m.trascrizione contiene HTML vero e la
 * griglia fa già così), handler assegnati per riga, nessuna delega.
 */
function renderTabellaSchede(paginated) {
    const table = document.getElementById('manoscritti-table');
    if (!table) return;

    window.__ultimiPaginati = paginated;
    const disponibili = campiTabellaDisponibili(paginated);
    const chiave = chiaveColonne(paginated);
    const visibili = colonneVisibili(chiave, disponibili);
    const hasSelection = window.selectedRecords && window.selectedRecords.length > 0;

    const thSegnatura = `<th class="ordinabile" onclick="window.impostaOrdinamento('segnatura')">${escapeHTML(window.t('field_segnatura', 'Segnatura'))}${indicatoreOrdinamento('segnatura')}</th>`;
    // Ogni colonna è ordinabile: in tabella l'intestazione È il comando di ordinamento
    // (il menu a tendina resta solo nella vista a schede, dove non c'è nulla da cliccare).
    const thCampi = visibili.map(c =>
        `<th class="ordinabile" onclick="window.impostaOrdinamento('${escapeHTML(c)}')">${escapeHTML(etichettaCampo(c))}${indicatoreOrdinamento(c)}</th>`
    ).join('');

    table.innerHTML = `
        <thead>
            <tr>
                ${thSegnatura}
                ${thCampi}
                <th class="ordinabile" onclick="window.impostaOrdinamento('tags')">${escapeHTML(window.t('th_tags', 'Tag'))}${indicatoreOrdinamento('tags')}</th>
                <th class="ordinabile" onclick="window.impostaOrdinamento('allegati')">${escapeHTML(window.t('th_attachments', 'Allegati'))}${indicatoreOrdinamento('allegati')}</th>
                <th class="ordinabile" onclick="window.impostaOrdinamento('lastModified')">${escapeHTML(window.t('th_modified', 'Modificato'))}${indicatoreOrdinamento('lastModified')}</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    const fragment = document.createDocumentFragment();

    for (const m of paginated) {
        const isSelected = window.selectedRecords && window.selectedRecords.includes(m.id);
        const tr = document.createElement('tr');
        // .card-scheda + id="card-<id>": contratto condiviso con la griglia (vedi style.css).
        tr.className = 'card-scheda' + (isSelected ? ' riga-selezionata' : '');
        tr.id = 'card-' + m.id;

        tr.onclick = (e) => {
            if (e.target.closest('button') || e.target.closest('a') || e.target.tagName.toLowerCase() === 'input') return;
            if (typeof window.selectItem === 'function') window.selectItem(m.id, e);
        };
        tr.ondblclick = () => { if (typeof editItem === 'function') editItem(m.id); };
        tr.draggable = true;
        tr.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'manoscritto', id: m.id }));
            e.dataTransfer.effectAllowed = 'move';
            tr.classList.add('opacity-50');
        };
        tr.ondragend = () => tr.classList.remove('opacity-50');
        tr.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof showRecordContextMenu === 'function') showRecordContextMenu(e, m.id);
        };

        const allegati = normalizzaAllegati(m);
        const tags = (m.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        const data = m.lastModified
            ? new Date(m.lastModified).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';

        const celleCampi = visibili.map(c => {
            const testo = cellaTestuale(m, c);
            return `<td class="cella-troncata" title="${escapeHTML(testo)}">${escapeHTML(testo)}</td>`;
        }).join('');

        tr.innerHTML = `
            <td class="cella-segnatura">${hasSelection ? (isSelected ? '● ' : '○ ') : ''}${escapeHTML(m.segnatura || '')}</td>
            ${celleCampi}
            <td>${tags.map(t => `<span class="card-tag">${escapeHTML(t)}</span>`).join(' ')}</td>
            <td>${allegati.length || ''}</td>
            <td class="cella-data">${escapeHTML(data)}</td>
        `;
        fragment.appendChild(tr);
    }

    tbody.appendChild(fragment);
    if (window.lucide) lucide.createIcons({ nodes: [table] });
}

/** Cambia vista: cambia solo come si guarda l'elenco, non quale elenco. */
window.cambiaVistaLista = function(vista) {
    const nuova = vista || (window.vistaLista === 'tabella' ? 'griglia' : 'tabella');
    if (nuova === window.vistaLista) return;
    window.vistaLista = nuova;
    renderMain(false);
    if (typeof window.salvaStatoPosizione === 'function') window.salvaStatoPosizione();
};

/**
 * Menu del chevron su "Nuova scheda": apre il form già impostato sul tipo scelto.
 * Il tipo si poteva scegliere solo dentro il form, dopo averlo aperto; per chi scheda
 * in serie documenti di un tipo diverso dal primo della lista era un passaggio a vuoto
 * ripetuto a ogni scheda.
 */
window.nuovaSchedaDelTipo = function(tipoId) {
    switchTab('add');
    const select = document.getElementById('form-tipo-documento');
    if (select && tipoId) {
        select.value = tipoId;
        // I campi del form dipendono dal tipo: senza questo il form resterebbe
        // quello del tipo precedente pur mostrando il nuovo nel select.
        if (typeof renderDynamicFields === 'function') renderDynamicFields();
    }
};

window.apriMenuNuovaScheda = function(ancora) {
    const tipi = (typeof appData !== 'undefined' && appData.tipiDocumento) || [];
    const voci = [{ heading: true, label: window.t('menu_new_record_type', 'Nuova scheda di tipo') }];
    for (const t of tipi) {
        const nome = window.t('model_' + t.id) !== 'model_' + t.id ? window.t('model_' + t.id) : t.nome;
        voci.push({ label: nome, icon: 'file-text', onSelect: () => window.nuovaSchedaDelTipo(t.id) });
    }
    window.apriMenuContestuale(ancora || document.getElementById('btn-nuova-scheda-tipo'), voci);
};

/**
 * Voci del "⋯" della barra: le azioni di contesto che si usano di rado. Sono valutate
 * al click (creaBottoneOverflow) così "Colonne visibili" compare solo in tabella.
 */
function vociMenuContesto() {
    const voci = [
        { label: window.t('btn_new_folder', 'Nuovo archivio'), icon: 'folder-plus', onSelect: () => aggiungiCartella() },
        { label: window.t('btn_import', 'Importa'), icon: 'download', onSelect: () => importaManoscritto() },
        { label: window.t('btn_export_folder', 'Esporta Cartella'), icon: 'upload', onSelect: () => esportaCartellaAttuale() }
    ];
    if (window.vistaLista === 'tabella') {
        voci.push({ separator: true });
        voci.push({
            label: window.t('menu_columns', 'Colonne visibili'),
            icon: 'columns-3',
            // Il menu si chiude prima di eseguire l'azione: riancorare il secondo menu al
            // pulsante "⋯", non alla voce, che a quel punto non è più nel DOM.
            onSelect: () => window.apriSelettoreColonne(document.querySelector('#context-overflow-slot button'))
        });
    }
    return voci;
}

window.invertiDirezioneOrdinamento = function() {
    const stato = window.sortState;
    window.impostaOrdinamento(stato.campo, stato.dir === 'asc' ? 'desc' : 'asc');
};

/** Allinea i controlli (select, direzione, toggle vista) allo stato corrente. */
/**
 * Criteri offerti dal menu a tendina: i due universali (segnatura, data di modifica),
 * più i campi dei tipi documento PRESENTI NELL'ELENCO CORRENTE, più il numero di allegati.
 *
 * Derivarli dai record e non da una lista fissa evita di proporre criteri che qui non
 * esistono — "Autore" fra schede fiscali, che non hanno quel campo: sceglierlo ordinava
 * tutto per un valore vuoto, cioè non ordinava affatto.
 */
function criteriOrdinamento(records) {
    const criteri = ['segnatura'];
    for (const c of campiTabellaDisponibili(records || [])) {
        if (!criteri.includes(c)) criteri.push(c);
    }
    criteri.push('allegati', 'lastModified');
    return criteri;
}

function aggiornaControlliLista(records) {
    const tabellaAttiva = window.vistaLista === 'tabella';

    // L'indicatore della selezione vive fuori dalla griglia: risincronizzarlo qui evita
    // che resti indietro dopo un render che ha cambiato i record selezionati.
    if (typeof window.aggiornaStatoSelezione === 'function') window.aggiornaStatoSelezione();

    // In tabella l'ordinamento si comanda dall'intestazione della colonna: select e
    // freccia sparirebbero come doppioni. Nella vista a schede restano l'unico modo.
    const controlliOrdinamento = document.getElementById('controlli-ordinamento');
    if (controlliOrdinamento) controlliOrdinamento.classList.toggle('hidden-tab', tabellaAttiva);

    const select = document.getElementById('select-ordinamento');
    if (select) {
        const etichette = {
            segnatura: window.t('field_segnatura', 'Segnatura'),
            lastModified: window.t('th_modified', 'Modificato'),
            allegati: window.t('th_attachments', 'Allegati')
        };
        const campoAttivo = window.sortState.campo;
        const criteri = criteriOrdinamento(records);
        // L'ordinamento in vigore resta comunque elencato, anche se il criterio non
        // appartiene ai tipi presenti (ci si arriva da un'intestazione di tabella o
        // cambiando cartella): il select deve dire il vero, non mostrarsi vuoto.
        if (!criteri.includes(campoAttivo)) criteri.push(campoAttivo);

        // Si ricostruisce solo quando l'insieme dei criteri cambia davvero: rifare le
        // option a ogni render chiuderebbe il dropdown mentre l'utente lo sta usando.
        const firma = criteri.join('|');
        if (select.dataset.firmaCriteri !== firma) {
            select.innerHTML = criteri
                .map(c => `<option value="${escapeHTML(c)}">${escapeHTML(etichette[c] || etichettaCampo(c))}</option>`)
                .join('');
            select.dataset.firmaCriteri = firma;
        }
        select.value = campoAttivo;
    }

    const btnDir = document.getElementById('btn-ordinamento-dir');
    if (btnDir) {
        const asc = window.sortState.dir === 'asc';
        btnDir.querySelector('i')?.setAttribute('data-lucide', asc ? 'arrow-down-a-z' : 'arrow-up-z-a');
        const label = asc
            ? window.t('tooltip_sort_asc', 'Ordine crescente: clicca per invertire')
            : window.t('tooltip_sort_desc', 'Ordine decrescente: clicca per invertire');
        btnDir.title = label;
        btnDir.setAttribute('aria-label', label);
    }

    // Segmento vista: `aria-pressed` dice quale è attiva anche a chi non vede il colore,
    // ed è ciò che i test interrogano invece di ispezionare le classi.
    const segmenti = [
        { el: document.getElementById('btn-vista-tabella'), attivo: tabellaAttiva },
        { el: document.getElementById('btn-vista-griglia'), attivo: !tabellaAttiva }
    ];
    for (const s of segmenti) {
        if (!s.el) continue;
        s.el.setAttribute('aria-pressed', String(s.attivo));
        s.el.classList.toggle('segmento-attivo', s.attivo);
    }

    // Il "⋯" si costruisce una volta sola: le voci sono valutate al click, quindi il menu
    // resta aggiornato senza ricreare il pulsante a ogni render (che perderebbe il focus).
    const slot = document.getElementById('context-overflow-slot');
    if (slot && !slot.firstChild && typeof window.creaBottoneOverflow === 'function') {
        slot.appendChild(window.creaBottoneOverflow(vociMenuContesto, {
            className: 'btn btn-ghost border border-stone-200 dark:border-stone-700',
            label: window.t('tooltip_more_actions', 'Altre azioni')
        }));
    }

    const barra = document.getElementById('context-actions');
    if (barra && window.lucide) lucide.createIcons({ nodes: [barra] });
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

    // I criteri di ordinamento dipendono dai tipi presenti fra i risultati: vanno
    // ricalcolati dopo il filtro, non prima.
    aggiornaControlliLista(filtered);

    if (filtered.length === 0) {
        mostraContenitoreLista('nessuno');
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
        mostraContenitoreLista(window.vistaLista === 'tabella' ? 'tabella' : 'griglia');
        document.getElementById('empty-state').classList.add('hidden');

        // Paginazione
        const dimPagina = pageSize();
        const totalPages = Math.ceil(filtered.length / dimPagina);
        if (window.currentPage >= totalPages) window.currentPage = Math.max(0, totalPages - 1);
        const paginated = filtered.slice(window.currentPage * dimPagina, (window.currentPage + 1) * dimPagina);

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

        // La tabella è un percorso di render alternativo, non un secondo elenco: stessi
        // record già filtrati, ordinati e paginati. Si occupa da sé delle proprie icone.
        if (window.vistaLista === 'tabella') {
            renderTabellaSchede(paginated);
            return;
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

/**
 * Costruisce lo snippet evidenziato. `token` è già normalizzato, quindi il match avviene
 * su `norm` mentre il testo mostrato resta `clean` (originale, accenti inclusi).
 *
 * L'evidenziazione è posizionale e non più via regex sul termine cercato: dopo la
 * normalizzazione il termine digitato ("perugia") può non comparire alla lettera nel
 * testo originale ("Perùgia"), e una regex costruita su di esso non evidenzierebbe nulla.
 * Gli offset di `norm` valgono su `clean` solo se la normalizzazione ha preservato la
 * lunghezza (vero sul testo precomposto); altrimenti si ripiega sul confronto grezzo.
 */
function buildSnippet(clean, lower, norm, token) {
    let idx = -1;
    if (norm && norm.length === clean.length) idx = norm.indexOf(token);
    if (idx === -1) idx = lower.indexOf(token);
    if (idx === -1) return null;

    // Estrai una frase più lunga
    const start = Math.max(0, idx - 60);
    const end = Math.min(clean.length, idx + token.length + 80);
    let snippet = clean.substring(start, end).trim();

    // Offset del match dentro lo snippet, tenendo conto del taglio e del trim iniziale.
    const tagliato = clean.substring(start, end);
    const scartoTrim = tagliato.length - tagliato.replace(/^\s+/, '').length;
    const rel = idx - start - scartoTrim;

    let html;
    if (rel >= 0 && rel + token.length <= snippet.length) {
        html = escapeHTML(snippet.substring(0, rel))
            + '<span class="bg-amber-200 text-amber-900 font-bold px-0.5 rounded">'
            + escapeHTML(snippet.substring(rel, rel + token.length))
            + '</span>'
            + escapeHTML(snippet.substring(rel + token.length));
    } else {
        html = escapeHTML(snippet);
    }

    if (start > 0) html = '...' + html;
    if (end < clean.length) html = html + '...';
    return html;
}

function extractSnippet(val, token) {
    if (!val) return null;
    const clean = val.toString().replace(/<[^>]*>/g, '');
    return buildSnippet(clean, clean.toLowerCase(), window.normalizzaTesto(clean), token);
}

function renderSearchSuggestions() {
    const tokens = window.tokenizzaRicerca(document.getElementById('search-input').value);
    const container = document.getElementById('search-suggestions');
    container.innerHTML = '';

    if (tokens.length === 0) {
        container.innerHTML = '<div class="p-4 text-xs text-stone-400 italic text-center">Digita per vedere i risultati...</div>';
        return;
    }

    const matches = [];
    for (const m of appData.manoscritti) {
        // Stesso predicato della griglia: un suggerimento che porta a un record poi
        // invisibile nella vista è un vicolo cieco per l'utente.
        if (!objectMatchesTokens(m, tokens)) continue;

        const index = getSearchIndex(m);
        let aggiunto = false;
        for (const f of index.fields) {
            // Confronto su stringhe già ripulite e normalizzate: nessuna regex per record.
            for (const tok of tokens) {
                const snippet = buildSnippet(f.clean, f.lower, f.norm, tok);
                if (snippet) {
                    matches.push({ item: m, key: f.readable, snippet });
                    aggiunto = true;
                    break;
                }
            }
            if (aggiunto) break; // Mostriamo solo il primo campo in cui matcha per questo documento
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
 * corretta (la griglia è paginata, altrimenti la card non è nel DOM),
 * scrolla e la evidenzia. Usata dai suggerimenti di ricerca e dall'albero a sinistra.
 */
window.rivelaRecordNellaGriglia = function(id) {
    const filtrati = window.getManoscrittiFiltrati();
    const idx = filtrati.findIndex(x => x.id === id);
    if (idx !== -1) {
        const paginaTarget = Math.floor(idx / pageSize());
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

    targetCard.scrollIntoView({ behavior: window.comportamentoScroll(), block: 'center' });
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
    if (viewList) viewList.scrollTo({ top: 0, behavior: window.comportamentoScroll() });
};
