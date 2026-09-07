// @ts-nocheck
// Fase 1.4 — Command palette (Ctrl+K) ed elenco delle scorciatoie.
//
// Due lacune distinte, risolte insieme perché condividono la stessa fonte di verità:
// 1. per raggiungere una scheda, una cartella o un'azione bisognava sapere in quale
//    angolo dell'interfaccia vive il comando; la palette le espone tutte da un unico
//    campo di testo, con la stessa ricerca normalizzata della griglia (Fase 0.1);
// 2. le scorciatoie esistenti erano sei e NON erano documentate da nessuna parte —
//    né nella guida, né in un tooltip: si scoprivano solo leggendo app.ts.
//
// Le voci NON sono una lista fissa: `costruisciComandi` le deriva a ogni apertura dai
// tipi documento e dalle cartelle esistenti e SCARTA i comandi la cui funzione non è
// caricata. Una palette che elenca un'azione inesistente è peggio di una che non la
// elenca: promette e non mantiene.
//
// `filtraComandi` è pura e vive qui accanto ai comandi, non in utils.ts: la usa solo
// questa superficie ed è coperta da test/commandPalette.test.js.

// --- Scorciatoie: unica fonte di verità -------------------------------------
//
// Questo elenco è ciò che il pannello "?" mostra. Le combinazioni sono implementate
// altrove (app.ts per le globali, imageViewer.ts per il visualizzatore): quando se ne
// aggiunge o cambia una, questa tabella va aggiornata NELLO STESSO intervento, o
// documenta un'applicazione che non esiste più.
window.SCORCIATOIE = [
    { gruppo: 'shortcut_group_general', etichetta: 'Generali', voci: [
        { tasti: ['Ctrl', 'K'], chiave: 'shortcut_palette', testo: 'Apri i comandi' },
        { tasti: ['?'], chiave: 'shortcut_help', testo: 'Mostra questo elenco' },
        { tasti: ['Ctrl', 'F'], chiave: 'shortcut_search', testo: 'Vai alla ricerca' },
        { tasti: ['Ctrl', 'N'], chiave: 'shortcut_new', testo: 'Nuova scheda' },
        { tasti: ['Ctrl', 'S'], chiave: 'shortcut_save', testo: 'Salva la scheda o la trascrizione aperta' },
        { tasti: ['Ctrl', 'Z'], chiave: 'shortcut_undo', testo: 'Annulla l\u2019ultima azione' },
        { tasti: ['Esc'], chiave: 'shortcut_esc', testo: 'Chiudi la finestra in primo piano, o svuota la ricerca' }
    ]},
    { gruppo: 'shortcut_group_selection', etichetta: 'Selezione', voci: [
        { tasti: ['Ctrl', 'clic'], chiave: 'shortcut_multi', testo: 'Aggiungi o togli una scheda dalla selezione' },
        { tasti: ['Maiusc', 'clic'], chiave: 'shortcut_range', testo: 'Seleziona l\u2019intervallo fino alla scheda cliccata' },
        { tasti: ['clic destro'], chiave: 'shortcut_menu', testo: 'Menu delle azioni sulla scheda o sulla cartella' }
    ]},
    { gruppo: 'shortcut_group_transcription', etichetta: 'Trascrizione', voci: [
        { tasti: ['Alt', '\u2190'], chiave: 'shortcut_prev_att', testo: 'Allegato precedente' },
        { tasti: ['Alt', '\u2192'], chiave: 'shortcut_next_att', testo: 'Allegato successivo' },
        { tasti: ['Alt', 'F'], chiave: 'shortcut_fullscreen', testo: 'Allegato a schermo intero' }
    ]},
    { gruppo: 'shortcut_group_viewer', etichetta: 'Visualizzatore immagini', voci: [
        { tasti: ['+', '\u2212'], chiave: 'shortcut_zoom', testo: 'Ingrandisci o riduci' },
        { tasti: ['0'], chiave: 'shortcut_fit', testo: 'Adatta alla pagina' },
        { tasti: ['1'], chiave: 'shortcut_real', testo: 'Dimensione reale (1:1)' },
        { tasti: ['R'], chiave: 'shortcut_rotate', testo: 'Ruota di 90\u00b0 (con Maiusc: in senso opposto)' },
        { tasti: ['\u2190', '\u2192', '\u2191', '\u2193'], chiave: 'shortcut_pan', testo: 'Sposta l\u2019immagine' }
    ]}
];

