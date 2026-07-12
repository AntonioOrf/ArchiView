const { ipcMain } = require('electron');
const { syncHubAttachments } = require('./hubAttachments');
const { HUB_URL, HUB_CREATE_SECRET, PUSHER_KEY, PUSHER_CLUSTER } = require('./cloudCredentials');

function setupHubIpc() {
  // Creazione repo: il CREATE_SECRET vive SOLO nel main (mai nel renderer). Ritorna
  // {repoId, ownerKey} generati server-side + l'URL hub bakeato nel build.
  ipcMain.handle('hub-create-repo', async (event: any, name: string) => {
    try {
      const res = await fetch(`${HUB_URL}/api/repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Create-Secret': HUB_CREATE_SECRET },
        body: JSON.stringify({ name: name || null }),
        signal: AbortSignal.timeout(20000)
      });
      if (res.status === 403) return { ok: false, error: "Creazione repository non autorizzata (secret non valido)." };
      if (!res.ok) return { ok: false, error: `Errore creazione repository (HTTP ${res.status}).` };
      const data: any = await res.json();
      return {
        ok: true, hubUrl: HUB_URL, repoId: data.repoId, ownerKey: data.ownerKey,
        pusherKey: PUSHER_KEY, pusherCluster: PUSHER_CLUSTER, pusherWebhook: `${HUB_URL}/api/ping`
      };
    } catch (e: any) {
      console.error("Errore creazione repo Hub:", e);
      const timedOut = e.name === 'TimeoutError' || e.name === 'AbortError';
      return { ok: false, error: timedOut ? "Hub non raggiungibile (timeout). Riprova più tardi." : e.message };
    }
  });

  // Sincronizza gli allegati del vault Hub (upload dei propri chunk se autenticato Google,
  // download via link pubblici per tutti). Ritorna il riepilogo, non lancia in caso di
  // allegati singoli non disponibili (vengono conteggiati in `unavailable`).
  ipcMain.handle('hub-sync-attachments', async () => {
    try {
      return { ok: true, ...(await syncHubAttachments()) };
    } catch (e: any) {
      console.error("Errore sync allegati Hub:", e);
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { setupHubIpc };
export {};
