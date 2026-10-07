## ArchiView 3.3.0 — Ricerca tra archivi e avvio più rapido

Si può cercare una persona, un luogo o una segnatura in tutti gli archivi aperti su questo computer, senza cambiare archivio, e copiare una scheda da uno all'altro. L'app si apre in un terzo del tempo e la sicurezza è stata rivista da cima a fondo.

### Novità

- **Cerca anche negli altri archivi**: con la casella sotto la ricerca, i risultati degli altri archivi compaiono in una sezione sotto l'elenco. Ogni scheda si apre in anteprima, in sola lettura; gli altri archivi vengono soltanto letti, mai modificati.
- **Copia in questo archivio**: dall'anteprima una scheda si copia per intero o in parte, anche con gli allegati. Prima di confermare si vede cosa succederà (tipo di documento, cartella, persone e luoghi già presenti o nuovi, campi che diventano propri della scheda). La copia ricorda da dove viene e non cambia se l'originale viene modificato.
- **Rimandi ad altri archivi**: nella scheda, la sezione "Rimandi ad altri archivi" collega una scheda a quella di un altro archivio, che si apre in anteprima con un clic.
- **Lo stesso nome in altri archivi**: scrivendo una persona in un campo, ArchiView avvisa se lo stesso nome compare in altri archivi. Si disattiva in Impostazioni → Archivio Dati, dove si scelgono anche gli archivi in cui cercare.

### Miglioramenti

- **Avvio molto più rapido**: su un archivio di 5.000 schede la finestra è pronta in circa un terzo del tempo, e riaprire o ridisegnare l'elenco costa molto meno.
- **Salvataggio più robusto**: il database si scrive sempre in modo completo anche quando più salvataggi arrivano insieme, e una modifica fatta da fuori (un altro computer tramite il client Drive) subito dopo un salvataggio viene riconosciuta.
- **Allegati degli archivi condivisi**: si scaricano più in fretta, più file insieme, e un download interrotto non lascia un file a metà.
- **Sicurezza**: protezioni aggiuntive sui contenuti che arrivano da archivi condivisi, inviti e file importati. L'aggiornamento è consigliato a tutti.

### Correzioni

- **Finestra stretta**: sotto i 768 pixel l'elenco delle schede restava alto pochi pixel; ora la vista resta usabile anche a metà schermo.
- **Conflitti di sincronizzazione**: la versione scelta nel confronto fra Locale e Cloud ora si vede ed è annunciata dai lettori di schermo.
- **Impostazioni**: "Ripristina cartella allegati predefinita" non aveva effetto, e svuotando i campi di copie di sicurezza e cestino (quante copie, quanti giorni) al riavvio tornava il valore precedente invece di quello predefinito.
- **Traduzioni**: lo stato del cloud, il suggerimento del grafo e i nomi delle lingue OCR seguono la lingua scelta.

### Da sapere

- Al primo avvio dopo l'aggiornamento alcune preferenze di comodità ripartono dal valore iniziale: le lingue e l'opzione "raddrizza" del riconoscimento del testo, l'ultimo modello usato in ogni archivio e la casella "Cerca anche negli altri archivi". Basta reimpostarle una volta.

---

## ArchiView 3.2.2 — Trascinamento delle pagine e aggiornamenti più affidabili

### Correzioni

- **Pagine e carte si trascinano col mouse**: nel visualizzatore della trascrizione una pagina PDF o un'immagine si sposta col tasto sinistro a qualunque ingrandimento, anche senza zoom. Prima, con uno o due scatti di zoom, si muoveva solo di pochi pixel e il trascinamento sembrava non funzionare. Un quarto della pagina resta sempre in vista, così non la si perde fuori dal riquadro.
- **Aggiornamenti**: mentre una nuova versione è in pubblicazione, l'app non mostra più "Nessuna versione pubblicata" ma invita a riprovare fra qualche minuto. Un controllo automatico non riuscito per cause passeggere (niente rete, versione in pubblicazione) non mostra più il banner rosso, e quando il controllo fallisce il pulsante è "Riprova" invece di "Scarica".

