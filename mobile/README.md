# ArchiScanner

App Android companion di ArchiView: scansiona documenti in archivio e li consegna al desktop,
via Google Drive o Wi-Fi. Piano di lavoro: `PIANO-SCANNER.md` nella radice del repository.

Flusso: **archivio** (pubblicato dal desktop, o nuovo) → **scheda** (cercata, nuova, o "Da
smistare") → «Scansiona». Ogni «Salva» dello scanner diventa un **lotto** (la busta di
trasferimento del [contratto](../docs/scanner/CONTRATTO.md), invisibile all'utente) e parte da
solo col Wi-Fi; il desktop lo importa da solo nella scheda.

Expo SDK 57 + React Native + TypeScript. Usa moduli nativi (Google Sign-In, ML Kit, VisionCamera): **non
gira in Expo Go**, serve una build.

## Comandi

```bash
npm install
npm run typecheck                 # tsc --noEmit
npm run android                   # expo run:android: build di debug, il JS arriva da Metro (serve il PC)
npx expo run:android --variant release   # JS incorporato, stessa firma di debug: per l'archivio, senza PC
npm run export                    # solo bundle JS (quello che fa la CI)
npx eas-cli@latest build -p android --profile apk   # APK installabile a mano
```

Se `npx expo install` non raggiunge api.expo.dev: `EXPO_OFFLINE=1 npx expo install …`.

## Test dell'interfaccia (Maestro)

Flussi in `.maestro/flussi/`, uno per funzione: archivio e albero, tendina degli archivi, Da
inviare, visore (etichetta, Ruota, Rifai, Ritaglia, Dividi, Elimina), pagine inviate, cartella di
una scheda nata qui, «Senza scheda», nuova scheda con scansione e numerazione, Impostazioni,
abbinamento Wi-Fi fino alla fotocamera, Documenti (cartelle, ricerca, rinomina, sposta, filtri,
Condividi, scansione di documenti nuovi).

Una tantum: [Maestro](https://maestro.mobile.dev) in `~/.maestro`, JDK 17 in `JAVA_HOME`, un
emulatore **Google Play** (lo scanner ML Kit sta in Play Services) o un telefono via USB.

```bash
# build di DEBUG (serve run-as), per telefono ed emulatore x86_64; poi adb install -r
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64 && cd ..
npx expo start                     # Metro; METRO_PORTA=… se non è sulla 8081
npm run test:maestro               # tutti i flussi
npm run test:maestro visore        # solo quelli col nome che contiene «visore»
```

`.maestro/esegui.mjs` azzera i dati dell'app prima di ogni flusso e scrive il **seme** dichiarato
in testa (`# seme: archivio`): archivio, schede, lotti e documenti come li scriverebbe l'app,
con la pagina MGH di `scripts/assets`. Niente account Google né rete. Sull'emulatore la fotocamera
virtuale fa scattare lo scanner da solo (`comuni/scatta.yaml`). Esiti JUnit e schermate dei
fallimenti in `.maestro/esiti/` e `~/.maestro/tests/`.

**Solo emulatore senza account Google.** Con più dispositivi collegati `esegui.mjs` sceglie
l'emulatore (o `ANDROID_SERIAL`) e su un telefono vero si ferma: i semi azzerano i dati
dell'app, e se il telefono ha un account Google l'app accede da sola e **invia su Drive** i lotti
finti dei semi (successo il 12/10). Per forzarlo: `ARCHIVIEW_MAESTRO_TELEFONO=1`, dopo aver
tolto l'account dall'app e salvato i dati (`adb exec-out run-as <pacchetto> tar cf - files`).
`20-wifi-diretto` gira solo dentro `e2e/wifi-emulatore.spec.ts` (`MAESTRO_WIFI_DESKTOP=acceso`):
lo spec mette il QR del desktop come poster della scena virtuale della fotocamera e riavvia
l'emulatore (i poster si leggono solo all'avvio); lanciato da solo non fa nulla.
`19-schermate` non verifica nulla: fotografa le schermate principali, da rilanciare con
`settings put system font_scale 2.0` e `cmd uimode night yes`.

Restano a mano: invio su Drive e via Wi-Fi (servono account e computer), lettura del QR reale,
«Salva in Download» (selettore di cartelle di Android), accesso Google.

## Accesso Google (una volta)

Nella console Google Cloud, **stesso progetto** del client desktop di ArchiView:

1. Credenziali → Crea credenziali → ID client OAuth → tipo **Android**.
2. Nome pacchetto: `com.antonioorf.archiview.scanner`.
3. SHA-1 del certificato con cui è firmata la build:
   - build di sviluppo (`expo run:android`): `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - EAS: `npx eas-cli@latest credentials` → Android → SHA1 Fingerprint.

   Ogni certificato (debug, EAS, release) vuole il suo client Android.
4. Lo scope `drive.file` deve essere già nella schermata di consenso del progetto (lo usa il desktop).

Nessun segreto nell'app: Google riconosce il client da pacchetto + SHA-1.

## Rilascio

APK su GitHub con il tag `scanner-vX.Y.Z` (workflow `.github/workflows/mobile-release.yml`):
release **prerelease e mai "latest"**, perché l'updater del desktop legge la release "latest".

Una tantum:
1. `npx eas-cli@latest init` in `mobile/` (scrive `extra.eas.projectId` in `app.json`).
2. `npx eas-cli@latest credentials` → Android → keystore gestito da EAS; con il suo SHA-1 crea
   un altro client OAuth Android (vedi sopra).
3. Su GitHub, segreto `EXPO_TOKEN` (expo.dev → Access tokens).

Ogni rilascio: alza `version` in `app.json`, poi tag `scanner-v<versione>` e push del tag.

## Lingua

Solo italiano, senza Lingui (decisione del 09/10): lo strumento è privato. Se servirà
l'inglese, un dizionario come `customIt`/`customEn` del desktop, non una libreria.

## Validatore condiviso

`src/contratto.ts` carica `../src/shared/scannerLotto.ts`, lo stesso file che usa il desktop
(Metro: `watchFolders` in `metro.config.js`). Non copiarlo né riscriverlo qui.

## Licenza

GPL-3.0, come ArchiView (vedi `LICENSE` nella radice del repository).