function _T(chiave, fallback) {
    return typeof window.t === 'function' ? window.t(chiave, fallback) : fallback;
}

// --- Filtro e ordinamento (puro) --------------------------------------------

/**
 * Ordina i comandi per pertinenza rispetto alla query. Il punteggio è a gradini, non
 * una distanza fuzzy: su un elenco di comandi noti l'utente digita l'inizio di ciò che
 * cerca, e un fuzzy match avrebbe soprattutto il potere di mettere in testa la voce
 * sbagliata.
 *
 *   0 = l'etichetta INIZIA con la query               ("imp" → "Impostazioni")
 *   1 = una parola dell'etichetta inizia con la query ("scheda" → "Nuova scheda")
 *   2 = l'etichetta contiene la query
 *   3 = tutti i token compaiono altrove (sottotitolo, gruppo, sinonimi)
 *
 * A parità di punteggio vale l'ordine di registrazione: è ciò che rende prevedibile la
 * palette a query vuota e stabile fra due battute.
 */
window.filtraComandi = function(voci, query) {
    const q = window.normalizzaTesto(query || '').trim();
    if (!q) return (voci || []).slice();

    const tokens = q.split(/\s+/).filter(Boolean);
    const qEscapata = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inizioParola = new RegExp('(^|[\\s:\\u00b7/-])' + qEscapata);
    const risultati = [];

    (voci || []).forEach((v, i) => {
        const label = window.normalizzaTesto(v.label || '');
        // `chiavi` sono sinonimi non mostrati: "backup" deve trovare "Esporta cartella"
        // anche se quella parola nell'etichetta non compare.
        const extra = window.normalizzaTesto(
            [v.sottotitolo || '', v.gruppo || '', (v.chiavi || []).join(' ')].join(' ')
        );
        const tutto = label + ' ' + extra;

        // Tutti i token devono comparire da qualche parte: è la stessa regola AND della
        // griglia, e senza di essa "nuovo archivio" pescherebbe ogni voce con "nuovo".
        for (const t of tokens) {
            if (!tutto.includes(t)) return;
        }

        let punteggio = 3;
        if (label.startsWith(q)) punteggio = 0;
        else if (inizioParola.test(label)) punteggio = 1;
        else if (label.includes(q)) punteggio = 2;

        risultati.push({ voce: v, punteggio, ordine: i });
    });

    risultati.sort((a, b) => (a.punteggio - b.punteggio) || (a.ordine - b.ordine));
    return risultati.map(r => r.voce);
};

// --- Costruzione dei comandi -------------------------------------------------

function _disponibile(nome) {
    return typeof window[nome] === 'function';
}

