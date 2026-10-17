(function() {
    const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const SKIP_IDS = new Set(['cloud-progress-overlay']);

    const openTriggers = new WeakMap();
    let labelledbyCounter = 0;

    function isVisible(el) {
        if (!el || SKIP_IDS.has(el.id)) return false;
        if (el.classList.contains('hidden-tab') || el.classList.contains('hidden')) return false;
        return el.getClientRects().length > 0;
    }

    function tutorialAttivo() {
        return document.body.classList.contains('driver-active');
    }

    function getWindow(modal) {
        return modal.querySelector('.modal-window') || modal;
    }

    function getFocusable(win) {
        return Array.from(win.querySelectorAll(FOCUSABLE) as NodeListOf<HTMLElement>)
            .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled'));
    }

    function getTopModal() {
        const aperti = Array.from(document.querySelectorAll('.modal-overlay')).filter(isVisible);
        if (!aperti.length) return null;
        let top = aperti[0];
        let topZ = -1;
        for (const m of aperti) {
            const z = parseInt(window.getComputedStyle(m).zIndex) || 0;
            if (z >= topZ) { topZ = z; top = m; }
        }
        return top;
    }

    function applicaSemantica(modal) {
        const win = getWindow(modal);
        if (win.getAttribute('role') !== 'dialog') win.setAttribute('role', 'dialog');
        win.setAttribute('aria-modal', 'true');
        if (!win.hasAttribute('aria-labelledby')) {
            const titolo = win.querySelector('.modal-title, h2, h3');
            if (titolo) {
                if (!titolo.id) titolo.id = 'modal-title-auto-' + (++labelledbyCounter);
                win.setAttribute('aria-labelledby', titolo.id);
            }
        }
    }

    function focusFirst(modal) {
        const win = getWindow(modal);
        if (win.contains(document.activeElement)) return;
        const f = getFocusable(win);
        if (f.length) {
            f[0].focus();
        } else {
            if (!win.hasAttribute('tabindex')) win.setAttribute('tabindex', '-1');
            win.focus();
        }
    }

    function onOpen(modal) {
        openTriggers.set(modal, document.activeElement);
        applicaSemantica(modal);
        if (tutorialAttivo()) return;
        setTimeout(() => { if (isVisible(modal) && !tutorialAttivo()) focusFirst(modal); }, 0);
    }

    function onClose(modal) {
        const trigger = openTriggers.get(modal);
        openTriggers.delete(modal);
        if (tutorialAttivo()) return;
        if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
            setTimeout(() => trigger.focus(), 0);
        }
    }

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Tab') return;
        if (tutorialAttivo()) return;
        const modal = getTopModal();
        if (!modal) return;
        const win = getWindow(modal);
        const f = getFocusable(win);
        if (!f.length) { e.preventDefault(); return; }
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement;
        if (!win.contains(active)) {
            e.preventDefault();
            first.focus();
        } else if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    }, true);

    const observed = new WeakSet();
    function attach(modal) {
        if (observed.has(modal)) return;
        observed.add(modal);
        let wasVisible = isVisible(modal);
        if (wasVisible) onOpen(modal);
        const mo = new MutationObserver(() => {
            const now = isVisible(modal);
            if (now && !wasVisible) onOpen(modal);
            else if (!now && wasVisible) onClose(modal);
            wasVisible = now;
        });
        mo.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
    }

    function scan() {
        document.querySelectorAll('.modal-overlay').forEach(attach);
    }

    document.addEventListener('DOMContentLoaded', () => {
        scan();
        const bodyObserver = new MutationObserver((mutations) => {
            for (const mut of mutations) {
                mut.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const el = node as Element;
                    if (el.classList && el.classList.contains('modal-overlay')) attach(el);
                    if (el.querySelectorAll) el.querySelectorAll('.modal-overlay').forEach(attach);
                });
                mut.removedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const el = node as Element;
                    if (openTriggers.has(el)) onClose(el);
                    if (el.querySelectorAll) el.querySelectorAll('.modal-overlay').forEach(m => { if (openTriggers.has(m)) onClose(m); });
                });
            }
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });
        agganciaVistaTrascrizione();
    });

    function agganciaVistaTrascrizione() {
        const vista = document.getElementById('view-trascrizione');
        if (!vista) return;
        const editor = document.getElementById('trascrizione-editor');
        if (editor) {
            editor.setAttribute('role', 'textbox');
            editor.setAttribute('aria-multiline', 'true');
            editor.setAttribute('aria-label', window.t ? window.t('transcription_editor_label', 'Testo della trascrizione') : 'Testo della trascrizione');
        }
        const sotto = () => {
            const main = document.querySelector('body > div main');
            return [
                document.querySelector('body > .skip-link'), document.querySelector('body > header'), main && main.parentElement,
                document.getElementById('update-banner'), document.getElementById('tutorial-banner'),
            ].filter(Boolean) as HTMLElement[];
        };
        let aperta = isVisible(vista);
        let trigger: any = null;
        const applica = (ora) => {
            sotto().forEach(el => { (el as HTMLElement).inert = ora; });
            if (ora) {
                trigger = document.activeElement;
                if (tutorialAttivo()) return;
                setTimeout(() => {
                    const dest = document.getElementById('trascrizione-editor') || vista.querySelector('button');
                    if (dest && isVisible(vista) && !vista.contains(document.activeElement)) dest.focus({ preventScroll: true });
                }, 0);
            } else if (trigger && document.contains(trigger) && typeof trigger.focus === 'function' && !trigger.inert) {
                const t = trigger;
                trigger = null;
                setTimeout(() => t.focus({ preventScroll: true }), 0);
            }
        };
        if (aperta) applica(true);
        new MutationObserver(() => {
            const ora = isVisible(vista);
            if (ora !== aperta) { aperta = ora; applica(ora); }
        }).observe(vista, { attributes: true, attributeFilter: ['class', 'style'] });
    }
})();
