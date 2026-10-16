(function () {
    const LATO_MIN = 1600;
    const LATO_MAX = 3200;
    const MAX_PIXEL = 16000000;
    const CACHE_PAGINE = 6;
    const ATTESA_AVVIO_MS = 15000;

    let caricamento = null;

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
            timer = setTimeout(() => fallito('pdf.js non si è avviato'), ATTESA_AVVIO_MS);
            const script = document.createElement('script');
            script.type = 'module';
            script.src = 'pdf/avvioPdfjs.mjs';
            script.onerror = () => fallito('pdf.js non trovato');
            document.head.appendChild(script);
        });
        return caricamento;
    }

    function creaPdfViewer() {
        let doc = null;
        let compito = null;
        let nomeAperto = null;
        let aperturaInCorso = null;
        let lato = 0;
        const cache = new Map();
        const inResa = new Map();
        let urlMostrato = null;
        let generazioneVista = 0;
        let generazioneRicerca = 0;
        let testi = [];

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
                        isEvalSupported: false,
                        enableXfa: false,
                        disableAutoFetch: true,
                        disableStream: true,
                        rangeChunkSize: 256 * 1024
                    });
                    trasporto.requestDataRange = (inizio, fine) => {
                        window.apiBrowser.pdfAllegatoIntervallo(nome, inizio, fine).then((r) => {
                            if (r && r.ok) { trasporto.onDataRange(inizio, r.dati); return; }
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
                if (u === urlMostrato) continue;
                URL.revokeObjectURL(u);
                cache.delete(p);
            }
        }

        function calcolaLato(viewport) {
            const dpr = window.devicePixelRatio || 1;
            const misura = viewport ? Math.max(viewport.clientWidth, viewport.clientHeight) : 0;
            const massimo = Math.min(LATO_MAX, Math.max(LATO_MIN, Number(window.pdfRisoluzioneMassima) || LATO_MAX));
            return Math.round(Math.min(massimo, Math.max(LATO_MIN, misura * dpr * 1.5)));
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
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    await p.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
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
                if (doc !== d) { URL.revokeObjectURL(url); return; }
                ricordaInCache(pagina, url);
            }, () => inResa.delete(pagina));
            return promessa;
        }

        async function mostraPagina(pagina, img, viewport) {
            if (!doc) return false;
            const gen = ++generazioneVista;
            if (!lato) lato = calcolaLato(viewport);
            const n = Math.min(Math.max(1, pagina), doc.numPages);
            const url = await immaginePagina(n);
            if (gen !== generazioneVista) return false;
            urlMostrato = url;
            img.src = url;
            if (n < doc.numPages) immaginePagina(n + 1).catch(() => {});
            return true;
        }

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

        return {
            apri,
            chiudi,
            mostraPagina,
            cerca,
            testoPagina,
            numeroPagine: () => (doc ? doc.numPages : 0),
            nomeAperto: () => (doc ? nomeAperto : null)
        };
    }

    window.creaPdfViewer = creaPdfViewer;
    window.PdfViewer = creaPdfViewer();
})();

window.estrattoAttorno = function(testo, indice, lunghezza) {
    const s = String(testo || '');
    if (indice < 0) return '';
    const inizio = Math.max(0, indice - 30);
    const fine = Math.min(s.length, indice + lunghezza + 30);
    return (inizio > 0 ? '…' : '') + s.slice(inizio, fine).replace(/\s+/g, ' ').trim() + (fine < s.length ? '…' : '');
};
