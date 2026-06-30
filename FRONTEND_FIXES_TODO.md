# Frontend Fixes — Roadmap (handoff prossima sessione)

Stato revisione frontend/UX di ArchiView. **P0 e P1 già completati e committabili.**
Restano **P2 (accessibilità)** e **P3 (UX/consistenza)**.

Tutti i riferimenti `file:line` vanno **riverificati** prima di editare (il codice può essere cambiato).
Verificare sempre con `npx tsc --noEmit` dopo le modifiche.

---

## ✅ Già fatto (P0 + P1)

**P0 — bug funzionali**
- Click suggerimenti di ricerca: salto alla pagina corretta + toast fallback — `mainView.ts` (`getManoscrittiFiltrati`).
- `Esc` chiude solo il modale in primo piano via handler dedicati (callback di cancel inclusi) — `app.ts`.
- `Esc` su image-modal resetta l'iframe PDF (instradato a `chiudiModal`).
- Dark mode modali: remap utility neutre `stone/white` dentro `.modal-window` — coda di `css/style.css`.

**P1 — i18n**
- Nuove chiavi in `customIt`/`customEn` (`i18n.ts`): contatori, tooltip, vault types, ecc.
- `document.documentElement.lang` aggiornato in `initLang` e `cambiaLingua`.
- Stringhe hardcoded convertite a `window.t(...)` in: `mainView.ts`, `form.ts`, `modals.ts`, `toasts.ts`, `sidebar.ts`, `issueModal.ts`, `driveLogic.ts`.

**Pattern i18n da riusare:** `window.t('chiave', 'fallback IT').replace('{var0}', String(val))`.
Le chiavi nuove vanno in `customIt`/`customEn` dentro `i18n.ts` (priorità su Lingui; nessun `lingui compile` necessario).

**Quick-win già applicati (sessione successiva):**
- P3.4 — etichetta contatore differenziata ricerca/navigazione (`mainView.ts` + chiave `counter_documents`).
- P3.1 — toast errore senza auto-dismiss + pulsante chiudi sempre presente (`toasts.ts`).
- P3.7 — drag allegati form: drop in-place senza re-render, indici via `data-idx`/`this` (`form.ts`).
- P2.6 — chip "Campi di base": spunta ✓ non-cromatica via CSS (`style.css`, regola `.custom-type-field:checked + div::before`).

---

## 🔲 P2 — Accessibilità (WCAG)

### ✅ P2.1 — Pulsanti icona senza nome accessibile — FATTO
`applicaTraduzioniHtml()` in `i18n.ts` ora gestisce `data-i18n-aria-label` (oltre a `-title`/`-placeholder`).
`aria-label` aggiunti in: `html/header.html` (nav tab, btn-tab-add, tutorial), `html/sidebar.html` (importa/aggiungi cartella/refresh storico/settings/cloud/issue + nuove chiavi `tooltip_import`/`tooltip_add_folder`/`tooltip_cloud_sync`), `mainView.ts` (export/delete card), `form.ts` (rinomina/rimuovi/remove riga), `modals.ts` (rinomina docs), `viewTrascrizione.ts` (back/collapse/B-I-U/liste/prev/next + nuova chiave `tooltip_back`), modali modulari `*.ts` (`x` chiusura via `data-i18n-aria-label="btn_close"`), `issueModal.ts`.
Fetch/Pull/Push e vault-switcher hanno già testo visibile (accessible name presente).

### ✅ P2.2 — `<img>` senza `alt` — FATTO
`alt` significativo (originalName) in `form.ts`, `modals.ts` (docs-modal), `attachmentsLogic.ts` (`#trasc-img-preview` impostato a runtime), `modals.ts apriModal` (`#modal-img`). `templates.ts` ignorato (codice morto).

### ✅ P2.3 — Modali senza semantica né focus management — FATTO
Nuovo modulo centralizzato `js/logic/a11yModal.ts` (incluso in `index.html` prima di `app.js`):
- imposta `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (id auto sul `.modal-title`/h2/h3) a runtime su ogni `.modal-window`;
- all'apertura salva `document.activeElement` (WeakMap per-modale) e sposta il focus sul primo focusabile; alla chiusura (anche se il modale è rimosso dal DOM) lo ripristina;
- focus-trap globale su Tab/Shift+Tab limitato al modale in cima allo stack (z-index);
- aggancio via MutationObserver sui `.modal-overlay` esistenti + observer su `body` per quelli iniettati/rimossi dinamicamente. `cloud-progress-overlay` escluso.
Nessuna modifica ai singoli file modale necessaria.

### ✅ P2.4 — Drag & drop senza alternativa da tastiera né touch — FATTO (parziale)
Aggiunti pulsanti "sposta su/giù" (con `aria-label`, chiavi `tooltip_move_up`/`tooltip_move_down`, disabilitati ai bordi) come alternativa accessibile al riordino allegati:
- `form.ts`: `window.spostaAllegatoForm(this, ±1)` + focus mantenuto sulla riga spostata.
- `modals.ts` (docs-modal): `window.spostaAllegatoDaModal(id, i, ±1)` + focus.
Le **card** (`mainView.ts`) NON sono riordinabili: il drag serve solo a spostarle tra archivi/cartelle e ha già l'alternativa da tastiera via menu contestuale (taglia/incolla). Nessun bottone necessario.
**Resta (lungo termine):** supporto touch via Pointer Events sul drag&drop esistente.

### ✅ P2.5 — Editor rich-text: stato attivo bottoni — FATTO (breve termine)
`viewTrascrizione.ts`: bottoni toolbar con `data-cmd` + `aria-pressed`, aggiornati via `window.updateToolbarState()` (al click e su `document.selectionchange` con `queryCommandState`, solo se la selezione è dentro l'editor). Stile visivo attivo in `style.css` (`#trascrizione-toolbar button[data-cmd][aria-pressed="true"]`).
**Resta (lungo termine):** sostituire `document.execCommand` deprecato (refactor significativo).

