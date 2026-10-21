const fs = require('fs');
const http = require('http');
const path = require('path');
const { exec } = require('child_process');

const radice = path.join(__dirname, '..');
const { auth } = require(path.join(radice, 'node_modules', '@googleapis', 'drive'));

const PORTA = 3456;
const REDIRECT = `http://localhost:${PORTA}/oauth2callback`;
const SCADENZA_MS = 5 * 60 * 1000;

function credenziale(sorgente, nome) {
  const m = sorgente.match(new RegExp(`${nome}\\s*=\\s*['"\`]([^'"\`]+)['"\`]`));
  if (!m) throw new Error(`${nome} mancante in src/main/ipc/cloudCredentials.ts`);
  return m[1];
}

let sorgente;
try {
  sorgente = fs.readFileSync(path.join(radice, 'src', 'main', 'ipc', 'cloudCredentials.ts'), 'utf8');
} catch (e) {
  console.error('src/main/ipc/cloudCredentials.ts non trovato:', e.message);
  process.exit(1);
}

const client = new auth.OAuth2(credenziale(sorgente, 'GOOGLE_CLIENT_ID'), credenziale(sorgente, 'GOOGLE_CLIENT_SECRET'), REDIRECT);
const url = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent select_account',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

const server = http.createServer(async (req, res) => {
  const richiesta = new URL(req.url || '/', REDIRECT);
  if (richiesta.pathname !== '/oauth2callback') { res.writeHead(404).end(); return; }
  const codice = richiesta.searchParams.get('code');
  if (!codice) {
    res.writeHead(400).end('Accesso annullato.');
    console.error('Accesso annullato o negato:', richiesta.searchParams.get('error'));
    process.exit(1);
  }
  try {
    const { tokens } = await client.getToken(codice);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Fatto, puoi chiudere questa scheda.');
    if (!tokens.refresh_token) {
      console.error('Google non ha restituito un refresh token: togli l\'accesso dell\'app da https://myaccount.google.com/permissions e riprova.');
      process.exit(1);
    }
    console.log('\nGOOGLE_TEST_REFRESH_TOKEN:\n\n' + tokens.refresh_token + '\n');
    process.exit(0);
  } catch (e) {
    res.writeHead(500).end('Scambio del codice non riuscito.');
    console.error('Scambio del codice non riuscito:', e && e.message ? e.message : e);
    process.exit(1);
  }
});

server.on('error', (e) => {
  console.error(`Porta ${PORTA} occupata (ArchiView aperto?):`, e.message);
  process.exit(1);
});

server.listen(PORTA, '127.0.0.1', () => {
  console.log('Accedi con l\'account Google DI PROVA nella pagina che si apre. Se non si apre:\n\n' + url + '\n');
  exec(process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`);
  setTimeout(() => { console.error('Nessun accesso entro 5 minuti.'); process.exit(1); }, SCADENZA_MS).unref();
});
