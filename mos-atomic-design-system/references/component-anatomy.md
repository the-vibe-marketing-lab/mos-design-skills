# Component anatomy — axes, focus, icons, composition, build order

Read this at Stages 2–4, before building a component and before writing its
spec file (`components/<level>/<ID>-<slug>.md`, template in
`assets/docs/COMPONENT-SPEC.md`). It covers the rules every interactive
component follows and a per-component summary for the common set.

Method source: the UI Collective "Build a Design System — Full Course"
(original teaching material is not bundled or required). The course builds in Figma; what follows translates its
component method to HTML/CSS. Where it skipped something — sizes on most
components, cards, navigation, modals — this skill fills the gap and says so.

---

## The two axes: State and Type

Every interactive component is designed along two independent axes, plus Size
only where the brand needs it.

**State** — what the user is doing to it:

| State | When | Usual treatment |
| --- | --- | --- |
| default | at rest | the base tokens |
| hover | pointer over | `-action-hover` surface/border/text; `-action-subtle` wash on neutral components |
| focus | keyboard focus (`:focus-visible`) | the standard focus ring, nothing else moves |
| active | pressed | a step darker than hover, or the hover treatment held |
| disabled | not available | `surface-disabled`, `border-disabled`, `text-disabled`, `icon-disabled` |
| error | invalid (fields, checkboxes) | `border-error` (a step that reaches 3:1 on the field surface — see `token-architecture.md`), `text-error`/`icon-error`, message below |
| loading | waiting | loader replaces or accompanies the label; width doesn't jump |
| selected | chosen (tabs, menu items, tags, toggles) | usually expressed on the Type axis instead — see below |

Use the states that apply; list the ones that don't in the spec as "n/a" so
the omission reads as a decision.

**Type** — which version of the component this is: button
`primary / secondary / outline / ghost`, tab `selected / unselected`, link
`default / inline`. Type changes the resting look; State changes apply on top.

**Why two axes.** Keeping them independent is what stops variant explosion
and keeps behaviour consistent — "hover on an outline button" is the hover rule
applied to the outline type, not a bespoke design. It also makes the spec's
States table and Props table say different things.

**Disabled is identical across types.** The course holds to this and it's
worth copying: a disabled primary and a disabled outline button look the same,
because "unavailable" is one message.

**Sizes** — the course builds sizes only for avatar, loader and progress
circle and defers button sizes. Add a Size axis when the brand genuinely
needs one (a compact table button, a large hero CTA), not by default. Every
size keeps a 44×44px target, set with `min-block-size:
var(--size-touch-target)` (and `min-inline-size` for icon-only controls) rather
than a literal, so the floor is one token.

**Naming.** Axis names capitalised in prose (State, Type, Size), values
lowercase (`default`, `hover`). In HTML: modifier classes for Type and Size
(`.button--outline`, `.button--sm`), real pseudo-classes for State, plus a
`data-state="hover"` forcing hook so the specimen can show every state side by
side.

---

## The focus ring (identical everywhere)

One recipe for every focusable thing:

```css
.button:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-border-focus);
  outline-offset: var(--focus-ring-offset);
}
```

- **Outline, not border.** It sits outside the component and never affects
  layout, so focusing doesn't nudge anything. (The course achieves the same in
  Figma with an absolutely-positioned ring 2px outside the component.)
- **Offset outside the component** by `--focus-ring-offset` (2px). The ring's
  corners follow the element's radius automatically in modern browsers.
- **`--color-border-focus` equals the action colour** in every theme. If that
  fails contrast against a surface, fix the token, not the component.
- **`:focus-visible`, not `:focus`,** so mouse clicks don't flash rings.
- Round components (radio, switch knob, carousel arrows) get the same ring;
  it follows the round radius.

Why identical: a keyboard user learns the ring once. Five different focus
treatments across a site read as five different kinds of thing.

---

## Icons

- **One set, one grid.** 20px default in UI (the course shrinks from 24 to 20
  for a "snug" look), drawn on a 24 art-board. One stroke weight.
- **`currentColor`** so icons inherit from text, and colour comes from
  `--color-icon-*` on the parent.
- **One SVG sprite** (`<symbol>` + `<use>`), shown on `icons.html`. Each icon
  gets an `I-nn` ID (contiguous from `I-01`) but no spec file of its own — one
  `components/atoms/icons.md` covers the set: grid, stroke, sizes, colour
  tokens, accessibility, and how to add an icon.
- **Decorative icons get `aria-hidden="true"`; meaningful icons get a label**
  (visually hidden text or `aria-label` on the control).
- **Trailing icons pin to the end** (the course sets the text to fill so the
  right icon always aligns). In CSS: the label takes `flex: 1`.

---

## Composition — compose, don't copy

- **Separate the parts that repeat.** Label is its own atom; field (the bare
  box) is its own atom; input is label + field + hint + error. The course
  credits this to Brad Frost's atomic design, and it's what stops an input
  multiplying into dozens of variants.
- **A molecule reuses atom classes.** An input molecule's label is `.label`,
  not a new `.input__label` with copied rules. If a composition needs the atom
  to look different, that's a Type on the atom.
- **Private sub-parts** — pieces that only exist inside one component
  (`.field__control`, `.menu__item`, `.table__cell`) — are documented in the
  parent spec's Anatomy as *internal* and get no ID. The course marks these
  with a leading dot in Figma so they don't publish; the equivalent here is
  "no ID, not in INDEX".
- **Things that shouldn't shift layout sit outside the flow**: required
  asterisks, focus rings, a snackbar's timeout bar, an avatar's oversized icon.
