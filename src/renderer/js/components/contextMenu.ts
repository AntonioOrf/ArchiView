// --- MENU CONTESTUALE UNIFICATO (Fase 4.3, submenu dalla Fase 0 di MENU_GROUPING_TODO) ---
// Unica implementazione per: menu record, menu cartella sidebar, menu sfondo lista,
// pulsanti overflow "⋯". Sostituisce l'HTML generato a mano in 3 punti di app.ts.
//
// Voci: { label, icon?, onSelect, danger?, disabled?, title?, shortcut? } oppure
// { separator: true } / { heading: true } / { label, icon?, submenu: [...voci] }.
// Origine: MouseEvent (coordinate del puntatore) oppure HTMLElement (ancoraggio sotto).
//
// Tastiera: frecce su/giù (saltano le voci disabilitate), Home/End, Invio/Spazio,
// destra/sinistra per entrare e uscire da un sottomenu, Esc chiude un livello alla volta,
// Tab chiude tutto e restituisce il fuoco all'elemento di partenza.
//
// I livelli vivono in uno stack: ogni chiusura è "da questo livello in giù", perché
// uscire da un sottomenu non deve far sparire il menu che lo ha aperto.

let _menuStack = [];          // [{ el, voceGenitore }] — indice 0 = menu principale
let _menuOrigineFocus = null;
// Voce di menu con sottomenu: le proprietà __ viaggiano sul nodo del pulsante.
type VoceMenu = HTMLButtonElement & { __submenu?: any; __livello?: number; __submenuAperto?: boolean };
let _menuAncora = null;
let _menuTimerHover = null;
// Posizioni di scroll al momento dell'apertura, per i contenitori sopra l'origine del menu.
let _menuScrollAllApertura = new Map();

/**
 * Fotografa lo scroll degli antenati dell'origine. Serve a _menuOnScroll per riconoscere un
 * evento `scroll` ARRIVATO IN RITARDO: lo scroll avvenuto subito prima dell'apertura (portare
 * in vista la scheda, un colpo di rotellina appena dato) viene notificato al frame successivo,
 * cioè a menu già aperto, e lo chiudeva senza che nulla si fosse mosso dopo. Nei test E2E
 * succedeva sempre (il click di Playwright scorre la scheda in vista), per l'utente a volte.
 */
function _fotografaScroll(origineEl) {
    const mappa = new Map();
    const registra = (el) => { if (el) mappa.set(el, [el.scrollTop, el.scrollLeft]); };
    registra(document.scrollingElement);
    for (let n = origineEl; n && n !== document.body; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth) registra(n);
    }
    return mappa;
}

const RITARDO_HOVER = 120;    // ms: sotto questa soglia il menu si aprirebbe attraversandolo

function _menuTop() {
    return _menuStack.length ? _menuStack[_menuStack.length - 1].el : null;
}

function _menuContiene(target) {
    return _menuStack.some(l => l.el.contains(target));
}

function _menuVociAttive(el?): HTMLElement[] {
    const menu = el || _menuTop();
    if (!menu) return [];
    return Array.from(menu.querySelectorAll('[role="menuitem"]:not([disabled])')) as HTMLElement[];
}

function _menuSpostaFuoco(delta) {
    const voci = _menuVociAttive();
    if (voci.length === 0) return;
    const corrente = voci.indexOf(document.activeElement as HTMLElement);
    // -1 (nessuna voce a fuoco) + delta 1 → 0: la prima voce, come atteso.
    const prossimo = (corrente + delta + voci.length) % voci.length;
    voci[prossimo].focus();
}

function _annullaHover() {
    if (_menuTimerHover) { clearTimeout(_menuTimerHover); _menuTimerHover = null; }
}

