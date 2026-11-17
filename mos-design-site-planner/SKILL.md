---
name: mos-design-site-planner
description: "Plan a small-business website before anything is built: a sourced website brief, a search-intent map and a sitemap with a spec for every page (URL, title, H1, sections, CTA, proof), built from the active MarketingOS brain, a gap-only interview and research labelled measured, observed or assumed. Stops at an approved plan saved in the website project. Use for a site plan, sitemap, website plan, plan the site, information architecture, search-intent map, page plan or lesson 2.1 Plan The Site. Not for building pages, design systems (mos-atomic-design-system), copywriting or running a migration."
---

# MarketingOS Site Planner

Turns what the business brain already knows, plus a short interview and real
research, into a website plan someone can build from: a brief, an intent map
and one spec per page. The plan is the deliverable. This skill **stops at the
approved plan**: it never builds pages, writes final copy, sets up redirects or
chooses visual design.

## MarketingOS context and prerequisites

Recommended sequence: `mos-design-authentication` → EmDash project setup →
**mos-design-site-planner** → `mos-atomic-design-system`. None of them is a
hard prerequisite; if an earlier step has not run, say so once and carry on.

Resolve the active business brain and the website project from the current
session and its records. Read the brain's `BRAIN.md` or agent instructions,
`CONTEXT.md` and `business/` (brand, voice, audience, offers, strategy, proof,
competitors) before asking anything. If the `mos` CLI is available,
`mos context show --json` names the files behind each context field. Keep each
business's context separate. Without MarketingOS, work from the files the user
supplies and treat everything else as a gap.

Use Bun for the bundled scripts; if it is missing, point the user to
https://bun.com/docs/installation. Resolve `$SKILL` to the real directory
containing this SKILL.md; install locations differ between agents.

Invocation: `/mos-design-site-planner` in Claude Code, `$mos-design-site-planner`
in Codex. Ask questions with AskUserQuestion in Claude Code and as numbered
questions with lettered options in Codex. One initial prompt drives the whole
workflow; keep every approval in the same conversation.

## Evidence labels

Every research finding and every intent claim carries one label:

- **measured**: a number from a tool or export (Search Console clicks, a
  keyword volume, a crawl count), with the figure and a dated source ID.
- **observed**: seen directly on a date but not counted (autocomplete
  suggestions, a results page, People Also Ask, a competitor sitemap, an AI
  answer), with a dated source ID.
- **assumed**: reasoning or the user's word, with the reason written down.

A finding with no source is assumed, or it is left out. Tool access, keyword
volumes, People Also Ask questions and business facts are only ever reported
when a run actually produced them.

## Workflow

Save progress in `<project>/site-plan/state.json` after each step so a later
session resumes where this one stopped. File formats, templates and the state
schema: **`references/output-format.md`**.

### 1. Preflight

Resolve the brain, the website project (its `docs/project.md` or equivalent
project notes) and any existing site URL. If `site-plan/state.json` exists,
report its step and resume there. Detect which research tools actually work in
this session: a Search Console export or connected tool, DataForSEO keys, a
crawler (Scrapling or plain fetch), web search. Test each one; a key in the
environment that fails its test call is unavailable. Detection steps:
**`references/research.md`**. If there is no website project yet, ask once
where to save; the brain's `outputs/YYYY/MM-Mon/YYYY-MM-DD-site-plan/` is the
fallback.

Done when the brain, project, save location, existing URL (or "new site") and
the working tool list are recorded in `state.json`.

### 2. What I already know

Build the card from the brain: business, services, locations and service area,
audience, offer, voice, proof and primary action. Each item names its source
file and is marked **confirmed** (stated plainly in the brain), **inferred**
(read between the lines) or **missing**. Show it and let the user correct it.
Card format: **`references/interview.md`**.

Done when the user has confirmed or corrected the card.

### 3. Gap-only interview

