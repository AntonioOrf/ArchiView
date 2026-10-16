const AV_IIIF_LINGUE = ['it', 'en', 'la', 'fr', 'de', 'none', '@none'];

const AV_IIIF_ENTITA_LATIN1 = (
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr ' +
  'deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest ' +
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ' +
  'ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig ' +
  'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml ' +
  'eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'
).split(' ');

const AV_IIIF_ENTITA_ALTRE: { [nome: string]: string } = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…',
  trade: '™', euro: '€', bull: '•'
};

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

function avIiifEtichetta(valore: any): string {
  if (valore === null || valore === undefined) return '';
  if (typeof valore === 'string' || typeof valore === 'number') return avIiifTestoSemplice(String(valore));

  if (Array.isArray(valore)) {
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

function avIiifId(nodo: any): string {
  if (!nodo || typeof nodo !== 'object') return '';
  const v = nodo.id || nodo['@id'] || '';
  return typeof v === 'string' ? v : '';
}

function avIiifTipo(nodo: any): string {
  if (!nodo || typeof nodo !== 'object') return '';
  const v = nodo.type || nodo['@type'] || '';
  return typeof v === 'string' ? v.replace(/^sc:/, '') : '';
}

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

    if (/SearchService|AutoComplete|AuthCookieService|AuthTokenService|AuthAccessService/i.test(tipo)) continue;

    const immagine = /ImageService/i.test(tipo) || /\/api\/image\//.test(profilo) || /\/api\/image\//.test(contesto);
    if (!immagine && candidati.length > 1) continue;

    const apiVersione: 2 | 3 = (/ImageService3/i.test(tipo) || /\/api\/image\/3/.test(profilo) || /\/api\/image\/3/.test(contesto)) ? 3 : 2;
    return { id: id.replace(/\/info\.json$/, '').replace(/\/$/, ''), apiVersione };
  }
  return null;
}

function avIiifUrlImmagine(carta: any, opzioni?: { lato?: number }): string {
  if (!carta) return '';
  const lato = opzioni && opzioni.lato ? Math.max(1, Math.round(opzioni.lato)) : 0;
  if (!carta.serviceId) return carta.urlStatico || '';
  const misura = lato ? `${lato},` : (carta.apiVersione === 3 ? 'max' : 'full');
  return `${carta.serviceId}/full/${misura}/0/default.jpg`;
}

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

function avIiifNumero(valore: any): number {
  const n = Number(valore);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

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

function avIiifNormalizza(json: any): any {
  const vuoto = {
    versione: 0, id: '', etichetta: '', attribuzione: '', licenza: '',
    carte: [] as any[], avvisi: ['non_manifest'] as string[]
  };
  if (!json || typeof json !== 'object' || Array.isArray(json)) return vuoto;

  const tipo = avIiifTipo(json);
  const contesto = Array.isArray(json['@context']) ? json['@context'].join(' ') : String(json['@context'] || '');

  if (tipo === 'Collection') {
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

function avIiifNomeAllegato(docId: string, indice: number, ripetizione?: number): string {
  const id = String(docId || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const coda = ripetizione && ripetizione > 1 ? `-${ripetizione}` : '';
  return `${id}_iiif_${String(indice + 1).padStart(4, '0')}${coda}.jpg`;
}

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

function avIiifCostruisciAllegati(carte: any[], docId: string, opzioni?: any): any[] {
  const elenco = Array.isArray(carte) ? carte : [];
  const opt = opzioni || {};

  const indici = Array.isArray(opt.indici)
    ? opt.indici.filter((i: any) => Number.isInteger(i) && i >= 0 && i < elenco.length)
    : elenco.map((_: any, i: number) => i);

  const usati = new Set<string>(opt.nomiEsistenti || []);
  const fuori: any[] = [];

  for (const i of indici) {
    const c = elenco[i];
    if (!c) continue;

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

function avIiifUrlAllegato(allegato: any, opzioni?: { lato?: number }): string {
  if (!allegato || !allegato.iiif) return '';
  return avIiifUrlImmagine(allegato.iiif, opzioni);
}

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
