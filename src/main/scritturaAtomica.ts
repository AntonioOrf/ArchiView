// Scrittura atomica di file JSON del main (N5 in PIANO-SICUREZZA-OTTIMIZZAZIONE.md):
// database, base del merge, settings.json.
//
// Prima ogni salvataggio del DB apriva lo STESSO `<file>.tmp` con flag 'w': due salvataggi
// sovrapposti troncavano o mescolavano il temporaneo, e il rename poteva pubblicare un file
// misto o fallire (ENOENT) perdendo il salvataggio. Qui:
// - un temporaneo univoco per scrittura (pid + contatore);
// - le scritture dello stesso percorso sono in coda (mutex per percorso): vince sempre
//   l'ultima chiamata, nell'ordine in cui è arrivata;
// - in caso di errore il temporaneo si cancella e il file esistente resta intatto.
//
// Test: test/scritturaAtomica.test.js.

const fs = require('fs');
const fsp = require('fs').promises;

let contatore = 0;
const code: Map<string, Promise<void>> = new Map();

function percorsoTemporaneo(percorso: string): string {
  contatore = (contatore + 1) % Number.MAX_SAFE_INTEGER;
  return `${percorso}.${process.pid}.${contatore}.tmp`;
}

// Su Windows il rename sopra un file aperto da un altro processo (antivirus, client Drive,
// indicizzatore) fallisce per un attimo con EPERM/EBUSY/EACCES: si riprova qualche volta.
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

/** Scrive `contenuto` in `percorso` in modo atomico, in coda alle altre scritture dello stesso file. */
function scriviAtomico(percorso: string, contenuto: string | Buffer): Promise<void> {
  const precedente = code.get(percorso) || Promise.resolve();
  const questa = precedente.then(() => scriviOra(percorso, contenuto));
  const coda = questa.catch(() => {});
  code.set(percorso, coda);
  // La coda si libera quando non c'è altro dietro: niente Map che cresce a ogni archivio aperto.
  coda.then(() => { if (code.get(percorso) === coda) code.delete(percorso); });
  return questa;
}

/**
 * Variante sincrona per i percorsi di codice già sincroni (settings.json). Non serve il mutex:
 * due chiamate sincrone non possono sovrapporsi. Non usarla su un file scritto anche da
 * `scriviAtomico`.
 */
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
    fs.renameSync(tmp, percorso);
  } catch (errore) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw errore;
  }
}

module.exports = { scriviAtomico, scriviAtomicoSync };
export {};
