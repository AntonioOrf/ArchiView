// Ricerca tra archivi, Fase 3: copia di una scheda da un altro archivio (shared/copiaScheda.ts).
const assert = require('assert');
const Model = require('../out/shared/model');
const Copia = require('../out/shared/copiaScheda');

const BASE = {
  dataTopica: { type: 'text', authority: 'luogo' },
  attori_dinamici: { type: 'dynamic_list', authority: 'persona' },
  note: { type: 'textarea' },
  condanne: { type: 'textarea' }
};
const ETICHETTE = { condanne: 'Condanne', dataTopica: 'Data topica', note: 'Note' };
const etichetta = (id) => ETICHETTE[id] || id;

function sorgente(extra) {
  return {
    archivio: { id: 'arch-A', nome: 'Giudiziario San Miniato', tipo: 'local' },
    tipo: {
      id: 'giudiziario', nome: 'Atti giudiziari',
      campi: ['attori_dinamici', 'dataTopica', 'note', 'condanne', 'stato'],
      campiDef: { stato: { id: 'stato', tipo: 'enum', vocabolario: 'stato_conservazione' } }
    },
    scheda: {
      id: 'a1', cartella: 'Podestà/1371', tipoDocumento: 'giudiziario', segnatura: 'Podestà 12, c. 3r',
      tags: 'azzardo, San Miniato', lastModified: 5, creatoDa: 'Collega', modificatoDa: 'Collega',
      attori_dinamici: [{ k: 'Imputato', v: 'Luca d’Abete' }, { k: 'Testimone', v: 'Nanni di Piero' }],
      dataTopica: 'San Miniato', note: "Gioco d'azzardo", condanne: 'Multa di 10 lire', stato: 'buono',
      vecchioCampo: 'rimasto da un tipo cambiato',
      relazioni: [{ id: 'a7', tipo: 'prosegue' }, { id: 'a9' }],
      ordineCampi: ['note', 'attori_dinamici'],
      trascrizione: '[c. 3r] Item Lucas de Abete',
      allegati: [
        { nome: 'a1_c3r.jpg', tipo: 'immagine', originalName: 'c3r.jpg', hash: 'vecchio', trascrizione: 'Item Lucas de Abete' },
        { nome: 'a1_c3v.jpg', tipo: 'immagine', originalName: 'c3v.jpg' },
        { nome: 'iiif_x.jpg', tipo: 'immagine', remoto: true, iiif: { canvasId: 'c', serviceId: 's', urlStatico: null, larghezza: 1, altezza: 1 } }
      ],
      ...(extra || {})
    },
    contesto: {
      vocabolari: { stato_conservazione: { id: 'stato_conservazione', nome: 'Stato', valori: ['ottimo', 'buono', 'pessimo'] } },
      authority: { "persona:nanni di piero": { chiave: 'persona:nanni di piero', nome: 'Nanni di Piero da Fucecchio', tipo: 'persona', note: 'Oste' } },
      segnatureRelazioni: { a7: 'Podestà 12, c. 4r' }
    }
  };
}

function destinazione() {
  return {
    schemaVersion: Model.SCHEMA_VERSION, cartelle: [], deletedIds: ['nuova-1'],
    tipiDocumento: [
      { id: 'notarile', nome: 'Notarile', campi: ['attori_dinamici', 'note'] },
      { id: 'giud2', nome: 'atti  GIUDIZIARI', campi: ['attori_dinamici', 'dataTopica', 'note'] }
    ],
    tagsAnagrafica: { azzardo: { nome: 'azzardo' } },
    authority: {},
    manoscritti: [
      { id: 'n1', tipoDocumento: 'notarile', segnatura: 'N1', attori_dinamici: [{ k: 'Teste', v: "Luca d'Abete" }], tags: '' }
    ]
  };
}

function opzioni(extra) {
  return { tipoDestinazione: 'notarile', cartella: 'Rogiti', autore: 'Io', ora: 1000, nuovoId: 'nuova-1',
    baseConf: BASE, etichetta, copiaAllegati: false, ...(extra || {}) };
}

