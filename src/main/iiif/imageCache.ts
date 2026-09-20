// Import IIIF — cache su disco delle immagini remote.
//
// ⚠️ LA CACHE NON STA NEL WORKSPACE. Sta in `userData`, per la stessa ragione per cui ci
// stanno i token e `auth_debug.log`: la cartella del workspace è sincronizzata, e qualche
// centinaio di megabyte di miniature finirebbe chunkato su Drive per tutti i collaboratori —
// cioè esattamente il costo che il modello "carte remote" esiste per evitare.
//
// Il nome del file è l'hash dell'URL COMPLETO, misura inclusa: una carta chiesta a 160 px e
// la stessa a 2000 px sono due voci distinte, e chiedere la miniatura non può far sparire
// dalla cache il facsimile grande già scaricato.

const { app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const crypto = require('crypto');

/** Oltre questa soglia si sfoltisce, dal file usato meno di recente. */
const TETTO_BYTE = 2 * 1024 * 1024 * 1024;

/** Un facsimile a piena risoluzione può pesare parecchio; oltre questo non è più un'immagine. */
const MAX_IMMAGINE = 80 * 1024 * 1024;

/**
 * Per SINGOLO tentativo, non per l'intera catena: un server che macina una misura che non
 * sa calcolare tiene aperta la connessione finché non si arrende (Bodleian: 504 al
 * cinquantesimo secondo). Tagliare prima e passare al ripiego mostra la carta in pochi
 * secondi invece di lasciare il visualizzatore vuoto per un minuto.
 */
const TIMEOUT_MS = 20000;

function cartella() {
  const dir = path.join(app.getPath('userData'), 'iiif-cache');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function chiave(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

/**
 * Il MIME si conserva accanto al file perché il nome è un hash e non ha estensione. Senza,
 * servire un PNG dichiarandolo JPEG funziona per caso finché non smette.
 */
function percorsi(url: string) {
  const base = path.join(cartella(), chiave(url));
  return { dati: base, meta: base + '.mime', parziale: base + '.part' };
}

/**
 * Solo http/https, e solo host veri. Senza questo controllo `iiif-img://img/<base64>`
 * diventerebbe un lettore di `file://` pilotabile da un manifest scaricato da chissà dove:
 * il manifest è un dato di terzi, non una fonte di fiducia.
 */
function urlAmmesso(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return !!u.hostname;
  } catch {
    return false;
  }
}

/**
 * Il riferimento che il renderer infila nel path, codificato base64url.
 *
 * È il JSON della carta (`{s, v, u, l}` — servizio, versione della Image API, immagine
 * statica, lato richiesto) e non un URL già pronto, perché l'URL da solo non basta: se la
 * misura non è servibile serve sapere COME ripiegare, e quella conoscenza sta in
 * `shared/iiifManifest.ts`, non in una stringa. Una stringa semplice resta accettata: è un
 * singolo candidato, senza ripieghi.
 */
function decodificaRiferimento(riferimento: string): any {
  const b64 = String(riferimento || '').replace(/-/g, '+').replace(/_/g, '/');
  let testo = '';
  try {
    testo = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return null;
  }
  if (!testo) return null;
  if (testo[0] !== '{') return testo;
  try {
    return JSON.parse(testo);
  } catch {
    return null;
  }
}

async function leggiDallaCache(url: string) {
  const p = percorsi(url);
  try {
    const dati = await fsp.readFile(p.dati);
    let mime = 'image/jpeg';
    try { mime = (await fsp.readFile(p.meta, 'utf8')) || mime; } catch { /* default */ }
    // `utimes` per la LRU: il timestamp di accesso è l'unico modo per sapere quali file
    // buttare, e su Windows `atime` non si aggiorna da solo alla lettura.
    fsp.utimes(p.dati, new Date(), new Date()).catch(() => {});
    return { dati, mime };
  } catch {
    return null;
  }
}

async function scriviInCache(url: string, dati: Buffer, mime: string) {
  const p = percorsi(url);
  try {
    // `.part` + rename: un'interruzione di rete lascerebbe altrimenti sul disco un JPEG
    // troncato che la cache servirebbe per sempre al posto della carta (stesso accorgimento
    // di `ocrLangs.installaLingua` e `zipStreaming`).
    await fsp.writeFile(p.parziale, dati);
    await fsp.rename(p.parziale, p.dati);
    await fsp.writeFile(p.meta, mime);
  } catch (errore) {
    console.warn('[IIIF] Scrittura in cache fallita:', (errore as any) && (errore as any).message);
    try { if (fs.existsSync(p.parziale)) await fsp.unlink(p.parziale); } catch { /* best effort */ }
  }
}

/** Un solo tentativo, senza cache. Ritorna `null` con una riga di log su qualunque intoppo. */
async function scarica(url: string): Promise<{ dati: Buffer; mime: string } | null> {
  try {
    const risposta = await net.fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept': 'image/jpeg,image/png,image/*;q=0.8' }
    });
    if (!risposta.ok) {
      console.warn(`[IIIF] Immagine non disponibile (${risposta.status}): ${url}`);
      return null;
    }

    const dichiarata = Number(risposta.headers.get('content-length') || 0);
    if (dichiarata && dichiarata > MAX_IMMAGINE) {
      console.warn(`[IIIF] Immagine troppo grande (${dichiarata} byte): ${url}`);
      return null;
    }

    const dati = Buffer.from(await risposta.arrayBuffer());
    if (!dati.length || dati.length > MAX_IMMAGINE) return null;

    const mime = (risposta.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    // Un server che risponde 200 con una pagina di errore HTML non deve finire in cache
    // come se fosse una carta: la voce sbagliata resterebbe lì a lungo.
    if (!/^image\//i.test(mime)) {
      console.warn(`[IIIF] Risposta non immagine (${mime}): ${url}`);
      return null;
    }
    return { dati, mime };
  } catch (errore) {
    // Rete assente o server che non risponde: non è un errore da mostrare, è il caso
    // normale dell'uso offline e del ripiego sulla misura successiva.
    console.warn(`[IIIF] Scaricamento fallito (${url}):`, (errore as any) && (errore as any).message);
    return null;
  }
}

/**
 * Scarica un'immagine servendosi della cache, tentando i candidati in ordine.
 *
 * ⚠️ PERCHÉ UNA LISTA E NON UN URL. I server IIIF sono decine di implementazioni diverse e
 * quello che non sa servire una misura non ripiega da sé: risponde 400, 501, o — il caso
 * peggiore, quello di Bodleian con `!w,h` — un 504 dopo cinquanta secondi. Con un solo URL
 * l'esito è una carta che non compare e nessuna spiegazione.
 *
 * La cache è indicizzata sul PRIMO candidato: la chiave è la richiesta logica ("questa
 * carta a questa misura"), non quello che si è riusciti a ottenere. Altrimenti ogni
 * apertura della carta ritenterebbe la misura che sul quel server non funziona.
 *
 * Ritorna `null` se nessun candidato risponde: il renderer mostra il segnaposto.
 */
async function immagine(candidati: string | string[]): Promise<{ dati: Buffer; mime: string } | null> {
  const elenco = (Array.isArray(candidati) ? candidati : [candidati]).filter(urlAmmesso);
  if (!elenco.length) return null;

  const chiaveCache = elenco[0];
  const inCache = await leggiDallaCache(chiaveCache);
  if (inCache) return inCache;

  for (const url of elenco) {
    const esito = await scarica(url);
    if (!esito) continue;
    if (url !== chiaveCache) {
      console.log(`[IIIF] Misura richiesta non disponibile, servita dal ripiego: ${url}`);
    }
    await scriviInCache(chiaveCache, esito.dati, esito.mime);
    return esito;
  }

  console.warn(`[IIIF] Nessun candidato utilizzabile per ${chiaveCache} (${elenco.length} tentati).`);
  return null;
}

/**
 * Sfoltimento LRU, eseguito una volta all'avvio e non a ogni scrittura: contare l'intera
 * cartella costa una `stat` per file, e farlo per ogni miniatura di una striscia da 400
 * carte trasformerebbe una cache in un problema di I/O.
 */
async function sfoltisci(tetto = TETTO_BYTE) {
  try {
    const dir = cartella();
    const nomi = await fsp.readdir(dir);
    const voci: any[] = [];
    let totale = 0;

    for (const nome of nomi) {
      if (nome.endsWith('.mime')) continue;
      try {
        const st = await fsp.stat(path.join(dir, nome));
        if (!st.isFile()) continue;
        // I `.part` sono residui di un'interruzione: non sono cache, sono spazzatura.
        if (nome.endsWith('.part')) { await fsp.unlink(path.join(dir, nome)).catch(() => {}); continue; }
        voci.push({ nome, dimensione: st.size, usato: st.atimeMs || st.mtimeMs });
        totale += st.size;
      } catch { /* il file può sparire fra readdir e stat */ }
    }

    if (totale <= tetto) return { rimossi: 0, totale };

    voci.sort((a, b) => a.usato - b.usato);
    let rimossi = 0;
    for (const v of voci) {
      if (totale <= tetto * 0.8) break;
      await fsp.unlink(path.join(dir, v.nome)).catch(() => {});
      await fsp.unlink(path.join(dir, v.nome + '.mime')).catch(() => {});
      totale -= v.dimensione;
      rimossi++;
    }
    console.log(`[IIIF] Cache sfoltita: ${rimossi} file rimossi, ${Math.round(totale / 1048576)} MB residui.`);
    return { rimossi, totale };
  } catch (errore) {
    console.warn('[IIIF] Sfoltimento cache fallito:', (errore as any) && (errore as any).message);
    return { rimossi: 0, totale: 0 };
  }
}

module.exports = {
  TETTO_BYTE, MAX_IMMAGINE,
  cartella, chiave, urlAmmesso, decodificaRiferimento,
  leggiDallaCache, immagine, sfoltisci
};
export {};
