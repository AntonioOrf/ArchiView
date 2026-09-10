// Fase 2.4 — Import CSV: analisi del file, proposta di mappatura, costruzione delle schede.
//
// ⚠️ PERCHÉ QUESTO MODULO È CONDIVISO E PURO
//
// L'import ha un dry-run, e un dry-run vale solo se percorre **lo stesso codice**
// dell'import vero: un'anteprima calcolata da una funzione diversa da quella che poi scrive
// non prova niente, e mente proprio nei casi storti — che sono quelli per cui il dry-run
// esiste. Qui c'è una sola funzione, `avCostruisciSchede`, e l'anteprima è letteralmente
// l'elenco delle schede che verranno inserite.
//
// Vive in `src/shared/` per la stessa ragione di `model.ts` e `dataStorica.ts`: il main
// legge il file (I/O), il renderer disegna il wizard e ricalcola l'anteprima a ogni tocco
// della mappatura, senza un giro di IPC per ogni tendina cambiata. Non ha `import`/`export`
// (per TypeScript è uno script) ed espone `module.exports` per il main e `window.CsvImport`
// per il renderer, sotto guardia.
//
// NON contiene i18n: restituisce CODICI (`obbligatorio`, `numero`, `url`, `opzione`,
// `tipo_sconosciuto`, `riga_corta`) e li traduce il renderer. Un modello che restituisse
// frasi in italiano le stamperebbe dentro un'app in inglese (lezione della 2.1).

// --- Analisi del testo --------------------------------------------------------

/** I delimitatori che si tentano, in ordine di frequenza reale nei file di scavo. */
const AV_DELIMITATORI = [',', ';', '\t', '|'];

/**
 * Il delimitatore dichiarato dal preambolo `sep=` (che è ciò che l'export della 2.1 scrive
 * per Excel), oppure `null`. Va letto PRIMA di qualunque euristica: è una dichiarazione
 * esplicita dell'autore del file e batte qualsiasi conteggio.
 */
function avSepDichiarato(testo: string): string | null {
  const m = /^sep=(.)\r?\n/.exec(testo || '');
  return m ? m[1] : null;
}

/**
 * Indovina il delimitatore contando le occorrenze FUORI dalle virgolette sulla prima riga
 * non vuota. Contarle a tappeto sbaglierebbe su un file in cui una cella contiene un elenco
 * ("Rossi, Bianchi, Verdi") e nessun'altra colonna: la virgola vincerebbe pur non separando
 * nulla.
 */
function avIndovinaDelimitatore(testo: string): string {
  const riga = avPrimaRigaLogica(testo);
  let migliore = ',';
  let max = 0;
  for (const d of AV_DELIMITATORI) {
    let n = 0;
    let inVirgolette = false;
    for (let i = 0; i < riga.length; i++) {
      const c = riga[i];
      if (c === '"') { inVirgolette = !inVirgolette; continue; }
      if (!inVirgolette && c === d) n++;
    }
    if (n > max) { max = n; migliore = d; }
  }
  return migliore;
}

/** La prima riga logica (le virgolette possono contenere a capo). */
function avPrimaRigaLogica(testo: string): string {
  let inVirgolette = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (c === '"') inVirgolette = !inVirgolette;
    else if (!inVirgolette && (c === '\n' || c === '\r')) return testo.slice(0, i);
  }
  return testo;
}

/**
 * Indovina QUALE riga contiene le intestazioni.
 *
 * Non è sempre la prima: i fogli veri cominciano con un titolo in una cella sola ("CATASTO
 * DI FIESOLE"), una riga di note o una vuota. Prenderla per intestazione produceva il guasto
 * peggiore possibile — colonne senza nome, la vera riga di intestazione importata come una
 * scheda, e tutte le tendine su "non importare" — senza che nulla lo segnalasse.
 *
 * Il criterio è il numero di celle piene, ma **non** "vince chi ne ha di più": vince la
 * PRIMA riga che ne ha abbastanza (il 60% del massimo). La differenza conta: un'intestazione
 * con una colonna senza nome — che nei fogli veri capita di continuo — ha una cella in meno
 * della prima riga di dati, e col criterio del massimo perderebbe contro di essa, cioè il
 * programma scarterebbe l'intestazione vera per eleggerne una fatta di dati.
 *
 * Resta un'ipotesi, e come tale il wizard la mostra e la lascia cambiare.
 */
