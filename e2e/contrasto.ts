// Scanner di contrasto sul rendering reale, condiviso da a11y-contrast (7.1) e a11y-modali-rari.
// Le classi Tailwind da sole non dicono nulla: style.css rimappa .text-stone-* sui token del
// tema (con !important) e i modali scuri hanno un secondo remap. Si misura quindi il colore
// CALCOLATO contro lo sfondo EFFETTIVO, risalendo gli antenati e componendo le trasparenze.

export const TEMI = ['light', 'dark', 'amber-light', 'blue-dark'] as const;
export const TEMI_SCURI: readonly string[] = ['dark', 'blue-dark'];

export type Violazione = { schermata: string; elemento: string; testo: string; fg: string; bg: string; ratio: number; minimo: number };

// Eseguita nella pagina (passarla a page.evaluate). Modi:
// - 'testo' (1.4.3): testi e placeholder sotto il minimo;
// - 'bordi' (1.4.11): campi di input il cui contorno non si stacca di 3:1 dall'intorno;
// - 'sfondi': testi su un fondo chiaro in un tema scuro. Il contrasto può anche reggere (blu
//   scuro su pastello), ma è la palette del tema chiaro rimasta cablata: il segno che un
//   componente ignora il tema. Esenti i fondi pieni dei token d'accento (pulsanti primari e
//   di pericolo), che nei temi scuri sono chiari per scelta.
export function scansiona({ radiceSel, modo }: { radiceSel: string; modo: 'testo' | 'bordi' | 'sfondi' }): Omit<Violazione, 'schermata'>[] {
  // Tailwind v4 calcola i colori in oklch(): nessun parsing a mano, li converte il browser
  // disegnandoli su un canvas 1×1 (sRGB), qualunque sia la sintassi (oklch, color-mix, rgb).
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const cache = new Map<string, any>();
  const parse = (c: string) => {
    if (!c) return null;
    if (cache.has(c)) return cache.get(c);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const v = { r, g, b, a: a / 255 };
    cache.set(c, v);
    return v;
  };
  const sopra = (f: any, b: any) => ({
    r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1,
  });
  const lum = (c: any) => {
    const t = [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
  };
  const hex = (c: any) => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

  // Sfondo effettivo: pila dei background-color dagli antenati fino al primo opaco.
  function sfondo(el: Element): any | 'immagine' {
    const pila: any[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none' && !s.backgroundImage.startsWith('url(')) return 'immagine';
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { pila.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = pila.length - 1; i >= 0; i--) bg = sopra(pila[i], bg);
    return bg;
  }
  function opacitaCumulata(el: Element) {
    let o = 1;
    for (let n: Element | null = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || '1');
    return o;
  }
  const descrivi = (el: Element) => {
    const id = el.id ? '#' + el.id : '';
    const cls = Array.from(el.classList).filter(c => /^(text-|bg-|btn|card|form|cp-|modal|pill|badge|chip|conflitto|storico|accesso|eliminazione)/.test(c)).slice(0, 4).join('.');
    return el.tagName.toLowerCase() + id + (cls ? '.' + cls : '');
  };

  const radice = document.querySelector(radiceSel);
  if (!radice) return [];
  const out: Omit<Violazione, 'schermata'>[] = [];
  const contrasto = (a: any, b: any) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  if (modo === 'bordi') {
    // Il campo si riconosce dal bordo OPPURE dal fondo diverso dall'intorno: basta uno dei
    // due a 3:1. Un campo senza né bordo né fondo propri (la ricerca, bg-transparent) ha il
    // contorno sul contenitore: si misura quello, fino a due livelli sopra.
    const bordoVisibile = (st: CSSStyleDeclaration) => ['Top', 'Right', 'Bottom', 'Left']
      .filter(l => parseFloat((st as any)['border' + l + 'Width']) >= 1 && (st as any)['border' + l + 'Style'] !== 'none')
      .map(l => parse((st as any)['border' + l + 'Color'])).filter(c => c && c.a > 0);
    radice.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=range]), select, textarea').forEach((campo) => {
      if (!campo.getClientRects().length || (campo as HTMLInputElement).disabled) return;
      if (campo.closest('[aria-hidden="true"], .sr-only, .hidden-tab')) return;
      let el: Element = campo;
      for (let i = 0; i < 3 && el; i++) {
        const st = getComputedStyle(el);
        const proprio = parse(st.backgroundColor);
        if (bordoVisibile(st).length || (proprio && proprio.a > 0) || st.boxShadow !== 'none') break;
        el = el.parentElement!;
      }
      const st = getComputedStyle(el);
      const fuori = sfondo(el.parentElement!);
      if (fuori === 'immagine') return;
      const proprio = parse(st.backgroundColor);
      const dentro = proprio && proprio.a > 0 ? sopra(proprio, fuori) : fuori;
      const bordi = bordoVisibile(st).map(c => contrasto(sopra(c, fuori), fuori));
      const migliore = Math.max(contrasto(dentro, fuori), ...bordi, 0);
      if (migliore < 3) {
        const colBordo = bordoVisibile(st)[0];
        out.push({
          elemento: descrivi(campo) + (el !== campo ? ' (contenitore ' + descrivi(el) + ')' : ''),
          testo: (campo as HTMLInputElement).placeholder || campo.id || '',
          fg: colBordo ? hex(sopra(colBordo, fuori)) : hex(dentro), bg: hex(fuori),
          ratio: Math.round(migliore * 100) / 100, minimo: 3,
        });
      }
    });
    return out;
  }

  const candidati: { el: Element; testo: string; placeholder?: boolean }[] = [];
  const walker = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
  const visti = new Set<Element>();
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent!.trim();
    const el = walker.currentNode.parentElement;
    if (!t || !el || visti.has(el)) continue;
    visti.add(el);
    candidati.push({ el, testo: t });
  }
  radice.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
    const i = el as HTMLInputElement;
    if (!i.value) candidati.push({ el, testo: i.placeholder, placeholder: true });
  });

  // Fondi pieni d'accento ammessi nei temi scuri (modo 'sfondi').
  const root = getComputedStyle(document.documentElement);
  const accenti = ['--color-primary', '--color-primary-hover', '--color-danger', '--color-danger-hover', '--color-warning']
    .map(n => parse(root.getPropertyValue(n).trim())).filter(Boolean).map(hex);

  for (const { el, testo, placeholder } of candidati) {
    if (!el.getClientRects().length) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || el.closest('[aria-hidden="true"], .sr-only')) continue;
    if ((el as HTMLButtonElement).disabled || el.closest(':disabled, [aria-disabled="true"]')) continue; // esenti (1.4.3)
    const bg = sfondo(el);
    if (bg === 'immagine') continue;
    if (modo === 'sfondi') {
      if (lum(bg) > 0.4 && !accenti.includes(hex(bg))) {
        out.push({ elemento: descrivi(el), testo: testo.slice(0, 50), fg: hex(parse(s.color) || bg), bg: hex(bg), ratio: Math.round(lum(bg) * 100) / 100, minimo: 0.4 });
      }
      continue;
    }
    const fgRaw = parse(placeholder ? getComputedStyle(el, '::placeholder').color : s.color);
    if (!fgRaw) continue;
    fgRaw.a *= opacitaCumulata(el);
    const fg = sopra(fgRaw, bg);
    const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const px = parseFloat(s.fontSize);
    const grande = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    if (ratio < minimo) {
      out.push({
        elemento: descrivi(el) + (placeholder ? '::placeholder' : ''),
        testo: testo.slice(0, 50), fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio * 100) / 100, minimo,
      });
    }
  }
  return out;
}
