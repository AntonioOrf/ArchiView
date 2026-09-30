# When two edits collide

It happens in every shared archive: you and a colleague touch the same record before
synchronising. ArchiView does not choose for you and never overwrites silently.

## First: most cases are not conflicts

If you changed **different fields** of the same record, the two changes combine by themselves, field
by field. No window, no decision to make: it is the most frequent case and it is handled without
disturbing you.

A real conflict only exists when two people changed **the same field** in different ways.

## The resolution window

It shows the disputed field with the two versions side by side, yours and your colleague's, and lets
you choose which to keep, **one decision per field**.

The starting point is already the **merged** record, with every non-conflicting change already
incorporated: choosing for one field does not lose the other person's work on the remaining fields.

To choose, click anywhere on the version you want to keep, **Your Change (Local)** or **Cloud Change
(Server)**. With the keyboard: `Tab` to move between them, `Enter` or `Space` to choose.

### When the program cannot tell what changed

To work out who changed what, the program compares both versions with the last one downloaded from the
server. If that reference point is missing (a computer's first connection, a very old archive), every
difference between your record and the server's opens the conflict window: the program would rather
ask you one more question than take a wrong decision.

If sending your changes fails (no network, server error), your local work stays as it is and goes out
at the next synchronisation.

## Deletions

If someone deleted from the server a record you still have in your archive, the program tells you
instead of letting your work vanish without warning. For each record you choose whether to **keep**
your local copy or **delete** it from your archive too, then confirm your choices; cancelling the
download postpones the decision.

## How to reduce their number

1. **Download before you start.** A conflict almost always stems from a local copy stuck at
   yesterday.
2. **Upload often.** Changes accumulated over weeks are conflicts waiting to happen.
3. **Divide the work** by fonds or by series, not by field.
4. If you know two of you have to work on the same document, agree on it in advance: it is quicker
   than resolving the conflict afterwards.

## If you chose the wrong version

`Ctrl+Z` straight away. If you notice later, the record has a
[history](/en/data/trash-snapshots#_4-record-history) from which to recover the previous version, and
the archive has [local snapshots](/en/data/trash-snapshots).
