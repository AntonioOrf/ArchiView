// Genera il contenuto del changelog in-app a partire da RELEASE_NOTES.md.
//
// Perché esiste: il modal era HTML scritto a mano dentro changelogModal.ts e andava
// aggiornato a ogni rilascio. Non è successo — l'app 2.4.5 mostrava ancora "Novità della
// Versione 2.4.3" — e un changelog che mente è peggio di uno assente, perché l'utente
// crede di sapere cosa è cambiato. RELEASE_NOTES.md è già la fonte usata da
// electron-builder (`build.releaseInfo.releaseNotesFile`): qui diventa anche la fonte del
// modal, così le due non possono più divergere.
//
// Emette out/renderer/js/changelogContent.js, che definisce window.changelogData.
// Deve girare DOPO copy-assets (che genera out/renderer/index.html) e PRIMA di
// build-renderer-bundle (che pretende presenti tutti gli script referenziati dall'HTML).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const notesFile = path.join(root, 'RELEASE_NOTES.md');
const outFile = path.join(root, 'out/renderer/js/changelogContent.js');
const version = require(path.join(root, 'package.json')).version;

/** Escape HTML: le note sono nostre, ma finiscono in innerHTML e non devono poter iniettare. */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Markdown inline, limitato a ciò che RELEASE_NOTES usa davvero: **grassetto** e `codice`.
 * Si applica DOPO l'escape, così i tag prodotti qui sono gli unici presenti.
 */
function inline(testo) {
  return esc(testo)
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-stone-900 dark:text-stone-100">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-[0.9em]">$1</code>');
}

/**
 * Estrae la sezione della versione richiesta. Il formato atteso è
 * `## ArchiView <versione> — <titolo>`, seguito da paragrafi introduttivi e da blocchi
 * `### <sezione>` con elenchi puntati, fino al `---` o alla versione successiva.
 */
function estraiVersione(md, versione) {
  const righe = md.split(/\r?\n/);
  const inizio = righe.findIndex(r => new RegExp('^##\\s+ArchiView\\s+' + versione.replace(/\./g, '\\.') + '\\b').test(r));
  if (inizio === -1) return null;

  // Dal titolo si toglie il prefisso "ArchiView <versione> — ": l'intestazione del modal
  // dice già "Novità della Versione X", ripeterlo nel sottotitolo è rumore.
  const titolo = righe[inizio]
    .replace(/^##\s+/, '')
    .replace(new RegExp('^ArchiView\\s+' + versione.replace(/\./g, '\\.') + '\\s*[—–-]\\s*'), '')
    .trim();
  const corpo = [];
  for (let i = inizio + 1; i < righe.length; i++) {
    if (/^##\s+ArchiView\s/.test(righe[i])) break;
    if (/^---\s*$/.test(righe[i])) break;
    corpo.push(righe[i]);
  }
  return { titolo, corpo };
}

/** Converte il corpo in HTML: intro come <p>, `###` come sezioni con elenco. */
function corpoInHtml(corpo) {
  const out = [];
  let intro = [];
  let sezione = null;
  let voci = [];

  const chiudiSezione = () => {
    if (!sezione) return;
    out.push(
      '<div>' +
      '<h4 class="font-semibold text-lg border-b border-stone-200 dark:border-stone-700 pb-2 mb-3">' + esc(sezione) + '</h4>' +
      (voci.length
        ? '<ul class="list-disc pl-5 space-y-2 text-sm">' + voci.map(v => '<li>' + inline(v) + '</li>').join('') + '</ul>'
        : '') +
      '</div>'
    );
    sezione = null;
    voci = [];
  };

  for (const rigaRaw of corpo) {
    const riga = rigaRaw.trim();
    if (!riga) continue;

    if (/^###\s+/.test(riga)) {
      chiudiSezione();
      sezione = riga.replace(/^###\s+/, '').trim();
      continue;
    }

    if (/^[-*]\s+/.test(riga)) {
      const testo = riga.replace(/^[-*]\s+/, '');
      if (sezione) voci.push(testo);
      else intro.push(testo); // elenco prima di qualsiasi ### : trattato come intro
      continue;
    }

    // Riga di continuazione di una voce (elenco su più righe).
    if (sezione && voci.length) voci[voci.length - 1] += ' ' + riga;
    else if (!sezione) intro.push(riga);
  }
  chiudiSezione();

  const introHtml = intro.length
    ? '<p class="text-sm">' + intro.map(inline).join('</p><p class="text-sm">') + '</p>'
    : '';

  return { introHtml, sezioniHtml: out.join('') };
}

function main() {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  let dati = { versione: version, titolo: '', html: '', disponibile: false };

  if (!fs.existsSync(notesFile)) {
    console.warn('[build-changelog] RELEASE_NOTES.md assente: changelog vuoto.');
  } else {
    const md = fs.readFileSync(notesFile, 'utf8');
    const sezione = estraiVersione(md, version);
    if (!sezione) {
      // Non blocca la build: un rilascio può essere impacchettato prima di scrivere le note.
      // Ma va detto forte, perché il sintomo a valle è un changelog silenziosamente assente.
      console.warn(`[build-changelog] ATTENZIONE: RELEASE_NOTES.md non contiene una sezione per la versione ${version}. Il changelog in-app non verrà mostrato.`);
    } else {
      const { introHtml, sezioniHtml } = corpoInHtml(sezione.corpo);
      dati = {
        versione: version,
        titolo: sezione.titolo,
        html: introHtml + sezioniHtml,
        disponibile: true,
      };
      console.log(`[build-changelog] changelog generato per ${version} ("${sezione.titolo}")`);
    }
  }

  const js = '// GENERATO da scripts/build-changelog.js — non modificare a mano.\n'
    + 'window.changelogData = ' + JSON.stringify(dati) + ';\n';
  fs.writeFileSync(outFile, js, 'utf8');
}

main();
