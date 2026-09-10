// Fase 3.0 — Schema del dato, versione e catena di migrazioni.
//
// PRIMO file condiviso fra main e renderer, e la ragione per cui esiste `src/shared/`: la
// forma del record era finora decisa in tre posti diversi (`handleFormSubmit` la
// costruiva, `state.ts` la correggeva all'apertura, `databaseIpc.ts` ne validava due
// chiavi), quindi non esisteva **una** risposta alla domanda "com'è fatta una scheda".
// Qui c'è quella risposta, e ogni cambiamento di modello passa da una migrazione numerata
// invece che da una riga aggiunta a `initData`.
//
// ⚠️ COME VIENE CARICATO. Il file non ha `import`/`export`: per TypeScript è uno *script*,
// non un modulo, ed è deliberato — il renderer concatena script classici in un unico scope
// (`scripts/build-renderer-bundle.js`) e non sa che cosa sia `require`. In coda c'è quindi
// una doppia esposizione: `module.exports` per il main (CommonJS) e `window.Model` per il
// renderer, ciascuna sotto la sua guardia. Il file arriva in `out/renderer/js/shared/`
// tramite `scripts/copy-shared.js` e va caricato **prima** di `state.js`.
//
// ⚠️ Tutti i nomi globali di questo file sono prefissati `AV`/`ARCHIVIEW`: essendo uno
// script, le sue dichiarazioni stanno nello scope globale sia di TypeScript sia del bundle.

// --- Tipi --------------------------------------------------------------------
//
// Sono i tipi del dato *come sta su disco oggi*, non come vorremmo che fosse: `tags` è una
// stringa CSV e i campi dinamici sono spalmati sulla radice del record. Descriverli
// fedelmente è il presupposto per cambiarli (3.1, 3.4) sapendo che cosa si rompe.

type AVAllegato = {
  nome: string;
  tipo: 'pdf' | 'immagine' | string;
  originalName?: string;
  hash?: string;
  /** Trascrizione della singola carta (Fase 2.3-bis). */
  trascrizione?: string;
};

type AVScheda = {
  id: string;
  cartella: string;
  tipoDocumento: string;
  segnatura?: string;
  /**
   * ⚠️ Stringa CSV anche dopo la 3.4, e per scelta: vedi la sezione "Tag come entità".
   * Non leggerla mai a mano — `avTagsDi`/`avScriviTags` sono gli unici due punti d'accesso.
   */
  tags?: string;
  allegati?: AVAllegato[];
  /** Derivati dal primo allegato, conservati per le schede antecedenti agli allegati multipli. */
  allegato?: string;
  allegatoTipo?: string;
  /** Forma derivata: concatenazione delle carte, ricalcolata a ogni salvataggio (2.3-bis). */
  trascrizione?: string;
  lastModified?: number;
  creatoDa?: string;
  modificatoDa?: string;
  /** Rimandi ad altre schede (Fase 3.5). Assente quando non ce ne sono, mai `[]`. */
  relazioni?: AVRelazione[];
  /**
   * Fase 3.7 — i campi che esistono su QUESTA scheda e non sul suo tipo documento: il
   * modello e' una base, non una gabbia. Assente quando non ce ne sono, mai `[]`, per la
   * stessa ragione di `relazioni` (una chiave in piu' cambia l'impronta del record).
   *
   * ⚠️ I VALORI restano flat sulla radice come ogni altro campo — qui ci sono solo le
   * definizioni. Annidarli renderebbe inutile la rete di sicurezza sulle chiavi non
   * previste in export e stampa, e li toglierebbe da ricerca, ordinamento e sostituzione.
   */
  campiPropri?: AVCampoDef[];
  /**
   * Fase 3.8 — l'ordine in cui i campi vanno mostrati SU QUESTA SCHEDA. Elenco di id, anche
   * parziale: ciò che non compare resta nell'ordine naturale, in coda.
   *
   * ⚠️ Vale per il form, la vista a schede e la stampa per scheda — cioè ovunque si guardi
   * UNA scheda. La tabella e il CSV hanno colonne comuni a tutte le schede e non possono
   * seguirlo: l'ordine di un record non può riordinare una colonna condivisa.
   * Assente quando coincide con l'ordine naturale, mai un elenco che ripete il già noto.
   */
  ordineCampi?: string[];
  /** I campi del tipo documento vivono FLAT sulla radice (dataCronica, autore, …). */
  [campo: string]: any;
};

/**
 * Definizione di un campo (Fase 3.1). `label` e `placeholder` sono FACOLTATIVI e servono
 * solo ai campi inventati dall'utente: per quelli base il testo visibile viene dalla i18n
 * del renderer, che il main non conosce e non deve conoscere.
 */
type AVCampoDef = {
  id: string;
  tipo: string;
  label?: string;
  placeholder?: string;
  obbligatorio?: boolean;
  /** Solo per `enum`: i valori ammessi, nell'ordine in cui vanno mostrati. */
  opzioni?: string[];
  /**
   * Solo per `enum` (Fase 3.3): id del vocabolario d'archivio da cui prendere i valori.
   * Quando c'è, `opzioni` NON viene scritto sul tipo — verrebbe duplicato in ogni tipo che
   * usa quel vocabolario e la prima aggiunta di un valore li farebbe divergere.
   */
  vocabolario?: string;
  /**
   * Fase 3.5: il campo alimenta l'anagrafica di persone (`'persona'`) o luoghi (`'luogo'`).
   * Su una `dynamic_list` il nome è il VALORE della coppia, non la chiave (che è il ruolo).
   */
  authority?: string;
  /** Solo avviso, mai blocco: vedi `avValidaValore`. */
  unico?: boolean;
};

type AVTipoDocumento = {
  id: string;
  nome: string;
  /**
   * Gli id dei campi, **sempre stringhe** (Fase 3.1).
   *
   * ⚠️ Le definizioni tipizzate stanno in `campiDef` e NON dentro questo array. Un oggetto
   * qui dentro manderebbe in errore ogni versione dell'app precedente alla 3.1, che fa
   * `campoId.replace(...)` per costruire l'id del controllo: su un archivio condiviso
   * basterebbe un campo numerico creato da un collega aggiornato per rompere il form
   * dell'altro. Con la mappa separata, chi non la conosce vede semplicemente dei campi di
   * testo — è la stessa scelta di `m.trascrizione` nella 2.3-bis.
   * In lettura un oggetto qui viene comunque accettato e spostato in `campiDef` (migrazione
   * v2): un file scritto da un altro strumento non deve poter diventare illeggibile.
   */
  campi: string[];
  /** id del campo → definizione. Presente solo per i campi che non sono `text` semplice. */
  campiDef?: { [id: string]: AVCampoDef };
};

type AVDatabase = {
  schemaVersion?: number;
  cartelle: string[];
  manoscritti: AVScheda[];
  tipiDocumento: AVTipoDocumento[];
  deletedIds?: string[];
  deletedCartelle?: string[];
  /** Snapshot dell'ultimo stato sincronizzato, per il merge a tre vie. */
  baseObjects?: { [id: string]: AVScheda };
  /** Anagrafica dei tag (Fase 3.4): chiave normalizzata → grafia scelta e colore. */
  tagsAnagrafica?: { [chiave: string]: AVVoceTag };
  /** Vocabolari controllati d'archivio (Fase 3.3): id → lista di valori ammessi. */
  vocabolari?: { [id: string]: AVVocabolario };
  /** Anagrafica di persone e luoghi (Fase 3.5): `tipo:chiave` → grafia scelta e note. */
  authority?: { [chiave: string]: AVAuthority };
  trascrizioneEditorWidth?: string;
  [altro: string]: any;
};

type AVEsitoMigrazione = {
  db: AVDatabase;
  /** Descrizioni delle migrazioni davvero applicate: vuoto = nessuna scrittura necessaria. */
  applicate: string[];
  /** Il file viene da una versione PIÙ NUOVA dell'applicazione: non è stato toccato. */
  futuro: boolean;
};

// --- Costanti condivise -------------------------------------------------------

/**
 * Versione dello schema scritta nel database.
 *
 * 1 — prima versione esplicita. Formalizza due migrazioni che vivevano implicite in
 *     `initData` (`state.ts`): il database "array piatto" delle primissime versioni e il
 *     tipo documento `manoscritto`, rimosso a favore dei modelli.
 * 2 — campi tipizzati (Fase 3.1): i tipi documento possono portare `campiDef`. Nessun dato
 *     esistente cambia forma — un archivio alla v1 è già valido alla v2 — ma la versione
 *     dice a chi legge che dentro `campi` potrebbero esserci definizioni da normalizzare.
 * 3 — tag come entità (Fase 3.4): compare `tagsAnagrafica`. I RECORD NON SI TOCCANO — `tags`
 *     resta la stessa stringa CSV — proprio perché la migrazione non deve cambiare
 *     l'impronta di una sola scheda: `getRecordHash` copre tutte le chiavi tranne tre, e
 *     normalizzare i CSV qui farebbe apparire l'intero archivio come "modificato" al primo
 *     sync di ogni collega. La normalizzazione avviene alla prima scrittura di quella scheda.
 * 4 — vocabolari controllati (3.3), relazioni e authority record (3.5). Compaiono tre chiavi
 *     di primo livello — `vocabolari`, `authority` — e una chiave facoltativa sul record,
 *     `relazioni`. Anche qui NESSUN record viene toccato: i vocabolari nascono con i valori
 *     predefiniti e non vengono legati a nessun campo, perché legarli trasformerebbe campi
 *     di testo libero in tendine e farebbe risultare "non previsto" ogni valore già scritto.
 */
const ARCHIVIEW_SCHEMA_VERSION = 4;

/**
 * Chiavi di servizio del record: tutto ciò che NON è un campo del tipo documento. Era
 * duplicata in `csvExport.ts`, `printTemplate.ts` e `transcriptExport.ts` — tre elenchi che
 * dovevano restare uguali senza che nulla lo garantisse, e il primo a divergere avrebbe
 * fatto comparire `lastModified` come colonna in uno solo dei tre export.
 */
const AV_CHIAVI_SERVIZIO = [
  'id', 'segnatura', 'tags', 'cartella', 'tipoDocumento', 'allegati', 'allegato',
  'allegatoTipo', 'lastModified', 'modificatoDa', 'creatoDa', 'trascrizione', 'schemaVersion',
  // Fase 3.5: i rimandi fra schede sono di servizio, non un campo del tipo documento — non
  // devono diventare una colonna del CSV né una riga della stampa.
  'relazioni',
  // Fase 3.7: `campiPropri` porta le DEFINIZIONI dei campi propri della scheda; i loro
  // valori sono chiavi normali del record. Senza questa riga l'elenco delle definizioni
  // diventerebbe esso stesso una colonna del CSV e una riga della stampa.
  'campiPropri',
  // Fase 3.8: `ordineCampi` è un elenco di id, non un dato della scheda.
  'ordineCampi'
];

/** Tipo documento assegnato alle schede che non ne hanno uno valido. */
const AV_TIPO_PREDEFINITO = 'imbreviature';

// --- Tipi di campo (Fase 3.1) -------------------------------------------------
//
// `text`, `textarea`, `dynamic_list` e `attachments` esistevano già come `type` in
// CONFIG_CAMPI (renderer) ma non erano scrivibili dall'utente: ogni campo inventato
// ricadeva in `text`. Gli altri sono nuovi.
//
// ⚠️ `date` qui è ancora una STRINGA libera: la data storica fuzzy — `c. 1340`,
// `ante 1350`, `sec. XIV in.` — con parser, intervallo e ordinamento cronologico è la 3.2.
// Il tipo esiste già perché è ciò che permetterà alla 3.2 di trovare i campi da convertire
// senza chiedere all'utente di ridichiararli uno per uno.

const AV_TIPI_CAMPO = ['text', 'textarea', 'number', 'boolean', 'enum', 'url', 'date', 'dynamic_list', 'attachments'];

/** I tipi che l'utente può assegnare a un campo suo. `attachments` è di sistema. */
const AV_TIPI_CAMPO_SCEGLIBILI = ['text', 'textarea', 'number', 'boolean', 'enum', 'url', 'date', 'dynamic_list'];

function avTipoCampoValido(tipo: any): boolean {
  return typeof tipo === 'string' && AV_TIPI_CAMPO.indexOf(tipo) !== -1;
}

/**
 * La definizione di UN campo del tipo documento, sempre completa.
 *
 * `baseConf` è il catalogo dei campi predefiniti del renderer (`CONFIG_CAMPI`): il modello
 * non lo incorpora perché contiene le etichette, cioè i18n, che nel main non esiste. Chi
 * chiama lo passa se ce l'ha; il main non ne ha bisogno perché per formattare un valore gli
 * basta il valore.
 */
