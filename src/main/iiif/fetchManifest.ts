import { hostPrivato, leggiCorpoLimitato, autorizzaOrigine, fetchGuardata, urlAmmesso } from './reteSicura';

const TIMEOUT_MS = 20000;

const MAX_BYTE = 20 * 1024 * 1024;

const ACCEPT = 'application/ld+json;profile="http://iiif.io/api/presentation/3/context.json", application/ld+json;q=0.9, application/json;q=0.8, */*;q=0.1';

async function leggiManifest(url: string): Promise<any> {
  const indirizzo = String(url || '').trim();
  if (!urlAmmesso(indirizzo)) return { ok: false, codice: 'url_non_valido' };

  try {
    if (await hostPrivato(new URL(indirizzo).hostname)) autorizzaOrigine(indirizzo);
    const risposta = await fetchGuardata(indirizzo, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept': ACCEPT }
    });

    if (!risposta.ok) {
      return { ok: false, codice: 'http', stato: risposta.status };
    }

    const dichiarata = Number(risposta.headers.get('content-length') || 0);
    if (dichiarata && dichiarata > MAX_BYTE) return { ok: false, codice: 'troppo_grande' };

    const corpo = await leggiCorpoLimitato(risposta, MAX_BYTE);
    if (!corpo) return { ok: false, codice: 'troppo_grande' };
    const testo = corpo.toString('utf8');

    let json;
    try {
      json = JSON.parse(testo);
    } catch {
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

export { MAX_BYTE, urlAmmesso, leggiManifest };
