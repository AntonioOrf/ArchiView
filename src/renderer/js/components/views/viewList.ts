// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const mainElement = document.querySelector('main');
        if (mainElement && !document.getElementById('view-list')) {
            const html = `
            <div id="view-list" class="fade-in h-full flex flex-col" oncontextmenu="if(typeof showFolderContextMenu==='function') showFolderContextMenu(event)">
                
                <div class="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-stone-200 pb-4 mb-4 shrink-0">
                    <div>
                        <h2 class="text-2xl font-bold text-amber-800 flex items-center gap-2">
                            <i data-lucide="folder-open" class="w-6 h-6"></i>
                            <span id="titolo-cartella-attuale">Generale</span>
                        </h2>
                        <div class="flex items-center gap-3 mt-1">
                            <span id="counter-results" class="text-sm text-stone-500 font-medium">Caricamento...</span>
                            <button onclick="esportaCartellaAttuale()" class="btn btn-ghost text-xs py-0.5 px-2 text-stone-500 hover:text-amber-700 border border-stone-200">
                                <i data-lucide="upload" class="w-3.5 h-3.5"></i> Esporta Cartella
                            </button>
                        </div>
                    </div>
                    <!-- Widget Hub -->
                    <div id="hub-sync-widget" class="hidden flex items-center gap-2.5 p-2 bg-amber-50/50 border border-amber-200 rounded-sm text-sm">
                        <span class="flex items-center gap-1 font-medium text-stone-700">
                            <i data-lucide="cloud" class="w-4 h-4 text-amber-700"></i>
                            <span>Hub:</span>
                            <b id="hub-repo-name" class="text-amber-800">Connesso</b>
                        </span>
                        <div class="flex gap-1.5 ml-2">
                            <button onclick="window.riceviModificheHub()" class="btn btn-secondary py-1.5 px-3 text-xs bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 flex items-center gap-1" data-i18n-title="btn_pull">
                                <i data-lucide="download-cloud" class="w-3.5 h-3.5"></i>
                                <span>Ricevi</span>
                            </button>
                            <button onclick="window.inviaModificheHub()" class="btn btn-secondary py-1.5 px-3 text-xs bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 flex items-center gap-1" data-i18n-title="btn_push">
                                <i data-lucide="upload-cloud" class="w-3.5 h-3.5"></i>
                                <span>Invia</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div id="manoscritti-grid" class="grid grid-cols-1 xl:grid-cols-2 gap-5 pb-6"></div>
                
                <div id="pagination-controls" class="hidden justify-center items-center gap-4 mt-2 mb-10">
                    <button onclick="cambiaPagina(-1)" class="btn btn-secondary" id="btn-prev-page"><i data-lucide="chevron-left" class="w-4 h-4"></i> <span data-i18n="btn_prev">Precedente</span></button>
                    <span id="page-indicator" class="text-stone-600 font-medium text-sm"></span>
                    <button onclick="cambiaPagina(1)" class="btn btn-secondary" id="btn-next-page"><span data-i18n="btn_next">Successiva</span> <i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                </div>

                <div id="empty-state" class="hidden text-center py-16 mt-10 bg-stone-50 rounded-sm border border-dashed border-stone-300">
                    <i data-lucide="file-box" class="w-12 h-12 text-stone-300 mx-auto mb-3"></i>
                    <p class="text-stone-500 italic text-lg mb-4" data-i18n="folder_empty">La cartella è vuota.</p>
                    <button onclick="eliminaCartellaAttuale()" id="btn-delete-folder" class="hidden btn btn-ghost text-red-600 hover:text-red-800 mx-auto text-sm">
                        <i data-lucide="trash" class="w-4 h-4"></i> <span data-i18n="btn_delete_folder">Elimina questa cartella</span></button>
                </div>
            </div>
            `;
            mainElement.insertAdjacentHTML('beforeend', html);
        }
    });
})();
