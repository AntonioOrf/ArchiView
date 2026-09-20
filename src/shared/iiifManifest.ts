// Import IIIF — normalizzazione del manifest e costruzione delle carte.
//
// ⚠️ PERCHÉ QUESTO MODULO È CONDIVISO E PURO
//
// Stessa ragione di `csvImport.ts`: l'import ha un'anteprima, e l'anteprima vale solo se
// percorre lo stesso codice dell'import vero. Qui c'è una sola funzione che produce gli
// allegati (`avIiifCostruisciAllegati`) e il modale inserisce esattamente l'array che ha
// appena disegnato. Il main ne ha bisogno a sua volta per materializzare le carte, quindi il
// modulo vive in `src/shared/`: niente `import`/`export`, `module.exports` per il main sotto
// guardia e `window.IiifManifest` per il renderer.
//
// NON contiene i18n: restituisce CODICI di avviso (`collection`, `nessuna_carta`,
// `servizio_assente`, `versione_ignota`) e li traduce il renderer. Le etichette mancanti
// tornano come stringa vuota, non come "Carta N": comporre quella frase è del renderer, che
// sa in che lingua sta parlando.
//
// LE DUE VERSIONI DELLE SPECIFICHE, in breve, perché è tutta la complessità del file:
//   Presentation 2: manifest.sequences[0].canvases[].images[0].resource(.service), `@id`,
//                   label stringa o array di {'@value','@language'}.
//   Presentation 3: manifest.items[](Canvas).items[](AnnotationPage).items[](Annotation)
//                   .body(.service[]), `id`, label mappa di lingue {"it": ["…"]}.
// Sulla Image API la differenza che conta è una sola: la size "tutto" si scrive `full` in
// v2 e `max` in v3. La size vincolata `!w,h` è valida in entrambe, quindi tutte le richieste
// con un lato massimo non hanno bisogno di sapere quale versione stanno interrogando.

// --- Testo e etichette --------------------------------------------------------

/** L'ordine in cui si cerca una lingua nelle mappe della v3 prima di arrendersi alla prima. */
const AV_IIIF_LINGUE = ['it', 'en', 'la', 'fr', 'de', 'none', '@none'];

/**
 * Le entità HTML4 del blocco Latin-1, nell'ordine dei loro codepoint da 160 (`nbsp`) a 255
 * (`yuml`). Serve un decodificatore vero, non le quattro sostituzioni di comodo: i manifest
 * francesi, tedeschi e spagnoli sono pieni di `&egrave;`, `&uuml;`, `&ntilde;`, e un
 * "Biblioth&egrave;que nationale" stampato così in interfaccia è un difetto visibile.
 * L'elenco è un'unica stringa perché è un dato, non codice da leggere.
 */
const AV_IIIF_ENTITA_LATIN1 = (
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr ' +
  'deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest ' +
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ' +
  'ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig ' +
  'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml ' +
  'eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'
).split(' ');

/** Le entità fuori dal blocco Latin-1 che ricorrono davvero nelle attribuzioni. */
const AV_IIIF_ENTITA_ALTRE: { [nome: string]: string } = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…',
  trade: '™', euro: '€', bull: '•'
};

/**
 * L'attribuzione IIIF può contenere HTML (`<span>`, `<a>`: le biblioteche ci mettono il
 * link alla licenza). Qui si riduce a testo: viene mostrata come testo e basta, e una
 * stringa già ripulita non può diventare un innerHTML distratto in un punto qualsiasi
 * dell'interfaccia.
 *
 * ⚠️ I tag si tolgono DUE VOLTE, prima e dopo la decodifica delle entità: `&lt;script&gt;`
 * decodificato diventa un `<script>` testuale, e una sola passata lo restituirebbe intatto
 * a chi usa questa funzione credendola sicura. La seconda passata non è ridondante.
 */