/** Azioni: sempre presenti, indipendenti dalla query. Ordine = frequenza d'uso attesa. */
function comandiAzione() {
    const voci = [];
    const G = _T('cp_group_actions', 'Azioni');
    const agg = (cond, v) => { if (cond) voci.push(Object.assign({ gruppo: G }, v)); };

    agg(_disponibile('switchTab'), {
        id: 'nuova-scheda', icon: 'plus', scorciatoia: 'Ctrl+N',
        label: _T('btn_new_record', 'Nuova scheda'),
        chiavi: ['crea', 'inserisci', 'add'],
        esegui: () => switchTab('add')
    });
    agg(_disponibile('apriSidebarTab'), {
        id: 'cerca', icon: 'search', scorciatoia: 'Ctrl+F',
        label: _T('cp_search', 'Cerca nell\u2019archivio'),
        chiavi: ['trova', 'find'],
        esegui: () => {
            if (_disponibile('switchTab')) switchTab('list');
            window.apriSidebarTab('search');
            const input = document.getElementById('search-input');
            if (input) { input.focus(); input.select(); }
        }
    });
    // Una voce sola, non due: proporre "vista a schede" mentre è già attiva è un comando
    // che non fa nulla, e la palette è esattamente il posto in cui non se ne vedrebbe
    // l'effetto per capirlo.
    agg(_disponibile('cambiaVistaLista'), (window.vistaLista === 'tabella')
        ? { id: 'vista-griglia', icon: 'layout-grid', label: _T('cp_view_grid', 'Passa alla vista a schede'), chiavi: ['vista', 'griglia'], esegui: () => window.cambiaVistaLista('griglia') }
        : { id: 'vista-tabella', icon: 'rows-3', label: _T('cp_view_table', 'Passa alla vista a tabella'), chiavi: ['vista', 'tabella', 'colonne'], esegui: () => window.cambiaVistaLista('tabella') });
    agg(_disponibile('apriPannelloFiltri'), {
        id: 'filtri', icon: 'filter',
        label: _T('tooltip_filters', 'Filtri avanzati e ricerche salvate'),
        chiavi: ['filtro', 'ricerche salvate'],
        // Il pannello si ancora al pulsante: va aperto DOPO la chiusura della palette,
        // e infatti `_paletteEsegui` chiude prima di invocare il comando.
        esegui: () => window.apriPannelloFiltri(document.getElementById('btn-filtri'))
    });
    agg(_disponibile('azzeraFiltriRicerca'), {
        id: 'azzera-filtri', icon: 'filter-x',
        label: _T('btn_clear_filters', 'Azzera tutti i filtri'),
        chiavi: ['reset', 'pulisci'],
        esegui: () => { window.azzeraFiltriRicerca(); if (_disponibile('renderMain')) renderMain(); }
    });
    agg(_disponibile('apriNewTypeModal'), {
        id: 'nuovo-modello', icon: 'file-plus-2',
        label: _T('btn_new_model', 'Nuovo modello'),
        chiavi: ['tipo', 'documento'],
        esegui: () => apriNewTypeModal()
    });
    agg(_disponibile('apriManageTypesModal'), {
        id: 'gestisci-modelli', icon: 'layers',
        label: _T('btn_manage_models', 'Gestisci Modelli'),
        chiavi: ['tipi', 'documento'],
        esegui: () => apriManageTypesModal()
    });
    agg(_disponibile('aggiungiCartella'), {
        id: 'nuovo-archivio', icon: 'folder-plus',
        label: _T('btn_new_folder', 'Nuovo archivio'),
        chiavi: ['cartella'],
        esegui: () => aggiungiCartella()
    });
    agg(_disponibile('importaManoscritto'), {
        id: 'importa', icon: 'download',
        label: _T('btn_import', 'Importa'),
        chiavi: ['zip'],
        esegui: () => importaManoscritto()
    });
    agg(_disponibile('esportaCartellaAttuale'), {
        id: 'esporta', icon: 'upload',
        label: _T('btn_export_folder', 'Esporta Cartella'),
        chiavi: ['zip', 'backup', 'copia'],
        esegui: () => esportaCartellaAttuale()
    });
    agg(_disponibile('apriImpostazioni'), {
        id: 'impostazioni', icon: 'settings',
        label: _T('modal_settings', 'Impostazioni'),
        chiavi: ['opzioni', 'preferenze', 'lingua'],
        esegui: () => window.apriImpostazioni()
    });
    agg(_disponibile('apriShareModal'), {
        id: 'condivisione', icon: 'users',
        label: _T('tooltip_sharing', 'Condivisione'),
        chiavi: ['collabora', 'invito'],
        esegui: () => window.apriShareModal()
    });
    agg(_disponibile('apriChangelogModal'), {
        id: 'novita', icon: 'sparkles',
        label: _T('cp_changelog', 'Novit\u00e0 di questa versione'),
        chiavi: ['changelog', 'aggiornamenti'],
        esegui: () => window.apriChangelogModal()
    });
    agg(_disponibile('avviaTutorial'), {
        id: 'tutorial', icon: 'help-circle',
        label: _T('tooltip_tutorial', 'Tutorial'),
        chiavi: ['guida', 'aiuto'],
        esegui: () => window.avviaTutorial()
    });
    agg(_disponibile('apriIssueModal'), {
        id: 'segnala', icon: 'alert-circle',
        label: _T('btn_report_issue', 'Segnala un problema'),
        chiavi: ['bug', 'errore'],
        esegui: () => window.apriIssueModal()
    });
    agg(true, {
        id: 'scorciatoie', icon: 'keyboard', scorciatoia: '?',
        label: _T('cp_shortcuts', 'Scorciatoie da tastiera'),
        chiavi: ['tasti', 'keyboard'],
        esegui: () => window.apriScorciatoie()
    });
    return voci;
}