function avRigaIntestazioni(righe: any[][], quante?: number): number {
  const limite = Math.min(righe ? righe.length : 0, typeof quante === 'number' ? quante : 10);
  if (limite <= 0) return 0;
  const piene: number[] = [];
  for (let i = 0; i < limite; i++) {
    piene.push((righe[i] || []).filter(c => String(c == null ? '' : c).trim() !== '').length);
  }
  const max = Math.max.apply(null, piene);
  const soglia = Math.max(2, Math.ceil(max * 0.6));
  for (let i = 0; i < limite; i++) if (piene[i] >= soglia) return i;
  return piene.indexOf(max);
}

/**
 * Parser RFC4180, scritto a mano perché una dipendenza per trecento righe di stato non si
 * giustifica — ed è la stessa scelta del serializzatore della 2.1.
 *
 * Regge: virgolette doppie raddoppiate, a capo dentro la cella, CRLF e LF mescolati, BOM,
 * preambolo `sep=`, riga finale senza terminatore.
 *
 * Restituisce anche `tutte` (le righe utili, intestazione compresa) e `rigaIntestazioni`:
 * servono al wizard per proporre un'altra riga di intestazione senza rileggere il file.
 */
function avAnalizzaCsv(testo: string, opzioni?: any): any {
  const o = opzioni || {};
  let t = String(testo == null ? '' : testo);
  const avvisi: string[] = [];

  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);           // BOM UTF-8 (lo scrive la 2.1)
  const dichiarato = avSepDichiarato(t);
  if (dichiarato) t = t.replace(/^sep=.\r?\n/, '');

  const delimitatore = o.delimitatore || dichiarato || avIndovinaDelimitatore(t);

  const righe: string[][] = [];
  let cella = '';
  let riga: string[] = [];
  let inVirgolette = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inVirgolette) {
      if (c === '"') {
        if (t[i + 1] === '"') { cella += '"'; i++; }
        else inVirgolette = false;
      } else cella += c;
      continue;
    }
    if (c === '"' && cella === '') { inVirgolette = true; continue; }
    if (c === delimitatore) { riga.push(cella); cella = ''; continue; }
    if (c === '\r') { if (t[i + 1] === '\n') i++; riga.push(cella); righe.push(riga); riga = []; cella = ''; continue; }
    if (c === '\n') { riga.push(cella); righe.push(riga); riga = []; cella = ''; continue; }
    cella += c;
  }
  // L'ultima riga entra solo se qualcosa c'era: un file che finisce con a capo non deve
  // produrre una riga vuota in coda, che il wizard mostrerebbe come una scheda da importare.
  if (cella !== '' || riga.length > 0) { riga.push(cella); righe.push(riga); }
  if (inVirgolette) avvisi.push('virgolette_aperte');

  // Righe interamente vuote: capitano in coda ai file salvati da Excel e non sono dati.
  const utili = righe.filter(r => r.some(c => String(c).trim() !== ''));

  const iIntestazioni = typeof o.rigaIntestazioni === 'number' && o.rigaIntestazioni >= 0
    ? Math.min(o.rigaIntestazioni, Math.max(0, utili.length - 1))
    : avRigaIntestazioni(utili);

  // Le colonne sono tante quante ne ha la riga PIÙ LARGA, non quante ne ha l'intestazione:
  // un foglio con una colonna in più solo su qualche riga perderebbe quel dato in silenzio.
  const larghezza = utili.reduce((m, r) => Math.max(m, r.length), 0);
  const grezze = utili[iIntestazioni] || [];
  const intestazioni: string[] = [];
  for (let i = 0; i < larghezza; i++) {
    const pulita = String(grezze[i] == null ? '' : grezze[i]).trim();
    // Un'intestazione vuota resta una colonna (le celle sotto esistono), ma va chiamata in
    // qualche modo o nel wizard comparirebbero tendine senza nome, indistinguibili fra loro.
    intestazioni.push(pulita || 'Colonna ' + (i + 1));
  }

  return {
    delimitatore,
    intestazioni,
    righe: utili.slice(iIntestazioni + 1),
    tutte: utili,
    rigaIntestazioni: iIntestazioni,
    avvisi
  };
}

