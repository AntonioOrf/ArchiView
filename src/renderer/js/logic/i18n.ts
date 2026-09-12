// @ts-nocheck
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../../locales/en/messages.js";
import { messages as itMessages } from "../../locales/it/messages.js";

i18n.load({
  en: enMessages,
  it: itMessages
});

// Attiva un locale di default subito per evitare errori Lingui
// prima che initLang() venga chiamato dall'app
i18n.activate('it');
window.linguaAttuale = 'it';

window.initLang = async function() {
    const settings = await window.apiSettings.get();
    window.linguaAttuale = settings.lang || 'it';
    i18n.activate(window.linguaAttuale);
    document.documentElement.lang = window.linguaAttuale;
    window.applicaTraduzioniHtml();
};

function _linguiExtraction() {
    i18n._({ id: "welcome_title", message: "Benvenuto in ArchiView" });
    i18n._({ id: "welcome_desc", message: "Per iniziare, è necessario creare o selezionare un <strong>Archivio di lavoro</strong>.<br><br>In questo archivio verranno salvati in automatico tutti i dati (il database) e gli allegati (come i PDF e le foto). Ti consigliamo di creare un archivio dedicato (ad esempio in \"Documenti\") per tenere tutto in ordine e al sicuro." });
    i18n._({ id: "btn_choose_folder", message: "Scegli o crea archivio" });
    i18n._({ id: "modal_new_folder", message: "Nuova cartella" });
    i18n._({ id: "label_folder_name", message: "Nome della cartella o percorso" });
    i18n._({ id: "hint_folder_name", message: "Consiglio: usa la barra ( / ) per creare automaticamente delle sottocartelle." });
    i18n._({ id: "btn_prev", message: "Precedente" });
    i18n._({ id: "btn_next", message: "Successiva" });
    i18n._({ id: "btn_cancel", message: "Annulla" });
    i18n._({ id: "btn_create_folder", message: "Crea cartella" });
    i18n._({ id: "btn_new_model", message: "Nuovo modello" });
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
    // Fase 1.1 — ordinamento e vista tabellare
    i18n._({ id: "field_segnatura", message: "Segnatura" });
    i18n._({ id: "label_sort_by", message: "Ordina per" });
    i18n._({ id: "tooltip_sort_by", message: "Criterio di ordinamento dell'elenco" });
    i18n._({ id: "tooltip_sort_dir", message: "Inverti la direzione dell'ordinamento" });
    i18n._({ id: "tooltip_sort_asc", message: "Ordine crescente: clicca per invertire" });
    i18n._({ id: "tooltip_sort_desc", message: "Ordine decrescente: clicca per invertire" });
    i18n._({ id: "tooltip_toggle_view", message: "Cambia modalità di visualizzazione" });
    i18n._({ id: "tooltip_view_grid", message: "Passa alla vista a schede" });
    i18n._({ id: "tooltip_view_table", message: "Passa alla vista tabella" });
    i18n._({ id: "th_tags", message: "Tag" });
    i18n._({ id: "th_attachments", message: "Allegati" });
    i18n._({ id: "th_modified", message: "Modificato" });
    i18n._({ id: "tooltip_columns", message: "Scegli le colonne visibili" });
    i18n._({ id: "menu_columns", message: "Colonne visibili" });
    // Fase 1 — passi del tutorial su ordinamento, filtri, comandi rapidi e visualizzatore
    i18n._({ id: "tut_sort_title", message: "Ordinamento e Vista Tabellare" });
    i18n._({ id: "tut_sort_desc", message: "L’elenco può essere ordinato per segnatura, per un campo del tipo di documento, per data di modifica o per numero di allegati. Questo comando alterna la griglia di schede alla vista tabellare, dove ogni intestazione di colonna è essa stessa un comando di ordinamento e le colonne visibili sono configurabili per tipo di documento." });
    i18n._({ id: "tut_filters_title", message: "Filtri Avanzati e Ricerche Salvate" });
    i18n._({ id: "tut_filters_desc", message: "Oltre alla ricerca testuale è possibile restringere l’elenco per tipo di documento, sottocartelle, intervallo di data di modifica, presenza di allegati o di trascrizione. Nel campo di ricerca è ammessa inoltre la sintassi campo:valore (per esempio notaio:rossi). Una combinazione di filtri può essere salvata con un nome e richiamata in seguito." });
    i18n._({ id: "tut_palette_title", message: "Comandi Rapidi" });
    i18n._({ id: "tut_palette_desc", message: "La combinazione Ctrl+K apre l’elenco dei comandi: da un unico campo si raggiunge una scheda, una cartella, una nuova scheda di un tipo specifico o qualsiasi altra azione dell’applicazione. Il tasto ? mostra l’elenco completo delle scorciatoie disponibili. Entrambi sono richiamabili anche da questo menu." });
    i18n._({ id: "tut_viewer_title", message: "Analisi dell’Immagine" });
    i18n._({ id: "tut_viewer_desc", message: "L’anteprima dell’allegato dispone di ingrandimento (rotella del mouse o tasti + e −), trascinamento, rotazione a 90° (tasto R) e adattamento alla pagina o alla larghezza. I comandi di luminosità, contrasto e negativo sono destinati alla lettura di scritture di difficile decifrazione. Con Alt+← e Alt+→ si scorrono gli allegati della scheda." });
    // Fase 1.4 — command palette e scorciatoie
    i18n._({ id: "cp_title", message: "Comandi" });
    i18n._({ id: "cp_placeholder", message: "Cerca un comando, una scheda o una cartella…" });
    i18n._({ id: "cp_empty", message: "Nessun comando corrisponde." });
    i18n._({ id: "cp_error", message: "Comando non riuscito." });
    i18n._({ id: "cp_group_actions", message: "Azioni" });
    i18n._({ id: "cp_group_records", message: "Vai alla scheda" });
    i18n._({ id: "cp_group_folders", message: "Vai alla cartella" });
    i18n._({ id: "cp_search", message: "Cerca nell’archivio" });
    i18n._({ id: "cp_view_grid", message: "Passa alla vista a schede" });
    i18n._({ id: "cp_view_table", message: "Passa alla vista a tabella" });
    i18n._({ id: "cp_changelog", message: "Novità di questa versione" });
    i18n._({ id: "cp_shortcuts", message: "Scorciatoie da tastiera" });
    i18n._({ id: "cp_hint_move", message: "scorri" });
    i18n._({ id: "cp_hint_run", message: "esegui" });
    i18n._({ id: "cp_hint_close", message: "chiudi" });
    i18n._({ id: "untitled_record", message: "Senza titolo" });
    i18n._({ id: "shortcut_group_general", message: "Generali" });
    i18n._({ id: "shortcut_group_selection", message: "Selezione" });
    i18n._({ id: "shortcut_group_transcription", message: "Trascrizione" });
    i18n._({ id: "shortcut_group_viewer", message: "Visualizzatore immagini" });
    i18n._({ id: "shortcut_palette", message: "Apri i comandi" });
    i18n._({ id: "shortcut_help", message: "Mostra questo elenco" });
    i18n._({ id: "shortcut_search", message: "Vai alla ricerca" });
    i18n._({ id: "shortcut_new", message: "Nuova scheda" });
    i18n._({ id: "shortcut_save", message: "Salva la scheda o la trascrizione aperta" });
    i18n._({ id: "shortcut_undo", message: "Annulla l’ultima azione" });
    i18n._({ id: "shortcut_esc", message: "Chiudi la finestra in primo piano, svuota la ricerca o azzera la selezione" });
    i18n._({ id: "shortcut_multi", message: "Aggiungi o togli una scheda dalla selezione" });
    i18n._({ id: "shortcut_range", message: "Seleziona l’intervallo fino alla scheda cliccata" });
    i18n._({ id: "shortcut_menu", message: "Menu delle azioni sulla scheda o sulla cartella" });
    i18n._({ id: "shortcut_prev_att", message: "Allegato precedente" });
    i18n._({ id: "shortcut_next_att", message: "Allegato successivo" });
    i18n._({ id: "shortcut_fullscreen", message: "Allegato a schermo intero" });
    i18n._({ id: "shortcut_zoom", message: "Ingrandisci o riduci" });
    i18n._({ id: "shortcut_fit", message: "Adatta alla pagina" });
    i18n._({ id: "shortcut_real", message: "Dimensione reale (1:1)" });
    i18n._({ id: "shortcut_rotate", message: "Ruota di 90° (con Maiusc: in senso opposto)" });
    i18n._({ id: "shortcut_pan", message: "Sposta l’immagine" });
    // Fase 1.5 — azioni in massa, selezione totale e relative scorciatoie
    i18n._({ id: "tut_bulk_title", message: "Azioni su più schede" });
    i18n._({ id: "tut_bulk_desc", message: "Con Ctrl+clic e Maiusc+clic si selezionano più schede, e Ctrl+A prende tutti i risultati del filtro corrente, comprese le pagine successive. Il menu del tasto destro applica allora l’azione all’intera selezione: spostamento in una cartella, cambio di tipo di documento, aggiunta o rimozione di tag e sostituzione di testo in un campo, con anteprima del numero di schede interessate e possibilità di annullare." });
    i18n._({ id: "bulk_move_title", message: "Sposta in una cartella" });
    i18n._({ id: "bulk_type_title", message: "Cambia tipo di documento" });
    i18n._({ id: "bulk_type_hint", message: "I valori dei campi che il nuovo tipo non prevede restano salvati nella scheda, ma non saranno più visibili nel form finché non si torna al tipo precedente." });
    i18n._({ id: "bulk_tag_title", message: "Aggiungi o rimuovi tag" });
    i18n._({ id: "bulk_tag_add", message: "Aggiungi" });
    i18n._({ id: "bulk_tag_remove", message: "Rimuovi" });
    i18n._({ id: "bulk_tag_ph", message: "Es. pergamena, notarile" });
    i18n._({ id: "bulk_tag_hint", message: "Più tag si separano con la virgola. La rimozione richiede la corrispondenza esatta del tag." });
    i18n._({ id: "bulk_replace_title", message: "Trova e sostituisci" });
    i18n._({ id: "bulk_label_folder", message: "Cartella di destinazione" });
    i18n._({ id: "bulk_label_type", message: "Nuovo tipo" });
    i18n._({ id: "bulk_label_action", message: "Operazione" });
    i18n._({ id: "bulk_label_tags", message: "Tag" });
    i18n._({ id: "bulk_label_field", message: "Campo" });
    i18n._({ id: "bulk_label_find", message: "Trova" });
    i18n._({ id: "bulk_label_replace", message: "Sostituisci con" });
    i18n._({ id: "bulk_field_signature", message: "Segnatura" });
    i18n._({ id: "bulk_field_tags", message: "Tag" });
    i18n._({ id: "bulk_case", message: "Distingui maiuscole" });
    i18n._({ id: "bulk_whole", message: "Solo parole intere" });
    i18n._({ id: "bulk_preview", message: "{var0} schede, {var1} occorrenze." });
    i18n._({ id: "bulk_preview_empty", message: "Scrivi il testo da cercare per vedere quante schede sarebbero modificate." });
    i18n._({ id: "btn_apply", message: "Applica" });
    i18n._({ id: "menu_select_all", message: "Seleziona tutti i risultati" });
    i18n._({ id: "menu_bulk_on", message: "Su {var0} schede" });
    i18n._({ id: "menu_bulk_on_one", message: "Su questa scheda" });
    i18n._({ id: "cp_group_selection", message: "Selezione" });
    i18n._({ id: "msg_bulk_no_selection", message: "Seleziona almeno una scheda." });
    i18n._({ id: "msg_bulk_nothing", message: "Nessuna scheda è stata modificata." });
    i18n._({ id: "msg_bulk_done", message: "{var0} schede modificate." });
    i18n._({ id: "msg_bulk_error", message: "Azione non riuscita." });
    i18n._({ id: "msg_bulk_moved", message: "{var0} schede spostate." });
    i18n._({ id: "msg_bulk_type", message: "Tipo cambiato su {var0} schede." });
    i18n._({ id: "msg_bulk_tag_add", message: "Tag aggiunti a {var0} schede." });
    i18n._({ id: "msg_bulk_tag_del", message: "Tag rimossi da {var0} schede." });
    i18n._({ id: "msg_bulk_replaced", message: "Sostituzione applicata a {var0} schede." });
    i18n._({ id: "msg_selected_all", message: "{var0} schede selezionate." });
    i18n._({ id: "undo_bulk_move", message: "Spostamento di schede" });
    i18n._({ id: "undo_bulk_type", message: "Cambio di tipo documento" });
    i18n._({ id: "undo_bulk_tag_add", message: "Aggiunta di tag" });
    i18n._({ id: "undo_bulk_tag_del", message: "Rimozione di tag" });
    i18n._({ id: "undo_bulk_replace", message: "Trova e sostituisci" });
    i18n._({ id: "shortcut_group_bulk", message: "Schede selezionate" });
    i18n._({ id: "shortcut_select_all", message: "Seleziona tutti i risultati, anche nelle pagine successive" });
    i18n._({ id: "shortcut_deselect", message: "Azzera la selezione" });
    i18n._({ id: "shortcut_edit", message: "Modifica la scheda selezionata" });
    i18n._({ id: "shortcut_copy", message: "Copia le schede selezionate" });
    i18n._({ id: "shortcut_cut", message: "Taglia le schede selezionate" });
    i18n._({ id: "shortcut_paste", message: "Incolla nella cartella corrente" });
    i18n._({ id: "shortcut_export_sel", message: "Esporta la selezione in ZIP" });
    i18n._({ id: "shortcut_delete_sel", message: "Elimina le schede selezionate" });
    i18n._({ id: "shortcut_bulk_move", message: "Sposta la selezione in una cartella" });
    i18n._({ id: "shortcut_bulk_type", message: "Cambia il tipo di documento della selezione" });
    i18n._({ id: "shortcut_bulk_tag", message: "Aggiungi o rimuovi tag sulla selezione" });
    i18n._({ id: "shortcut_bulk_replace", message: "Trova e sostituisci in un campo della selezione" });
    // Fase 2.1 — esportazione CSV/TSV
    i18n._({ id: "btn_export_csv", message: "Esporta Cartella in CSV" });
    i18n._({ id: "btn_export_tsv", message: "Esporta Cartella in TSV" });
    i18n._({ id: "menu_export_folder_csv", message: "Esporta cartella in CSV" });
    i18n._({ id: "bulk_export_csv", message: "Esporta selezione in CSV" });
    i18n._({ id: "bulk_export_tsv", message: "Esporta selezione in TSV" });
    i18n._({ id: "dialog_export_csv", message: "Esporta in CSV/TSV" });
    i18n._({ id: "shortcut_export_sel_csv", message: "Esporta la selezione in CSV" });
    i18n._({ id: "col_id", message: "ID" });
    i18n._({ id: "col_type", message: "Tipo documento" });
    i18n._({ id: "col_modified_by", message: "Modificato da" });
    i18n._({ id: "col_created_by", message: "Creato da" });
    // Fase 1.3 — filtri avanzati e ricerche salvate
    i18n._({ id: "btn_filters", message: "Filtri" });
    i18n._({ id: "tooltip_filters", message: "Filtri avanzati e ricerche salvate" });
    i18n._({ id: "tooltip_filters_active", message: "Filtri avanzati ({var0} attivi)" });
    i18n._({ id: "filter_type", message: "Tipo" });
    i18n._({ id: "filter_subfolders", message: "Includi sottocartelle" });
    i18n._({ id: "filter_from", message: "Dal" });
    i18n._({ id: "filter_to", message: "Al" });
    i18n._({ id: "filter_attachments", message: "Allegati" });
    i18n._({ id: "filter_transcription", message: "Trascrizione" });
    i18n._({ id: "filter_any", message: "Qualsiasi" });
    i18n._({ id: "filter_yes", message: "Sì" });
    i18n._({ id: "filter_no", message: "No" });
    i18n._({ id: "filter_has_attachments", message: "Con allegati" });
    i18n._({ id: "filter_no_attachments", message: "Senza allegati" });
    i18n._({ id: "filter_has_transcription", message: "Con trascrizione" });
    i18n._({ id: "filter_no_transcription", message: "Senza trascrizione" });
    i18n._({ id: "filter_remove_advanced", message: "Rimuovi questo filtro" });
    i18n._({ id: "filter_query_hint", message: "Nella ricerca puoi scrivere campo:valore — per esempio notaio:rossi, tag:pergamena, oppure \"frase esatta\"." });
    i18n._({ id: "btn_clear_advanced", message: "Azzera i filtri" });
    i18n._({ id: "label_saved_searches", message: "Ricerche salvate" });
    i18n._({ id: "empty_saved_searches", message: "Nessuna ricerca salvata." });
    i18n._({ id: "placeholder_saved_search", message: "Nome della ricerca" });
    i18n._({ id: "btn_save_search", message: "Salva" });
    i18n._({ id: "btn_delete_saved_search", message: "Elimina questa ricerca" });
    i18n._({ id: "msg_saved_search", message: "Ricerca salvata." });
    // Fase 1.2 — visualizzatore immagini
    i18n._({ id: "tooltip_zoom_in", message: "Ingrandisci (+)" });
    i18n._({ id: "tooltip_zoom_out", message: "Riduci (-)" });
    i18n._({ id: "tooltip_rotate_left", message: "Ruota a sinistra (Maiusc+R)" });
    i18n._({ id: "tooltip_rotate_right", message: "Ruota a destra (R)" });
    i18n._({ id: "tooltip_fit_page", message: "Adatta alla pagina (0)" });
    i18n._({ id: "tooltip_fit_width", message: "Adatta alla larghezza" });
    i18n._({ id: "tooltip_zoom_real", message: "Dimensione reale, 1:1 (1)" });
    i18n._({ id: "tooltip_image_filters", message: "Luminosità, contrasto e negativo" });
    i18n._({ id: "tooltip_view_reset", message: "Ripristina la vista" });
    i18n._({ id: "label_brightness", message: "Luminosità" });
    i18n._({ id: "label_contrast", message: "Contrasto" });
    i18n._({ id: "label_invert", message: "Inverti (negativo)" });
    i18n._({ id: "tooltip_new_record_type", message: "Scegli il tipo della nuova scheda" });
    i18n._({ id: "menu_new_record_type", message: "Nuova scheda di tipo" });
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
    i18n._({ id: "settings_workspace", message: "Archivio di Lavoro" });
    i18n._({ id: "settings_workspace_desc", message: "Questo archivio contiene il tuo database e tutti gli allegati copiati." });
    i18n._({ id: "btn_change_folder", message: "Cambia Archivio..." });
    i18n._({ id: "settings_workspace_restart", message: "L'app verrà riavviata se cambi l'archivio." });
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
    i18n._({ id: "title_source_control", message: "Controllo Modifiche" });
    i18n._({ id: "title_search", message: "Ricerca Globale" });
    i18n._({ id: "title_suggestions", message: "SUGGERIMENTI" });
    i18n._({ id: "title_tags", message: "Filtro Tag" });
    i18n._({ id: "btn_clear_tags", message: "Rimuovi filtri tag" });
    i18n._({ id: "title_available_tags", message: "TAG DISPONIBILI" });
    i18n._({ id: "folder_empty", message: "La cartella è vuota." });
    i18n._({ id: "btn_delete_folder", message: "Elimina questa cartella" });
    i18n._({ id: "title_new_record", message: "Compila Nuova Scheda" });
    i18n._({ id: "btn_cancel_edit", message: "Annulla modifica" });
    i18n._({ id: "label_folder", message: "Archivio:" });
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
    i18n._({ id: "tooltip_folders", message: "Apri Archivi" });
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
    i18n._({ id: "tooltip_back", message: "Torna alla lista" });
    i18n._({ id: "tooltip_prev", message: "Precedente (Alt + Freccia Sinistra)" });
    i18n._({ id: "tooltip_next", message: "Successivo (Alt + Freccia Destra)" });
    i18n._({ id: "placeholder_custom_field", message: "Es. Supporto, Filigrana..." });
    i18n._({ id: "placeholder_search", message: "Cerca in tutte le schede..." });
    i18n._({ id: "placeholder_tags", message: "Filtra tag..." });
    i18n._({ id: "placeholder_identifier", message: "Es. Plut. 40.1 o Atto 12" });
    i18n._({ id: "placeholder_tags_input", message: "es. miniatura, secolo XII, pergamenaceo" });
    i18n._({ id: "settings_theme", message: "Tema / Aspetto" });
    i18n._({ id: "settings_theme_desc", message: "Scegli il tema dell'applicazione." });
    i18n._({ id: "theme_system", message: "Sistema (Predefinito)" });
    i18n._({ id: "theme_light", message: "Chiaro" });
    i18n._({ id: "theme_dark", message: "Scuro (Flat Obsidian)" });
    i18n._({ id: "settings_lang", message: "Lingua / Language" });
    i18n._({ id: "settings_lang_desc", message: "Scegli la lingua dell'applicazione." });


    // IMPOSTAZIONI - TAB
    i18n._({ id: "settings_tab_general", message: "Generali" });
    i18n._({ id: "settings_tab_data", message: "Archivio Dati" });
    i18n._({ id: "settings_tab_sync", message: "Sincronizzazione" });
    i18n._({ id: "settings_tab_system", message: "Sistema & Info" });

    // IMPOSTAZIONI - CONTENUTI
    i18n._({ id: "settings_username_title", message: "Nome Collaboratore / Utente" });
    i18n._({ id: "settings_username_desc", message: "Imposta il tuo nome per identificare chi inserisce o modifica le schede ed i testi." });
    i18n._({ id: "settings_username_placeholder", message: "Es. Antonio" });
    i18n._({ id: "theme_light_group", message: "Temi Chiari" });
    i18n._({ id: "theme_dark_group", message: "Temi Scuri" });
    
    i18n._({ id: "settings_local_attachments_title", message: "Cartella Allegati Locale (Opzionale)" });
    i18n._({ id: "settings_local_attachments_desc", message: "Consente di salvare le immagini localmente sul PC, escludendole dal cloud condiviso per risparmiare spazio." });
    i18n._({ id: "btn_select_folder", message: "Seleziona Cartella..." });
    i18n._({ id: "btn_restore_default", message: "Ripristina di default" });
    
    i18n._({ id: "settings_hub_title", message: "Stato Collegamento Hub" });
    i18n._({ id: "settings_hub_desc", message: "Questo archivio locale è collegato ad un repository condiviso online." });
    i18n._({ id: "settings_hub_url", message: "URL Server:" });
    i18n._({ id: "settings_hub_repoid", message: "ID Repository:" });
    i18n._({ id: "settings_hub_key", message: "Chiave di Scrittura:" });
    i18n._({ id: "settings_not_defined", message: "Non definito" });
    i18n._({ id: "settings_autofetch_title", message: "Sincronizzazione Automatica (Autofetch)" });
    i18n._({ id: "settings_autofetch_interval", message: "Intervallo di controllo:" });
    i18n._({ id: "settings_autofetch_1m", message: "1 minuto" });
    i18n._({ id: "settings_autofetch_5m", message: "5 minuti" });
    i18n._({ id: "settings_autofetch_10m", message: "10 minuti" });
    i18n._({ id: "settings_autofetch_30m", message: "30 minuti" });
    i18n._({ id: "settings_autofetch_desc", message: "Se attivato, l'app controllerà in background se ci sono nuove modifiche dal server e le scaricherà automaticamente." });
    
    i18n._({ id: "settings_drive_title", message: "Sincronizzazione Google Drive" });
    i18n._({ id: "settings_drive_desc", message: "Questo archivio locale è configurato come Archivio Condiviso tramite Google Drive." });
    i18n._({ id: "settings_drive_status", message: "Stato:" });
    i18n._({ id: "settings_drive_checking", message: "Controllo in corso..." });
    i18n._({ id: "btn_drive_login", message: "Accedi a Drive" });
    i18n._({ id: "btn_drive_logout", message: "Disconnetti" });
    i18n._({ id: "btn_drive_sync", message: "Sincronizza Ora" });
    i18n._({ id: "settings_drive_hint", message: "Per gestire la sincronizzazione, gli inviti o disconnetterti, utilizza il menu <b>Cloud</b> nella barra superiore dell'applicazione." });

    // === CHIAVI DINAMICHE DA TYPESCRIPT ===

    // === CHIAVI MODALI ===
    i18n._({ id: "modal_cloud_manual_desc", message: "Usa questa opzione se invii l'invito via chat (WhatsApp/Slack). Ricorda che <strong>devi comunque aver autorizzato la sua email</strong> inserendola dal bottone qui sopra." });
    i18n._({ id: "btn_disconnect_cloud", message: "Scollega dal Cloud" });

    i18n._({ id: "modal_cloud_activate_title", message: "Attiva Sincronizzazione Cloud" });
    i18n._({ id: "modal_cloud_activate_desc", message: "Scegli se caricare il tuo archivio online o se unirti a uno già esistente tramite codice invito." });
    i18n._({ id: "modal_cloud_upload_title", message: "Carica nel Cloud" });
    i18n._({ id: "modal_cloud_upload_desc", message: "Trasforma questo archivio locale in un archivio cloud per poterlo sincronizzare e condividere." });
    i18n._({ id: "btn_backup_private", message: "Backup Personale" });
    i18n._({ id: "btn_shared_archive", message: "Archivio Condiviso" });
    i18n._({ id: "btn_use_different_account", message: "Usa un account diverso" });
    i18n._({ id: "modal_cloud_join_title", message: "Partecipa" });
    i18n._({ id: "modal_cloud_join_desc", message: "Hai ricevuto un invito? Abbandona l'archivio locale attuale per unirti a quello condiviso da un tuo collaboratore." });
    i18n._({ id: "btn_join_archive", message: "Unisciti a un Archivio" });
    i18n._({ id: "modal_cloud_active_title", message: "Cloud Attivo" });
    i18n._({ id: "modal_cloud_active_desc", message: "Questo Archivio è sincronizzato." });
    i18n._({ id: "btn_sync_now", message: "Sincronizza Ora" });
    i18n._({ id: "label_sync_attachments", message: "Sincronizza allegati automaticamente (PDF/Immagini)" });
    i18n._({ id: "label_advanced_options", message: "Opzioni avanzate" });
    // Cloud: riepilogo di stato, stati di caricamento e annunci per screen reader
    i18n._({ id: "modal_cloud_title_backup", message: "Backup personale su Google Drive" });
    i18n._({ id: "modal_cloud_title_shared", message: "Archivio condiviso su Google Drive" });
    i18n._({ id: "cloud_shared_hint", message: "I permessi Drive non sono revocabili singolarmente: chi ha il link mantiene l'accesso. Passa all'archivio condiviso per inviti revocabili." });
    i18n._({ id: "cloud_status_type", message: "Tipo" });
    i18n._({ id: "cloud_status_type_backup", message: "Backup personale" });
    i18n._({ id: "cloud_status_type_shared", message: "Archivio condiviso (legacy)" });
    i18n._({ id: "cloud_status_account", message: "Account" });
    i18n._({ id: "cloud_status_last_sync", message: "Ultima sincronizzazione" });
    i18n._({ id: "btn_syncing", message: "Sincronizzazione..." });
    i18n._({ id: "btn_activating", message: "Attivazione in corso..." });
    i18n._({ id: "a11y_sync_attachments_on", message: "Sincronizzazione allegati attivata" });
    i18n._({ id: "a11y_sync_attachments_off", message: "Sincronizzazione allegati disattivata" });
    i18n._({ id: "a11y_operation_done", message: "Operazione terminata" });
    i18n._({ id: "btn_convert_backup_private", message: "Converti in Backup Personale" });
    i18n._({ id: "btn_convert_shared", message: "Converti in Archivio Condiviso" });
    i18n._({ id: "btn_use_another_account", message: "Usa un altro account Google" });
    i18n._({ id: "btn_join_another", message: "Unisiti a un altro Archivio" });
    i18n._({ id: "modal_cloud_shared_active", message: "Archivio Condiviso Attivo" });
    i18n._({ id: "modal_cloud_shared_desc", message: "Questo Archivio è sincronizzato sul Cloud. Usa \"Invita tramite Email\" per autorizzare i collaboratori, poi condividi questo codice per configurarli." });
    i18n._({ id: "modal_cloud_backup_active", message: "Backup Personale Attivo" });
    i18n._({ id: "modal_cloud_backup_desc", message: "Questo Archivio è sincronizzato nel tuo Cloud privato. Nessun altro ha accesso." });
    i18n._({ id: "tab_add", message: "Aggiungi" });
    i18n._({ id: "tab_members", message: "Membri" });
    i18n._({ id: "modal_cloud_direct_invite", message: "Invito Diretto" });
    i18n._({ id: "modal_cloud_invite_desc", message: "Inserisci l'email Google del collaboratore. Riceverà un'email con l'autorizzazione di accesso e un \"link magico\" per aprire l'archivio nell'app automaticamente." });
    i18n._({ id: "btn_invite_email", message: "Invita tramite Email" });
    i18n._({ id: "btn_manual_invite_code", message: "Invia manualmente il codice d'invito" });
    i18n._({ id: "modal_cloud_members_desc", message: "Elenco di chi ha accesso a questo Archivio." });
    i18n._({ id: "modal_cloud_auth_desc", message: "Accedi con il tuo account per sincronizzare questo Archivio." });
    
    i18n._({ id: "sidebar_source_control_desc", message: "Modifiche locali non ancora inviate al Cloud" });
    i18n._({ id: "sidebar_pending_changes", message: "MODIFICHE PENDENTI" });
    i18n._({ id: "sidebar_cloud_history", message: "Storico Cloud" });
    i18n._({ id: "sidebar_cloud_history_desc", message: "Versioni salvate su Google Drive" });
    i18n._({ id: "sidebar_cloud_revisions", message: "REVISIONI CLOUD" });
    i18n._({ id: "tooltip_refresh_list", message: "Aggiorna lista" });
    i18n._({ id: "sidebar_history_empty", message: "Apri questa sezione per vedere lo storico." });
    i18n._({ id: "sidebar_manage_archives", message: "Gestisci archivi..." });


    i18n._({ id: "modal_docs_title", message: "Documentazione e Aiuto" });
    i18n._({ id: "modal_media_title", message: "Visualizzatore Multimediale" });
    i18n._({ id: "modal_unsaved_title", message: "Modifiche non salvate" });
    i18n._({ id: "modal_unsaved_desc", message: "Hai delle modifiche non salvate" });
    i18n._({ id: "btn_save_exit", message: "Salva ed esci" });
    i18n._({ id: "btn_exit_nosave", message: "Esci senza salvare" });
    i18n._({ id: "modal_conflict_title", message: "Conflitto di Sincronizzazione" });
    i18n._({ id: "modal_conflict_desc", message: "La scheda è stata modificata sia da te che da un altro utente" });
    i18n._({ id: "btn_keep_local", message: "Mantieni versione Locale" });
    i18n._({ id: "btn_keep_remote", message: "Mantieni versione Remota" });
    i18n._({ id: "modal_del_conflict_title", message: "Conflitto di Eliminazione" });
    i18n._({ id: "modal_del_conflict_desc", message: "Questa scheda è stata modificata da un altro utente" });
    i18n._({ id: "btn_force_delete", message: "Forza Eliminazione" });

    i18n._({ id: "tooltip_source_control", message: "Controllo Modifiche (Source Control)" });
    i18n._({ id: "tooltip_history", message: "Storico Versioni Cloud" });
    i18n._({ id: "tooltip_cloud_updates", message: "Ci sono aggiornamenti dal Cloud. Clicca Sincronizza o Scarica." });
    i18n._({ id: "indicator_incoming", message: "In Entrata" });
    i18n._({ id: "tooltip_pending_changes", message: "Hai modifiche locali non ancora sincronizzate con il Cloud" });
    i18n._({ id: "indicator_pending", message: "Modifiche Pendenti" });
    i18n._({ id: "tooltip_fetch", message: "Controlla se ci sono aggiornamenti dal Cloud" });
    i18n._({ id: "btn_fetch", message: "Fetch" });
    i18n._({ id: "tooltip_pull", message: "Scarica le ultime modifiche dal Cloud" });
    i18n._({ id: "tooltip_push", message: "Carica le modifiche locali sul Cloud" });
    i18n._({ id: "tooltip_tutorial", message: "Avvia Tutorial" });

    i18n._({ id: "modal_cloud_title", message: "Gestione Condivisione (Cloud)" });
    i18n._({ id: "modal_cloud_connect", message: "Connetti questo Archivio" });
    i18n._({ id: "modal_cloud_desc", message: "Se questo archivio locale non è ancora collegato al Cloud, puoi farlo ora." });
    i18n._({ id: "modal_cloud_drive", message: "Condivisione Google Drive" });
    i18n._({ id: "modal_cloud_drive_desc", message: "Crea o collega un Archivio Condiviso su Google Drive." });
    i18n._({ id: "modal_cloud_drive_btn", message: "Crea / Connetti a Drive" });
    i18n._({ id: "modal_cloud_control", message: "Pannello di Controllo" });
    i18n._({ id: "btn_add_member", message: "Aggiungi Membro" });
    i18n._({ id: "btn_clean_ghosts", message: "Pulizia File Fantasma" });
    i18n._({ id: "modal_cloud_manual", message: "Condivisione Manuale" });
    i18n._({ id: "btn_copy_code", message: "Copia Codice" });
    i18n._({ id: "msg_operation_progress", message: "Operazione in corso" });
    i18n._({ id: "msg_please_wait", message: "Attendere prego..." });
    i18n._({ id: "modal_cloud_auth", message: "Autenticazione Cloud" });
    i18n._({ id: "btn_login_google", message: "Accedi con Google" });
    i18n._({ id: "label_email", message: "Indirizzo Email" });
    i18n._({ id: "btn_send_invite", message: "Invia Invito" });

    i18n._({ id: "modal_delete_title", message: "Conferma Eliminazione" });
    i18n._({ id: "modal_delete_warning", message: "Attenzione: questa azione è irreversibile." });
    i18n._({ id: "modal_delete_desc", message: "Sei sicuro di voler eliminare" });
    i18n._({ id: "btn_delete", message: "Elimina" });

    i18n._({ id: "modal_folder_title", message: "Gestione Archivi" });
    i18n._({ id: "modal_folder_new", message: "Crea Nuovo Archivio" });
    i18n._({ id: "modal_folder_recent", message: "Archivi Recenti" });

    i18n._({ id: "modal_rename_title", message: "Rinomina" });
    i18n._({ id: "modal_rename_desc", message: "Inserisci il nuovo nome:" });

    i18n._({ id: "modal_manage_types_title", message: "Gestione Modelli Documento" });
    i18n._({ id: "btn_create_model", message: "Crea Nuovo Modello" });
    i18n._({ id: "modal_manage_types_default", message: "Modelli Predefiniti" });
    i18n._({ id: "modal_manage_types_custom", message: "I tuoi Modelli" });

    i18n._({ id: "modal_changelog_title", message: "Novità in ArchiView" });

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

    // Messaggi di stato / Toast
    i18n._({ id: "msg_insert_type_name", message: "Inserisci un nome per il tipo di documento." });
    i18n._({ id: "msg_add_one_field", message: "Aggiungi almeno un campo base o personalizzato." });
    i18n._({ id: "msg_type_updated", message: "Modello aggiornato con successo." });
    i18n._({ id: "msg_type_created", message: "Nuovo modello creato." });
    i18n._({ id: "msg_type_in_use", message: "Impossibile eliminare: ci sono schede che usano questo modello." });
    i18n._({ id: "msg_type_deleted", message: "Modello eliminato." });

    i18n._({ id: "msg_backup_init", message: "Preparazione del backup in corso..." });
    i18n._({ id: "msg_backup_success", message: "Backup creato con successo!" });
    i18n._({ id: "msg_backup_error", message: "Errore durante il backup: " });
    i18n._({ id: "msg_check_updates", message: "Controllo aggiornamenti in corso..." });
    i18n._({ id: "msg_update_error", message: "Errore controllo aggiornamenti: " });
    i18n._({ id: "msg_up_to_date", message: "Il programma è già aggiornato" });

    i18n._({ id: "msg_file_save_error", message: "Errore durante il salvataggio." });
    i18n._({ id: "msg_record_deleted", message: "Scheda eliminata." });

    i18n._({ id: "msg_folder_name_empty", message: "Il nome dell'archivio non può essere vuoto." });
    i18n._({ id: "msg_folder_exists", message: "L'archivio esiste già." });
    i18n._({ id: "msg_folder_exists_dest", message: "Esiste già un archivio con questo nome nella destinazione." });
    i18n._({ id: "msg_cannot_delete_last_folder", message: "Impossibile eliminare l'unico archivio rimasto." });
    i18n._({ id: "msg_cannot_delete_not_empty", message: "Impossibile eliminare l'archivio perché contiene dei documenti." });
    i18n._({ id: "msg_folder_deleted", message: "Cartella eliminata." });
    i18n._({ id: "msg_folder_invalid_name", message: "Nome archivio non valido." });
    i18n._({ id: "msg_folder_renamed", message: "Archivio rinominato." });

    i18n._({ id: "msg_transcription_saved", message: "Trascrizione salvata con successo." });
    i18n._({ id: "msg_attachment_error", message: "Impossibile caricare l'allegato." });

    i18n._({ id: "no_tags_found", message: "Nessun tag disponibile" });
    i18n._({ id: "no_attached_docs", message: "Nessun documento allegato" });
    i18n._({ id: "no_workspace_set", message: "Nessun archivio impostato" });
    i18n._({ id: "btn_pull", message: "Scarica" });
    i18n._({ id: "btn_push", message: "Invia" });

    i18n._({ id: "msg_new_version_avail", message: "È disponibile la nuova versione" });
    i18n._({ id: "msg_current_version", message: "attuale:" });
    i18n._({ id: "btn_download_update", message: "Scarica Aggiornamento" });
    i18n._({ id: "btn_download_starting", message: "Avvio download..." });
    i18n._({ id: "btn_download_error", message: "Errore Download" });
    i18n._({ id: "msg_downloading", message: "Scaricamento:" });
    i18n._({ id: "btn_restart_install", message: "Riavvia e Installa" });
    i18n._({ id: "btn_installing", message: "Installazione..." });
    i18n._({ id: "btn_report_issue", message: "Segnala problema" });
    i18n._({ id: "settings_support", message: "Supporto" });
    i18n._({ id: "settings_support_desc", message: "Hai riscontrato dei problemi o hai dei suggerimenti? Segnalalo su GitHub." });
    i18n._({ id: "modal_report_issue", message: "Segnala un problema" });
    i18n._({ id: "issue_title", message: "Titolo della segnalazione *" });
    i18n._({ id: "placeholder_issue_title", message: "Es. Errore durante il salvataggio o caricamento file..." });
    i18n._({ id: "issue_type", message: "Tipo di segnalazione" });
    i18n._({ id: "issue_type_bug", message: "Bug / Errore del programma" });
    i18n._({ id: "issue_type_enhancement", message: "Suggerimento / Nuova funzionalità" });
    i18n._({ id: "issue_type_feedback", message: "Feedback generico" });
    i18n._({ id: "issue_description", message: "Descrizione dettagliata *" });
    i18n._({ id: "placeholder_issue_desc", message: "Descrivi il problema, come riprodurlo, o cosa ti aspetti che accada..." });
    i18n._({ id: "btn_submit_issue", message: "Apri su GitHub" });
    i18n._({ id: "sync_in_progress", message: "Sincronizzazione" });
    i18n._({ id: "upload_in_progress", message: "Caricamento" });
    i18n._({ id: "download_in_progress", message: "Scaricamento" });
    i18n._({ id: "msg_sync_error", message: "Errore di connessione o sincronizzazione." });

    // TUTORIAL
    i18n._({ id: "tut_welcome_title", message: "Benvenuto in ArchiView" });
    i18n._({ id: "tut_welcome_desc", message: "Questo tour guidato ti illustrerà le funzionalità principali del sistema. Clicca su \"Avanti\" per iniziare la presentazione." });
    i18n._({ id: "tut_toolbar_title", message: "Barra degli Strumenti Globale" });
    i18n._({ id: "tut_toolbar_desc", message: "Quest'area consente la navigazione rapida tra le sezioni principali e l'accesso alle funzioni di gestione dell'archivio." });
    i18n._({ id: "tut_models_title", message: "Gestione Modelli" });
    i18n._({ id: "tut_models_desc", message: "Clicca su questo pulsante per creare o personalizzare i modelli di documento. Un modello definisce quali campi (es. Data, Autore, Note) saranno disponibili per la compilazione della scheda." });
    i18n._({ id: "tut_new_model_title", message: "Creazione Modello" });
    i18n._({ id: "tut_new_model_desc", message: "In questa finestra puoi selezionare un modello predefinito o crearne uno completamente personalizzato aggiungendo i tuoi campi. Chiudi la finestra (con la X o Annulla) per procedere." });
    i18n._({ id: "tut_search_title", message: "Ricerca Globale" });
    i18n._({ id: "tut_search_desc", message: "Per esplorare gli strumenti di ricerca avanzata, clicca sull'icona della lente d'ingrandimento." });
    i18n._({ id: "tut_search_engine_title", message: "Motore di Ricerca Avanzato" });
    i18n._({ id: "tut_search_engine_desc", message: "Il sistema indicizza e ricerca le parole chiave all'interno dei metadati, dei titoli e del corpo delle trascrizioni in tempo reale." });
    i18n._({ id: "tut_tags_title", message: "Sistema di Catalogazione" });
    i18n._({ id: "tut_tags_desc", message: "Per accedere alle funzionalità di classificazione tramite tag, seleziona l'icona a forma di segnalibro." });
    i18n._({ id: "tut_tags_filter_title", message: "Filtri Semantici e Tag" });
    i18n._({ id: "tut_tags_filter_desc", message: "Questa sezione permette di organizzare il patrimonio documentario attraverso etichette personalizzabili. La selezione di un tag applica un filtro immediato all'intero archivio." });
    i18n._({ id: "tut_cloud_sync_title", message: "Sincronizzazione Remota" });
    i18n._({ id: "tut_cloud_sync_desc", message: "Strumenti per la gestione del repository Cloud: utilizza \"Fetch\" per verificare la presenza di aggiornamenti, \"Scarica\" per allineare il database locale e \"Carica\" per pubblicare le tue revisioni." });
    i18n._({ id: "tut_source_control_title", message: "Gestione Versioni" });
    i18n._({ id: "tut_source_control_desc", message: "Per analizzare lo stato delle revisioni non ancora sincronizzate, seleziona l'icona del Controllo Modifiche." });
    i18n._({ id: "tut_source_status_title", message: "Stato delle Revisioni" });
    i18n._({ id: "tut_source_status_desc", message: "Questa vista riepiloga le modifiche effettuate in locale. Prima della sincronizzazione, è possibile revisionare o annullare ciascuna operazione in modo selettivo." });
    i18n._({ id: "tut_cloud_integration_title", message: "Integrazione Cloud" });
    i18n._({ id: "tut_cloud_integration_desc", message: "L'archivio corrente è configurato in modalità locale. Seleziona l'icona Cloud nell'angolo in basso a sinistra per esplorare le opzioni di connettività." });
    i18n._({ id: "tut_cloud_panel_title", message: "Pannello di Configurazione Remota" });
    i18n._({ id: "tut_cloud_panel_desc", message: "Da questa interfaccia è possibile convertire l'archivio locale in un database Condiviso (ottimizzato per team di lavoro) o in uno Personale (con backup automatico integrato). Chiudi la finestra per proseguire." });
    i18n._({ id: "tut_vaults_title", message: "Gestione Multi-Archivio" });
    i18n._({ id: "tut_vaults_desc", message: "ArchiView ti permette di creare e gestire un numero illimitato di archivi (vault) separati. Cliccando su questo pulsante potrai passare rapidamente da un archivio all'altro, creare nuovi archivi locali, collegarne di Cloud o gestire Archivi Condivisi per collaborare col tuo team." });
    i18n._({ id: "tut_nav_return_title", message: "Ritorno alla Navigazione" });
    i18n._({ id: "tut_nav_return_desc", message: "Per ripristinare la vista principale e sfogliare i record, seleziona l'icona a forma di cartella." });
    i18n._({ id: "tut_card_edit_title", message: "Accesso alla Schedatura" });
    i18n._({ id: "tut_card_edit_desc", message: "Per consultare o aggiornare i metadati di un documento, seleziona il pulsante \"Modifica\" posizionato sulla relativa scheda." });
    i18n._({ id: "tut_editor_title", message: "Editor della Schedatura" });
    i18n._({ id: "tut_editor_desc", message: "Questo pannello consente la catalogazione estesa del documento e la gestione dei relativi allegati digitali. L'interfaccia mantiene i comandi di salvataggio sempre accessibili. Clicca sulla freccia in alto a sinistra per tornare all'archivio." });
    i18n._({ id: "tut_transcribe_title", message: "Modulo di Trascrizione" });
    i18n._({ id: "tut_transcribe_desc", message: "Seleziona ora il pulsante \"Trascrivi\" su una scheda per avviare l'ambiente dedicato all'analisi e alla trascrizione del documento originale." });
    i18n._({ id: "tut_transcribe_env_title", message: "Ambiente di Trascrizione Integrato" });
    i18n._({ id: "tut_transcribe_env_desc", message: "Quest'area presenta l'immagine del manoscritto affiancata all'editor testuale avanzato. Si consiglia l'utilizzo della combinazione Ctrl+S per il salvataggio rapido. Clicca sulla freccia in alto a sinistra per tornare all'archivio." });
    i18n._({ id: "tut_context_menu_title", message: "Operazioni Contestuali" });
    i18n._({ id: "tut_context_menu_desc", message: "La piattaforma supporta menù contestuali (tasto destro del mouse) sugli elementi dell'archivio per l'accesso rapido alle funzioni di esportazione, duplicazione e rimozione." });
    i18n._({ id: "tut_done_title", message: "Configurazione Completata" });
    i18n._({ id: "tut_done_desc", message: "Il sistema è ora pronto per l'utilizzo. È possibile rieseguire questa presentazione formativa in qualsiasi momento selezionando l'icona (?)." });
    i18n._({ id: "tut_btn_next", message: "Avanti" });
    i18n._({ id: "tut_btn_prev", message: "Indietro" });
    i18n._({ id: "tut_btn_done", message: "Fine" });

    // --- Fase 2.3: OCR degli allegati ---
    i18n._({ id: "ocr_title", message: "Riconosci testo (OCR)" });
    i18n._({ id: "ocr_button", message: "Riconosci testo" });
    i18n._({ id: "ocr_menu_entry", message: "Riconosci testo (OCR)…" });
    i18n._({ id: "ocr_start", message: "Riconosci" });
    i18n._({ id: "ocr_source", message: "Allegato" });
    i18n._({ id: "ocr_source_all", message: "Tutti gli allegati della scheda" });
    i18n._({ id: "ocr_langs", message: "Lingue" });
    i18n._({ id: "ocr_langs_title", message: "Lingue del riconoscimento" });
    i18n._({ id: "ocr_langs_hint", message: "Più lingue insieme rallentano il riconoscimento: sceglile solo se il documento le mescola davvero." });
    i18n._({ id: "ocr_langs_loading", message: "Lettura in corso…" });
    i18n._({ id: "ocr_langs_offline_hint", message: "I dati si scaricano una sola volta e restano su questo computer: dopo l'installazione il riconoscimento funziona senza connessione." });
    i18n._({ id: "ocr_no_langs", message: "Nessuna lingua installata: il riconoscimento ha bisogno almeno di una lingua." });
    i18n._({ id: "ocr_manage_langs", message: "Gestisci lingue…" });
    i18n._({ id: "ocr_lang_install", message: "Installa" });
    i18n._({ id: "ocr_lang_remove", message: "Rimuovi" });
    i18n._({ id: "ocr_lang_installing", message: "Download…" });
    i18n._({ id: "ocr_lang_removing", message: "Rimozione…" });
    i18n._({ id: "ocr_lang_error", message: "Operazione non riuscita: serve una connessione per scaricare i dati di lingua." });
    i18n._({ id: "ocr_destination", message: "Destinazione" });
    i18n._({ id: "ocr_dest_draft", message: "Inserisci come bozza nella trascrizione" });
    i18n._({ id: "ocr_dest_index", message: "Rendi il testo cercabile" });
    i18n._({ id: "ocr_dest_hint", message: "Il testo cercabile resta legato all'allegato e non tocca la trascrizione: serve a ritrovare la scheda, non a sostituire il lavoro di lettura." });
    i18n._({ id: "ocr_advanced", message: "Opzioni avanzate" });
    i18n._({ id: "ocr_dpi", message: "Risoluzione di scansione dei PDF" });
    i18n._({ id: "ocr_dpi_fast", message: "veloce" });
    i18n._({ id: "ocr_dpi_default", message: "consigliata" });
    i18n._({ id: "ocr_dpi_slow", message: "lenta, testo minuto" });
    i18n._({ id: "ocr_max_pages", message: "Pagine massime per PDF" });
    i18n._({ id: "ocr_max_pages_hint", message: "Il limite esiste perché un PDF di trecento carte occuperebbe il programma per ore senza che nessuno lo abbia chiesto." });
    i18n._({ id: "ocr_phase_page", message: "Pagina" });
    i18n._({ id: "ocr_phase_raster", message: "Preparazione immagine" });
    i18n._({ id: "ocr_phase_recognize", message: "Riconoscimento" });
    i18n._({ id: "ocr_phase_lang", message: "Caricamento lingua" });
    i18n._({ id: "ocr_phase_init", message: "Avvio del motore" });
    i18n._({ id: "ocr_page_of", message: "pagina {var0} di {var1}" });
    i18n._({ id: "ocr_provenance", message: "Bozza generata da OCR ({var0}) il {var1} — da rivedere" });
    i18n._({ id: "ocr_pick_lang", message: "Scegli almeno una lingua." });
    i18n._({ id: "ocr_pick_dest", message: "Scegli almeno una destinazione per il testo." });
    i18n._({ id: "ocr_no_attachments", message: "Questa scheda non ha allegati da riconoscere." });
    i18n._({ id: "ocr_no_attachments_sel", message: "Nessuna delle schede selezionate ha allegati." });
    i18n._({ id: "ocr_failed", message: "Nessun testo riconosciuto." });
    i18n._({ id: "ocr_done", message: "Riconoscimento completato." });
    i18n._({ id: "ocr_result_summary", message: "{var0} caratteri riconosciuti, confidenza media {var1}%" });
    i18n._({ id: "ocr_low_confidence", message: "Confidenza bassa: probabilmente la scrittura è corsiva o la scansione è poco leggibile. Il testo va riletto parola per parola." });
    i18n._({ id: "ocr_saved_index", message: "Testo reso cercabile." });
    i18n._({ id: "ocr_saved_draft", message: "Bozza inserita nella trascrizione." });
    i18n._({ id: "ocr_draft_skipped", message: "Trascrizione lasciata invariata." });
    i18n._({ id: "ocr_overwrite_title", message: "Trascrizione già presente" });
    i18n._({ id: "ocr_overwrite_desc", message: "Alcune carte hanno già una trascrizione. La bozza dell'OCR può sostituirla o essere aggiunta in fondo. Il testo sostituito non è recuperabile." });
    i18n._({ id: "trasc_current_sheet", message: "Carta {var0} di {var1} — {var2}" });
    i18n._({ id: "ocr_overwrite_append", message: "Aggiungi in fondo" });
    i18n._({ id: "ocr_overwrite_replace", message: "Sostituisci" });
    i18n._({ id: "ocr_bulk_title", message: "OCR delle schede selezionate" });
    i18n._({ id: "ocr_bulk_progress", message: "Scheda {var0} di {var1}: {var2}" });
    i18n._({ id: "ocr_bulk_done", message: "OCR completato: {var0} allegati in {var1} schede." });
    i18n._({ id: "filter_ocr", message: "Testo OCR" });
    i18n._({ id: "filter_has_ocr", message: "Con testo OCR" });
    i18n._({ id: "filter_no_ocr", message: "Senza testo OCR" });
    i18n._({ id: "settings_ocr_desc", message: "Il riconoscimento del testo (OCR) funziona senza connessione, ma ogni lingua va installata una volta. I dati restano su questo computer e non vengono sincronizzati." });


    // --- Menu contestuali: etichette corte (la dizione estesa sta nel title) ---
    i18n._({ id: "menu_edit_short", message: "Modifica" });
    i18n._({ id: "menu_ocr_short", message: "Riconosci testo" });
    i18n._({ id: "menu_export_zip", message: "Esporta ZIP" });
    i18n._({ id: "menu_export_csv", message: "Esporta CSV" });
    i18n._({ id: "menu_export_tsv", message: "Esporta TSV" });
    i18n._({ id: "menu_print_short", message: "Stampa" });
    i18n._({ id: "menu_bulk_move", message: "Sposta" });
    i18n._({ id: "menu_bulk_type", message: "Cambia tipo" });
    i18n._({ id: "menu_bulk_tag", message: "Modifica tag" });
    i18n._({ id: "menu_bulk_replace", message: "Sostituisci" });
    i18n._({ id: "menu_bulk_ocr", message: "OCR" });
    i18n._({ id: "menu_select_all_short", message: "Seleziona tutto" });
    i18n._({ id: "menu_new_record_short", message: "Nuova scheda" });
    i18n._({ id: "menu_new_folder_short", message: "Nuova cartella" });
    i18n._({ id: "menu_rename_short", message: "Rinomina" });
    i18n._({ id: "menu_explorer_short", message: "Esplora risorse" });
    i18n._({ id: "bulk_export_zip_full", message: "Esporta la selezione in ZIP" });
    // --- Fase 2.2: stampa e PDF ---
    i18n._({ id: "print_title", message: "Stampa e PDF" });
    i18n._({ id: "print_scope", message: "Cosa stampare" });
    i18n._({ id: "print_scope_selection", message: "Schede selezionate" });
    i18n._({ id: "print_scope_current", message: "Scheda aperta" });
    i18n._({ id: "print_scope_results", message: "Risultati correnti" });
    i18n._({ id: "print_scope_folder", message: "Cartella corrente" });
    i18n._({ id: "print_scope_all", message: "Tutto l'archivio" });
    i18n._({ id: "print_layout", message: "Formato" });
    i18n._({ id: "print_layout_card", message: "Scheda singola" });
    i18n._({ id: "print_layout_card_desc", message: "Una scheda per pagina, con tutti i campi, gli allegati come miniature e la trascrizione." });
    i18n._({ id: "print_layout_regest", message: "Regesto / inventario" });
    i18n._({ id: "print_layout_regest_desc", message: "Elenco ordinato: segnatura, data e sintesi del contenuto. È il formato di un inventario a stampa." });
    i18n._({ id: "print_layout_table", message: "Elenco tabellare" });
    i18n._({ id: "print_layout_table_desc", message: "Le colonne della vista tabella, una riga per scheda." });
    i18n._({ id: "print_fund", message: "Fondo" });
    i18n._({ id: "print_fund_ph", message: "Es. ASP, Notarile" });
    i18n._({ id: "print_author", message: "Schedatura di" });
    i18n._({ id: "print_author_ph", message: "Nome e cognome" });
    i18n._({ id: "print_date", message: "Data" });
    i18n._({ id: "print_date_ph", message: "Es. giugno 2026" });
    i18n._({ id: "print_opt_cover", message: "Frontespizio" });
    i18n._({ id: "print_opt_pages", message: "Numeri di pagina" });
    i18n._({ id: "print_opt_thumbs", message: "Miniature degli allegati" });
    i18n._({ id: "print_opt_transcription", message: "Includi la trascrizione" });
    i18n._({ id: "print_opt_empty", message: "Mostra anche i campi vuoti" });
    i18n._({ id: "print_orientation", message: "Orientamento" });
    i18n._({ id: "print_portrait", message: "Verticale" });
    i18n._({ id: "print_landscape", message: "Orizzontale" });
    i18n._({ id: "print_count", message: "{var0} schede da stampare." });
    i18n._({ id: "print_current_view", message: "Stampa la vista" });
    i18n._({ id: "print_send", message: "Stampa" });
    i18n._({ id: "print_save_pdf", message: "Salva PDF" });
    i18n._({ id: "print_empty", message: "Non c'è nessuna scheda da stampare." });
    i18n._({ id: "print_working", message: "Preparazione del documento…" });
    i18n._({ id: "print_sent", message: "Documento inviato alla stampante." });
    i18n._({ id: "print_saved", message: "PDF salvato." });
    i18n._({ id: "print_failed", message: "Stampa non riuscita: " });
    i18n._({ id: "print_cmd_regest", message: "Stampa il regesto della cartella" });
    i18n._({ id: "print_cmd_selection", message: "Stampa la selezione" });
    i18n._({ id: "menu_print_folder", message: "Stampa cartella" });
    i18n._({ id: "dialog_print_pdf", message: "Salva in PDF" });
    i18n._({ id: "shortcut_print", message: "Stampa o salva in PDF" });
    i18n._({ id: "print_doc_title", message: "Schedatura" });
    i18n._({ id: "print_cover_fund", message: "Fondo" });
    i18n._({ id: "print_cover_author", message: "Schedatura a cura di" });
    i18n._({ id: "print_cover_date", message: "Data" });
    i18n._({ id: "print_cover_count", message: "Schede" });
    i18n._({ id: "print_section_transcription", message: "Trascrizione" });
    i18n._({ id: "print_section_attachments", message: "Allegati" });
    i18n._({ id: "print_no_records", message: "Nessuna scheda da stampare." });
    i18n._({ id: "print_untitled", message: "Senza segnatura" });
    // --- Fasi 2.5 e 2.6: export della trascrizione e citazioni ---
    i18n._({ id: "tx_title", message: "Esporta testo e citazioni" });
    i18n._({ id: "tx_scope", message: "Cosa esportare" });
    i18n._({ id: "tx_format", message: "Formato" });
    i18n._({ id: "tx_group_text", message: "Il testo della trascrizione" });
    i18n._({ id: "tx_group_citation", message: "La citazione bibliografica" });
    i18n._({ id: "tx_fmt_html_desc", message: "Pagina autonoma, apribile in qualsiasi browser e allegabile a un messaggio." });
    i18n._({ id: "tx_fmt_md_desc", message: "Testo semplice con la formattazione conservata: per Obsidian, Pandoc, GitHub." });
    i18n._({ id: "tx_fmt_rtf_desc", message: "Si apre in Word e LibreOffice mantenendo corsivi, grassetti e note." });
    i18n._({ id: "tx_fmt_bibtex_desc", message: "Voce @misc per LaTeX, Zotero e JabRef." });
    i18n._({ id: "tx_fmt_ris_desc", message: "Formato di scambio di Zotero, EndNote e Mendeley." });
    i18n._({ id: "tx_opt_header", message: "Intestazione con segnatura, date e archivio" });
    i18n._({ id: "tx_count", message: "{var0} schede, di cui {var1} con trascrizione." });
    i18n._({ id: "tx_count_citations", message: "{var0} citazioni da esportare." });
    i18n._({ id: "tx_export", message: "Esporta" });
    i18n._({ id: "tx_none", message: "Non c'è nessuna scheda da esportare." });
    i18n._({ id: "tx_done", message: "Esportate {var0} schede." });
    i18n._({ id: "tx_failed", message: "Esportazione non riuscita: " });
    i18n._({ id: "tx_doc_title", message: "Trascrizioni" });
    i18n._({ id: "tx_empty", message: "Nessuna trascrizione." });
    i18n._({ id: "tx_ocr_notice", message: "Bozza generata da OCR: testo non riletto, i tratti incerti sono segnalati." });
    i18n._({ id: "tx_cmd_transcription", message: "Esporta la trascrizione (HTML, Markdown, RTF)" });
    i18n._({ id: "tx_cmd_citation", message: "Esporta la citazione (BibTeX, RIS)" });
    i18n._({ id: "tx_cmd_selection", message: "Esporta la trascrizione o la citazione" });
    i18n._({ id: "menu_export_text", message: "Esporta testo" });
    i18n._({ id: "menu_export_text_folder", message: "Esporta il testo della cartella" });
    i18n._({ id: "dialog_export_text", message: "Esporta testo e citazioni" });
    i18n._({ id: "cit_type", message: "Manoscritto" });
    i18n._({ id: "cit_untitled", message: "Senza titolo" });
    // --- Fase 3.2: data storica fuzzy ---
    i18n._({ id: "filter_period", message: "Periodo del documento" });
    i18n._({ id: "filter_year_from", message: "Dall'anno" });
    i18n._({ id: "filter_year_to", message: "All'anno" });
    i18n._({ id: "filter_century", message: "Secolo" });
    i18n._({ id: "filter_any_century", message: "Qualsiasi secolo" });
    i18n._({ id: "placeholder_data_storica", message: "Es. 12 maggio 1340, c. 1340, sec. XIV in." });
    i18n._({ id: "date_read", message: "Letta come: {var0} ({var1})" });
    i18n._({ id: "date_not_read", message: "Datazione non interpretata: la scheda resterà in fondo agli ordinamenti cronologici." });
    i18n._({ id: "date_none", message: "Senza data." });
    i18n._({ id: "date_q_exact", message: "data esatta" });
    i18n._({ id: "date_q_year", message: "anno" });
    i18n._({ id: "date_q_circa", message: "circa" });
    i18n._({ id: "date_q_ante", message: "prima del" });
    i18n._({ id: "date_q_post", message: "dopo il" });
    i18n._({ id: "date_q_range", message: "intervallo" });
    i18n._({ id: "date_q_century", message: "secolo" });
    // --- Fase 3.1: campi tipizzati ---
    i18n._({ id: "value_yes", message: "Sì" });
    i18n._({ id: "value_no", message: "No" });
    i18n._({ id: "field_required", message: "Campo obbligatorio" });
    i18n._({ id: "field_configure", message: "Configura il campo" });
    i18n._({ id: "field_choose", message: "— scegli —" });
    i18n._({ id: "field_value_removed", message: "valore non più previsto" });
    i18n._({ id: "field_type_text", message: "Testo" });
    i18n._({ id: "field_type_textarea", message: "Testo lungo" });
    i18n._({ id: "field_type_number", message: "Numero" });
    i18n._({ id: "field_type_boolean", message: "Sì / No" });
    i18n._({ id: "field_type_enum", message: "Elenco a scelta" });
    i18n._({ id: "field_type_url", message: "Indirizzo web" });
    i18n._({ id: "field_type_date", message: "Data" });
    i18n._({ id: "field_type_dynamic_list", message: "Elenco chiave-valore" });
    i18n._({ id: "label_field_type", message: "Tipo di dato" });
    i18n._({ id: "label_field_options", message: "Valori ammessi (uno per riga)" });
    i18n._({ id: "placeholder_field_options", message: "pergamena\ncarta" });
    i18n._({ id: "label_field_required", message: "Obbligatorio: la scheda non si salva se è vuoto" });
    i18n._({ id: "label_field_unique", message: "Valore unico: avvisa se un'altra scheda ha lo stesso valore" });
    i18n._({ id: "btn_apply", message: "Applica" });
    i18n._({ id: "msg_enum_no_options", message: "Un elenco a scelta ha bisogno di almeno un valore." });
    i18n._({ id: "msg_link_non_valido", message: "Indirizzo non valido." });
    i18n._({ id: "err_field_required", message: "Il campo \"{var0}\" è obbligatorio." });
    i18n._({ id: "err_field_number", message: "Il campo \"{var0}\" deve contenere un numero." });
    i18n._({ id: "err_field_url", message: "Il campo \"{var0}\" deve essere un indirizzo web (https://…)." });
    i18n._({ id: "err_field_option", message: "Il valore del campo \"{var0}\" non è fra quelli previsti." });
    i18n._({ id: "warn_field_duplicate", message: "Attenzione: \"{var0}\" ha lo stesso valore di un'altra scheda ({var1})." });
    // --- Fase 3.4: tag come entità ---
    i18n._({ id: "tag_manager_title", message: "Gestione tag" });
    // Fase 2.4 — import CSV con mappatura colonne e dry-run
    i18n._({ id: "imp_title", message: "Importa da CSV" });
    i18n._({ id: "folders_empty_with_records", message: "Nessuna cartella ancora. Le {var0} schede stanno nella radice e le vedi qui accanto nell'elenco." });
    i18n._({ id: "folders_empty", message: "Nessuna cartella ancora. Le schede che crei restano nella radice finché non ne fai una." });
    i18n._({ id: "imp_step_model", message: "Dove finiscono queste schede?" });
    i18n._({ id: "imp_model_new", message: "Crea un modello nuovo" });
    i18n._({ id: "imp_model_new_desc", message: "I campi li costruisci dalle colonne del file, al passo successivo." });
    i18n._({ id: "imp_model_name", message: "Nome del modello" });
    i18n._({ id: "imp_model_name_missing", message: "Dai un nome al modello prima di continuare." });
    i18n._({ id: "field_locked", message: "Campo del modello predefinito: non si può togliere né cambiare." });
    i18n._({ id: "type_locked_note", message: "Questo è un modello predefinito: nome e campi d'origine non si cambiano — tornerebbero da soli al prossimo avvio. Puoi però aggiungere campi tuoi, modificarli ed eliminarli." });
    i18n._({ id: "type_name_locked", message: "Il nome di un modello predefinito non si cambia: è tradotto insieme all'applicazione." });
    i18n._({ id: "imp_header_row", message: "Riga con i nomi delle colonne" });
    i18n._({ id: "imp_mapped_count", message: "{var0} di {var1} colonne importate" });
    i18n._({ id: "imp_sample", message: "es." });
    i18n._({ id: "imp_dest_for", message: "Destinazione della colonna" });
    i18n._({ id: "imp_group_base", message: "Dati della scheda" });
    i18n._({ id: "imp_group_fields", message: "Campi dei modelli" });
    i18n._({ id: "imp_group_new", message: "Campi da creare" });
    i18n._({ id: "imp_new_field", message: "＋ Crea un campo nuovo…" });
    i18n._({ id: "imp_new_field_name", message: "Nome del campo" });
    i18n._({ id: "imp_new_field_type", message: "Tipo del campo" });
    i18n._({ id: "imp_new_field_invalid", message: "Nome non utilizzabile: è vuoto o coincide con un campo che esiste già." });
    i18n._({ id: "imp_new_fields", message: "Verranno aggiunti al modello {var0} i campi: " });
    i18n._({ id: "imp_state_new_p", message: "nuove" });
    i18n._({ id: "imp_state_updated_p", message: "aggiornate" });
    i18n._({ id: "imp_state_skipped_p", message: "scartate" });
    i18n._({ id: "imp_with_warnings", message: "con avvisi" });
    i18n._({ id: "imp_and_more", message: "…e altre {var0} righe." });
    i18n._({ id: "imp_menu", message: "Importa CSV" });
    i18n._({ id: "dialog_import_csv", message: "Importa da CSV" });
    i18n._({ id: "btn_import_zip_full", message: "Importa un backup ZIP di ArchiView" });
    i18n._({ id: "th_transcription", message: "Trascrizione" });
    i18n._({ id: "imp_read_error", message: "File non leggibile: " });
    i18n._({ id: "imp_empty", message: "Il file non contiene righe da importare." });
    i18n._({ id: "imp_rows_found", message: "{var0} righe" });
    i18n._({ id: "imp_delimiter", message: "separatore" });
    i18n._({ id: "imp_default_type", message: "Tipo di documento" });
    i18n._({ id: "imp_default_folder", message: "Cartella di destinazione" });
    i18n._({ id: "imp_update_existing", message: "Aggiorna le schede già presenti invece di aggiungerne di nuove" });
    i18n._({ id: "imp_mapping", message: "Colonne del file" });
    i18n._({ id: "imp_preview", message: "Anteprima" });
    i18n._({ id: "imp_skip", message: "— non importare —" });
    i18n._({ id: "imp_row", message: "riga {var0}" });
    i18n._({ id: "imp_state_new", message: "nuova" });
    i18n._({ id: "imp_state_updated", message: "aggiornata" });
    i18n._({ id: "imp_state_skipped", message: "scartata" });
    i18n._({ id: "imp_summary", message: "{var0} nuove, {var1} aggiornate, {var2} scartate, {var3} con avvisi." });
    i18n._({ id: "imp_new_folders", message: "Verranno creati {var0} archivi: " });
    i18n._({ id: "imp_confirm", message: "Importa {var0} schede" });
    i18n._({ id: "imp_nothing", message: "Niente da importare" });
    i18n._({ id: "imp_done", message: "Importate {var0} schede ({var1} aggiornate)." });
    i18n._({ id: "imp_hint", message: "Nulla viene scritto finché non premi Importa. Le righe scartate restano nel file: correggile e reimporta soltanto quelle. L'intero import si annulla con Ctrl+Z." });
    i18n._({ id: "imp_err_required", message: "campo obbligatorio mancante" });
    i18n._({ id: "imp_err_number", message: "non è un numero" });
    i18n._({ id: "imp_err_url", message: "non è un indirizzo valido" });
    i18n._({ id: "imp_err_option", message: "valore non fra quelli previsti" });
    i18n._({ id: "imp_err_boolean", message: "non è un sì/no riconoscibile" });
    i18n._({ id: "imp_err_type", message: "tipo di documento sconosciuto, si usa quello predefinito" });
    i18n._({ id: "imp_err_short", message: "la riga ha meno celle dell'intestazione" });
    i18n._({ id: "imp_err_dup", message: "segnatura già presente in archivio" });
    i18n._({ id: "imp_err_dup_file", message: "segnatura ripetuta dentro il file" });
    i18n._({ id: "undo_import_csv", message: "Import di {var0} schede" });
    // Fase 4 — cestino, snapshot locali, cronologia per scheda, undo/redo
    i18n._({ id: "trash_title", message: "Cestino" });
    i18n._({ id: "trash_select", message: "Seleziona questa scheda" });
    i18n._({ id: "trash_restore", message: "Ripristina" });
    i18n._({ id: "trash_delete_forever", message: "Elimina definitivamente" });
    i18n._({ id: "trash_empty", message: "Il cestino è vuoto." });
    i18n._({ id: "trash_empty_now", message: "Svuota il cestino" });
    i18n._({ id: "trash_read_error", message: "Il cestino non è leggibile." });
    i18n._({ id: "trash_selected", message: "{var0} selezionate" });
    i18n._({ id: "trash_restored", message: "{var0} schede ripristinate." });
    i18n._({ id: "trash_restore_none", message: "Nessuna scheda da ripristinare." });
    i18n._({ id: "trash_restore_error", message: "Ripristino non riuscito: " });
    i18n._({ id: "trash_delete_error", message: "Eliminazione non riuscita: " });
    i18n._({ id: "trash_confirm_delete_many", message: "Eliminare definitivamente {var0} schede? L'operazione non è annullabile." });
    i18n._({ id: "trash_confirm_delete_one", message: "Eliminare definitivamente questa scheda? L'operazione non è annullabile." });
    i18n._({ id: "trash_confirm_empty", message: "Svuotare il cestino? Tutte le schede eliminate andranno perse definitivamente." });
    i18n._({ id: "trash_emptied", message: "Cestino svuotato ({var0} schede)." });
    i18n._({ id: "trash_from_bulk", message: "Eliminazione multipla" });
    i18n._({ id: "trash_from_single", message: "Eliminazione" });
    i18n._({ id: "trash_hint", message: "Le schede eliminate restano qui per 30 giorni e poi spariscono da sole. Il cestino è locale a questo computer: non viene sincronizzato e non occupa spazio nell'archivio condiviso." });
    i18n._({ id: "record_untitled", message: "scheda senza titolo" });
    i18n._({ id: "btn_redo", message: "Ripeti" });
    i18n._({ id: "msg_nothing_to_redo", message: "Nessuna azione da ripetere." });
    i18n._({ id: "msg_ripetuto_var", message: "Ripetuto: {var0}" });
    i18n._({ id: "msg_errore_ripetizione", message: "Errore durante la ripetizione dell'azione." });
    i18n._({ id: "undo_edit_record", message: "Modifica di \"{var0}\"" });
    i18n._({ id: "undo_rename_folder", message: "Rinomina di \"{var0}\"" });
    i18n._({ id: "undo_restore_record", message: "Ripristino della scheda al {var0}" });
    i18n._({ id: "undo_move_records", message: "Spostamento di {var0} schede" });
    i18n._({ id: "undo_rename_attachment", message: "Rinomina di un allegato" });
    i18n._({ id: "undo_reorder_attachments", message: "Riordino degli allegati" });
    i18n._({ id: "shortcut_redo", message: "Ripeti l'azione annullata (anche Ctrl+Maiusc+Z)" });
    i18n._({ id: "snap_section_title", message: "Snapshot locali" });
    i18n._({ id: "snap_create_now", message: "Crea adesso" });
    i18n._({ id: "snap_create_now_hint", message: "Fotografa subito lo stato dell'archivio" });
    i18n._({ id: "snap_create_cmd", message: "Crea uno snapshot dell'archivio" });
    i18n._({ id: "snap_empty", message: "Nessuno snapshot: il primo viene creato da solo mentre lavori." });
    i18n._({ id: "snap_delete", message: "Elimina lo snapshot" });
    i18n._({ id: "snap_confirm_delete", message: "Eliminare questo snapshot? La cronologia locale di quel momento andrà persa." });
    i18n._({ id: "snap_created", message: "Snapshot creato." });
    i18n._({ id: "snap_create_failed", message: "Snapshot non creato: " });
    i18n._({ id: "snap_delete_failed", message: "Snapshot non eliminato: " });
    i18n._({ id: "snap_restored", message: "Archivio riportato allo snapshot: {var0} schede." });
    i18n._({ id: "snap_side_label", message: "NELLO SNAPSHOT" });
    i18n._({ id: "snap_reason_auto", message: "automatico" });
    i18n._({ id: "snap_reason_manual", message: "creato a mano" });
    i18n._({ id: "snap_reason_restore", message: "prima di un ripristino" });
    i18n._({ id: "snap_reason_import", message: "prima di un import" });
    i18n._({ id: "menu_record_history", message: "Cronologia" });
    i18n._({ id: "rec_history_title", message: "Cronologia della scheda" });
    i18n._({ id: "rec_history_loading", message: "Ricostruzione della cronologia…" });
    i18n._({ id: "rec_history_failed", message: "Cronologia non disponibile: " });
    i18n._({ id: "rec_history_empty", message: "Nessuno snapshot contiene questa scheda: la cronologia comincia dal primo snapshot." });
    i18n._({ id: "rec_history_absent", message: "scheda non presente" });
    i18n._({ id: "rec_history_restore", message: "Riporta la scheda a questa versione" });
    i18n._({ id: "rec_history_restored", message: "Scheda riportata alla versione del {var0}." });
    i18n._({ id: "rec_history_gone", message: "La scheda non è più in archivio: ripristinala dal cestino." });
    i18n._({ id: "rec_history_hint", message: "Le tappe sono ricavate dagli snapshot locali: compaiono solo i momenti in cui questa scheda è cambiata." });
    i18n._({ id: "settings_safety_title", message: "Cestino e snapshot" });
    i18n._({ id: "settings_safety_desc", message: "L'archivio viene fotografato periodicamente su questo computer, e le schede eliminate restano nel cestino prima di sparire. Nulla di tutto ciò viene sincronizzato." });
    i18n._({ id: "settings_snapshot_auto", message: "Crea snapshot automatici mentre lavoro" });
    i18n._({ id: "settings_snapshot_recenti", message: "Snapshot recenti" });
    i18n._({ id: "settings_snapshot_giorni", message: "Giorni di cronologia" });
    i18n._({ id: "settings_cestino_giorni", message: "Giorni nel cestino" });
    i18n._({ id: "tag_manager_hint", message: "Rinomina, fusione ed eliminazione agiscono su tutte le schede dell'archivio, non solo su quelle selezionate. Ogni operazione è annullabile." });
    i18n._({ id: "tag_rename", message: "Rinomina" });
    i18n._({ id: "tag_delete", message: "Elimina il tag" });
    i18n._({ id: "tag_select_for_merge", message: "Seleziona per la fusione" });
    i18n._({ id: "tag_merge_into", message: "Fondi i tag scelti in:" });
    i18n._({ id: "btn_tag_merge", message: "Fondi" });
    i18n._({ id: "tag_color_label", message: "Colore del tag" });
    i18n._({ id: "tag_color_none", message: "Nessuno" });
    i18n._({ id: "tag_color_ambra", message: "Ambra" });
    i18n._({ id: "tag_color_rosso", message: "Rosso" });
    i18n._({ id: "tag_color_verde", message: "Verde" });
    i18n._({ id: "tag_color_blu", message: "Blu" });
    i18n._({ id: "tag_color_viola", message: "Viola" });
    i18n._({ id: "tag_color_grigio", message: "Grigio" });
    i18n._({ id: "tag_count_one", message: "1 scheda" });
    i18n._({ id: "tag_count_many", message: "{var0} schede" });
    i18n._({ id: "undo_tag_rename", message: "Rinomina di un tag" });
    i18n._({ id: "undo_tag_merge", message: "Fusione di tag" });
    i18n._({ id: "undo_tag_delete", message: "Eliminazione di un tag" });
    i18n._({ id: "msg_tag_renamed", message: "Tag rinominato su {var0} schede." });
    i18n._({ id: "msg_tag_merged", message: "Tag fusi su {var0} schede." });
    i18n._({ id: "msg_tag_deleted", message: "Tag rimosso da {var0} schede." });
    i18n._({ id: "msg_tag_nothing", message: "Nessuna scheda modificata." });
    i18n._({ id: "msg_tag_rename_merges", message: "Un tag con questo nome esiste già: i due sono stati fusi." });
    i18n._({ id: "menu_tag_manager", message: "Gestione tag…" });
    // --- Fasi 3.3, 3.5 e 3.6: vocabolari, anagrafica, collegamenti, duplicati ---
    i18n._({ id: "vocab_title", message: "Vocabolari controllati" });
    i18n._({ id: "vocab_new", message: "Nuovo vocabolario" });
    i18n._({ id: "vocab_new_value", message: "Nuovo valore…" });
    i18n._({ id: "vocab_none", message: "Nessun vocabolario. Creane uno per condividere una lista di valori con tutto il gruppo." });
    i18n._({ id: "vocab_delete", message: "Elimina il vocabolario" });
    i18n._({ id: "vocab_remove_value", message: "Togli dall'elenco" });
    i18n._({ id: "vocab_used_by", message: "Schede che usano questo valore" });
    i18n._({ id: "vocab_own_values", message: "— valori scritti qui sotto —" });
    i18n._({ id: "vocab_add_inline", message: "Aggiungi un valore al vocabolario" });
    i18n._({ id: "vocab_hint", message: "Un vocabolario è condiviso da tutto l'archivio e viaggia con la sincronizzazione. Rinominare un valore lo aggiorna in tutte le schede; toglierlo dall'elenco non lo cancella dalle schede che lo contengono." });
    i18n._({ id: "label_field_vocab", message: "Prendi i valori da un vocabolario d'archivio" });
    i18n._({ id: "label_field_authority", message: "Alimenta l'anagrafica di" });
    i18n._({ id: "msg_vocab_exists", message: "Esiste già un vocabolario con questo nome." });
    i18n._({ id: "msg_vocab_renamed", message: "Valore rinominato su {var0} schede." });
    i18n._({ id: "msg_vocab_value_removed", message: "Valore tolto dall'elenco. Le schede che lo contengono lo conservano." });
    i18n._({ id: "msg_vocab_deleted", message: "Vocabolario eliminato. I campi che lo usavano conservano i valori come elenco proprio." });
    i18n._({ id: "undo_vocab_rename", message: "Rinomina di un valore" });
    i18n._({ id: "auth_title", message: "Persone e luoghi" });
    i18n._({ id: "auth_people", message: "Persone" });
    i18n._({ id: "auth_places", message: "Luoghi" });
    i18n._({ id: "auth_filter", message: "Filtra…" });
    i18n._({ id: "auth_type_none", message: "Nessuna" });
    i18n._({ id: "auth_type_persona", message: "Persone" });
    i18n._({ id: "auth_type_luogo", message: "Luoghi" });
    i18n._({ id: "auth_none", message: "Nessuna voce. Le persone e i luoghi si raccolgono dai campi marcati come tali nell'editor del tipo documento." });
    i18n._({ id: "auth_show_records", message: "Mostra le schede che la citano" });
    i18n._({ id: "auth_hint", message: "L'elenco si ricava dalle schede: non è un archivio parallelo. Rinominare una voce riscrive il nome in tutte le schede che lo citano, ed è il modo di unificare due grafie della stessa persona." });
    i18n._({ id: "undo_auth_rename", message: "Rinomina in anagrafica" });
    i18n._({ id: "msg_auth_renamed", message: "Nome aggiornato su {var0} schede." });
    i18n._({ id: "label_links", message: "Collegamenti ad altre schede" });
    i18n._({ id: "link_none", message: "Nessun collegamento." });
    i18n._({ id: "link_generic", message: "collegata a" });
    i18n._({ id: "link_choose", message: "— scegli una scheda —" });
    i18n._({ id: "link_add", message: "Aggiungi il collegamento" });
    i18n._({ id: "link_remove", message: "Togli il collegamento" });
    i18n._({ id: "link_missing", message: "scheda non presente in questa copia" });
    i18n._({ id: "no_signature", message: "Senza segnatura" });
    i18n._({ id: "undo_link_add", message: "Collegamento fra schede" });
    i18n._({ id: "undo_link_del", message: "Rimozione di un collegamento" });
    i18n._({ id: "msg_link_added", message: "Collegamento aggiunto." });
    i18n._({ id: "msg_link_removed", message: "Collegamento rimosso." });
    i18n._({ id: "dup_title", message: "Segnature ripetute" });
    i18n._({ id: "dup_none", message: "Nessuna segnatura ripetuta." });
    i18n._({ id: "dup_found", message: "{var0} segnature ripetute." });
    i18n._({ id: "dup_hint", message: "Una segnatura ripetuta non è per forza un errore: un fondo può contenerne per inventariazioni precedenti alla schedatura. L'elenco le segnala, la decisione resta a chi guarda." });
    i18n._({ id: "warn_signature_duplicate", message: "Attenzione: la segnatura \"{var0}\" è già usata da un'altra scheda ({var1} in tutto)." });
    i18n._({ id: "btn_add", message: "Aggiungi" });
    i18n._({ id: "link_panel_title", message: "Schede collegate" });
    i18n._({ id: "link_outgoing", message: "Questa scheda rimanda a" });
    i18n._({ id: "link_incoming", message: "È richiamata da" });
    i18n._({ id: "menu_links", message: "Collegate" });
    i18n._({ id: "filter_links", message: "Collegamenti" });
    i18n._({ id: "filter_has_links", message: "Con collegamenti" });
    i18n._({ id: "filter_no_links", message: "Senza collegamenti" });
    i18n._({ id: "graph_title", message: "Grafo dei collegamenti" });
    i18n._({ id: "menu_graph", message: "Grafo" });
    i18n._({ id: "graph_show_isolated", message: "Mostra anche le schede senza collegamenti" });
    i18n._({ id: "graph_relayout", message: "Ricalcola la disposizione" });
    i18n._({ id: "graph_summary", message: "{var0} schede, {var1} collegamenti, {var2} gruppi" });
    i18n._({ id: "graph_empty", message: "Nessuna scheda collegata. I collegamenti si aggiungono dal form della scheda, nel blocco \"Collegamenti ad altre schede\"." });
    i18n._({ id: "graph_truncated", message: "Mostrate le {var0} schede più collegate su {var1}: oltre questa soglia il grafo non si legge più." });
    i18n._({ id: "graph_hint", message: "Clic su un nodo per isolarlo con i suoi vicini, doppio clic per aprire la scheda. Trascina per spostare, rotella per lo zoom." });
    i18n._({ id: "graph_open_record", message: "Apri la scheda" });
    // Fase 3.7 — campi propri della scheda.
    i18n._({ id: "own_field_add", message: "Aggiungi un campo a questa scheda" });
    i18n._({ id: "own_field_title", message: "Aggiungi un campo a questa scheda" });
    i18n._({ id: "own_field_hint", message: "Il campo resta su questa scheda: il modello e le altre schede non cambiano." });
    i18n._({ id: "own_field_name", message: "Nome del campo" });
    i18n._({ id: "own_field_name_ph", message: "Filigrana" });
    i18n._({ id: "own_field_badge", message: "solo qui" });
    i18n._({ id: "own_field_badge_hint", message: "Campo di questa scheda: il modello non cambia." });
    i18n._({ id: "own_field_promote", message: "Aggiungi questo campo al modello" });
    i18n._({ id: "own_field_promoted", message: "Campo \"{var0}\" aggiunto al modello." });
    i18n._({ id: "own_field_remove", message: "Togli questo campo dalla scheda" });
    i18n._({ id: "own_field_remove_confirm", message: "Togliere il campo \"{var0}\" da questa scheda? Anche il suo valore verrà cancellato." });
    i18n._({ id: "own_field_bad_name", message: "Nome non valido o già usato in questa scheda." });
    i18n._({ id: "own_field_conflict", message: "Campi propri della scheda" });
    // Fase 3.8 — riordino dei campi della scheda.
    i18n._({ id: "reorder_fields", message: "Riordina i campi" });
    i18n._({ id: "reorder_done", message: "Fine riordino" });
    i18n._({ id: "reorder_hint", message: "Trascina per cambiare l'ordine dei campi. Vale solo per questa scheda." });
    i18n._({ id: "reorder_reset", message: "Ordine del modello" });
    i18n._({ id: "reorder_up", message: "Sposta su" });
    i18n._({ id: "reorder_down", message: "Sposta giù" });
    // Etichetta secondaria delle schede nell'albero
    i18n._({ id: "tree_label_title", message: "Etichetta secondaria delle schede" });
    i18n._({ id: "tree_label_heading", message: "Mostra sotto la segnatura" });
    i18n._({ id: "tree_label_none", message: "Nessuna" });
    i18n._({ id: "tree_label_auto", message: "Automatica (nome principale)" });
    i18n._({ id: "tree_sort_heading", message: "Ordina l’albero per" });
    i18n._({ id: "tree_sort_secondary", message: "Etichetta secondaria" });
}

