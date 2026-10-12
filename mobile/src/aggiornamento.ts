// Aggiornamento dell'app dalle release GitHub `scanner-v*` (prerelease, mai «latest»: vedi
// .github/workflows/mobile-release.yml). Android non installa in silenzio un APK fuori dal Play
// Store: si scarica l'APK e si apre l'installer di sistema, l'utente tocca «Installa».
// Solo la scelta della release qui (testata in node); download e installer in aggiornaApp.ts.

export type Release = { tag_name: string; draft: boolean; assets: { name: string; browser_download_url: string }[] };
export type Nuova = { versione: string; url: string };

const PREFISSO = 'scanner-v';
const numeri = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);

/** `a` è una versione X.Y.Z più recente di `b`. */
export function piuNuova(a: string, b: string): boolean {
  const x = numeri(a), y = numeri(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/** La release dello scanner più recente con un APK allegato, se più nuova di `attuale`. */
export function ultimaApk(releases: Release[], attuale: string): Nuova | null {
  let migliore: Nuova | null = null;
  for (const r of releases) {
    if (r.draft || !r.tag_name.startsWith(PREFISSO)) continue;
    const apk = r.assets.find(a => a.name.endsWith('.apk'));
    const versione = r.tag_name.slice(PREFISSO.length);
    if (apk && piuNuova(versione, migliore?.versione ?? attuale)) migliore = { versione, url: apk.browser_download_url };
  }
  return migliore;
}
