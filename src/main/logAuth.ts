// Log degli eventi OAuth di Google Drive (S2, P5). Sta in userData/logs/auth.log, mai nella
// cartella dell'archivio (che può essere sincronizzata), senza email, scritto in modo asincrono
// e in coda (le righe restano in ordine), con rotazione come updater.log.
// Nessuna dipendenza da electron: il percorso lo passa auth.ts. Test: test/logAuth.test.js.
import * as fs from 'fs';
import * as path from 'path';

const LOG_AUTH_MAX_BYTES = 1024 * 1024;
const RE_EMAIL = /[^\s@<>'"()]+@[^\s@<>'"()]+\.[A-Za-z]{2,}/g;

let coda: Promise<void> = Promise.resolve();

function scriviLogAuth(file: string, messaggio: string): Promise<void> {
  const riga = `[${new Date().toISOString()}] ${String(messaggio).replace(RE_EMAIL, '<email>')}\n`;
  coda = coda.then(async () => {
    try {
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      try {
        if ((await fs.promises.stat(file)).size > LOG_AUTH_MAX_BYTES) await fs.promises.rename(file, file + '.old');
      } catch { /* file non ancora esistente: ok */ }
      await fs.promises.appendFile(file, riga);
    } catch (e) { console.error('Errore scrittura log auth:', e); }
  });
  return coda;
}

/** Toglie i vecchi `auth_debug.log` (nell'archivio e in userData): contenevano email e percorsi. */
async function rimuoviLogVecchi(workspacePath: string | null, userData: string): Promise<void> {
  const vecchi = [path.join(userData, 'auth_debug.log')];
  if (workspacePath) vecchi.push(path.join(workspacePath, '.archiview-chunks', 'auth_debug.log'));
  for (const f of vecchi) {
    try { await fs.promises.rm(f, { force: true }); } catch (e) { console.error('Rimozione vecchio log auth:', e); }
  }
}

export { scriviLogAuth, rimuoviLogVecchi, LOG_AUTH_MAX_BYTES };
