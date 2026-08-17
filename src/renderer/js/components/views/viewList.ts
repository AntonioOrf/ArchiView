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
                        </div>
                    </div>

                    <!-- ZONA 3 — Azioni sul contesto corrente (l'archivio aperto).
                         Posizione fissa: non dipende dal contenuto della cartella. -->
                    <div id="context-actions" class="flex flex-wrap items-center gap-2 mt-3">
                        <button id="btn-tab-add" onclick="switchTab('add')" class="btn btn-primary" data-shortcut="Ctrl+N" data-i18n-title="tooltip_new_record" data-i18n-aria-label="tooltip_new_record">
                            <i data-lucide="plus" class="w-4 h-4"></i> <span data-i18n="btn_new_record">Nuova scheda</span>
                        </button>
                        <button onclick="apriNewTypeModal()" class="btn btn-secondary shadow-sm" data-i18n-title="tooltip_new_model">
                            <i data-lucide="file-plus-2" class="w-4 h-4"></i> <span data-i18n="btn_new_model">Modello</span>
                        </button>

                        <div class="w-px h-6 bg-stone-300 dark:bg-stone-600 mx-1"></div>

                        <button onclick="aggiungiCartella()" class="btn btn-ghost border border-stone-200 dark:border-stone-700" data-i18n-title="tooltip_add_folder">
                            <i data-lucide="folder-plus" class="w-4 h-4"></i> <span data-i18n="btn_new_folder">Nuovo archivio</span>
                        </button>
                        <button onclick="importaManoscritto()" class="btn btn-ghost border border-stone-200 dark:border-stone-700" data-i18n-title="tooltip_import">
                            <i data-lucide="download" class="w-4 h-4"></i> <span data-i18n="btn_import">Importa</span>
                        </button>
                        <button onclick="esportaCartellaAttuale()" class="btn btn-ghost border border-stone-200 dark:border-stone-700" data-i18n-title="tooltip_export_folder">
                            <i data-lucide="upload" class="w-4 h-4"></i> <span data-i18n="btn_export_folder">Esporta Cartella</span>
                        </button>
                        <button onclick="eliminaCartellaAttuale()" id="btn-delete-folder" class="btn btn-ghost border border-stone-200 dark:border-stone-700 text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed" data-i18n-title="tooltip_delete_folder">
                            <i data-lucide="trash" class="w-4 h-4"></i> <span class="sr-only" data-i18n="btn_delete_folder">Elimina questo archivio</span>
                        </button>
                    </div>
                </div>

                <!-- Fase 4.4 — Azioni sulla selezione multipla. Non è una barra flottante
                     (rimossa su richiesta): vive dove vivono le altre azioni di contesto,
                     appare solo con almeno un record selezionato. -->
                <div id="selection-bar" class="hidden flex-wrap items-center gap-2 shrink-0 mb-4 p-2 rounded-sm border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
                    <span id="selection-count" class="text-sm font-semibold text-amber-800 dark:text-amber-300 mr-1"></span>
                    <button onclick="window.esportaSelezionati()" class="btn btn-ghost border border-stone-200 dark:border-stone-700" data-i18n-title="tooltip_export">
                        <i data-lucide="upload" class="w-4 h-4"></i> <span data-i18n="tooltip_export">Esporta</span>
                    </button>
                    <button onclick="window.copiaSelezionati()" class="btn btn-ghost border border-stone-200 dark:border-stone-700" data-i18n-title="menu_copy">
                        <i data-lucide="copy" class="w-4 h-4"></i> <span data-i18n="menu_copy">Copia</span>
                    </button>
                    <button onclick="window.tagliaSelezionati()" class="btn btn-ghost border border-stone-200 dark:border-stone-700" data-i18n-title="menu_cut">
                        <i data-lucide="scissors" class="w-4 h-4"></i> <span data-i18n="menu_cut">Taglia</span>
                    </button>
                    <button onclick="window.eliminaSelezionati()" class="btn btn-ghost border border-stone-200 dark:border-stone-700 text-red-600 hover:text-red-800" data-i18n-title="tooltip_delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i> <span data-i18n="tooltip_delete">Elimina</span>
                    </button>
                    <button onclick="window.azzeraSelezione()" class="btn btn-ghost ml-auto" data-i18n-title="btn_clear_selection">
                        <i data-lucide="x" class="w-4 h-4"></i> <span data-i18n="btn_clear_selection">Deseleziona</span>
                    </button>
                </div>

                <div id="active-filters" class="hidden flex-wrap items-center gap-2 shrink-0 mb-4 -mt-1"></div>

                <div id="manoscritti-grid" class="grid grid-cols-1 xl:grid-cols-2 gap-5 pb-6"></div>

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
