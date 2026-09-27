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

module.exports = { chiamataHub, hubUrlValido, generaEncKey, codificaInvito, decodificaInvito, ID_HUB };
