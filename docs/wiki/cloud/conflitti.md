# Quando due modifiche si scontrano

Succede in ogni archivio condiviso: tu e un collega toccate la stessa scheda prima di
sincronizzare. ArchiView non sceglie al posto tuo e non sovrascrive in silenzio.

## Prima cosa: la maggior parte dei casi non è un conflitto

Se avete modificato **campi diversi** della stessa scheda, le due modifiche si sommano da sole,
campo per campo. Nessuna finestra, nessuna decisione da prendere: è il caso più frequente e viene
gestito senza disturbarti.

Un conflitto vero c'è solo quando due persone hanno cambiato **lo stesso campo** in modo diverso.

## La finestra di risoluzione

Mostra il campo conteso con le due versioni affiancate, la tua e quella del collega, e ti fa
scegliere quale tenere, **una decisione per campo**.

Il punto di partenza è già la scheda **fusa**, cioè con tutte le modifiche non in conflitto già
incorporate: scegliendo per un campo non perdi il lavoro fatto dall'altro sui campi restanti.

Per scegliere basta un clic in qualunque punto della versione che vuoi tenere, **Tua modifica
(Locale)** o **Modifica Cloud (Server)**. Da tastiera: `Tab` per spostarsi fra le due, `Invio` o `Spazio` per scegliere.

### Quando l'app non sa che cosa è cambiato

Per capire chi ha modificato che cosa, l'app confronta le due versioni con l'ultima scaricata dal
server. Se quel punto di riferimento manca (il primo collegamento di un computer, un archivio
molto vecchio), ogni differenza fra la tua scheda e quella del server apre la finestra dei
conflitti: l'app preferisce chiederti una decisione in più che prenderne una sbagliata.

Se l'invio delle tue modifiche non va a buon fine (niente rete, errore del server), il lavoro
locale resta com'è e parte alla sincronizzazione successiva.

## Le cancellazioni

Se qualcuno ha eliminato dal server una scheda che hai ancora nel tuo archivio, l'app te lo dice
invece di far sparire il tuo lavoro senza avviso. Nella finestra «File eliminati sul server»
scegli per ciascuna scheda **Mantieni** (conservi la tua copia locale) oppure **Elimina** (la
togli anche dal tuo archivio), poi **Conferma scelte**. **Annulla ricezione** rimanda la decisione.

## Come ridurne il numero

1. **Scarica prima di iniziare.** Un conflitto nasce quasi sempre da una copia locale ferma a
   ieri.
2. **Carica spesso.** Le modifiche accumulate per settimane sono conflitti in attesa.
3. **Dividetevi il lavoro** per fondo o per serie, non per campo.
4. Se sapete di dover lavorare in due sullo stesso documento, concordatelo in anticipo: è più
   rapido che risolvere il conflitto a posteriori.

## Se hai scelto la versione sbagliata

`Ctrl+Z` subito dopo. Se te ne accorgi più tardi, la scheda ha una
[cronologia](/dati/cestino-snapshot#_4-cronologia-di-una-scheda) da cui recuperare la versione
precedente, e l'archivio ha gli [snapshot locali](/dati/cestino-snapshot).
