// L10 — guardia statica sui sink HTML del renderer.
//
// Ogni `innerHTML =`, `innerHTML +=`, `outerHTML =` e `insertAdjacentHTML(_, x)` in
// src/renderer/js e src/shared deve ricevere un valore DIMOSTRABILMENTE sicuro dall'AST:
//   - letterali stringa o template senza interpolazioni;
//   - `escapeHTML(…)`, `sanitizeHTML(…)`, `DOMPurify.sanitize(…)` (con o senza `window.`);
//   - `t('chiave')` / `window.t('chiave')` (cataloghi del repo) se gli eventuali parametri
//     sono a loro volta sicuri: Lingui li sostituisce senza escape;
//   - numeri, `String(numero)`, `.length`, `toLocaleString()`;
//   - composizioni dei casi sopra: `+`, template, ternari, `a || b`, `.map(x => …).join(…)`,
//     e costanti locali (`const html = …`, anche costruite con `+=`) il cui valore è sicuro.
// Il resto va in ECCEZIONI con il motivo: file + testo esatto del sink (non il numero di
// riga, che si sposta). Un'eccezione che non trova più il suo sink fa fallire il test,
// così l'elenco non accumula voci morte.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const RADICE = path.join(__dirname, '..');
const CARTELLE = ['src/renderer/js', 'src/shared'];

const FUNZIONI_SICURE = new Set(['escapeHTML', 'sanitizeHTML', 'sanitize', 'escapeAttr']);
const FUNZIONI_NUMERICHE = new Set(['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString','toFixed', 'round', 'floor', 'ceil', 'min', 'max', 'Number', 'parseInt', 'parseFloat']);

/** Funzioni globali del renderer verificate a mano, con il motivo. */
const FUNZIONI_VERIFICATE = {
  chipTagHTML: 'logic/tagsLogic.ts: escapeHTML(tag); la classe viene da Model.coloreTag, che accetta solo AV_COLORI_TAG',
  contaFiltriAvanzati: 'logic/utils.ts: restituisce un numero',
};

/**
 * Eccezioni verificate a mano. Chiave: percorso relativo + '::' + inizio del testo del sink
 * (normalizzato negli spazi, primi 80 caratteri). Valore: perché è sicuro.
 */
const ECCEZIONI = {
  'src/renderer/js/components/mainView.ts::div.innerHTML = ` <div class="text-xs font-bold text-stone-800 truncate mb-1" tr':
    'match.snippet viene da buildSnippet(), che passa ogni pezzo da escapeHTML e aggiunge solo <mark>',
  "src/renderer/js/components/modals/diffModal.ts::document.body.insertAdjacentHTML('beforeend', modalHtml)":
    'textPrima/textDopo passano da escapeHTML, tranne emptyLabel che è un letterale con t() già escapato',
  'src/renderer/js/logic/i18n.ts::el.innerHTML = html':
    'html viene solo da _traduzioniSanitizzate, che memorizza il risultato di sanitizeHTML sulla traduzione',
};

function fileTs(dir) {
  const out = [];
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) { if (voce.name !== 'vendor') out.push(...fileTs(p)); }
    else if (voce.name.endsWith('.ts') && !voce.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const normalizza = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 80);

function nomeChiamata(callee) {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return '';
}

/** Dichiarazioni `const|let nome = …` e assegnazioni `nome += …` nel file, per nome. */
function indiceVariabili(sf) {
  const dichiarazioni = new Map();
  const aggiunte = new Map();
  const funzioni = new Map();
  const visita = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) {
      if (!funzioni.has(n.name.text)) funzioni.set(n.name.text, []);
      funzioni.get(n.name.text).push(n);
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      if (!dichiarazioni.has(n.name.text)) dichiarazioni.set(n.name.text, []);
      dichiarazioni.get(n.name.text).push(n.initializer);
    }
    if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left)
      && (n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken || n.operatorToken.kind === ts.SyntaxKind.EqualsToken)) {
      if (!aggiunte.has(n.left.text)) aggiunte.set(n.left.text, []);
      aggiunte.get(n.left.text).push(n.right);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return { dichiarazioni, aggiunte, funzioni };
}

function corpoFunzione(fn) {
  if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isFunctionDeclaration(fn))) return null;
  if (!ts.isBlock(fn.body)) return [fn.body];
  const ritorni = [];
  const visita = (n) => {
    if (ts.isFunctionLike(n) && n !== fn) return;
    if (ts.isReturnStatement(n) && n.expression) ritorni.push(n.expression);
    ts.forEachChild(n, visita);
  };
  visita(fn.body);
  return ritorni;
}

