type AVAnnotazione = { id: string; xywh: [number, number, number, number]; testo?: string };

type AVAllegato = {
  nome: string;
  tipo: 'pdf' | 'immagine' | string;
  originalName?: string;
  hash?: string;
  trascrizione?: string;
  pagine?: string[];
  stato?: 'daTrascrivere' | 'trascritta' | 'rivista' | 'dubbio';
  annotazioni?: AVAnnotazione[];
  remoto?: true;
  iiif?: {
    canvasId: string;
    serviceId: string | null;
    apiVersione?: number;
    urlStatico: string | null;
    larghezza: number;
    altezza: number;
  };
};

type AVScheda = {
  id: string;
  cartella: string;
  tipoDocumento: string;
  segnatura?: string;
  tags?: string;
  allegati?: AVAllegato[];
  allegato?: string;
  allegatoTipo?: string;
  trascrizione?: string;
  lastModified?: number;
  creatoDa?: string;
  modificatoDa?: string;
  relazioni?: AVRelazione[];
  campiPropri?: AVCampoDef[];
  ordineCampi?: string[];
  [campo: string]: any;
};

type AVCampoDef = {
  id: string;
  tipo: string;
  label?: string;
  placeholder?: string;
  obbligatorio?: boolean;
  opzioni?: string[];
  vocabolario?: string;
  authority?: string;
  unico?: boolean;
};

type AVTipoDocumento = {
  id: string;
  nome: string;
  campi: string[];
  campiDef?: { [id: string]: AVCampoDef };
};

type AVDatabase = {
  schemaVersion?: number;
  cartelle: string[];
  manoscritti: AVScheda[];
  tipiDocumento: AVTipoDocumento[];
  deletedIds?: string[];
  deletedCartelle?: string[];
  baseObjects?: { [id: string]: AVScheda };
  tagsAnagrafica?: { [chiave: string]: AVVoceTag };
  vocabolari?: { [id: string]: AVVocabolario };
  authority?: { [chiave: string]: AVAuthority };
  [altro: string]: any;
};

type AVEsitoMigrazione = {
  db: AVDatabase;
  applicate: string[];
  futuro: boolean;
};

const ARCHIVIEW_SCHEMA_VERSION = 4;

const AV_CHIAVI_SERVIZIO = [
  'id', 'segnatura', 'tags', 'cartella', 'tipoDocumento', 'allegati', 'allegato',
  'allegatoTipo', 'lastModified', 'modificatoDa', 'creatoDa', 'trascrizione', 'schemaVersion',
  'relazioni',
  'campiPropri',
  'ordineCampi',
  'provenienza',
  'rimandiEsterni'
];

const AV_TIPO_PREDEFINITO = 'imbreviature';

const AV_TIPI_CAMPO = ['text', 'textarea', 'number', 'boolean', 'enum', 'url', 'date', 'dynamic_list', 'attachments'];

const AV_TIPI_CAMPO_SCEGLIBILI = ['text', 'textarea', 'number', 'boolean', 'enum', 'url', 'date', 'dynamic_list'];

function avTipoCampoValido(tipo: any): boolean {
  return typeof tipo === 'string' && AV_TIPI_CAMPO.indexOf(tipo) !== -1;
}

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
  if (!def.authority && base && base.authority) def.authority = String(base.authority);
  if (def.authority && AV_TIPI_AUTHORITY.indexOf(def.authority) === -1) delete def.authority;

  if (def.vocabolario) {
    const dalVocabolario = avValoriVocabolario(db, def.vocabolario);
    if (dalVocabolario.length) def.opzioni = dalVocabolario;
  }
  if (def.tipo === 'enum' && !def.vocabolario && (!def.opzioni || def.opzioni.length === 0)) def.tipo = 'text';
  return def;
}

function avCampiDelTipo(tipo: any, baseConf?: any, db?: any): AVCampoDef[] {
  const campi = (tipo && Array.isArray(tipo.campi)) ? tipo.campi : [];
  return campi.map((c: any) => avDefinizioneCampo(tipo, c, baseConf, db));
}

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
  return avOrdinaDefinizioni(definizioni, scheda && scheda.ordineCampi);
}

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

function avScriviOrdineCampi(scheda: any, ordine: any, naturali?: any[]): any {
  if (!scheda) return scheda;
  const puliti = avOrdineCampi({ ordineCampi: ordine });
  const attesi = (naturali || []).map((x: any) => String(x && x.id ? x.id : x));
  const filtrati = attesi.length ? puliti.filter(id => attesi.indexOf(id) !== -1) : puliti;
  const naturale = attesi.length && filtrati.length === attesi.length &&
    filtrati.every((id, i) => id === attesi[i]);
  if (filtrati.length && !naturale) scheda.ordineCampi = filtrati;
  else delete scheda.ordineCampi;
  return scheda;
}

function avCampiPropri(scheda: any): AVCampoDef[] {
  const grezzi = scheda && Array.isArray(scheda.campiPropri) ? scheda.campiPropri : [];
  const fuori: AVCampoDef[] = [];
  const visti = new Set<string>();
  for (const g of grezzi) {
    if (!g || typeof g !== 'object' || !g.id) continue;
    const def = avDefinizioneCampo(null, g);
    if (!def.id || visti.has(def.id)) continue;
    if (!def.label) def.label = def.id;
    visti.add(def.id);
    fuori.push(def);
  }
  return fuori;
}

