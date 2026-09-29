// PDF ricercabile (OCR → copia dell'allegato con il testo invisibile sopra).
// Si testa il build in out/ senza Electron né Tesseract: i "livelli di testo" sono PDF di una
// pagina costruiti qui con pdf-lib, della stessa forma di quelli che produce il motore
// (pagina orientata come la vede pdf.js). La verifica passa da pdf.js, cioè da come un
// lettore vero ritrova il testo: una parola scritta in alto a sinistra della carta deve
// restare in alto a sinistra anche su pagine con /Rotate e CropBox spostato.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument, StandardFonts, degrees } = require('pdf-lib');
const pdfR = require('../out/main/ocr/pdfRicercabile');

const ROTAZIONI = [0, 90, 180, 270];
// CropBox volutamente diverso dal MediaBox e non quadrato: un errore di assi o di origine
// si vede come testo fuori pagina o nel quadrante sbagliato.
const MEDIA = [0, 0, 600, 800];
const CROP = { x: 50, y: 100, width: 450, height: 600 };
// JPEG 1×1 minimo: pdf-lib ne legge solo le intestazioni, il contenuto non conta.
const JPEG_1x1 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function sorgente() {
  const doc = await PDFDocument.create();
  for (const r of ROTAZIONI) {
    const p = doc.addPage([MEDIA[2], MEDIA[3]]);
    p.setCropBox(CROP.x, CROP.y, CROP.width, CROP.height);
    p.setRotation(degrees(r));
  }
  return doc.save();
}

