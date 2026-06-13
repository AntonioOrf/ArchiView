// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('changelog-modal')) {
            const html = `
                <div id="changelog-modal" class="modal-overlay hidden-tab z-200">
                    <div class="modal-window max-w-2xl bg-white dark:bg-stone-900 overflow-hidden flex flex-col h-[80vh]">
                        <div class="modal-header shrink-0 border-b border-stone-200 dark:border-stone-800">
                            <h3 class="modal-title">
                                <i data-lucide="sparkles" class="w-5 h-5 text-amber-500"></i>
                                <span>Novità della Versione 2.1.1</span>
                            </h3>
                            <button type="button" onclick="chiudiChangelogModal()" class="btn btn-ghost btn-icon">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <div class="modal-body overflow-y-auto p-6 space-y-6 text-stone-800 dark:text-stone-300">
                            
                            <div class="flex items-center gap-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                <i data-lucide="folder-kanban" class="w-10 h-10 text-amber-600 dark:text-amber-500 shrink-0"></i>
                                <div>
                                    <h4 class="font-bold text-lg text-amber-900 dark:text-amber-400">Supporto Multi-Vault</h4>
                                    <p class="text-sm mt-1">Gestisci un numero illimitato di archivi (Vaults) indipendenti per organizzare al meglio i tuoi documenti.</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                <i data-lucide="languages" class="w-10 h-10 text-blue-600 dark:text-blue-500 shrink-0"></i>
                                <div>
                                    <h4 class="font-bold text-lg text-blue-900 dark:text-blue-400">Supporto Multilingua (Inglese)</h4>
                                    <p class="text-sm mt-1">L'applicazione è ora completamente tradotta in Inglese. Puoi cambiare lingua in tempo reale accedendo alle Impostazioni.</p>
                                </div>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Miglioramenti all'Interfaccia</h4>
                                <ul class="list-disc pl-5 space-y-2 text-sm">
                                    <li><strong class="text-stone-900 dark:text-stone-100">Tutorial Interattivo:</strong> Nuova guida passo-passo per accompagnare i nuovi utenti nell'esplorazione del gestionale.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Fix Tema Scuro:</strong> Risolti numerosi problemi di contrasto (specialmente nei popover e nel tutorial) durante la modalità scura.</li>
                                    <li>Migliorate le notifiche a schermo e la reattività generale della UI.</li>
                                </ul>
                            </div>
                            
                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Fix e Ottimizzazioni</h4>
                                <ul class="list-disc pl-5 space-y-2 text-sm text-stone-600 dark:text-stone-400">
                                    <li>Risolto il problema di rendering delle icone all'apertura del changelog.</li>
                                    <li>Risolti problemi di sincronizzazione e gestione delle estensioni degli allegati.</li>
                                    <li>Risolto il problema di path assoluti nei sistemi Windows e Mac.</li>
                                    <li>Aggiornato il motore di ricerca interno per supportare meglio i caratteri speciali.</li>
                                </ul>
                            </div>

                        </div>
                        <div class="modal-footer border-t border-stone-200 dark:border-stone-800 p-4 flex justify-end shrink-0">
                            <button type="button" onclick="chiudiChangelogModal()" class="btn btn-primary px-6">Continua</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    });

    window.apriChangelogModal = function() {
        const modal = document.getElementById('changelog-modal');
        if (modal) {
            modal.classList.remove('hidden-tab');
            if (window.lucide) {
                lucide.createIcons({ nodes: [modal] });
            }
        }
    };

    window.chiudiChangelogModal = function() {
        const modal = document.getElementById('changelog-modal');
        if (modal) {
            modal.classList.add('hidden-tab');
        }
    };
})();
