// Fase 5 (PIANO-REVIEW-MOBILE): l'errore grezzo di un invio (`drive_403: {…}`, `wifi_401`, …)
// diventa una frase per chi scansiona. Il testo tecnico resta nel log della coda.

/** Messaggio leggibile per l'errore di un lotto (`messaggio` = `e.message` della coda). */
export function messaggioErrore(messaggio: string): string {
  const m = messaggio || '';
  const stato = Number(/^(?:drive|upload)_(\d{3})\b/.exec(m)?.[1] ?? 0);
  if (stato === 401 || /token_assente|sign.?in.?required/i.test(m)) return 'Accesso a Google scaduto: rientra dalle Impostazioni.';
  if (stato === 403 && /storageQuotaExceeded|quota/i.test(m)) return 'Google Drive è pieno: libera spazio, poi riprovo.';
  if (stato === 403) return 'Google Drive ha rifiutato l\'invio: rientra dalle Impostazioni.';
  if (stato === 404) return 'Cartella sparita su Drive: riprovo.';
  if (stato === 429 || stato >= 500) return 'Google Drive non risponde: riprovo più tardi.';
  if (/^wifi_401\b/.test(m)) return 'Abbinamento scaduto: riabbina il computer.';
  if (/^wifi_rete\b/.test(m)) return 'Il computer non risponde: riapri «Ricevi via Wi-Fi» e riabbina.';
  if (/^wifi_422\b/.test(m)) return 'Il computer ha rifiutato le pagine: controlla l\'archivio aperto.';
  if (/^wifi_\d/.test(m)) return 'Il computer non ha ricevuto le pagine: riprovo.';
  if (/^lotto_non_valido\b/.test(m)) return 'Lotto non valido: è un bug, segnalalo.';
  if (/^dimensione_diversa\b/.test(m)) return 'Pagina arrivata incompleta: riprovo.';
  if (/network|fetch|timeout|timed out|unable to resolve/i.test(m)) return 'Senza rete: riprovo appena torna.';
  return 'Invio non riuscito: riprovo al prossimo giro.';
}
