interface Window {
  [key: string]: any;
}
interface HTMLElement {
  value: any;
  checked: boolean;
  src: string;
  files: any;
  rows: any;
}
interface Element {
  value: any;
  dataset: any;
  style: any;
  checked: any;
}
interface EventTarget {
  files: any;
  classList: any;
  id: any;
}

declare var lucide: any;
declare var DOMPurify: any;
declare var sanitizeHTML: any;
declare var escapeHTML: any;
declare var mostraMessaggio: any;
declare var controllaAggiornamenti: any;
declare var cambiaAllegatoRelativo: any;
declare var nascondiBannerAggiornamento: any;
declare var process: any;
declare var require: any;
declare var __dirname: any;

// State variables shared across files (set on window by state.ts)
declare var cartellaAttuale: any;
declare var cartelleEspanse: any;
declare var statoIniziale: any;
declare var toggleFullscreenAllegato: any;
declare var editingTypeId: any;
