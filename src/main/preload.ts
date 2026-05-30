const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('apiBrowser', {
    leggiDati: () => ipcRenderer.invoke('leggi-dati'),
    salvaDati: (dati) => ipcRenderer.invoke('salva-dati', dati),
    onDatabaseModificatoEsterno: (callback) => ipcRenderer.on('database-modificato-esterno', () => callback()),
    
    // Funzioni aggiornate per gestire qualsiasi tipo di allegato
    salvaAllegato: (filePath, documentoId) => ipcRenderer.invoke('salva-allegato', filePath, documentoId),
    onAllegatoScaricato: (callback) => ipcRenderer.on('allegato-scaricato', (event, fileName) => callback(fileName)),
    verificaHashAllegato: (fileName, expectedHash) => ipcRenderer.invoke('verifica-hash-allegato', fileName, expectedHash),
    apriPdfEsterno: (fileName) => ipcRenderer.invoke('apri-pdf-esterno', fileName),
    getAllegatoPath: (fileName) => ipcRenderer.invoke('get-allegato-path', fileName),
    getPathForFile: (file) => webUtils.getPathForFile(file),
    
    getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),
    saveHubConfig: (config) => ipcRenderer.invoke('save-hub-config', config),
    loadHubConfig: () => ipcRenderer.invoke('load-hub-config'),
    getRecentWorkspaces: () => ipcRenderer.invoke('get-recent-workspaces'),
    openRecentWorkspace: (folderPath) => ipcRenderer.invoke('open-recent-workspace', folderPath),
    changeWorkspace: (title) => ipcRenderer.invoke('change-workspace', title),
    getDocumentsPath: () => ipcRenderer.invoke('get-documents-path'),
    selectBaseDirectory: () => ipcRenderer.invoke('select-base-directory'),
    createWorkspaceInPath: (basePath, name) => ipcRenderer.invoke('create-workspace-in-path', basePath, name),
    cloneWorkspaceHub: (basePath, folderName, hubConfig, database) => ipcRenderer.invoke('clone-workspace-hub', basePath, folderName, hubConfig, database),
    exportWorkspaceZip: (title) => ipcRenderer.invoke('export-workspace-zip', title),
    deleteVaultLocal: (path) => ipcRenderer.invoke('delete-vault-local', path),
    
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    apriLinkEsterno: (url) => ipcRenderer.invoke('apri-link-esterno', url),
    onExportProgress: (callback) => ipcRenderer.on('export-progress', (event, progress) => callback(progress)),
    
    // Auto-updater
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, progressObj) => callback(progressObj)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback())
});

contextBridge.exposeInMainWorld('apiSettings', {
    get: () => ipcRenderer.invoke('get-settings'),
    save: (settings) => ipcRenderer.invoke('save-settings', settings)
});

contextBridge.exposeInMainWorld('apiDrive', {
    auth: () => ipcRenderer.invoke('drive-auth'),
    logout: () => ipcRenderer.invoke('drive-logout'),
    status: () => ipcRenderer.invoke('drive-status'),
    listVaults: () => ipcRenderer.invoke('drive-list-vaults'),
    pull: (vaultId) => ipcRenderer.invoke('drive-pull', vaultId),
    sync: () => ipcRenderer.invoke('drive-sync'),
    checkUpdates: () => ipcRenderer.invoke('drive-check-updates'),
    generateInvite: () => ipcRenderer.invoke('drive-generate-invite'),
    joinInvite: (code, basePath, name) => ipcRenderer.invoke('drive-join-invite', code, basePath, name),
    decodeInvite: (code) => ipcRenderer.invoke('drive-decode-invite', code),
    onSyncProgress: (callback) => ipcRenderer.on('sync-progress', (event, data) => callback(data)),
    pulisciAllegatiOrfani: () => ipcRenderer.invoke('drive-clean-orphans'),
    peekDb: (vaultId) => ipcRenderer.invoke('drive-peek-db', vaultId)
});
export {};
