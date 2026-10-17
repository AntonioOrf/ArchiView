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
      } catch {}
      await fs.promises.appendFile(file, riga);
    } catch (e) { console.error('Errore scrittura log auth:', e); }
  });
  return coda;
}

async function rimuoviLogVecchi(workspacePath: string | null, userData: string): Promise<void> {
  const vecchi = [path.join(userData, 'auth_debug.log')];
  if (workspacePath) vecchi.push(path.join(workspacePath, '.archiview-chunks', 'auth_debug.log'));
  for (const f of vecchi) {
    try { await fs.promises.rm(f, { force: true }); } catch (e) { console.error('Rimozione vecchio log auth:', e); }
  }
}

export { scriviLogAuth, rimuoviLogVecchi, LOG_AUTH_MAX_BYTES };