function avScriviCampiPropri(scheda: any, definizioni: any[], tipo?: any): any {
  if (!scheda) return scheda;
  const delTipo = new Set(((tipo && Array.isArray(tipo.campi)) ? tipo.campi : []).map((c: any) => String(c && c.id ? c.id : c)));
  const puliti = avCampiPropri({ campiPropri: definizioni }).filter(d => !delTipo.has(d.id));
  if (puliti.length) scheda.campiPropri = puliti;
  else delete scheda.campiPropri;
  return scheda;
}

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

function avImpostaCampi(tipo: any, definizioni: any[]): AVTipoDocumento {
  const campi: string[] = [];
  const mappa: { [id: string]: AVCampoDef } = {};
  for (const grezza of definizioni || []) {
    const def = avDefinizioneCampo(null, grezza);
    if (!def.id || campi.indexOf(def.id) !== -1) continue;
    campi.push(def.id);
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

function avNormalizzaValore(def: any, grezzo: any): any {
  const tipo = def && def.tipo ? def.tipo : 'text';
  if (tipo === 'boolean') return grezzo === true || grezzo === 'true' || grezzo === 'on' || grezzo === 1;
  if (tipo === 'number') {
    if (grezzo === '' || grezzo === null || grezzo === undefined) return '';
    const n = typeof grezzo === 'number' ? grezzo : Number(String(grezzo).replace(',', '.').trim());
    return isFinite(n) ? n : String(grezzo);
  }
  if (tipo === 'dynamic_list' || tipo === 'attachments') return grezzo;
  return grezzo === null || grezzo === undefined ? '' : String(grezzo);
}

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

function avModelloPredefinito(id: any): any {
  for (const m of AV_MODELLI_PREDEFINITI) if (m.id === id) return m;
  return null;
}

function avApplicaModelliPredefiniti(db: any): boolean {
  if (!db) return false;
  if (!Array.isArray(db.tipiDocumento)) { db.tipiDocumento = []; }
  let cambiato = false;

  const senzaManoscritto = db.tipiDocumento.filter((t: any) => t && t.id !== 'manoscritto');
  if (senzaManoscritto.length !== db.tipiDocumento.length) { db.tipiDocumento = senzaManoscritto; cambiato = true; }

  for (let i = AV_MODELLI_PREDEFINITI.length - 1; i >= 0; i--) {
    const pref = AV_MODELLI_PREDEFINITI[i];
    const esistente = db.tipiDocumento.find((t: any) => t && t.id === pref.id);
    if (!esistente) {
      db.tipiDocumento.unshift({ id: pref.id, nome: pref.nome, campi: pref.campi.slice() });
      cambiato = true;
      continue;
    }
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

function avEArray(v: any): boolean {
  return Array.isArray(v);
}

function avVersioneDi(db: any): number {
  const v = db && db.schemaVersion;
  return typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function avRecordValidi(lista: any): { validi: any[]; scartati: number } {
  const voci = Array.isArray(lista) ? lista : [];
  const validi = voci.filter((m: any) => m && typeof m === 'object' && !Array.isArray(m)
    && ((typeof m.id === 'string' && m.id !== '') || (typeof m.id === 'number' && isFinite(m.id))));
  return { validi, scartati: voci.length - validi.length };
}

function avMotivoNonValido(db: any): string | null {
  if (!db || typeof db !== 'object' || Array.isArray(db)) return 'Il database non è un oggetto';
  if (!avEArray(db.manoscritti)) return 'Manca la collezione "manoscritti"';
  const { scartati } = avRecordValidi(db.manoscritti);
  if (scartati) return `${scartati} voci di "manoscritti" non valide (non oggetti o senza id)`;
  if (!avEArray(db.cartelle)) return 'Manca la collezione "cartelle"';
  if (db.tipiDocumento !== undefined && !avEArray(db.tipiDocumento)) return '"tipiDocumento" non è un elenco';
  if (db.strutturaCampi !== undefined && !avEArray(db.strutturaCampi)) return '"strutturaCampi" non è un elenco';
  if (db.deletedIds !== undefined && !avEArray(db.deletedIds)) return '"deletedIds" non è un elenco';
  return null;
}

function avDatabaseValido(db: any): boolean {
  return avMotivoNonValido(db) === null;
}

type AVVoceTag = {
  nome: string;
  colore?: string;
  modificato?: number;
};

const AV_COLORI_TAG = ['ambra', 'rosso', 'verde', 'blu', 'viola', 'grigio'];

function avChiaveTesto(t: any): string {
  return String(t === null || t === undefined ? '' : t)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼʹ′]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function avChiaveTag(t: any): string {
  return avChiaveTesto(t);
}

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

function avTagsDi(m: any): string[] {
  return avListaTag(m ? m.tags : '');
}

function avUnisciTag(lista: any): string {
  return avListaTag(lista).join(', ');
}

function avScriviTags(m: any, lista: any): boolean {
  if (!m) return false;
  const nuovo = avUnisciTag(lista);
  if (m.tags === nuovo) return false;
  m.tags = nuovo;
  return true;
}

function avHaTag(m: any, tag: any): boolean {
  const chiave = avChiaveTag(tag);
  if (!chiave) return false;
  for (const t of avTagsDi(m)) if (avChiaveTag(t) === chiave) return true;
  return false;
}

function avAnagraficaTag(db: any): { [chiave: string]: AVVoceTag } {
  return (db && db.tagsAnagrafica && typeof db.tagsAnagrafica === 'object') ? db.tagsAnagrafica : {};
}

function avVoceTag(db: any, tag: any): AVVoceTag | null {
  const chiave = avChiaveTag(tag);
  const voce = chiave ? avAnagraficaTag(db)[chiave] : null;
  return voce && typeof voce === 'object' ? voce : null;
}

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
    db.tagsAnagrafica[nuova].nome = nuovoNome;
    db.tagsAnagrafica[nuova].modificato = quando;
    anagraficaCambiata = true;
  }
  if (schede > 0) anagraficaCambiata = avRegistraTag(db, [nuovoNome]) || anagraficaCambiata;

  return { schede, cambiato: schede > 0 || anagraficaCambiata };
}

function avFondiTag(db: any, sorgenti: any, destinazione: any, opzioni?: any): { schede: number; cambiato: boolean } {
  const arrivo = avChiaveTag(destinazione);
  const toccate: { [id: string]: boolean } = {};
  let cambiato = false;
  for (const s of avListaTag(sorgenti)) {
    if (!arrivo || avChiaveTag(s) === arrivo) continue;
    for (const m of db.manoscritti || []) if (avHaTag(m, s)) toccate[String(m.id)] = true;
    if (avRinominaTag(db, s, destinazione, opzioni).cambiato) cambiato = true;
  }
  return { schede: Object.keys(toccate).length, cambiato };
}

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

type AVVocabolario = {
  id: string;
  nome: string;
  valori: string[];
  modificato?: number;
};

const AV_VOCABOLARI_PREDEFINITI: AVVocabolario[] = [
  { id: 'supporto', nome: 'Supporto', valori: ['pergamena', 'carta', 'papiro', 'palinsesto'] },
  { id: 'lingua', nome: 'Lingua', valori: ['latino', 'volgare', 'greco', 'ebraico'] },
  { id: 'scrittura', nome: 'Scrittura', valori: ['carolina', 'gotica', 'cancelleresca', 'mercantesca', 'umanistica', 'corsiva notarile'] },
  { id: 'tipo_di_atto', nome: 'Tipo di atto', valori: ['vendita', 'donazione', 'testamento', 'locazione', 'permuta', 'procura', 'quietanza', 'dote'] },
  { id: 'stato_conservazione', nome: 'Stato di conservazione', valori: ['ottimo', 'buono', 'discreto', 'mediocre', 'pessimo', 'lacunoso'] },
  { id: 'relazione', nome: 'Tipo di relazione', valori: ['stessa mano', 'stesso rogito', 'copia di', 'originale di', 'citato in', 'prosegue'] }
];

function avVocabolari(db: any): { [id: string]: AVVocabolario } {
  return (db && db.vocabolari && typeof db.vocabolari === 'object') ? db.vocabolari : {};
}

function avVocabolario(db: any, id: any): AVVocabolario | null {
  const v = avVocabolari(db)[String(id || '')];
  return v && typeof v === 'object' && Array.isArray(v.valori) ? v : null;
}

function avValoriVocabolario(db: any, id: any): string[] {
  const v = avVocabolario(db, id);
  return v ? avListaValori(v.valori) : [];
}

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

function avIdVocabolario(nome: any): string {
  return avChiaveTesto(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

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

function avRinominaValoreVocabolario(db: any, id: any, da: any, a: any, opzioni?: any): { schede: number; cambiato: boolean } {
  const voc = avVocabolario(db, id);
  const vecchia = avChiaveTesto(da);
  const nuovo = String(a === null || a === undefined ? '' : a).replace(/\s+/g, ' ').trim();
  if (!voc || !vecchia || !avChiaveTesto(nuovo)) return { schede: 0, cambiato: false };

  const opts = opzioni || {};
  const quando = typeof opts.quando === 'number' ? opts.quando : Date.now();

  const valori = avListaValori(voc.valori).map(v => (avChiaveTesto(v) === vecchia ? nuovo : v));
  voc.valori = avListaValori(valori);
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

type AVRelazione = {
  id: string;
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

type AVRimandoEsterno = { archivioId: string; schedaId: string; archivioNome?: string; segnatura?: string; tipo?: string };

function avRimandiEsterniDi(m: any): AVRimandoEsterno[] {
  const grezzi = m && Array.isArray(m.rimandiEsterni) ? m.rimandiEsterni : [];
  const out: AVRimandoEsterno[] = [];
  const visti: { [k: string]: boolean } = {};
  for (const r of grezzi) {
    if (!r || typeof r !== 'object') continue;
    const archivioId = String(r.archivioId || '').trim();
    const schedaId = String(r.schedaId || '').trim();
    if (!archivioId || !schedaId || visti[archivioId + '\u0000' + schedaId]) continue;
    visti[archivioId + '\u0000' + schedaId] = true;
    const x: AVRimandoEsterno = { archivioId, schedaId };
    for (const k of ['archivioNome', 'segnatura', 'tipo']) {
      const v = r[k] === null || r[k] === undefined ? '' : String(r[k]).trim();
      if (v) (x as any)[k] = v;
    }
    out.push(x);
  }
  return out;
}

function avScriviRimandiEsterni(m: any, lista: any): boolean {
  if (!m) return false;
  const nuovi = avRimandiEsterniDi({ rimandiEsterni: lista });
  const prima = JSON.stringify(avRimandiEsterniDi(m));
  if (nuovi.length === 0) {
    if (m.rimandiEsterni === undefined) return false;
    delete m.rimandiEsterni;
    return prima !== '[]';
  }
  if (JSON.stringify(nuovi) === prima && Array.isArray(m.rimandiEsterni)) return false;
  m.rimandiEsterni = nuovi;
  return true;
}

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
  nodi.sort((a, b) => (b.grado - a.grado) || a.id.localeCompare(b.id));
  return { nodi, archi };
}

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

type AVAuthority = {
  chiave: string;
  nome: string;
  tipo: string;
  note?: string;
  wikidata?: string;
  viaf?: string;
  varianti?: string[];
  modificato?: number;
};

const AV_ID_ESTERNI = { wikidata: /^Q[1-9]\d{0,11}$/, viaf: /^[1-9]\d{0,21}$/ };
const AV_MAX_VARIANTI = 30;

function avVariantiAuthority(v: any): string[] {
  const out: string[] = [];
  const viste = new Set<string>();
  for (const s of Array.isArray(v) ? v : []) {
    const t = String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 200);
    const k = t.toLowerCase();
    if (!t || viste.has(k)) continue;
    viste.add(k);
    out.push(t);
    if (out.length >= AV_MAX_VARIANTI) break;
  }
  return out;
}

const AV_TIPI_AUTHORITY = ['persona', 'luogo'];

function avAuthority(db: any): { [chiave: string]: AVAuthority } {
  return (db && db.authority && typeof db.authority === 'object') ? db.authority : {};
}

function avNomiAuthorityDelCampo(def: any, valore: any): string[] {
  if (!def || !def.authority) return [];
  if (def.tipo === 'dynamic_list') {
    if (!Array.isArray(valore)) return [];
    return valore.map((e: any) => String((e && (e.v !== undefined ? e.v : e.nome)) || '').trim()).filter(Boolean);
  }
  const s = String(valore === null || valore === undefined ? '' : valore).trim();
  return s ? [s] : [];
}

function avConCampiPropri(definizioni: any[], scheda: any): any[] {
  const propri = avCampiPropri(scheda);
  if (!propri.length) return definizioni;
  const visti = new Set((definizioni || []).map((d: any) => d && d.id));
  return (definizioni || []).concat(propri.filter(d => !visti.has(d.id)));
}

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

function avChiaveAuthority(tipo: any, nome: any): string {
  const k = avChiaveTesto(nome);
  return k ? String(tipo) + ':' + k : '';
}

function avVoceAuthority(db: any, tipo: any, nome: any): AVAuthority | null {
  const chiave = avChiaveAuthority(tipo, nome);
  const voce = chiave ? avAuthority(db)[chiave] : null;
  return voce && typeof voce === 'object' ? voce : null;
}

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
  const prima = db.authority[chiave];
  const note = d.note !== undefined ? String(d.note).trim() : (prima && prima.note) || '';
  if (note) voce.note = note;
  for (const k of Object.keys(AV_ID_ESTERNI) as Array<'wikidata' | 'viaf'>) {
    const id = String((d[k] !== undefined ? d[k] : prima && prima[k]) || '').trim();
    if (AV_ID_ESTERNI[k].test(id)) voce[k] = id;
  }
  const varianti = avVariantiAuthority(d.varianti !== undefined ? d.varianti : prima && prima.varianti);
  if (varianti.length) voce.varianti = varianti;
  const uguali = (k: string) => avUgualiJson((prima as any)[k], (voce as any)[k]);
  if (prima && ['nome', 'note', 'wikidata', 'viaf', 'varianti'].every(uguali)) return false;
  voce.modificato = Date.now();
  db.authority[chiave] = voce;
  return true;
}

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

  const chiaveVecchia = avChiaveAuthority(tipo, da);
  const chiaveNuova = avChiaveAuthority(tipo, nuovo);
  const ana = avAuthority(db);
  let anagraficaCambiata = false;
  if (chiaveVecchia !== chiaveNuova && ana[chiaveVecchia]) {
    const vecchiaVoce = ana[chiaveVecchia];
    const nuovaVoce: any = ana[chiaveNuova] || {};
    const note = nuovaVoce.note || vecchiaVoce.note;
    delete db.authority[chiaveVecchia];
    anagraficaCambiata = true;
    const esterni: any = {};
    if (!nuovaVoce.wikidata && !nuovaVoce.viaf) {
      for (const k of ['wikidata', 'viaf', 'varianti']) if ((vecchiaVoce as any)[k]) esterni[k] = (vecchiaVoce as any)[k];
    }
    avSalvaVoceAuthority(db, tipo, nuovo, { nome: nuovo, note: note || '', ...esterni });
  } else if (schede > 0 || ana[chiaveVecchia]) {
    anagraficaCambiata = avSalvaVoceAuthority(db, tipo, nuovo, { nome: nuovo }) || anagraficaCambiata;
  }

  return { schede, cambiato: schede > 0 || anagraficaCambiata };
}

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

function avNormalizzaScheda(m: any): AVScheda {
  if (!m || typeof m !== 'object') return m;
  if (typeof m.cartella !== 'string') m.cartella = '';
  if (!m.tipoDocumento || m.tipoDocumento === 'manoscritto') m.tipoDocumento = AV_TIPO_PREDEFINITO;
  if (m.allegati !== undefined && !Array.isArray(m.allegati)) m.allegati = [];
  return m as AVScheda;
}

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
  for (const k of Object.keys(d)) {
    if (base[k] === undefined) base[k] = d[k];
  }
  return base;
}

function avDatabaseVuoto(): AVDatabase {
  const db: any = {
    cartelle: [],
    manoscritti: [],
    tipiDocumento: AV_MODELLI_PREDEFINITI.map(m => ({ id: m.id, nome: m.nome, campi: m.campi.slice() }))
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

const AV_CHIAVI_NON_FUSE = ['lastModified', 'modificatoDa', 'creatoDa', 'allegatoTipo'];

function avUgualiJson(a: any, b: any): boolean {
  return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

function avFondiCampiPropri(base: any, locale: any, esterno: any): { definizioni: AVCampoDef[]; conflitto: boolean } {
  const lista = (x: any) => avCampiPropri({ campiPropri: x });
  const { elenco, conflitto } = avFondiPerId(lista(base), lista(locale), lista(esterno));
  return { definizioni: elenco, conflitto };
}

function avFondiPerId<T extends { id: string }>(base: T[], locale: T[], esterno: T[]): { elenco: T[]; conflitto: boolean } {
  const perId = (x: T[]) => {
    const m = new Map<string, T>();
    for (const d of x) m.set(d.id, d);
    return m;
  };
  const b = perId(base), l = perId(locale), e = perId(esterno);
  const elenco: T[] = [];
  let conflitto = false;
  const ordine = [...l.keys(), ...e.keys()];
  const visti = new Set<string>();
  for (const id of ordine) {
    if (visti.has(id)) continue;
    visti.add(id);
    const inB = b.has(id), inL = l.has(id), inE = e.has(id);
    if (inB && (!inL || !inE)) continue;
    const soloEsterno = inL && inE && inB && avUgualiJson(l.get(id), b.get(id));
    if (inL && inE && !soloEsterno && !avUgualiJson(l.get(id), e.get(id)) && !(inB && avUgualiJson(e.get(id), b.get(id)))) conflitto = true;
    elenco.push((inL && !soloEsterno ? l.get(id) : e.get(id)) as T);
  }
  return { elenco, conflitto };
}

function avAnnotazioni(a: any): AVAnnotazione[] {
  const grezze = a && Array.isArray(a.annotazioni) ? a.annotazioni : [];
  const out: AVAnnotazione[] = [];
  for (const r of grezze) {
    if (!r || typeof r.id !== 'string' || !r.id || !Array.isArray(r.xywh) || r.xywh.length !== 4) continue;
    if (!r.xywh.every((v: any) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)) continue;
    const [x, y, w, h] = r.xywh;
    if (!w || !h || x + w > 1.000001 || y + h > 1.000001) continue;
    const voce: AVAnnotazione = { id: r.id, xywh: [x, y, w, h] };
    if (typeof r.testo === 'string' && r.testo.trim()) voce.testo = r.testo;
    out.push(voce);
  }
  return out;
}

function avTestoAnnotazioni(m: any): string {
  let out = '';
  for (const a of (m && Array.isArray(m.allegati) ? m.allegati : [])) {
    for (const r of avAnnotazioni(a)) if (r.testo) out += r.testo + '\n';
  }
  return out;
}

function avFondiChiavi(b: any, l: any, e: any): { fuso: any; conflitti: string[] } {
  const fuso: any = { ...l };
  const conflitti: string[] = [];
  for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(e)])) {
    if (avUgualiJson(e[k], b[k])) continue;
    if (avUgualiJson(l[k], b[k])) {
      if (Object.prototype.hasOwnProperty.call(e, k)) fuso[k] = e[k]; else delete fuso[k];
    } else if (!avUgualiJson(l[k], e[k])) {
      conflitti.push(k);
    }
  }
  return { fuso, conflitti };
}

function avFondiAllegati(base: any, locale: any, esterno: any): { allegati: any[]; conflitto: boolean } {
  const perNome = (x: any) => {
    const m = new Map<string, any>();
    for (const a of Array.isArray(x) ? x : []) if (a && typeof a.nome === 'string') m.set(a.nome, a);
    return m;
  };
  const b = perNome(base), l = perNome(locale), e = perNome(esterno);
  const ordineLocaleInvariato = avUgualiJson([...l.keys()], [...b.keys()]);
  const ordine = ordineLocaleInvariato ? [...e.keys(), ...l.keys()] : [...l.keys(), ...e.keys()];
  const allegati: any[] = [];
  const visti = new Set<string>();
  let conflitto = false;
  for (const nome of ordine) {
    if (visti.has(nome)) continue;
    visti.add(nome);
    const inB = b.has(nome), inL = l.has(nome), inE = e.has(nome);
    if (inB && (!inL || !inE)) {
      const rimasta = inL ? l.get(nome) : (inE ? e.get(nome) : null);
      if (rimasta && !avUgualiJson(rimasta, b.get(nome))) {
        conflitto = true;
        if (inL) allegati.push(rimasta);
      }
      continue;
    }
    if (inL && inE) {
      const esito = avFondiChiavi(b.get(nome) || {}, l.get(nome), e.get(nome));
      const k = esito.conflitti.indexOf('annotazioni');
      if (k !== -1) {
        const r = avFondiPerId(avAnnotazioni(b.get(nome)), avAnnotazioni(l.get(nome)), avAnnotazioni(e.get(nome)));
        esito.conflitti.splice(k, 1);
        if (r.conflitto) esito.conflitti.push('annotazioni');
        if (r.elenco.length) esito.fuso.annotazioni = r.elenco; else delete esito.fuso.annotazioni;
      }
      if (esito.conflitti.length) conflitto = true;
      allegati.push(esito.fuso);
    } else {
      allegati.push(inL ? l.get(nome) : e.get(nome));
    }
  }
  return { allegati, conflitto };
}

function avTrascrizioneDerivata(m: any): boolean {
  return !!m && Array.isArray(m.allegati) && m.allegati.some((a: any) => a && typeof a.trascrizione === 'string');
}

function avFondiRecord(base: any, locale: any, esterno: any): { fuso: any; conflitti: string[] } {
  const b = base || {};
  const l = locale || {};
  const e = esterno || {};
  const fuso: any = { ...l };
  const conflitti: string[] = [];
  const derivata = avTrascrizioneDerivata(l) || avTrascrizioneDerivata(e);

  const chiavi = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(e)]);
  let daEsterno = false;
  for (const k of chiavi) {
    if (AV_CHIAVI_NON_FUSE.indexOf(k) !== -1) continue;

    if (k === 'allegati') {
      const { allegati, conflitto } = avFondiAllegati(b[k], l[k], e[k]);
      if (conflitto) conflitti.push(k);
      if (allegati.length || Object.prototype.hasOwnProperty.call(l, k) || Object.prototype.hasOwnProperty.call(e, k)) fuso[k] = allegati;
      else delete fuso[k];
      if (!avUgualiJson(e[k], b[k])) daEsterno = true;
      continue;
    }
    if (k === 'trascrizione' && derivata) {
      if (!avUgualiJson(e[k], b[k])) daEsterno = true;
      continue;
    }

    if (k === 'campiPropri') {
      const { definizioni, conflitto } = avFondiCampiPropri(b[k], l[k], e[k]);
      if (conflitto) conflitti.push(k);
      if (definizioni.length) fuso[k] = definizioni; else delete fuso[k];
      if (!avUgualiJson(e[k], b[k])) daEsterno = true;
      continue;
    }

    const cambiatoLocale = !avUgualiJson(l[k], b[k]);
    const cambiatoEsterno = !avUgualiJson(e[k], b[k]);

    if (!cambiatoEsterno) continue;
    if (!cambiatoLocale) {
      if (Object.prototype.hasOwnProperty.call(e, k)) fuso[k] = e[k];
      else delete fuso[k];
      daEsterno = true;
      continue;
    }
    if (avUgualiJson(l[k], e[k])) continue;
    conflitti.push(k);
  }

  if (!avUgualiJson(fuso.allegati, l.allegati)) fuso.allegatoTipo = e.allegatoTipo;

  fuso.lastModified = Math.max(l.lastModified || 0, e.lastModified || 0) || Date.now();
  if (daEsterno && e.modificatoDa) fuso.modificatoDa = e.modificatoDa;
  return { fuso, conflitti };
}

