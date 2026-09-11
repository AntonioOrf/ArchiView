# Sito ArchiView

Sito statico + wiki utente. Branch `vercel-site`, deploy su Firebase Hosting (site `archiview`).

```
docs/
├── firebase.json        hosting: public = public/
├── public/              ciò che viene pubblicato
│   ├── index.html       home, privacy.html, terms.html
│   └── wiki/            GENERATA dalla build VitePress (in .gitignore)
└── wiki/                sorgenti della wiki (Markdown)
    ├── .vitepress/       config + tema (palette stone/amber del sito)
    ├── primi-passi/  guida/  cloud/  dati/
    └── index.md  faq.md  glossario.md
```

## Due lingue

L'italiano è la radice (`wiki/`, servito su `/wiki/`); l'inglese sta in `wiki/en/` (servito su
`/wiki/en/`) con percorsi inglesi: `getting-started/`, `guide/`, `export/`, `sync/`, `data/`.
Le due alberature hanno le stesse 31 pagine e vanno aggiornate insieme: una pagina modificata in una
lingua sola lascia l'altra a descrivere un comportamento diverso.

Menu e barra laterale di ciascuna lingua stanno in `locales` dentro `wiki/.vitepress/config.mts`.
Gli screenshot inglesi stanno in `wiki/public/img/en/` e si rigenerano con lo stesso script.

## Modificare la wiki

Le pagine sono normali file Markdown: si modificano direttamente, senza toccare nulla di
tecnico. Per aggiungere una pagina, creare il file e inserirla nella `sidebar` di
`wiki/.vitepress/config.mts`.

Anteprima dal vivo, con ricarica automatica:

```bash
npm run wiki:dev        # http://localhost:5173/wiki/
```

## Gli screenshot

Le schermate in `wiki/public/img/` non si ritagliano a mano: le genera uno script che pilota
l'app vera con Playwright, su un archivio d'esempio temporaneo. Ogni schermata esiste in due
versioni, chiara e scura (`nome.png` e `nome-scuro.png`); la pagina mostra quella del tema
attivo grazie alle classi `light-only` / `dark-only`.

Per rigenerarle tutte dopo un cambio di interfaccia, dal repository dell'app:

```bash
npm run build-css && npm run build-ts
node scripts/wiki-screenshots.mjs
```

## Pubblicare

`public/wiki/` non è versionata: va rigenerata prima di ogni deploy.

```bash
npm run deploy          # build della wiki + firebase deploy --only hosting
```

Oppure separatamente:

```bash
npm run wiki:build
npx --yes firebase-tools deploy --only hosting
```

La prima volta serve l'autenticazione (una sola volta per macchina):

```bash
npx --yes firebase-tools login
```

## Nota sul nome del branch

Il branch si chiama `vercel-site` ma la configurazione presente è Firebase Hosting
(`firebase.json`, `.firebaserc`). Non esiste un workflow di deploy in `.github/workflows`: la
pubblicazione è manuale.
