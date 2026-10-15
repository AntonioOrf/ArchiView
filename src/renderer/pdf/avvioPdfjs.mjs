// Avvio di pdf.js per il visualizzatore della trascrizione.
//
// pdf.js è distribuito solo come modulo ES, mentre il renderer è fatto di script classici
// compilati da tsc in CommonJS: un `import()` scritto in un .ts diventerebbe `require()`,
// che nel renderer non esiste. Questo file è l'unico modulo della pagina, iniettato da
// pdfViewer.ts come <script type="module"> alla PRIMA apertura di un PDF: chi non apre PDF
// non paga né il download né la compilazione di ~400 KB di libreria all'avvio.
// pdf.js è quello dell'host OCR (out/renderer/ocr): una sola copia nell'installazione.
// app:// serve già tutta out/renderer, quindi non si espone nulla di nuovo.
import * as pdfjsLib from '../ocr/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../ocr/pdf.worker.min.mjs', import.meta.url).href;
window.pdfjsLib = pdfjsLib;
window.dispatchEvent(new Event('pdfjs-pronto'));
