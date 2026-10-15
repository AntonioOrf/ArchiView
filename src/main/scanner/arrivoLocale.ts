// ArchiScanner — i lotti già ricevuti, in `<workspace>/.archiview/scanner/arrivo/<id>/`
// (Fase 2 di PIANO-SCANNER.md): elenco per il pannello, copia delle pagine fra gli allegati,
// unione in un PDF, uscita dall'area d'arrivo.
//
// Solo file system: la scheda la scrive il renderer (è lui che possiede il database). Per
// questo l'assegnazione è in due passi: `copiaInAllegati` restituisce le voci `allegati`, il
// renderer le salva, e SOLO DOPO chiama `togliDaArrivo`. Se il salvataggio fallisce il lotto
// resta in arrivo e i file copiati sono orfani (li ripulisce la pulizia degli allegati).
//
// Nessun percorso arriva dal renderer: solo un id di lotto e nomi di pagina, controllati con
// il validatore del contratto, e un id di scheda ripulito come fa `salva-allegato`.

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { hashFile } from '../chunkingLogic';
const ScannerLotto = require('../../shared/scannerLotto');

export type CartelleScanner = { arrivo: string; assegnati: string };

function cartellaLotto(c: CartelleScanner, id: unknown): string {
  if (!ScannerLotto.idValido(id)) throw new Error('id_non_valido');
  return path.join(c.arrivo, id as string);
}

/** Manifest di un lotto in arrivo, rivalidato: su disco potrebbe averlo toccato chiunque. */
async function leggiLotto(c: CartelleScanner, id: unknown): Promise<any> {
  const testo = await fsp.readFile(path.join(cartellaLotto(c, id), ScannerLotto.NOME_MANIFEST), 'utf8');
  const esito = ScannerLotto.valida(JSON.parse(testo));
  if (!esito.ok) throw new Error('manifest_non_valido');
  if (esito.lotto.id !== id) throw new Error('id_diverso');
  return esito.lotto;
}

/** I lotti in arrivo, dal più vecchio. Uno illeggibile si salta (e si segnala), non blocca gli altri. */
async function elencaArrivo(c: CartelleScanner): Promise<any[]> {
  let nomi: string[];
  try {
    nomi = await fsp.readdir(c.arrivo);
  } catch (e: any) {
    if (e && e.code === 'ENOENT') return [];
    throw e;
  }
  const out: any[] = [];
  for (const id of nomi.filter((n: string) => ScannerLotto.idValido(n)).sort()) {
    try {
      out.push(await leggiLotto(c, id));
    } catch (e: any) {
      console.warn('[scanner] lotto in arrivo illeggibile:', id, e && e.message);
    }
  }
  return out;
}

/** Percorso di una pagina del lotto, per la miniatura. */
function percorsoPagina(c: CartelleScanner, id: unknown, file: unknown): string {
  if (!ScannerLotto.nomeFileValido(file)) throw new Error('file_non_valido');
  return path.join(cartellaLotto(c, id), file as string);
}

/** Stessa pulizia dell'id di `salva-allegato`: l'id arriva dal vault, anche condiviso. */
function prefissoScheda(schedaId: unknown): string {
  const pulito = typeof schedaId === 'string' || typeof schedaId === 'number'
    ? String(schedaId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64)
    : '';
  if (!pulito) throw new Error('scheda_non_valida');
  return pulito;
}

type VoceAllegato = { nome: string; tipo: 'immagine' | 'pdf'; originalName: string; hash: string };

/**
 * Copia le pagine fra gli allegati come `<scheda>_<lotto>_p0001.jpg`. Mai sovrascrivere: un
 * nome già preso è un errore (il lotto è già stato assegnato a quella scheda).
 * L'hash è quello del manifest, verificato all'arrivo e rivalidato sopra.
 */
async function copiaInAllegati(c: CartelleScanner, id: unknown, schedaId: unknown, cartellaAllegati: string): Promise<VoceAllegato[]> {
  const lotto = await leggiLotto(c, id);
  const prefisso = prefissoScheda(schedaId) + '_' + lotto.id + '_';
  const copiati: string[] = [];
  try {
    const voci: VoceAllegato[] = [];
    for (const pg of lotto.pagine) {
      const nome = prefisso + pg.file;
      const dest = path.join(cartellaAllegati, nome);
      await fsp.copyFile(path.join(cartellaLotto(c, id), pg.file), dest, fs.constants.COPYFILE_EXCL);
      copiati.push(dest);
      voci.push({ nome, tipo: 'immagine', originalName: pg.etichetta || pg.file, hash: pg.sha256 });
    }
    return voci;
  } catch (e) {
    // Tutto o niente: mezza copia lascerebbe file orfani e un'assegnazione da ripetere a mano.
    await Promise.all(copiati.map(p => fsp.rm(p, { force: true }).catch(() => {})));
    throw e;
  }
}

/**
 * Un solo PDF con tutte le pagine, nell'ordine del lotto. pdf-lib incorpora JPEG e PNG così
 * come sono (nessuna ricompressione); la pagina prende le misure dell'immagine.
 */
async function unisciInPdf(c: CartelleScanner, id: unknown, schedaId: unknown, cartellaAllegati: string): Promise<VoceAllegato> {
  const lotto = await leggiLotto(c, id);
  const { PDFDocument } = require('pdf-lib');
  // ponytail: il PDF si compone in memoria (pdf-lib non scrive a flusso): ~ somma delle pagine,
  // ok per lotti da qualche centinaio di MB; oltre, servirebbe un writer PDF incrementale.
  const doc = await PDFDocument.create();
  for (const pg of lotto.pagine) {
    const byte = await fsp.readFile(path.join(cartellaLotto(c, id), pg.file));
    const img = pg.file.endsWith('.png') ? await doc.embedPng(byte) : await doc.embedJpg(byte);
    const pagina = doc.addPage([img.width, img.height]);
    pagina.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  if (lotto.titolo) doc.setTitle(lotto.titolo);
  const nome = prefissoScheda(schedaId) + '_' + lotto.id + '.pdf';
  const dest = path.join(cartellaAllegati, nome);
  await fsp.writeFile(dest, await doc.save(), { flag: 'wx' });
  try {
    return { nome, tipo: 'pdf', originalName: lotto.titolo || lotto.id, hash: await hashFile(dest) };
  } catch (e) {
    await fsp.rm(dest, { force: true }).catch(() => {});
    throw e;
  }
}

/**
 * Il lotto esce dall'area d'arrivo (assegnato o scartato). Prima il segno nel registro, poi la
 * cancellazione: se questa fallisce, al giro dopo il lotto non torna da Drive.
 */
async function togliDaArrivo(c: CartelleScanner, id: unknown): Promise<void> {
  const dir = cartellaLotto(c, id);
  await fsp.mkdir(c.assegnati, { recursive: true });
  await fsp.writeFile(path.join(c.assegnati, id as string), '');
  await fsp.rm(dir, { recursive: true, force: true });
}

export { elencaArrivo, percorsoPagina, copiaInAllegati, unisciInPdf, togliDaArrivo };
