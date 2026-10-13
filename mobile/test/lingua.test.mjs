import { test } from 'node:test';
import assert from 'node:assert/strict';
import { impostaLingua, lingua, localeDate, t } from '../src/lingua.ts';
import { EN } from '../src/lingua.en.ts';
import { messaggioErrore } from '../src/errori.ts';
import { avvisoSpazio, PESO_FOTO } from '../src/spazio.ts';
import { quantiGiorni } from '../src/pagine.ts';
import { nomeAutomatico, quando } from '../src/elencoDocumenti.ts';
import { nomeFiltro } from '../src/filtri.ts';

test('le funzioni della logica parlano inglese', () => {
  impostaLingua('en');
  try {
    assert.equal(messaggioErrore('drive_404: x'), 'Folder missing on Drive: retrying.');
    assert.equal(avvisoSpazio(3 * PESO_FOTO), 'The phone has room for about 3 photos. Free up space or send the waiting pages.');
    assert.equal(quantiGiorni(1), '1 day');
    assert.equal(quantiGiorni(7), '7 days');
    assert.equal(nomeAutomatico(new Date(2026, 9, 9, 18, 5)), 'Document 9 Oct 18:05');
    const adesso = new Date(2026, 9, 12, 12, 0);
    assert.equal(quando(new Date(2026, 9, 12, 9, 10).toISOString(), adesso), 'Today 09:10');
    assert.equal(quando(new Date(2026, 9, 11, 9, 10).toISOString(), adesso), 'Yesterday 09:10');
    assert.equal(quando(new Date(2025, 4, 3).toISOString(), adesso), '3 May 2025');
    assert.equal(nomeFiltro(undefined), 'Original');
    assert.equal(nomeFiltro('bn'), 'B/W');
  } finally {
    impostaLingua('it');
  }
});

test('italiano: il testo resta e i {segnaposto} si riempiono', () => {
  impostaLingua('it');
  assert.equal(lingua(), 'it');
  assert.equal(localeDate(), 'it-IT');
  assert.equal(t('Le {n} pagine', { n: 3 }), 'Le 3 pagine');
  assert.equal(t('{a} e {b}', { a: 1 }), '1 e {b}');
});

test('inglese: voce del dizionario, ripiego sull\'italiano se manca', () => {
  impostaLingua('en');
  const [chiave, voce] = Object.entries(EN)[0];
  assert.equal(t(chiave), voce);
  assert.equal(t('Testo senza voce'), 'Testo senza voce');
  assert.equal(localeDate(), 'en-GB');
});

test('automatica: segue il locale del telefono', () => {
  const originale = Intl.DateTimeFormat;
  try {
    for (const [locale, atteso] of [['it-IT', 'it'], ['it-CH', 'it'], ['en-US', 'en'], ['de-DE', 'en']]) {
      Intl.DateTimeFormat = () => ({ resolvedOptions: () => ({ locale }) });
      impostaLingua('auto');
      assert.equal(lingua(), atteso, locale);
    }
    Intl.DateTimeFormat = () => { throw new Error('senza Intl'); };
    impostaLingua(undefined);
    assert.equal(lingua(), 'it');
  } finally {
    Intl.DateTimeFormat = originale;
    impostaLingua('it');
  }
});
