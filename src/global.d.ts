// I membri di `window` più usati hanno il loro tipo; gli altri passano ancora dall'indice `any`
// (PIANO-REFACTOR Fase 10, strada piccola: si aggiungono qui uno alla volta).
type ApiPreload = import('./main/preload').ApiPreload;

interface Window {
  [key: string]: any;
  t(chiave: string, ripiego?: string): string;
  escapeHTML(valore: unknown): string;
  sanitizeHTML(html: unknown): string;
  azione(tipo: string, nome: string, ...args: any[]): string;
  Model: typeof ArchiViewModel;
  apiBrowser: ApiPreload['apiBrowser'];
  apiOcr: ApiPreload['apiOcr'];
  apiSicurezza: ApiPreload['apiSicurezza'];
  apiIiif: ApiPreload['apiIiif'];
  apiAuthority: ApiPreload['apiAuthority'];
  apiScanner: ApiPreload['apiScanner'];
  apiFinestre: ApiPreload['apiFinestre'];
  apiSettings: ApiPreload['apiSettings'];
  apiDrive: ApiPreload['apiDrive'];
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
declare var localeAttuale: any;
declare var mostraMessaggio: any;
declare var controllaAggiornamenti: any;
declare var cambiaAllegatoRelativo: any;
declare var nascondiBannerAggiornamento: any;
declare var mostraProgressoCloud: any;
declare var nascondiProgressoCloud: any;
declare var chiudiUnsavedModal: any;
declare var mostraWelcomeModal: any;
declare var showRecordContextMenu: any;
declare var aggiornaListaVault: any;
declare var trasformaInCondiviso: any;
declare var trasformaInPersonale: any;
declare var apriCloudModal: any;
declare var mostraJoinForm: any;
declare var mostraBottomConfirm: any;
declare var aggiornaEditorCampo: any;
declare var importaManoscritto: any;
declare var esportaCartellaAttuale: any;
declare var process: any;
declare var require: any;
declare var __dirname: any;

// State variables shared across files (set on window by state.ts)
declare var cartellaAttuale: any;
declare var cartelleEspanse: any;
declare var statoIniziale: any;
declare var toggleFullscreenAllegato: any;
// editingTypeId: dichiarata con `let` in typesLogic.ts, visibile anche agli altri script.
