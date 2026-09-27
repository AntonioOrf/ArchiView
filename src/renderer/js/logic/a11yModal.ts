// P2.3 — Accessibilità modali centralizzata:
// - semantica ARIA (role="dialog" / aria-modal / aria-labelledby) impostata a runtime
// - focus spostato dentro il modale all'apertura e ripristinato al trigger alla chiusura
// - focus-trap su Tab/Shift+Tab (lo sfondo non è più raggiungibile da tastiera)
(function() {
    const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // I progress/overlay puramente informativi non devono catturare il focus
    const SKIP_IDS = new Set(['cloud-progress-overlay']);

    // Trigger (elemento attivo prima dell'apertura) memorizzato per-modale: ripristino affidabile
    // anche quando i modali vengono rimossi dal DOM invece che semplicemente nascosti.
    const openTriggers = new WeakMap();
    let labelledbyCounter = 0;

    function isVisible(el) {
        if (!el || SKIP_IDS.has(el.id)) return false;
        if (el.classList.contains('hidden-tab') || el.classList.contains('hidden')) return false;
        // NON usare offsetParent: per un elemento `position: fixed` è null per definizione,
        // e ogni .modal-overlay è fixed. Con quel test isVisible restituiva sempre false,
        // quindi onOpen/onClose e il focus-trap non si attivavano su NESSUN modale.
        return el.getClientRects().length > 0;
    }

    // Durante un tour driver.js (body.driver-active) è driver a gestire focus/overlay e ad
    // aprire i modali come parte della guida: il nostro focus-trap intrappolerebbe il Tab nel
    // modale rendendo irraggiungibili i bottoni del popover (X inclusa). Stiamo quindi a riposo.
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
        applicaSemantica(modal); // la semantica ARIA è innocua anche durante il tutorial
        if (tutorialAttivo()) return; // niente focus-stealing: lo gestisce driver.js
        // Defer: il contenuto del modale potrebbe essere popolato subito dopo il toggle di visibilità
        setTimeout(() => { if (isVisible(modal) && !tutorialAttivo()) focusFirst(modal); }, 0);
    }

    function onClose(modal) {
        const trigger = openTriggers.get(modal);
        openTriggers.delete(modal);
        if (tutorialAttivo()) return; // niente ripristino focus durante il tutorial
        if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
            setTimeout(() => trigger.focus(), 0);
        }
    }

    // Focus-trap globale (capture per intercettare prima di altri handler)
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Tab') return;
        if (tutorialAttivo()) return; // il focus-trap cederebbe i bottoni del tour driver.js
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
        if (wasVisible) onOpen(modal); // modale già visibile al momento dell'aggancio
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
        // Aggancia anche i modali iniettati dinamicamente nel body
        const bodyObserver = new MutationObserver((mutations) => {
            for (const mut of mutations) {
                mut.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const el = node as Element;
                    if (el.classList && el.classList.contains('modal-overlay')) attach(el);
                    if (el.querySelectorAll) el.querySelectorAll('.modal-overlay').forEach(attach);
                });
                // Modale rimosso dal DOM mentre era aperto → ripristina il focus al trigger
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

    // O4 — la vista trascrizione è un overlay `fixed inset-0` figlio del body, non un
    // .modal-overlay: aprendola il fuoco restava sul body e il Tab finiva, una volta su
    // quattro, su bottoni di intestazione e sidebar COPERTI dalla vista (2.4.3, 2.4.11).
    // Si rende inerte solo l'app sottostante — intestazione e layout — e non gli altri figli
    // del body: modali, toast, menu e tutorial devono poter comparire SOPRA la trascrizione.
    function agganciaVistaTrascrizione() {
        const vista = document.getElementById('view-trascrizione');
        if (!vista) return;
        const editor = document.getElementById('trascrizione-editor');
        if (editor) {
            // Un div contenteditable senza ruolo né nome è annunciato come "modificabile" e basta.
            editor.setAttribute('role', 'textbox');
            editor.setAttribute('aria-multiline', 'true');
            editor.setAttribute('aria-label', window.t ? window.t('transcription_editor_label', 'Testo della trascrizione') : 'Testo della trascrizione');
        }
        const sotto = () => {
            const main = document.querySelector('body > div main');
            // Anche lo skip link: porterebbe a un <main> coperto e inerte.
            return [document.querySelector('body > .skip-link'), document.querySelector('body > header'), main && main.parentElement].filter(Boolean) as HTMLElement[];
        };
        let aperta = isVisible(vista);
        let trigger = null;
        const applica = (ora) => {
            sotto().forEach(el => { (el as HTMLElement).inert = ora; });
            if (ora) {
                trigger = document.activeElement;
                if (tutorialAttivo()) return; // durante il tour il fuoco lo gestisce driver.js
                // Defer: la vista si popola subito dopo il cambio di classe.
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
