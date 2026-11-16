# {{BRAND_NAME}} — Design System Brief

<!--
  Produced by /mos-atomic-design-system Stage 0 (Discover).
  Lives at design-system/brief/DESIGN-BRIEF.md.
  This is the contract every later stage is judged against. When a
  reviewer asks "why is the accent this blue" the answer lives here,
  not in someone's memory.
-->

- **Target repo:** `{{TARGET_REPO}}`
- **Brand source:** `{{BRAND_DOC_PATH}}` {{BRAND_DOC_NOTE}}
- **Created:** {{DATE}}
- **Status:** {{STATUS}}

---

## 0. Strategic direction

{{STRATEGIC_DIRECTION}}

<!-- One paragraph. What should someone FEEL in the first two
     seconds, and what is this brand deliberately not? If you can't
     write this without hedging, the discovery isn't finished. -->

---

## 1. Inspiration map

What each reference contributes, and what we deliberately don't take.
The "leave" column matters more than the "take" column — it is what
stops the system becoming a collage of other people's decisions.

| Source | Snapshot | What we take | What we leave |
| ------ | -------- | ------------ | ------------- |
{{INSPIRATION_ROWS}}

<!-- Snapshot paths: ../reference/snapshots/<name>.png -->

**Sources consulted**

- Direct URLs snapshotted via Interceptor: {{URL_COUNT}}
- Mobbin pattern references: {{MOBBIN_COUNT}} {{MOBBIN_NOTE}}
- Brand documents read: {{BRAND_DOC_COUNT}}

---

## 2. Brand principles

{{PRINCIPLES}}

<!-- 5-7 maximum, each a rule you could actually fail. "Be modern"
     is not a principle. "One accent per visual surface" is: you can
     look at a page and say whether it holds. -->

---

## 3. Visual contract

These are the decisions Stage 1 compiles into `tokens/tokens.css` (four tiers:
brand → alias → mapped → responsive; see `references/token-architecture.md`
in the skill). Every value must appear here before it appears in code.

### 3.1 Colour

**Hues.** One row per hue the brand uses, plus the neutral and the status
hues. Place each given hex at the step its lightness implies — a mid-tone at
500, a deep navy at 800, a pale tint at 100 — not automatically at 500. Stage 1
derives the remaining 50–900 steps around the given ones.

| Hue (brand name) | Role(s) it will alias to | Given hex | Sits at step | Source |
| ---------------- | ------------------------ | --------- | ------------ | ------ |
{{HUE_ROWS}}

<!-- Example rows. Mark each hue given / derived / default — tokens.css
     carries the same /* given */ /* derived */ /* default */ comments.
| blue | primary | #1E3A8A | 800 | given: brand-guidelines.md §Colour |
| stone | neutral | #78716C | 500 | sampled from logo.svg (provisional) |
| red | error | — | — | default: skill status hue, none given |
-->

**Themes.** Default: {{DEFAULT_THEME}} · Also supported: {{OTHER_THEMES}}

<!-- light or dark default is a real fork — it changes every contrast
     calculation. Name any colour that must NOT change between themes
     (gets the -fixed suffix). -->

{{COLOUR_NOTES}}

### 3.2 Typography

{{TYPE_CONTRACT}}

- **Faces:** display {{DISPLAY_FACE}} · body {{BODY_FACE}} · mono {{MONO_FACE}}
- **Weights used:** {{WEIGHTS}}
- **Type scale:** base {{TYPE_BASE}}, desktop ratio {{DESKTOP_RATIO}}
  (default Major Third 1.25), mobile ratio {{MOBILE_RATIO}}; sizes rounded to
  multiples of 4. Body never below 16px.

### 3.3 Space, grid and shape

{{SPACE_CONTRACT}}

<!-- The number scale is on a 4px grid. Record radii (none/sm/md/lg/round),
     border widths, container widths, gutter, and whether the brand uses
     elevation at all. Brand-given sizes that break the 4px grid are used
     as given — list each deviation here with its source. -->

### 3.4 Motion

{{MOTION_CONTRACT}}

### 3.5 Accessibility baseline

{{A11Y_CONTRACT}}

<!-- Default floor, tighten as needed: visible keyboard focus on
     every interactive element (one identical ring); WCAG AA contrast
     in every theme; >=44px targets; body text >=16px; semantic
     headings and links; reduced-motion honoured; nothing essential
     hidden without JS. -->

---

## 4. Ladder inventory

The planned shape of the system. Counts are estimates at Stage 0 and
get locked as each stage is approved — `verify-stage.ts` checks the
built stage against whatever is recorded here, and each locked ID gets a
spec file under `components/`.

- **Atoms (A-nn):** {{ATOM_PLAN}}
- **Molecules (M-nn):** {{MOLECULE_PLAN}}
- **Organisms (O-nn):** {{ORGANISM_PLAN}}
- **Templates (T-nn):** {{TEMPLATE_PLAN}}
- **Pages (P-nn):** {{PAGE_PLAN}}

---

## 5. Explicitly out of scope

{{OUT_OF_SCOPE}}

<!-- Name what this system will NOT cover, and where that thing
     lives instead. Unscoped edges are where design systems rot. -->

---

## 6. Temporary choices

Placeholders standing in for decisions not yet made. These are
implementation conveniences, **not** brand approvals — flag them at
every review so they don't calcify by default.

{{TEMPORARY_CHOICES}}

---

## 7. Open decisions

Questions that need {{PRINCIPAL}}'s answer before the affected stage
can be approved.

{{OPEN_DECISIONS}}
