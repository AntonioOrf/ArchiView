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

async function leggiLotto(c: CartelleScanner, id: unknown): Promise<any> {
  const testo = await fsp.readFile(path.join(cartellaLotto(c, id), ScannerLotto.NOME_MANIFEST), 'utf8');
  const esito = ScannerLotto.valida(JSON.parse(testo));
  if (!esito.ok) throw new Error('manifest_non_valido');
  if (esito.lotto.id !== id) throw new Error('id_diverso');
  return esito.lotto;
}

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

function percorsoPagina(c: CartelleScanner, id: unknown, file: unknown): string {
  if (!ScannerLotto.nomeFileValido(file)) throw new Error('file_non_valido');
  return path.join(cartellaLotto(c, id), file as string);
}

function prefissoScheda(schedaId: unknown): string {
  const pulito = typeof schedaId === 'string' || typeof schedaId === 'number'
    ? String(schedaId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64)
    : '';
  if (!pulito) throw new Error('scheda_non_valida');
  return pulito;
}

type VoceAllegato = { nome: string; tipo: 'immagine' | 'pdf'; originalName: string; hash: string };

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
    await Promise.all(copiati.map(p => fsp.rm(p, { force: true }).catch(() => {})));
    throw e;
  }
}

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

async function togliDaArrivo(c: CartelleScanner, id: unknown): Promise<void> {
  const dir = cartellaLotto(c, id);
  await fsp.mkdir(c.assegnati, { recursive: true });
  await fsp.writeFile(path.join(c.assegnati, id as string), '');
  await fsp.rm(dir, { recursive: true, force: true });
}

export { elencaArrivo, percorsoPagina, copiaInAllegati, unisciInPdf, togliDaArrivo };
