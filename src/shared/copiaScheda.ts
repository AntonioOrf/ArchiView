// Ricerca tra archivi — Fase 3: copia di una scheda da un altro archivio in quello aperto.
//
// ⚠️ PERCHÉ QUESTO MODULO È CONDIVISO E PURO (stessa ragione di csvImport.ts)
//
// La finestra di copia mostra che cosa succederà ("3 campi diventano campi propri", "1
// persona nuova in anagrafica"). Quell'anteprima vale solo se È la copia: `avcsPianifica`
// costruisce la scheda e il riepilogo insieme, e la conferma inserisce esattamente la scheda
// che l'anteprima ha appena descritto. Due funzioni diverse divergerebbero proprio sui casi
// storti — un campo legato a un vocabolario, un tipo che nell'archivio aperto non esiste.
//
// Vive in `src/shared/` perché la scheda va costruita dove stanno i dati dell'archivio
// aperto (`appData`, nel renderer) e testata in Node. Il main fa solo I/O: legge la scheda
// sorgente e copia i file allegati.
//
// Non ha `import`/`export` (è uno script): espone `module.exports` per il main e i test e
// `window.CopiaScheda` per il renderer. Nomi globali prefissati `avcs`: nel bundle e per
// TypeScript condividono lo scope di model.ts e csvImport.ts.
//
// NON contiene i18n: le etichette dei campi base arrivano da `opzioni.etichetta` (il
// renderer passa `etichettaCampo`), gli avvisi sono CODICI.

/** Il modello condiviso, nel main come nel renderer. */
function avcsModel(): any {
  if (typeof window !== 'undefined' && (window as any).Model) return (window as any).Model;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./model');
}

type AvcsSorgente = {
  scheda: any;
  tipo: any;
  archivio: { id: string; nome: string; tipo?: string };
  /** Dal main: vocabolari e voci d'anagrafica dell'archivio sorgente, segnature dei rimandi. */
  contesto?: {
    vocabolari?: { [id: string]: any };
    authority?: { [chiave: string]: any };
    segnatureRelazioni?: { [id: string]: string };
  };
};

type AvcsOpzioni = {
  /** Id del tipo documento dell'archivio aperto da usare. */
  tipoDestinazione: string;
  cartella: string;
  autore: string;
  ora: number;
  nuovoId: string;
  /** Catalogo dei campi base (CONFIG_CAMPI): etichette e tipi. */
  baseConf?: any;
  /** Etichetta leggibile di un campo base (i18n del renderer). */
  etichetta?: (id: string) => string;
  /** true = gli allegati vengono copiati; servono allora `allegatiCopiati`. */
  copiaAllegati: boolean;
  /** Esito della copia dei file (dal main): posizione dell'allegato → nuovo nome e hash. */
  allegatiCopiati?: { [posizione: number]: { nome: string; hash?: string } };
};

type AvcsPiano = {
  scheda: any;
  tipo: { id: string; nome: string };
  /** Campi del tipo sorgente che nell'archivio aperto diventano campi propri della scheda. */
  campiPropri: { id: string; label: string }[];
  /** Persone/luoghi citati: `esistente` = la chiave c'è già nell'anagrafica dell'archivio aperto. */
  anagrafica: { tipo: string; chiave: string; nome: string; esistente: boolean }[];
  /**
   * Voci d'anagrafica (grafia scelta, note) che la sorgente ha e l'archivio aperto no.
   * `nome` è il nome COME CITATO nella scheda, da cui deriva la chiave; `grafia` è quella scelta.
   */
  vociNuove: { tipo: string; nome: string; grafia: string; note?: string }[];
  tagNuovi: string[];
  rimandi: number;
  allegati: { copiati: number; remoti: number; mancanti: number; omessi: number };
  /**
   * Codici: 'vocabolario_esplicitato', 'allegato_mancante', 'trascrizione_senza_allegati',
   * 'trascrizioni_in_campo' (testo di carte non copiate messo in un campo proprio).
   */
  avvisi: string[];
};

const AVCS_CHIAVE_PROVENIENZA = 'provenienza';
const AVCS_CHIAVE_RIMANDI = 'rimandiEsterni';
/** Campo proprio che raccoglie le trascrizioni delle carte non copiate. */
const AVCS_CAMPO_TRASCRIZIONI = 'trascrizioni_non_copiate';

function avcsHaTesto(html: any): boolean {
  return typeof html === 'string' && html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
}

/**
 * Le trascrizioni delle carte in un solo testo, ciascuna preceduta dal nome della carta
 * quando sono più d'una (o sempre, con `intestaSempre`): senza, non si saprebbe di quale
 * carta è un passo.
 */
