// Handler degli eventi senza JavaScript nell'HTML: la CSP può fare a meno di 'unsafe-inline'.
//
// Nel markup, al posto di onclick="fn(a, 1)":
//     data-on-click="fn" data-args-click="[&quot;a&quot;,1]"
// e nei template la stessa cosa si scrive ${window.azione('click', 'fn', a, 1)}.
// Il nome si cerca prima fra le AZIONI qui sotto (la logica che prima stava scritta
// nell'attributo), poi su window. Gli argomenti sono JSON: un valore arrivato da un vault
// condiviso resta un dato e non può diventare codice (era il rischio che jsArg tamponava).
// Segnaposto negli argomenti: ARG.elemento (this), ARG.evento (event), ARG.valore
// (this.value), ARG.spunta (this.checked).
//
// Semantica identica agli on*="" inline: l'handler sta sull'ELEMENTO, non sul document. Un
// listener in cattura sul document lo aggancia la prima volta che un evento attraversa
// l'elemento; i listener aggiunti a un nodo prima che l'evento lo raggiunga vengono eseguiti,
// quindi anche il primo evento arriva. Ordine di bolla e stopPropagation restano quelli di
// prima: con una delega classica sul document, uno stopPropagation su un pulsante dentro una
// scheda arriverebbe dopo il click della scheda, invece di fermarlo.

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

/** Azioni con logica propria: ricevono (elemento, evento, ...argomenti). */
const AZIONI: Record<string, (el: HTMLElement, e: Event, ...args: any[]) => any> = {
    // Invio in un campo esegue la conferma; con `previeni` non invia anche il form attorno.
    suInvio(_el, e, nome, previeni) {
        if ((e as KeyboardEvent).key !== 'Enter') return;
        if (previeni) e.preventDefault();
        _chiama(nome);
    },
    // Più passi in fila (chiudi un modale, apri l'altro); un passo assente si salta.
    inSequenza(_el, _e, ...nomi) {
        for (const nome of nomi) if (typeof (window as any)[nome] === 'function') (window as any)[nome]();
    },
    // Chiamata facoltativa: la funzione può non essere ancora caricata.
    seEsiste(_el, _e, nome, ...args) {
        if (typeof (window as any)[nome] === 'function') return (window as any)[nome](...args);
    },
    // Pulsante dentro una scheda cliccabile: agisce senza aprire la scheda.
    fermaEChiama(_el, e, nome, ...args) {
        e.stopPropagation();
        return _chiama(nome, ...args);
    },
    linkEsterno(_el, e, url) {
        e.stopPropagation();
        e.preventDefault();
        _chiama('apriLinkEsternoSicuro', url);
    },
    // Barra dell'editor: il mousedown non deve togliere il fuoco (e la selezione) al testo.
    nonRubareFuoco(_el, e) {
        e.preventDefault();
    },
    formatta(_el, _e, comando) {
        document.execCommand(comando, false, null);
        if (typeof window.updateToolbarState === 'function') window.updateToolbarState();
    },
    cliccaElemento(_el, _e, id) {
        const el = document.getElementById(id);
        if (el) el.click();
    },
    // Click sul margine del foglio (non sul testo): porta il cursore nell'editor.
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
        return _chiama(nome, ...valori);
    } catch (err) {
        console.error(`Azione "${nome}" (${tipo}) fallita:`, err);
    }
}

for (const tipo of EVENTI_AZIONE) {
    document.addEventListener(tipo, (e) => {
        for (const nodo of e.composedPath()) {
            if (!(nodo instanceof HTMLElement) || !nodo.hasAttribute('data-on-' + tipo)) continue;
            let tipi = _azioniAgganciate.get(nodo);
            if (!tipi) { tipi = new Set(); _azioniAgganciate.set(nodo, tipi); }
            if (tipi.has(tipo)) continue;
            tipi.add(tipo);
            nodo.addEventListener(tipo, (ev) => _eseguiAzione(nodo, tipo, ev));
        }
    }, true);
}

/**
 * Attributi per un template: ${window.azione('click', 'fn', a, b)}. Il nome e gli argomenti
 * passano da escapeHTML, quindi qualunque valore resta dentro l'attributo.
 */
window.azione = function(tipo: string, nome: string, ...args: any[]) {
    const base = `data-on-${tipo}="${window.escapeHTML(nome)}"`;
    return args.length ? `${base} data-args-${tipo}="${window.escapeHTML(JSON.stringify(args))}"` : base;
};
