// Unico proprietario di settings.json su disco: cache, scrittura atomica con copia `.bak`,
// lettura che sopravvive a un file corrotto. Cosa si può scrivere lo decide
// impostazioniRenderer.ts; come si fonde lo decide workspaceManager (vault, allegati).
//
// Sincrono di proposito: getAllSettings è usato da decine di percorsi sincroni del main e il
// file è di pochi KB. La cache evita le letture da disco dopo la prima.
//
// Puro (niente electron): testato in Node da test/settingsStore.test.js.

import * as fs from 'fs';
import { scriviAtomicoSync } from './scritturaAtomica';

let percorso = '';
let cache: any = null;

/** Imposta il file (userData/settings.json) e svuota la cache. */
function configuraStore(p: string) {
  percorso = p;
  cache = null;
}

function leggiJson(p: string): any {
  const v = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('non è un oggetto');
  return v;
}

/** Copia delle impostazioni. File corrotto → `.bak` → `{}`. */
function leggiStore(): any {
  if (cache === null) {
    if (!fs.existsSync(percorso)) {
      cache = {};
    } else {
      try {
        cache = leggiJson(percorso);
      } catch (errore) {
        console.error('settings.json illeggibile, provo la copia .bak:', errore.message);
        try {
          cache = leggiJson(percorso + '.bak');
        } catch (erroreBak) {
          // Non in cache: un errore transitorio (file bloccato dall'antivirus) memorizzato come
          // {} farebbe riscrivere al salvataggio successivo il file senza le altre chiavi.
          console.error('Anche settings.json.bak illeggibile, impostazioni predefinite:', erroreBak.message);
          return {};
        }
      }
    }
  }
  return structuredClone(cache);
}

/** Scrive in modo atomico; la versione precedente resta in `.bak`. */
function scriviStore(impostazioni: any) {
  try {
    if (fs.existsSync(percorso)) fs.copyFileSync(percorso, percorso + '.bak');
  } catch (errore) {
    // Senza .bak si perde solo la rete di sicurezza, non il salvataggio.
    console.warn('Copia settings.json.bak non riuscita:', errore.message);
  }
  scriviAtomicoSync(percorso, JSON.stringify(impostazioni, null, 2));
  cache = structuredClone(impostazioni);
}

/**
 * Una tantum: `lowPerf` stava in perf-config.json. Lo porta in settings.json (se non c'è già)
 * e cancella il vecchio file solo a scrittura riuscita. Idempotente.
 */
function migraPerfConfig(percorsoPerf: string) {
  if (!fs.existsSync(percorsoPerf)) return;
  try {
    const s = leggiStore();
    if (cache === null) return; // settings.json illeggibile: riscriverlo ora perderebbe le altre chiavi
    if (!Object.prototype.hasOwnProperty.call(s, 'lowPerf')) {
      let lowPerf = false;
      try { lowPerf = !!leggiJson(percorsoPerf).lowPerf; } catch (_) { /* illeggibile: predefinito */ }
      s.lowPerf = lowPerf;
      scriviStore(s);
    }
    fs.unlinkSync(percorsoPerf);
  } catch (errore) {
    console.error('Migrazione di perf-config.json non riuscita, riprovo al prossimo avvio:', errore.message);
  }
}

export { configuraStore, leggiStore, scriviStore, migraPerfConfig };
