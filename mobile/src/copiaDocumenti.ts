// F5 — copia dei Documenti su Drive e ripristino su un telefono nuovo (chiamate in drive.ts).
// Si copiano solo i documenti cambiati dall'ultima copia: `documento.json` si riscrive a ogni
// cambio (pagine, filtri, OCR, nome), quindi basta la sua ora di modifica. Lo stato sta in
// `documenti/copia.json`; i documenti eliminati in `documenti/eliminati.json` (documenti.ts).

import { Directory, File } from 'expo-file-system';
import { cartellaDoc, eliminati, eliminatiCopiati, elencaDocumenti, leggiCartelle, radiceDocumenti, salvaCartelle } from './documenti';
import { daCopiare, daRipristinare, fileValido } from './elencoDocumenti';
import { eliminaCopia, elencaCopie, scaricaIn, specchia, type FileDaCopiare } from './drive';
import { leggiJson, scriviJson } from './fileJson';

type StatoCopia = { ultima?: string; copiati: Record<string, number> };

const fileStato = () => new File(radiceDocumenti(), 'copia.json');

export function statoCopia(): StatoCopia {
  try {
    const s = leggiJson(fileStato()) as StatoCopia | undefined;
    return s && typeof s.copiati === 'object' && s.copiati ? s : { copiati: {} };
  } catch (e) {
    console.warn('[copia] stato illeggibile, ricopio tutto', e);
    return { copiati: {} };
  }
}

function daCaricare(f: File): FileDaCopiare {
  const i = f.info({ md5: true });
  if (!i.exists || !i.md5 || !i.size) throw new Error(`file_illeggibile: ${f.name}`);
  return { nome: f.name, file: f, md5: i.md5, byte: i.size };
}

/** I file di un documento, `documento.json` per ultimo. */
function fileDi(d: Directory): FileDaCopiare[] {
  const foto = d.list().filter((v): v is File => v instanceof File && fileValido(v.name)).sort((a, b) => a.name.localeCompare(b.name));
  return [...foto.map(daCaricare), daCaricare(new File(d, 'documento.json'))];
}

/**
 * Un giro di copia: toglie da Drive i documenti eliminati, copia le cartelle e i documenti
 * cambiati. Lo stato si salva a ogni documento: un giro interrotto riprende da lì.
 * Restituisce quanti documenti ha copiato.
 */
export async function copiaDocumenti(): Promise<number> {
  const stato = statoCopia();
  const copiati = { ...stato.copiati };
  const salva = (ultima?: string) => scriviJson(fileStato(), { ...(ultima ? { ultima } : stato.ultima ? { ultima: stato.ultima } : {}), copiati });

  const tolti = eliminati();
  for (const id of tolti) { await eliminaCopia(id); delete copiati[id]; }
  if (tolti.length) { eliminatiCopiati(tolti); salva(); }

  const cartelle = new File(radiceDocumenti(), 'cartelle.json');
  await specchia('', cartelle.exists ? [daCaricare(cartelle)] : []);

  const ore = elencaDocumenti().map(d => ({ id: d.id, ora: new File(cartellaDoc(d.id), 'documento.json').info().modificationTime ?? 0 }));
  let n = 0;
  for (const { id, ora } of daCopiare(ore, copiati)) {
    await specchia(id, fileDi(cartellaDoc(id)));
    copiati[id] = ora;
    salva();
    n++;
  }
  salva(new Date().toISOString());
  return n;
}

/**
 * Riporta sul telefono i documenti copiati su Drive che qui non ci sono (telefono nuovo, app
 * reinstallata). Niente si sovrascrive: un documento già presente resta com'è. Le cartelle si
 * uniscono a quelle che ci sono. Restituisce quanti documenti ha ripristinato.
 */
export async function ripristinaDocumenti(): Promise<number> {
  const copie = await elencaCopie();
  const radice = copie.find(c => c.nome === '');
  const remote = radice?.file.find(f => f.nome === 'cartelle.json');
  if (remote) {
    const tmp = new File(radiceDocumenti(), 'cartelle.drive.json');
    try {
      await scaricaIn(remote.id, tmp);
      const v = JSON.parse(tmp.textSync());
      if (Array.isArray(v)) salvaCartelle([...leggiCartelle(), ...v.filter((x): x is string => typeof x === 'string' && !!x.trim())]);
    } finally {
      if (tmp.exists) tmp.delete();
    }
  }

  const qui = elencaDocumenti().map(d => d.id);
  let n = 0;
  for (const c of daRipristinare(copie, qui)) {
    const d = cartellaDoc(c.nome);
    d.create({ intermediates: true, idempotent: true });
    for (const f of c.file) await scaricaIn(f.id, new File(d, f.nome));
    n++;
  }
  // Al prossimo giro i ripristinati risultano «cambiati», ma `specchia` confronta gli md5: nessun ricaricamento.
  return n;
}
