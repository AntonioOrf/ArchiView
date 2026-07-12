const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { state, getActiveVaultFlags } = require('./workspaceManager');

// Store centralizzato dei token cloud (Google + Microsoft).
//
// I token vivono SEMPRE in userData/cloud-tokens/, MAI dentro la cartella del workspace:
// - il blob DPAPI (safeStorage) è legato a utente+macchina, quindi non deve finire in una
//   cartella potenzialmente sincronizzata (Drive/OneDrive desktop) → sarebbe indecifrabile
//   su un'altra macchina e causerebbe re-login perpetuo.
// - la chiave è il vaultId del vault attivo (isolamento per account/vault), con fallback 'global'
//   per i workspace non-cloud → indipendente dal path della cartella (re-join = stesso token).

function tokensDir(): string {
  return path.join(app.getPath('userData'), 'cloud-tokens');
}

// Sanifica il vaultId per l'uso come nome file. Gli id Drive sono già [A-Za-z0-9_-],
// ma normalizziamo per robustezza.
function sanitizeKey(key: string): string {
  return String(key).replace(/[^A-Za-z0-9_-]/g, '_');
}

// Chiave del vault attivo: vaultId se il workspace è un vault cloud, altrimenti 'global'.
function activeVaultKey(): string {
  try {
    if (state.workspacePath) {
      const flags = getActiveVaultFlags();
      if ((flags.isSharedVault || flags.isPersonalCloud) && flags.sharedVaultId) {
        return sanitizeKey(flags.sharedVaultId);
      }
    }
  } catch (e) { /* nessun workspace / config illeggibile → global */ }
  return 'global';
}

function tokenPathFor(provider: 'google' | 'ms' | 'hub', key: string): string {
  return path.join(tokensDir(), `${provider}-${sanitizeKey(key)}.json`);
}

// --- Segreti Hub (repoKey owner/membro + encKey AES per-repo) ---
//
// Non sono token OAuth ma vanno protetti allo stesso modo: la repoKey concede accesso
// in lettura/scrittura al repo, la encKey decifra gli allegati. Vivono in userData
// (fuori dal workspace, che può essere sincronizzato) cifrati con DPAPI.
//
// La chiave dello slot combina repoId + hash del workspace path: due workspace locali
// dello stesso repo (es. owner + membro sullo stesso PC, per test) hanno chiavi diverse,
// altrimenti il join del membro sovrascriverebbe la ownerKey e l'owner degraderebbe a membro.

const crypto = require('crypto');

// `wpOverride` serve al clone Hub, dove i segreti del membro vanno salvati sotto il path del
// NUOVO workspace mentre `state.workspacePath` punta ancora a quello corrente.
function hubScopeKey(repoId: string, wpOverride?: string): string {
  const wp = wpOverride || state.workspacePath || '';
  const suffix = wp ? crypto.createHash('sha256').update(wp).digest('hex').slice(0, 12) : 'noworkspace';
  return `${repoId}-${suffix}`;
}

// Path legacy (solo repoId): mantenuto per la migrazione one-shot dei vault esistenti.
function hubLegacyPath(repoId: string): string {
  return tokenPathFor('hub', repoId);
}

function saveHubSecrets(repoId: string, secrets: { repoKey?: string; encKey?: string | null }, wpOverride?: string): boolean {
  try {
    if (!repoId) return false;
    const scopedPath = tokenPathFor('hub', hubScopeKey(repoId, wpOverride));
    let existing: any = {};
    try {
      const raw = readSerialized(scopedPath);
      if (raw) existing = JSON.parse(raw);
    } catch (e) { /* slot assente/illeggibile → sovrascrivi */ }
    const merged = { ...existing, ...secrets };
    writeSerialized(scopedPath, JSON.stringify(merged));
    return true;
  } catch (e) {
    console.error('[cloudTokenStore] Salvataggio segreti hub fallito:', repoId, e);
    return false;
  }
}

