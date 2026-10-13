// Fase 5 (PIANO-REVIEW-MOBILE): l'errore grezzo di un invio (`drive_403: {…}`, `wifi_401`, …)
// diventa una frase per chi scansiona. Il testo tecnico resta nel log della coda.

import { t } from './lingua';

/** Messaggio leggibile per l'errore di un lotto (`messaggio` = `e.message` della coda). */
export function messaggioErrore(messaggio: string): string {
  const m = messaggio || '';
  const stato = Number(/^(?:drive|upload)_(\d{3})\b/.exec(m)?.[1] ?? 0);
  if (stato === 401 || /token_assente|sign.?in.?required/i.test(m)) return t('Accesso a Google scaduto: rientra dalle Impostazioni.');
  if (stato === 403 && /storageQuotaExceeded|quota/i.test(m)) return t('Google Drive è pieno: libera spazio, poi riprovo.');
  if (stato === 403) return t('Google Drive ha rifiutato l\'invio: rientra dalle Impostazioni.');
  if (stato === 404) return t('Cartella sparita su Drive: riprovo.');
  if (stato === 429 || stato >= 500) return t('Google Drive non risponde: riprovo più tardi.');
  if (/^wifi_401\b/.test(m)) return t('Abbinamento scaduto: riabbina il computer.');
  if (/^wifi_rete\b/.test(m)) return t('Il computer non risponde: riapri «Ricevi via Wi-Fi» e riabbina.');
  if (/^wifi_422\b/.test(m)) return t('Il computer ha rifiutato le pagine: controlla l\'archivio aperto.');
  if (/^wifi_\d/.test(m)) return t('Il computer non ha ricevuto le pagine: riprovo.');
  if (/^lotto_non_valido\b/.test(m)) return t('Lotto non valido: è un bug, segnalalo.');
  if (/^dimensione_diversa\b/.test(m)) return t('Pagina arrivata incompleta: riprovo.');
  if (/network|fetch|timeout|timed out|unable to resolve/i.test(m)) return t('Senza rete: riprovo appena torna.');
  return t('Invio non riuscito: riprovo al prossimo giro.');
}