---

## ArchiView 3.2.1 — PDF ricercabili e pagine raddrizzate

Il testo riconosciuto dall'OCR si può ora portare fuori dall'archivio: una copia dell'allegato in PDF, con il testo cercabile e selezionabile sopra la scansione. Le pagine scansionate di traverso vengono raddrizzate da sole.

### Novità

- **PDF ricercabile**: nel riconoscimento del testo c'è l'opzione "Salva una copia come PDF ricercabile". Il file conserva le pagine originali dell'allegato, senza perdita di qualità, e vi aggiunge il testo riconosciuto, invisibile ma cercabile e copiabile in qualunque lettore PDF. Con "Tutti gli allegati della scheda" si ottiene un unico PDF.
- **Pagine raddrizzate in automatico**: con "Rilevamento orientamento" installato (da Gestisci lingue), le pagine girate di 90° o capovolte si ruotano prima del riconoscimento e nel PDF ricercabile appaiono dritte. Quando l'orientamento è incerto il testo si legge nei due versi e si tiene la lettura migliore; il risultato dice quante pagine sono state raddrizzate.

### Correzioni

- **Allegati e cartelle interne dell'app**: i file interni di ArchiView non si possono allegare nemmeno quando la loro cartella è raggiunta tramite un collegamento o un nome abbreviato di Windows.

---

## ArchiView 3.2.0 — PDF pagina per pagina e archivi condivisi più sicuri

I PDF si leggono e si trascrivono una pagina alla volta, con gli stessi strumenti delle carte fotografate. La condivisione degli archivi è stata rivista da cima a fondo: il server non legge più le schede e le trascrizioni, e le notifiche arrivano solo ai membri.

### Importante per gli archivi condivisi

- **Tutti i membri devono aggiornare prima di inviare modifiche.** Da questa versione il database di un archivio condiviso viene cifrato prima di arrivare al server. Le versioni precedenti di ArchiView non sanno leggerlo: vedrebbero l'archivio vuoto e proporrebbero di eliminare le schede. Chi non ha ancora aggiornato non deve confermare quella richiesta.

### Novità

- **PDF pagina per pagina**: il PDF si apre nel visualizzatore della trascrizione con zoom, rotazione e filtri paleografici, come le immagini. Si passa da una pagina all'altra e si cerca nel testo del PDF o nella trascrizione. Anche un facsimile molto grande si apre senza essere caricato per intero.
- **Trascrizione per pagina**: ogni pagina di un PDF ha la sua trascrizione. L'OCR di un PDF scrive ciascuna pagina al suo posto.
- **Notifiche immediate tra i membri di un archivio condiviso**: quando un collega invia modifiche, gli altri ne sono avvisati subito, anche su computer diversi.
- **Schede di merge interattive**: l'intera superficie della scheda di confronto (Locale e Cloud) è ora cliccabile con feedback visivo immediato e supporto completo alla navigazione da tastiera (Enter e Spazio).
- **Risoluzione cancellazioni reattiva**: ripristinata la piena funzionalità dei pulsanti "Mantieni" ed "Elimina" nel modale dei file rimossi dal server.
- **Nessuna modifica locale persa se il caricamento fallisce**: la base del merge a tre vie resta la versione scaricata dal server, così una sincronizzazione il cui caricamento non va a buon fine (offline, errore di rete) non fa scartare le modifiche locali alla sincronizzazione successiva.
- **Conflitti sempre mostrati senza una base**: la base non viene più creata dai dati locali. Quando manca (primo avvio, archivio precedente alla migrazione), ogni differenza tra la scheda locale e quella del server apre il modale dei conflitti invece di essere decisa in automatico.

### Sicurezza

- **Il server dell'archivio condiviso non legge i contenuti**: schede, trascrizioni e nome dell'archivio viaggiano e restano cifrati; il server non può nemmeno spacciare una versione vecchia per quella attuale.
- **Le chiavi dell'archivio non lasciano il processo principale** dell'app e l'interfaccia non le vede mai.
- **Accesso a Google più protetto**: la pagina di accesso accetta risposte solo dal proprio computer e solo per il login avviato dall'app.
- **Contenuti condivisi innocui**: un allegato o un testo ricevuto da un collaboratore non può più scrivere file fuori dalla cartella dell'archivio né avviare comandi dell'app.

