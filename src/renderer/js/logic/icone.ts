// Conversione delle icone lucide (`<i data-lucide="nome">` → `<svg>`).
//
// Sostituisce `lucide.createIcons` per due difetti di lucide 1.x misurati all'avvio
// (PIANO-SICUREZZA-OTTIMIZZAZIONE.md, Fase 3):
//  1. l'opzione è `root`, non `nodes`: le chiamate `createIcons({ nodes: [...] })` sparse nel
//     codice scandivano in realtà l'intero documento;
//  2. l'`<svg>` prodotto conserva `data-lucide`, quindi ogni chiamata ricreava da capo TUTTE
//     le icone già disegnate (con migliaia di righe nella sidebar era la voce più pesante del
//     render, e staccava dal DOM i riferimenti alle icone tenuti dal codice).
// Qui si scandisce ancora l'intero documento, come faceva di fatto lucide: un segnaposto
// inserito senza una chiamata propria continua a essere convertito dalla successiva, e
// `nodes` resta accettato e ignorato. Si ridisegnano però solo i segnaposto e gli `<svg>` il
// cui `data-lucide` è stato cambiato dal codice (la classe `lucide-<nome>` dice cosa è
// disegnato): `mainView`, `cloudModal` e altri cambiano l'icona proprio così.
(function () {
    const L = window.lucide;
    if (!L || typeof L.createElement !== 'function' || !L.icons || L.__archiview) return;

    const SVG_NS = 'http://www.w3.org/2000/svg';
    // Stessa conversione nome → chiave di `icons` usata da lucide (kebab-case → PascalCase).
    const chiaveIcona = (nome: string) => {
        const camel = nome.replace(/^([A-Z])|[\s-_]+(\w)/g, (_m, iniziale, dopo) =>
            dopo ? dopo.toUpperCase() : iniziale.toLowerCase());
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    };

    const daDisegnare = (el: Element, nome: string) =>
        el.namespaceURI !== SVG_NS || !el.classList.contains('lucide-' + nome);

    // Equivalente della sostituzione interna di lucide: attributi dell'elemento conservati,
    // `aria-hidden` se l'icona non ha già un nome accessibile, classi `lucide lucide-<nome>`.
    function disegna(el: Element, nome: string) {
        // Il nome può venire da un HTML condiviso (una trascrizione): solo chiavi proprie.
        const chiave = chiaveIcona(nome);
        const nodo = Object.prototype.hasOwnProperty.call(L.icons, chiave) ? L.icons[chiave] : null;
        if (!Array.isArray(nodo)) {
            console.warn(`[icone] icona lucide sconosciuta: ${nome}`);
            return;
        }
        const attributi: Record<string, string> = {};
        for (const a of Array.from(el.attributes)) attributi[a.name] = a.value;
        const haNomeAccessibile = Object.keys(attributi).some(k => k.startsWith('aria-') || k === 'role' || k === 'title');
        const classi = ['lucide', 'lucide-' + nome, ...(attributi.class || '').split(' ')]
            .filter((c, i, tutte) => c && c.trim() !== '' && tutte.indexOf(c) === i);
        const svg = L.createElement(nodo, {
            'data-lucide': nome,
            ...(haNomeAccessibile ? {} : { 'aria-hidden': 'true' }),
            ...attributi,
            class: classi.join(' ')
        });
        el.parentNode.replaceChild(svg, el);
    }

    L.createIcons = function () {
        const elementi = document.querySelectorAll('[data-lucide]');
        for (let i = 0; i < elementi.length; i++) {
            const el = elementi[i];
            const nome = el.getAttribute('data-lucide');
            if (nome && el.parentNode && daDisegnare(el, nome)) disegna(el, nome);
        }
    };
    L.__archiview = true;
})();
