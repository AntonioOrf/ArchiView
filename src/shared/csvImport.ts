const AV_DELIMITATORI = [',', ';', '\t', '|'];

function avSepDichiarato(testo: string): string | null {
  const m = /^sep=(.)\r?\n/.exec(testo || '');
  return m ? m[1] : null;
}

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

function avPrimaRigaLogica(testo: string): string {
  let inVirgolette = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (c === '"') inVirgolette = !inVirgolette;
    else if (!inVirgolette && (c === '\n' || c === '\r')) return testo.slice(0, i);
  }
  return testo;
}

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

function avAnalizzaCsv(testo: string, opzioni?: any): any {
  const o = opzioni || {};
  let t = String(testo == null ? '' : testo);
  const avvisi: string[] = [];

  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
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
  if (cella !== '' || riga.length > 0) { riga.push(cella); righe.push(riga); }
  if (inVirgolette) avvisi.push('virgolette_aperte');

  const utili = righe.filter(r => r.some(c => String(c).trim() !== ''));

  const iIntestazioni = typeof o.rigaIntestazioni === 'number' && o.rigaIntestazioni >= 0
    ? Math.min(o.rigaIntestazioni, Math.max(0, utili.length - 1))
    : avRigaIntestazioni(utili);

  const larghezza = utili.reduce((m, r) => Math.max(m, r.length), 0);
  const grezze = utili[iIntestazioni] || [];
  const intestazioni: string[] = [];
  for (let i = 0; i < larghezza; i++) {
    const pulita = String(grezze[i] == null ? '' : grezze[i]).trim();
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

function _ciModel(): any {
  if (typeof window !== 'undefined' && (window as any).Model) return (window as any).Model;
  if (typeof module !== 'undefined' && typeof require === 'function') return require('./model');
  return null;
}

function avChiaveIntestazione(t: any): string {
  const M = _ciModel();
  if (M && typeof M.chiaveTesto === 'function') return M.chiaveTesto(t);
  return String(t == null ? '' : t).trim().toLowerCase();
}

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
    if (!perChiave[avChiaveIntestazione(scelta)] && !perEtichetta[k]) {
      const esiste = (colonne || []).some(c => c && c.chiave === scelta);
      if (!esiste) return '';
    }
    usate.add(scelta);
    return scelta;
  });
}

function avRipulisciCella(grezzo: any): string {
  const t = grezzo === null || grezzo === undefined ? '' : String(grezzo);
  if (t.length > 1 && t[0] === "'") {
    const c = t[1];
    if (c === '=' || c === '+' || c === '@' || c === '\t' || c === '\r') return t.slice(1);
    if (c === '-' && !/^-\d/.test(t.slice(1))) return t.slice(1);
  }
  return t;
}

const AV_VERI = ['si', 'sì', 'true', 'vero', 'x', '1', 'yes', 'y', 's'];
const AV_FALSI = ['no', 'false', 'falso', '0', 'n', ''];

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
    const completo = /^(https?:\/\/|mailto:)/i.test(testo) ? testo
      : (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(testo) ? 'https://' + testo : testo);
    if (!/^(https?:\/\/|mailto:)/i.test(completo)) return { valore: testo, problema: 'url' };
    return { valore: completo, problema: null };
  }

  if (tipo === 'enum') {
    if (!testo) return { valore: '', problema: null };
    const opzioni = (def && def.opzioni) || [];
    const trovata = opzioni.find((o: any) => avChiaveIntestazione(o) === avChiaveIntestazione(testo));
    if (trovata) return { valore: trovata, problema: null };
    return { valore: testo, problema: 'opzione' };
  }

  return { valore: testo, problema: null };
}

const AV_BASE_IMPORT = ['segnatura', 'cartella', 'tags', 'tipoDocumento', 'trascrizione', 'id'];

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

  const defsCache = new Map<string, any>();
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
      for (const d of ctx.campiExtra || []) if (d && d.id) mappa[d.id] = d;
      defsCache.set(tipoId, mappa);
    }
    return defsCache.get(tipoId);
  };

  const schede: any[] = [];
  const esiti: any[] = [];
  const cartelleNuove = new Set<string>();
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

    let tipoId = tipoPredefinito;
    if (grezzo.tipoDocumento !== undefined && String(grezzo.tipoDocumento).trim() !== '') {
      const risolto = tipoPerChiave.get(avChiaveIntestazione(grezzo.tipoDocumento));
      if (risolto) tipoId = risolto;
      else problemi.push({ campo: 'tipoDocumento', codice: 'tipo_sconosciuto', valore: String(grezzo.tipoDocumento) });
    }
    const defs = defsDi(tipoId);

    const dati: any = { tipoDocumento: tipoId };
    for (const chiave of Object.keys(grezzo)) {
      if (chiave === 'tipoDocumento' || chiave === 'id') continue;
      if (chiave === 'segnatura' || chiave === 'trascrizione') {
        dati[chiave] = avRipulisciCella(grezzo[chiave]).trim();
        continue;
      }
      if (chiave === 'cartella') {
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

    const propriRiga: any[] = [];
    const delTipo = idsDelTipo.get(tipoId) || new Set<string>();
    for (const k of Object.keys(dati)) {
      if (k === 'tipoDocumento' || metaChiavi.has(k) || delTipo.has(k) || idsExtraWizard.has(k)) continue;
      const d = defs[k];
      propriRiga.push({ id: k, tipo: (d && d.tipo) || 'text', label: (d && d.label) || k });
    }

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

    const idIn = grezzo.id !== undefined ? String(grezzo.id).trim() : '';
    const chiaveSegn = avChiaveIntestazione(dati.segnatura);
    const gemella = (idIn && perId.get(idIn)) || (chiaveSegn ? perSegnatura.get(chiaveSegn) : null);

    if (gemella && ctx.aggiorna) {
      const patch: any = { id: gemella.id };
      for (const k of Object.keys(dati)) {
        if (k === 'tipoDocumento' && !grezzo.tipoDocumento) continue;
        if (k === 'cartella' && grezzo.cartella === undefined) continue;
        patch[k] = dati[k];
      }
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
  for (const d of campiPropri || []) {
    if (!d || !d.id || visti.has(d.id) || meta.has(d.id)) continue;
    visti.add(d.id);
    colonne.push({ chiave: d.id, etichetta: d.label || et[d.id] || d.id, base: false });
  }
  for (const d of campiExtra || []) {
    if (!d || !d.id || visti.has(d.id)) continue;
    visti.add(d.id);
    colonne.push({ chiave: d.id, etichetta: d.label || d.id, base: false, nuovo: true });
  }
  return colonne;
}

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
