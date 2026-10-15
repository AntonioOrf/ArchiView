// P10 — collegamento delle voci d'anagrafica a Wikidata (e, tramite Wikidata, a VIAF).
//
// Serve a distinguere gli omonimi e a trovare le varianti di un nome, non a pubblicare. Un
// solo host: il numero VIAF si legge dalla proprietà P214 dell'entità Wikidata, così non
// serve parlare con viaf.org (la cui API è cambiata nel 2024 senza un'alternativa stabile).
//
// Rete da `reteSicura.fetchGuardata`, URL costruiti qui e mai dal renderer, nessun redirect
// seguito (un 30x verso un altro host sarebbe un'uscita dalla whitelist), corpo a tetto.
// Codici di errore, non frasi: l'italiano lo aggiunge il renderer.

import { ipcMain } from 'electron';
import { leggiCorpoLimitato, fetchGuardata } from '../iiif/reteSicura';

const API = 'https://www.wikidata.org/w/api.php';
const TIMEOUT_MS = 15000;
const MAX_BYTE = 2 * 1024 * 1024;
const LINGUE = ['it', 'la', 'en', 'fr', 'de', 'es'];
const ID_WIKIDATA = /^Q[1-9]\d{0,11}$/;
const ID_VIAF = /^[1-9]\d{0,21}$/;

function urlApi(parametri: Record<string, string>): string {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ ...parametri, format: 'json', formatversion: '2' })) u.searchParams.set(k, v);
  return u.toString();
}

async function chiedi(url: string): Promise<any> {
  try {
    const risposta = await fetchGuardata(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept': 'application/json', 'Api-User-Agent': 'ArchiView (https://archiview.orfhist.com)' }
    });
    if (!risposta.ok) return { ok: false, codice: 'http', stato: risposta.status };
    const corpo = await leggiCorpoLimitato(risposta, MAX_BYTE);
    if (!corpo) return { ok: false, codice: 'troppo_grande' };
    return { ok: true, json: JSON.parse(corpo.toString('utf8')) };
  } catch (errore: any) {
    const nome = errore && (errore.name || '');
    if (nome === 'TimeoutError' || nome === 'AbortError') return { ok: false, codice: 'timeout' };
    if (nome === 'SyntaxError') return { ok: false, codice: 'non_json' };
    console.error('[Authority] Richiesta a Wikidata fallita:', errore);
    return { ok: false, codice: 'rete' };
  }
}

const testo = (v: any, max = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Candidati di `wbsearchentities`, ridotti a ciò che il renderer mostra. */
function leggiCandidati(json: any): Array<{ id: string; etichetta: string; descrizione: string }> {
  const voci = Array.isArray(json && json.search) ? json.search : [];
  return voci
    .filter((v: any) => v && ID_WIKIDATA.test(String(v.id)))
    .map((v: any) => ({ id: String(v.id), etichetta: testo(v.label), descrizione: testo(v.description) }));
}

/** Etichette e alias nelle lingue utili, senza doppioni. */
function leggiVarianti(json: any, id: string): string[] {
  const ent = json && json.entities && json.entities[id];
  if (!ent) return [];
  const out: string[] = [];
  for (const l of LINGUE) {
    const etichetta = ent.labels && ent.labels[l] && ent.labels[l].value;
    if (etichetta) out.push(testo(etichetta, 200));
    for (const a of (ent.aliases && ent.aliases[l]) || []) if (a && a.value) out.push(testo(a.value, 200));
  }
  const visti = new Set<string>();
  return out.filter(s => s && !visti.has(s.toLowerCase()) && visti.add(s.toLowerCase()));
}

/** Il primo numero VIAF (P214) fra le affermazioni dell'entità. */
function leggiViaf(json: any): string {
  const affermazioni = (json && json.claims && json.claims.P214) || [];
  for (const c of affermazioni) {
    const v = String(c && c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value || '');
    if (ID_VIAF.test(v)) return v;
  }
  return '';
}

async function cerca(nome: any, lingua: any) {
  const q = testo(nome, 200);
  if (!q) return { ok: false, codice: 'vuoto' };
  const lang = LINGUE.includes(String(lingua)) ? String(lingua) : 'it';
  const esito = await chiedi(urlApi({ action: 'wbsearchentities', search: q, language: lang, uselang: lang, type: 'item', limit: '15' }));
  return esito.ok ? { ok: true, candidati: leggiCandidati(esito.json) } : esito;
}

async function dettagli(id: any) {
  const qid = String(id || '');
  if (!ID_WIKIDATA.test(qid)) return { ok: false, codice: 'id_non_valido' };
  const [entita, viaf] = await Promise.all([
    chiedi(urlApi({ action: 'wbgetentities', ids: qid, props: 'labels|aliases', languages: LINGUE.join('|') })),
    chiedi(urlApi({ action: 'wbgetclaims', entity: qid, property: 'P214' }))
  ]);
  if (!entita.ok) return entita;
  // Senza VIAF la voce resta collegabile: molte persone d'archivio non ce l'hanno.
  const out: any = { ok: true, wikidata: qid, varianti: leggiVarianti(entita.json, qid) };
  const numero = viaf.ok ? leggiViaf(viaf.json) : '';
  if (numero) out.viaf = numero;
  return out;
}

function setupAuthorityIpc() {
  ipcMain.handle('authority-cerca', (event: any, nome: any, lingua: any) => cerca(nome, lingua));
  ipcMain.handle('authority-dettagli', (event: any, id: any) => dettagli(id));
}

export { setupAuthorityIpc, urlApi, leggiCandidati, leggiVarianti, leggiViaf };
