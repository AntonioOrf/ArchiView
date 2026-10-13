# ArchiScanner — privacy policy

Last updated: 13 October 2026. Translation of [PRIVACY_POLICY.md](PRIVACY_POLICY.md); if the two
differ, the Italian text prevails.

ArchiScanner is the Android companion app of ArchiView: it photographs archival documents and
delivers them to the same user's ArchiView desktop. It also has a **Documents** section, a
general-purpose scanner whose content stays on the phone.

## Data processed

- **Photos of archival documents**, with the title, note, shelfmark and labels you enter. They
  stay on the phone until they are sent. After sending they are deleted right away or, depending
  on the «After sending» setting, they stay on the phone as read-only for the number of days you
  chose and then delete themselves (or earlier, if you remove them).
- **Google account** (email address and name), only to access your Google Drive. The email of the
  last sign-in stays saved on the phone, so that pages scanned with the first account are not
  sent to another account without asking you.
- **List of records** (id, shelfmark, title, folder, and whether the record has the «to review»
  tag) of your archives, taken from what your ArchiView desktop has put on your Drive and saved on
  the phone to choose the destination even without a network.
- **Documents**: photos, names, folders and recognised text. Text recognition (OCR) runs on the
  phone. They stay on the phone, unless you turn on the copy to Drive or send a document to an
  archive (see below).
- **Images shared** with ArchiScanner from another app's Share menu: they become a new document
  in Documents.

## Where they go

- To **your** Google Drive, in the `ArchiView/Scansioni in arrivo/` folder. The app uses the
  `drive.file` scope: it only sees files created by ArchiView (app or desktop), not the rest of
  your Drive. From there your ArchiView desktop downloads them and moves every received batch to
  the Drive bin.
- Alternatively, with **«Receive over Wi-Fi»**, straight to your computer on the same local
  network, after pairing it by framing the QR code it shows. The transfer is unencrypted on the
  local network, only towards that computer, and is protected by a code that changes every time
  you reopen the panel on the computer; the pairing is not saved on the phone.
- **Documents** leave the phone only when you ask: with Android's Share menu (towards the app you
  choose), by saving them to a folder you choose, by sending one to an archive (its photos leave
  like archival scans) or by turning on **«Copy to Drive»** in Settings. The copy goes to **your**
  Drive, in `ArchiView/Documenti telefono/`, only on Wi-Fi, with the same `drive.file` scope; it
  is used to restore them on another phone.

No server of the developer receives data. No advertising, no usage statistics, no sharing with
third parties other than Google as the provider of your Drive.

The app's data is excluded from Android's backup to Google Drive.

## Permissions

- **Camera**: to scan, to read the QR code for Wi-Fi pairing and for the «Free photo» (seals,
  watermarks, details, without cropping). Android asks for it with its own dialog the first time,
  and you change it in Android's settings (Settings → Privacy in the app takes you there). The
  document photos are taken by the Google Play Services document scanner, which would not need the
  permission: the app asks for it anyway before scanning, so you always decide. Without it you
  cannot scan, read the QR code or take a Free photo.
- **Network and network state**: to send to Drive or to the computer and respect the «Send only
  on Wi-Fi» option.
- Gallery photos added to Documents go through Android's system picker: the app only sees the
  ones you choose, without gallery permissions.
- Files saved outside the app go to the folder you choose in Android's picker. The app neither
  requests nor declares permissions on the phone's storage, photos or videos, nor the permission
  to draw over other apps.
- A summary of this policy, with a link to it, appears on the app's first screen; the policy
  stays available in Settings → Privacy.

## Deletion

Sign out of the account in the app and uninstall it: nothing is left on the phone, Documents
included. Batches already sent are in your Drive or on your computer and are deleted from there;
the copy of Documents, if you turned it on, is in `ArchiView/Documenti telefono/` on your Drive.
The app's access to Drive is revoked at <https://myaccount.google.com/permissions>.

## Contact

For questions: the issues of the ArchiView repository on GitHub.
