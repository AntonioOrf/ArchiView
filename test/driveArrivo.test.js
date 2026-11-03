const path = require('path');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const OUT = path.join(__dirname, '..', 'out', 'main');
function stub(rel, exports) {
  const id = require.resolve(path.join(OUT, rel));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ID = '20261009-100000-abcd';
const PAGINA = Buffer.from('pagina');
const MANIFEST = JSON.stringify({
  formato: 'archiview-scanner/lotto', versione: 1, id: ID, creatoIl: '2026-10-09T10:00:00+02:00',
  destinazione: { tipo: 'nessuna' },
  pagine: [{ file: 'p0001.png', sha256: sha(PAGINA), byte: PAGINA.length, modalita: 'documento' }]
});

let cartelle;
let figli;
let cestinate;
const drive = {
  files: {
    list: async ({ q }) => {
      const m = /'([^']+)' in parents/.exec(q);
      if (q.includes("name='lotto.json'")) {
        const out = [];
        for (const [padre, lista] of Object.entries(figli)) for (const f of lista) if (f.name === 'lotto.json') out.push({ id: f.id, parents: [padre] });
        return { data: { files: out } };
      }
      if (q.includes('mimeType=')) return { data: { files: cartelle } };
      return { data: { files: figli[m[1]] || [] } };
    },
    get: async () => ({ data: Buffer.from(MANIFEST) }),
    update: async ({ fileId }) => { if (fileId === 'rotta') throw new Error('rete'); cestinate.push(fileId); return {}; }
  }
};
stub('ipc/drive/auth.js', { driveState: { drive } });
stub('ipc/drive/fileOps.js', {
  getOrCreateFolder: async () => 'lotti', downloadFile: async (id, dest) => fs.writeFileSync(dest, PAGINA),
  withDriveRetry: (fn) => fn(), escapeDriveQuery: (s) => s
});
const { creaSorgenteDrive } = require(path.join(OUT, 'scanner', 'driveArrivo.js'));
const { riceviLotti } = require(path.join(OUT, 'scanner', 'arrivoLotti.js'));

async function ricevi() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'av-drive-arrivo-'));
  const sorgente = await creaSorgenteDrive();
  return riceviLotti({ sorgente, cartellaArrivo: path.join(base, 'arrivo'), cartellaTemp: path.join(base, 'tmp') });
}

(async () => {
  console.log('Running driveArrivo tests...');
  const pag = { id: 'pg', name: 'p0001.png', size: String(PAGINA.length) };

  cartelle = [{ id: 'f1', name: ID }];
  figli = { f1: [{ id: 'm1', name: 'lotto.json', size: '10' }, { id: 'm2', name: 'lotto.json', size: '10' }, pag] };
  cestinate = [];
  let esito = await ricevi();
  assert.deepStrictEqual(esito.ricevuti, [ID]);
  assert.deepStrictEqual(esito.falliti, []);
  assert.deepStrictEqual(cestinate, ['f1']);

  for (const ordine of [['vuota', 'piena'], ['piena', 'vuota']]) {
    cartelle = ordine.map(n => ({ id: n, name: ID }));
    figli = { piena: [{ id: 'm1', name: 'lotto.json', size: '10' }, pag], vuota: [] };
    cestinate = [];
    esito = await ricevi();
    assert.deepStrictEqual(esito.ricevuti, [ID], ordine.join());
    assert.deepStrictEqual(esito.falliti, []);
    assert.deepStrictEqual(esito.inCaricamento, []);
    assert.deepStrictEqual(cestinate.sort(), ['piena', 'vuota']);
  }

  cartelle = [{ id: 'a', name: ID }, { id: 'b', name: ID }];
  figli = { a: [], b: [] };
  esito = await ricevi();
  assert.deepStrictEqual(esito.inCaricamento, [ID]);

  cartelle = [{ id: 'rotta', name: ID }, { id: 'ok', name: ID }];
  figli = { rotta: [{ id: 'm1', name: 'lotto.json', size: '10' }, pag], ok: [] };
  cestinate = [];
  esito = await ricevi();
  assert.deepStrictEqual(esito.nonRimossi, [ID]);
  assert.deepStrictEqual(cestinate, ['ok']);

  console.log('✓ driveArrivo: duplicati di manifest e di cartella');
})().catch(e => { console.error(e); process.exit(1); });
