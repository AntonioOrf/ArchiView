// Estrazione ZIP in streaming, isolata dall'IPC per poter essere testata senza Electron.
const fs = require('fs');
const path = require('path');
const { safeAttachmentPathOrNull } = require('./pathSafety');

// Limite di sicurezza per il JSON in memoria: oltre questa soglia l'import viene rifiutato
// invece di far esplodere l'heap su macchine deboli.
const MAX_JSON_BYTES = 64 * 1024 * 1024;

// Spazio che l'import lascia comunque libero sul disco degli allegati.
const MARGINE_DISCO_BYTES = 1024 * 1024 * 1024;

/** Byte disponibili sul volume di `dir` (o del primo antenato esistente); `null` se ignoto. */
function spazioLiberoDisco(dir: string): number | null {
  let corrente = path.resolve(dir);
  for (;;) {
    try {
      const s = fs.statfsSync(corrente);
      return Number(s.bavail) * Number(s.bsize);
    } catch {
      const padre = path.dirname(corrente);
      if (padre === corrente) return null;
      corrente = padre;
    }
  }
}

/**
 * Estrae uno ZIP entry-per-entry senza caricarlo in RAM.
 * - `schedatura.json` viene bufferizzato (unico contenuto che serve in memoria, con cap).
 * - Le entry `allegati/*` vengono scritte su disco via pipe stream→file.
 * I nomi sono normalizzati con `path.basename` per neutralizzare lo zip-slip, poi passano
 * da `safeAttachmentPath` (niente ADS né nomi riservati di Windows): un nome rifiutato si salta.
 *
 * Tetto: la somma delle dimensioni dichiarate degli allegati non deve superare lo spazio
 * libero meno `MARGINE_DISCO_BYTES` (uno zip bomb riempirebbe il disco). Le dimensioni
 * dichiarate sono affidabili: yauzl (`validateEntrySizes`, attivo di default) interrompe
 * lo stream di un'entry che produce più byte di quelli dichiarati.
 */
function extractZipStreaming(zipPath: string, allegatiDir: string,
  opzioni: { spazioLibero?: (dir: string) => number | null } = {}): Promise<{ json: string | null }> {
  const yauzl = require('yauzl');
  const libero = (opzioni.spazioLibero || spazioLiberoDisco)(allegatiDir);
  const tetto = libero == null ? Infinity : Math.max(0, libero - MARGINE_DISCO_BYTES);
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) return reject(err);

      let jsonText: string | null = null;
      let settled = false;
      let totaleAllegati = 0;
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
          const attPath = safeAttachmentPathOrNull(allegatiDir, attName);
          if (!attPath) {
            console.warn(`[import zip] allegato con nome non valido saltato: ${attName}`);
            return zipfile.readEntry();
          }
          if (fs.existsSync(attPath)) return zipfile.readEntry();

          totaleAllegati += entry.uncompressedSize;
          if (totaleAllegati > tetto) {
            return fail(new Error('Spazio su disco insufficiente per estrarre gli allegati dell\'archivio'));
          }

          try { fs.mkdirSync(allegatiDir, { recursive: true }); } catch (e) { return fail(e); }

          return zipfile.openReadStream(entry, (e, stream) => {
            if (e) return fail(e);
            // Scrittura su file temporaneo + rename: un import interrotto non lascia allegati troncati.
            const tmpPath = `${attPath}.part`;
            const out = fs.createWriteStream(tmpPath);
            const failPulito = (errore) => {
              stream.unpipe(out);
              out.destroy();
              fs.rm(tmpPath, { force: true }, () => fail(errore));
            };
            stream.on('error', failPulito);
            out.on('error', failPulito);
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


module.exports = { extractZipStreaming, MAX_JSON_BYTES, MARGINE_DISCO_BYTES };
export {};
