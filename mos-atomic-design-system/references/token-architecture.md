# Token architecture — four tiers, full scales, themes and type

Read this at Stage 1, before touching `tokens/tokens.css`. It explains how the
file is organised, why, and how to get from a handful of brand hexes to a
complete, themeable token set. Applies to v2 systems (`schemaVersion: 2`); a v1
system keeps its existing primitives — see the note at the end.

Method source: the UI Collective "Build a Design System — Full Course", outlined
from UI Collective design-system teaching (the private course material is
not bundled or required). The tier model, the 100-step naming, the 4px number scale,
the mapped text/icon/surface/border groups and the rounded type scale come
from there. Things the course doesn't cover — elevation, motion, contrast
testing, code export — are this skill's additions and are marked as such.

---

## The four tiers

`tokens.css` has four sections, in this order, each opened by a marker comment
that `verify-stage.ts` reads:

```css
/* @tier brand */       raw values, no roles
/* @tier alias */       roles, theme-agnostic
/* @tier mapped */      what components use; redefined per theme
/* @tier responsive */  device-dependent sizes (type)
```

The course's image for it: Brand is the roots, Alias the trunk, Mapped the
leaves — the only part anyone sees. Responsive sits beside them for numbers
that change with screen size.

**Why three colour tiers instead of the common two (primitive → semantic).**
The course's stated reason is multiple brands: with a separate Alias tier, a
second brand that swaps only its primary is a change in one tier. It is
explicit that two-tier isn't wrong and existing systems don't need rebuilding.
This skill adds two reasons of its own: themes redefine only the mapped tier
without touching roles, and two roles that happen to share a hex (error red,
brand red) stay separately addressable.

**The rules that make the tiers mean something**

- **Brand has no roles.** A colour is `purple`, never `primary`. The moment a
  role appears at this tier, you can't reassign it without renaming raw values.
- **Never skip a tier** for colour, border width or radius. Mapped points at
  Alias; Alias points at Brand. A mapped colour pointing straight at `--brand-*`
  works today and silently breaks the day a role is reassigned. The permitted
  skips are listed below — there are no others.
- **Components use mapped (and responsive) tokens only.** No `--brand-*` or
  `--alias-*` in component or specimen CSS. The verifier checks this. It is the
  rule that makes a theme switch or rebrand a token edit.
- **Name by job once you leave Brand.** Error red and primary red are different
  alias tokens even if they hold the same hex — otherwise nobody can tell which
  red an alert should use, and recolouring the brand recolours every error.
- **Mapped only what's used.** Not every alias step needs a mapped token. Map
  what components actually need; a mapped token nobody uses is noise in every
  picker.

### Tier rules and exceptions — the one list

This is the canonical list; `SKILL.md` and `RULES.md` mirror it briefly.

| Rule | Detail |
| --- | --- |
| Raw literals | Only in the **Brand** tier and the **Responsive** tier (type size, leading and tracking values — the course keeps these as raw numbers per device — and fluid `clamp()` spacing). Nowhere else. |
| Colour, border width, radius | Mapped → Alias → Brand. Never skip. |
| Permitted skips | Mapped `--space-*`, `--duration-*`, `--ease-*`, `--shadow-*` and `--font-*` may reference Brand directly — no alias tier exists for them because they carry no role to assign. Container widths (`--container-*` → `--brand-container-*`) and the touch target (`--size-touch-target` → `--brand-size-touch`) follow the same logic. |
| Deprecated block | Old token names kept for back-compat sit in a `/* @deprecated */` block at the end of the mapped tier, each pointing at a mapped (or responsive) token. They skip the alias requirement. See "Migration aids" below. |
| Foundations swatches | On `foundations.html` only, an element carrying `data-token="--brand-…"` or `data-token="--alias-…"` may use that one token in its inline style, so raw scales can be displayed. Nowhere else. |
| Component and specimen CSS | Mapped and responsive tokens only. No `--brand-*`, no `--alias-*`, no raw values. |

---

## Brand tier

### Colour scales

Every hue gets a full scale: `--brand-<hue>-<step>` for steps
`50, 100, 200, 300, 400, 500, 600, 700, 800, 900`. Higher is darker. Include:

- each brand hue (the brief names them),
- one neutral (`gray`, or the brand's named neutral such as `stone`),
- status hues — `red`, `green`, `amber`, `blue` — unless the brand supplies its
  own,
- `--brand-white` and `--brand-black` as pure values.

Values the skill supplies because the brand didn't (default status hues,
white/black) are commented `/* default */` and recorded as such in brief §3,
alongside `/* given */` and `/* derived */`.

In-between steps (`150`, `250`) are allowed when accessibility testing needs a
tint between two steps; the course introduces them for exactly that. Add them
when needed, not pre-emptively.

**Why full scales rather than four to six primitives.** States, themes and
status surfaces all need *neighbouring* values — hover is a step darker,
the dark-theme surface is a step from the other end, alert backgrounds are the
50 tint. Without a scale each of those becomes a one-off hex invented in the
mapped tier, which is exactly the drift the tiers exist to prevent. The course
does warn against over-building ("hundreds of scales"): the answer is few hues,
each complete — not many hues.

### Building a scale from a brand hex

The brief gives you one or two hexes per hue. Build the rest:

1. **Place the given hex at its natural step.** Judge by lightness, not by
   habit: a mid-tone brand blue sits at 500, a deep navy at 800, a pale sand at
   100. Record the step in brief §3.1 ("`#1E3A8A` given → `blue-800`"). Don't
   force every brand hex to 500 — a navy at 500 leaves no room for dark steps
   and pushes the whole scale grey.
2. **Derive the lighter steps** by mixing toward white, and the darker steps by
   mixing toward black (or by lowering lightness in OKLCH, which keeps hue more
   stable than RGB mixing). The course's manual version: lay the colour over
   white/black at 80/60/40/20/10% opacity and pick the resulting solid colour.
3. **Store solid hex only.** Never leave opacity inside a token; a
   translucent value changes with whatever sits beneath it and can't be
   contrast-checked.
4. **Mark every generated step** with a `/* derived */` comment. Given steps
   carry `/* given: <source> */`. A reviewer can then see at a glance which
   values are the brand's and which are ours.
5. **Check contrast** for the pairs you intend to use — at minimum the text
   steps (700–900) on the page surfaces and white on the action step. The
   course mentions accessibility but never runs a contrast check; this skill
   does, and states the ratios in `FOUNDATIONS.md`.

If two hexes of the same hue are given (e.g. a brand blue and a darker hover
blue), place both at their natural steps and derive around them.

### Number scale

One master scale on a 4px grid. Every space, radius and border width draws
from it:

| Token | px | Token | px | Token | px |
| --- | --- | --- | --- | --- | --- |
| `--brand-scale-0` | 0 | `--brand-scale-300` | 12 | `--brand-scale-900` | 40 |
| `--brand-scale-25` | 1 | `--brand-scale-400` | 16 | `--brand-scale-1000` | 48 |
| `--brand-scale-50` | 2 | `--brand-scale-500` | 20 | `--brand-scale-1100` | 64 |
| `--brand-scale-100` | 4 | `--brand-scale-600` | 24 | `--brand-scale-1200` | 80 |
| `--brand-scale-150` | 6 | `--brand-scale-700` | 28 | `--brand-scale-1300` | 96 |
| `--brand-scale-200` | 8 | `--brand-scale-800` | 32 | `--brand-scale-1400` | 128 |

Plus `--brand-scale-round` (999px or 9999px — either is fine, it's a
sentinel, not a grid step) for pills and circles, which `--alias-radius-round`
points at.

The scale can extend past 1400 when a brand needs larger steps (`1500` = 160px,
`1600` = 192px, …) — any multiple of 4 is a valid step. Extend only when a real
value needs it.

Write rem where it helps accessibility and comment the px. Steps 25 and 50
exist for 1px borders and 2px focus rings; above 32 the scale jumps rather than
listing every multiple of 4. Avoid odd values (3px, 5px) — the course is firm
on this and it keeps rhythm honest.