function avDefinizioneCampo(tipo: any, campoId: any, baseConf?: any, db?: any): AVCampoDef {
  const id = String(campoId && campoId.id ? campoId.id : campoId || '');
  const dichiarata = (tipo && tipo.campiDef && tipo.campiDef[id]) ||
    (campoId && typeof campoId === 'object' ? campoId : null);
  const base = (baseConf && baseConf[id]) || null;

  const def: AVCampoDef = {
    id,
    tipo: dichiarata && avTipoCampoValido(dichiarata.tipo) ? dichiarata.tipo
      : (base && avTipoCampoValido(base.type) ? base.type : 'text')
  };
  if (dichiarata) {
    if (dichiarata.label) def.label = String(dichiarata.label);
    if (dichiarata.placeholder) def.placeholder = String(dichiarata.placeholder);
    if (dichiarata.obbligatorio) def.obbligatorio = true;
    if (dichiarata.unico) def.unico = true;
    if (Array.isArray(dichiarata.opzioni)) {
      def.opzioni = dichiarata.opzioni.map((o: any) => String(o)).filter((o: string) => o !== '');
    }
    if (dichiarata.vocabolario) def.vocabolario = String(dichiarata.vocabolario);
    if (dichiarata.authority) def.authority = String(dichiarata.authority);
  }
  // Fase 3.5: i campi BASE dichiarano la loro semantica d'anagrafica nel catalogo del
  // renderer (`attori_dinamici` sono persone, `dataTopica` è un luogo), come già fanno per
  // il tipo di dato. Ripeterla qui vorrebbe dire due elenchi da tenere allineati.
  if (!def.authority && base && base.authority) def.authority = String(base.authority);
  if (def.authority && AV_TIPI_AUTHORITY.indexOf(def.authority) === -1) delete def.authority;

  // Fase 3.3: i valori del vocabolario si risolvono IN LETTURA, mai copiandoli nel tipo.
  if (def.vocabolario) {
    const dalVocabolario = avValoriVocabolario(db, def.vocabolario);
    if (dalVocabolario.length) def.opzioni = dalVocabolario;
  }
  // Un enum senza valori non è un enum: sarebbe una tendina vuota, cioè un campo che non si
  // può compilare. Ricade su testo, che è sempre compilabile.
  // ⚠️ Un enum LEGATO A UN VOCABOLARIO è l'eccezione: qui il `db` può mancare (il main non
  // ce l'ha, e `avImpostaCampi` chiama senza), e degradarlo a testo cancellerebbe il legame
  // ogni volta che il tipo viene riscritto.
  if (def.tipo === 'enum' && !def.vocabolario && (!def.opzioni || def.opzioni.length === 0)) def.tipo = 'text';
  return def;
}

/** Tutti i campi del tipo, nell'ordine dichiarato, sempre come definizioni complete. */
function avCampiDelTipo(tipo: any, baseConf?: any, db?: any): AVCampoDef[] {
  const campi = (tipo && Array.isArray(tipo.campi)) ? tipo.campi : [];
  return campi.map((c: any) => avDefinizioneCampo(tipo, c, baseConf, db));
}

/**
 * Fase 3.7 — tutti i campi di UNA scheda: quelli del suo tipo documento, nell'ordine
 * dichiarato, seguiti da quelli propri della scheda.
 *
 * ⚠️ È l'UNICO modo di sapere quali campi ha una scheda: form, tabella, ricerca, filtri,
 * export, stampa e import passano tutti di qui. Il giorno in cui metà dei chiamanti legge
 * ancora `campiDelTipo`, i campi propri spariscono a rotazione da una vista sola — senza
 * che niente fallisca, che è il modo peggiore di perdere un dato.
 *
 * ⚠️ **Il tipo vince**: se un campo proprio viene poi aggiunto al modello (promosso qui o
 * da un collega), la definizione buona è quella del tipo e il doppione non compare due
 * volte. La ripulitura di `campiPropri` avviene alla prima riscrittura della scheda
 * (`avScriviCampiPropri`), mai in migrazione: una migrazione non tocca i record.
 */
function avCampiDellaScheda(scheda: any, tipo: any, baseConf?: any, db?: any): AVCampoDef[] {
  const definizioni = avCampiDelTipo(tipo, baseConf, db);
  const propri = avCampiPropri(scheda);
  if (propri.length) {
    const visti = new Set(definizioni.map(d => d.id));
    for (const grezza of propri) {
      const def = avDefinizioneCampo(null, grezza, baseConf, db);
      if (!def.id || visti.has(def.id)) continue;
      visti.add(def.id);
      definizioni.push(def);
    }
  }
  // Fase 3.8 — l'ordine scelto su QUESTA scheda, se ce n'è uno.
  return avOrdinaDefinizioni(definizioni, scheda && scheda.ordineCampi);
}

/**
 * Fase 3.8 — le definizioni riordinate secondo un elenco di id.
 *
 * L'elenco è un DESIDERIO, non un contratto: gli id che non esistono (più) si ignorano e i
 * campi che non compaiono restano nell'ordine naturale, in coda. È ciò che permette a un
 * ordine salvato di sopravvivere a un modello che cambia — un campo aggiunto al tipo dopo il
 * riordino compare comunque, invece di sparire perché nessuno lo aveva elencato.
 */
function avOrdinaDefinizioni(definizioni: AVCampoDef[], ordine: any): AVCampoDef[] {
  if (!Array.isArray(ordine) || !ordine.length) return definizioni;
  const perId = new Map<string, AVCampoDef>();
  for (const d of definizioni) perId.set(d.id, d);
  const fuori: AVCampoDef[] = [];
  const presi = new Set<string>();
  for (const grezzo of ordine) {
    const id = String(grezzo == null ? '' : grezzo);
    if (!perId.has(id) || presi.has(id)) continue;
    presi.add(id);
    fuori.push(perId.get(id) as AVCampoDef);
  }
  for (const d of definizioni) if (!presi.has(d.id)) fuori.push(d);
  return fuori;
}

/** L'ordine dichiarato dalla scheda, ripulito: solo stringhe, senza doppioni. */
function avOrdineCampi(scheda: any): string[] {
  const grezzi = scheda && Array.isArray(scheda.ordineCampi) ? scheda.ordineCampi : [];
  const fuori: string[] = [];
  const visti = new Set<string>();
  for (const g of grezzi) {
    const id = String(g == null ? '' : g).trim();
    if (!id || visti.has(id)) continue;
    visti.add(id);
    fuori.push(id);
  }
  return fuori;
}

/**
 * Scrive l'ordine sulla scheda, ma **solo se si discosta da quello naturale**.
 *
 * ⚠️ Un elenco che ripete l'ordine già noto è rumore in ogni diff e in ogni sincronizzazione,
 * ed è per giunta una chiave in più nell'impronta del record (`getRecordHash`): salvarlo
 * farebbe risultare modificata a ogni collega una scheda che nessuno ha riordinato. Stessa
 * regola di `campiDef` (3.1) e di `campiPropri` (3.7).
 *
 * `naturali` sono gli id nell'ordine in cui verrebbero senza riordino (tipo + campi propri).
 */
function avScriviOrdineCampi(scheda: any, ordine: any, naturali?: any[]): any {
  if (!scheda) return scheda;
  const puliti = avOrdineCampi({ ordineCampi: ordine });
  const attesi = (naturali || []).map((x: any) => String(x && x.id ? x.id : x));
  // Solo gli id che esistono davvero: un ordine che nomina campi scomparsi è un elenco che
  // cresce a ogni cambio di modello e non riordina niente.
  const filtrati = attesi.length ? puliti.filter(id => attesi.indexOf(id) !== -1) : puliti;
  const naturale = attesi.length && filtrati.length === attesi.length &&
    filtrati.every((id, i) => id === attesi[i]);
  if (filtrati.length && !naturale) scheda.ordineCampi = filtrati;
  else delete scheda.ordineCampi;
  return scheda;
}

/** Le definizioni proprie della scheda, sempre un array (mai `null`), mai voci senza id. */
function avCampiPropri(scheda: any): AVCampoDef[] {
  const grezzi = scheda && Array.isArray(scheda.campiPropri) ? scheda.campiPropri : [];
  const fuori: AVCampoDef[] = [];
  const visti = new Set<string>();
  for (const g of grezzi) {
    if (!g || typeof g !== 'object' || !g.id) continue;
    const def = avDefinizioneCampo(null, g);
    if (!def.id || visti.has(def.id)) continue;
    // `label` è obbligatoria sui campi propri: per un campo inventato qui non esiste una
    // i18n `field_<id>`, e senza etichetta la colonna del CSV porterebbe l'id grezzo.
    if (!def.label) def.label = def.id;
    visti.add(def.id);
    fuori.push(def);
  }
  return fuori;
}

/**
 * Scrive le definizioni proprie sulla scheda nella forma su disco.
 *
 * ⚠️ La chiave SPARISCE quando non resta niente: un `[]` su ogni scheda mai toccata ne
 * cambierebbe l'impronta (`getRecordHash`) e farebbe risultare modificato a ogni collega
 * un archivio che nessuno ha aperto. Stessa regola di `relazioni` (3.5).
 *
 * ⚠️ Ciò che il TIPO già dichiara viene tolto: è la ripulitura del campo promosso al
 * modello, e avviene qui — cioè alla prima riscrittura della scheda — perché una
 * migrazione non può toccare i record.
 */
function avScriviCampiPropri(scheda: any, definizioni: any[], tipo?: any): any {
  if (!scheda) return scheda;
  const delTipo = new Set(((tipo && Array.isArray(tipo.campi)) ? tipo.campi : []).map((c: any) => String(c && c.id ? c.id : c)));
  const puliti = avCampiPropri({ campiPropri: definizioni }).filter(d => !delTipo.has(d.id));
  if (puliti.length) scheda.campiPropri = puliti;
  else delete scheda.campiPropri;
  return scheda;
}

/**
 * Fase 3.7 — l'unione di due elenchi di campi propri, per il merge a tre vie e per la
 * promozione al modello. `primo` vince sui doppioni.
 */
function avUnisciCampiPropri(primo: any, secondo: any): AVCampoDef[] {
  const fuori = avCampiPropri({ campiPropri: primo });
  const visti = new Set(fuori.map(d => d.id));
  for (const d of avCampiPropri({ campiPropri: secondo })) {
    if (visti.has(d.id)) continue;
    visti.add(d.id);
    fuori.push(d);
  }
  return fuori;
}

/**
 * Scrive le definizioni sul tipo nella forma su disco: `campi` resta un elenco di stringhe,
 * `campiDef` porta SOLO ciò che si discosta dal testo semplice. Una mappa che ripete
 * `{tipo:'text'}` per ogni campo sarebbe rumore in ogni diff e in ogni sincronizzazione.
 */
function avImpostaCampi(tipo: any, definizioni: any[]): AVTipoDocumento {
  const campi: string[] = [];
  const mappa: { [id: string]: AVCampoDef } = {};
  for (const grezza of definizioni || []) {
    const def = avDefinizioneCampo(null, grezza);
    if (!def.id || campi.indexOf(def.id) !== -1) continue;
    campi.push(def.id);
    // Il vocabolario sostituisce le opzioni sul disco: tenerle entrambe significherebbe una
    // copia della lista per ogni tipo, e la prima aggiunta di un valore le farebbe divergere.
    if (def.vocabolario) delete def.opzioni;
    const serve = def.tipo !== 'text' || def.obbligatorio || def.unico || def.opzioni ||
      def.label || def.vocabolario || def.authority;
    if (serve) mappa[def.id] = def;
  }
  tipo.campi = campi;
  if (Object.keys(mappa).length) tipo.campiDef = mappa;
  else delete tipo.campiDef;
  return tipo as AVTipoDocumento;
}

/**
 * Il valore come va SCRITTO nel record: numero per `number`, booleano per `boolean`,
 * stringa per tutto il resto.
 *
 * ⚠️ Un campo numerico vuoto diventa `''` e non `0`: zero è un dato, "non compilato" no, e
 * un archivio in cui ogni campo mai riempito vale zero è un archivio che mente sui totali.
 */
function avNormalizzaValore(def: any, grezzo: any): any {
  const tipo = def && def.tipo ? def.tipo : 'text';
  if (tipo === 'boolean') return grezzo === true || grezzo === 'true' || grezzo === 'on' || grezzo === 1;
  if (tipo === 'number') {
    if (grezzo === '' || grezzo === null || grezzo === undefined) return '';
    // La virgola decimale è ciò che si batte su una tastiera italiana.
    const n = typeof grezzo === 'number' ? grezzo : Number(String(grezzo).replace(',', '.').trim());
    return isFinite(n) ? n : String(grezzo);
  }
  if (tipo === 'dynamic_list' || tipo === 'attachments') return grezzo;
  return grezzo === null || grezzo === undefined ? '' : String(grezzo);
}

/**
 * Verifica il valore rispetto alla definizione.
 *
 * Restituisce un CODICE (`obbligatorio`, `numero`, `url`, `opzione`) e non un messaggio: la
 * i18n vive nel renderer, e un modello che restituisse frasi in italiano le stamperebbe
 * dentro un'app in inglese (lezione della 2.1).
 *
 * ⚠️ `unico` NON è qui: non è una proprietà del valore ma dell'archivio, e soprattutto non
 * blocca. Un fondo reale contiene segnature ripetute per errori di inventariazione
 * antecedenti alla schedatura, e un'applicazione che rifiuta di registrarle costringe a
 * falsificarle. Il duplicato si segnala (vedi `avDuplicatiCampo`) e si salva lo stesso.
 */