### Rimosso

- **OneDrive**: il collegamento a OneDrive non era più selezionabile. Un archivio ancora collegato torna locale e i dati restano sul disco; gli accessi Microsoft salvati vengono cancellati.
- Gli archivi su Google Drive ricevono gli aggiornamenti con il controllo periodico (ogni 5 minuti) invece che con le notifiche immediate, che tra computer diversi non funzionavano.

---

## ArchiView 3.1.2 — Import IIIF

Praticamente tutte le biblioteche che digitalizzano codici medievali — BnF/Gallica,
e-codices, Vaticana, British Library, Bodleian — pubblicano un **manifest IIIF**: un JSON
con la sequenza ordinata delle carte e un server che le serve a qualsiasi risoluzione.
Da questa versione basta incollare quell'indirizzo in **Importa → Manifest IIIF** per
ottenere una scheda con tutte le carte già in sequenza, già etichettate, e visibili nel
visualizzatore senza scaricare nulla.

### Novità

- **Modello ibrido**: le carte restano sul server della biblioteca e non occupano spazio
  nell'archivio né nella sincronizzazione. Si scaricano una per una, o tutte insieme,
  quando servono per l'OCR, la stampa o l'uso offline.
- **IIIF v2 e v3**: il normalizzatore gestisce entrambe le versioni della specifica
  Presentation, la Image API 2 e 3, le etichette multilingua, le `Choice` (carte a luce
  visibile e ultravioletto) e i manifest senza servizio (immagini statiche).
- **Cache offline**: le carte già visualizzate restano disponibili senza rete, in una
  cache fuori dal workspace (non si sincronizza), con sfoltimento LRU e tetto di 2 GB.
- **Protocollo `iiif-img:`**: le immagini remote passano da uno schema custom come
  `local-asset:`, senza allargare la CSP a `https:`.
- **Attribuzione e licenza**: vengono conservate e mostrate, come richiesto dalla licenza
  IIIF.
- **Esportazione e stampa complete**: l'esportazione Markdown include ora tutti i metadati
  della scheda, i campi personalizzati e l'elenco degli allegati. La stampa include le
  trascrizioni per-carta degli allegati e supporta le miniature delle carte remote IIIF.

---

## ArchiView 3.1.1 — Menu più corti

Il menu del tasto destro su una scheda era arrivato a ventidue voci: su una finestra bassa
diventava scorrevole, e per accorciare le etichette si era finito a scriverle in una o due
parole. Da questa versione le voci che rispondono alla stessa domanda stanno in un
sottomenu, e nessun menu supera le undici righe.

- **Scheda**: le tre viste secondarie stanno in **Vedi** (Collegate, Grafo, Cronologia); i
  quattro modi di portare fuori il lavoro in **Esporta** (ZIP, CSV, testo, Stampa); le
  azioni in massa in **Su N schede**, che nell'etichetta dice quante schede si stanno per
  cambiare. Modifica, Trascrivi, Copia, Taglia ed Elimina restano dove erano.
- **Barra "⋯"**: i due import in **Importa**, i cinque export in **Esporta**, e
  "Colonne visibili" è finalmente un sottomenu invece di un secondo menu che si riapriva
  da solo.
- **Cartella**: ZIP, CSV, testo e stampa in **Esporta**.
- I sottomenu si aprono col mouse o con la freccia destra, si chiudono con la sinistra o
  con Esc, un livello per volta. Le scorciatoie da tastiera restano scritte accanto al
  comando, dentro il sottomenu.

Nessuna funzione è stata rimossa: tutti i comandi di prima sono ancora tutti raggiungibili.

---

## ArchiView 3.1.0 — L'albero dice chi, non solo dove