**Brand-given sizes win over rounding.** If the brand document specifies a
size that isn't on the 4px grid (a 42px logo lockup, a 15px caption), use it as
given and record the deviation and its source in brief §3. The grid is a
default for values nobody decided, not a reason to overrule ones somebody did.

### Spacing — the one naming table

There is one spacing vocabulary. Components use `--space-1` … `--space-12`
only. Each maps onto a scale step, through the `--alias-space-<step>`
passthrough the skeleton ships with (a direct `--brand-scale-*` reference is
also permitted, since space carries no role):

| Mapped (use this) | Alias passthrough | Brand scale | px |
| --- | --- | --- | --- |
| `--space-1` | `--alias-space-100` | `--brand-scale-100` | 4 |
| `--space-2` | `--alias-space-200` | `--brand-scale-200` | 8 |
| `--space-3` | `--alias-space-300` | `--brand-scale-300` | 12 |
| `--space-4` | `--alias-space-400` | `--brand-scale-400` | 16 |
| `--space-5` | `--alias-space-500` | `--brand-scale-500` | 20 |
| `--space-6` | `--alias-space-600` | `--brand-scale-600` | 24 |
| `--space-7` | `--alias-space-800` | `--brand-scale-800` | 32 |
| `--space-8` | `--alias-space-900` | `--brand-scale-900` | 40 |
| `--space-9` | `--alias-space-1000` | `--brand-scale-1000` | 48 |
| `--space-10` | `--alias-space-1100` | `--brand-scale-1100` | 64 |
| `--space-11` | `--alias-space-1200` | `--brand-scale-1200` | 80 |
| `--space-12` | `--alias-space-1300` | `--brand-scale-1300` | 96 |

Note the jump at `--space-7`: 28px (scale 700) is skipped because it rarely
earns a place in layout spacing. `--gutter` and `--section-space` point at a
`--space-*` step and may be overridden per device in the responsive tier; fluid
`clamp()` spacing also lives there (see the responsive tier).

### Type primitives

`--brand-font-display`, `--brand-font-sans`, `--brand-font-mono` (full stacks),
and `--brand-weight-regular|medium|semibold|bold` as numbers. Font names must
match the loaded face exactly — a misspelt family falls back silently.

### Motion and elevation primitives *(skill addition)*

`--brand-duration-fast|base|slow`, `--brand-ease-out|in-out`, and
`--brand-shadow-sm|md|lg` — or a single `--brand-shadow-none: none` with a
comment if the brand has no elevation. Layout widths go here too:
`--brand-container-wide|reading` (e.g. 80rem / 42rem). The course has no motion,
elevation or layout tokens; they live in Brand here so raw values stay in one
tier.

### Touch target *(skill addition)*

`--brand-size-touch: 44px` in Brand, `--size-touch-target:
var(--brand-size-touch)` in Mapped (a permitted direct reference — a size has
no role). Interactive components use `min-block-size` / `min-inline-size:
var(--size-touch-target)`. Keeping the WCAG floor as one token means a brand
that wants 48px changes one line, and the verifier warns when it's missing.

---

## Alias tier

Roles, still theme-agnostic. Each role aliases one brand scale step for step:

- `--alias-<role>-<step>` for `primary`, `secondary` (optional), `neutral`,
  `error`, `success`, `warning`, `info`
- `--alias-<role>-default` — the step the brand hex was given at. Makes the
  source colour obvious (`--alias-primary-default: var(--brand-blue-800)`).
- `--alias-white` / `--alias-black` pointing at the pure brand
  values, so mapped tokens never need to reach into Brand for them.
- `--alias-border-width-none|sm|md|lg` → 0 / 1 / 2 / 4px from the scale
- `--alias-radius-none|sm|md|lg|round` → e.g. 0 / 2 / 4 / 8px from the scale,
  and `--alias-radius-round: var(--brand-scale-round)` (values come from the
  brief; `round` is for pills and circles)
- `--alias-space-<step>` passthrough of the number scale (the skeleton ships
  it; see the spacing table above)

Border widths and radii get t-shirt names because four or five steps don't
justify 100-numbering.

