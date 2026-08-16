// Mappa i messaggi grezzi di electron-updater/rete in codici stabili per la UI,
// così il renderer può mostrare testo i18n invece dell'errore tecnico raw.
// Nessuna dipendenza da Electron: testabile sotto plain Node.
function classifyUpdateError(error: unknown): 'offline' | 'no-release' | 'rate-limited' | 'generic' {
  const msg = String((error && (error as any).message) || error || '');
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|net::ERR_INTERNET_DISCONNECTED|getaddrinfo/i.test(msg)) {
    return 'offline';
  }
  if (/404|Not Found|no published versions|cannot find latest/i.test(msg)) {
    return 'no-release';
  }
  if (/403|rate limit/i.test(msg)) {
    return 'rate-limited';
  }
  return 'generic';
}

module.exports = { classifyUpdateError };
export {};