function avIiifTestoSemplice(grezzo: any): string {
  if (typeof grezzo !== 'string') return '';
  return grezzo
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (intero: string, corpo: string) => {
      if (corpo[0] === '#') {
        const codice = corpo[1] === 'x' || corpo[1] === 'X'
          ? parseInt(corpo.slice(2), 16)
          : parseInt(corpo.slice(1), 10);
        // I codepoint fuori intervallo e i surrogati isolati si lasciano come sono: un
        // `String.fromCodePoint` su di essi solleva, e qui non deve sollevare niente.
        if (!Number.isFinite(codice) || codice < 32 || codice > 0x10ffff || (codice >= 0xd800 && codice <= 0xdfff)) return intero;
        return String.fromCodePoint(codice);
      }
      const nome = corpo.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(AV_IIIF_ENTITA_ALTRE, nome)) return AV_IIIF_ENTITA_ALTRE[nome];
      const i = AV_IIIF_ENTITA_LATIN1.indexOf(corpo);
      if (i >= 0) return i === 0 ? ' ' : String.fromCharCode(160 + i);
      return intero;
    })
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Risolve un'etichetta in tutte le forme che le due versioni ammettono:
 *   'Paris, BnF, lat. 1'            (v2, stringa)
 *   {'@value': '1r', '@language': 'it'}  oppure un array di quelli  (v2)
 *   {'it': ['1r'], 'en': ['f. 1r']} (v3, mappa di lingue)
 */
function avIiifEtichetta(valore: any): string {
  if (valore === null || valore === undefined) return '';
  if (typeof valore === 'string' || typeof valore === 'number') return avIiifTestoSemplice(String(valore));

  if (Array.isArray(valore)) {
    // v2 multilingua: si preferisce una lingua nota, altrimenti la prima voce utile.
    for (const lingua of AV_IIIF_LINGUE) {
      const trovato = valore.find((v: any) => v && v['@language'] === lingua && v['@value']);
      if (trovato) return avIiifTestoSemplice(trovato['@value']);
    }
    for (const v of valore) {
      const testo = avIiifEtichetta(v);
      if (testo) return testo;
    }
    return '';
  }

  if (typeof valore === 'object') {
    if (valore['@value']) return avIiifTestoSemplice(valore['@value']);
    // v3: mappa di lingue → array di stringhe.
    for (const lingua of AV_IIIF_LINGUE) {
      const voci = valore[lingua];
      if (Array.isArray(voci) && voci.length) return avIiifTestoSemplice(String(voci[0]));
      if (typeof voci === 'string' && voci) return avIiifTestoSemplice(voci);
    }
    for (const chiave of Object.keys(valore)) {
      const voci = valore[chiave];
      if (Array.isArray(voci) && voci.length) return avIiifTestoSemplice(String(voci[0]));
      if (typeof voci === 'string' && voci) return avIiifTestoSemplice(voci);
    }
  }
  return '';
}

/** `id` della v3, `@id` della v2. Nessuna risorsa IIIF usa entrambi con valori diversi. */
function avIiifId(nodo: any): string {
  if (!nodo || typeof nodo !== 'object') return '';
  const v = nodo.id || nodo['@id'] || '';
  return typeof v === 'string' ? v : '';
}

/** `type` della v3, `@type` della v2 (`sc:Manifest`, `sc:Collection`). */
function avIiifTipo(nodo: any): string {
  if (!nodo || typeof nodo !== 'object') return '';
  const v = nodo.type || nodo['@type'] || '';
  return typeof v === 'string' ? v.replace(/^sc:/, '') : '';
}

// --- Servizio immagine --------------------------------------------------------

/**
 * Il servizio Image API di una risorsa. Può essere un oggetto o un array, in entrambe le
 * versioni: la v3 lo dichiara array per contratto, ma molti server v2 lo pubblicano già
 * così, e alcuni manifest v3 incapsulano un ImageService2 con `@id` invece di `id`.
 * Si scarta ciò che non è un servizio immagine (in v3 accanto possono esserci un
 * SearchService o un AuthService, che non servono a caricare la carta).
 */
