(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const mainElement = document.querySelector('main');
        if (mainElement && !document.getElementById('view-add')) {
            const html = `
            <div id="view-add" class="hidden-tab fade-in scheda-vista">
                <div class="scheda-testa">
                    <button id="btn-back-to-list" data-on-click="seEsiste" data-args-click="[&quot;switchTab&quot;,&quot;list&quot;]" class="btn btn-ghost btn-icon" data-i18n-title="tooltip_back_to_list" data-i18n-aria-label="tooltip_back_to_list" title="Torna alla lista" aria-label="Torna alla lista">
                        <i data-lucide="arrow-left" class="w-5 h-5"></i>
                    </button>
                    <div class="min-w-0 mr-auto">
                        <p id="form-title" class="scheda-sopratitolo" data-i18n="title_new_record">Nuova scheda</p>
                        <h1 id="form-titolo-segnatura" class="scheda-titolo"></h1>
                    </div>
                    <button type="button" id="btn-documento-scheda" data-on-click="alternaDocumentoScheda" aria-pressed="false" aria-controls="doc-scheda" aria-keyshortcuts="Control+Shift+S" data-shortcut="Ctrl+Shift+S" class="hidden-tab btn btn-secondary" data-i18n-title="doc_record_title" title="Guarda il documento accanto alla scheda">
                        <i data-lucide="image" class="w-4 h-4"></i>
                        <span data-i18n="doc_record_button">Documento</span>
                    </button>
                </div>

                <div class="scheda-corpo">
                <form id="manoscritto-form" class="scheda-form">
                    <input type="hidden" id="form-id">

                    <section id="sez-identificazione" class="scheda-sez" aria-labelledby="sez-identificazione-titolo">
                        <div class="scheda-sez-testa">
                            <h2 id="sez-identificazione-titolo" data-i18n="record_sec_ident">Identificazione</h2>
                            <p data-i18n="record_sec_ident_desc">Dove sta la scheda e come si cita.</p>
                        </div>
                        <div>
                            <div class="form-group">
                                <label class="form-label" for="form-cartella" data-i18n="label_folder">Cartella</label>
                                <select id="form-cartella" class="form-input"></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="form-tipo-documento" data-i18n="label_doc_type">Modello</label>
                                <select id="form-tipo-documento" data-on-change="cambiaTipoDocumentoForm" class="form-input"></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="form-segnatura" data-i18n="label_identifier">Segnatura *</label>
                                <input required id="form-segnatura" data-i18n-placeholder="placeholder_identifier" class="form-input campo-segnatura">
                            </div>
                        </div>
                    </section>

                    <section id="sez-campi" class="scheda-sez" aria-labelledby="sez-campi-titolo">
                        <div class="scheda-sez-testa">
                            <h2 id="sez-campi-titolo" data-i18n="record_sec_fields">Descrizione</h2>
                            <p data-i18n="record_sec_fields_desc">I campi del modello, più quelli aggiunti a questa scheda.</p>
                        </div>
                        <div>
                            <div id="form-dynamic-fields"></div>
                            <input type="hidden" id="form-campi-propri" value="[]">
                            <input type="hidden" id="form-ordine-campi" value="[]">
                            <div id="form-riordino" class="hidden-tab panel-solid p-3 mb-3">
                                <div class="flex items-center justify-between gap-2 mb-2">
                                    <p class="text-xs text-stone-500" data-i18n="reorder_hint">Trascina per cambiare l'ordine dei campi. Vale solo per questa scheda.</p>
                                    <button type="button" data-on-click="azzeraRiordinoCampi" class="btn btn-ghost text-xs" data-i18n="reorder_reset">Ordine del modello</button>
                                </div>
                                <ul id="form-riordino-lista" class="space-y-1"></ul>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <button type="button" id="btn-campo-proprio" data-on-click="apriCampoProprioModal" class="btn btn-ghost text-sm">
                                    <i data-lucide="plus" class="w-4 h-4"></i>
                                    <span data-i18n="own_field_add">Aggiungi un campo a questa scheda</span>
                                </button>
                                <button type="button" id="btn-riordina-campi" data-on-click="alternaRiordinoCampi" aria-pressed="false" class="btn btn-ghost text-sm">
                                    <i data-lucide="arrow-up-down" class="w-4 h-4"></i>
                                    <span data-i18n="reorder_fields">Riordina i campi</span>
                                </button>
                            </div>
                        </div>
                    </section>

                    <section id="sez-allegati" class="scheda-sez" aria-labelledby="sez-allegati-titolo">
                        <div class="scheda-sez-testa">
                            <h2 id="sez-allegati-titolo" data-i18n="record_sec_attachments">Allegati</h2>
                            <p data-i18n="record_sec_attachments_desc">Foto o PDF del documento.</p>
                        </div>
                        <div>
                            <div class="form-group">
                                <label class="form-label" for="form-allegato" data-i18n="label_attachments">Aggiungi file</label>
                                <input type="file" id="form-allegato" accept="image/*,.pdf" multiple class="form-input file:mr-4 file:py-1.5 file:px-3 file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 cursor-pointer p-1">
                                <input type="hidden" id="form-allegati" value="[]">
                                <div id="form-allegati-list" class="mt-3 grid grid-cols-1 gap-2"></div>
                                <div id="form-allegati-new-preview" class="text-xs text-amber-700 mt-2 font-medium hidden"></div>
                            </div>
                        </div>
                    </section>

                    <section id="sez-collegamenti" class="scheda-sez" aria-labelledby="sez-collegamenti-titolo">
                        <div class="scheda-sez-testa">
                            <h2 id="sez-collegamenti-titolo" data-i18n="record_sec_links">Tag e collegamenti</h2>
                            <p data-i18n="record_sec_links_desc">Come la scheda si ritrova e a cosa rimanda.</p>
                        </div>
                        <div>
                            <div class="form-group">
                                <label class="form-label" for="form-tags" data-i18n="label_tags">Tag</label>
                                <input id="form-tags" data-i18n-placeholder="placeholder_tags_input" class="form-input">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="form-relazione-target" data-i18n="label_links">Collegamenti</label>
                                <input type="hidden" id="form-relazioni" value="[]">
                                <div id="form-relazioni-list" class="space-y-1 mb-2"></div>
                                <div id="form-backlink" class="hidden mb-2">
                                    <p class="text-xs text-stone-500 mb-1" data-i18n="link_incoming">È richiamata da</p>
                                    <div id="form-backlink-list" class="space-y-1"></div>
                                </div>
                                <div class="flex gap-2">
                                    <select id="form-relazione-tipo" class="form-input shrink-0" style="max-width: 12rem;" data-i18n-aria-label="link_type" aria-label="Tipo di collegamento"></select>
                                    <select id="form-relazione-target" class="form-input"></select>
                                    <button type="button" data-on-click="aggiungiRelazioneForm" class="btn btn-secondary shrink-0" data-i18n-title="link_add" data-i18n-aria-label="link_add" title="Aggiungi il collegamento" aria-label="Aggiungi il collegamento">
                                        <i data-lucide="link" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="form-group">
                                <span class="form-label" data-i18n="cross_links_title">Rimandi ad altri archivi</span>
                                <input type="hidden" id="form-rimandi-esterni" value="[]">
                                <div id="form-rimandi-esterni-list" class="space-y-1 mb-2"></div>
                                <div>
                                    <button type="button" id="btn-rimando-esterno" class="btn btn-secondary">
                                        <i data-lucide="library" class="w-4 h-4"></i>
                                        <span data-i18n="cross_links_add">Aggiungi un rimando a un altro archivio</span>
                                    </button>
                                </div>
                                <p id="form-provenienza" class="hidden mt-3 text-xs text-stone-500 dark:text-stone-400"></p>
                            </div>
                        </div>
                    </section>
                </form>

                <nav class="scheda-indice" data-i18n-aria-label="record_toc" aria-label="In questa scheda">
                    <p class="scheda-indice-titolo" data-i18n="record_toc">In questa scheda</p>
                    <a href="#sez-identificazione" data-i18n="record_sec_ident">Identificazione</a>
                    <a href="#sez-campi" data-i18n="record_sec_fields">Descrizione</a>
                    <a href="#sez-allegati" data-i18n="record_sec_attachments">Allegati</a>
                    <a href="#sez-collegamenti" data-i18n="record_sec_links">Tag e collegamenti</a>
                </nav>
                </div>

                <div class="scheda-azioni">
                    <button type="button" id="btn-cancel-edit" data-on-click="cancelEdit" class="hidden btn btn-secondary" data-i18n="btn_cancel_edit">Annulla</button>
                    <button type="submit" form="manoscritto-form" id="btn-submit-form" data-shortcut="Ctrl+S" data-i18n-title="tooltip_save_record" title="Salva la scheda" class="btn btn-primary">
                        <span id="testo-btn-submit" data-i18n="btn_save_record">Salva scheda</span>
                        <kbd class="kbd" aria-hidden="true">Ctrl S</kbd>
                    </button>
                </div>
            </div>
            `;
            mainElement.insertAdjacentHTML('beforeend', html);
        }
    });
})();
