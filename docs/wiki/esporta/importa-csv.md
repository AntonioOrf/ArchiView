# Importare da CSV o Excel

Se hai già schedato in un foglio di calcolo, che è il caso più frequente, non serve ridigitare
nulla: il file si importa, colonna per colonna.

Il comando è nel menu «⋯» sopra l'elenco, accanto a «Importa», e nella palette dei comandi
(`Ctrl+K` → «csv» o «excel»).

## Prima di importare

Da Excel o LibreOffice, salva il foglio come **CSV** (qualunque variante: il separatore viene
riconosciuto da solo, e anche i file salvati con le impostazioni italiane funzionano).

Non serve ripulire il foglio: intestazioni fuori posto, colonne senza nome e righe vuote sono
gestite dalla procedura.

## Un file per fondo, non un file per tutto

Tutte le righe di un CSV finiscono **nella stessa cartella di destinazione**: la procedura non
smista le schede in cartelle diverse a seconda del contenuto.

Se il tuo foglio di calcolo raccoglie la schedatura di più fondi, di più serie o di più archivi
di conservazione, dividilo prima in un file per ciascuno e importali uno alla volta, scegliendo
ogni volta la cartella giusta. In caso contrario ti ritroverai centinaia di schede di provenienza
diversa mescolate in un'unica cartella, da separare poi a mano.

Per lo stesso motivo conviene che le **segnature** di un singolo file appartengano a un solo
fondo: sono ciò che distingue le schede una volta importate, e segnature di fondi diversi
mescolate nella stessa cartella rendono impossibile capire a colpo d'occhio da dove venga
ciascun documento.

Se le schede sono già tutte in un unico foglio, la via più rapida è ordinarlo per fondo e
salvarne una copia per ciascun gruppo di righe.

## Il primo passo: il modello

Il wizard comincia chiedendo **in quale modello di documento** finiranno le schede, mostrando
sotto ogni scelta i campi che porta con sé.

![Il primo passo dell'importazione: la scelta del modello di documento](/img/import-csv.png){.light-only}
![Il primo passo dell'importazione: la scelta del modello di documento](/img/import-csv-scuro.png){.dark-only}

Non è una formalità: il modello decide quali campi si possono scegliere, come vengono convertiti
i valori e quali sono obbligatori. C'è anche «Crea un modello nuovo», con il nome proposto dal
nome del file.

## Il secondo passo: la mappatura

Qui si dice dove va ogni colonna del file. Tre cose da sapere:

**La riga delle intestazioni è un'ipotesi.** L'app indovina quale riga contiene i nomi delle
colonne, dato che un foglio reale comincia spesso con un titolo in una cella sola, e te la mostra
in una tendina, così puoi correggerla. Un errore su questa riga si propaga a tutto il resto:
controllala per prima.

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

## Se l'importazione non è andata come previsto

L'import è **una sola azione annullabile**: `Ctrl+Z` subito dopo toglie tutte le schede
importate in una sola operazione. Duecento schede da cancellare a mano sarebbero un ostacolo,
non una funzione.

Prima di un'importazione estesa conviene comunque copiare la cartella di lavoro (vedi
[Backup](/dati/backup-export)).
