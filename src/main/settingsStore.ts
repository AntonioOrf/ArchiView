import * as fs from 'fs';
import { scriviAtomicoSync } from './scritturaAtomica';

let percorso = '';
let cache: any = null;

function configuraStore(p: string) {
  percorso = p;
  cache = null;
}

function leggiJson(p: string): any {
  const v = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('non è un oggetto');
  return v;
}

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
          console.error('Anche settings.json.bak illeggibile, impostazioni predefinite:', erroreBak.message);
          return {};
        }
      }
    }
  }
  return structuredClone(cache);
}

function scriviStore(impostazioni: any) {
  try {
    if (fs.existsSync(percorso)) fs.copyFileSync(percorso, percorso + '.bak');
  } catch (errore) {
    console.warn('Copia settings.json.bak non riuscita:', errore.message);
  }
  scriviAtomicoSync(percorso, JSON.stringify(impostazioni, null, 2));
  cache = structuredClone(impostazioni);
}

function migraPerfConfig(percorsoPerf: string) {
  if (!fs.existsSync(percorsoPerf)) return;
  try {
    const s = leggiStore();
    if (cache === null) return;
    if (!Object.prototype.hasOwnProperty.call(s, 'lowPerf')) {
      let lowPerf = false;
      try { lowPerf = !!leggiJson(percorsoPerf).lowPerf; } catch (_) {}
      s.lowPerf = lowPerf;
      scriviStore(s);
    }
    fs.unlinkSync(percorsoPerf);
  } catch (errore) {
    console.error('Migrazione di perf-config.json non riuscita, riprovo al prossimo avvio:', errore.message);
  }
}

export { configuraStore, leggiStore, scriviStore, migraPerfConfig };
