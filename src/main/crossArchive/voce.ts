// Ricerca tra archivi — dalla scheda alla voce d'indice.
//
// La voce è DATI PURI (stringhe, numeri, array): niente funzioni, niente riferimenti al
// database d'origine. È ciò che permette di spedirla fra worker e main e, il giorno in cui
// servirà, di scriverla su disco così com'è (vedi `INDICE_FORMATO`).

const Model = require('../../shared/model');
const { normalizza, testoPulito, testoIndicizzabile } = require('./testo');

/**
 * Versione della forma di `Voce`. Va incrementata a OGNI cambiamento di struttura o di ciò
 * che finisce dentro una voce: un indice persistito con il formato vecchio va scartato.
 */
// 2: `provenienza` e `rimandiEsterni` diventano chiavi di servizio e non entrano più nella voce.
const INDICE_FORMATO = 2;

/**
 * Tipo e authority dei campi BASE, cioè di quelli dichiarati in `CONFIG_CAMPI` (renderer,
 * logic/utils.ts). Il main non può leggere quel catalogo e senza questa tabella non saprebbe
 * che `attori_dinamici` contiene persone.
 * ⚠️ È una copia: `test/crossArchiveIndex.test.js` la confronta con CONFIG_CAMPI e fallisce
 * se un campo base acquista o perde `authority` da una parte sola.
 */
const CAMPI_BASE_AUTHORITY = {
  dataTopica: { type: 'text', authority: 'luogo' },
  attori_dinamici: { type: 'dynamic_list', authority: 'persona' },
  famiglia_dinamici: { type: 'dynamic_list', authority: 'persona' }
};

/** Peso di un campo nel punteggio: la segnatura e le persone contano più delle note. */
const PESO = { segnatura: 4, anagrafica: 3, campo: 2, testo: 1 };

const ID_TRASCRIZIONE = '#trascrizione';
const ID_OCR = '#ocr';
const ID_TAGS = '#tags';

type CampoVoce = { id: string; label?: string; orig: string; norm: string; peso: number };
type NomeAnagrafica = { tipo: string; chiave: string; nome: string; norm: string };
type Voce = {
  id: string;
  segnatura: string;
  tipoId: string;
  tipoNome: string;
  lastModified: number | null;
  campi: CampoVoce[];
  anagrafica: NomeAnagrafica[];
  troncata?: true;
};

/** Ciò che serve a costruire le voci di UN archivio, calcolato una volta per archivio. */
type ContestoArchivio = { tipi: Map<string, any>; db: any; firma: string };

function contestoArchivio(db: any): ContestoArchivio {
  const tipi = new Map<string, any>();
  for (const t of (db && Array.isArray(db.tipiDocumento)) ? db.tipiDocumento : []) {
    if (t && t.id) tipi.set(String(t.id), t);
  }
  // La firma copre ciò che cambia una voce SENZA cambiare la scheda: un campo dichiarato
  // persona, un tipo rinominato, una grafia scelta in anagrafica. Se cambia, le voci si
  // ricostruiscono tutte anche se nessun `lastModified` si è mosso.
  const firma = require('crypto').createHash('sha1')
    .update(JSON.stringify([db && db.tipiDocumento || [], db && db.authority || {}]))
    .digest('base64');
  return { tipi, db, firma };
}

function aggiungiCampo(campi: CampoVoce[], id: string, testo: string, peso: number, label?: string) {
  if (!testo) return;
  const c: CampoVoce = { id, orig: testo, norm: normalizza(testo), peso };
  if (label) c.label = label;
  campi.push(c);
}

function taglia(testo: string, limite: number): { testo: string; troncato: boolean } {
  if (!limite || testo.length <= limite) return { testo, troncato: false };
  return { testo: testo.slice(0, limite), troncato: true };
}

function costruisciVoce(m: any, ctx: ContestoArchivio, limiteTesto: number): Voce | null {
  if (!m || typeof m !== 'object' || m.id === undefined || m.id === null) return null;
  const tipo = ctx.tipi.get(String(m.tipoDocumento || '')) || null;
  const definizioni = Model.campiDellaScheda(m, tipo, CAMPI_BASE_AUTHORITY, ctx.db);
  const defPerId = new Map<string, any>();
  for (const d of definizioni) defPerId.set(d.id, d);

  const voce: Voce = {
    id: String(m.id),
    segnatura: testoPulito(m.segnatura),
    tipoId: String(m.tipoDocumento || ''),
    tipoNome: tipo && tipo.nome ? String(tipo.nome) : String(m.tipoDocumento || ''),
    lastModified: typeof m.lastModified === 'number' ? m.lastModified : null,
    campi: [],
    anagrafica: []
  };

  aggiungiCampo(voce.campi, 'segnatura', voce.segnatura, PESO.segnatura);
  if (m.tags) aggiungiCampo(voce.campi, ID_TAGS, testoPulito(m.tags), PESO.campo);

  // Tutti i campi della scheda, non solo quelli del tipo: un campo rimasto da un tipo
  // cambiato è ancora un dato che il ricercatore ha scritto e che si aspetta di ritrovare.
  const servizio = new Set(Model.CHIAVI_SERVIZIO);
  const ana = Model.authority(ctx.db);
  for (const k of Object.keys(m)) {
    if (servizio.has(k)) continue;
    const def = defPerId.get(k);
    const testo = testoPulito(m[k]);
    if (!testo) continue;
    const label = def && def.label ? String(def.label) : undefined;
    if (def && def.authority) {
      aggiungiCampo(voce.campi, k, testo, PESO.anagrafica, label);
      const valori = def.tipo === 'dynamic_list' && Array.isArray(m[k])
        ? m[k].map((e: any) => String((e && (e.v !== undefined ? e.v : e.nome)) || '').trim())
        : [testoIndicizzabile(m[k]).trim()];
      for (const nome of valori) {
        const chiave = Model.chiaveAuthority(def.authority, nome);
        if (!chiave || voce.anagrafica.some(a => a.chiave === chiave)) continue;
        const scelto = ana[chiave] && ana[chiave].nome ? String(ana[chiave].nome) : nome;
        voce.anagrafica.push({ tipo: def.authority, chiave, nome: scelto, norm: normalizza(scelto + ' ' + nome) });
      }
    } else {
      aggiungiCampo(voce.campi, k, testo, PESO.campo, label);
    }
  }

  // Trascrizione: la forma derivata `m.trascrizione` se c'è, altrimenti le carte.
  let trascr = typeof m.trascrizione === 'string' ? m.trascrizione : '';
  let ocr = '';
  if (Array.isArray(m.allegati)) {
    const daCarte = !trascr;
    for (const a of m.allegati) {
      if (!a) continue;
      if (daCarte && typeof a.trascrizione === 'string' && a.trascrizione) trascr += a.trascrizione + '\n';
      if (a.ocr && typeof a.ocr.testo === 'string' && a.ocr.testo) ocr += a.ocr.testo + '\n';
    }
  }
  const t1 = taglia(testoPulito(trascr), limiteTesto);
  const t2 = taglia(ocr.trim(), limiteTesto);
  aggiungiCampo(voce.campi, ID_TRASCRIZIONE, t1.testo, PESO.testo);
  aggiungiCampo(voce.campi, ID_OCR, t2.testo, PESO.testo);
  if (t1.troncato || t2.troncato) voce.troncata = true;

  return voce;
}

module.exports = {
  INDICE_FORMATO, CAMPI_BASE_AUTHORITY, PESO, ID_TRASCRIZIONE, ID_OCR, ID_TAGS,
  contestoArchivio, costruisciVoce
};
export {};
