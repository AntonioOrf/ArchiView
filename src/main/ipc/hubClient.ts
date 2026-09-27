// Client HTTP dell'Hub e formato degli inviti HUB1. Vive nel main (S8 in REVIEW-SECURITY.md):
// repoKey ed encKey non escono mai da qui verso il renderer, che riceve solo dati ed esiti.
//
// Nessuna dipendenza da electron: testabile in Node puro (test/hubClient.test.js).
const crypto = require('crypto');

export interface ConfigHub {
  hubUrl: string;
  repoId: string;
  repoKey: string;
}

/** Esito di una chiamata: `status` 0 = rete assente o timeout. Mai un'eccezione. */
export interface EsitoHub {
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
}

export interface InvitoHub {
  hubUrl: string;
  repoId: string;
  memberKey: string;
  encKey: string | null;
  pusherKey: string;
  pusherCluster: string;
  name: string;
}

/**
 * L'URL dell'Hub arriva anche da un invito (Hub self-hosted): la repoKey viaggia solo su HTTPS,
 * o in chiaro verso la macchina stessa (sviluppo). Niente credenziali o query nell'URL base.
 */
function hubUrlValido(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const locale = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && locale)) return null;
  if (u.username || u.password || u.search || u.hash) return null;
  return u.origin + u.pathname.replace(/\/+$/, '');
}

// Id di repo e membri generati dal server: alfanumerici. Un id con `/` o `..` cambierebbe la rotta.
const ID_HUB = /^[A-Za-z0-9_-]{1,128}$/;

