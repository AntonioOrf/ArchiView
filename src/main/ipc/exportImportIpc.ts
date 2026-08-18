const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { state } = require('../workspaceManager');
const { extractZipStreaming } = require('./zipStreaming');

function setupExportImportIpc() {
  ipcMain.handle('export-zip', async (event, ids, titleDialog) => {
    if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
    
    // Leggi il database
    const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
    if (!fs.existsSync(dbPath)) return { success: false, error: 'Database non trovato' };
    
    const dbData = await fs.promises.readFile(dbPath, 'utf8');
    const db = JSON.parse(dbData);
    const manoscritti = db.manoscritti || [];
    
    // Trova i manoscritti richiesti
    const toExport = manoscritti.filter(m => ids.includes(m.id));
    if (toExport.length === 0) return { success: false, error: 'Nessun manoscritto trovato per l\'esportazione' };
    
    // Trova gli allegati necessari
    const allegatiDir = path.join(state.workspacePath, 'allegati_manoscritti');
    const requiredAttachments = new Set();
    
    for (const m of toExport) {
        if (m.allegati) {
            let files = [];
            if (typeof m.allegati === 'string') {
                files = [m.allegati];
            } else if (Array.isArray(m.allegati)) {
                files = m.allegati;
            }
            files.forEach(f => requiredAttachments.add(typeof f === 'string' ? f : f.name || f.path));
        }
    }
    
    // Scegli dove salvare
    const defaultName = ids.length === 1 ? `Esportazione_${toExport[0].segnatura || 'Manoscritto'}.zip` : `Esportazione_Multipla.zip`;
    const result = await dialog.showSaveDialog({
        title: 'Esporta Schedatura',
        defaultPath: defaultName,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
    });
    
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    
    // Crea lo zip
    return new Promise((resolve) => {
        const output = fs.createWriteStream(result.filePath);
        // Lazy require: archiver serve solo qui, non a ogni avvio dell'app.
        const archiver = require('archiver');
        const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
        
        output.on('close', () => resolve({ success: true, count: toExport.length }));
        archive.on('error', (err) => resolve({ success: false, error: err.message }));
        
        archive.pipe(output);
        
        // Aggiungi il JSON con solo i manoscritti filtrati
        archive.append(JSON.stringify({ manoscritti: toExport }, null, 2), { name: 'schedatura.json' });
        
        // Aggiungi gli allegati
        if (fs.existsSync(allegatiDir)) {
            for (const att of requiredAttachments) {
                // Puliamo il nome dell'allegato se è un path assoluto (dovrebbe essere solo il nome)
                const attName = path.basename(att);
                const attPath = path.join(allegatiDir, attName);
                if (fs.existsSync(attPath)) {
                    archive.file(attPath, { name: `allegati/${attName}` });
                }
            }
        }
        
        archive.finalize();
    });
  });

  ipcMain.handle('import-zip', async () => {
    if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
    
    const result = await dialog.showOpenDialog({
        title: 'Importa Schedatura',
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
        properties: ['openFile']
    });
    
    if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
    
    const zipPath = result.filePaths[0];
    
    try {
        // Estrazione in streaming (yauzl, lazyEntries): l'archivio non viene mai caricato
        // interamente in RAM, requisito su macchine con 4GB dove AdmZip mandava in swap.
        const estratto = await extractZipStreaming(zipPath, path.join(state.workspacePath, 'allegati_manoscritti'));
        if (!estratto.json) return { success: false, error: 'File non valido: manca schedatura.json' };

        let data;
        try {
            data = JSON.parse(estratto.json);
        } catch (e) {
            return { success: false, error: 'Formato JSON non valido' };
        }
        if (!data.manoscritti || !Array.isArray(data.manoscritti)) return { success: false, error: 'Formato JSON non valido' };

        return { success: true, manoscritti: data.manoscritti };
    } catch (e) {
        let errorMsg = e.message || String(e);
        if (/invalid|not a zip|end of central directory/i.test(errorMsg)) {
            errorMsg = "File ZIP non valido, corrotto, oppure generato incorrettamente. Assicurati che sia un'esportazione valida di ArchiView e non superi i limiti di memoria.";
        }
        return { success: false, error: errorMsg };
    }
  });

  ipcMain.handle('duplicate-records', async (event, ids, targetFolder) => {
      if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
      
      const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
      if (!fs.existsSync(dbPath)) return { success: false, error: 'Database non trovato' };
      
      const dbData = await fs.promises.readFile(dbPath, 'utf8');
      const db = JSON.parse(dbData);
      if (!db.manoscritti) db.manoscritti = [];
      
      const toDuplicate = db.manoscritti.filter(m => ids.includes(m.id));
      if (toDuplicate.length === 0) return { success: false, error: 'Nessun record da duplicare' };
      
      const allegatiDir = path.join(state.workspacePath, 'allegati_manoscritti');
      let duplicatedCount = 0;
      
      for (const original of toDuplicate) {
          const clone = JSON.parse(JSON.stringify(original));
          clone.id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
          clone.titolo = clone.titolo ? clone.titolo + ' (Copia)' : 'Copia';
          if (clone.segnatura) clone.segnatura += ' (Copia)';
          if (targetFolder) clone.cartella = targetFolder;
          
          // Duplica gli allegati
          if (clone.allegati) {
              let allegatiArr = Array.isArray(clone.allegati) ? clone.allegati : [clone.allegati];
              let nuoviAllegati = [];
              for (const att of allegatiArr) {
                  const origName = typeof att === 'string' ? att : att.name || att.path;
                  if (!origName) continue;
                  
                  const origPath = path.join(allegatiDir, path.basename(origName));
                  if (fs.existsSync(origPath)) {
                      const ext = path.extname(origName);
                      const base = path.basename(origName, ext);
                      const newName = `${base}_copia_${Date.now()}${ext}`;
                      const newPath = path.join(allegatiDir, newName);
                      fs.copyFileSync(origPath, newPath);
                      nuoviAllegati.push(newName);
                  }
              }
              clone.allegati = nuoviAllegati;
          }
          
          db.manoscritti.push(clone);
          duplicatedCount++;
      }
      
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      return { success: true, count: duplicatedCount };
  });
}

module.exports = { setupExportImportIpc };
export {};
