// Fase 3.2 — Data storica fuzzy: interpretazione di una datazione scritta a mano.
//
// `dataCronica` è sempre stata un campo di testo con segnaposto "Es. 12 Maggio 1340",
// quindi la lista si ordinava alfabeticamente: "12 maggio 1340" prima di "3 aprile 1290",
// perché 1 viene prima di 3. Questo modulo dà un significato a quel testo — un intervallo di
// anni — e con esso arrivano l'ordinamento cronologico e il filtro per secolo.
//
// ⚠️ DECISIONE CENTRALE: **il risultato non viene salvato nel record**. `m.dataCronica`
// resta la stringa che l'utente ha battuto, e l'intervallo si ricalcola quando serve, con
// una memoria in RAM per il testo già visto. Le tre ragioni, in ordine di peso:
//  1. il parser migliorerà (le forme di datazione sono infinite): un intervallo salvato
//     resterebbe quello sbagliato di oggi anche dopo la correzione, su ogni scheda mai più
//     riaperta;
//  2. una chiave in più sul record cambia la sua impronta (`getRecordHash`) e farebbe
//     apparire modificato a ogni collega un archivio che nessuno ha toccato;
//  3. sarebbe un dato derivato dentro un file sincronizzato, cioè una cosa che due macchine
//     con versioni diverse dell'app scriverebbero in modo diverso.
// Il costo è una regex su una stringa corta per record ordinato: irrilevante rispetto al
// filtro che gira già su ogni battuta (`objectMatchesTokens`).
//
// ⚠️ `raw` resta sempre l'unica cosa mostrata e modificabile: una datazione incerta non va
// forzata in un calendario. Se l'app non capisce, lo dice — e il campo continua a funzionare
// come prima.
//
// Modulo PURO e condiviso (main + renderer), come `model.ts`: stessa doppia esposizione in
// coda al file, stesso prefisso `AV` sui nomi globali.

type AVIntervalloData = {
  /** Il testo come l'ha scritto l'utente. */
  raw: string;
  /** Estremi INCLUSIVI come interi AAAAMMGG, o null se l'estremo è ignoto. */
  da: number | null;
  a: number | null;
  /** `esatta`, `anno`, `circa`, `ante`, `post`, `intervallo`, `secolo`, `nessuna`. */
  qualificatore: string;
  /** false quando la datazione è dichiarata incerta (`c.`, `ante`, `post`, secolo). */
  certa: boolean;
  /** true se il testo è stato riconosciuto: l'interfaccia mostra il resto solo allora. */
  riconosciuta: boolean;
};

const AV_MESI: { [k: string]: number } = {
  gennaio: 1, gennaro: 1, genn: 1, gen: 1, ianuarii: 1, januarii: 1, ian: 1,
  febbraio: 2, febbr: 2, feb: 2, februarii: 2,
  marzo: 3, mar: 3, martii: 3,
  aprile: 4, apr: 4, aprilis: 4,
  maggio: 5, magg: 5, mag: 5, maii: 5, madii: 5,
  giugno: 6, giu: 6, iunii: 6, junii: 6,
  luglio: 7, lug: 7, iulii: 7, julii: 7,
  agosto: 8, ago: 8, augusti: 8,
  settembre: 9, sett: 9, set: 9, septembris: 9,
  ottobre: 10, ott: 10, octobris: 10,
  novembre: 11, nov: 11, novembris: 11,
  dicembre: 12, dic: 12, decembris: 12
};

const AV_ROMANI: { [k: string]: number } = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18,
  XIX: 19, XX: 20, XXI: 21
};

/**
 * Il giorno prima / il giorno dopo, in chiave AAAAMMGG.
 *
 * Servono ad `ante` e `post`, e non basta `chiave ± 1`: il giorno prima del 1° maggio
 * sarebbe `…0500`, che non è una data. Come chiave di ordinamento funzionerebbe lo stesso,
 * ed è proprio per questo che l'errore sarebbe sopravvissuto — fino al punto in cui
 * l'intervallo viene mostrato all'utente o confrontato per anno.
 */
