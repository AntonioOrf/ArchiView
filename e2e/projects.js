// Raggruppamento degli spec E2E per area, fonte UNICA della verità.
//
// Serve a due consumatori: playwright.config.ts (che ne deriva i `projects`, così si può
// lanciare `--project=cloud` invece dell'intera suite) e test/e2eProjects.test.js (che
// verifica la copertura). Vive in .js CommonJS proprio per essere leggibile da entrambi:
// tsconfig.json compila solo src/**, quindi un .ts qui non sarebbe requireable dai test unit.
//
// I nomi sono senza estensione: la config li espande in `<nome>.spec.ts`.
//
// ATTENZIONE: con i `projects` di Playwright, uno spec che non compare in nessun gruppo
// NON viene eseguito e nessuno se ne accorge. La guardia in test/e2eProjects.test.js
// (agganciata a `npm run test:unit`) esiste per intercettare esattamente questo.
const PROJECTS = {
  smoke: ['app', 'workspace', 'security'],
  ui: ['ui', 'list-view', 'sidebar-panels', 'context-menu', 'modals-misc', 'flow-responsive', 'form'],
  data: ['items', 'folders', 'types', 'tags-search', 'trascrizione', 'attachments', 'merge-conflict'],
  cloud: ['cloud-status', 'cloud-offline'],
  a11y: ['a11y', 'a11y-global']
};

// `a11y` è prefisso di `a11y-global`: i pattern devono ancorare il nome completo, altrimenti
// `**/a11y*.spec.ts` tirerebbe dentro anche l'altro file. Da qui la lista esplicita.
function testMatchFor(nome) {
  return PROJECTS[nome].map(f => `**/${f}.spec.ts`);
}

module.exports = { PROJECTS, testMatchFor };