function _menuOnKeyDown(e) {
    const livelloTop = _menuStack.length - 1;
    switch (e.key) {
        case 'ArrowDown': e.preventDefault(); _menuSpostaFuoco(1); break;
        case 'ArrowUp': e.preventDefault(); _menuSpostaFuoco(-1); break;
        case 'Home': { e.preventDefault(); const v = _menuVociAttive(); if (v.length) v[0].focus(); break; }
        case 'End': { e.preventDefault(); const v = _menuVociAttive(); if (v.length) v[v.length - 1].focus(); break; }
        case 'ArrowRight': {
            const btn = document.activeElement as VoceMenu;
            if (btn && btn.__submenu) { e.preventDefault(); _apriSottomenu(btn, true); }
            break;
        }
        case 'ArrowLeft': {
            // Esce di un livello soltanto, e il fuoco torna sulla voce che ha aperto il
            // sottomenu: non sulla prima voce del menu padre.
            if (livelloTop > 0) { e.preventDefault(); window.chiudiMenuContestuale(true, livelloTop); }
            break;
        }
        case 'Escape':
            e.preventDefault(); e.stopPropagation();
            window.chiudiMenuContestuale(true, Math.max(0, livelloTop));
            break;
        case 'Tab': window.chiudiMenuContestuale(true, 0); break;
    }
}

function _menuOnPointerDown(e) {
    // "Dentro il menu" = dentro QUALUNQUE livello: altrimenti il click su una voce di un
    // sottomenu chiuderebbe lo stack prima che il suo onclick venga eseguito.
    if (_menuStack.length && !_menuContiene(e.target)) window.chiudiMenuContestuale(false, 0);
}

function _menuOnScroll(e) {
    // Lo scroll DENTRO il menu non deve chiuderlo: da quando le azioni in massa (Fase 1.5)
    // hanno allungato il menu del record, su finestre basse il menu scorre, e con
    // l'handler in capture ogni rotellina lo faceva sparire sotto il puntatore. Stessa
    // lezione del pannello filtri (Fase 1.3).
    if (_menuStack.length && e && e.target && e.target.nodeType === 1 && _menuContiene(e.target)) return;
    // Evento in ritardo di uno scroll precedente all'apertura: la posizione è quella
    // fotografata aprendo, quindi da allora non si è mosso nulla.
    const bersaglio = e && e.target && e.target.nodeType === 9 ? document.scrollingElement : e && e.target;
    const prima = bersaglio && _menuScrollAllApertura.get(bersaglio);
    if (prima && prima[0] === bersaglio.scrollTop && prima[1] === bersaglio.scrollLeft) return;
    window.chiudiMenuContestuale(false, 0);
}

/**
 * @param ripristinaFuoco rimette il fuoco sulla sorgente (solo Esc/Tab/freccia sinistra).
 * @param finoALivello    chiude i livelli con indice >= questo. 0 (default) = tutto.
 */
window.chiudiMenuContestuale = function(ripristinaFuoco = false, finoALivello = 0) {
    if (_menuStack.length === 0) return;
    _annullaHover();

    while (_menuStack.length > finoALivello) {
        const livello = _menuStack.pop();
        livello.el.remove();
        if (livello.voceGenitore) {
            livello.voceGenitore.setAttribute('aria-expanded', 'false');
            livello.voceGenitore.__submenuAperto = false;
            // Chiusura del solo sottomenu: il fuoco torna sulla voce che l'aveva aperto.
            if (ripristinaFuoco && _menuStack.length > 0 && document.contains(livello.voceGenitore)) {
                livello.voceGenitore.focus();
            }
        }
    }
    if (_menuStack.length > 0) return;

    document.removeEventListener('mousedown', _menuOnPointerDown, true);
    document.removeEventListener('contextmenu', _menuOnPointerDown, true);
    window.removeEventListener('scroll', _menuOnScroll, true);
    window.removeEventListener('resize', _menuOnScroll);
    if (_menuAncora) {
        _menuAncora.setAttribute('aria-expanded', 'false');
        _menuAncora = null;
    }
    const daRimettereAFuoco = _menuOrigineFocus;
    _menuOrigineFocus = null;
    // Il fuoco torna alla sorgente solo su Esc/Tab: dopo un click col mouse rubarlo
    // sposterebbe lo scroll senza motivo.
    if (ripristinaFuoco && daRimettereAFuoco && document.contains(daRimettereAFuoco)) {
        daRimettereAFuoco.focus();
    }
};