function avImprontaRecord(record: any): string | null {
  if (!record) return null;
  const r = { ...record };
  delete r.lastModified;
  delete r.modificatoDa;
  delete r.creatoDa;
  const ordinato: any = {};
  for (const k of Object.keys(r).sort()) ordinato[k] = r[k];
  return JSON.stringify(ordinato);
}

function avFondiTipi(base: any[] | undefined, locali: any[], esterni: any[], eliminati: Set<string>) {
  const perId = (x: any[] | undefined) => new Map<string, any>((x || []).filter((t: any) => t && t.id != null).map((t: any) => [t.id, t]));
  const B = base ? perId(base) : null, L = perId(locali), E = perId(esterni);
  const tipi: any[] = [];
  const conflitti: string[] = [];
  for (const id of new Set([...L.keys(), ...E.keys()])) {
    if (eliminati.has(id)) continue;
    const l = L.get(id), e = E.get(id), b = B ? B.get(id) : undefined;
    if (!l || !e) {
      const solo = l || e;
      if (b && avUgualiJson(solo, b)) continue;
      tipi.push(solo);
      continue;
    }
    const bb = b || l;
    const { fuso, conflitti: chiavi } = avFondiChiavi(bb, l, e);
    const bc: string[] = b ? (b.campi || []) : [];
    const lc: string[] = l.campi || [], ec: string[] = e.campi || [];
    fuso.campi = [
      ...lc.filter(c => ec.includes(c) || !bc.includes(c)),
      ...ec.filter(c => !lc.includes(c) && !bc.includes(c))
    ];
    const def = avFondiChiavi(b ? (b.campiDef || {}) : {}, l.campiDef || {}, e.campiDef || {});
    for (const c of Object.keys(def.fuso)) if (!fuso.campi.includes(c)) delete def.fuso[c];
    if (Object.keys(def.fuso).length) fuso.campiDef = def.fuso; else delete fuso.campiDef;
    if (b && (chiavi.some(k => k !== 'campi' && k !== 'campiDef') || def.conflitti.length)) conflitti.push(fuso.nome || id);
    tipi.push(fuso);
  }
  return { tipi, conflitti };
}

