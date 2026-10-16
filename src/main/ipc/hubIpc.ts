import { ipcMain } from 'electron';
import { syncHubAttachments } from './hubAttachments';
const { HUB_URL, HUB_CREATE_SECRET, PUSHER_KEY, PUSHER_CLUSTER } = require('./cloudCredentials');
import { loadHubConfig, loadHubConfigPubblica, saveHubConfig } from '../workspaceManager';
import { chiamataHub, generaEncKey, codificaInvito, decodificaInvito, ID_HUB, cifraDatabase, decifraDatabase, eDatabaseCifrato } from './hubClient';
import { clonaWorkspace } from './workspaceIpc';
import { nomeCartellaSicuro } from './pathSafety';

const NON_COLLEGATO = { ok: false, status: 0, error: 'Questo archivio non è collegato ad un repository Hub.' };

const TIMEOUT_DB_MS = 120000;

function configAttiva() {
  const cfg = loadHubConfig();
  return cfg && cfg.repoId && cfg.repoKey ? cfg : null;
}

async function corpoPush(cfg: any, parentVersion: number, database: any) {
  if (!cfg.encKey) {
    console.warn(`[hub] repo ${cfg.repoId}: nessuna encKey, database inviato in chiaro.`);
    return { parentVersion, database };
  }
  return { parentVersion, database: await cifraDatabase(database, cfg.encKey, cfg.repoId, parentVersion + 1) };
}

function segnaDbCifrato() {
  const cfg = loadHubConfig();
  if (cfg && cfg.repoId && !cfg.dbCifrato) saveHubConfig({ ...cfg, dbCifrato: true });
}

async function conDatabaseInChiaro(r: any, cfg: any, corrente: boolean) {
  if (!r.ok || !r.data || r.data.unchanged === true || r.data.database === undefined) return r;
  const { version, database } = r.data;
  try {
    if (!eDatabaseCifrato(database)) {
      if (corrente && cfg.dbCifrato && version > 0) {
        return { ok: false, status: 0, error: "L'archivio sul server non è cifrato come atteso: dati rifiutati. Verifica che tutti i membri usino l'ultima versione di ArchiView." };
      }
      return r;
    }
    const inChiaro = await decifraDatabase(database, cfg.encKey, cfg.repoId, version);
    if (corrente && !cfg.dbCifrato) segnaDbCifrato();
    return { ...r, data: { ...r.data, database: inChiaro } };
  } catch (e: any) {
    console.error('[hub] decifratura database:', e.message);
    return { ok: false, status: 0, error: e.message };
  }
}