async function chiamataHub(
  cfg: ConfigHub, method: string, suffisso: string,
  opzioni: { body?: any; timeoutMs?: number } = {}
): Promise<EsitoHub> {
  const base = hubUrlValido(cfg && cfg.hubUrl);
  if (!base || !cfg.repoKey || !ID_HUB.test(String(cfg.repoId))) {
    return { ok: false, status: 0, error: 'Configurazione Hub assente o non valida.' };
  }
  try {
    const res = await fetch(`${base}/api/repos/${cfg.repoId}${suffisso}`, {
      method,
      headers: {
        'Authorization': `Bearer ${cfg.repoKey}`,
        ...(opzioni.body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: opzioni.body !== undefined ? JSON.stringify(opzioni.body) : undefined,
      redirect: 'error', // un redirect porterebbe l'header Authorization altrove
      signal: AbortSignal.timeout(opzioni.timeoutMs || 30000)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: (data && typeof data.error === 'string') ? data.error : undefined };
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    const timeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return { ok: false, status: 0, error: timeout ? 'Hub non raggiungibile (timeout).' : 'Hub non raggiungibile.' };
  }
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

/** Chiave AES-256 per gli allegati, base64url (formato letto da hubAttachments.encKeyBuffer). */
function generaEncKey(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Convenzione pipe: HUB1|hubUrl|repoId|memberKey|encKey|pusherKey|pusherCluster|name(URI-encoded)
function codificaInvito(i: InvitoHub): string {
  return b64urlEncode(['HUB1', i.hubUrl, i.repoId, i.memberKey, i.encKey || '', i.pusherKey || '',
    i.pusherCluster || '', encodeURIComponent(i.name || '')].join('|'));
}

function decodificaInvito(raw: unknown): InvitoHub | null {
  if (typeof raw !== 'string') return null;
  let code = raw.trim();
  if (code.startsWith('archiview://join/')) code = code.slice('archiview://join/'.length);
  if (!code || code.length > 8192 || !/^[A-Za-z0-9_-]+=*$/.test(code)) return null;
  const decoded = Buffer.from(code, 'base64url').toString('utf8');
  if (!decoded.startsWith('HUB1|')) return null;
  const [, hubUrl, repoId, memberKey, encKey, pusherKey, pusherCluster, nameEnc] = decoded.split('|');
  const url = hubUrlValido(hubUrl);
  if (!url || !repoId || !ID_HUB.test(repoId) || !memberKey) return null;
  let name = '';
  try { name = nameEnc ? decodeURIComponent(nameEnc) : ''; } catch { name = ''; }
  return { hubUrl: url, repoId, memberKey, encKey: encKey || null, pusherKey: pusherKey || '', pusherCluster: pusherCluster || '', name };
}

// --- Cifratura del database (S7 in REVIEW-SECURITY.md) ---
//
// Il server conserva il database così come lo riceve: cifrato, chi legge D1 (o gestisce un Hub
// self-hosted) non vede schede e trascrizioni. Busta:
//   { archiviewCifrato: 1, iv, dati }   dati = AES-256-GCM(gzip(JSON)) || tag, base64
// - gzip prima di cifrare: il server comprime, ma un testo cifrato non si comprime più;
// - chiave derivata da encKey con HKDF: gli allegati usano encKey con nonce deterministici, il
//   DB nonce casuali; chiavi separate evitano qualsiasi incrocio fra i due schemi;
// - AAD = repoId + versione: il server non può spacciare una versione vecchia per la corrente,
//   né la busta di un altro repo. La versione è nota prima del push (parentVersion + 1).
// Le versioni in chiaro già presenti sul server restano leggibili (nessuna busta → passthrough).

const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const FORMATO_CIFRATO = 1;
// Tetto al JSON decompresso: una busta ostile non deve esaurire la memoria del main.
const MAX_DB_DECOMPRESSO = 512 * 1024 * 1024;

function chiaveDatabase(encKey: unknown): Buffer | null {
  if (typeof encKey !== 'string' || !encKey) return null;
  const k = Buffer.from(encKey, 'base64url');
  if (k.length !== 32) return null;
  return Buffer.from(crypto.hkdfSync('sha256', k, Buffer.alloc(0), 'archiview-hub-db-v1', 32));
}

const aadDatabase = (repoId: string, version: number) => Buffer.from(`archiview-hub-db|${repoId}|${version}`, 'utf8');

function eDatabaseCifrato(db: any): boolean {
  return !!db && typeof db === 'object' && db.archiviewCifrato !== undefined;
}

async function cifraDatabase(database: any, encKey: unknown, repoId: string, version: number): Promise<any> {
  const key = chiaveDatabase(encKey);
  if (!key) throw new Error('Chiave di cifratura dell\'archivio assente o non valida.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aadDatabase(repoId, version));
  const compresso: Buffer = await gzip(Buffer.from(JSON.stringify(database), 'utf8'));
  const dati = Buffer.concat([cipher.update(compresso), cipher.final(), cipher.getAuthTag()]);
  return { archiviewCifrato: FORMATO_CIFRATO, iv: iv.toString('base64'), dati: dati.toString('base64') };
}

/** Busta → database. Un database in chiaro (versioni precedenti alla cifratura) passa com'è. */
async function decifraDatabase(db: any, encKey: unknown, repoId: string, version: number): Promise<any> {
  if (!eDatabaseCifrato(db)) return db;
  if (db.archiviewCifrato !== FORMATO_CIFRATO) {
    throw new Error('Archivio cifrato con un formato più recente: aggiorna ArchiView.');
  }
  const key = chiaveDatabase(encKey);
  if (!key) throw new Error('Chiave di cifratura dell\'archivio assente: chiedi al proprietario un nuovo invito.');
  if (typeof db.iv !== 'string' || typeof db.dati !== 'string') throw new Error('Archivio cifrato danneggiato.');
  const iv = Buffer.from(db.iv, 'base64');
  const dati = Buffer.from(db.dati, 'base64');
  if (iv.length !== 12 || dati.length < 16) throw new Error('Archivio cifrato danneggiato.');
  let compresso: Buffer;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aadDatabase(repoId, version));
    decipher.setAuthTag(dati.subarray(dati.length - 16));
    compresso = Buffer.concat([decipher.update(dati.subarray(0, dati.length - 16)), decipher.final()]);
  } catch {
    throw new Error('Impossibile decifrare l\'archivio: la chiave non corrisponde o i dati sul server sono stati alterati.');
  }
  const json: Buffer = await gunzip(compresso, { maxOutputLength: MAX_DB_DECOMPRESSO });
  return JSON.parse(json.toString('utf8'));
}

module.exports = {
  chiamataHub, hubUrlValido, generaEncKey, codificaInvito, decodificaInvito, ID_HUB,
  cifraDatabase, decifraDatabase, eDatabaseCifrato
};