// --- Proposta di mappatura ----------------------------------------------------

function _ciModel(): any {
  if (typeof window !== 'undefined' && (window as any).Model) return (window as any).Model;
  if (typeof module !== 'undefined' && typeof require === 'function') return require('./model');
  return null;
}

/** Normalizzazione delle intestazioni: la stessa dei tag e dei nomi d'anagrafica (3.4/3.5). */
function avChiaveIntestazione(t: any): string {
  const M = _ciModel();
  if (M && typeof M.chiaveTesto === 'function') return M.chiaveTesto(t);
  return String(t == null ? '' : t).trim().toLowerCase();
}

/**
 * I nomi con cui le colonne di base compaiono nei fogli veri. Non è una comodità: senza,
 * la mappatura andrebbe rifatta a mano per ogni file, e un wizard che propone sempre "non
 * importare" è un wizard che non ha proposto niente.
 *
 * Le chiavi sono già normalizzate (`avChiaveIntestazione`), quindi accenti e maiuscole non
 * contano e non vanno ripetuti.
 */
const AV_SINONIMI_COLONNE: { [k: string]: string } = {
  'segnatura': 'segnatura', 'collocazione': 'segnatura', 'shelfmark': 'segnatura',
  'signature': 'segnatura', 'sigla': 'segnatura', 'codice': 'segnatura', 'id archivistico': 'segnatura',
  'archivio': 'cartella', 'cartella': 'cartella', 'fondo': 'cartella', 'folder': 'cartella',
  'serie': 'cartella', 'busta': 'cartella',
  'tag': 'tags', 'tags': 'tags', 'parole chiave': 'tags', 'keywords': 'tags', 'etichette': 'tags',
  'tipo documento': 'tipoDocumento', 'tipo': 'tipoDocumento', 'modello': 'tipoDocumento',
  'tipologia': 'tipoDocumento', 'type': 'tipoDocumento',
  'trascrizione': 'trascrizione', 'transcription': 'trascrizione', 'testo': 'trascrizione',
  'id': 'id', 'identificativo': 'id', 'uuid': 'id'
};

/**
 * Propone una chiave per ogni intestazione, o `''` (= non importare).
 *
 * Tre passaggi in ordine di certezza: corrispondenza esatta con l'etichetta di una colonna
 * offerta, corrispondenza esatta con la sua chiave interna, sinonimo noto. Nessuna
 * corrispondenza "somigliante": una mappatura sbagliata proposta con sicurezza è peggio di
 * una tendina lasciata vuota, perché nessuno la ricontrolla.
 *
 * Una colonna già presa non viene riproposta: due intestazioni sulla stessa destinazione
 * significherebbero che la seconda sovrascrive la prima senza dirlo.
 */
function avProponiMappatura(intestazioni: string[], colonne: any[]): string[] {
  const perEtichetta: { [k: string]: string } = {};
  const perChiave: { [k: string]: string } = {};
  for (const c of colonne || []) {
    if (!c || !c.chiave) continue;
    if (c.etichetta) perEtichetta[avChiaveIntestazione(c.etichetta)] = c.chiave;
    perChiave[avChiaveIntestazione(c.chiave)] = c.chiave;
  }

  const usate = new Set<string>();
  return (intestazioni || []).map(h => {
    const k = avChiaveIntestazione(h);
    const scelta = perEtichetta[k] || perChiave[k] || AV_SINONIMI_COLONNE[k] || '';
    if (!scelta || usate.has(scelta)) return '';
    // Un sinonimo vale solo se quella destinazione è davvero fra le colonne offerte.
    if (!perChiave[avChiaveIntestazione(scelta)] && !perEtichetta[k]) {
      const esiste = (colonne || []).some(c => c && c.chiave === scelta);
      if (!esiste) return '';
    }
    usate.add(scelta);
    return scelta;
  });
}

// --- Conversione delle celle --------------------------------------------------

