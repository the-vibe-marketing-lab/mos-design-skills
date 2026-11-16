# Brand discovery — finding the contract before designing anything

Read this at Stage 0. It covers resolving the brand source, what to do when
the source is incomplete, and the interview fallback.

## Why this comes first

Every value in the finished system traces back to a decision. If that decision
came from a brand document, the system is *documenting* a brand. If it came
from the model's aesthetic preferences, the system is *inventing* one and
calling it the brand — which reads as competent right up until the moment
someone compares it to the real logo.

So the first job is not design. It is finding out what has already been
decided, and being explicit about the gaps.

## Run the script

```bash
bun $SKILL/scripts/discover-brand.ts --target <repo> [--siblings <dir>] [--json]
```

It probes the known path conventions across the target repo and its sibling
repos, reads frontmatter, merges declared companion files, and ranks what it
finds. Exit code `3` means nothing was found for this brand.

**Where it looks for siblings.** By default it searches the target's parent
directory, so it works with any workspace layout. Pass `--siblings <dir>`
when the active MarketingOS brain lives elsewhere, and explicitly read that
brain's recorded brand source. A sibling folder can be a candidate without
Git metadata. `--all` includes archived documents.

**Templates are never sources.** A file with unresolved `{{PLACEHOLDER}}`s, a
scaffolded `design-system/brief/DESIGN-BRIEF.md` (or v1
`docs/design-system/…`) that still matches the skill's template, and anything
inside the skill itself are listed under `skippedTemplates` and never ranked.
Otherwise `init-system.ts` followed by discovery would offer the empty brief it
just wrote as "the brand".

Read the output carefully — it answers three separate questions:

**1. Which document?** The top-ranked candidate. Discovery partitions by brand
family before ranking, so a document belonging to a different brand can never
win. This matters: a polished doc for the wrong brand is the worst possible
result, because it produces a confident, coherent system for someone else's
company. If `noFamilyMatch` is true, only other brands' docs exist — treat that
as "nothing found", never as "close enough".

**2. Is the visual contract complete?** `visualContract` is `full`, `partial`,
or `verbal-only`. A brand doc that is 1 KB of positioning is still the correct
source of truth for *who this is*, and carries nothing about *what it looks
like*. Those are different facts and conflating them is the main trap here.

**3. Does a system already exist?** If `existingAtomicSystem` is non-empty,
this brand has been through some of this ladder before. Read those artifacts
first. Extending an approved system is almost always right; replacing one
silently discards decisions someone already signed off on.

Then check for a `STATE.json` to tell three cases apart:

- **`design-system/STATE.json` with `schemaVersion: 2`** — a v2 system. Resume it.
- **A `STATE.json` without it** (under `docs/design-system/` or
  `design-system/docs/`) — a v1 system built by the old skill. Extend it in its
  v1 layout (`init-system.ts --schema 1` only if a v1 scaffold file is missing).
- **`existingAtomicSystem` reported but no `STATE.json` at all** — a legacy,
  hand-built system (an existing project's `public/atomic-framework/*.html`, a legacy project's
  `reference/brand/atomic-design/stage-*.html`). Extend it in its own files and
  naming: add to its existing pages, keep its markup, class and ID conventions,
  and record new work in a small `ATOMIC-NOTES.md` beside it, including which
  ladder stage each legacy page corresponds to (by content, not file name). If
  the system is in a sibling repo, give the target a short `DESIGN-SYSTEM.md`
  pointing at it. Verify with
  `verify-stage.ts --legacy <dir>`, which applies only the generic checks
  (noindex, raw values, focus).

In the v1 and legacy cases, don't scaffold v2 unless the user asks to migrate
(`output-structure.md`).

## Confirm the pick with the user

Always. Use an available question tool or a concise message with the top candidates.
Discovery is a heuristic over other people's filing habits, and it cannot know
that the doc in `_archive/` is the one actually in use because the migration
stalled. One click here prevents rebuilding six stages on a wrong foundation.

Show the score reasons — they make a wrong pick obvious at a glance.

## When the visual contract is incomplete

Do not silently invent the missing half, and do not stop. Both are failures:
inventing produces a fake brand, stopping produces nothing.

Derive the missing layer, and label every derived value as provisional:

- **Colour missing** — pull from the inspiration snapshots (Stage 0 has real
  computed values from real sites) and from any logo or asset files in the
  brand folder. State the derivation in the brief: "accent sampled from the
  wordmark in `reference/brand/assets/logo.svg`".
- **Colour present but partial** — the usual case. A brand doc gives one or
  two hexes per hue, not a scale. Record each given hex and the step it sits
  at (a mid-tone at 500, a deep navy at 800); Stage 1 derives the rest of the
  scale around it (`token-architecture.md`). Name any status hues the brand
  already uses so they aren't replaced with defaults.
- **Typography missing** — ask. Type is the single most identity-carrying
  choice in a system and the one where a guess is most visible. If the user
  has no preference, propose two options with a reason each rather than
  picking silently.
- **Both missing** — run the full interview below.

Then do the thing that makes the next run cheaper: **write the derived
contract back to the brand document.** A system whose tokens exist only in
`tokens.css` will drift, because the next person to touch the brand edits the
`.md`. Offer this as an explicit step; it is the difference between a one-off
artifact and a compounding asset.

## The interview fallback

When no brand document exists at all, derive the contract in this order. The
sequence matters — later answers are constrained by earlier ones, and asking
about hex codes before knowing the strategic direction produces arbitrary
answers.

1. **Strategic direction** — what should someone feel in two seconds, and what
   is this brand deliberately *not*? Push for the negative; it is more useful
   than the positive and people rarely volunteer it.
2. **Reference brands** — which three companies' surfaces feel right, and what
   specifically about each? This is where the inspiration URLs come from, so
   run it alongside the snapshot step.
3. **Light or dark default, and whether the other theme is wanted.** A real
   fork, not a preference: it changes every contrast calculation downstream.
   Decide it once, here.
4. **Accent** — one colour that carries the brand. If they name several, ask
   which survives if they only get one; systems with three co-equal accents
   have no accent.
5. **Type** — display face, reading face, and whether technical detail needs a
   mono. Two faces is a complete system; four is usually decoration.
6. **Non-negotiables and forbidden things** — the "never do this" list. Stock
   photography, gradients, emoji, particular colours. These become the
   guardrails in `rules/RULES.md` and they are what stops later stages drifting.

Record every answer in `brief/DESIGN-BRIEF.md` with its provenance. An unattributed
value is indistinguishable from an invented one six weeks later.

## Also read the verbal identity

Discovery reports `verbalIdentity` — voice, audience, positioning, soul files.
These do not contain colour or type, so they cannot fill a visual gap, but they
constrain tone: the copy in the Stage 6 page references has to sound like the
brand, and organism names and labels read better when they use the brand's own
vocabulary.

Read them if Stage 6 will carry real copy. Skip them if the run stops at Atoms.

## Known conventions

`scripts/discover-brand.ts` holds the current list in `KNOWN_PATHS`. Three
families exist in the wild:

| Convention | Example | Notes |
| --- | --- | --- |
| Domain-nested | `business/brand/guidelines/brand-guidelines.md` | Newest; often has `canonical: true` |
| Flat reference | `reference/brand/brand-guidelines.md` | May split into companion files |
| Positioning-only | `business/brand/brand.md` | Usually `verbal-only` |

When a run finds a document under a path not in that list, add it. The list is
the accumulated knowledge of where these things actually live, and it is only
useful if it keeps growing.