Nell'albero a sinistra una scheda si riconosceva solo dalla segnatura: "165, 579" dice dov'è
il documento, non di chi parla. Da questa versione ogni scheda può portare sotto la segnatura
il valore di un campo a scelta — il dichiarante, il notaio, l'autore — così si trova la carta
giusta guardando l'albero, senza aprirla.

### Nell'albero

- **Etichetta secondaria sotto la segnatura.** Nel pannello Struttura, il pulsante in alto a
  destra apre l'elenco dei campi dell'archivio: scelto il campo, ogni scheda mostra il suo
  valore su una seconda riga.
- **Automatica**, se non si vuole scegliere: l'applicazione usa il primo nome disponibile fra
  dichiarante, notaio, autore e persone coinvolte, quindi funziona anche con modelli diversi
  mescolati nello stesso archivio.
- **Ordinamento per etichetta.** Le schede dell'albero si possono ordinare per il campo
  mostrato invece che per segnatura: tutte quelle dello stesso dichiarante finiscono vicine.
- La scelta si ricorda per ogni archivio e resta locale a questo computer: non viene
  sincronizzata e non cambia nulla ai collaboratori.
- Raggiungibile anche da `Ctrl+K` → "etichetta".

---

## ArchiView 3.0.0 — L'archivio ha una forma, e il lavoro non si perde

È il rilascio più grande dalla nascita dell'applicazione, e cambia il modo in cui ArchiView
tratta i dati. Fino alla 2.4 la scheda era un foglio di testo: ogni campo una stringa, nessun
controllo, nessuna storia, e l'unico modo di portare fuori il lavoro era l'archivio compresso
dell'applicazione stessa. Da qui in avanti il dato ha un tipo, una versione e una rete di
sicurezza, e può uscire in CSV, in PDF, in Word e come citazione bibliografica.

### ⚠️ Prima di aggiornare, se lavori in archivio condiviso

Questa versione cambia il formato dell'archivio, che viene aggiornato automaticamente e senza
perdita di dati alla prima apertura. **Le versioni 2.4.x non sanno leggere il formato nuovo**:
se condividi un archivio con altri, aggiornate tutti prima di riprendere a lavorarci insieme.
È la ragione per cui questa è una 3.0 e non una 2.5.
Un archivio locale non richiede nessuna attenzione: si apre, si aggiorna, si continua.

### Il dato ha un tipo

- **I campi non sono più tutti testo.** Un modello può dichiarare numeri, sì/no, date, elenchi a
  scelta, collegamenti e liste: il modulo si adatta, e chi scheda non può più scrivere una parola
  dove serve un anno.
- **Date storiche come si scrivono davvero.** "1340 ca.", "sec. XIV", "ante 1350", "1340-1345":
  l'applicazione le capisce, le ordina e le usa nei filtri, senza costringere a inventare una
  data precisa che il documento non dà.
- **Tag, vocabolari e anagrafica sono entità d'archivio**, non più parole sparse: si rinominano
  una volta sola e la modifica arriva su tutte le schede che li usano. Persone e luoghi hanno
  una loro scheda d'autorità.
- **Le schede si collegano fra loro.** Un atto può rimandare al suo originale, a una copia, a un
  documento citato; la vista a grafo mostra la rete che ne esce.
- **Campi propri della singola scheda.** Il modello è una base, non una gabbia: se una carta ha
  qualcosa che le altre non hanno, il campo si aggiunge solo lì. E l'ordine dei campi si cambia
  scheda per scheda.

### Niente si perde

- **Cestino.** Le schede eliminate non spariscono: restano recuperabili.
- **Copie di sicurezza automatiche.** L'applicazione conserva istantanee a rotazione
  dell'archivio, da cui tornare indietro se qualcosa va storto.
- **Cronologia della singola scheda.** Si vede che cosa è cambiato, quando e per mano di chi.
- **Annulla e ripristina** ora coprono anche modifiche e rinomine, non più solo le eliminazioni.
- **Conflitti risolti campo per campo.** Se due persone toccano la stessa scheda ma campi
  diversi, non c'è più nulla da scegliere: si fondono. Il conflitto vero resta, ma è sul singolo
  campo, e nessuno perde ciò che ha scritto.