// Wrapper per compatibilità con il codice esistente
const customEn = {
    // --- Etichetta secondaria delle schede nell'albero ---
    "tree_label_title": "Secondary label on records",
    "tree_label_heading": "Show under the shelfmark",
    "tree_label_none": "None",
    "tree_label_auto": "Automatic (main name)",
    "tree_sort_heading": "Sort the tree by",
    "tree_sort_secondary": "Secondary label",
    // Vedi la nota sul lessico in customIt: "archive" = vault, "folder" = albero interno.
    "msg_l_archivio_copiato_vuoto": "The copied folder is empty.",
    "th_folder": "Folder",
    "msg_folder_deleted": "Folder deleted.",
    "btn_create_folder": "Create folder",
    "hint_folder_name": "Tip: use the slash ( / ) to create subfolders automatically.",
    "label_folder_name": "Folder name or path",
    "modal_new_folder": "New folder",
    "folder_empty": "The folder is empty.",
    "btn_delete_folder": "Delete this folder",
    // --- Fase 1.1: ordinamento e vista tabellare ---
    "field_segnatura": "Shelfmark",
    "label_sort_by": "Sort by",
    "tooltip_sort_by": "Sort criterion for the list",
    "tooltip_sort_dir": "Reverse sort direction",
    "tooltip_sort_asc": "Ascending order: click to reverse",
    "tooltip_sort_desc": "Descending order: click to reverse",
    "tooltip_toggle_view": "Change display mode",
    "tooltip_view_grid": "Switch to card view",
    "tooltip_view_table": "Switch to table view",
    "th_tags": "Tags",
    "th_attachments": "Attachments",
    "th_modified": "Modified",
    "tooltip_columns": "Choose visible columns",
    "menu_columns": "Visible columns",
    "btn_new_model": "New model",
    "tooltip_new_record_type": "Choose the type of the new record",
    "menu_new_record_type": "New record of type",

    // --- Fase 1: passi del tutorial sulle funzioni della vista elenco ---
    "tut_sort_title": "Sorting and Table View",
    "tut_sort_desc": "The list can be sorted by shelfmark, by a field of the document type, by modification date or by number of attachments. This control switches between the card grid and the table view, where every column header is itself a sorting command and the visible columns are configurable per document type.",
    "tut_filters_title": "Advanced Filters and Saved Searches",
    "tut_filters_desc": "Besides full-text search, the list can be narrowed by document type, subfolders, modification date range, presence of attachments or of a transcription. The search box also accepts the field:value syntax (for example notaio:rossi). A combination of filters can be saved under a name and recalled later.",
    "tut_palette_title": "Quick Commands",
    "tut_palette_desc": "Ctrl+K opens the command list: from a single box you can reach a record, an archive, a new record of a specific type, or any other action of the application. The ? key shows the full list of available shortcuts. Both are also reachable from this menu.",
    "tut_viewer_title": "Image Analysis",
    "tut_viewer_desc": "The attachment preview supports zooming (mouse wheel or the + and − keys), panning, 90° rotation (R key) and fit to page or to width. The brightness, contrast and negative controls are meant for reading hard-to-decipher scripts. Alt+← and Alt+→ move through the attachments of the record.",

    // --- Fase 1.4: command palette e scorciatoie ---
    "cp_title": "Commands",
    "cp_placeholder": "Search a command, a record or a folder…",
    "cp_empty": "No matching command.",
    "cp_error": "Command failed.",
    "cp_group_actions": "Actions",
    "cp_group_records": "Go to record",
    "cp_group_folders": "Go to folder",
    "cp_search": "Search the archive",
    "cp_view_grid": "Switch to card view",
    "cp_view_table": "Switch to table view",
    "cp_changelog": "What’s new in this version",
    "cp_shortcuts": "Keyboard shortcuts",
    "cp_hint_move": "move",
    "cp_hint_run": "run",
    "cp_hint_close": "close",
    "untitled_record": "Untitled",
    "shortcut_group_general": "General",
    "shortcut_group_selection": "Selection",
    "shortcut_group_transcription": "Transcription",
    "shortcut_group_viewer": "Image viewer",
    "shortcut_palette": "Open the commands",
    "shortcut_help": "Show this list",
    "shortcut_search": "Jump to the search box",
    "shortcut_new": "New record",
    "shortcut_save": "Save the open record or transcription",
    "shortcut_undo": "Undo the last action",
    "shortcut_esc": "Close the topmost window, clear the search, or clear the selection",
    "shortcut_multi": "Add or remove a record from the selection",
    "shortcut_range": "Select the range up to the clicked record",
    "shortcut_menu": "Actions menu for the record or the folder",
    "shortcut_prev_att": "Previous attachment",
    "shortcut_next_att": "Next attachment",
    "shortcut_fullscreen": "Attachment full screen",
    "shortcut_zoom": "Zoom in or out",
    "shortcut_fit": "Fit to page",
    "shortcut_real": "Actual size (1:1)",
    "shortcut_rotate": "Rotate by 90° (with Shift: the other way)",
    "shortcut_pan": "Pan the image",

    // --- Fase 1.5: azioni in massa e scorciatoie sulla selezione ---
    "tut_bulk_title": "Actions on several records",
    "tut_bulk_desc": "Ctrl+click and Shift+click select several records, and Ctrl+A takes every result of the current filter, later pages included. The right-click menu then applies the action to the whole selection: moving to an archive, changing the document type, adding or removing tags, and replacing text in a field, with a preview of how many records are affected and the option to undo.",
    "bulk_move_title": "Move to a folder",
    "bulk_type_title": "Change document type",
    "bulk_type_hint": "Values of fields the new type does not define stay stored in the record, but will no longer appear in the form until the previous type is restored.",
    "bulk_tag_title": "Add or remove tags",
    "bulk_tag_add": "Add",
    "bulk_tag_remove": "Remove",
    "bulk_tag_ph": "E.g. parchment, notarial",
    "bulk_tag_hint": "Separate multiple tags with commas. Removal requires an exact tag match.",
    "bulk_replace_title": "Find and replace",
    "bulk_label_folder": "Destination folder",
    "bulk_label_type": "New type",
    "bulk_label_action": "Operation",
    "bulk_label_tags": "Tags",
    "bulk_label_field": "Field",
    "bulk_label_find": "Find",
    "bulk_label_replace": "Replace with",
    "bulk_field_signature": "Shelfmark",
    "bulk_field_tags": "Tags",
    "bulk_case": "Match case",
    "bulk_whole": "Whole words only",
    "bulk_preview": "{var0} records, {var1} occurrences.",
    "bulk_preview_empty": "Type the text to search for to see how many records would change.",
    "btn_apply": "Apply",
    "menu_select_all": "Select all results",
    "menu_bulk_on": "On {var0} records",
    "menu_bulk_on_one": "On this record",
    "cp_group_selection": "Selection",
    "msg_bulk_no_selection": "Select at least one record.",
    "msg_bulk_nothing": "No record was changed.",
    "msg_bulk_done": "{var0} records changed.",
    "msg_bulk_error": "Action failed.",
    "msg_bulk_moved": "{var0} records moved.",
    "msg_bulk_type": "Type changed on {var0} records.",
    "msg_bulk_tag_add": "Tags added to {var0} records.",
    "msg_bulk_tag_del": "Tags removed from {var0} records.",
    "msg_bulk_replaced": "Replacement applied to {var0} records.",
    "msg_selected_all": "{var0} records selected.",
    "undo_bulk_move": "Moving records",
    "undo_bulk_type": "Document type change",
    "undo_bulk_tag_add": "Adding tags",
    "undo_bulk_tag_del": "Removing tags",
    "undo_bulk_replace": "Find and replace",
    "shortcut_group_bulk": "Selected records",
    "shortcut_select_all": "Select all results, including later pages",
    "shortcut_deselect": "Clear the selection",
    "shortcut_edit": "Edit the selected record",
    "shortcut_copy": "Copy the selected records",
    "shortcut_cut": "Cut the selected records",
    "shortcut_paste": "Paste into the current folder",
    "shortcut_export_sel": "Export the selection to ZIP",
    "btn_export_csv": "Export Folder to CSV",
    "btn_export_tsv": "Export Folder to TSV",
    "menu_export_folder_csv": "Export folder to CSV",
    "bulk_export_csv": "Export selection to CSV",
    "bulk_export_tsv": "Export selection to TSV",
    "dialog_export_csv": "Export to CSV/TSV",
    "shortcut_export_sel_csv": "Export the selection to CSV",
    "col_id": "ID",
    "col_type": "Document type",
    "col_modified_by": "Modified by",
    "col_created_by": "Created by",
    "shortcut_delete_sel": "Delete the selected records",
    "shortcut_bulk_move": "Move the selection to a folder",
    "shortcut_bulk_type": "Change the document type of the selection",
    "shortcut_bulk_tag": "Add or remove tags on the selection",
    "shortcut_bulk_replace": "Find and replace in a field of the selection",

    // --- Fase 1.3: filtri avanzati e ricerche salvate ---
    "btn_filters": "Filters",
    "tooltip_filters": "Advanced filters and saved searches",
    "tooltip_filters_active": "Advanced filters ({var0} active)",
    "filter_type": "Type",
    "filter_subfolders": "Include subfolders",
    "filter_from": "From",
    "filter_to": "To",
    "filter_attachments": "Attachments",
    "filter_transcription": "Transcription",
    "filter_any": "Any",
    "filter_yes": "Yes",
    "filter_no": "No",
    "filter_has_attachments": "With attachments",
    "filter_no_attachments": "Without attachments",
    "filter_has_transcription": "With transcription",
    "filter_no_transcription": "Without transcription",
    "filter_remove_advanced": "Remove this filter",
    "filter_query_hint": "In the search box you can type field:value — for example notaio:rossi, tag:parchment, or \"exact phrase\".",
    "btn_clear_advanced": "Clear filters",
    "label_saved_searches": "Saved searches",
    "empty_saved_searches": "No saved searches.",
    "placeholder_saved_search": "Search name",
    "btn_save_search": "Save",
    "btn_delete_saved_search": "Delete this search",
    "msg_saved_search": "Search saved.",

    // --- Fase 1.2: visualizzatore immagini ---
    "tooltip_zoom_in": "Zoom in (+)",
    "tooltip_zoom_out": "Zoom out (-)",
    "tooltip_rotate_left": "Rotate left (Shift+R)",
    "tooltip_rotate_right": "Rotate right (R)",
    "tooltip_fit_page": "Fit page (0)",
    "tooltip_fit_width": "Fit width",
    "tooltip_zoom_real": "Actual size, 1:1 (1)",
    "tooltip_image_filters": "Brightness, contrast and negative",
    "tooltip_view_reset": "Reset the view",
    "label_brightness": "Brightness",
    "label_contrast": "Contrast",
    "label_invert": "Invert (negative)",

    // --- Zona 3: azioni di contesto + filtri attivi (UI_UX_TODO Fase 0/1) ---
    "btn_new_record": "New record",
    "btn_new_folder": "New folder",
    "btn_import": "Import",
    "tooltip_new_model": "Create a new document model",
    "tooltip_export_folder": "Export this folder to ZIP",
    "tooltip_delete_folder": "Delete this folder",
    "tooltip_delete_folder_not_empty": "You can only delete an empty folder",
    "tooltip_delete_folder_root": "The archive root cannot be deleted",
    "folder_root_label": "Root",
    "empty_no_folders": "No folders yet. Records stay in the root until you create one.",
    "tooltip_sharing": "Sharing and collaborators",
    "nav_panels": "Panels",
    "tooltip_save_record": "Save the record",
    "tooltip_back_to_list": "Back to the list",
    "tooltip_resize": "Drag to resize",
    "label_not_editable": "Not editable",
    "tutorial_invite_text": "Want a quick tour of the main features?",
    "btn_tutorial_start": "Yes, start",
    "btn_tutorial_dismiss": "No, thanks",
    "label_active_filters": "Active filters",
    "filter_search": "Search",
    "filter_remove_search": "Clear the search",
    "filter_remove_tag": "Remove this tag",
    "btn_clear_filters": "Clear all filters",
    "msg_export_success_count": "Export of {var0} records completed successfully!",
    "msg_import_success_count": "{var0} records imported successfully!",
    "msg_delete_count": "{var0} records deleted.",
    "msg_copied_count": "{var0} records copied to ArchiView clipboard. Right click to paste in another archive.",
    "msg_cut_count": "{var0} records cut. Right click to move them to another archive.",
    "msg_folder_copied": "Folder copied. Right click on another folder to paste it.",
    "msg_impossible_open_folder": "Cannot open folder in File Explorer.",
    "msg_folder_cut": "Folder cut. Right click to move it.",
    "msg_record_copied": "Record copied. Right click to paste it into a folder.",
    "msg_record_cut": "Record cut. Right click to move it to another archive.",
    "msg_archive_moved_success": "Archive moved successfully!",
    "msg_copied_archive_empty": "The copied archive is empty.",
    "msg_archive_dup_success": "Archive duplicated successfully ({var0} records)!",
    "msg_records_moved_success": "{var0} records moved successfully!",
    "msg_records_dup_success": "{var0} records duplicated successfully!",
    "msg_undone_action": "Undone: {var0}",
    "msg_removing_in_progress": "Removing {var0}...",
    "msg_removed_success": "{var0} was removed successfully.",
    "msg_error_during_remove": "Error during removal: {var0}",
    "msg_invite_sent_success": "Invite sent successfully to {var0}!",
    "msg_cleanup_completed": "Cleanup completed! Files removed: {var0} local, {var1} on Drive.",
    "msg_l_archivio_stato_sincro": "The archive has been synced in real-time.",
    "msg_benvenuto_nell_archivio_c": "Welcome to the Shared Archive! Sign in to Google Drive to download data.",
    "msg_esportazione_completata_c": "Export completed successfully!",
    "msg_errore_in_esportazione": "Error during export: ",
    "msg_l_archivio_vuoto_nulla_da": "The folder is empty, nothing to export.",
    "msg_errore_in_importazione": "Error during import: ",
    "msg_errore_in_duplicazione_ar": "Error during archive duplication: ",
    "msg_errore_in_incolla": "Error pasting: ",
    "msg_nessuna_azione_da_annulla": "No actions to undo.",
    "msg_errore_durante_l_annullam": "Error during undo.",
    "msg_il_documento_corrente_sta": "The current document was deleted by another user.",
    "msg_caricamento_revisione": "Loading revision...",
    "msg_revisione_vuota_o_non_val": "Empty or invalid revision.",
    "msg_nessuna_differenza_rispet": "No difference compared to the current version.",
    "msg_errore_nel_caricamento_de": "Error loading revision: ",
    "msg_vault_ripristinato_alla_v": "\u2705 Vault restored to the selected version!",
    "msg_errore_durante_il_riprist": "Error during restore: ",
    "msg_segnalazione_inviata_con_": "Report sent successfully!",
    "msg_errore_durante_l_invio_de": "Error sending report.",
    "msg_errore_di_rete_durante_l_": "Network error during send.",
    "msg_funzionalit_non_disponibi": "Feature not available.",
    "msg_errore": "Error: ",
    "msg_dlg_cambia_account_google": "Change Google Account",
    "msg_dlg_questo_forzer_l_uso_d": "This will force the use of a specific Google account ONLY for this Archive. Do you want to proceed?",
    "msg_codice_copiato_negli_appu": "Code copied to clipboard!",
    "msg_errore_durante_la_pulizia": "Error during cleanup: ",
    "msg_sincronizzazione_annullat": "Sync cancelled. Restoring local version.",
    "msg_nessuna_modifica_rilevata": "No changes detected in main fields.",
    "msg_autenticazione_e_ricerca_": "Authenticating and searching for archives...",
    "msg_errore_cloud": "Cloud Error: ",
    "msg_compila_tutti_i_campi": "Please fill all fields.",
    "msg_connessione_all_archivio_": "Connecting to Archive...",
    "msg_connesso_con_successo_ria": "Connected successfully! Restarting...",
    "msg_scaricamento_archivio": "Downloading archive...",
    "msg_nessun_database_trovato_n": "No database found in the selected Archive.",
    "msg_archivio_scaricato_selezi": "Archive downloaded! Select where to save it on your PC.",
    "msg_archivio_ripristinato_con": "Archive restored successfully! Restarting...",
    "msg_attenzione_l_allegato_pot": "Warning: the attachment might be corrupted or modified (Hash mismatch).",
    "msg_ci_sono_nuovi_aggiornamen": "There are new updates to download!",
    "msg_nessun_nuovo_aggiornament": "No new updates found.",
    "msg_errore_durante_il_fetch": "Error during fetch: ",
    "msg_apri_il_browser_per_compl": "Open browser to complete sign-in...",
    "msg_autenticazione_completata": "Authentication completed!",
    "msg_errore_durante_l_autentic": "Error during authentication",
    "msg_disconnesso_da_google_dri": "Disconnected from Google Drive.",
    "msg_sincronizzazione_completa": "Sync completed successfully!",
    "msg_conflitto_sul_cloud_un_al": "Cloud conflict: another user saved. Auto-merging...",
    "msg_conflitto_risolto_sincron": "Conflict resolved! Sync completed safely.",
    "msg_errore_durante_la_risoluz": "Error during conflict resolution: ",
    "msg_errore_durante_la_sincron": "Error during sync: ",
    "msg_scaricamento_completato": "Download completed!",
    "msg_errore_durante_lo_scarica": "Error downloading: ",
    "msg_caricamento_completato_in": "Upload completed safely!",
    "msg_conflitto_risolto_caricam": "Conflict resolved! Upload completed safely.",
    "msg_errore_durante_il_caricam": "Error uploading: ",
    "msg_l_archivio_ora_scollegato": "The Archive is now unlinked and strictly local.",
    "msg_errore_durante_la_disconn": "Error disconnecting from cloud: ",
    "msg_questo_archivio_non_colle": "This archive is not connected to a Hub repository.",
    "msg_ricezione_modifiche_dall_": "Receiving changes from Hub...",
    "msg_nessuna_nuova_modifica_su": "No new changes on server. You are up to date.",
    "msg_dati_scaricati_e_fusi_con": "Data downloaded and merged locally successfully.",
    "msg_attenzione_rilevati_confl": "Warning: Sync conflicts detected from server. Click 'Receive' to resolve.",
    "msg_attenzione_alcuni_file_so": "Warning: Some files were deleted on the server. Click 'Receive' to check.",
    "msg_dati_sincronizzati_automa": "Data automatically synced from server.",
    "msg_invio_modifiche_al_server": "Sending changes to server...",
    "msg_il_server_contiene_modifi": "The server has more recent changes. Use 'Receive' to update your archive before sending.",
    "msg_modifiche_inviate_con_suc": "Changes sent successfully!",
    "msg_sincronizzazione": "Syncing...",
    "msg_connessione_al_repository": "Connecting to repository...",
    "msg_seleziona_il_percorso_in_": "Select the path to download the archive.",
    "msg_archivio_clonato_con_succ": "Archive cloned successfully! Restarting...",
    "msg_impostazioni_cloud_salvat": "Cloud settings saved.",
    "msg_nome_collaboratore_salvat": "Collaborator name saved.",
    "msg_directory_allegati_locale": "Local attachments directory configured successfully.",
    "msg_la_directory_degli_allega": "The attachments directory was reset to its default (inside the archive).",
    "dialog_select_folder": "Select the location for the new folder",
    "dialog_export_zip": "Export Backup as ZIP",
    "dialog_import_zip": "Import JSON Archive",
    "btn_procedi": "Proceed",
    "modal_folder_title": "Archives Management",
    "welcome_desc_gestione": "Choose a destination folder to create a new independent archive, or select an existing archive to load its data.",
    "btn_open_local": "Open Local Archive",
    "btn_create_local": "Create New Local Folder",
    "btn_create_cloud_private": "Create a Personal Backup",
    "btn_backup_private": "Personal Backup",
    "btn_convert_backup_private": "Convert to Personal Backup",
    "btn_create_shared": "Create a Shared Archive",
    "btn_join_shared": "Join a Shared Archive",
    "btn_restore_drive": "Restore from Google Drive...",
    "label_archive_name": "Archive Name",
    "placeholder_archive_name": "E.g. Manuscripts Archive",
    "label_position": "Location",
    "btn_browse": "Browse...",
    "btn_go_back": "Go Back",
    "btn_create_and_start": "Create and Start",
    "welcome_desc_join": "By joining via code you will access a shared Cloud on the original creator's Google Drive. Any local changes will sync directly with the other members.",
    "label_invite_code": "Invite Code",
    "placeholder_invite_code": "Paste the code here...",
    "label_archive_name_colon": "Archive Name:",
    "label_local_archive_pos": "Local archive location",
    "btn_connect": "Connect",
    "title_select_cloud_archive": "Select an Archive from the Cloud",
    "msg_no_archive_found_drive": "No Archive found in the ArchiView folder on your Drive.",
    "label_modified": "Modified:",
    "btn_search_everywhere": "Search Everywhere",
    "title_search_everywhere": "If you don't see your archive, search all of Drive",
    "prog_prep_title": "Preparation in progress",
    "prog_prep_auth": "Authenticating with Google Drive...",
    "prog_conf_title": "Configuration in progress",
    "prog_conf_shared": "Setting up Archive as shared...",
    "prog_sync_title": "Syncing",
    "prog_sync_merge": "Uploading and merging data on Cloud (this may take a while)...",
    "prog_conf_backup": "Setting up Personal Backup...",
    "prog_disc_title": "Disconnecting",
    "prog_disc_desc": "Disabling Cloud synchronization...",
    "prog_auth_title": "Authentication in progress",
    "prog_auth_desc1": "Sign in with your desired Google account in the browser...",
    "prog_auth_desc2": "Sign in with the new account in the browser...",
    "prog_invite_title": "Sending invite",
    "prog_invite_desc": "Assigning permissions on Google Drive...",
    "prog_prep_cloud": "Starting cloud configuration...",
    "confirm_disc_cloud": "Do you really want to disconnect this Archive from the Cloud? The data will remain saved on your computer, but will no longer be synced online and the app will return to local-only mode.",
    "confirm_pull_no_fetch": "Warning: you are about to download changes from the Cloud without verifying what they are (Fetch) first. Proceed anyway?",
    "confirm_disc_cloud_short": "Do you really want to disconnect this Archive from the Cloud?\nData will remain saved on your computer, but will no longer be synced online.",
    "confirm_join_shared": "Do you want to close the current Archive to join a new Shared Archive? Unsaved local changes may be lost.",
    "confirm_delete_multiple": "Are you sure you want to delete the {var0} selected records? This operation is irreversible.",
    "confirm_delete_single": "Are you sure you want to delete this record? This operation is irreversible.",
    "confirm_delete_multiple_cloud": "You deleted {var0} records from your archive. Are you sure you want to permanently delete them from the shared cloud as well?",
    "confirm_delete_single_cloud": "You deleted a record from your archive. Are you sure you want to permanently delete it from the shared cloud as well?",
    "confirm_delete_archive_empty": "Are you sure you want to delete the folder \"{var0}\"? All empty subfolders will be removed.",
    "confirm_delete_archive_with_docs": "The folder \"{var0}\" contains {var1} documents. Deleting it will also delete every document inside it. Do you want to proceed?",
    "confirm_delete_model": "Are you sure you want to delete this model?",
    "confirm_tutorial_demo": "You are about to load the Demo archive. The current archive will be closed. Do you want to proceed?",
    "label_invite_code_opt": "Invite Code",
    "label_optional": "(optional)",
    "label_authorize_folder": "Authorize Folder Access",
    "desc_picker_required": "Open Drive and select the shared folder. This grants access without giving full app permissions.",
    "btn_browse_drive": "Browse Google Drive...",
    "label_selected_archive": "Selected:",
    "msg_picker_required": "First open Google Drive with the Browse button to authorize access to the shared folder.",
    "msg_selezione_annullata": "Selection cancelled.",
    "msg_seleziona_percorso": "Select a local location for the archive.",
    "cloud_step1_title": "Grant Access to Google Drive",
    "cloud_step1_desc": "The collaborator will receive an email from Google authorizing access to the shared folder.",
    "cloud_step2_title": "Share the ArchiView Link",
    "cloud_step2_desc": "The collaborator pastes this link in ArchiView to complete setup and enable real-time sync.",
    "cloud_step2_hint": "The recipient goes to <em>Join an Archive</em> and pastes this link in the Step 1 field.",
    "confirm_use_another_account": "You will be redirected to the browser to sign in with another Google account. This account will be used ONLY for this shared Archive. Do you want to proceed?",
    "cloud_no_members": "No members found.",
    "cloud_role_owner": "Owner",
    "cloud_role_collaborator": "Collaborator",
    "btn_remove_access": "Remove Access",
    "cloud_user_fallback": "User",
    "confirm_remove_access": "Are you sure you want to remove access for {var0}?",
    "cloud_invite_email_desc": "Enter the Google email address of the person to invite to the Archive:",
    "confirm_clean_orphans_desc": "This operation will permanently delete from your PC and Google Drive all attachments no longer associated with any record in the current database. This cannot be undone. Do you want to proceed?",
    "btn_delete_orphans": "Delete orphan files",
    "cloud_cleaning_in_progress": "Cleaning in progress...",
    "modal_cloud_title_backup": "Personal backup on Google Drive",
    "modal_cloud_title_shared": "Shared archive on Google Drive",
    "cloud_shared_hint": "Drive permissions cannot be revoked individually: anyone with the link keeps access. Switch to a shared archive for revocable invites.",
    "cloud_status_type": "Type",
    "cloud_status_type_backup": "Personal backup",
    "cloud_status_type_shared": "Shared archive (legacy)",
    "cloud_status_account": "Account",
    "cloud_status_last_sync": "Last sync",
    "btn_syncing": "Syncing...",
    "btn_activating": "Activating...",
    "a11y_sync_attachments_on": "Attachment sync enabled",
    "a11y_sync_attachments_off": "Attachment sync disabled",
    "a11y_operation_done": "Operation finished",
    "merge_conflict_modal_title": "Sync Conflicts Detected",
    "merge_conflicts_to_resolve": "Conflicts to resolve:",
    "merge_all_resolved": "All conflicts have been resolved!",
    "btn_cancel_sync": "Cancel Synchronization",
    "btn_apply_resolution": "Apply Resolution",
    "merge_badge_resolved": "Resolved",
    "merge_badge_pending": "pending",
    "merge_select_version_desc": "Select the correct version for each field modified by both users.",
    "merge_choice_registered": "Choice registered",
    "merge_local_label": "Your Change (Local)",
    "btn_keep_mine": "Keep mine",
    "merge_cloud_label": "Cloud Change (Server)",
    "btn_use_this": "Use this",
    "merge_field_empty": "Empty",
    "merge_rich_transcription": "(Rich Transcription)",
    "merge_no_attachments": "No attachments",
    "join_step1_hint": "Paste the archiview://join/... link received from the organizer.",
    "join_step2_hint": "First <strong>accept the sharing email from Google Drive</strong>. The folder will appear in <em>\"Shared with me\"</em>.",
    "join_step3_hint": "Choose where to save the local copy of the archive on your PC.",
    "join_code_ok_suffix": "— now click \"Browse Google Drive\" to authorize access.",
    "join_code_invalid": "Invalid code. Make sure you copied the complete text.",
    "msg_error_creating_files": "Error creating local files.",
    "btn_creating": "Creating...",
    "label_loading": "Loading...",
    "tooltip_expand_editor": "Expand Editor",
    "btn_rename_short": "Rename",
    "attachment_not_local_title": "Attachment not found locally",
    "attachment_not_local_desc1": "This archive is shared. The attachment file is not yet present on your PC.",
    "attachment_not_local_desc2": "Use Cloud Explorer to sync attachments.",
    "attachment_file_label": "File to insert:",
    "attachment_copy_hint": "Copy the file to your attachments folder:",
    "attachment_unsafe_title": "Unsafe file",
    "attachment_unsafe_desc": "The file hash does not match the one saved in the cloud.",
    "attachment_image": "Image",
    "settings_personal_backup_title": "Personal Backup",
    "settings_personal_backup_desc": "This local archive is synced privately as a backup on your Google Drive.",
    "sidebar_no_pending": "No pending changes",
    "sidebar_incoming_cloud": "INCOMING (CLOUD)",
    "sidebar_local_label": "LOCAL",
    "sidebar_click_to_show": "Click to show changes",
    "sidebar_from": "from ",
    "sidebar_from_colon": "from: ",
    "sidebar_from_cloud_title": "Cloud change sent by {var0}. Do a Fetch/Download to see it.",
    "sidebar_structural_updates": "Structural updates",
    "sidebar_structural_hint": "There are structural changes (e.g. folders or removals). Click Download on the top right.",
    "history_compare_now": "Compare with current",
    "history_restore_version": "Restore to this version",
    "history_no_revisions": "No revisions found. Upload to Cloud at least once.",
    "history_click_hint": "Click a version to compare or restore.",
    "history_not_connected": "Connect to Google Drive to see the history.",
    "history_loading": "Loading history...",
    "search_results_title": "Global Search Results",
    "title_edit_record": "Edit Record",
    "btn_save_changes": "Save Changes",
    "type_modal_edit_title": "Edit Document Type",
    "placeholder_key": "Key",
    "placeholder_value": "Value",
    "diff_before": "BEFORE",
    "diff_after": "AFTER",
    "diff_field": "Field:",
    "diff_empty": "(Empty)",
    "diff_in_revision": "IN REVISION",
    "diff_current_version": "CURRENT VERSION",
    "counter_documents_found": "Documents found: {var0}",
    "counter_documents": "Documents: {var0}",
    "attachment_count_one": "1 attached document",
    "attachment_count_many": "{var0} attached documents",
    "tooltip_export": "Export",
    "tooltip_rename": "Rename",
    "tooltip_remove": "Remove",
    "tooltip_move_up": "Move up",
    "tooltip_move_down": "Move down",
    "tooltip_delete": "Delete",
    "cloud_action_enable_short": "Enable cloud",
    "cloud_action_connect_short": "Connect",
    "cloud_action_retry": "Retry",
    "cloud_action_receive": "Receive",
    "cloud_action_send": "Send",
    "cloud_action_check": "Check",
    "cloud_action_fetch": "Check for updates",
    "cloud_click_hint": "click for the sync actions",
    "tooltip_click_for_actions": "Click for available actions",
    "tooltip_click_show_changes": "Click to show the changes",
    "tooltip_remove_from_list": "Remove from the list",
    "modal_vault_remove_title": "Remove archive",
    "modal_vault_remove_desc": "Do you want to remove the archive {var0} from the list only, or permanently delete all its files from this computer?",
    "btn_vault_delete_files": "Yes, delete the files too",
    "btn_vault_remove_list": "Remove from the list only",
    "cloud_state_local_only": "Local only",
    "cloud_state_syncing": "Syncing…",
    "cloud_state_offline": "Offline",
    "cloud_state_error": "Sync error",
    "cloud_state_disconnected": "Not connected",
    "cloud_state_incoming": "Incoming updates",
    "cloud_state_incoming_n": "{var0} incoming",
    "cloud_state_pending": "Local changes to upload",
    "cloud_state_pending_n": "{var0} to upload",
    "cloud_state_synced": "Synced",
    "cloud_action_enable": "Enable cloud for this archive",
    "cloud_action_connect": "Connect cloud account",
    "cloud_action_view_changes": "View changes",
    "cloud_action_history": "Version history",
    "cloud_busy_hint": "Sync in progress",
    "cloud_disconnected_hint": "Cloud account not connected",
    "tut_cloud_sync_desc": "This one line shows the state of the remote archive: synced, incoming updates, or local changes to upload. Clicking it opens Fetch, Download, Upload and the link to Source Control.",
    "menu_edit_record": "Rename / Edit",
    "menu_copy": "Copy",
    "menu_cut": "Cut",
    "menu_paste": "Paste",
    "menu_paste_here": "Paste here",
    "menu_paste_folder_here": "Paste folder here",
    "menu_new_record_here": "New record here",
    "menu_new_folder_here": "New folder here",
    "menu_rename_folder": "Rename folder",
    "menu_open_in_explorer": "Open in File Explorer",
    "menu_copy_folder": "Copy folder",
    "menu_cut_folder": "Cut folder",
    "menu_delete_folder": "Delete folder",
    "tooltip_more_actions": "More actions",
    "tooltip_folder_actions": "Folder actions",
    "btn_clear_selection": "Clear selection",
    "selection_count_one": "1 record selected",
    "selection_count_many": "{var0} records selected",
    "vault_type_shared": "Shared",
    "vault_type_backup": "Personal Backup",
    "vault_type_local": "Local",
    "msg_record_non_in_vista": "Document not visible in the current view.",
    "btn_sending": "Sending...",
    "settings_drive_not_connected": "Not Connected",
    "settings_drive_status_error": "Status check error",
    "tooltip_import": "Import Record Set (from ZIP)",
    "tooltip_add_folder": "Create a new folder",
    "tooltip_cloud_sync": "Cloud & Sync",
    "tooltip_back": "Back to list",
    "placeholder_tags": "Filter tags...",

    // === CONDIVISIONE (redesign) ===
    "share_title": "Sharing",
    "share_local_title": "Share this archive",
    "share_local_desc": "Create a free shared archive to work together with your colleagues, or join an existing one with an invite link.",
    "share_local_share_online": "Share online",
    "share_local_create_hub": "Create shared Hub",
    "share_local_have_invite": "I received an invite",
    "share_local_backup_link": "Just want a private backup copy? Backup on Google Drive",
    "modal_cloud_activate_desc_short": "A private copy of the archive on your Google Drive, accessible only to you.",
    "cloud_local_share_link": "Want to work on it together with colleagues instead? Share the archive",
    "btn_cloud_login": "Sign in to Google Drive",
    "modal_cloud_relink_title": "Link to an existing archive on Drive",
    "modal_cloud_relink_desc": "Choose the Drive folder this archive should sync with. Use this if another PC already works on an archive you can't see here.",
    "btn_relink_drive_vault": "Link to an existing archive on Drive",
    "label_currently_linked": "Linked",
    "msg_ricerca_archivi_drive": "Searching for archives on your Drive...",
    "msg_archivio_collegato": "Archive linked. Syncing...",
    "msg_nessun_db_sul_cloud": "No database found on the Cloud: the local copy will be uploaded. If this archive already exists on another PC, check from the Cloud menu that you are linked to the same Drive folder.",
    "share_migrate_panel_title": "Switch to a shared archive?",
    "share_migrate_bullet1": "The archive stays exactly as it is on your PC.",
    "share_migrate_bullet2": "The Google Drive backup remains as a safety copy.",
    "share_migrate_bullet3": "Current collaborators will need a new invite link.",
    "btn_continue": "Continue",
    "share_badge_member": "Collaborator",
    "share_badge_owner": "Owner",
    "share_member_note": "This archive is shared with you. Only the owner can invite or remove collaborators.",
    "share_sync_title": "Synchronization",
    "share_sync_desc": "Download others' changes or send yours to the shared archive.",
    "share_receive": "Receive changes",
    "share_send": "Send changes",
    "share_sync_receive_desc": "Download your colleagues' updates",
    "share_sync_send_desc": "Publish your changes",
    "share_last_update": "Last update: {var0}",
    "share_last_update_unknown": "Last update: unknown",
    "share_attachments_label": "Also share attachments (images and PDFs)",
    "share_attachments_status_on": "Attachments are shared through your Google Drive.",
    "share_attachments_connect_title": "To share images and PDFs you need to connect Google Drive",
    "share_attachments_connect_desc": "Free space on your Google account, used only for your own attachments.",
    "share_attachments_connect_btn": "Connect Google Drive",
    "share_attachments_member_off_note": "The owner hasn't turned on attachment sharing yet.",
    "share_member_leave": "Leave this shared archive",
    "share_member_leave_confirm": "Your PC will keep a local copy, but you will no longer receive your colleagues' updates.",
    "share_invite_title": "Invite a collaborator",
    "share_invite_desc": "Create a personal invite link. Each link creates a collaborator you can revoke at any time.",
    "share_invite_label_ph": "Collaborator's name (e.g. Maria)",
    "share_invite_generate": "Create invite link",
    "share_invite_hint": "Whoever receives the link needs ArchiView installed: they just click it.",
    "share_members_title": "Collaborators",
    "share_members_empty": "No collaborators yet. Create an invite link above.",
    "share_chip_revoked": "Revoked",
    "share_revoke_confirm": "Revoke this collaborator's access? Their invite link will stop working.",
    "share_invite_copied": "Link copied. Send it to {var0} by email or message.",
    "share_invite_copied_generic": "Link copied. Send it to your collaborator by email or message.",
    "share_invite_generated": "Invite created. Copy the link and share it.",
    "share_sync_settings": "Synchronization settings",
    "share_version": "v",
    "share_widget_btn": "Share",
    "btn_copy": "Copy",
    "btn_revoke": "Revoke",
    "btn_manage_share": "Manage sharing",
    "btn_open_share": "Open Sharing",
    "btn_create_hub_shared": "Create a Shared Hub",
    "cloud_backup_hint": "This is a personal backup on your private Cloud. To collaborate with others, use a shared archive instead.",
    "modal_cloud_shared_legacy_desc": "Shared archive on Google Drive (legacy). Switch to the shared archive for revocable invites and real-time sync.",
    "hub_widget_label": "Hub:",
    "hub_widget_receive": "Receive",
    "hub_widget_send": "Send",
    "hub_invite_default_label": "Invite",
    "msg_membro_revocato": "Access revoked.",
    "msg_errore_revoca": "Error during revocation.",
    "btn_pull": "Receive changes",
    "btn_push": "Send changes",
    "hub_fallback_name": "Shared archive",
    "vault_type_hub": "Shared Hub",
    "share_local_name_label": "Archive name (all collaborators will see it)",
    "share_local_name_ph": "e.g. Datini Manuscripts",
    "modal_cloud_hub_active": "Shared Hub Active",
    "modal_cloud_hub_desc": "This Archive is synced on the shared Hub. Use \"Manage sharing\" for invites and collaborators.",
    "settings_hub_manage_hint": "Invites, collaborators, attachments and automatic sync are managed from the Sharing panel.",
    "settings_sync_none": "No cloud synchronization (Hub or Google Drive) configured for this workspace.",
    "btn_export_folder": "Export Folder",
    "btn_create_hub": "Shared Hub (recommended for collaboration)",
    "btn_migrate_hub": "Switch to shared archive",
    "msg_creazione_repository": "Preparing your shared archive...",
    "msg_repository_creato": "Shared archive ready! You can now invite collaborators.",
    "msg_errore_creazione_repo": "Failed to create the shared archive.",
    "msg_errore_creazione_repo_generic": "Error while creating the shared archive.",
    "msg_timeout_creazione_repo": "Hub unreachable (timeout). Please try again later.",
    "msg_allegati_sincronizzati": "Attachments synced.",
    "msg_allegati_non_disponibili": "Some attachments are unavailable (the owner hasn't uploaded them yet or the link has expired).",
    "msg_il_server_contiene_modifi_action": "A colleague just saved some changes. Receive them, then try sending again.",
    "share_conflict_action_label": "Receive now",
    "prog_hub_prepare_title": "Preparing your shared archive",
    "prog_hub_prepare_desc": "Just a moment...",
    "msg_connesso_con_successo_nome": "Connected successfully to \"{var0}\"! Restarting...",
    "msg_update_offline": "No Internet connection: cannot check for updates.",
    "msg_update_no_release": "No published release found on GitHub.",
    "msg_update_rate_limited": "Too many requests to GitHub, try again in a few minutes.",
    "msg_update_generic": "Error during update: ",
    "btn_release_notes": "What's new in this version",
    "modal_release_notes_title": "Release notes",
    "msg_no_release_notes": "No release notes available for this version.",

    // --- Fase 2.3: OCR degli allegati ---
    // --- Menu contestuali: etichette corte ---
    "menu_edit_short": "Edit",
    "menu_ocr_short": "Recognise text",
    "menu_export_zip": "Export ZIP",
    "menu_export_csv": "Export CSV",
    "menu_export_tsv": "Export TSV",
    "menu_print_short": "Print",
    "menu_bulk_move": "Move",
    "menu_bulk_type": "Change type",
    "menu_bulk_tag": "Edit tags",
    "menu_bulk_replace": "Replace",
    "menu_bulk_ocr": "OCR",
    "menu_select_all_short": "Select all",
    "menu_new_record_short": "New record",
    "menu_new_folder_short": "New folder",
    "menu_rename_short": "Rename",
    "menu_explorer_short": "File explorer",
    "bulk_export_zip_full": "Export the selection as ZIP",

    // --- Fase 2.2: stampa e PDF ---
    "print_title": "Print and PDF",
    "print_scope": "What to print",
    "print_scope_selection": "Selected records",
    "print_scope_current": "Open record",
    "print_scope_results": "Current results",
    "print_scope_folder": "Current folder",
    "print_scope_all": "Whole archive",
    "print_layout": "Format",
    "print_layout_card": "Single record sheet",
    "print_layout_card_desc": "One record per page, with every field, the attachments as thumbnails and the transcription.",
    "print_layout_regest": "Regest / inventory",
    "print_layout_regest_desc": "Ordered list: shelfmark, date and summary of the content. This is the format of a printed inventory.",
    "print_layout_table": "Tabular list",
    "print_layout_table_desc": "The columns of the table view, one row per record.",
    "print_fund": "Fonds",
    "print_fund_ph": "e.g. ASP, Notarile",
    "print_author": "Catalogued by",
    "print_author_ph": "Name and surname",
    "print_date": "Date",
    "print_date_ph": "e.g. June 2026",
    "print_opt_cover": "Title page",
    "print_opt_pages": "Page numbers",
    "print_opt_thumbs": "Attachment thumbnails",
    "print_opt_transcription": "Include the transcription",
    "print_opt_empty": "Show empty fields too",
    "print_orientation": "Orientation",
    "print_portrait": "Portrait",
    "print_landscape": "Landscape",
    "print_count": "{var0} records to print.",
    "print_current_view": "Print the view",
    "print_send": "Print",
    "print_save_pdf": "Save PDF",
    "print_empty": "There is no record to print.",
    "print_working": "Preparing the document…",
    "print_sent": "Document sent to the printer.",
    "print_saved": "PDF saved.",
    "print_failed": "Printing failed: ",
    "print_cmd_regest": "Print the regest of the folder",
    "print_cmd_selection": "Print the selection",
    "menu_print_folder": "Print folder",
    "dialog_print_pdf": "Save as PDF",
    "shortcut_print": "Print or save as PDF",
    "print_doc_title": "Catalogue",
    "print_cover_fund": "Fonds",
    "print_cover_author": "Catalogued by",
    "print_cover_date": "Date",
    "print_cover_count": "Records",
    "print_section_transcription": "Transcription",
    "print_section_attachments": "Attachments",
    "print_no_records": "No record to print.",
    "print_untitled": "No shelfmark",

    // --- Fasi 2.5 e 2.6: export della trascrizione e citazioni ---
    "tx_title": "Export text and citations",
    "tx_scope": "What to export",
    "tx_format": "Format",
    "tx_group_text": "The transcription text",
    "tx_group_citation": "The bibliographic citation",
    "tx_fmt_html_desc": "Self-contained page, opens in any browser and can be attached to a message.",
    "tx_fmt_md_desc": "Plain text with the formatting preserved: for Obsidian, Pandoc, GitHub.",
    "tx_fmt_rtf_desc": "Opens in Word and LibreOffice keeping italics, bold and notes.",
    "tx_fmt_bibtex_desc": "@misc entry for LaTeX, Zotero and JabRef.",
    "tx_fmt_ris_desc": "Exchange format of Zotero, EndNote and Mendeley.",
    "tx_opt_header": "Header with shelfmark, dates and archive",
    "tx_count": "{var0} records, {var1} of them with a transcription.",
    "tx_count_citations": "{var0} citations to export.",
    "tx_export": "Export",
    "tx_none": "There is no record to export.",
    "tx_done": "{var0} records exported.",
    "tx_failed": "Export failed: ",
    "tx_doc_title": "Transcriptions",
    "tx_empty": "No transcription.",
    "tx_ocr_notice": "OCR-generated draft: the text has not been proofread, uncertain readings are marked.",
    "tx_cmd_transcription": "Export the transcription (HTML, Markdown, RTF)",
    "tx_cmd_citation": "Export the citation (BibTeX, RIS)",
    "tx_cmd_selection": "Export the transcription or the citation",
    "menu_export_text": "Export text",
    "menu_export_text_folder": "Export the folder's text",
    "dialog_export_text": "Export text and citations",
    "cit_type": "Manuscript",
    "cit_untitled": "Untitled",

    // --- Fase 3.2: data storica fuzzy ---
    "filter_period": "Document period",
    "filter_year_from": "From year",
    "filter_year_to": "To year",
    "filter_century": "Century",
    "filter_any_century": "Any century",
    "placeholder_data_storica": "e.g. 12 May 1340, c. 1340, 14th c. beginning",
    "date_read": "Read as: {var0} ({var1})",
    "date_not_read": "Date not understood: the record will stay at the bottom of chronological sorts.",
    "date_none": "No date.",
    "date_q_exact": "exact date",
    "date_q_year": "year",
    "date_q_circa": "circa",
    "date_q_ante": "before",
    "date_q_post": "after",
    "date_q_range": "range",
    "date_q_century": "century",

    // --- Fase 3.1: campi tipizzati ---
    "value_yes": "Yes",
    "value_no": "No",
    "field_required": "Required field",
    "field_configure": "Configure the field",
    "field_choose": "— choose —",
    "field_value_removed": "value no longer allowed",
    "own_field_add": "Add a field to this record",
    "own_field_title": "Add a field to this record",
    "own_field_hint": "The field stays on this record: the model and the other records do not change.",
    "own_field_name": "Field name",
    "own_field_name_ph": "Watermark",
    "own_field_badge": "here only",
    "own_field_badge_hint": "Field of this record: the model does not change.",
    "own_field_promote": "Add this field to the model",
    "own_field_promoted": "Field \"{var0}\" added to the model.",
    "own_field_remove": "Remove this field from the record",
    "own_field_remove_confirm": "Remove the field \"{var0}\" from this record? Its value will be deleted too.",
    "own_field_bad_name": "Invalid name, or already used on this record.",
    "own_field_conflict": "Record-specific fields",
    "reorder_fields": "Reorder fields",
    "reorder_done": "Done reordering",
    "reorder_hint": "Drag to change the order of the fields. It applies to this record only.",
    "reorder_reset": "Model order",
    "reorder_up": "Move up",
    "reorder_down": "Move down",
    "field_type_text": "Text",
    "field_type_textarea": "Long text",
    "field_type_number": "Number",
    "field_type_boolean": "Yes / No",
    "field_type_enum": "Pick list",
    "field_type_url": "Web address",
    "field_type_date": "Date",
    "field_type_dynamic_list": "Key-value list",
    "label_field_type": "Data type",
    "label_field_options": "Allowed values (one per line)",
    "placeholder_field_options": "parchment\npaper",
    "label_field_required": "Required: the record cannot be saved while it is empty",
    "label_field_unique": "Unique value: warn if another record has the same value",
    "btn_apply": "Apply",
    "msg_enum_no_options": "A pick list needs at least one value.",
    "msg_link_non_valido": "Invalid address.",
    "err_field_required": "The field \"{var0}\" is required.",
    "err_field_number": "The field \"{var0}\" must contain a number.",
    "err_field_url": "The field \"{var0}\" must be a web address (https://…).",
    "err_field_option": "The value of the field \"{var0}\" is not among the allowed ones.",
    "warn_field_duplicate": "Careful: \"{var0}\" has the same value as another record ({var1}).",

    // --- Fase 3.4: tag come entità ---
    "tag_manager_title": "Manage tags",
    // Fase 2.4 — import CSV
    "imp_title": "Import from CSV",
    "folders_empty_with_records": "No folder yet. The {var0} records are in the root and you can see them in the list beside.",
    "folders_empty": "No folder yet. The records you create stay in the root until you make one.",
    "imp_step_model": "Where do these records go?",
    "imp_model_new": "Create a new template",
    "imp_model_new_desc": "You build its fields from the columns of the file, in the next step.",
    "imp_model_name": "Template name",
    "imp_model_name_missing": "Give the template a name before continuing.",
    "field_locked": "Field of a built-in template: it cannot be removed or changed.",
    "type_locked_note": "This is a built-in template: its name and original fields cannot be changed — they would come back on their own at the next start. You can however add fields of your own, edit them and delete them.",
    "type_name_locked": "The name of a built-in template cannot be changed: it is translated along with the application.",
    "imp_header_row": "Row with the column names",
    "imp_mapped_count": "{var0} of {var1} columns imported",
    "imp_sample": "e.g.",
    "imp_dest_for": "Destination of the column",
    "imp_group_base": "Record data",
    "imp_group_fields": "Fields of the templates",
    "imp_group_new": "Fields to be created",
    "imp_new_field": "＋ Create a new field…",
    "imp_new_field_name": "Field name",
    "imp_new_field_type": "Field type",
    "imp_new_field_invalid": "Name unusable: it is empty or matches a field that already exists.",
    "imp_new_fields": "These fields will be added to the {var0} template: ",
    "imp_state_new_p": "new",
    "imp_state_updated_p": "updated",
    "imp_state_skipped_p": "skipped",
    "imp_with_warnings": "with warnings",
    "imp_and_more": "…and {var0} more rows.",
    "btn_create": "Create",
    "imp_menu": "Import CSV",
    "dialog_import_csv": "Import from CSV",
    "btn_import_zip_full": "Import an ArchiView ZIP backup",
    "th_transcription": "Transcription",
    "imp_read_error": "The file cannot be read: ",
    "imp_empty": "The file has no rows to import.",
    "imp_rows_found": "{var0} rows",
    "imp_delimiter": "separator",
    "imp_default_type": "Document type",
    "imp_default_folder": "Destination folder",
    "imp_update_existing": "Update the records already present instead of adding new ones",
    "imp_mapping": "Columns in the file",
    "imp_preview": "Preview",
    "imp_skip": "— do not import —",
    "imp_row": "row {var0}",
    "imp_state_new": "new",
    "imp_state_updated": "updated",
    "imp_state_skipped": "skipped",
    "imp_summary": "{var0} new, {var1} updated, {var2} skipped, {var3} with warnings.",
    "imp_new_folders": "{var0} archives will be created: ",
    "imp_confirm": "Import {var0} records",
    "imp_nothing": "Nothing to import",
    "imp_done": "{var0} records imported ({var1} updated).",
    "imp_hint": "Nothing is written until you press Import. Skipped rows stay in the file: fix them and import only those. The whole import can be undone with Ctrl+Z.",
    "imp_err_required": "required field missing",
    "imp_err_number": "not a number",
    "imp_err_url": "not a valid address",
    "imp_err_option": "value not among the allowed ones",
    "imp_err_boolean": "not a recognisable yes/no",
    "imp_err_type": "unknown document type, the default one is used",
    "imp_err_short": "the row has fewer cells than the header",
    "imp_err_dup": "shelfmark already in the archive",
    "imp_err_dup_file": "shelfmark repeated inside the file",
    "undo_import_csv": "Import of {var0} records",
    // Fase 4 — cestino, snapshot, cronologia per scheda, undo/redo
    "trash_title": "Trash",
    "trash_select": "Select this record",
    "trash_restore": "Restore",
    "trash_delete_forever": "Delete permanently",
    "trash_empty": "The trash is empty.",
    "trash_empty_now": "Empty the trash",
    "trash_read_error": "The trash cannot be read.",
    "trash_selected": "{var0} selected",
    "trash_restored": "{var0} records restored.",
    "trash_restore_none": "No record to restore.",
    "trash_restore_error": "Restore failed: ",
    "trash_delete_error": "Deletion failed: ",
    "trash_confirm_delete_many": "Permanently delete {var0} records? This cannot be undone.",
    "trash_confirm_delete_one": "Permanently delete this record? This cannot be undone.",
    "trash_confirm_empty": "Empty the trash? Every deleted record will be lost for good.",
    "trash_emptied": "Trash emptied ({var0} records).",
    "trash_from_bulk": "Bulk deletion",
    "trash_from_single": "Deletion",
    "trash_hint": "Deleted records stay here for 30 days, then disappear on their own. The trash is local to this computer: it is never synchronised and takes no room in the shared archive.",
    "record_untitled": "untitled record",
    "btn_redo": "Redo",
    "msg_nothing_to_redo": "Nothing to redo.",
    "msg_ripetuto_var": "Redone: {var0}",
    "msg_errore_ripetizione": "The action could not be redone.",
    "undo_edit_record": "Edit of \"{var0}\"",
    "undo_rename_folder": "Rename of \"{var0}\"",
    "undo_restore_record": "Record restored to {var0}",
    "undo_move_records": "Move of {var0} records",
    "undo_rename_attachment": "Attachment renamed",
    "undo_reorder_attachments": "Attachments reordered",
    "shortcut_redo": "Redo the undone action (also Ctrl+Shift+Z)",
    "snap_section_title": "Local snapshots",
    "snap_create_now": "Create now",
    "snap_create_now_hint": "Take a snapshot of the archive right now",
    "snap_create_cmd": "Create a snapshot of the archive",
    "snap_empty": "No snapshot yet: the first one is taken on its own while you work.",
    "snap_delete": "Delete the snapshot",
    "snap_confirm_delete": "Delete this snapshot? The local history of that moment will be lost.",
    "snap_created": "Snapshot created.",
    "snap_create_failed": "Snapshot not created: ",
    "snap_delete_failed": "Snapshot not deleted: ",
    "snap_restored": "Archive restored to the snapshot: {var0} records.",
    "snap_side_label": "IN THE SNAPSHOT",
    "snap_reason_auto": "automatic",
    "snap_reason_manual": "created by hand",
    "snap_reason_restore": "before a restore",
    "snap_reason_import": "before an import",
    "menu_record_history": "History",
    "rec_history_title": "Record history",
    "rec_history_loading": "Rebuilding the history…",
    "rec_history_failed": "History unavailable: ",
    "rec_history_empty": "No snapshot contains this record: its history starts with the first snapshot.",
    "rec_history_absent": "record not present",
    "rec_history_restore": "Restore the record to this version",
    "rec_history_restored": "Record restored to the version of {var0}.",
    "rec_history_gone": "The record is no longer in the archive: restore it from the trash.",
    "rec_history_hint": "The steps come from the local snapshots: only the moments in which this record changed are listed.",
    "settings_safety_title": "Trash and snapshots",
    "settings_safety_desc": "The archive is photographed periodically on this computer, and deleted records rest in the trash before disappearing. None of this is ever synchronised.",
    "settings_snapshot_auto": "Take automatic snapshots while I work",
    "settings_snapshot_recenti": "Recent snapshots",
    "settings_snapshot_giorni": "Days of history",
    "settings_cestino_giorni": "Days in the trash",
    "tag_manager_hint": "Renaming, merging and deleting act on every record in the archive, not only on the selected ones. Every operation can be undone.",
    "tag_rename": "Rename",
    "tag_delete": "Delete tag",
    "tag_select_for_merge": "Select for merging",
    "tag_merge_into": "Merge the chosen tags into:",
    "btn_tag_merge": "Merge",
    "tag_color_label": "Tag colour",
    "tag_color_none": "None",
    "tag_color_ambra": "Amber",
    "tag_color_rosso": "Red",
    "tag_color_verde": "Green",
    "tag_color_blu": "Blue",
    "tag_color_viola": "Purple",
    "tag_color_grigio": "Grey",
    "tag_count_one": "1 record",
    "tag_count_many": "{var0} records",
    "undo_tag_rename": "Tag rename",
    "undo_tag_merge": "Tag merge",
    "undo_tag_delete": "Tag deletion",
    "msg_tag_renamed": "Tag renamed on {var0} records.",
    "msg_tag_merged": "Tags merged on {var0} records.",
    "msg_tag_deleted": "Tag removed from {var0} records.",
    "msg_tag_nothing": "No record was modified.",
    "msg_tag_rename_merges": "A tag with this name already exists: the two have been merged.",
    "menu_tag_manager": "Manage tags…",

    // --- Fasi 3.3, 3.5 e 3.6: vocabolari, anagrafica, collegamenti, duplicati ---
    "vocab_title": "Controlled vocabularies",
    "vocab_new": "New vocabulary",
    "vocab_new_value": "New value…",
    "vocab_none": "No vocabulary yet. Create one to share a list of values with the whole group.",
    "vocab_delete": "Delete the vocabulary",
    "vocab_remove_value": "Remove from the list",
    "vocab_used_by": "Records using this value",
    "vocab_own_values": "— values typed below —",
    "vocab_add_inline": "Add a value to the vocabulary",
    "vocab_hint": "A vocabulary is shared by the whole archive and travels with synchronisation. Renaming a value updates it in every record; removing it from the list does not delete it from the records that contain it.",
    "label_field_vocab": "Take the values from an archive vocabulary",
    "label_field_authority": "Feeds the register of",
    "msg_vocab_exists": "A vocabulary with this name already exists.",
    "msg_vocab_renamed": "Value renamed on {var0} records.",
    "msg_vocab_value_removed": "Value removed from the list. The records containing it keep it.",
    "msg_vocab_deleted": "Vocabulary deleted. The fields that used it keep the values as their own list.",
    "undo_vocab_rename": "Value rename",
    "auth_title": "People and places",
    "auth_people": "People",
    "auth_places": "Places",
    "auth_filter": "Filter…",
    "auth_type_none": "None",
    "auth_type_persona": "People",
    "auth_type_luogo": "Places",
    "auth_none": "Nothing here yet. People and places are gathered from the fields marked as such in the document type editor.",
    "auth_show_records": "Show the records mentioning it",
    "auth_hint": "The list is derived from the records: it is not a parallel archive. Renaming an entry rewrites the name in every record mentioning it, which is how two spellings of the same person get unified.",
    "undo_auth_rename": "Register rename",
    "msg_auth_renamed": "Name updated on {var0} records.",
    "label_links": "Links to other records",
    "link_none": "No links.",
    "link_generic": "linked to",
    "link_choose": "— choose a record —",
    "link_add": "Add the link",
    "link_remove": "Remove the link",
    "link_missing": "record not present in this copy",
    "no_signature": "No shelfmark",
    "undo_link_add": "Record link",
    "undo_link_del": "Link removal",
    "msg_link_added": "Link added.",
    "msg_link_removed": "Link removed.",
    "dup_title": "Repeated shelfmarks",
    "dup_none": "No repeated shelfmark.",
    "dup_found": "{var0} repeated shelfmarks.",
    "dup_hint": "A repeated shelfmark is not necessarily a mistake: a fonds may contain some from inventories predating the cataloguing. The list flags them; the decision stays with the reader.",
    "warn_signature_duplicate": "Careful: the shelfmark \"{var0}\" is already used by another record ({var1} in total).",
    "btn_add": "Add",
    "link_panel_title": "Linked records",
    "link_outgoing": "This record points to",
    "link_incoming": "Referred to by",
    "menu_links": "Linked",
    "filter_links": "Links",
    "filter_has_links": "With links",
    "filter_no_links": "Without links",
    "graph_title": "Link graph",
    "menu_graph": "Graph",
    "graph_show_isolated": "Show records without links too",
    "graph_relayout": "Recompute the layout",
    "graph_summary": "{var0} records, {var1} links, {var2} clusters",
    "graph_empty": "No linked record yet. Links are added from the record form, in the \"Links to other records\" block.",
    "graph_truncated": "Showing the {var0} most linked records out of {var1}: beyond that the graph stops being readable.",
    "graph_hint": "Click a node to isolate it with its neighbours, double-click to open the record. Drag to move, wheel to zoom.",
    "graph_open_record": "Open the record",

    "ocr_title": "Recognise text (OCR)",
    "ocr_button": "Recognise text",
    "ocr_menu_entry": "Recognise text (OCR)…",
    "ocr_start": "Recognise",
    "ocr_source": "Attachment",
    "ocr_source_all": "All attachments of this record",
    "ocr_langs": "Languages",
    "ocr_langs_title": "Recognition languages",
    "ocr_langs_hint": "Several languages at once slow recognition down: pick more than one only if the document really mixes them.",
    "ocr_langs_loading": "Loading…",
    "ocr_langs_offline_hint": "Language data is downloaded once and stays on this computer: after installing, recognition works without a connection.",
    "ocr_no_langs": "No language installed: recognition needs at least one.",
    "ocr_manage_langs": "Manage languages…",
    "ocr_lang_install": "Install",
    "ocr_lang_remove": "Remove",
    "ocr_lang_installing": "Downloading…",
    "ocr_lang_removing": "Removing…",
    "ocr_lang_error": "Operation failed: a connection is needed to download language data.",
    "ocr_destination": "Destination",
    "ocr_dest_draft": "Insert as a draft in the transcription",
    "ocr_dest_index": "Make the text searchable",
    "ocr_dest_hint": "Searchable text stays attached to the file and does not touch the transcription: it is there to find the record again, not to replace the work of reading it.",
    "ocr_advanced": "Advanced options",
    "ocr_dpi": "PDF scanning resolution",
    "ocr_dpi_fast": "fast",
    "ocr_dpi_default": "recommended",
    "ocr_dpi_slow": "slow, small type",
    "ocr_max_pages": "Maximum pages per PDF",
    "ocr_max_pages_hint": "The limit exists because a three-hundred-folio PDF would keep the program busy for hours without anyone asking for it.",
    "ocr_phase_page": "Page",
    "ocr_phase_raster": "Preparing image",
    "ocr_phase_recognize": "Recognising",
    "ocr_phase_lang": "Loading language",
    "ocr_phase_init": "Starting the engine",
    "ocr_page_of": "page {var0} of {var1}",
    "ocr_provenance": "Draft produced by OCR ({var0}) on {var1} — to be checked",
    "ocr_pick_lang": "Pick at least one language.",
    "ocr_pick_dest": "Pick at least one destination for the text.",
    "ocr_no_attachments": "This record has no attachment to recognise.",
    "ocr_no_attachments_sel": "None of the selected records has attachments.",
    "ocr_failed": "No text recognised.",
    "ocr_done": "Recognition complete.",
    "ocr_result_summary": "{var0} characters recognised, average confidence {var1}%",
    "ocr_low_confidence": "Low confidence: the hand is probably cursive or the scan hard to read. The text must be checked word by word.",
    "ocr_saved_index": "Text made searchable.",
    "ocr_saved_draft": "Draft inserted in the transcription.",
    "ocr_draft_skipped": "Transcription left unchanged.",
    "ocr_overwrite_title": "Transcription already there",
    "ocr_overwrite_desc": "Some sheets already have a transcription. The OCR draft can replace it or be appended at the end. Replaced text cannot be recovered.",
    "ocr_overwrite_append": "Append at the end",
    "ocr_overwrite_replace": "Replace",
    "ocr_bulk_title": "OCR of the selected records",
    "ocr_bulk_progress": "Record {var0} of {var1}: {var2}",
    "ocr_bulk_done": "OCR complete: {var0} attachments in {var1} records.",
    "filter_ocr": "OCR text",
    "filter_has_ocr": "With OCR text",
    "filter_no_ocr": "Without OCR text",
    "settings_ocr_desc": "Text recognition (OCR) works without a connection, but each language has to be installed once. The data stays on this computer and is not synchronised.",
    "trasc_current_sheet": "Sheet {var0} of {var1} — {var2}"
};