function avValidaValore(def: any, valore: any): string | null {
  const tipo = def && def.tipo ? def.tipo : 'text';
  const vuoto = valore === '' || valore === null || valore === undefined ||
    (Array.isArray(valore) && valore.length === 0);
  if (def && def.obbligatorio && tipo !== 'boolean' && vuoto) return 'obbligatorio';
  if (vuoto) return null;
  if (tipo === 'number' && typeof valore !== 'number') return 'numero';
  if (tipo === 'url' && !/^(https?:\/\/|mailto:)/i.test(String(valore))) return 'url';
  if (tipo === 'enum' && def.opzioni && def.opzioni.indexOf(String(valore)) === -1) return 'opzione';
  return null;
}

// --- Modelli predefiniti ------------------------------------------------------
//
// I tre modelli con cui l'applicazione nasce. Erano scritti in TRE posti — il valore
// iniziale di `appData`, l'elenco `predefiniti` di `initData` e `MODELLI_PREDEFINITI` del
// modale dei tipi — e le tre copie dovevano restare uguali senza che nulla lo garantisse:
// aggiungere un campo a un modello e dimenticarne una significava che il tipo creato dal
// modale aveva campi diversi dal tipo che l'app installa da sola, con lo stesso nome.
//
// ⚠️ I `campi` sono id di campi BASE: etichette, segnaposto e tipo di dato vengono dal
// catalogo del renderer (`CONFIG_CAMPI`), che è anche l'unico posto che conosce la i18n.
// Un `campiDef` qui servirebbe solo a un modello predefinito che volesse un tipo diverso da
// quello del campo base — oggi non succede, e se succedesse sarebbe il segnale che quel
// campo va tipizzato nel catalogo, non nel singolo modello.
const AV_MODELLI_PREDEFINITI = [
  {
    id: 'imbreviature',
    nome: 'Imbreviature Notarili',
    campi: ['Marginalia', 'Notaio', 'dataCronica', 'dataTopica', 'attori_dinamici', 'tipo_di_atto', 'oggetto', 'elementi_economici']
  },
  {
    id: 'atti',
    nome: 'Atti Giudiziari',
    campi: ['dataCronica', 'magistratura', 'attori_dinamici', 'tipo_di_atto_giur', 'motivazione_processo', 'condanne', 'note']
  },
  {
    id: 'fiscali',
    nome: 'Documenti Fiscali',
    campi: ['dataCronica', 'dichiarante', 'beni_dinamici', 'debiti_dinamici', 'crediti_dinamici', 'famiglia_dinamici', 'note']
  }
];

/** Il modello predefinito con quell'id, o `null`. */
function avModelloPredefinito(id: any): any {
  for (const m of AV_MODELLI_PREDEFINITI) if (m.id === id) return m;
  return null;
}

/**
 * Rimette i modelli predefiniti nel database e ne riallinea i campi.
 *
 * ⚠️ I campi dei predefiniti sono **imposti**, non fusi: l'utente non può modificarli dal
 * modale (sono marcati "non modificabile"), quindi una differenza rispetto a questo elenco
 * è sempre un archivio scritto da una versione precedente, mai una scelta da rispettare.
 * ⚠️ Il `nome` invece NON si sovrascrive: è l'unica cosa che di quei tipi si vede tradotta
 * (`model_<id>` nella i18n del renderer), e riscriverlo in italiano dentro un'app in inglese
 * sarebbe una regressione visibile a ogni avvio.
 *
 * @returns true se ha cambiato qualcosa (serve a `initData` per decidere se salvare).
 */
function avApplicaModelliPredefiniti(db: any): boolean {
  if (!db) return false;
  if (!Array.isArray(db.tipiDocumento)) { db.tipiDocumento = []; }
  let cambiato = false;

  // `manoscritto` non è un tipo: era il valore di ripiego di ogni scheda prima dei modelli.
  const senzaManoscritto = db.tipiDocumento.filter((t: any) => t && t.id !== 'manoscritto');
  if (senzaManoscritto.length !== db.tipiDocumento.length) { db.tipiDocumento = senzaManoscritto; cambiato = true; }

  for (let i = AV_MODELLI_PREDEFINITI.length - 1; i >= 0; i--) {
    const pref = AV_MODELLI_PREDEFINITI[i];
    const esistente = db.tipiDocumento.find((t: any) => t && t.id === pref.id);
    if (!esistente) {
      // In testa: i modelli dell'applicazione precedono quelli inventati dall'utente, e
      // l'ordine della tendina è l'ordine di questo elenco.
      db.tipiDocumento.unshift({ id: pref.id, nome: pref.nome, campi: pref.campi.slice() });
      cambiato = true;
      continue;
    }
    // ⚠️ UNIONE, NON SOSTITUZIONE.
    //
    // Qui c'era `esistente.campi = pref.campi.slice()`, cioè: qualunque differenza dal
    // modello dell'applicazione veniva cancellata al primo avvio. Reggeva su una premessa —
    // "i campi dei predefiniti non sono modificabili dall'utente, quindi una differenza è
    // sempre un archivio scritto da una versione precedente" — che ha smesso di essere vera
    // quando il wizard di import (2.4) ha permesso di inventare un campo e agganciarlo al
    // modello scelto. Il risultato era il peggior guasto possibile: il campo spariva alla
    // riapertura successiva, i valori restavano nei record come chiavi orfane invisibili, e
    // nulla lo segnalava.
    //
    // La regola nuova tiene entrambe le esigenze: i campi del modello ci sono SEMPRE (un
    // aggiornamento che ne aggiunge uno lo installa ancora, e uno tolto per errore torna) e
    // i campi aggiunti dall'utente SOPRAVVIVONO, in coda e nel loro ordine. `campiDef` non
    // si tocca: è lì che vivono i tipi dei campi aggiunti.
    const attuali = Array.isArray(esistente.campi)
      ? esistente.campi.filter((c: any) => typeof c === 'string')
      : [];
    const aggiunti = attuali.filter((c: string) => pref.campi.indexOf(c) === -1);
    const voluti = pref.campi.concat(aggiunti);
    if (JSON.stringify(esistente.campi) !== JSON.stringify(voluti)) {
      esistente.campi = voluti;
      cambiato = true;
    }
  }
  return cambiato;
}

/** Gli id delle altre schede che hanno lo stesso valore in un campo dichiarato `unico`. */
function avDuplicatiCampo(records: any[], campoId: string, valore: any, escludiId?: string): string[] {
  if (valore === '' || valore === null || valore === undefined) return [];
  const atteso = String(valore).trim().toLowerCase();
  const fuori: string[] = [];
  for (const m of records || []) {
    if (!m || String(m.id) === String(escludiId)) continue;
    const v = m[campoId];
    if (v === '' || v === null || v === undefined) continue;
    if (String(v).trim().toLowerCase() === atteso) fuori.push(String(m.id));
  }
  return fuori;
}

// --- Utilità ------------------------------------------------------------------

function avEArray(v: any): boolean {
  return Array.isArray(v);
}

/** La versione dichiarata dal file. Assente = 0, cioè "prima che lo schema esistesse". */
function avVersioneDi(db: any): number {
  const v = db && db.schemaVersion;
  return typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/**
 * Validazione del database, unica per main e renderer.
 *
 * Restituisce il MOTIVO (stringa) o `null` se è valido: un booleano costringerebbe il
 * chiamante a inventarsi il messaggio d'errore, ed è così che nascono due diagnosi diverse
 * per lo stesso file corrotto.
 */
function avMotivoNonValido(db: any): string | null {
  if (!db || typeof db !== 'object' || Array.isArray(db)) return 'Il database non è un oggetto';
  if (!avEArray(db.manoscritti)) return 'Manca la collezione "manoscritti"';
  if (!avEArray(db.cartelle)) return 'Manca la collezione "cartelle"';
  if (db.tipiDocumento !== undefined && !avEArray(db.tipiDocumento)) return '"tipiDocumento" non è un elenco';
  if (db.strutturaCampi !== undefined && !avEArray(db.strutturaCampi)) return '"strutturaCampi" non è un elenco';
  if (db.deletedIds !== undefined && !avEArray(db.deletedIds)) return '"deletedIds" non è un elenco';
  return null;
}

function avDatabaseValido(db: any): boolean {
  return avMotivoNonValido(db) === null;
}

// --- Tag come entità (Fase 3.4) ----------------------------------------------
//
// ⚠️ FORMA SU DISCO: `tags` resta una **stringa CSV**. La roadmap chiedeva l'array, ma il
// record viaggia intero nella sincronizzazione: su un archivio Hub condiviso con chi non ha
// ancora aggiornato, `m.tags.split(',')` su un array è un TypeError — `split` non esiste
// sugli array — e la griglia e la sidebar del collega smettono di renderizzare. È la stessa
// scelta di `campiDef` (3.1) e di `m.trascrizione` (2.3-bis): la struttura nuova si aggiunge,
// il campo vecchio resta leggibile da tutti.
//
// Ciò che la 3.4 cambia davvero non è il serializzatore ma il fatto che **nessun consumatore
// spezza più la stringa da sé**: si passa da `avTagsDi`/`avScriviTags`, e ogni confronto
// avviene per CHIAVE normalizzata. Prima il filtro faceva `includes()` sull'intera stringa
// CSV, quindi il tag `not` selezionava anche le schede con `notaio`; ora no.
//
// L'anagrafica (`db.tagsAnagrafica`) è una chiave di PRIMO LIVELLO, non del record: non
// entra in `getRecordHash`, quindi assegnare un colore non fa apparire mezzo archivio come
// "modificato" al prossimo sync. Rinomina e fusione invece toccano i record e sono a tutti
// gli effetti una modifica dell'utente: firmano `lastModified`/`modificatoDa`, al contrario
// delle migrazioni.

type AVVoceTag = {
  /** Il nome come va MOSTRATO: è la grafia scelta dall'utente, la chiave è derivata. */
  nome: string;
  /** Uno dei valori di `AV_COLORI_TAG`, oppure assente = colore neutro. */
  colore?: string;
  /** Ultima modifica della voce: serve al merge dell'anagrafica (last-write-wins). */
  modificato?: number;
};

/**
 * La palette. Sono NOMI, non valori CSS: il colore vero lo decide il tema del renderer, che
 * ha chiaro e scuro. Salvare `#fde68a` qui significherebbe un archivio con tag illeggibili
 * in tema scuro, e per giunta impossibili da ritematizzare senza riscrivere il database.
 */
const AV_COLORI_TAG = ['ambra', 'rosso', 'verde', 'blu', 'viola', 'grigio'];

/**
 * La chiave di confronto: minuscole, accenti tolti, apostrofi unificati, spazi ridotti a uno.
 * Stessa normalizzazione di `normalizzaTesto` (renderer) più il collasso degli spazi, perché
 * `sec. XIV` e `sec.  XIV` sono la stessa cosa battuta due volte.
 *
 * ⚠️ È UNA SOLA per tag (3.4), valori di vocabolario (3.3) e authority record (3.5). Con due
 * normalizzazioni diverse "Perùgia" sarebbe un solo tag ma due luoghi, e i conteggi delle
 * due anagrafiche direbbero cose diverse sullo stesso archivio.
 */
function avChiaveTesto(t: any): string {
  return String(t === null || t === undefined ? '' : t)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼʹ′]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Alias storico: i tag hanno chiamato `chiaveTag` prima che la chiave diventasse comune. */
function avChiaveTag(t: any): string {
  return avChiaveTesto(t);
}

/**
 * Da qualunque forma — CSV, array, `null` — all'elenco dei tag: ripuliti, senza vuoti e
 * senza duplicati per chiave. Il primo vince, perché è la grafia già scritta nel record.
 * Accetta anche l'array perché un file scritto da un altro strumento (o da una versione
 * futura) non deve diventare illeggibile: si legge largo, si scrive stretto.
 */
function avListaTag(v: any): string[] {
  const grezzi: any[] = Array.isArray(v)
    ? v
    : String(v === null || v === undefined ? '' : v).split(',');
  const out: string[] = [];
  const viste: { [k: string]: boolean } = {};
  for (const g of grezzi) {
    const nome = String(g === null || g === undefined ? '' : g).replace(/\s+/g, ' ').trim();
    const chiave = avChiaveTag(nome);
    if (!chiave || viste[chiave]) continue;
    viste[chiave] = true;
    out.push(nome);
  }
  return out;
}

/** I tag di una scheda. UNICO punto di lettura: nessun `split` sparso per i consumatori. */
function avTagsDi(m: any): string[] {
  return avListaTag(m ? m.tags : '');
}

/** La forma su disco. Lo spazio dopo la virgola è quello che l'utente ha sempre visto. */
function avUnisciTag(lista: any): string {
  return avListaTag(lista).join(', ');
}

/** UNICO punto di scrittura. @returns true se il record è davvero cambiato. */
function avScriviTags(m: any, lista: any): boolean {
  if (!m) return false;
  const nuovo = avUnisciTag(lista);
  if (m.tags === nuovo) return false;
  m.tags = nuovo;
  return true;
}

/** Corrispondenza ESATTA per chiave: `not` non deve trovare `notaio`. */
function avHaTag(m: any, tag: any): boolean {
  const chiave = avChiaveTag(tag);
  if (!chiave) return false;
  for (const t of avTagsDi(m)) if (avChiaveTag(t) === chiave) return true;
  return false;
}

/** L'anagrafica in sola lettura: non la crea, così leggere non sporca il database. */
function avAnagraficaTag(db: any): { [chiave: string]: AVVoceTag } {
  return (db && db.tagsAnagrafica && typeof db.tagsAnagrafica === 'object') ? db.tagsAnagrafica : {};
}

function avVoceTag(db: any, tag: any): AVVoceTag | null {
  const chiave = avChiaveTag(tag);
  const voce = chiave ? avAnagraficaTag(db)[chiave] : null;
  return voce && typeof voce === 'object' ? voce : null;
}

/** Il colore di un tag, `''` se non ne ha uno. */
function avColoreTag(db: any, tag: any): string {
  const voce = avVoceTag(db, tag);
  const c = voce && voce.colore;
  return typeof c === 'string' && AV_COLORI_TAG.indexOf(c) !== -1 ? c : '';
}

function avImpostaColoreTag(db: any, tag: any, colore: any): boolean {
  const chiave = avChiaveTag(tag);
  if (!db || !chiave) return false;
  if (!db.tagsAnagrafica || typeof db.tagsAnagrafica !== 'object') db.tagsAnagrafica = {};
  const voce: AVVoceTag = db.tagsAnagrafica[chiave] || { nome: String(tag).trim() };
  const valido = typeof colore === 'string' && AV_COLORI_TAG.indexOf(colore) !== -1 ? colore : '';
  if ((voce.colore || '') === valido && db.tagsAnagrafica[chiave]) return false;
  if (valido) voce.colore = valido; else delete voce.colore;
  voce.modificato = Date.now();
  db.tagsAnagrafica[chiave] = voce;
  return true;
}

/**
 * Registra dei tag nell'anagrafica senza toccare quelli già presenti.
 * @returns true se ha aggiunto almeno una voce.
 */
function avRegistraTag(db: any, nomi: any): boolean {
  if (!db) return false;
  let cambiato = false;
  for (const nome of avListaTag(nomi)) {
    const chiave = avChiaveTag(nome);
    if (avAnagraficaTag(db)[chiave]) continue;
    if (!db.tagsAnagrafica || typeof db.tagsAnagrafica !== 'object') db.tagsAnagrafica = {};
    db.tagsAnagrafica[chiave] = { nome };
    cambiato = true;
  }
  return cambiato;
}

/**
 * I tag realmente in uso, con quante schede li portano, in ordine alfabetico.
 *
 * Il `nome` mostrato è quello dell'anagrafica se c'è, altrimenti la prima grafia
 * incontrata: senza anagrafica, `Pergamena` e `pergamena` sono lo stesso tag e la sidebar
 * deve mostrarne UNO — prima li fondeva forzando il minuscolo, e i nomi propri ci
 * rimettevano (`Notai di Perugia` diventava `notai di perugia`).
 */
function avConteggiTag(records: any[], db?: any): { chiave: string; nome: string; conteggio: number }[] {
  const mappa: { [k: string]: { chiave: string; nome: string; conteggio: number } } = {};
  const ana = avAnagraficaTag(db);
  for (const m of records || []) {
    for (const t of avTagsDi(m)) {
      const chiave = avChiaveTag(t);
      if (!mappa[chiave]) {
        const voce = ana[chiave];
        mappa[chiave] = { chiave, nome: (voce && voce.nome) || t, conteggio: 0 };
      }
      mappa[chiave].conteggio++;
    }
  }
  return Object.keys(mappa)
    .map(k => mappa[k])
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }));
}