**Multi-brand (only if the brief needs it).** A "branded house" (shared
everything except primary) is handled here: a second set of alias values under
a brand selector, swapping only primary/secondary. A "house of brands" with
different schemes throughout gets a separate system per brand. The course
sketches both; neither is built by default.

---

## Mapped tier

What components use. Four colour groups plus the non-colour tokens.

| Group | Tokens |
| --- | --- |
| Text | `--color-text-heading` `-body` `-muted` `-subtle` `-action` `-action-hover` `-disabled` `-on-action` `-placeholder` `-error` `-success` `-warning` `-info` |
| Icon | `--color-icon-default` `-muted` `-action` `-action-hover` `-disabled` `-on-action` `-error` `-success` `-warning` `-info` |
| Surface | `--color-surface-page` `-default` `-raised` `-sunken` `-inverse` `-action` `-action-hover` `-action-subtle` `-disabled` `-error` `-success` `-warning` `-info` |
| Border | `--color-border-default` `-strong` `-action` `-action-hover` `-disabled` `-focus` `-error` `-success` `-warning` `-info` |

Conventions inside the groups:

- **Icon mirrors text** so a warning icon beside warning text is always the same
  colour. The resting icon is `default`, not `primary`, so it doesn't collide
  with the action names.
- **Status surfaces are the 50 tint.** Status text and icons use the role's
  `default`.
- **Status borders on form controls reach 3:1.** `--color-border-error` (and
  any other status border drawn on a field, checkbox or similar) maps to a step
  that reaches 3:1 against the field surface — about 600 in light, 400 in dark.
  This deliberately departs from the course's "status border = 200": a 200
  border on a white field is too faint to signal an error to someone with low
  vision, and WCAG asks 3:1 for the visual boundary of a control. A border on a
  tinted status surface (an alert box) may still use 200, via
  `--color-border-<status>-subtle`.
