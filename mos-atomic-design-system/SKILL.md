---
name: mos-atomic-design-system
description: "Build or extend a brand-grounded atomic design system with tokens, component specifications and an HTML review site. Use for design systems, UI kits, component libraries, brand-to-token work and Figma token exports. Works from an active MarketingOS brain or standalone brand files; preserves existing systems and stage approvals."
---

# MarketingOS Atomic Design System

Turns a brand into a reviewable design system: tiered tokens, one spec file
per component, and a static HTML reference site, built one rung at a time with
a human sign-off between each — all under one `design-system/` folder that a
person or an agent can navigate from a single README.

## MarketingOS context and prerequisites

Resolve the active business brain and website target from the current session
and its project records. Read the brain's BRAIN.md or agent instructions,
CONTEXT.md, brand, voice, audience, offer and saved design references before
asking for information. Keep each business's context separate. Record the
source brain and target in the design brief. When used without MarketingOS,
work from the supplied brand files and identify genuine gaps.

Use Bun for the bundled TypeScript scripts. If it is missing, guide the user
to the official installation instructions at https://bun.com/docs/installation.
Resolve `$SKILL` to the real directory containing this loaded SKILL.md; agents
install in different places, so do not assume a particular home path.

If the user has selected Taste Skill, read its installed instructions first
and use its art direction and reference findings as inputs to this framework.
Preserve this framework's brand contract, token system and stage decisions.
Taste Skill is a separate optional dependency, not bundled with this pack;
inspect its current official instructions at
https://github.com/leonxlnx/taste-skill when installation is requested.

One initial prompt can drive the complete workflow. Keep required decisions
and visual stage approvals in the same conversation, resuming after each
reply without requiring another copy-and-paste prompt. Stop at the stage the
user requested; do not treat one invocation as permission to skip approvals.

## The idea

A design system fails in one of two ways. Either it is invented — the model
picks a nice palette and the result is confident, coherent, and not the brand.
Or it is built all at once, so a wrong decision at the bottom silently
propagates through twenty pages before anyone sees it.

This skill addresses both. **Discovery before design:** find what has already
been decided and be explicit about the gaps. **A gate between rungs:** rework at
Foundations is a five-line edit; the same rework at Pages is twenty pages.

## Router

Work out where the user is, then act. Don't ask what mode they want.

| Situation | Do this |
| --- | --- |
| No `STATE.json` and discovery finds no existing atomic system | Start Stage 0 (v2 layout) |
| Discovery reports `existingAtomicSystem` but there's no `STATE.json` (hand-built HTML, e.g. an existing project's `public/atomic-framework/`, a legacy project's `stage-*.html`) | **Legacy system.** Extend it in its own files and naming: add to its existing pages, keep its markup/class/ID conventions, record new work in a small `ATOMIC-NOTES.md` beside it. Its conventions are kept, but the quality floor isn't lowered: visible `:focus-visible`, 44px targets, contrast, and an Inspiration Map with take *and* leave filled. If it lives in a sibling repo, that's a second repo — ask before writing there (see Safety) and give the target a short `DESIGN-SYSTEM.md` pointing at it. Don't scaffold v2 unless the user asks to migrate. Verify with `verify-stage.ts --legacy <dir>`. Detail: `references/output-structure.md` |
| `design-system/STATE.json` with `schemaVersion: 2` | v2 system: report status, run the next unapproved stage |
| `STATE.json` without `schemaVersion: 2` (under `docs/design-system/` or `design-system/docs/`) | **v1 system** built by the old skill. Extend it in its v1 layout and conventions (`init-system.ts --schema 1` if a v1 scaffold file is missing). Don't migrate unless the user asks |
| "migrate to v2" / "move to the new structure" | Follow the migration procedure in `references/output-structure.md`, on a branch |
| "redo the molecules" (or `--stage <n>` in the request) | Rebuild that stage, mark downstream stale |
| "where are we" (or `--status`) | Print the ladder with per-stage status and version, then stop |
| "export to figma" / "figma variables" | Run `export-figma.ts` — see `references/figma-export.md`. Never part of the ladder |
| User explicitly waives the gates ("don't stop for approvals"; `--non-interactive` in an eval or CI) | Run the ladder without stopping and present every gate together at the end — see "Waived approvals" below |
| Target repo unclear | Ask, once. Don't guess between sibling repos |

