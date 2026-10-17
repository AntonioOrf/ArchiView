## ArchiView 3.4.1 — Lighter, and safer with your data

A bug-fix release: no big new features, and many fixes for cases where data could be lost without warning.

### New

- **Lighter install**: the installer goes from 151 to 115 MB, the installed program from 574 to 369 MB.
- **Attachment folder per archive**: a custom attachment folder now belongs to the archive, not to the whole program. If you had already chosen one, it is kept for the open archive and for your recent archives. The ZIP backup also includes the attachments stored in that folder.
- **Twenty recent archives** instead of five: they all stay available to cross-archive search and links.
- **Pasting from Word or the web** keeps only paragraphs, bold, italic, underline and lists; styles, colours and pasted images are dropped.

### Fixes

- **Document types, vocabularies, tags and people/places** are now merged three-way, like records: a field added to a document type on one PC no longer disappears on sync, and a removed value no longer comes back.
- **Attachments with the same name** (e.g. `IMG_0001.jpg` from two folders) no longer overwrite each other: the second one gets a free name (`_2`, `_3`). The same applies to ZIP import when the content differs.
- **Google Drive attachments**: they now really sync even if the option was never touched; an interrupted download no longer leaves a truncated file that was never downloaded again.
- **A moved or renamed archive** finds its shared Hub connection again.
- **A failed save after a sync** no longer overwrites your colleagues' changes; delete confirmations during a sync now wait for your answer.
- **"Exit without saving"** in the transcription really discards the text of every sheet.
- **Orphaned attachment cleanup**: files go to the Windows (or Drive) recycle bin instead of being deleted for good; a file you have just attached is left alone.
- **Undoing a CSV or IIIF import, or a copy from another archive** no longer brings the records back on the next sync.
- **The X on the welcome screen** closes the program.
- **An `archiview://` invite** opened while the program is closed goes straight to joining the archive.
- **Google sign-in left halfway**: after 5 minutes a message appears and you can try again right away.
- The OCR text, links and sheet status filters are remembered after a restart; Recycle bin, Vocabularies, Tags and Graph appear in the palette (Ctrl+K) even with no record selected.
- Key-value lists whose field name has spaces, undoing a deletion that lost links, copied folders missing from the tree: fixed.
- Security: Drive identifiers are validated, the sign-in log has no email address and no longer sits in the archive folder, CSV export also neutralises formulas starting with `-`, OCR language downloads have a size and time limit.