/**
 * Rinomina un tag su TUTTE le schede e nell'anagrafica.
 *
 * La fusione non è un caso a parte: rinominare `notaio` in `notai` su una scheda che ha già
 * `notai` produce un duplicato che `avListaTag` scarta da solo. Un ramo `fondi` separato
 * sarebbe una seconda implementazione della stessa deduplicazione.
 *
 * `opzioni.autore` firma i record toccati: è una modifica dell'utente e deve propagarsi al
 * sync come tale. Le migrazioni, che modifiche dell'utente non sono, non firmano nulla.
 */
function avRinominaTag(db: any, da: any, a: any, opzioni?: any): { schede: number; cambiato: boolean } {
  const vecchia = avChiaveTag(da);
  const nuovoNome = String(a === null || a === undefined ? '' : a).replace(/\s+/g, ' ').trim();
  const nuova = avChiaveTag(nuovoNome);
  if (!db || !vecchia || !nuova) return { schede: 0, cambiato: false };

  const opts = opzioni || {};
  const quando = typeof opts.quando === 'number' ? opts.quando : Date.now();
  let schede = 0;

  for (const m of db.manoscritti || []) {
    const attuali = avTagsDi(m);
    let tocca = false;
    const nuovi = attuali.map(t => {
      if (avChiaveTag(t) !== vecchia) return t;
      tocca = true;
      return nuovoNome;
    });
    if (!tocca) continue;
    if (!avScriviTags(m, nuovi)) continue;
    m.lastModified = quando;
    if (opts.autore) m.modificatoDa = opts.autore;
    schede++;
  }

  // L'anagrafica segue anche quando nessuna scheda usa il tag: un tag creato, colorato e
  // non ancora applicato resta comunque rinominabile.
  const ana = avAnagraficaTag(db);
  let anagraficaCambiata = false;
  if (vecchia !== nuova) {
    const vecchiaVoce = ana[vecchia];
    if (vecchiaVoce) {
      const esistente = ana[nuova];
      const fusa: AVVoceTag = esistente
        ? { nome: esistente.nome, colore: esistente.colore || vecchiaVoce.colore }
        : { nome: nuovoNome, colore: vecchiaVoce.colore };
      if (!fusa.colore) delete fusa.colore;
      fusa.modificato = quando;
      delete db.tagsAnagrafica[vecchia];
      db.tagsAnagrafica[nuova] = fusa;
      anagraficaCambiata = true;
    }
  } else if (ana[nuova] && ana[nuova].nome !== nuovoNome) {
    // Stessa chiave, grafia diversa: è un cambio di maiuscole o di accenti, e va scritto.
    db.tagsAnagrafica[nuova].nome = nuovoNome;
    db.tagsAnagrafica[nuova].modificato = quando;
    anagraficaCambiata = true;
  }
  if (schede > 0) anagraficaCambiata = avRegistraTag(db, [nuovoNome]) || anagraficaCambiata;

  return { schede, cambiato: schede > 0 || anagraficaCambiata };
}

/** Fonde più tag in uno: è una rinomina per ciascuna sorgente (vedi `avRinominaTag`). */
function avFondiTag(db: any, sorgenti: any, destinazione: any, opzioni?: any): { schede: number; cambiato: boolean } {
  const arrivo = avChiaveTag(destinazione);
  const toccate: { [id: string]: boolean } = {};
  let cambiato = false;
  for (const s of avListaTag(sorgenti)) {
    if (!arrivo || avChiaveTag(s) === arrivo) continue;
    // Le schede si contano PRIMA della rinomina e una volta sola: una scheda che portava
    // due delle sorgenti fuse è stata toccata una volta, non due.
    for (const m of db.manoscritti || []) if (avHaTag(m, s)) toccate[String(m.id)] = true;
    if (avRinominaTag(db, s, destinazione, opzioni).cambiato) cambiato = true;
  }
  return { schede: Object.keys(toccate).length, cambiato };
}

/** Toglie un tag da tutte le schede e dall'anagrafica. */
function avEliminaTag(db: any, tag: any, opzioni?: any): { schede: number; cambiato: boolean } {
  const chiave = avChiaveTag(tag);
  if (!db || !chiave) return { schede: 0, cambiato: false };
  const opts = opzioni || {};
  const quando = typeof opts.quando === 'number' ? opts.quando : Date.now();
  let schede = 0;
  for (const m of db.manoscritti || []) {
    const restanti = avTagsDi(m).filter(t => avChiaveTag(t) !== chiave);
    if (!avScriviTags(m, restanti)) continue;
    m.lastModified = quando;
    if (opts.autore) m.modificatoDa = opts.autore;
    schede++;
  }
  let cambiato = schede > 0;
  if (avAnagraficaTag(db)[chiave]) { delete db.tagsAnagrafica[chiave]; cambiato = true; }
  return { schede, cambiato };
}

/**
 * Fonde due anagrafiche nel merge di sincronizzazione. Non è un campo del record, quindi non
 * passa da `rilevaConflitti`: l'unione è per chiave e sul colore vince chi l'ha cambiato per
 * ultimo. Un conflitto modale per il colore di un'etichetta sarebbe sproporzionato.
 */
function avUnisciAnagraficheTag(locale: any, remota: any): { [chiave: string]: AVVoceTag } {
  const out: { [chiave: string]: AVVoceTag } = {};
  for (const fonte of [remota, locale]) {
    for (const chiave of Object.keys(fonte || {})) {
      const voce = fonte[chiave];
      if (!voce || typeof voce !== 'object' || typeof voce.nome !== 'string') continue;
      const gia = out[chiave];
      if (!gia || (voce.modificato || 0) >= (gia.modificato || 0)) out[chiave] = voce;
    }
  }
  return out;
}

// --- Vocabolari controllati (Fase 3.3) ---------------------------------------
//
// Un `enum` della 3.1 porta i valori ammessi DENTRO il tipo documento (`campiDef[x].opzioni`).
// Per un singolo ricercatore basta; per un gruppo no: "pergamena" e "Pergamena" su due tipi
// diversi — o su due macchine — sono due valori distinti, e un conteggio per supporto
// restituisce due righe dove ce n'è una. Il vocabolario è la stessa lista **una sola volta
// per archivio**, quindi sincronizzata via Hub come tutto il resto del database.
//
// ⚠️ I valori NON vengono copiati dentro il campo. `avDefinizioneCampo` li risolve in
// lettura: se li duplicasse in `campiDef`, ogni tipo avrebbe la sua copia e la prima
// aggiunta di un valore le farebbe divergere — cioè esattamente il problema che il
// vocabolario esiste per risolvere.

type AVVocabolario = {
  id: string;
  nome: string;
  valori: string[];
  /** Ultima modifica, per il merge di sincronizzazione. */
  modificato?: number;
};

/**
 * I vocabolari con cui l'archivio nasce (migrazione v4). Sono **liste, non vincoli**:
 * nessun campo vi è legato d'ufficio.
 *
 * ⚠️ Legarli automaticamente ai campi base sarebbe una regressione silenziosa: `tipo_di_atto`
 * è oggi testo libero, e trasformarlo in tendina farebbe risultare "non previsto" ogni
 * valore già scritto in archivio. Il legame lo fa l'utente dall'editor del campo.
 */
const AV_VOCABOLARI_PREDEFINITI: AVVocabolario[] = [
  { id: 'supporto', nome: 'Supporto', valori: ['pergamena', 'carta', 'papiro', 'palinsesto'] },
  { id: 'lingua', nome: 'Lingua', valori: ['latino', 'volgare', 'greco', 'ebraico'] },
  { id: 'scrittura', nome: 'Scrittura', valori: ['carolina', 'gotica', 'cancelleresca', 'mercantesca', 'umanistica', 'corsiva notarile'] },
  { id: 'tipo_di_atto', nome: 'Tipo di atto', valori: ['vendita', 'donazione', 'testamento', 'locazione', 'permuta', 'procura', 'quietanza', 'dote'] },
  { id: 'stato_conservazione', nome: 'Stato di conservazione', valori: ['ottimo', 'buono', 'discreto', 'mediocre', 'pessimo', 'lacunoso'] },
  // Serve alla 3.5: è il vocabolario dei rimandi fra schede.
  { id: 'relazione', nome: 'Tipo di relazione', valori: ['stessa mano', 'stesso rogito', 'copia di', 'originale di', 'citato in', 'prosegue'] }
];

/** I vocabolari dell'archivio, in sola lettura: non li crea, così leggere non sporca il DB. */
function avVocabolari(db: any): { [id: string]: AVVocabolario } {
  return (db && db.vocabolari && typeof db.vocabolari === 'object') ? db.vocabolari : {};
}

function avVocabolario(db: any, id: any): AVVocabolario | null {
  const v = avVocabolari(db)[String(id || '')];
  return v && typeof v === 'object' && Array.isArray(v.valori) ? v : null;
}

/** I valori di un vocabolario, ripuliti e senza duplicati per chiave. */
function avValoriVocabolario(db: any, id: any): string[] {
  const v = avVocabolario(db, id);
  return v ? avListaValori(v.valori) : [];
}

/**
 * Ripulitura di una lista di valori. È `avListaTag` senza il taglio sulla virgola: un valore
 * di vocabolario può contenerla ("Perugia, San Lorenzo"), un tag no.
 */
function avListaValori(v: any): string[] {
  const grezzi: any[] = Array.isArray(v) ? v : String(v === null || v === undefined ? '' : v).split('\n');
  const out: string[] = [];
  const viste: { [k: string]: boolean } = {};
  for (const g of grezzi) {
    const nome = String(g === null || g === undefined ? '' : g).replace(/\s+/g, ' ').trim();
    const chiave = avChiaveTesto(nome);
    if (!chiave || viste[chiave]) continue;
    viste[chiave] = true;
    out.push(nome);
  }
  return out;
}