function avFondiMappa(base: any, locale: any, esterno: any, unisci: (l: any, e: any) => any) {
  const fuso = unisci(locale, esterno);
  if (!base || typeof base !== 'object') return fuso;
  const l = locale || {}, e = esterno || {};
  for (const k of Object.keys(base)) {
    const inL = Object.prototype.hasOwnProperty.call(l, k), inE = Object.prototype.hasOwnProperty.call(e, k);
    if (inL && inE) {
      if (Array.isArray(base[k] && base[k].valori) && fuso[k]) {
        const chiavi = (x: any) => new Set(avListaValori(x && x.valori).map(avChiaveTesto));
        const b = chiavi(base[k]), cl = chiavi(l[k]), ce = chiavi(e[k]);
        fuso[k].valori = avListaValori(fuso[k].valori).filter((v: any) => {
          const c = avChiaveTesto(v);
          return !(b.has(c) && (!cl.has(c) || !ce.has(c)));
        });
      }
      continue;
    }
    if (!inL && !inE) continue;
    if (avUgualiJson(inL ? l[k] : e[k], base[k])) delete fuso[k];
  }
  return fuso;
}

function avFondiDatabase(locale: any, esterno: any, risolte: any[] = []) {
  const l = locale || {};
  const e = esterno || {};

  const deletedCartelle = new Set<string>([...(l.deletedCartelle || []), ...(e.deletedCartelle || [])]);
  const cartelle = new Set<string>([...(l.cartelle || []), ...(e.cartelle || [])]);
  for (const c of deletedCartelle) cartelle.delete(c);

  const deletedTipi = new Set<string>([...(l.deletedTipi || []), ...(e.deletedTipi || [])]);
  const bS = l.baseStruttura || null;
  const tipi = avFondiTipi(bS ? bS.tipiDocumento : undefined, l.tipiDocumento, e.tipiDocumento, deletedTipi);

  const risolteMap = new Map<string, any>((risolte || []).map((r: any) => [r.id, r]));
  const localMap = new Map<string, any>((l.manoscritti || []).map((m: any) => [m.id, m]));
  const esternoMap = new Map<string, any>((e.manoscritti || []).map((m: any) => [m.id, m]));
  const eliminatiRemoti = new Set(e.deletedIds || []);
  const eliminatiLocali = new Set(l.deletedIds || []);
  const baseHashes = l.baseHashes || {};
  const baseObjects = l.baseObjects || {};

  const schede: any[] = [];
  const daRicomporre: any[] = [];
  const eliminateDalRemoto: any[] = [];
  const eliminateInLocale: any[] = [];

  for (const id of new Set([...localMap.keys(), ...esternoMap.keys()])) {
    if (risolteMap.has(id)) { schede.push(risolteMap.get(id)); continue; }
    const loc = localMap.get(id);
    const est = esternoMap.get(id);

    if (loc && est) {
      const base = baseObjects[id];
      if (base) {
        const fuso = avFondiRecord(base, loc, est).fuso;
        if (!avUgualiJson(fuso.allegati, loc.allegati)) daRicomporre.push(fuso);
        schede.push(fuso);
        continue;
      }
      const baseHash = baseHashes[id];
      if (!baseHash) {
        schede.push((loc.lastModified || 0) >= (est.lastModified || 0) ? loc : est);
        continue;
      }
      const hLoc = avImprontaRecord(loc);
      const hEst = avImprontaRecord(est);
      if (hLoc === hEst || hLoc === baseHash) schede.push(est);
      else schede.push(loc);
    } else if (loc) {
      (eliminatiRemoti.has(id) ? eliminateDalRemoto : schede).push(loc);
    } else if (est) {
      (eliminatiLocali.has(id) ? eliminateInLocale : schede).push(est);
    }
  }

  return {
    cartelle: Array.from(cartelle).sort(),
    deletedCartelle: Array.from(deletedCartelle),
    tagsAnagrafica: avFondiMappa(bS && bS.tagsAnagrafica, l.tagsAnagrafica, e.tagsAnagrafica, avUnisciAnagraficheTag),
    vocabolari: avFondiMappa(bS && bS.vocabolari, l.vocabolari, e.vocabolari, avUnisciVocabolari),
    authority: avFondiMappa(bS && bS.authority, l.authority, e.authority, avUnisciAuthority),
    tipiDocumento: tipi.tipi,
    deletedTipi: Array.from(deletedTipi),
    tipiInConflitto: tipi.conflitti,
    schede,
    daRicomporre,
    eliminateDalRemoto,
    eliminateInLocale
  };
}

