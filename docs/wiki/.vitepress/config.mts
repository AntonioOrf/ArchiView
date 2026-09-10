import { defineConfig } from 'vitepress';

// Il sito statico è servito da docs/public: la wiki viene compilata dentro
// docs/public/wiki e pubblicata dallo stesso deploy (nessun dominio esterno,
// nessun iframe). `base` deve combaciare con quella sottocartella.
export default defineConfig({
  lang: 'it-IT',
  title: 'Wiki ArchiView',
  description: "Guida d'uso di ArchiView: catalogazione, trascrizione e archiviazione di manoscritti e documenti storici.",
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
    outline: { level: [2, 3], label: 'In questa pagina' },
    darkModeSwitchLabel: 'Tema',
    returnToTopLabel: 'Torna su',
    sidebarMenuLabel: 'Sezioni',
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

    socialLinks: [{ icon: 'github', link: 'https://github.com/AntonioOrf/ArchiView' }],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Cerca nella wiki', buttonAriaLabel: 'Cerca nella wiki' },
          modal: {
            displayDetails: 'Mostra dettagli',
            resetButtonTitle: 'Azzera la ricerca',
            backButtonTitle: 'Chiudi',
            noResultsText: 'Nessun risultato per',
            footer: {
              selectText: 'per aprire',
              navigateText: 'per navigare',
              closeText: 'per chiudere'
            }
          }
        }
      }
    },

    footer: {
      message: 'Wiki utente di ArchiView — software open source (licenza MIT).',
      copyright: '© 2026 Antonio Orfitelli'
    }
  }
});
