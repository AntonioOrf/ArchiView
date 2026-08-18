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