/** Costruisce l'elemento di un livello. Non lo posiziona e non lo mette nello stack. */
function _costruisciMenu(elenco, livello) {
    const menu = document.createElement('div');
    // L'id del primo livello resta quello storico: ci si appoggiano CSS e test E2E.
    menu.id = livello === 0 ? 'custom-context-menu' : 'custom-context-menu-' + livello;
    menu.className = 'ctx-menu fixed bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-xl rounded-md py-1 z-menu min-w-[190px] max-w-[280px] max-h-[85vh] overflow-y-auto custom-scroll text-sm text-stone-800 dark:text-stone-100';
    menu.setAttribute('role', 'menu');
    menu.dataset.livello = String(livello);
    // Fuori schermo finché non è misurato: evita il salto visibile del riposizionamento.
    menu.style.left = '-9999px';
    menu.style.top = '0px';

    for (const voce of elenco) {
        if (voce.heading) {
            // Riga di sola lettura (es. lo stato cloud in cima al popover): niente role
            // menuitem, così le frecce non ci si fermano sopra.
            const h = document.createElement('div');
            h.className = voce.sottotitolo
                ? 'px-4 py-1 text-xs text-red-600 dark:text-red-400 max-w-[260px] whitespace-normal'
                : 'px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400';
            h.textContent = voce.label;
            menu.appendChild(h);
            continue;
        }
        if (voce.separator) {
            const hr = document.createElement('div');
            hr.className = 'h-px bg-stone-200 dark:bg-stone-700 my-1';
            hr.setAttribute('role', 'separator');
            menu.appendChild(hr);
            continue;
        }
        const sottovoci = Array.isArray(voce.submenu) ? voce.submenu.filter(Boolean) : null;
        const btn = document.createElement('button') as VoceMenu;
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        btn.tabIndex = -1;
        btn.className = 'w-full text-left px-4 py-2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed '
            + (voce.danger
                ? 'text-red-600 dark:text-red-400 hover:enabled:bg-red-50 dark:hover:enabled:bg-red-900/30 focus:enabled:bg-red-50 dark:focus:enabled:bg-red-900/30'
                : 'hover:enabled:bg-stone-100 dark:hover:enabled:bg-stone-800 focus:enabled:bg-stone-100 dark:focus:enabled:bg-stone-800')
            + (voce.accent ? ' font-medium text-blue-600 dark:text-blue-400' : '')
            // amber-600 su fondo bianco sta a 3.4:1, sotto il minimo 4.5:1 per il testo:
            // amber-700 lo porta a 5.1:1 senza cambiare la semantica del colore (5.5).
            + (voce.accentWarn ? ' font-medium text-amber-700 dark:text-amber-400' : '');
        // Un sottomenu senza voci è un comando che non fa nulla: disabilitato, non nascosto,
        // così l'assenza si vede invece di far sparire una riga da sotto il puntatore.
        btn.disabled = !!voce.disabled || (sottovoci !== null && sottovoci.length === 0);
        if (voce.title) btn.title = voce.title;

        if (voce.icon) {
            const i = document.createElement('i');
            i.setAttribute('data-lucide', voce.icon);
            i.className = 'w-4 h-4 shrink-0';
            btn.appendChild(i);
        }
        const span = document.createElement('span');
        span.className = 'truncate';
        span.textContent = voce.label;   // textContent: nessuna interpolazione di HTML
        btn.appendChild(span);

        if (sottovoci) {
            // Una voce padre non porta scorciatoia: le combinazioni restano visibili DENTRO
            // il sottomenu, accanto al comando che eseguono (Fase 1.4).
            btn.__submenu = sottovoci;
            btn.__livello = livello;
            btn.setAttribute('aria-haspopup', 'menu');
            btn.setAttribute('aria-expanded', 'false');
            const chev = document.createElement('i');
            chev.setAttribute('data-lucide', 'chevron-right');
            chev.className = 'w-4 h-4 shrink-0 ml-auto opacity-60';
            btn.appendChild(chev);
        } else if (voce.shortcut) {
            // `shortcut` (Fase 1.4): la combinazione accanto alla voce è il solo posto in cui
            // un utente scopre una scorciatoia mentre sta già usando il comando col mouse.
            const kbd = document.createElement('kbd');
            kbd.className = 'cp-kbd ml-auto';
            kbd.textContent = voce.shortcut;
            btn.appendChild(kbd);
        }

        // Attraversare una voce qualunque chiude i livelli più profondi; entrare in una voce
        // padre apre il suo. Stesso ritardo per i due casi, così un movimento diagonale verso
        // il sottomenu già aperto non lo fa sparire a metà strada.
        btn.onmouseenter = () => {
            _annullaHover();
            if (btn.disabled) return;
            _menuTimerHover = setTimeout(() => {
                _menuTimerHover = null;
                if (sottovoci) _apriSottomenu(btn, false);
                else if (_menuStack.length > livello + 1) window.chiudiMenuContestuale(false, livello + 1);
            }, RITARDO_HOVER);
        };
        btn.onmouseleave = _annullaHover;

        btn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (sottovoci) { _annullaHover(); _apriSottomenu(btn, true); return; }
            const azione = voce.onSelect;
            window.chiudiMenuContestuale(false, 0);
            if (typeof azione === 'function') azione();
        };
        menu.appendChild(btn);
    }

    menu.addEventListener('keydown', _menuOnKeyDown);
    return menu;
}