function creaVerifica(sf) {
  const { dichiarazioni, aggiunte, funzioni } = indiceVariabili(sf);
  const inCorso = new Set();

  /** Funzione locale (dichiarata o `const f = () => …`): sicura se lo sono tutti i return. */
  function funzioneLocaleSicura(nome) {
    const chiave = 'fn:' + nome;
    if (inCorso.has(chiave)) return true; // ricorsione: decidono gli altri return
    const candidati = [...(funzioni.get(nome) || []),
      ...(dichiarazioni.get(nome) || []).filter((i) => ts.isArrowFunction(i) || ts.isFunctionExpression(i))];
    if (!candidati.length) return false;
    inCorso.add(chiave);
    try {
      return candidati.every((fn) => {
        const ritorni = corpoFunzione(fn);
        return !!ritorni && ritorni.length > 0 && ritorni.every(sicuro);
      });
    } finally { inCorso.delete(chiave); }
  }

  // Prima foglia non dimostrabile (la più interna): serve solo all'elenco diagnostico.
  let fallita = null;
  function sicuro(e) {
    const esito = sicuroNodo(e);
    if (!esito && !fallita && e) fallita = e.getText(sf).replace(/\s+/g, ' ').slice(0, 100);
    return esito;
  }
  function sicuroNodo(e) {
    if (!e) return true;
    switch (e.kind) {
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.NumericLiteral:
      case ts.SyntaxKind.TrueKeyword:
      case ts.SyntaxKind.FalseKeyword:
      case ts.SyntaxKind.NullKeyword:
        return true;
    }
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return sicuro(e.expression);
    if (ts.isTemplateExpression(e)) return e.templateSpans.every((s) => sicuro(s.expression));
    if (ts.isConditionalExpression(e)) return sicuro(e.whenTrue) && sicuro(e.whenFalse);
    if (ts.isPrefixUnaryExpression(e)) return true; // -x, +x, !x: numeri o booleani
    if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind;
      if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.BarBarToken
        || op === ts.SyntaxKind.QuestionQuestionToken) return sicuro(e.left) && sicuro(e.right);
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return sicuro(e.right);
      // - * / % confronti: risultato numerico o booleano
      return op !== ts.SyntaxKind.EqualsToken && op !== ts.SyntaxKind.PlusEqualsToken;
    }
    if (ts.isPropertyAccessExpression(e) && e.name.text === 'length') return true;
    if (ts.isCallExpression(e)) {
      const nome = nomeChiamata(e.expression);
      if (FUNZIONI_SICURE.has(nome) || FUNZIONI_NUMERICHE.has(nome)) return true;
      if (Object.prototype.hasOwnProperty.call(FUNZIONI_VERIFICATE, nome)) return true;
      // stringaSicura.replace(x, sostituzioneSicura): il pattern (anche regex) non entra nell'output
      if ((nome === 'replace' || nome === 'replaceAll') && ts.isPropertyAccessExpression(e.expression)) {
        return e.arguments.length === 2 && sicuro(e.expression.expression) && sicuro(e.arguments[1]);
      }
      if (nome === 't') return e.arguments.slice(1).every((a) =>
        ts.isObjectLiteralExpression(a)
          ? a.properties.every((p) => ts.isPropertyAssignment(p) ? sicuro(p.initializer)
            : ts.isShorthandPropertyAssignment(p) ? sicuro(p.name) : false)
          : sicuro(a));
      if (nome === 'String' && e.arguments.length === 1) return sicuro(e.arguments[0]);
      // window.azione('click', nome, ...args): nome e argomenti passano da escapeHTML
      // (logic/azioni.ts); il tipo evento no, quindi deve essere un letterale.
      if (nome === 'azione') return e.arguments.length > 0 && ts.isStringLiteralLike(e.arguments[0]);
      if (nome === 'join' && ts.isPropertyAccessExpression(e.expression)) {
        const sorgente = e.expression.expression;
        if (!e.arguments.every(sicuro)) return false;
        if (ts.isCallExpression(sorgente) && ['map', 'filter'].includes(nomeChiamata(sorgente.expression))) {
          if (nomeChiamata(sorgente.expression) === 'filter') return sicuro(ts.factory.createCallExpression(sorgente.expression, undefined, []));
          const ritorni = corpoFunzione(sorgente.arguments[0]);
          return !!ritorni && ritorni.every(sicuro);
        }
        return sicuro(sorgente);
      }
      if (ts.isIdentifier(e.expression)) return funzioneLocaleSicura(e.expression.text);
      return false;
    }
    if (ts.isIdentifier(e)) {
      if (inCorso.has(e.text)) return true; // `html += …` ricorsivo: il resto lo verificano le altre voci
      const valori = [...(dichiarazioni.get(e.text) || []), ...(aggiunte.get(e.text) || [])];
      if (!valori.length) return false;
      inCorso.add(e.text);
      try { return valori.every(sicuro); } finally { inCorso.delete(e.text); }
    }
    if (ts.isArrayLiteralExpression(e)) return e.elements.every(sicuro);
    return false;
  }
  return (e) => { fallita = null; const ok = sicuro(e); return { ok, fallita }; };
}