function avIiifServizio(risorsa: any): { id: string; apiVersione: 2 | 3 } | null {
  if (!risorsa || typeof risorsa !== 'object') return null;
  const grezzo = risorsa.service || risorsa.services;
  const candidati = Array.isArray(grezzo) ? grezzo : (grezzo ? [grezzo] : []);

  for (const s of candidati) {
    if (!s || typeof s !== 'object') continue;
    const id = avIiifId(s);
    if (!id) continue;

    const tipo = String(s.type || s['@type'] || '');
    const profilo = typeof s.profile === 'string' ? s.profile : String((s.profile && avIiifId(s.profile)) || '');
    const contesto = String(s['@context'] || '');
    const spia = tipo + ' ' + profilo + ' ' + contesto;

    // Servizi che non sono immagini: si ignorano, non si restituisce il primo della lista.
    if (/SearchService|AutoComplete|AuthCookieService|AuthTokenService|AuthAccessService/i.test(tipo)) continue;

    const immagine = /ImageService/i.test(tipo) || /\/api\/image\//.test(profilo) || /\/api\/image\//.test(contesto);
    if (!immagine && candidati.length > 1) continue;

    const apiVersione: 2 | 3 = (/ImageService3/i.test(tipo) || /\/api\/image\/3/.test(profilo) || /\/api\/image\/3/.test(contesto)) ? 3 : 2;
    return { id: id.replace(/\/info\.json$/, '').replace(/\/$/, ''), apiVersione };
  }
  return null;
}

/**
 * L'URL di una carta alla dimensione richiesta.
 *
 * ⚠️ LA SIZE È `w,` E NON `!w,h`. Sembrano equivalenti — entrambe mantengono le proporzioni —
 * ma `!w,h` è **livello 2** delle specifiche Image API, mentre `w,` è livello 1, cioè il
 * minimo che ogni server implementa. La differenza non è teorica: su iiif.bodleian.ox.ac.uk
 * `/full/!2000,2000/0/default.jpg` risponde 504 dopo cinquanta secondi, e
 * `/full/2000,/0/default.jpg` risponde 200 in un secondo. Era il motivo per cui le miniature
 * a 140 px comparivano e il visualizzatore a 2000 px restava vuoto: sembrava un problema di
 * CORS, era una size che il server non sa calcolare.
 *
 * `w,` vincola la sola larghezza e lascia l'altezza alle proporzioni: per una carta, che è
 * più alta che larga, è anche la misura che si vuole davvero.
 *
 * Senza `lato` si chiede la dimensione massima, e lì le due versioni divergono (`full`
 * contro `max`): è l'unico punto in cui `apiVersione` cambia qualcosa.
 */
function avIiifUrlImmagine(carta: any, opzioni?: { lato?: number }): string {
  if (!carta) return '';
  const lato = opzioni && opzioni.lato ? Math.max(1, Math.round(opzioni.lato)) : 0;
  if (!carta.serviceId) return carta.urlStatico || '';
  const misura = lato ? `${lato},` : (carta.apiVersione === 3 ? 'max' : 'full');
  return `${carta.serviceId}/full/${misura}/0/default.jpg`;
}

/**
 * Gli URL da tentare in ordine per una carta, dal più desiderabile al più sicuro.
 *
 * Un solo URL non basta: i server IIIF sono decine di implementazioni diverse, e quello che
 * non sa servire una misura risponde 400, 501 o 504 — mai "ecco l'immagine più vicina".
 * La catena è: la misura chiesta, poi la dimensione massima (che ogni server sa dare, al
 * prezzo di qualche megabyte in più), poi l'immagine statica dichiarata nel manifest, che è
 * l'unica cosa che i servizi di livello 0 sanno restituire.
 *
 * Chi consuma questa lista deve indicizzare la cache sul PRIMO elemento: è la richiesta
 * logica ("questa carta a questa misura"), mentre quello che si è riusciti a ottenere è un
 * dettaglio che non deve cambiare la chiave.
 */
function avIiifCandidati(carta: any, opzioni?: { lato?: number }): string[] {
  if (!carta) return [];
  const lato = opzioni && opzioni.lato ? Math.max(1, Math.round(opzioni.lato)) : 0;
  const urls: string[] = [];

  if (carta.serviceId) {
    if (lato) urls.push(avIiifUrlImmagine(carta, { lato }));
    urls.push(avIiifUrlImmagine(carta));
  }
  if (carta.urlStatico) urls.push(carta.urlStatico);

  return urls.filter((u, i) => u && urls.indexOf(u) === i);
}

// --- Estrazione delle carte ---------------------------------------------------