/** Crea o sostituisce un vocabolario. @returns true se il database è cambiato. */
function avSalvaVocabolario(db: any, voc: any): boolean {
  const id = avIdVocabolario(voc && (voc.id || voc.nome));
  if (!db || !id) return false;
  if (!db.vocabolari || typeof db.vocabolari !== 'object') db.vocabolari = {};
  const nuovo: AVVocabolario = {
    id,
    nome: String((voc && voc.nome) || id).trim() || id,
    valori: avListaValori(voc && voc.valori),
    modificato: Date.now()
  };
  const prima = db.vocabolari[id];
  if (prima && prima.nome === nuovo.nome && JSON.stringify(avListaValori(prima.valori)) === JSON.stringify(nuovo.valori)) return false;
  db.vocabolari[id] = nuovo;
  return true;
}

/**
 * L'id tecnico di un vocabolario, ricavato dal nome. Non è la chiave normalizzata dei tag:
 * qui serve un identificatore stabile che finisce dentro `campiDef`, quindi senza spazi né
 * punteggiatura — un id che cambia rompe il legame di ogni campo che lo usa.
 */
function avIdVocabolario(nome: any): string {
  return avChiaveTesto(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

/** Aggiunge un valore (l'"al volo" del form). @returns true se non c'era già. */
function avAggiungiValoreVocabolario(db: any, id: any, valore: any): boolean {
  const voc = avVocabolario(db, id);
  if (!voc) return false;
  const pulito = String(valore === null || valore === undefined ? '' : valore).replace(/\s+/g, ' ').trim();
  const chiave = avChiaveTesto(pulito);
  if (!chiave) return false;
  const valori = avListaValori(voc.valori);
  for (const v of valori) if (avChiaveTesto(v) === chiave) return false;
  valori.push(pulito);
  voc.valori = valori;
  voc.modificato = Date.now();
  return true;
}

/** Gli id dei campi legati a un vocabolario, con i tipi documento che li portano. */
function avCampiDelVocabolario(db: any, id: any): { tipo: string; campo: string }[] {
  const cercato = String(id || '');
  const out: { tipo: string; campo: string }[] = [];
  for (const tipo of (db && db.tipiDocumento) || []) {
    if (!tipo || !tipo.campiDef) continue;
    for (const campo of Object.keys(tipo.campiDef)) {
      const def = tipo.campiDef[campo];
      if (def && def.vocabolario === cercato) out.push({ tipo: String(tipo.id), campo });
    }
  }
  return out;
}

/**
 * Rinomina un valore nel vocabolario **e in tutte le schede che lo portano**.
 *
 * Senza la propagazione la rinomina sarebbe una bugia: la tendina mostrerebbe il nome nuovo
 * e le schede vecchie continuerebbero a dire il vecchio, marcato "valore non più previsto".
 */
function avRinominaValoreVocabolario(db: any, id: any, da: any, a: any, opzioni?: any): { schede: number; cambiato: boolean } {
  const voc = avVocabolario(db, id);
  const vecchia = avChiaveTesto(da);
  const nuovo = String(a === null || a === undefined ? '' : a).replace(/\s+/g, ' ').trim();
  if (!voc || !vecchia || !avChiaveTesto(nuovo)) return { schede: 0, cambiato: false };

  const opts = opzioni || {};
  const quando = typeof opts.quando === 'number' ? opts.quando : Date.now();

  const valori = avListaValori(voc.valori).map(v => (avChiaveTesto(v) === vecchia ? nuovo : v));
  voc.valori = avListaValori(valori);   // la rinomina su un valore già esistente è una fusione
  voc.modificato = quando;

  const bersagli = avCampiDelVocabolario(db, id);
  let schede = 0;
  for (const m of (db && db.manoscritti) || []) {
    if (!m) continue;
    let tocca = false;
    for (const b of bersagli) {
      if (String(m.tipoDocumento) !== b.tipo) continue;
      if (avChiaveTesto(m[b.campo]) !== vecchia) continue;
      m[b.campo] = nuovo;
      tocca = true;
    }
    if (!tocca) continue;
    m.lastModified = quando;
    if (opts.autore) m.modificatoDa = opts.autore;
    schede++;
  }
  return { schede, cambiato: true };
}

/**
 * Toglie un valore dal vocabolario. Le schede che lo portano **non si toccano**: cancellare
 * il dato di N schede perché una lista è stata accorciata sarebbe una perdita silenziosa.
 * Quelle schede mostreranno il valore marcato "non più previsto" (comportamento già della 3.1).
 */
function avEliminaValoreVocabolario(db: any, id: any, valore: any): boolean {
  const voc = avVocabolario(db, id);
  const chiave = avChiaveTesto(valore);
  if (!voc || !chiave) return false;
  const restanti = avListaValori(voc.valori).filter(v => avChiaveTesto(v) !== chiave);
  if (restanti.length === avListaValori(voc.valori).length) return false;
  voc.valori = restanti;
  voc.modificato = Date.now();
  return true;
}

/**
 * Elimina un vocabolario **liberando** i campi che lo usavano: i valori gli vengono copiati
 * dentro come `opzioni`. Lasciarli legati a un id inesistente li renderebbe tendine vuote,
 * cioè campi non compilabili, in tutte le schede di quel tipo.
 */
function avEliminaVocabolario(db: any, id: any): boolean {
  const voc = avVocabolario(db, id);
  if (!voc) return false;
  const valori = avListaValori(voc.valori);
  for (const b of avCampiDelVocabolario(db, id)) {
    const tipo = (db.tipiDocumento || []).find((t: any) => t && String(t.id) === b.tipo);
    const def = tipo && tipo.campiDef && tipo.campiDef[b.campo];
    if (!def) continue;
    delete def.vocabolario;
    def.opzioni = valori.slice();
  }
  delete db.vocabolari[String(id)];
  return true;
}

/**
 * Merge dei vocabolari in sincronizzazione.
 *
 * ⚠️ NON è last-write-wins sull'intero vocabolario, come per i tag: due colleghi che
 * aggiungono un valore ciascuno nella stessa sessione perderebbero quello scritto per primo.
 * I `valori` si UNISCONO; solo il `nome` segue chi l'ha toccato per ultimo. L'unione è per
 * chiave, quindi "Pergamena" aggiunto da uno non si somma a "pergamena" dell'altro.
 */
function avUnisciVocabolari(locale: any, remota: any): { [id: string]: AVVocabolario } {
  const out: { [id: string]: AVVocabolario } = {};
  const ids: { [id: string]: boolean } = {};
  for (const fonte of [locale, remota]) for (const id of Object.keys(fonte || {})) ids[id] = true;

  for (const id of Object.keys(ids)) {
    const a = (locale || {})[id];
    const b = (remota || {})[id];
    if (!a || typeof a !== 'object') { if (b && typeof b === 'object') out[id] = b; continue; }
    if (!b || typeof b !== 'object') { out[id] = a; continue; }
    const recente = (a.modificato || 0) >= (b.modificato || 0) ? a : b;
    out[id] = {
      id,
      nome: recente.nome,
      valori: avListaValori((a.valori || []).concat(b.valori || [])),
      modificato: Math.max(a.modificato || 0, b.modificato || 0)
    };
  }
  return out;
}

// --- Duplicati (Fase 3.6) -----------------------------------------------------

/**
 * I gruppi di schede che condividono lo stesso valore in un campo, ordinati per valore.
 *
 * ⚠️ Non è un errore da correggere d'ufficio: un fondo reale contiene segnature ripetute per
 * errori di inventariazione **antecedenti** alla schedatura, e talvolta la ripetizione è il
 * dato. Questa funzione le trova; decidere sta a chi guarda.
 */
function avGruppiDuplicati(records: any[], campoId: string): { valore: string; ids: string[] }[] {
  const mappa: { [k: string]: { valore: string; ids: string[] } } = {};
  for (const m of records || []) {
    if (!m) continue;
    const v = m[campoId];
    if (v === '' || v === null || v === undefined) continue;
    const chiave = avChiaveTesto(v);
    if (!chiave) continue;
    if (!mappa[chiave]) mappa[chiave] = { valore: String(v).trim(), ids: [] };
    mappa[chiave].ids.push(String(m.id));
  }
  return Object.keys(mappa)
    .map(k => mappa[k])
    .filter(g => g.ids.length > 1)
    .sort((a, b) => a.valore.localeCompare(b.valore, 'it', { sensitivity: 'base' }));
}

// --- Relazioni fra schede (Fase 3.5) ------------------------------------------
//
// ⚠️ La relazione si scrive su UNA sola scheda, non su entrambe. Scriverla su due
// significherebbe due record modificati per ogni collegamento, quindi doppie righe nel diff,
// doppie possibilità di conflitto e — appena due colleghi collegano le stesse due schede in
// momenti diversi — un conflitto su un dato che è lo stesso. Il verso opposto si CALCOLA
// (`avRelazioniEntranti`): è informazione derivata, e come tale non va salvata.
//
// ⚠️ Un id che non corrisponde a nessuna scheda non è un errore da ripulire: su un archivio
// condiviso la scheda può esistere sulla copia di un collega e non ancora sulla nostra.
// Si salta in resa e si conserva nel dato.

type AVRelazione = {
  /** Id della scheda collegata. */
  id: string;
  /** Valore del vocabolario `relazione`, facoltativo: un rimando senza etichetta è lecito. */
  tipo?: string;
};

function avRelazioniDi(m: any): AVRelazione[] {
  const grezze = m && Array.isArray(m.relazioni) ? m.relazioni : [];
  const out: AVRelazione[] = [];
  const viste: { [id: string]: boolean } = {};
  for (const r of grezze) {
    const id = String((r && r.id) || '').trim();
    if (!id || viste[id]) continue;
    viste[id] = true;
    const rel: AVRelazione = { id };
    const tipo = r && r.tipo ? String(r.tipo).trim() : '';
    if (tipo) rel.tipo = tipo;
    out.push(rel);
  }
  return out;
}

/**
 * Scrive le relazioni. Con l'elenco vuoto la chiave viene **rimossa**, non azzerata: un
 * `relazioni: []` comparso su ogni scheda mai collegata ne cambierebbe l'impronta
 * (`getRecordHash`) e la farebbe apparire modificata a ogni collega — vedi `avCreaScheda`.
 */
function avScriviRelazioni(m: any, lista: any): boolean {
  if (!m) return false;
  const nuove = avRelazioniDi({ relazioni: lista });
  const prima = JSON.stringify(avRelazioniDi(m));
  if (nuove.length === 0) {
    if (m.relazioni === undefined) return false;
    delete m.relazioni;
    return prima !== '[]';
  }
  if (JSON.stringify(nuove) === prima && Array.isArray(m.relazioni)) return false;
  m.relazioni = nuove;
  return true;
}

/** Aggiunge un rimando da `idA` a `idB`. Auto-collegamenti e doppioni sono scartati. */
function avAggiungiRelazione(db: any, idA: any, idB: any, tipo?: any): boolean {
  const a = (db && db.manoscritti || []).find((m: any) => m && String(m.id) === String(idA));
  if (!a || String(idA) === String(idB) || !String(idB || '').trim()) return false;
  const lista = avRelazioniDi(a);
  for (const r of lista) if (r.id === String(idB)) return false;
  const rel: AVRelazione = { id: String(idB) };
  const t = tipo ? String(tipo).trim() : '';
  if (t) rel.tipo = t;
  lista.push(rel);
  return avScriviRelazioni(a, lista);
}

function avRimuoviRelazione(db: any, idA: any, idB: any): boolean {
  const a = (db && db.manoscritti || []).find((m: any) => m && String(m.id) === String(idA));
  if (!a) return false;
  return avScriviRelazioni(a, avRelazioniDi(a).filter(r => r.id !== String(idB)));
}

/** Chi punta a questa scheda: il verso che non è salvato da nessuna parte. */
function avRelazioniEntranti(records: any[], id: any): { id: string; tipo?: string }[] {
  const cercato = String(id || '');
  const out: { id: string; tipo?: string }[] = [];
  if (!cercato) return out;
  for (const m of records || []) {
    if (!m || String(m.id) === cercato) continue;
    for (const r of avRelazioniDi(m)) {
      if (r.id !== cercato) continue;
      const voce: { id: string; tipo?: string } = { id: String(m.id) };
      if (r.tipo) voce.tipo = r.tipo;
      out.push(voce);
      break;
    }
  }
  return out;
}

/**
 * Il grafo dei rimandi: nodi (le schede) e archi (i collegamenti), pronti per essere
 * disegnati. È **puro** — nessun DOM, nessuna posizione — proprio perché la parte difficile
 * da verificare di una vista a grafo non è il disegno ma che cosa ci finisce dentro.
 *
 * `isolate: true` include anche le schede senza alcun collegamento. Di norma NON si fa: su
 * un archivio di trecento schede con dieci rimandi, il grafo sarebbe duecentonovanta puntini
 * fermi intorno a una figura minuscola, cioè l'informazione utile resa illeggibile da quella
 * inutile.
 *
 * ⚠️ Gli archi verso una scheda che non esiste vengono SCARTATI dal grafo ma restano nel
 * dato (la regola di sempre: su un archivio condiviso quella scheda può esistere sulla copia
 * di un collega). Disegnarli vorrebbe dire nodi fantasma senza segnatura.
 *
 * ⚠️ Due schede che si rimandano a vicenda producono DUE archi, non uno: "A è copia di B" e
 * "B è originale di A" sono due affermazioni, e fonderle ne perderebbe una.
 */
function avGrafoRelazioni(records: any[], opzioni?: any): { nodi: any[]; archi: any[] } {
  const opts = opzioni || {};
  const esistenti: { [id: string]: any } = {};
  for (const m of records || []) if (m && m.id !== undefined) esistenti[String(m.id)] = m;

  const archi: any[] = [];
  const grado: { [id: string]: number } = {};
  for (const m of records || []) {
    if (!m) continue;
    const da = String(m.id);
    for (const r of avRelazioniDi(m)) {
      if (!esistenti[r.id]) continue;
      archi.push({ da, a: r.id, tipo: r.tipo || '' });
      grado[da] = (grado[da] || 0) + 1;
      grado[r.id] = (grado[r.id] || 0) + 1;
    }
  }

  const nodi: any[] = [];
  for (const id of Object.keys(esistenti)) {
    const g = grado[id] || 0;
    if (g === 0 && !opts.isolate) continue;
    const m = esistenti[id];
    nodi.push({
      id,
      etichetta: String(m.segnatura || '').trim(),
      tipoDocumento: String(m.tipoDocumento || ''),
      cartella: String(m.cartella || ''),
      grado: g
    });
  }
  // Ordine stabile: il layout parte dalle posizioni iniziali, e un ordine che cambia a ogni
  // apertura darebbe un grafo diverso ogni volta a parità di dati.
  nodi.sort((a, b) => (b.grado - a.grado) || a.id.localeCompare(b.id));
  return { nodi, archi };
}

/**
 * Le componenti connesse del grafo, dalla più grande alla più piccola: in un archivio
 * notarile sono i "grappoli" di documenti che si richiamano — una filza, un rogito con le
 * sue copie — ed è la lettura che serve davvero, più del disegno d'insieme.
 * Il verso non conta: due schede collegate stanno nello stesso grappolo comunque.
 */
function avComponentiGrafo(grafo: any): string[][] {
  const vicini: { [id: string]: string[] } = {};
  for (const n of (grafo && grafo.nodi) || []) vicini[n.id] = [];
  for (const a of (grafo && grafo.archi) || []) {
    if (vicini[a.da] && vicini[a.a]) { vicini[a.da].push(a.a); vicini[a.a].push(a.da); }
  }
  const visti: { [id: string]: boolean } = {};
  const out: string[][] = [];
  for (const n of (grafo && grafo.nodi) || []) {
    if (visti[n.id]) continue;
    const gruppo: string[] = [];
    const coda = [n.id];
    visti[n.id] = true;
    while (coda.length) {
      const corrente = coda.shift() as string;
      gruppo.push(corrente);
      for (const v of vicini[corrente] || []) {
        if (visti[v]) continue;
        visti[v] = true;
        coda.push(v);
      }
    }
    out.push(gruppo);
  }
  return out.sort((a, b) => b.length - a.length);
}

// --- Authority record: persone e luoghi (Fase 3.5) ----------------------------
//
// I nomi di persona sono già in archivio: sono i valori delle `dynamic_list`
// (`attori_dinamici`, `famiglia_dinamici`), dove la chiave è il ruolo e il valore è il nome.
// Mancava il passo che li rende interrogabili: raccoglierli, dirgli che sono la stessa
// persona anche se scritti in due modi, e sapere da quali schede compaiono.
//
// ⚠️ L'anagrafica NON è la fonte del dato: la fonte restano le schede. Qui si registrano
// solo la grafia scelta e le note, e i conteggi si RICALCOLANO. Duplicare i nomi qui
// significherebbe due verità che divergono al primo salvataggio fatto da un'app più vecchia.

type AVAuthority = {
  chiave: string;
  nome: string;
  tipo: string;          // 'persona' | 'luogo'
  note?: string;
  modificato?: number;
};

const AV_TIPI_AUTHORITY = ['persona', 'luogo'];

function avAuthority(db: any): { [chiave: string]: AVAuthority } {
  return (db && db.authority && typeof db.authority === 'object') ? db.authority : {};
}

/** I nomi che un campo contribuisce all'anagrafica, secondo la sua definizione. */
function avNomiAuthorityDelCampo(def: any, valore: any): string[] {
  if (!def || !def.authority) return [];
  if (def.tipo === 'dynamic_list') {
    if (!Array.isArray(valore)) return [];
    // La chiave è il RUOLO ("Venditore"), il valore è il nome: è il contratto di
    // `aggiungiElementoDinamico`, e invertirlo riempirebbe l'anagrafica di ruoli.
    return valore.map((e: any) => String((e && (e.v !== undefined ? e.v : e.nome)) || '').trim()).filter(Boolean);
  }
  const s = String(valore === null || valore === undefined ? '' : valore).trim();
  return s ? [s] : [];
}

/**
 * Fase 3.7 — le definizioni del tipo più quelle proprie della scheda, senza ripassare da
 * `avCampiDellaScheda`: qui i campi del tipo arrivano già risolti dal renderer (`campiDi`),
 * e rifarli perderebbe le etichette tradotte.
 */
function avConCampiPropri(definizioni: any[], scheda: any): any[] {
  const propri = avCampiPropri(scheda);
  if (!propri.length) return definizioni;
  const visti = new Set((definizioni || []).map((d: any) => d && d.id));
  return (definizioni || []).concat(propri.filter(d => !visti.has(d.id)));
}

/**
 * Le voci d'anagrafica ricavate dalle schede, con quante schede le citano.
 *
 * `campiDi` è una funzione `(tipoDocumento) => AVCampoDef[]`: il modello non sa risolvere i
 * campi base (le etichette e i loro tipi vivono in `CONFIG_CAMPI`, cioè nel renderer), e
 * incorporare quel catalogo qui vorrebbe dire portare la i18n dentro il main.
 *
 * ⚠️ Fase 3.7 — i campi PROPRI della scheda si aggiungono qui dentro e non nella funzione
 * passata: `campiDi` conosce solo il tipo documento, e un campo proprio dichiarato
 * `authority` non arriverebbe mai all'anagrafica (che è il motivo per cui lo si dichiara).
 */
function avVociAuthority(records: any[], campiDi: any, db?: any): { chiave: string; nome: string; tipo: string; conteggio: number; ids: string[] }[] {
  const mappa: { [k: string]: { chiave: string; nome: string; tipo: string; conteggio: number; ids: string[] } } = {};
  const ana = avAuthority(db);
  for (const m of records || []) {
    if (!m) continue;
    const definizioni = avConCampiPropri(campiDi ? campiDi(m.tipoDocumento) || [] : [], m);
    const gia: { [k: string]: boolean } = {};
    for (const def of definizioni) {
      if (!def || !def.authority) continue;
      for (const nome of avNomiAuthorityDelCampo(def, m[def.id])) {
        const chiave = def.authority + ':' + avChiaveTesto(nome);
        if (!avChiaveTesto(nome)) continue;
        if (!mappa[chiave]) {
          const voce = ana[chiave];
          mappa[chiave] = { chiave, nome: (voce && voce.nome) || nome, tipo: def.authority, conteggio: 0, ids: [] };
        }
        // Una scheda che cita la stessa persona in due campi (o due volte nello stesso) va
        // contata UNA volta: il conteggio dice "in quante schede compare", non "quante volte".
        if (gia[chiave]) continue;
        gia[chiave] = true;
        mappa[chiave].conteggio++;
        mappa[chiave].ids.push(String(m.id));
      }
    }
  }
  return Object.keys(mappa)
    .map(k => mappa[k])
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }));
}

