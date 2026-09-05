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
                                <span>Novità della Versione 2.4.3</span>
                            </h3>
                            <button type="button" onclick="chiudiChangelogModal()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <div class="modal-body overflow-y-auto p-6 space-y-6 text-stone-800 dark:text-stone-300">

                            <div class="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                <i data-lucide="cloud" class="w-10 h-10 text-blue-600 dark:text-blue-500 shrink-0"></i>
                                <div>
                                    <h4 class="font-bold text-lg text-blue-900 dark:text-blue-400">Google Drive: disconnessione, accesso e sincronizzazione</h4>
                                    <p class="text-sm mt-1">Aggiornamento correttivo dedicato al collegamento con Google Drive, utile soprattutto a chi lavora sullo stesso archivio da più computer.</p>
                                </div>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Correzioni</h4>
                                <ul class="list-disc pl-5 space-y-2 text-sm">
                                    <li><strong class="text-stone-900 dark:text-stone-100">La disconnessione ora disconnette davvero:</strong> prima confermava l'operazione ma l'account restava collegato. Ora le credenziali vengono rimosse dal computer e l'autorizzazione revocata anche sul tuo account Google.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">"Accedi" torna ad aprire il browser:</strong> dopo una disconnessione il pulsante non apriva più nulla. Anche "Connetti" nella barra di sincronizzazione ora avvia direttamente il login.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Niente più sincronizzazioni finte:</strong> se il computer puntava a una cartella di Drive diversa dagli altri, il download veniva saltato in silenzio dichiarando comunque successo. Ora l'app avvisa e indica cosa controllare.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Cartelle duplicate su Drive:</strong> un secondo computer poteva crearne una nuova invece di riusare quella esistente, separando di fatto i due archivi. Ora la cartella già presente viene riutilizzata.</li>
                                </ul>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Pannello Google Drive rinnovato</h4>
                                <p class="text-sm mb-2">Mostra in evidenza l'account collegato, così puoi verificare a colpo d'occhio di essere sullo stesso account su tutti i computer, e offre subito il pulsante di accesso quando la sessione non è più valida.</p>
                                <p class="text-sm">Fra le opzioni avanzate trovi <strong class="text-stone-900 dark:text-stone-100">"Collega a un archivio esistente su Drive"</strong>: elenca gli archivi presenti sul tuo Drive e collega questo computer a quello giusto — la riparazione per due PC finiti su cartelle diverse.</p>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Sotto il cofano</h4>
                                <p class="text-sm">Il motore su cui gira ArchiView è stato aggiornato di cinque versioni principali (Electron 44), portando con sé tutte le correzioni di sicurezza di Chromium accumulate nel frattempo. Nessun cambiamento nell'uso quotidiano.</p>
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
