const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { state } = require('../workspaceManager');
const { extractZipStreaming } = require('./zipStreaming');
const { generaCsv } = require('./csvExport');
const { leggiDb, recordsRichiesti, nomeFileSicuro } = require('./recordSelection');

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

  // Fase 2.1 — Export CSV/TSV. Il main resta l'unico a toccare il disco; etichette e nomi
  // dei tipi arrivano dal renderer perché la i18n vive solo lì.
  ipcMain.handle('export-csv', async (event, ids, opzioni) => {
    if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
    const opt = opzioni || {};
    const formato = opt.formato === 'tsv' ? 'tsv' : 'csv';

    try {
      const db = await leggiDb();
      if (!db) return { success: false, error: 'Database non trovato' };
      // L'ordine della selezione arriva dal renderer: preservarlo rende l'export
      // riproducibile rispetto a quello che l'utente vede a schermo (`recordSelection`).
      const toExport = recordsRichiesti(db, ids);
      if (toExport.length === 0) return { success: false, error: "Nessun record trovato per l'esportazione" };

      const contenuto = generaCsv(toExport, db.tipiDocumento || [], {
        formato,
        etichette: opt.etichette || {},
        nomiTipi: opt.nomiTipi || {}
      });

      const safeBase = nomeFileSicuro(toExport.length === 1 ? toExport[0].segnatura : 'Schedatura', 'Schedatura');
      const result = await dialog.showSaveDialog({
        title: opt.titolo || 'Esporta in CSV',
        defaultPath: `${safeBase}.${formato}`,
        filters: formato === 'tsv'
          ? [{ name: 'TSV (tab-separated)', extensions: ['tsv'] }]
          : [{ name: 'CSV (Excel, R, Python)', extensions: ['csv'] }]
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };

      await fs.promises.writeFile(result.filePath, contenuto, 'utf8');
      return { success: true, count: toExport.length, path: result.filePath };
    } catch (e) {
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  });

  // Fase 2.4 — Import CSV. Il main fa SOLO ciò che il renderer non può fare: il dialogo e la
  // lettura del file. L'analisi e la costruzione delle schede stanno in `shared/csvImport.ts`,
  // che gira nel renderer, così il wizard ricalcola l'anteprima a ogni tendina cambiata senza
  // un giro di IPC per volta — e soprattutto perché l'anteprima e l'import definitivo devono
  // passare per lo STESSO codice, o il dry-run non prova nulla.
  //
  // ⚠️ Il file viene letto come UTF-8 con una riserva su Windows: i CSV salvati da Excel in
  // "CSV (delimitato da separatore di elenco)" sono in ANSI/Windows-1252, e letti come UTF-8
  // riempirebbero di caratteri di sostituzione proprio le diacritiche di un archivio italiano.
  // Il riconoscimento è per presenza di U+FFFD, che in un UTF-8 valido non compare mai.
  ipcMain.handle('import-csv-leggi', async (event, titolo) => {
    if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
    const result = await dialog.showOpenDialog({
      title: titolo || 'Importa da CSV',
      filters: [
        { name: 'CSV / TSV', extensions: ['csv', 'tsv', 'txt'] },
        { name: 'Tutti i file', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

    const percorso = result.filePaths[0];
    try {
      const buffer = await fs.promises.readFile(percorso);
      // 40 MB: un CSV di schedatura sta in pochi MB, e oltre questa soglia il costo non è il
      // file ma le decine di migliaia di righe da rendere nell'anteprima del wizard.
      if (buffer.length > 40 * 1024 * 1024) return { success: false, error: 'File troppo grande (oltre 40 MB)' };

      let testo = buffer.toString('utf8');
      if (testo.indexOf('�') !== -1) {
        testo = buffer.toString('latin1');
      }
      return { success: true, testo, path: percorso, nome: path.basename(percorso) };
    } catch (e) {
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
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
