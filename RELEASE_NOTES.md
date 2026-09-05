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
