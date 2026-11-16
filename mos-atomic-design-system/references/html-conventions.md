# HTML conventions — the shape of the reference site

Read this before writing any stage page. These conventions are what make a
20-page reference navigable instead of a pile of files.

Paths are v2: the reference site lives in `design-system/reference/`, tokens in
`design-system/tokens/tokens.css`, component specs in
`design-system/components/<level>/`. A v1 system keeps its existing paths (see
`output-structure.md`); everything else here applies to both.

## Why plain HTML and CSS

The reference is deliberately framework-free. Approving a *visual* decision
shouldn't require committing to a *stack* — and a reference that needs a dev
server to view is a reference that stops getting reviewed.

It also creates a clean handoff: the static reference is the visual contract,
and production components consume it rather than defining a competing system.
When the brand contract changes, both surfaces move together (see the change
protocol in `rules/RULES.md`).

The reference is for humans reviewing; the component spec files are for
whoever builds from the system, human or agent. Each specimen and its spec
describe the same component — the specimen carries a link to the spec and the
spec's frontmatter carries `specimen: reference/<page>.html#<ID>`, so either
can find the other.

## The ID scheme

Every specimen carries a zero-padded ID: `A-01`, `M-17`, `O-04`, `T-05`,
`P-02` — and `I-01` … for icons on `icons.html`. Rules:

- **Contiguous.** No gaps, no duplicates. `verify-stage.ts` enforces this. A
  gap means something was deleted without renumbering, and now the map and the
  page disagree.
- **Surfaced in the UI**, in `<span class="card-label">`. IDs that exist only
  in a spreadsheet don't help the person reviewing.
- **Mirrored in data attributes** where a machine needs them:
  `data-organism="O-01"`, `data-template="T-05"`, `data-status="built"`.
- **Anchored.** Each specimen has `id="<ID>"` (e.g. `id="A-01"`) so a spec's
  `specimen:` link lands on it.
- **Stable.** Once approved, an ID doesn't move. Renumbering breaks every
  reference to it in the spec files, `components/INDEX.md`, the recipe lines,
  and any conversation anyone has had about it.

These IDs are the system's coordinates. Their whole value is that "M-17" means
one thing to you, the reviewer, and the test suite simultaneously.

## Page anatomy

Stage pages use `assets/shell.html`. Create each one with
`init-system.ts --target <repo> --page <file>` (e.g. `--page atoms.html`, or
`--page all`): it writes the shell with the rail nav generated whole —
`aria-current="page"` on exactly one entry, the parent stage for a sub-page
like `icons.html` — plus the brand, stage number, title, footer link and
version. What the stage decides stays as `{{LANG}}`, `{{BG_HEX}}`,
`{{STAGE_INTRO}}`, `{{STATUS}}` and `{{SECTIONS}}`; the verifier fails a page
that still has any. Structure:

```
skip-link
shell
├── rail (sticky, aria-label, numbered nav 00–07, aria-current on one entry)
└── page
    ├── page-header  (eyebrow "03 · Molecules", h1, intro, status chip)
    ├── main.content (sections)
    └── footer       (version, next-stage link)
```

**Section blocks** carry a numbered head:

```html
<section class="section" aria-labelledby="forms-title">
  <div class="section-head">
    <div>
      <span class="section-number">03.2</span>
      <h2 id="forms-title">Forms and input</h2>
    </div>
    <p>Why this group exists and what governs it.</p>
  </div>
  <!-- specimens -->
</section>
```

The `NN.n` numbering lets you and a reviewer say "03.2" and mean the same
thing. The rationale paragraph is not filler — it is where the *reason* for a
group lives, and it's the first thing that gets checked when someone proposes
adding to it.

## Specimen anatomy