/** "Nuova scheda di tipo X": stessa azione del chevron nella barra, ora anche da tastiera. */
function comandiNuovaScheda() {
    if (!_disponibile('nuovaSchedaDelTipo')) return [];
    const G = _T('menu_new_record_type', 'Nuova scheda di tipo');
    const tipi = (typeof appData !== 'undefined' && appData.tipiDocumento) || [];
    return tipi.map(t => {
        const nome = window.t('model_' + t.id) !== 'model_' + t.id ? window.t('model_' + t.id) : t.nome;
        return {
            id: 'tipo-' + t.id, gruppo: G, icon: 'file-text',
            label: G + ': ' + nome,
            chiavi: ['nuova', 'crea'],
            esegui: () => window.nuovaSchedaDelTipo(t.id)
        };
    });
}

function comandiCartella() {
    if (!_disponibile('vaiACartella')) return [];
    const G = _T('cp_group_folders', 'Vai alla cartella');
    const cartelle = (typeof appData !== 'undefined' && appData.cartelle) || [];
    return cartelle.slice().sort((a, b) => window.confrontaNaturale(a, b)).map(c => ({
        id: 'cartella-' + c, gruppo: G, icon: 'folder',
        label: c.split('/').pop(),
        // Il percorso completo distingue due "Notarile" in rami diversi, che con la sola
        // foglia sarebbero due voci identiche e indistinguibili.
        sottotitolo: c,
        esegui: () => window.vaiACartella(c)
    }));
}

/**
 * Le schede entrano SOLO con una query: sono migliaia, e costruire migliaia di voci a
 * ogni apertura per poi scartarle è esattamente il lavoro che si sente su hardware
 * lento. Il prefiltro passa per `objectMatchesTokens`, cioè per l'indice già in cache
 * della ricerca (Fase 0.1): nessun secondo indice, nessun secondo comportamento.
 */
const MAX_SCHEDE_PALETTE = 20;
function comandiScheda(query) {
    if (!_disponibile('rivelaRecordNellaGriglia') || !_disponibile('objectMatchesTokens')) return [];
    const tokens = window.tokenizzaRicerca(query);
    if (tokens.length === 0) return [];

    const G = _T('cp_group_records', 'Vai alla scheda');
    const voci = [];
    for (const m of ((typeof appData !== 'undefined' && appData.manoscritti) || [])) {
        if (!window.objectMatchesTokens(m, tokens)) continue;
        voci.push({
            id: 'scheda-' + m.id, gruppo: G, icon: 'file-text',
            label: m.segnatura || m.titolo || _T('untitled_record', 'Senza titolo'),
            sottotitolo: [m.titolo, m.cartella].filter(Boolean).join(' \u00b7 '),
            esegui: () => window.rivelaRecordNellaGriglia(m.id)
        });
        if (voci.length >= MAX_SCHEDE_PALETTE) break;
    }
    return voci;
}

window.costruisciComandi = function(query) {
    return comandiAzione()
        .concat(comandiScheda(query))
        .concat(comandiCartella())
        .concat(comandiNuovaScheda());
};

// --- Palette -----------------------------------------------------------------

let _palette = null;
let _paletteOrigineFocus = null;
let _paletteVoci = [];
let _paletteIndice = 0;

function _paletteOnPointerDown(e) {
    const box = _palette && _palette.querySelector('.cp-box');
    if (box && !box.contains(e.target)) window.chiudiCommandPalette(true);
}

