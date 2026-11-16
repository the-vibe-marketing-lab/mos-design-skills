---
id: {{ID}}
name: {{NAME}}
level: {{LEVEL}}
status: draft
composes: []
tokens: []
specimen: reference/{{PAGE}}.html#{{ID}}
implementation:
---

<!--
  One file per component: design-system/components/<level>/<ID>-<slug>.md
  e.g. components/atoms/A-01-button.md
  level: atom | molecule | organism | template
  status: draft -> approved (on stage approval) -> deprecated (never deleted).
          legacy = carried over by a migration: usable, not yet signed off
          under v2; promote to approved when it passes a stage review.
  composes: IDs this is built from, e.g. [A-02, A-03]. Empty for most atoms.
            Templates list their organism sequence in order.
  implementation: optional — path to the component in the product
          codebase once one exists (e.g. src/components/Button.astro).
  tokens: every mapped/responsive token the component CSS uses. No
          --brand-* or --alias-* — if one is needed, Foundations is missing
          a mapped token.
  Keep the sections below in this order. Write "n/a — <reason>" rather
  than deleting a section, so an omission reads as a decision.
  Full guidance: references/component-anatomy.md in the skill.
-->

# {{ID}} {{NAME}}

## Purpose

{{ONE_JOB}}

<!-- One sentence: the single job. If it needs "and", it may be two
     components. Add when to use it vs its nearest sibling. -->

## Anatomy

1. {{PART}}
2. {{PART}}

<!-- Numbered parts, in visual order. Mark optional parts "(optional)".
     Mark private sub-parts "(internal)" with their class name, e.g.
     "3. Control — `.field__control` (internal)". Internal parts get no ID. -->

## Props / variants

| Prop | Values | Default |
| ---- | ------ | ------- |
| type | {{TYPES}} | {{DEFAULT_TYPE}} |

<!-- The Type axis first, then optional parts (icon-left: none | <icon>),
     then content props (label: text). Size only if the brand needs it. -->

## States

| State | Visual change | Tokens |
| ----- | ------------- | ------ |
| default | | |
| hover | | |
| focus | shared focus ring, nothing else moves | `--focus-ring-width` `--color-border-focus` `--focus-ring-offset` |
| active | | |
| disabled | same across all types | `--color-surface-disabled` `--color-border-disabled` `--color-text-disabled` `--color-icon-disabled` |

<!-- Add error, loading, selected where they apply. Mark states that
     don't apply as "n/a". Non-interactive components: one row, "static". -->

## Sizes

{{SIZES}}

<!-- Table of size | dimensions | when to use, or "n/a — single size".
     Every size keeps a 44×44 target. -->

## Behaviour & responsive

{{BEHAVIOUR}}

<!-- What happens on interaction, with long content, and at narrow widths. -->

## Accessibility

- **Role / element:** {{ROLE}}
- **Keyboard:** {{KEYBOARD}}
- **Focus:** shared focus ring on `:focus-visible`
- **Target size:** ≥44×44px
- **Labels:** {{LABELS}}

## Markup

```html
{{CANONICAL_MARKUP}}
```

<!-- Minimal canonical HTML — the classes and attributes an implementer
     copies. Same markup as the specimen, without the demo scaffolding. -->

## Do / Don't

- **Do** {{DO}}
- **Don't** {{DONT}}
