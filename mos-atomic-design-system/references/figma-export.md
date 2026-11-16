# Figma export — optional, outside the ladder

Read this only when the user asks to get the tokens into Figma ("export to
figma", "figma variables", "tokens studio"). Most builds never need it.

**It never gates the ladder.** Nothing in Stages 0–6 depends on Figma, no stage
waits for it, and `verify-stage.ts` doesn't check it. The code (`tokens.css`)
is the source of truth; Figma receives a copy. If the two ever disagree, the
CSS wins and the export is re-run.

---

## Running it

```bash
bun $SKILL/scripts/export-figma.ts --target <repo>
```

It reads `design-system/tokens/tokens.json` (so run `build-index.ts` or
`export-tokens.ts` first if tokens changed) and writes:

```
design-system/tokens/figma/
├── README.md                 import steps for this system
├── brand.default.json        Brand collection — one mode
├── alias.default.json        Alias collection — one mode
├── mapped.light.json         Mapped collection — light mode
├── mapped.dark.json          Mapped collection — dark mode
├── responsive.desktop.json   Responsive collection — desktop mode
└── responsive.mobile.json    Responsive collection — mobile mode
```

One file per collection × mode (`<collection>.<mode>.json`), in W3C DTCG
format. Figma variables have no duration, easing or shadow types, so those
tokens are left out and listed in `figma/README.md`; rem values are converted
to px (1rem = 16px). Run `build-index.ts` afterwards so the README file index
picks up the new folder. A brand with a single
theme gets only the one mapped file. References between tiers are kept as
`{alias.primary.default}`-style references rather than flattened, so the
tier structure survives the import.

Record the run under `## Unreleased` in `CHANGELOG.md` ("Figma export
regenerated") and don't bump the version — nothing in the system changed
(`output-structure.md` has the bump table).

---

## How the tiers map to Figma

| Tier (`tokens.css`) | Figma collection | Modes | Picker visibility |
| --- | --- | --- | --- |
| Brand | Brand | one | hidden — except the number scale if designers set padding/gap by hand |
| Alias | Alias | one (or one per brand in a branded house) | colour scales hidden; border width and radius visible |
| Mapped | Mapped | light, dark (whichever the system has) | visible — this is what designers pick from |
| Responsive | Responsive | desktop, mobile | visible |

This mirrors the course's Figma setup: designers should only ever see the
tokens components are allowed to use, the same rule `verify-stage.ts` enforces
in CSS.

## Importing

Import steps change as Figma and plugins update, so describe them generically
and check the current UI:

1. **Figma's native variable import** (preferred when available). Figma can
   import DTCG-format JSON into variable collections. Create or select each
   collection, import the matching file for each mode, and confirm aliases
   resolved (an unresolved reference usually shows as a raw value or a warning).
   Import Brand first, then Alias, then Mapped and Responsive, so references
   have something to point at.
2. **A token plugin as fallback** — e.g. Tokens Studio. Load the files as token
   sets, one per collection × mode, and let the plugin create variables and
   collections from them.

The generated `figma/README.md` repeats these steps with this system's actual
collection and mode names.

## Scoping after import

The first three are from the course; they keep designers' pickers clean:

- **Hide the Brand collection** from publishing and pickers, except the number
  scale if it's used directly for padding and gap.
- **Hide Alias colour scales** from pickers; they exist so Mapped can point at
  them.
- **Scope radius tokens to corner radius only** and **border-width tokens to
  stroke only**, so they can't be picked for the wrong property.
- **Colour tokens** *(skill addition — the course scopes only radius and
  border width)*: scope text tokens to text fill, surface to frame/shape fill,
  border to stroke, where Figma's scoping allows it.

## What this doesn't do

- No sync back from Figma to code. Changes go into `tokens.css` and get
  re-exported.
- No components, text styles or effect styles — variables only. Text styles
  (H1–H6, body sizes) can be built in Figma by binding the Responsive and font
  variables, following the course's text-styles chapter.
- No Figma publishing. Publishing a library needs a paid Figma plan and is the
  user's call.
