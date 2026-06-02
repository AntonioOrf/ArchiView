const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DATA_DIR = path.join(__dirname, 'projects');
const METADATA_FILE = path.join(__dirname, 'repositories.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Carica e salva metadati repository
function loadMetadata() {
  if (fs.existsSync(METADATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    } catch (e) {
      console.error("Errore lettura metadati:", e);
    }
  }
  return {};
}

function saveMetadata(metadata) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
}

// Google Drive Integration (Optional)
let googleDriveConfig = null;
const DRIVE_CONFIG_FILE = path.join(__dirname, 'google-drive-config.json');
if (fs.existsSync(DRIVE_CONFIG_FILE)) {
  try {
    googleDriveConfig = JSON.parse(fs.readFileSync(DRIVE_CONFIG_FILE, 'utf8'));
    console.log("Configurazione Google Drive caricata con successo.");
  } catch (e) {
    console.error("Errore lettura google-drive-config.json:", e);
  }
}

// Funzione fittizia per caricamento su Google Drive (espandibile con Google SDK)
async function syncToGoogleDrive(repoId, dataString) {
  if (!googleDriveConfig) return;
  console.log(`[Google Drive] Sincronizzazione in corso per repository ${repoId}...`);
  // Qui si integrerebbe la chiamata API a Google Drive usando le credenziali fornite.
  // Nel frattempo, per i test del server, salviamo comunque in locale e tracciamo il log.
}

// HTML Dashboard Web del Server Hub
app.get('/', (req, res) => {
  const meta = loadMetadata();
  const repoRows = Object.values(meta).map(r => `
    <tr class="border-b border-stone-200 hover:bg-stone-50">
      <td class="p-3 font-semibold text-stone-800">${escapeHtml(r.name)}</td>
      <td class="p-3 text-mono text-xs text-stone-500">${r.id}</td>
      <td class="p-3 text-stone-600">v${r.version}</td>
      <td class="p-3 text-stone-600">${new Date(r.lastModified).toLocaleString('it-IT')}</td>
      <td class="p-3">
        <button onclick="copiaChiave('${r.key}')" class="bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1 rounded text-xs font-semibold">Copia Chiave</button>
      </td>
    </tr>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <title>Schedatore Hub - Dashboard</title>
      <script src="https://unpkg.com/@lucide/web"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; background: #fafaf9; margin: 0; padding: 40px; color: #1c1917; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e7e5e4; }
        h1 { color: #f59e0b; margin-top: 0; font-size: 28px; display: flex; align-items: center; gap: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { text-align: left; background: #f5f5f4; padding: 12px; font-weight: 600; border-bottom: 2px solid #e7e5e4; }
        td { padding: 12px; border-bottom: 1px solid #e7e5e4; }
        .btn { background: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 500; }
        .btn:hover { background: #d97706; }
        .modal-bg { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; }
        .modal { background: white; padding: 25px; border-radius: 4px; width: 400px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1><i data-lucide="server"></i> Schedatore Hub</h1>
        <p class="text-stone-500">Piattaforma di coordinamento e hosting per i tuoi repository di Schedatore.</p>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 30px;">
          <h2>Repository Attivi</h2>
          <button onclick="apriModal()" class="btn">+ Crea Repository</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome Repository</th>
              <th>ID (Stanza)</th>
              <th>Versione</th>
              <th>Ultima Modifica</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            ${repoRows || '<tr><td colspan="5" style="text-align: center; color: #78716c; padding: 30px;">Nessun repository creato. Creane uno per iniziare.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div id="modal" class="modal-bg">
        <div class="modal">
          <h3 style="margin-top:0;">Crea Nuovo Repository</h3>
          <input type="text" id="repo-name" placeholder="Nome repository..." style="width: 100%; padding: 8px; margin-bottom: 15px; box-sizing: border-box;">
          <div style="display:flex; justify-content: flex-end; gap: 10px;">
            <button onclick="chiudiModal()" style="padding: 8px 15px; background:#e7e5e4; border:none; border-radius:4px; cursor:pointer;">Annulla</button>
            <button onclick="creaRepo()" class="btn" style="padding: 8px 15px;">Crea</button>
          </div>
        </div>
      </div>

      <script>
        lucide.createIcons();
        function apriModal() { document.getElementById('modal').style.display = 'flex'; }
        function chiudiModal() { document.getElementById('modal').style.display = 'none'; }
        function copiaChiave(key) {
          navigator.clipboard.writeText(key);
          alert('Chiave copiata negli appunti!');
        }
        async function creaRepo() {
          const name = document.getElementById('repo-name').value.trim();
          if(!name) return;
          const res = await fetch('/api/repos/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoName: name })
          });
          const data = await res.json();
          if(data.repoId) {
            window.location.reload();
          }
        }
      </script>
    </body>
    </html>
  `);
});

