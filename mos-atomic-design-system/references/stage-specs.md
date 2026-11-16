# Stage specs — what each rung produces and how it's judged

One section per build stage. Read the section for the stage you're on; you
don't need the rest.

Paths below are v2 (`schemaVersion: 2`), relative to `<repo>/design-system/`.
When extending a v1 system built by the old skill, produce the same content in
its existing layout — the v1 path table is in `output-structure.md`, and the
v1-only criteria are listed at the end of this file. A legacy hand-built system
(no `STATE.json`) is extended in its own files; only the generic checks apply
(see the end of this file).

**Stage numbers vs page numbers.** There are seven *build* stages (0–6) and
eight *reference pages* (00–07). They don't line up one-to-one because Stage 0
produces the system map and Stage 6 produces three artifacts. Mapping:

| Stage | Reference pages (`reference/`) | Docs |
| --- | --- | --- |
| 0 Discover | `index.html` (00) | `brief/DESIGN-BRIEF.md`, `STATE.json`, `README.md` (skeleton), `CHANGELOG.md` |
| 1 Foundations | `foundations.html` (01) | `tokens/tokens.css` (+ generated `tokens.json`, `TOKENS.md`), `foundations/FOUNDATIONS.md` |
| 2 Atoms | `atoms.html` (02), `icons.html` (02A) | `components/atoms/A-nn-*.md` |
| 3 Molecules | `molecules.html` (03) | `components/molecules/M-nn-*.md` |
| 4 Organisms | `organisms.html` (04) | `components/organisms/O-nn-*.md` |
| 5 Templates | `templates.html` (05) | `components/templates/T-nn-*.md` |
| 6 Pages | `pages.html` (06), `pages/P-nn-<slug>.html`, `rules.html` (07) | `rules/RULES.md`, final `README.md` |

Every stage ends the same way on approval: run `build-index.ts`, add a
`CHANGELOG.md` entry, bump `STATE.json` `version`. That's spelled out once at
the bottom rather than repeated per stage.

---

## Stage 0 — Discover

**Produces:** `brief/DESIGN-BRIEF.md`, `STATE.json`, `README.md` (skeleton from
`assets/docs/README.md`), `CHANGELOG.md`, `reference/index.html`,
`reference/styles.css` (chrome only), `tokens/tokens.css` (placeholders
unresolved).

Read `brand-discovery.md` and `inspiration-research.md` for the two halves of
this stage.

**Acceptance criteria**

- Brand source resolved and confirmed by the user, or the interview completed.
- Inspiration Map has a row per source with **both** take and leave filled in.
- Strategic direction written as one paragraph that names what this brand is
  *not*.
