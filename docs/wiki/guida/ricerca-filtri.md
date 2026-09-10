# Ricerca e filtri

Tre strumenti che si sommano: la ricerca a testo libero, i [tag](/guida/tag) e i filtri avanzati.

## Ricerca globale

Pannello a sinistra, icona della lente (`Ctrl+F`). Cerca in tempo reale dentro **metadati,
titoli, corpo delle trascrizioni** e testo riconosciuto dall'[OCR](/guida/ocr).

Accenti e maiuscole non contano: `citta` trova «città». Scrivendo più parole, la ricerca cerca
le schede che le contengono **tutte**, non una qualsiasi.

Per cercare un'espressione esatta, usa le virgolette:

```
"ad instantiam"
```

## Cercare dentro un campo preciso

Scrivi il nome del campo seguito dai due punti:

```
notaio:rossi
```

Restituisce solo le schede in cui il campo *notaio* contiene «rossi»: non quelle che nominano
Rossi in una nota, né quelle prive di quel campo.

Se il valore contiene spazi, virgolette:

```
notaio:"de rubeis"
```

Le abbreviazioni riconosciute, che nessuno digiterebbe per esteso:

| Scrivi | Cerca in |
| --- | --- |
| `tag:` | I tag della scheda |
| `tipo:` | Il tipo di documento |
| `archivio:` | La cartella |
| `modificato:` | La data di modifica |
| `ocr:` | Il testo riconosciuto automaticamente negli allegati |

I vincoli si combinano, e si combinano con il testo libero:

```
tipo:imbreviature notaio:rossi dote
```

## Filtri avanzati

Il pulsante dei filtri sopra l'elenco restringe le schede per:

- **tipo di documento**;
- **sottocartelle** (estende la ricerca al ramo, non solo alla cartella aperta);
- **periodo del documento**: un intervallo di anni o un secolo, vedi
  [Datazioni storiche](/guida/date-storiche);
- **intervallo di data di modifica**;
- **presenza di allegati**;
- **presenza di trascrizione**;
- **presenza di OCR**;
- **presenza di collegamenti** ad altre schede.

![Il pannello dei filtri avanzati aperto, con tipo, periodo del documento, secolo, allegati, trascrizione, OCR e collegamenti](/img/filtri.png){.light-only}
![Il pannello dei filtri avanzati aperto, con tipo, periodo del documento, secolo, allegati, trascrizione, OCR e collegamenti](/img/filtri-scuro.png){.dark-only}

I filtri attivi restano visibili sopra l'elenco come etichette rimovibili, e il pulsante porta un
contatore, così un archivio filtrato non può essere scambiato per un archivio vuoto.

::: tip Periodo del documento ≠ data di modifica
Il primo è quando il documento è stato scritto, il secondo quando tu hai toccato la scheda.
Sono due filtri distinti.
:::

## Ricerche salvate

Una combinazione di filtri che usi spesso può essere **salvata con un nome** e richiamata con un
clic: «da trascrivere 1432», «carte senza allegato», «atti giudiziari dell'anno in corso».

È la funzione che più fa risparmiare tempo su un archivio grande: vale la pena impostarne due o
tre appena si supera il centinaio di schede.

Le ricerche salvate sono **tue e di questo computer**: non vengono sincronizzate, perché citano
cartelle e tipi che sull'altro computer potrebbero non esistere.

## Ordinamento e vista tabellare

L'elenco si ordina per segnatura, per un campo del tipo di documento, per data di modifica o per
numero di allegati. L'ordinamento delle segnature è **naturale**: `MS 2` viene prima di `MS 10`,
non dopo.

Il comando apposito alterna la **griglia di schede** alla **vista tabellare**. In tabella ogni
intestazione di colonna ordina (un secondo clic inverte) e le colonne visibili si scelgono dal
menu «⋯» → «Colonne visibili», separatamente per ciascun tipo di documento.

![La vista tabellare con le colonne segnatura, marginalia, notaio, data cronica, tag, allegati e data di modifica](/img/vista-tabella.png){.light-only}
![La vista tabellare con le colonne segnatura, marginalia, notaio, data cronica, tag, allegati e data di modifica](/img/vista-tabella-scuro.png){.dark-only}

Per il controllo di un fondo intero la tabella è molto più leggibile della griglia, ed è anche
quella che viene ripresa dalla [stampa in formato tabella](/esporta/stampa).
