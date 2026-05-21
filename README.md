# Schedatore
**Schedatore** è un'applicazione desktop (creata con Electron) progettata come gestionale offline per catalogare, archiviare e trascrivere manoscritti medievali e documenti storici.

## Caratteristiche Principali
- **Organizzazione a Cartelle**: Gestisci i tuoi archivi in una struttura gerarchica di cartelle e sottocartelle per un ordine perfetto.
- **Modelli di Documento Flessibili**: Utilizza i modelli predefiniti (Imbreviature notarili, Atti giudiziari, Documenti fiscali) o crea i tuoi tipi di documento personalizzati con i campi di cui hai bisogno (Data, Autori, Segnatura, Supporto, ecc.).
- **Gestione Allegati**: Allega e visualizza direttamente nell'applicazione scansioni, fotografie o file PDF associati alle tue schede.
- **Ambiente di Trascrizione Integrato**: Un editor di testo con vista "split-screen" per affiancare comodamente le immagini o i PDF originali del documento durante il lavoro di trascrizione.
- **Ricerca Avanzata e Tag**: Trova rapidamente qualsiasi scheda attraverso la ricerca globale testuale o filtrando l'archivio tramite i tag associati.
- **Completamente Offline e Locale**: Tutti i dati (il database in formato JSON e i file allegati) vengono salvati localmente sul tuo computer nella cartella di lavoro (Workspace) scelta al primo avvio, garantendo massima privacy e sicurezza.
- **Backup in ZIP**: Funzione integrata per esportare in un solo clic l'intero archivio (database e allegati) in un comodo file ZIP di backup.

## Download e Installazione:
Il modo più semplice per utilizzare **Schedatore** è scaricare l'ultima versione pre-compilata. **Non è necessario installare nulla tramite terminale**:
1. Vai alla pagina [Releases](https://github.com/AntonioOrf/Schedatore/releases) del progetto su GitHub.
2. Scarica il file eseguibile per il tuo sistema operativo (es. il pacchetto `.exe` "Portable" per Windows).
3. Avvia direttamente il file scaricato. L'applicazione è autonoma e non richiede un processo di installazione nel sistema.
---
## Per gli Sviluppatori (Compilazione da sorgente)
Se desideri modificare il codice o avviare l'applicazione in ambiente di sviluppo, assicurati di avere [Node.js](https://nodejs.org/) installato sul tuo sistema, quindi:
1. Clona questo repository o estrai i file del progetto.
2. Apri il terminale nella directory principale (dove si trova il file `package.json`).
3. Installa le dipendenze:
   ```bash
   npm install
   ```
4. Avvia l'applicazione:
   ```bash
   npm start
   ```
### Creazione dell'Eseguibile
Se desideri pacchettizzare l'applicazione per creare un eseguibile (es. per Windows):
```bash
npm run pack
```
Questo comando, grazie a `electron-builder`, creerà un pacchetto portable nella cartella `dist`.
## Primo Avvio
Al primo avvio, Schedatore ti chiederà di selezionare una **Cartella di Lavoro** (Workspace). 
Scegli una directory vuota e sicura sul tuo disco fisso: al suo interno l'app creerà automaticamente:
- Il file `database_manoscritti.json` (dove verranno salvati tutti i testi e i metadati).
- La cartella `allegati_manoscritti` (dove verranno copiate le immagini e i PDF che allegherai alle schede).
Puoi sempre modificare la cartella di lavoro successivamente dalle **Impostazioni**.
## Tecnologie Utilizzate
- [Electron](https://www.electronjs.org/) per il framework desktop.
- [Tailwind CSS](https://tailwindcss.com/) per lo styling dell'interfaccia.
- [Lucide Icons](https://lucide.dev/) per le icone.
## Licenza
Consulta il file [LICENSE](LICENSE) per ulteriori informazioni sulle condizioni d'uso.