function avGiornoPrima(chiave: number): number {
  const anno = Math.floor(chiave / 10000);
  const mese = Math.floor((chiave % 10000) / 100);
  const giorno = chiave % 100;
  if (giorno > 1) return avChiaveData(anno, mese, giorno - 1);
  if (mese > 1) return avChiaveData(anno, mese - 1, avGiorniDelMese(anno, mese - 1));
  return avChiaveData(anno - 1, 12, 31);
}

function avGiornoDopo(chiave: number): number {
  const anno = Math.floor(chiave / 10000);
  const mese = Math.floor((chiave % 10000) / 100);
  const giorno = chiave % 100;
  if (giorno < avGiorniDelMese(anno, mese)) return avChiaveData(anno, mese, giorno + 1);
  if (mese < 12) return avChiaveData(anno, mese + 1, 1);
  return avChiaveData(anno + 1, 1, 1);
}

/** Anno plausibile per un archivio: fuori da qui il numero è una segnatura, non una data. */
const AV_ANNO_MIN = 500;
const AV_ANNO_MAX = 2200;

function avGiorniDelMese(anno: number, mese: number): number {
  if (mese === 2) return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0 ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mese - 1] || 31;
}

/** AAAAMMGG come intero: confrontabile con `<`, ordinabile, e leggibile in un log. */
function avChiaveData(anno: number, mese: number, giorno: number): number {
  return anno * 10000 + mese * 100 + giorno;
}

function avAnnoValido(n: number): boolean {
  return isFinite(n) && n >= AV_ANNO_MIN && n <= AV_ANNO_MAX;
}

function avNormalizza(testo: any): string {
  return String(testo === null || testo === undefined ? '' : testo)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function avVuota(raw: string): AVIntervalloData {
  return { raw, da: null, a: null, qualificatore: 'nessuna', certa: false, riconosciuta: false };
}

/** L'intero anno, dal 1° gennaio al 31 dicembre. */
function avAnnoIntero(anno: number): { da: number; a: number } {
  return { da: avChiaveData(anno, 1, 1), a: avChiaveData(anno, 12, 31) };
}

/**
 * Il secolo N va dall'anno (N-1)*100+1 all'anno N*100: il XIV secolo è 1301-1400.
 * È la convenzione italiana, ed è quella che un archivista si aspetta di leggere.
 * Le partizioni (`in.`, `ex.`, `med.`, prima/seconda metà) sono convenzioni di catalogo:
 * primo/ultimo quarto e metà centrale.
 */
function avSecolo(numero: number, parte: string): { da: number; a: number } | null {
  if (!isFinite(numero) || numero < 5 || numero > 22) return null;
  const primo = (numero - 1) * 100 + 1;
  const ultimo = numero * 100;
  if (parte === 'in') return { da: avChiaveData(primo, 1, 1), a: avChiaveData(primo + 24, 12, 31) };
  if (parte === 'ex') return { da: avChiaveData(ultimo - 24, 1, 1), a: avChiaveData(ultimo, 12, 31) };
  if (parte === 'med') return { da: avChiaveData(primo + 37, 1, 1), a: avChiaveData(primo + 62, 12, 31) };
  if (parte === 'prima') return { da: avChiaveData(primo, 1, 1), a: avChiaveData(primo + 49, 12, 31) };
  if (parte === 'seconda') return { da: avChiaveData(primo + 50, 1, 1), a: avChiaveData(ultimo, 12, 31) };
  return { da: avChiaveData(primo, 1, 1), a: avChiaveData(ultimo, 12, 31) };
}

function avMeseDaNome(nome: string): number {
  if (!nome) return 0;
  const pulito = nome.replace(/\./g, '');
  if (AV_MESI[pulito]) return AV_MESI[pulito];
  // Abbreviazioni non previste: si prova il prefisso più lungo che corrisponde.
  for (const chiave of Object.keys(AV_MESI)) {
    if (pulito.length >= 3 && chiave.indexOf(pulito) === 0) return AV_MESI[chiave];
  }
  return 0;
}

/** Giorno + mese + anno, nelle forme in cui si scrive una data in un regesto. */
function avGiornoMeseAnno(t: string): { anno: number; mese: number; giorno: number } | null {
  // "12 maggio 1340", "12 magg. 1340", "12 di maggio 1340"
  let m = /(\b\d{1,2})\s*(?:di\s+)?([a-z]{3,12}\.?)\s+(\d{3,4})\b/.exec(t);
  if (m) {
    const mese = avMeseDaNome(m[2]);
    if (mese) return { anno: Number(m[3]), mese, giorno: Number(m[1]) };
  }
  // "1340 maggio 12" — l'ordine degli inventari a stampa.
  m = /\b(\d{3,4})\s+([a-z]{3,12}\.?)\s+(\d{1,2})\b/.exec(t);
  if (m) {
    const mese = avMeseDaNome(m[2]);
    if (mese) return { anno: Number(m[1]), mese, giorno: Number(m[3]) };
  }
  // "12/5/1340", "12-05-1340", "12.5.1340"
  m = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{3,4})\b/.exec(t);
  if (m) return { anno: Number(m[3]), mese: Number(m[2]), giorno: Number(m[1]) };
  // "1340-05-12" (ISO)
  m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(t);
  if (m) return { anno: Number(m[1]), mese: Number(m[2]), giorno: Number(m[3]) };
  return null;
}