/**
 * Toglie l'apostrofo anti-formula che l'export della 2.1 antepone alle celle che iniziano
 * per `=` `+` `@` `-`, perché Excel altrimenti le eseguirebbe. È un carattere che appartiene
 * al FILE, non al dato: lasciarlo dentro significherebbe che esportare e reimportare un
 * archivio ne cambia le segnature — un apostrofo in più a ogni giro.
 *
 * Il riconoscimento è esattamente l'inverso di `neutralizzaFormula` (`main/ipc/csvExport.ts`):
 * la coppia va tenuta d'accordo, ed è per questo che la regola è scritta in tutte e due i
 * posti nella stessa forma.
 */
function avRipulisciCella(grezzo: any): string {
  const t = grezzo === null || grezzo === undefined ? '' : String(grezzo);
  if (t.length > 1 && t[0] === "'") {
    const c = t[1];
    if (c === '=' || c === '+' || c === '@' || c === '\t' || c === '\r') return t.slice(1);
    if (c === '-' && !/^-\d/.test(t.slice(1))) return t.slice(1);
  }
  return t;
}

/** Le grafie con cui un sì si scrive in un foglio di calcolo, in italiano e in inglese. */
const AV_VERI = ['si', 'sì', 'true', 'vero', 'x', '1', 'yes', 'y', 's'];
const AV_FALSI = ['no', 'false', 'falso', '0', 'n', ''];

/**
 * Converte una cella di testo nel tipo dichiarato dal campo.
 *
 * ⚠️ Non chiama direttamente `Model.normalizzaValore` per i booleani: quello è il contratto
 * del FORM, dove il valore arriva da una casella di spunta (`true`/`on`), e un "Sì" scritto
 * a mano in Excel ci finirebbe dentro come `false` — cioè un dato ribaltato, in silenzio.
 * Qui la conversione è quella del foglio di calcolo, e ciò che non si riconosce diventa un
 * problema dichiarato, mai un valore inventato.
 */
function avConvertiCella(def: any, grezzo: any): { valore: any; problema: string | null } {
  const M = _ciModel();
  const tipo = def && def.tipo ? def.tipo : 'text';
  const testo = avRipulisciCella(grezzo).trim();

  if (tipo === 'boolean') {
    const k = testo.toLowerCase();
    if (AV_VERI.indexOf(k) !== -1) return { valore: true, problema: null };
    if (AV_FALSI.indexOf(k) !== -1) return { valore: false, problema: null };
    return { valore: false, problema: 'booleano' };
  }

  if (tipo === 'dynamic_list') {
    // "Notaio: Rossi; Teste: Bianchi" — la forma in cui la 2.1 esporta le liste dinamiche.
    // Il viaggio di andata e ritorno deve chiudersi: un CSV esportato e reimportato deve
    // dare le stesse schede, o l'export non è un formato ma un vicolo cieco.
    if (!testo) return { valore: [], problema: null };
    const voci = testo.split(';').map(p => p.trim()).filter(Boolean).map(p => {
      const i = p.indexOf(':');
      if (i === -1) return { k: '', v: p };
      return { k: p.slice(0, i).trim(), v: p.slice(i + 1).trim() };
    });
    return { valore: voci, problema: null };
  }

  if (tipo === 'number') {
    if (!testo) return { valore: '', problema: null };
    const valore = M ? M.normalizzaValore(def, testo) : Number(testo.replace(',', '.'));
    if (typeof valore !== 'number' || !isFinite(valore)) return { valore: testo, problema: 'numero' };
    return { valore, problema: null };
  }

  if (tipo === 'url') {
    if (!testo) return { valore: '', problema: null };
    // Un dominio nudo ("www.archivio.it") è un URL a cui manca solo il protocollo: si
    // completa invece di scartarlo, perché è così che lo si incolla da un foglio.
    const completo = /^(https?:\/\/|mailto:)/i.test(testo) ? testo
      : (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(testo) ? 'https://' + testo : testo);
    if (!/^(https?:\/\/|mailto:)/i.test(completo)) return { valore: testo, problema: 'url' };
    return { valore: completo, problema: null };
  }

  if (tipo === 'enum') {
    if (!testo) return { valore: '', problema: null };
    const opzioni = (def && def.opzioni) || [];
    // Il confronto è normalizzato: "pergamena" e "Pergamena" sono lo stesso valore, e
    // rifiutare il secondo perché scritto in minuscolo sarebbe pedanteria, non controllo.
    const trovata = opzioni.find((o: any) => avChiaveIntestazione(o) === avChiaveIntestazione(testo));
    if (trovata) return { valore: trovata, problema: null };
    return { valore: testo, problema: 'opzione' };
  }

  return { valore: testo, problema: null };
}

