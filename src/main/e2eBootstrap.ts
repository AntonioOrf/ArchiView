// Bootstrap di isolamento per i test E2E (Playwright).
// DEVE essere il primo modulo richiesto in main.ts: reindirizza la cartella
// `userData` PRIMA che qualsiasi altro modulo (workspaceManager, cloudTokenStore, ...)
// la legga a import-time. Inerte in produzione: attivo solo se la env var è presente.
const { app } = require('electron');

const e2eUserData = process.env.ARCHIVIEW_E2E_USER_DATA;
if (e2eUserData) {
  try {
    app.setPath('userData', e2eUserData);
    // Evita che il singleton lock, i dizionari, la cache GPU, ecc. finiscano altrove.
    app.setPath('sessionData', e2eUserData);
  } catch (e) {
    console.error('[e2eBootstrap] setPath userData fallito:', e);
  }
}

// Test in background: la finestra vive fuori dallo schermo (vedi createWindow). Windows la
// considererebbe occlusa e Chromium la passerebbe a visibilityState 'hidden', con rAF
// fermo: Playwright aspetta la stabilità degli elementi via rAF e si bloccherebbe.
if (e2eUserData && process.env.ARCHIVIEW_E2E_BACKGROUND) {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
}

module.exports = {};
export {};
