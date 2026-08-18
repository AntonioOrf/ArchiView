// @ts-nocheck

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('changelog-modal')) {
            const html = `
                <div id="changelog-modal" class="modal-overlay hidden-tab z-modal-nested">
                    <div class="modal-window max-w-2xl bg-white dark:bg-stone-900 overflow-hidden flex flex-col h-[80vh]">
                        <div class="modal-header shrink-0 border-b border-stone-200 dark:border-stone-800">
                            <h3 class="modal-title">
                                <i data-lucide="sparkles" class="w-5 h-5 text-amber-500"></i>
                                <span>Novità della Versione 2.4.2</span>
                            </h3>
                            <button type="button" onclick="chiudiChangelogModal()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <div class="modal-body overflow-y-auto p-6 space-y-6 text-stone-800 dark:text-stone-300">

                            <div class="flex items-center gap-4 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                                <i data-lucide="zap" class="w-10 h-10 text-emerald-600 dark:text-emerald-500 shrink-0"></i>
                                <div>
                                    <h4 class="font-bold text-lg text-emerald-900 dark:text-emerald-400">Ottimizzazione per hardware low-end</h4>
                                    <p class="text-sm mt-1">Un importante aggiornamento dedicato alle prestazioni, che riduce i tempi di avvio e l'utilizzo di memoria, migliorando la fluidità su computer meno recenti o con archivi molto grandi.</p>
                                </div>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Miglioramenti principali</h4>
                                <ul class="list-disc pl-5 space-y-2 text-sm">
                                    <li><strong class="text-stone-900 dark:text-stone-100">Avvio più rapido:</strong> il codice dell'interfaccia viene ora compresso e le dipendenze pesanti vengono caricate solo al momento del bisogno.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Scritture ottimizzate e sicure:</strong> i salvataggi dei dati ora avvengono in background e sono atomici, per proteggere i dati in caso di arresto anomalo.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Ricerca e filtri istantanei:</strong> una nuova cache testuale rende fulminea la ricerca e l'applicazione dei filtri anche con migliaia di schede.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Navigazione fluida:</strong> l'albero laterale si aggiorna solo quando necessario. L'estrazione dei file ZIP in importazione avviene in "streaming" azzerando i picchi di RAM.</li>
                                </ul>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Opzione "Prestazioni ridotte"</h4>
                                <p class="text-sm mb-2">Una nuova impostazione nelle preferenze permette di disattivare le animazioni, ridurre gli elementi visualizzati a 25 per pagina e limitare l'accelerazione hardware, ideale per risparmiare risorse e batteria.</p>
                            </div>

                        </div>
                        <div class="modal-footer border-t border-stone-200 dark:border-stone-800 p-4 flex justify-end shrink-0">
                            <button type="button" onclick="chiudiChangelogModal()" class="btn btn-primary px-6">Continua</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
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
