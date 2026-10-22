(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('new-type-modal')) {
            const html = `
    <div id="new-type-modal" class="modal-overlay hidden-tab">
        <div class="modal-window modello-editor">
            <div class="modal-header">
                <div>
                    <h3 class="modal-title" data-i18n="modal_create_type">Nuovo modello</h3>
                    <p class="modal-sottotitolo" data-i18n="type_modal_sub">I campi del modello compaiono, in quest'ordine, in ogni scheda che lo usa.</p>
                </div>
                <button type="button" data-on-click="chiudiNewTypeModal" class="btn btn-ghost btn-icon" data-i18n-aria-label="btn_close" aria-label="Chiudi"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div id="custom-type-container" class="modello-corpo">
                <div class="modello-sinistra">
                    <div class="modello-testa">
                        <div>
                            <label class="form-label" for="custom-type-name" data-i18n="label_type_name">Nome del modello</label>
                            <input type="text" id="custom-type-name" data-i18n-placeholder="label_type_name" class="form-input">
                        </div>
                        <div>
                            <label class="form-label" for="new-type-select" data-i18n="label_select_model">Parti da</label>
                            <select id="new-type-select" data-on-change="applicaModello" class="form-input">
                                <option value="custom" data-i18n="model_custom">Nuovo documento vuoto</option>
                                <option value="imbreviature" data-i18n="model_imbreviature">Modello: Imbreviature notarili</option>
                                <option value="atti" data-i18n="model_atti">Modello: Atti giudiziari</option>
                                <option value="fiscali" data-i18n="model_fiscali">Modello: Documenti fiscali</option>
                            </select>
                        </div>
                        <p id="type-locked-note" class="hidden modello-nota" data-i18n="type_locked_note">Questo è un modello predefinito: nome e campi d'origine non si cambiano, perché tornerebbero da soli al prossimo avvio. Puoi però aggiungere campi tuoi, modificarli ed eliminarli.</p>
                    </div>
                    <div class="modello-campi-testa">
                        <h4 id="modello-campi-titolo" class="modello-sez"><span data-i18n="label_selected_fields">Campi</span> · <span id="modello-campi-conto" class="font-mono">0</span></h4>
                        <span class="modello-suggerimento" data-i18n="type_fields_hint">Trascina o usa le frecce</span>
                    </div>
                    <div id="custom-fields-list" class="modello-campi" role="list" aria-labelledby="modello-campi-titolo">
                        <span class="modello-suggerimento" id="empty-fields-placeholder" data-i18n="placeholder_empty_fields">Aggiungi un campo qui sotto o scegline uno comune.</span>
                    </div>
                    <div class="modello-aggiungi">
                        <label class="form-label" for="custom-type-extra-input" data-i18n="label_custom_fields">Aggiungi un campo</label>
                        <div class="flex gap-2">
                            <input type="text" id="custom-type-extra-input" data-i18n-placeholder="placeholder_custom_field" class="form-input flex-1" data-on-keydown="suInvio" data-args-keydown="[&quot;aggiungiCampoCustom&quot;,true]">
                            <button type="button" data-on-click="aggiungiCampoCustom" class="btn btn-secondary" data-i18n="btn_add">Aggiungi</button>
                        </div>
                        <div class="modello-comuni">
                            <span data-i18n="label_base_fields">Campi comuni:</span>
                            <label class="modello-comune"><input type="checkbox" value="dataCronica" data-label="Data cronica" data-on-change="toggleCampoBase" data-args-change="[{&quot;$&quot;:&quot;this&quot;}]" class="custom-type-field sr-only"><span data-i18n="field_data_cronica">Data cronica</span></label>
                            <label class="modello-comune"><input type="checkbox" value="dataTopica" data-label="Data topica" data-on-change="toggleCampoBase" data-args-change="[{&quot;$&quot;:&quot;this&quot;}]" class="custom-type-field sr-only"><span data-i18n="field_data_topica">Data topica</span></label>
                            <label class="modello-comune"><input type="checkbox" value="autore" data-label="Autore/i" data-on-change="toggleCampoBase" data-args-change="[{&quot;$&quot;:&quot;this&quot;}]" class="custom-type-field sr-only"><span data-i18n="field_autore">Autore/i</span></label>
                            <label class="modello-comune"><input type="checkbox" value="titolo" data-label="Titolo / Cont." data-on-change="toggleCampoBase" data-args-change="[{&quot;$&quot;:&quot;this&quot;}]" class="custom-type-field sr-only"><span data-i18n="field_titolo">Titolo / Cont.</span></label>
                            <label class="modello-comune"><input type="checkbox" value="note" data-label="Note" data-on-change="toggleCampoBase" data-args-change="[{&quot;$&quot;:&quot;this&quot;}]" class="custom-type-field sr-only"><span data-i18n="field_note">Note</span></label>
                            <label class="modello-comune"><input type="checkbox" value="prezzo" data-label="Prezzo" data-on-change="toggleCampoBase" data-args-change="[{&quot;$&quot;:&quot;this&quot;}]" class="custom-type-field sr-only"><span data-i18n="field_prezzo">Prezzo</span></label>
                        </div>
                    </div>
                </div>

                <div class="modello-destra">
                    <div id="campo-editor" class="hidden campo-editor-box">
                        <div class="campo-editor-testa">
                            <h4 id="campo-editor-nome" class="campo-editor-titolo"></h4>
                            <span id="campo-editor-posizione" class="modello-suggerimento"></span>
                        </div>
                        <div class="campo-editor-corpo">
                            <div>
                                <label class="form-label" for="campo-editor-tipo" data-i18n="label_field_type">Tipo di dato</label>
                                <select id="campo-editor-tipo" class="form-input" data-on-change="aggiornaEditorCampo"></select>
                            </div>
                            <div class="campo-editor-coppia">
                                <div id="campo-editor-vocabolario-riga" class="hidden">
                                    <label class="form-label" for="campo-editor-vocabolario" data-i18n="label_field_vocab">Prendi i valori da un vocabolario d'archivio</label>
                                    <select id="campo-editor-vocabolario" class="form-input" data-on-change="aggiornaEditorCampo"></select>
                                    <button type="button" data-on-click="apriVocabolari" class="btn-collegamento" data-i18n="type_manage_vocab">Gestisci vocabolari d'archivio</button>
                                </div>
                                <div id="campo-editor-authority-riga" class="hidden">
                                    <label class="form-label" for="campo-editor-authority" data-i18n="label_field_authority">Alimenta l'anagrafica di</label>
                                    <select id="campo-editor-authority" class="form-input"></select>
                                </div>
                            </div>
                            <div id="campo-editor-opzioni-riga" class="hidden">
                                <label class="form-label" for="campo-editor-opzioni" data-i18n="label_field_options">Valori ammessi (uno per riga)</label>
                                <textarea id="campo-editor-opzioni" rows="4" class="form-input" data-on-input="aggiornaEditorCampo" data-i18n-placeholder="placeholder_field_options" placeholder="pergamena&#10;carta"></textarea>
                            </div>
                            <label class="campo-editor-scelta">
                                <input type="checkbox" id="campo-editor-obbligatorio">
                                <span data-i18n="label_field_required">Obbligatorio: la scheda non si salva se è vuoto</span>
                            </label>
                            <label id="campo-editor-unico-riga" class="campo-editor-scelta">
                                <input type="checkbox" id="campo-editor-unico">
                                <span data-i18n="label_field_unique">Valore unico: avvisa se un'altra scheda ha lo stesso valore</span>
                            </label>
                            <div class="campo-editor-anteprima" aria-hidden="true" inert>
                                <div class="modello-sez" data-i18n="type_preview">Come appare nella scheda</div>
                                <div class="campo-editor-anteprima-riga">
                                    <span id="campo-anteprima-etichetta"></span>
                                    <span id="campo-anteprima-controllo"></span>
                                </div>
                            </div>
                        </div>
                        <div class="campo-editor-azioni">
                            <button type="button" data-on-click="chiudiEditorCampo" class="btn btn-secondary text-sm" data-i18n="btn_cancel">Annulla</button>
                            <button type="button" data-on-click="confermaEditorCampo" class="btn btn-primary text-sm" id="btn-campo-editor-ok" data-i18n="btn_apply">Applica</button>
                        </div>
                    </div>
                    <p id="campo-editor-vuoto" class="modello-suggerimento" data-i18n="type_config_empty">Scegli un campo dall'elenco per configurarne tipo, valori e regole. I campi comuni e quelli dei modelli predefiniti hanno già la loro configurazione.</p>
                </div>
            </div>

            <div class="modal-footer modal-footer-bar">
                <button type="button" data-on-click="apriManageTypesModal" class="btn btn-ghost" data-i18n="btn_manage_models">Gestisci modelli</button>
                <span id="type-used-by" class="modello-suggerimento hidden"></span>
                <span class="flex-1"></span>
                <button type="button" data-on-click="chiudiNewTypeModal" class="btn btn-secondary" data-i18n="btn_cancel">Annulla</button>
                <button type="button" data-on-click="confermaCreaTipo" class="btn btn-primary" id="btn-salva-tipo" data-i18n="btn_create">Crea</button>
            </div>
        </div>
    </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
        }
    });
})();
