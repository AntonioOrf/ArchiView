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
                                <span>Novità della Versione 2.4.0</span>
                            </h3>
                            <button type="button" onclick="chiudiChangelogModal()" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <div class="modal-body overflow-y-auto p-6 space-y-6 text-stone-800 dark:text-stone-300">
                            
                            <div class="flex items-center gap-4 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                                <i data-lucide="layout-dashboard" class="w-10 h-10 text-emerald-600 dark:text-emerald-500 shrink-0"></i>
                                <div>
                                    <h4 class="font-bold text-lg text-emerald-900 dark:text-emerald-400">Interfaccia riorganizzata per zone</h4>
                                    <p class="text-sm mt-1">Ogni comando ha ora una posizione stabile: a sinistra la navigazione dei pannelli, a destra un unico controllo per lo stato del cloud, e sopra la griglia le azioni sull'archivio aperto. Niente più pulsanti che cambiano posto a seconda del contenuto.</p>
                                </div>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Archivi e navigazione</h4>
                                <ul class="list-disc pl-5 space-y-2 text-sm">
                                    <li><strong class="text-stone-900 dark:text-stone-100">Nessun archivio "Generale" imposto:</strong> un nuovo Vault nasce vuoto. Le schede non ancora archiviate restano nella radice, visibile in cima all'albero, e ogni cartella — compresa l'ultima rimasta — si può rinominare, spostare ed eliminare.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Filtri attivi sempre dichiarati:</strong> ricerca globale e tag scavalcavano in silenzio la cartella selezionata. Ora compaiono come chip rimovibili sopra la griglia, e navigare l'albero li azzera.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Percorso leggibile:</strong> due cartelle omonime in rami diversi erano indistinguibili; l'intestazione mostra il percorso completo, con gli antenati cliccabili.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Un solo menu azioni:</strong> il pulsante "⋯" di schede e cartelle apre esattamente il menu del tasto destro. Rinomina, copia/taglia/incolla ed esporta non sono più raggiungibili solo col tasto destro.</li>
                                    <li>Il messaggio di "nessun risultato" distingue una cartella vuota da un filtro troppo stretto.</li>
                                </ul>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Bugfix di interfaccia</h4>
                                <ul class="list-disc pl-5 space-y-2 text-sm">
                                    <li><strong class="text-stone-900 dark:text-stone-100">Nuova cartella:</strong> il campo nome non prendeva subito il fuoco — i primi caratteri digitati andavano persi e il cursore saltava in fondo a scrittura iniziata.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Chiusura dei modali:</strong> Esc chiude la finestra in cima passando dalla sua procedura di chiusura: prima lasciava nodi orfani nel DOM e abbandonava senza annullarla la risoluzione dei conflitti di sincronizzazione.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Operazioni in corso:</strong> gli overlay di sincronizzazione e la finestra di autenticazione non si chiudono più per un Esc o un click a vuoto.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Ctrl+F:</strong> mandava il fuoco sul campo di ricerca anche quando il pannello era chiuso, cioè su un elemento invisibile.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Click su una scheda nell'albero:</strong> dalla vista Nuova scheda o Trascrizione non portava alla lista, e la scheda selezionata restava fuori schermo.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Pannelli sidebar:</strong> il pulsante restava evidenziato a sidebar chiusa, facendo sembrare rotto il click successivo.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Sovrapposizione delle finestre:</strong> scala z-index unica — niente più modali che finiscono dietro l'overlay che li ha aperti.</li>
                                    <li><strong class="text-stone-900 dark:text-stone-100">Tutorial:</strong> risolto un errore che poteva bloccare il disegno dell'albero degli archivi all'avvio della guida; l'invito al tutorial non è più un modale a tutto schermo.</li>
                                </ul>
                            </div>

                            <div>
                                <h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">Accessibilità, temi e leggibilità</h4>
                                <ul class="list-disc pl-5 space-y-2 text-sm text-stone-600 dark:text-stone-400">
                                    <li>Pulsanti icona con area di click di almeno 32px, e azioni di riga raggiungibili anche da tastiera.</li>
                                    <li>I cinque pulsanti dei pannelli si comportano da vere schede: frecce, Home e Fine spostano il fuoco, lo stato è annunciato agli screen reader.</li>
                                    <li>Ogni annuncio (sincronizzazione, errori, salvataggi) passa da un'unica live region; i pulsanti che lavorano dichiarano l'attesa invece di sembrare bloccati.</li>
                                    <li>Colori dei pannelli cloud presi dai token del tema: risolti i testi illeggibili nei temi scuri e nel tema chiaro Clear Blue.</li>
                                    <li>Le animazioni si fermano se il sistema chiede movimento ridotto.</li>
                                    <li>Riepilogo dello stato dell'archivio con i dati reali al posto del vecchio testo fisso.</li>
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