/** Livello di testo come lo vede il lettore: dimensioni già ruotate, parola in alto a sinistra. */
async function livello(r, parola) {
  const doc = await PDFDocument.create();
  const verticale = r === 90 || r === 270;
  const w = verticale ? CROP.height : CROP.width;
  const h = verticale ? CROP.width : CROP.height;
  const p = doc.addPage([w, h]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  p.drawText(parola, { x: 10, y: h - 30, size: 12, font });
  return doc.save();
}

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-pdfr-'));
  try {
    const src = path.join(dir, 'sorgente.pdf');
    fs.writeFileSync(src, await sorgente());

    // --- Test 1: pagine copiate, testo solo dove c'è un livello, posizione giusta ----
    {
      const out = path.join(dir, 'uscita.pdf');
      await pdfR.apri(out);
      assert.strictEqual(pdfR.attiva(), true);
      const livelli = new Map();
      for (let i = 0; i < ROTAZIONI.length; i++) livelli.set(i + 1, await livello(ROTAZIONI[i], 'CARTA' + ROTAZIONI[i]));
      // Una pagina in più senza livello: deve esserci, senza testo.
      const conExtra = await PDFDocument.load(fs.readFileSync(src));
      conExtra.addPage([300, 300]);
      fs.writeFileSync(src, await conExtra.save());

      await pdfR.aggiungiPdf(src, livelli);
      const esito = await pdfR.concludi(false);
      assert.strictEqual(esito.ok, true);
      assert.strictEqual(esito.pagine, 5);
      assert.strictEqual(esito.nome, 'uscita.pdf');
      assert.strictEqual(pdfR.attiva(), false);
      assert.ok(!fs.existsSync(out + '.tmp'), 'il .tmp non deve restare');

      const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(out)), isEvalSupported: false, verbosity: 0 }).promise;
      assert.strictEqual(doc.numPages, 5);
      for (let i = 0; i < ROTAZIONI.length; i++) {
        const pagina = await doc.getPage(i + 1);
        assert.strictEqual(pagina.rotate, ROTAZIONI[i], 'la rotazione originale resta');
        const vp = pagina.getViewport({ scale: 1 });
        const testo = await pagina.getTextContent();
        const voce = testo.items.find(it => it.str === 'CARTA' + ROTAZIONI[i]);
        assert.ok(voce, `testo ritrovabile a ${ROTAZIONI[i]}°`);
        const [vx, vy] = vp.convertToViewportPoint(voce.transform[4], voce.transform[5]);
        // Riga di base a 30 pt dal bordo alto e 10 pt da sinistra, nella pagina come si vede.
        assert.ok(Math.abs(vx - 10) < 1 && Math.abs(vy - 30) < 1,
          `posizione a ${ROTAZIONI[i]}°: ${vx.toFixed(1)},${vy.toFixed(1)}`);
      }
      const ultima = await (await doc.getPage(5)).getTextContent();
      assert.strictEqual(ultima.items.length, 0, 'pagina senza livello copiata intatta');
      await doc.loadingTask.destroy();
    }

    // --- Test 2: immagine non incorporabile → pagina completa del motore -------------
    {
      const out = path.join(dir, 'immagine.pdf');
      await pdfR.apri(out);
      await pdfR.aggiungiImmagine(path.join(dir, 'inesistente.png'), await livello(0, 'IMMAGINE'), false);
      const esito = await pdfR.concludi(false);
      assert.strictEqual(esito.pagine, 1);
      const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(out)), isEvalSupported: false, verbosity: 0 }).promise;
      const testo = await (await doc.getPage(1)).getTextContent();
      assert.ok(testo.items.some(it => it.str === 'IMMAGINE'));
      await doc.loadingTask.destroy();
    }

    // --- Test 3: annullamento e sessione vuota non scrivono nulla ----------------------
    {
      const out = path.join(dir, 'scartato.pdf');
      await pdfR.apri(out);
      await pdfR.aggiungiPdf(src, new Map());
      const esito = await pdfR.concludi(true);
      assert.strictEqual(esito.pagine, 0);
      assert.ok(!fs.existsSync(out));

      await pdfR.apri(out);
      assert.strictEqual((await pdfR.concludi(false)).pagine, 0);
      assert.ok(!fs.existsSync(out));
      await assert.rejects(() => pdfR.aggiungiPdf(src, new Map()), /Nessun PDF/);
    }

    // --- Test 4: PDF cifrato → codice dedicato, sessione ancora utilizzabile ---------
    {
      const cifrato = path.join(dir, 'cifrato.pdf');
      const byte = Buffer.from(fs.readFileSync(src).toString('latin1')
        .replace(/\/Root /, '/Encrypt << /Filter /Standard /V 1 /R 2 /O <00> /U <00> /P -4 >>\n/Root '), 'latin1');
      fs.writeFileSync(cifrato, byte);
      await pdfR.apri(path.join(dir, 'c.pdf'));
      await assert.rejects(() => pdfR.aggiungiPdf(cifrato, new Map()), (e) => e.codice === 'pdf_cifrato');
      await pdfR.concludi(true);
    }

    // --- Test 4-bis: pagine raddrizzate (/Rotate sommato, testo dritto) -------------
    {
      // Sorgente senza /Rotate e con /Rotate 90: il raddrizzamento si SOMMA a quello esistente.
      const base = await PDFDocument.create();
      for (const r of [0, 90]) {
        const p = base.addPage([MEDIA[2], MEDIA[3]]);
        p.setCropBox(CROP.x, CROP.y, CROP.width, CROP.height);
        p.setRotation(degrees(r));
      }
      const srcR = path.join(dir, 'girate.pdf');
      fs.writeFileSync(srcR, await base.save());

      const out = path.join(dir, 'raddrizzate.pdf');
      await pdfR.apri(out);
      // Tesseract ha letto la pagina GIÀ raddrizzata: il livello ha l'orientamento finale.
      await pdfR.aggiungiPdf(srcR,
        new Map([[1, await livello(270, 'PRIMA')], [2, await livello(270, 'SECONDA')]]),
        new Map([[1, 270], [2, 180]]));
      await pdfR.concludi(false);

      const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(out)), isEvalSupported: false, verbosity: 0 }).promise;
      for (const [n, parola, attesa] of [[1, 'PRIMA', 270], [2, 'SECONDA', 270]]) {
        const pagina = await doc.getPage(n);
        assert.strictEqual(pagina.rotate, attesa, `rotazione finale p. ${n}`);
        const vp = pagina.getViewport({ scale: 1 });
        const voce = (await pagina.getTextContent()).items.find(it => it.str === parola);
        assert.ok(voce, `testo p. ${n}`);
        const [vx, vy] = vp.convertToViewportPoint(voce.transform[4], voce.transform[5]);
        assert.ok(Math.abs(vx - 10) < 1 && Math.abs(vy - 30) < 1, `posizione p. ${n}: ${vx.toFixed(1)},${vy.toFixed(1)}`);
      }
      await doc.loadingTask.destroy();
    }

    // --- Test 4-ter: JPEG incorporato e raddrizzato con /Rotate ---------------------
    {
      const jpg = path.join(dir, 'carta.jpg');
      fs.writeFileSync(jpg, Buffer.from(JPEG_1x1, 'base64'));
      const out = path.join(dir, 'jpeg.pdf');
      await pdfR.apri(out);
      // Livello 450×600 (verticale, già dritto); il JPEG nel file è orizzontale: 600×450.
      const liv = await PDFDocument.create();
      const pl = liv.addPage([450, 600]);
      pl.drawText('DRITTA', { x: 10, y: 570, size: 12, font: await liv.embedFont(StandardFonts.Helvetica) });
      await pdfR.aggiungiImmagine(jpg, await liv.save(), true, 90);
      await pdfR.concludi(false);

      const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(out)), isEvalSupported: false, verbosity: 0 }).promise;
      const pagina = await doc.getPage(1);
      assert.strictEqual(pagina.rotate, 90);
      const vp = pagina.getViewport({ scale: 1 });
      assert.strictEqual(Math.round(vp.width), 450, 'mostrata verticale');
      assert.strictEqual(Math.round(vp.height), 600);
      const voce = (await pagina.getTextContent()).items.find(it => it.str === 'DRITTA');
      const [vx, vy] = vp.convertToViewportPoint(voce.transform[4], voce.transform[5]);
      assert.ok(Math.abs(vx - 10) < 1 && Math.abs(vy - 30) < 1, `posizione JPEG: ${vx.toFixed(1)},${vy.toFixed(1)}`);
      await doc.loadingTask.destroy();
    }

    // --- Test 5: quali immagini si incorporano tali e quali --------------------------
    {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
      assert.strictEqual(pdfR.immagineIncorporabile(jpeg), true);
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.strictEqual(pdfR.immagineIncorporabile(png), false);
      // JPEG con EXIF Orientation = 6 (big-endian): Tesseract lo raddrizza, pdf-lib no.
      const exif = Buffer.concat([jpeg, Buffer.from([0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06])]);
      assert.strictEqual(pdfR.immagineIncorporabile(exif), false);
    }

    console.log('pdfRicercabile: OK');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((errore) => {
  console.error(errore);
  process.exit(1);
});
