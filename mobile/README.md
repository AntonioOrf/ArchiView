# ArchiView Scanner

App Android companion di ArchiView: scansiona documenti in archivio e li consegna al desktop
come **lotti** (vedi [`docs/scanner/CONTRATTO.md`](../docs/scanner/CONTRATTO.md)), via Google
Drive o Wi-Fi. Piano di lavoro: `PIANO-SCANNER.md` nella radice del repository.

Expo SDK 57 + React Native + TypeScript. Usa moduli nativi (Google Sign-In, ML Kit): **non
gira in Expo Go**, serve una build.

## Comandi

```bash
npm install
npm run typecheck                 # tsc --noEmit
npm run android                   # expo run:android: build di sviluppo su telefono/emulatore
npm run export                    # solo bundle JS (quello che fa la CI)
npx eas-cli@latest build -p android --profile apk   # APK installabile a mano
```

Se `npx expo install` non raggiunge api.expo.dev: `EXPO_OFFLINE=1 npx expo install …`.

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

## Validatore condiviso

`src/contratto.ts` carica `../src/shared/scannerLotto.ts`, lo stesso file che usa il desktop
(Metro: `watchFolders` in `metro.config.js`). Non copiarlo né riscriverlo qui.

## Licenza

GPL-3.0, come ArchiView (vedi `LICENSE` nella radice del repository).
