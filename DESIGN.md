# Design

Visual system of the ArchiView renderer. Decisions taken in the front-end audit (October 2026,
plan closed on 9 October; the commits of phases 1–7 carry the details). The source of truth for values is `src/renderer/css/style.css`; this file says
what the values are for and which rules a change must respect.

## Themes and tokens

Four themes, all first-class: Clear Blue (`:root`), Dark (`.dark-theme`), Blue Dark
(`.blue-dark-theme`), Amber Light (`.amber-light-theme`). Components read **only** semantic
tokens; a hex value or a Tailwind colour in a component is a bug waiting for the next theme.

| Role | Tokens | Use |
|---|---|---|
| Accent | `--color-primary`, `-hover`, `-light`, `-border`, `--color-on-primary` | primary actions, selection, focus ring, progress, accent text |
| Surfaces | `--color-bg-base`, `-panel`, `-hover`, `-sidebar` | page, panels/modals, hover/secondary fill, sidebar |
| Text | `--color-text-main`, `-secondary`, `-muted`, `-placeholder` | hierarchy; all ≥ 4.5:1 on every surface of the theme |
| Lines | `--color-border`, `-border-light`, `-border-input` | dividers, light dividers, form controls (≥ 3:1, WCAG 1.4.11) |
| Meaning | `--color-danger*`, `--color-success*`, `--color-info*`, `--color-warning*` | destructive / done / informative / caution states only |

**Accent = the theme's primary.** Amber in Amber Light, blue in Clear Blue and Blue Dark, orange
in Dark. There is no fixed "brand amber": the historical `amber-*` utilities are remapped to the
accent tokens. Accent *text* uses `--color-primary-hover` (it lightens in dark themes, so it
holds ≥ 4.5:1 everywhere). Text on an accent fill uses `--color-on-primary`, never `#fff`.

Red, green and blue are **meanings**, not decoration: danger, success, information. The Hub
"shared archive" identity uses the success family (`.riquadro-successo`, `.tessera-successo`),
the Drive backup identity the info family (`.riquadro-info`, `.tessera-info`).

## Tailwind utilities and the remap

`style.css` sits outside `@layer`, so its rules beat Tailwind utilities. Two consequences:

1. The recurring colour utilities (`stone-*`, `amber-*`, `red-*`, `emerald-*`/`green-*`,
   `blue-*`) are remapped there to tokens with `!important`. A remapped utility is safe in
   markup; anything else is not. New UI should use the semantic classes
   (`.testo-successo`, `.testo-pericolo`, `.testo-accento`, `.testo-info`, `.stato-badge.is-*`,
   `.riquadro-*`) rather than rely on the remap.
2. Utilities next to `.btn-*` are inert (the button class wins). `test/btnUtility.test.js`
   forbids them; destructive ghost buttons use `.btn-danger-ghost`.

`dark:` variants apply to both dark themes, but they never fix a colour the remap does not
cover: prefer a token class to a `dark:` pair.

## Shape

- **Radius 0** everywhere (`--radius-sm: 0`; `rounded`, `rounded-sm…2xl` are forced to 0).
  `rounded-full` is kept only for dots, avatars, toggles, spinners and numeric counters; text
  labels are square.
- No decorative side stripes on cards. Coloured left bands exist only where they carry data
  (tag colours in the sidebar, own-field marker in the form).
- Flat surfaces: panels, modals and cards have no shadow beyond a hover lift. Modals are a
  hairline-bordered panel on a plain scrim (no blur); the title is ink, not accent.
- Every modal has the same frame: `.modal-header` with the title and, when useful, one line of
  `.modal-sottotitolo` (shelfmarks and paths in mono), an optional × on the right; `.modal-body`;
  `.modal-footer.modal-footer-bar` outside the body with the primary on the right. No icon in the
  title, no coloured header: red is only the destructive button.
- Lists inside modals are hairline rows (`.tag-manager-row`, `.riga-filetto`, `.cestino-riga`),
  not boxes; option cards are `.scelta-riga` (accent tint only on the chosen one); a bulk
  selection shows `.barra-selezione` under the header.
- The bottom confirmation (`mostraBottomConfirm`) is an ink bar at the bottom of the window in the
  light themes and a dark raised panel in the dark ones (no light fill in a dark theme).
- Context menus (`.ctx-menu`) are flat panels with hairline border; headings are sentence case;
  a menu item can carry a tag colour square and a check for the current choice.

## Type

- Three local typefaces (`css/fonts`, OFL), each with one job, read through `--font-sans`,
  `--font-serif`, `--font-mono`: **IBM Plex Sans** for controls and UI text (the `body` default),
  **Source Serif 4** for content (view titles `h1`, record values, transcription), **IBM Plex Mono**
  for shelfmarks, normalised dates, counts and shortcuts. Junicode stays as a transcription choice
  and as the serif fallback for medieval abbreviation glyphs.
- Palette "paper and ink": warm neutral grounds, ink text, hairline dividers
  (`--color-border`/`-light`), input borders at ≥ 3:1 (`--color-border-input`). Reference
  mock-ups: Claude Design canvas linked from `PIANO-NUOVA-UI.md`.
- Minimum **11 px** for any informative text (labels, badges, hints, metadata). 10 px only for
  numeric counters and single glyphs in fixed-size badges. No 9 px.
- Uppercase + letter-spacing only for short status badges.

## Motion

- Theme cross-fade only while switching (`:root.cambio-tema`, 300 ms), never on boot.
- `prefers-reduced-motion`: no movement (translate/scale), but short opacity fades stay, because
  they orient (a modal appearing, a toast leaving).

## Verification

Contrast and theme leaks are measured on the real rendering, not read from source:
`e2e/a11y-contrast.spec.ts` (7.1: text, input borders, focus ring, light backgrounds in dark
themes, across `e2e/a11ySchermate.ts`) and `e2e/a11y-modali-rari.spec.ts` (sync, history,
sharing with a Hub, cloud states). A new screen goes into one of those lists.

Known limit: the scanner measures text, not icon-only buttons.

Impeccable detector false positives (verified, no action): `gray-on-color` on `text-stone-*`
over `bg-amber-50/100` (remapped and measured); `broken-image` in `imagePdfModal.ts` and
`viewTrascrizione.ts` (`src` set at runtime); `overused-font` in `vendor/driver.css` (overridden
by `input.css`); `side-tab` on sidebar tags (the band is data). Progress bars fill with `.barra-scala`
(`transform: scaleX`), never by animating `width`; resizable panels have no width transition.
