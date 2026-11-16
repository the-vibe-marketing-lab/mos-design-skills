# Inspiration research — snapshots, Mobbin, and the take/leave discipline

Read this at Stage 0, alongside `brand-discovery.md`. The brand document says
what this brand *is*; inspiration research says what "good" looks like in this
category right now. Both feed the same brief.

## Why the "leave" column is the whole point

The instinct with design inspiration is to collect things you like. That
produces a collage: five brands' best ideas in one layout, coherent with
nothing. The useful artifact is the **Inspiration Map** — for each source, what
we take *and what we deliberately don't*.

The "leave" column is where judgement lives. "We take Linear's typographic
discipline, we leave their density" is a design decision. "We like Linear" is
not. When a later stage drifts — an organism that suddenly has three accents —
the leave column is what you point at.

So: never write an Inspiration Map row without both halves filled in. If you
can't articulate what to leave, you haven't looked closely enough yet.

## Ask for the URLs

Open Stage 0 by reading the active brain and any completed Taste Skill
research. Reuse their reference URLs and ask only for genuinely missing
inputs, using an available question tool or plain message. Three to six is the working range: fewer than three and there's nothing
to triangulate; more than six and the map becomes a survey nobody reads.

Ask for *specific pages*, not homepages, where possible. "Stripe's pricing
page" is a far more useful reference than "Stripe" because it names the problem
being solved. If the user only has brand names, snapshot the homepage and say
so in the map.

If the brand document already has an inspiration section, read it first and
bring those references to the conversation. Several brand docs carry exactly
this table already — reusing it keeps the system consistent with decisions that
were already approved.

## Snapshot with Interceptor

Interceptor drives real Chrome from inside the browser, so it renders what a
human actually sees — real fonts, real layout, authenticated pages if needed.
Use the browser tools available in the session. Interceptor is optional;
an authenticated in-app browser or another supported visual browser is fine.
Verify fonts and lazy-loaded content before judging the result.

```bash
interceptor open <url>
```

For each URL capture:

- **A screenshot** — the artifact the user reviews.
- **The computed palette** — background, surface, text, and accent as actually
  rendered. Not the marketing hex from a press kit; what the page really uses.
- **The type stack** — resolved `font-family`, plus the display size and
  tracking at the top of the page. Negative tracking at large sizes is the most
  commonly missed detail in premium type.
- **Spacing rhythm** — section padding and the reading measure. Most "this feels
  expensive" reactions are whitespace, not colour.
- **Radii and borders** — the shape language, and whether borders are hairlines
  or absent.

Record the values in the brief. A snapshot with no extracted values is a
mood board; a snapshot with values is evidence you can compile. Note which
theme each reference uses and roughly where its accent sits in lightness —
Stage 1 needs both to place brand hexes on their scales.

**If a page won't load or is bot-blocked:** note it and move on. Do not spend
several attempts fighting one URL — after two failures, ask the user for an
alternative or proceed with the remaining sources and say which one is missing.

## Mobbin MCP

Mobbin is a curated library of real product screens. It is the right tool for
*pattern* questions the URLs can't answer: how onboarding is usually sequenced,
what an empty state looks like in this category, how pricing tables are
structured across many products rather than one.

**Check availability first.** The Mobbin MCP may be installed but not
authenticated — in that state only `mcp__mobbin__authenticate` and
`mcp__mobbin__complete_authentication` are exposed, and the search tools are
absent. Detect this by looking for search-capable Mobbin tools; if only the auth
pair is present:

1. Call `mcp__mobbin__authenticate` to start the OAuth flow.
2. Give the user the authorization URL and ask them to complete it.
3. If the redirect lands on a `localhost/callback?code=…` page that fails to
   load, the URL in the address bar is still valid — pass it to
   `mcp__mobbin__complete_authentication` as `callback_url`.

**If the user declines or auth fails, continue without it.** Mobbin is an
accelerator, not a dependency. Record the gap honestly in the brief:

> Mobbin pattern references: 0 — MCP not authenticated this run.

Never write a brief that implies pattern research happened when it didn't. A
silent skip is worse than a stated gap, because the gap is recoverable and the
false claim isn't.

**What to ask Mobbin for**, once available: the specific component or flow
you're about to design, scoped to a category. "SaaS pricing page" beats
"pricing". Pull 2–4 references per pattern, and treat them the same as URLs —
they get take/leave rows too.

## Synthesising the map

After snapshotting, write the Inspiration Map into `brief/DESIGN-BRIEF.md`
(screenshots saved in `design-system/reference/snapshots/`, linked from the
brief as `../reference/snapshots/<name>.png`):

| Source | Snapshot | What we take | What we leave |
| --- | --- | --- | --- |
| linear.app | `../reference/snapshots/linear.png` | Typographic discipline; hairline borders; restraint at scale | Density — our reader is not a power user |
| stripe.com/pricing | `../reference/snapshots/stripe-pricing.png` | Comparison table structure; how tiers are ranked | Illustration style; multi-accent palette |

Then do the harder part: **reconcile it with the brand document.** Where the
inspiration and the brand contract disagree, the brand contract wins, and the
disagreement gets written down as an open decision. If three references all use
a light default and the brand is dark-first, that tension is real information
about the category — surface it rather than quietly splitting the difference.

## What this stage does not do

It does not pick colours. It does not choose fonts. It gathers evidence and
states tensions; Stage 1 makes the decisions, from the brief, with the user's
sign-off. Keeping gathering and deciding in separate stages is what makes the
sign-off meaningful — a reviewer approving Foundations can see exactly which
evidence produced each token.