/** Mese e anno senza giorno: "maggio 1340", "1340 maggio". */
function avMeseAnno(t: string): { anno: number; mese: number } | null {
  let m = /\b([a-z]{3,12}\.?)\s+(\d{3,4})\b/.exec(t);
  if (m) {
    const mese = avMeseDaNome(m[1]);
    if (mese) return { anno: Number(m[2]), mese };
  }
  m = /\b(\d{3,4})\s+([a-z]{3,12}\.?)\b/.exec(t);
  if (m) {
    const mese = avMeseDaNome(m[2]);
    if (mese) return { anno: Number(m[1]), mese };
  }
  return null;
}

/**
 * Interpreta una datazione scritta a mano.
 *
 * Le forme riconosciute sono quelle che si trovano davvero in una schedatura: data piena,
 * solo anno, `c./ca./circa`, `ante/prima del`, `post/dopo il`, intervallo `1340-1345` o
 * `tra il … e il …`, secolo in numeri romani con le sue partizioni, `s.d.`.
 * Tutto il resto **non viene indovinato**: `riconosciuta: false`, e a schermo il campo si
 * comporta come prima. Un intervallo inventato su una datazione che l'app non ha capito
 * sarebbe peggio di nessun intervallo, perché entrerebbe negli ordinamenti come se fosse
 * un dato.
 */
