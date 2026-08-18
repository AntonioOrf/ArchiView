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
