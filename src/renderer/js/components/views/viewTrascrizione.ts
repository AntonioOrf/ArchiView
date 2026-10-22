(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('view-trascrizione')) {
            const html = `
    <div id="view-trascrizione" class="fixed inset-0 z-sticky hidden-tab fade-in flex flex-col overflow-hidden" style="background-color: var(--color-bg-base);">
        <header class="trasc-intestazione shrink-0 flex items-center gap-3">
            <button id="btn-back-to-list-trasc" data-on-click="chiudiTrascrizione" class="btn btn-ghost btn-icon" data-i18n-title="tooltip_back" data-i18n-aria-label="tooltip_back">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>
            <div class="trasc-titoli">
                <h1 id="trascrizione-title" class="trasc-etichetta"><span data-i18n="title_transcription">Trascrizione</span></h1>
                <p id="trascrizione-subtitle" class="trasc-titolo" translate="no"></p>
            </div>
            <div id="trasc-vista" role="group" class="doc-scheda-vista trasc-vista" data-i18n-aria-label="trasc_view">
                <button type="button" data-vista="fonte" aria-pressed="false" aria-keyshortcuts="Alt+F" data-on-mousedown="nonRubareFuoco" data-on-click="impostaVistaTrascrizione" data-args-click="[&quot;fonte&quot;]" data-i18n-title="trasc_view_source_title"><i data-lucide="image" class="w-4 h-4"></i> <span data-i18n="trasc_view_source">Fonte</span></button>
                <button type="button" data-vista="affiancate" aria-pressed="true" data-on-mousedown="nonRubareFuoco" data-on-click="impostaVistaTrascrizione" data-args-click="[&quot;affiancate&quot;]" data-i18n-title="trasc_view_split_title"><i data-lucide="columns-2" class="w-4 h-4"></i> <span data-i18n="trasc_view_split">Affiancate</span></button>
                <button type="button" data-vista="testo" aria-pressed="false" data-on-mousedown="nonRubareFuoco" data-on-click="impostaVistaTrascrizione" data-args-click="[&quot;testo&quot;]" data-i18n-title="trasc_view_text_title"><i data-lucide="align-left" class="w-4 h-4"></i> <span data-i18n="trasc_view_text">Testo</span></button>
            </div>
            <div class="trasc-azioni flex items-center gap-2">
                <button id="btn-confronta-carte" data-on-click="apriConfrontoCarte" class="btn btn-secondary" data-i18n-title="cmp_title" data-i18n-aria-label="cmp_title">
                    <i data-lucide="columns-2" class="w-4 h-4"></i> <span data-i18n="cmp_button">Confronta</span>
                </button>
                <button data-on-mousedown="nonRubareFuoco" data-on-click="apriEsportaTesto" data-args-click="[&quot;corrente&quot;]" id="btn-export-trasc" class="btn btn-secondary" data-i18n-title="tx_title" data-i18n-aria-label="tx_title">
                    <i data-lucide="file-output" class="w-4 h-4"></i> <span data-i18n="tx_export">Esporta</span>
                </button>
                <button data-on-mousedown="nonRubareFuoco" data-on-click="salvaTrascrizione" data-i18n-title="btn_save" class="btn btn-primary">
                    <span data-i18n="btn_save_transcription">Salva Trascrizione</span>
                </button>
            </div>
        </header>

        <div id="trascrizione-container" data-vista="affiancate" class="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

            <div id="trascrizione-allegato-panel" class="trasc-fonte flex-1 overflow-hidden relative flex flex-col hidden-tab min-w-[250px]">
                <div id="trasc-carte-bar" class="hidden-tab shrink-0 flex items-center gap-1 px-2 py-1 bg-stone-100 border-b border-stone-300 text-xs text-stone-700">
                    <button id="btn-carta-prec" data-on-mousedown="nonRubareFuoco" data-on-click="cambiaCartaRelativa" data-args-click="[-1]" class="btn btn-ghost btn-icon" data-i18n-title="trasc_prev_sheet" data-i18n-aria-label="trasc_prev_sheet"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
                    <input id="trasc-carta-numero" type="number" min="1" inputmode="numeric" class="w-14 px-1 py-0.5 text-center border border-stone-300 bg-white tabular-nums" data-i18n-aria-label="trasc_sheet_number" data-on-change="vaiACartaDaCampo">
                    <span id="trasc-carte-totale" class="tabular-nums whitespace-nowrap"></span>
                    <button id="btn-carta-succ" data-on-mousedown="nonRubareFuoco" data-on-click="cambiaCartaRelativa" data-args-click="[1]" class="btn btn-ghost btn-icon" data-i18n-title="trasc_next_sheet" data-i18n-aria-label="trasc_next_sheet"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                    <span id="trasc-carta-nome" class="ml-2 font-medium truncate min-w-0" translate="no"></span>
                    <button id="btn-rinomina-carta" data-on-click="rinominaCartaCorrente" class="btn btn-ghost btn-icon shrink-0" data-i18n-title="btn_rename_short" data-i18n-aria-label="btn_rename_short"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                    <select id="trasc-carta-stato" class="ml-auto shrink-0 px-1 py-0.5 border border-stone-300 bg-white text-xs" data-i18n-aria-label="sheet_status" data-i18n-title="sheet_status" data-on-change="impostaStatoCarta" data-args-change="[{&quot;$&quot;:&quot;value&quot;}]"></select>
                </div>
                <div id="trasc-pdf-bar" class="hidden-tab shrink-0 flex items-center gap-1 px-2 py-1 bg-stone-100 border-b border-stone-300 text-xs text-stone-700">
                    <button id="btn-pdf-pagina-prec" data-on-mousedown="nonRubareFuoco" data-on-click="cambiaPaginaPdfRelativa" data-args-click="[-1]" class="btn btn-ghost btn-icon rounded" data-i18n-title="pdf_prev_page" data-i18n-aria-label="pdf_prev_page"><i data-lucide="chevron-up" class="w-4 h-4"></i></button>
                    <input id="trasc-pdf-pagina" type="number" min="1" inputmode="numeric" class="w-14 px-1 py-0.5 text-center border border-stone-300 rounded-sm bg-white tabular-nums" data-i18n-aria-label="pdf_page_number" data-on-change="vaiAPaginaPdfDaCampo">
                    <span id="trasc-pdf-totale" class="tabular-nums whitespace-nowrap"></span>
                    <button id="btn-pdf-pagina-succ" data-on-mousedown="nonRubareFuoco" data-on-click="cambiaPaginaPdfRelativa" data-args-click="[1]" class="btn btn-ghost btn-icon rounded" data-i18n-title="pdf_next_page" data-i18n-aria-label="pdf_next_page"><i data-lucide="chevron-down" class="w-4 h-4"></i></button>
                    <span id="trasc-pdf-stato" class="ml-2 italic text-stone-500 truncate" role="status" aria-live="polite"></span>
                    <div class="flex-1"></div>
                    <div class="relative">
                        <input id="trasc-pdf-cerca" type="search" autocomplete="off" class="px-2 py-0.5 border border-stone-300 rounded-sm bg-white" data-i18n-placeholder="pdf_search_placeholder" data-i18n-aria-label="pdf_search_placeholder" aria-controls="trasc-pdf-risultati" placeholder="Cerca nel PDF">
                        <ul id="trasc-pdf-risultati" class="hidden-tab mt-1 max-h-72 overflow-y-auto bg-white border border-stone-300 rounded-sm shadow-lg text-stone-800"></ul>
                    </div>
                </div>
                <div class="flex-1 relative flex justify-center items-center overflow-hidden group">
                    <button id="btn-prev-allegato" data-on-click="cambiaAllegatoRelativo" data-args-click="[-1]" data-i18n-title="tooltip_prev" data-i18n-aria-label="tooltip_prev" class="btn btn-icon absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100 disabled:opacity-0 z-10 hidden" style="background-color: rgba(41, 37, 36, 0.6); color: white;"><i data-lucide="chevron-left" class="w-6 h-6"></i></button>
                    <div id="trasc-img-viewport" class="iv-viewport hidden-tab" tabindex="0">
                        <img id="trasc-img-preview" alt="" class="max-w-full max-h-full object-contain" />
                    </div>
                    <div id="trasc-iiif-bar" class="hidden-tab absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 max-w-[90%] px-3 py-1.5 rounded-sm text-xs text-white shadow-lg" style="background-color: rgba(41, 37, 36, 0.82);">
                        <i data-lucide="cloud" class="w-3.5 h-3.5 shrink-0"></i>
                        <span id="trasc-iiif-attribuzione" class="truncate"></span>
                        <button id="btn-iiif-scarica-carta" class="btn btn-icon shrink-0 rounded-sm px-2 py-1 text-white hover:bg-white/20" data-i18n-title="iiif_download_page" data-i18n-aria-label="iiif_download_page">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i>
                        </button>
                        <button id="btn-iiif-scarica-tutte" class="btn btn-icon shrink-0 rounded-sm px-2 py-1 text-white hover:bg-white/20" data-i18n-title="iiif_download_all" data-i18n-aria-label="iiif_download_all">
                            <i data-lucide="download-cloud" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <button id="btn-next-allegato" data-on-click="cambiaAllegatoRelativo" data-args-click="[1]" data-i18n-title="tooltip_next" data-i18n-aria-label="tooltip_next" class="btn btn-icon absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100 disabled:opacity-0 z-10 hidden" style="background-color: rgba(41, 37, 36, 0.6); color: white;"><i data-lucide="chevron-right" class="w-6 h-6"></i></button>
                    <div id="trasc-no-allegato" class="text-center p-8 hidden">
                        <i data-lucide="image-off" class="w-16 h-16 mx-auto text-stone-400 mb-4"></i>
                        <p class="text-stone-500 font-medium" data-i18n="no_attachment">Nessun allegato disponibile per questa scheda.</p>
                    </div>
                </div>
            </div>

            <div id="trascrizione-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-controls="trascrizione-allegato-panel" class="separatore-colonne trasc-separatore flex cursor-col-resize items-center justify-center z-10 shrink-0" data-i18n-title="tooltip_resize" data-i18n-aria-label="tooltip_resize" title="Trascina per ridimensionare">
                <i data-lucide="grip-vertical" class="w-4 h-4 pointer-events-none"></i>
            </div>

            <div id="trascrizione-editor-panel" style="width: 50%;" class="trasc-testo flex flex-col overflow-hidden shrink-0 min-w-[250px]">
                <div class="trasc-schede shrink-0 flex items-center justify-between gap-2 pr-2">
                    <span id="trasc-staccata-titolo" class="solo-staccata pl-3 font-semibold truncate" translate="no"></span>
                    <div role="tablist" class="flex" data-i18n-aria-label="trasc_tabs">
                        <button id="tab-trasc-testo" type="button" role="tab" aria-selected="true" aria-controls="trasc-pannello-testo" data-on-click="mostraSchedaTrascrizione" data-args-click="[&quot;testo&quot;]" class="trasc-tab">
                            <i data-lucide="type" class="w-4 h-4"></i> <span data-i18n="trasc_tab_text">Testo</span></button>
                        <button id="tab-trasc-scheda" type="button" role="tab" aria-selected="false" aria-controls="trasc-pannello-scheda" aria-keyshortcuts="Control+Shift+S" data-shortcut="Ctrl+Shift+S" data-on-click="mostraSchedaTrascrizione" data-args-click="[&quot;scheda&quot;]" class="trasc-tab" data-i18n-title="trasc_tab_record_title">
                            <i data-lucide="file-text" class="w-4 h-4"></i> <span data-i18n="trasc_tab_record">Scheda</span></button>
                    </div>
                    <div class="flex items-center gap-2 min-w-0">
                        <span id="trasc-scheda-stato" class="text-xs truncate" role="status" aria-live="polite"></span>
                        <button type="button" id="btn-stacca-scheda" data-on-click="staccaScheda" class="solo-principale btn btn-ghost text-sm" data-i18n-aria-label="detach_button" aria-label="Stacca in una finestra"><i data-lucide="external-link" class="w-4 h-4"></i> <span data-i18n="detach_button">Stacca in una finestra</span></button>
                        <button type="button" data-on-click="riagganciaFinestra" class="solo-staccata btn btn-secondary text-sm" data-i18n="detach_reattach">Riaggancia</button>
                    </div>
                </div>
                <div id="trasc-pannello-testo" role="tabpanel" aria-labelledby="tab-trasc-testo" class="flex-1 flex flex-col min-h-0">
                <div id="trasc-senza-fonte" class="trasc-senza-fonte shrink-0">
                    <i data-lucide="image-off" class="w-4 h-4 shrink-0" aria-hidden="true"></i>
                    <span data-i18n="trasc_no_source">Nessuna immagine collegata: la trascrizione occupa tutta la larghezza.</span>
                    <button id="btn-carica-allegato-trasc" data-on-click="cliccaElemento" data-args-click="[&quot;trasc-file-input&quot;]" class="btn btn-secondary shrink-0" data-i18n-title="btn_add_image_pdf" data-i18n-aria-label="btn_add_image_pdf">
                        <i data-lucide="paperclip" class="w-4 h-4"></i> <span data-i18n="btn_add_image_pdf">Aggiungi Immagine/PDF</span></button>
                </div>
                <div id="trascrizione-toolbar" class="trasc-barra flex flex-wrap gap-1 items-center">
                    <button data-on-mousedown="nonRubareFuoco" data-cmd="bold" aria-pressed="false" data-on-click="formatta" data-args-click="[&quot;bold&quot;]" class="btn btn-ghost btn-icon" data-i18n-title="tooltip_bold" data-i18n-aria-label="tooltip_bold"><i data-lucide="bold" class="w-4 h-4"></i></button>
                    <button data-on-mousedown="nonRubareFuoco" data-cmd="italic" aria-pressed="false" data-on-click="formatta" data-args-click="[&quot;italic&quot;]" class="btn btn-ghost btn-icon" data-i18n-title="tooltip_italic" data-i18n-aria-label="tooltip_italic"><i data-lucide="italic" class="w-4 h-4"></i></button>
                    <button data-on-mousedown="nonRubareFuoco" data-cmd="underline" aria-pressed="false" data-on-click="formatta" data-args-click="[&quot;underline&quot;]" class="btn btn-ghost btn-icon" data-i18n-title="tooltip_underline" data-i18n-aria-label="tooltip_underline"><i data-lucide="underline" class="w-4 h-4"></i></button>
                    <span class="trasc-sep" aria-hidden="true"></span>
                    <button data-on-mousedown="nonRubareFuoco" data-cmd="insertUnorderedList" aria-pressed="false" data-on-click="formatta" data-args-click="[&quot;insertUnorderedList&quot;]" class="btn btn-ghost btn-icon" data-i18n-title="tooltip_ul" data-i18n-aria-label="tooltip_ul"><i data-lucide="list" class="w-4 h-4"></i></button>
                    <button data-on-mousedown="nonRubareFuoco" data-cmd="insertOrderedList" aria-pressed="false" data-on-click="formatta" data-args-click="[&quot;insertOrderedList&quot;]" class="btn btn-ghost btn-icon" data-i18n-title="tooltip_ol" data-i18n-aria-label="tooltip_ol"><i data-lucide="list-ordered" class="w-4 h-4"></i></button>
                    <span class="trasc-sep" aria-hidden="true"></span>
                    <button id="btn-caratteri-speciali" data-on-mousedown="nonRubareFuoco" data-on-click="toggleCaratteriSpeciali" aria-expanded="false" aria-controls="trasc-caratteri" aria-keyshortcuts="Alt+K" class="btn btn-ghost btn-icon" data-i18n-title="tooltip_special_chars" data-i18n-aria-label="tooltip_special_chars"><i data-lucide="omega" class="w-4 h-4"></i></button>
                    <span class="trasc-sep" aria-hidden="true"></span>
                    <button type="button" data-on-mousedown="nonRubareFuoco" data-on-click="segnoFilologico" data-args-click="[&quot;lacuna&quot;]" class="btn btn-ghost trasc-segno" data-i18n-aria-label="trasc_mark_gap" aria-label="[lacuna]" data-i18n-title="trasc_mark_gap_title" title="Lacuna o integrazione: la selezione tra quadre, oppure [...]"><span class="segno-esteso" data-i18n="trasc_mark_gap">[lacuna]</span><span class="segno-breve" aria-hidden="true">[…]</span></button>
                    <button type="button" data-on-mousedown="nonRubareFuoco" data-on-click="segnoFilologico" data-args-click="[&quot;espansione&quot;]" class="btn btn-ghost trasc-segno" data-i18n-aria-label="trasc_mark_expan" aria-label="(espansione)" data-i18n-title="trasc_mark_expan_title" title="Scioglimento di abbreviazione: la selezione tra tonde"><span class="segno-esteso" data-i18n="trasc_mark_expan">(espansione)</span><span class="segno-breve" aria-hidden="true">( )</span></button>
                    <button type="button" data-on-mousedown="nonRubareFuoco" data-on-click="segnoFilologico" data-args-click="[&quot;sic&quot;]" class="btn btn-ghost trasc-segno" data-i18n-aria-label="trasc_mark_sic" aria-label="sic (!)" data-i18n-title="trasc_mark_sic_title" title="Sic: segnala la lezione con (!)"><span class="segno-esteso" data-i18n="trasc_mark_sic">sic (!)</span><span class="segno-breve" aria-hidden="true">(!)</span></button>

                    <div class="flex-1"></div>

                    <button id="btn-ocr-trasc" data-on-click="apriOcrModal" class="btn btn-secondary" data-i18n-title="ocr_title" data-i18n-aria-label="ocr_title">
                        <i data-lucide="scan-text" class="w-4 h-4"></i> <span data-i18n="ocr_button">Riconosci testo</span></button>

                    <button id="btn-iiif-trasc" data-on-click="aggiungiCarteIiifATrascrizione" class="btn btn-secondary" data-i18n-title="iiif_title_add" data-i18n-aria-label="iiif_title_add">
                        <i data-lucide="library" class="w-4 h-4"></i> <span data-i18n="iiif_add_button">Aggiungi da IIIF</span></button>
                    <input type="file" id="trasc-file-input" class="hidden" accept="image/*,.pdf" data-on-change="caricaAllegatoTrascrizione" data-args-change="[{&quot;$&quot;:&quot;event&quot;}]">
                </div>
                <div id="trasc-caratteri" class="hidden-tab shrink-0" data-i18n-aria-label="tooltip_special_chars" role="region"></div>
                <div id="trascrizione-carta" class="hidden-tab shrink-0 px-3 py-1.5 text-xs font-medium bg-amber-50 border-b border-amber-200 text-amber-900 truncate"></div>
                <div class="trasc-editor-area flex-1 overflow-y-auto cursor-text" data-on-click="fuocoEditorDaSfondo">
                    <div id="trascrizione-editor" contenteditable="true" class="min-h-full outline-none select-text"></div>
                </div>
                <div id="trasc-stato-testo" class="trasc-stato shrink-0" aria-live="off"></div>
                </div>
                <div id="trasc-pannello-scheda" role="tabpanel" aria-labelledby="tab-trasc-scheda" class="hidden-tab flex-1 min-h-0 overflow-y-auto p-3">
                    <div id="trasc-scheda-staccata" class="hidden-tab riquadro-info p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span data-i18n="detach_record_elsewhere">La scheda è aperta in un'altra finestra.</span>
                        <button type="button" data-on-click="riportaSchedaQui" class="btn btn-secondary" data-i18n="detach_bring_back">Riporta qui</button>
                    </div>
                </div>
            </div>

            <button type="button" id="trasc-mostra-testo" class="trasc-mostra-testo" data-on-click="impostaVistaTrascrizione" data-args-click="[&quot;affiancate&quot;]" aria-keyshortcuts="Alt+F">
                <i data-lucide="chevron-left" class="w-4 h-4"></i> <span data-i18n="trasc_show_text">Mostra il testo</span>
            </button>
        </div>
        <input type="hidden" id="trascrizione-id">
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }

        const RIGHE = ':scope > :is(p, div, h1, h2, h3, h4, h5, h6, blockquote, pre):not(.ocr-origine, .ocr-pagina), :scope > :is(ul, ol) > li';
        const aggiornaStatoTesto = () => {
            const editor = document.getElementById('trascrizione-editor');
            const stato = document.getElementById('trasc-stato-testo');
            if (!editor || !stato) return;
            const righe = Array.from(editor.querySelectorAll(RIGHE));
            const parole = righe.reduce((n, r) => n + (r.textContent.match(/\S+/g) || []).length, 0);
            const sel = window.getSelection();
            const corrente = sel && sel.rangeCount ? righe.findIndex(r => r.contains(sel.anchorNode)) : -1;
            const testoParole = parole === 1 ? window.t('trasc_status_word', '1 parola') : window.t('trasc_status_words', '{var0} parole').replace('{var0}', String(parole));
            const testoRiga = corrente >= 0
                ? window.t('trasc_status_line', 'riga {var0} di {var1}').replace('{var0}', String(corrente + 1)).replace('{var1}', String(righe.length))
                : window.t('trasc_status_lines', '{var0} righe').replace('{var0}', String(righe.length));
            stato.textContent = testoRiga + ' · ' + testoParole;
        };
        window.aggiornaStatoTesto = aggiornaStatoTesto;
        document.getElementById('trascrizione-editor')?.addEventListener('input', aggiornaStatoTesto);

        const updateToolbarState = () => {
            const editor = document.getElementById('trascrizione-editor');
            const toolbar = document.getElementById('trascrizione-toolbar');
            if (!editor || !toolbar) return;
            const sel = window.getSelection();
            const inEditor = sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode);
            toolbar.querySelectorAll('button[data-cmd]').forEach((btn) => {
                let active = false;
                if (inEditor) {
                    try { active = document.queryCommandState(btn.getAttribute('data-cmd')); } catch {}
                }
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            if (inEditor) aggiornaStatoTesto();
        };
        window.updateToolbarState = updateToolbarState;
        document.addEventListener('selectionchange', updateToolbarState);
    });
})();
