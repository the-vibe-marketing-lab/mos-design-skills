# {{BRAND_NAME}} Design System

<!--
  START HERE. Entry point for people and AI agents.
  Lives at design-system/README.md. Keep it under ~150 lines.
  Hand-written sections are yours to edit. The sections between
  BEGIN/END GENERATED markers are rebuilt by scripts/build-index.ts —
  do not hand-edit them.
-->

**Version:** {{VERSION}} · **Status:** {{STATUS}} · **Themes:** {{THEMES}}
(default first) · **Brand source:** `{{BRAND_DOC_PATH}}`

{{ONE_PARAGRAPH_SUMMARY}}

<!-- Two or three sentences: what the brand is, what this system covers,
     and what it deliberately doesn't (point at brief §5). -->

Built with Atomic Design: foundations (tokens) → atoms → molecules →
organisms → templates → pages. Every component has an ID (`A-01`,
`M-03`, …) and one spec file.

---

## Start here

1. Read the **non-negotiable rules** below.
2. **Tokens:** import `tokens/tokens.css`. Look names up in
   `tokens/TOKENS.md`. Use only mapped tokens (`--color-*`, `--space-*`,
   `--radius-*`, `--border-width-*`, `--focus-ring-*`, `--shadow-*`,
   `--duration-*`, `--ease-*`, `--font-*`, `--container-*`, `--gutter`,
   `--section-space`) and responsive tokens (`--text-*`).
3. **Components:** find the ID in `components/INDEX.md`, open its spec,
   then the specs listed in its `composes:`. Start from the spec's Markup
   section.
4. Prefer components with `status: approved`. `legacy` ones are usable
   but predate v2 sign-off; `draft` may change.
5. Need something that doesn't exist? Follow the change protocol in
   `rules/RULES.md` — don't invent it locally.

To see everything rendered, open `reference/index.html` in a browser.
Inspiration screenshots from discovery are in `reference/snapshots/`.

---

## Consuming the tokens

{{TOKEN_IMPORT_INSTRUCTIONS}}

<!-- Say exactly how the site gets the tokens. Either:
       @import "../design-system/tokens/tokens.css";   (path from the site's CSS)
     or, if the framework can't import from outside its source folder,
     name the sync step (script or build copy) and where the copy lands,
     and say "never edit the copy".
     Themes: set data-theme="dark" (or "light") on <html>; unset follows
     the OS where both themes are supported.
     If the site serves the reference at an old URL via a sync script,
     name the script here. If reference pages use site-absolute asset
     paths (/fonts/...), say they only render when served, not over
     file://. -->

Machine-readable tokens (W3C DTCG): `tokens/tokens.json`.

---

## Non-negotiable rules

<!-- The canonical rules list. Other docs point here rather than
     restating it. -->

1. Mapped and responsive tokens only in component CSS — never `--brand-*`
   or `--alias-*`.
2. No raw colour, font or size values outside `tokens/tokens.css`.
3. One focus ring everywhere: `--focus-ring-width` outline in
   `--color-border-focus`, offset `--focus-ring-offset`.
4. Every interactive component has hover, focus and disabled states;
   disabled looks the same across types.
5. Interactive targets at least 44×44px, via `var(--size-touch-target)`.
   Body text at least 16px.
6. WCAG AA contrast in every theme.
7. One job per molecule. Two jobs means two molecules.
8. Promote only what repeats in at least two contexts.
9. IDs are stable — never renumbered or reused.
10. Changes go through `rules/RULES.md`: tokens, specs, reference,
    index and changelog move together.

{{BRAND_SPECIFIC_RULES}}

<!-- Add the brand's own guardrails from RULES.md, one line each, if they
     are the kind an implementer will trip over (e.g. "one accent per
     visual surface"). Keep the total list short. -->

---

## Files

<!-- One line per top-level file; components/ appears as counts plus a
     link to components/INDEX.md, never one line per spec. -->
<!-- BEGIN GENERATED: file-index — scripts/build-index.ts, do not hand-edit -->
{{FILE_INDEX}}
<!-- END GENERATED: file-index -->

---

## Inventory

<!-- BEGIN GENERATED: inventory — scripts/build-index.ts, do not hand-edit -->
{{INVENTORY}}
<!-- END GENERATED: inventory -->