const customIt = {
    // --- Etichetta secondaria delle schede nell'albero ---
    "tree_label_title": "Etichetta secondaria delle schede",
    "tree_label_heading": "Mostra sotto la segnatura",
    "tree_label_none": "Nessuna",
    "tree_label_auto": "Automatica (nome principale)",
    "tree_sort_heading": "Ordina l’albero per",
    "tree_sort_secondary": "Etichetta secondaria",
    // ⚠️ LESSICO: "archivio" è il VAULT — quelli che si creano e si scelgono dal selettore
    // in fondo alla sidebar. L'albero interno (appData.cartelle) si chiama "cartella".
    // Le due cose erano entrambe "archivio" e l'ambiguità arrivava fino alle conferme di
    // eliminazione, dove "eliminare l'archivio" poteva voler dire due cose molto diverse.
    "msg_l_archivio_copiato_vuoto": "La cartella copiata è vuota.",
    "msg_l_archivio_vuoto_nulla_da": "La cartella è vuota, nulla da esportare.",
    "th_folder": "Cartella",
    "msg_folder_deleted": "Cartella eliminata.",
    "btn_create_folder": "Crea cartella",
    "hint_folder_name": "Consiglio: usa la barra ( / ) per creare automaticamente delle sottocartelle.",
    "label_folder_name": "Nome della cartella o percorso",
    "modal_new_folder": "Nuova cartella",
    "folder_empty": "La cartella è vuota.",
    "btn_delete_folder": "Elimina questa cartella",
    // --- Fase 1.1: ordinamento e vista tabellare ---
    "field_segnatura": "Segnatura",
    "label_sort_by": "Ordina per",
    "tooltip_sort_by": "Criterio di ordinamento dell'elenco",
    "tooltip_sort_dir": "Inverti la direzione dell'ordinamento",
    "tooltip_sort_asc": "Ordine crescente: clicca per invertire",
    "tooltip_sort_desc": "Ordine decrescente: clicca per invertire",
    "tooltip_toggle_view": "Cambia modalità di visualizzazione",
    "tooltip_view_grid": "Passa alla vista a schede",
    "tooltip_view_table": "Passa alla vista tabella",
    "th_tags": "Tag",
    "th_attachments": "Allegati",
    "th_modified": "Modificato",
    "tooltip_columns": "Scegli le colonne visibili",
    "menu_columns": "Colonne visibili",
    "btn_new_model": "Nuovo modello",
    "tooltip_new_record_type": "Scegli il tipo della nuova scheda",
    "menu_new_record_type": "Nuova scheda di tipo",

    // --- Fase 1: passi del tutorial sulle funzioni della vista elenco ---
    "tut_sort_title": "Ordinamento e Vista Tabellare",
    "tut_sort_desc": "L’elenco può essere ordinato per segnatura, per un campo del tipo di documento, per data di modifica o per numero di allegati. Questo comando alterna la griglia di schede alla vista tabellare, dove ogni intestazione di colonna è essa stessa un comando di ordinamento e le colonne visibili sono configurabili per tipo di documento.",
    "tut_filters_title": "Filtri Avanzati e Ricerche Salvate",
    "tut_filters_desc": "Oltre alla ricerca testuale è possibile restringere l’elenco per tipo di documento, sottocartelle, intervallo di data di modifica, presenza di allegati o di trascrizione. Nel campo di ricerca è ammessa inoltre la sintassi campo:valore (per esempio notaio:rossi). Una combinazione di filtri può essere salvata con un nome e richiamata in seguito.",
    "tut_palette_title": "Comandi Rapidi",
    "tut_palette_desc": "La combinazione Ctrl+K apre l’elenco dei comandi: da un unico campo si raggiunge una scheda, una cartella, una nuova scheda di un tipo specifico o qualsiasi altra azione dell’applicazione. Il tasto ? mostra l’elenco completo delle scorciatoie disponibili. Entrambi sono richiamabili anche da questo menu.",
    "tut_viewer_title": "Analisi dell’Immagine",
    "tut_viewer_desc": "L’anteprima dell’allegato dispone di ingrandimento (rotella del mouse o tasti + e −), trascinamento, rotazione a 90° (tasto R) e adattamento alla pagina o alla larghezza. I comandi di luminosità, contrasto e negativo sono destinati alla lettura di scritture di difficile decifrazione. Con Alt+← e Alt+→ si scorrono gli allegati della scheda.",

    // --- Fase 1.4: command palette e scorciatoie ---
    "cp_title": "Comandi",
    "cp_placeholder": "Cerca un comando, una scheda o una cartella…",
    "cp_empty": "Nessun comando corrisponde.",
    "cp_error": "Comando non riuscito.",
    "cp_group_actions": "Azioni",
    "cp_group_records": "Vai alla scheda",
    "cp_group_folders": "Vai alla cartella",
    "cp_search": "Cerca nell’archivio",
    "cp_view_grid": "Passa alla vista a schede",
    "cp_view_table": "Passa alla vista a tabella",
    "cp_changelog": "Novità di questa versione",
    "cp_shortcuts": "Scorciatoie da tastiera",
    "cp_hint_move": "scorri",
    "cp_hint_run": "esegui",
    "cp_hint_close": "chiudi",
    "untitled_record": "Senza titolo",
    "shortcut_group_general": "Generali",
    "shortcut_group_selection": "Selezione",
    "shortcut_group_transcription": "Trascrizione",
    "shortcut_group_viewer": "Visualizzatore immagini",
    "shortcut_palette": "Apri i comandi",
    "shortcut_help": "Mostra questo elenco",
    "shortcut_search": "Vai alla ricerca",
    "shortcut_new": "Nuova scheda",
    "shortcut_save": "Salva la scheda o la trascrizione aperta",
    "shortcut_undo": "Annulla l’ultima azione",
    "shortcut_esc": "Chiudi la finestra in primo piano, svuota la ricerca o azzera la selezione",
    "shortcut_multi": "Aggiungi o togli una scheda dalla selezione",
    "shortcut_range": "Seleziona l’intervallo fino alla scheda cliccata",
    "shortcut_menu": "Menu delle azioni sulla scheda o sulla cartella",
    "shortcut_prev_att": "Allegato precedente",
    "shortcut_next_att": "Allegato successivo",
    "shortcut_fullscreen": "Allegato a schermo intero",
    "shortcut_zoom": "Ingrandisci o riduci",
    "shortcut_fit": "Adatta alla pagina",
    "shortcut_real": "Dimensione reale (1:1)",
    "shortcut_rotate": "Ruota di 90° (con Maiusc: in senso opposto)",
    "shortcut_pan": "Sposta l’immagine",

    // --- Fase 1.5: azioni in massa e scorciatoie sulla selezione ---
    "tut_bulk_title": "Azioni su più schede",
    "tut_bulk_desc": "Con Ctrl+clic e Maiusc+clic si selezionano più schede, e Ctrl+A prende tutti i risultati del filtro corrente, comprese le pagine successive. Il menu del tasto destro applica allora l’azione all’intera selezione: spostamento in una cartella, cambio di tipo di documento, aggiunta o rimozione di tag e sostituzione di testo in un campo, con anteprima del numero di schede interessate e possibilità di annullare.",
    "bulk_move_title": "Sposta in una cartella",
    "bulk_type_title": "Cambia tipo di documento",
    "bulk_type_hint": "I valori dei campi che il nuovo tipo non prevede restano salvati nella scheda, ma non saranno più visibili nel form finché non si torna al tipo precedente.",
    "bulk_tag_title": "Aggiungi o rimuovi tag",
    "bulk_tag_add": "Aggiungi",
    "bulk_tag_remove": "Rimuovi",
    "bulk_tag_ph": "Es. pergamena, notarile",
    "bulk_tag_hint": "Più tag si separano con la virgola. La rimozione richiede la corrispondenza esatta del tag.",
    "bulk_replace_title": "Trova e sostituisci",
    "bulk_label_folder": "Cartella di destinazione",
    "bulk_label_type": "Nuovo tipo",
    "bulk_label_action": "Operazione",
    "bulk_label_tags": "Tag",
    "bulk_label_field": "Campo",
    "bulk_label_find": "Trova",
    "bulk_label_replace": "Sostituisci con",
    "bulk_field_signature": "Segnatura",
    "bulk_field_tags": "Tag",
    "bulk_case": "Distingui maiuscole",
    "bulk_whole": "Solo parole intere",
    "bulk_preview": "{var0} schede, {var1} occorrenze.",
    "bulk_preview_empty": "Scrivi il testo da cercare per vedere quante schede sarebbero modificate.",
    "btn_apply": "Applica",
    "menu_select_all": "Seleziona tutti i risultati",
    "menu_bulk_on": "Su {var0} schede",
    "menu_bulk_on_one": "Su questa scheda",
    "cp_group_selection": "Selezione",
    "msg_bulk_no_selection": "Seleziona almeno una scheda.",
    "msg_bulk_nothing": "Nessuna scheda è stata modificata.",
    "msg_bulk_done": "{var0} schede modificate.",
    "msg_bulk_error": "Azione non riuscita.",
    "msg_bulk_moved": "{var0} schede spostate.",
    "msg_bulk_type": "Tipo cambiato su {var0} schede.",
    "msg_bulk_tag_add": "Tag aggiunti a {var0} schede.",
    "msg_bulk_tag_del": "Tag rimossi da {var0} schede.",
    "msg_bulk_replaced": "Sostituzione applicata a {var0} schede.",
    "msg_selected_all": "{var0} schede selezionate.",
    "undo_bulk_move": "Spostamento di schede",
    "undo_bulk_type": "Cambio di tipo documento",
    "undo_bulk_tag_add": "Aggiunta di tag",
    "undo_bulk_tag_del": "Rimozione di tag",
    "undo_bulk_replace": "Trova e sostituisci",
    "shortcut_group_bulk": "Schede selezionate",
    "shortcut_select_all": "Seleziona tutti i risultati, anche nelle pagine successive",
    "shortcut_deselect": "Azzera la selezione",
    "shortcut_edit": "Modifica la scheda selezionata",
    "shortcut_copy": "Copia le schede selezionate",
    "shortcut_cut": "Taglia le schede selezionate",
    "shortcut_paste": "Incolla nella cartella corrente",
    "shortcut_export_sel": "Esporta la selezione in ZIP",
    "btn_export_csv": "Esporta Cartella in CSV",
    "btn_export_tsv": "Esporta Cartella in TSV",
    "menu_export_folder_csv": "Esporta cartella in CSV",
    "bulk_export_csv": "Esporta selezione in CSV",
    "bulk_export_tsv": "Esporta selezione in TSV",
    "dialog_export_csv": "Esporta in CSV/TSV",
    "shortcut_export_sel_csv": "Esporta la selezione in CSV",
    "col_id": "ID",
    "col_type": "Tipo documento",
    "col_modified_by": "Modificato da",
    "col_created_by": "Creato da",
    "shortcut_delete_sel": "Elimina le schede selezionate",
    "shortcut_bulk_move": "Sposta la selezione in una cartella",
    "shortcut_bulk_type": "Cambia il tipo di documento della selezione",
    "shortcut_bulk_tag": "Aggiungi o rimuovi tag sulla selezione",
    "shortcut_bulk_replace": "Trova e sostituisci in un campo della selezione",

    // --- Fase 1.3: filtri avanzati e ricerche salvate ---
    "btn_filters": "Filtri",
    "tooltip_filters": "Filtri avanzati e ricerche salvate",
    "tooltip_filters_active": "Filtri avanzati ({var0} attivi)",
    "filter_type": "Tipo",
    "filter_subfolders": "Includi sottocartelle",
    "filter_from": "Dal",
    "filter_to": "Al",
    "filter_attachments": "Allegati",
    "filter_transcription": "Trascrizione",
    "filter_any": "Qualsiasi",
    "filter_yes": "Sì",
    "filter_no": "No",
    "filter_has_attachments": "Con allegati",
    "filter_no_attachments": "Senza allegati",
    "filter_has_transcription": "Con trascrizione",
    "filter_no_transcription": "Senza trascrizione",
    "filter_remove_advanced": "Rimuovi questo filtro",
    "filter_query_hint": "Nella ricerca puoi scrivere campo:valore — per esempio notaio:rossi, tag:pergamena, oppure \"frase esatta\".",
    "btn_clear_advanced": "Azzera i filtri",
    "label_saved_searches": "Ricerche salvate",
    "empty_saved_searches": "Nessuna ricerca salvata.",
    "placeholder_saved_search": "Nome della ricerca",
    "btn_save_search": "Salva",
    "btn_delete_saved_search": "Elimina questa ricerca",
    "msg_saved_search": "Ricerca salvata.",

    // --- Fase 1.2: visualizzatore immagini ---
    "tooltip_zoom_in": "Ingrandisci (+)",
    "tooltip_zoom_out": "Riduci (-)",
    "tooltip_rotate_left": "Ruota a sinistra (Maiusc+R)",
    "tooltip_rotate_right": "Ruota a destra (R)",
    "tooltip_fit_page": "Adatta alla pagina (0)",
    "tooltip_fit_width": "Adatta alla larghezza",
    "tooltip_zoom_real": "Dimensione reale, 1:1 (1)",
    "tooltip_image_filters": "Luminosità, contrasto e negativo",
    "tooltip_view_reset": "Ripristina la vista",
    "label_brightness": "Luminosità",
    "label_contrast": "Contrasto",
    "label_invert": "Inverti (negativo)",

    // --- Zona 3: azioni di contesto + filtri attivi (UI_UX_TODO Fase 0/1) ---
    "btn_new_record": "Nuova scheda",
    "btn_new_folder": "Nuova cartella",
    "btn_import": "Importa",
    "tooltip_new_model": "Crea un nuovo modello di documento",
    "tooltip_export_folder": "Esporta questa cartella in ZIP",
    "tooltip_delete_folder": "Elimina questa cartella",
    "tooltip_delete_folder_not_empty": "Puoi eliminare solo una cartella vuota",
    "tooltip_delete_folder_root": "La radice dell'archivio non può essere eliminata",
    "folder_root_label": "Radice",
    "empty_no_folders": "Nessuna cartella. Le schede restano nella radice finché non ne crei una.",
    "tooltip_sharing": "Condivisione e collaboratori",
    "nav_panels": "Pannelli",
    "tooltip_save_record": "Salva la scheda",
    "tooltip_back_to_list": "Torna alla lista",
    "tooltip_resize": "Trascina per ridimensionare",
    "label_not_editable": "Non modificabile",
    "tutorial_invite_text": "Vuoi seguire una brevissima guida per scoprire le funzionalità principali dell'app?",
    "btn_tutorial_start": "Sì, avvia",
    "btn_tutorial_dismiss": "No, grazie",
    "label_active_filters": "Filtri attivi",
    "filter_search": "Ricerca",
    "filter_remove_search": "Rimuovi la ricerca",
    "filter_remove_tag": "Rimuovi questo tag",
    "btn_clear_filters": "Azzera tutti i filtri",
    "dialog_select_folder": "Seleziona la posizione per il nuovo archivio",
    "dialog_export_zip": "Esporta Backup in ZIP",
    "dialog_import_zip": "Importa Archivio JSON",
    "btn_procedi": "Procedi",
    "modal_folder_title": "Gestione Archivi",
    "welcome_desc_gestione": "Scegli una cartella di destinazione per creare un nuovo archivio indipendente, oppure seleziona un archivio esistente per caricarne i dati.",
    "btn_open_local": "Apri Archivio Locale",
    "btn_create_local": "Crea Nuova Cartella Locale",
    "btn_create_cloud_private": "Crea un Backup Personale",
    "btn_backup_private": "Backup Personale",
    "btn_convert_backup_private": "Converti in Backup Personale",
    "btn_create_shared": "Crea Archivio Condiviso",
    "btn_join_shared": "Unisciti a un Archivio Condiviso",
    "btn_restore_drive": "Ripristina da Google Drive...",
    "label_archive_name": "Nome Archivio",
    "placeholder_archive_name": "Es. Archivio Manoscritti",
    "label_position": "Posizione",
    "btn_browse": "Sfoglia...",
    "btn_go_back": "Torna Indietro",
    "btn_create_and_start": "Crea e Avvia",
    "welcome_desc_join": "Unendoti tramite codice accederai a un Cloud condiviso sul Google Drive del creatore. Qualsiasi modifica locale si sincronizzerà direttamente con gli altri membri.",
    "label_invite_code": "Codice Invito",
    "placeholder_invite_code": "Incolla il codice qui...",
    "label_archive_name_colon": "Nome Archivio:",
    "label_local_archive_pos": "Posizione dell'archivio locale",
    "btn_connect": "Connetti",
    "title_select_cloud_archive": "Seleziona un Archivio dal Cloud",
    "msg_no_archive_found_drive": "Nessun Archivio trovato nella cartella ArchiView sul tuo Drive.",
    "label_modified": "Modificato:",
    "btn_search_everywhere": "Cerca Ovunque",
    "title_search_everywhere": "Se non vedi il tuo archivio, cerca in tutto il Drive",
    "prog_prep_title": "Preparazione in corso",
    "prog_prep_auth": "Autenticazione con Google Drive...",
    "prog_conf_title": "Configurazione in corso",
    "prog_conf_shared": "Impostazione Archivio come condiviso...",
    "prog_sync_title": "Sincronizzazione",
    "prog_sync_merge": "Caricamento e unione dei dati sul Cloud (potrebbe richiedere un po')...",
    "prog_conf_backup": "Impostazione Backup Personale...",
    "prog_disc_title": "Disconnessione",
    "prog_disc_desc": "Disattivazione della sincronizzazione Cloud...",
    "prog_auth_title": "Autenticazione in corso",
    "prog_auth_desc1": "Accedi con l'account Google desiderato nel browser...",
    "prog_auth_desc2": "Accedi con il nuovo account nel browser...",
    "prog_invite_title": "Invio invito",
    "prog_invite_desc": "Assegnazione dei permessi su Google Drive...",
    "prog_prep_cloud": "Avvio della configurazione cloud...",
    "confirm_disc_cloud": "Vuoi davvero disconnettere questo Archivio dal Cloud? I dati rimarranno salvati sul tuo computer, ma non saranno più sincronizzati online e l'app tornerà in modalità solo locale.",
    "confirm_pull_no_fetch": "Attenzione: stai per scaricare le modifiche dal Cloud senza prima verificare quali siano (Fetch). Procedere comunque?",
    "confirm_disc_cloud_short": "Vuoi davvero disconnettere questo Archivio dal Cloud?\nI dati rimarranno salvati sul computer, ma non saranno più sincronizzati.",
    "confirm_join_shared": "Vuoi chiudere l'Archivio attuale per unirti a un nuovo Archivio Condiviso? Le modifiche locali non salvate andranno perse.",
    "confirm_delete_multiple": "Sei sicuro di voler eliminare le {var0} schede selezionate? L'operazione è irreversibile.",
    "confirm_delete_single": "Sei sicuro di voler eliminare questa scheda? L'operazione è irreversibile.",
    "confirm_delete_multiple_cloud": "Hai eliminato {var0} schede dal tuo archivio. Sei sicuro di volerle eliminare permanentemente anche dal cloud condiviso?",
    "confirm_delete_single_cloud": "Hai eliminato una scheda dal tuo archivio. Sei sicuro di volerla eliminare permanentemente anche dal cloud condiviso?",
    "confirm_delete_archive_empty": "Sei sicuro di voler eliminare la cartella \"{var0}\"? Tutte le sottocartelle vuote verranno rimosse.",
    "confirm_delete_archive_with_docs": "La cartella \"{var0}\" contiene {var1} documenti. Eliminandola verranno eliminati anche tutti i documenti al suo interno. Vuoi procedere?",
    "confirm_delete_model": "Sei sicuro di voler eliminare questo modello?",
    "confirm_tutorial_demo": "Stai per caricare l'archivio Demo. L'archivio attuale verrà chiuso. Vuoi procedere?",
    "label_invite_code_opt": "Codice d'Invito",
    "label_optional": "(opzionale)",
    "label_authorize_folder": "Autorizza l'accesso alla cartella",
    "desc_picker_required": "Apri il Drive e seleziona la cartella condivisa. Questo autorizza l'accesso senza concedere permessi completi all'app.",
    "btn_browse_drive": "Sfoglia Google Drive...",
    "label_selected_archive": "Selezionato:",
    "msg_picker_required": "Prima apri Google Drive con il pulsante Sfoglia per autorizzare l'accesso alla cartella condivisa.",
    "msg_selezione_annullata": "Selezione annullata.",
    "msg_seleziona_percorso": "Seleziona una posizione locale per l'archivio.",
    "cloud_step1_title": "Concedi l'accesso a Google Drive",
    "cloud_step1_desc": "Il collaboratore riceverà un'email da Google che lo autorizza ad accedere alla cartella condivisa.",
    "cloud_step2_title": "Condividi il link ArchiView",
    "cloud_step2_desc": "Il collaboratore incolla questo link in ArchiView per completare la configurazione e abilitare il sync in tempo reale.",
    "cloud_step2_hint": "Il destinatario va su <em>Unisciti a un Archivio</em> e incolla questo link nel campo Step 1.",
    "confirm_use_another_account": "Verrai reindirizzato al browser per accedere con un altro account Google. Questo account verrà usato SOLO per questo Archivio condiviso. Vuoi procedere?",
    "cloud_no_members": "Nessun membro trovato.",
    "cloud_role_owner": "Proprietario",
    "cloud_role_collaborator": "Collaboratore",
    "btn_remove_access": "Rimuovi Accesso",
    "cloud_user_fallback": "Utente",
    "confirm_remove_access": "Sei sicuro di voler rimuovere l'accesso a {var0}?",
    "cloud_invite_email_desc": "Inserisci l'indirizzo email (Google) della persona da invitare all'Archivio:",
    "confirm_clean_orphans_desc": "Questa operazione eliminerà definitivamente dal PC e da Google Drive tutti gli allegati che non sono più associati a nessuna scheda nel database corrente. L'operazione è irreversibile. Vuoi procedere?",
    "btn_delete_orphans": "Elimina file orfani",
    "cloud_cleaning_in_progress": "Pulizia in corso...",
    "modal_cloud_title_backup": "Backup personale su Google Drive",
    "modal_cloud_title_shared": "Archivio condiviso su Google Drive",
    "cloud_shared_hint": "I permessi Drive non sono revocabili singolarmente: chi ha il link mantiene l'accesso. Passa all'archivio condiviso per inviti revocabili.",
    "cloud_status_type": "Tipo",
    "cloud_status_type_backup": "Backup personale",
    "cloud_status_type_shared": "Archivio condiviso (legacy)",
    "cloud_status_account": "Account",
    "cloud_status_last_sync": "Ultima sincronizzazione",
    "btn_syncing": "Sincronizzazione...",
    "btn_activating": "Attivazione in corso...",
    "a11y_sync_attachments_on": "Sincronizzazione allegati attivata",
    "a11y_sync_attachments_off": "Sincronizzazione allegati disattivata",
    "a11y_operation_done": "Operazione terminata",
    "merge_conflict_modal_title": "Conflitti di Sincronizzazione Rilevati",
    "merge_conflicts_to_resolve": "Conflitti da risolvere:",
    "merge_all_resolved": "Tutti i conflitti sono stati risolti!",
    "btn_cancel_sync": "Annulla Sincronizzazione",
    "btn_apply_resolution": "Applica Risoluzione",
    "merge_badge_resolved": "Risolto",
    "merge_badge_pending": "in sospeso",
    "merge_select_version_desc": "Seleziona la versione corretta per ciascun campo modificato da entrambi gli utenti.",
    "merge_choice_registered": "Scelta registrata",
    "merge_local_label": "Tua Modifica (Locale)",
    "btn_keep_mine": "Tieni la mia",
    "merge_cloud_label": "Modifica Cloud (Server)",
    "btn_use_this": "Usa questa",
    "merge_field_empty": "Vuoto",
    "merge_rich_transcription": "(Trascrizione ricca)",
    "merge_no_attachments": "Nessun allegato",
    "join_step1_hint": "Incolla il link archiview://join/... ricevuto dall'organizzatore.",
    "join_step2_hint": "Prima <strong>accetta l'email di condivisione da Google Drive</strong>. La cartella apparirà in <em>\"Condivisi con me\"</em>.",
    "join_step3_hint": "Scegli dove salvare la copia locale dell'archivio sul tuo PC.",
    "join_code_ok_suffix": "— ora clicca \"Sfoglia Google Drive\" per autorizzare l'accesso.",
    "join_code_invalid": "Codice non valido. Verifica di aver copiato il testo completo.",
    "msg_error_creating_files": "Errore durante la creazione dei file locali.",
    "btn_creating": "Creazione...",
    "label_loading": "Caricamento...",
    "tooltip_expand_editor": "Espandi Editor",
    "btn_rename_short": "Rinomina",
    "attachment_not_local_title": "Allegato non presente in locale",
    "attachment_not_local_desc1": "Questo archivio è condiviso. Il file dell'allegato non è ancora presente sul tuo PC.",
    "attachment_not_local_desc2": "Usa il Cloud Explorer per sincronizzare gli allegati.",
    "attachment_file_label": "File da inserire:",
    "attachment_copy_hint": "Copia il file nella tua cartella allegati:",
    "attachment_unsafe_title": "File non sicuro",
    "attachment_unsafe_desc": "L'hash del file non corrisponde a quello salvato nel cloud.",
    "attachment_image": "Immagine",
    "settings_personal_backup_title": "Backup Personale",
    "settings_personal_backup_desc": "Questo archivio locale è sincronizzato privatamente come backup sul tuo Google Drive.",
    "sidebar_no_pending": "Nessuna modifica pendente",
    "sidebar_incoming_cloud": "IN ENTRATA (CLOUD)",
    "sidebar_local_label": "LOCALE",
    "sidebar_click_to_show": "Clicca per mostrare modifiche",
    "sidebar_from": "da ",
    "sidebar_from_colon": "da: ",
    "sidebar_from_cloud_title": "Modifica dal Cloud inviata da {var0}. Fai un Fetch/Scarica per vederla.",
    "sidebar_structural_updates": "Aggiornamenti strutturali",
    "sidebar_structural_hint": "Sono presenti modifiche strutturali (es. cartelle o rimozioni). Clicca su Scarica in alto a destra.",
    "history_compare_now": "Confronta con ora",
    "history_restore_version": "Ripristina a questa versione",
    "history_no_revisions": "Nessuna revisione trovata. Carica almeno una volta sul Cloud.",
    "history_click_hint": "Clicca su una versione per confrontare o ripristinare.",
    "history_not_connected": "Connettiti a Google Drive per vedere lo storico.",
    "history_loading": "Caricamento storico...",
    "search_results_title": "Risultati Ricerca Globale",
    "title_edit_record": "Modifica Scheda",
    "btn_save_changes": "Salva Modifiche",
    "type_modal_edit_title": "Modifica Tipo Documento",
    "placeholder_key": "Chiave",
    "placeholder_value": "Valore",
    "diff_before": "PRIMA",
    "diff_after": "DOPO",
    "diff_field": "Campo:",
    "diff_empty": "(Vuoto)",
    "diff_in_revision": "NELLA REVISIONE",
    "diff_current_version": "VERSIONE ATTUALE",
    "counter_documents_found": "Documenti trovati: {var0}",
    "counter_documents": "Documenti: {var0}",
    "attachment_count_one": "1 documento allegato",
    "attachment_count_many": "{var0} documenti allegati",
    "tooltip_export": "Esporta",
    "tooltip_rename": "Rinomina",
    "tooltip_remove": "Rimuovi",
    "tooltip_move_up": "Sposta su",
    "tooltip_move_down": "Sposta giù",
    "tooltip_delete": "Elimina",
    "cloud_action_enable_short": "Attiva cloud",
    "cloud_action_connect_short": "Connetti",
    "cloud_action_retry": "Riprova",
    "cloud_action_receive": "Ricevi",
    "cloud_action_send": "Invia",
    "cloud_action_check": "Controlla",
    "cloud_action_fetch": "Controlla aggiornamenti",
    "cloud_click_hint": "clicca per le azioni di sincronizzazione",
    "tooltip_click_for_actions": "Clicca per le azioni disponibili",
    "tooltip_click_show_changes": "Clicca per mostrare le modifiche",
    "tooltip_remove_from_list": "Rimuovi dalla lista",
    "modal_vault_remove_title": "Rimuovi Archivio",
    "modal_vault_remove_desc": "Vuoi solo rimuovere l'Archivio {var0} dall'elenco o eliminare definitivamente tutti i suoi file dal computer?",
    "btn_vault_delete_files": "Sì, elimina anche i file",
    "btn_vault_remove_list": "Rimuovi solo dall'elenco",
    "cloud_state_local_only": "Solo locale",
    "cloud_state_syncing": "Sincronizzazione…",
    "cloud_state_offline": "Offline",
    "cloud_state_error": "Errore di sincronizzazione",
    "cloud_state_disconnected": "Non connesso",
    "cloud_state_incoming": "Aggiornamenti in entrata",
    "cloud_state_incoming_n": "{var0} in entrata",
    "cloud_state_pending": "Modifiche locali da inviare",
    "cloud_state_pending_n": "{var0} da inviare",
    "cloud_state_synced": "Sincronizzato",
    "cloud_action_enable": "Attiva il cloud per questo archivio",
    "cloud_action_connect": "Connetti account cloud",
    "cloud_action_view_changes": "Vedi modifiche",
    "cloud_action_history": "Storico versioni",
    "cloud_busy_hint": "Sincronizzazione in corso",
    "cloud_disconnected_hint": "Account cloud non connesso",
    "tut_cloud_sync_desc": "Qui vedi in una riga lo stato dell’archivio remoto: sincronizzato, aggiornamenti in entrata o modifiche locali da inviare. Il clic apre Fetch, Scarica, Carica e il collegamento al Controllo Modifiche.",
    "menu_edit_record": "Rinomina / Modifica",
    "menu_copy": "Copia",
    "menu_cut": "Taglia",
    "menu_paste": "Incolla",
    "menu_paste_here": "Incolla qui",
    "menu_paste_folder_here": "Incolla cartella qui",
    "menu_new_record_here": "Crea nuova scheda qui",
    "menu_new_folder_here": "Crea nuova cartella qui",
    "menu_rename_folder": "Rinomina cartella",
    "menu_open_in_explorer": "Apri in Esplora Risorse",
    "menu_copy_folder": "Copia cartella",
    "menu_cut_folder": "Taglia cartella",
    "menu_delete_folder": "Elimina cartella",
    "tooltip_more_actions": "Altre azioni",
    "tooltip_folder_actions": "Azioni cartella",
    "btn_clear_selection": "Deseleziona",
    "selection_count_one": "1 scheda selezionata",
    "selection_count_many": "{var0} schede selezionate",
    "vault_type_shared": "Condiviso",
    "vault_type_backup": "Backup Personale",
    "vault_type_local": "Locale",
    "msg_record_non_in_vista": "Documento non visibile nella vista corrente.",
    "btn_sending": "Invio in corso...",
    "settings_drive_not_connected": "Non Connesso",
    "settings_drive_status_error": "Errore di controllo stato",
    "tooltip_import": "Importa Schedatura (da ZIP)",
    "tooltip_add_folder": "Crea una nuova cartella",
    "tooltip_cloud_sync": "Cloud & Sincronizzazione",

    // === CONDIVISIONE (redesign) ===
    "share_title": "Condivisione",
    "share_local_title": "Condividi questo archivio",
    "share_local_desc": "Crea un archivio condiviso gratuito per lavorare insieme ai tuoi colleghi, oppure unisciti a un archivio con un link di invito.",
    "share_local_share_online": "Condividi online",
    "share_local_create_hub": "Crea Hub condiviso",
    "share_local_have_invite": "Ho ricevuto un invito",
    "share_local_backup_link": "Vuoi solo una copia di sicurezza privata? Backup su Google Drive",
    "modal_cloud_activate_desc_short": "Una copia privata dell'archivio sul tuo Google Drive, accessibile solo a te.",
    "cloud_local_share_link": "Vuoi invece lavorarci insieme ai colleghi? Condividi l'archivio",
    "btn_cloud_login": "Accedi a Google Drive",
    "modal_cloud_relink_title": "Collega a un archivio esistente su Drive",
    "modal_cloud_relink_desc": "Scegli la cartella su Drive con cui questo archivio deve sincronizzarsi. Usalo se un altro PC lavora già su un archivio che qui non vedi.",
    "btn_relink_drive_vault": "Collega a un archivio esistente su Drive",
    "label_currently_linked": "Collegato",
    "msg_ricerca_archivi_drive": "Ricerca degli archivi sul tuo Drive...",
    "msg_archivio_collegato": "Archivio collegato. Sincronizzazione in corso...",
    "msg_nessun_db_sul_cloud": "Nessun database trovato sul Cloud: viene caricata la copia locale. Se questo archivio esiste già su un altro PC, verifica dal menu Cloud di essere collegato alla stessa cartella Drive.",
    "share_migrate_panel_title": "Passare all'archivio condiviso?",
    "share_migrate_bullet1": "L'archivio resta identico sul tuo PC.",
    "share_migrate_bullet2": "Il backup su Google Drive resta come copia di sicurezza.",
    "share_migrate_bullet3": "I collaboratori attuali dovranno ricevere un nuovo link di invito.",
    "btn_continue": "Continua",
    "share_badge_member": "Collaboratore",
    "share_badge_owner": "Proprietario",
    "share_member_note": "Questo archivio è condiviso con te. Solo il proprietario può invitare o rimuovere collaboratori.",
    "share_sync_title": "Sincronizzazione",
    "share_sync_desc": "Scarica le modifiche dei colleghi o invia le tue all'archivio condiviso.",
    "share_receive": "Ricevi modifiche",
    "share_send": "Invia modifiche",
    "share_sync_receive_desc": "Scarica le novità dei colleghi",
    "share_sync_send_desc": "Pubblica le tue modifiche",
    "share_last_update": "Ultimo aggiornamento: {var0}",
    "share_last_update_unknown": "Ultimo aggiornamento: sconosciuto",
    "share_attachments_label": "Condividi anche gli allegati (immagini e PDF)",
    "share_attachments_status_on": "Allegati condivisi tramite il tuo Google Drive.",
    "share_attachments_connect_title": "Per condividere immagini e PDF serve collegare Google Drive",
    "share_attachments_connect_desc": "Spazio gratuito del tuo account Google, usato solo per i tuoi allegati.",
    "share_attachments_connect_btn": "Collega Google Drive",
    "share_attachments_member_off_note": "Il proprietario non ha ancora attivato la condivisione degli allegati.",
    "share_member_leave": "Abbandona questo archivio condiviso",
    "share_member_leave_confirm": "Il tuo PC conserverà una copia locale, ma non riceverai più gli aggiornamenti dei colleghi.",
    "share_invite_title": "Invita un collaboratore",
    "share_invite_desc": "Crea un link d'invito personale. Ogni link crea un collaboratore che puoi revocare in qualsiasi momento.",
    "share_invite_label_ph": "Nome del collaboratore (es. Maria)",
    "share_invite_generate": "Crea link di invito",
    "share_invite_hint": "Chi riceve il link deve avere ArchiView installato: gli basterà cliccarlo.",
    "share_members_title": "Collaboratori",
    "share_members_empty": "Nessun collaboratore ancora. Crea un link di invito qui sopra.",
    "share_chip_revoked": "Revocato",
    "share_revoke_confirm": "Revocare l'accesso di questo collaboratore? Il suo link d'invito smetterà di funzionare.",
    "share_invite_copied": "Link copiato. Invialo a {var0} per email o messaggio.",
    "share_invite_copied_generic": "Link copiato. Invialo al collaboratore per email o messaggio.",
    "share_invite_generated": "Invito creato. Copia il link e condividilo.",
    "share_sync_settings": "Impostazioni di sincronizzazione",
    "share_version": "v",
    "share_widget_btn": "Condividi",
    "btn_copy": "Copia",
    "btn_revoke": "Revoca",
    "btn_manage_share": "Gestisci condivisione",
    "btn_open_share": "Apri Condivisione",
    "btn_create_hub_shared": "Crea un Hub Condiviso",
    "cloud_backup_hint": "Questo è un backup personale sul tuo Cloud privato. Per collaborare con altri, usa un archivio condiviso.",
    "modal_cloud_shared_legacy_desc": "Archivio condiviso su Google Drive (legacy). Passa all'archivio condiviso per inviti revocabili e sincronizzazione in tempo reale.",
    "hub_widget_label": "Hub:",
    "hub_widget_receive": "Ricevi",
    "hub_widget_send": "Invia",
    "hub_invite_default_label": "Invito",
    "msg_membro_revocato": "Accesso revocato.",
    "msg_errore_revoca": "Errore durante la revoca.",
    "btn_pull": "Ricevi modifiche",
    "btn_push": "Invia modifiche",
    "hub_fallback_name": "Archivio condiviso",
    "vault_type_hub": "Hub Condiviso",
    "share_local_name_label": "Nome dell'archivio (lo vedranno tutti i collaboratori)",
    "share_local_name_ph": "Es. Manoscritti Datini",
    "modal_cloud_hub_active": "Hub Condiviso Attivo",
    "modal_cloud_hub_desc": "Questo Archivio è sincronizzato sull'Hub condiviso. Usa \"Gestisci condivisione\" per inviti e collaboratori.",
    "settings_hub_manage_hint": "Inviti, collaboratori, allegati e sincronizzazione automatica si gestiscono dal pannello Condivisione.",
    "settings_sync_none": "Nessuna sincronizzazione cloud (Hub o Google Drive) configurata per questa cartella di lavoro.",
    "btn_export_folder": "Esporta Cartella",
    "msg_il_server_contiene_modifi_action": "Un collega ha appena salvato delle modifiche. Ricevile e poi riprova a inviare.",
    "share_conflict_action_label": "Ricevi ora",
    "prog_hub_prepare_title": "Preparazione dell'archivio condiviso",
    "prog_hub_prepare_desc": "Un attimo di pazienza...",
    "msg_timeout_creazione_repo": "Hub non raggiungibile (timeout). Riprova più tardi.",
    "msg_connesso_con_successo_nome": "Connesso con successo a \"{var0}\"! Riavvio in corso...",
    "msg_update_offline": "Nessuna connessione a Internet: impossibile controllare gli aggiornamenti.",
    "msg_update_no_release": "Nessuna versione pubblicata trovata su GitHub.",
    "msg_update_rate_limited": "Troppe richieste a GitHub, riprova tra qualche minuto.",
    "msg_update_generic": "Errore durante l'aggiornamento: ",
    "btn_release_notes": "Novità di questa versione",
    "modal_release_notes_title": "Note di rilascio",
    "msg_no_release_notes": "Nessuna nota di rilascio disponibile per questa versione.",

    // --- Fase 2.3: OCR degli allegati ---
    // --- Menu contestuali: etichette corte ---
    "menu_edit_short": "Modifica",
    "menu_ocr_short": "Riconosci testo",
    "menu_export_zip": "Esporta ZIP",
    "menu_export_csv": "Esporta CSV",
    "menu_export_tsv": "Esporta TSV",
    "menu_print_short": "Stampa",
    "menu_bulk_move": "Sposta",
    "menu_bulk_type": "Cambia tipo",
    "menu_bulk_tag": "Modifica tag",
    "menu_bulk_replace": "Sostituisci",
    "menu_bulk_ocr": "OCR",
    "menu_select_all_short": "Seleziona tutto",
    "menu_new_record_short": "Nuova scheda",
    "menu_new_folder_short": "Nuova cartella",
    "menu_rename_short": "Rinomina",
    "menu_explorer_short": "Esplora risorse",
    "bulk_export_zip_full": "Esporta la selezione in ZIP",

    // --- Fase 2.2: stampa e PDF ---
    "print_title": "Stampa e PDF",
    "print_scope": "Cosa stampare",
    "print_scope_selection": "Schede selezionate",
    "print_scope_current": "Scheda aperta",
    "print_scope_results": "Risultati correnti",
    "print_scope_folder": "Cartella corrente",
    "print_scope_all": "Tutto l'archivio",
    "print_layout": "Formato",
    "print_layout_card": "Scheda singola",
    "print_layout_card_desc": "Una scheda per pagina, con tutti i campi, gli allegati come miniature e la trascrizione.",
    "print_layout_regest": "Regesto / inventario",
    "print_layout_regest_desc": "Elenco ordinato: segnatura, data e sintesi del contenuto. È il formato di un inventario a stampa.",
    "print_layout_table": "Elenco tabellare",
    "print_layout_table_desc": "Le colonne della vista tabella, una riga per scheda.",
    "print_fund": "Fondo",
    "print_fund_ph": "Es. ASP, Notarile",
    "print_author": "Schedatura di",
    "print_author_ph": "Nome e cognome",
    "print_date": "Data",
    "print_date_ph": "Es. giugno 2026",
    "print_opt_cover": "Frontespizio",
    "print_opt_pages": "Numeri di pagina",
    "print_opt_thumbs": "Miniature degli allegati",
    "print_opt_transcription": "Includi la trascrizione",
    "print_opt_empty": "Mostra anche i campi vuoti",
    "print_orientation": "Orientamento",
    "print_portrait": "Verticale",
    "print_landscape": "Orizzontale",
    "print_count": "{var0} schede da stampare.",
    "print_current_view": "Stampa la vista",
    "print_send": "Stampa",
    "print_save_pdf": "Salva PDF",
    "print_empty": "Non c'è nessuna scheda da stampare.",
    "print_working": "Preparazione del documento…",
    "print_sent": "Documento inviato alla stampante.",
    "print_saved": "PDF salvato.",
    "print_failed": "Stampa non riuscita: ",
    "print_cmd_regest": "Stampa il regesto della cartella",
    "print_cmd_selection": "Stampa la selezione",
    "menu_print_folder": "Stampa cartella",
    "dialog_print_pdf": "Salva in PDF",
    "shortcut_print": "Stampa o salva in PDF",
    "print_doc_title": "Schedatura",
    "print_cover_fund": "Fondo",
    "print_cover_author": "Schedatura a cura di",
    "print_cover_date": "Data",
    "print_cover_count": "Schede",
    "print_section_transcription": "Trascrizione",
    "print_section_attachments": "Allegati",
    "print_no_records": "Nessuna scheda da stampare.",
    "print_untitled": "Senza segnatura",

    // --- Fasi 2.5 e 2.6: export della trascrizione e citazioni ---
    "tx_title": "Esporta testo e citazioni",
    "tx_scope": "Cosa esportare",
    "tx_format": "Formato",
    "tx_group_text": "Il testo della trascrizione",
    "tx_group_citation": "La citazione bibliografica",
    "tx_fmt_html_desc": "Pagina autonoma, apribile in qualsiasi browser e allegabile a un messaggio.",
    "tx_fmt_md_desc": "Testo semplice con la formattazione conservata: per Obsidian, Pandoc, GitHub.",
    "tx_fmt_rtf_desc": "Si apre in Word e LibreOffice mantenendo corsivi, grassetti e note.",
    "tx_fmt_bibtex_desc": "Voce @misc per LaTeX, Zotero e JabRef.",
    "tx_fmt_ris_desc": "Formato di scambio di Zotero, EndNote e Mendeley.",
    "tx_opt_header": "Intestazione con segnatura, date e archivio",
    "tx_count": "{var0} schede, di cui {var1} con trascrizione.",
    "tx_count_citations": "{var0} citazioni da esportare.",
    "tx_export": "Esporta",
    "tx_none": "Non c'è nessuna scheda da esportare.",
    "tx_done": "Esportate {var0} schede.",
    "tx_failed": "Esportazione non riuscita: ",
    "tx_doc_title": "Trascrizioni",
    "tx_empty": "Nessuna trascrizione.",
    "tx_ocr_notice": "Bozza generata da OCR: testo non riletto, i tratti incerti sono segnalati.",
    "tx_cmd_transcription": "Esporta la trascrizione (HTML, Markdown, RTF)",
    "tx_cmd_citation": "Esporta la citazione (BibTeX, RIS)",
    "tx_cmd_selection": "Esporta la trascrizione o la citazione",
    "menu_export_text": "Esporta testo",
    "menu_export_text_folder": "Esporta il testo della cartella",
    "dialog_export_text": "Esporta testo e citazioni",
    "cit_type": "Manoscritto",
    "cit_untitled": "Senza titolo",

    // --- Fase 3.2: data storica fuzzy ---
    "filter_period": "Periodo del documento",
    "filter_year_from": "Dall'anno",
    "filter_year_to": "All'anno",
    "filter_century": "Secolo",
    "filter_any_century": "Qualsiasi secolo",
    "placeholder_data_storica": "Es. 12 maggio 1340, c. 1340, sec. XIV in.",
    "date_read": "Letta come: {var0} ({var1})",
    "date_not_read": "Datazione non interpretata: la scheda resterà in fondo agli ordinamenti cronologici.",
    "date_none": "Senza data.",
    "date_q_exact": "data esatta",
    "date_q_year": "anno",
    "date_q_circa": "circa",
    "date_q_ante": "prima del",
    "date_q_post": "dopo il",
    "date_q_range": "intervallo",
    "date_q_century": "secolo",

    // --- Fase 3.1: campi tipizzati ---
    "value_yes": "Sì",
    "value_no": "No",
    "field_required": "Campo obbligatorio",
    "field_configure": "Configura il campo",
    "field_choose": "— scegli —",
    "field_value_removed": "valore non più previsto",
    "field_type_text": "Testo",
    "field_type_textarea": "Testo lungo",
    "field_type_number": "Numero",
    "field_type_boolean": "Sì / No",
    "field_type_enum": "Elenco a scelta",
    "field_type_url": "Indirizzo web",
    "field_type_date": "Data",
    "field_type_dynamic_list": "Elenco chiave-valore",
    "label_field_type": "Tipo di dato",
    "label_field_options": "Valori ammessi (uno per riga)",
    "placeholder_field_options": "pergamena\ncarta",
    "label_field_required": "Obbligatorio: la scheda non si salva se è vuoto",
    "label_field_unique": "Valore unico: avvisa se un'altra scheda ha lo stesso valore",
    "btn_apply": "Applica",
    "msg_enum_no_options": "Un elenco a scelta ha bisogno di almeno un valore.",
    "msg_link_non_valido": "Indirizzo non valido.",
    "err_field_required": "Il campo \"{var0}\" è obbligatorio.",
    "err_field_number": "Il campo \"{var0}\" deve contenere un numero.",
    "err_field_url": "Il campo \"{var0}\" deve essere un indirizzo web (https://…).",
    "err_field_option": "Il valore del campo \"{var0}\" non è fra quelli previsti.",
    "warn_field_duplicate": "Attenzione: \"{var0}\" ha lo stesso valore di un'altra scheda ({var1}).",

    // --- Fase 3.4: tag come entità ---
    "tag_manager_title": "Gestione tag",
    // Fase 2.4 — import CSV
    "imp_title": "Importa da CSV",
    "folders_empty_with_records": "Nessuna cartella ancora. Le {var0} schede stanno nella radice e le vedi qui accanto nell'elenco.",
    "folders_empty": "Nessuna cartella ancora. Le schede che crei restano nella radice finché non ne fai una.",
    "imp_step_model": "Dove finiscono queste schede?",
    "imp_model_new": "Crea un modello nuovo",
    "imp_model_new_desc": "I campi li costruisci dalle colonne del file, al passo successivo.",
    "imp_model_name": "Nome del modello",
    "imp_model_name_missing": "Dai un nome al modello prima di continuare.",
    "field_locked": "Campo del modello predefinito: non si può togliere né cambiare.",
    "type_locked_note": "Questo è un modello predefinito: nome e campi d'origine non si cambiano — tornerebbero da soli al prossimo avvio. Puoi però aggiungere campi tuoi, modificarli ed eliminarli.",
    "type_name_locked": "Il nome di un modello predefinito non si cambia: è tradotto insieme all'applicazione.",
    "imp_header_row": "Riga con i nomi delle colonne",
    "imp_mapped_count": "{var0} di {var1} colonne importate",
    "imp_sample": "es.",
    "imp_dest_for": "Destinazione della colonna",
    "imp_group_base": "Dati della scheda",
    "imp_group_fields": "Campi dei modelli",
    "imp_group_new": "Campi da creare",
    "imp_new_field": "＋ Crea un campo nuovo…",
    "imp_new_field_name": "Nome del campo",
    "imp_new_field_type": "Tipo del campo",
    "imp_new_field_invalid": "Nome non utilizzabile: è vuoto o coincide con un campo che esiste già.",
    "imp_new_fields": "Verranno aggiunti al modello {var0} i campi: ",
    "imp_state_new_p": "nuove",
    "imp_state_updated_p": "aggiornate",
    "imp_state_skipped_p": "scartate",
    "imp_with_warnings": "con avvisi",
    "imp_and_more": "…e altre {var0} righe.",
    "imp_menu": "Importa CSV",
    "dialog_import_csv": "Importa da CSV",
    "btn_import_zip_full": "Importa un backup ZIP di ArchiView",
    "th_transcription": "Trascrizione",
    "imp_read_error": "File non leggibile: ",
    "imp_empty": "Il file non contiene righe da importare.",
    "imp_rows_found": "{var0} righe",
    "imp_delimiter": "separatore",
    "imp_default_type": "Tipo di documento",
    "imp_default_folder": "Cartella di destinazione",
    "imp_update_existing": "Aggiorna le schede già presenti invece di aggiungerne di nuove",
    "imp_mapping": "Colonne del file",
    "imp_preview": "Anteprima",
    "imp_skip": "— non importare —",
    "imp_row": "riga {var0}",
    "imp_state_new": "nuova",
    "imp_state_updated": "aggiornata",
    "imp_state_skipped": "scartata",
    "imp_summary": "{var0} nuove, {var1} aggiornate, {var2} scartate, {var3} con avvisi.",
    "imp_new_folders": "Verranno creati {var0} archivi: ",
    "imp_confirm": "Importa {var0} schede",
    "imp_nothing": "Niente da importare",
    "imp_done": "Importate {var0} schede ({var1} aggiornate).",
    "imp_hint": "Nulla viene scritto finché non premi Importa. Le righe scartate restano nel file: correggile e reimporta soltanto quelle. L'intero import si annulla con Ctrl+Z.",
    "imp_err_required": "campo obbligatorio mancante",
    "imp_err_number": "non è un numero",
    "imp_err_url": "non è un indirizzo valido",
    "imp_err_option": "valore non fra quelli previsti",
    "imp_err_boolean": "non è un sì/no riconoscibile",
    "imp_err_type": "tipo di documento sconosciuto, si usa quello predefinito",
    "imp_err_short": "la riga ha meno celle dell'intestazione",
    "imp_err_dup": "segnatura già presente in archivio",
    "imp_err_dup_file": "segnatura ripetuta dentro il file",
    "undo_import_csv": "Import di {var0} schede",
    // Fase 4 — cestino, snapshot, cronologia per scheda, undo/redo
    "trash_title": "Cestino",
    "trash_select": "Seleziona questa scheda",
    "trash_restore": "Ripristina",
    "trash_delete_forever": "Elimina definitivamente",
    "trash_empty": "Il cestino è vuoto.",
    "trash_empty_now": "Svuota il cestino",
    "trash_read_error": "Il cestino non è leggibile.",
    "trash_selected": "{var0} selezionate",
    "trash_restored": "{var0} schede ripristinate.",
    "trash_restore_none": "Nessuna scheda da ripristinare.",
    "trash_restore_error": "Ripristino non riuscito: ",
    "trash_delete_error": "Eliminazione non riuscita: ",
    "trash_confirm_delete_many": "Eliminare definitivamente {var0} schede? L'operazione non è annullabile.",
    "trash_confirm_delete_one": "Eliminare definitivamente questa scheda? L'operazione non è annullabile.",
    "trash_confirm_empty": "Svuotare il cestino? Tutte le schede eliminate andranno perse definitivamente.",
    "trash_emptied": "Cestino svuotato ({var0} schede).",
    "trash_from_bulk": "Eliminazione multipla",
    "trash_from_single": "Eliminazione",
    "trash_hint": "Le schede eliminate restano qui per 30 giorni e poi spariscono da sole. Il cestino è locale a questo computer: non viene sincronizzato e non occupa spazio nell'archivio condiviso.",
    "record_untitled": "scheda senza titolo",
    "btn_redo": "Ripeti",
    "msg_nothing_to_redo": "Nessuna azione da ripetere.",
    "msg_ripetuto_var": "Ripetuto: {var0}",
    "msg_errore_ripetizione": "Errore durante la ripetizione dell'azione.",
    "undo_edit_record": "Modifica di \"{var0}\"",
    "undo_rename_folder": "Rinomina di \"{var0}\"",
    "undo_restore_record": "Ripristino della scheda al {var0}",
    "undo_move_records": "Spostamento di {var0} schede",
    "undo_rename_attachment": "Rinomina di un allegato",
    "undo_reorder_attachments": "Riordino degli allegati",
    "shortcut_redo": "Ripeti l'azione annullata (anche Ctrl+Maiusc+Z)",
    "snap_section_title": "Snapshot locali",
    "snap_create_now": "Crea adesso",
    "snap_create_now_hint": "Fotografa subito lo stato dell'archivio",
    "snap_create_cmd": "Crea uno snapshot dell'archivio",
    "snap_empty": "Nessuno snapshot: il primo viene creato da solo mentre lavori.",
    "snap_delete": "Elimina lo snapshot",
    "snap_confirm_delete": "Eliminare questo snapshot? La cronologia locale di quel momento andrà persa.",
    "snap_created": "Snapshot creato.",
    "snap_create_failed": "Snapshot non creato: ",
    "snap_delete_failed": "Snapshot non eliminato: ",
    "snap_restored": "Archivio riportato allo snapshot: {var0} schede.",
    "snap_side_label": "NELLO SNAPSHOT",
    "snap_reason_auto": "automatico",
    "snap_reason_manual": "creato a mano",
    "snap_reason_restore": "prima di un ripristino",
    "snap_reason_import": "prima di un import",
    "menu_record_history": "Cronologia",
    "rec_history_title": "Cronologia della scheda",
    "rec_history_loading": "Ricostruzione della cronologia…",
    "rec_history_failed": "Cronologia non disponibile: ",
    "rec_history_empty": "Nessuno snapshot contiene questa scheda: la cronologia comincia dal primo snapshot.",
    "rec_history_absent": "scheda non presente",
    "rec_history_restore": "Riporta la scheda a questa versione",
    "rec_history_restored": "Scheda riportata alla versione del {var0}.",
    "rec_history_gone": "La scheda non è più in archivio: ripristinala dal cestino.",
    "rec_history_hint": "Le tappe sono ricavate dagli snapshot locali: compaiono solo i momenti in cui questa scheda è cambiata.",
    "settings_safety_title": "Cestino e snapshot",
    "settings_safety_desc": "L'archivio viene fotografato periodicamente su questo computer, e le schede eliminate restano nel cestino prima di sparire. Nulla di tutto ciò viene sincronizzato.",
    "settings_snapshot_auto": "Crea snapshot automatici mentre lavoro",
    "settings_snapshot_recenti": "Snapshot recenti",
    "settings_snapshot_giorni": "Giorni di cronologia",
    "settings_cestino_giorni": "Giorni nel cestino",
    "tag_manager_hint": "Rinomina, fusione ed eliminazione agiscono su tutte le schede dell'archivio, non solo su quelle selezionate. Ogni operazione è annullabile.",
    "tag_rename": "Rinomina",
    "tag_delete": "Elimina il tag",
    "tag_select_for_merge": "Seleziona per la fusione",
    "tag_merge_into": "Fondi i tag scelti in:",
    "btn_tag_merge": "Fondi",
    "tag_color_label": "Colore del tag",
    "tag_color_none": "Nessuno",
    "tag_color_ambra": "Ambra",
    "tag_color_rosso": "Rosso",
    "tag_color_verde": "Verde",
    "tag_color_blu": "Blu",
    "tag_color_viola": "Viola",
    "tag_color_grigio": "Grigio",
    "tag_count_one": "1 scheda",
    "tag_count_many": "{var0} schede",
    "undo_tag_rename": "Rinomina di un tag",
    "undo_tag_merge": "Fusione di tag",
    "undo_tag_delete": "Eliminazione di un tag",
    "msg_tag_renamed": "Tag rinominato su {var0} schede.",
    "msg_tag_merged": "Tag fusi su {var0} schede.",
    "msg_tag_deleted": "Tag rimosso da {var0} schede.",
    "msg_tag_nothing": "Nessuna scheda modificata.",
    "msg_tag_rename_merges": "Un tag con questo nome esiste già: i due sono stati fusi.",
    "menu_tag_manager": "Gestione tag…",

    // --- Fasi 3.3, 3.5 e 3.6: vocabolari, anagrafica, collegamenti, duplicati ---
    "vocab_title": "Vocabolari controllati",
    "vocab_new": "Nuovo vocabolario",
    "vocab_new_value": "Nuovo valore…",
    "vocab_none": "Nessun vocabolario. Creane uno per condividere una lista di valori con tutto il gruppo.",
    "vocab_delete": "Elimina il vocabolario",
    "vocab_remove_value": "Togli dall'elenco",
    "vocab_used_by": "Schede che usano questo valore",
    "vocab_own_values": "— valori scritti qui sotto —",
    "vocab_add_inline": "Aggiungi un valore al vocabolario",
    "vocab_hint": "Un vocabolario è condiviso da tutto l'archivio e viaggia con la sincronizzazione. Rinominare un valore lo aggiorna in tutte le schede; toglierlo dall'elenco non lo cancella dalle schede che lo contengono.",
    "label_field_vocab": "Prendi i valori da un vocabolario d'archivio",
    "label_field_authority": "Alimenta l'anagrafica di",
    "msg_vocab_exists": "Esiste già un vocabolario con questo nome.",
    "msg_vocab_renamed": "Valore rinominato su {var0} schede.",
    "msg_vocab_value_removed": "Valore tolto dall'elenco. Le schede che lo contengono lo conservano.",
    "msg_vocab_deleted": "Vocabolario eliminato. I campi che lo usavano conservano i valori come elenco proprio.",
    "undo_vocab_rename": "Rinomina di un valore",
    "auth_title": "Persone e luoghi",
    "auth_people": "Persone",
    "auth_places": "Luoghi",
    "auth_filter": "Filtra…",
    "auth_type_none": "Nessuna",
    "auth_type_persona": "Persone",
    "auth_type_luogo": "Luoghi",
    "auth_none": "Nessuna voce. Le persone e i luoghi si raccolgono dai campi marcati come tali nell'editor del tipo documento.",
    "auth_show_records": "Mostra le schede che la citano",
    "auth_hint": "L'elenco si ricava dalle schede: non è un archivio parallelo. Rinominare una voce riscrive il nome in tutte le schede che lo citano, ed è il modo di unificare due grafie della stessa persona.",
    "undo_auth_rename": "Rinomina in anagrafica",
    "msg_auth_renamed": "Nome aggiornato su {var0} schede.",
    "label_links": "Collegamenti ad altre schede",
    "link_none": "Nessun collegamento.",
    "link_generic": "collegata a",
    "link_choose": "— scegli una scheda —",
    "link_add": "Aggiungi il collegamento",
    "link_remove": "Togli il collegamento",
    "link_missing": "scheda non presente in questa copia",
    "no_signature": "Senza segnatura",
    "undo_link_add": "Collegamento fra schede",
    "undo_link_del": "Rimozione di un collegamento",
    "msg_link_added": "Collegamento aggiunto.",
    "msg_link_removed": "Collegamento rimosso.",
    "dup_title": "Segnature ripetute",
    "dup_none": "Nessuna segnatura ripetuta.",
    "dup_found": "{var0} segnature ripetute.",
    "dup_hint": "Una segnatura ripetuta non è per forza un errore: un fondo può contenerne per inventariazioni precedenti alla schedatura. L'elenco le segnala, la decisione resta a chi guarda.",
    "warn_signature_duplicate": "Attenzione: la segnatura \"{var0}\" è già usata da un'altra scheda ({var1} in tutto).",
    "btn_add": "Aggiungi",
    "link_panel_title": "Schede collegate",
    "link_outgoing": "Questa scheda rimanda a",
    "link_incoming": "È richiamata da",
    "menu_links": "Collegate",
    "filter_links": "Collegamenti",
    "filter_has_links": "Con collegamenti",
    "filter_no_links": "Senza collegamenti",
    "graph_title": "Grafo dei collegamenti",
    "menu_graph": "Grafo",
    "graph_show_isolated": "Mostra anche le schede senza collegamenti",
    "graph_relayout": "Ricalcola la disposizione",
    "graph_summary": "{var0} schede, {var1} collegamenti, {var2} gruppi",
    "graph_empty": "Nessuna scheda collegata. I collegamenti si aggiungono dal form della scheda, nel blocco \"Collegamenti ad altre schede\".",
    "graph_truncated": "Mostrate le {var0} schede più collegate su {var1}: oltre questa soglia il grafo non si legge più.",
    "graph_hint": "Clic su un nodo per isolarlo con i suoi vicini, doppio clic per aprire la scheda. Trascina per spostare, rotella per lo zoom.",
    "graph_open_record": "Apri la scheda",

    "ocr_title": "Riconosci testo (OCR)",
    "ocr_button": "Riconosci testo",
    "ocr_menu_entry": "Riconosci testo (OCR)…",
    "ocr_start": "Riconosci",
    "ocr_source": "Allegato",
    "ocr_source_all": "Tutti gli allegati della scheda",
    "ocr_langs": "Lingue",
    "ocr_langs_title": "Lingue del riconoscimento",
    "ocr_langs_hint": "Più lingue insieme rallentano il riconoscimento: sceglile solo se il documento le mescola davvero.",
    "ocr_langs_loading": "Lettura in corso…",
    "ocr_langs_offline_hint": "I dati si scaricano una sola volta e restano su questo computer: dopo l'installazione il riconoscimento funziona senza connessione.",
    "ocr_no_langs": "Nessuna lingua installata: il riconoscimento ha bisogno almeno di una lingua.",
    "ocr_manage_langs": "Gestisci lingue…",
    "ocr_lang_install": "Installa",
    "ocr_lang_remove": "Rimuovi",
    "ocr_lang_installing": "Download…",
    "ocr_lang_removing": "Rimozione…",
    "ocr_lang_error": "Operazione non riuscita: serve una connessione per scaricare i dati di lingua.",
    "ocr_destination": "Destinazione",
    "ocr_dest_draft": "Inserisci come bozza nella trascrizione",
    "ocr_dest_index": "Rendi il testo cercabile",
    "ocr_dest_hint": "Il testo cercabile resta legato all'allegato e non tocca la trascrizione: serve a ritrovare la scheda, non a sostituire il lavoro di lettura.",
    "ocr_advanced": "Opzioni avanzate",
    "ocr_dpi": "Risoluzione di scansione dei PDF",
    "ocr_dpi_fast": "veloce",
    "ocr_dpi_default": "consigliata",
    "ocr_dpi_slow": "lenta, testo minuto",
    "ocr_max_pages": "Pagine massime per PDF",
    "ocr_max_pages_hint": "Il limite esiste perché un PDF di trecento carte occuperebbe il programma per ore senza che nessuno lo abbia chiesto.",
    "ocr_phase_page": "Pagina",
    "ocr_phase_raster": "Preparazione immagine",
    "ocr_phase_recognize": "Riconoscimento",
    "ocr_phase_lang": "Caricamento lingua",
    "ocr_phase_init": "Avvio del motore",
    "ocr_page_of": "pagina {var0} di {var1}",
    "ocr_provenance": "Bozza generata da OCR ({var0}) il {var1} — da rivedere",
    "ocr_pick_lang": "Scegli almeno una lingua.",
    "ocr_pick_dest": "Scegli almeno una destinazione per il testo.",
    "ocr_no_attachments": "Questa scheda non ha allegati da riconoscere.",
    "ocr_no_attachments_sel": "Nessuna delle schede selezionate ha allegati.",
    "ocr_failed": "Nessun testo riconosciuto.",
    "ocr_done": "Riconoscimento completato.",
    "ocr_result_summary": "{var0} caratteri riconosciuti, confidenza media {var1}%",
    "ocr_low_confidence": "Confidenza bassa: probabilmente la scrittura è corsiva o la scansione è poco leggibile. Il testo va riletto parola per parola.",
    "ocr_saved_index": "Testo reso cercabile.",
    "ocr_saved_draft": "Bozza inserita nella trascrizione.",
    "ocr_draft_skipped": "Trascrizione lasciata invariata.",
    "ocr_overwrite_title": "Trascrizione già presente",
    "ocr_overwrite_desc": "Alcune carte hanno già una trascrizione. La bozza dell'OCR può sostituirla o essere aggiunta in fondo. Il testo sostituito non è recuperabile.",
    "ocr_overwrite_append": "Aggiungi in fondo",
    "ocr_overwrite_replace": "Sostituisci",
    "ocr_bulk_title": "OCR delle schede selezionate",
    "ocr_bulk_progress": "Scheda {var0} di {var1}: {var2}",
    "ocr_bulk_done": "OCR completato: {var0} allegati in {var1} schede.",
    "filter_ocr": "Testo OCR",
    "filter_has_ocr": "Con testo OCR",
    "filter_no_ocr": "Senza testo OCR",
    "settings_ocr_desc": "Il riconoscimento del testo (OCR) funziona senza connessione, ma ogni lingua va installata una volta. I dati restano su questo computer e non vengono sincronizzati.",
    "trasc_current_sheet": "Carta {var0} di {var1} — {var2}"
};

