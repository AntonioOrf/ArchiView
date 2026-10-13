# ArchiScanner: scansionare col telefono

**ArchiScanner** è l'app Android che accompagna ArchiView. In archivio fotografi le carte col
telefono, scegliendo la scheda a cui appartengono; a casa le pagine entrano da sole in quella
scheda, sul computer, come allegati. Non serve spostare file a mano né rinominarli.

L'app ha anche una sezione [Documenti](/archiscanner/documenti), uno scanner per tutto ciò che non va nell'archivio
(ricevute, fotocopie, articoli): quei documenti restano sul telefono e si condividono come PDF.

::: info Cosa serve
- Un telefono **Android**. L'app non c'è per iPhone e non è sul Play Store: si installa dal file
  APK pubblicato fra le [release di ArchiView](https://github.com/AntonioOrf/ArchiView/releases).
  Android chiede di consentire l'installazione da quella sorgente.
- Per il canale principale, lo stesso **account Google** con cui ArchiView sincronizza su Drive.
  Senza account si può usare il [Wi-Fi diretto](/archiscanner/computer#wi-fi-diretto-senza-drive).
- L'app è in italiano e in inglese: segue la lingua del telefono, e si cambia in
  **Impostazioni → Lingua**.
:::

## Il percorso di una pagina

Sul telefono si ragiona come sul computer: **archivio**, poi **scheda**, poi **pagine**.

1. Scegli l'archivio e, dentro, la scheda (o creane una nuova).
2. Scansioni le carte, una dopo l'altra, e le numeri.
3. Le pagine partono verso Google Drive appena il telefono è sul Wi-Fi.
4. Quando apri quell'archivio sul computer, ArchiView le scarica, controlla che siano arrivate
   intere e le aggiunge alla scheda.

Le foto viaggiano come JPEG a piena risoluzione, una per pagina. Il riconoscimento del testo
(OCR) non si fa sul telefono per le pagine d'archivio: si lancia dal computer, con le lingue che
hai installato lì (vedi [OCR degli allegati](/guida/ocr)).

## Primo avvio

Al primo avvio un benvenuto in tre passi presenta l'app, con un riassunto di come tratta i tuoi
dati e il link all'[informativa sulla privacy](https://github.com/AntonioOrf/ArchiView/blob/main/mobile/PRIVACY_POLICY.md);
poi chiede cosa fare delle pagine dopo l'invio e se collegare Google Drive. Tutto si cambia dopo
da **Impostazioni**, e **Salta** porta direttamente all'ultimo passo.

L'app non chiede un consenso suo: la prima volta che scansioni, Android chiede il permesso della
fotocamera con la sua finestra. Senza permesso non si scansiona; si concede o si toglie in
**Impostazioni → Privacy → Gestisci nelle impostazioni di Android**. Galleria e cartelle passano
dai selettori di Android e non chiedono permessi.

## Scegliere l'archivio

L'app poi chiede l'archivio. Per vederne l'elenco serve l'accesso a Google
(**Impostazioni → Accedi con Google**).

![La tendina degli archivi: gli archivi che vanno al computer e, sotto, i Documenti che restano sul telefono](/img/telefono-tendina.png){.light-only .telefono}
![La tendina degli archivi: gli archivi che vanno al computer e, sotto, i Documenti che restano sul telefono](/img/telefono-tendina-scuro.png){.dark-only .telefono}

L'elenco viene da due fonti:

- gli archivi che il computer ha **pubblicato**: ArchiView lo fa ogni volta che apri il pannello
  [«Dal telefono»](/archiscanner/computer) e riceve da Drive;
- gli archivi **sincronizzati con Google Drive**, anche a computer spento.

Gli archivi condivisi tramite Hub, o da un altro account Google, non compaiono.

Con **Nuovo archivio** ne crei uno dal telefono, indicando solo il nome. Il computer lo propone
alla prima ricezione con **Crea archivio…**: scegli dove metterlo sul disco e le pagine entrano.

La scelta resta ricordata. Per cambiarla tocca il nome dell'archivio in alto.

## Aggiornare l'app

All'avvio l'app controlla se è uscita una versione nuova e lo dice con un avviso: **Aggiorna**
scarica l'APK e apre l'installazione di Android, **Più tardi** lo rimanda. La versione nuova resta
in **Impostazioni → App**, dove **Cerca aggiornamenti** ripete il controllo a mano. Le pagine in
attesa restano dove sono.