console.log('Running copiaScheda tests...');

// 1. Tipo corrispondente: per id, poi per nome normalizzato, altrimenti nessuno.
const dest0 = destinazione();
assert.strictEqual(Copia.tipoCorrispondente({ id: 'notarile', nome: 'x' }, dest0.tipiDocumento), 'notarile');
assert.strictEqual(Copia.tipoCorrispondente(sorgente().tipo, dest0.tipiDocumento), 'giud2');
assert.strictEqual(Copia.tipoCorrispondente({ id: 'zz', nome: 'Estimo' }, dest0.tipiDocumento), null);
assert.strictEqual(Copia.tipoCorrispondente(null, dest0.tipiDocumento), null);

// 2. Tipo diverso: i campi che il notarile non ha diventano campi propri, nessun valore perso.
{
  const src = sorgente();
  const prima = JSON.stringify(src);
  const dest = destinazione();
  const p = Copia.pianifica(src, dest, opzioni());
  assert.strictEqual(JSON.stringify(src), prima, 'la sorgente non va toccata');
  const s = p.scheda;
  assert.strictEqual(s.id, 'nuova-1');
  assert.strictEqual(s.tipoDocumento, 'notarile');
  assert.strictEqual(s.cartella, 'Rogiti');
  assert.strictEqual(s.segnatura, 'Podestà 12, c. 3r');
  assert.deepStrictEqual([s.creatoDa, s.modificatoDa, s.lastModified], ['Io', 'Io', 1000]);
  assert.deepStrictEqual(s.attori_dinamici, src.scheda.attori_dinamici);
  assert.notStrictEqual(s.attori_dinamici, src.scheda.attori_dinamici, 'copia profonda');
  assert.strictEqual(s.condanne, 'Multa di 10 lire');
  assert.strictEqual(s.vecchioCampo, 'rimasto da un tipo cambiato');
  assert.deepStrictEqual(p.campiPropri.map(c => c.id).sort(), ['condanne', 'dataTopica', 'stato', 'vecchioCampo']);
  const propri = Object.fromEntries(Model.campiPropri(s).map(d => [d.id, d]));
  assert.strictEqual(propri.condanne.label, 'Condanne');
  assert.strictEqual(propri.condanne.tipo, 'textarea');
  assert.strictEqual(propri.dataTopica.authority, 'luogo', 'un campo persona/luogo resta tale');
  // Enum legato a un vocabolario della sorgente: opzioni scritte sopra, nessun legame.
  assert.deepStrictEqual([propri.stato.tipo, propri.stato.opzioni, propri.stato.vocabolario], ['enum', ['ottimo', 'buono', 'pessimo'], undefined]);
  assert.ok(p.avvisi.includes('vocabolario_esplicitato'));
  assert.deepStrictEqual(Object.keys(dest.vocabolari || {}), [], 'i vocabolari dell\'archivio aperto non si toccano');

  // Relazioni → rimandi esterni verso l'archivio sorgente; niente relazioni interne.
  assert.strictEqual(s.relazioni, undefined);
  assert.deepStrictEqual(s.rimandiEsterni, [
    { archivioId: 'arch-A', archivioNome: 'Giudiziario San Miniato', schedaId: 'a7', segnatura: 'Podestà 12, c. 4r', tipo: 'prosegue' },
    { archivioId: 'arch-A', archivioNome: 'Giudiziario San Miniato', schedaId: 'a9' }
  ]);
  assert.strictEqual(p.rimandi, 2);
  assert.deepStrictEqual(s.provenienza, { archivioId: 'arch-A', archivioNome: 'Giudiziario San Miniato', schedaId: 'a1', segnatura: 'Podestà 12, c. 3r', copiataIl: 1000 });
  // Le due chiavi nuove sono di servizio: fuori da CSV e stampa.
  assert.ok(Model.CHIAVI_SERVIZIO.includes('provenienza') && Model.CHIAVI_SERVIZIO.includes('rimandiEsterni'));

  // Ordine dei campi: si porta, limitato ai campi che esistono.
  assert.deepStrictEqual(s.ordineCampi, ['note', 'attori_dinamici']);

  // Anagrafica: Luca è già citato nell'archivio aperto, Nanni no; la voce di Nanni (grafia
  // scelta e note) arriva dalla sorgente. San Miniato (luogo) è nuovo.
  const ana = Object.fromEntries(p.anagrafica.map(a => [a.chiave, a.esistente]));
  assert.deepStrictEqual(ana, { "persona:luca d'abete": true, 'persona:nanni di piero': false, 'luogo:san miniato': false });
  assert.deepStrictEqual(p.vociNuove, [{ tipo: 'persona', nome: 'Nanni di Piero', grafia: 'Nanni di Piero da Fucecchio', note: 'Oste' }]);

  // Tag: "azzardo" esiste già, "San Miniato" no.
  assert.deepStrictEqual(p.tagNuovi, ['San Miniato']);

  // Senza allegati: le carte non arrivano, la trascrizione resta sulla scheda.
  assert.deepStrictEqual(s.allegati, []);
  assert.strictEqual(s.trascrizione, '[c. 3r] Item Lucas de Abete');
  assert.deepStrictEqual(p.allegati, { copiati: 0, remoti: 0, mancanti: 0, omessi: 3 });
  assert.ok(p.avvisi.includes('trascrizione_senza_allegati'));

  // Applica: unica scrittura, nell'archivio aperto.
  Copia.applica(dest, p);
  assert.strictEqual(dest.manoscritti.length, 2);
  assert.notStrictEqual(dest.manoscritti[1], p.scheda, 'si inserisce una copia del piano');
  assert.deepStrictEqual(dest.deletedIds, [], 'un id fra i tombstone verrebbe ricancellato al sync');
  assert.ok(dest.cartelle.includes('Rogiti'));
  assert.ok(dest.tagsAnagrafica['san miniato']);
  assert.strictEqual(dest.authority['persona:nanni di piero'].nome, 'Nanni di Piero da Fucecchio');
  assert.strictEqual(dest.authority['persona:nanni di piero'].note, 'Oste');
}

