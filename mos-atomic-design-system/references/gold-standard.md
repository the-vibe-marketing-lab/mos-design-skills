# Calibration examples

These examples are illustrative. They do not claim that an unbundled client
project is available or that any particular design was verified.

## New business website

Start with the active brain's actual brand, audience, offer and proof. The
brief records the brand sources and an Inspiration Map with both take and
leave decisions. A verbal-only brand becomes a labelled proposed visual
direction, not an invented existing brand guideline.

Foundations contains full documented colour scales, a type scale, spacing,
radii, focus and motion values. Tokens use the brand → alias → mapped →
responsive model. Every derived value has its provenance. Atoms demonstrate
their real states; molecules have one job; organisms compose those approved
pieces. Templates and representative pages test the system with realistic
content at desktop and phone widths.

Use the stage specifications for required artifacts. Component counts follow
the real interface inventory; adding arbitrary components to hit a quota is
not completeness. A reference page is useful only when it demonstrates the
states and decisions an implementer needs.

## Existing system

Read its state, README, token files and reference pages before scaffolding.
A hand-built system keeps its existing file and component conventions while
gaps are filled. A migration is an explicit decision with a file mapping,
not an incidental side effect of running an initializer.

## Handoff into EmDash or another application

The design-system reference is distinct from production pages. Record which
theme and component files consume the approved tokens. Reuse the production
application's working layouts and content model. Explain the sync boundary
so a change to a token or component has one authoritative source.

## Review evidence

Show the rendered artifact, the verification result, what was approved and
what remains provisional. Where browser tools are unavailable, state that
visual checks remain outstanding. See stage-specs.md for stage-specific
acceptance criteria and output-structure.md for the folder contract.
