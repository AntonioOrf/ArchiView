# Esportare in CSV o Excel

L'esportazione CSV/TSV serve per lavorare sui **dati** delle schede fuori dall'app: un foglio di
calcolo, un grafico, un'analisi statistica, un elenco da consegnare.

Si trova nel menu «⋯» sopra l'elenco, nel menu del tasto destro su una scheda o su una cartella,
e nella palette dei comandi (`Ctrl+K` → «csv» o «excel»).

## Che cosa contiene il file

Una riga per scheda. Le colonne sono:

1. otto colonne fisse — segnatura, tipo di documento, cartella, tag, allegati, data di modifica,
   modificato da, creato da;
2. tutti i campi dei modelli presenti fra le schede esportate;
3. l'identificativo interno, come **ultima** colonna (è un codice illeggibile: in testa
   spingerebbe la segnatura fuori schermo).

I campi di tipo sì/no escono come «Sì» e «No», non come `true`/`false`: in una cella di Excel
quelle due parole non sono leggibili, e in italiano non sono nemmeno valori riconosciuti.

## CSV o TSV?

| Formato | Quando |
| --- | --- |
| **CSV** | Aprire il file con Excel o LibreOffice |
| **TSV** | Leggerlo con strumenti di analisi (R, pandas), o quando le celle contengono virgole e punti e virgola |

## Excel in italiano: due accorgimenti già inclusi

Il file esportato contiene due dettagli invisibili che evitano i due problemi classici:

- una marcatura di codifica che impedisce a Excel di trasformare le diacritiche medievali in
  caratteri incomprensibili;
- una prima riga tecnica (`sep=,`) che dice a Excel qual è il separatore. Senza, con le
  impostazioni italiane l'intera riga finisce nella prima cella.

Se leggi il file con strumenti di analisi, salta quella prima riga oppure usa il TSV, che non ne
ha bisogno.

::: tip Sicurezza
Le celle che iniziano con `=`, `+`, `@` o `-` vengono neutralizzate con un apostrofo: senza,
Excel le interpreterebbe come formule. Reimportando il file in ArchiView l'apostrofo viene tolto,
quindi un giro export → import non altera le segnature.
:::

## Il giro completo funziona

Un archivio esportato in CSV si può **reimportare** in ArchiView senza perdite: le colonne
vengono riconosciute, i tipi di documento pure. Vedi [Importare da CSV](/esporta/importa-csv).

È una garanzia deliberata: un'esportazione che non rientra non è un formato aperto, è un vicolo
cieco.
