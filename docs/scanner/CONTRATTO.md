# ArchiView Scanner — contratto del lotto

**Versione del contratto: 1** (`"versione": 1` in `lotto.json`)

Questo documento è la fonte di verità sul formato che l'app Android **ArchiView Scanner**
consegna ad ArchiView desktop. Il codice che lo applica è uno solo:
[`src/shared/scannerLotto.ts`](../../src/shared/scannerLotto.ts), usato sia dal desktop sia
dall'app. Se codice e documento divergono è un bug: si correggono insieme, nello stesso commit.

## 1. Il lotto

Un **lotto** è una sessione di scatto: una o più pagine destinate allo stesso fine (nessuno,
una scheda esistente, una scheda nuova).

```
<id>/
  p0001.jpg
  p0002.jpg
  …
  lotto.json      ← scritto PER ULTIMO
```

- **`lotto.json` è il segnale di completezza.** Una cartella senza `lotto.json` è un lotto
  ancora in caricamento: chi riceve non la legge, non la scarica e non la cancella.
- Il mittente carica tutte le pagine, poi `lotto.json`. Non modifica più un lotto dopo aver
  scritto `lotto.json`.
- I file della cartella che non sono elencati in `pagine` vengono ignorati.

### 1.1 Id

`AAAAMMGG-hhmmss-xxxx`, es. `20261005-143022-k3f9`.

- Data e ora **locali** del telefono all'apertura del lotto; devono essere una data e un'ora
  esistenti.
- `xxxx`: 4 caratteri casuali in `[0-9a-z]` (minuscoli).
- È anche il nome della cartella. Un lotto il cui `id` non coincide con il nome della
  cartella viene rifiutato (`id_diverso`).

### 1.2 Nomi delle pagine

`p` + 4 cifre + `.jpg` | `.jpeg` | `.png`, tutto minuscolo (`p0001.jpg` … `p9999.png`).
Mai percorsi, barre, `..` o maiuscole. L'ordine delle pagine è quello dell'array `pagine`,
non quello dei nomi.

## 2. `lotto.json`

UTF-8, al più 2 MB.

```json
{
  "formato": "archiview-scanner/lotto",
  "versione": 1,
  "id": "20261005-143022-k3f9",
  "creatoIl": "2026-10-05T14:30:22+02:00",
  "dispositivo": "Pixel 8",
  "titolo": "Podestà, reg. 12",
  "nota": "cc. 1-40, legatura fragile",
  "destinazione": { "tipo": "nessuna" },
  "pagine": [
    {
      "file": "p0001.jpg",
      "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "byte": 4823112,
      "modalita": "documento",
      "larghezza": 3024,
      "altezza": 4032,
      "etichetta": "12v",
      "doppia": { "lato": "sx" }
    }
  ]
}
```

| Chiave | Obbligatoria | Regola |
|---|---|---|
| `formato` | sì | esattamente `archiview-scanner/lotto` |
| `versione` | sì | intero; questa specifica è la `1` |
| `id` | sì | §1.1 |
| `creatoIl` | sì | ISO 8601 **con fuso** (`Z` o `±hh:mm`), es. `2026-10-05T14:30:22+02:00` |
| `dispositivo` | no | stringa, ≤ 100 caratteri |
| `titolo` | no | stringa, ≤ 200 caratteri |
| `nota` | no | stringa, ≤ 2000 caratteri |
| `destinazione` | sì | §2.2 |
| `pagine` | sì | da 1 a 2000 elementi, §2.1 |

Le stringhe facoltative vengono ripulite dagli spazi esterni; vuote equivalgono ad assenti.

### 2.1 Pagina

| Chiave | Obbligatoria | Regola |
|---|---|---|
| `file` | sì | §1.2, unico nel lotto |
| `sha256` | sì | 64 caratteri esadecimali (normalizzati in minuscolo) |
| `byte` | sì | intero, da 1 a 200 MB (209 715 200) |
| `modalita` | sì | `documento` (ML Kit: bordi, prospettiva) · `grezza` (nessuna correzione) · `raffica` |
| `larghezza`, `altezza` | no | interi in pixel, da 1 a 30 000 |
| `etichetta` | no | stringa ≤ 32 caratteri, es. `12v` |
| `doppia` | no | `{ "lato": "sx" \| "dx" }`: metà di una pagina doppia divisa sulla piega |

### 2.2 Destinazione

Sempre un oggetto con `tipo`:

- `{ "tipo": "nessuna" }` — da smistare sul desktop.
- `{ "tipo": "esistente", "schedaId": "…" }` — aggiungere le pagine a una scheda esistente
  (`schedaId` non vuoto, ≤ 200 caratteri).
