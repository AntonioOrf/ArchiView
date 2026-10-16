const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readVaultConfig, syncUnifiedFromLegacy } = require('../out/main/vaultConfig');

console.log('Running vaultConfig tests...');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archiview-vaultcfg-'));
const vault = (nome, files) => {
  const dir = path.join(tmp, nome);
  fs.mkdirSync(dir);
  for (const [f, v] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), JSON.stringify(v));
  return dir;
};

try {
  const ms = vault('ms', { '.archiview-drive.json': { isSharedVault: true, sharedVaultId: 'ONEDRIVE!123' } });
  const cfg = readVaultConfig(ms, { workspacePath: ms, cloudProvider: 'microsoft' });
  assert.strictEqual(cfg.vaultType, 'local');
  assert.strictEqual(cfg.provider, 'none');
  assert.strictEqual(cfg.migratedFromMicrosoft, true);
  assert.strictEqual(cfg.sync.sharedVaultId, null);

  const unif = vault('unificato', { '.archiview-vault.json': {
    schemaVersion: 1, vaultType: 'shared', provider: 'microsoft', sync: { sharedVaultId: 'ONEDRIVE!9' } } });
  const u = readVaultConfig(unif, {});
  assert.deepStrictEqual([u.vaultType, u.provider, u.sync.sharedVaultId, u.migratedFromMicrosoft], ['local', 'none', null, true]);

  const scritto = syncUnifiedFromLegacy(ms, { workspacePath: ms, cloudProvider: 'microsoft' });
  assert.strictEqual(scritto.provider, 'none');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(ms, '.archiview-vault.json'), 'utf8')).provider, 'none');

  const g = vault('google', { '.archiview-drive.json': { isSharedVault: true, sharedVaultId: 'drive123' } });
  const cg = readVaultConfig(g, {});
  assert.deepStrictEqual([cg.vaultType, cg.provider, cg.sync.sharedVaultId, cg.migratedFromMicrosoft], ['shared', 'google', 'drive123', undefined]);
  const h = vault('hub', { '.archiview-hub.json': { hubUrl: 'https://hub.example', repoId: 'repo_1' } });
  assert.strictEqual(readVaultConfig(h, {}).provider, 'hub');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('vaultConfig tests passed.');