The repeating unit. Head (ID + name + usage chip), stage (the live component),
note (what it's for and how it behaves).

```html
<article class="specimen specimen--wide" id="M-01">
  <header class="specimen__head">
    <div>
      <span class="card-label">M-01</span>
      <h3>Primary navigation cluster</h3>
    </div>
    <span class="specimen__usage">Site header</span>
  </header>
  <div class="specimen__stage">
    <!-- the real component, real markup, no screenshots -->
  </div>
  <p class="specimen__note">
    Wordmark + navigation links + primary action. At narrow widths, preserve
    the action and move links into the organism-level menu.
    <a href="../components/molecules/M-01-primary-navigation.md">Spec</a>
  </p>
</article>
```

**Show every state and type side by side.** Interactive specimens render a
row per type with a cell per state (default, hover, focus, active, disabled,
plus error / loading / selected where they apply). Force the non-default
states with a `data-state="hover"` hook that the component CSS styles the
same as the real pseudo-class, so the reviewer sees them all at once without
hovering. See `component-anatomy.md` for the axes.

**Live markup, never images.** A screenshot can't be focused, hovered, resized,
or read by a screen reader — which are the properties actually being approved.

**Organisms add a recipe line** naming their molecules:

```html
<article class="organism-specimen" id="O-01" data-organism="O-01">
  <header class="organism-specimen__head">
    <div><span class="card-label">O-01</span><h3>Site header</h3></div>
    <p class="organism-recipe">
      <span>Built from</span> M-01 Primary navigation · M-24 CTA group
    </p>
  </header>
  <div class="organism-stage organism-stage--compact"><!-- section --></div>
  <p class="organism-note">Use on every public page. On small screens…</p>
</article>
```

Templates follow the same pattern with their own anchor and data attributes:

```html
<article class="template-specimen" id="T-05" data-template="T-05" data-status="built">
  <header>
    <span class="card-label">T-05</span><h3>Homepage</h3>
    <p class="organism-recipe"><span>Sequence</span> O-01 · O-03 · O-07 · O-12</p>
  </header>
  <!-- placeholder-content layout -->
</article>
```

## Page references (Stage 6)

Full-fidelity pages use `assets/template-page.html` and live in
`reference/pages/P-nn-<slug>.html`: no rail, a
`template-review-bar` for orientation, then the page rendered for real. The
rail is omitted deliberately — a page being judged for how it *feels* shouldn't
sit inside documentation chrome.

## Stylesheet organisation

One `reference/styles.css`, which `@import`s `../tokens/tokens.css`, in ladder
order, sectioned by banner comments:

```css
/* ---- Framework chrome ---- */
/* ---- A-nn — atoms ---- */
/* ---- M-01 — primary navigation cluster ---- */
/* ---- O-01 — site header ---- */
/* ---- T-05 / P-05 — homepage ---- */
```

A single file rather than many: the reference is viewed over `file://` as often
as over a server, and one stylesheet always resolves. Banner comments in ladder
order mean the stylesheet reads in the same sequence as the system, so finding
`M-17`'s styles is a search for `M-17`.

Chrome styles (`assets/styles-base.css`) go at the top and stay separate from
specimen styles. The boundary is a marker comment that `init-system.ts` writes
right after the chrome:

```css
/* @specimens — everything below is component CSS. … */
```

Everything above it is chrome and may use literals; everything below is held
to mapped + responsive tokens and no literals by `verify-stage.ts`. Append
stage CSS below it, never above. Without the marker the verifier falls back to
the first `A-nn` banner, and with neither it can't find the component CSS and
only warns — so deleting the marker silently switches the strict check off.
`output-structure.md` has the full note. If the frame and the exhibit share rules you can no longer
tell which decisions belong to the brand and which to the viewer — and the
reference stops being a contract.

## Non-negotiables on every page

- `<meta name="robots" content="noindex,nofollow">`. These pages carry
  unapproved brand decisions and sometimes real client copy. Checked
  mechanically.
- A skip link, and `id="content"` on `<main>`.
- `aria-label` on the rail nav; `aria-current="page"` on exactly one entry.
- `aria-labelledby` on each section pointing at its `<h2>`.
- No raw hex, font stack, or magic dimension outside `tokens.css`. Every value
  is `var(--token)`. This is the rule that makes a rebrand a token edit instead
  of a find-and-replace across twenty files.
- **One exception, on `foundations.html` only:** a swatch that displays a raw
  scale step may reference that brand or alias token in its inline style, as
  long as the element names it in `data-token` —
  `<span class="swatch" data-token="--brand-blue-600" style="background: var(--brand-blue-600)">`.
  That's how the page shows the scales the rest of the system isn't allowed to
  touch. The verifier accepts it there and nowhere else.
- **Asset paths.** Relative paths work over `file://` and when served. If a
  migrated reference keeps site-absolute paths (`/fonts/…`), it only renders
  correctly when served by the site; say so in the README.
- **Mapped and responsive tokens only** in chrome and specimen CSS — no
  `--brand-*` or `--alias-*`. Those tiers exist so mapped tokens can point at
  them; a component that reaches past the mapped tier won't follow a theme
  switch. (v2 only; checked mechanically.)
- The identical focus ring on every focusable element (`component-anatomy.md`).
- Wide content (tables, code, diagrams) scrolls inside its own
  `overflow-x: auto` container. The page body never scrolls sideways.

## Naming

- Reference HTML: lowercase kebab-case matching the artifact —
  `blog-post.html`, `not-found.html`, `category-archive.html`.
- Docs: UPPER-KEBAB — `README.md`, `DESIGN-BRIEF.md`, `FOUNDATIONS.md`,
  `RULES.md`, `CHANGELOG.md`.
- Component specs: `<ID>-<slug>.md` in the level's folder —
  `components/atoms/A-01-button.md`. The slug matches the specimen name.
- Chrome CSS: BEM-ish element/modifier — `.specimen__head`,
  `.specimen--wide`, `.organism-stage--compact`.
- Specimen CSS: semantic, suffixed by level — `.nav-molecule`,
  `.site-header-organism`. The suffix makes the ladder visible in the
  stylesheet, which matters in a file this long.
