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

module.exports = { safeAttachmentPath, safeAttachmentPathOrNull };
export {};