function avcsComponiCarte(carte: any[], intestaSempre?: boolean): string {
  const conTesto = carte.filter(a => a && avcsHaTesto(a.trascrizione));
  if (!conTesto.length) return '';
  if (conTesto.length === 1 && !intestaSempre) return conTesto[0].trascrizione;
  return conTesto.map(a => '<p><strong>[' + avcsEscape(a.originalName || a.nome || '') + ']</strong></p>' + a.trascrizione).join('\n');
}

function avcsEscape(t: string): string {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** HTML di una trascrizione → testo per una textarea: a capo dove c'erano paragrafi e righe. */
function avcsTestoSemplice(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Il tipo dell'archivio aperto che corrisponde a quello della sorgente: stesso id o stesso nome. */
function avcsTipoCorrispondente(tipoSorgente: any, tipiDestinazione: any[]): string | null {
  if (!tipoSorgente) return null;
  const Model = avcsModel();
  const tipi = Array.isArray(tipiDestinazione) ? tipiDestinazione : [];
  const perId = tipi.find(t => t && t.id === tipoSorgente.id);
  if (perId) return perId.id;
  const nome = Model.chiaveTesto(tipoSorgente.nome);
  const perNome = nome ? tipi.find(t => t && Model.chiaveTesto(t.nome) === nome) : null;
  return perNome ? perNome.id : null;
}

function avcsVuoto(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** I nomi d'anagrafica che un valore porta, secondo la definizione del campo. */
function avcsNomi(def: any, valore: any): string[] {
  if (!def || !def.authority) return [];
  if (def.tipo === 'dynamic_list') {
    if (!Array.isArray(valore)) return [];
    return valore.map((e: any) => String((e && (e.v !== undefined ? e.v : e.nome)) || '').trim()).filter(Boolean);
  }
  const s = String(valore === null || valore === undefined ? '' : valore).trim();
  return s ? [s] : [];
}

/**
 * Definizione di campo proprio per un campo della sorgente che il tipo di destinazione non ha.
 * Un campo legato a un vocabolario della sorgente diventa un `enum` con le opzioni scritte
 * sopra: i vocabolari dell'archivio aperto non si toccano, e un legame a un vocabolario che
 * qui non esiste darebbe una tendina vuota.
 */
function avcsDefPropria(def: any, etichetta: string, avvisi: Set<string>): any {
  const out: any = { id: def.id, tipo: def.tipo === 'attachments' ? 'text' : def.tipo, label: def.label || etichetta || def.id };
  if (def.placeholder) out.placeholder = def.placeholder;
  if (def.authority) out.authority = def.authority;
  if (def.tipo === 'enum') {
    const opzioni = Array.isArray(def.opzioni) ? def.opzioni.slice() : [];
    if (def.vocabolario) avvisi.add('vocabolario_esplicitato');
    if (opzioni.length) out.opzioni = opzioni;
    else out.tipo = 'text';
  }
  return out;
}

function avcsPianifica(sorgente: AvcsSorgente, destinazione: any, opzioni: AvcsOpzioni): AvcsPiano {
  const Model = avcsModel();
  const s = sorgente.scheda || {};
  const ctx = sorgente.contesto || {};
  const db = destinazione || {};
  const o = opzioni;
  const avvisi = new Set<string>();
  const etichetta = (id: string) => (o.etichetta ? o.etichetta(id) : '') || id;

  const tipoDest = (db.tipiDocumento || []).find((t: any) => t && t.id === o.tipoDestinazione) || null;
  // Definizioni della sorgente con i SUOI vocabolari: un enum legato a un vocabolario
  // trova lì le sue opzioni.
  const dbSorgente = { vocabolari: ctx.vocabolari || {} };
  const defsSorgente = Model.campiDellaScheda(s, sorgente.tipo, o.baseConf, dbSorgente);
  const defsDest = Model.campiDelTipo(tipoDest, o.baseConf, db);
  const idDest = new Set(defsDest.map((d: any) => d.id));

  const valori: any = {};
  const propri: any[] = [];
  const servizio = new Set(Model.CHIAVI_SERVIZIO.concat([AVCS_CHIAVE_PROVENIENZA, AVCS_CHIAVE_RIMANDI]));
  const viste = new Set<string>();
  const trasferisci = (id: string, def: any) => {
    if (viste.has(id) || servizio.has(id)) return;
    viste.add(id);
    const v = s[id];
    if (avcsVuoto(v)) return;
    valori[id] = JSON.parse(JSON.stringify(v));
    if (!idDest.has(id)) propri.push(avcsDefPropria(def || { id, tipo: Array.isArray(v) ? 'dynamic_list' : 'text' }, etichetta(id), avvisi));
  };
  for (const d of defsSorgente) if (d.tipo !== 'attachments') trasferisci(d.id, d);
  // Valori rimasti da un tipo cambiato: dati scritti dal ricercatore, si portano anche loro.
  for (const k of Object.keys(s)) trasferisci(k, null);

  // --- Allegati e trascrizione
  const allegati: any[] = [];
  const conteggi = { copiati: 0, remoti: 0, mancanti: 0, omessi: 0 };
  const origine = Array.isArray(s.allegati) ? s.allegati : [];
  // Carte che restano indietro con una trascrizione: il testo non deve andare perso con loro.
  const lasciate: any[] = [];
  if (o.copiaAllegati) {
    origine.forEach((a: any, i: number) => {
      if (!a) return;
      if (a.remoto) {
        // Una carta IIIF è un riferimento a un server, non un file: si copia com'è.
        allegati.push(JSON.parse(JSON.stringify(a)));
        conteggi.remoti++;
        return;
      }
      const nuovo = o.allegatiCopiati && o.allegatiCopiati[i];
      if (!nuovo) { conteggi.mancanti++; avvisi.add('allegato_mancante'); lasciate.push(a); return; }
      const copia = JSON.parse(JSON.stringify(a));
      copia.nome = nuovo.nome;
      if (nuovo.hash) copia.hash = nuovo.hash; else delete copia.hash;
      allegati.push(copia);
      conteggi.copiati++;
    });
  } else {
    conteggi.omessi = origine.filter((a: any) => a).length;
    for (const a of origine) if (a) lasciate.push(a);
  }

  const scheda = Model.creaScheda({
    ...valori,
    id: o.nuovoId,
    cartella: o.cartella || '',
    tipoDocumento: o.tipoDestinazione,
    segnatura: typeof s.segnatura === 'string' ? s.segnatura : '',
    tags: Model.unisciTag(Model.tags(s)),
    allegati,
    allegato: allegati.length ? allegati[0].nome : '',
    allegatoTipo: allegati.length ? allegati[0].tipo || '' : '',
    lastModified: o.ora,
    creatoDa: o.autore,
    modificatoDa: o.autore
  });
  // Trascrizione. Con gli allegati vive nelle carte; senza, resta sulla scheda (regola di
  // `leggiTrascrizioneAllegato`: niente allegati = trascrizione della scheda). Si porta la
  // forma derivata se c'è, altrimenti la si ricompone dalle carte: una scheda con il testo
  // solo nelle carte, copiata senza allegati, lo perderebbe.
  const carteConTesto = lasciate.filter(a => avcsHaTesto(a.trascrizione));
  if (!allegati.length) {
    const testo = avcsHaTesto(s.trascrizione) ? s.trascrizione : avcsComponiCarte(carteConTesto);
    if (testo) {
      scheda.trascrizione = testo;
      if (origine.length) avvisi.add('trascrizione_senza_allegati');
    }
  } else {
    if (avcsHaTesto(s.trascrizione)) scheda.trascrizione = s.trascrizione;
    // Alcune carte arrivano, altre no: la forma derivata verrà ricalcolata dalle carte
    // presenti al primo salvataggio, quindi il testo delle carte rimaste indietro va messo
    // in un campo proprio, dove nessun ricalcolo lo tocca.
    if (carteConTesto.length) {
      valori[AVCS_CAMPO_TRASCRIZIONI] = avcsTestoSemplice(avcsComponiCarte(carteConTesto, true));
      scheda[AVCS_CAMPO_TRASCRIZIONI] = valori[AVCS_CAMPO_TRASCRIZIONI];
      propri.push({ id: AVCS_CAMPO_TRASCRIZIONI, tipo: 'textarea', label: etichetta(AVCS_CAMPO_TRASCRIZIONI) });
      avvisi.add('trascrizioni_in_campo');
    }
  }

  Model.scriviCampiPropri(scheda, propri, tipoDest);
  if (Array.isArray(s.ordineCampi)) {
    Model.scriviOrdineCampi(scheda, s.ordineCampi, Model.campiDellaScheda(Object.assign({}, scheda, { ordineCampi: undefined }), tipoDest, o.baseConf, db));
  }

  // --- Rimandi: le relazioni della sorgente puntano a schede di QUELL'archivio
  const rimandi = Model.relazioni(s).map((r: any) => {
    const x: any = { archivioId: sorgente.archivio.id, archivioNome: sorgente.archivio.nome, schedaId: r.id };
    const seg = ctx.segnatureRelazioni && ctx.segnatureRelazioni[r.id];
    if (seg) x.segnatura = seg;
    if (r.tipo) x.tipo = r.tipo;
    return x;
  });
  Model.scriviRimandiEsterni(scheda, rimandi);

  scheda[AVCS_CHIAVE_PROVENIENZA] = {
    archivioId: sorgente.archivio.id,
    archivioNome: sorgente.archivio.nome,
    schedaId: String(s.id),
    segnatura: typeof s.segnatura === 'string' ? s.segnatura : '',
    copiataIl: o.ora
  };

  // --- Anagrafica: calcolata sulle definizioni FINALI, cioè su ciò che l'archivio aperto
  // leggerà davvero (un campo persona nella sorgente può non esserlo qui, e viceversa).
  const defsFinali = Model.campiDellaScheda(scheda, tipoDest, o.baseConf, db);
  const anaDest = Model.authority(db);
  const anaSorg = ctx.authority || {};
  const conosciute = new Set<string>();
  for (const m of db.manoscritti || []) {
    if (!m) continue;
    const tm = (db.tipiDocumento || []).find((t: any) => t && t.id === m.tipoDocumento) || null;
    for (const d of Model.campiDellaScheda(m, tm, o.baseConf, db)) {
      for (const n of avcsNomi(d, m[d.id])) conosciute.add(Model.chiaveAuthority(d.authority, n));
    }
  }
  const anagrafica: AvcsPiano['anagrafica'] = [];
  const vociNuove: AvcsPiano['vociNuove'] = [];
  for (const d of defsFinali) {
    for (const nome of avcsNomi(d, scheda[d.id])) {
      const chiave = Model.chiaveAuthority(d.authority, nome);
      if (!chiave || anagrafica.some(a => a.chiave === chiave)) continue;
      const esistente = !!anaDest[chiave] || conosciute.has(chiave);
      anagrafica.push({ tipo: d.authority, chiave, nome, esistente });
      // La grafia scelta e le note della sorgente si portano solo se qui la voce non c'è:
      // l'anagrafica dell'archivio aperto vince sempre sulla sua.
      const voce = anaSorg[chiave];
      if (!anaDest[chiave] && voce && (voce.nome !== nome || voce.note)) {
        const v: any = { tipo: d.authority, nome, grafia: voce.nome || nome };
        if (voce.note) v.note = voce.note;
        vociNuove.push(v);
      }
    }
  }

  const tagNoti = new Set(Object.keys(db.tagsAnagrafica || {}));
  for (const m of db.manoscritti || []) for (const t of Model.tags(m)) tagNoti.add(Model.chiaveTag(t));
  const tagNuovi = Model.tags(scheda).filter((t: string) => !tagNoti.has(Model.chiaveTag(t)));

  return {
    scheda,
    tipo: { id: o.tipoDestinazione, nome: tipoDest && tipoDest.nome ? tipoDest.nome : o.tipoDestinazione },
    campiPropri: Model.campiPropri(scheda).map((d: any) => ({ id: d.id, label: d.label || d.id })),
    anagrafica,
    vociNuove,
    tagNuovi,
    rimandi: rimandi.length,
    allegati: conteggi,
    avvisi: Array.from(avvisi)
  };
}

/**
 * Applica il piano all'archivio aperto (muta `db`). È l'unica scrittura: inserisce la scheda
 * del piano, registra i tag e le voci d'anagrafica nuove. Il salvataggio su disco resta del
 * chiamante (`Store.commit`).
 */
function avcsApplica(db: any, piano: AvcsPiano): void {
  const Model = avcsModel();
  if (!db || !piano || !piano.scheda) return;
  if (!Array.isArray(db.manoscritti)) db.manoscritti = [];
  db.manoscritti.push(JSON.parse(JSON.stringify(piano.scheda)));
  if (Array.isArray(db.deletedIds)) db.deletedIds = db.deletedIds.filter((x: any) => String(x) !== String(piano.scheda.id));
  if (piano.scheda.cartella && Array.isArray(db.cartelle) && db.cartelle.indexOf(piano.scheda.cartella) === -1) {
    db.cartelle.push(piano.scheda.cartella);
  }
  Model.registraTag(db, Model.tags(piano.scheda));
  // La chiave viene dal nome citato, la grafia mostrata da `grafia`: passare la grafia come nome
  // creerebbe la voce sotto una chiave che nessuna scheda cita.
  for (const v of piano.vociNuove) Model.salvaVoceAuthority(db, v.tipo, v.nome, v.note ? { nome: v.grafia, note: v.note } : { nome: v.grafia });
}

const ArchiViewCopiaScheda = {
  CHIAVE_PROVENIENZA: AVCS_CHIAVE_PROVENIENZA,
  CHIAVE_RIMANDI: AVCS_CHIAVE_RIMANDI,
  CAMPO_TRASCRIZIONI: AVCS_CAMPO_TRASCRIZIONI,
  tipoCorrispondente: avcsTipoCorrispondente,
  pianifica: avcsPianifica,
  applica: avcsApplica
};

const avModuloCjsCopia = typeof module !== 'undefined' ? module : null;
if (avModuloCjsCopia && avModuloCjsCopia.exports) avModuloCjsCopia.exports = ArchiViewCopiaScheda;
if (typeof window !== 'undefined') (window as any).CopiaScheda = ArchiViewCopiaScheda;