// --- Costruzione delle schede -------------------------------------------------

const AV_BASE_IMPORT = ['segnatura', 'cartella', 'tags', 'tipoDocumento', 'trascrizione', 'id'];

/**
 * Costruisce le schede da importare e il verdetto riga per riga.
 *
 * `contesto`:
 * - `tipiDocumento`   l'elenco dei tipi dell'archivio;
 * - `campiBase`       il catalogo dei campi base del renderer (`CONFIG_CAMPI`), per i tipi
 *                     dei campi predefiniti; nel main può mancare, e tutto ricade su testo;
 * - `db`              il database, per i vocabolari legati agli `enum` (3.3);
 * - `tipoPredefinito` l'id del tipo per le righe che non ne dichiarano uno;
 * - `cartella`        la destinazione per le righe senza colonna archivio;
 * - `esistenti`       le schede già in archivio, per riconoscere i doppioni;
 * - `aggiorna`        se vero, una riga che corrisponde a una scheda esistente la AGGIORNA
 *                     invece di aggiungerne una seconda.
 *
 * ⚠️ Gli `id` in ingresso NON diventano mai l'id di una scheda nuova. Servono solo a
 * ritrovare una scheda esistente quando si aggiorna: riusarli significherebbe che
 * reimportare due volte lo stesso file sovrascrive schede a caso in un archivio in cui quegli
 * id, nel frattempo, appartengono a qualcos'altro (è la stessa regola dell'import ZIP, che
 * rigenera l'id in caso di collisione).
 */
