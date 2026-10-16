import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
const fsp = require('fs').promises;
import * as crypto from 'crypto';
import { leggiCorpoLimitato, fetchGuardata, urlAmmesso } from './reteSicura';

const TETTO_BYTE = 2 * 1024 * 1024 * 1024;

const MAX_IMMAGINE = 80 * 1024 * 1024;

const TIMEOUT_MS = 20000;

function cartella() {
  const dir = path.join(app.getPath('userData'), 'iiif-cache');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function chiave(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

function percorsi(url: string) {
  const base = path.join(cartella(), chiave(url));
  return { dati: base, meta: base + '.mime', parziale: base + '.part' };
}


function decodificaRiferimento(riferimento: string): any {
  const b64 = String(riferimento || '').replace(/-/g, '+').replace(/_/g, '/');
  let testo = '';
  try {
    testo = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return null;
  }
  if (!testo) return null;
  if (testo[0] !== '{') return testo;
  try {
    return JSON.parse(testo);
  } catch {
    return null;
  }
}

async function leggiDallaCache(url: string) {
  const p = percorsi(url);
  try {
    const dati = await fsp.readFile(p.dati);
    let mime = 'image/jpeg';
    try { mime = (await fsp.readFile(p.meta, 'utf8')) || mime; } catch {}
    fsp.utimes(p.dati, new Date(), new Date()).catch(() => {});
    return { dati, mime };
  } catch {
    return null;
  }
}

async function scriviInCache(url: string, dati: Buffer, mime: string) {
  const p = percorsi(url);
  try {
    await fsp.writeFile(p.parziale, dati);
    await fsp.rename(p.parziale, p.dati);
    await fsp.writeFile(p.meta, mime);
  } catch (errore) {
    console.warn('[IIIF] Scrittura in cache fallita:', (errore as any) && (errore as any).message);
    try { if (fs.existsSync(p.parziale)) await fsp.unlink(p.parziale); } catch {}
  }
}

async function scarica(url: string): Promise<{ dati: Buffer; mime: string } | null> {
  try {
    const risposta = await fetchGuardata(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept': 'image/jpeg,image/png,image/*;q=0.8' }
    });
    if (!risposta.ok) {
      console.warn(`[IIIF] Immagine non disponibile (${risposta.status}): ${url}`);
      return null;
    }

    const dichiarata = Number(risposta.headers.get('content-length') || 0);
    if (dichiarata && dichiarata > MAX_IMMAGINE) {
      console.warn(`[IIIF] Immagine troppo grande (${dichiarata} byte): ${url}`);
      return null;
    }

    const dati = await leggiCorpoLimitato(risposta, MAX_IMMAGINE);
    if (!dati) {
      console.warn(`[IIIF] Immagine oltre ${MAX_IMMAGINE} byte, interrotta: ${url}`);
      return null;
    }
    if (!dati.length) return null;

    const mime = (risposta.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!/^image\//i.test(mime)) {
      console.warn(`[IIIF] Risposta non immagine (${mime}): ${url}`);
      return null;
    }
    return { dati, mime };
  } catch (errore) {
    console.warn(`[IIIF] Scaricamento fallito (${url}):`, (errore as any) && (errore as any).message);
    return null;
  }
}

async function immagine(candidati: string | string[]): Promise<{ dati: Buffer; mime: string } | null> {
  const elenco = (Array.isArray(candidati) ? candidati : [candidati]).filter(urlAmmesso);
  if (!elenco.length) return null;

  const chiaveCache = elenco[0];
  const inCache = await leggiDallaCache(chiaveCache);
  if (inCache) return inCache;

  for (const url of elenco) {
    const esito = await scarica(url);
    if (!esito) continue;
    if (url !== chiaveCache) {
      console.log(`[IIIF] Misura richiesta non disponibile, servita dal ripiego: ${url}`);
    }
    await scriviInCache(chiaveCache, esito.dati, esito.mime);
    return esito;
  }

  console.warn(`[IIIF] Nessun candidato utilizzabile per ${chiaveCache} (${elenco.length} tentati).`);
  return null;
}

async function sfoltisci(tetto = TETTO_BYTE) {
  try {
    const dir = cartella();
    const nomi = await fsp.readdir(dir);
    const voci: any[] = [];
    let totale = 0;

    for (const nome of nomi) {
      if (nome.endsWith('.mime')) continue;
      try {
        const st = await fsp.stat(path.join(dir, nome));
        if (!st.isFile()) continue;
        if (nome.endsWith('.part')) { await fsp.unlink(path.join(dir, nome)).catch(() => {}); continue; }
        voci.push({ nome, dimensione: st.size, usato: st.atimeMs || st.mtimeMs });
        totale += st.size;
      } catch {}
    }

    if (totale <= tetto) return { rimossi: 0, totale };

    voci.sort((a, b) => a.usato - b.usato);
    let rimossi = 0;
    for (const v of voci) {
      if (totale <= tetto * 0.8) break;
      await fsp.unlink(path.join(dir, v.nome)).catch(() => {});
      await fsp.unlink(path.join(dir, v.nome + '.mime')).catch(() => {});
      totale -= v.dimensione;
      rimossi++;
    }
    console.log(`[IIIF] Cache sfoltita: ${rimossi} file rimossi, ${Math.round(totale / 1048576)} MB residui.`);
    return { rimossi, totale };
  } catch (errore) {
    console.warn('[IIIF] Sfoltimento cache fallito:', (errore as any) && (errore as any).message);
    return { rimossi: 0, totale: 0 };
  }
}

export { TETTO_BYTE, MAX_IMMAGINE, cartella, chiave, urlAmmesso, decodificaRiferimento, leggiDallaCache, immagine, sfoltisci };
