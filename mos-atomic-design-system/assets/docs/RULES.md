# {{BRAND_NAME}} — System Rules

<!--
  Written at Stage 6, mirrored into reference/rules.html (07).
  Lives at design-system/rules/RULES.md.
  These are the constraints that keep the system coherent after the
  people who built it have moved on.
-->

## The promotion ladder

How something earns its place at each level. A piece that skips a
rung is the most common way a design system starts contradicting
itself.

- **01 Foundation** — approve the token, behaviour or accessibility
  rule before anything consumes it.
- **02 Atom** — prove it works independently in every required state.
- **03 Molecule** — combine atoms only when the combination has one
  clear job. Two jobs means two molecules.
- **04 Organism** — promote a repeated section pattern, never a
  one-off.
- **05 Template** — standardise a page sequence only when multiple
  pages share the structure.
- **06 Page** — a real content instance of a template. Pages prove
  the system; they don't extend it.

Promotion happens only when the lower-level pieces are approved **and**
the new composition repeats in at least two credible contexts. One-off
compositions stay local to their page until reuse is proven.

---

## Token rules

- **Components use mapped and responsive tokens only** — never
  `--brand-*` or `--alias-*`. That's what lets a theme switch or rebrand
  happen in `tokens/tokens.css` alone.
- **Never skip a tier** for colour, border width or radius: mapped →
  alias → brand. The only permitted skips are mapped `--space-*`,
  `--duration-*`, `--ease-*`, `--shadow-*`, `--font-*` (and
  `--container-*`), which read brand directly because they have no role.
- **Raw values only in the brand and responsive tiers** of
  `tokens/tokens.css`. Not in component CSS, not inline, not in page
  references.
- **Need a new token?** Add it to the right tier through the change
  protocol below. Don't define a local value in a component.

---

## Ownership boundaries

{{OWNERSHIP}}

<!-- Who owns what: code, CMS, structured fields, the human. The
     hard line worth stating explicitly is where a structured-content
     tool stops being structure and becomes a page builder — that is
     the point a design system loses control of its own output. -->

---

## System guardrails

{{GUARDRAILS}}

<!-- The numbered constraints specific to this brand. Each should be
     checkable by looking at a page. Examples of the SHAPE:
       - one accent per visual surface
       - proof gets the spotlight; decoration doesn't
       - accessibility is foundational, not a pass at the end
     Replace with this brand's actual rules from the brief. -->

---

## Accessibility floor

{{A11Y_RULES}}

Non-negotiable, because retrofitting these costs more than building
them in:

- Visible keyboard focus on every interactive element, using the one
  shared ring (`--focus-ring-width` in `--color-border-focus`, offset
  `--focus-ring-offset`)
- WCAG AA contrast for text and meaningful non-text
- Interactive targets at least 44×44px, from `--size-touch-target`
- Body text at least 16px on every device
- Every interactive component shows its disabled state, identical
  across types
- Semantic headings and links; landmarks on every page
- `prefers-reduced-motion` honoured in the motion tokens
- Nothing essential hidden behind JavaScript

---

## Change protocol

When the brand contract or a component changes, every surface moves
together:

1. Update the brand source (`{{BRAND_DOC_PATH}}`) if the brand itself
   changed.
2. Update `tokens/tokens.css`, the affected spec files under
   `components/`, and the affected reference pages.
3. Re-run `verify-stage.ts` for every affected stage.
4. Run `build-index.ts` to regenerate `tokens.json`, `TOKENS.md`,
   `components/INDEX.md` and the README file index.
5. Bump `STATE.json` `version` and add a `CHANGELOG.md` entry listing
   only what changed (amend = patch; new component or token after 1.0 =
   minor; removing or renaming a token or ID after 1.0 = major).
6. Record the change in the design brief's open-decisions log.

A change that lands in only one of these places is how the reference
and the implementation start lying to each other.

**IDs are stable.** An approved ID is never renumbered or reused. A
retired component keeps its spec file with `status: deprecated` and a
pointer to its replacement.
