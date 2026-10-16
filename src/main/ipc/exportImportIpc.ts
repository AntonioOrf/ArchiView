import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { state } from '../workspaceManager';
import { extractZipStreaming } from './zipStreaming';
import { generaCsv } from './csvExport';
import { leggiDb, recordsRichiesti, nomeFileSicuro } from './recordSelection';
import { scriviAtomico } from '../scritturaAtomica';

function setupExportImportIpc() {
  ipcMain.handle('export-zip', async (event, ids, titleDialog) => {
    if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
    
    const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
    if (!fs.existsSync(dbPath)) return { success: false, error: 'Database non trovato' };
    
    const dbData = await fs.promises.readFile(dbPath, 'utf8');
    const db = JSON.parse(dbData);
    const manoscritti = db.manoscritti || [];
    
    const toExport = manoscritti.filter(m => ids.includes(m.id));
    if (toExport.length === 0) return { success: false, error: 'Nessun manoscritto trovato per l\'esportazione' };
    
    const allegatiDir = state.attachmentsDirPath;
    const requiredAttachments = new Set<string>();
    
    for (const m of toExport) {
        for (const a of Array.isArray(m.allegati) ? m.allegati : []) {
            if (a && typeof a.nome === 'string' && a.nome) requiredAttachments.add(a.nome);
        }
    }
    
    const defaultName = ids.length === 1 ? `Esportazione_${toExport[0].segnatura || 'Manoscritto'}.zip` : `Esportazione_Multipla.zip`;
    const result = await dialog.showSaveDialog({
        title: 'Esporta Schedatura',
        defaultPath: defaultName,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
    });
    
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    
    return new Promise((resolve) => {
        const output = fs.createWriteStream(result.filePath);
        const archiver = require('archiver');
        const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
        
        output.on('close', () => resolve({ success: true, count: toExport.length }));
        output.on('error', (err) => { archive.abort(); resolve({ success: false, error: err.message }); });
        archive.on('error', (err) => resolve({ success: false, error: err.message }));
        
        archive.pipe(output);
        
        archive.append(JSON.stringify({ manoscritti: toExport }, null, 2), { name: 'schedatura.json' });
        
        if (fs.existsSync(allegatiDir)) {
            for (const att of requiredAttachments) {
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

  ipcMain.handle('export-csv', async (event, ids, opzioni) => {
    if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
    const opt = opzioni || {};
    const formato = opt.formato === 'tsv' ? 'tsv' : 'csv';

    try {
      const db = await leggiDb();
      if (!db) return { success: false, error: 'Database non trovato' };
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

  ipcMain.handle('import-zip', async (event) => {
    if (!state.workspacePath) return { success: false, error: 'Nessun workspace aperto' };
    
    const result = await dialog.showOpenDialog({
        title: 'Importa Schedatura',
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
        properties: ['openFile']
    });
    
    if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
    
    const zipPath = result.filePaths[0];
    const nome = path.basename(zipPath);
    const nonArchiview = (dettaglio) => ({ success: false, codice: 'non_archiview', error: dettaglio, dettaglio });

    try {
        const estratto = await extractZipStreaming(zipPath, state.attachmentsDirPath, {
            avanzamento: (fatte, totale) => {
                if (event && event.sender && !event.sender.isDestroyed()) event.sender.send('import-zip-avanzamento', { nome, fatte, totale });
            }
        });
        if (!estratto.json) return nonArchiview('File non valido: manca schedatura.json');

        let data;
        try {
            data = JSON.parse(estratto.json);
        } catch (e) {
            return nonArchiview('Formato JSON non valido');
        }
        if (!data.manoscritti || !Array.isArray(data.manoscritti)) return nonArchiview('Formato JSON non valido');

        return { success: true, manoscritti: data.manoscritti, copiati: estratto.copiati, saltati: estratto.saltati };
    } catch (e) {
        const dettaglio = e.message || String(e);
        let codice = 'altro';
        let errorMsg = dettaglio;
        if (/invalid|not a zip|end of central directory/i.test(dettaglio)) {
            codice = 'zip_non_valido';
            errorMsg = "File ZIP non valido, corrotto, oppure generato incorrettamente. Assicurati che sia un'esportazione valida di ArchiView e non superi i limiti di memoria.";
        } else if (e.code === 'ENOSPC' || /Spazio su disco insufficiente/.test(dettaglio)) {
            codice = 'spazio';
        } else if (['EACCES', 'EPERM', 'EBUSY', 'EROFS'].includes(e.code)) {
            codice = 'permessi';
        }
        return { success: false, codice, error: errorMsg, dettaglio };
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
      
      const allegatiDir = state.attachmentsDirPath;
      let duplicatedCount = 0;
      
      for (const original of toDuplicate) {
          const clone = JSON.parse(JSON.stringify(original));
          clone.id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
          clone.titolo = clone.titolo ? clone.titolo + ' (Copia)' : 'Copia';
          if (clone.segnatura) clone.segnatura += ' (Copia)';
          if (targetFolder) clone.cartella = targetFolder;
          
          if (Array.isArray(clone.allegati)) {
              for (const att of clone.allegati) {
                  if (!att || typeof att.nome !== 'string' || !att.nome) continue;
                  const origName = path.basename(att.nome);
                  const origPath = path.join(allegatiDir, origName);
                  if (!fs.existsSync(origPath)) continue;
                  const ext = path.extname(origName);
                  const newName = `${path.basename(origName, ext)}_copia_${Date.now()}${ext}`;
                  fs.copyFileSync(origPath, path.join(allegatiDir, newName));
                  att.nome = newName;
              }
          }
          
          db.manoscritti.push(clone);
          duplicatedCount++;
      }
      
      await scriviAtomico(dbPath, JSON.stringify(db));
      return { success: true, count: duplicatedCount };
  });
}

export { setupExportImportIpc };
