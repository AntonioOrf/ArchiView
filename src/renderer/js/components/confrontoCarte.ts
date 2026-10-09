// P5 — due carte affiancate, per confrontare le mani e ricostruire i fascicoli.
//
// Due colonne uguali: ciascuna sceglie la sua carta cercando in TUTTO l'archivio e ha il suo
// visualizzatore (imageViewer.ts), quindi zoom, rotazione e filtri di P4 sono indipendenti.
// "Sincronizza" copia scala, spostamento e rotazione da un lato all'altro.
// Un PDF ha un pdfViewer.ts per lato, separato da quello della trascrizione: la pagina resa
// finisce nello stesso <img>, quindi zoom e filtri valgono uguali.
(function() {
    const LATI = ['sx', 'dx'];
    const MAX_RISULTATI = 40;
    let _ccSincronizza = false;
    let _ccInSync = false;
    // Per lato: il visualizzatore PDF (creato al primo PDF), la pagina mostrata e un contatore
    // che scarta le rese superate da una scelta successiva.
    const _ccPdf = { sx: null, dx: null };
    const _ccPagina = { sx: 0, dx: 0 };
    const _ccGen = { sx: 0, dx: 0 };

    function _ccEl(id) { return document.getElementById(id); }

    /** Indici delle carte della scheda, immagini e PDF. */
    function _ccCarte(m) {
        return normalizzaAllegati(m).map((a, i) => (a ? i : -1)).filter(i => i >= 0);
    }

    /**
     * Schede con almeno una carta che contengono tutte le parole della ricerca, in
     * segnatura o nei campi: il nome di un file non lo ricorda nessuno, la scheda sì.
     */
    function _ccCerca(testo) {
        const parole = window.tokenizzaRicerca(testo);
        const servizio = new Set(window.Model.CHIAVI_SERVIZIO);
        const out = [];
        for (const m of appData.manoscritti) {
            const carte = _ccCarte(m);
            if (!carte.length) continue;
            if (parole.length) {
                let testoScheda = m.segnatura || '';
                for (const k in m) if (!servizio.has(k)) testoScheda += ' ' + window.testoIndicizzabile(m[k]);
                const norm = window.normalizzaTesto(testoScheda);
                if (!parole.every(p => norm.includes(p))) continue;
            }
            out.push({ m, carte });
            if (out.length >= MAX_RISULTATI) break;
        }
        return out;
    }

    function _ccVoce(lista, testo, onClick) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'confronto-voce';
        b.textContent = testo;   // segnature e nomi sono dati dell'archivio
        b.addEventListener('click', onClick);
        li.appendChild(b);
        lista.appendChild(li);
        return b;
    }

    function _ccApriLista(lato) {
        _ccEl(`confronto-risultati-${lato}`).classList.remove('hidden-tab');
        _ccEl(`confronto-cerca-${lato}`).setAttribute('aria-expanded', 'true');
    }

    function _ccMostraRisultati(lato) {
        const lista = _ccEl(`confronto-risultati-${lato}`);
        const campo = _ccEl(`confronto-cerca-${lato}`) as HTMLInputElement;
        lista.replaceChildren();
        const trovate = _ccCerca(campo.value);
        if (!trovate.length) {
            const li = document.createElement('li');
            li.className = 'confronto-vuoto';
            li.textContent = window.t('cmp_no_results', 'Nessuna scheda con carte trovata.');
            lista.appendChild(li);
        }
        for (const { m, carte } of trovate) {
            const n = window.t('cmp_n_sheets', '{n} carte').replace('{n}', String(carte.length));
            // Una sola carta: inutile un secondo passaggio.
            _ccVoce(lista, `${m.segnatura || m.id} · ${n}`, () =>
                carte.length === 1 ? _ccScegli(lato, m.id, carte[0]) : _ccMostraCarte(lato, m, carte));
        }
        _ccApriLista(lato);
    }

    /** Secondo livello: le carte della scheda scelta, con il ritorno alle schede. */
    function _ccMostraCarte(lato, m, carte) {
        const lista = _ccEl(`confronto-risultati-${lato}`);
        lista.replaceChildren();
        _ccVoce(lista, `← ${window.t('auth_link_back', 'Indietro')}`, () => {
            _ccMostraRisultati(lato);
            lista.querySelector<HTMLElement>('button')?.focus();
        });
        let prima = null;
        for (const i of carte) {
            const a = m.allegati[i];
            const pdf = a.tipo === 'pdf' ? ' (PDF)' : '';
            const b = _ccVoce(lista, `c. ${i + 1} · ${a.originalName || a.nome}${pdf}`, () => _ccScegli(lato, m.id, i));
            prima = prima || b;
        }
        _ccApriLista(lato);
        // Il bottone cliccato è sparito: il fuoco va sulla prima carta, non si perde nel vuoto.
        prima?.focus();
    }

    function _ccChiudiRisultati(lato) {
        _ccEl(`confronto-risultati-${lato}`).classList.add('hidden-tab');
        _ccEl(`confronto-cerca-${lato}`).setAttribute('aria-expanded', 'false');
    }

    /** Sceglie la carta `indice` della scheda `id`; su un PDF apre la pagina `pagina` (1 se assente). */
    async function _ccScegli(lato, id, indice, pagina = 1) {
        const m = appData.manoscritti.find(x => String(x.id) === String(id));
        const a = m && Array.isArray(m.allegati) ? m.allegati[indice] : null;
        if (!a) return;
        const gen = ++_ccGen[lato];
        const img = _ccEl(`confronto-img-${lato}`) as HTMLImageElement;
        const nome = `${m.segnatura || ''} · ${a.originalName || a.nome || indice + 1}`;
        (_ccEl(`confronto-cerca-${lato}`) as HTMLInputElement).value = '';
        _ccChiudiRisultati(lato);
        _ccEl(`confronto-etichetta-${lato}`).textContent = nome;
        _ccEl(`confronto-vuoto-${lato}`).classList.add('hidden-tab');
        _ccEl(`confronto-viewport-${lato}`).classList.remove('hidden-tab');
        _ccEl(`confronto-pagine-${lato}`).classList.toggle('hidden-tab', a.tipo !== 'pdf');
        _ccPagina[lato] = 0;

        if (a.tipo !== 'pdf') {
            img.alt = nome;
            img.src = window.srcAllegato(a);
            // Il PDF di prima non serve più: via documento e pagine rese.
            if (_ccPdf[lato]) _ccPdf[lato].chiudi();
            return;
        }
        if (!_ccPdf[lato]) _ccPdf[lato] = window.creaPdfViewer();
        const r = await _ccPdf[lato].apri(a.nome);
        if (gen !== _ccGen[lato]) return;
        if (!r.ok) {
            img.removeAttribute('src');
            _ccEl(`confronto-etichetta-${lato}`).textContent = `${nome} — ${window.t('cmp_pdf_error', 'PDF non leggibile')}`;
            _ccEl(`confronto-pagine-${lato}`).classList.add('hidden-tab');
            return;
        }
        img.dataset.nome = nome;
        await _ccMostraPagina(lato, pagina);
    }

    async function _ccMostraPagina(lato, n) {
        const pdf = _ccPdf[lato];
        const totale = pdf ? pdf.numeroPagine() : 0;
        if (!totale) return;
        n = Math.min(Math.max(1, Number(n) || 1), totale);
        _ccPagina[lato] = n;
        (_ccEl(`confronto-pagina-${lato}`) as HTMLInputElement).value = String(n);
        _ccEl(`confronto-totale-${lato}`).textContent = `/ ${totale}`;
        (_ccEl(`confronto-prec-${lato}`) as HTMLButtonElement).disabled = n <= 1;
        (_ccEl(`confronto-succ-${lato}`) as HTMLButtonElement).disabled = n >= totale;
        const img = _ccEl(`confronto-img-${lato}`) as HTMLImageElement;
        img.alt = `${img.dataset.nome || 'PDF'}, ` +
            window.t('trasc_page_of', 'p. {var0} di {var1}').replace('{var0}', String(n)).replace('{var1}', String(totale));
        try {
            await pdf.mostraPagina(n, img, _ccEl(`confronto-viewport-${lato}`));
        } catch (e) {
            console.error('[Confronto] Resa della pagina fallita:', e);
            _ccEl(`confronto-etichetta-${lato}`).textContent = `${img.dataset.nome || ''} — ${window.t('cmp_pdf_error', 'PDF non leggibile')}`;
        }
    }

    /** Copia la vista di `da` sull'altro lato. Il flag evita il rimbalzo fra i due applica(). */
    function _ccAllinea(da) {
        if (!_ccSincronizza || _ccInSync) return;
        const sorgente = (_ccEl(`confronto-viewport-${da}`) as any)._imageViewer;
        const dest = (_ccEl(`confronto-viewport-${da === 'sx' ? 'dx' : 'sx'}`) as any)._imageViewer;
        if (!sorgente || !dest) return;
        _ccInSync = true;
        try {
            const { scala, tx, ty, rot } = sorgente.stato;
            Object.assign(dest.stato, { scala, tx, ty, rot });
            dest.applica();
        } finally {
            _ccInSync = false;
        }
    }

    window.apriConfrontoCarte = function() {
        const modal = _ccEl('confronto-modal');
        if (!modal) return;
        for (const lato of LATI) {
            const vp = _ccEl(`confronto-viewport-${lato}`);
            const ctrl = window.attivaVisualizzatoreImmagini(vp, _ccEl(`confronto-img-${lato}`));
            if (ctrl) ctrl.onVista = () => _ccAllinea(lato);
        }
        modal.classList.remove('hidden-tab');
        // A sinistra la carta che si sta trascrivendo; di un PDF, la pagina aperta
        // (`_taPaginaCorrente`, attachmentsLogic.ts: 0 sulle immagini).
        const id = (_ccEl('trascrizione-id') as HTMLInputElement)?.value;
        const vistaAperta = !_ccEl('view-trascrizione')?.classList.contains('hidden-tab');
        if (id && vistaAperta) _ccScegli('sx', id, window.currentAllegatoIndex || 0, _taPaginaCorrente || 1);
        (_ccEl('confronto-cerca-dx') as HTMLInputElement).focus();
    };

    window.chiudiConfrontoCarte = function() {
        const modal = _ccEl('confronto-modal');
        if (modal) modal.classList.add('hidden-tab');
        for (const lato of LATI) {
            _ccGen[lato]++;
            const img = _ccEl(`confronto-img-${lato}`) as HTMLImageElement;
            if (img) img.removeAttribute('src');
            if (_ccPdf[lato]) _ccPdf[lato].chiudi();
            _ccEl(`confronto-pagine-${lato}`)?.classList.add('hidden-tab');
            _ccEl(`confronto-viewport-${lato}`)?.classList.add('hidden-tab');
            _ccEl(`confronto-vuoto-${lato}`)?.classList.remove('hidden-tab');
            const etichetta = _ccEl(`confronto-etichetta-${lato}`);
            if (etichetta) etichetta.textContent = '';
        }
    };

    window.sincronizzaConfronto = function(attiva) {
        _ccSincronizza = !!attiva;
        // All'accensione la destra prende la vista della sinistra: è da lì che si parte.
        if (_ccSincronizza) _ccAllinea('sx');
    };

    function colonna(lato) {
        return `
            <section class="confronto-colonna" aria-labelledby="confronto-titolo-${window.escapeHTML(lato)}">
                <h4 id="confronto-titolo-${window.escapeHTML(lato)}" class="sr-only" data-i18n="cmp_${window.escapeHTML(lato)}">${lato === 'sx' ? 'Carta a sinistra' : 'Carta a destra'}</h4>
                <div class="confronto-ricerca">
                    <input id="confronto-cerca-${window.escapeHTML(lato)}" type="search" autocomplete="off" class="form-input py-1 text-sm w-full" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="confronto-risultati-${window.escapeHTML(lato)}" data-i18n-placeholder="cmp_search" data-i18n-aria-label="cmp_search" placeholder="Cerca una scheda (segnatura, campi)">
                    <ul id="confronto-risultati-${window.escapeHTML(lato)}" class="confronto-risultati hidden-tab" role="list"></ul>
                </div>
                <div class="confronto-testa">
                    <p id="confronto-etichetta-${window.escapeHTML(lato)}" class="confronto-etichetta" translate="no" aria-live="polite"></p>
                    <div id="confronto-pagine-${window.escapeHTML(lato)}" class="confronto-pagine hidden-tab">
                        <button type="button" id="confronto-prec-${window.escapeHTML(lato)}" data-cc-passo="-1" class="btn btn-ghost btn-icon" data-i18n-title="pdf_prev_page" data-i18n-aria-label="pdf_prev_page" title="Pagina precedente"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
                        <input type="number" id="confronto-pagina-${window.escapeHTML(lato)}" min="1" inputmode="numeric" class="form-input py-0.5 text-xs text-center tabular-nums" data-i18n-aria-label="pdf_page_number" aria-label="Numero di pagina">
                        <span id="confronto-totale-${window.escapeHTML(lato)}" class="tabular-nums"></span>
                        <button type="button" id="confronto-succ-${window.escapeHTML(lato)}" data-cc-passo="1" class="btn btn-ghost btn-icon" data-i18n-title="pdf_next_page" data-i18n-aria-label="pdf_next_page" title="Pagina successiva"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                    </div>
                </div>
                <p id="confronto-vuoto-${window.escapeHTML(lato)}" class="confronto-vuoto" data-i18n="cmp_empty">Scegli una scheda dalla ricerca qui sopra, poi la carta.</p>
                <div id="confronto-viewport-${window.escapeHTML(lato)}" class="iv-viewport confronto-viewport hidden-tab" tabindex="0">
                    <img id="confronto-img-${window.escapeHTML(lato)}" alt="" class="max-w-full max-h-full object-contain">
                </div>
            </section>`;
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (_ccEl('confronto-modal')) return;
        const html = `
    <div id="confronto-modal" class="modal-overlay hidden-tab">
        <div class="modal-window confronto-finestra">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i data-lucide="columns-2" class="w-5 h-5 text-amber-700"></i>
                    <span data-i18n="cmp_title">Confronta carte</span>
                </h3>
                <label class="ml-auto flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" id="confronto-sincronizza" data-on-change="sincronizzaConfronto" data-args-change="[{&quot;$&quot;:&quot;checked&quot;}]">
                    <span data-i18n="cmp_sync">Sincronizza zoom e spostamento</span>
                </label>
                <button type="button" data-on-click="chiudiConfrontoCarte" data-modal-cancel class="btn btn-ghost btn-icon" data-i18n-title="btn_close" data-i18n-aria-label="btn_close" title="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="modal-body confronto-corpo">
                ${colonna('sx')}
                ${colonna('dx')}
            </div>
        </div>
    </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        for (const lato of LATI) {
            const campo = _ccEl(`confronto-cerca-${lato}`);
            // L'elenco si apre scrivendo o con freccia giù, non al fuoco: aperto da solo, il primo
            // Esc dopo l'apertura del modale chiuderebbe l'elenco invece del modale.
            campo.addEventListener('input', () => _ccMostraRisultati(lato));
            campo.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (_ccEl(`confronto-risultati-${lato}`).classList.contains('hidden-tab')) _ccMostraRisultati(lato);
                    _ccEl(`confronto-risultati-${lato}`).querySelector<HTMLElement>('button')?.focus();
                } else if (e.key === 'Escape' && !_ccEl(`confronto-risultati-${lato}`).classList.contains('hidden-tab')) {
                    // Il primo Esc chiude l'elenco, non il modale.
                    e.stopPropagation();
                    _ccChiudiRisultati(lato);
                }
            });
            const lista = _ccEl(`confronto-risultati-${lato}`);
            lista.addEventListener('keydown', (e) => {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                e.preventDefault();
                const voci = Array.from(lista.querySelectorAll<HTMLElement>('button'));
                const i = voci.indexOf(document.activeElement as HTMLElement);
                if (e.key === 'ArrowUp' && i <= 0) campo.focus();
                else voci[Math.min(voci.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))]?.focus();
            });
            const pagine = _ccEl(`confronto-pagine-${lato}`);
            pagine.addEventListener('click', (e) => {
                const passo = Number((e.target as HTMLElement).closest('[data-cc-passo]')?.getAttribute('data-cc-passo'));
                if (passo) _ccMostraPagina(lato, _ccPagina[lato] + passo);
            });
            _ccEl(`confronto-pagina-${lato}`).addEventListener('change', (e) =>
                _ccMostraPagina(lato, (e.target as HTMLInputElement).value));
            // Col mouse l'elenco si apre anche a campo vuoto: tutte le schede, si sceglie scorrendo.
            campo.addEventListener('click', () => _ccMostraRisultati(lato));
            // Il fuoco esce dalla ricerca (clic altrove, Tab): l'elenco si chiude. A fine giro,
            // perché passando da schede a carte il bottone col fuoco viene rimpiazzato.
            const ricerca = campo.closest('.confronto-ricerca');
            ricerca.addEventListener('focusout', () => setTimeout(() => {
                if (!ricerca.contains(document.activeElement)) _ccChiudiRisultati(lato);
            }));
        }
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [_ccEl('confronto-modal')] });
    });
})();
