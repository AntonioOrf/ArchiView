const fs = require('fs');
const path = require('path');

const poPath = path.join(__dirname, '../src/renderer/locales/en/messages.po');
let poContent = fs.readFileSync(poPath, 'utf8');

const translations = {
    'tut_welcome_title': 'Welcome to ArchiView',
    'tut_welcome_desc': 'This guided tour will show you the main features of the system. Click "Next" to start the presentation.',
    'tut_toolbar_title': 'Global Toolbar',
    'tut_toolbar_desc': 'This area allows quick navigation between main sections and access to archive management functions.',
    'tut_models_title': 'Models Management',
    'tut_models_desc': 'Click this button to create or customize document models. A model defines which fields (e.g. Date, Author, Notes) will be available when filling a record.',
    'tut_new_model_title': 'Model Creation',
    'tut_new_model_desc': 'In this window you can select a predefined model or create a fully customized one by adding your fields. Close the window (with the X or Cancel) to proceed.',
    'tut_search_title': 'Global Search',
    'tut_search_desc': 'To explore advanced search tools, click on the magnifying glass icon.',
    'tut_search_engine_title': 'Advanced Search Engine',
    'tut_search_engine_desc': 'The system indexes and searches keywords within metadata, titles, and transcription bodies in real-time.',
    'tut_tags_title': 'Cataloging System',
    'tut_tags_desc': 'To access tag-based classification features, select the bookmark icon.',
    'tut_tags_filter_title': 'Semantic Filters and Tags',
    'tut_tags_filter_desc': 'This section allows organizing the documentary heritage through customizable labels. Selecting a tag applies an immediate filter to the entire archive.',
    'tut_cloud_sync_title': 'Remote Synchronization',
    'tut_cloud_sync_desc': 'Cloud repository management tools: use "Fetch" to check for updates, "Download" to align the local database, and "Upload" to publish your revisions.',
    'tut_source_control_title': 'Version Control',
    'tut_source_control_desc': 'To analyze the status of unsynchronized revisions, select the Source Control icon.',
    'tut_source_status_title': 'Revision Status',
    'tut_source_status_desc': 'This view summarizes locally made changes. Before syncing, you can review or selectively cancel each operation.',
    'tut_cloud_integration_title': 'Cloud Integration',
    'tut_cloud_integration_desc': 'The current archive is configured in local mode. Select the Cloud icon in the bottom left corner to explore connectivity options.',
    'tut_cloud_panel_title': 'Remote Configuration Panel',
    'tut_cloud_panel_desc': 'From this interface, you can convert the local archive into a Shared database (optimized for teamwork) or a Personal one (with integrated automatic backup). Close the window to continue.',
    'tut_vaults_title': 'Multi-Archive Management',
    'tut_vaults_desc': 'ArchiView allows you to create and manage an unlimited number of separate archives (vaults). Clicking this button lets you quickly switch between archives, create new local ones, link Cloud ones, or manage Shared Archives to collaborate with your team.',
    'tut_nav_return_title': 'Return to Navigation',
    'tut_nav_return_desc': 'To restore the main view and browse records, select the folder icon.',
    'tut_card_edit_title': 'Accessing the Record',
    'tut_card_edit_desc': 'To consult or update a document\'s metadata, select the "Edit" button located on its card.',
    'tut_editor_title': 'Record Editor',
    'tut_editor_desc': 'This panel allows extended cataloging of the document and management of its digital attachments. The interface keeps save commands always accessible. Click the arrow in the top left to return to the archive.',
    'tut_transcribe_title': 'Transcription Module',
    'tut_transcribe_desc': 'Now select the "Transcribe" button on a card to launch the environment dedicated to the analysis and transcription of the original document.',
    'tut_transcribe_env_title': 'Integrated Transcription Environment',
    'tut_transcribe_env_desc': 'This area presents the manuscript image alongside the advanced text editor. It is recommended to use the Ctrl+S shortcut for quick saving. Click the arrow in the top left to return to the archive.',
    'tut_context_menu_title': 'Contextual Operations',
    'tut_context_menu_desc': 'The platform supports contextual menus (right-click) on archive items for quick access to export, duplication, and removal functions.',
    'tut_done_title': 'Configuration Complete',
    'tut_done_desc': 'The system is now ready for use. You can replay this training presentation at any time by selecting the (?) icon.',
    'tut_btn_next': 'Next',
    'tut_btn_prev': 'Previous',
    'tut_btn_done': 'Done'
};

for (const [key, value] of Object.entries(translations)) {
    const regex = new RegExp(`msgid "${key}"\\r?\\nmsgstr ""`, 'g');
    poContent = poContent.replace(regex, `msgid "${key}"\nmsgstr "${value.replace(/"/g, '\\"')}"`);
}

fs.writeFileSync(poPath, poContent, 'utf8');
console.log('Translations applied successfully!');
