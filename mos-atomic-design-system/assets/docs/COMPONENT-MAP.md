# {{BRAND_NAME}} — Component Map

<!--
  v1 ONLY. Used when extending a v1 system (docs/design-system/ or
  design-system/docs/ layout, no schemaVersion 2) that doesn't have a
  component map yet. v2 systems use one spec per component
  (COMPONENT-SPEC.md) plus the generated components/INDEX.md instead.

  The reference-to-implementation handoff, written at Stage 6.

  The static reference under {{REFERENCE_DIR}} is the visual
  contract. It is deliberately independent of any framework so that
  approving a design decision doesn't require committing to a stack.
  When production implementation begins, components should CONSUME
  this reference rather than define a competing visual system.
-->

Status: {{STATUS}}
Reference: `{{REFERENCE_DIR}}`
Tokens: `{{TOKENS_PATH}}`

---

## Foundations

| Foundation | Source | Status |
| ---------- | ------ | ------ |
{{FOUNDATION_ROWS}}

---

## Atoms

| ID | Specimen | Implementation | Required states | Status |
| -- | -------- | -------------- | --------------- | ------ |
{{ATOM_ROWS}}

<!-- "Required states" is the acceptance criteria for that atom. An
     atom with only a default state has not been designed, it has
     been drawn. Hover, focus, disabled, loading, error — whichever
     apply — belong in this column and in the specimen. -->

---

## Molecules

{{MOLECULE_SUMMARY}}

| ID | Specimen | Group | Usage |
| -- | -------- | ----- | ----- |
{{MOLECULE_ROWS}}

---

## Organisms

{{ORGANISM_SUMMARY}}

| ID | Specimen | Composed from | Usage |
| -- | -------- | ------------- | ----- |
{{ORGANISM_ROWS}}

---

## Templates

| ID | Template | Reference | Status |
| -- | -------- | --------- | ------ |
{{TEMPLATE_ROWS}}

---

## Pages

| ID | Page | Instantiates | Reference | Content basis |
| -- | ---- | ------------ | --------- | ------------- |
{{PAGE_ROWS}}

### Content provenance

{{CONTENT_PROVENANCE}}

<!-- Where the real copy and real numbers on the page references came
     from, and when. If a figure was deliberately omitted because
     sources disagreed, say so here — an unexplained gap reads as an
     oversight, an explained one reads as judgement. -->

---

## Promotion rule

A pattern moves up the ladder only when its lower-level pieces are
approved **and** the new composition repeats in at least two credible
contexts. One-off compositions stay local to their page until reuse
is proven.

This is the rule that keeps the system from bloating. Most "we need a
new component" requests are actually one page's problem.

---

## Verification contract

{{VERIFICATION_CONTRACT}}

<!-- Which check locks which stage. The reusable trick: the spec
     sheet and the test are the same artifact, so the inventory
     cannot silently drift. -->
