# ArchiScanner: scanning with your phone

**ArchiScanner** is the Android companion app for ArchiView. In the archive you photograph the
leaves with your phone and pick the record they belong to; back home, the pages land in that
record on your computer as attachments. No moving or renaming files by hand.

The app also has a [Documenti](/en/archiscanner/documents) (Documents) section, a general scanner for things that don't
belong in the archive (receipts, photocopies, articles). Those stay on the phone and are shared
as PDFs.

::: info What you need
- An **Android** phone. There is no iPhone version and the app is not on the Play Store: you
  install it from the APK published with the
  [ArchiView releases](https://github.com/AntonioOrf/ArchiView/releases). The steps are in
  [Installation](/en/archiscanner/installation).
- For the main channel, the same **Google account** ArchiView uses to sync with Drive. Without
  an account you can use [direct Wi-Fi](/en/archiscanner/computer#direct-wi-fi-without-drive).
- The app is in English and Italian: it follows the phone's language, and you change it in
  **Settings → Language**. Older parts of this guide give the Italian label first, with the
  English one in brackets.
:::

## How a page travels

The phone follows the same structure as the computer: **archive**, then **record**, then
**pages**.

1. Pick the archive and, inside it, the record (or create a new one).
2. Scan the leaves one after another and number them.
3. The pages go up to Google Drive as soon as the phone is on Wi-Fi.
4. When you open that archive on the computer, ArchiView downloads them, checks that they
   arrived whole, and adds them to the record.

Photos travel as full-resolution JPEGs, one per page. Text recognition (OCR) for archive pages
does not happen on the phone: you run it on the computer, with the languages you installed there
(see [OCR of attachments](/en/guide/ocr)).

## First run

On first run a three-step welcome introduces the app, with a summary of how it handles your data
and a link to the [privacy policy](https://github.com/AntonioOrf/ArchiView/blob/main/mobile/PRIVACY_POLICY.en.md);
then it asks what to do with pages after sending and whether to connect Google Drive. Everything
can be changed later in **Settings**, and **Skip** jumps straight to the last step.

The app does not ask for a consent of its own: the first time you scan, Android asks for the
camera permission with its own dialog. Without it you cannot scan; you grant or revoke it in
**Settings → Privacy → Manage in Android settings**. The gallery and folders go through Android's
pickers and need no permission.

## Choosing the archive

Next the app asks for an archive. To see the list you need to sign in to Google
(**Impostazioni → Accedi con Google**, Settings → Sign in with Google).

![The archive drop-down: archives that go to the computer and, below, the Documents that stay on the phone](/img/telefono-tendina.png){.light-only .telefono}
![The archive drop-down: archives that go to the computer and, below, the Documents that stay on the phone](/img/telefono-tendina-scuro.png){.dark-only .telefono}

The list comes from two places:

- archives the computer has **published**: ArchiView does this every time you open the
  [«From the phone»](/en/archiscanner/computer) panel and it receives from Drive;
- archives **synced with Google Drive**, even with the computer switched off.

Archives shared through the Hub, or from another Google account, do not appear.

**Nuovo archivio** (New archive) creates one from the phone; you only give it a name. On its
next receive the computer offers **Create archive…**: choose where to put it on disk and the
pages go in.

The app remembers your choice. To change it, tap the archive name at the top.

## Updating the app

At startup the app checks for a new version and tells you with a message: **Update** downloads
the APK and opens Android's installer, **Later** puts it off. While the APK downloads, the message
stays open with the percentage downloaded and the app can't be used until the installer appears.
The new version stays in **Settings → App**, where **Update** does the same and **Check for
updates** runs the check by hand. Pages waiting to be sent stay where they are.
