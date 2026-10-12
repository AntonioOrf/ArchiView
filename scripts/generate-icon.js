// Rigenera le icone di ArchiView (desktop) e ArchiScanner (mobile) dai sorgenti SVG:
// assets/logo.svg e mobile/assets/logo.svg. Rasterizza con Playwright (Edge di sistema).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const desktop = fs.readFileSync(path.join(root, 'assets', 'logo.svg'), 'utf8');
const mobile = fs.readFileSync(path.join(root, 'mobile', 'assets', 'logo.svg'), 'utf8');

const FONDO = /<rect [^>]*\/>/;
const colore = svg => svg.match(/fill="(#[0-9A-Fa-f]{6})"/)[1];
const viewBox = (svg, vb) => svg.replace(/viewBox="[^"]*"/, `viewBox="${vb}"`);
// Icona a tutto campo (launcher legacy): il launcher applica la sua maschera.
const pieno = svg => viewBox(svg, '0 0 100 100').replace(/ rx="[^"]*"/, '');
// Adattiva: il disegno deve stare nei 72dp visibili su 108dp di tela → margine di 25 unità.
const primoPiano = svg => viewBox(svg.replace(FONDO, ''), '-25 -25 150 150');
const tinta = svg => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="${colore(svg)}"/></svg>`;

const uscite = [
  { file: 'assets/icon.png', svg: desktop, lato: 1024 },
  { file: 'mobile/assets/icon.png', svg: pieno(mobile), lato: 1024 },
  { file: 'mobile/assets/android-icon-foreground.png', svg: primoPiano(mobile), lato: 512 },
  { file: 'mobile/assets/android-icon-background.png', svg: tinta(mobile), lato: 512 },
  { file: 'mobile/assets/android-icon-monochrome.png', svg: primoPiano(mobile), lato: 432 },
  { file: 'mobile/assets/splash-icon.png', svg: mobile, lato: 1024 },
  { file: 'mobile/assets/favicon.png', svg: mobile, lato: 48 },
];
const LATI_ICO = [16, 24, 32, 48, 64, 128, 256];

(async () => {
  // Edge di sistema: non dipende dai browser scaricati da `playwright install`.
  const browser = await chromium.launch({ channel: process.env.ICON_BROWSER || 'msedge' });
  try {
    const page = await browser.newPage();
    const rasterizza = async (svg, lato) => {
      await page.setViewportSize({ width: lato, height: lato });
      const dimensionato = svg.replace('<svg ', `<svg width="${lato}" height="${lato}" `);
      await page.setContent(`<html><body style="margin:0;background:transparent">${dimensionato}</body></html>`);
      return page.locator('svg').screenshot({ omitBackground: true });
    };
    for (const u of uscite) {
      fs.writeFileSync(path.join(root, u.file), await rasterizza(u.svg, u.lato));
      console.log(`Generato ${u.file}`);
    }
    const { default: pngToIco } = await import('png-to-ico');
    const png = [];
    for (const l of LATI_ICO) png.push(await rasterizza(desktop, l)); // una pagina sola: in sequenza
    const ico = await pngToIco(png);
    fs.writeFileSync(path.join(root, 'assets', 'icon.ico'), ico);
    console.log(`Generato assets/icon.ico (${ico.length} byte)`);
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('Generazione delle icone fallita:', err);
  process.exit(1);
});
