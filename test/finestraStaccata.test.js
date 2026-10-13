// PIANO-SCHEDA-AFFIANCATA, Fase 5 — quando la finestra staccata, trascinata, è sulla zona di
// riaggancio. Il trascinamento vero di una finestra del sistema non si automatizza: qui si prova
// la geometria, che è l'unica parte con cui si può sbagliare in silenzio (zoom, bordi).
const assert = require('assert');
const path = require('path');

const { cursoreSullaZona, posizioneValida } = require(path.join(__dirname, '..', 'out', 'main', 'finestraStaccata.js'));

console.log('Running finestraStaccata tests...');
const contenuto = { x: 100, y: 50, width: 1200, height: 800 };
const zona = { x: 20, y: 80, width: 500, height: 600 };   // px CSS nel contenuto

assert.strictEqual(cursoreSullaZona(zona, contenuto, 1, { x: 300, y: 400 }), true, 'dentro, zoom 100 %');
assert.strictEqual(cursoreSullaZona(zona, contenuto, 1, { x: 119, y: 400 }), false, 'a sinistra della zona');
assert.strictEqual(cursoreSullaZona(zona, contenuto, 1, { x: 120, y: 130 }), true, 'sul bordo conta come dentro');
assert.strictEqual(cursoreSullaZona(zona, contenuto, 1, { x: 700, y: 400 }), false, 'oltre il bordo destro');
// Zoom 125 %: la zona si allarga sullo schermo; il bordo destro passa da 620 a 745.
assert.strictEqual(cursoreSullaZona(zona, contenuto, 1.25, { x: 740, y: 400 }), true, 'zoom: dentro solo se si scala');
assert.strictEqual(cursoreSullaZona(zona, contenuto, 1, { x: 740, y: 400 }), false, 'senza scala lo stesso punto è fuori');
assert.strictEqual(cursoreSullaZona(zona, contenuto, 0, { x: 300, y: 400 }), true, 'zoom illeggibile: 100 %');
assert.strictEqual(cursoreSullaZona(null, contenuto, 1, { x: 300, y: 400 }), false, 'nessuna zona (vista sbagliata)');
assert.strictEqual(cursoreSullaZona({ x: 0, y: 0, width: 0, height: 0 }, contenuto, 1, { x: 100, y: 50 }), false, 'zona vuota');
assert.strictEqual(cursoreSullaZona({ x: NaN, y: 0, width: 10, height: 10 }, contenuto, 1, { x: 100, y: 50 }), false, 'zona malformata');
// M14.6 — la posizione ricordata, con il secondo monitor tolto o spostato.
const principale = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const secondo = { workArea: { x: 1920, y: 0, width: 1920, height: 1040 } };
const sulSecondo = { x: 2200, y: 100, width: 720, height: 860 };
assert.deepStrictEqual(posizioneValida(sulSecondo, [principale, secondo]), sulSecondo, 'monitor collegato: la posizione resta');
assert.strictEqual(posizioneValida(sulSecondo, [principale]), null, 'monitor tolto: si riparte dal centro, non fuori schermo');
assert.deepStrictEqual(posizioneValida({ x: 1500, y: 100, width: 720, height: 860 }, [principale]), { x: 1500, y: 100, width: 720, height: 860 },
  'a cavallo del bordo ma con la barra del titolo raggiungibile: resta');
assert.strictEqual(posizioneValida({ x: 100, y: 1030, width: 720, height: 860 }, [principale]), null, 'barra del titolo sotto lo schermo: no');
assert.strictEqual(posizioneValida({ x: 100, y: -500, width: 720, height: 860 }, [principale]), null, 'barra del titolo sopra lo schermo: no');
assert.deepStrictEqual(posizioneValida({ x: 10.4, y: 20.6, width: 700.2, height: 800.7 }, [principale]), { x: 10, y: 21, width: 700, height: 801 }, 'arrotondata');
assert.strictEqual(posizioneValida(null, [principale]), null, 'mai salvata');
assert.strictEqual(posizioneValida({ x: 'a', y: 0, width: 10, height: 10 }, [principale]), null, 'malformata');
console.log('✅ Tutti i test finestraStaccata passati con successo!');
