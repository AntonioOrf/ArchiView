#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const CSS = path.join(RADICE, 'src', 'renderer', 'css', 'style.css');
const USCITA = path.join(RADICE, 'mobile', 'src', 'theme', 'colori.ts');

function blocco(css, selettore) {
  const re = new RegExp('^' + selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'gm');
  for (let m; (m = re.exec(css));) {
    const token = {};
    for (const d of m[1].matchAll(/--color-([a-z0-9-]+)\s*:\s*([^;]+);/g)) token[d[1]] = d[2].trim();
    if (Object.keys(token).length) return token;
  }
  throw new Error('blocco_assente: ' + selettore);
}

function risolvi(token, base) {
  const out = {};
  for (const [k, v] of Object.entries(token)) {
    let val = v;
    for (let i = 0; i < 5 && /var\(/.test(val); i++) {
      val = val.replace(/var\(--color-([a-z0-9-]+)\)/g, (_, n) => token[n] || base[n] || (() => { throw new Error('var_irrisolta: ' + n); })());
    }
    if (!/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,]+\))$/i.test(val)) throw new Error('colore_non_supportato: ' + k + ' = ' + val);
    out[k] = val;
  }
  return out;
}

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

const conDivisore = (t) => ({ ...t, divisore: t['border-light'] });

function genera() {
  const css = fs.readFileSync(CSS, 'utf8');
  const chiaroGrezzo = blocco(css, ':root');
  const chiaro = conDivisore(risolvi(chiaroGrezzo, {}));
  const scuro = conDivisore(risolvi({ ...chiaroGrezzo, ...blocco(css, ':root.dark-theme') }, chiaro));
  const righe = (t) => Object.keys(chiaro).map(k => `    ${camel(k)}: '${t[k]}',`).join('\n');
  return `export const colori = {
  chiaro: {
${righe(chiaro)}
  },
  scuro: {
${righe(scuro)}
  }
} as const;

export type Colori = { [K in keyof typeof colori.chiaro]: string };
`;
}

if (require.main === module) {
  const testo = genera();
  if (process.argv.includes('--check')) {
    const attuale = fs.existsSync(USCITA) ? fs.readFileSync(USCITA, 'utf8').replace(/\r\n/g, '\n') : '';
    if (attuale !== testo) {
      console.error('mobile/src/theme/colori.ts non è allineato a style.css: esegui `npm run tema-mobile`.');
      process.exit(1);
    }
    console.log('✓ colori del telefono allineati a style.css');
  } else {
    fs.mkdirSync(path.dirname(USCITA), { recursive: true });
    fs.writeFileSync(USCITA, testo);
    console.log('scritto', path.relative(RADICE, USCITA));
  }
}

module.exports = { genera };
