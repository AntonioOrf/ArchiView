// Estrazione ZIP in streaming, isolata dall'IPC per poter essere testata senza Electron.
const fs = require('fs');
const path = require('path');

// Limite di sicurezza per il JSON in memoria: oltre questa soglia l'import viene rifiutato
// invece di far esplodere l'heap su macchine deboli.
const MAX_JSON_BYTES = 64 * 1024 * 1024;

/**
 * Estrae uno ZIP entry-per-entry senza caricarlo in RAM.
 * - `schedatura.json` viene bufferizzato (unico contenuto che serve in memoria, con cap).
 * - Le entry `allegati/*` vengono scritte su disco via pipe stream→file.
 * I nomi sono normalizzati con `path.basename` per neutralizzare lo zip-slip.
 */
function extractZipStreaming(zipPath: string, allegatiDir: string): Promise<{ json: string | null }> {
  const yauzl = require('yauzl');
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) return reject(err);

      let jsonText: string | null = null;
      let settled = false;
      const fail = (e) => { if (!settled) { settled = true; try { zipfile.close(); } catch (_) {} reject(e); } };

      zipfile.on('error', fail);
      zipfile.on('end', () => { if (!settled) { settled = true; resolve({ json: jsonText }); } });

      zipfile.on('entry', (entry) => {
        const name = entry.fileName;

        if (name === 'schedatura.json') {
          if (entry.uncompressedSize > MAX_JSON_BYTES) return fail(new Error('schedatura.json troppo grande per essere importato'));
          return zipfile.openReadStream(entry, (e, stream) => {
            if (e) return fail(e);
            const chunks = [];
            let size = 0;
            stream.on('data', (c) => {
              size += c.length;
              if (size > MAX_JSON_BYTES) { stream.destroy(); return fail(new Error('schedatura.json troppo grande per essere importato')); }
              chunks.push(c);
            });
            stream.on('error', fail);
            stream.on('end', () => { jsonText = Buffer.concat(chunks).toString('utf8'); zipfile.readEntry(); });
          });
        }

        if (name.startsWith('allegati/') && !name.endsWith('/')) {
          const attName = path.basename(name);
          if (!attName) return zipfile.readEntry();
          const attPath = path.join(allegatiDir, attName);
          if (fs.existsSync(attPath)) return zipfile.readEntry();

          try { fs.mkdirSync(allegatiDir, { recursive: true }); } catch (e) { return fail(e); }

          return zipfile.openReadStream(entry, (e, stream) => {
            if (e) return fail(e);
            // Scrittura su file temporaneo + rename: un import interrotto non lascia allegati troncati.
            const tmpPath = `${attPath}.part`;
            const out = fs.createWriteStream(tmpPath);
            stream.on('error', fail);
            out.on('error', fail);
            out.on('close', () => {
              try { fs.renameSync(tmpPath, attPath); } catch (err) { return fail(err); }
              zipfile.readEntry();
            });
            stream.pipe(out);
          });
        }

        zipfile.readEntry();
      });

      zipfile.readEntry();
    });
  });
}


module.exports = { extractZipStreaming, MAX_JSON_BYTES };
export {};