/** Apre (o riporta a fuoco) il sottomenu della voce `btn`, ancorandolo al suo fianco. */
function _apriSottomenu(btn, dallaTastiera) {
    const livelloFiglio = btn.__livello + 1;
    if (btn.__submenuAperto && _menuStack.length > livelloFiglio) {
        if (dallaTastiera) {
            const prima = _menuVociAttive(_menuStack[livelloFiglio].el)[0];
            if (prima) prima.focus();
        }
        return;
    }
    // Chiude l'eventuale sottomenu fratello già aperto allo stesso livello.
    window.chiudiMenuContestuale(false, livelloFiglio);

    const menu = _costruisciMenu(btn.__submenu, livelloFiglio);
    document.body.appendChild(menu);
    if (window.lucide) lucide.createIcons({ nodes: [menu] });
    _menuStack.push({ el: menu, voceGenitore: btn });
    btn.setAttribute('aria-expanded', 'true');
    btn.__submenuAperto = true;

    const margine = 8;
    const r = btn.getBoundingClientRect();
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    // A destra della voce, sovrapponendo di 2px il bordo del padre così il puntatore non
    // attraversa un varco scoperto; ribaltato a sinistra del menu padre se non ci sta.
    let x = r.right - 2;
    if (x + w > window.innerWidth - margine) x = r.left - w + 2;
    let y = r.top - 4;
    if (y + h > window.innerHeight - margine) y = window.innerHeight - h - margine;
    menu.style.left = Math.max(margine, Math.min(x, window.innerWidth - w - margine)) + 'px';
    menu.style.top = Math.max(margine, y) + 'px';

    if (dallaTastiera) {
        const prima = _menuVociAttive(menu)[0];
        if (prima) prima.focus();
    }
}

/**
 * @param origine MouseEvent (menu al puntatore) oppure HTMLElement (menu ancorato sotto).
 * @param voci    array di voci; le label sono inserite come testo, mai come HTML.
 */
