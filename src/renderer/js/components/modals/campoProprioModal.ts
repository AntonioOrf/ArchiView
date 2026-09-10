// @ts-nocheck

// Fase 3.7 — il campo che vive su UNA scheda sola. Il modello documento resta una base:
// qui si dichiara ciò che quel manoscritto ha e gli altri no (una nota di possesso, una
// filigrana, un colophon anomalo), senza far comparire una colonna vuota su tutto l'archivio.
//
// È un modale e non un pannello inline come l'editor dei campi del tipo (3.1) perché qui non
// si sta componendo un elenco: si dichiara un campo alla volta, mentre si compila la scheda,
// e il form sotto deve restare visibile solo dopo la conferma.
//
// ⚠️ Niente `obbligatorio` e niente `unico`: "obbligatorio" bloccherebbe il salvataggio della
// sola scheda che lo dichiara — cioè non vieta niente a nessuno — e l'unicità cerca duplicati
// su un campo che per definizione esiste una volta sola.
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('campo-proprio-modal')) return;
        const html = `
    <div id="campo-proprio-modal" class="modal-overlay hidden-tab">
        <div class="modal-window max-w-md">
            <div class="modal-header">
                <h3 class="modal-title" data-i18n="own_field_title">Aggiungi un campo a questa scheda</h3>
            </div>
            <div class="modal-body space-y-4">
                <p class="text-xs text-stone-500" data-i18n="own_field_hint">Il campo resta su questa scheda: il modello e le altre schede non cambiano.</p>
                <div>
                    <label class="form-label" for="campo-proprio-nome" data-i18n="own_field_name">Nome del campo</label>
                    <input type="text" id="campo-proprio-nome" class="form-input" list="campo-proprio-suggerimenti" data-i18n-placeholder="own_field_name_ph" placeholder="Filigrana" onkeydown="if(event.key === 'Enter') { event.preventDefault(); confermaCampoProprio(); }">
                    <datalist id="campo-proprio-suggerimenti"></datalist>
                </div>
                <div>
                    <label class="form-label" for="campo-proprio-tipo" data-i18n="label_field_type">Tipo di dato</label>
                    <select id="campo-proprio-tipo" class="form-input" onchange="aggiornaCampoProprio()"></select>
                </div>
                <div id="campo-proprio-vocabolario-riga" class="hidden">
                    <label class="form-label" for="campo-proprio-vocabolario" data-i18n="label_field_vocab">Prendi i valori da un vocabolario d'archivio</label>
                    <select id="campo-proprio-vocabolario" class="form-input" onchange="aggiornaCampoProprio()"></select>
                </div>
                <div id="campo-proprio-opzioni-riga" class="hidden">
                    <label class="form-label" for="campo-proprio-opzioni" data-i18n="label_field_options">Valori ammessi (uno per riga)</label>
                    <textarea id="campo-proprio-opzioni" rows="4" class="form-input" placeholder="pergamena&#10;carta"></textarea>
                </div>
                <div id="campo-proprio-authority-riga" class="hidden">
                    <label class="form-label" for="campo-proprio-authority" data-i18n="label_field_authority">Alimenta l'anagrafica di</label>
                    <select id="campo-proprio-authority" class="form-input"></select>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="chiudiCampoProprioModal()" class="btn btn-ghost" data-i18n="btn_cancel">Annulla</button>
                    <button type="button" onclick="confermaCampoProprio()" class="btn btn-primary" data-i18n="btn_add">Aggiungi</button>
                </div>
            </div>
        </div>
    </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.applicaTraduzioniHtml) window.applicaTraduzioniHtml();
    });
})();
