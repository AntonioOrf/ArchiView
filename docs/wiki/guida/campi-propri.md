# Campi propri di una scheda

Il modello di documento è una **base**, non una gabbia. Quando un manoscritto porta
un'informazione che il suo modello non prevede (la nota di possesso, la filigrana, un colophon
anomalo), puoi aggiungere un campo **a quella scheda soltanto**.

## Perché non aggiungerlo al modello

Perché dopo cinquanta manoscritti il modello diventerebbe la somma di tutti i casi unici mai
incontrati, con cinquanta colonne vuote al 98%. Il campo proprio risolve esattamente questo: sta
sulla scheda che lo richiede e non appesantisce le altre.

## Aggiungere un campo

Dall'editor della scheda: aggiungi il campo indicandone il **nome** e il **tipo** (testo, testo
lungo, numero, sì/no, elenco, indirizzo web, data).

Il nome diventa anche l'intestazione della colonna nelle esportazioni, quindi scrivilo
leggibile: «Numero di carte», non «numerocarte».

![La finestra per aggiungere un campo alla singola scheda, con nome e tipo](/img/campo-proprio.png){.light-only}
![La finestra per aggiungere un campo alla singola scheda, con nome e tipo](/img/campo-proprio-scuro.png){.dark-only}

::: warning
Togliere un campo proprio cancella anche il valore che conteneva. Non c'è modo di conservare un
dato senza il campo che lo descrive.
:::

## Promuovere un campo al modello

Se ti accorgi che un campo che avevi aggiunto a una scheda ti serve **sempre**, puoi
promuoverlo al modello di documento: da quel momento comparirà in tutte le schede di quel tipo.

Le schede che già lo avevano come campo proprio non si sdoppiano: quando un modello dichiara un
campo con lo stesso nome, vince il modello e il campo compare una volta sola.

È il percorso naturale del lavoro d'archivio: si incontra un caso, poi un secondo, poi ci si
accorge che è una regola.

## Riordinare i campi

Il pulsante **Riordina i campi** trasforma il modulo in un elenco di nomi trascinabili: sposta i
campi nell'ordine in cui ti servono su *quella* scheda, con il trascinamento o con le frecce
↑ ↓ (utilizzabili anche da tastiera).

![L'elenco dei campi in modalità riordino, con le frecce per spostarli](/img/riordino-campi.png){.light-only}
![L'elenco dei campi in modalità riordino, con le frecce per spostarli](/img/riordino-campi-scuro.png){.dark-only}

L'ordine scelto vale nei posti in cui si guarda **una** scheda per volta:

| Vale | Non vale |
| --- | --- |
| Il modulo di compilazione | La vista tabellare |
| La vista a schede | L'esportazione CSV |
| La stampa «per scheda» | |

Tabella e CSV hanno colonne comuni a tutte le schede: l'ordine di una singola scheda non può
riordinare una colonna condivisa. È un limite dichiarato della scelta «ordine per scheda», non
un difetto.

Un campo aggiunto al modello **dopo** che hai riordinato non sparisce: si accoda in fondo.

## In un archivio condiviso

Due persone che aggiungono **campi diversi** alla stessa scheda non entrano in conflitto: i
campi si sommano. Lo stesso campo definito in due modi diversi, invece, è un conflitto vero e te
lo fa decidere l'app.

Un collega con una versione più vecchia del programma **conserva** i valori dei campi propri e
li vede nelle esportazioni e nelle stampe; semplicemente non li vede nel modulo. Non si perde
nulla.
