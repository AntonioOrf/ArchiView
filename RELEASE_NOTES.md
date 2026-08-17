## ArchiView 2.4.0 — Interfaccia riorganizzata per zone

Ogni comando ha ora una posizione stabile: a sinistra la navigazione dei pannelli, a destra un unico controllo per lo stato del cloud, e sopra la griglia le azioni sull'archivio aperto. Niente più pulsanti che cambiano posto a seconda del contenuto.

### Archivi e navigazione

- **Nessun archivio "Generale" imposto:** un nuovo Vault nasce vuoto. Le schede non ancora archiviate restano nella radice, visibile in cima all'albero, e ogni cartella — compresa l'ultima rimasta — si può rinominare, spostare ed eliminare.
- **Filtri attivi sempre dichiarati:** ricerca globale e tag scavalcavano in silenzio la cartella selezionata. Ora compaiono come chip rimovibili sopra la griglia, e navigare l'albero li azzera.
- **Percorso leggibile:** due cartelle omonime in rami diversi erano indistinguibili; l'intestazione mostra il percorso completo, con gli antenati cliccabili.
- **Un solo menu azioni:** il pulsante "⋯" di schede e cartelle apre esattamente il menu del tasto destro. Rinomina, copia/taglia/incolla ed esporta non sono più raggiungibili solo col tasto destro.
- Il messaggio di "nessun risultato" distingue una cartella vuota da un filtro troppo stretto.

### Bugfix di interfaccia

- **Nuova cartella:** il campo nome non prendeva subito il fuoco — i primi caratteri digitati andavano persi e il cursore saltava in fondo a scrittura iniziata.
- **Chiusura dei modali:** Esc chiude la finestra in cima passando dalla sua procedura di chiusura: prima lasciava nodi orfani nel DOM e abbandonava senza annullarla la risoluzione dei conflitti di sincronizzazione.
- **Operazioni in corso:** gli overlay di sincronizzazione e la finestra di autenticazione non si chiudono più per un Esc o un click a vuoto.
- **Ctrl+F:** mandava il fuoco sul campo di ricerca anche quando il pannello era chiuso, cioè su un elemento invisibile.
- **Click su una scheda nell'albero:** dalla vista Nuova scheda o Trascrizione non portava alla lista, e la scheda selezionata restava fuori schermo.
- **Pannelli sidebar:** il pulsante restava evidenziato a sidebar chiusa, facendo sembrare rotto il click successivo.
- **Sovrapposizione delle finestre:** scala z-index unica — niente più modali che finiscono dietro l'overlay che li ha aperti.
- **Sincronizzazione:** risolto il blocco su "Preparazione dell'archivio condiviso" al termine della creazione di un repository Hub e del cambio di archivio.
- **Tutorial:** risolto un errore che poteva bloccare il disegno dell'albero degli archivi all'avvio della guida; l'invito al tutorial non è più un modale a tutto schermo.

### Accessibilità, temi e leggibilità

- Pulsanti icona con area di click di almeno 32px, e azioni di riga raggiungibili anche da tastiera.
- I cinque pulsanti dei pannelli si comportano da vere schede: frecce, Home e Fine spostano il fuoco, lo stato è annunciato agli screen reader.
- Ogni annuncio (sincronizzazione, errori, salvataggi) passa da un'unica live region; i pulsanti che lavorano dichiarano l'attesa invece di sembrare bloccati.
- Colori dei pannelli cloud presi dai token del tema: risolti i testi illeggibili nei temi scuri e nel tema chiaro Clear Blue.
- Le animazioni si fermano se il sistema chiede movimento ridotto.
- Riepilogo dello stato dell'archivio con i dati reali al posto del vecchio testo fisso.
