// Mappa i messaggi grezzi di electron-updater/rete in codici stabili per la UI,
// così il renderer può mostrare testo i18n invece dell'errore tecnico raw.
// Nessuna dipendenza da Electron: testabile sotto plain Node.
function classifyUpdateError(error: unknown): 'offline' | 'release-incomplete' | 'no-release' | 'rate-limited' | 'generic' {
  const msg = String((error && (error as any).message) || error || '');
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|net::ERR_INTERNET_DISCONNECTED|getaddrinfo/i.test(msg)) {
    return 'offline';
  }
  // La release c'è ma i suoi file non ancora: è una pubblicazione in corso, non un'assenza.
  // Va PRIMA di 'no-release', perché il messaggio di electron-updater contiene anche "404".
  if (/in the latest release artifacts/i.test(msg)) {
    return 'release-incomplete';
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
