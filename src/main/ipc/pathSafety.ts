const path = require('path');

// Sanitizza un nome di allegato proveniente da fonti NON fidate (DB di vault condivisi/Hub,
// listing OneDrive/Drive di altri collaboratori). Impedisce path traversal e path assoluti:
// il file può essere scritto/letto SOLO dentro `dir`.
// Ritorna il path assoluto sicuro, oppure lancia se il nome è malevolo/vuoto.
function safeAttachmentPath(dir: string, rawName: string): string {
  if (typeof rawName !== 'string' || !rawName) throw new Error('Nome allegato non valido');
  const base = path.basename(rawName);                 // rimuove ../ e componenti di percorso
  if (!base || base === '.' || base === '..') throw new Error('Nome allegato non valido');
  const resolved = path.resolve(dir, base);
  const rel = path.relative(dir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Path traversal bloccato');
  return resolved;
}

// Variante non-throwing: ritorna null invece di lanciare (utile nei loop di sync
// dove un singolo nome malevolo non deve abortire l'intera sincronizzazione).
function safeAttachmentPathOrNull(dir: string, rawName: string): string | null {
  try { return safeAttachmentPath(dir, rawName); } catch { return null; }
}

// Nomi che Windows riserva ai dispositivi, anche con un'estensione ("CON.txt").
const NOMI_RISERVATI_WIN = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
// Caratteri vietati nei nomi di file su Windows, più i controlli.
const CARATTERI_VIETATI = /[<>:"/\\|?*\u0000-\u001f]/;

/**
 * Cartella `nome` DIRETTAMENTE dentro `base`, per un nuovo workspace. `nome` può arrivare da
 * fuori (nome della cartella Drive scelta nel Picker, invito): deve essere un solo segmento,
 * senza separatori né `..`, e il risultato deve restare figlio di `base`. Lancia altrimenti.
 */
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

/**
 * Rende un nome qualsiasi (es. "Fondo: Carte / 1500_ArchiView" da Drive) un nome di cartella
 * valido su Windows, invece di rifiutarlo: un nome remoto legittimo non deve bloccare un join.
 * Il risultato passa comunque da safeChildDir.
 */
function nomeCartellaSicuro(nome: unknown, riserva = 'Vault_Condiviso'): string {
  let s = typeof nome === 'string' ? nome : '';
  s = s.replace(new RegExp(CARATTERI_VIETATI.source, 'g'), '_').replace(/_+/g, '_').trim().replace(/[. ]+$/, '');
  if (!s || /^\.+$/.test(s)) return riserva;
  if (NOMI_RISERVATI_WIN.test(s)) s = '_' + s;
  return s.slice(0, 200);
}

module.exports = { safeAttachmentPath, safeAttachmentPathOrNull, safeChildDir, nomeCartellaSicuro };
export {};
