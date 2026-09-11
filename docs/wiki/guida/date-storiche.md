# Datazioni storiche

Le date dei documenti d'archivio non sono date da calendario: sono `c. 1340`, `ante 1350`,
`sec. XIV in.`, `1340-45`, `s.d.`. ArchiView le **interpreta**, senza mai riscriverle, e da
quell'interpretazione ricava l'ordinamento cronologico e il filtro per periodo.

## Come si scrive una data

Scrivi come scriveresti in un regesto. L'app riconosce:

| Forma | Esempi |
| --- | --- |
| Data completa | `12 maggio 1340`, `1340 maggio 12`, `12/05/1340`, mesi latini compresi |
| Solo anno | `1340` |
| Mese e anno | `maggio 1340` |
| Approssimazione | `c. 1340`, `ca. 1340`, `circa 1340`, `verso il 1340`, `intorno al 1340` |
| Termine ante quem | `ante 1350`, `prima del 1350` |
| Termine post quem | `post 1330`, `dopo il 1330` |
| Intervallo | `1340-1345`, `1340-45`, `tra il 1340 e il 1345` |
| Secolo | `sec. XIV`, `sec. XIV in.`, `sec. XIV ex.`, `sec. XIV med.`, prima e seconda metà |
| Senza data | `s.d.` |

Sotto il campo, mentre scrivi, l'app dichiara **come ha letto** quello che hai scritto. È il
punto più utile della funzione: verifichi subito se l'ordinamento collocherà la scheda dove ti
aspetti.

![Il campo Data Cronica con il riscontro dell'interpretazione sotto](/img/form-scheda.png){.light-only}
![Il campo Data Cronica con il riscontro dell'interpretazione sotto](/img/form-scheda-scuro.png){.dark-only}

## Quello che non viene riconosciuto

Non viene indovinato. Una datazione che l'app non capisce resta un testo qualsiasi: non entra
negli ordinamenti cronologici (finisce **in coda**, in entrambe le direzioni) e non risponde ai
filtri per periodo.

Il motivo: un intervallo inventato entrerebbe negli ordinamenti come se fosse un dato certo.
Se una datazione ti serve ordinabile e l'app non la riconosce, riformulala in una delle forme
qui sopra.

## Ordinare cronologicamente

Nell'elenco puoi ordinare per il campo data: le schede si dispongono in ordine cronologico
vero, non alfabetico. Senza questa interpretazione «12 maggio 1340» verrebbe prima di «3 aprile
1290», perché 1 viene prima di 3.

Le datazioni con il solo termine *ante* si ordinano sulla loro **fine**, non avendo un inizio:
altrimenti finirebbero in testa all'archivio insieme ai documenti più antichi.

## Filtrare per periodo

Nei filtri avanzati puoi chiedere un intervallo di anni o un secolo.

Il criterio è la **sovrapposizione**, non il contenimento: cercando il Trecento, una scheda
datata `1290-1310` **compare**. Escluderla nasconderebbe proprio i documenti a cavallo, che sono
quelli che di solito si stanno cercando.

::: tip Due filtri diversi, da non confondere
**Periodo del documento** = quando il documento è stato scritto.
**Data di modifica** = quando tu hai toccato la scheda l'ultima volta.
Sono due filtri distinti, con icone e intestazioni diverse.
:::

## Dettagli

- `circa` **non allarga** l'intervallo di cinque anni: è un'incertezza dichiarata, non una
  quantità che nessuno ha scritto.
- L'interpretazione **non viene salvata** nella scheda: nel database resta il testo che hai
  scritto. Se il riconoscimento migliorerà in una versione futura, le tue schede ne
  beneficeranno senza che tu debba correggerle.
- Un tipo di documento che non ha nessun campo di tipo data non compare mai nei risultati di un
  filtro per periodo: mostrarlo equivarrebbe a dire che quella scheda è del Trecento senza
  saperlo.
