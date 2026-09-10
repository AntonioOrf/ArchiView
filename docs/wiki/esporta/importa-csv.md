# Importare da CSV o Excel

Se hai già schedato in un foglio di calcolo — capita quasi sempre — non serve ribattere niente:
il file si importa, colonna per colonna.

Il comando è nel menu «⋯» sopra l'elenco, accanto a «Importa», e nella palette dei comandi
(`Ctrl+K` → «csv» o «excel»).

## Prima di importare

Da Excel o LibreOffice, salva il foglio come **CSV** (qualunque variante: il separatore viene
riconosciuto da solo, e anche i file salvati con le impostazioni italiane funzionano).

Non serve ripulire il foglio: intestazioni fuori posto, colonne senza nome e righe vuote sono
gestite dalla procedura.

## Il primo passo: il modello

Il wizard comincia chiedendo **in quale modello di documento** finiranno le schede, mostrando
sotto ogni scelta i campi che porta con sé.

Non è una formalità: il modello decide quali campi si possono scegliere, come vengono convertiti
i valori e quali sono obbligatori. C'è anche «Crea un modello nuovo», con il nome proposto dal
nome del file.

## Il secondo passo: la mappatura

Qui si dice dove va ogni colonna del file. Tre cose da sapere:

**La riga delle intestazioni è un'ipotesi.** L'app indovina quale riga contiene i nomi delle
colonne — un foglio vero comincia spesso con un titolo in una cella sola — e te la mostra in una
tendina, così puoi correggerla. Se sbagli qui, sbaglia tutto il resto: controllala per prima.

**Ogni colonna ha una destinazione.** Le voci sono raggruppate: dati della scheda, campi dei
modelli, campi da creare. Una colonna che non ti serve si lascia su «non importare».

**Puoi creare campi nuovi durante l'import**, con nome e tipo, direttamente dalla tendina di
destinazione. Il campo non esiste finché non confermi.

## L'anteprima è l'import

Il riepilogo che vedi prima di confermare non è una simulazione: è esattamente il risultato che
verrà inserito. Ti dice quante schede entreranno, quali righe vengono **scartate** e quali
portano un **avviso**.

| Situazione | Esito |
| --- | --- |
| Manca un campo obbligatorio | Riga **scartata**, e ti viene detto quale |
| Numero illeggibile, valore fuori elenco, sì/no non riconoscibile | Riga importata, problema **segnalato**, dato non inventato |
| Segnatura già presente in archivio | Riga importata, doppione **segnalato** |

Niente viene scritto sull'archivio finché non premi «Importa». Se annulli, il modello nuovo e i
campi nuovi che avevi creato nel wizard spariscono con lui.

## Aggiornare schede esistenti

Esiste anche la modalità di aggiornamento, che ritrova le schede già in archivio tramite la
colonna dell'identificativo (quella che ArchiView mette in fondo alle sue esportazioni).

L'aggiornamento è un **completamento**, non una sostituzione: le colonne assenti dal file non
azzerano i campi corrispondenti. Un CSV di tre colonne non può svuotare venti campi.

## Se qualcosa va storto

L'import è **una sola azione annullabile**: `Ctrl+Z` subito dopo toglie tutte le schede
importate in un colpo. Duecento schede da cancellare a mano sarebbero una trappola, non una
funzione.

Per sicurezza, prima di un import grosso: copia della cartella di lavoro (vedi
[Backup](/dati/backup-export)).
