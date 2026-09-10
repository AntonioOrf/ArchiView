const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('apiBrowser', {
    leggiDati: () => ipcRenderer.invoke('leggi-dati'),
    salvaDati: (dati) => ipcRenderer.invoke('salva-dati', dati),
    leggiDatiBase: () => ipcRenderer.invoke('leggi-dati-base'),
    salvaDatiBase: (dati) => ipcRenderer.invoke('salva-dati-base', dati),
    onDatabaseModificatoEsterno: (callback) => ipcRenderer.on('database-modificato-esterno', () => callback()),
    onInviteUrl: (callback) => ipcRenderer.on('handle-invite-url', (event, url) => callback(url)),
    
    // Funzioni aggiornate per gestire qualsiasi tipo di allegato
    salvaAllegato: (filePath, documentoId) => ipcRenderer.invoke('salva-allegato', filePath, documentoId),
    onAllegatoScaricato: (callback) => ipcRenderer.on('allegato-scaricato', (event, fileName) => callback(fileName)),
    verificaHashAllegato: (fileName, expectedHash) => ipcRenderer.invoke('verifica-hash-allegato', fileName, expectedHash),
    apriPdfEsterno: (fileName) => ipcRenderer.invoke('apri-pdf-esterno', fileName),
    mostraCartellaAllegato: (fileName) => ipcRenderer.invoke('mostra-cartella-allegato', fileName),
    getAllegatoPath: (fileName) => ipcRenderer.invoke('get-allegato-path', fileName),
    getPathForFile: (file) => webUtils.getPathForFile(file),
    
    onRequestClose: (callback) => ipcRenderer.on('request-close', () => callback()),
    confirmClose: () => ipcRenderer.send('confirm-close'),

    getPerfMode: () => ipcRenderer.invoke('get-perf-mode'),
    setPerfMode: (lowPerf) => ipcRenderer.invoke('set-perf-mode', lowPerf),

    getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),
    getVaultConfig: () => ipcRenderer.invoke('get-vault-config'),
    setVaultType: (payload) => ipcRenderer.invoke('set-vault-type', payload),
    setRealtimeConfig: (payload) => ipcRenderer.invoke('set-realtime-config', payload),
    saveHubConfig: (config) => ipcRenderer.invoke('save-hub-config', config),
    loadHubConfig: () => ipcRenderer.invoke('load-hub-config'),
    disconnectHub: () => ipcRenderer.invoke('disconnect-hub'),
    syncHubAttachments: () => ipcRenderer.invoke('hub-sync-attachments'),
    hubCreateRepo: (name) => ipcRenderer.invoke('hub-create-repo', name),
    getRecentWorkspaces: () => ipcRenderer.invoke('get-recent-workspaces'),
    loadTutorialWorkspace: () => ipcRenderer.invoke('load-tutorial-workspace'),
    openRecentWorkspace: (folderPath) => ipcRenderer.invoke('open-recent-workspace', folderPath),
    changeWorkspace: (title) => ipcRenderer.invoke('change-workspace', title),
    getDocumentsPath: () => ipcRenderer.invoke('get-documents-path'),
    apriCartellaWorkspace: () => ipcRenderer.invoke('apri-cartella-workspace'),
    selectBaseDirectory: (title) => ipcRenderer.invoke('select-base-directory', title),
    createWorkspaceInPath: (basePath, name, config) => ipcRenderer.invoke('create-workspace-in-path', basePath, name, config),
    cloneWorkspaceHub: (basePath, folderName, hubConfig, database) => ipcRenderer.invoke('clone-workspace-hub', basePath, folderName, hubConfig, database),
    exportWorkspaceZip: (title) => ipcRenderer.invoke('export-workspace-zip', title),
    exportZip: (ids, title) => ipcRenderer.invoke('export-zip', ids, title),
    exportCsv: (ids, opzioni) => ipcRenderer.invoke('export-csv', ids, opzioni),
    importZip: (title) => ipcRenderer.invoke('import-zip', title),
    // Fase 2.4 — il main apre il dialogo e legge il file; l'analisi e la costruzione delle
    // schede stanno in shared/csvImport.ts, che gira nel renderer (vedi exportImportIpc.ts).
    importCsvLeggi: (titolo) => ipcRenderer.invoke('import-csv-leggi', titolo),
    // Stampa e PDF (Fase 2.2): il renderer manda ids + opzioni e riceve un esito. Template,
    // finestra di rendering e stampante restano nel main.
    printPdf: (ids, opzioni) => ipcRenderer.invoke('print-pdf', ids, opzioni),
    printDirect: (ids, opzioni) => ipcRenderer.invoke('print-direct', ids, opzioni),
    // Export testuali (Fasi 2.5 e 2.6): il renderer manda ids + opzioni, il main scrive il
    // file. HTML/Markdown/RTF per la trascrizione, BibTeX/RIS per la citazione.
    exportTranscript: (ids, opzioni) => ipcRenderer.invoke('export-transcript', ids, opzioni),
    exportCitations: (ids, opzioni) => ipcRenderer.invoke('export-citations', ids, opzioni),
    duplicateRecords: (ids, targetFolder) => ipcRenderer.invoke('duplicate-records', ids, targetFolder),
    deleteVaultLocal: (path) => ipcRenderer.invoke('delete-vault-local', path),
    
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    apriLinkEsterno: (url) => ipcRenderer.invoke('apri-link-esterno', url),
    getVersion: () => ipcRenderer.invoke('get-version'),
    inviaSegnalazione: (payload) => ipcRenderer.invoke('invia-segnalazione', payload),
    onExportProgress: (callback) => ipcRenderer.on('export-progress', (event, progress) => callback(progress)),
    
    // Auto-updater
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, progressObj) => callback(progressObj)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, payload) => callback(payload))
});