Resolve the target repo first. Everything else is relative to it.

`--stage`, `--status` and `--non-interactive` above are ways a user phrases a
request to this skill — modes of behaviour, not script flags.

## Setup

```bash
# Set SKILL to the real directory containing the loaded SKILL.md
bun $SKILL/scripts/discover-brand.ts --target <repo> [--siblings <dir>]   # Stage 0
bun $SKILL/scripts/init-system.ts    --target <repo>               # scaffold v2; --schema 1 only for an old-skill v1 system
bun $SKILL/scripts/init-system.ts    --target <repo> --page <file> # stage page from the shell, rail + aria-current filled
bun $SKILL/scripts/verify-stage.ts   --target <repo> --stage <n>   # reads schemaVersion; --legacy <dir> for hand-built systems
bun $SKILL/scripts/build-index.ts    --target <repo>               # after every approved stage
bun $SKILL/scripts/export-tokens.ts  --target <repo>               # tokens.css → tokens.json + TOKENS.md (build-index runs it)
bun $SKILL/scripts/export-figma.ts   --target <repo>               # optional
```

`discover-brand.ts` searches the target and its parent directory by default.
Use `--siblings <dir>` when the active brain lives elsewhere. Read the
resolved brain explicitly even when discovery finds no matching sibling.
Every script flag is documented in `references/output-structure.md`.

Output (v2) — one root, one entry file, one spec per component:

```
design-system/
├── README.md          START HERE — entry point for people and agents
├── STATE.json         schemaVersion 2, stages, approvals, inventory, version, themes
├── CHANGELOG.md       one entry per approved stage / publish
├── brief/DESIGN-BRIEF.md
├── tokens/            tokens.css (canonical) · tokens.json · TOKENS.md (generated) · figma/ (optional)
├── foundations/FOUNDATIONS.md
├── components/        INDEX.md (generated) · atoms/ molecules/ organisms/ templates/ <ID>-<slug>.md
├── rules/RULES.md
└── reference/         static HTML review site (noindex) · styles.css · pages/P-nn-<slug>.html
```

Why it's shaped this way, the README spec, the v1 → v2 path table and the
migration procedure: **`references/output-structure.md`**. Read it when
scaffolding, writing the README, or migrating.

## The ladder

Seven build stages. Foundations sits ahead of Atoms because you cannot build an
atom without tokens; Rules lands last because guardrails are written from what
was actually decided. Paths are relative to `design-system/`.

| # | Stage | Produces |
| --- | --- | --- |
| 0 | Discover | `brief/DESIGN-BRIEF.md`, `STATE.json`, `README.md` skeleton, `CHANGELOG.md`, `reference/index.html` (00) |
| 1 | Foundations | `tokens/tokens.css` (+ generated json/md), `foundations/FOUNDATIONS.md`, `reference/foundations.html` (01) |
| 2 | Atoms | `components/atoms/A-nn-*.md`, `reference/atoms.html` (02), `reference/icons.html` (02A) |
| 3 | Molecules | `components/molecules/M-nn-*.md`, `reference/molecules.html` (03) |
| 4 | Organisms | `components/organisms/O-nn-*.md`, `reference/organisms.html` (04) |
| 5 | Templates | `components/templates/T-nn-*.md`, `reference/templates.html` (05) |
| 6 | Pages | `reference/pages.html` (06), `reference/pages/P-nn-*.html`, `reference/rules.html` (07), `rules/RULES.md`, final `README.md`, version `1.0.0` |

Full per-stage artifacts and acceptance criteria: **`references/stage-specs.md`**.
Read the section for the stage you're on, not the whole file.

## Stage 0 — Discover

Three inputs, then synthesis. Do the first two concurrently; they don't depend
on each other.

**1. Design inspiration.** Reuse saved references from the active brain or
the Taste Skill pass first; ask only for missing raw URLs — three to six, specific
pages rather than homepages where possible. Snapshot each with the available browser tool, checking actual fonts and
layout. Use Interceptor only if it is installed and appropriate to the session. Extract the computed palette, type stack, spacing rhythm
and radii — actual rendered values, not marketing hexes.

