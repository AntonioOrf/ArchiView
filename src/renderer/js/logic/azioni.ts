const EVENTI_AZIONE = ['click', 'change', 'input', 'keydown', 'submit', 'contextmenu', 'mousedown'];
const _azioniAgganciate = new WeakMap<Element, Set<string>>();

window.ARG = Object.freeze({
    elemento: { $: 'this' },
    evento: { $: 'event' },
    valore: { $: 'value' },
    spunta: { $: 'checked' },
});

const _chiama = (nome: string, ...args: any[]) => {
    const fn = (window as any)[nome];
    if (typeof fn === 'function') return fn(...args);
    console.error(`Azione "${nome}": la funzione non esiste.`);
};

const _consentita = (nome: unknown): nome is string => {
    if (typeof nome === 'string' && AZIONI_CONSENTITE.has(nome)) return true;
    console.error(`Azione "${String(nome)}" non consentita: non compare in azioniConsentite.ts.`);
    return false;
};
const _chiamaConsentita = (nome: unknown, ...args: any[]) => {
    if (_consentita(nome)) return _chiama(nome, ...args);
};

const ELEMENTI_CLICCABILI: ReadonlySet<string> = new Set(['trasc-file-input']);

const AZIONI: Record<string, (el: HTMLElement, e: Event, ...args: any[]) => any> = {
    suInvio(_el, e, nome, previeni) {
        if ((e as KeyboardEvent).key !== 'Enter') return;
        if (previeni) e.preventDefault();
        _chiamaConsentita(nome);
    },
    inSequenza(_el, _e, ...nomi) {
        for (const nome of nomi) {
            if (_consentita(nome) && typeof (window as any)[nome] === 'function') (window as any)[nome]();
        }
    },
    seEsiste(_el, _e, nome, ...args) {
        if (_consentita(nome) && typeof (window as any)[nome] === 'function') return (window as any)[nome](...args);
    },
    fermaEChiama(_el, e, nome, ...args) {
        e.stopPropagation();
        return _chiamaConsentita(nome, ...args);
    },
    linkEsterno(_el, e, url) {
        e.stopPropagation();
        e.preventDefault();
        _chiama('apriLinkEsternoSicuro', url);
    },
    nonRubareFuoco(_el, e) {
        e.preventDefault();
    },
    formatta(_el, _e, comando) {
        document.execCommand(comando, false, null);
        if (typeof window.updateToolbarState === 'function') window.updateToolbarState();
    },
    cliccaElemento(_el, _e, id) {
        if (!ELEMENTI_CLICCABILI.has(id)) {
            console.error(`cliccaElemento: id "${String(id)}" non ammesso.`);
            return;
        }
        const el = document.getElementById(id);
        if (el) el.click();
    },
    fuocoEditorDaSfondo(el, e) {
        if (e.target !== el) return;
        const editor = document.getElementById('trascrizione-editor');
        if (editor) editor.focus();
    },
    azzeraTagAttivi() {
        if (window.activeTags) window.activeTags.clear();
        _chiama('renderMain');
        _chiama('renderTagList');
    },
    gestisciArchivi() {
        _chiama('mostraWelcomeModal');
        _chiama('toggleVaultSwitcher', new Event('click'));
    },
};
window.AZIONI = AZIONI;

function _valoreArg(a, el, e) {
    if (!a || typeof a !== 'object' || Array.isArray(a) || !('$' in a)) return a;
    switch (a.$) {
        case 'this': return el;
        case 'event': return e;
        case 'value': return el.value;
        case 'checked': return el.checked;
        default: return a;
    }
}

function _eseguiAzione(el: HTMLElement, tipo: string, e: Event) {
    const nome = el.getAttribute('data-on-' + tipo);
    if (!nome) return;
    let args = [];
    const grezzi = el.getAttribute('data-args-' + tipo);
    if (grezzi) {
        try {
            args = JSON.parse(grezzi);
        } catch (err) {
            console.error(`Argomenti non validi in data-args-${tipo} per "${nome}":`, grezzi, err);
            return;
        }
    }
    const valori = (Array.isArray(args) ? args : [args]).map(a => _valoreArg(a, el, e));
    try {
        if (Object.prototype.hasOwnProperty.call(AZIONI, nome)) return AZIONI[nome](el, e, ...valori);
        return _chiamaConsentita(nome, ...valori);
    } catch (err) {
        console.error(`Azione "${nome}" (${tipo}) fallita:`, err);
    }
}

for (const tipo of EVENTI_AZIONE) {
    document.addEventListener(tipo, (e) => {
        for (const nodo of e.composedPath()) {
            if (!(nodo instanceof HTMLElement) || !nodo.hasAttribute('data-on-' + tipo)) continue;
            if (nodo.isContentEditable || nodo.closest('[data-contenuto-utente]')) continue;
            let tipi = _azioniAgganciate.get(nodo);
            if (!tipi) { tipi = new Set(); _azioniAgganciate.set(nodo, tipi); }
            if (tipi.has(tipo)) continue;
            tipi.add(tipo);
            nodo.addEventListener(tipo, (ev) => _eseguiAzione(nodo, tipo, ev));
        }
    }, true);
}

window.azione = function(tipo: string, nome: string, ...args: any[]) {
    const base = `data-on-${tipo}="${window.escapeHTML(nome)}"`;
    return args.length ? `${base} data-args-${tipo}="${window.escapeHTML(JSON.stringify(args))}"` : base;
};
