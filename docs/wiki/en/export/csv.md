# Exporting to CSV or Excel

CSV/TSV export is for working on record **data** outside the program: a spreadsheet, a chart, a
statistical analysis, a list to hand over.

It is in the "⋯" menu above the list, in the right-click menu of a record or folder, and in the
command palette (`Ctrl+K`, "csv" or "excel").

## What the file contains

One row per record. The columns are:

1. eight fixed columns: shelfmark, document type, folder, tags, attachments, modification date,
   modified by, created by;
2. every field of the models present among the exported records;
3. the internal identifier, as the **last** column (it is an unreadable code: at the front it would
   push the shelfmark off screen).

Yes/no fields are exported as words ("Yes" and "No", in the interface language), not as
`true`/`false`, which are not readable in a spreadsheet cell.

## CSV or TSV?

| Format | When |
| --- | --- |
| **CSV** | Opening the file with Excel or LibreOffice |
| **TSV** | Reading it with analysis tools (R, pandas), or when cells contain commas and semicolons |

## Excel with regional settings: two precautions already included

The exported file contains two invisible details that avoid the two classic problems:

- an encoding marker that stops Excel from turning medieval diacritics into garbled characters;
- a technical first line (`sep=,`) telling Excel which separator is used. Without it, with regional
  settings that use the semicolon (such as Italian), the whole row ends up in the first cell.

If you read the file with analysis tools, skip that first line or use TSV, which does not need it.

::: tip Security
Cells starting with `=`, `+`, `@` or `-` are neutralised with an apostrophe: otherwise Excel would
interpret them as formulas. When the file is reimported into ArchiView the apostrophe is removed,
so an export and import round trip does not alter shelfmarks.
:::

## The round trip works

An archive exported to CSV can be **reimported** into ArchiView without loss: columns are
recognised, and so are document types. See [Importing from CSV](/en/export/csv-import).

This is a deliberate guarantee: an export that cannot come back in is not an open format, it is a
dead end.
