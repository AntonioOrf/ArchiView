// @ts-nocheck
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../../locales/en/messages.js";
import { messages as itMessages } from "../../locales/it/messages.js";

i18n.load({
  en: enMessages,
  it: itMessages
});

window.linguaAttuale = localStorage.getItem('archiview_lang') || 'it';
i18n.activate(window.linguaAttuale);

function _linguiExtraction() {
    i18n._({ id: "welcome_title", message: "Benvenuto in ArchiView" });
    i18n._({ id: "welcome_desc", message: "Per iniziare, è necessario creare o selezionare una <strong>Cartella di lavoro</strong>.<br><br>In questa cartella verranno salvati in automatico tutti i dati (il database) e gli allegati (come i PDF e le foto). Ti consigliamo di creare una cartella dedicata (ad esempio in \"Documenti\") per tenere tutto in ordine e al sicuro." });
    i18n._({ id: "btn_choose_folder", message: "Scegli o crea cartella" });
    i18n._({ id: "modal_new_folder", message: "Nuova Cartella" });
    i18n._({ id: "label_folder_name", message: "Nome della cartella o percorso" });
    i18n._({ id: "hint_folder_name", message: "Consiglio: usa la barra ( / ) per creare automaticamente sottocartelle." });
    i18n._({ id: "btn_cancel", message: "Annulla" });
    i18n._({ id: "btn_create_folder", message: "Crea Cartella" });
    i18n._({ id: "btn_new_model", message: "Modello" });
    i18n._({ id: "modal_create_type", message: "Crea Tipo Documento" });
    i18n._({ id: "label_select_model", message: "Seleziona modello o creane uno nuovo" });
    i18n._({ id: "model_custom", message: "Nuovo documento vuoto" });
    i18n._({ id: "model_imbreviature", message: "Modello: Imbreviature notarili" });
    i18n._({ id: "model_atti", message: "Modello: Atti giudiziari" });
    i18n._({ id: "model_fiscali", message: "Modello: Documenti fiscali" });
    i18n._({ id: "label_type_name", message: "Nome del nuovo tipo" });
    i18n._({ id: "label_base_fields", message: "Campi di base" });
    i18n._({ id: "field_data_cronica", message: "Data cronica" });
    i18n._({ id: "field_data_topica", message: "Data topica" });
    i18n._({ id: "field_autore", message: "Autore/i" });
    i18n._({ id: "field_titolo", message: "Titolo / Cont." });
    i18n._({ id: "field_note", message: "Note" });
    i18n._({ id: "field_prezzo", message: "Prezzo" });
    i18n._({ id: "label_custom_fields", message: "Campi aggiuntivi personalizzati" });
    i18n._({ id: "label_selected_fields", message: "Campi selezionati (trascina per riordinare)" });
    i18n._({ id: "placeholder_empty_fields", message: "Seleziona o aggiungi dei campi..." });
    i18n._({ id: "btn_manage_models", message: "Gestisci Modelli" });
    i18n._({ id: "btn_create", message: "Crea" });
    i18n._({ id: "modal_manage_models", message: "Gestisci Modelli" });
    i18n._({ id: "btn_close", message: "Chiudi" });
    i18n._({ id: "modal_confirm_delete", message: "Conferma Eliminazione" });
    i18n._({ id: "delete_item_prompt", message: "Sei sicuro di voler eliminare questa scheda?" });
    i18n._({ id: "delete_item_hint", message: "L'eventuale allegato (immagine o PDF) non verrà rimosso dall'archivio." });
    i18n._({ id: "btn_delete", message: "Elimina" });
    i18n._({ id: "modal_unsaved_changes", message: "Modifiche non salvate" });
    i18n._({ id: "unsaved_prompt", message: "Ci sono modifiche non salvate in questa trascrizione." });
    i18n._({ id: "unsaved_hint", message: "Sei sicuro di voler uscire e perdere le modifiche?" });
    i18n._({ id: "btn_continue_writing", message: "Continua a scrivere" });
    i18n._({ id: "btn_exit_without_saving", message: "Esci senza salvare" });
    i18n._({ id: "modal_rename", message: "Rinomina Allegato" });
    i18n._({ id: "label_new_filename", message: "Nuovo nome del file" });
    i18n._({ id: "btn_save", message: "Salva" });
    i18n._({ id: "modal_settings", message: "Impostazioni" });
    i18n._({ id: "settings_workspace", message: "Cartella di Lavoro (Archivio)" });
    i18n._({ id: "settings_workspace_desc", message: "Questa cartella contiene il tuo database e tutti gli allegati copiati." });
    i18n._({ id: "btn_change_folder", message: "Cambia Cartella..." });
    i18n._({ id: "settings_workspace_restart", message: "L'app verrà riavviata se cambi la cartella." });
    i18n._({ id: "settings_backup", message: "Backup Dati" });
    i18n._({ id: "settings_backup_desc", message: "Crea un file compresso contenente l'intero archivio e tutti gli allegati." });
    i18n._({ id: "btn_export_zip", message: "Esporta Backup in ZIP" });
    i18n._({ id: "settings_updates", message: "Aggiornamenti" });
    i18n._({ id: "settings_updates_desc", message: "Controlla se è disponibile una nuova versione del programma su GitHub." });
    i18n._({ id: "btn_check_updates", message: "Controlla Aggiornamenti" });
    i18n._({ id: "update_available", message: "È disponibile un nuovo aggiornamento!" });
    i18n._({ id: "btn_download_github", message: "Scarica da GitHub" });
    i18n._({ id: "modal_confirm_action", message: "Conferma Azione" });
    i18n._({ id: "confirm_prompt_default", message: "Sei sicuro?" });
    i18n._({ id: "dont_ask_again", message: "Non chiederlo più" });
    i18n._({ id: "btn_yes_proceed", message: "Sì, procedi" });
    i18n._({ id: "title_structure", message: "Struttura" });
    i18n._({ id: "title_search", message: "Ricerca Globale" });
    i18n._({ id: "title_suggestions", message: "SUGGERIMENTI" });
    i18n._({ id: "title_tags", message: "Filtro Tag" });
    i18n._({ id: "btn_clear_tags", message: "Rimuovi filtri tag" });
    i18n._({ id: "title_available_tags", message: "TAG DISPONIBILI" });
    i18n._({ id: "folder_empty", message: "La cartella è vuota." });
    i18n._({ id: "btn_delete_folder", message: "Elimina questa cartella" });
    i18n._({ id: "title_new_record", message: "Compila Nuova Scheda" });
    i18n._({ id: "btn_cancel_edit", message: "Annulla modifica" });
    i18n._({ id: "label_folder", message: "Cartella:" });
    i18n._({ id: "label_doc_type", message: "Tipo Documento:" });
    i18n._({ id: "label_identifier", message: "Identificativo / Segnatura *" });
    i18n._({ id: "label_attachments", message: "Allega Documenti (Foto o PDF)" });
    i18n._({ id: "label_tags", message: "Tags (separati da virgola)" });
    i18n._({ id: "btn_save_record", message: "Salva Scheda" });
    i18n._({ id: "title_transcription", message: "Trascrizione" });
    i18n._({ id: "btn_save_transcription", message: "Salva Trascrizione" });
    i18n._({ id: "btn_add_image_pdf", message: "Aggiungi Immagine/PDF" });
    i18n._({ id: "no_attachment", message: "Nessun allegato disponibile per questa scheda." });
    i18n._({ id: "tooltip_sidebar", message: "Mostra/Nascondi Struttura" });
    i18n._({ id: "tooltip_folders", message: "Apri Cartelle" });
    i18n._({ id: "tooltip_search_btn", message: "Ricerca" });
    i18n._({ id: "tooltip_tags_btn", message: "Filtra per Tag" });
    i18n._({ id: "tooltip_new_record", message: "Nuova Scheda" });
    i18n._({ id: "tooltip_new_type", message: "Nuovo Tipo Documento" });
    i18n._({ id: "tooltip_bold", message: "Grassetto" });
    i18n._({ id: "tooltip_italic", message: "Corsivo" });
    i18n._({ id: "tooltip_underline", message: "Sottolineato" });
    i18n._({ id: "tooltip_ul", message: "Elenco puntato" });
    i18n._({ id: "tooltip_ol", message: "Elenco numerato" });
    i18n._({ id: "tooltip_collapse", message: "Collassa Editor" });
    i18n._({ id: "tooltip_prev", message: "Precedente (Alt + Freccia Sinistra)" });
    i18n._({ id: "tooltip_next", message: "Successivo (Alt + Freccia Destra)" });
    i18n._({ id: "placeholder_custom_field", message: "Es. Supporto, Filigrana..." });
    i18n._({ id: "placeholder_search", message: "Cerca in tutte le schede..." });
    i18n._({ id: "placeholder_tags", message: "Seleziona tag..." });
    i18n._({ id: "placeholder_identifier", message: "Es. Plut. 40.1 o Atto 12" });
    i18n._({ id: "placeholder_tags_input", message: "es. miniatura, secolo XII, pergamenaceo" });
    i18n._({ id: "settings_theme", message: "Tema / Aspetto" });
    i18n._({ id: "settings_theme_desc", message: "Scegli il tema dell'applicazione." });
    i18n._({ id: "theme_system", message: "Sistema (Predefinito)" });
    i18n._({ id: "theme_light", message: "Chiaro" });
    i18n._({ id: "theme_dark", message: "Scuro (Flat Obsidian)" });
    i18n._({ id: "settings_lang", message: "Lingua / Language" });
    i18n._({ id: "settings_lang_desc", message: "Scegli la lingua dell'applicazione." });

    // === CHIAVI DINAMICHE DA TYPESCRIPT ===
    i18n._({ id: "btn_edit", message: "Modifica" });
    i18n._({ id: "btn_transcribe", message: "Trascrivi" });
    i18n._({ id: "btn_add_dynamic", message: "Aggiungi" });
    i18n._({ id: "drag_to_root", message: "Sposta alla radice" });
    i18n._({ id: "no_search_match", message: "Nessun match trovato nel database." });
    
    // CONFIG_CAMPI
    i18n._({ id: "field_dataCronica", message: "Data Cronica" });
    i18n._({ id: "field_dataTopica", message: "Data Topica" });
    i18n._({ id: "field_Marginalia", message: "Marginalia" });
    i18n._({ id: "field_Notaio", message: "Notaio" });
    i18n._({ id: "field_tipo_di_atto", message: "Tipo di Atto" });
    i18n._({ id: "field_oggetto", message: "Oggetto" });
    i18n._({ id: "field_elementi_economici", message: "Elementi Economici" });
    i18n._({ id: "field_magistratura", message: "Magistratura" });
    i18n._({ id: "field_tipo_di_atto_giur", message: "Tipo di Atto" });
    i18n._({ id: "field_motivazione_processo", message: "Motivazione del Processo" });
    i18n._({ id: "field_condanne", message: "Condanne" });
    i18n._({ id: "field_attori_dinamici", message: "Persone / Attori" });
    i18n._({ id: "field_dichiarante", message: "Dichiarante" });
    i18n._({ id: "field_beni_dinamici", message: "Beni (Proprietà)" });
    i18n._({ id: "field_debiti_dinamici", message: "Debiti" });
    i18n._({ id: "field_crediti_dinamici", message: "Crediti" });
    i18n._({ id: "field_famiglia_dinamici", message: "Familiari" });

    // PLACEHOLDERS
    i18n._({ id: "placeholder_dataCronica", message: "Es. 12 Maggio 1340" });
    i18n._({ id: "placeholder_dataTopica", message: "Es. Firenze" });
    i18n._({ id: "placeholder_autore", message: "Es. Anonimo / Notaio" });
    i18n._({ id: "placeholder_titolo", message: "Titolo o descrizione sintetica" });
    i18n._({ id: "placeholder_note", message: "Note testuali o codicologiche" });
    i18n._({ id: "placeholder_prezzo", message: "Es. 12 fiorini" });
    i18n._({ id: "placeholder_Marginalia", message: "Note marginali..." });
    i18n._({ id: "placeholder_Notaio", message: "Nome del notaio" });
    i18n._({ id: "placeholder_tipo_di_atto", message: "Es. matrimonio, vendita, testamento..." });
    i18n._({ id: "placeholder_oggetto", message: "Oggetto del documento" });
    i18n._({ id: "placeholder_elementi_economici", message: "Dettagli economici..." });
    i18n._({ id: "placeholder_magistratura", message: "Es. Podestà, Capitano del Popolo..." });
    i18n._({ id: "placeholder_tipo_di_atto_giur", message: "Es. accusa, inquisitione, testimoni, altro" });
    i18n._({ id: "placeholder_motivazione_processo", message: "Causa e ragioni del processo..." });
    i18n._({ id: "placeholder_condanne", message: "Eventuali condanne, assoluzioni o pene..." });
    i18n._({ id: "placeholder_dichiarante", message: "Es. famiglia, istituzione..." });

    i18n._({ id: "placeholder_key_attori_dinamici", message: "Ruolo (es. Venditore)" });
    i18n._({ id: "placeholder_val_attori_dinamici", message: "Nome della persona" });
    i18n._({ id: "placeholder_key_beni_dinamici", message: "Bene (es. Casa, Terreno)" });
    i18n._({ id: "placeholder_val_beni_dinamici", message: "Valore (es. 10 fiorini)" });
    i18n._({ id: "placeholder_key_debiti_dinamici", message: "Creditore / Motivo" });
    i18n._({ id: "placeholder_val_debiti_dinamici", message: "Ammontare" });
    i18n._({ id: "placeholder_key_crediti_dinamici", message: "Debitore / Motivo" });
    i18n._({ id: "placeholder_val_crediti_dinamici", message: "Ammontare" });
    i18n._({ id: "placeholder_key_famiglia_dinamici", message: "Parentela (es. Figlio, Moglie)" });
    i18n._({ id: "placeholder_val_famiglia_dinamici", message: "Nome" });
}

// Wrapper per compatibilità con il codice esistente
window.t = function(key, fallback) {
    const res = i18n._({ id: key });
    if (res === key && fallback) return fallback;
    return res;
}

// Funzione globale per cambiare lingua
window.cambiaLingua = function(lang) {
    window.linguaAttuale = lang;
    localStorage.setItem('archiview_lang', lang);
    i18n.activate(lang);
    window.applicaTraduzioniHtml();
    
    // Rendi nuovamente l'interfaccia principale per applicare i cambiamenti
    if (typeof renderMain === 'function') renderMain();
    if (typeof renderSidebar === 'function') renderSidebar();
}

window.applicaTraduzioniHtml = function() {
    // Sostituisce il testo (innerHTML)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerHTML = window.t(key);
    });

    // Sostituisce il title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = window.t(key);
    });

    // Sostituisce il placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = window.t(key);
    });
}

// Applica le traduzioni all'avvio
document.addEventListener('DOMContentLoaded', () => {
    window.applicaTraduzioniHtml();
});