- **The required asterisk goes before the label text**, positioned so
  required and optional labels still align. Users learn a field is required
  before they read its name. Pair it with `aria-required` or `required` on the
  control — the asterisk is visual only.
- **Always give a component its border, even if it matches the fill.** Adding a
  border later changes every component's size. (Course rule.) In CSS: set
  `border: var(--border-width-sm) solid <same-as-fill>`.
- **Avoid "detaching"**: expose the knobs (a CSS custom property for a
  progress value, a `--cols` for a table) so users configure rather than fork.

---

## Build order

Build what's composed after what composes it. The course's order (with the
icon button moved ahead of snackbar and carousel, which use it), adapted for
the web — skip what the brand doesn't need, but don't reorder so that a
component is built before its parts:

| # | Component | Level (typical) | Anatomy | States | Type / props |
| --- | --- | --- | --- | --- | --- |
| 1 | Button | atom | icon-left? · label · icon-right? | default hover focus active disabled loading | primary (filled) · secondary (if the brand has one) · outline · ghost (transparent); icons optional |
| 2 | Label | atom | required-marker? · text · help-icon? | — | default · required |
| 3 | Field (bare input) | atom | icon-left? · control (fills) · icon-right? | default hover focus disabled error; empty vs filled (placeholder colour) | input type, icons optional |
| 4 | Input | molecule | label · field · hint · error message | inherits from field | presets (email, search) optional |
| 5 | Menu item | internal / atom | icon-left? · label (fills) · icon-right? | default hover focus disabled | selected · unselected |
| 6 | Menu | molecule | stack of menu items · scroll area | inherits | scrollbar optional |
| 7 | Checkbox (+ label) | atom | box · check icon · label | default hover focus disabled error | checked · unchecked (· indeterminate) |
| 8 | Radio (+ label) | atom | round box · dot · label | default hover focus disabled | selected · unselected |
| 9 | Switch (+ label) | atom | track · knob · label | default hover focus disabled | on · off |
| 10 | Textarea | molecule | label · multi-line field · hint/count | as field | one optional icon only (no left icon — it leaves dead space on multi-line text) |
| 11 | Tab item | internal / atom | icon? · label | default hover focus disabled | selected (2px bottom border in action colour) · unselected |
| 12 | Tab bar | molecule | row of tab items · bottom divider | inherits | — |
| 13 | Button group (segmented) | molecule | items joined, shared outer border, dividers between | default hover focus disabled | selected item; text · icon-only |
| 14 | Link | atom | icon-left? · label · icon-right? | default hover focus disabled | default (underline on hover) · inline (underlined at rest) |
| 15 | Breadcrumb | molecule | links with separators · current page | inherits | max ~6 crumbs; last is current, no separator, `aria-current="page"` |
| 16 | Avatar (+ group, + label) | atom / molecule | frame · image \| initials \| icon | — | sizes sm/md/lg; group overlaps with overflow "+n" |
| 17 | Tag | atom | label · add/remove icon | default hover focus disabled | selected · unselected (interactive); static tag optional |
| 18 | Loader | atom | spinner or dots | — | sizes; respects reduced motion |
| 19 | Badge | atom | count or dot | status: default error success warning info | count · dot (uses the *icon* status colour as fill — status surfaces are too pale) |
| 20 | Progress bar | atom | track · fill · label? | — | value via custom property; `role="progressbar"` + aria values |
| 21 | Progress circle | atom | track · arc · centre text? | — | doubles as a determinate loader |
| 22 | Icon button | atom | one icon, square, same height as button (built here because snackbar and carousel use it) | as button | as button types; accessible label required |
| 23 | Snackbar / toast | molecule | status icon · title · body · link · close · timeout bar | — | default success error warning info; `role="status"` or `alert` |
| 24 | Carousel | molecule | prev/next arrow buttons · position bar | arrows: default hover focus disabled | direction left/right |
| 25 | Table | organism / molecule | header cells · body cells · optional actions column | row hover, sortable header focus | cell types: text · link · actions · checkbox · header |

Notes:

- Levels are typical, not rules. The level follows the one-job test and the
  inventory in the brief.
- Items marked *internal* often end up as private sub-parts of their parent
  rather than their own ID. Give them an ID only if they're used on their own.
- The course builds checkbox/radio/switch "labels" as wrappers; on the web the
  `<label>` wrapping the control is the whole pattern, so they're usually one
  atom each.

## Site-level pieces the course skips

The course stops at the component list above and never builds templates or
pages. Websites almost always need some of these; build them when the brand's
inventory does, following the same axis/focus/composition rules:

| Component | Level | Notes |
| --- | --- | --- |
| Card | molecule | one job per card type (article card ≠ product card) |
| Select | atom / molecule | native `<select>` styled first; a custom listbox only if native can't do the job, and then fully keyboard-operable |
| Tooltip | atom | not the only way to reach information; keyboard-triggerable |
| Alert (inline) | molecule | status surfaces/borders from the mapped tier; `role="alert"` only when urgent |
| Modal / dialog | organism | native `<dialog>`, focus trapped and returned, Esc closes |
| Navigation (site header, footer, mobile menu) | organism | recipe line names its molecules |
| Pagination, accordion, empty states | molecule | only if the site has the content for them |

---

## What goes in the spec file

One `.md` per component with an ID, using `assets/docs/COMPONENT-SPEC.md`.
Sections, in order: frontmatter → Purpose → Anatomy → Props / variants →
States → Sizes → Behaviour & responsive → Accessibility → Markup → Do / Don't.

The spec and the specimen describe the same thing from two sides: the specimen
proves it works, the spec says what it's allowed to do. If they disagree, the
specimen is wrong until the spec is changed on purpose.
