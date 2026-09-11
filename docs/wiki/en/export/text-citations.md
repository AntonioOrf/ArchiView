# Exporting transcriptions and citations

Two exports meant for people who **write**: the text of transcriptions to bring into an article,
and bibliographic citations to put into Zotero or LaTeX.

They are reached from the right-click menu of a record or folder, from the command palette and from
the export button inside the transcription environment.

## Five formats

| Format | What it is for |
| --- | --- |
| **HTML** | A standalone file that opens in the browser and can be sent to anyone |
| **Markdown** | Bringing the text into a modern editor, a website, a repository |
| **RTF** | Opening in Word or LibreOffice with formatting preserved |
| **BibTeX** | Citing in LaTeX |
| **RIS** | Importing into Zotero, Mendeley, EndNote |

![The export window with the choice of scope and of the five formats](/img/en/esporta-testo.png){.light-only}
![The export window with the choice of scope and of the five formats](/img/en/esporta-testo-scuro.png){.dark-only}

## What comes out

For transcriptions: the scope you choose (open record, selection, folder, filtered archive), with
folio headings.

A record **without** a transcription does not vanish from the file: it appears with its heading and
the note "No transcription". An export that silently drops three records out of twenty is worse
than an empty one.

## OCR uncertainty survives

Words flagged as uncertain by automatic recognition stay marked:

- in **Markdown** they become `[?]`, the philological convention for a doubtful reading;
- in **RTF** they keep the wavy underline;
- the provenance note ("this text comes from automatic recognition") is carried over.

This is deliberate: an OCR draft that leaves the program without saying so would become a falsely
authoritative transcription in someone else's article.

## Citations

BibTeX and RIS produce one entry per record, of type "manuscript", with fonds, author and date taken
from the headers set for printing: they are the same data, and a second copy would end up stating a
different fonds in the `.bib` file and on paper.

Two precautions already handled:

- the **title** is protected from the capitalisation rules of bibliographic styles, which would
  otherwise lowercase proper names;
- **citation keys** are deduplicated: two folios by the same notary in the same year exist, and
  without a suffix the second citation would point to the wrong document.

The year is extracted only if plausible: a register number will never end up as a year.

## Before exporting

The open transcription is saved automatically: the latest text you wrote is exported too, not the
previous version.
