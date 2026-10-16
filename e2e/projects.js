const PROJECTS = {
  a11y: ['a11y', 'a11y-global', 'a11y-contrast', 'a11y-modali-rari'],
  smoke: ['app', 'workspace', 'security'],
  ui: ['ui', 'settings', 'list-view', 'sidebar-panels', 'context-menu', 'modals-misc', 'flow-responsive', 'form', 'sort-table', 'image-viewer', 'filters', 'command-palette', 'tutorial', 'bulk-actions', 'updater', 'cascata'],
  data: ['items', 'folders', 'types', 'tags-search', 'trascrizione', 'attachments', 'merge-conflict', 'sync-base', 'csv-export', 'csv-import', 'import-zip', 'iiif-import', 'ocr', 'print', 'text-export', 'schema-migration', 'typed-fields', 'campi-propri', 'data-storica', 'tags-entity', 'fase3', 'fase4', 'cross-archive', 'scanner'],
  cloud: ['cloud-status', 'cloud-offline'],
  manuali: ['prove-manuali', 'hub-locale', 'wifi-emulatore', 'pacchetto']
};

function testMatchFor(nome) {
  return PROJECTS[nome].map(f => `**/${f}.spec.ts`);
}

module.exports = { PROJECTS, testMatchFor };