### Il lavoro esce dall'applicazione

- **Esportazione CSV** dell'archivio o della selezione, apribile in Excel e in LibreOffice.
- **Importazione CSV** con mappatura delle colonne e prova a vuoto: si vede che cosa entrerà
  prima che entri.
- **Stampa e PDF** in tre formati: scheda per pagina, regesto d'inventario, elenco.
- **Esportazione della trascrizione** in HTML, Markdown e RTF — quest'ultimo si apre in Word.
- **Citazioni bibliografiche** pronte da incollare in un articolo.

### Il testo delle carte

- **Riconoscimento del testo (OCR)** su immagini e PDF, con le lingue scaricabili su richiesta.
  Il testo riconosciuto diventa cercabile e produce una bozza di trascrizione in cui i tratti
  incerti sono segnalati — e resta chiaro che è una bozza, non una lettura.
- **Una trascrizione per ogni carta.** L'editor segue la carta mostrata a destra: prima la
  scheda aveva un testo solo, e cambiando allegato il pannello restava indietro.

### Lavorare più in fretta

- **Visualizzatore delle immagini** con zoom, spostamento, rotazione e regolazione di luminosità
  e contrasto: una carta scura si legge senza uscire dall'applicazione.
- **Barra dei comandi** (`Ctrl+K`): si raggiunge qualunque azione scrivendone il nome.
- **Filtri avanzati e ricerche salvate**: la ricerca costruita una volta si richiama.
- **Azioni in massa** sulla selezione, con scorciatoie da tastiera.
- **Tour guidato** rivisto per le funzioni nuove.

---

## ArchiView 2.4.6 — Ordina, cerca e vedi l'archivio come vuoi

Aggiornamento dedicato al lavoro quotidiano su archivi grandi: la lista ora si ordina, si può
vedere come tabella, e la ricerca trova quello che prima si perdeva.

### Novità

- **La lista si ordina.** Fino a ieri le schede comparivano nell'ordine in cui erano state inserite, e basta. Ora si ordinano per segnatura, per data di modifica, per numero di allegati o per qualunque campo del modello in uso. L'ordinamento per segnatura è "naturale": `MS 2` viene prima di `MS 10`, non dopo come farebbe un ordine alfabetico. Le schede a cui manca il valore restano in fondo, anche invertendo l'ordine. La scelta viene ricordata alla riapertura.
- **Nuova vista a tabella.** Accanto alla vista a schede c'è una vista a righe e colonne, con le colonne prese dai campi del modello: si clicca l'intestazione per ordinare, si ri-clicca per invertire. Dal menù "⋯" si sceglie quali colonne mostrare, e la scelta è ricordata per ciascun modello. Selezione multipla, trascinamento e tasto destro funzionano esattamente come sulle schede.
- **Il menù di ordinamento propone solo i campi che le schede hanno davvero.** Fra i documenti fiscali non compare "Autore", che quel modello non prevede.
- **Nuova scheda del tipo che vuoi, subito.** La freccia accanto a "Nuova scheda" apre il modulo già impostato sul modello scelto, senza doverlo cambiare dopo averlo aperto.
- **Barra dei comandi riordinata.** In evidenza restano le azioni di ogni giorno; nuovo archivio, importazione, esportazione e scelta delle colonne sono raccolte nel menù "⋯". Sotto i 768 pixel di larghezza nulla sparisce più.

### Ricerca

- **Gli accenti non nascondono più le schede.** Cercando *Perugia* si trovano anche le schede che scrivono *Perùgia*, e viceversa: su testo medievale e latino la stessa parola ricorre in entrambe le forme. Vale anche per gli apostrofi curvi incollati da Word.
- **Ricerca a più parole.** Scrivendo `notaio 1340` si ottengono le schede che contengono entrambi i termini, anche se stanno in campi diversi.
- **Si cerca anche nei campi che hai creato tu** e negli elenchi di persone, beni, debiti, crediti e familiari: i nomi di persona, cioè ciò che si cerca più spesso, prima non venivano trovati.
- **Ricerca e tag attivi vengono ricordati:** riaprendo l'applicazione si ritrova il contesto di lavoro, non l'archivio intero.
- **Il pannello dei tag mostra quante schede usano ciascun tag.**

