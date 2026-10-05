// Ricerca tra archivi — prova di carico (PIANO-RICERCA-ARCHIVI.md, Fase 1, punto 9).
//
// 10 archivi × 5.000 schede con trascrizioni, attraverso il WORKER reale. Le soglie sono
// il segnale per cambiare backend: se una salta, si passa a un indice invertito dietro lo
// stesso contratto invece di ottimizzare la scansione lineare.
// Le soglie hanno margine per macchine lente e CI; i tempi misurati vengono stampati.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { IndiceWorker } = require('../out/main/crossArchive/client');

const ARCHIVI = 10;
const SCHEDE = 5000;
const SOGLIE = { primoCaricamento: 2000, ricercaCalda: 100, aggiornamentoUna: 300 };

const NOMI = ['Luca', 'Bartolo', 'Giovanni', 'Piero', 'Nanni', 'Cecco', 'Andrea', 'Bindo', 'Lapo', 'Vanni'];
const COGNOMI = ["d'Abete", 'di Ser Lapo', 'Bonaccorsi', 'del Pace', 'Ricoveri', 'da Pisa', 'Mannelli', 'Strozzi'];
const LUOGHI = ['San Miniato', 'Firenze', 'Prato', 'Pistoia', 'Empoli', 'Fucecchio', 'Pisa', 'Lucca'];
const PAROLE = 'item die predicto in civitate coram domino potestate comparuit dictus accusatus de ludo taxillorum contra formam statutorum et condempnatus fuit in libris decem denariorum'.split(' ');

let seme = 42;
// LCG in aritmetica a 32 bit: con la moltiplicazione in virgola mobile i bit bassi si
// azzerano e la sequenza collassa su poche parole, cioè su un testo irrealistico.
const caso = (n) => { seme = (Math.imul(seme, 1103515245) + 12345) >>> 0; return (seme >>> 8) % n; };
const frase = (n) => Array.from({ length: n }, () => PAROLE[caso(PAROLE.length)]).join(' ');

function generaArchivio(dir, a) {
  fs.mkdirSync(dir, { recursive: true });
  const manoscritti = [];
  for (let i = 0; i < SCHEDE; i++) {
    manoscritti.push({
      id: `a${a}-${i}`,
      tipoDocumento: i % 2 ? 'giudiziario' : 'notarile',
      segnatura: `Busta ${a}.${Math.floor(i / 100)}, c. ${i % 100}r`,
      lastModified: 1,
      attori_dinamici: [
        { k: 'Imputato', v: NOMI[caso(NOMI.length)] + ' ' + COGNOMI[caso(COGNOMI.length)] },
        { k: 'Testimone', v: NOMI[caso(NOMI.length)] + ' ' + COGNOMI[caso(COGNOMI.length)] }
      ],
      dataTopica: LUOGHI[caso(LUOGHI.length)],
      note: frase(30),
      trascrizione: frase(250)
    });
  }
  const db = {
    schemaVersion: 4, cartelle: [], manoscritti,
    tipiDocumento: [
      { id: 'giudiziario', nome: 'Giudiziario', campi: ['attori_dinamici', 'dataTopica', 'note'] },
      { id: 'notarile', nome: 'Notarile', campi: ['attori_dinamici', 'dataTopica', 'note'] }
    ]
  };
  fs.writeFileSync(path.join(dir, 'database_manoscritti.json'), JSON.stringify(db));
}

async function misura(fn) {
  const t = process.hrtime.bigint();
  const v = await fn();
  return { v, ms: Number(process.hrtime.bigint() - t) / 1e6 };
}

async function runTests() {
  console.log('Running crossArchiveBench tests...');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'av-bench-'));
  const w = new IndiceWorker({ inattivitaMs: 0 });
  try {
    const rif = [];
    for (let a = 0; a < ARCHIVI; a++) {
      const dir = path.join(tmp, 'Archivio ' + a);
      generaArchivio(dir, a);
      rif.push({ id: 'A' + a, percorso: dir });
    }
    const mb = rif.reduce((s, r) => s + fs.statSync(path.join(r.percorso, 'database_manoscritti.json')).size, 0) / 1048576;

    const primo = await misura(() => w.sincronizza(rif));
    assert.strictEqual(primo.v.reduce((s, x) => s + x.schede, 0), ARCHIVI * SCHEDE);
    assert.strictEqual(w.inRipiego, false);

    // Indice caldo: sincronizza (solo stat) + ricerca, cioè ciò che fa ogni ricerca dall'IPC.
    await w.cerca({ testo: 'riscaldamento' });
    const tempi = [];
    for (const q of ["luca d'abete", 'taxillorum condempnatus', 'san miniato', 'busta 3.12', 'parolachenonce']) {
      tempi.push((await misura(async () => { await w.sincronizza(rif); return w.cerca({ testo: q }); })).ms);
    }
    const anagrafica = await misura(() => w.cerca({ testo: "luca d'abete", soloAnagrafica: true }));
    assert.ok(anagrafica.v.totale > 0);
    const caldo = Math.max(...tempi, anagrafica.ms);

    // Una scheda modificata in un archivio: rilettura del file, una sola voce ricalcolata.
    const f = path.join(rif[3].percorso, 'database_manoscritti.json');
    const db = JSON.parse(fs.readFileSync(f, 'utf8'));
    db.manoscritti[10].note = 'parolanuovissima';
    db.manoscritti[10].lastModified = 2;
    fs.writeFileSync(f, JSON.stringify(db));
    const agg = await misura(() => w.sincronizza(rif));
    assert.strictEqual(agg.v.find(s => s.id === 'A3').ricostruite, 1);
    assert.strictEqual((await w.cerca({ testo: 'parolanuovissima' })).totale, 1);

    console.log(`  ${ARCHIVI}×${SCHEDE} schede, ${mb.toFixed(1)} MB: primo caricamento ${primo.ms.toFixed(0)} ms, ` +
      `ricerca calda max ${caldo.toFixed(1)} ms, aggiornamento di una scheda ${agg.ms.toFixed(0)} ms`);
    assert.ok(primo.ms < SOGLIE.primoCaricamento, `primo caricamento ${primo.ms.toFixed(0)} ms > ${SOGLIE.primoCaricamento}`);
    assert.ok(caldo < SOGLIE.ricercaCalda, `ricerca calda ${caldo.toFixed(1)} ms > ${SOGLIE.ricercaCalda}`);
    assert.ok(agg.ms < SOGLIE.aggiornamentoUna, `aggiornamento ${agg.ms.toFixed(0)} ms > ${SOGLIE.aggiornamentoUna}`);
    console.log('crossArchiveBench tests passed.');
  } finally {
    await w.chiudi();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

runTests().catch(e => { console.error(e); process.exit(1); });
