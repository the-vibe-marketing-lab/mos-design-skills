# Page rules: from queries to pages

Step 6. The goal is the smallest set of pages that covers every intent worth
serving, with no two pages competing for the same one.

## Cluster queries into intents

An **intent** is one job a searcher wants done. Queries share an intent when
the same page would satisfy all of them.

1. Gather every query from Search Console, volume research, autocomplete and
   People Also Ask, plus the user's own phrasing from the interview.
2. Group by job, not by wording. "blocked drain plumber" and "drain unblocking
   near me" are one intent; "blocked drain plumber" and "how to unblock a
   drain" are two (hire versus do it yourself).
3. When results-page data exists, use it as the tiebreaker: if the same URLs
   rank for two queries, treat them as one intent.
4. Name each intent in plain words, give it an ID (`I-01`), example queries,
   evidence with its label, and the page that will own it.
5. Intents the site will not serve (do-it-yourself, jobs the business does not
   do, other regions) stay in the map with `none` as the page and the reason in
   the evidence. That records the decision.

For large exports, `mos-geo-topic-clusters` (GEO pack, optional) clusters
queries into page-sized groups and flags cannibalisation; its output feeds
this step.

## Page rules

- **One page per intent.** Each intent has exactly one owning page. A page owns
  one primary intent and may also cover closely related ones (the home page
  often covers "emergency" alongside the brand intent).
- **One service page per money service.** Services the user wants less of are
  mentioned on related pages and get no page of their own.
- **Core pages.** Home, a contact page, an about page, a page per money
  service, and the offer or lead page when the brain has an offer. Anything
  beyond that needs an intent with evidence, or a clear business reason in the
  page's purpose.
- **Articles and a blog** only when the brief names who will write them. An
  unwritten blog is worse than none.
- **Use the brain's offer and positioning.** The plan frames pages around the
  offer the business already sells; a new offer is a strategy question for the
  brain, not a sitemap decision.
- **Page budget.** Respect the brief's page limit; phase the rest into a later
  release and say so in the plan.

## The location page test

A location page earns its place only when all three hold:

1. **Served:** the area is on the brief's served-areas list, confirmed by the
   user.
2. **Distinct:** the page can carry content no other location page has: jobs
   done there with photos, reviews from that area, local conditions (housing
   type, council rules, travel time), staff based there.
3. **Demand:** there is evidence people search with that area name, or the
   user has a business reason (most jobs come from there).

Fail any test: list the area on the contact page and the relevant service
pages instead. Swapping the suburb name into the same copy produces doorway
pages, which search engines treat as spam. Record each area's outcome in
`decisions.md`.

## Cannibalisation check

Before the specs are final, compare every pair of pages:

- Do two pages target the same intent, or the same head term in the title tag
  and H1? (A service page and a location page for that service share a head
  term by design; the location page must be about the place.)
- Would a searcher be equally happy landing on either page?

If yes, merge the pages or re-scope one so the intents separate. Write a one
line note per resolved pair in `decisions.md`. The validator enforces one
owner per intent; this check catches overlaps the intent map hides.

## Migration map

Only for a site being replaced. Every existing URL with traffic or links gets
a row; URLs with neither can be listed or left out.

| Action | Use when | Target |
| --- | --- | --- |
| keep | The URL stays the same on the new site | The same URL |
| redirect | The content moves to a new URL | The new page's URL (a 301 later) |
| merge | Several old pages fold into one new page | The new page's URL |
| retire | No equivalent page will exist and the URL has little or no value | Blank; note why |

- Redirect to the closest equivalent page, never everything to the home page.
- Keep URLs that earn links or enquiries unless the new structure truly needs
  a change.
- Each row carries its evidence and label (clicks, referring domains).
- This map is an inventory for the later migration work. This skill does not
  configure redirects.

With no existing site, the section holds one line: `None: new business with no
existing site`.
