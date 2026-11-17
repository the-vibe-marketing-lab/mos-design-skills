# Output format

Steps 7 to 9. `scripts/check-site-plan.ts` enforces every rule marked
**(checked)**. Templates for each file are in `assets/`; a complete passing
example is `scripts/fixtures/valid-plan/`.

## Folder

```text
<website-project>/site-plan/
├── site-plan.md        brief, intent map, sitemap, page specs, migration map, research gaps
├── decisions.md        every approval, edit and removal, dated
├── sitemap.csv         one row per page, mirrors the specs
├── state.json          resumable progress
└── research/
    ├── sources.md      one dated row per source
    ├── notes.md        optional: findings by method
    └── raw/            exports and API responses; never committed
```

## site-plan.md

Five H2 sections, with these exact names **(checked)**:

### `## Website brief`

Top-level bullets, `- Field: value`. Required fields **(checked)**: Business,
Primary action, Money services, Areas served, Audience, Offer. Useful extras:
Secondary action, Services to show less, Location type, Voice, Proof, Site
status, Functionality, Constraints.

Every bullet ends with `(source: <brain file, URL, or user YYYY-MM-DD>)` or
contains `GAP:` and what is missing **(checked)**. `Areas served` is a comma
list; write `none` for an online-only business. Location pages must name one
of these areas **(checked)**.

### `## Search-intent map`

One Markdown table with columns ID, Intent, Example queries, Evidence, Label,
Page **(checked: all but Example queries required)**.

- ID: `I-01`, unique.
- Label: `measured`, `observed` or `assumed` **(checked)**.
- Evidence: required. Measured evidence states its number; measured and
  observed evidence cite a source ID from `research/sources.md`, eg `(S-02)`
  **(checked)**. Assumed evidence states the reason.
- Page: the owning page ID, or `none` for an intent the site will not serve.
  The owning page must list the intent **(checked)**.

### `## Sitemap`

Optionally a tree in a fenced code block (ignored by the validator), then one
H3 per page: `### P-01 Home`. Each page is a list of `- Field: value` bullets;
nested bullets or numbered lines under a field belong to it.

| Field | Rule |
| --- | --- |
| URL | Required, a path starting with `/`, unique **(checked)**. Home is `/` **(checked)** |
| Type | Required: home, service, location, about, contact, lead, blog-index, article, utility or other **(checked)**. Exactly one home and at least one contact page **(checked)** |
| Parent | Optional page ID; must match `sitemap.csv` **(checked)** |
| Title tag | Required **(checked)**; a warning past 65 characters |
| H1 | Required **(checked)** |
| Purpose | Required **(checked)** |
| Primary intent | Required, an intent ID; `none` only for utility pages. One owner per intent across all pages **(checked)** |
| Also covers | Optional comma list of intent IDs this page also owns **(checked as above)** |
| Primary CTA | Required, the one action the page asks for **(checked)** |
| Proof | Required. Each item has `(source: ...)` or is marked `GAP:` with what is needed **(checked)** |
| Sections | Required, the section outline in order **(checked)** |
| Internal links | Required, the URLs this page links to **(checked)** |
| Schema | Required, the schema.org type(s) **(checked)** |
| Served area | Location pages only: one area from the brief **(checked)** |
| Distinct content | Location pages only: what makes this page more than a suburb swap **(checked)** |

### `## Migration map`

A table with Old URL, Evidence, Label, Action, Target **(checked)**. Action is
keep, merge, redirect or retire; a kept URL and every redirect or merge target
must be a sitemap URL **(checked)**. Evidence follows the intent-map rules
**(checked)**. With no existing site, one line: `None: <reason>` **(checked)**.

### `## Research gaps`

A list of the methods that did not run and why, or `None` **(checked: not
empty)**.

## sitemap.csv

Columns `page_id,url,type,title_tag,h1,primary_intent,primary_cta,parent`.
One row per page spec, no extras; each value matches its spec (whitespace and
URL trailing slashes are normalised) **(checked)**. Quote values containing
commas.

## research/sources.md

A table with ID, Source, Date, Method, Notes. IDs `S-01` upward and unique;
Date is `YYYY-MM-DD` **(checked)**. Put a paid call's reported cost in Method or
Notes.

## decisions.md

A table with Date, Page, Decision, Notes **(checked)**. Page is a page ID,
`brief`, `plan` or an area or pair under discussion. Decision is approved,
edited, added, removed, deferred or rejected **(checked)**. Rows are appended in
order, never rewritten.

Final mode **(checked)**: each page's latest row is `approved`, and a row with
Page `plan` and Decision `approved` exists. Draft mode (`--draft`) skips this so the plan can be
checked before the approval loop.

## state.json

```json
{
  "schemaVersion": 1,
  "status": "in-progress",
  "step": 5,
  "brain": "<brain folder name>",
  "project": "<website project folder name>",
  "existingSite": "https://example.com.au or null",
  "tools": { "searchConsole": "export | connected | none", "dataforseo": false, "crawler": "scrapling | fetch | none", "webSearch": true },
  "approvals": { "card": "YYYY-MM-DD", "brief": null, "plan": null },
  "openQuestions": [],
  "updated": "YYYY-MM-DD"
}
```

`status` is `in-progress` until step 9, then `approved`. On resume, read it,
tell the user the step and what is left, and continue from there.

## Project notes entry

Append to `docs/project.md` (or the project's equivalent):

```markdown
## YYYY-MM-DD Site plan approved

- Plan: site-plan/site-plan.md (N pages, M intents), sitemap.csv, decisions.md
- Check: check-site-plan.ts PASS (final), N pages, M intents, 0 errors
- Open gaps: <from Research gaps and GAP: markers>
- Next: run mos-atomic-design-system for the design system; the migration map is ready for the migration step
```

## Committing

Only when the website project is already a git repository. Run `git status`
first, then stage by explicit path:

```bash
git add site-plan/site-plan.md site-plan/decisions.md site-plan/sitemap.csv \
  site-plan/state.json site-plan/research/sources.md docs/project.md
git commit -m "Add approved site plan"
```

Add `site-plan/research/notes.md` if it exists. Leave out `research/raw/`,
`.env` files, credentials and anything holding personal data (form
submissions, customer lists). Leave other people's uncommitted changes
untouched. Never push; the user decides when.
