import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { safeAttachmentPathOrNull } from './pathSafety';
import { hashFile } from '../chunkingLogic';

const MAX_JSON_BYTES = 64 * 1024 * 1024;

const MARGINE_DISCO_BYTES = 1024 * 1024 * 1024;

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

function extractZipStreaming(zipPath: string, allegatiDir: string,
  opzioni: { spazioLibero?: (dir: string) => number | null; avanzamento?: (fatte: number, totale: number) => void } = {}): Promise<{ json: string | null; copiati: number; saltati: number; rinominati: { [nome: string]: string } }> {
  const yauzl = require('yauzl');
  const libero = (opzioni.spazioLibero || spazioLiberoDisco)(allegatiDir);
  const tetto = libero == null ? Infinity : Math.max(0, libero - MARGINE_DISCO_BYTES);
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) return reject(err);

      let jsonText: string | null = null;
      let settled = false;
      let totaleAllegati = 0;
      let copiati = 0;
      let saltati = 0;
      const rinominati: { [nomeNelloZip: string]: string } = {};
      const fail = (e) => { if (!settled) { settled = true; try { zipfile.close(); } catch (_) {} reject(e); } };

      zipfile.on('error', fail);
      zipfile.on('end', () => { if (!settled) { settled = true; resolve({ json: jsonText, copiati, saltati, rinominati }); } });

      let fatte = 0;
      zipfile.on('entry', (entry) => {
        const name = entry.fileName;
        if (opzioni.avanzamento) opzioni.avanzamento(++fatte, zipfile.entryCount);

        if (name === 'schedatura.json') {
          if (entry.uncompressedSize > MAX_JSON_BYTES) return fail(new Error('schedatura.json troppo grande per essere importato'));
          return zipfile.openReadStream(entry, (e, stream) => {
            if (e) return fail(e);
            const chunks: Buffer[] = [];
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
          totaleAllegati += entry.uncompressedSize;
          if (totaleAllegati > tetto) {
            return fail(new Error('Spazio su disco insufficiente per estrarre gli allegati dell\'archivio'));
          }

          try { fs.mkdirSync(allegatiDir, { recursive: true }); } catch (e) { return fail(e); }

          return zipfile.openReadStream(entry, (e, stream) => {
            if (e) return fail(e);
            const tmpPath = `${attPath}.${crypto.randomBytes(4).toString('hex')}.part`;
            const out = fs.createWriteStream(tmpPath);
            const impronta = crypto.createHash('sha256');
            stream.on('data', (c) => impronta.update(c));
            const failPulito = (errore) => {
              stream.unpipe(out);
              out.destroy();
              fs.rm(tmpPath, { force: true }, () => fail(errore));
            };
            stream.on('error', failPulito);
            out.on('error', failPulito);
            out.on('close', async () => {
              try {
                let verso = attPath;
                if (fs.existsSync(attPath)) {
                  if (await hashFile(attPath) === impronta.digest('hex')) { fs.rmSync(tmpPath, { force: true }); saltati++; return zipfile.readEntry(); }
                  const ext = path.extname(attName);
                  // ponytail: exists + rename non è atomico; basta perché il renderer non lancia due import insieme.
                  for (let n = 2; fs.existsSync(verso); n++) verso = path.join(path.dirname(attPath), `${path.basename(attName, ext)}_${n}${ext}`);
                  rinominati[attName] = path.basename(verso);
                }
                fs.renameSync(tmpPath, verso);
                copiati++;
              } catch (err) { return fail(err); }
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


export { extractZipStreaming, MAX_JSON_BYTES, MARGINE_DISCO_BYTES };
