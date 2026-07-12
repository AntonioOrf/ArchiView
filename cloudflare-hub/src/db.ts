import type { Env } from './types';

const BLOB_MAX = 900 * 1024; // limite prudente per valore/riga D1

// --- gzip/gunzip via Compression Streams (nativi nel runtime Workers) --------

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const stream = new Response(bytes).body!.pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const stream = new Response(bytes).body!.pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// D1 restituisce i BLOB come ArrayBuffer; normalizziamo difensivamente.
function toU8(v: unknown): Uint8Array {
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v)) return Uint8Array.from(v as number[]);
  throw new Error('BLOB inatteso da D1');
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// Buffer indipendente (evita di passare viste condivise al binding D1).
function slab(seg: Uint8Array): ArrayBuffer {
  return seg.slice().buffer;
}

const EMPTY_DB = {};

/**
 * Legge una versione specifica. version 0 => DB vuoto (repo appena creato, mai nessun push).
 * Ritorna null se la versione non esiste (mai scritta o eliminata dalla retention).
 */
export async function readVersion(
  env: Env,
  repoId: string,
  version: number
): Promise<{ version: number; database: unknown } | null> {
  if (version === 0) return { version, database: EMPTY_DB };

  const exists = await env.DB.prepare(
    'SELECT 1 FROM versions WHERE repo_id = ? AND version = ?'
  ).bind(repoId, version).first();
  if (!exists) return null;

  const rows = await env.DB.prepare(
    'SELECT data FROM version_blobs WHERE repo_id = ? AND version = ? ORDER BY seq ASC'
  ).bind(repoId, version).all<{ data: unknown }>();

  const parts = (rows.results ?? []).map((r) => toU8(r.data));
  if (parts.length === 0) return { version, database: EMPTY_DB };

  const jsonBytes = await gunzip(concat(parts));
  return { version, database: JSON.parse(new TextDecoder().decode(jsonBytes)) };
}

/** Ultima versione + DB deserializzato. null => repo inesistente. */
export async function readLatest(
  env: Env,
  repoId: string
): Promise<{ version: number; database: unknown } | null> {
  const repo = await env.DB.prepare('SELECT current_version FROM repos WHERE repo_id = ?')
    .bind(repoId).first<{ current_version: number }>();
  if (!repo) return null;
  const result = await readVersion(env, repoId, repo.current_version);
  // Difensivo: se per qualche motivo la versione corrente non ha blob (race), non rompere il pull.
  return result ?? { version: repo.current_version, database: EMPTY_DB };
}

/** Elenco versioni (metadata-only, nessuna lettura di blob) con autore risolto da members.label. */
export async function listVersions(
  env: Env,
  repoId: string
): Promise<Array<{
  version: number;
  createdAt: number;
  authorMemberId: string | null;
  authorLabel: string | null;
  sizeBytes: number;
}> | null> {
  const repo = await env.DB.prepare('SELECT 1 FROM repos WHERE repo_id = ?')
    .bind(repoId).first();
  if (!repo) return null;

  const rows = await env.DB.prepare(
    `SELECT v.version AS version, v.created_at AS createdAt, v.author_member_id AS authorMemberId,
            v.size_bytes AS sizeBytes, m.label AS authorLabel
     FROM versions v
     LEFT JOIN members m ON m.member_id = v.author_member_id AND m.repo_id = v.repo_id
     WHERE v.repo_id = ?
     ORDER BY v.version DESC`
  ).bind(repoId).all<{
    version: number; createdAt: number; authorMemberId: string | null;
    sizeBytes: number; authorLabel: string | null;
  }>();

  return rows.results ?? [];
}

/** Solo la versione corrente (fast-path per ?ifVersionNot). */
export async function currentVersion(env: Env, repoId: string): Promise<number | null> {
  const repo = await env.DB.prepare('SELECT current_version FROM repos WHERE repo_id = ?')
    .bind(repoId).first<{ current_version: number }>();
  return repo ? repo.current_version : null;
}

/**
 * Scrive una nuova versione (versions + blob gzippati) in un unico batch atomico.
 * L'incremento condizionale di current_version è responsabilità del chiamante (push).
 */
export async function writeVersion(
  env: Env,
  repoId: string,
  newVersion: number,
  database: unknown,
  authorMemberId: string | null
): Promise<void> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(database));
  const gz = await gzip(jsonBytes);

  const segments: Uint8Array[] = [];
  for (let off = 0; off < gz.length; off += BLOB_MAX) {
    segments.push(gz.subarray(off, Math.min(off + BLOB_MAX, gz.length)));
  }
  if (segments.length === 0) segments.push(new Uint8Array(0));

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      'INSERT INTO versions(repo_id,version,created_at,author_member_id,size_bytes,chunk_count) VALUES(?,?,?,?,?,?)'
    ).bind(repoId, newVersion, Date.now(), authorMemberId, jsonBytes.length, segments.length),
  ];
  segments.forEach((seg, i) => {
    stmts.push(
      env.DB.prepare('INSERT INTO version_blobs(repo_id,version,seq,data) VALUES(?,?,?,?)')
        .bind(repoId, newVersion, i, slab(seg))
    );
  });

  await env.DB.batch(stmts);
}

/** Conserva solo le ultime MAX_VERSIONS versioni; elimina le più vecchie + blob. */
export async function pruneVersions(env: Env, repoId: string, keep: number): Promise<void> {
  const threshold = await env.DB.prepare(
    'SELECT MAX(version) AS maxv FROM versions WHERE repo_id = ?'
  ).bind(repoId).first<{ maxv: number | null }>();
  const maxv = threshold?.maxv ?? 0;
  const cutoff = maxv - keep;
  if (cutoff <= 0) return;

  await env.DB.batch([
    env.DB.prepare('DELETE FROM version_blobs WHERE repo_id = ? AND version <= ?').bind(repoId, cutoff),
    env.DB.prepare('DELETE FROM versions WHERE repo_id = ? AND version <= ?').bind(repoId, cutoff),
  ]);
}