### Correzioni

- **Errore sugli allegati degli archivi condivisi.** Durante la sincronizzazione poteva comparire un errore `ENOENT` su file temporanei e alcuni allegati non venivano caricati: due sincronizzazioni sovrapposte si cancellavano a vicenda i file di lavoro. Ora vengono eseguite una alla volta.
- **Il pannello "Novità" mostrava una versione vecchia.** L'elenco delle novità era scritto a mano e non veniva aggiornato: la 2.4.5 mostrava ancora quelle della 2.4.3. Ora è generato dalle note di rilascio, e non può più restare indietro.

### Modifiche all'interfaccia

- **La barra delle azioni sulla selezione è stata rimossa.** Compariva sopra l'elenco a ogni selezione, spingendo in basso le schede. Le stesse azioni — copia, taglia, esporta, elimina, deseleziona — sono nel menù del tasto destro, che le applica a tutte le schede selezionate. Quante ne hai selezionate è scritto accanto al conteggio dei risultati.

---

## ArchiView 2.4.5 — Il modello resta quello che hai scelto

Aggiornamento dedicato a chi scheda molti documenti dello stesso tipo di seguito.

### Novità

- **L'applicazione ricorda l'ultimo modello usato.** Aprendo una nuova scheda, il campo "Tipo Documento" si presenta già impostato sul modello con cui stavi lavorando, invece di tornare ogni volta a "Imbreviature Notarili". La scelta viene memorizzata sia quando salvi una scheda sia appena cambi modello dal menù, ed è ricordata separatamente per ogni archivio. Resta su questo computer: non viene sincronizzata né condivisa con gli altri collaboratori. Se il modello ricordato viene nel frattempo eliminato, si riparte dal primo della lista.

---

## ArchiView 2.4.4 — Ripristino archivio da Google Drive

Aggiornamento correttivo per chi recupera un archivio dal cloud su un nuovo computer.

### Correzioni

- **Il ripristino di un archivio da Google Drive non funzionava.** Al momento dello scaricamento compariva l'errore `Cannot read properties of undefined (reading 'some')` e la procedura si interrompeva prima ancora di chiedere dove salvare l'archivio sul PC. Ora il download prosegue normalmente; se nella cartella selezionata non c'è alcun database, viene mostrato il consueto avviso invece di un errore tecnico.

---

## ArchiView 2.4.3 — Google Drive: disconnessione, accesso e sincronizzazione

Aggiornamento correttivo dedicato al collegamento con Google Drive. **Consigliato a chi usa Drive come backup o come archivio condiviso**, in particolare a chi lavora sullo stesso archivio da più computer.

### Correzioni

- **La disconnessione ora disconnette davvero.** Il comando confermava "Disconnessione avvenuta" ma l'account restava collegato: l'email continuava a comparire e la sessione era ancora attiva. Ora vengono rimosse tutte le credenziali dal computer e l'autorizzazione viene revocata anche sul tuo account Google.
- **"Accedi" torna ad aprire il browser.** Dopo una disconnessione il pulsante non apriva più nulla, perché l'applicazione si riteneva ancora autenticata. Ora l'accesso riporta sempre alla schermata di scelta dell'account Google.
- **"Connetti" dalla barra di sincronizzazione** portava a una finestra priva di qualsiasi comando di accesso, senza vie d'uscita. Ora avvia direttamente il login nel browser.
- **Sincronizzazioni che non scaricavano nulla ma dichiaravano successo.** Se il computer puntava a una cartella di Drive diversa da quella degli altri, il download veniva saltato in silenzio e compariva comunque "Sincronizzazione completata". Ora l'applicazione avvisa e indica che cosa controllare.
- **Cartelle duplicate su Drive.** Un secondo computer poteva creare una nuova cartella omonima invece di riusare quella esistente: da quel momento i due computer lavoravano su archivi separati pur usando lo stesso account Google. Ora la cartella già presente viene riutilizzata.