function avAnalizzaData(testo: any): AVIntervalloData {
  const raw = String(testo === null || testo === undefined ? '' : testo);
  const t = avNormalizza(raw);
  if (!t) return avVuota(raw);

  // Senza data dichiarata: è un'informazione, non un vuoto — ma non è nemmeno una data.
  if (/^(s\.?\s?d\.?|senza data|sine data|n\.?\s?d\.?)$/.test(t)) {
    return { raw, da: null, a: null, qualificatore: 'nessuna', certa: false, riconosciuta: true };
  }

  // --- Secolo: "sec. XIV", "XIV secolo", "sec. XIV in.", "prima meta del sec. XIV" -------
  const mSec = /(?:sec\.?|secolo|s\.)\s*([ivxl]+)|(\b[ivxl]+)\s*(?:sec\.?|secolo)/.exec(t);
  if (mSec) {
    const numero = AV_ROMANI[String(mSec[1] || mSec[2]).toUpperCase()];
    let parte = '';
    if (/\bin(?:\.|izio)?\b|inizi/.test(t)) parte = 'in';
    else if (/\bex(?:\.|eunte)?\b|\bfine\b|\bultimi\b/.test(t)) parte = 'ex';
    else if (/\bmed(?:\.|io)?\b|\bmeta\b/.test(t) && !/prima meta|seconda meta/.test(t)) parte = 'med';
    if (/prima meta|1a meta|primi decenni/.test(t)) parte = 'prima';
    if (/seconda meta|2a meta|ultimi decenni/.test(t)) parte = 'seconda';
    const intervallo = avSecolo(numero, parte);
    if (intervallo) {
      return { raw, da: intervallo.da, a: intervallo.a, qualificatore: 'secolo', certa: false, riconosciuta: true };
    }
  }

  // --- Intervallo fra due anni: "1340-1345", "1340/45", "tra il 1340 e il 1345" ----------
  const mFra = /\b(\d{3,4})\s*(?:-|\/|–|—|\s+e\s+il\s+|\s+e\s+|\s+al\s+)\s*(\d{2,4})\b/.exec(t);
  if (mFra && !avGiornoMeseAnno(t)) {
    const a1 = Number(mFra[1]);
    let a2 = Number(mFra[2]);
    // "1340-45": il secondo numero è l'abbreviazione del primo, non l'anno 45.
    if (a2 < 100 && a1 >= 100) a2 = Math.floor(a1 / 100) * 100 + a2;
    if (avAnnoValido(a1) && avAnnoValido(a2) && a2 >= a1) {
      return {
        raw, da: avAnnoIntero(a1).da, a: avAnnoIntero(a2).a,
        qualificatore: 'intervallo', certa: false, riconosciuta: true
      };
    }
  }

  const circa = /\b(c|ca|circ|circa|verso|intorno)\b\.?/.test(t) || /^c\.\s*\d/.test(t);
  const ante = /\b(ante|prima del|prima di|anteriore al?)\b/.test(t);
  const post = /\b(post|dopo il|dopo di|posteriore al?)\b/.test(t);

  // --- Data piena ------------------------------------------------------------------------
  const gma = avGiornoMeseAnno(t);
  if (gma && avAnnoValido(gma.anno) && gma.mese >= 1 && gma.mese <= 12 &&
      gma.giorno >= 1 && gma.giorno <= avGiorniDelMese(gma.anno, gma.mese)) {
    const chiave = avChiaveData(gma.anno, gma.mese, gma.giorno);
    if (ante) return { raw, da: null, a: avGiornoPrima(chiave), qualificatore: 'ante', certa: false, riconosciuta: true };
    if (post) return { raw, da: avGiornoDopo(chiave), a: null, qualificatore: 'post', certa: false, riconosciuta: true };
    return {
      raw, da: chiave, a: chiave,
      qualificatore: circa ? 'circa' : 'esatta', certa: !circa, riconosciuta: true
    };
  }

  // --- Mese e anno -------------------------------------------------------------------------
  const ma = avMeseAnno(t);
  if (ma && avAnnoValido(ma.anno) && ma.mese >= 1 && ma.mese <= 12) {
    const da = avChiaveData(ma.anno, ma.mese, 1);
    const a = avChiaveData(ma.anno, ma.mese, avGiorniDelMese(ma.anno, ma.mese));
    if (ante) return { raw, da: null, a: avGiornoPrima(da), qualificatore: 'ante', certa: false, riconosciuta: true };
    if (post) return { raw, da: avGiornoDopo(a), a: null, qualificatore: 'post', certa: false, riconosciuta: true };
    return { raw, da, a, qualificatore: circa ? 'circa' : 'anno', certa: !circa, riconosciuta: true };
  }

  // --- Solo anno ---------------------------------------------------------------------------
  const mAnno = /\b(\d{3,4})\b/.exec(t);
  if (mAnno) {
    const anno = Number(mAnno[1]);
    if (avAnnoValido(anno)) {
      const intero = avAnnoIntero(anno);
      if (ante) return { raw, da: null, a: avGiornoPrima(intero.da), qualificatore: 'ante', certa: false, riconosciuta: true };
      if (post) return { raw, da: avGiornoDopo(intero.a), a: null, qualificatore: 'post', certa: false, riconosciuta: true };
      return {
        raw, da: intero.da, a: intero.a,
        qualificatore: circa ? 'circa' : 'anno', certa: !circa, riconosciuta: true
      };
    }
  }

  return avVuota(raw);
}

