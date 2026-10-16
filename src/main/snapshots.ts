import * as path from 'path';
import * as fs from 'fs';
const fsp = require('fs').promises;
import * as zlib from 'zlib';
import { promisify } from 'util';
import { state, getAllSettings } from './workspaceManager';
const Model = require('../shared/model');

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

const INTERVALLO_AUTO_MS = 30 * 60 * 1000;

const MOTIVI = ['auto', 'manuale', 'prima-ripristino', 'prima-import'];
const RE_NOME = /^(\d{8})-(\d{6})(?:-([a-z-]+))?\.json\.gz$/;

let ultimoAuto = 0;

function cartellaSnapshot(): string | null {
  if (!state.workspacePath) return null;
  return path.join(state.workspacePath, '.archiview', 'snapshots');
}

function assicuraCartella(): string | null {
  const dir = cartellaSnapshot();
  if (!dir) return null;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function due(n: number): string { return (n < 10 ? '0' : '') + n; }

function nomeSnapshot(ts: number, motivo: string): string {
  const d = new Date(ts);
  const giorno = '' + d.getFullYear() + due(d.getMonth() + 1) + due(d.getDate());
  const ora = '' + due(d.getHours()) + due(d.getMinutes()) + due(d.getSeconds());
  const m = MOTIVI.indexOf(motivo) !== -1 ? motivo : 'auto';
  return `${giorno}-${ora}-${m}.json.gz`;
}

function metaDaNome(nome: string): { nome: string; creatoIl: number; motivo: string } | null {
  const m = RE_NOME.exec(nome || '');
  if (!m) return null;
  const [, giorno, ora, motivo] = m;
  const ts = new Date(
    Number(giorno.slice(0, 4)), Number(giorno.slice(4, 6)) - 1, Number(giorno.slice(6, 8)),
    Number(ora.slice(0, 2)), Number(ora.slice(2, 4)), Number(ora.slice(4, 6))
  ).getTime();
  if (!isFinite(ts)) return null;
  return { nome, creatoIl: ts, motivo: motivo || 'auto' };
}

function percorsoSicuro(nome: string): string {
  const dir = cartellaSnapshot();
  if (!dir) throw new Error('Workspace non impostato');
  if (!metaDaNome(path.basename(nome || ''))) throw new Error('Nome snapshot non valido');
  const { safeAttachmentPath } = require('./ipc/pathSafety');
  return safeAttachmentPath(dir, nome);
}

function opzioniRotazione(): { recenti: number; giorni: number; attivi: boolean } {
  const s = getAllSettings() || {};
  const num = (v: any, dflt: number) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : dflt);
  return {
    attivi: s.snapshotAutomatici !== false,
    recenti: num(s.snapshotRecenti, Model.SNAPSHOT_RECENTI),
    giorni: num(s.snapshotGiorni, Model.SNAPSHOT_GIORNI)
  };
}

async function elencaSnapshot(): Promise<any[]> {
  const dir = cartellaSnapshot();
  if (!dir || !fs.existsSync(dir)) return [];
  const nomi = await fsp.readdir(dir);
  const voci: any[] = [];
  for (const nome of nomi) {
    const meta = metaDaNome(nome);
    if (!meta) continue;
    try {
      const st = await fsp.stat(path.join(dir, nome));
      voci.push({ ...meta, sizeBytes: st.size });
    } catch {}
  }
  return voci.sort((a, b) => b.creatoIl - a.creatoIl);
}

async function ruotaSnapshot(): Promise<string[]> {
  const dir = cartellaSnapshot();
  if (!dir) return [];
  const voci = await elencaSnapshot();
  const { recenti, giorni } = opzioniRotazione();
  const { eliminare } = Model.rotazioneSnapshot(voci, { recenti, giorni });
  const fatti: string[] = [];
  for (const nome of eliminare) {
    try {
      await fsp.unlink(path.join(dir, nome));
      fatti.push(nome);
    } catch (e: any) {
      console.error('[Snapshot] Eliminazione fallita per', nome, e && e.message);
    }
  }
  return fatti;
}

async function creaSnapshot(payload?: string | null, motivo: string = 'manuale'): Promise<any> {
  const dir = assicuraCartella();
  if (!dir) throw new Error('Workspace non impostato');

  let json = typeof payload === 'string' ? payload : null;
  if (!json) {
    if (!state.dataFilePath || !fs.existsSync(state.dataFilePath)) throw new Error('Nessun database da fotografare');
    json = String(await fsp.readFile(state.dataFilePath, 'utf8'));
  }

  const ts = Date.now();
  let nome = nomeSnapshot(ts, motivo);
  let scarto = 0;
  while (fs.existsSync(path.join(dir, nome)) && scarto < 60) {
    scarto++;
    nome = nomeSnapshot(ts + scarto * 1000, motivo);
  }

  const compresso = await gzipAsync(Buffer.from(json, 'utf8'));
  const tmp = path.join(dir, nome + '.tmp');
  await fsp.writeFile(tmp, compresso);
  await fsp.rename(tmp, path.join(dir, nome));

  if (motivo === 'auto') ultimoAuto = ts;
  await ruotaSnapshot();
  return { nome, creatoIl: ts, motivo, sizeBytes: compresso.length };
}

async function forseCreaSnapshotAutomatico(payload: string): Promise<void> {
  try {
    const { attivi } = opzioniRotazione();
    if (!attivi) return;
    if (!cartellaSnapshot()) return;
    if (ultimoAuto === 0) {
      const voci = await elencaSnapshot();
      if (ultimoAuto === 0) ultimoAuto = voci.length ? voci[0].creatoIl : 0;
    }
    const adesso = Date.now();
    if (adesso - ultimoAuto < INTERVALLO_AUTO_MS) return;
    const precedente = ultimoAuto;
    ultimoAuto = adesso;
    try {
      await creaSnapshot(payload, 'auto');
    } catch (e) {
      ultimoAuto = precedente;
      throw e;
    }
  } catch (e: any) {
    console.error('[Snapshot] Creazione automatica fallita:', e && e.message);
  }
}

async function caricaSnapshot(nome: string): Promise<any> {
  const file = percorsoSicuro(nome);
  const compresso = await fsp.readFile(file);
  const json = (await gunzipAsync(compresso)).toString('utf8');
  return JSON.parse(json);
}

async function eliminaSnapshot(nome: string): Promise<void> {
  await fsp.unlink(percorsoSicuro(nome));
}

async function storiaRecord(id: string): Promise<any[]> {
  const voci = await elencaSnapshot();
  const tappe: any[] = [];
  let precedente: string | null = null;
  for (const v of voci.slice().reverse()) {
    let db: any = null;
    try { db = await caricaSnapshot(v.nome); } catch { continue; }
    const rec = (db && Array.isArray(db.manoscritti))
      ? db.manoscritti.find((m: any) => String(m.id) === String(id))
      : null;
    const impronta = rec ? JSON.stringify(rec) : '';
    if (impronta === precedente) continue;
    precedente = impronta;
    tappe.push({ nome: v.nome, creatoIl: v.creatoIl, motivo: v.motivo, record: rec || null });
  }
  return tappe.reverse();
}

export { INTERVALLO_AUTO_MS, cartellaSnapshot, nomeSnapshot, metaDaNome, elencaSnapshot, creaSnapshot, forseCreaSnapshotAutomatico, ruotaSnapshot, caricaSnapshot, eliminaSnapshot, storiaRecord };
