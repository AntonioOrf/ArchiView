const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('apiBrowser', {
    leggiDati: () => ipcRenderer.invoke('leggi-dati'),
    salvaDati: (dati) => ipcRenderer.invoke('salva-dati', dati),
    
    // Funzioni aggiornate per gestire qualsiasi tipo di allegato
    salvaAllegato: (filePath) => ipcRenderer.invoke('salva-allegato', filePath),
    leggiImmagine: (fileName) => ipcRenderer.invoke('leggi-immagine', fileName),
    apriPdfEsterno: (fileName) => ipcRenderer.invoke('apri-pdf-esterno', fileName)
});