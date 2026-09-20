// Import IIIF — lettura del manifest.
//
// Il modulo fa SOLO I/O: scarica e consegna il JSON grezzo. L'interpretazione sta in
// `shared/iiifManifest.ts`, che gira identica nel renderer — è ciò che permette all'anteprima
// del modale di essere davvero l'import, e non un secondo percorso che diverge sui casi
// storti.
//
// Restituisce CODICI di errore, non frasi: l'italiano lo aggiunge il renderer, che sa in che
// lingua sta parlando (lezione della 2.1).

const { net } = require('electron');

const TIMEOUT_MS = 20000;

/** Un manifest di 1000 carte sta abbondantemente sotto; oltre, è qualcos'altro. */
const MAX_BYTE = 20 * 1024 * 1024;

const ACCEPT = 'application/ld+json;profile="http://iiif.io/api/presentation/3/context.json", application/ld+json;q=0.9, application/json;q=0.8, */*;q=0.1';

/** Solo http/https e un host vero: l'URL arriva incollato dall'utente. */
function urlAmmesso(url: string): boolean {
  try {
    const u = new URL(String(url || '').trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return !!u.hostname;
  } catch {
    return false;
  }
}

/**
 * Scarica un manifest. Non solleva: ogni errore diventa un codice, perché il modale deve
 * poter dire *cosa* non ha funzionato invece di mostrare una finestra vuota.
 *
 * Codici: `url_non_valido`, `timeout`, `rete`, `http`, `troppo_grande`, `non_json`.
 */
async function leggiManifest(url: string): Promise<any> {
  const indirizzo = String(url || '').trim();
  if (!urlAmmesso(indirizzo)) return { ok: false, codice: 'url_non_valido' };

  try {
    const risposta = await net.fetch(indirizzo, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept': ACCEPT }
    });

    if (!risposta.ok) {
      return { ok: false, codice: 'http', stato: risposta.status };
    }

    const dichiarata = Number(risposta.headers.get('content-length') || 0);
    if (dichiarata && dichiarata > MAX_BYTE) return { ok: false, codice: 'troppo_grande' };

    const testo = await risposta.text();
    if (testo.length > MAX_BYTE) return { ok: false, codice: 'troppo_grande' };

    let json;
    try {
      json = JSON.parse(testo);
    } catch {
      // Il caso tipico non è un JSON corrotto: è l'URL della PAGINA del manoscritto
      // incollato al posto di quello del manifest, e la risposta è una pagina HTML.
      return { ok: false, codice: 'non_json' };
    }

    return { ok: true, json, url: indirizzo };
  } catch (errore: any) {
    const nome = errore && (errore.name || '');
    if (nome === 'TimeoutError' || nome === 'AbortError') return { ok: false, codice: 'timeout' };
    console.error('[IIIF] Lettura manifest fallita:', errore);
    return { ok: false, codice: 'rete', errore: errore && errore.message };
  }
}

module.exports = { MAX_BYTE, urlAmmesso, leggiManifest };
export {};
