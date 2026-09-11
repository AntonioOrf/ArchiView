# Historical dates

Dates in archival documents are not calendar dates: they are `c. 1340`, `ante 1350`,
`sec. XIV in.`, `1340-45`, `s.d.`. ArchiView **interprets** them, without ever rewriting them, and
derives chronological sorting and period filtering from that interpretation.

## How to write a date

Write it as you would in a calendar or summary. The program recognises the Italian and Latin
archival conventions it was built for:

| Form | Examples |
| --- | --- |
| Full date | `12 maggio 1340`, `1340 maggio 12`, `12/05/1340`, Latin month names included |
| Year only | `1340` |
| Month and year | `maggio 1340` |
| Approximation | `c. 1340`, `ca. 1340`, `circa 1340`, `verso il 1340`, `intorno al 1340` |
| Terminus ante quem | `ante 1350`, `prima del 1350` |
| Terminus post quem | `post 1330`, `dopo il 1330` |
| Range | `1340-1345`, `1340-45`, `tra il 1340 e il 1345` |
| Century | `sec. XIV`, `sec. XIV in.`, `sec. XIV ex.`, `sec. XIV med.`, first and second half |
| Undated | `s.d.` |

Below the field, as you type, the program states **how it read** what you wrote. It is the most
useful part of the feature: you check straight away whether sorting will place the record where you
expect.

![The Chronic Date field with the interpretation feedback underneath](/img/en/form-scheda.png){.light-only}
![The Chronic Date field with the interpretation feedback underneath](/img/en/form-scheda-scuro.png){.dark-only}

## What is not recognised

It is not guessed. A dating the program does not understand stays plain text: it takes no part in
chronological sorting (it goes **to the end**, in both directions) and does not answer period
filters.

This is deliberate: an invented range would enter sorting as if it were certain data. If you need
a dating to be sortable and the program does not recognise it, rephrase it in one of the forms
above.

## Sorting chronologically

In the list you can sort by the date field: records are arranged in true chronological order, not
alphabetical. Without this interpretation "12 maggio 1340" would come before "3 aprile 1290",
because 1 comes before 3.

Datings with only an *ante* term are sorted on their **end**, since they have no beginning:
otherwise they would sit at the top of the archive together with the oldest documents.

## Filtering by period

In the advanced filters you can ask for a range of years or a century.

The criterion is **overlap**, not containment: when searching the fourteenth century, a record
dated `1290-1310` **does appear**. Excluding it would hide precisely the documents that straddle
the boundary, which are usually the ones you are looking for.

::: tip Two different filters, not to be confused
**Document period** = when the document was written.
**Modification date** = when you last touched the record.
They are two distinct filters, with different icons and headings.
:::

## Details worth knowing

- `circa` **does not widen** the range by five years: it is a declared uncertainty, not a quantity
  nobody wrote.
- The interpretation **is not saved** in the record: the database keeps the text you typed. If
  recognition improves in a future version, your records will benefit without you having to
  correct them.
- A document type with no date field never appears in the results of a period filter: showing it
  would amount to claiming that the record is from the fourteenth century without knowing it.