/** La chiave d'anagrafica di un nome, dato il suo tipo. */
function avChiaveAuthority(tipo: any, nome: any): string {
  const k = avChiaveTesto(nome);
  return k ? String(tipo) + ':' + k : '';
}

function avVoceAuthority(db: any, tipo: any, nome: any): AVAuthority | null {
  const chiave = avChiaveAuthority(tipo, nome);
  const voce = chiave ? avAuthority(db)[chiave] : null;
  return voce && typeof voce === 'object' ? voce : null;
}

/** Registra o aggiorna una voce (grafia scelta e note). @returns true se il DB è cambiato. */
function avSalvaVoceAuthority(db: any, tipo: any, nome: any, dati?: any): boolean {
  const chiave = avChiaveAuthority(tipo, nome);
  if (!db || !chiave || AV_TIPI_AUTHORITY.indexOf(String(tipo)) === -1) return false;
  if (!db.authority || typeof db.authority !== 'object') db.authority = {};
  const d = dati || {};
  const voce: AVAuthority = {
    chiave,
    nome: String(d.nome !== undefined ? d.nome : nome).replace(/\s+/g, ' ').trim(),
    tipo: String(tipo)
  };
  const note = d.note !== undefined ? String(d.note).trim() : (db.authority[chiave] && db.authority[chiave].note) || '';
  if (note) voce.note = note;
  const prima = db.authority[chiave];
  if (prima && prima.nome === voce.nome && (prima.note || '') === (voce.note || '')) return false;
  voce.modificato = Date.now();
  db.authority[chiave] = voce;
  return true;
}

/**
 * Rinomina una persona o un luogo **in tutte le schede che la citano**, non solo
 * nell'anagrafica: è l'operazione per cui l'anagrafica esiste — unificare "Bartolo da
 * Sassoferrato" e "Bartolus de Saxoferrato" senza aprire quaranta schede.
 */
function avRinominaAuthority(db: any, tipo: any, da: any, a: any, campiDi: any, opzioni?: any): { schede: number; cambiato: boolean } {
  const vecchia = avChiaveTesto(da);
  const nuovo = String(a === null || a === undefined ? '' : a).replace(/\s+/g, ' ').trim();
  if (!db || !vecchia || !avChiaveTesto(nuovo)) return { schede: 0, cambiato: false };

  const opts = opzioni || {};
  const quando = typeof opts.quando === 'number' ? opts.quando : Date.now();
  let schede = 0;

  for (const m of db.manoscritti || []) {
    if (!m) continue;
    let tocca = false;
    for (const def of avConCampiPropri(campiDi ? campiDi(m.tipoDocumento) || [] : [], m)) {
      if (!def || def.authority !== String(tipo)) continue;
      if (def.tipo === 'dynamic_list') {
        if (!Array.isArray(m[def.id])) continue;
        for (const voce of m[def.id]) {
          const attuale = voce && (voce.v !== undefined ? voce.v : voce.nome);
          if (avChiaveTesto(attuale) !== vecchia) continue;
          if (voce.v !== undefined) voce.v = nuovo; else voce.nome = nuovo;
          tocca = true;
        }
      } else if (avChiaveTesto(m[def.id]) === vecchia) {
        m[def.id] = nuovo;
        tocca = true;
      }
    }
    if (!tocca) continue;
    m.lastModified = quando;
    if (opts.autore) m.modificatoDa = opts.autore;
    schede++;
  }

  // L'anagrafica segue: la voce vecchia sparisce, la nuova eredita le note se non ne ha.
  const chiaveVecchia = avChiaveAuthority(tipo, da);
  const chiaveNuova = avChiaveAuthority(tipo, nuovo);
  const ana = avAuthority(db);
  let anagraficaCambiata = false;
  if (chiaveVecchia !== chiaveNuova && ana[chiaveVecchia]) {
    const note = (ana[chiaveNuova] && ana[chiaveNuova].note) || ana[chiaveVecchia].note;
    delete db.authority[chiaveVecchia];
    anagraficaCambiata = true;
    avSalvaVoceAuthority(db, tipo, nuovo, { nome: nuovo, note: note || '' });
  } else if (schede > 0 || ana[chiaveVecchia]) {
    anagraficaCambiata = avSalvaVoceAuthority(db, tipo, nuovo, { nome: nuovo }) || anagraficaCambiata;
  }

  return { schede, cambiato: schede > 0 || anagraficaCambiata };
}

/** Merge dell'anagrafica in sincronizzazione: per chiave, last-write-wins sulla voce. */
function avUnisciAuthority(locale: any, remota: any): { [chiave: string]: AVAuthority } {
  const out: { [chiave: string]: AVAuthority } = {};
  for (const fonte of [remota, locale]) {
    for (const chiave of Object.keys(fonte || {})) {
      const voce = fonte[chiave];
      if (!voce || typeof voce !== 'object' || typeof voce.nome !== 'string') continue;
      const gia = out[chiave];
      if (!gia || (voce.modificato || 0) >= (gia.modificato || 0)) out[chiave] = voce;
    }
  }
  return out;
}

// --- Record -------------------------------------------------------------------

/**
 * Porta una scheda alla forma canonica **senza inventare contenuto**.
 *
 * ⚠️ Non aggiunge chiavi che non c'erano se non sono strettamente necessarie: `getRecordHash`
 * (`diffMergeLogic.ts`) calcola l'impronta su TUTTE le chiavi tranne tre, quindi una chiave
 * in più su un record già sincronizzato lo farebbe apparire modificato a ogni collega — un
 * archivio intero "in conflitto" per un campo che nessuno ha toccato.
 * Le sole eccezioni sono `cartella` e `tipoDocumento`, che senza un valore rendono la scheda
 * irraggiungibile: sta nella radice di nessun albero e non ha campi da mostrare.
 */
function avNormalizzaScheda(m: any): AVScheda {
  if (!m || typeof m !== 'object') return m;
  if (typeof m.cartella !== 'string') m.cartella = '';
  if (!m.tipoDocumento || m.tipoDocumento === 'manoscritto') m.tipoDocumento = AV_TIPO_PREDEFINITO;
  if (m.allegati !== undefined && !Array.isArray(m.allegati)) m.allegati = [];
  return m as AVScheda;
}