const AV_SNAPSHOT_RECENTI = 10;
const AV_SNAPSHOT_GIORNI = 30;

function avGiornoLocale(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function avRotazioneSnapshot(voci: any[], opzioni?: any): { tenere: string[]; eliminare: string[] } {
  const o = opzioni || {};
  const recenti = typeof o.recenti === 'number' && o.recenti >= 0 ? o.recenti : AV_SNAPSHOT_RECENTI;
  const giorni = typeof o.giorni === 'number' && o.giorni >= 0 ? o.giorni : AV_SNAPSHOT_GIORNI;
  const ora = typeof o.ora === 'number' ? o.ora : Date.now();

  const lista = (voci || []).filter(v => v && v.nome).slice()
    .sort((a, b) => (b.creatoIl || 0) - (a.creatoIl || 0));

  const tenere = new Set<string>();
  for (let i = 0; i < Math.min(recenti, lista.length); i++) tenere.add(lista[i].nome);

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

const AV_CESTINO_GIORNI = 30;

function avCestinoValido(voci: any[], opzioni?: any): any[] {
  const o = opzioni || {};
  const giorni = typeof o.giorni === 'number' && o.giorni >= 0 ? o.giorni : AV_CESTINO_GIORNI;
  const ora = typeof o.ora === 'number' ? o.ora : Date.now();
  const soglia = ora - giorni * 86400000;
  return (voci || [])
    .filter(v => v && v.record && typeof v.deletedAt === 'number' && v.deletedAt > soglia)
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

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

        const conOggetti = tipo.campi.some((c: any) => c && typeof c === 'object');
        if (conOggetti) {
          avImpostaCampi(tipo, tipo.campi.map((c: any) => avDefinizioneCampo(tipo, c)));
          cambiato = true;
          continue;
        }

        if (!tipo.campiDef || typeof tipo.campiDef !== 'object') continue;
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
      let cambiato = false;
      if (!db.vocabolari || typeof db.vocabolari !== 'object') { db.vocabolari = {}; cambiato = true; }
      for (const pref of AV_VOCABOLARI_PREDEFINITI) {
        if (db.vocabolari[pref.id]) continue;
        db.vocabolari[pref.id] = { id: pref.id, nome: pref.nome, valori: pref.valori.slice() };
        cambiato = true;
      }
      if (!db.authority || typeof db.authority !== 'object') { db.authority = {}; cambiato = true; }
      return cambiato;
    }
  }
];