window.t = function(key, fallback) {
    if (window.linguaAttuale === 'en' && customEn[key]) return customEn[key];
    if (window.linguaAttuale === 'it' && customIt[key]) return customIt[key];
    const res = i18n._({ id: key });
    if (res === key && fallback) return fallback;
    return res;
}

// Funzione globale per cambiare lingua
window.cambiaLingua = async function(lang) {
    window.linguaAttuale = lang;
    const settings = await window.apiSettings.get();
    settings.lang = lang;
    await window.apiSettings.save(settings);
    i18n.activate(lang);
    document.documentElement.lang = lang;
    window.applicaTraduzioniHtml();
    
    // Rendi nuovamente l'interfaccia principale per applicare i cambiamenti
    if (typeof renderMain === 'function') renderMain();
    if (typeof renderSidebar === 'function') renderSidebar();
}

window.applicaTraduzioniHtml = function() {
    // Sostituisce il testo (innerHTML).
    // Il testo statico presente nell'HTML (in italiano) viene memorizzato come
    // fallback: se una chiave non è ancora tradotta si mostra quel testo invece
    // della chiave grezza (es. "btn_create_hub").
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (!el.hasAttribute('data-i18n-default')) {
            el.setAttribute('data-i18n-default', el.textContent || '');
        }
        const def = el.getAttribute('data-i18n-default') || key;
        el.innerHTML = window.sanitizeHTML(window.t(key, def));
    });

    // Sostituisce il title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = window.t(key, el.title || key);
    });

    // Sostituisce il placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (!el.hasAttribute('data-i18n-ph-default')) {
            el.setAttribute('data-i18n-ph-default', el.placeholder || '');
        }
        el.placeholder = window.t(key, el.getAttribute('data-i18n-ph-default') || key);
    });

    // Sostituisce l'aria-label (accessible name per bottoni icona)
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label');
        el.setAttribute('aria-label', window.t(key, el.getAttribute('aria-label') || key));
    });

    // Le scorciatoie vanno riapplicate qui: le righe sopra hanno appena riscritto
    // title e aria-label dalle chiavi, cancellando il suffisso precedente.
    if (typeof window.applicaScorciatoieTooltip === 'function') window.applicaScorciatoieTooltip();
}

// Applica le traduzioni all'avvio
document.addEventListener('DOMContentLoaded', () => {
    window.applicaTraduzioniHtml();
});
