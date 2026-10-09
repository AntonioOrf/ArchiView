// Fase 1.2 — Visualizzatore immagini (zoom, pan, rotazione, filtri paleografici).
//
// UN SOLO componente per i due percorsi che mostrano un allegato immagine — il modal
// #image-modal e il pannello affiancato alla trascrizione — perché finora erano due
// <img object-contain> indipendenti, destinati a divergere a ogni ritocco.
// L'host fornisce solo un viewport (il contenitore con overflow nascosto) e la sua <img>:
// barra dei comandi, eventi e stato li costruisce e li possiede questo file.
//
// Nessuna dipendenza: la trasformazione è una `transform` CSS su GPU, i filtri sono
// `filter: brightness()/contrast()/invert()`. Su hardware low-end (.perf-low) la
// transizione è disattivata dal CSS, non da qui.
(function () {
    const SCALA_MIN = 0.1;
    const SCALA_MAX = 12;
    const PASSO_ZOOM = 1.2;
    // Frazione dell'immagine (o del viewport, se più piccolo) che il pan lascia sempre in vista.
    const QUOTA_VISIBILE = 0.25;

    /**
     * Scala richiesta da una modalità di adattamento. Funzione PURA (nessun DOM): è il solo
     * pezzo con aritmetica non banale, ed è quello coperto dal test unit.
     *
     * `cw`/`ch` sono le dimensioni di LAYOUT dell'immagine (già contenute dal max-width/height
     * del CSS, quindi a scala 1 l'immagine è per definizione "adattata" alla pagina), `nw` la
     * larghezza naturale in pixel, `rot` la rotazione in gradi.
     * Con rotazione di 90/270 le due dimensioni si scambiano: senza questo scambio "adatta
     * alla larghezza" su una carta ruotata dà una scala che sborda dal viewport.
     */
    window.calcolaScalaFit = function (modo, d) {
        const vw = d.vw || 0, vh = d.vh || 0;
        const cw = d.cw || 0, ch = d.ch || 0;
        if (!vw || !vh || !cw || !ch) return 1;

        if (modo === 'reale') {
            // 1:1 = un pixel dell'immagine per un pixel dello schermo.
            return d.nw ? d.nw / cw : 1;
        }

        const ruotato = Math.abs(((d.rot || 0) % 180 + 180) % 180 - 90) < 1;
        const larghezza = ruotato ? ch : cw;
        const altezza = ruotato ? cw : ch;

        if (modo === 'larghezza') return vw / larghezza;
        return Math.min(vw / larghezza, vh / altezza);
    };

    function limita(valore, min, max) {
        return Math.min(max, Math.max(min, valore));
    }

    const BARRA_HTML = `
        <div class="iv-barra" role="toolbar">
            <button type="button" data-iv="zoom-out" class="iv-btn" data-i18n-title="tooltip_zoom_out" data-i18n-aria-label="tooltip_zoom_out" title="Riduci"><i data-lucide="zoom-out"></i></button>
            <span class="iv-percento" data-iv="percento">100%</span>
            <button type="button" data-iv="zoom-in" class="iv-btn" data-i18n-title="tooltip_zoom_in" data-i18n-aria-label="tooltip_zoom_in" title="Ingrandisci"><i data-lucide="zoom-in"></i></button>
            <span class="iv-sep"></span>
            <button type="button" data-iv="rot-ccw" class="iv-btn" data-i18n-title="tooltip_rotate_left" data-i18n-aria-label="tooltip_rotate_left" title="Ruota a sinistra"><i data-lucide="rotate-ccw"></i></button>
            <button type="button" data-iv="rot-cw" class="iv-btn" data-i18n-title="tooltip_rotate_right" data-i18n-aria-label="tooltip_rotate_right" title="Ruota a destra"><i data-lucide="rotate-cw"></i></button>
            <span class="iv-sep"></span>
            <button type="button" data-iv="fit" class="iv-btn" data-i18n-title="tooltip_fit_page" data-i18n-aria-label="tooltip_fit_page" title="Adatta alla pagina"><i data-lucide="scan"></i></button>
            <button type="button" data-iv="fit-width" class="iv-btn" data-i18n-title="tooltip_fit_width" data-i18n-aria-label="tooltip_fit_width" title="Adatta alla larghezza"><i data-lucide="move-horizontal"></i></button>
            <button type="button" data-iv="reale" class="iv-btn iv-btn-testo" data-i18n-title="tooltip_zoom_real" data-i18n-aria-label="tooltip_zoom_real" title="Dimensione reale">1:1</button>
            <span class="iv-sep"></span>
            <button type="button" data-iv="filtri" class="iv-btn" aria-expanded="false" data-i18n-title="tooltip_image_filters" data-i18n-aria-label="tooltip_image_filters" title="Luminosità e contrasto"><i data-lucide="sliders-horizontal"></i></button>
            <button type="button" data-iv="reset" class="iv-btn" data-i18n-title="tooltip_view_reset" data-i18n-aria-label="tooltip_view_reset" title="Ripristina la vista"><i data-lucide="refresh-ccw"></i></button>
        </div>
        <div class="iv-pannello-filtri hidden-tab" data-iv="pannello-filtri">
            <label class="iv-filtro">
                <span data-i18n="label_brightness">Luminosità</span>
                <input type="range" data-iv="luminosita" min="-100" max="100" step="1" value="0">
                <output data-iv="val-luminosita" class="iv-filtro-valore">0</output>
            </label>
            <label class="iv-filtro">
                <span data-i18n="label_contrast">Contrasto</span>
                <input type="range" data-iv="contrasto" min="-100" max="100" step="1" value="0">
                <output data-iv="val-contrasto" class="iv-filtro-valore">0</output>
            </label>
            <label class="iv-filtro iv-filtro-check">
                <input type="checkbox" data-iv="inverti">
                <span data-i18n="label_invert">Inverti (negativo)</span>
            </label>
            <label class="iv-filtro iv-solo-perf-ok">
                <span data-i18n="label_enhance">Elaborazione</span>
                <select data-iv="elaborazione">
                    <option value="" data-i18n="enhance_none">Nessuna</option>
                    <option value="r" data-i18n="enhance_red">Canale rosso</option>
                    <option value="g" data-i18n="enhance_green">Canale verde</option>
                    <option value="b" data-i18n="enhance_blue">Canale blu</option>
                    <option value="livelli" data-i18n="enhance_levels">Livelli automatici</option>
                    <option value="soglia" data-i18n="enhance_threshold">Soglia</option>
                    <option value="dstretch" data-i18n="enhance_dstretch">Pseudo-colore (DStretch)</option>
                </select>
            </label>
            <label class="iv-filtro hidden-tab" data-iv="riga-soglia">
                <span data-i18n="label_threshold">Soglia</span>
                <input type="range" data-iv="soglia" min="0" max="255" step="1" value="128">
            </label>
            <button type="button" data-iv="reset-filtri" class="iv-filtri-reset" data-i18n="btn_reset_filters">Reimposta</button>
        </div>
    `;

    // P4 — un solo worker per tutti i visualizzatori, creato al primo uso. Lato massimo della
    // copia elaborata: oltre, la memoria del worker cresce più del dettaglio che si guadagna.
    // ponytail: niente elaborazione "a piena risoluzione su richiesta"; alzare LATO_MAX se serve.
    const LATO_MAX = 3000;
    let _worker = null;
    let _richiesta = 0;
    const _inAttesa = new Map();

    /** Copia elaborata di `sorgente` come Blob JPEG. */
    window.elaboraImmagine = async function (sorgente, modo, soglia) {
        // crossOrigin: local-asset e iiif-img rispondono con Access-Control-Allow-Origin per
        // l'app, e solo così la bitmap non è "tainted" e il worker può leggerne i pixel.
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.src = sorgente;
        await im.decode();
        const k = Math.min(1, LATO_MAX / Math.max(im.naturalWidth, im.naturalHeight));
        // Riduzione su un canvas e non con createImageBitmap(img): in Electron quella fallisce
        // ("could not be allocated") anche su immagini leggibili.
        const tela = new OffscreenCanvas(Math.max(1, Math.round(im.naturalWidth * k)), Math.max(1, Math.round(im.naturalHeight * k)));
        const ctx = tela.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(im, 0, 0, tela.width, tela.height);
        const bitmap = tela.transferToImageBitmap();
        if (!_worker) {
            _worker = new Worker('js/workers/elaboraImmagine.js');
            _worker.onmessage = (e) => {
                const r = _inAttesa.get(e.data.id);
                if (!r) return;
                _inAttesa.delete(e.data.id);
                if (e.data.errore) r.reject(new Error(e.data.errore)); else r.resolve(e.data.blob);
            };
            _worker.onerror = (e) => {
                for (const r of _inAttesa.values()) r.reject(new Error(e.message || 'Worker non disponibile'));
                _inAttesa.clear();
            };
        }
        const id = ++_richiesta;
        return new Promise((resolve, reject) => {
            _inAttesa.set(id, { resolve, reject });
            _worker.postMessage({ id, bitmap, modo, soglia }, [bitmap]);
        });
    };

    /**
     * Attiva il visualizzatore su un viewport. Idempotente: due chiamate sullo stesso
     * elemento restituiscono lo stesso controller (gli host la invocano a ogni cambio di
     * allegato senza doversi ricordare se l'avevano già fatto).
     */
    window.attivaVisualizzatoreImmagini = function (viewport, img) {
        if (!viewport || !img) return null;
        if (viewport._imageViewer) return viewport._imageViewer;

        viewport.classList.add('iv-viewport');
        if (!viewport.hasAttribute('tabindex')) viewport.setAttribute('tabindex', '0');
        img.classList.add('iv-img');

        viewport.insertAdjacentHTML('beforeend', window.sanitizeHTML(BARRA_HTML));
        const q = (nome) => viewport.querySelector(`[data-iv="${nome}"]`);
        const barra = viewport.querySelector('.iv-barra');
        const pannelloFiltri = q('pannello-filtri');
        const etichettaPercento = q('percento');

        // luminosita/contrasto: valore del cursore, -100..100, 0 = neutro (vedi percentuale()).
        const stato = { scala: 1, tx: 0, ty: 0, rot: 0, luminosita: 0, contrasto: 0, inverti: false, elaborazione: '', soglia: 128 };

        // P4 — la copia elaborata prende il posto dell'immagine (stesso <img>: zoom, pan,
        // rotazione e filtri CSS restano com'erano). `srcOriginale` è ciò che l'host aveva
        // messo; un `load` di un src diverso da questi due è una carta nuova.
        let srcOriginale = null;
        let urlElaborato = null;
        let generazioneElab = 0;
        let timerSoglia = null;
        let ripristino = false;   // il prossimo load è il ritorno all'originale, non una carta nuova

        function tornaAllOriginale() {
            if (!urlElaborato) return;
            const u = urlElaborato;
            urlElaborato = null;
            ripristino = true;
            img.src = srcOriginale;
            srcOriginale = null;
            URL.revokeObjectURL(u);
        }

        function dimenticaElaborazione() {
            generazioneElab++;
            if (urlElaborato) URL.revokeObjectURL(urlElaborato);
            urlElaborato = null;
            srcOriginale = null;
            viewport.removeAttribute('aria-busy');
        }

        async function elabora() {
            const gen = ++generazioneElab;
            if (!stato.elaborazione) {
                tornaAllOriginale();
                viewport.removeAttribute('aria-busy');
                return;
            }
            if (!srcOriginale) srcOriginale = img.src;
            viewport.setAttribute('aria-busy', 'true');
            try {
                const blob = await window.elaboraImmagine(srcOriginale, stato.elaborazione, stato.soglia);
                if (gen !== generazioneElab) return;
                const vecchio = urlElaborato;
                urlElaborato = URL.createObjectURL(blob);
                img.src = urlElaborato;
                if (vecchio) URL.revokeObjectURL(vecchio);
            } catch (err) {
                if (gen !== generazioneElab) return;
                console.error('[Visualizzatore] Elaborazione non riuscita:', err);
                if (typeof mostraMessaggio === 'function') mostraMessaggio(window.t('enhance_failed', 'Elaborazione dell\'immagine non riuscita.'), 'error');
                stato.elaborazione = '';
                const sel = q('elaborazione');
                if (sel) sel.value = '';
                q('riga-soglia')?.classList.add('hidden-tab');
            } finally {
                if (gen === generazioneElab) viewport.removeAttribute('aria-busy');
            }
        }

        function dimensioni() {
            return {
                vw: viewport.clientWidth,
                vh: viewport.clientHeight,
                cw: img.clientWidth,
                ch: img.clientHeight,
                nw: img.naturalWidth,
                rot: stato.rot
            };
        }

        // Il pan è libero a qualunque scala, ma una parte dell'immagine resta sempre nel
        // viewport: portarla del tutto fuori (e non ritrovarla più) è il modo classico di
        // rompere uno zoom. Il limite precedente — il solo debordo reale — era troppo stretto:
        // una carta adattata alla pagina e ingrandita di uno o due scatti si spostava di
        // poche decine di pixel, e il trascinamento sembrava non funzionare.
        function limitaTraslazione() {
            const d = dimensioni();
            const ruotato = Math.abs((stato.rot % 180 + 180) % 180 - 90) < 1;
            const larghezza = (ruotato ? d.ch : d.cw) * stato.scala;
            const altezza = (ruotato ? d.cw : d.ch) * stato.scala;
            const maxX = Math.max(0, (larghezza + d.vw) / 2 - Math.min(larghezza, d.vw) * QUOTA_VISIBILE);
            const maxY = Math.max(0, (altezza + d.vh) / 2 - Math.min(altezza, d.vh) * QUOTA_VISIBILE);
            stato.tx = limita(stato.tx, -maxX, maxX);
            stato.ty = limita(stato.ty, -maxY, maxY);
        }

        function applica() {
            limitaTraslazione();
            img.style.transformOrigin = 'center center';
            img.style.transform = `translate(${stato.tx}px, ${stato.ty}px) rotate(${stato.rot}deg) scale(${stato.scala})`;
            img.style.filter = `brightness(${percentuale(stato.luminosita, 100)}%) contrast(${percentuale(stato.contrasto, 150)}%) invert(${stato.inverti ? 1 : 0})`;
            viewport.classList.add('iv-trascinabile');

            const d = dimensioni();
            const percento = d.nw && d.cw ? Math.round(stato.scala * (d.cw / d.nw) * 100) : Math.round(stato.scala * 100);
            if (etichettaPercento) etichettaPercento.textContent = percento + '%';
            // P5 — chi affianca due visualizzatori sincronizza la vista da qui.
            const ctrl = viewport._imageViewer;
            if (ctrl && typeof ctrl.onVista === 'function') ctrl.onVista();
        }

        /**
         * Zoom ancorato a un punto del viewport: il pixel sotto il puntatore resta fermo.
         * Vale anche con l'immagine ruotata — la rotazione agisce dopo la traslazione, quindi
         * non entra in questo conto (t' = c(1-k) + k·t).
         */
        function zoomVerso(fattore, clientX?, clientY?) {
            const nuova = limita(stato.scala * fattore, SCALA_MIN, SCALA_MAX);
            const k = nuova / stato.scala;
            if (k === 1) return;
            const rect = viewport.getBoundingClientRect();
            const cx = (clientX == null ? rect.width / 2 : clientX - rect.left) - rect.width / 2;
            const cy = (clientY == null ? rect.height / 2 : clientY - rect.top) - rect.height / 2;
            stato.tx = cx * (1 - k) + k * stato.tx;
            stato.ty = cy * (1 - k) + k * stato.ty;
            stato.scala = nuova;
            applica();
        }

        function adatta(modo) {
            stato.scala = limita(window.calcolaScalaFit(modo, dimensioni()), SCALA_MIN, SCALA_MAX);
            stato.tx = 0;
            // "Adatta alla larghezza" su una carta alta serve proprio a leggerla dall'alto:
            // riportare la vista in cima è ciò che ci si aspetta, non centrarla.
            // Il bordo superiore sul bordo del viewport: il debordo, non il limite del pan, che
            // ora lascerebbe la carta a metà schermo.
            stato.ty = 0;
            if (modo === 'larghezza') {
                const d = dimensioni();
                const ruotato = Math.abs((stato.rot % 180 + 180) % 180 - 90) < 1;
                stato.ty = Math.max(0, ((ruotato ? d.cw : d.ch) * stato.scala - d.vh) / 2);
            }
            applica();
        }

        function ruota(gradi) {
            stato.rot = (stato.rot + gradi + 360) % 360;
            stato.tx = 0;
            stato.ty = 0;
            applica();
        }

        /** Cursore -100..100 → percentuale CSS: sotto lo zero fino a 50%, sopra fino a 100+`su`%. */
        function percentuale(v, su) {
            return v < 0 ? 100 + v / 2 : 100 + v * su / 100;
        }

        /** Solo i filtri, la vista resta dov'è: è il "Reimposta" dentro il pannello. */
        function reimpostaFiltri() {
            stato.luminosita = 0;
            stato.contrasto = 0;
            stato.inverti = false;
            for (const nome of ['luminosita', 'contrasto']) {
                const el = q(nome);
                if (el) el.value = '0';
                const val = q('val-' + nome);
                if (val) val.textContent = '0';
            }
            const inv = q('inverti');
            if (inv) inv.checked = false;
            generazioneElab++;
            stato.elaborazione = '';
            const sel = q('elaborazione');
            if (sel) sel.value = '';
            q('riga-soglia')?.classList.add('hidden-tab');
            tornaAllOriginale();
            viewport.removeAttribute('aria-busy');
        }

        function reimposta() {
            stato.scala = 1;
            stato.tx = 0;
            stato.ty = 0;
            stato.rot = 0;
            reimpostaFiltri();
            if (pannelloFiltri) pannelloFiltri.classList.add('hidden-tab');
            const btnFiltri = q('filtri');
            if (btnFiltri) btnFiltri.setAttribute('aria-expanded', 'false');
            applica();
        }

        // --- Comandi della barra --------------------------------------------------
        const azioni = {
            'zoom-in': () => zoomVerso(PASSO_ZOOM),
            'zoom-out': () => zoomVerso(1 / PASSO_ZOOM),
            'rot-ccw': () => ruota(-90),
            'rot-cw': () => ruota(90),
            'fit': () => adatta('pagina'),
            'fit-width': () => adatta('larghezza'),
            'reale': () => adatta('reale'),
            'reset': reimposta,
            'filtri': () => {
                if (!pannelloFiltri) return;
                // toggle() ritorna true quando la classe è stata AGGIUNTA, cioè quando il
                // pannello è appena stato chiuso.
                const chiuso = pannelloFiltri.classList.toggle('hidden-tab');
                const btn = q('filtri');
                if (btn) btn.setAttribute('aria-expanded', chiuso ? 'false' : 'true');
            }
        };

        if (barra) {
            barra.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-iv]');
                if (!btn || !azioni[btn.getAttribute('data-iv')]) return;
                // La barra vive dentro il viewport: senza stop, il click risalirebbe al
                // backdrop del modal e lo chiuderebbe a ogni zoom.
                e.stopPropagation();
                azioni[btn.getAttribute('data-iv')]();
            });
        }

        if (pannelloFiltri) {
            pannelloFiltri.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target.closest('[data-iv="reset-filtri"]')) { reimpostaFiltri(); applica(); }
            });
            pannelloFiltri.addEventListener('input', (e) => {
                const nome = e.target.getAttribute('data-iv');
                if (nome === 'luminosita' || nome === 'contrasto') {
                    stato[nome] = Number(e.target.value);
                    const val = q('val-' + nome);
                    if (val) val.textContent = e.target.value;
                }
                else if (nome === 'inverti') stato.inverti = !!e.target.checked;
                else if (nome === 'elaborazione') {
                    stato.elaborazione = e.target.value;
                    q('riga-soglia')?.classList.toggle('hidden-tab', stato.elaborazione !== 'soglia');
                    elabora();
                    return;
                } else if (nome === 'soglia') {
                    // Il cursore manda decine di eventi al secondo: si elabora quando si ferma.
                    stato.soglia = Number(e.target.value);
                    clearTimeout(timerSoglia);
                    timerSoglia = setTimeout(elabora, 200);
                    return;
                }
                else return;
                applica();
            });
        }

        // --- Rotella: zoom ---------------------------------------------------------
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            zoomVerso(e.deltaY < 0 ? PASSO_ZOOM : 1 / PASSO_ZOOM, e.clientX, e.clientY);
        }, { passive: false });

        // --- Trascinamento ---------------------------------------------------------
        let trascino = null;
        viewport.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 || e.target.closest('.iv-barra, .iv-pannello-filtri')) return;
            trascino = { x: e.clientX, y: e.clientY, tx: stato.tx, ty: stato.ty };
            viewport.classList.add('iv-in-trascinamento');
            viewport.setPointerCapture(e.pointerId);
        });
        viewport.addEventListener('pointermove', (e) => {
            if (!trascino) return;
            stato.tx = trascino.tx + (e.clientX - trascino.x);
            stato.ty = trascino.ty + (e.clientY - trascino.y);
            applica();
        });
        const fineTrascinamento = (e) => {
            if (!trascino) return;
            trascino = null;
            viewport.classList.remove('iv-in-trascinamento');
            try { viewport.releasePointerCapture(e.pointerId); } catch { /* già rilasciato */ }
        };
        viewport.addEventListener('pointerup', fineTrascinamento);
        viewport.addEventListener('pointercancel', fineTrascinamento);

        // Doppio click: alterna vista adattata e 2× sul punto guardato.
        viewport.addEventListener('dblclick', (e) => {
            if (e.target.closest('.iv-barra, .iv-pannello-filtri')) return;
            if (stato.scala > 1.001) adatta('pagina');
            else zoomVerso(2, e.clientX, e.clientY);
        });

        // --- Tastiera --------------------------------------------------------------
        // Solo sul viewport (che è focusabile), MAI sul document: l'editor di trascrizione
        // è un contenteditable a fianco, e un handler globale gli mangerebbe i tasti.
        viewport.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            const passo = 40;
            const tasti = {
                '+': () => zoomVerso(PASSO_ZOOM), '=': () => zoomVerso(PASSO_ZOOM),
                '-': () => zoomVerso(1 / PASSO_ZOOM), '_': () => zoomVerso(1 / PASSO_ZOOM),
                '0': () => adatta('pagina'), '1': () => adatta('reale'),
                'r': () => ruota(90), 'R': () => ruota(-90),
                'ArrowLeft': () => { stato.tx += passo; applica(); },
                'ArrowRight': () => { stato.tx -= passo; applica(); },
                'ArrowUp': () => { stato.ty += passo; applica(); },
                'ArrowDown': () => { stato.ty -= passo; applica(); }
            };
            if (!tasti[e.key]) return;
            e.preventDefault();
            tasti[e.key]();
        });

        // Ogni nuova immagine riparte pulita: filtri e rotazione della carta precedente
        // applicati a quella dopo sarebbero incomprensibili.
        // P4: i load provocati dall'elaborazione (copia elaborata, ritorno all'originale) no.
        img.addEventListener('load', () => {
            if (urlElaborato && img.src === urlElaborato) return;
            if (ripristino) { ripristino = false; return; }
            dimenticaElaborazione();
            reimposta();
        });
        img.addEventListener('error', () => { ripristino = false; });

        // Il pannello della trascrizione è ridimensionabile: al restringersi del viewport
        // la traslazione va ri-limitata, o l'immagine resta ferma fuori campo.
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => applica()).observe(viewport);
        }

        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [viewport] });
        applica();

        const controller = { stato, reimposta, adatta, ruota, zoomVerso, applica };
        viewport._imageViewer = controller;
        return controller;
    };
})();