Ask only about what the card marks inferred or missing, in batches, each
question with a recommended answer and the reason for it. The question bank
covers goals, money services, locations served, new site versus replacement,
functionality, proof assets, competitors and constraints:
**`references/interview.md`**. Design references belong to
`mos-atomic-design-system` and the design skills; leave them out here.

Done when every brief field is answered or recorded as a GAP.

### 4. Lock the brief

Play the brief back on one screen: the facts with their sources, the gaps, the
research plan and any paid calls with their estimated cost. Ask for a yes
before spending research time or money.

Done when the user approves the brief; record it in `decisions.md`.

### 5. Research

Run each method the preflight found working: existing-site crawl and URL
inventory, Search Console queries and landing pages, keyword volumes
(DataForSEO when keyed, otherwise autocomplete labelled as having no volume),
results pages and People Also Ask, competitor sitemaps, and an optional
AI-answer check. Missing optional sources go on the research-gaps list and the
work continues. Methods, fallbacks and cost reporting:
**`references/research.md`**. Every source gets a dated row in
`research/sources.md`.

Done when each method has either produced labelled findings or a gap entry.

### 6. Decide the pages

Cluster the queries into intents, then apply the page rules: one page per
intent, one service page per money service, location pages only for served
areas with distinct content, an explicit cannibalisation check, and a
keep, merge, redirect or retire decision for every existing URL with traffic or
links. Use the brain's existing offer and positioning as the frame.
Rules and tests: **`references/page-rules.md`**.

Done when every intent maps to one page or `none` with a reason, and every
existing URL with traffic or links has a migration action.

### 7. Spec every page

For each page: URL, title tag, H1, purpose, target intent and its evidence,
section outline, primary CTA, real proof from the brain (or a `GAP:` marker),
internal links and schema type. Then write `site-plan.md` and `sitemap.csv` and
run the validator in draft mode:

```bash
bun $SKILL/scripts/check-site-plan.ts <project>/site-plan --draft
```

Done when the draft check passes.

### 8. Approval loop

Show the sitemap tree, then the page specs in batches of three or four. For
each page the user approves, edits or removes; apply edits, re-run the draft
check and show the change. Record every decision with its date in
`decisions.md`. Repeat until the user approves the whole plan.

Done when every page's latest decision and the plan itself are `approved`.

### 9. Save and hand over

Write the final files (`site-plan.md`, `decisions.md`, `sitemap.csv`,
`research/`), set `state.json` to approved, and run the full check:

```bash
bun $SKILL/scripts/check-site-plan.ts <project>/site-plan
```

Add a dated entry to the project notes (`docs/project.md` or equivalent; ask
before creating one): what was planned, where it lives, the check result and
the next step, normally `mos-atomic-design-system`. If the website project is
already a git repository, stage the planning files by explicit path and commit
them; never stage secrets, `.env` files or raw tool responses, and never push.
Commit rules: **`references/output-format.md`**.

End with: what changed, the check output, open gaps and blockers, and the exact
next action. Report a check as passed only when it ran and passed in this
session.

## Reference map

| File | Read it when |
| --- | --- |
| `references/interview.md` | Steps 2 to 4: the card, the question bank, batching and the brief playback |
| `references/research.md` | Steps 1 and 5: tool detection, each research method, fallbacks and costs |
| `references/page-rules.md` | Step 6: intent clustering, location pages, cannibalisation, the migration map |
| `references/output-format.md` | Steps 7 to 9: the formats the validator enforces, state, decisions and commits |
| `assets/` | Starting templates for every output file |
| `scripts/check-site-plan.ts` | `--help`; run in steps 7 to 9 |
| `scripts/test-check-site-plan.ts` | Proof that the validator fails each broken plan |

## Related skills

Optional follow-ons from the MarketingOS GEO pack (`mos-geo-skills`), named
here and installed separately: `mos-geo-topic-clusters` to cluster a large
Search Console or Ahrefs export before step 6, `mos-geo-brand-360` for the
AI-answer check, and `mos-geo-fan-out-map` once the site is live.
