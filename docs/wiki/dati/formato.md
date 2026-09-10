# Dove sono salvati i dati

Non serve essere informatici per capire questa pagina, ed è utile leggerla: sapere dove stanno i
propri dati è ciò che permette di non perderli.

## Nella tua cartella di lavoro

Tutto vive nella cartella scelta al primo avvio:

```
La tua cartella di lavoro
├── database_manoscritti.json     tutte le schede e le trascrizioni
└── allegati_manoscritti/         le immagini e i PDF allegati
```

Nient'altro. Nessun database nascosto, nessun archivio proprietario, nessun file sparso nel
sistema.

## Perché è importante

- **Nessun blocco tecnologico.** Il file `.json` è un file di testo strutturato: si apre con un
  qualsiasi editor, si legge, si ispeziona. Se un domani ArchiView non esistesse più, i tuoi dati
  resterebbero leggibili e recuperabili.
- **Il trasferimento è una copia.** Non c'è nessuna procedura di esportazione da imparare per
  spostare un archivio: si copia la cartella.
- **Il backup è una copia.** Vedi [Backup, export e trasferimento](/dati/backup-export).

## Gli allegati sono copie

Quando alleghi un'immagine o un PDF, il file viene **copiato** dentro `allegati_manoscritti`.
L'originale può essere spostato o cancellato senza rompere la scheda — ma lo spazio occupato su
disco raddoppia rispetto ai file di partenza.

## Cose da non fare

::: warning
- Non modificare `database_manoscritti.json` con un editor di testo mentre ArchiView è aperto:
  le modifiche verrebbero sovrascritte, o il file danneggiato.
- Non tenere la cartella di lavoro dentro una cartella sincronizzata da un servizio cloud
  generico (Dropbox, OneDrive, Google Drive) se lavori dallo stesso archivio su più computer:
  due sincronizzazioni contemporanee possono corrompere il file. Per lavorare su più macchine usa
  la [sincronizzazione integrata](/cloud/sincronizzazione).
- Non rinominare a mano i file dentro `allegati_manoscritti`: le schede li cercano con il nome
  che avevano quando sono stati allegati.
:::

## E i dati personali?

ArchiView funziona offline: se non attivi la sincronizzazione, nulla lascia il tuo computer.
Il dettaglio di cosa viene trattato quando la attivi è nella
[Privacy Policy](https://archiview.web.app/privacy.html).
