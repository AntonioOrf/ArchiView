# Tag

I tag sono etichette libere che raggruppano le schede **trasversalmente** rispetto alle cartelle
e ai modelli: una stessa scheda può portarne quante ne vuoi.

## Quando un tag è utile

Quando risponde a una domanda di lavoro che i campi non sanno esprimere:

| Buoni tag | Cattivi tag |
| --- | --- |
| `da rivedere`, `lacunoso`, `foto illeggibile` | il nome del notaio (è già un campo) |
| `tesi cap. 3`, `articolo Zanetti` | la segnatura (è già un campo) |
| `cause matrimoniali`, `atti dotali` | `1340` (è la data) |

Regola pratica: se l'informazione ha già un campo dedicato, non farne anche un tag. La ricerca la
trova comunque, e il doppione andrebbe tenuto aggiornato in due posti.

## Applicare e togliere

Dall'editor della scheda, e su molte schede insieme dal menu del tasto destro
(vedi [Lavorare su più schede](/guida/selezione-multipla)) o con `Ctrl+Maiusc+L`.

## Filtrare per tag

Pannello a sinistra, icona a segnalibro: l'elenco di tutte le etichette usate, ciascuna con il
numero di schede. Un clic filtra l'archivio.

![Il pannello dei tag nella barra laterale, con l'elenco delle etichette e i conteggi](/img/tag.png){.light-only}
![Il pannello dei tag nella barra laterale, con l'elenco delle etichette e i conteggi](/img/tag-scuro.png){.dark-only}

Il confronto è **esatto**: il tag `sec. XIV` non seleziona le schede con `sec. XIV in.`, e il
tag `not` non seleziona quelle con `notaio`. È ciò che rende affidabili i vocabolari gerarchici,
dove i tag condividono per forza il prefisso.

## Gestione tag

Dal pannello dei tag, il pulsante di **gestione** apre la finestra in cui si mette ordine. È lì
che i tag restano utili invece di moltiplicarsi:

- **Rinominare** un tag: la modifica si propaga a tutte le schede che lo portano.
- **Fondere** due tag: `not.` dentro `notaio`, senza lasciare doppioni.
- **Assegnare un colore**: i colori sono nomi (ambra, rosso, verde…), non tinte fisse, così
  restano leggibili anche nel tema scuro.
- **Eliminare** un tag da tutto l'archivio.

![La finestra di gestione tag: elenco con conteggi, colore, rinomina, eliminazione e barra di fusione](/img/gestione-tag.png){.light-only}
![La finestra di gestione tag: elenco con conteggi, colore, rinomina, eliminazione e barra di fusione](/img/gestione-tag-scuro.png){.dark-only}

Ogni operazione è **annullabile** con `Ctrl+Z`, e se stai filtrando per un tag che rinomini o
fondi, il filtro attivo lo segue invece di svuotare la griglia.

::: tip
Assegnare un colore non fa risultare le schede come «modificate» ai colleghi di un archivio
condiviso: l'anagrafica dei tag viaggia a parte.
:::

## Quando conviene fare ordine

Dopo le prime cinquanta schede, e poi a ogni fine progetto. La deriva tipica è
`notaio` / `Notaio` / `not.` / `notarile`: tre minuti nella gestione tag li unificano, mentre
lasciarli divergere significa che nessun filtro darà mai il numero giusto.