function avIdAStringa(db: any): number {
  let cambiati = 0;
  const comeStringa = (v: any) => (typeof v === 'number' ? (cambiati++, String(v)) : v);
  const scheda = (m: any) => {
    if (!m || typeof m !== 'object') return;
    m.id = comeStringa(m.id);
    if (Array.isArray(m.relazioni)) for (const r of m.relazioni) if (r && typeof r === 'object') r.id = comeStringa(r.id);
  };
  for (const m of Array.isArray(db.manoscritti) ? db.manoscritti : []) scheda(m);
  if (Array.isArray(db.deletedIds)) db.deletedIds = db.deletedIds.map(comeStringa);
  if (db.baseObjects && typeof db.baseObjects === 'object') for (const k of Object.keys(db.baseObjects)) scheda(db.baseObjects[k]);
  return cambiati;
}

function avMigraDatabase(grezzo: any): AVEsitoMigrazione {
  const applicate: string[] = [];

  let db: any = grezzo;
  if (Array.isArray(grezzo)) {
    db = { cartelle: [], manoscritti: grezzo, tipiDocumento: [] };
    applicate.push('Database "lista piatta" convertito in archivio con cartelle');
  } else if (!db || typeof db !== 'object') {
    db = { cartelle: [], manoscritti: [], tipiDocumento: [] };
    applicate.push('Database assente o illeggibile: creato vuoto');
  }

  if (Array.isArray(db.manoscritti)) {
    const { validi, scartati } = avRecordValidi(db.manoscritti);
    if (scartati) {
      db.manoscritti = validi;
      applicate.push(`${scartati} voci di "manoscritti" non valide scartate (non oggetti o senza id)`);
    }
  }

  const idConvertiti = avIdAStringa(db);
  if (idConvertiti) applicate.push(`${idConvertiti} id numerici portati a stringa`);

  const versione = avVersioneDi(db);
  if (versione > ARCHIVIEW_SCHEMA_VERSION) {
    return { db, applicate, futuro: true };
  }

  for (const migrazione of AV_MIGRAZIONI) {
    if (migrazione.versione <= versione) continue;
    const cambiato = migrazione.applica(db);
    if (cambiato) applicate.push(`v${migrazione.versione}: ${migrazione.descrizione}`);
  }

  if (db.schemaVersion !== ARCHIVIEW_SCHEMA_VERSION) {
    db.schemaVersion = ARCHIVIEW_SCHEMA_VERSION;
    if (versione !== 0 || applicate.length) applicate.push(`Versione dello schema portata a ${ARCHIVIEW_SCHEMA_VERSION}`);
    else applicate.push(`Versione dello schema iniziale (${ARCHIVIEW_SCHEMA_VERSION})`);
  }

  return { db, applicate, futuro: false };
}

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
  campiDellaScheda: avCampiDellaScheda,
  ordinaDefinizioni: avOrdinaDefinizioni,
  ordineCampi: avOrdineCampi,
  scriviOrdineCampi: avScriviOrdineCampi,
  campiPropri: avCampiPropri,
  annotazioni: avAnnotazioni,
  testoAnnotazioni: avTestoAnnotazioni,
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
  gruppiDuplicati: avGruppiDuplicati,
  relazioni: avRelazioniDi,
  scriviRelazioni: avScriviRelazioni,
  rimandiEsterni: avRimandiEsterniDi,
  scriviRimandiEsterni: avScriviRimandiEsterni,
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
  CHIAVI_NON_FUSE: AV_CHIAVI_NON_FUSE,
  fondiRecord: avFondiRecord,
  improntaRecord: avImprontaRecord,
  fondiDatabase: avFondiDatabase,
  recordValidi: avRecordValidi,
  fondiAllegati: avFondiAllegati,
  trascrizioneDerivata: avTrascrizioneDerivata,
  fondiCampiPropri: avFondiCampiPropri,
  SNAPSHOT_RECENTI: AV_SNAPSHOT_RECENTI,
  SNAPSHOT_GIORNI: AV_SNAPSHOT_GIORNI,
  giornoLocale: avGiornoLocale,
  rotazioneSnapshot: avRotazioneSnapshot,
  CESTINO_GIORNI: AV_CESTINO_GIORNI,
  cestinoValido: avCestinoValido
};

const avModuloCjs = typeof module !== 'undefined' ? module : null;
if (avModuloCjs && avModuloCjs.exports) avModuloCjs.exports = ArchiViewModel;
if (typeof window !== 'undefined') (window as any).Model = ArchiViewModel;
