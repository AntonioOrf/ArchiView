import { defineConfig } from '@playwright/test';

const { PROJECTS, testMatchFor } = require('./e2e/projects');

// Suite E2E per l'app Electron ArchiView.
// I test lanciano l'app buildata (out/main/main.js). Prerequisito: `npm run build-ts`
// (gestito da pretest:e2e per il run completo; gli script per area NON ricostruiscono).
//
// PERCHÉ IL PARALLELISMO È SICURO (non riportare `workers` a 1):
// ogni test riceve una userData temporanea propria (e2e/fixtures.ts) e src/main/e2eBootstrap.ts
// vi reindirizza sia `userData` sia `sessionData` prima di ogni altro modulo. Il
// requestSingleInstanceLock() di main.ts è quindi per-cartella-temporanea, non globale: istanze
// Electron concorrenti non si contendono nulla. Misurato su questa suite: 364s in seriale contro
// ~100s con 8 worker.
export default defineConfig({
  testDir: './e2e',
  // I test sono indipendenti uno per uno (Electron + userData propri), quindi la
  // parallelizzazione può scendere sotto il livello del file: senza, folders.spec.ts (13 test)
  // diventerebbe il collo di bottiglia dell'intero run.
  fullyParallel: true,
  // I runner GitHub hanno 2-4 core: 2 è il tetto utile lì. In locale metà dei core logici.
  workers: process.env.CI ? 2 : '50%',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 45s e non 30: con più Electron in avvio simultaneo la contesa su CPU e I/O allunga il singolo
  // lancio, e un timeout tarato sul caso seriale diventa una sorgente di falsi rossi.
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Un progetto per area, così durante il lavoro si lancia solo la parte toccata
  // (`npm run test:e2e:cloud`) invece dei 6 minuti dell'intera suite.
  // I gruppi stanno in e2e/projects.js, condivisi con la guardia test/e2eProjects.test.js:
  // uno spec fuori da ogni gruppo NON verrebbe eseguito e il run resterebbe verde.
  projects: Object.keys(PROJECTS).map(nome => ({
    name: nome,
    testMatch: testMatchFor(nome),
  })),
});
