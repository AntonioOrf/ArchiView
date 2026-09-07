// @ts-nocheck

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
                <input type="range" data-iv="luminosita" min="50" max="200" step="5" value="100">
            </label>
            <label class="iv-filtro">
                <span data-i18n="label_contrast">Contrasto</span>
                <input type="range" data-iv="contrasto" min="50" max="250" step="5" value="100">
            </label>
            <label class="iv-filtro iv-filtro-check">
                <input type="checkbox" data-iv="inverti">
                <span data-i18n="label_invert">Inverti (negativo)</span>
            </label>
        </div>
    `;

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

        const stato = { scala: 1, tx: 0, ty: 0, rot: 0, luminosita: 100, contrasto: 100, inverti: false };

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

        // Il pan è consentito solo entro il debordo reale dell'immagine: portarla del tutto
        // fuori dal viewport (e non ritrovarla più) è il modo classico di rompere uno zoom.
        function limitaTraslazione() {
            const d = dimensioni();
            const ruotato = Math.abs((stato.rot % 180 + 180) % 180 - 90) < 1;
            const larghezza = (ruotato ? d.ch : d.cw) * stato.scala;
            const altezza = (ruotato ? d.cw : d.ch) * stato.scala;
            const maxX = Math.max(0, (larghezza - d.vw) / 2);
            const maxY = Math.max(0, (altezza - d.vh) / 2);
            stato.tx = limita(stato.tx, -maxX, maxX);
            stato.ty = limita(stato.ty, -maxY, maxY);
        }

        function applica() {
            limitaTraslazione();
            img.style.transformOrigin = 'center center';
            img.style.transform = `translate(${stato.tx}px, ${stato.ty}px) rotate(${stato.rot}deg) scale(${stato.scala})`;
            img.style.filter = `brightness(${stato.luminosita}%) contrast(${stato.contrasto}%) invert(${stato.inverti ? 1 : 0})`;
            viewport.classList.toggle('iv-trascinabile', stato.scala > 1.001);

            const d = dimensioni();
            const percento = d.nw && d.cw ? Math.round(stato.scala * (d.cw / d.nw) * 100) : Math.round(stato.scala * 100);
            if (etichettaPercento) etichettaPercento.textContent = percento + '%';
        }

        /**
         * Zoom ancorato a un punto del viewport: il pixel sotto il puntatore resta fermo.
         * Vale anche con l'immagine ruotata — la rotazione agisce dopo la traslazione, quindi
         * non entra in questo conto (t' = c(1-k) + k·t).
         */
        function zoomVerso(fattore, clientX, clientY) {
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
            stato.ty = modo === 'larghezza' ? Number.MAX_SAFE_INTEGER : 0;
            applica();
        }

        function ruota(gradi) {
            stato.rot = (stato.rot + gradi + 360) % 360;
            stato.tx = 0;
            stato.ty = 0;
            applica();
        }

        function reimposta() {
            stato.scala = 1;
            stato.tx = 0;
            stato.ty = 0;
            stato.rot = 0;
            stato.luminosita = 100;
            stato.contrasto = 100;
            stato.inverti = false;
            const sl = q('luminosita'), sc = q('contrasto'), inv = q('inverti');
            if (sl) sl.value = '100';
            if (sc) sc.value = '100';
            if (inv) inv.checked = false;
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
            pannelloFiltri.addEventListener('click', (e) => e.stopPropagation());
            pannelloFiltri.addEventListener('input', (e) => {
                const nome = e.target.getAttribute('data-iv');
                if (nome === 'luminosita') stato.luminosita = Number(e.target.value);
                else if (nome === 'contrasto') stato.contrasto = Number(e.target.value);
                else if (nome === 'inverti') stato.inverti = !!e.target.checked;
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
        img.addEventListener('load', reimposta);

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