**2. Mobbin MCP (optional).** For pattern questions the URLs can't answer: how this
category sequences onboarding, structures pricing, handles empty states. The
MCP may be installed but unauthenticated — if only
`mcp__mobbin__authenticate` / `complete_authentication` are exposed, run the
OAuth flow and hand the user the URL. If they decline, continue and record the
gap in the brief. Never imply pattern research happened when it didn't.

**3. Brand discovery.** Run `discover-brand.ts`. It probes the known path
conventions across the target and its sibling repos, merges companion docs, and
partitions by brand family before ranking — so another brand's polished document
can never win. Read three things off it: which document, whether the visual
contract is `full`/`partial`/`verbal-only`, and whether an atomic system already
exists (if so, extend it rather than starting over).

**Confirm the brand source with the user before compiling anything.** It is the
one error that invalidates every stage downstream.

Then write `DESIGN-BRIEF.md`. Its **Inspiration Map** needs both halves of every
row — what we take *and* what we deliberately leave. The leave column is where
the judgement lives; a row with only "take" is a collage instruction. Its §3
visual contract names each hue and the step each given hex sits at, the themes,
and the type-scale ratio — the inputs Stage 1 compiles.

Detail: **`references/brand-discovery.md`** and
**`references/inspiration-research.md`**.

## Stages 1–6 — the loop

Every stage runs the same five beats.

**1. Build.** Follow the stage spec. Compose only approved lower-level pieces.
A stage that needs a token Foundations doesn't have means Foundations was
incomplete — go back and amend it rather than defining a local value, or the
system starts contradicting itself. Stage 1: read
**`references/token-architecture.md`** first. Stages 2–4: read
**`references/component-anatomy.md`** first, and write one spec file per
component from `assets/docs/COMPONENT-SPEC.md` alongside its specimen.
Stage 1 also runs `export-tokens.ts` so `tokens.json` and `TOKENS.md` exist
for the review. Start each stage page with `init-system.ts --page <file>` so
the rail is generated, not hand-copied.

**2. Verify.** `bun $SKILL/scripts/verify-stage.ts --target <repo> --stage <n>`.
Fix what it reports before showing anything. It checks ID contiguity, raw
values outside `tokens.css`, tier markers and tier references, focus
treatments, `noindex`, rail wiring, organism recipes and state ordering.

**3. Show.** Look at the rendered page before the reviewer does, in this
order: the session's available browser tool over local HTTP, with fonts
loaded → another available visual browser tool → DOM checks only
(computed tokens, fonts loaded, no sideways scroll at 375px). Headless misses
web fonts and rendering issues, which are much of what's being judged. Say
which tier you used and what was *not* checked visually.

**4. Gate.** Present the artifact and ask using the available question tool or a concise message:

- **Approve** → advance `STATE.json`, unlock the next stage
- **Revise** → take the notes, rebuild, verify, show again
- **Approve with notes** → advance, record the notes as open decisions

Only advance on an explicit yes. The gate exists because the reviewer knows
things about this brand that aren't written down anywhere — and because it's the
throttle that lets a large build stop after Atoms and resume next week.

**Waived approvals.** When the user explicitly says not to stop (or an eval or
CI prompt runs non-interactive), run the ladder without pausing: answer the
Stage 0 interview from the request and the evidence, mark each such answer
provisional in the brief's open decisions, record every stage as "approved
without review (waived by user)" in `STATE.json` and `CHANGELOG.md`, and present
all the gates together at the end. Never waive on your own judgement — a quiet
user hasn't waived anything. Detail: `references/stage-specs.md`.

**5. Index.** On approval: mark the stage's specs `status: approved`, run
`build-index.ts` (regenerates `tokens.json`, `TOKENS.md`, `components/INDEX.md`
and the README file index), append a `CHANGELOG.md` entry listing only what
changed, and bump `STATE.json` `version` — `0.1.0` for Foundations up to
`0.5.0` for Templates; approving Pages publishes `1.0.0`. Amending an approved
stage is a patch (so is re-approving each stale downstream stage); full rules in
`references/output-structure.md`. Generated files carry a do-not-hand-edit
header; edit their sources and re-run.

When you present a stage, keep it short: what was built, the count per level,
anything you had to decide without evidence, and the one thing most worth
looking at. Not a tour of every specimen.

## Conventions that hold everywhere

Full detail in **`references/html-conventions.md`**. The load-bearing ones:

- **Zero-padded contiguous IDs** — `A-01`, `M-17`, `O-04`, `T-05`, `P-02` —
  shown in the UI via `.card-label`, mirrored in `data-*`, and matching the
  spec file name. Stable once approved; renumbering breaks every reference.
- **Four token tiers** — brand → alias → mapped → responsive, each opened by
  an `@tier` marker in `tokens.css`. Raw literals only in Brand and Responsive.
  Colour, border width and radius go Mapped → Alias → Brand, never skipping;
  mapped `--space-*`, `--duration-*`, `--ease-*`, `--shadow-*` and `--font-*`
  may read Brand directly because they have no alias. The one list of
  exceptions is in `references/token-architecture.md`.
- **Mapped tokens only in components.** No `--brand-*` or `--alias-*` in
  component or specimen CSS, and no raw values outside `tokens.css`. This is
  what makes a theme switch or rebrand a token edit.
- **Full colour scales** — every hue 50–900, given hexes at their natural step,
  derived steps marked. Text hierarchy from solid neutral steps, not opacity.
- **State and Type axes** on every interactive component — default, hover,
  focus, active, disabled (+ error, loading, selected where relevant), shown
  live and listed in the spec. Disabled looks the same across types.
- **One focus ring** — `--focus-ring-width` outline in `--color-border-focus`,
  offset `--focus-ring-offset`, never shifting layout.
- **44px targets from a token** — `min-block-size: var(--size-touch-target)`
  on every interactive component, so the floor is one value, not forty.
- **One spec `.md` per component**, sections in the order of
  `assets/docs/COMPONENT-SPEC.md`, frontmatter naming what it composes and the
  tokens it uses.
- **Live markup, never screenshots.** A screenshot can't be focused, hovered or
  resized — which are the properties being approved.
- **Organisms name their molecule recipe.** Without it the ladder is invisible.
- **`noindex` on every page.** These carry unapproved decisions and sometimes
  real client copy.
- **One job per molecule.** Two jobs means two molecules.
- **Promote only what repeats** in at least two credible contexts.

These are v2 conventions. A v1 system keeps its primitives (`--base`,
`--contrast`, …), opacity text hierarchy and single `COMPONENT-MAP.md` — the
v1-only criteria are at the end of `references/stage-specs.md`.

## Safety

- **Stop only what you started, by PID.** Never kill by image name
  (`taskkill /IM python.exe`, `pkill python`, `killall node`): two eval runs did
  that to stop a preview server and killed every Python process on the user's
  machine. Note the PID when you start a server; stop that one.
- **A sibling repo is a second repo.** Extending a legacy system that lives
  next door writes into a repo the user didn't name. Say so and get a yes
  before writing there; with approvals waived, record it in `ATOMIC-NOTES.md`
  and the run notes instead.

## Figma (optional)

If the user wants the tokens in Figma, run `export-figma.ts` after Foundations
is approved. It writes DTCG files per collection × mode into
`tokens/figma/` with import notes. It never gates a stage and most builds skip
it. How the tiers map to Figma collections, import routes and variable
scoping: **`references/figma-export.md`**.

## Worked examples and method

Read `references/gold-standard.md` when a stage specification is clear about
what to build but you need calibration on depth and evidence. These are
illustrative, portable examples, not dependencies on the author's projects.

The original framework adapted token and component concepts from UI
Collective's design-system teaching into an agent workflow. The executable
helpers, review stages and references needed to run this port are bundled;
no private course outline or author workspace is required.

## Honesty rules

These matter more than they look, because a design system is a document people
trust later without re-deriving.

- **Label temporary choices as temporary.** An unlabelled placeholder calcifies
  into a decision nobody remembers making. Give them their own section in the
  brief and flag them at every review. Derived colour steps are marked as
  derived for the same reason.
- **Record provenance for real content and real numbers** — where from, when. If
  a figure is omitted because sources disagreed, say so; an unexplained gap
  reads as an oversight, an explained one reads as judgement.
- **State gaps rather than filling them silently.** No Mobbin, no brand doc, no
  type contract — say it. A stated gap is recoverable; a false claim isn't.
- **Don't advance the state file on your own judgement.** Only the user's
  explicit waiver (or an eval) skips a gate, and the record says so.
