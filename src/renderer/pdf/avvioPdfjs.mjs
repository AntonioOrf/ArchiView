import * as pdfjsLib from '../ocr/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../ocr/pdf.worker.min.mjs', import.meta.url).href;
window.pdfjsLib = pdfjsLib;
window.dispatchEvent(new Event('pdfjs-pronto'));
