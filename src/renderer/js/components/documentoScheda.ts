// PIANO-SCHEDA-AFFIANCATA, Fase 2 — il documento accanto al modulo della scheda.
//
// Il pannello sta a destra di #view-add, fisso sul bordo della finestra: il modulo resta dove
// è e scorre come sempre, gli fa solo posto. Mostra la carta (stesso imageViewer del confronto
// e della trascrizione, un pdfViewer suo per i PDF) oppure il suo testo trascritto in sola
// lettura: per scrivere c'è l'editor, a un clic.
(function() {
    const CHIAVE_APERTO = 'schedaDocumentoAperto';
    const CHIAVE_VISTA = 'schedaDocumentoVista';
    const CHIAVE_LARGHEZZA = 'schedaDocumentoLarghezza';
    const stato = { id: null, carta: 0, pagina: 1, vista: 'immagine', modulo: 50 };
    let _pdf = null;
    let _gen = 0;

    const el = (id) => document.getElementById(id);

    function scheda() {
        return stato.id ? appData.manoscritti.find(x => String(x.id) === String(stato.id)) : null;
    }

    /** Le carte senza toccare il record (normalizzaAllegati aggiungerebbe `allegati`). */
    function carte(m) {
        if (!m) return [];
        if (Array.isArray(m.allegati)) return m.allegati;
        return m.allegato ? [{ nome: m.allegato, tipo: m.allegatoTipo }] : [];
    }

    function aperto() {
        return !el('doc-scheda').classList.contains('hidden-tab');
    }

    /** Larghezze: il modulo prende `stato.modulo` % dell'area principale, il documento il resto. */
    function disponi() {
        const pannello = el('doc-scheda');
        const vAdd = el('view-add');
        if (!aperto()) {
            vAdd.style.marginRight = '';
            vAdd.classList.remove('con-documento');
            return;
        }
        const main = document.querySelector('main').getBoundingClientRect();
        const larghezza = Math.round(main.width * (100 - stato.modulo) / 100);
        pannello.style.top = `${Math.round(main.top)}px`;
        pannello.style.height = `${Math.round(main.height)}px`;
        pannello.style.width = `${larghezza}px`;
        vAdd.classList.add('con-documento');
        vAdd.style.marginRight = `${larghezza}px`;
        el('doc-scheda-sep').setAttribute('aria-valuenow', String(Math.round(stato.modulo)));
    }

    async function mostraPagina(n) {
        const totale = _pdf ? _pdf.numeroPagine() : 0;
        if (!totale) return;
        stato.pagina = Math.min(Math.max(1, Number(n) || 1), totale);
        (el('doc-scheda-pagina') as HTMLInputElement).value = String(stato.pagina);
        el('doc-scheda-pagine-totale').textContent = `/ ${totale}`;
        (el('doc-scheda-pagina-prec') as HTMLButtonElement).disabled = stato.pagina <= 1;
        (el('doc-scheda-pagina-succ') as HTMLButtonElement).disabled = stato.pagina >= totale;
        if (stato.vista === 'trascrizione') return mostraTesto();
        const img = el('doc-scheda-img') as HTMLImageElement;
        try {
            await _pdf.mostraPagina(stato.pagina, img, el('doc-scheda-viewport'));
        } catch (e) {
            console.error('[Documento] Resa della pagina fallita:', e);
            el('doc-scheda-nome').textContent = window.t('cmp_pdf_error', 'PDF non leggibile');
        }
    }

    function mostraTesto() {
        const m = scheda();
        const a = carte(m)[stato.carta];
        const pagina = a && a.tipo === 'pdf' ? stato.pagina : 0;
        const html = m ? window.leggiTrascrizioneAllegato(m, stato.carta, pagina) : '';
        const box = el('doc-scheda-testo-html');
        if (window.trascrizioneHaTesto(html)) {
            box.innerHTML = window.sanitizeHTML(html);
        } else {
            box.textContent = window.t('doc_no_transcription', 'Questa carta non è ancora trascritta.');
        }
    }

    async function mostraCarta(indice) {
        const m = scheda();
        const lista = carte(m);
        if (!lista.length) return;
        stato.carta = Math.min(Math.max(0, indice), lista.length - 1);
        const a = lista[stato.carta];
        const gen = ++_gen;
        const nome = a.originalName || a.nome || String(stato.carta + 1);
        el('doc-scheda-nome').textContent = nome;
        (el('doc-scheda-carta') as HTMLInputElement).value = String(stato.carta + 1);
        (el('doc-scheda-carta') as HTMLInputElement).max = String(lista.length);
        el('doc-scheda-totale').textContent = `/ ${lista.length}`;
        (el('doc-scheda-prec') as HTMLButtonElement).disabled = stato.carta === 0;
        (el('doc-scheda-succ') as HTMLButtonElement).disabled = stato.carta === lista.length - 1;
        el('doc-scheda-carte').classList.toggle('hidden-tab', lista.length < 2);
        el('doc-scheda-pagine').classList.toggle('hidden-tab', a.tipo !== 'pdf');

        const img = el('doc-scheda-img') as HTMLImageElement;
        img.alt = nome;
        if (a.tipo !== 'pdf') {
            if (_pdf) _pdf.chiudi();
            stato.pagina = 1;
            img.src = window.srcAllegato(a);
            if (stato.vista === 'trascrizione') mostraTesto();
            return;
        }
        if (!_pdf) _pdf = window.creaPdfViewer();
        const r = await _pdf.apri(a.nome);
        if (gen !== _gen) return;
        if (!r.ok) {
            img.removeAttribute('src');
            el('doc-scheda-nome').textContent = `${nome} — ${window.t('cmp_pdf_error', 'PDF non leggibile')}`;
            el('doc-scheda-pagine').classList.add('hidden-tab');
            return;
        }
        await mostraPagina(1);
    }

    function impostaVista(vista) {
        stato.vista = vista === 'trascrizione' ? 'trascrizione' : 'immagine';
        window.prefLocale(CHIAVE_VISTA, stato.vista);
        const testo = stato.vista === 'trascrizione';
        el('doc-scheda-viewport').classList.toggle('hidden-tab', testo);
        el('doc-scheda-testo').classList.toggle('hidden-tab', !testo);
        el('doc-vista-immagine').setAttribute('aria-pressed', String(!testo));
        el('doc-vista-testo').setAttribute('aria-pressed', String(testo));
        if (testo) mostraTesto();
        // Tornando all'immagine di un PDF la pagina va ridisegnata: l'<img> era nascosto.
        else if (_pdf && _pdf.numeroPagine()) mostraPagina(stato.pagina);
    }

    function chiudi(ricorda) {
        if (ricorda) window.prefLocale(CHIAVE_APERTO, '0');
        _gen++;
        el('doc-scheda').classList.add('hidden-tab');
        el('btn-documento-scheda')?.setAttribute('aria-pressed', 'false');
        (el('doc-scheda-img') as HTMLImageElement).removeAttribute('src');
        if (_pdf) _pdf.chiudi();
        disponi();
    }

    function apri() {
        const m = scheda();
        if (!carte(m).length) return;
        window.prefLocale(CHIAVE_APERTO, '1');
        el('doc-scheda').classList.remove('hidden-tab');
        el('btn-documento-scheda')?.setAttribute('aria-pressed', 'true');
        window.attivaVisualizzatoreImmagini(el('doc-scheda-viewport'), el('doc-scheda-img'));
        disponi();
        impostaVista(window.prefLocale(CHIAVE_VISTA) || 'immagine');
        mostraCarta(0);
    }

    window.alternaDocumentoScheda = function() {
        // Fase 4 — staccato in un'altra finestra: il pulsante la porta in primo piano.
        if (window.documentoStaccato && window.documentoStaccato()) window.apiFinestre.messaggio('mostra');
        else if (aperto()) chiudi(true);
        else apri();
    };

    /** Ciò che serve alla finestra staccata per mostrare lo stesso punto del documento. */
    window.statoDocumentoScheda = function() {
        return { id: stato.id, carta: stato.carta, pagina: stato.pagina, vista: stato.vista };
    };

    /** Il pannello si chiude perché il documento va in un'altra finestra: «aperto» resta ricordato. */
    window.chiudiDocumentoScheda = function() {
        if (aperto()) chiudi(false);
        el('btn-documento-scheda')?.setAttribute('aria-pressed', 'true');
    };

    /** Nella finestra staccata: il pannello a tutta finestra, sul punto lasciato nella principale. */
    window.mostraDocumentoStaccato = async function(dati) {
        stato.id = dati.id;
        el('doc-scheda').classList.remove('hidden-tab');
        window.attivaVisualizzatoreImmagini(el('doc-scheda-viewport'), el('doc-scheda-img'));
        impostaVista(dati.vista || 'immagine');
        await mostraCarta(dati.carta || 0);
        if (dati.pagina > 1) await mostraPagina(dati.pagina);
    };

    /**
     * Il modulo ha cambiato scheda (editItem, resetForm): il pulsante c'è solo su una scheda
     * salvata con carte, e il pannello si riapre da solo se lo si era lasciato aperto.
     */
    window.aggiornaDocumentoScheda = function() {
        if (!el('doc-scheda')) return;
        const id = (el('form-id') as HTMLInputElement)?.value || null;
        const inModulo = !window.moduloInTrascrizione || !window.moduloInTrascrizione();
        stato.id = inModulo ? id : null;
        const conCarte = carte(scheda()).length > 0;
        el('btn-documento-scheda')?.classList.toggle('hidden-tab', !conCarte);
        if (!conCarte) {
            if (aperto()) chiudi(false);
            return;
        }
        // Fase 4 — lasciato in una finestra a parte: ci torna, e segue la scheda aperta.
        if (window.prefLocale(CHIAVE_APERTO) === '1' && window.prefLocale('finestraStaccata:documento') === '1' && window.staccaDocumento) {
            stato.carta = 0;
            stato.pagina = 1;
            window.staccaDocumento();
            return;
        }
        if (window.prefLocale(CHIAVE_APERTO) === '1') apri();
    };

    window.apriEditorDaDocumento = function() {
        const id = stato.id;
        const carta = stato.carta;
        const pagina = stato.pagina;
        window.apriTrascrizioneSuCarta(id, carta, pagina);
    };

    document.addEventListener('DOMContentLoaded', () => {
        const vAdd = el('view-add');
        if (!vAdd || el('doc-scheda')) return;
        const modello = `
    <aside id="doc-scheda" class="doc-scheda hidden-tab" aria-labelledby="doc-scheda-titolo">
        <div id="doc-scheda-sep" class="separatore-colonne doc-scheda-sep" role="separator" tabindex="0" aria-orientation="vertical" aria-controls="doc-scheda" data-i18n-title="tooltip_resize" data-i18n-aria-label="tooltip_resize" title="Trascina per ridimensionare">
            <i data-lucide="grip-vertical" class="w-4 h-4 pointer-events-none"></i>
        </div>
        <div class="doc-scheda-corpo">
            <h2 id="doc-scheda-titolo" class="sr-only" data-i18n="doc_record_button">Documento</h2>
            <div class="doc-scheda-barra">
                <div id="doc-scheda-carte" class="flex items-center gap-1">
                    <button type="button" id="doc-scheda-prec" class="btn btn-ghost btn-icon" data-i18n-title="trasc_prev_sheet" data-i18n-aria-label="trasc_prev_sheet" title="Allegato precedente"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
                    <input id="doc-scheda-carta" type="number" min="1" inputmode="numeric" class="form-input py-0.5 w-14 text-center tabular-nums" data-i18n-aria-label="trasc_sheet_number" aria-label="Numero della carta">
                    <span id="doc-scheda-totale" class="tabular-nums whitespace-nowrap"></span>
                    <button type="button" id="doc-scheda-succ" class="btn btn-ghost btn-icon" data-i18n-title="trasc_next_sheet" data-i18n-aria-label="trasc_next_sheet" title="Allegato successivo"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                </div>
                <span id="doc-scheda-nome" class="font-medium truncate min-w-0" translate="no"></span>
                <div id="doc-scheda-pagine" class="flex items-center gap-1 hidden-tab">
                    <button type="button" id="doc-scheda-pagina-prec" class="btn btn-ghost btn-icon" data-i18n-title="pdf_prev_page" data-i18n-aria-label="pdf_prev_page" title="Pagina precedente"><i data-lucide="chevron-up" class="w-4 h-4"></i></button>
                    <input id="doc-scheda-pagina" type="number" min="1" inputmode="numeric" class="form-input py-0.5 w-14 text-center tabular-nums" data-i18n-aria-label="pdf_page_number" aria-label="Numero di pagina">
                    <span id="doc-scheda-pagine-totale" class="tabular-nums whitespace-nowrap"></span>
                    <button type="button" id="doc-scheda-pagina-succ" class="btn btn-ghost btn-icon" data-i18n-title="pdf_next_page" data-i18n-aria-label="pdf_next_page" title="Pagina successiva"><i data-lucide="chevron-down" class="w-4 h-4"></i></button>
                </div>
                <div class="doc-scheda-vista ml-auto" role="group" data-i18n-aria-label="doc_view_group" aria-label="Cosa mostrare">
                    <button type="button" id="doc-vista-immagine" aria-pressed="true" data-i18n="doc_view_image">Immagine</button>
                    <button type="button" id="doc-vista-testo" aria-pressed="false" data-i18n="doc_view_text">Trascrizione</button>
                </div>
                <button type="button" data-on-click="staccaDocumento" class="solo-principale btn btn-ghost btn-icon" data-i18n-title="detach_button" data-i18n-aria-label="detach_button" title="Stacca in una finestra"><i data-lucide="external-link" class="w-4 h-4"></i></button>
                <button type="button" data-on-click="riagganciaFinestra" class="solo-staccata btn btn-secondary text-sm" data-i18n="detach_reattach">Riaggancia</button>
                <button type="button" id="doc-scheda-chiudi" class="btn btn-ghost btn-icon" data-i18n-title="btn_close" data-i18n-aria-label="btn_close" title="Chiudi"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div id="doc-scheda-viewport" class="iv-viewport doc-scheda-viewport" tabindex="0">
                <img id="doc-scheda-img" alt="" class="max-w-full max-h-full object-contain">
            </div>
            <div id="doc-scheda-testo" class="doc-scheda-testo hidden-tab">
                <div class="flex items-center justify-between gap-2 mb-3">
                    <span class="text-xs" style="color: var(--color-text-muted);" data-i18n="doc_read_only">Sola lettura</span>
                    <button type="button" data-on-click="apriEditorDaDocumento" class="btn btn-ghost text-sm" data-i18n="doc_open_editor">Apri nell'editor di trascrizione</button>
                </div>
                <div id="doc-scheda-testo-html" class="leading-relaxed"></div>
            </div>
        </div>
    </aside>`;
        // Subito dopo #view-add: il CSS lo nasconde quando la vista è nascosta (`+`).
        vAdd.insertAdjacentHTML('afterend', modello);

        el('doc-scheda-prec').addEventListener('click', () => mostraCarta(stato.carta - 1));
        el('doc-scheda-succ').addEventListener('click', () => mostraCarta(stato.carta + 1));
        el('doc-scheda-carta').addEventListener('change', (e) => mostraCarta(Number((e.target as HTMLInputElement).value) - 1));
        el('doc-scheda-pagina-prec').addEventListener('click', () => mostraPagina(stato.pagina - 1));
        el('doc-scheda-pagina-succ').addEventListener('click', () => mostraPagina(stato.pagina + 1));
        el('doc-scheda-pagina').addEventListener('change', (e) => mostraPagina((e.target as HTMLInputElement).value));
        el('doc-vista-immagine').addEventListener('click', () => impostaVista('immagine'));
        el('doc-vista-testo').addEventListener('click', () => impostaVista('trascrizione'));
        el('doc-scheda-chiudi').addEventListener('click', () => {
            chiudi(true);
            el('btn-documento-scheda')?.focus();
        });

        stato.modulo = window.proporzioneSeparatore(parseFloat(window.prefLocale(CHIAVE_LARGHEZZA)) || 50, false);
        window.attivaSeparatore(el('doc-scheda-sep'), {
            attuale: () => stato.modulo,
            daPuntatore: (x) => {
                const main = document.querySelector('main').getBoundingClientRect();
                return ((x - main.left) / main.width) * 100;
            },
            applica: (p) => {
                stato.modulo = p;
                disponi();
            },
            fine: (p) => window.prefLocale(CHIAVE_LARGHEZZA, p)
        });
        window.addEventListener('resize', () => { if (aperto()) disponi(); });
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        if (window.lucide) lucide.createIcons({ nodes: [el('doc-scheda')] });
    });
})();
