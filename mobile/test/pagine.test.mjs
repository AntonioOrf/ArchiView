import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERA, LATO_MINIMO, eIntera, giorniRimasti, inviatiScaduti, misureJpeg, quantiGiorni, rettangoloRitaglio, spostaAngolo } from '../src/pagine.ts';

function jpeg(w, h, o, le = true) {
  const u16 = v => (le ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = v => (le ? [...u16(v & 0xffff), ...u16(v >>> 16)] : [...u16(v >>> 16), ...u16(v & 0xffff)]);
  const tiff = o ? [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(o), 0, 0, ...u32(0)] : [];
  const app1 = o ? [0xff, 0xe1, ...[(tiff.length + 8) >> 8, (tiff.length + 8) & 255], 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff] : [];
  const app0 = [0xff, 0xe0, 0, 6, 1, 2, 3, 4];
  const sof = [0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, ...app1, ...app0, ...sof, 0xff, 0xda]);
}

test('misureJpeg legge le misure dal SOF e le scambia per 90°/270°', () => {
  assert.deepEqual(misureJpeg(jpeg(4000, 3000)), { w: 4000, h: 3000, orientamento: 1 });
  assert.deepEqual(misureJpeg(jpeg(4000, 3000, 1)), { w: 4000, h: 3000, orientamento: 1 });
  assert.deepEqual(misureJpeg(jpeg(4000, 3000, 6)), { w: 3000, h: 4000, orientamento: 6 });
  assert.deepEqual(misureJpeg(jpeg(4000, 3000, 8, false)), { w: 3000, h: 4000, orientamento: 8 });
  assert.deepEqual(misureJpeg(jpeg(4000, 3000, 3, false)), { w: 4000, h: 3000, orientamento: 3 });
});

test('misureJpeg: null se non è un JPEG o manca il SOF', () => {
  assert.equal(misureJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null);
  assert.equal(misureJpeg(jpeg(4000, 3000, 6).subarray(0, 30)), null);
  assert.equal(misureJpeg(new Uint8Array(0)), null);
});

test('spostaAngolo resta dentro l\'immagine e col lato minimo', () => {
  assert.deepEqual(spostaAngolo(INTERA, { x: 'x0', y: 'y0' }, -0.2, -0.2), INTERA);
  const r = spostaAngolo(INTERA, { x: 'x1', y: 'y1' }, -0.95, -0.95);
  assert.ok(Math.abs(r.x1 - LATO_MINIMO) < 1e-9 && Math.abs(r.y1 - LATO_MINIMO) < 1e-9);
  const s = spostaAngolo(INTERA, { x: 'x0', y: 'y1' }, 0.25, -0.5);
  assert.deepEqual(s, { x0: 0.25, y0: 0, x1: 1, y1: 0.5 });
});

test('rettangoloRitaglio in pixel interi e mai fuori', () => {
  assert.deepEqual(rettangoloRitaglio(INTERA, 3000, 4000), { originX: 0, originY: 0, width: 3000, height: 4000 });
  assert.deepEqual(rettangoloRitaglio({ x0: 0.1, y0: 0.25, x1: 0.9, y1: 0.75 }, 1001, 2000), { originX: 100, originY: 500, width: 801, height: 1000 });
  assert.deepEqual(rettangoloRitaglio({ x0: -1, y0: 0, x1: 2, y1: 1 }, 10, 10), { originX: 0, originY: 0, width: 10, height: 10 });
  assert.ok(eIntera(INTERA) && !eIntera({ ...INTERA, x0: 0.01 }));
});

test('inviatiScaduti secondo «Dopo l\'invio»', () => {
  const ora = new Date('2026-10-11T12:00:00+02:00');
  const lotti = [
    { id: 'vecchio', inviatoIl: '2026-10-01T12:00:00+02:00' },
    { id: 'recente', inviatoIl: '2026-10-10T12:00:00+02:00' },
    { id: 'senza' }
  ];
  assert.deepEqual(inviatiScaduti(lotti, { modo: 'sempre', giorni: 7 }, ora), []);
  assert.deepEqual(inviatiScaduti(lotti, { modo: 'subito', giorni: 7 }, ora), ['vecchio', 'recente', 'senza']);
  assert.deepEqual(inviatiScaduti(lotti, { modo: 'giorni', giorni: 7 }, ora), ['vecchio', 'senza']);
  assert.deepEqual(inviatiScaduti(lotti, { modo: 'giorni', giorni: 0 }, ora), ['vecchio', 'recente', 'senza']);
});

test('giorniRimasti', () => {
  const ora = new Date('2026-10-11T12:00:00+02:00');
  assert.equal(giorniRimasti('2026-10-10T12:00:00+02:00', 7, ora), 6);
  assert.equal(giorniRimasti('2026-10-01T12:00:00+02:00', 7, ora), 0);
  assert.equal(giorniRimasti(undefined, 7, ora), 0);
});

test('quantiGiorni', () => {
  assert.equal(quantiGiorni(1), '1 giorno');
  assert.equal(quantiGiorni(0), '0 giorni');
  assert.equal(quantiGiorni(7), '7 giorni');
});