- **`--color-border-focus` equals the action colour** in every theme.
- **`-action-subtle`** is the light hover wash for fields, menus and tabs (the
  course's "action-hover-light").
- **`-fixed` suffix** marks a colour that must not change between themes — a
  logo-adjacent brand colour, say. Everything else is free to change. The
  course puts the suffix on Brand and Alias tokens; this skill puts it on the
  mapped token instead (`--color-surface-brand-fixed`), because mapped is the
  only tier that changes per theme, so that's where "doesn't change" needs
  saying.
- **Text hierarchy uses solid neutral steps** (`heading` 900, `body` 700,
  `muted` 600, `subtle` 500 — adjust to pass contrast), not opacity of one
  colour. Solid steps can be contrast-checked; opacity can't, because its
  result depends on the surface.

Non-colour mapped tokens:

| Kind | Tokens |
| --- | --- |
| Space | `--space-1` … `--space-12` — see the one spacing table under the Brand tier |
| Size | `--size-touch-target` → `--brand-size-touch` (44px) |
| Shape | `--radius-none|sm|md|lg|round`, `--border-width-sm|md|lg` |
| Focus | `--focus-ring-width` and `--focus-ring-offset` (2px each) → `--alias-border-width-md` |
| Elevation | `--shadow-sm|md|lg` → `--brand-shadow-*`, or explicitly `none` if the brand has no elevation *(skill addition)* |
| Motion | `--duration-fast|base|slow` → `--brand-duration-*`, `--ease-out|in-out` → `--brand-ease-*`; durations zeroed under `prefers-reduced-motion` *(skill addition)* |
| Type | `--font-heading|body|mono` → `--brand-font-*` |
| Layout | `--gutter` and `--section-space` → a `--space-*` step (mapped referencing mapped is fine); `--container-wide|reading` → `--brand-container-*` |

---

## Themes: light and dark

Only mapped colour tokens change per theme. Brand and alias never do.

1. **Pick the default theme** from the brief (light or dark default is a real
   fork — decide it once at Stage 0). Its values go in `:root`.
2. **Write the other theme** in `[data-theme="dark"]` (or `"light"`), and, if
   the brand supports both, mirror it under
   `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { … } }` so
   an unset page follows the OS.
3. **Invert the neutral mapping first.** Roughly: steps swap ends (50 ↔ 900,
   100 ↔ 800, 300 ↔ 600). Status surfaces move from 50 to a dark step (800/900);
   status text moves lighter (300/400) so it still reads on dark.
4. **Leave `-fixed` tokens alone.**
5. **Fill fast, then test.** The course's advice and a good one: rough in the
   second theme quickly, then contrast-check every text-on-surface pair and
   fix what fails. Record the ratios in `FOUNDATIONS.md`.
6. **Record the themes** in `STATE.json` — `themes: ["dark"]`,
   `["light", "dark"]`, etc. The first entry is the default.

### Dark-default brands

The skeleton reads as light-default because its `:root` values are light and
its second block is `[data-theme="dark"]`. Nothing in the tooling assumes
that: `:root` holds whichever theme is the default, and `STATE.json`
`themes[0]` names it. For a dark default:

```css
/* @tier mapped */
:root {                                  /* the DEFAULT theme: dark */
  color-scheme: dark light;
  --color-surface-page: var(--alias-neutral-900);
  --color-text-heading: var(--alias-neutral-50);
  /* … */
}

[data-theme="light"] {                   /* the other theme, by choice */
  color-scheme: light;
  --color-surface-page: var(--alias-neutral-50);
  --color-text-heading: var(--alias-neutral-900);
}

@media (prefers-color-scheme: light) {   /* the other theme, by OS */
  :root:not([data-theme]) { color-scheme: light; /* same values */ }
}
```

and `"themes": ["dark", "light"]` (`init-system.ts --themes dark,light`). The
verifier then expects a `[data-theme="light"]` block (and warns without the
media block); `tokens.json` records `defaultTheme: "dark"` with a `light`
mode; `TOKENS.md` names dark as the default. Write the dark values first, then
derive light from them — the same inversion as step 3, run the other way.

---

## Responsive tier: the type scale

Desktop values are the default; mobile overrides live in
`@media (max-width: 40rem)`. Tokens:
`--text-<h1..h6|body-lg|body-md|body-sm|body-xs>-size` and `-leading`, plus
`-tracking` where the brand needs it (large display type usually does).

Procedure:

1. **Base 16px, Major Third (1.25) for desktop** unless the brief says
   otherwise. Record the ratio in brief §3.2.
2. **Generate the heading steps** (h6 ≈ base × 1.25, up to h1) and **round each
   to the nearest multiple of 4**. Decimal sizes like 31.25px are a course
   warning — they render inconsistently and read as unconsidered.
3. **Pick a tighter ratio for mobile** (1.2 or 1.125) and round again.
   Only headings shrink.
4. **Body sizes never change between desktop and mobile**, and body copy is
   never below 16px on any device. `body-sm` (14) and `body-xs` (12) are the
   allowed exceptions to the 4-rule, and 12 is for captions and legal text only.
5. **Leading:** headings ≈ size × 1.2, body ≈ size × 1.5, each rounded to a
   multiple of 4. The multiplier is a taste call — decide the look first.
6. **Fluid `clamp()`** is fine as the desktop value if the brand already uses
   it; keep the mobile override so the minimum is explicit.
7. **Brand-given sizes win.** If the brand specifies a type size or leading off
   the 4px grid, use it and record the deviation in brief §3.2.

**Spacing in this tier.** The course leaves responsive spacing as "mentioned,
not built". This skill keeps the `--space-*` steps in the mapped tier, and puts
only the device-dependent layout spacing here: `--gutter` and
`--section-space` overrides in the mobile block, and any fluid `clamp()`
spacing (`--section-space: clamp(4rem, 8vw, 6rem)`). `clamp()` holds raw
values, which is why it lives in this tier rather than in mapped.

---

## Worked mini-example

Brief says: brand blue `#2563EB`, neutral warm grey `#78716C`, light default
with a dark theme, Inter for everything.

```css
/* @tier brand */
--brand-blue-50:  #eff4fe; /* derived */
/* … 100–500 derived … */
--brand-blue-600: #2563eb; /* given: brand-guidelines.md §Colour */
/* … 700–900 derived … */
--brand-stone-500: #78716c; /* given */
--brand-scale-50: 0.125rem; /* 2px */

/* @tier alias */
--alias-primary-default:   var(--brand-blue-600);
--alias-primary-700:       var(--brand-blue-700);
--alias-neutral-900:       var(--brand-stone-900);
--alias-white:             var(--brand-white);
--alias-border-width-md:   var(--brand-scale-50);
--alias-radius-md:         var(--brand-scale-100);

/* @tier mapped */
:root {
  --color-surface-action:       var(--alias-primary-default);
  --color-surface-action-hover: var(--alias-primary-700);
  --color-text-on-action:       var(--alias-white);
  --color-text-heading:         var(--alias-neutral-900);
  --color-border-focus:         var(--alias-primary-default);
  --focus-ring-width:           var(--alias-border-width-md);
}
[data-theme="dark"] {
  --color-text-heading:         var(--alias-neutral-50);
  --color-surface-page:         var(--alias-neutral-900);
}

/* @tier responsive */
:root { --text-h1-size: 3rem; /* 48 */ --text-h1-leading: 3.5rem; /* 56 */ }
@media (max-width: 40rem) { :root { --text-h1-size: 2.5rem; /* 40 */ } }
```

Note the given blue landed at 600, not 500 — it's darker than a mid-tone —
and the brief records that. The focus-ring width goes through Alias
(`--alias-border-width-md` → `--brand-scale-50`) because it's a border width;
only the permitted skips (space, duration, ease, shadow, font) read Brand
directly.

---

## Migration aids and file hygiene

These exist for migrations (an existing project is the worked case); a fresh v2 build doesn't
need them.

**The deprecated block.** When a site already uses old token names (`--base`,
`--contrast`), keep them working during the migration with a block at the
**end of the mapped tier**:

```css
/* @deprecated */
--base:     var(--color-surface-page);
--contrast: var(--color-text-heading);
```

Each deprecated token points at a mapped token (or a responsive one, e.g.
`--font-size-h1: var(--text-h1-size)`), never at a raw value or a
brand token. The verifier skips the alias requirement for this block,
`export-tokens.ts` marks each one `"$deprecated": true` in `tokens.json`, and
`TOKENS.md` lists them in a "Deprecated" table so nobody adopts them for new
work. Delete the block once the site stops using the names — that removal is a
major version after 1.0.

**Opacity-preserving tokens.** A legacy system that relied on opacity (text at
78% of one colour) can't always be re-expressed as solid steps in one pass
without visible change. As a stopgap, `--brand-<hue>-a<NN>` holds an rgba —
`--brand-paper-a78: rgba(245, 240, 230, 0.78)` — so the migration is
pixel-identical first and corrected second. It's a migration aid, not a v2
default: replace each with a solid, contrast-checked step when the reviewer
signs off on the visual change.

**One declaration per line.** Keep every token declaration on a single line,
however long. Diffs stay readable, and the export scripts parse line by line
(they tolerate wrapping, but don't rely on it). If the repo runs Prettier, add
an override so it doesn't wrap them:

```json
{ "overrides": [{ "files": "design-system/tokens/*.css", "options": { "printWidth": 200 } }] }
```

---

## Common mistakes (most from the course's warnings)

- Hundreds of hues "just in case". Few hues, each complete.
- Opacity baked into a colour token instead of a solid hex.
- Odd values (3px) in the number scale, or every multiple of 4 up to 256.
- Roles in the Brand tier, or error UI pointing at the primary scale.
- Mapped tokens that skip Alias and point straight at Brand.
- Unrounded type sizes and line heights (31.25, 57.6).
- Shrinking paragraph sizes on mobile.
- Font names or weights that don't exactly match the loaded face.
- A second theme shipped without a contrast pass. *(skill addition)*
- Component CSS reaching for `--brand-*` "just this once". The verifier fails it.

---

## v1 systems

A v1 system (no `schemaVersion: 2` in `STATE.json`) uses a single primitive
layer — `--base`, `--raised`, `--contrast`, `--accent`, `--line` — with text
hierarchy as opacity of one text colour. Those rules still hold when extending
a v1 system; don't half-convert it. Moving to four tiers is a migration, done
only when the user asks — see `output-structure.md`.
