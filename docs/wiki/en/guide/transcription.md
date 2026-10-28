# Transcription

The **Transcribe** button on a record opens the dedicated environment: the image (or PDF) of the
document on the left, the text editor on the right.

![The transcription environment: document folio on the left, text with line numbers on the right](/img/en/trascrizione.png){.light-only}
![The transcription environment: document folio on the left, text with line numbers on the right](/img/en/trascrizione-scuro.png){.dark-only}

At the top, the **Source | Side by side | Text** switch chooses what you see: only the folio, both
columns, or only the text at full width. If the record has no attachments, only the text is shown.

## One transcription per folio

The text belongs to the **folio** you are looking at, not to the whole record: when you change
attachment, the editor follows. At the top an indication such as "Folio 2 of 3" appears, with the
file name.

`Alt+←` and `Alt+→` move from one folio to the next, and each folio keeps its own text: before
every change of folio the app stores what you have just written.

If the record has no attachments, you write a single transcription, as always.

Next to the folio indicator, a menu sets its **status**: To transcribe, Transcribed, Reviewed,
Doubtful. It is there even when the record has a single folio. In the table view the
**Transcription** column sums up the folios' statuses, and a click on its header sorts the records
from least to most advanced; a second click reverses the order.

## PDFs, one page at a time

A PDF opens in the same viewer as images, with zoom, rotation and filters, and is browsed **page by
page**: the arrows and the page number in the viewer bar, or `Page Up` and `Page Down`. After the
last page you carry on to the next attachment.

The transcription is **per page** too: every page of the PDF has its own text, and the indication at
the top tells you which page you are working on ("p. 3 of 12"). When the text leaves the program
(printing, export), the pages are joined in order, each preceded by its `[p. N]` marker.

The **Search the PDF** field finds a word in the PDF's own text (if it has one) or in your
transcription, and takes you to the right page. Even a facsimile of hundreds of pages opens at once:
the file is read a piece at a time, not loaded whole.

## The viewer

It has all the commands described in [Attachments](/en/guide/attachments): zoom, panning, rotation,
fit to page, and above all **brightness, contrast and negative** for difficult hands. `Alt+F`
switches between "Side by side" and "Source": the folio takes all the space.

## The editor

It is a text editor: the toolbar offers the formatting needed to mark up the text where required.
**Save often with `Ctrl+S`**: it is the most useful shortcut in the program.

Every line has its **number** in the margin, and a bar at the bottom shows the current line, the
number of lines and the word count.

The philological toolbar applies Leiden signs to the selection:

| Button | With a selection | Without a selection |
| --- | --- | --- |
| **[gap]** | puts it in square brackets: `[sel]` | inserts `[...]` |
| **(expansion)** | expanded abbreviation in round brackets: `(sel)` | inserts `()` with the cursor inside |
| **sic (!)** | flags the reading: `sel (!)` | — |

When you paste from Word or a web page, paragraphs, bold, italic, underline and lists are kept;
styles, colours and images are dropped.

The export button takes the text out of the program in five formats: see
[Exporting transcriptions and citations](/en/export/text-citations).

## The record next to the document

Above the editor there are two tabs, **Text** and **Record**. "Record" shows the full record form
in place of the text, with the folio always beside it: you fill in date, material and
dimensions while looking at the document. The record saves by itself after a short pause, and
"Saved at…" appears next to the tabs. `Ctrl+Shift+S` switches between the two tabs.

It also works the other way round: while editing a record, the **Document** button shows the folio
next to the form, with "Image | Transcription" to read the text already transcribed.

The bar between the two columns can be dragged, adjusted with the `←` `→` arrows once selected, and
reset to half with a double-click; it snaps to one third, half and two thirds. "Text" and "Record"
remember different proportions.

### In a separate window

With two monitors, the **Open in a separate window** button moves the record (or the document) into
its own window. To put it back: **Dock back**, closing the window, or dragging it over the left
column until "Release to dock" appears. Both windows work on the same record: what you write in one
is not lost in the other.

## Transcribed text is searchable

Everything you write goes into the global search: looking for a formula or a name inside
transcriptions works just like looking for it in the metadata.

The "has transcription" filter separates what is done from what is still to do in a single click.

## Starting from an automatic draft

On later or printed scripts, [OCR](/en/guide/ocr) can produce a first draft to correct, with
uncertain words already flagged. On a fourteenth-century notarial minuscule, it cannot: evaluate it
on three or four sample folios first.

## Recommended working method

1. **Records first, transcriptions later.** Cataloguing a whole fonds in one pass (shelfmarks,
   dates, short summaries) gives you a searchable archive immediately; transcriptions are added
   over time.
2. **Use a tag for status**: `to transcribe`, `partial transcription`, `to collate`. Filtering by
   tag you always know what is missing.
3. **Mark doubts with a consistent convention** (for example `[?]`): you will be able to find them
   all again with the search.
