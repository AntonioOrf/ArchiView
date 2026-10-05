// Ponte tipizzato verso il validatore condiviso con il desktop (src/shared/scannerLotto.ts).
// Il file condiviso è uno script senza export (vive anche nel renderer del desktop): si
// carica con `require` e qui gli si danno i tipi. Se il contratto cambia, si cambiano
// insieme scannerLotto.ts, docs/scanner/CONTRATTO.md e questo file.

export type Modalita = 'documento' | 'grezza' | 'raffica';

export type Pagina = {
  file: string;
  sha256: string;
  byte: number;
  modalita: Modalita;
  larghezza?: number;
  altezza?: number;
  etichetta?: string;
  doppia?: { lato: 'sx' | 'dx' };
};

export type Destinazione =
  | { tipo: 'nessuna' }
  | { tipo: 'esistente'; schedaId: string }
  | { tipo: 'nuova'; tipoDocumento: string; cartella?: string; campi: Record<string, string> };

export type Lotto = {
  formato: string;
  versione: number;
  id: string;
  creatoIl: string;
  dispositivo?: string;
  titolo?: string;
  nota?: string;
  destinazione: Destinazione;
  pagine: Pagina[];
};

export type ErroreContratto = { codice: string; percorso: string };
export type EsitoValidazione = { ok: true; lotto: Lotto } | { ok: false; errori: ErroreContratto[] };

type ModuloScannerLotto = {
  FORMATO: string;
  VERSIONE: number;
  NOME_MANIFEST: string;
  MODALITA: Modalita[];
  CHIAVI_RISERVATE: string[];
  LIMITI: Record<string, number>;
  valida(json: unknown): EsitoValidazione;
  idValido(id: unknown): boolean;
  nomeFileValido(nome: unknown): boolean;
  nuovoId(data: Date, suffisso: string): string;
  nomePagina(n: number, estensione?: 'jpg' | 'jpeg' | 'png'): string;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const ScannerLotto: ModuloScannerLotto = require('../../src/shared/scannerLotto.ts');