function avCostruisciSchede(righe: any[][], mappatura: string[], contesto?: any): any {
  const M = _ciModel();
  const ctx = contesto || {};
  const tipi = ctx.tipiDocumento || [];
  const esistenti = ctx.esistenti || [];
  const tipoPredefinito = ctx.tipoPredefinito || (M ? M.TIPO_PREDEFINITO : 'imbreviature');

  const perId = new Map<string, any>();
  const perSegnatura = new Map<string, any>();
  for (const m of esistenti) {
    perId.set(String(m.id), m);
    const k = avChiaveIntestazione(m.segnatura);
    if (k && !perSegnatura.has(k)) perSegnatura.set(k, m);
  }

  const tipoPerChiave = new Map<string, string>();
  for (const t of tipi) {
    tipoPerChiave.set(avChiaveIntestazione(t.id), t.id);
    if (t.nome) tipoPerChiave.set(avChiaveIntestazione(t.nome), t.id);
  }

  // Le definizioni dei campi si calcolano una volta per tipo: su un file di duemila righe
  // ricavarle a ogni cella significherebbe risolvere duemila volte gli stessi vocabolari.
  const defsCache = new Map<string, any>();
  // Gli id che appartengono al TIPO: tutto ciò che è mappato e non sta qui dentro (né fra le
  // chiavi di servizio, né fra i campi che il wizard sta per aggiungere al modello) è un
  // campo PROPRIO della scheda importata — Fase 3.7. Senza questa distinzione una colonna
  // riconosciuta ma non prevista dal modello entrerebbe nel record come chiave orfana:
  // presente nel file salvato, invisibile in ogni schermata dell'app.
  const idsDelTipo = new Map<string, Set<string>>();
  const idsExtraWizard = new Set<string>((ctx.campiExtra || []).map((d: any) => d && d.id).filter(Boolean));
  const metaChiavi = new Set<string>(M ? M.CHIAVI_SERVIZIO : []);
  const defsDi = (tipoId: string) => {
    if (!defsCache.has(tipoId)) {
      const tipo = tipi.find((t: any) => t.id === tipoId);
      const lista = M ? M.campiDelTipo(tipo, ctx.campiBase || {}, ctx.db) : [];
      const mappa: any = {};
      for (const d of lista) mappa[d.id] = d;
      idsDelTipo.set(tipoId, new Set(lista.map((d: any) => d.id)));
      // I campi inventati nel wizard (`campiExtra`) valgono come gli altri PRIMA di
      // esistere davvero: il tipo li riceve solo alla conferma, ma l'anteprima deve già
      // convertire i valori con il tipo dichiarato, o mostrerebbe come testo ciò che poi
      // entrerà come numero — cioè un'anteprima di qualcosa che non verrà importato.
      for (const d of ctx.campiExtra || []) if (d && d.id) mappa[d.id] = d;
      defsCache.set(tipoId, mappa);
    }
    return defsCache.get(tipoId);
  };

  const schede: any[] = [];
  const esiti: any[] = [];
  const cartelleNuove = new Set<string>();
  // Le segnature viste in QUESTO file: due righe con la stessa segnatura sono un doppione
  // interno al foglio, che nessun controllo sull'archivio esistente intercetterebbe.
  const segnatureFile = new Set<string>();

  for (let r = 0; r < righe.length; r++) {
    const riga = righe[r] || [];
    const problemi: any[] = [];
    const grezzo: any = {};

    for (let c = 0; c < mappatura.length; c++) {
      const chiave = mappatura[c];
      if (!chiave) continue;
      grezzo[chiave] = riga[c] === undefined ? '' : riga[c];
    }
    if (riga.length < mappatura.filter(Boolean).length) problemi.push({ campo: '', codice: 'riga_corta' });

    // 1. Il tipo, che decide come si convertono tutte le altre celle.
    let tipoId = tipoPredefinito;
    if (grezzo.tipoDocumento !== undefined && String(grezzo.tipoDocumento).trim() !== '') {
      const risolto = tipoPerChiave.get(avChiaveIntestazione(grezzo.tipoDocumento));
      if (risolto) tipoId = risolto;
      else problemi.push({ campo: 'tipoDocumento', codice: 'tipo_sconosciuto', valore: String(grezzo.tipoDocumento) });
    }
    const defs = defsDi(tipoId);

    // 2. I campi.
    const dati: any = { tipoDocumento: tipoId };
    for (const chiave of Object.keys(grezzo)) {
      if (chiave === 'tipoDocumento' || chiave === 'id') continue;
      if (chiave === 'segnatura' || chiave === 'trascrizione') {
        dati[chiave] = avRipulisciCella(grezzo[chiave]).trim();
        continue;
      }
      if (chiave === 'cartella') {
        // I separatori di Windows non sono percorsi d'archivio: `appData.cartelle` usa `/`.
        const percorso = String(grezzo[chiave] || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        dati.cartella = percorso;
        continue;
      }
      if (chiave === 'tags') {
        dati.tags = M ? M.unisciTag(avRipulisciCella(grezzo[chiave]).replace(/;/g, ',')) : avRipulisciCella(grezzo[chiave]);
        continue;
      }
      const def = defs[chiave] || { id: chiave, tipo: 'text' };
      const esito = avConvertiCella(def, grezzo[chiave]);
      if (esito.problema) problemi.push({ campo: chiave, codice: esito.problema, valore: String(grezzo[chiave] || '') });
      dati[chiave] = esito.valore;
    }
    if (dati.cartella === undefined) dati.cartella = ctx.cartella || '';

    // Fase 3.7 — le colonne che il modello non prevede diventano campi propri della scheda.
    // È ciò che rende reimportabile un CSV appena esportato: senza, quelle colonne si
    // potrebbero mappare e i loro valori entrerebbero nel record senza che niente li mostri.
    const propriRiga: any[] = [];
    const delTipo = idsDelTipo.get(tipoId) || new Set<string>();
    for (const k of Object.keys(dati)) {
      if (k === 'tipoDocumento' || metaChiavi.has(k) || delTipo.has(k) || idsExtraWizard.has(k)) continue;
      const d = defs[k];
      propriRiga.push({ id: k, tipo: (d && d.tipo) || 'text', label: (d && d.label) || k });
    }

    // 3. Gli obbligatori del tipo: la riga che non li ha NON entra a metà. Una scheda
    // importata incompleta non la riguarda più nessuno, mentre uno scarto sta in un elenco.
    for (const id of Object.keys(defs)) {
      const def = defs[id];
      if (!def.obbligatorio) continue;
      const codice = M ? M.validaValore(def, dati[id]) : null;
      if (codice) problemi.push({ campo: id, codice, valore: String(dati[id] == null ? '' : dati[id]) });
    }

    const bloccanti = problemi.filter(p => p.codice === 'obbligatorio');
    if (bloccanti.length) {
      esiti.push({ riga: r, stato: 'scartata', problemi, segnatura: dati.segnatura || '' });
      continue;
    }

    // 4. Doppioni: per id se la colonna è mappata, altrimenti per segnatura.
    const idIn = grezzo.id !== undefined ? String(grezzo.id).trim() : '';
    const chiaveSegn = avChiaveIntestazione(dati.segnatura);
    const gemella = (idIn && perId.get(idIn)) || (chiaveSegn ? perSegnatura.get(chiaveSegn) : null);

    if (gemella && ctx.aggiorna) {
      // L'aggiornamento è un PATCH: le colonne assenti dal file non azzerano ciò che c'è
      // nella scheda. Un CSV con tre colonne non deve poter svuotare venti campi.
      const patch: any = { id: gemella.id };
      for (const k of Object.keys(dati)) {
        if (k === 'tipoDocumento' && !grezzo.tipoDocumento) continue;
        if (k === 'cartella' && grezzo.cartella === undefined) continue;
        patch[k] = dati[k];
      }
      // Anche i campi propri si UNISCONO invece di sostituirsi: un file con una colonna in
      // più non deve cancellare i campi che quella scheda già portava.
      if (propriRiga.length && M) {
        const uniti = M.unisciCampiPropri(M.campiPropri(gemella), propriRiga);
        if (uniti.length) patch.campiPropri = uniti;
      }
      schede.push(patch);
      if (patch.cartella) cartelleNuove.add(patch.cartella);
      esiti.push({ riga: r, stato: 'aggiornata', problemi, segnatura: dati.segnatura || '', id: gemella.id });
      continue;
    }

    if (gemella) problemi.push({ campo: 'segnatura', codice: 'doppione', valore: dati.segnatura || '' });
    else if (chiaveSegn && segnatureFile.has(chiaveSegn)) problemi.push({ campo: 'segnatura', codice: 'doppione_file', valore: dati.segnatura || '' });
    if (chiaveSegn) segnatureFile.add(chiaveSegn);

    // `creaScheda` è l'unico posto in cui si decide la forma di un record (3.0): costruirla
    // qui a mano significherebbe che l'import è l'unica porta da cui entrano schede fatte
    // in un altro modo.
    const scheda = M ? M.creaScheda(dati) : Object.assign({ id: 'tmp-' + r }, dati);
    if (M && propriRiga.length) M.scriviCampiPropri(scheda, propriRiga, tipi.find((t: any) => t.id === tipoId));
    if (ctx.autore) { scheda.creatoDa = ctx.autore; scheda.modificatoDa = ctx.autore; }
    schede.push(scheda);
    if (scheda.cartella) cartelleNuove.add(scheda.cartella);
    esiti.push({ riga: r, stato: 'nuova', problemi, segnatura: dati.segnatura || '', id: scheda.id });
  }

  return {
    schede,
    esiti,
    cartelleNuove: Array.from(cartelleNuove),
    riepilogo: {
      nuove: esiti.filter(e => e.stato === 'nuova').length,
      aggiornate: esiti.filter(e => e.stato === 'aggiornata').length,
      scartate: esiti.filter(e => e.stato === 'scartata').length,
      conAvvisi: esiti.filter(e => e.stato !== 'scartata' && e.problemi.length > 0).length
    }
  };
}

/**
 * Le colonne offerte dal wizard: quelle di base più l'unione dei campi di TUTTI i tipi.
 *
 * Non solo quelli del tipo scelto: un CSV esportato da ArchiView contiene i campi di più
 * tipi (l'export unisce, vedi `costruisciColonne` nella 2.1), e offrire i soli campi di un
 * tipo renderebbe non reimportabile ciò che l'app stessa ha appena scritto.
 */
function avColonneImportabili(tipiDocumento: any[], etichette?: any, campiExtra?: any[], campiPropri?: any[]): any[] {
  const et = etichette || {};
  const M = _ciModel();
  const meta = new Set(M ? M.CHIAVI_SERVIZIO : []);
  const colonne: any[] = AV_BASE_IMPORT.map(k => ({ chiave: k, etichetta: et[k] || k, base: true }));
  const visti = new Set(AV_BASE_IMPORT);
  for (const t of tipiDocumento || []) {
    for (const c of (t && t.campi) || []) {
      if (visti.has(c) || meta.has(c)) continue;
      visti.add(c);
      colonne.push({ chiave: c, etichetta: et[c] || c, base: false });
    }
  }
  // Fase 3.7 — i campi PROPRI già usati in archivio: esistono, quindi non sono "nuovi", ma
  // non appartengono a nessun modello. Offrirli è ciò che rende reimportabile un CSV appena
  // esportato da ArchiView, che è la stessa ragione per cui le colonne dei tipi si uniscono.
  for (const d of campiPropri || []) {
    if (!d || !d.id || visti.has(d.id) || meta.has(d.id)) continue;
    visti.add(d.id);
    colonne.push({ chiave: d.id, etichetta: d.label || et[d.id] || d.id, base: false });
  }
  // I campi inventati nel wizard: in fondo e marcati, perché non esistono ancora
  // nell'archivio e l'utente deve poterli distinguere da quelli che c'erano già.
  for (const d of campiExtra || []) {
    if (!d || !d.id || visti.has(d.id)) continue;
    visti.add(d.id);
    colonne.push({ chiave: d.id, etichetta: d.label || d.id, base: false, nuovo: true });
  }
  return colonne;
}

/**
 * Un id di campo valido a partire da un nome scritto dall'utente.
 *
 * ⚠️ NON è `chiaveTesto`: l'id di un campo è anche una chiave del record e un'intestazione di
 * colonna nell'export, quindi deve restare leggibile ("Numero di carta", non "numerodicarta").
 * Si ripulisce soltanto ciò che romperebbe: i separatori e gli spazi ai bordi.
 *
 * Restituisce `''` se non resta niente di utilizzabile, oppure se il nome collide con una
 * chiave di servizio — `id`, `tags`, `cartella` e compagnia non sono campi del tipo, e un
 * campo che si chiamasse così sovrascriverebbe un pezzo della scheda.
 */
function avIdCampoNuovo(nome: any, colonneEsistenti?: any[]): string {
  const M = _ciModel();
  const pulito = String(nome == null ? '' : nome).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!pulito) return '';
  const meta = new Set(M ? M.CHIAVI_SERVIZIO : []);
  if (meta.has(pulito) || AV_BASE_IMPORT.indexOf(pulito) !== -1) return '';
  for (const c of colonneEsistenti || []) {
    if (c && avChiaveIntestazione(c.chiave) === avChiaveIntestazione(pulito)) return '';
  }
  return pulito;
}

const ArchiViewCsvImport = {
  DELIMITATORI: AV_DELIMITATORI,
  SINONIMI_COLONNE: AV_SINONIMI_COLONNE,
  BASE_IMPORT: AV_BASE_IMPORT,
  analizzaCsv: avAnalizzaCsv,
  rigaIntestazioni: avRigaIntestazioni,
  idCampoNuovo: avIdCampoNuovo,
  indovinaDelimitatore: avIndovinaDelimitatore,
  proponiMappatura: avProponiMappatura,
  convertiCella: avConvertiCella,
  ripulisciCella: avRipulisciCella,
  costruisciSchede: avCostruisciSchede,
  colonneImportabili: avColonneImportabili,
  chiaveIntestazione: avChiaveIntestazione
};

const avModuloCjsCsv = typeof module !== 'undefined' ? module : null;
if (avModuloCjsCsv && avModuloCjsCsv.exports) avModuloCjsCsv.exports = ArchiViewCsvImport;
if (typeof window !== 'undefined') (window as any).CsvImport = ArchiViewCsvImport;
