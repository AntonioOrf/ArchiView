import * as fs from 'fs';
const fsp = require('fs').promises;

let contatore = 0;
const code: Map<string, Promise<void>> = new Map();

function percorsoTemporaneo(percorso: string): string {
  contatore = (contatore + 1) % Number.MAX_SAFE_INTEGER;
  return `${percorso}.${process.pid}.${contatore}.tmp`;
}

const ERRORI_TRANSITORI = new Set(['EPERM', 'EBUSY', 'EACCES']);
const TENTATIVI_RENAME = 5;

async function rinomina(da: string, a: string): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await fsp.rename(da, a);
      return;
    } catch (errore) {
      if (i >= TENTATIVI_RENAME || !ERRORI_TRANSITORI.has(errore && errore.code)) throw errore;
      await new Promise(r => setTimeout(r, 30 * i));
    }
  }
}

async function scriviOra(percorso: string, contenuto: string | Buffer): Promise<void> {
  const tmp = percorsoTemporaneo(percorso);
  try {
    const fh = await fsp.open(tmp, 'wx');
    try {
      await fh.writeFile(contenuto, typeof contenuto === 'string' ? 'utf8' : undefined);
      await fh.sync();
    } finally {
      await fh.close();
    }
    await rinomina(tmp, percorso);
  } catch (errore) {
    await fsp.unlink(tmp).catch(() => {});
    throw errore;
  }
}

function scriviAtomico(percorso: string, contenuto: string | Buffer): Promise<void> {
  const precedente = code.get(percorso) || Promise.resolve();
  const questa = precedente.then(() => scriviOra(percorso, contenuto));
  const coda = questa.catch(() => {});
  code.set(percorso, coda);
  coda.then(() => { if (code.get(percorso) === coda) code.delete(percorso); });
  return questa;
}

function scriviAtomicoSync(percorso: string, contenuto: string | Buffer): void {
  const tmp = percorsoTemporaneo(percorso);
  try {
    const fd = fs.openSync(tmp, 'wx');
    try {
      fs.writeFileSync(fd, contenuto, typeof contenuto === 'string' ? 'utf8' : undefined);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    for (let i = 1; ; i++) {
      try {
        fs.renameSync(tmp, percorso);
        break;
      } catch (errore) {
        if (i >= TENTATIVI_RENAME || !ERRORI_TRANSITORI.has(errore && errore.code)) throw errore;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30 * i);
      }
    }
  } catch (errore) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw errore;
  }
}

export { scriviAtomico, scriviAtomicoSync };
