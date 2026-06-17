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
    window.applicaTraduzioniHtml();
};

function _linguiExtraction() {
    i18n._({ id: "welcome_title", message: "Benvenuto in ArchiView" });
    i18n._({ id: "welcome_desc", message: "Per iniziare, è necessario creare o selezionare un <strong>Archivio di lavoro</strong>.<br><br>In questo archivio verranno salvati in automatico tutti i dati (il database) e gli allegati (come i PDF e le foto). Ti consigliamo di creare un archivio dedicato (ad esempio in \"Documenti\") per tenere tutto in ordine e al sicuro." });
    i18n._({ id: "btn_choose_folder", message: "Scegli o crea archivio" });
    i18n._({ id: "modal_new_folder", message: "Nuovo Archivio" });
    i18n._({ id: "label_folder_name", message: "Nome dell'archivio o percorso" });
    i18n._({ id: "hint_folder_name", message: "Consiglio: usa la barra ( / ) per creare automaticamente sottoarchivi." });
    i18n._({ id: "btn_prev", message: "Precedente" });
    i18n._({ id: "btn_next", message: "Successiva" });
    i18n._({ id: "btn_cancel", message: "Annulla" });
    i18n._({ id: "btn_create_folder", message: "Crea Archivio" });
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
    i18n._({ id: "folder_empty", message: "L'archivio è vuoto." });
    i18n._({ id: "btn_delete_folder", message: "Elimina questo archivio" });
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
    i18n._({ id: "btn_backup_private", message: "Backup Privato" });
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
    i18n._({ id: "btn_convert_backup_private", message: "Converti in Backup Privato" });
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
    i18n._({ id: "msg_folder_deleted", message: "Archivio eliminato." });
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
}

// Wrapper per compatibilità con il codice esistente
const customEn = {
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
    "msg_l_archivio_vuoto_nulla_da": "The archive is empty, nothing to export.",
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
    "btn_create_cloud_private": "Create a Private Cloud Archive",
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
    "confirm_delete_archive_empty": "Are you sure you want to delete the archive \"{var0}\"? All empty sub-archives will be removed.",
    "confirm_delete_archive_with_docs": "The archive \"{var0}\" contains {var1} documents. Deleting it will also delete all documents inside it. Do you want to proceed?",
    "confirm_delete_model": "Are you sure you want to delete this model?",
    "confirm_tutorial_demo": "You are about to load the Demo archive. The current archive will be closed. Do you want to proceed?"
};

const customIt = {
    "dialog_select_folder": "Seleziona la posizione per il nuovo archivio",
    "dialog_export_zip": "Esporta Backup in ZIP",
    "dialog_import_zip": "Importa Archivio JSON",
    "btn_procedi": "Procedi",
    "modal_folder_title": "Gestione Archivi",
    "welcome_desc_gestione": "Scegli una cartella di destinazione per creare un nuovo archivio indipendente, oppure seleziona un archivio esistente per caricarne i dati.",
    "btn_open_local": "Apri Archivio Locale",
    "btn_create_local": "Crea Nuova Cartella Locale",
    "btn_create_cloud_private": "Crea Archivio Cloud Personale",
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
    "confirm_delete_archive_empty": "Sei sicuro di voler eliminare l'archivio \"{var0}\"? Tutte le sotto-cartelle vuote verranno rimosse.",
    "confirm_delete_archive_with_docs": "L'archivio \"{var0}\" contiene {var1} documenti. Eliminandolo verranno eliminati anche tutti i documenti all'interno. Vuoi procedere?",
    "confirm_delete_model": "Sei sicuro di voler eliminare questo modello?",
    "confirm_tutorial_demo": "Stai per caricare l'archivio Demo. L'archivio attuale verrà chiuso. Vuoi procedere?"
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
    window.applicaTraduzioniHtml();
    
    // Rendi nuovamente l'interfaccia principale per applicare i cambiamenti
    if (typeof renderMain === 'function') renderMain();
    if (typeof renderSidebar === 'function') renderSidebar();
}

window.applicaTraduzioniHtml = function() {
    // Sostituisce il testo (innerHTML)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerHTML = window.sanitizeHTML(window.t(key));
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