/**
 * La scheda nuova, in un punto solo. Prima la costruiva `handleFormSubmit` a mano, cioè la
 * forma del record era decisa dal form: aggiungere un campo di servizio significava
 * ricordarsi di aggiungerlo anche all'import ZIP e alla duplicazione.
 */
function avCreaScheda(dati: any): AVScheda {
  const d = dati || {};
  const ora = Date.now();
  const base: AVScheda = {
    id: d.id || avNuovoId(),
    cartella: typeof d.cartella === 'string' ? d.cartella : '',
    tipoDocumento: d.tipoDocumento || AV_TIPO_PREDEFINITO,
    segnatura: d.segnatura || '',
    tags: typeof d.tags === 'string' ? d.tags : '',
    allegati: Array.isArray(d.allegati) ? d.allegati : [],
    allegato: d.allegato || '',
    allegatoTipo: d.allegatoTipo || '',
    lastModified: typeof d.lastModified === 'number' ? d.lastModified : ora,
    creatoDa: d.creatoDa || 'Anonimo',
    modificatoDa: d.modificatoDa || d.creatoDa || 'Anonimo'
  };
  // I campi del tipo documento restano flat sulla radice: è la forma su disco (vedi AVScheda).
  for (const k of Object.keys(d)) {
    if (base[k] === undefined) base[k] = d[k];
  }
  return base;
}

/**
 * Il database VUOTO, con cui nasce un archivio nuovo.
 *
 * ⚠️ Sta qui e non in `state.ts` per una ragione precisa: un archivio nuovo non passa dalle
 * migrazioni — non c'è niente da migrare — quindi tutto ciò che una migrazione installa
 * (i vocabolari della v4, per esempio) su un archivio nuovo NON esisterebbe mai. Prima
 * questo oggetto era un letterale nel renderer, e ogni voce aggiunta alla catena andava
 * ricordata due volte, in due file diversi, senza che nulla lo garantisse.
 *
 * La costruzione è deliberatamente "vuoto + migrazioni": così l'archivio nuovo è per
 * definizione identico a un archivio vecchio appena migrato, e non c'è un secondo elenco
 * di valori predefiniti da tenere allineato.
 */
function avDatabaseVuoto(): AVDatabase {
  const db: any = {
    // Nessuna cartella predefinita: '' è la radice virtuale del vault (vedi renderSidebar).
    cartelle: [],
    manoscritti: [],
    tipiDocumento: AV_MODELLI_PREDEFINITI.map(m => ({ id: m.id, nome: m.nome, campi: m.campi.slice() })),
    trascrizioneEditorWidth: '50%'
  };
  for (const migrazione of AV_MIGRAZIONI) migrazione.applica(db);
  db.schemaVersion = ARCHIVIEW_SCHEMA_VERSION;
  return db as AVDatabase;
}

function avNuovoId(): string {
  const c: any = typeof crypto !== 'undefined' ? crypto : null;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Date.now().toString() + Math.random().toString(36).slice(2, 8);
}

// --- Merge campo per campo (Fase 4.4) -----------------------------------------
//
// Il confronto a tre vie di `state.ts` lavorava sull'impronta dell'INTERO record: due
// colleghi che toccavano campi diversi della stessa scheda — uno la trascrizione, l'altro
// il notaio — producevano un conflitto da risolvere a mano scegliendo una versione e
// buttando l'altra. La granularità giusta è il campo, non il record.
//
// ⚠️ Serve l'oggetto di base, non la sua impronta. `baseHashes` basta a sapere SE un lato
// ha cambiato qualcosa, non COSA: senza `baseObjects[id]` non c'è modo di attribuire una
// differenza a chi l'ha introdotta, ed è la ragione per cui questa funzione prende tre
// record interi. `baseObjects` è già scritto su disco (`.archiview-base.json`) e già
// migrato insieme ai record (v1), quindi non costa nulla in più.

/** Le chiavi che non sono contenuto: non entrano nel confronto e non generano conflitti. */
const AV_CHIAVI_NON_FUSE = ['lastModified', 'modificatoDa', 'creatoDa', 'allegatoTipo'];

function avUgualiJson(a: any, b: any): boolean {
  return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

/**
 * Fonde due versioni della stessa scheda campo per campo, rispetto alla base comune.
 *
 * Per ogni chiave: se un solo lato l'ha cambiata vince quel lato; se l'hanno cambiata
 * entrambi allo STESSO modo non è un conflitto; se l'hanno cambiata in modi diversi la
 * chiave finisce in `conflitti` e nel record fuso resta il valore LOCALE — chi sta davanti
 * allo schermo decide, e finché non decide non gli si toglie ciò che ha scritto.
 *
 * `allegatoTipo` è derivato da `allegati` e non si fonde da sé: segue la sorte di
 * `allegati`, altrimenti si otterrebbe un'icona che descrive un allegato che non c'è (è la
 * stessa ragione per cui `rilevaConflitti` lo ignora da sempre).
 */
/**
 * Fase 3.7 — il merge a tre vie dei campi propri, per `id` invece che per l'elenco intero.
 *
 * Regole, nell'ordine: un id TOLTO da un lato sparisce (o una cancellazione non si
 * propagherebbe mai e resterebbe un campo senza valore nel form); un id presente da un lato
 * solo entra; lo stesso id con due definizioni diverse è un conflitto, e nel fuso resta la
 * definizione LOCALE — chi sta davanti allo schermo decide.
 */
function avFondiCampiPropri(base: any, locale: any, esterno: any): { definizioni: AVCampoDef[]; conflitto: boolean } {
  const perId = (x: any) => {
    const m = new Map<string, AVCampoDef>();
    for (const d of avCampiPropri({ campiPropri: x })) m.set(d.id, d);
    return m;
  };
  const b = perId(base), l = perId(locale), e = perId(esterno);
  const definizioni: AVCampoDef[] = [];
  let conflitto = false;
  // L'ordine è quello locale, poi ciò che arriva da fuori: il campo che l'utente ha appena
  // aggiunto non deve saltare in mezzo agli altri sotto i suoi occhi.
  const ordine = [...l.keys(), ...e.keys()];
  const visti = new Set<string>();
  for (const id of ordine) {
    if (visti.has(id)) continue;
    visti.add(id);
    const inB = b.has(id), inL = l.has(id), inE = e.has(id);
    if (inB && (!inL || !inE)) continue;               // tolto da un lato: si toglie
    if (inL && inE && !avUgualiJson(l.get(id), e.get(id))) conflitto = true;
    definizioni.push((inL ? l.get(id) : e.get(id)) as AVCampoDef);
  }
  return { definizioni, conflitto };
}

function avFondiRecord(base: any, locale: any, esterno: any): { fuso: any; conflitti: string[] } {
  const b = base || {};
  const l = locale || {};
  const e = esterno || {};
  const fuso: any = { ...l };
  const conflitti: string[] = [];

  const chiavi = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(e)]);
  let daEsterno = false;
  for (const k of chiavi) {
    if (AV_CHIAVI_NON_FUSE.indexOf(k) !== -1) continue;

    // Fase 3.7 — `campiPropri` è un ELENCO, e il confronto per chiave lo tratterebbe come
    // un valore solo: due colleghi che aggiungono due campi DIVERSI alla stessa scheda
    // sarebbero un conflitto, e il perdente resterebbe con un valore orfano — presente nel
    // record, invisibile nel form. Si fondono per `id`, come si farebbe con un insieme.
    // Resta un conflitto vero solo quando lo STESSO id porta due definizioni diverse.
    if (k === 'campiPropri') {
      const { definizioni, conflitto } = avFondiCampiPropri(b[k], l[k], e[k]);
      if (conflitto) conflitti.push(k);
      if (definizioni.length) fuso[k] = definizioni; else delete fuso[k];
      if (!avUgualiJson(e[k], b[k])) daEsterno = true;
      continue;
    }

    const cambiatoLocale = !avUgualiJson(l[k], b[k]);
    const cambiatoEsterno = !avUgualiJson(e[k], b[k]);

    if (!cambiatoEsterno) continue;          // solo il locale (o nessuno) l'ha toccata
    if (!cambiatoLocale) {                   // solo l'esterno: prende l'esterno
      if (Object.prototype.hasOwnProperty.call(e, k)) fuso[k] = e[k];
      else delete fuso[k];
      daEsterno = true;
      continue;
    }
    if (avUgualiJson(l[k], e[k])) continue;  // stessa identica modifica da entrambe le parti
    conflitti.push(k);                       // conflitto vero: nel fuso resta il locale
  }

  // `allegatoTipo` segue `allegati`, mai da solo.
  if (!avUgualiJson(fuso.allegati, l.allegati)) fuso.allegatoTipo = e.allegatoTipo;

  // Il record fuso è NUOVO: porta il timestamp più alto delle due parti, o al confronto
  // successivo il lato che ha perso la firma sembrerebbe ancora indietro e rientrerebbe.
  fuso.lastModified = Math.max(l.lastModified || 0, e.lastModified || 0) || Date.now();
  if (daEsterno && e.modificatoDa) fuso.modificatoDa = e.modificatoDa;
  return { fuso, conflitti };
}

// --- Snapshot locali: rotazione (Fase 4.2) ------------------------------------
//
// La regola di conservazione sta QUI e non nel main perché è aritmetica pura, quindi
// verificabile con un unit test senza toccare il disco (è il criterio di `test/`: eseguire
// il sorgente vero, non una copia che può divergere).
//
// Due criteri sommati, mai in alternativa: gli ultimi N snapshot QUALUNQUE sia la loro età
// (la rete di chi ha appena sbagliato) e il PIÙ RECENTE di ogni giorno per D giorni (la
// cronologia di chi si accorge dell'errore la settimana dopo). Uno snapshot che soddisfa
// anche uno solo dei due criteri sopravvive.

const AV_SNAPSHOT_RECENTI = 10;
const AV_SNAPSHOT_GIORNI = 30;

