# Sincronizzazione: come funziona

ArchiView funziona benissimo **senza** alcun collegamento a internet, e questa è la modalità
predefinita. La sincronizzazione serve se vuoi:

- lavorare sullo stesso archivio da più computer;
- collaborare con altre persone;
- avere una copia di sicurezza fuori dal tuo disco.

## Le tre modalità di un archivio

| Modalità | Che cos'è | Per chi |
| --- | --- | --- |
| **Locale** | Tutto sul tuo disco, nessun collegamento | Predefinita. Va benissimo per un lavoro individuale |
| **Personale** | Collegato al tuo spazio cloud, per il solo backup | Chi lavora da solo su due computer, o vuole una copia remota |
| **Condiviso** | Su un server comune, con più persone | Un gruppo di ricerca, un progetto a più mani |

Un archivio locale resta locale finché non sei tu a convertirlo. La conversione si fa dal
pulsante di condivisione in basso a sinistra.

## L'archivio condiviso

La collaborazione passa da un **server comune** (l'Hub): ogni partecipante tiene la sua copia
completa sul proprio computer e continua a lavorare anche offline; quando c'è rete, le modifiche
vengono scambiate.

Chi crea l'archivio ne è il **titolare**: genera gli inviti e può revocare l'accesso a chiunque.
Gli altri sono **membri**: ricevono, inviano e possono uscire. Vedi
[Condividere con altri](/cloud/condivisione).

Gli allegati vengono sincronizzati **cifrati**: chi ospita i file non è in grado di leggerli.

## Lo stato, in alto a destra

Una riga riassume sempre la situazione:

- **sincronizzato** — locale e remoto coincidono;
- **aggiornamenti in entrata** — qualcuno ha caricato modifiche che tu non hai ancora;
- **modifiche locali da inviare** — hai lavorato e non hai ancora caricato.

Cliccandoci si aprono i comandi: **controlla** (chiede se c'è qualcosa di nuovo, senza scaricare
né inviare), **scarica**, **carica**, e il collegamento al Controllo modifiche.

## Le abitudini che evitano i problemi

1. **Scarica prima di iniziare** a lavorare.
2. **Carica quando hai finito** una sessione, non una volta al mese: più a lungo si accumulano
   modifiche parallele, più conflitti ci saranno da risolvere.
3. In gruppo, mettetevi d'accordo su chi lavora su quale fondo. I conflitti si evitano meglio di
   quanto si risolvano.

Se due persone modificano la stessa scheda, l'app non sovrascrive nulla in silenzio: vedi
[Quando due modifiche si scontrano](/cloud/conflitti).

## Google Drive e OneDrive

Le versioni precedenti usavano Google Drive per gli archivi condivisi. Quel percorso resta
funzionante per il **backup personale** e per gli archivi condivisi già esistenti, che si possono
migrare all'Hub con un comando dedicato (Opzioni avanzate della finestra cloud).

I nuovi archivi condivisi si creano solo sull'Hub: è più veloce, non richiede a ciascun
collaboratore un account Google e permette di revocare l'accesso davvero.

::: tip Privacy
In modalità locale nessun dato lascia il computer. Il dettaglio di che cosa viene trattato quando
attivi la sincronizzazione è nella
[Privacy Policy](https://archiview.web.app/privacy.html).
:::