window.chiudiCommandPalette = function(ripristinaFuoco = false) {
    if (!_palette) return;
    document.removeEventListener('keydown', _paletteOnKeyDown, true);
    _palette.remove();
    _palette = null;
    _paletteVoci = [];
    const origine = _paletteOrigineFocus;
    _paletteOrigineFocus = null;
    if (ripristinaFuoco && origine && document.contains(origine) && typeof origine.focus === 'function') origine.focus();
};

function _paletteSposta(delta) {
    if (_paletteVoci.length === 0) return;
    _paletteIndice = (_paletteIndice + delta + _paletteVoci.length) % _paletteVoci.length;
    _paletteEvidenzia();
}

function _paletteEvidenzia() {
    const lista = _palette && _palette.querySelector('#cp-lista');
    if (!lista) return;
    const righe = Array.from(lista.querySelectorAll('.cp-voce'));
    const input = _palette.querySelector('#cp-input');
    righe.forEach((el, i) => {
        const attiva = i === _paletteIndice;
        el.classList.toggle('cp-attiva', attiva);
        el.setAttribute('aria-selected', attiva ? 'true' : 'false');
        if (attiva) {
            el.scrollIntoView({ block: 'nearest' });
            if (input) input.setAttribute('aria-activedescendant', el.id);
        }
    });
}

function _paletteEsegui() {
    const voce = _paletteVoci[_paletteIndice];
    if (!voce) return;
    // Chiudere PRIMA di eseguire: molti comandi aprono un modale o un popover ancorato,
    // e farlo sotto l'overlay della palette significa aprirlo dietro una tendina.
    window.chiudiCommandPalette(false);
    try {
        voce.esegui();
    } catch (err) {
        console.error('Comando fallito:', voce.id, err);
        if (typeof mostraMessaggio === 'function') {
            mostraMessaggio(_T('cp_error', 'Comando non riuscito.'), 'error');
        }
    }
}

function _paletteOnKeyDown(e) {
    if (!_palette) return;
    switch (e.key) {
        case 'Escape': e.preventDefault(); e.stopPropagation(); window.chiudiCommandPalette(true); break;
        case 'ArrowDown': e.preventDefault(); _paletteSposta(1); break;
        case 'ArrowUp': e.preventDefault(); _paletteSposta(-1); break;
        case 'Home': e.preventDefault(); _paletteIndice = 0; _paletteEvidenzia(); break;
        case 'End': e.preventDefault(); _paletteIndice = Math.max(0, _paletteVoci.length - 1); _paletteEvidenzia(); break;
        case 'Enter': e.preventDefault(); e.stopPropagation(); _paletteEsegui(); break;
        // Tab non deve portare il fuoco fuori da un overlay che copre tutto: finirebbe
        // su comandi invisibili sotto la tendina. Qui scorre l'elenco, come le frecce.
        case 'Tab': e.preventDefault(); _paletteSposta(e.shiftKey ? -1 : 1); break;
    }
}