function avIiifNumero(valore: any): number {
  const n = Number(valore);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Una carta a partire dalla risorsa dipinta sul canvas (v2 `resource`, v3 `body`). */
function avIiifCarta(canvas: any, risorsa: any): any {
  const servizio = avIiifServizio(risorsa);
  const urlStatico = avIiifId(risorsa);
  return {
    canvasId: avIiifId(canvas),
    etichetta: avIiifEtichetta(canvas && canvas.label),
    serviceId: servizio ? servizio.id : null,
    apiVersione: servizio ? servizio.apiVersione : 0,
    urlStatico: urlStatico || null,
    formato: (risorsa && typeof risorsa.format === 'string') ? risorsa.format : '',
    larghezza: avIiifNumero(risorsa && risorsa.width) || avIiifNumero(canvas && canvas.width),
    altezza: avIiifNumero(risorsa && risorsa.height) || avIiifNumero(canvas && canvas.height)
  };
}

/** Presentation 2: `sequences[].canvases[].images[].resource`. */
function avIiifCarteV2(manifest: any): any[] {
  const carte: any[] = [];
  const sequenze = Array.isArray(manifest.sequences) ? manifest.sequences : [];
  for (const sequenza of sequenze) {
    const canvases = (sequenza && Array.isArray(sequenza.canvases)) ? sequenza.canvases : [];
    for (const canvas of canvases) {
      const immagini = (canvas && Array.isArray(canvas.images)) ? canvas.images : [];
      const dipinta = immagini.find((i: any) => i && i.resource) || immagini[0];
      if (!dipinta || !dipinta.resource) continue;
      carte.push(avIiifCarta(canvas, dipinta.resource));
    }
  }
  return carte;
}

/**
 * Presentation 3: `items[](Canvas).items[](AnnotationPage).items[](Annotation).body`.
 *
 * Il `body` può essere una `SpecificResource` (`{type:'SpecificResource', source:{…}}`) o una
 * `Choice` (`{type:'Choice', items:[…]}`, usata dalle biblioteche che pubblicano la stessa
 * carta a luce visibile e in ultravioletto): in entrambi i casi la risorsa vera è annidata, e
 * prenderla per buona così com'è darebbe una carta senza immagine.
 */
function avIiifRisolviBody(body: any): any {
  if (!body || typeof body !== 'object') return null;
  if (Array.isArray(body)) return avIiifRisolviBody(body[0]);
  const tipo = avIiifTipo(body);
  if (tipo === 'Choice' && Array.isArray(body.items)) return avIiifRisolviBody(body.items[0]);
  if (tipo === 'SpecificResource' && body.source) return avIiifRisolviBody(body.source);
  return body;
}

function avIiifCarteV3(manifest: any): any[] {
  const carte: any[] = [];
  const canvases = Array.isArray(manifest.items) ? manifest.items : [];
  for (const canvas of canvases) {
    if (!canvas || avIiifTipo(canvas) !== 'Canvas') continue;
    const pagine = Array.isArray(canvas.items) ? canvas.items : [];
    let risorsa = null;
    for (const pagina of pagine) {
      const annotazioni = (pagina && Array.isArray(pagina.items)) ? pagina.items : [];
      const dipinta = annotazioni.find((a: any) => a && a.motivation === 'painting' && a.body) || annotazioni.find((a: any) => a && a.body);
      if (dipinta) { risorsa = avIiifRisolviBody(dipinta.body); break; }
    }
    if (!risorsa) continue;
    carte.push(avIiifCarta(canvas, risorsa));
  }
  return carte;
}

// --- Normalizzazione ----------------------------------------------------------

/**
 * Da JSON grezzo a forma unica. Non solleva mai: un manifest storto è la norma, e il modale
 * deve poter mostrare *cosa* non va invece di una schermata vuota. Gli `avvisi` sono codici.
 */
function avIiifNormalizza(json: any): any {
  const vuoto = {
    versione: 0, id: '', etichetta: '', attribuzione: '', licenza: '',
    carte: [] as any[], avvisi: ['non_manifest'] as string[]
  };
  if (!json || typeof json !== 'object' || Array.isArray(json)) return vuoto;

  const tipo = avIiifTipo(json);
  const contesto = Array.isArray(json['@context']) ? json['@context'].join(' ') : String(json['@context'] || '');

  if (tipo === 'Collection') {
    // Non è un errore dell'utente: incollare l'URL di una collection è l'inciampo più comune,
    // e il numero di manifest contenuti è l'informazione che gli serve per capirlo.
    const contenuti = Array.isArray(json.items) ? json.items.length : (Array.isArray(json.manifests) ? json.manifests.length : 0);
    return {
      versione: /presentation\/3/.test(contesto) ? 3 : 2,
      id: avIiifId(json),
      etichetta: avIiifEtichetta(json.label),
      attribuzione: '', licenza: '', carte: [],
      contenuti,
      avvisi: ['collection']
    };
  }

  const avvisi: string[] = [];
  let versione: 2 | 3;
  if (/presentation\/3/.test(contesto)) versione = 3;
  else if (/presentation\/2/.test(contesto)) versione = 2;
  else if (Array.isArray(json.sequences)) versione = 2;
  else if (Array.isArray(json.items)) versione = 3;
  else return vuoto;

  if (!contesto) avvisi.push('versione_ignota');

  const carte = versione === 3 ? avIiifCarteV3(json) : avIiifCarteV2(json);
  if (!carte.length) avvisi.push('nessuna_carta');
  if (carte.length && carte.every((c: any) => !c.serviceId)) avvisi.push('servizio_assente');

  let attribuzione = '';
  if (versione === 3) {
    const rs = json.requiredStatement;
    attribuzione = rs ? avIiifEtichetta(rs.value) : '';
  } else {
    attribuzione = avIiifEtichetta(json.attribution);
  }

  const licenzaGrezza = versione === 3 ? json.rights : json.license;
  const licenza = Array.isArray(licenzaGrezza) ? avIiifEtichetta(licenzaGrezza) : avIiifTestoSemplice(String(licenzaGrezza || ''));

  return {
    versione,
    id: avIiifId(json),
    etichetta: avIiifEtichetta(json.label),
    attribuzione,
    licenza,
    carte,
    avvisi
  };
}

// --- Costruzione degli allegati -----------------------------------------------

/**
 * Il nome che il file avrà sul disco, deciso **all'import** e non alla materializzazione.
 *
 * Deterministico per due motivi. Primo: materializzare una carta non deve rinominare nulla
 * né toccare il record, solo far comparire il file al posto già riservato. Secondo: due
 * collaboratori che importano lo stesso manifest nella stessa scheda producono gli stessi
 * nomi, quindi la deduplicazione della sync li riconosce come un solo allegato invece di
 * caricare due copie della stessa carta con nomi diversi.
 *
 * La forma `<docId>_iiif_<NNNN>.jpg` è quella di `salva-allegato`
 * (`attachmentsIpc.ts`, `<documentoId>_<nome>`): i controlli su nome e path del resto
 * dell'applicazione continuano a valere senza eccezioni.
 */
function avIiifNomeAllegato(docId: string, indice: number, ripetizione?: number): string {
  const id = String(docId || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const coda = ripetizione && ripetizione > 1 ? `-${ripetizione}` : '';
  return `${id}_iiif_${String(indice + 1).padStart(4, '0')}${coda}.jpg`;
}

/**
 * Gli indici (0-based) descritti da un'espressione come `1-10, 25, 40-60`, riferita alla
 * numerazione che l'utente vede, cioè 1-based.
 *
 * Esiste perché un manifest di biblioteca contiene quasi sempre più del manoscritto: piatti
 * della legatura, dorso, regolo colorimetrico, carte di guardia. Su un codice di 500 carte
 * spuntarle a mano non è un'operazione, e `1-10, 25, 40-60` lo è.
 *
 * Tollerante per scelta: ignora i pezzi che non capisce e limita al totale, invece di
 * rifiutare l'intera espressione. Chi la scrive la sta scrivendo mentre la guarda, e un
 * campo che si svuota a metà digitazione è inutilizzabile.
 */
function avIiifIndiciDaIntervallo(testo: string, totale: number): number[] {
  const n = Math.max(0, Number(totale) || 0);
  const scelti = new Set<number>();
  const grezzo = String(testo || '').trim();
  if (!grezzo || !n) return [];

  for (const pezzo of grezzo.split(/[,;\n]+/)) {
    const p = pezzo.trim();
    if (!p) continue;

    const intervallo = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(p);
    if (intervallo) {
      // `40-10` è quasi certamente un lapsus, non una richiesta vuota: si ordina.
      let da = parseInt(intervallo[1], 10);
      let a = parseInt(intervallo[2], 10);
      if (da > a) { const t = da; da = a; a = t; }
      for (let i = Math.max(1, da); i <= Math.min(n, a); i++) scelti.add(i - 1);
      continue;
    }

    const aperto = /^(\d+)\s*[-–—]$/.exec(p);
    if (aperto) {
      for (let i = Math.max(1, parseInt(aperto[1], 10)); i <= n; i++) scelti.add(i - 1);
      continue;
    }

    const singolo = /^(\d+)$/.exec(p);
    if (singolo) {
      const i = parseInt(singolo[1], 10);
      if (i >= 1 && i <= n) scelti.add(i - 1);
    }
  }

  return Array.from(scelti).sort((a, b) => a - b);
}

/**
 * Le carte normalizzate diventano allegati REMOTI: hanno già il loro posto in
 * `allegati_manoscritti/`, ma il file non c'è. `remoto: true` è ciò che dice al renderer di
 * chiedere l'immagine a `iiif-img:` invece che a `local-asset:` e di non verificare un hash
 * che non esiste ancora.
 *
 * Nessun `hash`: comparirà alla materializzazione, ed è anche il segnale con cui il resto
 * dell'applicazione distingue una carta scaricata da una che è solo un riferimento.
 */
function avIiifCostruisciAllegati(carte: any[], docId: string, opzioni?: any): any[] {
  const elenco = Array.isArray(carte) ? carte : [];
  const opt = opzioni || {};

  // `indici` seleziona un sottoinsieme di carte mantenendo la NUMERAZIONE del manifest: la
  // carta 40 si chiama `_0040` anche se è la prima importata. Cosi' due colleghi che
  // importano sottoinsiemi diversi dello stesso codice non producono due nomi diversi per la
  // stessa carta, e la deduplicazione della sincronizzazione continua a funzionare.
  const indici = Array.isArray(opt.indici)
    ? opt.indici.filter((i: any) => Number.isInteger(i) && i >= 0 && i < elenco.length)
    : elenco.map((_: any, i: number) => i);

  const usati = new Set<string>(opt.nomiEsistenti || []);
  const fuori: any[] = [];

  for (const i of indici) {
    const c = elenco[i];
    if (!c) continue;

    // Reimportare una carta già presente è una richiesta legittima (l'utente la sta
    // duplicando); prendersi il suo nome non lo è, sovrascriverebbe il file dell'altra.
    let nome = avIiifNomeAllegato(docId, i);
    for (let r = 2; usati.has(nome); r++) nome = avIiifNomeAllegato(docId, i, r);
    usati.add(nome);

    fuori.push({
      nome,
      tipo: 'immagine',
      originalName: c.etichetta || nome,
      remoto: true,
      iiif: {
        canvasId: c.canvasId || '',
        serviceId: c.serviceId || null,
        apiVersione: c.apiVersione || 0,
        urlStatico: c.urlStatico || null,
        larghezza: c.larghezza || 0,
        altezza: c.altezza || 0
      }
    });
  }

  return fuori;
}

/** L'URL da cui prendere l'immagine di un allegato remoto. Speculare a `avIiifUrlImmagine`. */
function avIiifUrlAllegato(allegato: any, opzioni?: { lato?: number }): string {
  if (!allegato || !allegato.iiif) return '';
  return avIiifUrlImmagine(allegato.iiif, opzioni);
}

/** I ripieghi per un allegato remoto. Speculare a `avIiifCandidati`. */
function avIiifCandidatiAllegato(allegato: any, opzioni?: { lato?: number }): string[] {
  if (!allegato || !allegato.iiif) return [];
  return avIiifCandidati(allegato.iiif, opzioni);
}

const ArchiViewIiifManifest = {
  LINGUE: AV_IIIF_LINGUE,
  testoSemplice: avIiifTestoSemplice,
  etichetta: avIiifEtichetta,
  servizio: avIiifServizio,
  normalizza: avIiifNormalizza,
  urlImmagine: avIiifUrlImmagine,
  candidati: avIiifCandidati,
  urlAllegato: avIiifUrlAllegato,
  candidatiAllegato: avIiifCandidatiAllegato,
  nomeAllegato: avIiifNomeAllegato,
  indiciDaIntervallo: avIiifIndiciDaIntervallo,
  costruisciAllegati: avIiifCostruisciAllegati
};

const avModuloCjsIiif = typeof module !== 'undefined' ? module : null;
if (avModuloCjsIiif && avModuloCjsIiif.exports) avModuloCjsIiif.exports = ArchiViewIiifManifest;
if (typeof window !== 'undefined') (window as any).IiifManifest = ArchiViewIiifManifest;
