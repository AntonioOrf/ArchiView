# Importing from IIIF

Almost every library that digitises medieval codices — BnF/Gallica, e-codices, the Vatican Library,
the British Library, the Bodleian — publishes a **IIIF manifest** for each manuscript: an address
that describes the sequence of folios and from which the images can be obtained at any resolution.
That address is all ArchiView needs to give you a record with every folio in order, already
labelled, without downloading anything.

## Where to find the manifest

On the library's website, on the manuscript's page, look for the IIIF logo (a coloured "i") or an
item such as *Manifest*, *IIIF Manifest*, *Share → IIIF*. The address often ends in
`manifest.json` or `/manifest`.

::: tip
If ArchiView replies that the address "does not return a manifest", you have probably copied the
address of the manuscript's web page rather than that of its manifest. If it says it is a
**collection**, you have copied the list of a whole fonds: open the single manuscript and copy its own.
:::

## Creating a record from a manifest

1. "⋯" menu above the list → **Import** → **Import from IIIF**.
2. Paste the address and press **Read**. The title, the number of folios and, below, the attribution
   and licence declared by the library appear.
3. Choose the **pages to import**. A manifest almost always contains more than the text: boards,
   spine, flyleaves, the colour chart. You can tick them one by one, use **All** and **None**, or
   type a range such as `1-10, 25, 40-60`.
4. Check the **shelfmark** (suggested from the manifest's title), **model** and **folder**.
5. Press **Import**.

The record is created with the folios already in sequence and with the names the library gives
them (for example "f. 1r", "f. 1v"), and is transcribed like any other. The whole import can be
undone with `Ctrl+Z`.

## Adding folios to an existing record

In the transcription environment, the **Add from IIIF** button opens the same window, without the
new-record fields: the chosen folios are appended to those already there. Useful, for example, when
the same document is split across two shelfmarks.

## The folios stay at the library

Folios imported from IIIF **take up no space** in the archive and do not weigh down
synchronisation: they stay on the library's server and are shown on the fly. In the viewer they
behave like any other: zoom, rotation, filters, one transcription per folio.

Folios you have already looked at remain available **offline too**, in a temporary store on your
computer (up to 2 GB; the least used are removed first). That store is not part of the archive and
is not synchronised.

## Downloading folios into the archive

Some things need the real file: [OCR](/en/guide/ocr), high-quality printing, reliable offline work,
long-term preservation. In the viewer bar, on a remote folio:

- **Download this page into the archive**;
- **Download every page into the archive**.

The **download resolution** is chosen in the import window: 1200, 2000 (default) or 4000 pixels on
the long side, or the largest available. Some manifests only publish fixed-size images, and in that
case the choice is ignored (the program tells you).

Once downloaded, the folio becomes an attachment like any other.

## Licence and attribution

The images belong to the library that publishes them. ArchiView keeps the **attribution** and
**licence** declared in the manifest in the record: bear them in mind when you publish or share the
reproductions.

## If a folio does not show

"Page unavailable" means the library's server did not return it: it may be temporarily unreachable,
or you are offline and that folio has never been viewed. Try again later, or download it into the
archive while you have a connection.

::: details Technical details
IIIF Presentation 2 and 3 and IIIF Image API 2 and 3 are supported, as are multilingual labels,
alternative images of the same folio (for example visible and ultraviolet light) and manifests
without an image service.
:::
