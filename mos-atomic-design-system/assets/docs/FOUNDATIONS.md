# {{BRAND_NAME}} — Foundations

<!--
  Written at Stage 1. Lives at design-system/foundations/FOUNDATIONS.md.
  The prose-and-tables twin of reference/foundations.html, for readers
  who won't open the HTML. Token NAMES only here — values live in
  tokens/tokens.css and are listed in the generated tokens/TOKENS.md.
  Same eight sections as the page, same order.
-->

**Tokens:** `tokens/tokens.css` (canonical) · `tokens/TOKENS.md` (lookup
table) · `tokens/tokens.json` (DTCG)
**Themes:** {{THEMES}} — default first

---

## 1. Brand principles

{{PRINCIPLES_PROSE}}

---

## 2. Colour

### How the tiers work here

Brand scales (raw) → alias roles → mapped tokens (what components use).
Components never reference brand or alias tokens.

### Brand scales

| Hue | Given hex → step | Steps | Aliased as |
| --- | ---------------- | ----- | ---------- |
{{SCALE_ROWS}}

<!-- e.g. | blue | #2563EB → 600 | 50–900 (others derived) | primary | -->

### Mapped colour — what to use for what

| Job | Token | Notes |
| --- | ----- | ----- |
{{MAPPED_COLOUR_ROWS}}

<!-- One row per mapped token group worth explaining: heading/body/muted
     text, action surfaces and their hover, status surfaces for alerts,
     focus border, -fixed tokens and why they don't change per theme. -->

### Contrast

Checked for every text-on-surface pair the system allows, per theme.

| Foreground | Background | Theme | Ratio | Passes |
| ---------- | ---------- | ----- | ----- | ------ |
{{CONTRAST_ROWS}}

---

## 3. Typography

Faces: {{FACES}}. Scale: base {{TYPE_BASE}}, ratio {{DESKTOP_RATIO}}
desktop / {{MOBILE_RATIO}} mobile, rounded to multiples of 4.

| Style | Token prefix | Desktop size / leading | Mobile size / leading | Weight | Use for |
| ----- | ------------ | ---------------------- | --------------------- | ------ | ------- |
{{TYPE_ROWS}}

Body sizes don't change on mobile; only headings shrink. Body copy never
below 16px.

---

## 4. Spacing

Number scale on a 4px grid; components use `--space-1` … `--space-12`.

{{SPACING_NOTES}}

---

## 5. Grid and layout

{{GRID_NOTES}}

<!-- Columns, gutter (--gutter), containers (--container-wide,
     --container-reading), section rhythm (--section-space), and what it
     collapses to at narrow widths. -->

---

## 6. Shape and elevation

- Radii: {{RADII}} — `round` for pills and circles.
- Border widths: {{BORDER_WIDTHS}}.
- Focus ring: `--focus-ring-width` outline in `--color-border-focus`,
  offset `--focus-ring-offset`, identical on every focusable element.
- Elevation: {{ELEVATION}} <!-- or "none — this brand is flat", stated -->

---

## 7. Motion

{{MOTION_NOTES}}

Durations are zeroed under `prefers-reduced-motion`.

---

## 8. Accessibility

{{A11Y_RULES}}

<!-- Testable rules: AA contrast in every theme (table above), one visible
     focus ring, 44×44 targets (--size-touch-target), 16px body minimum,
     status borders on controls at 3:1, reduced motion,
     semantic structure. -->
