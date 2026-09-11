import { defineConfig } from 'vitepress';

// Il sito statico è servito da docs/public: la wiki viene compilata dentro
// docs/public/wiki e pubblicata dallo stesso deploy (nessun dominio esterno,
// nessun iframe). `base` deve combaciare con quella sottocartella.
//
// Due lingue: l'italiano è la radice (/wiki/), l'inglese vive sotto /wiki/en/.
// Le pagine inglesi hanno percorsi inglesi (guide/, export/, sync/, data/): un
// lettore che legge l'URL deve capirlo senza conoscere l'italiano.
export default defineConfig({
  title: 'Wiki ArchiView',
  base: '/wiki/',
  outDir: '../public/wiki',
  // false di proposito: Firebase Hosting serve gli URL senza estensione solo con
  // "cleanUrls" in firebase.json, che redirigerebbe anche /privacy.html del sito
  // esistente. Con false la wiki emette link .html e il sito resta intoccato.
  cleanUrls: false,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
      }
    ]
  ],

  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/AntonioOrf/ArchiView' }],
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: 'Cerca nella wiki', buttonAriaLabel: 'Cerca nella wiki' },
              modal: {
                displayDetails: 'Mostra dettagli',
                resetButtonTitle: 'Azzera la ricerca',
                backButtonTitle: 'Chiudi',
                noResultsText: 'Nessun risultato per',
                footer: { selectText: 'per aprire', navigateText: 'per navigare', closeText: 'per chiudere' }
              }
            }
          }
        }
      }
    }
  },

  locales: {
    root: {
      label: 'Italiano',
      lang: 'it-IT',
      description:
        "Guida d'uso di ArchiView: catalogazione, trascrizione e archiviazione di manoscritti e documenti storici.",
      themeConfig: {
        outline: { level: [2, 3], label: 'In questa pagina' },
        darkModeSwitchLabel: 'Tema',
        lightModeSwitchTitle: 'Passa al tema chiaro',
        darkModeSwitchTitle: 'Passa al tema scuro',
        returnToTopLabel: 'Torna su',
        sidebarMenuLabel: 'Sezioni',
        langMenuLabel: 'Cambia lingua',
        lastUpdatedText: 'Ultimo aggiornamento',
        docFooter: { prev: 'Precedente', next: 'Successiva' },

        nav: [
          { text: 'Primi passi', link: '/primi-passi/installazione' },
          { text: 'Guida', link: '/guida/schede' },
          { text: 'Esportare', link: '/esporta/stampa' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Sito', link: 'https://archiview.web.app/' },
          { text: 'Scarica', link: 'https://github.com/AntonioOrf/ArchiView/releases' }
        ],

        sidebar: [
          {
            text: 'Primi passi',
            collapsed: false,
            items: [
              { text: 'Installazione', link: '/primi-passi/installazione' },
              { text: 'Primo avvio', link: '/primi-passi/primo-avvio' },
              { text: "L'interfaccia", link: '/primi-passi/interfaccia' }
            ]
          },
          {
            text: 'Lavorare con le schede',
            collapsed: false,
            items: [
              { text: 'Creare e compilare una scheda', link: '/guida/schede' },
              { text: 'Modelli di documento', link: '/guida/modelli' },
              { text: 'Campi propri di una scheda', link: '/guida/campi-propri' },
              { text: 'Datazioni storiche', link: '/guida/date-storiche' },
              { text: 'Cartelle e archivi', link: '/guida/cartelle-archivi' },
              { text: 'Allegati', link: '/guida/allegati' },
              { text: 'Trascrizione', link: '/guida/trascrizione' },
              { text: 'OCR degli allegati', link: '/guida/ocr' }
            ]
          },
          {
            text: 'Trovare e organizzare',
            collapsed: false,
            items: [
              { text: 'Ricerca e filtri', link: '/guida/ricerca-filtri' },
              { text: 'Tag', link: '/guida/tag' },
              { text: 'Vocabolari controllati', link: '/guida/vocabolari' },
              { text: 'Collegamenti, persone e luoghi', link: '/guida/collegamenti' },
              { text: 'Lavorare su più schede', link: '/guida/selezione-multipla' },
              { text: 'Comandi rapidi e scorciatoie', link: '/guida/scorciatoie' }
            ]
          },
          {
            text: 'Stampare ed esportare',
            collapsed: false,
            items: [
              { text: 'Stampare e salvare in PDF', link: '/esporta/stampa' },
              { text: 'Esportare in CSV o Excel', link: '/esporta/csv' },
              { text: 'Importare da CSV o Excel', link: '/esporta/importa-csv' },
              { text: 'Trascrizioni e citazioni', link: '/esporta/testo-citazioni' }
            ]
          },
          {
            text: 'Sincronizzazione',
            collapsed: false,
            items: [
              { text: 'Come funziona', link: '/cloud/sincronizzazione' },
              { text: 'Condividere con altri', link: '/cloud/condivisione' },
              { text: 'Controllo modifiche e storico', link: '/cloud/versioni' },
              { text: 'Quando due modifiche si scontrano', link: '/cloud/conflitti' }
            ]
          },
          {
            text: 'I tuoi dati',
            collapsed: false,
            items: [
              { text: 'Cestino, snapshot e cronologia', link: '/dati/cestino-snapshot' },
              { text: 'Backup, export e trasferimento', link: '/dati/backup-export' },
              { text: 'Dove sono salvati i dati', link: '/dati/formato' }
            ]
          },
          {
            text: 'Altro',
            collapsed: false,
            items: [
              { text: 'Domande frequenti', link: '/faq' },
              { text: 'Glossario', link: '/glossario' }
            ]
          }
        ],

        footer: {
          message: 'Wiki utente di ArchiView, software open source (licenza MIT).',
          copyright: '© 2026 Antonio Orfitelli'
        }
      }
    },

    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      description:
        'ArchiView user guide: cataloguing, transcribing and preserving medieval manuscripts and historical documents.',
      themeConfig: {
        outline: { level: [2, 3], label: 'On this page' },

        nav: [
          { text: 'Getting started', link: '/en/getting-started/installation' },
          { text: 'Guide', link: '/en/guide/records' },
          { text: 'Export', link: '/en/export/print' },
          { text: 'FAQ', link: '/en/faq' },
          { text: 'Website', link: 'https://archiview.web.app/' },
          { text: 'Download', link: 'https://github.com/AntonioOrf/ArchiView/releases' }
        ],

        sidebar: [
          {
            text: 'Getting started',
            collapsed: false,
            items: [
              { text: 'Installation', link: '/en/getting-started/installation' },
              { text: 'First run', link: '/en/getting-started/first-run' },
              { text: 'The interface', link: '/en/getting-started/interface' }
            ]
          },
          {
            text: 'Working with records',
            collapsed: false,
            items: [
              { text: 'Creating and filling in a record', link: '/en/guide/records' },
              { text: 'Document models', link: '/en/guide/models' },
              { text: 'Record-specific fields', link: '/en/guide/custom-fields' },
              { text: 'Historical dates', link: '/en/guide/historical-dates' },
              { text: 'Folders and archives', link: '/en/guide/folders-archives' },
              { text: 'Attachments', link: '/en/guide/attachments' },
              { text: 'Transcription', link: '/en/guide/transcription' },
              { text: 'OCR of attachments', link: '/en/guide/ocr' }
            ]
          },
          {
            text: 'Finding and organising',
            collapsed: false,
            items: [
              { text: 'Search and filters', link: '/en/guide/search-filters' },
              { text: 'Tags', link: '/en/guide/tags' },
              { text: 'Controlled vocabularies', link: '/en/guide/vocabularies' },
              { text: 'Links, people and places', link: '/en/guide/links' },
              { text: 'Working on several records', link: '/en/guide/multiple-records' },
              { text: 'Commands and shortcuts', link: '/en/guide/shortcuts' }
            ]
          },
          {
            text: 'Printing and exporting',
            collapsed: false,
            items: [
              { text: 'Printing and saving as PDF', link: '/en/export/print' },
              { text: 'Exporting to CSV or Excel', link: '/en/export/csv' },
              { text: 'Importing from CSV or Excel', link: '/en/export/csv-import' },
              { text: 'Transcriptions and citations', link: '/en/export/text-citations' }
            ]
          },
          {
            text: 'Synchronisation',
            collapsed: false,
            items: [
              { text: 'How it works', link: '/en/sync/how-it-works' },
              { text: 'Sharing with others', link: '/en/sync/sharing' },
              { text: 'Change control and history', link: '/en/sync/versions' },
              { text: 'When two edits collide', link: '/en/sync/conflicts' }
            ]
          },
          {
            text: 'Your data',
            collapsed: false,
            items: [
              { text: 'Trash, snapshots and history', link: '/en/data/trash-snapshots' },
              { text: 'Backup, export and transfer', link: '/en/data/backup-export' },
              { text: 'Where your data is stored', link: '/en/data/storage' }
            ]
          },
          {
            text: 'More',
            collapsed: false,
            items: [
              { text: 'Frequently asked questions', link: '/en/faq' },
              { text: 'Glossary', link: '/en/glossary' }
            ]
          }
        ],

        footer: {
          message: 'ArchiView user wiki. Open source software (MIT licence).',
          copyright: '© 2026 Antonio Orfitelli'
        }
      }
    }
  }
});
