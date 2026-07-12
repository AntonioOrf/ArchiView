*Leggi in [Inglese](README.md)*

<img padding=20i width="1920" height="1280" alt="914_1x_shots_so" src="https://github.com/user-attachments/assets/973bffbb-f596-47ad-97d3-151f5f10075b" />


# ArchiView

**ArchiView** è un'applicazione desktop (creata con Electron) progettata come gestionale offline per catalogare, archiviare e trascrivere manoscritti e documenti storici.

## Ambiente di Trascrizione Integrato
<img width="1920" height="1280" alt="83_1x_shots_so" src="https://github.com/user-attachments/assets/07bbe09f-12a6-4948-abac-83dd21c9fe0e" />

 Un editor di testo con vista "split-screen" per affiancare comodamente le immagini o i PDF originali del documento durante il lavoro di trascrizione.

 ## Gestione Modulare dei Dati
 
   <img width="1920" height="1280" alt="832_1x_shots_so" src="https://github.com/user-attachments/assets/ecd03e76-77de-4eff-b733-ad6bbea0b084" />

Il cuore dell'applicazione si basa su un sistema di modelli di documento completamente dinamico. Puoi utilizzare i modelli predefiniti (Imbreviature notarili, Atti giudiziari, Documenti fiscali) o assemblare nuovi tipi di documento scegliendo solo i campi informativi di cui hai realmente bisogno (Titolo, Autori, Segnatura, Supporto, ecc.). L'interfaccia si adatterà automaticamente al modello scelto.



## Ulteriori Caratteristiche

- **Sincronizzazione tramite Server Hub (Nuova Architettura)**: Sincronizza e collabora in tempo reale con altri utenti tramite la nuova architettura basata interamente su un Server Hub ad alte prestazioni, che sostituisce il precedente modello Google Drive per i "Vault Condivisi". Puoi gestire archivi multipli e indipendenti (Multi-Vault) con risoluzione istantanea dei conflitti e sicurezza avanzata.
- **Tutorial Interattivo e Multilingua**: Impara ad utilizzare ArchiView grazie ad una guida interattiva integrata. L'applicazione è inoltre completamente tradotta in Italiano e in Inglese.
- **Organizzazione a Cartelle**: Gestisci i tuoi archivi in una struttura gerarchica di cartelle e sottocartelle per un ordine perfetto.
- **Gestione Allegati**: Allega e visualizza direttamente nell'applicazione scansioni, fotografie o file PDF associati alle tue schede.
- **Ricerca Avanzata e Tag**: Trova rapidamente qualsiasi scheda attraverso la ricerca globale testuale o filtrando l'archivio tramite i tag associati.
- **Formato Dati Aperto e Indipendente**: Nessun database proprietario o cloud bloccante (no vendor lock-in). Tutto il ciclo di vita dei dati avviene offline sul tuo dispositivo o tramite il tuo Server Hub. I documenti vengono salvati all'interno della cartella di lavoro (Workspace) in un formato JSON strutturato, chiaro, ispezionabile e facilmente manipolabile anche all'esterno dell'applicazione.
- **Esportabilità e Backup Immediato**: Hai il controllo totale e materiale dei tuoi dati. È sufficiente copiare la tua cartella Workspace su una chiavetta per trasferire l'intero progetto su un altro computer. Inoltre, è integrata una funzione nativa per generare in un solo clic l'intero archivio (database JSON e file allegati) in un pratico file ZIP di backup.

## Download e Installazione:

Il modo più semplice per utilizzare **ArchiView** è scaricare l'ultima versione:

1. Vai alla pagina [Releases](https://github.com/AntonioOrf/Schedatore/releases) del progetto su GitHub.
2. Scarica il file eseguibile per il tuo sistema operativo.
3. Avvia direttamente il file scaricato.

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

## Privacy & Termini di Servizio

- [Privacy Policy](PRIVACY_POLICY.md)
- [Terms of Service](TERMS_OF_SERVICE.md)

## Licenza

Consulta il file [LICENSE](LICENSE) per ulteriori informazioni sulle condizioni d'uso.