- Brief §3 names every brand hue and the step each given hex sits at (or says
  it's to be derived), the default theme and whether a second theme is wanted,
  and the type-scale ratio. These are the inputs Stage 1 compiles.
- Ladder inventory has planned counts for every level (estimates are fine —
  they get locked as each stage is approved).
- Out-of-scope section names what this system won't cover and where that lives.
- Open decisions listed, with the stage each one blocks.

**With approvals waived** (see "Waived approvals" below), the interview is
answered from the request and the evidence instead of the user. Each such
answer goes into the brief's open decisions marked *provisional — not
confirmed by the user*, with the stage it would change, so the end-of-run
review knows exactly which calls are guesses.

**The failure mode:** starting to design during discovery. Resist it. The
moment you pick a hex here, the sign-off on Foundations stops meaning anything
because the decision was already made without evidence.

---

## Stage 1 — Foundations

**Produces:** `tokens/tokens.css` (fully resolved), `tokens/tokens.json` and
`tokens/TOKENS.md` (generated), `foundations/FOUNDATIONS.md`,
`reference/foundations.html` (01).

Compile the brief's §3 visual contract into the four tiers. Read
`token-architecture.md` first — it has the scale-building, theming and
type-scale procedures. `assets/tokens.css` is the skeleton; every
`{{PLACEHOLDER}}` must be replaced with a value traceable to the brief.

Before showing the stage, run `bun $SKILL/scripts/export-tokens.ts --target
<repo>` so `tokens.json` and `TOKENS.md` exist for the review. (`build-index.ts`
re-runs it at approval.)

**Sections on the page** — eight, numbered `01.1`–`01.8`:

1. Brand principles — the rules from the brief, as prose, not bullets alone
2. Colour — every brand scale as a strip (given steps marked), then the mapped
   tokens per theme with the *job* each does
3. Typography — every face at real display size, with the type scale table
   (desktop and mobile)
4. Spacing — the scale rendered as actual bars, not a list of numbers
5. Grid — the 12-column grid shown live, and what it collapses to
6. Shape and elevation — radii, border widths, focus ring, and whether
   elevation exists at all
7. Motion — durations and easing, with something that actually moves
8. Accessibility — the floor, stated as testable rules, with the contrast table

`FOUNDATIONS.md` carries the same eight sections as prose and tables, for
readers who won't open the HTML.

**Acceptance criteria**

- `tokens.css` has the four `@tier` markers — brand, alias, mapped, responsive —
  in that order.
- **Full scales.** Every brand hue, the neutral and the status hues have steps
  50–900. Given hexes sit at their natural step and are commented
  `/* given */`; skill defaults `/* default */`; every other step
  `/* derived */`.
- **Tiers respected** per the one exceptions list in `token-architecture.md`:
  raw literals only in Brand and Responsive; colour, border width and radius go
  Mapped → Alias → Brand without skipping; only mapped `--space-*`,
  `--duration-*`, `--ease-*`, `--shadow-*`, `--font-*` (and `--container-*`)
  read Brand directly. No roles in Brand.
- **Required mapped tokens exist** — exactly this set at minimum:
  - text: `action`, `action-hover`, `disabled`, `on-action`, `placeholder`
  - icon: `action`, `disabled`, `on-action`
  - surface: `action`, `action-hover`, `disabled`
  - border: `action`, `action-hover`, `disabled`, `focus`
  - text, surface and border for each of `error`, `success`, `warning`, `info`

  (all as `--color-<group>-<name>`). The fuller list in
  `token-architecture.md` is what most brands end up with.
- **Themes.** The default theme is in `:root`; a second theme (if the brief
  asks for one) is in `[data-theme=…]` and the `prefers-color-scheme` block.
  Only mapped colour tokens change between themes. `STATE.json` `themes` set.
- **Responsive type.** `--text-*` sizes and leadings for h1–h6 and body sizes,
  rounded to multiples of 4 (14/12 allowed for small body), mobile overrides
  for headings only, body never below 16px.
- **Text hierarchy uses solid neutral steps**, not opacity. (A migration may
  carry `--brand-<hue>-a<NN>` opacity tokens temporarily; they're a migration
  aid, listed as an open decision until replaced.)
- **Touch target token** — `--brand-size-touch` (44px) and
  `--size-touch-target` exist.
- **Status borders on controls reach 3:1** against the field surface
  (`--color-border-error` ≈ 600 light / 400 dark), with
  `--color-border-<status>-subtle` (200) for borders on tinted status surfaces.
- If brand-given sizes break the 4px grid, they're used as given and the
  deviation is recorded in brief §3.
- Contrast checked and stated in `FOUNDATIONS.md` for every text-on-surface
  pair the system allows, in every theme.
- `prefers-reduced-motion` zeroes the duration tokens.
- Every token traces to the brief; no invented values.
- The page renders every token visually. A token list that isn't shown is
  documentation nobody can review.
- No raw values anywhere outside `tokens.css`. The one exception is the
  swatches on `foundations.html`: an element with `data-token="--brand-…"` (or
  `--alias-…`) may use that token in its inline style so the raw scales can be
  shown. Nowhere else.
- Old token names, if any, sit in the `/* @deprecated */` block at the end of
  the mapped tier, each pointing at a mapped token.

**Why this stage carries the most weight:** rework here is a five-line edit;
the same rework discovered at Stage 6 is twenty pages. Spend the review time.

---

## Stage 2 — Atoms

**Produces:** `reference/atoms.html` (02), `reference/icons.html` (02A),
one `components/atoms/A-nn-<slug>.md` per atom, and one
`components/atoms/icons.md` for the icon set.

Atoms are the smallest things with a job. Buttons, links, labels, fields,
checkboxes, marks, dividers, media frames, icons. Read
`component-anatomy.md` — it has the axis rules, the focus ring, and the build
order with each component's anatomy and states.

**Acceptance criteria**

- Every atom gets an `A-nn` ID, contiguous from `A-01`, and a spec file with
  the required sections (frontmatter, Purpose, Anatomy, Props / variants,
  States, Sizes, Behaviour & responsive, Accessibility, Markup, Do / Don't).
- **Icons are the exception**: each icon on `icons.html` gets an `I-nn` ID
  (contiguous from `I-01`), but no spec file of its own. One
  `components/atoms/icons.md` covers the set — grid, stroke, sizes, colour
  tokens, accessibility, how to add one.
- **Built in course order**, adapted to the brand: button → label → field →
  … Nothing is built before the parts it composes.
- **State and Type axes.** Every interactive atom shows every applicable state
  (default, hover, focus, active, disabled; error, loading, selected where
  relevant) live, for each type. Listed in the spec's States table; states that
  don't apply are marked n/a.
- **Focus ring identical everywhere** — `--focus-ring-width` outline in
  `--color-border-focus`, offset `--focus-ring-offset`, no layout shift. This
  is checked mechanically, but look at it too — a technically-present ring
  that's invisible against the surface passes the check and fails the user.
- Disabled looks the same across types.
- Interactive targets are at least 44×44px, including in compact variants —
  via `var(--size-touch-target)`, not a literal.
- Icons: one set, one grid (20px in UI), one stroke weight, `currentColor`,
  a single sprite, coloured via `--color-icon-*`. Decorative icons get
  `aria-hidden`; meaningful ones get a label.
- **Mapped tokens only** in atom CSS — no `--brand-*` or `--alias-*`. An atom
  that needs a token Foundations doesn't have means Foundations was
  incomplete; go back and amend it rather than defining a local value.

---

## Stage 3 — Molecules

**Produces:** `reference/molecules.html` (03), one
`components/molecules/M-nn-<slug>.md` per molecule.

A molecule is two or more atoms combined into a unit with **one clear job**. A
search field. A proof metric. An article card. An input with its label, field,
hint and error.

**Acceptance criteria**

- Every molecule gets `M-nn`, contiguous from `M-01`, and a spec file whose
  frontmatter `composes:` lists the atom IDs it uses.
- Grouped by function, with each group as its own numbered section (`03.1`,
  `03.2`, …). Typical groups: navigation, forms and input, proof and trust,
  editorial, learning and progress, conversion, status and feedback, page
  utility. Use the groups this brand actually needs.
- Each specimen carries a note saying what it's for and how it behaves at
  narrow widths; the spec's Behaviour section says the same.
- **One job per molecule.** Two jobs means two molecules. This is the rule that
  keeps the count honest — most bloat comes from one component quietly growing
  a second responsibility.
- **Compose, don't copy.** Molecules reuse atom classes; private sub-parts are
  documented in Anatomy as internal and get no ID.
- State and Type axes shown where the molecule adds behaviour of its own.
- Native controls where native controls exist. A custom select that isn't
  keyboard-operable is worse than the plain one.
- Uses approved atoms only; mapped tokens only.

---

## Stage 4 — Organisms

**Produces:** `reference/organisms.html` (04), one
`components/organisms/O-nn-<slug>.md` per organism.

An organism is a complete, page-scale section: a site header, a hero, a proof
wall, a footer, a newsletter block.

**Acceptance criteria**

- Every organism gets `O-nn`, contiguous from `O-01`, and a spec file.
- **Each specimen names the molecules it composes** — the recipe line — and the
  spec's `composes:` matches it. This is load-bearing documentation: without
  it, nobody can see the ladder, and the relationship has to be
  reverse-engineered from markup.
- Each is shown at realistic width, in a roomy stage. An organism judged in a
  cramped box gets approved on the wrong evidence.
- Promotion rule enforced: promote a *repeated* section pattern, never a
  one-off. If it appears on one page only, it stays local to that page until
  reuse is proven.
- Behaviour at narrow widths described per organism.
- Uses approved molecules only; mapped tokens only.

---

## Stage 5 — Templates

**Produces:** `reference/templates.html` (05), one
`components/templates/T-nn-<slug>.md` per template.

A template is page **structure** — the sequence of organisms, with placeholder
content. It answers "what goes where", not "what does it say".

**Acceptance criteria**

- Every template gets `T-nn`, contiguous from `T-01`, plus
  `data-template="T-nn"` and `data-status="built|draft|external"`, and a spec
  file listing its organism sequence in `composes:`.
- Content is deliberately placeholder. If real copy appears here you've skipped
  to Stage 6 and lost the ability to judge structure independently of writing —
  which is exactly when a weak layout gets approved because the headline was
  good.
- Each shows its organism sequence explicitly.
- `external` marks templates intentionally not built here, with a note saying
  where that surface lives instead. Naming the exclusion is what makes it a
  decision rather than a gap.
- Uses approved organisms only.

---

## Stage 6 — Pages (and publish)

**Produces:** `reference/pages.html` (06), one `reference/pages/P-nn-<slug>.html`
per page, `reference/rules.html` (07), `rules/RULES.md`, the finished
`README.md`, and the `1.0.0` changelog entry.

Pages are real content instances of templates. This is where the system meets
actual copy, actual numbers, actual image dimensions — and where its real
weaknesses surface.

**Acceptance criteria**

- Every page gets `P-nn` and names the `T-nn` it instantiates.
- **Real copy, in the brand's voice.** Read the verbal identity files. If the
  brand has a copy-research process, use it for high-stakes surfaces rather
  than writing placeholder-quality text and calling it real.
- **Content provenance recorded** in `pages.html` and the CHANGELOG entry —
  where the copy and figures came from, and when. If a figure was omitted
  because sources disagreed, say so; an unexplained gap reads as an oversight,
  an explained one reads as judgement.
- Pages prove the system; they don't extend it. If a page needs something that
  doesn't exist yet, that's a finding: either go back and add it properly at
  the right rung, or record it as a one-off and say so.
- `RULES.md` and `rules.html` completed: promotion ladder, ownership
  boundaries, guardrails, accessibility floor, change protocol.
- **Publish.** `README.md` finalised — usage, token import path, the
  non-negotiable rules, generated file index and inventory all current. Every
  approved component has `status: approved`. `STATE.json` `version` set to
  `1.0.0` and the CHANGELOG entry says so.

**The real test of this stage:** if the system survives real content without
needing new components, it works. If every page needs a new organism, the
ladder was built on guesses and Stage 3–4 need revisiting.

---

## The loop, every stage

1. **Build** per the spec above, composing only approved lower-level pieces.
2. **Verify** — `bun $SKILL/scripts/verify-stage.ts --target <repo> --stage <n>`.
3. **Show** — look at the rendered page before the reviewer does. Use the
   first tier available:
   1. **The session's available visual browser** — use its supported controls
      and confirm the actual fonts and content loaded before capturing evidence.
   2. **Another available browser tool** — one tab for the whole run (navigate it
      between pages rather than opening a tab per page). Serve the reference
      over local HTTP (start the server yourself and stop it by its PID) when
      the pages use site-absolute paths like `/fonts/…`; `file://` is fine
      otherwise. If screenshots time out, use the pane's DOM tools instead.
   3. **DOM checks only** — computed token values, fonts loaded
      (`document.fonts`), IDs in order, no horizontal scroll at 375px.
   A screenshot is evidence only after fonts and delayed content have loaded.
   Whatever tier you used, say so when presenting, and list what was not
   checked visually. Interceptor is optional, not an installation requirement.
4. **Gate** — present it, ask for approval, and only advance `STATE.json` on a
   yes.
5. **Index** — on approval: set the stage's components to `status: approved`,
   run `bun $SKILL/scripts/build-index.ts --target <repo>` (regenerates
   `tokens.json`, `TOKENS.md`, `components/INDEX.md` and the README file
   index), append a `CHANGELOG.md` entry listing only what changed, and bump
   `STATE.json` `version` (see `output-structure.md` for the scheme).

Never advance on your own judgement. The gate is the mechanism that keeps a
20-page artifact from compounding one bad early decision — and the person
reviewing knows things about this brand that aren't written down anywhere.

### Waived approvals

Some users say "don't stop for approvals" — they want the whole ladder in one
go and will review at the end. Evals and CI run the same way
(`--non-interactive` in the prompt). Honour it, but only when it is said
explicitly; never decide on the user's behalf that a gate can be skipped.

- **Run the ladder without pausing**, still doing Build, Verify, Show and Index
  at every stage. Verification failures still stop a stage — a waiver covers
  the human's sign-off, not the script's.
- **Stage 0 interview** — answer it from the request and the evidence; mark
  each answer provisional in the brief's open decisions (see Stage 0).
- **Record each auto-approval honestly.** In `STATE.json` the stage gets
  `"approvedBy": "approved without review (waived by user)"` (an eval run says
  "waived: non-interactive eval"), and the `CHANGELOG.md` entry carries the
  same words. Component specs stay `status: draft` — they were never reviewed.
- **A second repo still needs a yes** where one is available; when it isn't,
  record the write in `ATOMIC-NOTES.md` / the run notes (see Safety in
  `SKILL.md`).
- **Present all the gates together at the end**: per stage, what was built, the
  provisional decisions, what wasn't checked visually, and the one thing most
  worth looking at — then ask for approval stage by stage, from Foundations up,
  because a revision low down makes everything above it stale.

---

## v1 systems only

When extending a v1 system built by the old skill (a `STATE.json` without
`schemaVersion: 2`), these criteria replace the
v2 token and spec ones above. They were right for v1's single primitive layer
and remain valid there:

- Primitives keep their given names — `--base`, `--raised`, `--contrast`,
  `--accent`, `--line` — on light brands as well as dark. They are named by
  role in the stack so they don't need inverting; don't rename them to
  material words like ink/paper.
- Text hierarchy expressed as opacity of one text colour, unless the brand
  explicitly specifies otherwise.
- Component documentation goes in the single `COMPONENT-MAP.md` rather than
  per-component spec files; there is no `build-index.ts` step or CHANGELOG
  unless the system already has one.

## Legacy systems (hand-built, no `STATE.json`)

an existing project's old `public/atomic-framework/` and a legacy project's `stage-*.html` are
examples. Extend them in their own files: add to the existing pages, keep their
markup, class and ID conventions, and record what was added (and why) in a
small `ATOMIC-NOTES.md` beside them — including a table mapping each legacy
page to the ladder stage it covers, judged by content rather than file name. If
the system lives in a sibling repo, the target gets a short `DESIGN-SYSTEM.md`
pointing there — and since that writes into a second repo, ask first (see
Safety in `SKILL.md`). Don't scaffold v2 unless the user asks to migrate. The
per-stage IDs, spec files and tier rules above don't apply, because the
system never adopted them.

What does apply, unchanged, is the quality floor. Legacy conventions are
about naming and structure; they are never a reason to ship less:

- **Accessibility floor** — a visible `:focus-visible` treatment on every
  interactive element (not `outline: none`, not only `:focus`), 44px minimum
  targets, text contrast ≥ 4.5:1 and UI-component contrast ≥ 3:1. Surface any
  brand value that fails rather than silently keeping it.
- **Inspiration Map** — the run's map in `ATOMIC-NOTES.md` has a row per
  source with *both* take and leave filled, same as a v2 brief.

`verify-stage.ts --legacy <dir>` checks the mechanical part: `noindex`, no raw
values outside the system's token file, and — per page — a visible
`:focus-visible` rule in the CSS that page actually loads whenever it has
something focusable (button, link, input, select, textarea, `[tabindex]`).

## Migrated systems (`migratedFrom` in `STATE.json`)

A system migrated to v2 is held to the v2 criteria with two allowances while
the cleanup finishes: components may carry `status: legacy` (usable, not yet
signed off under v2), and with `"migratedFrom": "legacy"` leftover raw literals
in `reference/styles.css` and inline styles are reported as one warning line
with a count rather than failing the stage. The token file is checked strictly
either way.
