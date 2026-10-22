let _menuStack = [];
let _menuOrigineFocus = null;
type VoceMenu = HTMLButtonElement & { __submenu?: any; __livello?: number; __submenuAperto?: boolean };
let _menuAncora = null;
let _menuTimerHover = null;
let _menuScrollAllApertura = new Map();

function _fotografaScroll(origineEl) {
    const mappa = new Map();
    const registra = (el) => { if (el) mappa.set(el, [el.scrollTop, el.scrollLeft]); };
    registra(document.scrollingElement);
    for (let n = origineEl; n && n !== document.body; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth) registra(n);
    }
    return mappa;
}

const RITARDO_HOVER = 120;

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
    if (_menuStack.length && !_menuContiene(e.target)) window.chiudiMenuContestuale(false, 0);
}

function _menuOnScroll(e) {
    if (_menuStack.length && e && e.target && e.target.nodeType === 1 && _menuContiene(e.target)) return;
    const bersaglio = e && e.target && e.target.nodeType === 9 ? document.scrollingElement : e && e.target;
    const prima = bersaglio && _menuScrollAllApertura.get(bersaglio);
    if (prima && prima[0] === bersaglio.scrollTop && prima[1] === bersaglio.scrollLeft) return;
    window.chiudiMenuContestuale(false, 0);
}

window.chiudiMenuContestuale = function(ripristinaFuoco = false, finoALivello = 0) {
    if (_menuStack.length === 0) return;
    _annullaHover();

    while (_menuStack.length > finoALivello) {
        const livello = _menuStack.pop();
        livello.el.remove();
        if (livello.voceGenitore) {
            livello.voceGenitore.setAttribute('aria-expanded', 'false');
            livello.voceGenitore.__submenuAperto = false;
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
    if (ripristinaFuoco && daRimettereAFuoco && document.contains(daRimettereAFuoco)) {
        daRimettereAFuoco.focus();
    }
};

function _costruisciMenu(elenco, livello) {
    const menu = document.createElement('div');
    menu.id = livello === 0 ? 'custom-context-menu' : 'custom-context-menu-' + livello;
    menu.className = 'ctx-menu fixed z-menu custom-scroll';
    menu.setAttribute('role', 'menu');
    menu.dataset.livello = String(livello);
    menu.style.left = '-9999px';
    menu.style.top = '0px';

    for (const voce of elenco) {
        if (voce.heading) {
            const h = document.createElement('div');
            h.className = voce.sottotitolo ? 'ctx-sottotitolo' : 'ctx-titolo';
            h.textContent = voce.label;
            menu.appendChild(h);
            continue;
        }
        if (voce.separator) {
            const hr = document.createElement('div');
            hr.className = 'ctx-separatore';
            hr.setAttribute('role', 'separator');
            menu.appendChild(hr);
            continue;
        }
        const sottovoci = Array.isArray(voce.submenu) ? voce.submenu.filter(Boolean) : null;
        const btn = document.createElement('button') as VoceMenu;
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        btn.tabIndex = -1;
        btn.className = 'ctx-voce'
            + (voce.danger ? ' is-pericolo' : '')
            + (voce.accent ? ' is-accento' : '')
            + (voce.accentWarn ? ' is-avviso' : '');
        if (voce.corrente) btn.setAttribute('aria-current', 'true');
        btn.disabled = !!voce.disabled || (sottovoci !== null && sottovoci.length === 0);
        if (voce.title) btn.title = voce.title;

        if (voce.icon) {
            const i = document.createElement('i');
            i.setAttribute('data-lucide', voce.icon);
            i.className = 'w-4 h-4 shrink-0';
            btn.appendChild(i);
        }
        if (voce.colore) {
            const q = document.createElement('span');
            q.className = 'sidebar-tag-quadro' + (voce.colore === 'neutro' ? '' : ' tag-quadro-' + voce.colore);
            q.setAttribute('aria-hidden', 'true');
            btn.appendChild(q);
        }
        const span = document.createElement('span');
        span.className = 'truncate';
        span.textContent = voce.label;
        btn.appendChild(span);

        if (sottovoci) {
            btn.__submenu = sottovoci;
            btn.__livello = livello;
            btn.setAttribute('aria-haspopup', 'menu');
            btn.setAttribute('aria-expanded', 'false');
            const chev = document.createElement('i');
            chev.setAttribute('data-lucide', 'chevron-right');
            chev.className = 'w-4 h-4 shrink-0 ml-auto opacity-60';
            btn.appendChild(chev);
        } else if (voce.corrente) {
            const spunta = document.createElement('i');
            spunta.setAttribute('data-lucide', 'check');
            spunta.className = 'w-4 h-4 shrink-0 ml-auto';
            btn.appendChild(spunta);
        } else if (voce.shortcut) {
            const kbd = document.createElement('kbd');
            kbd.className = 'cp-kbd ml-auto';
            kbd.textContent = voce.shortcut;
            btn.appendChild(kbd);
        }

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

function _apriSottomenu(btn, dallaTastiera) {
    const livelloFiglio = btn.__livello + 1;
    if (btn.__submenuAperto && _menuStack.length > livelloFiglio) {
        if (dallaTastiera) {
            const prima = _menuVociAttive(_menuStack[livelloFiglio].el)[0];
            if (prima) prima.focus();
        }
        return;
    }
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

window.apriMenuContestuale = function(origine, voci) {
    window.chiudiMenuContestuale(false, 0);
    const elenco = (voci || []).filter(Boolean);
    if (elenco.length === 0) return;

    const daPuntatore = origine && typeof origine.clientX === 'number';
    if (daPuntatore) origine.preventDefault();

    _menuOrigineFocus = daPuntatore ? document.activeElement : origine;
    let origineEl = daPuntatore ? origine.target : origine;
    if (daPuntatore && !(origineEl && origineEl.isConnected)) origineEl = document.elementFromPoint(origine.clientX, origine.clientY);
    _menuScrollAllApertura = _fotografaScroll(origineEl);
    _menuAncora = daPuntatore ? null : origine;
    if (_menuAncora) _menuAncora.setAttribute('aria-expanded', 'true');

    const menu = _costruisciMenu(elenco, 0);
    document.body.appendChild(menu);
    if (window.lucide) lucide.createIcons({ nodes: [menu] });
    _menuStack.push({ el: menu, voceGenitore: null });

    const larghezza = menu.offsetWidth;
    const altezza = menu.offsetHeight;
    const margine = 8;
    let x, y;
    if (daPuntatore) {
        x = origine.clientX;
        y = origine.clientY;
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

    document.addEventListener('mousedown', _menuOnPointerDown, true);
    document.addEventListener('contextmenu', _menuOnPointerDown, true);
    window.addEventListener('scroll', _menuOnScroll, true);
    window.addEventListener('resize', _menuOnScroll);
};

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
        if (_menuAncora === btn) { window.chiudiMenuContestuale(true, 0); return; }
        let ancora: HTMLElement = btn;
        if (typeof opzioni.preparaApertura === 'function') {
            const sostituto = opzioni.preparaApertura();
            if (sostituto) ancora = sostituto;
        }
        window.apriMenuContestuale(ancora, costruisciVoci());
    };
    return btn;
};