window.apriMenuContestuale = function(origine, voci) {
    window.chiudiMenuContestuale(false, 0);
    const elenco = (voci || []).filter(Boolean);
    if (elenco.length === 0) return;

    const daPuntatore = origine && typeof origine.clientX === 'number';
    if (daPuntatore) origine.preventDefault();

    _menuOrigineFocus = daPuntatore ? document.activeElement : origine;
    // Col menu al puntatore il target può essere già staccato: aprire seleziona la scheda,
    // e renderMain ridisegna la griglia. Si riparte allora dall'elemento sotto il puntatore.
    let origineEl = daPuntatore ? origine.target : origine;
    if (daPuntatore && !(origineEl && origineEl.isConnected)) origineEl = document.elementFromPoint(origine.clientX, origine.clientY);
    _menuScrollAllApertura = _fotografaScroll(origineEl);
    _menuAncora = daPuntatore ? null : origine;
    if (_menuAncora) _menuAncora.setAttribute('aria-expanded', 'true');

    const menu = _costruisciMenu(elenco, 0);
    document.body.appendChild(menu);
    if (window.lucide) lucide.createIcons({ nodes: [menu] });
    _menuStack.push({ el: menu, voceGenitore: null });

    // Posizionamento con dimensioni reali (non più le costanti 180/200 stimate a mano)
    const larghezza = menu.offsetWidth;
    const altezza = menu.offsetHeight;
    const margine = 8;
    let x, y;
    if (daPuntatore) {
        x = origine.clientX;
        y = origine.clientY;
        // Se non ci sta sotto il puntatore si apre verso l'alto, invece di essere tagliato
        if (y + altezza > window.innerHeight - margine) y = Math.max(margine, y - altezza);
    } else {
        const r = origine.getBoundingClientRect();
        x = r.right - larghezza;
        y = r.bottom + 4;
        if (y + altezza > window.innerHeight - margine) y = Math.max(margine, r.top - altezza - 4);
    }
    menu.style.left = Math.max(margine, Math.min(x, window.innerWidth - larghezza - margine)) + 'px';
    menu.style.top = Math.max(margine, Math.min(y, window.innerHeight - altezza - margine)) + 'px';

    const prima = _menuVociAttive(menu)[0];
    if (prima) prima.focus();

    // capture: chiude anche se un handler intermedio ferma la propagazione
    document.addEventListener('mousedown', _menuOnPointerDown, true);
    document.addEventListener('contextmenu', _menuOnPointerDown, true);
    window.addEventListener('scroll', _menuOnScroll, true);
    window.addEventListener('resize', _menuOnScroll);
};

/** Pulsante overflow "⋯" riusabile (Fase 4.1 / 4.2). costruisciVoci() è valutata al click. */
window.creaBottoneOverflow = function(costruisciVoci, opzioni: { className?: string; label?: string; iconClass?: string; preparaApertura?: () => HTMLElement | null | void } = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = opzioni.className || 'btn btn-ghost btn-icon';
    const etichetta = opzioni.label || window.t('tooltip_more_actions', 'Altre azioni');
    btn.setAttribute('aria-label', etichetta);
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.title = etichetta;
    btn.innerHTML = window.sanitizeHTML('<i data-lucide="more-horizontal" class="' + (opzioni.iconClass || 'w-4 h-4') + '"></i>');
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Toggle: un secondo click sullo stesso pulsante chiude il menu.
        if (_menuAncora === btn) { window.chiudiMenuContestuale(true, 0); return; }
        // preparaApertura può ri-renderizzare il contenitore (es. selezionare la scheda):
        // in quel caso restituisce il pulsante nuovo, altrimenti ancoreremmo il menu a un
        // nodo staccato dal DOM, il cui getBoundingClientRect è tutto zeri.
        let ancora: HTMLElement = btn;
        if (typeof opzioni.preparaApertura === 'function') {
            const sostituto = opzioni.preparaApertura();
            if (sostituto) ancora = sostituto;
        }
        window.apriMenuContestuale(ancora, costruisciVoci());
    };
    return btn;
};
