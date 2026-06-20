# ArchiView - Codemap Architetturale Dettagliato

Questa è una mappa completa dell'architettura di ArchiView, che documenta dove si trovano le funzioni principali per OAuth, API Cloud, IPC/Preload e logica DOM frontend.

---

## 📋 Indice

1. [Struttura Cartelle](#struttura-cartelle)
2. [Flusso OAuth e Autenticazione Cloud](#flusso-oauth-e-autenticazione-cloud)
3. [Gestione API Google Drive](#gestione-api-google-drive)
4. [Gestione Microsoft OneDrive/Graph](#gestione-microsoft-onedrive-graph)
5. [Setup Preload e IPC](#setup-preload-e-ipc)
6. [Logica DOM Frontend](#logica-dom-frontend)
7. [Flussi Critici](#flussi-critici)

---

## 📁 Struttura Cartelle

```
ArchiView/
├── src/
│   ├── main/                          # Main Process (Electron)
│   │   ├── main.ts                    # Entry point app, setup IPC handlers
│   │   ├── preload.ts                 # contextBridge: espone API al renderer
│   │   ├── workspaceManager.ts        # Gestione workspace, settings, state
│   │   ├── chunkingLogic.ts/.js       # Chunking per upload/download
│   │   └── ipc/                       # IPC handlers
│   │       ├── cloudCredentials.ts    # Credenziali OAuth2 (Google + MS)
│   │       ├── drive/                 # **Google Drive - Modulo Refactorizzato**
│   │       │   ├── index.ts           # Entry point + setupDriveIpc (tutti gli ipcMain.handle)
│   │       │   ├── auth.ts            # OAuth2 flow, token storage, driveState condiviso
│   │       │   ├── fileOps.ts         # Primitivi Drive API (getOrCreateFolder, upload, download, asyncPool)
│   │       │   ├── vaultOps.ts        # Operazioni vault (pull, sync, list, checkUpdates, cleanOrphans)
│   │       │   ├── attachments.ts     # Sync bidirezionale allegati con chunking
│   │       │   ├── revisions.ts       # Storico versioni (list, get, restore)
│   │       │   └── sharing.ts         # Inviti, condivisione, permessi, picker esterno
│   │       ├── msSync.ts              # Microsoft OneDrive OAuth2 + sync
│   │       ├── databaseIpc.ts         # IPC read/write database
│   │       ├── attachmentsIpc.ts      # IPC gestione allegati
│   │       ├── settingsIpc.ts         # IPC impostazioni
│   │       ├── workspaceIpc.ts        # IPC workspace
│   │       ├── exportImportIpc.ts     # IPC export/import ZIP
│   │       └── updaterIpc.ts          # IPC auto-updater
│   │
│   └── renderer/                      # Renderer Process (Browser)
│       ├── index.html                 # HTML base
│       ├── js/
│       │   ├── app.ts                 # Entry point, bootstrap app
│       │   ├── state.ts               # State global (realtime, UI)
│       │   ├── store.ts               # Data store (cache locale)
│       │   │
│       │   ├── components/            # UI Components
│       │   │   ├── modals/            # Modal dialogs
│       │   │   │   ├── cloudModal.ts           # Cloud setup UI
│       │   │   │   ├── settingsModal.ts        # Impostazioni
│       │   │   │   ├── welcomeModal.ts         # Welcome onboarding
│       │   │   │   ├── changelogModal.ts       # Changelog viewer
│       │   │   │   ├── diffModal.ts            # Visualizza diff merge
│       │   │   │   ├── deletionConflictModal.ts # Risolvi conflitti
│       │   │   │   ├── mergeConflictModal.ts  # Risolvi merge
│       │   │   │   └── [altri modali]         # Delete, rename, etc.
│       │   │   │
│       │   │   ├── views/             # View principali
│       │   │   │   ├── viewList.ts           # Elenco manoscritti
│       │   │   │   ├── viewAdd.ts            # Form aggiunta
│       │   │   │   └── viewTrascrizione.ts   # Editor trascrizione
│       │   │   │
│       │   │   ├── mainView.ts        # Container UI principale
│       │   │   ├── sidebar.ts         # Menu laterale
│       │   │   ├── form.ts            # Form utilities
│       │   │   ├── banners.ts         # Notifiche a banner
│       │   │   ├── toasts.ts          # Toast notifications
│       │   │   └── [altri components] # History, tutorial, etc.
│       │   │
│       │   ├── logic/                 # Business Logic
│       │   │   ├── driveLogic.ts           # Frontend Google Drive
│       │   │   ├── realtimeLogic.ts        # Pusher realtime
│       │   │   ├── itemsLogic.ts           # Logica manoscritti
│       │   │   ├── foldersLogic.ts         # Logica cartelle
│       │   │   ├── attachmentsLogic.ts     # Logica allegati
│       │   │   ├── settingsLogic.ts        # Logica impostazioni
│       │   │   ├── diffMergeLogic.ts       # Diff e merge
│       │   │   ├── typesLogic.ts           # Logica tipi documento
│       │   │   ├── hubLogic.ts             # Hub sharing
│       │   │   ├── i18n.ts                 # Lingua/i18n
│       │   │   └── utils.ts                # Utility functions
│       │   │
│       │   ├── theme-init.ts          # Tema chiaro/scuro
│       │   ├── i18n.ts                # Caricamento traduzioni
│       │   └── locales/               # Traduzioni
│       │       ├── en/messages.po/.js
│       │       └── it/messages.po/.js
│       │
│       ├── css/
│       │   ├── input.css              # Input Tailwind
│       │   ├── style.css              # CSS custom
│       │   └── tailwind.css           # Output Tailwind compilato
│       │
│       ├── html/
│       │   ├── header.html
│       │   ├── sidebar.html
│       │   └── toasts-bars.html
│       │
│       └── vendor/
│           ├── driver.js.iife.js      # Driver per tutorial
│           ├── lucide.min.js          # Icons
│           └── purify.min.js          # DOMPurify (sicurezza XSS)
```

---

## 🔐 Flusso OAuth e Autenticazione Cloud

### 1. **Credenziali e Configurazione**

**File:** `src/main/ipc/cloudCredentials.ts`
- Contiene costanti OAuth2:
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - `MS_CLIENT_ID`
  - `GOOGLE_API_KEY`
  - `PUSHER_KEY` / `PUSHER_CLUSTER` (per real-time sync)
- Questa è una **configurazione sensibile**, caricata dal file template

---

### 2. **Google Drive OAuth2 Flow**

**Principale:** `src/main/ipc/driveSync.ts`

#### Funzioni Critiche:

| Funzione | Linea Aprox. | Descrizione |
|----------|------------|-------------|
| `initGoogle()` | ~68-90 | Inizializza `OAuth2Client` con credenziali |
| `setupLocalServer()` | ~150-200 | Server HTTP localhost:3456 per redirect OAuth |
| `handleOAuth2Callback()` | ~200-250 | Gestisce redirect URL da Google (con auth code) |
| `getAuthUrl()` | ~250-280 | Genera URL autorizzazione Google |
| `requestAccessToken()` | ~280-320 | Exchange auth code per access token |
| `refreshTokenIfNeeded()` | ~320-360 | Refresh automatico token scaduti |
| `writeTokenFile()` | ~13-22 | Salva token (cifrato con `safeStorage`) |
| `readTokenFile()` | ~24-36 | Legge token da file cifrato |
| `getGlobalTokenPath()` | ~38-40 | Path token globale: `userData/google-drive-tokens-global.json` |
| `getLocalTokenPath()` | ~42-45 | Path token locale: `workspace/.archiview-chunks/.credentials.json` |

#### IPC Handler (Esposto a Renderer):

```
ipcMain.handle('drive-auth', async (event, forceLocal) => {
  // Avvia flusso OAuth, apre server locale, gestisce redirect
  // Salva token (globale o locale)
})

ipcMain.handle('drive-logout', async () => {
  // Cancella token, disconnette
})

ipcMain.handle('drive-check-auth', async () => {
  // Verifica se token valido esiste
})
```

---

### 3. **Microsoft OneDrive/Graph OAuth2 Flow**

**Principale:** `src/main/ipc/msSync.ts`

#### Funzioni Critiche:

| Funzione | Linea Aprox. | Descrizione |
|----------|------------|-------------|
| `initMsal()` | ~54-100 | Inizializza MSAL client (Microsoft Authentication Library) |
| `setupLocalServer()` | ~150-200 | Server HTTP localhost:3457 per redirect MS |
| `handleMsRedirect()` | ~200-250 | Gestisce redirect da Microsoft |
| `writeMsTokenFile()` | ~12-21 | Salva token MSAL cache (cifrato) |
| `readMsTokenFile()` | ~23-38 | Legge token MSAL cache |
| `getGlobalTokenPath()` | ~40-42 | Path: `userData/ms-tokens-global.json` |
| `getLocalTokenPath()` | ~44-47 | Path: `workspace/.ms-tokens.json` |

#### IPC Handler (Esposto a Renderer):

```
ipcMain.handle('ms-auth', async (event, forceLocal) => {
  // Avvia flusso OAuth Microsoft MSAL
})

ipcMain.handle('ms-logout', async () => {
  // Cancella cache MSAL
})
```

---

### 4. **Token Storage e Sicurezza**

**In:** `driveSync.ts` / `msSync.ts`

- **Globale:** `~userData/google-drive-tokens-global.json` (primo account)
- **Locale (per workspace):** `workspace/.archiview-chunks/.credentials.json`
- **Cifratura:** Usata `electron.safeStorage.encryptString()` quando disponibile
- **Fallback:** Se cifratura non disponibile, salva plaintext

**Logica:**
1. Se sono in un workspace → salva **localmente** (non bleed tra workspace)
2. Se no workspace → salva **globalmente**

---

## 🔄 Gestione API Google Drive

**File Principale:** `src/main/ipc/drive/` (modulo refactorizzato in 6 file + index)  
**File Logica Frontend:** `src/renderer/js/logic/driveLogic.ts`

### Architettura Modulo Drive - Moduli Specializzati

Il modulo Drive è stato **refactorizzato da un singolo `driveSync.ts` a una cartella `drive/`** con 7 file:

| File | Responsabilità |
|------|-----------------|
| **index.ts** | Entry point: setup di tutti gli `ipcMain.handle` + import/export |
| **auth.ts** | OAuth2, token storage (globale/locale), `driveState` condiviso, `loadSavedTokens()`, `authenticateDrive()` |
| **fileOps.ts** | Primitivi Drive API: `getOrCreateFolder()`, `uploadFile()`, `downloadFile()`, `asyncPool()` |
| **vaultOps.ts** | Operazioni vault: `pullFromDrive()`, `syncToDrive()`, `listVaultsFromDrive()`, `checkUpdatesFromDrive()`, `cleanOrphanedAttachments()` |
| **attachments.ts** | Sync bidirezionale allegati con chunking: `syncAttachmentsBidirectional()` |
| **revisions.ts** | Storico versioni: `getDbFileId()`, `listDriveRevisions()`, `getDriveRevision()`, `restoreRevision()` |
| **sharing.ts** | Inviti e permessi: `generateInviteCode()`, `joinByInviteCode()`, `shareVault()`, `listPermissions()`, `openExternalPicker()` |

**Come è stato refactorizzato:**
- ✅ `driveState` (oauth2Client, drive, googleInstance) centralizzato in **auth.ts** e importato dagli altri moduli
- ✅ Token storage e OAuth flow isolati in **auth.ts**
- ✅ Operazioni file Drive (query, upload, download) in **fileOps.ts**
- ✅ Business logic vault (pull, sync, updates) in **vaultOps.ts**
- ✅ Sincronizzazione allegati (chunking) in **attachments.ts**
- ✅ Storico versioni in **revisions.ts**
- ✅ Inviti e condivisione in **sharing.ts**
- ✅ Tutti gli `ipcMain.handle` registrati in **index.ts**

### Main Process - Operazioni Drive (IPC Handlers)

| Funzione IPC | Descrizione |
|-------------|-------------|
| `drive-sync` | Sincronizza database locale ↔ Drive |
| `drive-pull` | Scarica vault specifico da Drive |
| `drive-list-vaults` | Elenca vault disponibili su Drive |
| `drive-upload-file` | Upload file/chunk su Drive |
| `drive-download-file` | Download file/chunk da Drive |
| `drive-check-updates` | Verifica se ci sono aggiornamenti remoti |
| `drive-sync-attachments` | Sincronizza allegati |
| `drive-clean-orphans` | Pulisce allegati orfani |
| `drive-generate-invite` | Genera codice invito (condivisione) |
| `drive-join-invite` | Unisciti a vault via codice |
| `drive-share-vault` | Condividi vault via email |
| `drive-list-permissions` | Elenca chi ha accesso |
| `drive-remove-permission` | Revoca accesso utente |
| `drive-get-token` | Restituisce token attuale (per debug) |

### Comunicazione tra Moduli Drive

Tutti i moduli usano **`driveState`** (oggetto mutabile in **auth.ts**):
```javascript
driveState = {
  localServer: null,      // Server HTTP per OAuth redirect
  googleInstance: null,   // googleapis module
  oauth2Client: null,     // OAuth2Client instance
  drive: null            // drive API client (versione v3)
}
```

**Pattern di dipendenza:**
- **fileOps.ts, vaultOps.ts, attachments.ts, revisions.ts, sharing.ts** → importano `driveState` e `authenticateDrive()` da **auth.ts**
- **fileOps.ts** → usato da **vaultOps.ts, attachments.ts, sharing.ts**
- **vaultOps.ts** → usato da **sharing.ts** (per `pullFromDrive()`)
- **revisions.ts** → standalone (usa solo `driveState`)

**Sicurezza token:**
- `driveState.oauth2Client` contiene il token in memoria
- Token salvati su disco cifrati con `safeStorage.encryptString()` (Electron)
- Workspace isolati: token locale in `workspace/.archiview-chunks/.credentials.json`
- Account globale: token globale in `~userData/google-drive-tokens-global.json`

### Chunking e Upload/Download

**File:** `src/main/chunkingLogic.ts` / `src/main/chunkingLogic.js`

- **Funzione:** `splitFileIntoChunks()` - Divide file grande in chunk
- **Funzione:** `assembleFileFromChunks()` - Riassembla file dai chunk
- **Uso:** Per evitare timeout su upload grandi, inviare chunk singoli

### Frontend - driveLogic.ts

**File:** `src/renderer/js/logic/driveLogic.ts`

| Funzione | Descrizione |
|----------|-------------|
| `aggiornaStatoDrive()` | Sincronizza stato drive con UI (bottoni visibili/nascosti) |
| `autentica()` (alias: `trasformaInPersonale()`) | Avvia OAuth login |
| `sincronizzaGoogleDrive()` | Invoca IPC sync |
| `controllaModificheInEntrata()` | Controlla aggiornamenti remoti via Pusher |
| `getApiCloud()` | Restituisce API corretta (Drive o Microsoft) |

---

## 🟦 Gestione Microsoft OneDrive/Graph

**File Principale:** `src/main/ipc/msSync.ts`

Struttura simile a Google Drive, ma usa:
- **MSAL (Microsoft Authentication Library)** per OAuth
- **Microsoft Graph API** per operazioni file
- **Token cache:** MSAL serializable cache

| Funzione IPC | Descrizione |
|-------------|-------------|
| `ms-auth` | Avvia autenticazione Microsoft |
| `ms-logout` | Logout Microsoft |
| `ms-status` | Stato autenticazione |
| `ms-sync` | Sincronizza con OneDrive |
| `ms-pull` | Scarica vault da OneDrive |
| `ms-list-vaults` | Elenca vault OneDrive |
| `ms-clean-orphans` | Pulisce allegati orfani |
| `ms-generate-invite` | Genera invito condivisione |

---

## 🌉 Setup Preload e IPC

**File Principale:** `src/main/preload.ts`

Questo file usa **contextBridge** per esporre API IPC al renderer in modo sicuro (senza `nodeIntegration`).

### Oggetti Esposti su Window

#### 1. **window.apiBrowser** - Operazioni locali/workspace

```typescript
window.apiBrowser = {
  // Database
  leggiDati()                          // Leggi database completo
  salvaDati(dati)                      // Salva database
  
  // Allegati
  salvaAllegato(filePath, documentoId) // Salva file allegato
  verificaHashAllegato(fileName, hash) // Verifica integrità
  apriPdfEsterno(fileName)             // Apri PDF esterno
  getAllegatoPath(fileName)            // Ottieni path allegato
  
  // Workspace
  getWorkspacePath()                   // Path workspace corrente
  changeWorkspace(title)               // Cambia workspace
  selectBaseDirectory(title)           // Seleziona cartella
  createWorkspaceInPath(basePath, name, config)
  deleteVaultLocal(path)               // Elimina vault locale
  
  // Export/Import
  exportWorkspaceZip(title)            // Esporta workspace ZIP
  exportZip(ids, title)                // Esporta documenti specifici
  importZip(title)                     // Importa da ZIP
  
  // Hub (Condivisione)
  saveHubConfig(config)
  loadHubConfig()
  cloneWorkspaceHub(basePath, folderName, hubConfig, database)
  
  // Utilities
  checkForUpdates()
  getVersion()
  apriLinkEsterno(url)
  inviaSegnalazione(payload)
}
```

**Dove sono gli IPC handlers:**
- `databaseIpc.ts` - leggi/salva dati
- `attachmentsIpc.ts` - gestione allegati
- `workspaceIpc.ts` - workspace operations
- `exportImportIpc.ts` - ZIP import/export
- `updaterIpc.ts` - auto-updater

---

#### 2. **window.apiSettings** - Impostazioni

```typescript
window.apiSettings = {
  get()        // Leggi settings
  save(settings) // Salva settings
}
```

**Handler:** `src/main/ipc/settingsIpc.ts`

---

#### 3. **window.apiDrive** - Google Drive Operations

```typescript
window.apiDrive = {
  // Auth
  auth(forceLocal)          // Avvia OAuth
  logout()                  // Logout
  status()                  // Stato auth
  checkAuth()               // Verifica token valido
  
  // Sync e Vault
  sync(parentTime)          // Sincronizza
  pull(vaultId)             // Scarica vault
  listVaults()              // Elenca vault
  checkUpdates()            // Verifica aggiornamenti remoti
  
  // Allegati
  syncAttachments()         // Sincronizza allegati
  pulisciAllegatiOrfani()   // Cleanup allegati orfani
  
  // Condivisione e Inviti
  generateInvite()          // Genera codice invito
  joinInvite(code, basePath, name)
  decodeInvite(code)
  shareVault(email)         // Condividi via email
  listPermissions()         // Chi ha accesso
  removePermission(permId)  // Revoca accesso
  
  // Versioni Cloud
  getDbFileId()             // ID file database su Drive
  listRevisions(fileId)     // Storico versioni
  getRevision(fileId, revId)
  restoreRevision(fileId, revId)
  
  // Events
  onStatusUpdated(callback) // Evento: autenticazione completata
  onSyncProgress(callback)  // Evento: progresso sync
  
  // Utility
  getToken()
  getClientId()
  peekDb(vaultId)           // Preview database remoto
}
```

**Handler:** `src/main/ipc/driveSync.ts`

---

#### 4. **window.apiMicrosoft** - OneDrive/Microsoft Graph

```typescript
window.apiMicrosoft = {
  auth(forceLocal)
  logout()
  status()
  sync()
  pull(vaultId)
  checkUpdates()
  generateInvite()
  pulisciAllegatiOrfani()
  peekDb(vaultId)
}
```

**Handler:** `src/main/ipc/msSync.ts`

---

### Come Funziona la Sicurezza

**In `src/main/main.ts`:**

```typescript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,        // ✅ Isolamento attivo
  nodeIntegration: false         // ✅ Node.js disabilitato
}
```

- **contextIsolation: true** → Renderer non ha accesso a Node APIs
- **preload.js** → Unico punto di contatto, expone via `contextBridge` solo le funzioni IPC
- **nodeIntegration: false** → Niente `require()`, `__dirname`, ecc nel renderer

---

## 🎨 Logica DOM Frontend

**Entry Point:** `src/renderer/js/app.ts`

### Ciclo di Inizializzazione

```
1. HTML caricato (index.html)
2. Attendere DOMContentLoaded
3. app.ts eseguito:
   - Carica modali HTML
   - Verifica workspace
     - Se NO → mostraWelcomeModal()
     - Se SÌ → aggiornaListaVault() + avviaApp()
   - Inizializza tema (initTheme)
   - Inizializza lingua (initLang)
   - Ascolta changelog
   - Ascolta handle-invite-url (per protocollo archiview://)
```

### Struttura Componenti UI

#### **Modali Principali**

**File:** `src/renderer/js/components/modals/`

| Modal | Descrizione |
|-------|-------------|
| `welcomeModal.ts` | Onboarding: seleziona workspace/crea nuovo |
| `cloudModal.ts` | **CLOUD SETUP**: Attiva cloud, genera inviti, unisciti a vault |
| `settingsModal.ts` | Impostazioni globali, account cloud, Pusher config |
| `diffModal.ts` | Visualizza diff tra versioni (merge preview) |
| `deletionConflictModal.ts` | Risolvi conflitti di cancellazione |
| `mergeConflictModal.ts` | Risolvi conflitti di merge |
| `changelogModal.ts` | Mostra changelog nuova versione |
| `deleteModal.ts` | Conferma cancellazione |
| `renameModal.ts` | Rinomina documento |
| `folderModal.ts` | Crea/Modifica cartelle |

**Cloud Modal (Più Importante):**

**File:** `src/renderer/js/components/modals/cloudModal.ts` (~300+ linee)

Struttura HTML:
```html
<div id="cloud-modal">
  <!-- SEZIONE 1: Vault Locale (non sincronizzato) -->
  <div id="cloud-local-section">
    <!-- Bottoni: Carica nel Cloud (privato) / Condiviso -->
    <!-- Bottone: Unisciti a un archivio -->
  </div>
  
  <!-- SEZIONE 2: Vault Attivo (già sincronizzato) -->
  <div id="cloud-shared-section" class="hidden-tab">
    <!-- Mostra info vault -->
    <!-- Bottone: Sincronizza Ora -->
    <!-- Sezione: Condivisione e Inviti -->
    <!-- Sezione: Gestione Permessi -->
  </div>
</div>
```

**Funzioni Chiave:**
- `apriCloudModal()` - Apre il modal
- `chiudiCloudModal()` - Chiude il modal
- `trasformaInPersonale()` - Carica vault come backup privato (Google Drive personale)
- `trasformaInCondiviso()` - Carica vault come archivio condiviso
- `uniscitiDaCloudModal()` - Join a vault con codice invito
- `sincronizzaGoogleDrive()` - Esegui sync manuale
- `aggiornaVistaCloud()` - Aggiorna UI basato su stato cloud

#### **View Principali (Contenuti)**

**File:** `src/renderer/js/components/views/`

| Vista | Descrizione |
|------|-------------|
| `viewList.ts` | Elenco manoscritti con filtri e ricerca |
| `viewAdd.ts` | Form aggiunta nuovo manoscritto |
| `viewTrascrizione.ts` | Editor trascrizione testo |

#### **Componenti Layout**

| Componente | File | Descrizione |
|-----------|------|-------------|
| Sidebar | `sidebar.ts` | Menu laterale con tab (Documents, Cloud, History) |
| Main View | `mainView.ts` | Container principale contenuti |
| Header | HTML (inline) | Logo, versione, info |
| Form | `form.ts` | Utilities form (validation, rendering) |
| Banners | `banners.ts` | Notifiche a top (update disponibile, etc.) |
| Toasts | `toasts.ts` | Notifiche brevi in basso |

---

### Gestione State e Store

#### **Global State**

**File:** `src/renderer/js/state.ts`

```typescript
window.documentoSelezionato   // Documento attualmente aperto
window.cartellaNascosta       // ID cartella nascosta (se filtrata)
window.searchQuery            // Query ricerca corrente
window.driveStatus            // { isAuthenticated, user, ... }
window.appStatus              // { isLoading, hasUnsavedChanges, ... }
```

#### **Data Store (Cache Locale)**

**File:** `src/renderer/js/store.ts`

```typescript
window.localStorage   // Persiste impostazioni UI (dark mode, tab aperto, etc.)
window.datiApp        // Cache in-memory database
```

---

### DOM Manipulation e XSS Prevention

#### **DOMPurify**

**File:** `src/renderer/vendor/purify.min.js`

Usato ovunque ci sia HTML dinamico:

```javascript
// ✅ SICURO
element.innerHTML = DOMPurify.sanitize(htmlString);

// ❌ PERICOLOSO - Non usare mai
element.innerHTML = htmlString;
```

**Dove è usato:**
- Rendering testi trascritti (che possono contenere HTML)
- Rendering note e commenti
- Visualizzazione changelog (HTML markup)

---

### Real-time Sync e Pusher

**File:** `src/renderer/js/logic/realtimeLogic.ts`

```typescript
window.pusherInstance     // Istanza Pusher
window.pusherChannel      // Canale abbonato
window.myAppInstanceId    // ID unico app

// All'avvio:
inizializzaRealTime() {
  // Legge settings (pusherKey, pusherCluster)
  // Crea istanza Pusher
  // Si abbona a canale per workspace
  // Ascolta evento 'drive-updated'
    // Se aggiornamento da altri client → mostra notifica "Modifiche in Entrata"
}
```

**Flusso:**
1. User A modifica e sincronizza su Drive
2. Main Process invia evento Pusher
3. User B riceve evento Pusher (tramite realtimeLogic)
4. Accende notifica "Modifiche in Entrata"
5. User B può scaricare aggiornamenti manualmente

---

### Event Listeners e IPC

**Listener Principali in Renderer:**

```javascript
// Ascolta modifiche database (da altri workspace/client)
window.apiBrowser.onDatabaseModificatoEsterno(() => {
  // Ricarica dati
  aggiornaListaDocumenti();
});

// Ascolta completamento download/upload
window.apiBrowser.onAllegatoScaricato((fileName) => {
  mostraToast(`File ${fileName} scaricato`);
});

// Ascolta URL invito (protocollo archiview://)
window.apiBrowser.onInviteUrl((url) => {
  decifraEUnisciAlVault(url);
});

// Ascolta notifiche stato Drive
window.apiDrive.onStatusUpdated((data) => {
  if (data.authenticated) {
    aggiornaStatoDrive();
    mostraMessaggio("Autenticazione completata!");
  }
});

// Ascolta progresso sync
window.apiDrive.onSyncProgress((data) => {
  updateSyncProgress(data.percent, data.message);
});

// Ascolta notifiche Pusher (real-time)
window.apiDrive.onSyncProgress((data) => {
  impostaModificheInEntrata(true);
});

// Auto-updater
window.apiBrowser.onUpdateProgress((progress) => {
  updateDownloadBar(progress);
});
```

---

## 🔄 Flussi Critici

### Flusso 1: Autenticazione Google Drive (Per La Prima Volta)

```
1. User clicca "Carica nel Cloud" (cloudModal.ts)
   → trasformaInPersonale() o trasformaInCondiviso()

2. Frontend chiama window.apiDrive.auth(forceLocal = true/false)

3. Main Process (drive/auth.ts + drive/index.ts):
   → initGoogle() (inizializza OAuth2Client)
   → authenticateDrive() crea server localhost:3456
   → oauth2Client.generateAuthUrl() (genera URL Google con authorization_code flow)
   → apre BrowserWindow redirect (o usa shell.openExternal)
   → User acconsente su Google
   → Google reindirizza a localhost:3456/oauth2callback

4. handleOAuth2Callback() riceve auth code:
   → requestAccessToken() exchange code per access token
   → writeTokenFile() salva token (cifrato)
   → ipcMain.send('drive-status-updated', { authenticated: true })

5. Frontend riceve notifica:
   → aggiorna UI (bottone login → logout)
   → mostra messaggio "Autenticazione completata!"

6. Token permanente è salvato:
   → Locale: workspace/.archiview-chunks/.credentials.json
   → O Globale: userData/google-drive-tokens-global.json
```

---

### Flusso 2: Sincronizzazione Database ↔ Google Drive

```
1. User clicca "Sincronizza Ora" (cloudModal.ts)
   → sincronizzaGoogleDrive()

2. Frontend chiama window.apiDrive.sync(parentTime)

3. Main Process (drive/vaultOps.ts + drive/fileOps.ts):
   → loadSavedTokens() carica token da disco
   → Lista folder su Drive
   → Cerca file "database_manoscritti.json"
   
   Se file non esiste:
     → crea nuovo file su Drive
   
   Se file esiste:
     → Compare local timestamp vs remote timestamp
     → Se local più nuovo → uploadFile()
       • splitFileIntoChunks() divide file
       • Upload chunk per chunk (per evitare timeout)
       • Merge chunks su Drive
     → Se remote più nuovo → downloadFile()
       • Download file da Drive
       • assembleFileFromChunks()
       • Unzip e importa nel database locale
     → Se conflitto → genera versione merge

4. Durante sync:
   → ipcMain.send('sync-progress', { percent, message })

5. Frontend riceve aggiornamenti:
   → updateSyncProgress(percent, text)
   → Visualizza barra progresso in UI

6. Al completamento:
   → ipcMain.send('database-modificato-esterno')
   → Frontend ricarica dati (aggiornaListaDocumenti)
```

---

### Flusso 3: Unisciti a Vault Condiviso (Join Invite)

```
1. User riceve codice invito via email o UI (cloudModal.ts)
   → uniscitiDaCloudModal()

2. Frontend chiama window.apiDrive.joinInvite(code, basePath, name)

3. Main Process (driveSync.ts):
   → decodeInvite() decodifica base64 code
   → Ottiene Folder ID e Shared Key
   → Scarica "database_manoscritti.db.json" da quella cartella
   → Crea nuovo workspace locale in basePath/name
   → Salva configurazione:
       • sharedVaultId = Folder ID su Drive
       • driveAutofetch = true (per aggiornamenti Pusher)
   → Sincronizza database completo

4. Frontend:
   → Crea entry nell'hub config locale
   → Ricarica UI con nuovo workspace

5. D'ora in poi:
   → Ogni sync sincronizza con quella cartella Drive
   → Pusher notifica quando altri collaboratori aggiornano
```

---

### Flusso 4: Real-Time Sync con Pusher

```
1. User A modifica documento e clicca "Sincronizza"
   → sincronizzaGoogleDrive()
   → File aggiornato su Drive

2. Main Process (driveSync.ts):
   → Upload completo
   → Invia evento Pusher: 
       channel.publish('drive-updated', { 
         senderId: myAppInstanceId,
         timestamp, 
         vaultId 
       })

3. Tutti i client connessi ricevono evento (realtimeLogic.ts):
   → Controllo: senderId != myAppInstanceId (no loop)
   → Chiama controllaModificheInEntrata()
   → Accende indicatore "Modifiche in Entrata"

4. User B vede notifica, clicca "Scarica Aggiornamenti"
   → window.apiDrive.sync() con pull
   → Aggiorna database locale
   → Ricarica UI
```

---

### Flusso 5: Gestione Conflitti di Merge

```
1. Durante sync (driveSync.ts):
   → Rileva cambio contemporaneo su local e remote
   → Calcola diff e merge automatico
   
   Se merge fallisce (conflitti irrisolvibili):
     → Salva tre versioni:
       • local.json (versione locale)
       • remote.json (versione remota)
       • merged.json (tentativo merge)
     → ipcMain.send('merge-conflict', { local, remote, merged })

2. Frontend riceve notifica:
   → Apre mergeConflictModal.ts
   → Visualizza diff con 3-way view
   → User sceglie conflitto per conflitto quale versione tenere

3. User clicca "Risolvi Conflitto":
   → Invia versione scelta al Main Process
   → Main Process sincronizza versione risolta

4. Al completamento:
   → Modal chiude
   → UI ricarica
```

---

## 📊 Albero di Dipendenze Chiave

```
src/main/main.ts (Entry Point)
├── workspaceManager.ts (State + Settings)
├── preload.ts (IPC Bridge)
└── ipc/
    ├── drive/ ← **Modulo Google Drive (refactorizzato)**
    │   ├── index.ts (setup IPC)
    │   ├── auth.ts (OAuth2, token, driveState)
    │   ├── fileOps.ts (primitivi API)
    │   ├── vaultOps.ts (pull, sync, list)
    │   ├── attachments.ts (sync allegati)
    │   ├── revisions.ts (storico versioni)
    │   └── sharing.ts (inviti, condivisione)
    ├── msSync.ts ← OAuth2 Microsoft
    ├── databaseIpc.ts
    ├── attachmentsIpc.ts
    ├── settingsIpc.ts
    ├── workspaceIpc.ts
    └── exportImportIpc.ts

src/renderer/js/app.ts (Entry Point)
├── modals/
│   ├── cloudModal.ts ← UI Cloud Setup
│   ├── settingsModal.ts
│   └── [altri modali]
├── components/
│   ├── sidebar.ts
│   ├── mainView.ts
│   └── [altri componenti]
└── logic/
    ├── driveLogic.ts ← Frontend Drive Orchestration
    ├── realtimeLogic.ts ← Pusher Real-Time
    ├── itemsLogic.ts
    ├── foldersLogic.ts
    └── [altra business logic]
```

---

## 🎯 Mappe Veloci per Compiti Comuni

### "Dove aggiungo nuove credenziali OAuth?"
→ `src/main/ipc/cloudCredentials.ts` (costanti GOOGLE_CLIENT_ID, MS_CLIENT_ID, etc.)

### "Dove gestisco il flusso di login Google?"
→ `src/main/ipc/drive/auth.ts` (funzioni `authenticateDrive()`, `initGoogle()`, server HTTP redirect)

### "Dove salvo i token in modo sicuro?"
→ `src/main/ipc/drive/auth.ts` funzioni `writeTokenFile()` / `readTokenFile()` + `electron.safeStorage`
→ Token storage isolato per workspace (workspace/.archiview-chunks/.credentials.json) e globale (~userData/google-drive-tokens-global.json)

### "Dove aggiungo bottoni per il cloud?"
→ `src/renderer/js/components/modals/cloudModal.ts` (HTML del modal)

### "Dove gestisco il sync del database?"
→ `src/main/ipc/drive/vaultOps.ts` (handler `drive-sync`: funzione `syncToDrive()`)
→ `src/main/ipc/drive/index.ts` (registra IPC handler `drive-sync`)
→ `src/renderer/js/logic/driveLogic.ts` (orchestrazione frontend)

### "Dove implemento real-time notifications?"
→ `src/renderer/js/logic/realtimeLogic.ts` (Pusher setup e event listeners)

### "Dove gestisco allegati e chunking?"
→ `src/main/chunkingLogic.ts` (split/assemble chunks)
→ `src/main/ipc/drive/attachments.ts` (sync bidirezionale, handler `drive-sync-attachments`)
→ `src/main/ipc/attachmentsIpc.ts` (IPC handlers locali per allegati)

### "Dove aggiungo nuove operazioni Drive?"
→ Crea una funzione in uno dei moduli `drive/*.ts` appropriato (auth, fileOps, vaultOps, etc.)
→ Esporta da quel modulo
→ Importa in `drive/index.ts` e registra `ipcMain.handle()` se necessario

### "Dove apparecchio l'IPC sicuro?"
→ `src/main/preload.ts` (contextBridge espone API)
→ `src/main/main.ts` (webPreferences con contextIsolation: true)

---

## ⚠️ Note Architetturali

1. **OAuth è SOLO nel Main Process** - Il renderer non tocca mai credenziali o token
2. **Token storage ha priorità locale** - Workspace non si contaminano reciprocamente
3. **Chunking è critico per file grandi** - Upload/download senza timeout
4. **DOMPurify ovunque** - Niente `innerHTML` unsanitized
5. **Pusher per real-time** - Non WebSocket diretto, usa Pusher per signaling
6. **Merge a 3-vie per conflitti** - Local + Remote + Auto-merge tentativo

---

## 🔧 Refactor `drive/` - Modularizzazione e Benefici

### Perché è stato refactorizzato?

Il file monolitico `driveSync.ts` (1560 righe) è stato diviso in **7 moduli specializzati** per:
1. **Responsabilità singola** - Ogni modulo ha un compito ben definito
2. **Manutenibilità** - Facile trovare e modificare funzionalità specifiche
3. **Riusabilità** - Moduli possono essere usati da altri handler IPC (es. Microsoft Sync potrebbe usare `fileOps.asyncPool()`)
4. **Testabilità** - Ogni modulo può essere testato indipendentemente
5. **Scalabilità** - Aggiungere nuove funzionalità (es. `migrateVault()`, `backupVault()`) è semplice

### Come aggiungere una nuova funzionalità Drive

**Esempio: aggiungere `shareVaultPublic()` (rendi vault pubblico)**

1. Determina il modulo appropriato → **sharing.ts** (è già legato alla condivisione)
2. Aggiungi la funzione:
   ```javascript
   // src/main/ipc/drive/sharing.ts
   async function shareVaultPublic(): Promise<boolean> {
     // ... implementazione
   }
   module.exports = { ..., shareVaultPublic };
   ```
3. Registra l'IPC handler in **index.ts**:
   ```javascript
   ipcMain.handle('drive-share-vault-public', async () => {
     return await shareVaultPublic();
   });
   ```
4. Usa dal frontend:
   ```javascript
   window.apiDrive.shareVaultPublic(); // Aggiunto in preload.ts
   ```

### Come estendere per un provider alternativo (es. Dropbox)

Se vuoi aggiungere **Dropbox** mantenendo la struttura:
1. Crea `src/main/ipc/dropbox/` con la stessa struttura:
   ```
   dropbox/
   ├── index.ts
   ├── auth.ts (OAuth Dropbox)
   ├── fileOps.ts (primitivi Dropbox API)
   ├── vaultOps.ts
   ├── attachments.ts
   └── sharing.ts
   ```
2. Riusa helper comuni se creati in utility: `src/main/ipc/cloudUtils.ts`
3. Registra in **main.ts** accanto a `setupDriveIpc()` e `setupMsIpc()`

---

Questo CODEMAP è una mappa vivente dell'architettura ArchiView. Aggiorna quando cambia la struttura!
