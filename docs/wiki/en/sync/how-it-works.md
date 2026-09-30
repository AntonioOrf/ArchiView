# Synchronisation: how it works

ArchiView works perfectly well **without** any internet connection, and that is the default mode.
Synchronisation is useful if you want to:

- work on the same archive from several computers;
- collaborate with other people;
- keep a safety copy outside your own disk.

## The three modes of an archive

| Mode | What it is | For whom |
| --- | --- | --- |
| **Local** | Everything on your disk, no connection | Default. Entirely adequate for individual work |
| **Personal** | Connected to your cloud space, for backup only | Working alone on two computers, or wanting a remote copy |
| **Shared** | On a common server, with several people | A research group, a multi-author project |

A local archive stays local until you convert it. Conversion is done from the sharing button at the
bottom left.

## The shared archive

Collaboration goes through a **common server** (the Hub): each participant keeps a complete copy on
their own computer and keeps working offline; when the network is available, changes are exchanged.

Whoever creates the archive is its **owner**: they generate invitations and can revoke anyone's
access. The others are **members**: they receive, send, and can leave. See
[Sharing with others](/en/sync/sharing).

Everything travels and is stored **encrypted**: records, transcriptions, the archive's name and the
attachments. The server keeps the data but cannot read it, and cannot even pass off an old version of
the archive as the current one.

When a colleague sends changes, the other members are **notified straight away**, even on different
computers: you do not need to check by hand to know there is something new.

## The status, at the top right

A single line always summarises the situation:

- **synchronised**: local and remote match;
- **incoming updates**: someone has uploaded changes you do not have yet;
- **local changes to send**: you have worked and have not uploaded yet.

Clicking it opens the commands: **check** (asks whether there is anything new, without downloading
or sending), **download**, **upload**, and the link to Change control.

## Habits that prevent problems

1. **Download before you start** working.
2. **Upload when you finish** a session, not once a month: the longer parallel changes accumulate,
   the more conflicts there will be to resolve.
3. In a group, agree on who works on which fonds. Conflicts are easier to avoid than to resolve.

If two people edit the same record, the program never overwrites anything silently: see
[When two edits collide](/en/sync/conflicts).

## Google Drive

Earlier versions used Google Drive for shared archives. That route still works for **personal
backup** and for existing shared archives, which can be migrated to the Hub with a dedicated command
(Advanced options in the cloud window). After migrating, collaborators have to be invited again:
Google Drive permissions cannot be transferred.

An archive on Google Drive does not receive instant notifications: it checks for news by itself
**every 5 minutes**.

New shared archives are created on the Hub only: it is faster, does not require each collaborator to
have a Google account, and makes revoking access truly effective.

::: info OneDrive
Since version 3.2.0 the OneDrive connection no longer exists. An archive still connected to it goes
back to **local**: the data stays on disk, and saved Microsoft sign-ins are deleted. To synchronise
it again, convert it into a shared archive on the Hub.
:::

::: tip Privacy
In local mode no data leaves the computer. What is processed when you enable synchronisation is
detailed in the [Privacy Policy](https://archiview.web.app/privacy.html).
:::