function _paletteRiempi(query) {
    const lista = _palette.querySelector('#cp-lista');
    const input = _palette.querySelector('#cp-input');
    lista.innerHTML = '';
    _paletteVoci = window.filtraComandi(window.costruisciComandi(query), query);
    _paletteIndice = 0;

    if (_paletteVoci.length === 0) {
        const vuoto = document.createElement('p');
        vuoto.id = 'cp-vuoto';
        vuoto.className = 'p-6 text-sm italic text-center text-stone-400';
        vuoto.textContent = _T('cp_empty', 'Nessun comando corrisponde.');
        lista.appendChild(vuoto);
        if (input) input.removeAttribute('aria-activedescendant');
        return;
    }

    const frammento = document.createDocumentFragment();
    let gruppoCorrente = null;
    _paletteVoci.forEach((v, i) => {
        // L'intestazione di gruppo compare solo quando il gruppo CAMBIA: dopo il riordino
        // per pertinenza le voci di uno stesso gruppo non sono più contigue, e una
        // intestazione per voce sarebbe rumore puro.
        if (v.gruppo && v.gruppo !== gruppoCorrente) {
            gruppoCorrente = v.gruppo;
            const h = document.createElement('div');
            h.className = 'cp-gruppo';
            h.textContent = v.gruppo;
            frammento.appendChild(h);
        }
        const riga = document.createElement('div');
        riga.id = 'cp-voce-' + i;
        riga.className = 'cp-voce';
        riga.setAttribute('role', 'option');
        riga.setAttribute('aria-selected', 'false');
        riga.dataset.comandoId = v.id;

        const icona = document.createElement('i');
        icona.setAttribute('data-lucide', v.icon || 'chevron-right');
        icona.className = 'w-4 h-4 shrink-0 text-stone-400';
        riga.appendChild(icona);

        const testi = document.createElement('div');
        testi.className = 'min-w-0 flex-1';
        const titolo = document.createElement('div');
        titolo.className = 'truncate text-sm';
        titolo.textContent = v.label;      // textContent: segnature e cartelle sono dati utente
        testi.appendChild(titolo);
        if (v.sottotitolo) {
            const sub = document.createElement('div');
            sub.className = 'truncate text-xs text-stone-500 dark:text-stone-400';
            sub.textContent = v.sottotitolo;
            testi.appendChild(sub);
        }
        riga.appendChild(testi);

        if (v.scorciatoia) {
            const kbd = document.createElement('kbd');
            kbd.className = 'cp-kbd';
            kbd.textContent = v.scorciatoia;
            riga.appendChild(kbd);
        }

        // mousedown e non click: il pointerdown di chiusura sull'overlay arriverebbe
        // comunque prima del click, e sul comando "esegui" smonterebbe la riga sotto
        // il puntatore prima che il click possa nascere.
        riga.onmousedown = (e) => { e.preventDefault(); _paletteIndice = i; _paletteEsegui(); };
        riga.onmousemove = () => { if (_paletteIndice !== i) { _paletteIndice = i; _paletteEvidenzia(); } };
        frammento.appendChild(riga);
    });
    lista.appendChild(frammento);
    if (window.lucide) lucide.createIcons({ nodes: [lista] });
    _paletteEvidenzia();
}

