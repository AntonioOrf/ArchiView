const assert = require('assert');
const D = require('../out/shared/dataStorica');

function letta(testo) {
  const d = D.analizza(testo);
  return [d.da, d.a, d.qualificatore, d.riconosciuta];
}

{
  for (const forma of ['12 maggio 1340', '12 magg. 1340', '12 di maggio 1340', '1340 maggio 12',
                       '12/5/1340', '12-05-1340', '1340-05-12']) {
    assert.deepStrictEqual(letta(forma), [13400512, 13400512, 'esatta', true], forma);
  }
  assert.deepStrictEqual(letta('12 maii 1340'), [13400512, 13400512, 'esatta', true]);
  assert.deepStrictEqual(letta('31 aprile 1340'), [13400401, 13400430, 'anno', true]);
}

{
  assert.deepStrictEqual(letta('1340'), [13400101, 13401231, 'anno', true]);
  assert.deepStrictEqual(letta('maggio 1340'), [13400501, 13400531, 'anno', true]);
  assert.deepStrictEqual(letta('1340 maggio'), [13400501, 13400531, 'anno', true]);
  assert.strictEqual(D.analizza('febbraio 1340').a, 13400229);
  assert.strictEqual(D.analizza('febbraio 1341').a, 13410228);
}

{
  for (const forma of ['c. 1340', 'ca. 1340', 'circa 1340', 'verso il 1340', 'intorno al 1340']) {
    const d = D.analizza(forma);
    assert.strictEqual(d.qualificatore, 'circa', forma);
    assert.strictEqual(d.certa, false, forma);
    assert.deepStrictEqual([d.da, d.a], [13400101, 13401231], forma);
  }
  assert.strictEqual(D.analizza('12 maggio 1340').certa, true);
}

{
  assert.deepStrictEqual(letta('ante 1350'), [null, 13491231, 'ante', true]);
  assert.deepStrictEqual(letta('prima del 1350'), [null, 13491231, 'ante', true]);
  assert.deepStrictEqual(letta('post 1340'), [13410101, null, 'post', true]);
  assert.deepStrictEqual(letta('dopo il 1340'), [13410101, null, 'post', true]);
  assert.deepStrictEqual(letta('ante 1 maggio 1340'), [null, 13400430, 'ante', true]);
  assert.deepStrictEqual(letta('post 31 dicembre 1340'), [13410101, null, 'post', true]);
}

{
  assert.deepStrictEqual(letta('1340-1345'), [13400101, 13451231, 'intervallo', true]);
  assert.deepStrictEqual(letta('1340/1345'), [13400101, 13451231, 'intervallo', true]);
  assert.deepStrictEqual(letta('tra il 1340 e il 1345'), [13400101, 13451231, 'intervallo', true]);
  assert.deepStrictEqual(letta('1340-45'), [13400101, 13451231, 'intervallo', true]);
  assert.strictEqual(D.analizza('1345-1340').qualificatore, 'anno');
}

{
  assert.deepStrictEqual(letta('sec. XIV'), [13010101, 14001231, 'secolo', true]);
  assert.deepStrictEqual(letta('XIV secolo'), [13010101, 14001231, 'secolo', true]);
  assert.deepStrictEqual(letta('sec. XIV in.'), [13010101, 13251231, 'secolo', true]);
  assert.deepStrictEqual(letta('sec. XIV ex.'), [13760101, 14001231, 'secolo', true]);
  assert.deepStrictEqual(letta('prima meta del sec. XIV'), [13010101, 13501231, 'secolo', true]);
  assert.deepStrictEqual(letta('seconda metà del sec. XIV'), [13510101, 14001231, 'secolo', true]);
  assert.deepStrictEqual(letta('metà sec. XIV'), [13380101, 13631231, 'secolo', true]);
  assert.strictEqual(D.analizza('sec. XIV').certa, false, 'un secolo non è mai una data certa');
}

{
  for (const testo of ['pergamena', 'reg. 4520', 'n. 12', '', '   ', 'ASP 1']) {
    assert.strictEqual(D.analizza(testo).riconosciuta, false, JSON.stringify(testo));
    assert.strictEqual(D.chiaveOrdinamento(testo), null, JSON.stringify(testo));
  }
  assert.strictEqual(D.analizza('4520').riconosciuta, false);
  const sd = D.analizza('s.d.');
  assert.strictEqual(sd.riconosciuta, true);
  assert.deepStrictEqual([sd.da, sd.a], [null, null]);
  assert.strictEqual(D.chiaveOrdinamento('s.d.'), null, 'senza data resta in coda');
}

{
  const date = ['12 maggio 1340', '3 aprile 1290', 'sec. XIV', 'c. 1400', 'pergamena', 'ante 1200'];
  const ordinate = date.slice().sort((a, b) => {
    const ka = D.chiaveOrdinamento(a), kb = D.chiaveOrdinamento(b);
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;
    if (kb === null) return -1;
    return ka - kb;
  });
  assert.deepStrictEqual(ordinate, ['ante 1200', '3 aprile 1290', 'sec. XIV', '12 maggio 1340', 'c. 1400', 'pergamena']);
  assert.strictEqual(D.chiaveOrdinamento('ante 1200'), 11991231);
}

{
  assert.strictEqual(D.nelPeriodo('12 maggio 1340', 1300, 1400), true);
  assert.strictEqual(D.nelPeriodo('12 maggio 1340', 1400, 1500), false);
  assert.strictEqual(D.nelPeriodo('1290-1310', 1301, 1400), true);
  assert.strictEqual(D.nelPeriodo('sec. XIV', 1301, 1400), true);
  assert.strictEqual(D.nelPeriodo('sec. XV', 1301, 1400), false);
  assert.strictEqual(D.nelPeriodo('1340', 1350, ''), false);
  assert.strictEqual(D.nelPeriodo('1340', '', 1350), true);
  assert.strictEqual(D.nelPeriodo('post 1340', '', 1300), false, 'dopo il 1340 non è prima del 1300');
  assert.strictEqual(D.nelPeriodo('post 1340', 1500, ''), true, 'dopo il 1340 può essere nel 1500');
  assert.strictEqual(D.nelPeriodo('pergamena', 1301, 1400), false);
  assert.strictEqual(D.nelPeriodo('s.d.', 1301, 1400), false);
}

{
  const a = D.analizza('c. 1340');
  const b = D.analizza('c. 1340');
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a, D.analizzaSenzaCache('c. 1340'));
  assert.strictEqual(D.analizza('Sec. XIV In.').raw, 'Sec. XIV In.');
  assert.strictEqual(D.annoDi(13400512), 1340);
  assert.strictEqual(D.annoDi(null), null);
}

console.log('dataStorica: 10 gruppi di test OK');
