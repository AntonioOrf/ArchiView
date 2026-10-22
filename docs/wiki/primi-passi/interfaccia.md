# L'interfaccia

Lo schermo di ArchiView è diviso in zone che restano sempre al loro posto: la testata in alto, la
colonna laterale a sinistra, le schede al centro e la barra di stato in fondo.

![La finestra principale di ArchiView: testata in alto, cartelle e tag a sinistra, tabella delle schede al centro e pannello della scheda selezionata a destra](/img/vista-tabella.png){.light-only}
![La finestra principale di ArchiView: testata in alto, cartelle e tag a sinistra, tabella delle schede al centro e pannello della scheda selezionata a destra](/img/vista-tabella-scuro.png){.dark-only}

*Testata in alto, cartelle e tag a sinistra, schede al centro, scheda selezionata a destra.*

## In alto: la testata

Da sinistra a destra:

- le **icone dei pannelli**, che cambiano il contenuto della colonna laterale (tabella sotto);
- il **percorso** della cartella aperta: ogni tratto si clicca per risalire;
- **Cerca nell'archivio**, che apre l'elenco dei comandi e la ricerca (`Ctrl+K`);
- a destra le azioni globali: scansioni in arrivo dal telefono, **condivisione**, tutorial,
  segnala un problema, **impostazioni**.

Le icone dei pannelli:

| Icona | Pannello | A cosa serve |
| --- | --- | --- |
| Cartella | **Cartelle** | Sfogliare l'archivio e le sue sottocartelle. È la vista normale |
| Lente | **Ricerca** | Cercare nei metadati, nei titoli, nelle trascrizioni e nell'OCR |
| Segnalibro | **Tag** | Tutte le etichette usate; un clic filtra. Da qui si apre la gestione tag |
| Modifiche | **Controllo modifiche** | Che cosa hai cambiato e non hai ancora inviato all'archivio remoto |
| Orologio | **Cronologia** | Snapshot locali e versioni precedenti salvate sul cloud |

## A sinistra: archivio, cartelle, ricerche salvate, tag

In cima alla colonna c'è il **selettore degli archivi** (per passare da un archivio all'altro,
crearne, collegarne; «Gestisci archivi…» mostra anche i recenti). Sotto, tre sezioni:
**Cartelle**, **Ricerche salvate** e **Tag**, con il colore di ogni tag e il numero di schede.
I primi dodici tag sono sempre in vista, gli altri sotto «Tutti i tag». Il tasto destro su un tag
ne cambia il colore.

In cima all'albero delle cartelle c'è una riga che porta il **nome dell'archivio**: è la radice,
e raccoglie le schede non ancora messe in una cartella.

Nell'albero ogni scheda porta la sua segnatura; il pulsante in alto a destra del pannello
**Cartelle** vi aggiunge sotto un campo a scelta (il dichiarante, il notaio, l'autore) e
permette di ordinare l'albero per quel campo. Vedi
[Che cosa mostra una scheda nell'albero](/guida/cartelle-archivi#che-cosa-mostra-una-scheda-nell-albero).

## In fondo: la barra di stato

A sinistra lo **stato della sincronizzazione**: se l'archivio è collegato a un remoto, un clic
apre i comandi di scarico e invio, e accanto compare l'azione del momento (per esempio «Invia»).
Su un archivio locale non c'è nulla da guardare. A destra «Salvato alle…» e i conteggi delle
schede.

## Al centro: l'elenco delle schede

Sopra l'elenco, da sinistra a destra:

- **Nuova scheda** (il chevron preseleziona il tipo) e **Nuovo modello**;
- **Filtri** (con il contatore dei filtri attivi), **ordinamento**, e il selettore
  **griglia / tabella**;
- il menu **«⋯»**, che raccoglie il resto: nuovo archivio, importa ed esporta, colonne visibili
  in tabella, cestino, elimina archivio.

La vista predefinita è la **tabella**: la segnatura in carattere monospaziato, i campi principali e
una colonna **Trascrizione** con un pallino (trascritta, n carte su m, con testo, da fare). Chi
aveva già scelto la griglia la ritrova.

Selezionando una sola scheda, a destra si apre il **pannello della scheda**: campi, date lette in
forma normalizzata, allegati, collegamenti, tag e i pulsanti **Modifica** e **Trascrivi**. Su uno
schermo stretto il pannello si nasconde. Il «⋯» di ogni scheda è lo stesso menu del tasto destro.

Sotto l'elenco, il **contatore dei risultati**: quando una selezione è attiva, lì compare quante
schede hai selezionato.

## Tre cose che fanno risparmiare tempo

- `Ctrl+K` apre l'elenco dei comandi: qualunque funzione, senza cercarla nei menu.
- `?` mostra tutte le scorciatoie.
- Il **tasto destro** funziona ovunque: su una scheda, su una cartella, su un archivio. Le voci
  affini sono raccolte in sottomenu (**Vedi**, **Esporta**, **Su N schede**), che si aprono col
  mouse o con la freccia destra e si chiudono con la sinistra o con `Esc`.

Vedi [Comandi rapidi e scorciatoie](/guida/scorciatoie).

## Il tutorial interno

L'icona **?** nella testata riavvia in qualsiasi momento la visita guidata che parte al primo avvio.
