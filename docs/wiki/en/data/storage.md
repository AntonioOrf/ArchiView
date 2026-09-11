# Where your data is stored

You do not need to be technical to understand this page, and it is worth reading: knowing where your
data lives is what lets you avoid losing it.

## In your working folder

Everything lives in the folder chosen on first run:

```
Your working folder
├── database_manoscritti.json     all records and transcriptions
└── allegati_manoscritti/         attached images and PDFs
```

Nothing else. No hidden database, no proprietary archive, no files scattered around the system.

## Why it matters

- **No technological lock-in.** The `.json` file is a structured text file: it opens with any
  editor, it can be read and inspected. If one day ArchiView no longer existed, your data would
  remain readable and recoverable.
- **Transferring is copying.** There is no export procedure to learn in order to move an archive:
  you copy the folder.
- **Backup is copying.** See [Backup, export and transfer](/en/data/backup-export).

## Attachments are copies

When you attach an image or a PDF, the file is **copied** into `allegati_manoscritti`. The original
can be moved or deleted without affecting the record, but the disk space used doubles compared with
the original files.

## Things not to do

::: warning
- Do not edit `database_manoscritti.json` with a text editor while ArchiView is open: your changes
  would be overwritten, or the file damaged.
- Do not keep the working folder inside a folder synchronised by a generic cloud service (Dropbox,
  OneDrive, Google Drive) if you work on the same archive from several computers: two simultaneous
  synchronisations can corrupt the file. To work on several machines use the
  [built-in synchronisation](/en/sync/how-it-works).
- Do not rename files inside `allegati_manoscritti` by hand: records look for them under the name
  they had when they were attached.
:::

## What about personal data?

ArchiView works offline: if you do not enable synchronisation, nothing leaves your computer. What is
processed when you enable it is detailed in the
[Privacy Policy](https://archiview.web.app/privacy.html).
