import { getAllSettings, saveAllSettings, finestraPrincipale } from './workspaceManager';

const MIN = 80;
const MAX = 150;
const PASSO = 10;

function zoomSalvato(): number {
  const z = getAllSettings().zoomInterfaccia;
  return Number.isInteger(z) && z >= MIN && z <= MAX ? z : 100;
}

function applicaZoom() {
  const w = finestraPrincipale();
  const fattore = zoomSalvato() / 100;
  if (w && Math.abs(w.webContents.getZoomFactor() - fattore) > 0.001) w.webContents.setZoomFactor(fattore);
}

function zoomPerTasto(attuale: number, tasto: string): number | null {
  if (tasto === '+' || tasto === '=') return Math.min(MAX, attuale + PASSO);
  if (tasto === '-') return Math.max(MIN, attuale - PASSO);
  if (tasto === '0') return 100;
  return null;
}

function collegaZoom(finestra) {
  finestra.webContents.on('did-finish-load', applicaZoom);
  finestra.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return;
    const nuovo = zoomPerTasto(zoomSalvato(), input.key);
    if (nuovo === null) return;
    event.preventDefault();
    try {
      saveAllSettings({ zoomInterfaccia: nuovo });
    } catch (errore) {
      console.error('Zoom non salvato, applicato solo a questa sessione:', errore);
    }
    finestra.webContents.setZoomFactor(nuovo / 100);
    finestra.webContents.send('impostazioni-cambiate', ['zoomInterfaccia']);
  });
}

export { applicaZoom, collegaZoom, zoomPerTasto };
