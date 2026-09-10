# OCR: far leggere il testo all'app

L'OCR (*riconoscimento ottico dei caratteri*) legge il testo stampato o scritto dentro le
immagini e i PDF allegati, e lo rende cercabile. Funziona **sul tuo computer**: nessuna
immagine viene inviata a un servizio esterno.

::: warning Cosa aspettarsi
L'OCR è nato per la stampa. Su una scrittura umanistica pulita e ben fotografata dà risultati
utilizzabili; su una minuscola notarile corsiva del Trecento no. Trattalo come uno strumento di
**ricerca** — trovare la carta giusta in duecento scansioni — non come un sostituto della
trascrizione.
:::

## Prima di tutto: installare una lingua

I pacchetti lingua pesano decine di megabyte, perciò non sono inclusi nell'app: si scaricano
una volta sola, e restano su quel computer.

Si installano da tre punti: la finestra dell'OCR, la palette dei comandi (`Ctrl+K` → «lingue
OCR») e **Impostazioni → Archivio Dati**.

Per il latino e il volgare italiano conviene installare entrambe le lingue e selezionarle
insieme: il motore le usa contemporaneamente.

::: tip
La scelta della lingua è **per computer**, non per archivio: non viene sincronizzata. Un
collega che non ha installato quella lingua non ne subisce le conseguenze.
:::

## Riconoscere un allegato

Dalla scheda, sull'allegato che ti interessa. Le opzioni:

- **lingue** da usare;
- **risoluzione (dpi)** per i PDF: più alta significa più preciso e più lento;
- **numero massimo di pagine**, per non lanciare un lavoro di un'ora su un registro intero.

Il lavoro si può **annullare** mentre gira: ciò che è già stato riconosciuto resta.

### Sui PDF, prima si cerca il testo vero

Se il PDF contiene già un livello di testo (perché nasce digitale, o è stato già passato
all'OCR da qualcun altro), l'app lo **legge direttamente**, pagina per pagina, e riconosce solo
le pagine che ne sono prive. È più preciso e incomparabilmente più veloce.

## Dove finisce il testo riconosciuto

In due posti, con ruoli diversi:

1. **Nell'indice di ricerca.** Il testo entra nella ricerca globale senza comparire nella
   scheda. Da lì la sintassi dedicata:

   ```
   ocr:testamento
   ```

   e il filtro avanzato «ha OCR: sì / no», che è la lista di lavoro di chi sta riconoscendo un
   fondo intero.

2. **Come bozza di trascrizione**, se lo chiedi: il testo viene messo nell'editor della carta
   corrispondente. Se quella carta ha già una trascrizione, l'app chiede cosa fare —
   **sostituisci**, **accoda** o **annulla** — e non sovrascrive mai in silenzio.

### Le parole incerte si vedono

Le parole riconosciute con poca sicurezza sono **sottolineate con una linea ondulata**, e in
cima alla bozza compare una nota che dice che quel testo viene da un riconoscimento automatico.

La marcatura sopravvive all'esportazione: diventa `[?]` in Markdown (la convenzione filologica
per una lettura dubbia) e una sottolineatura ondulata in RTF. Una bozza OCR che esce dall'app
senza dichiararsi diventerebbe una trascrizione falsamente autorevole.

## OCR su molte schede

Si può lanciare il riconoscimento su una selezione di schede. In quel caso:

- gli allegati che hanno **già** un OCR vengono saltati;
- la domanda su cosa fare con le trascrizioni esistenti viene posta **una volta sola**, non per
  ogni carta;
- l'annullamento a metà conserva tutto ciò che è già stato riconosciuto.

Su un fondo di qualche centinaio di scansioni è un lavoro da lasciar girare mentre fai
altro — l'app resta usabile, ma sul computer sarà l'operazione più pesante in corso.

## Metodo consigliato

1. Prova su **tre o quattro carte rappresentative** prima di lanciare l'intero fondo: se il
   risultato è illeggibile, cambiare mano non lo migliorerà.
2. Se la scrittura non si presta, usa comunque l'OCR sulle parti **stampate o tarde** (buste,
   camicie, note di inventario moderne): spesso sono proprio quelle a contenere le segnature
   che cerchi.
3. Usa `ocr:` per trovare la carta e la trascrizione manuale per il lavoro serio.
