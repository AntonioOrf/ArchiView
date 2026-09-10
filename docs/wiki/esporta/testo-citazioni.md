# Esportare trascrizioni e citazioni

Due esportazioni pensate per chi **scrive**: il testo delle trascrizioni da portare in un
articolo, e le citazioni bibliografiche da versare in Zotero o in LaTeX.

Si raggiungono dal menu del tasto destro su una scheda o su una cartella, dalla palette dei
comandi e dal pulsante di esportazione dentro l'ambiente di trascrizione.

## Cinque formati

| Formato | A che serve |
| --- | --- |
| **HTML** | Un file autonomo che si apre nel browser e si può inviare a chiunque |
| **Markdown** | Portare il testo in un editor moderno, in un sito, in un repository |
| **RTF** | Aprire in Word o LibreOffice conservando la formattazione |
| **BibTeX** | Citare in LaTeX |
| **RIS** | Importare in Zotero, Mendeley, EndNote |

![La finestra di esportazione con la scelta dell'ambito e dei cinque formati](/img/esporta-testo.png)

## Che cosa esce

Per le trascrizioni: l'ambito che scegli (scheda aperta, selezione, cartella, archivio filtrato),
con le intestazioni delle carte.

Una scheda **senza** trascrizione non sparisce dal file: compare con la sua intestazione e la
nota «Nessuna trascrizione». Un export che perde per strada tre schede su venti senza dirlo è
peggio di uno vuoto.

## L'incertezza dell'OCR sopravvive

Le parole segnate come incerte da un riconoscimento automatico restano marcate:

- in **Markdown** diventano `[?]`, la convenzione filologica per una lettura dubbia;
- in **RTF** restano sottolineate con la linea ondulata;
- la nota di provenienza («questo testo viene da un riconoscimento automatico») viene riportata.

È voluto: una bozza OCR che esce dall'app senza dichiararsi diventerebbe una trascrizione
falsamente autorevole nell'articolo di qualcun altro.

## Citazioni

BibTeX e RIS producono una voce per scheda, del tipo «manoscritto», con fondo, autore e data
presi dalle intestazioni impostate per la stampa — sono lo stesso dato, e una seconda copia
finirebbe per dire un fondo diverso nel `.bib` e sulla carta.

Due accortezze già gestite:

- il **titolo** è protetto dalle regole di capitalizzazione degli stili bibliografici, che
  altrimenti abbasserebbero le maiuscole dei nomi propri;
- le **chiavi di citazione** sono deduplicate: due carte dello stesso notaio nello stesso anno
  esistono, e senza suffisso la seconda citazione punterebbe al documento sbagliato.

L'anno viene estratto solo se plausibile: un numero di registro non finirà mai a fare da anno.

## Prima di esportare

La trascrizione aperta viene salvata automaticamente: esporti l'ultima riga che hai battuto, non
quella di prima.
