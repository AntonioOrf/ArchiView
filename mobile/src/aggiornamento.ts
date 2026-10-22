export type Release = { tag_name: string; draft: boolean; assets: { name: string; browser_download_url: string; size: number }[] };
export type Nuova = { versione: string; url: string; byte: number };

const PREFISSO = 'scanner-v';
const numeri = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);

export function piuNuova(a: string, b: string): boolean {
  const x = numeri(a), y = numeri(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

export function ultimaApk(releases: Release[], attuale: string): Nuova | null {
  let migliore: Nuova | null = null;
  for (const r of releases) {
    if (r.draft || !r.tag_name.startsWith(PREFISSO)) continue;
    const apk = r.assets.find(a => a.name.endsWith('.apk'));
    const versione = r.tag_name.slice(PREFISSO.length);
    if (apk && piuNuova(versione, migliore?.versione ?? attuale)) migliore = { versione, url: apk.browser_download_url, byte: apk.size };
  }
  return migliore;
}