### Novità

- **Collega a un archivio esistente su Drive.** Nelle opzioni avanzate del pannello Google Drive: elenca gli archivi presenti sul tuo Drive e collega questo computer a quello giusto. È la riparazione per due PC finiti su cartelle diverse.
- **Pannello Google Drive rinnovato.** Mostra in evidenza l'account collegato — utile per verificare a colpo d'occhio di essere sullo stesso account su tutti i computer — e, quando la sessione non è valida, offre subito il pulsante di accesso.
- Aprendo **Condivisione** su un archivio Google Drive non compare più la schermata che invitava a passare all'archivio condiviso: si va direttamente alla gestione del backup. La conversione resta disponibile fra le opzioni avanzate.

### Aggiornamenti tecnici

- **Electron 44.2.0** (da 39.8.10): il motore su cui gira l'applicazione fa un salto importante e porta con sé le correzioni di sicurezza di Chromium accumulate in cinque versioni principali. Nessun cambiamento visibile nell'uso quotidiano.
- Risolte tutte le vulnerabilità note nelle dipendenze di sviluppo (`npm audit`: 0 su 568 pacchetti).
- Altre dipendenze aggiornate: fast-uri 3.1.7, qs 6.16.0, @xmldom/xmldom 0.8.15, browserslist 4.28.9.

---

## ArchiView 2.4.2 — Ottimizzazione per hardware low-end

Un importante aggiornamento dedicato alle prestazioni, che riduce i tempi di avvio e l'utilizzo di memoria, migliorando la fluidità su computer meno recenti o con archivi molto grandi.

### Miglioramenti delle prestazioni

- **Avvio più rapido:** il codice dell'interfaccia viene ora compresso in un unico file per ridurre i tempi di caricamento, e le dipendenze pesanti vengono caricate solo al momento del bisogno.
- **Scritture ottimizzate e sicure:** i salvataggi dei dati ora avvengono in background, raggruppando le modifiche ravvicinate. La scrittura su disco è atomica, per proteggere i dati in caso di arresto anomalo.
- **Ricerca e filtri istantanei:** introdotta una cache testuale che rende fulminea la ricerca e l'applicazione dei filtri anche con migliaia di schede.
- **Navigazione fluida:** l'albero laterale degli archivi si aggiorna solo quando strettamente necessario. L'estrazione dei file ZIP durante l'importazione avviene in "streaming", azzerando i picchi di RAM e scongiurando blocchi.
- **Opzione "Prestazioni ridotte":** una nuova impostazione nelle preferenze permette di disattivare le animazioni, ridurre gli elementi visualizzati (25 schede per pagina) e limitare l'accelerazione hardware per risparmiare risorse e batteria.

---

## ArchiView 2.4.1 — Avvio affidabile e albero più pulito

Aggiornamento correttivo della 2.4.0. **Consigliato a chiunque abbia installato la 2.4.0**: correggeva un errore che poteva far fallire in silenzio la creazione del primo archivio.

### Correzioni

- **Creazione dell'archivio al primo avvio:** premendo "Crea Nuova Cartella Locale" nella schermata di benvenuto subito dopo l'installazione, l'operazione poteva non produrre nulla senza alcun messaggio. Le traduzioni venivano caricate dopo che la finestra era già cliccabile; ora sono pronte prima che l'interfaccia risponda.
- **Albero degli archivi senza riga radice:** l'albero elenca solo le cartelle. Per tornare alla radice basta un click nell'area vuota sotto l'elenco, che accetta anche il trascinamento di schede e cartelle. Il menu del tasto destro nell'area vuota crea la prima scheda o la prima cartella.
- L'etichetta della radice nei percorsi e nei menu è ora "Radice" ("Root" in inglese), non più "Archivio".

### Aggiornamenti tecnici

- Electron 39.8.10 (da 39.8.5).
- DOMPurify 3.4.13 (da 3.4.7) — la protezione applicata ai contenuti sincronizzati dal cloud.
- Hub Cloudflare: dipendenze di sviluppo aggiornate, nessuna vulnerabilità nota.