function trovaSink(file, testo = fs.readFileSync(file, 'utf8')) {
  const sf = ts.createSourceFile(file, testo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const sicuro = creaVerifica(sf);
  const rel = path.relative(RADICE, file).replace(/\\/g, '/');
  const sink = [];
  const visita = (n) => {
    let valore = null;
    if (ts.isBinaryExpression(n) && ts.isPropertyAccessExpression(n.left)
      && ['innerHTML', 'outerHTML'].includes(n.left.name.text)
      && (n.operatorToken.kind === ts.SyntaxKind.EqualsToken || n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)) {
      valore = n.right;
    } else if (ts.isCallExpression(n) && nomeChiamata(n.expression) === 'insertAdjacentHTML') {
      valore = n.arguments[1];
    }
    if (valore) {
      const riga = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const { ok, fallita } = sicuro(valore);
      sink.push({ rel, riga, chiave: rel + '::' + normalizza(n.getText(sf)), ok, fallita });
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return sink;
}

/** La guardia stessa: casi sintetici che deve accettare e casi ostili che deve rifiutare. */
function autoverifica() {
  const esito = (codice) => trovaSink(path.join(RADICE, 'sintetico.ts'), codice).map((s) => s.ok);
  const accettati = [
    "el.innerHTML = '<b>x</b>';",
    'el.innerHTML = `<b>${escapeHTML(nome)}</b>`;',
    'el.innerHTML = window.sanitizeHTML(m.trascrizione);',
    "el.innerHTML = window.t('chiave', 'Testo');",
    "el.innerHTML = `<i>${window.t('k', 'x {n}', { n: lista.length })}</i>`;",
    "el.innerHTML = lista.map(x => `<li>${escapeHTML(x)}</li>`).join('');",
    "let html = '<ul>'; html += `<li>${escapeHTML(a)}</li>`; el.innerHTML = html;",
    "function riga(v) { return '<td>' + escapeHTML(v) + '</td>'; } el.innerHTML = riga(x);",
    "el.innerHTML = `<b ${window.azione('click', 'apri', id)}>x</b>`;",
    "el.innerHTML = window.t('k', 'Archivio {v}').replace('{v}', '<b>' + escapeHTML(n) + '</b>');",
    'el.insertAdjacentHTML("beforeend", `<p>${n.toLocaleString()}</p>`);',
  ];
  const rifiutati = [
    'el.innerHTML = nome;',
    'el.innerHTML = `<b>${nome}</b>`;',
    "el.innerHTML = '<b>' + m.titolo + '</b>';",
    "el.innerHTML = window.t('k', 'Ciao {n}', { n: utente.nome });",
    "el.innerHTML = lista.map(x => `<li>${x}</li>`).join('');",
    "let html = '<ul>'; html += `<li>${a}</li>`; el.innerHTML = html;",
    "function riga(v) { return '<td>' + v + '</td>'; } el.innerHTML = riga(x);",
    'el.outerHTML = `<div>${dati.html}</div>`;',
    "el.insertAdjacentHTML('beforeend', risposta.body);",
    "el.innerHTML = `<b ${window.azione(tipo, 'apri', id)}>x</b>`;",
    "el.innerHTML = escapeHTML(a).replace('x', b);",
    "el.innerHTML = cond ? escapeHTML(a) : b;",
    "el.innerHTML = a || escapeHTML(b);",
  ];
  for (const c of accettati) assert.deepStrictEqual(esito(c), [true], `doveva essere accettato: ${c}`);
  for (const c of rifiutati) assert.deepStrictEqual(esito(c), [false], `doveva essere rifiutato: ${c}`);
}

function run() {
  console.log('Running htmlSinks tests...');
  autoverifica();
  const tutti = CARTELLE.flatMap((c) => fileTs(path.join(RADICE, c))).flatMap((f) => trovaSink(f));
  assert.ok(tutti.length > 100, `trovati solo ${tutti.length} sink: il parser non li vede più?`);

  const nonSicuri = tutti.filter((s) => !s.ok && !(s.chiave in ECCEZIONI));
  const usate = new Set(tutti.filter((s) => !s.ok).map((s) => s.chiave));
  const morte = Object.keys(ECCEZIONI).filter((k) => !usate.has(k));

  if (process.env.HTML_SINKS_ELENCO) {
    for (const s of nonSicuri) console.log(`${s.rel}:${s.riga}\n  chiave: ${JSON.stringify(s.chiave)}\n  non dimostrato: ${s.fallita}`);
  }
  assert.deepStrictEqual(nonSicuri.map((s) => `${s.rel}:${s.riga}  ${s.chiave.split('::')[1]}`), [],
    'sink HTML con valore non dimostrabilmente sicuro: avvolgere in escapeHTML/sanitizeHTML o aggiungere un\'eccezione motivata');
  assert.deepStrictEqual(morte, [], 'eccezioni che non corrispondono più a nessun sink: rimuoverle');

  console.log(`htmlSinks tests passed (${tutti.length} sink, ${Object.keys(ECCEZIONI).length} eccezioni).`);
}

run();
