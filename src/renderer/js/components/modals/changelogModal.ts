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
                                <span>Novità della Versione 2.2.0</span>
                            </h3>
                            <button type="button" onclick="chiudiChangelogModal()" class="btn btn-ghost btn-icon">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <div class="modal-body overflow-y-auto p-6 space-y-6 text-stone-800 dark:text-stone-300">
                            
                            <div class="flex items-center gap-4 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                                <i data-lucide="mail-plus" class="w-10 h-10 text-emerald-600 dark:text-emerald-500 shrink-0"></i>
                                <div>
                                    <h4 class="font-bold text-lg text-emerald-900 dark:text-emerald-400">Invito Diretto tramite Email</h4>
                                    <p class="text-sm mt-1">Introdotta la funzionalità di invito diretto dall'applicazione. Il sistema gestisce in autonomia l'autorizzazione su Google Drive e l'invio di un link di accesso rapido per semplificare l'inserimento dei collaboratori.</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                <i data-lucide="users" class="w-10 h-10 text-blue-600 dark:text-blue-500 shrink-0"></i>
                                <div>
                                    <h4 class="font-bold text-lg text-blue-900 dark:text-blue-400">Gestione Partecipanti Cloud</h4>
                                    <p class="text-sm mt-1">Implementata una dashboard dedicata all'interno del modulo Cloud per la gestione degli accessi. È ora possibile monitorare la lista dei collaboratori attivi e revocare i permessi in tempo reale.</p>
                                </div>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Miglioramenti all'Interfaccia</h4>
                                <ul class="list-disc pl-5 space-y-2 text-sm">
                                    <li><strong class="text-stone-900 dark:text-stone-100">Riprogettazione Pannello Cloud:</strong> Nuovo layout a due colonne per un'esperienza utente più intuitiva nella creazione e partecipazione agli archivi condivisi.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Storico Versioni:</strong> Integrazione di moduli informativi nel tutorial iniziale per illustrare il funzionamento del tracciamento cloud.</li>
                                    <li>Ottimizzazione delle animazioni e del bilanciamento visivo all'interno dei componenti modali.</li>
                                </ul>
                            </div>
                            
                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Fix e Ottimizzazioni</h4>
                                <ul class="list-disc pl-5 space-y-2 text-sm text-stone-600 dark:text-stone-400">
                                    <li>Risoluzione delle direttive di sicurezza (CSP) per garantire il corretto caricamento degli avatar da Google Drive.</li>
                                    <li>Miglioramento dell'impaginazione e della gestione degli spazi nel pannello di sincronizzazione.</li>
                                    <li>Ottimizzazione dei protocolli di generazione e validazione dei codici invito.</li>
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
