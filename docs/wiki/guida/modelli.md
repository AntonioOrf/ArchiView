# Modelli di documento

Un **modello** (o *tipo di documento*) è l'elenco dei campi che compaiono quando compili una
scheda. È la scelta più importante che fai all'inizio: definisce la forma del tuo archivio.

## Modelli già pronti

ArchiView include tre modelli predefiniti: **Imbreviature notarili**, **Atti giudiziari**,
**Documenti fiscali**.

Puoi usarli così come sono, oppure **aggiungere** campi tuoi. I campi d'origine e il nome
restano bloccati — sono riallineati a ogni avvio, quindi una modifica si disferebbe da sola —
ma tutto ciò che aggiungi resta.

## Creare un modello tuo

Dal pulsante di **gestione modelli** nella barra sopra l'elenco: da lì si crea un modello nuovo
scegliendo i campi che servono.

L'interfaccia della scheda si adatta da sola al modello scelto.

## Il tipo di un campo

Ogni campo che inventi può avere un tipo, e il tipo cambia il controllo che compare nel modulo:

| Tipo | Nel modulo | Quando usarlo |
| --- | --- | --- |
| Testo | Una riga | Segnature, nomi, luoghi |
| Testo lungo | Un riquadro | Regesti, note, descrizioni |
| Numero | Numerico | Carte, fascicoli, importi |
| Sì / No | Interruttore | Presenza del sigillo, esistenza di una copia |
| Elenco | Tendina | Supporto, stato di conservazione |
| Indirizzo web | Collegamento | Il permalink alla riproduzione digitale |
| Data | Testo con riscontro | Datazioni, vedi [Datazioni storiche](/guida/date-storiche) |
| Elenco dinamico | Più voci ripetibili | Attori, testimoni |

Un campo di tipo **elenco** può attingere a un [vocabolario controllato](/guida/vocabolari)
condiviso da più modelli, invece di avere un elenco tutto suo.

Due opzioni in più su ciascun campo:

- **obbligatorio** — blocca il salvataggio se resta vuoto;
- **unico** — non blocca, ma avvisa quando il valore esiste già in un'altra scheda.

::: tip
Un campo numerico lasciato vuoto vale «non compilato», non zero. Un archivio in cui ogni campo
mai riempito vale zero mente sui totali.
:::

## Come progettare un buon modello

- **Meno campi, meglio riempiti.** Un campo che resta sempre vuoto rallenta la compilazione di
  ogni scheda. Per i casi eccezionali ci sono i [campi propri](/guida/campi-propri).
- **Un campo per un'informazione.** «Luogo e data» insieme non si potrà mai ordinare né filtrare.
- **Pensa alla ricerca.** La sintassi `campo:valore` funziona bene solo se quell'informazione ha
  un campo suo.
- **Dai un tipo ai campi.** Un numero dichiarato tale si ordina come numero; lasciato a testo
  no.

## Cambiare modello a un documento già schedato

Si può fare anche a posteriori, e anche su molte schede insieme con `Ctrl+Maiusc+T` (vedi
[Lavorare su più schede](/guida/selezione-multipla)).

::: warning
Cambiare tipo a una scheda già compilata può lasciare senza casa i valori dei campi che il nuovo
modello non prevede. Prova prima su una scheda sola, o fai un backup — copiare la cartella di
lavoro basta.
:::

## In un archivio condiviso

Concordate i modelli **prima** di cominciare a schedare: cambiarli a metà è possibile, ma chi ha
già lavorato dovrà rivedere le proprie schede.
