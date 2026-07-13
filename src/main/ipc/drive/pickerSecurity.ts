// Guardia di autorizzazione per il server HTTP effimero del Google Picker (sharing.ts).
// Il GET della pagina serve l'access token OAuth in chiaro: va servito SOLO alla finestra
// legittima aperta dall'app, che porta il sessionSecret nella query (?s=<secret>).
// Estratto qui (nessuna dipendenza da electron) per essere unit-testabile.
function pickerGetSecretOk(reqUrl: string, sessionSecret: string): boolean {
  if (!sessionSecret) return false;
  try {
    const parsed = new URL(reqUrl, 'http://127.0.0.1:3457');
    return parsed.searchParams.get('s') === sessionSecret;
  } catch {
    return false;
  }
}

module.exports = { pickerGetSecretOk };
export {};