// 3. Stesso tipo (per nome): i campi del modello restano campi del modello.
{
  const dest = destinazione();
  const p = Copia.pianifica(sorgente(), dest, opzioni({ tipoDestinazione: 'giud2' }));
  assert.deepStrictEqual(p.campiPropri.map(c => c.id).sort(), ['condanne', 'stato', 'vecchioCampo']);
  assert.strictEqual(p.tipo.nome, 'atti  GIUDIZIARI');
}

// 4. Con gli allegati: copiati con il nome deciso dal main, le carte IIIF come riferimento,
//    quelli non copiati segnalati.
{
  const p = Copia.pianifica(sorgente(), destinazione(), opzioni({
    copiaAllegati: true,
    allegatiCopiati: { 0: { nome: 'nuova-1_c3r.jpg', hash: 'h0' } }
  }));
  const a = p.scheda.allegati;
  assert.deepStrictEqual(a.map(x => x.nome), ['nuova-1_c3r.jpg', 'iiif_x.jpg']);
  assert.strictEqual(a[0].hash, 'h0');
  assert.strictEqual(a[0].trascrizione, 'Item Lucas de Abete', 'la trascrizione della carta viaggia con la carta');
  assert.strictEqual(a[1].remoto, true);
  assert.strictEqual(p.scheda.allegato, 'nuova-1_c3r.jpg');
  assert.deepStrictEqual(p.allegati, { copiati: 1, remoti: 1, mancanti: 1, omessi: 0 });
  assert.ok(p.avvisi.includes('allegato_mancante'));
  assert.ok(!p.avvisi.includes('trascrizione_senza_allegati'));
}

// 5. Voce d'anagrafica già presente nell'archivio aperto: vince quella, nessuna voce nuova.
{
  const dest = destinazione();
  dest.authority = { 'persona:nanni di piero': { chiave: 'persona:nanni di piero', nome: 'Giovanni di Piero', tipo: 'persona' } };
  const p = Copia.pianifica(sorgente(), dest, opzioni());
  assert.deepStrictEqual(p.vociNuove, []);
  assert.strictEqual(p.anagrafica.find(x => x.chiave === 'persona:nanni di piero').esistente, true);
}