window.apriCommandPalette = function() {
    if (_palette) { window.chiudiCommandPalette(true); return; }   // toggle
    _paletteOrigineFocus = document.activeElement;

    const titolo = _T('cp_title', 'Comandi');
    const overlay = document.createElement('div');
    overlay.id = 'command-palette';
    overlay.className = 'cp-overlay';
    overlay.innerHTML = `
        <div class="cp-box" role="dialog" aria-modal="true" aria-label="${escapeHTML(titolo)}">
            <div class="cp-riga-input">
                <i data-lucide="search" class="w-4 h-4 shrink-0 text-stone-400"></i>
                <input id="cp-input" type="text" role="combobox" aria-expanded="true"
                       aria-controls="cp-lista" aria-autocomplete="list" autocomplete="off"
                       class="cp-input" placeholder="${escapeHTML(_T('cp_placeholder', 'Cerca un comando, una scheda o una cartella\u2026'))}">
            </div>
            <div id="cp-lista" role="listbox" aria-label="${escapeHTML(titolo)}" class="cp-lista"></div>
            <div class="cp-piede">
                <span><kbd class="cp-kbd">\u2191</kbd><kbd class="cp-kbd">\u2193</kbd> ${escapeHTML(_T('cp_hint_move', 'scorri'))}</span>
                <span><kbd class="cp-kbd">\u21b5</kbd> ${escapeHTML(_T('cp_hint_run', 'esegui'))}</span>
                <span><kbd class="cp-kbd">Esc</kbd> ${escapeHTML(_T('cp_hint_close', 'chiudi'))}</span>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    _palette = overlay;

    overlay.addEventListener('mousedown', _paletteOnPointerDown);

    const input = overlay.querySelector('#cp-input');
    // Il filtro è sincrono e senza debounce: costa quanto una scansione dell'indice già
    // in cache, e un ritardo su una palette si legge come interfaccia rotta. È il taglio
    // a 20 schede a tenere il costo costante sugli archivi grandi.
    input.addEventListener('input', () => _paletteRiempi(input.value));
    _paletteRiempi('');
    input.focus();

    document.addEventListener('keydown', _paletteOnKeyDown, true);
    if (window.lucide) lucide.createIcons({ nodes: [overlay] });
};

// --- Pannello delle scorciatoie ----------------------------------------------

window.apriScorciatoie = function() {
    const modal = document.getElementById('shortcuts-modal');
    if (!modal) return;
    const corpo = modal.querySelector('#shortcuts-body');
    corpo.innerHTML = '';

    for (const sezione of window.SCORCIATOIE) {
        const blocco = document.createElement('section');
        blocco.className = 'mb-5 last:mb-0';

        const titolo = document.createElement('h4');
        titolo.className = 'text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2';
        titolo.textContent = _T(sezione.gruppo, sezione.etichetta);
        blocco.appendChild(titolo);

        const dl = document.createElement('dl');
        dl.className = 'flex flex-col gap-1.5';
        for (const s of sezione.voci) {
            const riga = document.createElement('div');
            riga.className = 'flex items-baseline justify-between gap-4';

            const dt = document.createElement('dt');
            dt.className = 'text-sm text-stone-700 dark:text-stone-200 min-w-0';
            dt.textContent = _T(s.chiave, s.testo);

            const dd = document.createElement('dd');
            dd.className = 'flex items-center gap-1 shrink-0';
            s.tasti.forEach((k, i) => {
                if (i > 0) {
                    const piu = document.createElement('span');
                    piu.className = 'text-xs text-stone-400';
                    piu.textContent = '+';
                    dd.appendChild(piu);
                }
                const kbd = document.createElement('kbd');
                kbd.className = 'cp-kbd';
                kbd.textContent = k;
                dd.appendChild(kbd);
            });

            riga.append(dt, dd);
            dl.appendChild(riga);
        }
        blocco.appendChild(dl);
        corpo.appendChild(blocco);
    }

    modal.classList.remove('hidden-tab');
    const chiudi = modal.querySelector('[data-modal-cancel]');
    if (chiudi) chiudi.focus();
};

window.chiudiScorciatoie = function() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.classList.add('hidden-tab');
};

// --- Attivazione --------------------------------------------------------------
//
// I due tasti sono agganciati QUI e non fra le scorciatoie di app.ts: quell'handler
// esce prima del blocco globale quando la vista trascrizione è aperta (`return`), e
// Ctrl+K deve funzionare anche lì. In capture, così la palette si apre sopra qualunque
// campo abbia il fuoco.
function _inCampoTestuale(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

document.addEventListener('keydown', (e) => {
    if (_palette) return;   // i tasti a palette aperta li gestisce _paletteOnKeyDown

    // Sopra un modale aperto la palette non si apre: eseguire da lì un comando che apre
    // un altro modale impilerebbe finestre che l'utente non ha chiesto, e che Esc poi
    // chiuderebbe a ritroso.
    const modaleAperto = document.querySelector('.modal-overlay:not(.hidden-tab)');

    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        if (modaleAperto) return;
        e.preventDefault();
        e.stopPropagation();
        window.apriCommandPalette();
        return;
    }

    // '?' e non 'Maiusc + /': sulla tastiera italiana il punto interrogativo è Maiusc+'.
    // Solo fuori dai campi di testo, dove è un carattere da scrivere.
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (modaleAperto || _inCampoTestuale(document.activeElement)) return;
        e.preventDefault();
        window.apriScorciatoie();
    }
}, true);

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('shortcuts-modal')) return;
        const html = `
    <div id="shortcuts-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-lg max-h-[85vh]">
            <div class="modal-header shrink-0">
                <h3 class="modal-title">
                    <i data-lucide="keyboard" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="cp_shortcuts">Scorciatoie da tastiera</span>
                </h3>
                <button type="button" onclick="chiudiScorciatoie()" data-modal-cancel
                        class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div id="shortcuts-body" class="modal-body flex-1 overflow-y-auto custom-scroll"></div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
    });
})();
