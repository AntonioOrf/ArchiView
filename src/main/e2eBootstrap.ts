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

module.exports = {};
export {};