// 6. Scheda minima: nessun rimando, nessuna chiave vuota che cambierebbe l'impronta.
{
  const p = Copia.pianifica({ archivio: { id: 'B', nome: 'B' }, tipo: null, scheda: { id: 'x', segnatura: 'S' } }, destinazione(), opzioni());
  assert.strictEqual('rimandiEsterni' in p.scheda, false);
  assert.strictEqual('campiPropri' in p.scheda, false);
  assert.strictEqual('ordineCampi' in p.scheda, false);
  assert.strictEqual('trascrizione' in p.scheda, false);
  assert.deepStrictEqual(p.avvisi, []);
}

// 7. Nessuna forma derivata e nessun allegato copiato: la trascrizione si ricompone dalle carte.
{
  const src = sorgente({ trascrizione: undefined });
  src.scheda.allegati[1].trascrizione = '<p>Secunda carta</p>';
  const p = Copia.pianifica(src, destinazione(), opzioni());
  assert.ok(p.scheda.trascrizione.includes('Item Lucas de Abete'));
  assert.ok(p.scheda.trascrizione.includes('Secunda carta'));
  assert.ok(p.scheda.trascrizione.includes('[c3r.jpg]') && p.scheda.trascrizione.includes('[c3v.jpg]'), 'con più carte ogni passo dice da quale carta viene');
  assert.ok(p.avvisi.includes('trascrizione_senza_allegati'));
}

// 8. Alcune carte arrivano e altre no: il testo di quelle rimaste indietro va in un campo
//    proprio, perché la forma derivata verrà ricalcolata dalle sole carte presenti.
{
  const src = sorgente();
  src.scheda.allegati[1].trascrizione = '<p>Secunda<br>carta</p>';
  const p = Copia.pianifica(src, destinazione(), opzioni({ copiaAllegati: true, allegatiCopiati: { 0: { nome: 'n_c3r.jpg', hash: 'h' } } }));
  const campo = Copia.CAMPO_TRASCRIZIONI;
  assert.strictEqual(p.scheda[campo], ['[c3v.jpg]', 'Secunda', 'carta'].join('\n'));
  const def = Model.campiPropri(p.scheda).find(d => d.id === campo);
  assert.strictEqual(def.tipo, 'textarea');
  assert.ok(p.avvisi.includes('trascrizioni_in_campo'));
  assert.ok(p.campiPropri.some(c => c.id === campo));
}

// 9. Modello: normalizzazione e scrittura dei rimandi esterni.
{
  const grezzi = [
    { archivioId: ' A ', schedaId: '1', archivioNome: 'Fondo A', segnatura: 'S1', tipo: '' },
    { archivioId: 'A', schedaId: '1', segnatura: 'doppione' },
    { archivioId: '', schedaId: '2' }, null, 'x',
    { archivioId: 'B', schedaId: 7, tipo: 'citato in', extra: 'via' }
  ];
  assert.deepStrictEqual(Model.rimandiEsterni({ rimandiEsterni: grezzi }), [
    { archivioId: 'A', schedaId: '1', archivioNome: 'Fondo A', segnatura: 'S1' },
    { archivioId: 'B', schedaId: '7', tipo: 'citato in' }
  ]);
  const m = { id: 'x' };
  assert.strictEqual(Model.scriviRimandiEsterni(m, []), false);
  assert.strictEqual('rimandiEsterni' in m, false, 'elenco vuoto = chiave assente');
  assert.strictEqual(Model.scriviRimandiEsterni(m, grezzi), true);
  assert.strictEqual(m.rimandiEsterni.length, 2);
  assert.strictEqual(Model.scriviRimandiEsterni(m, grezzi), false, 'nessun cambiamento');
  assert.strictEqual(Model.scriviRimandiEsterni(m, []), true);
  assert.strictEqual('rimandiEsterni' in m, false);
}

console.log('copiaScheda tests passed.');
