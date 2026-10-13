# ArchiScanner

Android companion app of ArchiView: it scans archival documents and delivers them to the
desktop, via Google Drive or Wi-Fi. Italian version, with the developer notes:
[README.md](README.md).

Flow: **archive** (published by the desktop, or new) → **record** (searched, new, or "To sort")
→ «Scan». Every «Save» of the scanner becomes a **batch** (the transfer envelope of the
[contract](../docs/scanner/CONTRATTO.md), invisible to the user) and leaves by itself on Wi-Fi;
the desktop imports it into the record by itself.

The **Documents** section is a general-purpose scanner whose documents stay on the phone: folders,
search, filters, text recognition (OCR), PDF or JPEG export, optional copy to Drive.

The app follows the phone's language (Italian, otherwise English); Settings › Language changes it.

Expo SDK 57 + React Native + TypeScript. It uses native modules (Google Sign-In, ML Kit,
VisionCamera): **it does not run in Expo Go**, it needs a build.

## Commands

```bash
npm install
npm run typecheck                 # tsc --noEmit
npm test                          # unit tests (node --test), dictionary guard included
npm run android                   # expo run:android: debug build, JS from Metro (needs the PC)
npx expo run:android --variant release   # embedded JS, same signature as debug
npm run export                    # JS bundle only (what CI does)
npm run test:maestro              # UI flows on an emulator (see README.md)
```

## Installing

Releases are on GitHub with the `scanner-vX.Y.Z` tag (APK attached, prerelease). The app checks
for a newer release at start-up and offers «Update».

## Privacy

[PRIVACY_POLICY.en.md](PRIVACY_POLICY.en.md). No developer server receives data: pages go to your
own Google Drive or straight to your computer on the local network.

## Licence

GPL-3.0, like ArchiView (see `LICENSE` in the repository root).
