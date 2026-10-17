(function () {
    const L = window.lucide;
    if (!L || typeof L.createElement !== 'function' || !L.icons || L.__archiview) return;

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const chiaveIcona = (nome: string) => {
        const camel = nome.replace(/^([A-Z])|[\s-_]+(\w)/g, (_m, iniziale, dopo) =>
            dopo ? dopo.toUpperCase() : iniziale.toLowerCase());
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    };

    const daDisegnare = (el: Element, nome: string) =>
        el.namespaceURI !== SVG_NS || !el.classList.contains('lucide-' + nome);

    function disegna(el: Element, nome: string) {
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
        el.replaceWith(svg);
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
