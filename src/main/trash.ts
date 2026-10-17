import * as path from 'path';
import * as fs from 'fs';
const fsp = require('fs').promises;
import { state, getAllSettings } from './workspaceManager';
const Model = require('../shared/model');
import { scriviAtomico } from './scritturaAtomica';

const MAX_VOCI = 2000;

function percorsoCestino(): string | null {
  if (!state.workspacePath) return null;
  return path.join(state.workspacePath, '.archiview', 'cestino.json');
}

function giorniConservazione(): number {
  const s = getAllSettings() || {};
  const v = s.cestinoGiorni;
  return typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : Model.CESTINO_GIORNI;
}

async function leggiGrezzo(): Promise<any[]> {
  const file = percorsoCestino();
  if (!file || !fs.existsSync(file)) return [];
  try {
    const dati = JSON.parse(await fsp.readFile(file, 'utf8'));
    if (Array.isArray(dati)) return dati;
    throw new Error('non è un elenco');
  } catch (e: any) {
    console.error('[Cestino] File illeggibile, conservato a parte:', e && e.message);
    const data = new Date().toISOString().replace(/[:.]/g, '-');
    try { await fsp.rename(file, path.join(path.dirname(file), `cestino.corrotto-${data}.json`)); }
    catch (err: any) { if (!err || err.code !== 'ENOENT') throw err; }
    return [];
  }
}

async function scrivi(voci: any[]): Promise<void> {
  const file = percorsoCestino();
  if (!file) throw new Error('Workspace non impostato');
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await scriviAtomico(file, JSON.stringify(voci));
}

let coda: Promise<unknown> = Promise.resolve();
function inCoda<T>(fn: () => Promise<T>): Promise<T> {
  const p = coda.then(fn, fn);
  coda = p.catch(() => {});
  return p;
}

async function elencaCestino(): Promise<any[]> {
  const voci = Model.cestinoValido(await leggiGrezzo(), { giorni: giorniConservazione() });
  return voci.slice(0, MAX_VOCI);
}

async function potaCestino(): Promise<number> {
  const grezzo = await leggiGrezzo();
  const validi = Model.cestinoValido(grezzo, { giorni: giorniConservazione() }).slice(0, MAX_VOCI);
  if (validi.length !== grezzo.length) await scrivi(validi);
  return grezzo.length - validi.length;
}

async function aggiungiAlCestino(records: any[], da?: string): Promise<number> {
  const lista = Array.isArray(records) ? records.filter(r => r && r.id) : [];
  if (lista.length === 0) return 0;
  if (giorniConservazione() === 0) return 0;

  const ora = Date.now();
  const nuove = lista.map(r => ({
    deletedAt: ora,
    record: r,
    cartella: typeof r.cartella === 'string' ? r.cartella : '',
    da: da || ''
  }));

  const esistenti = Model.cestinoValido(await leggiGrezzo(), { giorni: giorniConservazione() });
  const idNuovi = new Set(nuove.map(v => String(v.record.id)));
  const fuse = nuove.concat(esistenti.filter(v => !idNuovi.has(String(v.record && v.record.id))));
  await scrivi(fuse.slice(0, MAX_VOCI));
  return nuove.length;
}

async function prendiDalCestino(ids: string[]): Promise<any[]> {
  const cercati = new Set((ids || []).map(String));
  const voci = Model.cestinoValido(await leggiGrezzo(), { giorni: giorniConservazione() });
  const presi = voci.filter(v => cercati.has(String(v.record.id)));
  if (presi.length) await scrivi(voci.filter(v => !cercati.has(String(v.record.id))));
  return presi.map(v => v.record);
}

async function eliminaDalCestino(ids: string[]): Promise<number> {
  const cercati = new Set((ids || []).map(String));
  const voci = Model.cestinoValido(await leggiGrezzo(), { giorni: giorniConservazione() });
  const restanti = voci.filter(v => !cercati.has(String(v.record.id)));
  await scrivi(restanti);
  return voci.length - restanti.length;
}

async function svuotaCestino(): Promise<number> {
  const voci = await leggiGrezzo();
  await scrivi([]);
  return voci.length;
}

module.exports = {
  MAX_VOCI,
  percorsoCestino,
  elencaCestino,
  potaCestino: () => inCoda(potaCestino),
  aggiungiAlCestino: (records: any[], da?: string) => inCoda(() => aggiungiAlCestino(records, da)),
  prendiDalCestino: (ids: string[]) => inCoda(() => prendiDalCestino(ids)),
  eliminaDalCestino: (ids: string[]) => inCoda(() => eliminaDalCestino(ids)),
  svuotaCestino: () => inCoda(svuotaCestino)
};
export {};
