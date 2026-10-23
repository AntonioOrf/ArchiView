## ArchiView 4.0.1 — More reliable Drive sync

### Fixes

- **Large archives with a full Drive**: attachment sync no longer crashes the program. A "Google Drive storage is full" message appears and the cloud status stays in error instead of "Synced".
- **Use another Google account**: the chosen account now stays with the archive even when its Drive folder changes, instead of falling back to the first account.
- **Personal backup on another account**: after switching account you get the list of archives on the new account's Drive, with a "Create a new backup on this account" button. The message no longer talks about a shared archive.
- Two attachment syncs no longer run at the same time.
