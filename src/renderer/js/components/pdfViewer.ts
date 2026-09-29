// Visualizzatore PDF della trascrizione, una pagina per volta.
//
// Prima il PDF stava in un <iframe> col visualizzatore di Chromium: comodo, ma l'app non
// poteva sapere quale pagina l'utente stesse guardando, e la trascrizione per pagina era
// impossibile. Qui pdf.js disegna la pagina scelta dall'app e la consegna come immagine
// allo STESSO <img> del visualizzatore immagini (imageViewer.ts): zoom, pan, rotazione e
// filtri paleografici valgono identici per carte fotografate e pagine di PDF, senza un
// secondo insieme di comandi da tenere allineato.
//
// I byte non li legge il renderer: li chiede al main a intervalli (`pdfAllegatoIntervallo`),
// perché da file:// verso `local-asset://` Chromium blocca le richieste. pdf.js domanda
// solo i pezzi della pagina che disegna, quindi aprire la p. 200 di un facsimile da 300 MB
// non lo carica intero.
//
// Lo stato sta dentro la IIFE: il bundle di produzione concatena gli script in un unico
// scope, e nomi come `doc` o `cache` a livello globale collidrebbero.
(function () {
    // Lato lungo della resa, in pixel. Sotto i 1600 lo zoom sgrana subito; sopra i 3200 la
    // resa di una pagina costa più di quanto l'occhio guadagni nel pannello affiancato.
    const LATO_MIN = 1600;
    const LATO_MAX = 3200;
    // Tetto di pixel per pagina: un PDF con una tavola ripiegata di 2 metri non deve
    // chiedere un canvas da centinaia di megabyte.
    const MAX_PIXEL = 16000000;
    // Pagine tenute pronte: la corrente, le vicine già viste e quella prefetchata.
    const CACHE_PAGINE = 6;
    const ATTESA_AVVIO_MS = 15000;

    let caricamento = null;

    /** Carica pdf.js alla prima necessità (vedi src/renderer/pdf/avvioPdfjs.mjs). */
    function caricaPdfjs() {
        if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
        if (caricamento) return caricamento;
        caricamento = new Promise((risolvi, rifiuta) => {
            let timer = null;
            const pronto = () => { clearTimeout(timer); risolvi(window.pdfjsLib); };
            const fallito = (motivo) => {
                clearTimeout(timer);
                window.removeEventListener('pdfjs-pronto', pronto);
                caricamento = null;
                rifiuta(new Error(motivo));
            };
            window.addEventListener('pdfjs-pronto', pronto, { once: true });
            // Un errore di valutazione del modulo non fa scattare `onerror`: senza il timer
            // il pannello resterebbe in attesa per sempre.
            timer = setTimeout(() => fallito('pdf.js non si è avviato'), ATTESA_AVVIO_MS);
            const script = document.createElement('script');
            script.type = 'module';
            script.src = 'pdf/avvioPdfjs.mjs';
            script.onerror = () => fallito('pdf.js non trovato');
            document.head.appendChild(script);
        });
        return caricamento;
    }

    // --- Stato del documento aperto ----------------------------------------------
    let doc = null;
    let compito = null;
    let nomeAperto = null;
    let aperturaInCorso = null;
    let lato = 0;
    const cache = new Map();       // pagina → URL blob (ordine = uso, per l'LRU)
    const inResa = new Map();      // pagina → Promise<URL> di una resa già avviata
    let urlMostrato = null;
    let generazioneVista = 0;
    let generazioneRicerca = 0;
    let testi = [];                // pagina-1 → testo del livello testo, o null se non letto

    function svuotaCache() {
        for (const url of cache.values()) URL.revokeObjectURL(url);
        cache.clear();
        inResa.clear();
        urlMostrato = null;
    }

    async function chiudi() {
        generazioneVista++;
        generazioneRicerca++;
        svuotaCache();
        testi = [];
        lato = 0;
        nomeAperto = null;
        aperturaInCorso = null;
        const d = doc, c = compito;
        doc = null;
        compito = null;
        try { if (d) await d.destroy(); else if (c) await c.destroy(); } catch (e) { console.warn('[PDF] Chiusura:', e); }
    }

    /**
     * Apre il PDF `nome` della cartella allegati. Riaprire lo stesso nome è gratis: il
     * documento resta aperto finché non se ne apre un altro, così sfogliare le pagine e
     * tornare allo stesso allegato non rifà il parsing.
     *
     * @returns {ok, pagine} oppure {ok:false, errore}
     */
    async function apri(nome) {
        if (nomeAperto === nome) {
            if (aperturaInCorso) return aperturaInCorso;
            if (doc) return { ok: true, pagine: doc.numPages };
        }
        await chiudi();
        nomeAperto = nome;

        const questa = (async () => {
            try {
                const lib = await caricaPdfjs();
                const info = await window.apiBrowser.pdfAllegatoInfo(nome);
                if (!info || !info.ok) throw new Error((info && info.errore) || 'PDF non leggibile');

                const trasporto = new lib.PDFDataRangeTransport(info.dimensione, info.iniziale);
                const t = lib.getDocument({
                    range: trasporto,
                    // Un PDF resta un formato ostile anche quando è un allegato dell'utente:
                    // niente codice valutato, niente moduli XFA.
                    isEvalSupported: false,
                    enableXfa: false,
                    // Solo i pezzi che servono alla pagina richiesta: senza, pdf.js
                    // scaricherebbe in sottofondo tutto il file.
                    disableAutoFetch: true,
                    disableStream: true,
                    rangeChunkSize: 256 * 1024
                });
                trasporto.requestDataRange = (inizio, fine) => {
                    window.apiBrowser.pdfAllegatoIntervallo(nome, inizio, fine).then((r) => {
                        if (r && r.ok) { trasporto.onDataRange(inizio, r.dati); return; }
                        // Senza i byte pdf.js aspetterebbe per sempre: meglio chiudere e far
                        // vedere l'errore che lasciare un pannello bianco.
                        console.error('[PDF] Lettura intervallo fallita:', r && r.errore);
                        t.destroy();
                    }, (e) => {
                        console.error('[PDF] Lettura intervallo fallita:', e);
                        t.destroy();
                    });
                };
                compito = t;
                const d = await t.promise;
                if (nomeAperto !== nome) { d.destroy(); return { ok: false, errore: 'annullato' }; }
                doc = d;
                testi = new Array(d.numPages).fill(null);
                return { ok: true, pagine: d.numPages };
            } catch (e) {
                console.error('[PDF] Apertura fallita:', e);
                if (nomeAperto === nome) nomeAperto = null;
                return { ok: false, errore: (e && e.message) || String(e) };
            } finally {
                if (aperturaInCorso === questa) aperturaInCorso = null;
            }
        })();
        aperturaInCorso = questa;
        return questa;
    }

    function ricordaInCache(pagina, url) {
        cache.delete(pagina);
        cache.set(pagina, url);
        for (const [p, u] of cache) {
            if (cache.size <= CACHE_PAGINE) break;
            // L'immagine a schermo non si revoca: l'<img> la perderebbe al primo repaint.
            if (u === urlMostrato) continue;
            URL.revokeObjectURL(u);
            cache.delete(p);
        }
    }

    function calcolaLato(viewport) {
        const dpr = window.devicePixelRatio || 1;
        const misura = viewport ? Math.max(viewport.clientWidth, viewport.clientHeight) : 0;
        return Math.round(Math.min(LATO_MAX, Math.max(LATO_MIN, misura * dpr * 1.5)));
    }

    function immaginePagina(pagina) {
        if (cache.has(pagina)) {
            const url = cache.get(pagina);
            ricordaInCache(pagina, url);
            return Promise.resolve(url);
        }
        if (inResa.has(pagina)) return inResa.get(pagina);

        const d = doc;
        const promessa = (async () => {
            const p = await d.getPage(pagina);
            try {
                const base = p.getViewport({ scale: 1 });
                let scala = lato / Math.max(base.width, base.height);
                if (base.width * base.height * scala * scala > MAX_PIXEL) {
                    scala = Math.sqrt(MAX_PIXEL / (base.width * base.height));
                }
                const vp = p.getViewport({ scale: scala });
                const canvas = document.createElement('canvas');
                canvas.width = Math.floor(vp.width);
                canvas.height = Math.floor(vp.height);
                const ctx = canvas.getContext('2d');
                // Fondo bianco esplicito: una pagina trasparente diventerebbe nera in JPEG.
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await p.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
                // JPEG e non PNG: su una carta fotografata di 3000 px la codifica PNG costa
                // centinaia di millisecondi a ogni cambio pagina, e la differenza non si vede.
                const blob = await new Promise<Blob>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
                canvas.width = 0;
                canvas.height = 0;
                if (!blob) throw new Error('Resa della pagina non riuscita');
                return URL.createObjectURL(blob);
            } finally {
                p.cleanup();
            }
        })();
        inResa.set(pagina, promessa);
        promessa.then((url) => {
            inResa.delete(pagina);
            // Il documento è cambiato mentre si disegnava: l'immagine non serve più.
            if (doc !== d) { URL.revokeObjectURL(url); return; }
            ricordaInCache(pagina, url);
        }, () => inResa.delete(pagina));
        return promessa;
    }

    /**
     * Mette la pagina `pagina` nell'`<img>` e prepara la successiva. Se nel frattempo è stata
     * chiesta un'altra pagina, questa non tocca l'immagine: sfogliando in fretta, l'ultima
     * richiesta deve vincere anche se arriva prima di quelle vecchie.
     *
     * @returns true se l'immagine mostrata è quella chiesta.
     */
    async function mostraPagina(pagina, img, viewport) {
        if (!doc) return false;
        const gen = ++generazioneVista;
        if (!lato) lato = calcolaLato(viewport);
        const n = Math.min(Math.max(1, pagina), doc.numPages);
        const url = await immaginePagina(n);
        if (gen !== generazioneVista) return false;
        urlMostrato = url;
        img.src = url;
        if (n < doc.numPages) immaginePagina(n + 1).catch(() => { /* prefetch: si riproverà */ });
        return true;
    }

    /** Livello testo della pagina (vuoto sulle scansioni senza OCR incorporato). */
    async function testoPagina(n) {
        if (!doc) return '';
        if (typeof testi[n - 1] === 'string') return testi[n - 1];
        const p = await doc.getPage(n);
        try {
            const contenuto = await p.getTextContent();
            let s = '';
            for (const it of contenuto.items) {
                if (typeof it.str !== 'string') continue;
                s += it.str + (it.hasEOL ? '\n' : '');
            }
            testi[n - 1] = s;
            return s;
        } finally {
            p.cleanup();
        }
    }

    /**
     * Cerca `query` nel livello testo di tutte le pagine. Una nuova ricerca annulla quella in
     * corso (restituisce null): è la ricerca "mentre si digita", e su trecento pagine la
     * vecchia arriverebbe dopo la nuova.
     *
     * @returns [{pagina, conteggio, estratto}] oppure null se superata.
     */
    async function cerca(query, onProgresso) {
        const gen = ++generazioneRicerca;
        const q = window.normalizzaTesto(query).trim();
        if (!q || !doc) return [];
        const risultati = [];
        const totale = doc.numPages;
        for (let n = 1; n <= totale; n++) {
            if (gen !== generazioneRicerca || !doc) return null;
            let testo = '';
            try { testo = await testoPagina(n); } catch (e) { console.warn('[PDF] Testo p.', n, e); }
            const norm = window.normalizzaTesto(testo);
            let conteggio = 0;
            let primo = -1;
            for (let i = norm.indexOf(q); i !== -1; i = norm.indexOf(q, i + q.length)) {
                if (primo === -1) primo = i;
                conteggio++;
            }
            if (conteggio) risultati.push({ pagina: n, conteggio, estratto: window.estrattoAttorno(testo, primo, q.length) });
            if (onProgresso) onProgresso(n, totale);
        }
        return gen === generazioneRicerca ? risultati : null;
    }

    window.PdfViewer = {
        apri,
        chiudi,
        mostraPagina,
        cerca,
        testoPagina,
        numeroPagine: () => (doc ? doc.numPages : 0),
        nomeAperto: () => (doc ? nomeAperto : null)
    };
})();

/**
 * Estratto di ~60 caratteri attorno a una corrispondenza, su una riga sola. Gli offset
 * valgono sul testo originale perché `normalizzaTesto` preserva la lunghezza del testo
 * precomposto (vedi utils.ts).
 */
window.estrattoAttorno = function(testo, indice, lunghezza) {
    const s = String(testo || '');
    if (indice < 0) return '';
    const inizio = Math.max(0, indice - 30);
    const fine = Math.min(s.length, indice + lunghezza + 30);
    return (inizio > 0 ? '…' : '') + s.slice(inizio, fine).replace(/\s+/g, ' ').trim() + (fine < s.length ? '…' : '');
};