### ✅ P2.6 — Stato veicolato solo dal colore — FATTO
Chip "Campi di base": aggiunta spunta ✓ via CSS (`.custom-type-field:checked + div::before`). Le card selezionate hanno già il check nella checkbox. I chip sono checkbox reali (stato annunciato).

---

## 🔲 P3 — UX / consistenza

### ✅ P3.1 — Toast errore: auto-dismiss e senza chiudi — FATTO
`toasts.ts`: errori senza auto-dismiss + pulsante chiudi (`x`, con `aria-label`) sempre presente.

### ✅ P3.2 — Sync cloud inaccessibile su mobile/finestra stretta — FATTO
`html/header.html`: aggiunto `#cloud-menu-wrapper` (`md:hidden`, complementare a `#cloud-buttons-container` `hidden md:flex`) con bottone cloud + dropdown Fetch/Pull/Push (stesse funzioni). Toggle via `window.toggleCloudMenu(event)` (`app.ts`) con `aria-expanded` e chiusura su click esterno.

### ✅ P3.3 — Modali non chiudibili/cleanup su click backdrop — FATTO
`app.ts`: estratto helper condiviso `chiudiModaleTop(top)` + mappa `modalClosers`, usato sia dal dispatcher `Esc` sia dal click sul backdrop. Il click sullo sfondo ora instrada alle funzioni `chiudi*` dedicate (cleanup iframe/callback) invece di un semplice `add('hidden-tab')`. `welcome-modal` obbligatorio e `cloud-progress-overlay`/`cloud-auth-modal`/`email-prompt-modal` esclusi.

### ✅ P3.4 — Etichetta contatore fuorviante — FATTO
`mainView.ts`: usa `counter_documents` ("Documenti: N") in navigazione e `counter_documents_found` in ricerca.

### ✅ P3.5 — Campo filtro tag `readonly` — FATTO
`#global-tag-search` non è più `readonly`: ora è un filtro live della lista tag. `renderTagList()` (`sidebar.ts`) filtra `allTags` per `includes(testo)` e non sovrascrive più il valore dell'input; listener `input` in `app.ts` chiama `renderTagList()`. Placeholder aggiornato a "Filtra tag..." (chiave `placeholder_tags`, IT/EN). I tag selezionati restano evidenziati (amber) + bottone "Rimuovi filtri tag".

### ✅ P3.6 — Nessuno stato di caricamento su operazioni cloud async — FATTO
Centralizzato in `toggleSyncProgress()` (`driveLogic.ts`): durante un'operazione cloud disabilita tutti i bottoni in `#cloud-buttons-container` (Fetch/Pull/Push) + `opacity-50`/`cursor-not-allowed`, riabilitati quando l'overlay si chiude (già chiamato nei `finally` di pull/push/fetch-manuale).

### ✅ P3.7 — `renderAllegatiForm` ricostruiva l'intera lista a ogni drop — FATTO
`form.ts`: drop sposta il nodo in-place (no re-render); indici via `data-idx` risincronizzato e bottoni che passano `this`. NB: lo stesso pattern resta da applicare al docs-modal (`modals.ts`) se si vuole.

---

## Ordine consigliato prossima sessione
Tutte le voci P2/P3 sono ✅. Restano solo due refactor di **lungo termine**, opzionali:
- **P2.4 (touch):** supporto touch via Pointer Events sul drag&drop allegati.
- **P2.5 (lungo termine):** sostituire `document.execCommand` deprecato nell'editor trascrizione.

## Note tecniche
- Verificare sempre i `file:line` (possono essere disallineati).
- `templates.ts` è **codice morto** (`window.modalsHtml` non incluso in `index.html`): i modali vivi sono i file modulari `components/modals/*.ts` + `components/banners.ts`. Candidato a rimozione in cleanup separato — **non** editarlo per i fix.
- Temi scuri: `.dark-theme` (nero) e `.blue-dark-theme` (slate). Qualsiasi remap CSS va applicato a **entrambi**.
- `escapeHTML` è `window.escapeHTML` (utils.ts), accessibile come global bare; usarlo su ogni interpolazione in `innerHTML`/`title`.
- Build: `npm run start` (build-css + build-ts + electron). Check rapido: `npx tsc --noEmit`.
