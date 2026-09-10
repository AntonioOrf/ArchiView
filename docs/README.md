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

## Modificare la wiki

Le pagine sono normali file Markdown: si modificano direttamente, senza toccare nulla di
tecnico. Per aggiungere una pagina, creare il file e inserirla nella `sidebar` di
`wiki/.vitepress/config.mts`.

Anteprima dal vivo, con ricarica automatica:

```bash
npm run wiki:dev        # http://localhost:5173/wiki/
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
