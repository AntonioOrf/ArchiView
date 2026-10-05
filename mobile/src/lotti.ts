// Lotti sul telefono: `<documenti>/lotti/<id>/p0001.jpg …` più `bozza.json` (stato locale,
// NON il manifest: `lotto.json` si compone al momento dell'invio e si valida con il contratto).
// Fase 0: un lotto alla volta, nessuna coda. La coda offline è Fase 1.

import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { ScannerLotto, type Destinazione, type Lotto, type Modalita, type Pagina } from './contratto';

const ALFABETO = '0123456789abcdefghijklmnopqrstuvwxyz';

export type Bozza = {
  id: string;
  creatoIl: string;
  titolo?: string;
  destinazione: Destinazione;
  pagine: Pagina[];
};

function radice(): Directory {
  const d = new Directory(Paths.document, 'lotti');
  d.create({ intermediates: true, idempotent: true });
  return d;
}

export function cartellaLotto(id: string): Directory {
  if (!ScannerLotto.idValido(id)) throw new Error('id_non_valido');
  return new Directory(radice(), id);
}

/** `2026-10-05T14:30:22+02:00`: ora locale con il fuso esplicito, come chiede il contratto. */
function isoLocale(d: Date): string {
  const due = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const segno = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}T${due(d.getHours())}:${due(d.getMinutes())}:${due(d.getSeconds())}` +
    `${segno}${due(Math.floor(a / 60))}:${due(a % 60)}`;
}

function suffissoCasuale(): string {
  return Array.from(Crypto.getRandomBytes(4), b => ALFABETO[b % ALFABETO.length]).join('');
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

function salvaBozza(b: Bozza): void {
  const f = new File(cartellaLotto(b.id), 'bozza.json');
  f.write(JSON.stringify(b, null, 2));
}

export function nuovoLotto(destinazione: Destinazione = { tipo: 'nessuna' }): Bozza {
  const ora = new Date();
  const b: Bozza = { id: ScannerLotto.nuovoId(ora, suffissoCasuale()), creatoIl: isoLocale(ora), destinazione, pagine: [] };
  cartellaLotto(b.id).create({ intermediates: true });
  salvaBozza(b);
  return b;
}

/**
 * Copia l'immagine nel lotto come pagina successiva e ne calcola sha256 e byte.
 * L'hash si calcola sulla COPIA, cioè sul file che verrà caricato.
 */
export async function aggiungiPagina(b: Bozza, uriSorgente: string, modalita: Modalita, dim?: { larghezza?: number; altezza?: number }): Promise<Bozza> {
  const nome = ScannerLotto.nomePagina(b.pagine.length + 1);
  const dest = new File(cartellaLotto(b.id), nome);
  if (dest.exists) dest.delete();
  await new File(uriSorgente).copy(dest);
  const bytes = await dest.bytes();
  const sha256 = hex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes));
  const pagina: Pagina = { file: nome, sha256, byte: bytes.byteLength, modalita };
  if (dim?.larghezza) pagina.larghezza = Math.round(dim.larghezza);
  if (dim?.altezza) pagina.altezza = Math.round(dim.altezza);
  const nuova: Bozza = { ...b, pagine: [...b.pagine, pagina] };
  salvaBozza(nuova);
  return nuova;
}

export function fileDellaPagina(b: Bozza, nome: string): File {
  if (!ScannerLotto.nomeFileValido(nome)) throw new Error('file_non_valido');
  return new File(cartellaLotto(b.id), nome);
}

export function manifest(b: Bozza, dispositivo?: string): Lotto {
  const l: Lotto = {
    formato: ScannerLotto.FORMATO,
    versione: ScannerLotto.VERSIONE,
    id: b.id,
    creatoIl: b.creatoIl,
    destinazione: b.destinazione,
    pagine: b.pagine
  };
  if (dispositivo) l.dispositivo = dispositivo;
  if (b.titolo) l.titolo = b.titolo;
  return l;
}

/** Dopo l'invio riuscito i file locali non servono più. */
export function eliminaLotto(b: Bozza): void {
  const d = cartellaLotto(b.id);
  if (d.exists) d.delete();
}
