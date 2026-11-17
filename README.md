# mos-design-skills

Design skills for MarketingOS, Claude Code and Codex.

| Skill | What it does |
| --- | --- |
| **mos-design-authentication** | Gets the computer ready: checks and fixes sign-in for GitHub, Cloudflare and MarketingOS, then points to EmDash |
| **mos-design-site-planner** | Plans the website before anything is built: a sourced brief, a search-intent map and a spec for every page, approved by you |
| **mos-atomic-design-system** | Builds the design system the pages are made from, ported from Richard's atomic design framework |

Recommended order for a new website: `mos-design-authentication` →
EmDash project setup → `mos-design-site-planner` → `mos-atomic-design-system`.
Each skill works on its own; the order is what makes each step's output the
next step's input.

## mos-design-authentication

The first step. Building a website with an AI agent needs three accounts working
from your computer: GitHub (where the website project lives), Cloudflare (where
EmDash sites run) and MarketingOS (so the agent reads your business brain). The
skill runs a checker before asking you anything, shows a readiness card, and
walks you through whatever is missing in plain English. Browser sign-ins are
commands you run yourself; tokens are never printed or pasted into the chat.

It also catches the quiet problems that make an agent wrongly say "you're all
set": an expired Cloudflare token in a `.env` that overrides a working login, a
login to the wrong Cloudflare account (an employer's, say), git not using the
GitHub login, or errors in the brain.

When everything is ready it points to the next steps: create the website with
[EmDash](https://github.com/emdash-cms/emdash) (`npm create emdash@latest`, the
Marketing template suits most small businesses), then `mos-design-site-planner`.

Install for Claude Code:

```sh
npx skills add https://github.com/the-vibe-marketing-lab/mos-design-skills --skill mos-design-authentication --agent claude-code --global --yes
```

For Codex, replace `--agent claude-code` with `--agent codex`. The checker runs
with Bun.

Use: in Claude Code type `/mos-design-authentication` (Codex:
`$mos-design-authentication`), or paste:

```text
Use mos-design-authentication to check my computer is signed in to GitHub,
Cloudflare and MarketingOS. Run the checker first, fix what is missing one step
at a time, and tell me what to do next to start my website.
```

## mos-design-site-planner

Plans a small-business website from the active business brain. It shows what
the brain already knows (with the source of each fact), asks only about the
gaps with a recommended answer for each question, locks the brief with you,
then researches: the existing site and its URLs, Search Console, keyword
volumes (DataForSEO if you have a key, free autocomplete if not), results
pages, People Also Ask and competitor sitemaps. Every finding is labelled
measured, observed or assumed, and anything it could not check is listed as a
research gap rather than guessed.

The plan follows fixed rules: one page per search intent, one service page per
money service, location pages only for areas you genuinely serve with content
unique to that area, and a keep, merge or redirect decision for every existing
URL that has traffic or links. You approve or edit each page, and every
decision is recorded. It saves `site-plan/` in the website project
(`site-plan.md`, `sitemap.csv`, `decisions.md`, `research/`), runs a
deterministic plan validator (its test suite feeds it 22 deliberately broken
plans), adds the outcome to the project notes and commits the planning files
locally. It stops at the approved plan: no pages,
copy, redirects or visual design.

Install for Claude Code:

```sh
npx skills add https://github.com/the-vibe-marketing-lab/mos-design-skills --skill mos-design-site-planner --agent claude-code --global --yes
```

For Codex, replace `--agent claude-code` with `--agent codex`. Bun runs the
bundled validator. No API key is required; a DataForSEO key and a Search
Console export make the research stronger.

Use: open the business's MarketingOS brain, or a website session with that
brain in context, and paste:

```text
Use mos-design-site-planner to plan this business's website. Read the active
MarketingOS brain and the website project's notes first. Show me what you
already know, ask only about the gaps, and confirm the brief with me before
researching. Label every finding, keep one page per search intent, and walk me
through approving each page. Save the approved plan in the website project,
run the validator and record the next step.
```

In Claude Code you can also invoke `/mos-design-site-planner`; in Codex use
`$mos-design-site-planner`. When the plan is approved, run
`mos-atomic-design-system` next.

## mos-atomic-design-system

It turns the active business brain's brand and references into a documented
design system: discovery, foundations, atoms, molecules, organisms, templates
and representative pages. It includes token exports, component specifications,
an HTML review site, resumable state and verification scripts.

### Install

Ask your agent to run this command for Claude Code:

```sh
npx skills add https://github.com/the-vibe-marketing-lab/mos-design-skills --skill mos-atomic-design-system --agent claude-code --global --yes
```

For Codex, replace `--agent claude-code` with `--agent codex`. Omit `--global`
to install only in the current project. Start a new agent session after
installation so the skill can be discovered.

The installer needs Node.js/npm and Git. The bundled helper scripts run with
[Bun](https://bun.com/docs/installation). An agent can check for it and guide
installation if missing. No API key is required. Browser tools improve visual
verification; Mobbin and Figma exports are optional.

### Optional companion skills

For extra design help, consider installing:

- [Taste Skill](https://github.com/leonxlnx/taste-skill): art direction,
  reference-led layouts and frontend design guidance before building the system.
- [Impeccable](https://github.com/pbakaus/impeccable): design critique,
  accessibility audits and visual polish as the system takes shape.

Both are optional and installed separately using their own installation
instructions. You can use `mos-atomic-design-system` on its own.

If you're an agent helping with setup, suggest these companions and let the
user choose whether to install either or both. Install them only if requested.

### Use

Open the correct MarketingOS brain, or a website session with that brain in
context, and paste:

```text
Use mos-atomic-design-system to build the design system for this business's
existing website project. Read the active MarketingOS brain and saved
references first. Use our Taste Skill direction if one is already approved.
Find the project and brand sources from the existing records. Follow the
atomic stages, show the visual reviews and continue after each approval in
this conversation. Save the system in the website project and explain how
its approved tokens and components connect to the existing application.
```

In Claude Code you can also invoke `/mos-atomic-design-system`; in Codex use
`$mos-atomic-design-system`. This builds the design system and its reference
artifacts. Production pages are implemented in the website project using that
system. Standalone brand files work too; MarketingOS is useful context rather
than a hidden runtime dependency.

## Verify the package

From a clone of this repository:

```sh
bun run check
bun run test
```

The deterministic regression suite exercises valid fixtures and deliberately
broken v1, v2 and legacy systems, and a valid site plan alongside broken ones
(a duplicate intent, a missing CTA, unlabelled evidence and more). It is not a substitute for reviewing the
rendered design or testing the complete agent workflow against your business.

## Provenance

`PORT-PROVENANCE.json` records the original source revision, source-file hashes
and portability changes. The pack includes the scripts, references, templates
and evaluation scenarios required by the framework. It does not require access
to Richard's private repos or course notes.

Licensed under MIT. See [LICENSE](LICENSE).