// OCR degli allegati (Fase 2.3). Il renderer non vede mai né tesseract né pdf.js: chiede
// un riconoscimento e riceve testo. Motore, pagine e dati di lingua restano nel main.
contextBridge.exposeInMainWorld('apiOcr', {
    lingue: () => ipcRenderer.invoke('ocr-lingue'),
    installaLingua: (codice) => ipcRenderer.invoke('ocr-installa-lingua', codice),
    rimuoviLingua: (codice) => ipcRenderer.invoke('ocr-rimuovi-lingua', codice),
    esegui: (opzioni) => ipcRenderer.invoke('ocr-esegui', opzioni),
    annulla: () => ipcRenderer.invoke('ocr-annulla'),
    stato: () => ipcRenderer.invoke('ocr-stato'),
    onProgress: (callback) => ipcRenderer.on('ocr-progress', (event, dati) => callback(dati))
});

// Fase 4 — sicurezza del dato. Il renderer non vede mai un percorso: chiede per nome di
// snapshot o per id di scheda. Cestino e snapshot vivono in <workspace>/.archiview/ e non
// entrano nel database, quindi non si sincronizzano (vedi main/trash.ts).
contextBridge.exposeInMainWorld('apiSicurezza', {
    cestinoElenca: () => ipcRenderer.invoke('cestino-elenca'),
    cestinoAggiungi: (records, da) => ipcRenderer.invoke('cestino-aggiungi', records, da),
    cestinoPrendi: (ids) => ipcRenderer.invoke('cestino-prendi', ids),
    cestinoElimina: (ids) => ipcRenderer.invoke('cestino-elimina', ids),
    cestinoSvuota: () => ipcRenderer.invoke('cestino-svuota'),
    snapshotElenca: () => ipcRenderer.invoke('snapshot-elenca'),
    snapshotCrea: (motivo) => ipcRenderer.invoke('snapshot-crea', motivo),
    snapshotCarica: (nome) => ipcRenderer.invoke('snapshot-carica', nome),
    snapshotElimina: (nome) => ipcRenderer.invoke('snapshot-elimina', nome),
    storiaRecord: (id) => ipcRenderer.invoke('snapshot-storia-record', id)
});

