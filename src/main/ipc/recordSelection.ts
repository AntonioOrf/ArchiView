import * as fs from 'fs';
import * as path from 'path';
import { state } from '../workspaceManager';

async function leggiDb() {
  if (!state.workspacePath) return null;
  const dbPath = path.join(state.workspacePath, 'database_manoscritti.json');
  if (!fs.existsSync(dbPath)) return null;
  return JSON.parse(await fs.promises.readFile(dbPath, 'utf8'));
}

function recordsRichiesti(db: any, ids: any[]): any[] {
  const manoscritti = (db && db.manoscritti) || [];
  const indice = new Map(manoscritti.map((m: any) => [String(m.id), m]));
  const visti = new Set<string>();
  return (ids || []).map(String).filter((id) => {
    if (visti.has(id)) return false;
    visti.add(id); return true;
  }).map((id) => indice.get(id)).filter(Boolean);
}

function nomeFileSicuro(base: any, fallback: string): string {
  return String(base || '').replace(/[\/:*?"<>|]/g, '_').trim().slice(0, 80) || fallback;
}

export { leggiDb, recordsRichiesti, nomeFileSicuro };
