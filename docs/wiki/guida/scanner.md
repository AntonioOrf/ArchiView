# Scansionare col telefono

**ArchiScanner** è l'app Android che accompagna ArchiView. In archivio fotografi le carte col
telefono, scegliendo la scheda a cui appartengono; a casa le pagine entrano da sole in quella
scheda, sul computer, come allegati. Non serve spostare file a mano né rinominarli.

L'app ha anche una sezione **Documenti**, uno scanner per tutto ciò che non va nell'archivio
(ricevute, fotocopie, articoli): quei documenti restano sul telefono e si condividono come PDF.

::: info Cosa serve
- Un telefono **Android**. L'app non c'è per iPhone e non è sul Play Store: si installa dal file
  APK pubblicato fra le [release di ArchiView](https://github.com/AntonioOrf/ArchiView/releases).
  Android chiede di consentire l'installazione da quella sorgente.
- Per il canale principale, lo stesso **account Google** con cui ArchiView sincronizza su Drive.
  Senza account si può usare il [Wi-Fi diretto](#wi-fi-diretto-senza-drive).
- L'interfaccia dell'app è solo in italiano.
:::

## Il percorso di una pagina

Sul telefono si ragiona come sul computer: **archivio**, poi **scheda**, poi **pagine**.

1. Scegli l'archivio e, dentro, la scheda (o creane una nuova).
2. Scansioni le carte, una dopo l'altra, e le numeri.
3. Le pagine partono verso Google Drive appena il telefono è sul Wi-Fi.
4. Quando apri quell'archivio sul computer, ArchiView le scarica, controlla che siano arrivate
   intere e le aggiunge alla scheda.

Le foto viaggiano come JPEG a piena risoluzione, una per pagina. Il riconoscimento del testo
(OCR) non si fa sul telefono per le pagine d'archivio: si lancia dal computer, con le lingue che
hai installato lì (vedi [OCR degli allegati](/guida/ocr)).

## Primo avvio: scegliere l'archivio

Al primo avvio l'app chiede l'archivio. Per vederne l'elenco serve l'accesso a Google
(**Impostazioni → Accedi con Google**).

![La tendina degli archivi: gli archivi che vanno al computer e, sotto, i Documenti che restano sul telefono](/img/telefono-tendina.png){.light-only .telefono}
![La tendina degli archivi: gli archivi che vanno al computer e, sotto, i Documenti che restano sul telefono](/img/telefono-tendina-scuro.png){.dark-only .telefono}

L'elenco viene da due fonti:

- gli archivi che il computer ha **pubblicato**: ArchiView lo fa ogni volta che apri il pannello
  [«Dal telefono»](#dal-telefono) e riceve da Drive;
- gli archivi **sincronizzati con Google Drive**, anche a computer spento.

Gli archivi condivisi tramite Hub, o da un altro account Google, non compaiono.

Con **Nuovo archivio** ne crei uno dal telefono, indicando solo il nome. Il computer lo propone
alla prima ricezione con **Crea archivio…**: scegli dove metterlo sul disco e le pagine entrano.

La scelta resta ricordata. Per cambiarla tocca il nome dell'archivio in alto.

## L'archivio sul telefono

La schermata principale mostra l'albero delle cartelle, come la barra laterale del computer,
cartelle vuote comprese. Ogni scheda ha la segnatura e, sotto, la stessa riga secondaria che
vedi sul computer (il notaio, l'autore, il titolo). Le cartelle che apri restano aperte alla
volta successiva.

![L'archivio sul telefono: il riquadro «Da inviare», la ricerca e l'albero delle cartelle con le schede](/img/telefono-archivio.png){.light-only .telefono}
![L'archivio sul telefono: il riquadro «Da inviare», la ricerca e l'albero delle cartelle con le schede](/img/telefono-archivio-scuro.png){.dark-only .telefono}

La ricerca filtra l'albero per segnatura, titolo o cartella: restano solo le cartelle con un
risultato, già aperte. Il pallino accanto a una scheda dice quante pagine sono ancora sul
telefono in attesa di partire.

## Scansionare

Il **+** in basso offre due strade.

![Il «+» aperto: nuova scheda nella cartella aperta, oppure scansione senza scheda](/img/telefono-piu.png){.light-only .telefono}
![Il «+» aperto: nuova scheda nella cartella aperta, oppure scansione senza scheda](/img/telefono-piu-scuro.png){.dark-only .telefono}

**Nuova scheda** chiede segnatura e nota. La scheda nasce nella cartella aperta nell'albero, e
**Cambia** ne sceglie un'altra; le cartelle nuove si creano solo sul computer. Sul computer la
scheda prende forma al primo invio, con quella segnatura e quella nota, e le scansioni
successive vanno nella stessa scheda.

**Scannerizza senza scheda** apre subito lo scanner. Le pagine arrivano sul computer da
smistare: è la strada per le carte sciolte di cui non sai ancora la collocazione. Titolo e nota
facoltativi aiutano a riconoscerle dopo.

Per aggiungere pagine a una scheda che esiste già, toccala nell'albero e premi il pulsante dello
scanner.

### Lo scanner

Lo scanner è quello di Google (ML Kit): inquadra la pagina, la ritaglia e ne raddrizza la
prospettiva. Si scansiona una pagina dopo l'altra, fino a 100, e si chiude con **Salva**.
Per tenere la foto intera, con i margini e la legatura, nella revisione allarga il ritaglio
fino ai bordi.

### Numerare le carte

![Una scheda con le pagine da inviare, numerate 1r, 1v, 2r](/img/telefono-scheda.png){.light-only .telefono}
![Una scheda con le pagine da inviare, numerate 1r, 1v, 2r](/img/telefono-scheda-scuro.png){.dark-only .telefono}

Con **Numera le carte da** acceso, ogni pagina nuova prende l'etichetta successiva: 1r, 1v, 2r,
2v… a partire da quella che scrivi. Funziona anche con numeri semplici (5, 6, 7) e con un
prefisso («c. 009v» → «c. 010r»). Se il codice salta una carta, correggi l'etichetta dell'ultima
pagina: la successiva riparte da lì. Sul computer l'etichetta diventa il nome dell'allegato.

## Rivedere le pagine prima dell'invio

Tocca una miniatura per aprire la pagina a schermo intero. Si ingrandisce col pizzico o col
doppio tocco, e si passa alle altre strisciando.

![Il visore: la pagina a schermo intero, l'etichetta della carta e i comandi](/img/telefono-visore.png){.light-only .telefono}
![Il visore: la pagina a schermo intero, l'etichetta della carta e i comandi](/img/telefono-visore-scuro.png){.dark-only .telefono}

- **Carta**: l'etichetta della pagina.
- **Ruota** di 90°.
- **Ritaglia** con un riquadro dritto; **Pagina intera** lo riporta ai bordi.
- **Rifai**: riapre lo scanner per quella sola pagina. La foto nuova prende il posto della
  vecchia, con la stessa etichetta.
- **Dividi**: per una pagina doppia (un'apertura del registro). Sposti la linea sulla piega e
  ottieni due pagine, etichettate per esempio 12v e 13r.
- **Elimina**.

Le pagine già partite si aprono in sola lettura.

## L'invio

Il riquadro **Da inviare** in cima all'archivio conta le pagine ancora sul telefono. Toccato,
le mostra raggruppate per scheda.

![Il riquadro «Da inviare» aperto: le pagine in attesa per scheda e quelle senza scheda](/img/telefono-da-inviare.png){.light-only .telefono}
![Il riquadro «Da inviare» aperto: le pagine in attesa per scheda e quelle senza scheda](/img/telefono-da-inviare-scuro.png){.dark-only .telefono}

L'invio automatico parte **solo col Wi-Fi**, perché una giornata in archivio può fare qualche
centinaio di megabyte. Con i dati mobili le pagine aspettano; se ti servono subito usa **Invia
ora**. L'interruttore è in **Impostazioni → Invio**.

L'invio procede solo con l'app aperta. Se Android la chiude a metà, alla riapertura riprende
dalle pagine che non erano ancora arrivate.

![Le impostazioni dell'app: account Google, invio solo col Wi-Fi, cosa fare dopo l'invio, Wi-Fi diretto](/img/telefono-impostazioni.png){.light-only .telefono}
![Le impostazioni dell'app: account Google, invio solo col Wi-Fi, cosa fare dopo l'invio, Wi-Fi diretto](/img/telefono-impostazioni-scuro.png){.dark-only .telefono}

In **Dopo l'invio** decidi cosa resta sul telefono: le pagine si cancellano subito (la scelta
predefinita), restano per un certo numero di giorni o restano sempre. Quelle tenute compaiono
nella scheda come «inviate», in sola lettura, e si possono togliere a mano.

## Sul computer: il pannello «Dal telefono» {#dal-telefono}

### L'avviso all'apertura

Quando apri un archivio e su Drive ci sono pagine scansionate, ArchiView mostra un solo
riepilogo: quante pagine sono per questo archivio, a quali schede vanno, quante sono da
smistare, e cosa c'è per gli altri archivi.

![L'avviso all'apertura: pagine per questo archivio, pagine da smistare e pagine per altri archivi](/img/scanner-avviso.png){.light-only}
![L'avviso all'apertura: pagine per questo archivio, pagine da smistare e pagine per altri archivi](/img/scanner-avviso-scuro.png){.dark-only}

**Importa ora** apre il pannello e scarica. **Più tardi** chiude l'avviso, che torna solo
quando arriva qualcosa di nuovo. Con **Non chiedere** le pagine di quell'archivio si importano
sempre senza domande.

L'avviso compare solo se su quel computer hai già fatto l'accesso a Google per la
sincronizzazione: il controllo non apre mai una finestra di login.

### Il pannello

Il pannello si apre dall'icona del telefono in fondo alla barra laterale, e all'apertura
controlla Drive da solo. Sta di lato: l'elenco delle schede resta utilizzabile mentre è aperto.

![Il pannello «Dal telefono»: le pagine appena importate, un gruppo da smistare e gli archivi nuovi creati sul telefono](/img/dal-telefono.png){.light-only}
![Il pannello «Dal telefono»: le pagine appena importate, un gruppo da smistare e gli archivi nuovi creati sul telefono](/img/dal-telefono-scuro.png){.dark-only}

**Importate ora** elenca le schede che hanno appena ricevuto pagine, con **Apri**. Le pagine
con una scheda scelta sul telefono non chiedono niente: entrano da sole. Nella barra laterale
la scheda mostra **+N** accanto al nome fino alla chiusura dell'app.

**Da smistare** raccoglie le scansioni senza scheda, con titolo, nota e miniature. Per ciascun
gruppo:

- cerca la scheda nel campo e premi **Aggiungi**;
- oppure **Nuova scheda**: segnatura e note vengono dal titolo e dalla nota scritti sul
  telefono, e la scheda si apre da completare;
- oppure **Scarta**, dopo una conferma. Le foto scartate non si recuperano.

**Per altri archivi** mostra le pagine destinate ad archivi diversi da quello aperto. Restano su
Drive finché non apri quell'archivio (**Apri archivio**), oppure, se è nuovo, finché non lo crei
(**Crea archivio…**).

ArchiView toglie le pagine da Drive solo dopo averle scaricate e controllate. Le scansioni
ancora in caricamento dal telefono non si toccano: arrivano alla ricezione successiva.

### Le opzioni

In **Impostazioni → Documenti → Scansioni dal telefono**:

- **Unisci le pagine di ogni scansione in un solo PDF**: invece di un'immagine per pagina, la
  scheda riceve un PDF;
- **All'apertura dell'archivio importa senza chiedere**: la stessa scelta di «Non chiedere».

## Wi-Fi diretto, senza Drive

Se non vuoi usare un account Google, o in archivio non c'è rete, il telefono può mandare le
pagine direttamente al computer, purché siano sulla stessa rete Wi-Fi.

1. Sul computer, nel pannello «Dal telefono», premi **Ricevi via Wi-Fi, senza Drive…**: compare
   un codice QR.
2. Sul telefono, in **Impostazioni → Wi-Fi diretto**, premi **Abbina col computer** e inquadra
   il codice.
3. Premi **Invia via Wi-Fi**: le pagine in attesa passano al computer.

Il computer resta in ascolto solo finché il pannello è aperto. La prima volta Windows chiede il
permesso del firewall, che va concesso. Se sul computer è aperto un archivio diverso da quello
scelto sul telefono, l'app avvisa che quelle pagine verrebbero rifiutate.

## Documenti: lo scanner per tutto il resto

Dalla tendina degli archivi, sotto **Solo su questo telefono**, si apre **Documenti**. Qui non
servono account né archivio, e niente parte verso il computer.

![I Documenti: ricerca, cartelle e documenti fuori dalle cartelle](/img/telefono-documenti.png){.light-only .telefono}
![I Documenti: ricerca, cartelle e documenti fuori dalle cartelle](/img/telefono-documenti-scuro.png){.dark-only .telefono}

Il pulsante dello scanner crea un documento nella cartella aperta, con un nome automatico
(«Documento 9 ott 18:05») che puoi cambiare con la matita. Le cartelle sono di un solo livello.
Dentro un documento lo stesso pulsante aggiunge pagine, e per cambiarne l'ordine tieni premuta
una pagina e trascinala. La ricerca trova i documenti per nome e per il testo riconosciuto.

### Filtri

Nel visore, **Filtri** propone **Originale**, **Migliora**, **Grigi** e **B/N**. **Usa per
tutte** applica la scelta a ogni pagina del documento.

![Il filtro «Migliora» applicato a una pagina, con le altre scelte sotto la foto](/img/telefono-filtri.png){.light-only .telefono}
![Il filtro «Migliora» applicato a una pagina, con le altre scelte sotto la foto](/img/telefono-filtri-scuro.png){.dark-only .telefono}

La foto originale resta sul telefono: **Originale** la rimette in qualunque momento, e Ruota o
Ritaglia partono sempre da lei.

### Testo

**Testo** riconosce le parole della pagina, sul telefono e senza connessione. Il risultato si
corregge nel riquadro (la correzione resta col documento) e si copia con **Copia testo**, o con
**Tutte le pagine** per l'intero documento.

![Il testo riconosciuto di una pagina, correggibile, con «Copia testo» e «Tutte le pagine»](/img/telefono-testo.png){.light-only .telefono}
![Il testo riconosciuto di una pagina, correggibile, con «Copia testo» e «Tutte le pagine»](/img/telefono-testo-scuro.png){.dark-only .telefono}

Il riconoscimento è pensato per la stampa moderna in alfabeto latino. Su un'edizione ottocentesca
come quella della figura legge le parole ma ne storpia parecchie («Gallorun», «Frnncorum»): va
riletto prima di copiarlo. Su una scrittura a mano serve a poco.

### Condividere o salvare

**Condividi o salva** prepara il documento come **PDF** (un file con tutte le pagine) o come
**immagini JPEG**.

![Il foglio «Condividi o salva»: PDF o JPEG, testo cercabile nel PDF, Condividi e Salva in Download](/img/telefono-condividi.png){.light-only .telefono}
![Il foglio «Condividi o salva»: PDF o JPEG, testo cercabile nel PDF, Condividi e Salva in Download](/img/telefono-condividi-scuro.png){.dark-only .telefono}

- Con **Testo cercabile nel PDF** acceso, il PDF contiene il testo riconosciuto sotto le
  immagini, e si cerca e si copia in qualunque lettore. Le pagine non ancora riconosciute
  vengono lette prima di creare il file.
- **Condividi…** apre il menu di condivisione di Android (Gmail, Drive…).
- **Salva in Download** scrive il file in una cartella del telefono. La prima volta Android
  chiede quale: dentro «Download» creane una (per esempio «Scansioni») e scegli quella, perché
  Android non permette di usare «Download» direttamente. Da lì in poi l'app la ricorda.

::: warning Limiti del PDF cercabile
Il testo nascosto nel PDF è quello letto dal riconoscimento, non quello che hai corretto a mano.
Le lettere fuori dall'alfabeto dell'Europa occidentale (polacco, greco, cirillico…) vi diventano
«?».
:::

## Se qualcosa non torna

**L'archivio non compare sul telefono.** Apri sul computer il pannello «Dal telefono»: la
ricezione pubblica anche l'elenco degli archivi e delle schede. Gli archivi condivisi via Hub
non compaiono comunque.

**Una scheda creata sul computer non si vede sul telefono.** L'elenco del telefono si aggiorna
quando il computer riceve da Drive. Apri il pannello, poi sul telefono riapri l'archivio.

**Le pagine non partono.** Controlla di aver fatto l'accesso a Google. Con i dati mobili e
l'invio solo col Wi-Fi le pagine aspettano: usa **Invia ora**.

**Il computer non trova le pagine.** Devi aprire sul computer l'archivio scelto sul telefono:
le pagine per gli altri archivi restano su Drive e compaiono in «Per altri archivi».
