// @ts-nocheck
// --- MENU CONTESTUALE UNIFICATO (Fase 4.3) ---
// Unica implementazione per: menu record, menu cartella sidebar, menu sfondo lista,
// pulsanti overflow "⋯". Sostituisce l'HTML generato a mano in 3 punti di app.ts.
//
// Voci: { label, icon?, onSelect, danger?, disabled?, title? } oppure { separator: true }.
// Origine: MouseEvent (coordinate del puntatore) oppure HTMLElement (ancoraggio sotto).
//
// Tastiera: frecce su/giù (saltano le voci disabilitate), Home/End, Invio/Spazio,
// Esc e Tab chiudono e restituiscono il fuoco all'elemento di partenza.

let _menuEl = null;
let _menuOrigineFocus = null;
let _menuAncora = null;

function _menuVociAttive() {
    if (!_menuEl) return [];
    return Array.from(_menuEl.querySelectorAll('[role="menuitem"]:not([disabled])'));
}

function _menuSpostaFuoco(delta) {
    const voci = _menuVociAttive();
    if (voci.length === 0) return;
    const corrente = voci.indexOf(document.activeElement);
    // -1 (nessuna voce a fuoco) + delta 1 → 0: la prima voce, come atteso.
    const prossimo = (corrente + delta + voci.length) % voci.length;
    voci[prossimo].focus();
}

function _menuOnKeyDown(e) {
    switch (e.key) {
        case 'ArrowDown': e.preventDefault(); _menuSpostaFuoco(1); break;
        case 'ArrowUp': e.preventDefault(); _menuSpostaFuoco(-1); break;
        case 'Home': { e.preventDefault(); const v = _menuVociAttive(); if (v.length) v[0].focus(); break; }
        case 'End': { e.preventDefault(); const v = _menuVociAttive(); if (v.length) v[v.length - 1].focus(); break; }
        case 'Escape': e.preventDefault(); e.stopPropagation(); window.chiudiMenuContestuale(true); break;
        case 'Tab': window.chiudiMenuContestuale(true); break;
    }
}

function _menuOnPointerDown(e) {
    if (_menuEl && !_menuEl.contains(e.target)) window.chiudiMenuContestuale(false);
}

function _menuOnScroll() { window.chiudiMenuContestuale(false); }

window.chiudiMenuContestuale = function(ripristinaFuoco = false) {
    if (!_menuEl) return;
    document.removeEventListener('mousedown', _menuOnPointerDown, true);
    document.removeEventListener('contextmenu', _menuOnPointerDown, true);
    window.removeEventListener('scroll', _menuOnScroll, true);
    window.removeEventListener('resize', _menuOnScroll);
    _menuEl.remove();
    _menuEl = null;
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

/**
 * @param origine MouseEvent (menu al puntatore) oppure HTMLElement (menu ancorato sotto).
 * @param voci    array di voci; le label sono inserite come testo, mai come HTML.
 */
window.apriMenuContestuale = function(origine, voci) {
    window.chiudiMenuContestuale(false);
    const elenco = (voci || []).filter(Boolean);
    if (elenco.length === 0) return;

    const daPuntatore = origine && typeof origine.clientX === 'number';
    if (daPuntatore) origine.preventDefault();

    _menuOrigineFocus = daPuntatore ? document.activeElement : origine;
    _menuAncora = daPuntatore ? null : origine;
    if (_menuAncora) _menuAncora.setAttribute('aria-expanded', 'true');

    const menu = document.createElement('div');
    menu.id = 'custom-context-menu';
    menu.setAttribute('role', 'menu');
    menu.className = 'fixed bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-xl rounded-md py-1 z-menu min-w-[190px] max-w-[280px] text-sm text-stone-800 dark:text-stone-100';
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
        const btn = document.createElement('button');
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
        btn.disabled = !!voce.disabled;
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

        btn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const azione = voce.onSelect;
            window.chiudiMenuContestuale(false);
            if (typeof azione === 'function') azione();
        };
        menu.appendChild(btn);
    }

    menu.addEventListener('keydown', _menuOnKeyDown);
    document.body.appendChild(menu);
    if (window.lucide) lucide.createIcons({ nodes: [menu] });
    _menuEl = menu;

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

    const prima = _menuVociAttive()[0];
    if (prima) prima.focus();

    // capture: chiude anche se un handler intermedio ferma la propagazione
    document.addEventListener('mousedown', _menuOnPointerDown, true);
    document.addEventListener('contextmenu', _menuOnPointerDown, true);
    window.addEventListener('scroll', _menuOnScroll, true);
    window.addEventListener('resize', _menuOnScroll);
};

/** Pulsante overflow "⋯" riusabile (Fase 4.1 / 4.2). costruisciVoci() è valutata al click. */
window.creaBottoneOverflow = function(costruisciVoci, opzioni = {}) {
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
        if (_menuAncora === btn) { window.chiudiMenuContestuale(true); return; }
        // preparaApertura può ri-renderizzare il contenitore (es. selezionare la scheda):
        // in quel caso restituisce il pulsante nuovo, altrimenti ancoreremmo il menu a un
        // nodo staccato dal DOM, il cui getBoundingClientRect è tutto zeri.
        let ancora = btn;
        if (typeof opzioni.preparaApertura === 'function') {
            const sostituto = opzioni.preparaApertura();
            if (sostituto) ancora = sostituto;
        }
        window.apriMenuContestuale(ancora, costruisciVoci());
    };
    return btn;
};
