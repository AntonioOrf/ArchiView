# Frequently asked questions

## Is ArchiView free?

Yes, and it is open source under the MIT licence: you can use, copy and modify it freely, for work
too. There are no subscriptions or paid features.

## Do I need an internet connection?

No. ArchiView is designed to work offline, even in a reading room without a network. The internet is
needed only if you enable synchronisation or download an update.

## Windows says the file is not safe. Is it a virus?

No. It is the warning Windows shows for every program not signed with a commercial certificate. See
[Installation](/en/getting-started/installation#windows-protected-your-pc).

## Do my documents end up on a server?

Only if you enable synchronisation yourself. In local mode, which is the default, data stays on your
disk and nobody can access it.

## Can two people work on the same archive?

Yes, with a **shared archive**: see [Synchronisation](/en/sync/how-it-works). If two people edit the
same record, the program shows both versions and lets you choose.

## Can I use ArchiView on two computers without collaborating with anyone?

Yes, in two ways: by converting the archive to **personal** (synchronised, with automatic backup), or
by copying the working folder by hand from one machine to the other, provided you never work on both
at the same time.

## I deleted a record by mistake.

`Ctrl+Z` straight away undoes it. Later on, you will find it in the **trash**, where deleted records
stay for 30 days: see [Trash, snapshots and history](/en/data/trash-snapshots). If the trash has
already been emptied, local snapshots remain and, for synchronised archives, the
[History](/en/sync/versions).

## Can I change the fields of a model after cataloguing hundreds of documents?

Yes, models can be changed at any time. Make a backup first, though: see
[Document models](/en/guide/models).

## How many records can an archive hold?

There is no fixed limit. On very large archives it is better to use filters and saved searches
instead of scrolling the list, and table view instead of the grid.

## Can I print or export a record?

Yes: export entries are in the right-click menu on archive items and in the commands above the list.
See [Backup, export and transfer](/en/data/backup-export).

## How do I change the language?

From the settings. The interface is available in Italian and English.

## Can I add a field to a single record only?

Yes: these are [record-specific fields](/en/guide/custom-fields). The model stays clean and the record
carries its exceptional case. If you later find you always need it, you promote it to the model.

## Does the program recognise the text in scans?

Yes, with [OCR](/en/guide/ocr), which runs on your computer. It works well on print and on later,
regular hands; on a fourteenth-century notarial minuscule it does not. It is mainly for **finding**
the right folio, not for replacing transcription.

## How do I put records in chronological order?

Just write dates as you would in a calendar (`c. 1340`, `ante 1350`, `sec. XIV in.`): ArchiView
interprets them and sorts them chronologically. See [Historical dates](/en/guide/historical-dates).

## I wrote the same name in three different ways. Do I have to fix every record?

No. The [authority list of people and places](/en/guide/links) unifies spellings in a single
operation. For tags there is tag management, with rename and merge.

## Can I import my list from Excel?

Yes, with a preview telling you row by row what will be added. See
[Importing from CSV](/en/export/csv-import). The import can be undone with `Ctrl+Z`.

## Can I cite records in Zotero or LaTeX?

Yes: the export also produces BibTeX and RIS. See
[Transcriptions and citations](/en/export/text-citations).

## Who can see my shared archive?

Only the people you invited, and you can revoke each of them individually. Attachments travel
encrypted. See [Sharing with others](/en/sync/sharing).

## What is the difference between "archive" and "folder"?

The **archive** is the complete container you choose from the switcher at the bottom left; **folders**
are the internal subdivisions of an archive. See [Folders and archives](/en/guide/folders-archives).

## I found a problem, or I would like a feature that does not exist.

Open a report in the [GitHub issues](https://github.com/AntonioOrf/ArchiView/issues): it is the right
channel for both bugs and proposals.
