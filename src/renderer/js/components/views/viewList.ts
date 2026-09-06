// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const mainElement = document.querySelector('main');
        if (mainElement && !document.getElementById('view-list')) {
            const html = `
            <div id="view-list" class="fade-in h-full flex flex-col" oncontextmenu="if(typeof showFolderContextMenu==='function') showFolderContextMenu(event)">

                <div class="border-b border-stone-200 pb-4 mb-4 shrink-0">
                    <div class="min-w-0">
                        <nav id="breadcrumb-cartella" class="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 flex-wrap mb-1 empty:hidden" aria-label="Percorso cartella"></nav>
                        <h2 class="text-2xl font-bold text-amber-800 flex items-center gap-2">
                            <i id="icona-vista-corrente" data-lucide="folder-open" class="w-6 h-6"></i>
                            <span id="titolo-cartella-attuale"></span>
                        </h2>
                        <div class="flex items-center gap-3 mt-1">
                            <span id="counter-results" class="text-sm text-stone-500 font-medium">Caricamento...</span>
                            <!-- Unico segnale della selezione ora che la barra non c'è più:
                                 testo, non pulsanti — le azioni stanno tutte nel tasto destro. -->
                            <span id="selection-indicator" class="hidden text-sm font-semibold" style="color: var(--color-primary);"></span>
                        </div>
                    </div>

                    <!-- ZONA 3 — Azioni sul contesto corrente (l'archivio aperto).
                         Posizione fissa: non dipende dal contenuto della cartella.
                         Gerarchia: a sinistra le due azioni che si usano ogni giorno (creare
                         una scheda, creare un modello), a destra i controlli di vista, e nel
                         "⋯" tutto ciò che si fa di rado (archivio, importa, esporta, colonne).
                         Tenere sette pulsanti tutti allo stesso peso rendeva invisibile quello
                         che conta ed era il primo a soffrire sotto i 768px. -->
                    <div id="context-actions" class="flex flex-wrap items-center gap-2 mt-3">
                        <!-- Azione primaria, in due parti: il corpo apre il form come sempre,
                             il chevron sceglie subito il tipo di scheda. Prima il tipo si
                             poteva scegliere solo DENTRO il form, dopo averlo aperto. -->
                        <div class="flex items-stretch">
                            <button id="btn-tab-add" onclick="switchTab('add')" class="btn btn-primary rounded-r-none" data-shortcut="Ctrl+N" data-i18n-title="tooltip_new_record" data-i18n-aria-label="tooltip_new_record">
                                <i data-lucide="plus" class="w-4 h-4"></i> <span data-i18n="btn_new_record">Nuova scheda</span>
                            </button>
                            <button id="btn-nuova-scheda-tipo" onclick="window.apriMenuNuovaScheda(this)"
                                    class="btn btn-primary rounded-l-none px-2 border-l border-white/25"
                                    aria-haspopup="menu" aria-expanded="false"
                                    data-i18n-title="tooltip_new_record_type" data-i18n-aria-label="tooltip_new_record_type">
                                <i data-lucide="chevron-down" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <button onclick="apriNewTypeModal()" class="btn btn-secondary shadow-sm" data-i18n-title="tooltip_new_model">
                            <i data-lucide="file-plus-2" class="w-4 h-4"></i> <span data-i18n="btn_new_model">Nuovo modello</span>
                        </button>

                        <!-- Controlli di vista, a destra e staccati dalle azioni di creazione:
                             non creano nulla, cambiano solo come si guarda l'elenco. -->
                        <div class="ml-auto flex flex-wrap items-center gap-2">
                            <!-- Ordinamento esplicito: serve SOLO nella vista a schede, dove non
                                 esistono intestazioni da cliccare. In tabella si ordina dall'header
                                 della colonna, e questi due controlli sarebbero un doppione. -->
                            <div id="controlli-ordinamento" class="flex items-center gap-2">
                                <label for="select-ordinamento" class="sr-only" data-i18n="label_sort_by">Ordina per</label>
                                <select id="select-ordinamento" onchange="window.impostaOrdinamento(this.value)"
                                        class="btn btn-ghost border border-stone-200 dark:border-stone-700 py-1"
                                        data-i18n-title="tooltip_sort_by" data-i18n-aria-label="label_sort_by"></select>
                                <button id="btn-ordinamento-dir" onclick="window.invertiDirezioneOrdinamento()"
                                        class="btn btn-ghost border border-stone-200 dark:border-stone-700"
                                        data-i18n-title="tooltip_sort_dir">
                                    <i data-lucide="arrow-down-a-z" class="w-4 h-4"></i>
                                </button>
                            </div>

                            <!-- Segmento a due stati invece di un unico bottone: mostra QUALE
                                 vista e' attiva, invece di nasconderlo dietro un'icona sola. -->
                            <div class="flex items-stretch" role="group" data-i18n-aria-label="tooltip_toggle_view">
                                <button id="btn-vista-tabella" onclick="window.cambiaVistaLista('tabella')"
                                        class="btn btn-ghost border border-stone-200 dark:border-stone-700 rounded-r-none"
                                        data-i18n-title="tooltip_view_table">
                                    <i data-lucide="rows-3" class="w-4 h-4"></i>
                                </button>
                                <button id="btn-vista-griglia" onclick="window.cambiaVistaLista('griglia')"
                                        class="btn btn-ghost border border-l-0 border-stone-200 dark:border-stone-700 rounded-l-none"
                                        data-i18n-title="tooltip_view_grid">
                                    <i data-lucide="layout-grid" class="w-4 h-4"></i>
                                </button>
                            </div>

                            <button onclick="eliminaCartellaAttuale()" id="btn-delete-folder" class="btn btn-ghost border border-stone-200 dark:border-stone-700 text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed" data-i18n-title="tooltip_delete_folder">
                                <i data-lucide="trash" class="w-4 h-4"></i> <span class="sr-only" data-i18n="btn_delete_folder">Elimina questo archivio</span>
                            </button>

                            <!-- "..." : nuovo archivio, importa, esporta, colonne. Stesso
                                 pulsante e stesso menu delle azioni sulla card (creaBottoneOverflow),
                                 popolato da mainView perche' le voci dipendono dalla vista. -->
                            <span id="context-overflow-slot" class="flex"></span>
                        </div>
                    </div>
                </div>

                <!-- La barra delle azioni sulla selezione è stata RIMOSSA: compariva
                     sopra la lista a ogni selezione, spingendo in basso le schede e rubando
                     spazio proprio mentre si lavora. Le stesse azioni (copia, taglia,
                     esporta, elimina, deseleziona) vivono nel menu del tasto destro e nel
                     "⋯" della card, che sono lo stesso menu: vedi vociMenuRecord in app.ts.
                     Quante schede sono selezionate lo dice #selection-indicator, accanto al
                     contatore dei risultati. -->

                <div id="active-filters" class="hidden flex-wrap items-center gap-2 shrink-0 mb-4 -mt-1"></div>

                <div id="manoscritti-grid" class="grid grid-cols-1 xl:grid-cols-2 gap-5 pb-6"></div>

                <!-- Vista tabella: alternativa alla griglia, stessi record e stessa
                     paginazione. Le righe portano .card-scheda e id="card-<id>" perché
                     selezione multipla, shift-range, menu contestuale e
                     rivelaRecordNellaGriglia si agganciano a quei due selettori. -->
                <div id="manoscritti-table-wrap" class="hidden overflow-x-auto pb-6">
                    <table id="manoscritti-table" class="tabella-schede w-full text-sm"></table>
                </div>

                <div id="pagination-controls" class="hidden justify-center items-center gap-4 mt-2 mb-10">
                    <button onclick="cambiaPagina(-1)" class="btn btn-secondary" id="btn-prev-page"><i data-lucide="chevron-left" class="w-4 h-4"></i> <span data-i18n="btn_prev">Precedente</span></button>
                    <span id="page-indicator" class="text-stone-600 font-medium text-sm"></span>
                    <button onclick="cambiaPagina(1)" class="btn btn-secondary" id="btn-next-page"><span data-i18n="btn_next">Successiva</span> <i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                </div>

                <div id="empty-state" class="hidden text-center py-16 mt-10 bg-stone-50 rounded-sm border border-dashed border-stone-300">
                    <i data-lucide="file-box" class="w-12 h-12 text-stone-300 mx-auto mb-3"></i>
                    <p id="empty-state-text" class="text-stone-500 italic text-lg mb-4" data-i18n="folder_empty">La cartella è vuota.</p>
                </div>
            </div>
            `;
            mainElement.insertAdjacentHTML('beforeend', html);
        }
    });
})();