function setupHubIpc() {
  ipcMain.handle('hub-create-repo', async (event: any, name: string, database: any) => {
    try {
      const res = await fetch(`${HUB_URL}/api/repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Create-Secret': HUB_CREATE_SECRET },
        body: JSON.stringify({ name: null }),
        signal: AbortSignal.timeout(20000)
      });
      if (res.status === 403) return { ok: false, error: "Creazione repository non autorizzata (secret non valido)." };
      if (!res.ok) return { ok: false, error: `Errore creazione repository (HTTP ${res.status}).` };
      const data: any = await res.json();
      if (!data || !ID_HUB.test(String(data.repoId)) || typeof data.ownerKey !== 'string') {
        return { ok: false, error: "Risposta dell'Hub non valida." };
      }

      const cfg = { hubUrl: HUB_URL, repoId: data.repoId, repoKey: data.ownerKey, encKey: generaEncKey() };
      const push = await chiamataHub(cfg, 'POST', '/push', { body: await corpoPush(cfg, 0, database), timeoutMs: TIMEOUT_DB_MS });
      if (!push.ok) return { ok: false, error: push.error || `Push iniziale fallito (HTTP ${push.status}).` };

      const salvato = saveHubConfig({
        ...cfg, dbCifrato: true,
        version: push.data.version, lastLoadedAt: Date.now(), attachmentsMode: 'drive-links',
        role: 'owner', name: typeof name === 'string' ? name : '',
        pusherKey: PUSHER_KEY, pusherCluster: PUSHER_CLUSTER
      });
      if (!salvato) return { ok: false, error: "Repository creato ma configurazione locale non salvata." };
      return { ok: true, config: loadHubConfigPubblica(), pusherKey: PUSHER_KEY, pusherCluster: PUSHER_CLUSTER };
    } catch (e: any) {
      console.error("Errore creazione repo Hub:", e);
      const timedOut = e.name === 'TimeoutError' || e.name === 'AbortError';
      return { ok: false, error: timedOut ? "Hub non raggiungibile (timeout). Riprova più tardi." : e.message };
    }
  });

  ipcMain.handle('hub-pull', async (event: any, ifVersionNot?: number) => {
    const cfg = configAttiva();
    if (!cfg) return NON_COLLEGATO;
    const qs = Number.isInteger(ifVersionNot) ? `?ifVersionNot=${ifVersionNot}` : '';
    return conDatabaseInChiaro(await chiamataHub(cfg, 'GET', `/pull${qs}`, { timeoutMs: TIMEOUT_DB_MS }), cfg, true);
  });

  ipcMain.handle('hub-push', async (event: any, parentVersion: number, database: any) => {
    const cfg = configAttiva();
    if (!cfg) return NON_COLLEGATO;
    if (!Number.isInteger(parentVersion) || !database || typeof database !== 'object') {
      return { ok: false, status: 0, error: 'Dati di invio non validi.' };
    }
    try {
      const r = await chiamataHub(cfg, 'POST', '/push', { body: await corpoPush(cfg, parentVersion, database), timeoutMs: TIMEOUT_DB_MS });
      if (r.ok && cfg.encKey) segnaDbCifrato();
      return r;
    } catch (e: any) {
      console.error('[hub] cifratura database:', e.message);
      return { ok: false, status: 0, error: e.message };
    }
  });

  ipcMain.handle('hub-versions', async () => {
    const cfg = configAttiva();
    return cfg ? chiamataHub(cfg, 'GET', '/versions') : NON_COLLEGATO;
  });

  ipcMain.handle('hub-version', async (event: any, n: number) => {
    const cfg = configAttiva();
    if (!cfg) return NON_COLLEGATO;
    if (!Number.isInteger(n) || n < 0) return { ok: false, status: 0, error: 'Versione non valida.' };
    return conDatabaseInChiaro(await chiamataHub(cfg, 'GET', `/versions/${n}`, { timeoutMs: TIMEOUT_DB_MS }), cfg, false);
  });

  ipcMain.handle('hub-role', async () => {
    const cfg = configAttiva();
    if (!cfg) return 'unknown';
    if (cfg.role === 'owner' || cfg.role === 'member') return cfg.role;
    const r = await chiamataHub(cfg, 'GET', '/members');
    const role = r.ok ? 'owner' : (r.status === 401 || r.status === 403 ? 'member' : null);
    if (!role) return 'unknown';
    try { saveHubConfig({ ...cfg, role }); } catch (e) { console.error("Errore salvataggio ruolo Hub:", e); }
    return role;
  });

  ipcMain.handle('hub-invite', async (event: any, label: string, nomeArchivio: string) => {
    const cfg = configAttiva();
    if (!cfg) return NON_COLLEGATO;
    const r = await chiamataHub(cfg, 'POST', '/members', { body: { label: String(label || '').slice(0, 200) } });
    if (!r.ok) return r;
    if (!r.data || typeof r.data.memberKey !== 'string') return { ok: false, status: 0, error: "Risposta dell'Hub non valida." };
    const code = codificaInvito({
      hubUrl: cfg.hubUrl, repoId: cfg.repoId, memberKey: r.data.memberKey, encKey: cfg.encKey || null,
      pusherKey: cfg.pusherKey || '', pusherCluster: cfg.pusherCluster || '',
      name: cfg.name || (typeof nomeArchivio === 'string' ? nomeArchivio : '')
    });
    return { ok: true, status: r.status, data: { code } };
  });

  ipcMain.handle('hub-members', async () => {
    const cfg = configAttiva();
    return cfg ? chiamataHub(cfg, 'GET', '/members') : NON_COLLEGATO;
  });

  ipcMain.handle('hub-revoke-member', async (event: any, memberId: string) => {
    const cfg = configAttiva();
    if (!cfg) return NON_COLLEGATO;
    if (!ID_HUB.test(String(memberId))) return { ok: false, status: 0, error: 'Membro non valido.' };
    return chiamataHub(cfg, 'DELETE', `/members/${memberId}`);
  });

  ipcMain.handle('hub-join', async (event: any, code: string, basePath: string) => {
    const inv = decodificaInvito(code);
    if (!inv) return { ok: false, status: 0, error: 'Invito non valido.' };
    const cfg = { hubUrl: inv.hubUrl, repoId: inv.repoId, repoKey: inv.memberKey, encKey: inv.encKey };
    const grezzo = await chiamataHub(cfg, 'GET', '/pull', { timeoutMs: TIMEOUT_DB_MS });
    if (!grezzo.ok) {
      return { ok: false, status: grezzo.status, error: (grezzo.status === 401 || grezzo.status === 403)
        ? "Invito non valido o accesso revocato." : "Impossibile connettersi al repository remoto." };
    }
    const dbCifrato = eDatabaseCifrato(grezzo.data && grezzo.data.database);
    const r = await conDatabaseInChiaro(grezzo, cfg, false);
    if (!r.ok) return r;
    const database = (r.data && r.data.database) || {};
    const sharedName = (typeof database.nomeArchivio === 'string' && database.nomeArchivio) || inv.name || '';
    const nomeCartella = nomeCartellaSicuro(sharedName.slice(0, 80), `Vault_${inv.repoId}`);
    const ok = clonaWorkspace(basePath, nomeCartella, {
      ...cfg, dbCifrato, version: r.data.version, lastLoadedAt: Date.now(),
      attachmentsMode: 'drive-links', role: 'member', name: sharedName,
      pusherKey: inv.pusherKey, pusherCluster: inv.pusherCluster
    }, database);
    return ok ? { ok: true, status: 200, data: { name: sharedName } } : { ok: false, status: 0, error: "Errore durante la creazione dei file locali." };
  });

  ipcMain.handle('hub-realtime-auth', async (event: any, socketId: string, channel: string) => {
    const cfg = configAttiva();
    if (!cfg) return NON_COLLEGATO;
    if (typeof socketId !== 'string' || !/^\d{1,20}\.\d{1,20}$/.test(socketId) || channel !== `private-repo-${cfg.repoId}`) {
      return { ok: false, status: 0, error: 'Richiesta di iscrizione non valida.' };
    }
    return chiamataHub(cfg, 'POST', '/realtime-auth', { body: { socketId, channel }, timeoutMs: 15000 });
  });

  ipcMain.handle('hub-sync-attachments', async () => {
    try {
      return { ok: true, ...(await syncHubAttachments()) };
    } catch (e: any) {
      console.error("Errore sync allegati Hub:", e);
      return { ok: false, error: e.message };
    }
  });
}

export { setupHubIpc };
