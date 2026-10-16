import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { state, getActiveVaultFlags } from './workspaceManager';

function tokensDir(): string {
  return path.join(app.getPath('userData'), 'cloud-tokens');
}

function sanitizeKey(key: string): string {
  return String(key).replace(/[^A-Za-z0-9_-]/g, '_');
}

function activeVaultKey(): string {
  try {
    if (state.workspacePath) {
      const flags = getActiveVaultFlags();
      if ((flags.isSharedVault || flags.isPersonalCloud) && flags.sharedVaultId) {
        return sanitizeKey(flags.sharedVaultId);
      }
    }
  } catch (e) {}
  return 'global';
}

function tokenPathFor(provider: 'google' | 'hub', key: string): string {
  return path.join(tokensDir(), `${provider}-${sanitizeKey(key)}.json`);
}

import * as crypto from 'crypto';

function hubScopeKey(repoId: string, wpOverride?: string): string {
  const wp = wpOverride || state.workspacePath || '';
  const suffix = wp ? crypto.createHash('sha256').update(wp).digest('hex').slice(0, 12) : 'noworkspace';
  return `${repoId}-${suffix}`;
}

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
    } catch (e) {}
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
    if (!raw) {
      const legacyPath = hubLegacyPath(repoId);
      if (legacyPath !== scopedPath && fs.existsSync(legacyPath)) {
        raw = readSerialized(legacyPath);
        if (raw) {
          try { writeSerialized(scopedPath, raw); fs.unlinkSync(legacyPath); } catch (e) {}
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
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
  }
}

function writeSerialized(filePath: string, serialized: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(serialized).toString('base64');
    fs.writeFileSync(filePath, JSON.stringify({ encrypted, v: 1 }));
  } else {
    console.warn('[cloudTokenStore] safeStorage non disponibile: token salvato in chiaro.');
    fs.writeFileSync(filePath, serialized);
  }
}

function readSerialized(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {}
    if (parsed && parsed.v === 1 && parsed.encrypted) {
      return safeStorage.decryptString(Buffer.from(parsed.encrypted, 'base64'));
    }
    return raw;
  } catch (e) {
    console.error('[cloudTokenStore] Errore lettura token:', filePath, e);
    return null;
  }
}

function moveFile(src: string, dst: string): void {
  const dir = path.dirname(dst);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dst);
  try { fs.unlinkSync(src); } catch {}
}

function migrateLegacy(
  provider: 'google',
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
          moveFile(legacyLocal, globalNew);
        }
      }
    }
  } catch (e) {
    console.error('[cloudTokenStore] Migrazione token fallita:', provider, e);
  }
}

function purgeMicrosoftTokens(): number {
  const candidati: string[] = [path.join(app.getPath('userData'), 'ms-tokens-global.json')];
  try {
    for (const nome of fs.readdirSync(tokensDir())) {
      if (/^ms-.*\.json$/.test(nome)) candidati.push(path.join(tokensDir(), nome));
    }
  } catch {}
  if (state.workspacePath) candidati.push(path.join(state.workspacePath, '.ms-tokens.json'));
  let rimossi = 0;
  for (const p of candidati) {
    try { if (fs.existsSync(p)) { fs.unlinkSync(p); rimossi++; } } catch (e: any) {
      console.warn('[cloudTokenStore] token Microsoft non rimosso:', p, e && e.message);
    }
  }
  return rimossi;
}

export { tokensDir, purgeMicrosoftTokens, activeVaultKey, tokenPathFor, writeSerialized, readSerialized, migrateLegacy, saveHubSecrets, loadHubSecrets, clearHubSecrets };
