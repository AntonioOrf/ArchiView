import * as path from 'path';
import * as fs from 'fs';

function safeAttachmentPath(dir: string, rawName: string): string {
  if (typeof rawName !== 'string' || !rawName) throw new Error('Nome allegato non valido');
  const base = path.basename(rawName);
  if (!base || base === '.' || base === '..' || /[. ]$/.test(base) || base.length > 255
      || CARATTERI_VIETATI.test(base) || NOMI_RISERVATI_WIN.test(base)) {
    throw new Error('Nome allegato non valido');
  }
  const resolved = path.resolve(dir, base);
  const rel = path.relative(dir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Path traversal bloccato');
  return resolved;
}

function safeAttachmentPathOrNull(dir: string, rawName: string): string | null {
  try { return safeAttachmentPath(dir, rawName); } catch { return null; }
}

const NOMI_RISERVATI_WIN = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const CARATTERI_VIETATI = /[<>:"/\\|?*\u0000-\u001f]/;

function safeChildDir(base: string, nome: string): string {
  if (typeof base !== 'string' || !base) throw new Error('Cartella di destinazione non valida');
  if (typeof nome !== 'string') throw new Error('Nome cartella non valido');
  const pulito = nome.trim();
  if (!pulito || pulito === '.' || pulito === '..' || /[. ]$/.test(pulito)
      || CARATTERI_VIETATI.test(pulito) || NOMI_RISERVATI_WIN.test(pulito) || pulito.length > 200) {
    throw new Error(`Nome cartella non valido: "${nome}"`);
  }
  const radice = path.resolve(base);
  const risultato = path.resolve(radice, pulito);
  if (path.dirname(risultato) !== radice) throw new Error('Path traversal bloccato');
  return risultato;
}

function nomeCartellaSicuro(nome: unknown, riserva = 'Vault_Condiviso'): string {
  let s = typeof nome === 'string' ? nome : '';
  s = s.replace(new RegExp(CARATTERI_VIETATI.source, 'g'), '_').replace(/_+/g, '_').trim().replace(/[. ]+$/, '');
  if (!s || /^\.+$/.test(s)) return riserva;
  if (NOMI_RISERVATI_WIN.test(s)) s = '_' + s;
  return s.slice(0, 200);
}

function dentroCartellaReale(fileReale: string, dir: string): boolean {
  if (typeof fileReale !== 'string' || typeof dir !== 'string' || !dir) return false;
  let base: string;
  try { base = fs.realpathSync.native(dir); } catch { base = path.resolve(dir); }
  const rel = path.relative(base, fileReale);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export { safeAttachmentPath, safeAttachmentPathOrNull, safeChildDir, nomeCartellaSicuro, dentroCartellaReale };
