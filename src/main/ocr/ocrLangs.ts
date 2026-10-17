import { app, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
const fsp = require('fs').promises;
import * as zlib from 'zlib';

const BASE_URL = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/';
const MAX_LINGUA_BYTES = 100 * 1024 * 1024;
const TIMEOUT_DOWNLOAD_MS = 5 * 60 * 1000;
const gunzip = require('util').promisify(zlib.gunzip);

const LINGUE_NOTE = [
  { codice: 'ita', nome: 'Italiano' },
  { codice: 'lat', nome: 'Latino' },
  { codice: 'eng', nome: 'Inglese' },
  { codice: 'fra', nome: 'Francese' },
  { codice: 'deu', nome: 'Tedesco' },
  { codice: 'spa', nome: 'Spagnolo' },
  { codice: 'ita_old', nome: 'Italiano (ortografia antica)' },
  { codice: 'osd', nome: 'Rilevamento orientamento' }
];

function codiceValido(codice) {
  return typeof codice === 'string' && /^[a-z]{3}(_[a-z]+)?$/.test(codice);
}

function cartellaLingue() {
  const dir = path.join(app.getPath('userData'), 'ocr-langs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function percorsoLingua(codice) {
  if (!codiceValido(codice)) throw new Error(`Codice lingua non valido: ${codice}`);
  return path.join(cartellaLingue(), `${codice}.traineddata`);
}

function linguaInstallata(codice) {
  try {
    return codiceValido(codice) && fs.existsSync(percorsoLingua(codice));
  } catch {
    return false;
  }
}

function codiciInstallati(): string[] {
  try {
    return fs.readdirSync(cartellaLingue())
      .filter(f => f.endsWith('.traineddata'))
      .map(f => f.slice(0, -'.traineddata'.length))
      .filter(codiceValido)
      .sort();
  } catch {
    return [];
  }
}

function listaLingue() {
  const installate = new Set<string>(codiciInstallati());
  const out = LINGUE_NOTE.map(l => ({
    ...l,
    installata: installate.has(l.codice),
    dimensione: installate.has(l.codice) ? dimensioneLingua(l.codice) : 0
  }));
  for (const c of installate) {
    if (!LINGUE_NOTE.some(l => l.codice === c)) {
      out.push({ codice: c, nome: c, installata: true, dimensione: dimensioneLingua(c) });
    }
  }
  return out;
}

function dimensioneLingua(codice) {
  try {
    return fs.statSync(percorsoLingua(codice)).size;
  } catch {
    return 0;
  }
}

async function installaLingua(codice) {
  if (!codiceValido(codice)) return { ok: false, errore: 'codice_non_valido' };
  if (linguaInstallata(codice)) return { ok: true, gia: true };

  const destinazione = percorsoLingua(codice);
  const temporaneo = destinazione + '.part';

  try {
    let dati: Buffer | null = null;
    for (const [url, comprimuto] of [
      [BASE_URL + codice + '.traineddata.gz', true],
      [BASE_URL + codice + '.traineddata', false]
    ] as Array<[string, boolean]>) {
      const risposta = await net.fetch(url, { signal: AbortSignal.timeout(TIMEOUT_DOWNLOAD_MS) });
      if (!risposta.ok) continue;
      if (Number(risposta.headers.get('content-length')) > MAX_LINGUA_BYTES) return { ok: false, errore: 'troppo_grande' };
      const buffer = Buffer.from(await risposta.arrayBuffer());
      if (buffer.length > MAX_LINGUA_BYTES) return { ok: false, errore: 'troppo_grande' };
      try {
        dati = comprimuto ? await gunzip(buffer, { maxOutputLength: MAX_LINGUA_BYTES }) : buffer;
      } catch (e: any) {
        if (e && e.code === 'ERR_BUFFER_TOO_LARGE') return { ok: false, errore: 'troppo_grande' };
        throw e;
      }
      break;
    }

    if (!dati || dati.length < 1024) {
      return { ok: false, errore: 'non_trovata' };
    }

    await fsp.writeFile(temporaneo, dati);
    await fsp.rename(temporaneo, destinazione);
    return { ok: true, dimensione: dati.length };
  } catch (errore) {
    console.error(`[OCR] Installazione lingua ${codice} fallita:`, errore);
    try { if (fs.existsSync(temporaneo)) await fsp.unlink(temporaneo); } catch {}
    return { ok: false, errore: errore && errore.message ? errore.message : 'rete' };
  }
}

async function rimuoviLingua(codice) {
  if (!codiceValido(codice)) return { ok: false, errore: 'codice_non_valido' };
  try {
    const p = percorsoLingua(codice);
    if (fs.existsSync(p)) await fsp.unlink(p);
    return { ok: true };
  } catch (errore) {
    console.error(`[OCR] Rimozione lingua ${codice} fallita:`, errore);
    return { ok: false, errore: errore && errore.message ? errore.message : 'io' };
  }
}

export { LINGUE_NOTE, MAX_LINGUA_BYTES, codiceValido, cartellaLingue, percorsoLingua, linguaInstallata, codiciInstallati, listaLingue, installaLingua, rimuoviLingua };
