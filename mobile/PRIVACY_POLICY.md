# ArchiScanner — informativa sulla privacy

Ultimo aggiornamento: 13 ottobre 2026. In inglese: [PRIVACY_POLICY.en.md](PRIVACY_POLICY.en.md).

ArchiScanner è l'app Android companion di ArchiView: fotografa documenti d'archivio e li
consegna all'ArchiView desktop dello stesso utente. Ha anche una sezione **Documenti**, uno
scanner generico che resta sul telefono.

## Dati trattati

- **Foto dei documenti d'archivio**, con titolo, nota, segnatura ed etichette che inserisci tu.
  Restano sul telefono finché non vengono inviate. Dopo l'invio si cancellano subito oppure,
  secondo l'impostazione «Dopo l'invio», restano sul telefono in sola lettura per il numero di
  giorni scelto e poi si cancellano da sole (o prima, se le rimuovi tu).
- **Account Google** (indirizzo email e nome), solo per accedere al tuo Google Drive. L'email
  dell'ultimo accesso resta salvata sul telefono, per non inviare a un altro account le pagine
  scansionate con il primo senza chiedertelo.
- **Elenco delle schede** (id, segnatura, titolo, cartella, e se la scheda ha il tag «da vedere»)
  dei tuoi archivi, ricavato da quanto il tuo ArchiView desktop ha messo sul tuo Drive e salvato
  sul telefono per scegliere la destinazione anche senza rete.
- **Documenti**: foto, nomi, cartelle e testo riconosciuto. Il riconoscimento del testo (OCR)
  avviene sul telefono. Restano sul telefono, salvo che tu accenda la copia su Drive o mandi un
  documento a un archivio (vedi sotto).
- **Immagini condivise** con ArchiScanner dal menu Condividi di un'altra app: diventano un
  documento nuovo nei Documenti.

## Dove vanno

- Nel **tuo** Google Drive, nella cartella `ArchiView/Scansioni in arrivo/`. L'app usa lo scope
  `drive.file`: vede solo i file creati da ArchiView (app o desktop), non il resto del Drive.
  Da lì li scarica il tuo ArchiView desktop, che sposta nel cestino di Drive ogni lotto ricevuto.
- In alternativa, con **«Ricevi via Wi-Fi»**, direttamente al tuo computer sulla stessa rete
  locale, dopo averlo abbinato inquadrando il codice QR che mostra. Il trasferimento avviene in
  chiaro sulla rete locale, solo verso quel computer, ed è protetto da un codice che cambia ogni
  volta che riapri il pannello sul computer; l'abbinamento non si salva sul telefono.
- I **Documenti** escono dal telefono solo quando lo chiedi tu: con il menu Condividi di Android
  (verso l'app che scegli), salvandoli in una cartella che scegli tu, mandandone uno a un archivio
  (le sue foto partono come le scansioni d'archivio) o accendendo **«Copia su Drive»** in
  Impostazioni. La copia va nel **tuo** Drive, in `ArchiView/Documenti telefono/`, solo col Wi-Fi,
  con lo stesso scope `drive.file`; serve a ripristinarli su un altro telefono.

Nessun server dello sviluppatore riceve dati. Nessuna pubblicità, nessuna statistica d'uso,
nessuna condivisione con terzi oltre a Google come fornitore del tuo Drive.

I dati dell'app sono esclusi dal backup di Android su Google Drive.

## Permessi

- **Fotocamera**: per scansionare, per leggere il codice QR dell'abbinamento Wi-Fi e per la «Foto
  libera» (sigilli, filigrane, dettagli, senza ritaglio). La chiede Android con il suo dialogo la
  prima volta, e la cambi dalle impostazioni di Android (Impostazioni → Privacy nell'app ti ci
  porta). Le foto dei documenti le scatta lo scanner di documenti di Google Play Services, che non
  avrebbe bisogno del permesso: l'app lo chiede comunque prima di scansionare, così decidi sempre
  tu. Senza permesso non si scansiona, non si legge il QR e non si fa la Foto libera.
- **Rete e stato della rete**: per inviare su Drive o al computer e rispettare l'opzione
  «Invia solo con Wi-Fi».
- Le foto della galleria aggiunte ai Documenti passano dal selettore di sistema di Android: l'app
  vede solo quelle che scegli, senza permessi sulla galleria.
- I file salvati fuori dall'app vanno nella cartella che scegli tu dal selettore di Android.
  L'app non chiede né dichiara permessi su memoria, foto o video del telefono, e nemmeno quello
  di sovrapporsi ad altre app.
- Un riassunto di questa informativa, con il link, compare nella prima schermata dell'app;
  l'informativa resta raggiungibile da Impostazioni → Privacy.

## Cancellazione

Esci dall'account nell'app e disinstallala: sul telefono non resta nulla, Documenti compresi.
I lotti già inviati sono nel tuo Drive o sul tuo computer e si cancellano da lì; la copia dei
Documenti, se l'hai accesa, sta in `ArchiView/Documenti telefono/` del tuo Drive. L'accesso
dell'app al Drive si revoca da <https://myaccount.google.com/permissions>.

## Contatti

Per domande: le issue del repository di ArchiView su GitHub.
