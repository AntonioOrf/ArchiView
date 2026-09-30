# Importare da IIIF

Quasi tutte le biblioteche che digitalizzano codici medievali — BnF/Gallica, e-codices, la
Vaticana, la British Library, la Bodleian — pubblicano per ogni manoscritto un **manifest IIIF**:
un indirizzo che descrive la sequenza delle carte e da cui le immagini si ottengono a qualunque
risoluzione. Basta quell'indirizzo per avere in ArchiView una scheda con tutte le carte in
ordine, già etichettate, senza scaricare nulla.

## Dove si trova il manifest

Sul sito della biblioteca, nella pagina del manoscritto, cerca il logo IIIF (una «i» colorata) o
una voce come *Manifest*, *IIIF Manifest*, *Condividi → IIIF*. L'indirizzo finisce spesso in
`manifest.json` o `/manifest`.

::: tip
Se ArchiView risponde che l'indirizzo «non restituisce un manifest», probabilmente hai copiato
l'indirizzo della pagina web del manoscritto e non quello del suo manifest. Se risponde che è una
**collezione**, hai copiato l'elenco di un intero fondo: apri il singolo manoscritto e copia il suo.
:::

## Creare una scheda da un manifest

1. Menu «⋯» sopra l'elenco → **Importa** → **Importa da IIIF**.
2. Incolla l'indirizzo e premi **Leggi**. Compaiono il titolo, il numero di carte e, sotto,
   l'attribuzione e la licenza dichiarate dalla biblioteca.
3. Scegli le **carte da importare**. Un manifest contiene quasi sempre più del testo: piatti,
   dorso, carte di guardia, il regolo dei colori. Puoi spuntarle una per una, usare **Tutte** e
   **Nessuna**, o scrivere un intervallo come `1-10, 25, 40-60`.
4. Controlla **segnatura** (proposta dal titolo del manifest), **modello** e **cartella**.
5. Premi **Importa**.

La scheda nasce con le carte già in sequenza e con il nome che dà loro la biblioteca (per
esempio «f. 1r», «f. 1v»), e si trascrive come qualunque altra. L'intero import si annulla con `Ctrl+Z`.

## Aggiungere carte a una scheda esistente

Nell'ambiente di trascrizione, il pulsante **Aggiungi da IIIF** apre la stessa finestra, senza i
campi della scheda nuova: le carte scelte si aggiungono in coda a quelle che ci sono già. Serve,
per esempio, quando lo stesso documento è diviso fra due segnature.

## Le carte restano in biblioteca

Le carte importate da IIIF **non occupano spazio** nell'archivio e non appesantiscono la
sincronizzazione: restano sul server della biblioteca e vengono mostrate al volo. Nel visore
funzionano come le altre: zoom, rotazione, filtri, una trascrizione per carta.

Le carte già guardate restano disponibili **anche senza rete**, in una memoria temporanea sul tuo
computer (fino a 2 GB; le meno usate vengono tolte per prime). Quella memoria non fa parte
dell'archivio e non si sincronizza.

## Scaricare le carte nell'archivio

Per alcune cose serve il file vero: l'[OCR](/guida/ocr), la stampa ad alta qualità, il lavoro
sicuro offline, la conservazione a lungo termine. Nella barra del visore, su una carta remota:

- **Scarica questa carta nell'archivio**;
- **Scarica tutte le carte nell'archivio**.

La **risoluzione dei download** si sceglie nella finestra di import: 1200, 2000 (predefinita) o
4000 pixel sul lato lungo, oppure la massima disponibile. Alcuni manifest pubblicano solo
immagini a misura fissa, e in quel caso la scelta viene ignorata (l'app lo segnala).

Una volta scaricata, la carta diventa un allegato come gli altri.

## Licenza e attribuzione

Le immagini appartengono alla biblioteca che le pubblica. ArchiView conserva nella scheda
l'**attribuzione** e la **licenza** dichiarate nel manifest: tienine conto quando pubblichi o
condividi le riproduzioni.

## Se una carta non si vede

«Carta non raggiungibile» vuol dire che il server della biblioteca non l'ha restituita: può essere
momentaneamente irraggiungibile, o sei offline e quella carta non è mai stata guardata. Riprova
più tardi, oppure scaricala nell'archivio quando la rete c'è.

::: details Dettagli tecnici
Sono supportati IIIF Presentation 2 e 3 e IIIF Image API 2 e 3, le etichette in più lingue, le
immagini alternative della stessa carta (per esempio luce visibile e ultravioletto) e i manifest
senza servizio di immagini.
:::