// --- Memoria in RAM -----------------------------------------------------------
//
// L'ordinamento chiama il parser una volta per record a ogni render, e il testo si ripete
// (un fondo ha decine di schede datate "sec. XIV"). La memoria è sul TESTO, non sul record:
// così vale anche fra schede diverse, e non va invalidata quando un record cambia — cambia
// il testo, e con esso la chiave.

const AV_CACHE_DATE = new Map<string, AVIntervalloData>();
const AV_CACHE_MAX = 5000;

function avData(testo: any): AVIntervalloData {
  const chiave = String(testo === null || testo === undefined ? '' : testo);
  const memo = AV_CACHE_DATE.get(chiave);
  if (memo) return memo;
  const esito = avAnalizzaData(chiave);
  // Tetto grossolano: un archivio con più di 5000 datazioni DIVERSE esiste, e la memoria
  // non deve crescere all'infinito in un processo che resta aperto per giorni.
  if (AV_CACHE_DATE.size >= AV_CACHE_MAX) AV_CACHE_DATE.clear();
  AV_CACHE_DATE.set(chiave, esito);
  return esito;
}

/**
 * Chiave di ordinamento cronologico: l'estremo INIZIALE dell'intervallo.
 *
 * `ante 1350` non ha un inizio: si ordina appena prima della sua fine, o finirebbe in testa
 * all'archivio insieme alle datazioni più antiche. `null` per ciò che non è una data: chi
 * ordina lo mette in coda, dove stanno già i campi vuoti.
 */
function avChiaveOrdinamento(testo: any): number | null {
  const d = avData(testo);
  if (!d.riconosciuta) return null;
  if (d.da !== null) return d.da;
  if (d.a !== null) return d.a;
  return null;
}

/**
 * L'intervallo [daAnno, aAnno] tocca la datazione? Estremi inclusivi, anni interi.
 *
 * Basta una **sovrapposizione**, non il contenimento: cercando il Trecento, una scheda
 * datata "1290-1310" va mostrata. Escluderla perché sborda significherebbe nascondere
 * proprio i documenti a cavallo, che sono quelli che si cercano.
 */
function avNelPeriodo(testo: any, daAnno: any, aAnno: any): boolean {
  const d = avData(testo);
  if (!d.riconosciuta || (d.da === null && d.a === null)) return false;
  const da = daAnno === '' || daAnno === null || daAnno === undefined ? null : Number(daAnno);
  const a = aAnno === '' || aAnno === null || aAnno === undefined ? null : Number(aAnno);
  const inizio = d.da !== null ? d.da : -Infinity;
  const fine = d.a !== null ? d.a : Infinity;
  if (da !== null && isFinite(da) && fine < avChiaveData(da, 1, 1)) return false;
  if (a !== null && isFinite(a) && inizio > avChiaveData(a, 12, 31)) return false;
  return true;
}

/** L'anno di un estremo (AAAAMMGG → AAAA), per mostrarlo o per il filtro per secolo. */
function avAnnoDi(chiave: number | null): number | null {
  return chiave === null ? null : Math.floor(chiave / 10000);
}

const ArchiViewData = {
  analizza: avData,
  analizzaSenzaCache: avAnalizzaData,
  chiaveOrdinamento: avChiaveOrdinamento,
  nelPeriodo: avNelPeriodo,
  annoDi: avAnnoDi,
  chiaveData: avChiaveData,
  secolo: avSecolo,
  ANNO_MIN: AV_ANNO_MIN,
  ANNO_MAX: AV_ANNO_MAX
};

const avModuloCjsData = typeof module !== 'undefined' ? module : null;
if (avModuloCjsData && avModuloCjsData.exports) avModuloCjsData.exports = ArchiViewData;
if (typeof window !== 'undefined') (window as any).DataStorica = ArchiViewData;
