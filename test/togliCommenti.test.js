const assert = require('assert');
const { togli, togliTs, togliCss, togliHtml, togliKotlin, togliCancelletto } = require('../scripts/togli-commenti');

const casi = [
  ['riga intera', 'a();\n// spiega\nb();\n', 'a();\nb();\n'],
  ['in coda', 'a(); // spiega\nb();\n', 'a();\nb();\n'],
  ['blocco JSDoc', '/**\n * doc\n */\nfunction f() {}\n', 'function f() {}\n'],
  ['in mezzo alla riga', 'f(a, /* x */ b);\nconst y = 1 /* z */;\n', 'f(a, b);\nconst y = 1;\n'],
  ['prima della graffa chiusa', 'if (x) {\n  a();\n  // fine\n}\n', 'if (x) {\n  a();\n}\n'],
  ['blocco vuoto', 'function f() { /* niente */ }\ntry { a(); } catch { /* ignora */ }\n', 'function f() {}\ntry { a(); } catch {}\n'],
  ['stringhe e template', 'const u = "http://x/*y*/";\nconst t = `// no ${a /* s */} /* no */`;\n', 'const u = "http://x/*y*/";\nconst t = `// no ${a} /* no */`;\n'],
  ['regex', 'const r = /\\/\\/.*$/g; // via\n', 'const r = /\\/\\/.*$/g;\n'],
  ['direttive', '// @ts-ignore perché sì\nx();\n// eslint-disable-next-line no-undef -- motivo\ny();\n/* @__PURE__ */ z();\n', '// @ts-ignore\nx();\n// eslint-disable-next-line no-undef\ny();\n/* @__PURE__ */ z();\n'],
  ['shebang', '#!/usr/bin/env node\n// via\nx();\n', '#!/usr/bin/env node\nx();\n'],
  ['ponytail su più righe', '// prima\n// ponytail: limite che\n// continua qui.\n// altro\nx();\n', '// ponytail: limite che\n// continua qui.\nx();\n'],
  ['ponytail in JSDoc', '/**\n * Spiega.\n * ponytail: limite.\n */\nx();\n', '/** ponytail: limite.\n */\nx();\n'],
  ['righe vuote non raddoppiate', 'a();\n\n// blocco\n\nb();\n', 'a();\n\nb();\n'],
  ['BOM', '﻿/* testa */\na();\n', '﻿a();\n'],
  ['CRLF', 'a();\r\n// via\r\nb(); // via\r\n', 'a();\r\nb();\r\n'],
];

for (const [nome, ingresso, atteso] of casi) assert.strictEqual(togliTs(ingresso).testo, atteso, nome);

assert.strictEqual(
  togliTs('const e = (\n  <div>\n    {/* nota */}\n    <p>// testo</p>\n  </div>\n);\n', 'x.tsx').testo,
  'const e = (\n  <div>\n    <p>// testo</p>\n  </div>\n);\n',
  'JSX',
);

assert.strictEqual(
  togliCss('/* tema */\n.a { color: red; /* rosso */ }\n.b::after { content: "/* no */"; }\n').testo,
  '.a { color: red; }\n.b::after { content: "/* no */"; }\n',
  'CSS',
);

assert.strictEqual(
  togliHtml('<body>\n  <!-- spiega -->\n  <!-- @include \'html/a.html\' -->\n<script type="module">\n// via\nx();\n</script>\n</body>\n').testo,
  '<body>\n  <!-- @include \'html/a.html\' -->\n<script type="module">\nx();\n</script>\n</body>\n',
  'HTML',
);

assert.strictEqual(togliKotlin('// via\nval s = "http://x" // via\n').testo, 'val s = "http://x"\n', 'Kotlin');
assert.strictEqual(togliCancelletto('# via\nappId: x\n  # via\nk: "a # b"\n').testo, 'appId: x\nk: "a # b"\n', 'YAML');
assert.strictEqual(togli("-- via\nCREATE TABLE t (\n  a TEXT, -- via\n  b TEXT DEFAULT '--no'\n);\n", 'x.sql').testo, "CREATE TABLE t (\n  a TEXT,\n  b TEXT DEFAULT '--no'\n);\n", 'SQL');
assert.strictEqual(togli('!macro x\n  ; via\n  # via\n  StrCmp $0 "a;b"\n!macroend\n', 'x.nsh').testo, '!macro x\n  StrCmp $0 "a;b"\n!macroend\n', 'NSIS');
assert.strictEqual(togli('# via\nnode_modules/\n\\#letterale\n', '.gitignore').testo, 'node_modules/\n\\#letterale\n', '.gitignore');

for (const [nome, ingresso] of casi) {
  const una = togliTs(ingresso).testo;
  assert.strictEqual(togliTs(una).testo, una, 'idempotente: ' + nome);
}

console.log('togliCommenti: ok');