- `{ "tipo": "nuova", "tipoDocumento": "…", "cartella": "…", "campi": { … } }` — bozza di
  una scheda nuova.
  - `tipoDocumento`: obbligatorio, non vuoto, ≤ 200 caratteri.
  - `cartella`: facoltativa, ≤ 500 caratteri.
  - `campi`: facoltativo; oggetto di al più 100 voci. Chiavi `[A-Za-z][A-Za-z0-9_]*`,
    valori **solo stringhe** (≤ 10 000 caratteri). I valori vuoti vengono scartati.
  - **Chiavi riservate** (errore `campo_riservato`): `id`, `cartella`, `tipoDocumento`,
    `allegati`, `allegato`, `allegatoTipo`, `lastModified`, `modificatoDa`, `creatoDa`,
    `trascrizione`, `schemaVersion`, `relazioni`, `campiPropri`, `ordineCampi`,
    `provenienza`, `rimandiEsterni`, `tags`, `constructor`, `prototype`.
    `segnatura` **non** è riservata: si compila dal telefono.

Chiavi non previste dalla destinazione del suo `tipo` (es. `campi` su `esistente`) vengono
scartate.

### 2.3 Chiavi sconosciute e normalizzazione

Il validatore restituisce una **copia normalizzata** con le sole chiavi di questa
specifica, in ordine fisso. Le chiavi sconosciute non sono un errore: vengono eliminate.
Il desktop scrive su disco la copia normalizzata, mai il JSON ricevuto.

### 2.4 Versioni

- Una `versione` maggiore di quella supportata è rifiutata (`versione_futura`): il desktop
  va aggiornato. Non si legge "a metà" un lotto di una versione successiva.
- Aggiungere una chiave **facoltativa** che le versioni precedenti possono ignorare non
  richiede una nuova versione. Tutto il resto (nuove chiavi obbligatorie, significato
  diverso di una chiave esistente, limiti più stretti) sì.

## 3. Codici di errore

Il validatore non produce frasi: `{ codice, percorso }`, con `percorso` del tipo
`pagine[3].sha256` o `destinazione.campi.note`. Sono raccolti tutti, non solo il primo
(tranne per `non_oggetto`, `formato_sconosciuto`, `versione_*`, che fermano subito).

`non_oggetto` · `formato_sconosciuto` · `versione_futura` · `versione_non_valida` ·
`id_non_valido` · `data_non_valida` · `testo_non_valido` · `destinazione_non_valida` ·
`destinazione_tipo_sconosciuto` · `scheda_id_non_valido` · `tipo_documento_non_valido` ·
`campi_non_validi` · `troppi_campi` · `campo_chiave_non_valida` · `campo_riservato` ·
`campo_valore_non_valido` · `pagine_non_valide` · `pagine_vuote` · `troppe_pagine` ·
`pagina_non_valida` · `file_non_valido` · `file_duplicato` · `sha256_non_valido` ·
`byte_non_validi` · `modalita_non_valida` · `dimensione_non_valida` · `doppia_non_valida`

Errori della **ricezione** (desktop, `src/main/scanner/arrivoLotti.ts`), per lotto:
`id_non_valido` (nome di cartella) · `id_duplicato` · `manifest_non_leggibile` ·
`manifest_troppo_grande` · `manifest_non_json` · `manifest_non_valido` (dettaglio: gli
errori del validatore) · `id_diverso` · `pagina_non_scaricata` · `byte_diversi` ·
`sha256_diverso` · `errore_locale`.

## 4. Canali

Stesso lotto, due strade.

### 4.1 Google Drive (principale)

```
ArchiView/
  Scansioni in arrivo/
    lotti/<id>/…
    archiview-scanner-config.json     ← desktop → telefono (Fase 3, formato da definire)
```

- Scope `drive.file`, stesso progetto Google Cloud del desktop.
- **Telefono:** pagine con sessione resumable; salta le pagine già presenti con la stessa
  dimensione, elimina le copie parziali; `lotto.json` per ultimo (multipart).
- **Desktop:** per ogni cartella con `lotto.json`: valida, scarica in una cartella
  temporanea, verifica `byte` e `sha256` di ogni pagina, scrive il manifest normalizzato,
  rinomina in `<archivio>/.archiview/scanner/arrivo/<id>/`; **solo dopo** sposta la
  cartella del lotto nel cestino di Drive. Un lotto già presente in locale non si
  riscarica: si cestina soltanto. Un lotto che fallisce non blocca gli altri e resta su
  Drive.

### 4.2 Wi-Fi diretto (Fase 2)

- Il desktop ascolta sulla rete locale **solo** mentre la finestra "Ricevi dal telefono" è
  aperta.
- QR: `archiview-scanner://abbina?h=<ip>&p=<porta>&t=<token monouso>`.
- `PUT /lotti/<id>/<file>` per ogni pagina, poi `PUT /lotti/<id>/lotto.json`, che risponde
  `201` solo se il lotto è valido e completo. `Authorization: Bearer <token>`; il token
  scade alla chiusura della finestra.
- La ricezione usa la stessa logica del canale Drive.

## 5. Storia delle versioni

| Versione | Data | Modifiche |
|---|---|---|
| 1 | 2026-10-05 | Prima versione. |
