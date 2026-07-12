# ArchiView Hub (Cloudflare Workers + D1)

Backend di sincronizzazione **gratuito** per ArchiView. Serve il DB JSON versionato
(pull/push con guardia di concorrenza) e l'indice degli allegati (hash → link pubblico
su Drive personale). Il client esiste già in `src/renderer/js/logic/hubLogic.ts`.

## Protocollo

| Metodo/Path | Auth | Corpo → Risposta |
|---|---|---|
| `POST /api/repos` | header `X-Create-Secret` | `{name?}` → `201 {repoId, ownerKey}` |
| `GET /api/repos/:id/pull[?ifVersionNot=N]` | `Bearer` membro/owner | → `{version, database}` oppure `{version, unchanged:true}` |
| `POST /api/repos/:id/push` | `Bearer` membro/owner | `{parentVersion, database}` → `{version}` (409 su conflitto) |
| `GET /api/repos/:id/members` | owner | → `{members:[…]}` |
| `POST /api/repos/:id/members` | owner | `{label?}` → `201 {memberId, memberKey}` |
| `DELETE /api/repos/:id/members/:mid` | owner | → revoca soft |
| `GET /api/repos/:id/attachments/index` | membro | → `{files, chunks}` |
| `POST /api/repos/:id/attachments/index` | membro | `{files?, chunks?}` upsert last-writer-wins |
| `DELETE /api/repos/:id/attachments/chunks/:hash` | uploader/owner | pulizia post-revoca |
| `POST /api/ping` | — | `{channel, event, data?}` relay Pusher (sostituisce vercel-hub) |

Le chiavi (owner/membro) sono 32 byte random base64url, mostrate **una sola volta**;
sul server resta solo lo SHA-256 hex. Il DB è gzippato e spezzato in righe ≤900KB;
retention delle ultime `MAX_VERSIONS` versioni (default 20).

## Setup

```bash
cd cloudflare-hub
npm install

# 1. Crea il database D1 e incolla il database_id in wrangler.toml
npx wrangler d1 create archiview-hub

# 2. Applica lo schema (locale per wrangler dev, remoto per la produzione)
npm run migrate:local
npm run migrate

# 3. Secret (NON committare). CREATE_SECRET va poi bakeato nel client.
npx wrangler secret put CREATE_SECRET
npx wrangler secret put PUSHER_APP_ID
npx wrangler secret put PUSHER_KEY
npx wrangler secret put PUSHER_SECRET
npx wrangler secret put PUSHER_CLUSTER

# 4a. Sviluppo locale
npm run dev            # http://localhost:8787

# 4b. Deploy
npm run deploy
```

Per lo sviluppo locale i secret si mettono in `.dev.vars` (git-ignored):

```
CREATE_SECRET=dev-secret
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=eu
```

## Test di fumo

Con `npm run dev` attivo su un'altra shell:

```bash
node test/smoke.mjs http://localhost:8787 dev-secret
```

Copre: create → push v1 → pull → push concorrente (409) → add/revoke membro
(chiave revocata → 401) → indice allegati → ping.

## Note architetturali

- **Concorrenza**: il push fa `UPDATE … WHERE current_version = parentVersion`; 0 righe → 409.
  La scrittura dei blob è compensata (rollback dell'incremento) se fallisce.
- **Fast-path autofetch**: `?ifVersionNot=N` evita di leggere/decomprimere i blob quando
  il client è già aggiornato — lettura D1 quasi gratuita.
- **Allowlist URL chunk**: solo `drive.google.com`, `googleapis.com`, `*.usercontent.google.com`.
- **MD5**: vendorizzato in `src/crypto.ts` perché WebCrypto non lo espone e la firma REST
  Pusher richiede `body_md5`.
