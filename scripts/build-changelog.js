const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const notesFile = path.join(root, 'RELEASE_NOTES.md');
const outFile = path.join(root, 'out/renderer/js/changelogContent.js');
const version = require(path.join(root, 'package.json')).version;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inline(testo) {
  return esc(testo)
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-stone-900 dark:text-stone-100">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-[0.9em]">$1</code>');
}

function estraiVersione(md, versione) {
  const righe = md.split(/\r?\n/);
  const inizio = righe.findIndex(r => new RegExp('^##\\s+ArchiView\\s+' + versione.replace(/\./g, '\\.') + '\\b').test(r));
  if (inizio === -1) return null;

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
      else intro.push(testo);
      continue;
    }

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
