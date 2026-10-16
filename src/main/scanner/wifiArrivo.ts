import * as http from 'http';
import * as os from 'os';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { pipeline } from 'stream/promises';
const ScannerLotto = require('../../shared/scannerLotto');
import { riceviLotti, MAX_BYTE_MANIFEST } from './arrivoLotti';

export interface OpzioniWifi {
  cartellaArrivo: string;
  cartellaTemp: string;
  cartellaAssegnati?: string;
  cartellaStaging: string;
  archivio: string;
  onLotto?: (id: string) => void;
}

export interface ServerWifi {
  porta: number;
  token: string;
  ferma(): Promise<void>;
}

function rangoLan(ip: string): number {
  const [a, b] = ip.split('.').map(Number);
  if (a === 192 && b === 168) return 0;
  if (a === 10) return 1;
  if (a === 172 && b >= 16 && b <= 31) return 2;
  return 3;
}

function indirizziLan(schedeRete: Record<string, any[] | undefined> = os.networkInterfaces()): string[] {
  const out: string[] = [];
  for (const schede of Object.values(schedeRete)) {
    for (const s of schede || []) if (s.family === 'IPv4' && !s.internal) out.push(s.address);
  }
  return out.sort((x, y) => rangoLan(x) - rangoLan(y));
}

function urlAbbinamento(host: string, porta: number, token: string): string {
  return `archiview-scanner://abbina?h=${encodeURIComponent(host)}&p=${porta}&t=${token}`;
}

function rispondi(res: any, stato: number, corpo?: any) {
  if (corpo === undefined) { res.writeHead(stato); res.end(); return; }
  res.writeHead(stato, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
}

function tokenValido(header: unknown, token: string): boolean {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sorgenteStaging(staging: string, id: string) {
  const dir = path.join(staging, id);
  return {
    async elenca() { return [{ id, completo: fs.existsSync(path.join(dir, ScannerLotto.NOME_MANIFEST)) }]; },
    async leggiManifest(_id: string, maxByte: number) {
      const st = await fsp.stat(path.join(dir, ScannerLotto.NOME_MANIFEST));
      if (st.size > maxByte) throw new Error('manifest_troppo_grande');
      return fsp.readFile(path.join(dir, ScannerLotto.NOME_MANIFEST), 'utf8');
    },
    async scaricaPagina(_id: string, pagina: { file: string }, destinazione: string) {
      await fsp.copyFile(path.join(dir, pagina.file), destinazione);
    },
    async rimuovi() { await fsp.rm(dir, { recursive: true, force: true }); }
  };
}

async function avviaServerWifi(o: OpzioniWifi): Promise<ServerWifi> {
  const token = crypto.randomBytes(32).toString('hex');
  let catena: Promise<any> = Promise.resolve();

  async function ricevi(id: string): Promise<{ stato: number; corpo?: any }> {
    const esito = await riceviLotti({
      sorgente: sorgenteStaging(o.cartellaStaging, id),
      cartellaArrivo: o.cartellaArrivo,
      cartellaTemp: o.cartellaTemp,
      cartellaAssegnati: o.cartellaAssegnati,
      archivio: o.archivio
    });
    if (esito.ricevuti.includes(id) || esito.giaPresenti.includes(id)) {
      if (o.onLotto) o.onLotto(id);
      return { stato: 201 };
    }
    await fsp.rm(path.join(o.cartellaStaging, id), { recursive: true, force: true });
    const codici = esito.falliti.map((f: any) => f.codice).concat(esito.altroArchivio.map(() => 'altro_archivio'));
    return { stato: 422, corpo: { falliti: codici } };
  }

  async function gestisci(req: any, res: any) {
    if (!tokenValido(req.headers.authorization, token)) return rispondi(res, 401);
    if (req.method === 'GET' && req.url === '/ping') return rispondi(res, 200, { archivio: o.archivio });
    const m = /^\/lotti\/([^/?#]+)\/([^/?#]+)$/.exec(req.url || '');
    if (req.method !== 'PUT' || !m) return rispondi(res, 404);
    const [, id, file] = m;
    const manifest = file === ScannerLotto.NOME_MANIFEST;
    if (!ScannerLotto.idValido(id) || !(manifest || ScannerLotto.nomeFileValido(file))) return rispondi(res, 400);
    const byte = Number(req.headers['content-length']);
    const tetto = manifest ? MAX_BYTE_MANIFEST : ScannerLotto.LIMITI.byte;
    if (!Number.isInteger(byte) || byte < 1) return rispondi(res, 411);
    if (byte > tetto) return rispondi(res, 413);

    const dir = path.join(o.cartellaStaging, id);
    await fsp.mkdir(dir, { recursive: true });
    const parziale = path.join(dir, file + '.' + crypto.randomBytes(4).toString('hex') + '.part');
    try {
      await pipeline(req, fs.createWriteStream(parziale));
      const st = await fsp.stat(parziale);
      if (st.size !== byte) throw new Error('corpo_troncato');
      await fsp.rename(parziale, path.join(dir, file));
    } catch (e) {
      await fsp.rm(parziale, { force: true }).catch(() => {});
      throw e;
    }
    if (!manifest) return rispondi(res, 204);
    const esito = await (catena = catena.catch(() => {}).then(() => ricevi(id)));
    return rispondi(res, esito.stato, esito.corpo);
  }

  await fsp.rm(o.cartellaStaging, { recursive: true, force: true });
  const server = http.createServer((req: any, res: any) => {
    gestisci(req, res).catch((e: any) => {
      console.error('[scanner-wifi] richiesta fallita:', e && e.message);
      if (!res.headersSent) rispondi(res, 500); else res.destroy();
    });
  });
  await new Promise<void>((ok, ko) => { server.once('error', ko); server.listen(0, '0.0.0.0', () => ok()); });

  return {
    porta: (server.address() as import('net').AddressInfo).port,
    token,
    async ferma() {
      server.closeAllConnections?.();
      await new Promise<void>(ok => server.close(() => ok()));
      await fsp.rm(o.cartellaStaging, { recursive: true, force: true }).catch(() => {});
    }
  };
}

export { avviaServerWifi, indirizziLan, urlAbbinamento };
