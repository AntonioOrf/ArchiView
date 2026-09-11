# Document models

A **model** (or *document type*) is the list of fields that appear when you fill in a record. It is
the most important choice you make at the start: it defines the shape of your archive.

## Ready-made models

ArchiView includes three predefined models: **Notarial imbreviature**, **Judicial acts**,
**Tax documents**.

You can use them as they are, or **add** fields of your own. The original fields and the name stay
locked, because they are realigned at every start and a change would undo itself; everything you
add, on the other hand, is kept.

## Creating your own model

From the **model management** button in the bar above the list: there you create a new model by
choosing the fields you need.

The record form adapts automatically to the chosen model.

## The type of a field

Every field you invent can have a type, and the type changes the control shown in the form:

| Type | In the form | When to use it |
| --- | --- | --- |
| Text | One line | Shelfmarks, names, places |
| Long text | A text area | Summaries, notes, descriptions |
| Number | Numeric | Folios, files, amounts |
| Yes / No | Switch | Presence of a seal, existence of a copy |
| List | Drop-down | Writing support, state of preservation |
| Web address | Link | The permalink to the digital reproduction |
| Date | Text with feedback | Datings, see [Historical dates](/en/guide/historical-dates) |
| Dynamic list | Several repeatable entries | Parties, witnesses |

A field of type **list** can draw on a [controlled vocabulary](/en/guide/vocabularies) shared by
several models, instead of having a list of its own.

Two extra options on each field:

- **required**: blocks saving if left empty;
- **unique**: does not block, but warns when the value already exists in another record.

::: tip
An empty numeric field means "not filled in", not zero. An archive in which every field never
filled in counts as zero gives false totals.
:::

## How to design a good model

- **Fewer fields, better filled.** A field that always stays empty slows down the cataloguing of
  every record. Exceptional cases are what [record-specific fields](/en/guide/custom-fields) are
  for.
- **One field per piece of information.** "Place and date" together can never be sorted or
  filtered.
- **Think about searching.** The `field:value` syntax only works well if that information has a
  field of its own.
- **Give fields a type.** A number declared as such sorts as a number; left as text, it does not.

## Changing the model of a document already catalogued

This can be done afterwards too, and on many records at once with `Ctrl+Shift+T` (see
[Working on several records](/en/guide/multiple-records)).

::: warning
Changing the type of a record already filled in can leave homeless the values of fields the new
model does not provide for. Try it on a single record first, or make a backup: copying the working
folder is enough.
:::

## In a shared archive

Agree on the models **before** you start cataloguing: changing them halfway is possible, but
whoever has already worked will have to review their records.
