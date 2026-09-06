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
