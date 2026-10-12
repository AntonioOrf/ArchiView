# Scanning with your phone

**ArchiScanner** is the Android companion app for ArchiView. In the archive you photograph the
leaves with your phone and pick the record they belong to; back home, the pages land in that
record on your computer as attachments. No moving or renaming files by hand.

The app also has a **Documenti** (Documents) section, a general scanner for things that don't
belong in the archive (receipts, photocopies, articles). Those stay on the phone and are shared
as PDFs.

::: info What you need
- An **Android** phone. There is no iPhone version and the app is not on the Play Store: you
  install it from the APK published with the
  [ArchiView releases](https://github.com/AntonioOrf/ArchiView/releases). Android will ask you
  to allow installs from that source.
- For the main channel, the same **Google account** ArchiView uses to sync with Drive. Without
  an account you can use [direct Wi-Fi](#direct-wi-fi-without-drive).
- The app's interface is in Italian only. This page gives each Italian label with its meaning.
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

## First run: choosing the archive

On first run the app asks for an archive. To see the list you need to sign in to Google
(**Impostazioni → Accedi con Google**, Settings → Sign in with Google).

![The archive drop-down: archives that go to the computer and, below, the Documents that stay on the phone](/img/telefono-tendina.png){.light-only .telefono}
![The archive drop-down: archives that go to the computer and, below, the Documents that stay on the phone](/img/telefono-tendina-scuro.png){.dark-only .telefono}

The list comes from two places:

- archives the computer has **published**: ArchiView does this every time you open the
  [«From the phone»](#from-the-phone) panel and it receives from Drive;
- archives **synced with Google Drive**, even with the computer switched off.

Archives shared through the Hub, or from another Google account, do not appear.

**Nuovo archivio** (New archive) creates one from the phone; you only give it a name. On its
next receive the computer offers **Create archive…**: choose where to put it on disk and the
pages go in.

The app remembers your choice. To change it, tap the archive name at the top.

## The archive on the phone

The main screen shows the folder tree, like the computer's sidebar, empty folders included.
Each record shows its shelfmark and, below it, the same secondary line you see on the computer
(the notary, the author, the title). Folders you open stay open next time.

![The archive on the phone: the «Da inviare» box, the search field and the folder tree with its records](/img/telefono-archivio.png){.light-only .telefono}
![The archive on the phone: the «Da inviare» box, the search field and the folder tree with its records](/img/telefono-archivio-scuro.png){.dark-only .telefono}

The search filters the tree by shelfmark, title or folder: only folders with a match remain,
already open. The dot next to a record says how many of its pages are still on the phone,
waiting to be sent.

## Scanning

The **+** button at the bottom offers two paths.

![The «+» menu open: a new record in the open folder, or a scan without a record](/img/telefono-piu.png){.light-only .telefono}
![The «+» menu open: a new record in the open folder, or a scan without a record](/img/telefono-piu-scuro.png){.dark-only .telefono}

**Nuova scheda** (New record) asks for a shelfmark and a note. The record is created in the
folder open in the tree, and **Cambia** (Change) picks another; new folders can only be created
on the computer. On the computer the record takes shape with the first upload, with that
shelfmark and note, and later scans go into the same record.

**Scannerizza senza scheda** (Scan without a record) opens the scanner straight away. The pages
reach the computer as items to sort: use it for loose leaves whose place you don't know yet. An
optional title and note help you recognise them later.

To add pages to a record that already exists, tap it in the tree and press the scanner button.

### The scanner

The scanner is Google's (ML Kit): it frames the page, crops it and corrects the perspective. You
scan one page after another, up to 100, and finish with **Salva** (Save). To keep the whole
photo, with margins and binding, drag the crop out to the edges during review.

### Numbering the leaves

![A record with pages waiting to be sent, numbered 1r, 1v, 2r](/img/telefono-scheda.png){.light-only .telefono}
![A record with pages waiting to be sent, numbered 1r, 1v, 2r](/img/telefono-scheda-scuro.png){.dark-only .telefono}

With **Numera le carte da** (Number the leaves from) switched on, each new page takes the next
label: 1r, 1v, 2r, 2v… starting from the one you type. Plain numbers (5, 6, 7) and prefixes
(«c. 009v» → «c. 010r») work too. If the volume skips a leaf, correct the label of the last page:
the next one carries on from there. On the computer the label becomes the attachment's name.

## Reviewing pages before sending

Tap a thumbnail to open the page full screen. Pinch or double-tap to zoom, swipe to move to the
others.

![The viewer: the page full screen, the leaf label and the commands](/img/telefono-visore.png){.light-only .telefono}
![The viewer: the page full screen, the leaf label and the commands](/img/telefono-visore-scuro.png){.dark-only .telefono}

- **Carta** (Leaf): the page label.
- **Ruota** (Rotate) by 90°.
- **Ritaglia** (Crop) with a straight frame; **Pagina intera** (Whole page) resets it to the
  edges.
- **Rifai** (Redo): reopens the scanner for that page only. The new photo replaces the old one
  and keeps its label.
- **Dividi** (Split): for a double page (an opening of the register). Move the line onto the
  fold and you get two pages, labelled for example 12v and 13r.
- **Elimina** (Delete).

Pages that have already left open read-only.

## Sending

The **Da inviare** (To send) box at the top of the archive counts the pages still on the phone.
Tap it to see them grouped by record.

![The «Da inviare» box open: pages waiting, grouped by record, and those without a record](/img/telefono-da-inviare.png){.light-only .telefono}
![The «Da inviare» box open: pages waiting, grouped by record, and those without a record](/img/telefono-da-inviare-scuro.png){.dark-only .telefono}

Automatic sending starts **only on Wi-Fi**, because a day in the archive can add up to a few
hundred megabytes. On mobile data the pages wait; if you need them now, use **Invia ora** (Send
now). The switch is in **Impostazioni → Invio** (Settings → Sending).

Sending only runs while the app is open. If Android closes it halfway, it picks up again from
the pages that had not arrived yet when you reopen it.

![The app settings: Google account, send only on Wi-Fi, what to do after sending, direct Wi-Fi](/img/telefono-impostazioni.png){.light-only .telefono}
![The app settings: Google account, send only on Wi-Fi, what to do after sending, direct Wi-Fi](/img/telefono-impostazioni-scuro.png){.dark-only .telefono}

**Dopo l'invio** (After sending) decides what stays on the phone: pages are deleted at once (the
default), kept for a number of days, or kept for good. Kept pages appear in the record as sent,
read-only, and can be removed by hand.

## On the computer: the «From the phone» panel {#from-the-phone}

### The notice when an archive opens

When you open an archive and there are scanned pages on Drive, ArchiView shows a single summary:
how many pages are for this archive, which records they go to, how many need sorting, and what
is waiting for other archives.

![The notice on opening: pages for this archive, pages to sort and pages for other archives](/img/en/scanner-avviso.png){.light-only}
![The notice on opening: pages for this archive, pages to sort and pages for other archives](/img/en/scanner-avviso-scuro.png){.dark-only}

**Import now** opens the panel and downloads. **Later** closes the notice, which only comes back
when something new arrives. With **Don't ask: always import on opening** that archive's pages
are always imported without a question.

The notice only appears if you have already signed in to Google on that computer for sync: the
check never opens a login window.

### The panel

Open the panel with the phone icon at the bottom of the sidebar. It checks Drive by itself when
it opens. It sits at the side, so the list of records stays usable while it is open.

![The «From the phone» panel: pages just imported, a batch to sort and new archives created on the phone](/img/en/dal-telefono.png){.light-only}
![The «From the phone» panel: pages just imported, a batch to sort and new archives created on the phone](/img/en/dal-telefono-scuro.png){.dark-only}

**Just imported** lists the records that have just received pages, with **Open**. Pages whose
record was chosen on the phone need nothing from you: they go in by themselves. In the sidebar
the record shows **+N** next to its name until you close the app.

**To sort** collects the scans without a record, with title, note and thumbnails. For each
batch:

- search for the record in the field and press **Add**;
- or **New record**: shelfmark and notes come from the title and note written on the phone, and
  the record opens for you to complete;
- or **Discard**, after a confirmation. Discarded photos cannot be recovered.

**For other archives** shows pages meant for archives other than the open one. They stay on
Drive until you open that archive (**Open archive**) or, if it is new, until you create it
(**Create archive…**).

ArchiView removes pages from Drive only after downloading and checking them. Scans the phone is
still uploading are left alone and arrive with the next receive.

### Options

In **Settings → Documents → Scans from the phone**:

- **Merge the pages of each scan into a single PDF**: the record gets one PDF instead of an
  image per page;
- **Import without asking when the archive opens**: the same choice as «Don't ask».

## Direct Wi-Fi, without Drive

If you don't want to use a Google account, or there is no network in the archive, the phone can
send pages straight to the computer, as long as both are on the same Wi-Fi network.

1. On the computer, in the «From the phone» panel, press **Receive over Wi-Fi, without
   Drive…**: a QR code appears.
2. On the phone, in **Impostazioni → Wi-Fi diretto** (Settings → Direct Wi-Fi), press **Abbina
   col computer** (Pair with the computer) and frame the code.
3. Press **Invia via Wi-Fi** (Send over Wi-Fi): the waiting pages move to the computer.

The computer only listens while the panel is open. The first time, Windows asks for firewall
permission, which you need to grant. If the computer has a different archive open from the one
chosen on the phone, the app warns that those pages would be refused.

## Documents: the scanner for everything else

From the archive drop-down, under **Solo su questo telefono** (Only on this phone), open
**Documenti**. No account or archive is needed here, and nothing goes to the computer.

![Documents: search, folders and documents outside folders](/img/telefono-documenti.png){.light-only .telefono}
![Documents: search, folders and documents outside folders](/img/telefono-documenti-scuro.png){.dark-only .telefono}

The scanner button creates a document in the open folder, with an automatic name
(«Documento 9 ott 18:05») that you can change with the pencil. Folders have a single level.
Inside a document the same button adds pages; to reorder them, press and hold a page and drag
it. Search finds documents by name and by recognised text.

### Filters

In the viewer, **Filtri** (Filters) offers **Originale** (Original), **Migliora** (Enhance),
**Grigi** (Greyscale) and **B/N** (Black and white). **Usa per tutte** (Use for all) applies the
choice to every page of the document.

![The «Migliora» filter applied to a page, with the other choices below the photo](/img/telefono-filtri.png){.light-only .telefono}
![The «Migliora» filter applied to a page, with the other choices below the photo](/img/telefono-filtri-scuro.png){.dark-only .telefono}

The original photo stays on the phone: **Originale** brings it back at any time, and Rotate and
Crop always start from it.

### Text

**Testo** (Text) recognises the words on the page, on the phone and without a connection. You
can correct the result in the box (the correction stays with the document) and copy it with
**Copia testo** (Copy text), or **Tutte le pagine** (All pages) for the whole document.

![The recognised text of a page, editable, with «Copia testo» and «Tutte le pagine»](/img/telefono-testo.png){.light-only .telefono}
![The recognised text of a page, editable, with «Copia testo» and «Tutte le pagine»](/img/telefono-testo-scuro.png){.dark-only .telefono}

Recognition is built for modern print in the Latin alphabet. On a nineteenth-century edition like
the one in the picture it reads the words but mangles quite a few («Gallorun», «Frnncorum»), so
check it before copying. On handwriting it is of little use.

### Sharing or saving

**Condividi o salva** (Share or save) prepares the document as a **PDF** (one file with all the
pages) or as **JPEG images**.

![The «Condividi o salva» sheet: PDF or JPEG, searchable text in the PDF, Share and Save to Download](/img/telefono-condividi.png){.light-only .telefono}
![The «Condividi o salva» sheet: PDF or JPEG, searchable text in the PDF, Share and Save to Download](/img/telefono-condividi-scuro.png){.dark-only .telefono}

- With **Testo cercabile nel PDF** (Searchable text in the PDF) on, the PDF carries the
  recognised text under the images, so any reader can search and copy it. Pages not yet
  recognised are read before the file is created.
- **Condividi…** (Share…) opens Android's share menu (Gmail, Drive…).
- **Salva in Download** (Save to Download) writes the file to a folder on the phone. The first
  time, Android asks which one: create a folder inside «Download» (for example «Scans») and pick
  it, because Android does not allow «Download» itself. From then on the app remembers it.

::: warning Limits of the searchable PDF
The hidden text in the PDF is what recognition read, not what you corrected by hand. Letters
outside the Western European alphabet (Polish, Greek, Cyrillic…) become «?» in it.
:::

## If something doesn't add up

**The archive does not appear on the phone.** Open the «From the phone» panel on the computer:
receiving also publishes the list of archives and records. Archives shared through the Hub do
not appear in any case.

**A record created on the computer is missing on the phone.** The phone's list updates when the
computer receives from Drive. Open the panel, then reopen the archive on the phone.

**Pages are not leaving.** Check that you are signed in to Google. On mobile data, with
Wi-Fi-only sending, pages wait: use **Invia ora**.

**The computer does not find the pages.** Open on the computer the archive chosen on the phone:
pages for other archives stay on Drive and show up under «For other archives».
