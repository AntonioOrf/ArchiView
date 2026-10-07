// Blocco delle richieste `file:` verso un host di rete (N1 in PIANO-SICUREZZA-OTTIMIZZAZIONE.md).
//
// `<img src="file://host/share/x.png">` in un HTML condiviso (una trascrizione) fa tentare a
// Windows una connessione SMB verso host, e la connessione porta con sé l'hash NTLM
// dell'utente: basta aprire la scheda. DOMPurify scarta già lo schema e, da quando la finestra
// gira su app:// (O3), anche la CSP lo blocca; questa è la terza difesa, nel main,
// indipendente dal renderer: vale per ogni webContents della sessione.
//
// Restano ammessi i percorsi di rete DENTRO l'archivio aperto o la sua cartella allegati:
// chi tiene l'archivio su un NAS (\\nas\fondo) deve continuare a vedere i propri allegati.
//
// La parte che decide è pura (niente electron): test/guardiaFile.test.js.

const path = require('path');

/** Percorso UNC o di dispositivo (`\\host\…`, `//host/…`, `\\?\UNC\…`). */
function percorsoDiRete(p: string): boolean {
  return /^[\\/]{2}/.test(p);
}

function dentro(figlio: string, radice: string): boolean {
  const rel = path.win32.relative(radice.toLowerCase(), figlio.toLowerCase());
  return rel === '' || (!rel.startsWith('..') && !path.win32.isAbsolute(rel));
}

function decodifica(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

/**
 * true se la richiesta va annullata: URL `file:` che punta a un host di rete fuori dalle
 * `radici` ammesse. Gli URL non `file:` non sono affar suo. Un URL file: illeggibile si nega.
 */
function richiestaFileBloccata(url: string, radici: string[] = []): boolean {
  if (typeof url !== 'string' || !/^file:/i.test(url)) return false;
  let percorso: string;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const p = decodifica(u.pathname);
    if (host && host !== 'localhost') {
      percorso = '\\\\' + host + p.replace(/\//g, '\\');
    } else {
      // file:////host/share → pathname "//host/share"; file:///%5C%5Chost → "/\\host".
      if (!percorsoDiRete(p) && !percorsoDiRete(p.slice(1))) return false;
      percorso = '\\\\' + p.replace(/^[\\/]+/, '').replace(/\//g, '\\');
    }
  } catch {
    return true;
  }
  return !radici.some((r) => typeof r === 'string' && percorsoDiRete(r) && dentro(percorso, r.replace(/\//g, '\\')));
}

/** Installa la guardia sulla sessione indicata (una sola `onBeforeRequest` per sessione). */
function installaGuardiaFile(sessione: any, radici: () => string[]) {
  sessione.webRequest.onBeforeRequest((dettagli: any, callback: any) => {
    if (dettagli.url.charCodeAt(0) !== 102 /* f */ && dettagli.url.charCodeAt(0) !== 70 /* F */) {
      callback({});
      return;
    }
    let blocca = true;
    try { blocca = richiestaFileBloccata(dettagli.url, radici()); } catch { /* nel dubbio si nega */ }
    if (blocca) console.warn(`[SECURITY] Richiesta file: verso un host di rete bloccata: ${dettagli.url}`);
    callback({ cancel: blocca });
  });
}

module.exports = { richiestaFileBloccata, installaGuardiaFile };
export {};