/** `YYYY-MM-DD` in ora LOCALE: il "giorno" della rotazione è quello dell'utente, non UTC. */
function avGiornoLocale(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/**
 * Decide quali snapshot tenere.
 *
 * @param voci     `[{ nome, creatoIl }]`, in ordine qualsiasi.
 * @param opzioni  `{ recenti, giorni, ora }`.
 * @return         `{ tenere, eliminare }`, entrambi elenchi di nomi.
 */
function avRotazioneSnapshot(voci: any[], opzioni?: any): { tenere: string[]; eliminare: string[] } {
  const o = opzioni || {};
  const recenti = typeof o.recenti === 'number' && o.recenti >= 0 ? o.recenti : AV_SNAPSHOT_RECENTI;
  const giorni = typeof o.giorni === 'number' && o.giorni >= 0 ? o.giorni : AV_SNAPSHOT_GIORNI;
  const ora = typeof o.ora === 'number' ? o.ora : Date.now();

  const lista = (voci || []).filter(v => v && v.nome).slice()
    .sort((a, b) => (b.creatoIl || 0) - (a.creatoIl || 0));

  const tenere = new Set<string>();
  for (let i = 0; i < Math.min(recenti, lista.length); i++) tenere.add(lista[i].nome);

  // Il più recente di ogni giorno, per i `giorni` giorni appena trascorsi. Il taglio è sul
  // GIORNO e non su `ora - giorni*24h`: col secondo criterio, l'ultimo giorno conservato
  // perderebbe lo snapshot delle 09:00 e terrebbe quello delle 23:00, cioè la cronologia
  // si accorcerebbe di mezza giornata a ogni rotazione.
  const limite = avGiornoLocale(ora - giorni * 86400000);
  const vistiPerGiorno = new Set<string>();
  for (const v of lista) {
    const giorno = avGiornoLocale(v.creatoIl || 0);
    if (giorno < limite) continue;
    if (vistiPerGiorno.has(giorno)) continue;
    vistiPerGiorno.add(giorno);
    tenere.add(v.nome);
  }

  return {
    tenere: lista.filter(v => tenere.has(v.nome)).map(v => v.nome),
    eliminare: lista.filter(v => !tenere.has(v.nome)).map(v => v.nome)
  };
}

// --- Cestino: conservazione (Fase 4.1) ----------------------------------------
//
// Il cestino NON sta nel database e NON si sincronizza (il perché è in `main/trash.ts`):
// è una rete di sicurezza locale, e la sua regola di scadenza sta qui per la stessa ragione
// della rotazione degli snapshot — è aritmetica, e va provata come tale.

const AV_CESTINO_GIORNI = 30;

/** Le voci ancora valide, dalla più recente. Una voce senza data è scaduta per definizione. */
function avCestinoValido(voci: any[], opzioni?: any): any[] {
  const o = opzioni || {};
  const giorni = typeof o.giorni === 'number' && o.giorni >= 0 ? o.giorni : AV_CESTINO_GIORNI;
  const ora = typeof o.ora === 'number' ? o.ora : Date.now();
  // `giorni === 0` vuol dire "non conservare nulla": il cestino resta vuoto, non infinito.
  const soglia = ora - giorni * 86400000;
  return (voci || [])
    .filter(v => v && v.record && typeof v.deletedAt === 'number' && v.deletedAt > soglia)
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

// --- Catena di migrazioni -----------------------------------------------------
//
// Ogni voce porta il database DA `versione - 1` A `versione`, è idempotente e non tocca
// `lastModified` né `modificatoDa`: una migrazione che firmasse i record col nome di chi ha
// aperto l'app per primo riscriverebbe la paternità di un archivio condiviso, e al primo
// sync propagherebbe l'intero database come "modificato da lui".

const AV_MIGRAZIONI: { versione: number; descrizione: string; applica: (db: any) => boolean }[] = [
  {
    versione: 1,
    descrizione: 'Formato iniziale esplicito (collezioni, tipo documento predefinito)',
    applica(db: any): boolean {
      let cambiato = false;
      if (!Array.isArray(db.cartelle)) { db.cartelle = []; cambiato = true; }
      if (!Array.isArray(db.manoscritti)) { db.manoscritti = []; cambiato = true; }
      if (!Array.isArray(db.tipiDocumento)) { db.tipiDocumento = []; cambiato = true; }

      for (const m of db.manoscritti) {
        if (!m || typeof m !== 'object') continue;
        const prima = m.cartella + '|' + m.tipoDocumento;
        avNormalizzaScheda(m);
        if (prima !== m.cartella + '|' + m.tipoDocumento) cambiato = true;
      }
      // Lo snapshot di base va migrato INSIEME ai record, o il merge a tre vie confronterebbe
      // una scheda migrata con la sua base non migrata e la dichiarerebbe modificata: un
      // archivio intero da riconciliare per una migrazione che non ha cambiato contenuto.
      if (db.baseObjects && typeof db.baseObjects === 'object') {
        for (const id of Object.keys(db.baseObjects)) avNormalizzaScheda(db.baseObjects[id]);
      }
      return cambiato;
    }
  },
  {
    versione: 2,
    descrizione: 'Campi tipizzati: definizioni raccolte in campiDef',
    applica(db: any): boolean {
      let cambiato = false;
      for (const tipo of db.tipiDocumento || []) {
        if (!tipo || typeof tipo !== 'object') continue;
        if (!Array.isArray(tipo.campi)) { tipo.campi = []; cambiato = true; continue; }

        // Un oggetto dentro `campi` (la forma che un altro strumento potrebbe scrivere)
        // viene spostato in `campiDef`: dentro l'array manderebbe in errore ogni versione
        // precedente alla 3.1 — vedi il commento su AVTipoDocumento.campi.
        const conOggetti = tipo.campi.some((c: any) => c && typeof c === 'object');
        if (conOggetti) {
          avImpostaCampi(tipo, tipo.campi.map((c: any) => avDefinizioneCampo(tipo, c)));
          cambiato = true;
          continue;
        }

        if (!tipo.campiDef || typeof tipo.campiDef !== 'object') continue;
        // Definizioni orfane: restano dopo che un campo è stato tolto dal tipo. Non fanno
        // danno, ma tornerebbero in vita — con vincoli e opzioni di allora — se qualcuno
        // rimettesse un campo con lo stesso nome.
        for (const id of Object.keys(tipo.campiDef)) {
          if (tipo.campi.indexOf(id) === -1) { delete tipo.campiDef[id]; cambiato = true; }
        }
        if (Object.keys(tipo.campiDef).length === 0) { delete tipo.campiDef; cambiato = true; }
      }
      return cambiato;
    }
  },
  {
    versione: 3,
    descrizione: 'Anagrafica dei tag ricavata dai tag in uso',
    applica(db: any): boolean {
      // Solo la chiave di primo livello: i record restano intatti (vedi il commento su
      // ARCHIVIEW_SCHEMA_VERSION). Le voci nascono senza colore — un colore inventato dalla
      // migrazione sarebbe una decisione estetica presa al posto dell'utente, e per giunta
      // diversa su ogni macchina che apre l'archivio per prima.
      const ana = avAnagraficaTag(db);
      const nomi: string[] = [];
      for (const m of db.manoscritti || []) for (const t of avTagsDi(m)) nomi.push(t);
      const prima = Object.keys(ana).length;
      avRegistraTag(db, nomi);
      return Object.keys(avAnagraficaTag(db)).length !== prima;
    }
  },
  {
    versione: 4,
    descrizione: 'Vocabolari controllati predefiniti e anagrafica di persone e luoghi',
    applica(db: any): boolean {
      // Come la v3: solo chiavi di primo livello, nessun record toccato. I vocabolari
      // nascono ma non vengono legati ad alcun campo (vedi AV_VOCABOLARI_PREDEFINITI).
      let cambiato = false;
      if (!db.vocabolari || typeof db.vocabolari !== 'object') { db.vocabolari = {}; cambiato = true; }
      for (const pref of AV_VOCABOLARI_PREDEFINITI) {
        // Un vocabolario già presente NON si sovrascrive: l'utente potrebbe averne tolto
        // valori che non usa, e rimetterglieli a ogni avvio sarebbe una modifica non chiesta.
        if (db.vocabolari[pref.id]) continue;
        db.vocabolari[pref.id] = { id: pref.id, nome: pref.nome, valori: pref.valori.slice() };
        cambiato = true;
      }
      if (!db.authority || typeof db.authority !== 'object') { db.authority = {}; cambiato = true; }
      return cambiato;
    }
  }
];

/**
 * Applica la catena e restituisce il database migrato.
 *
 * Tre casi, tutti espliciti:
 * 1. **array piatto** — il database delle primissime versioni era una lista di schede senza
 *    involucro. Va riconosciuto prima di qualunque altra cosa, perché non ha (e non può
 *    avere) una `schemaVersion`;
 * 2. **versione minore** — si applicano in ordine le migrazioni mancanti;
 * 3. **versione maggiore della nostra** — il file arriva da un'app più recente (succede su
 *    un archivio condiviso in cui un collega ha aggiornato prima). NON si migra e NON si
 *    riscrive la versione all'ingiù: un downgrade silenzioso distruggerebbe dati che questa
 *    versione non sa nemmeno di avere. Si apre com'è e si segnala al chiamante.
 */
function avMigraDatabase(grezzo: any): AVEsitoMigrazione {
  const applicate: string[] = [];

  let db: any = grezzo;
  if (Array.isArray(grezzo)) {
    // Caso 1: lista piatta delle primissime versioni.
    db = { cartelle: [], manoscritti: grezzo, tipiDocumento: [] };
    applicate.push('Database "lista piatta" convertito in archivio con cartelle');
  } else if (!db || typeof db !== 'object') {
    db = { cartelle: [], manoscritti: [], tipiDocumento: [] };
    applicate.push('Database assente o illeggibile: creato vuoto');
  }

  const versione = avVersioneDi(db);
  if (versione > ARCHIVIEW_SCHEMA_VERSION) {
    return { db, applicate, futuro: true };
  }

  for (const migrazione of AV_MIGRAZIONI) {
    if (migrazione.versione <= versione) continue;
    const cambiato = migrazione.applica(db);
    if (cambiato) applicate.push(`v${migrazione.versione}: ${migrazione.descrizione}`);
  }

  // La versione si stampa comunque, anche quando nessuna migrazione ha cambiato nulla: è
  // ciò che permette alla prossima apertura di sapere da dove partire.
  if (db.schemaVersion !== ARCHIVIEW_SCHEMA_VERSION) {
    db.schemaVersion = ARCHIVIEW_SCHEMA_VERSION;
    if (versione !== 0 || applicate.length) applicate.push(`Versione dello schema portata a ${ARCHIVIEW_SCHEMA_VERSION}`);
    else applicate.push(`Versione dello schema iniziale (${ARCHIVIEW_SCHEMA_VERSION})`);
  }

  return { db, applicate, futuro: false };
}

// --- Esposizione --------------------------------------------------------------

const ArchiViewModel = {
  SCHEMA_VERSION: ARCHIVIEW_SCHEMA_VERSION,
  CHIAVI_SERVIZIO: AV_CHIAVI_SERVIZIO,
  TIPO_PREDEFINITO: AV_TIPO_PREDEFINITO,
  MIGRAZIONI: AV_MIGRAZIONI,
  TIPI_CAMPO: AV_TIPI_CAMPO,
  MODELLI_PREDEFINITI: AV_MODELLI_PREDEFINITI,
  modelloPredefinito: avModelloPredefinito,
  applicaModelliPredefiniti: avApplicaModelliPredefiniti,
  TIPI_CAMPO_SCEGLIBILI: AV_TIPI_CAMPO_SCEGLIBILI,
  tipoCampoValido: avTipoCampoValido,
  definizioneCampo: avDefinizioneCampo,
  campiDelTipo: avCampiDelTipo,
  impostaCampi: avImpostaCampi,
  // Campi propri della scheda (Fase 3.7)
  campiDellaScheda: avCampiDellaScheda,
  ordinaDefinizioni: avOrdinaDefinizioni,
  ordineCampi: avOrdineCampi,
  scriviOrdineCampi: avScriviOrdineCampi,
  campiPropri: avCampiPropri,
  scriviCampiPropri: avScriviCampiPropri,
  unisciCampiPropri: avUnisciCampiPropri,
  normalizzaValore: avNormalizzaValore,
  validaValore: avValidaValore,
  duplicatiCampo: avDuplicatiCampo,
  versioneDi: avVersioneDi,
  migraDatabase: avMigraDatabase,
  normalizzaScheda: avNormalizzaScheda,
  creaScheda: avCreaScheda,
  databaseVuoto: avDatabaseVuoto,
  nuovoId: avNuovoId,
  databaseValido: avDatabaseValido,
  motivoNonValido: avMotivoNonValido,
  // Tag (Fase 3.4)
  COLORI_TAG: AV_COLORI_TAG,
  chiaveTag: avChiaveTag,
  listaTag: avListaTag,
  tags: avTagsDi,
  unisciTag: avUnisciTag,
  scriviTags: avScriviTags,
  haTag: avHaTag,
  anagraficaTag: avAnagraficaTag,
  voceTag: avVoceTag,
  coloreTag: avColoreTag,
  impostaColoreTag: avImpostaColoreTag,
  registraTag: avRegistraTag,
  conteggiTag: avConteggiTag,
  rinominaTag: avRinominaTag,
  fondiTag: avFondiTag,
  eliminaTag: avEliminaTag,
  unisciAnagraficheTag: avUnisciAnagraficheTag,
  chiaveTesto: avChiaveTesto,
  // Vocabolari controllati (Fase 3.3)
  VOCABOLARI_PREDEFINITI: AV_VOCABOLARI_PREDEFINITI,
  vocabolari: avVocabolari,
  vocabolario: avVocabolario,
  valoriVocabolario: avValoriVocabolario,
  listaValori: avListaValori,
  idVocabolario: avIdVocabolario,
  salvaVocabolario: avSalvaVocabolario,
  aggiungiValoreVocabolario: avAggiungiValoreVocabolario,
  rinominaValoreVocabolario: avRinominaValoreVocabolario,
  eliminaValoreVocabolario: avEliminaValoreVocabolario,
  eliminaVocabolario: avEliminaVocabolario,
  campiDelVocabolario: avCampiDelVocabolario,
  unisciVocabolari: avUnisciVocabolari,
  // Duplicati (Fase 3.6)
  gruppiDuplicati: avGruppiDuplicati,
  // Relazioni e authority (Fase 3.5)
  relazioni: avRelazioniDi,
  scriviRelazioni: avScriviRelazioni,
  aggiungiRelazione: avAggiungiRelazione,
  rimuoviRelazione: avRimuoviRelazione,
  relazioniEntranti: avRelazioniEntranti,
  grafoRelazioni: avGrafoRelazioni,
  componentiGrafo: avComponentiGrafo,
  TIPI_AUTHORITY: AV_TIPI_AUTHORITY,
  authority: avAuthority,
  vociAuthority: avVociAuthority,
  chiaveAuthority: avChiaveAuthority,
  voceAuthority: avVoceAuthority,
  salvaVoceAuthority: avSalvaVoceAuthority,
  rinominaAuthority: avRinominaAuthority,
  unisciAuthority: avUnisciAuthority,
  // Merge campo per campo, snapshot e cestino (Fase 4)
  CHIAVI_NON_FUSE: AV_CHIAVI_NON_FUSE,
  fondiRecord: avFondiRecord,
  fondiCampiPropri: avFondiCampiPropri,
  SNAPSHOT_RECENTI: AV_SNAPSHOT_RECENTI,
  SNAPSHOT_GIORNI: AV_SNAPSHOT_GIORNI,
  giornoLocale: avGiornoLocale,
  rotazioneSnapshot: avRotazioneSnapshot,
  CESTINO_GIORNI: AV_CESTINO_GIORNI,
  cestinoValido: avCestinoValido
};

// Main (CommonJS) e renderer (script classico) prendono lo STESSO oggetto per strade
// diverse. Le due guardie sono indipendenti apposta: in un test `node` esiste solo la
// prima, nel bundle solo la seconda, e nessuna delle due deve poter far fallire l'altra.
// `module` è già dichiarato da @types/node: si accede via globalThis per non ridichiararlo
// e perché nel renderer non esiste affatto.
const avModuloCjs = typeof module !== 'undefined' ? module : null;
if (avModuloCjs && avModuloCjs.exports) avModuloCjs.exports = ArchiViewModel;
if (typeof window !== 'undefined') (window as any).Model = ArchiViewModel;
