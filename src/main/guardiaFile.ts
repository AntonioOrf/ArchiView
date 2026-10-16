import * as path from 'path';

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
      if (!percorsoDiRete(p) && !percorsoDiRete(p.slice(1))) return false;
      percorso = '\\\\' + p.replace(/^[\\/]+/, '').replace(/\//g, '\\');
    }
  } catch {
    return true;
  }
  return !radici.some((r) => typeof r === 'string' && percorsoDiRete(r) && dentro(percorso, r.replace(/\//g, '\\')));
}

function installaGuardiaFile(sessione: any, radici: () => string[]) {
  sessione.webRequest.onBeforeRequest((dettagli: any, callback: any) => {
    if (dettagli.url.charCodeAt(0) !== 102 && dettagli.url.charCodeAt(0) !== 70) {
      callback({});
      return;
    }
    let blocca = true;
    try { blocca = richiestaFileBloccata(dettagli.url, radici()); } catch {}
    if (blocca) console.warn(`[SECURITY] Richiesta file: verso un host di rete bloccata: ${dettagli.url}`);
    callback({ cancel: blocca });
  });
}

export { richiestaFileBloccata, installaGuardiaFile };
