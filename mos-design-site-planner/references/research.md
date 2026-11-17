# Research: tools, methods and fallbacks

Steps 1 and 5. Every method is optional. Run what works, record what does not
on the research-gaps list, and keep going. Labels (measured, observed,
assumed) are defined in SKILL.md.

## Step 1: detecting tools

Test each tool before listing it as available. Never print a key's value.

| Tool | How to detect | Counts as available when |
| --- | --- | --- |
| Search Console | The user supplies a Performance export (CSV for Queries and Pages), or a Search Console tool is connected to the session | The export opens with rows, or a test query for the property returns data |
| DataForSEO | `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` in the environment or the project's or brain's `.env` | A test request with those credentials succeeds (an account or balance endpoint, per the current DataForSEO docs) |
| Crawler | `uv run --with "scrapling[fetchers]" scrapling --help`, else plain HTTP fetch | The existing site's home page fetches with real content |
| Web search | The session has a web search tool | A test query returns results |

Record the result in `state.json` under `tools`. A tool the user mentions but
the session cannot reach is unavailable; say so plainly.

## Step 5: methods

### Existing site crawl and URL inventory

1. Read `robots.txt` and `sitemap.xml` (and sitemap indexes). Respect
   disallow rules and keep requests slow (about one per second).
2. Fetch each URL: status code, title, H1, canonical, word count. Scrapling
   first (`scrapling extract get`, add the browser fetcher for pages that need
   JavaScript), plain fetch as the fallback. Record which fetcher was used.
3. Add URLs found in Search Console landing pages that the sitemap misses.
4. Referring domains per URL, if a backlink tool is connected; otherwise note
   the gap. Links matter for the migration map.

Labels: counts (status codes, URLs, clicks) are measured; page contents are
observed.

### Search Console

Use the last 12 months, or 3 months for a fast-changing business. Pull queries
and landing pages, with clicks and impressions. Brand and non-brand queries are
reported separately. Labels: measured. This is the best evidence of what
people already find the business for.

### Keyword volumes

- **DataForSEO keyed:** the Google Ads search volume endpoint, location set to
  the business's country (and region where supported). Check the endpoint and
  parameters against the current DataForSEO docs. Each response reports its
  cost; add it to the run total. Label: measured.
- **No key:** Google autocomplete suggestions for each seed (service, service +
  area, problem phrasing). Record the suggestions with the date. Label:
  observed, and write "no volume data" in the evidence. A suggestion shows
  that people type something, not how many.

Never estimate, round up or borrow volumes from memory.

### Results pages and People Also Ask

- DataForSEO SERP endpoint when keyed (the GEO pack uses
  `serp/google/organic/live/regular`; the advanced variant returns People Also
  Ask items), or a web search tool, or a manual check by the user.
- Record for each money-service query: page types ranking (service pages,
  directories, articles), whether a local pack shows, and the People Also Ask
  questions exactly as shown.
- Label: observed, dated, one snapshot. Results vary by location and over
  time; say so.
- If no tool can see a results page, People Also Ask is a gap. Never write
  questions that "would probably appear".

### Competitor sitemaps

Fetch two to four competitors' `sitemap.xml` files (from the interview or the
results pages). Note which pages they have for each money service and area,
and which they lack. Label: observed. This informs the page list; it is not a
reason to copy a competitor's thin location pages.

### Optional: AI-answer check

Ask whether the user wants to see which businesses ChatGPT or Google AI Mode
names for the money-service questions. If they do and the GEO pack is
installed, `mos-geo-brand-360` runs it properly; otherwise a manual check in
the user's own session works. Label: observed, one run per engine, a snapshot.

## Recording sources

Each source gets a row in `research/sources.md` (format in
`output-format.md`): ID `S-nn`, what it is, the date, the method and any cost.
Measured and observed claims in the plan cite these IDs. Raw responses and
exports go in `research/raw/`, which is never committed.

## Research gaps

List every method that did not run, and why, in the `## Research gaps`
section of `site-plan.md`: "No keyword volumes: no DataForSEO key; autocomplete
used instead", "People Also Ask not checked: no results-page tool". A stated
gap keeps the plan honest; a filled-in guess does not.