function loadHubSecrets(repoId: string): { repoKey?: string; encKey?: string | null } | null {
  try {
    if (!repoId) return null;
    const scopedPath = tokenPathFor('hub', hubScopeKey(repoId));
    let raw = readSerialized(scopedPath);
    // Migrazione one-shot dal path legacy (keyed solo per repoId) al path per-workspace.
    if (!raw) {
      const legacyPath = hubLegacyPath(repoId);
      if (legacyPath !== scopedPath && fs.existsSync(legacyPath)) {
        raw = readSerialized(legacyPath);
        if (raw) {
          try { writeSerialized(scopedPath, raw); fs.unlinkSync(legacyPath); } catch (e) { /* best-effort */ }
        }
      }
    }
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[cloudTokenStore] Lettura segreti hub fallita:', repoId, e);
    return null;
  }
}

function clearHubSecrets(repoId: string): void {
  for (const p of [tokenPathFor('hub', hubScopeKey(repoId)), hubLegacyPath(repoId)]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* best-effort */ }
  }
}

// --- Crittografia condivisa (envelope { encrypted, v:1 } via DPAPI, oppure plaintext) ---

function writeSerialized(filePath: string, serialized: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(serialized).toString('base64');
    fs.writeFileSync(filePath, JSON.stringify({ encrypted, v: 1 }));
  } else {
    // Fallback plaintext: safeStorage non disponibile (raro su Windows con DPAPI).
    console.warn('[cloudTokenStore] safeStorage non disponibile: token salvato in chiaro.');
    fs.writeFileSync(filePath, serialized);
  }
}

// Ritorna la stringa serializzata (JSON per Google, cache MSAL per MS) oppure null.
function readSerialized(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { /* non JSON → plaintext legacy MSAL */ }
    if (parsed && parsed.v === 1 && parsed.encrypted) {
      return safeStorage.decryptString(Buffer.from(parsed.encrypted, 'base64'));
    }
    return raw;
  } catch (e) {
    console.error('[cloudTokenStore] Errore lettura token:', filePath, e);
    return null;
  }
}

// --- Migrazione one-shot dai vecchi percorsi ---

function moveFile(src: string, dst: string): void {
  const dir = path.dirname(dst);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dst); // il formato envelope è identico: copia byte-for-byte, niente re-encrypt
  try { fs.unlinkSync(src); } catch { /* best-effort */ }
}

// Migra il token globale legacy e quello locale del workspace attivo verso la nuova location.
// legacyLocalFor: risolve il vecchio percorso locale dato il workspacePath (null se n/d).
function migrateLegacy(
  provider: 'google' | 'ms',
  legacyGlobalPath: string | null,
  legacyLocalFor: (ws: string) => string | null
): void {
  try {
    const globalNew = tokenPathFor(provider, 'global');
    if (legacyGlobalPath && !fs.existsSync(globalNew) && fs.existsSync(legacyGlobalPath)) {
      moveFile(legacyGlobalPath, globalNew);
    }
    if (state.workspacePath) {
      const legacyLocal = legacyLocalFor(state.workspacePath);
      if (legacyLocal && fs.existsSync(legacyLocal)) {
        const key = activeVaultKey();
        if (key !== 'global') {
          const keyedNew = tokenPathFor(provider, key);
          if (!fs.existsSync(keyedNew)) moveFile(legacyLocal, keyedNew);
        } else if (!fs.existsSync(globalNew)) {
          // workspace non-vault: il token locale diventa il globale (stesso account).
          moveFile(legacyLocal, globalNew);
        }
      }
    }
  } catch (e) {
    console.error('[cloudTokenStore] Migrazione token fallita:', provider, e);
  }
}

module.exports = {
  tokensDir,
  activeVaultKey,
  tokenPathFor,
  writeSerialized,
  readSerialized,
  migrateLegacy,
  saveHubSecrets,
  loadHubSecrets,
  clearHubSecrets
};
export {};