// API: Crea Repository
app.post('/api/repos/create', (req, res) => {
  const { repoName } = req.body;
  if (!repoName) {
    return res.status(400).json({ error: "Nome repository mancante" });
  }

  const repoId = 'repo_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  const repoKey = 'tk_' + crypto.randomBytes(16).toString('hex');
  
  const metadata = loadMetadata();
  metadata[repoId] = {
    id: repoId,
    name: repoName,
    key: repoKey,
    version: 1,
    lastModified: Date.now()
  };
  saveMetadata(metadata);

  // Inizializza database vuoto
  const defaultDb = {
    cartelle: ['Generale'],
    manoscritti: [],
    tipiDocumento: []
  };

  const projectPath = path.join(DATA_DIR, `${repoId}.json`);
  const dataString = JSON.stringify(defaultDb, null, 2);
  fs.writeFileSync(projectPath, dataString, 'utf8');

  // Sincronizza su Google Drive se configurato
  syncToGoogleDrive(repoId, dataString);

  res.json({ repoId, repoKey });
});

// API: Pull (Scarica database)
app.get('/api/repos/:repoId/pull', (req, res) => {
  const { repoId } = req.params;
  const auth = req.headers['authorization'];

  const metadata = loadMetadata();
  const repo = metadata[repoId];

  if (!repo) {
    return res.status(404).json({ error: "Repository non trovato" });
  }

  // Verifica chiave
  const key = auth ? auth.replace('Bearer ', '').trim() : '';
  if (repo.key !== key) {
    return res.status(401).json({ error: "Non autorizzato" });
  }

  const projectPath = path.join(DATA_DIR, `${repoId}.json`);
  if (!fs.existsSync(projectPath)) {
    return res.status(404).json({ error: "File database non trovato" });
  }

  const data = fs.readFileSync(projectPath, 'utf8');
  res.json({
    version: repo.version,
    lastModified: repo.lastModified,
    database: JSON.parse(data)
  });
});

// API: Push (Invia database ed esegue il controllo versione)
app.post('/api/repos/:repoId/push', async (req, res) => {
  const { repoId } = req.params;
  const { parentVersion, database } = req.body;
  const auth = req.headers['authorization'];

  const metadata = loadMetadata();
  const repo = metadata[repoId];

  if (!repo) {
    return res.status(404).json({ error: "Repository non trovato" });
  }

  // Verifica chiave
  const key = auth ? auth.replace('Bearer ', '').trim() : '';
  if (repo.key !== key) {
    return res.status(401).json({ error: "Non autorizzato" });
  }

  // Controllo versione concorrente (Git-like fast-forward reject)
  if (parseInt(parentVersion) !== repo.version) {
    return res.status(409).json({ 
      error: "conflict",
      message: "Il repository remoto contiene modifiche successive. Fai prima un Pull per fonderle." 
    });
  }

  // Salva il nuovo database
  const projectPath = path.join(DATA_DIR, `${repoId}.json`);
  const dataString = JSON.stringify(database, null, 2);
  fs.writeFileSync(projectPath, dataString, 'utf8');

  // Aggiorna versione e metadati
  repo.version += 1;
  repo.lastModified = Date.now();
  saveMetadata(metadata);

  // Sincronizza su Google Drive se configurato
  await syncToGoogleDrive(repoId, dataString);

  res.json({
    success: true,
    version: repo.version,
    lastModified: repo.lastModified
  });
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

app.listen(PORT, () => {
  console.log(`Server Schedatore Hub avviato sulla porta ${PORT}`);
});