contextBridge.exposeInMainWorld('apiSettings', {
    get: () => ipcRenderer.invoke('get-settings'),
    save: (settings) => ipcRenderer.invoke('save-settings', settings)
});

contextBridge.exposeInMainWorld('apiDrive', {
    auth: (forceLocal) => ipcRenderer.invoke('drive-auth', forceLocal),
    logout: () => ipcRenderer.invoke('drive-logout'),
    status: () => ipcRenderer.invoke('drive-status'),
    checkAuth: () => ipcRenderer.invoke('drive-check-auth'),
    onStatusUpdated: (callback) => ipcRenderer.on('drive-status-updated', (event, data) => callback(data)),
    listVaults: () => ipcRenderer.invoke('drive-list-vaults'),
    pull: (vaultId) => ipcRenderer.invoke('drive-pull', vaultId),
    sync: (parentTime) => ipcRenderer.invoke('drive-sync', parentTime),
    syncAttachments: () => ipcRenderer.invoke('drive-sync-attachments'),
    checkUpdates: () => ipcRenderer.invoke('drive-check-updates'),
    generateInvite: () => ipcRenderer.invoke('drive-generate-invite'),
    joinInvite: (code, basePath, name) => ipcRenderer.invoke('drive-join-invite', code, basePath, name),
    decodeInvite: (code) => ipcRenderer.invoke('drive-decode-invite', code),
    onSyncProgress: (callback) => ipcRenderer.on('sync-progress', (event, data) => callback(data)),
    pulisciAllegatiOrfani: () => ipcRenderer.invoke('drive-clean-orphans'),
    peekDb: (vaultId) => ipcRenderer.invoke('drive-peek-db', vaultId),
    shareVault: (email) => ipcRenderer.invoke('drive-share-vault', email),
    listPermissions: () => ipcRenderer.invoke('drive-list-permissions'),
    removePermission: (permissionId) => ipcRenderer.invoke('drive-remove-permission', permissionId),
    getClientId: () => ipcRenderer.invoke('drive-get-client-id'),
    joinByFolderId: (folderId, vaultName, basePath, customPusher) => ipcRenderer.invoke('drive-join-folder-id', folderId, vaultName, basePath, customPusher),
    // --- Storico Versioni Cloud ---
    getDbFileId: () => ipcRenderer.invoke('drive-get-db-file-id'),
    listRevisions: (fileId) => ipcRenderer.invoke('drive-list-revisions', fileId),
    getRevision: (fileId, revisionId) => ipcRenderer.invoke('drive-get-revision', fileId, revisionId),
    restoreRevision: (fileId, revisionId) => ipcRenderer.invoke('drive-restore-revision', fileId, revisionId),
    openExternalPicker: () => ipcRenderer.invoke('drive-open-external-picker'),
    getFileMeta: (fileId) => ipcRenderer.invoke('drive-get-file-meta', fileId)
});

contextBridge.exposeInMainWorld('apiMicrosoft', {
    auth: (forceLocal) => ipcRenderer.invoke('ms-auth', forceLocal),
    logout: () => ipcRenderer.invoke('ms-logout'),
    status: () => ipcRenderer.invoke('ms-status'),
    pull: (vaultId) => ipcRenderer.invoke('ms-pull', vaultId),
    sync: () => ipcRenderer.invoke('ms-sync'),
    checkUpdates: () => ipcRenderer.invoke('ms-check-updates'),
    generateInvite: () => ipcRenderer.invoke('ms-generate-invite'),
    pulisciAllegatiOrfani: () => ipcRenderer.invoke('ms-clean-orphans'),
    peekDb: (vaultId) => ipcRenderer.invoke('ms-peek-db', vaultId)
});
export {};
