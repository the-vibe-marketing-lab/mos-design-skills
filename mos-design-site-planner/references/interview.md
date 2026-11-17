# Interview: the card, the questions and the brief

Steps 2 to 4. The aim is to ask as little as possible: the brain answers most
questions, and the user only fills what it cannot.

## Step 2: the "what I already know" card

Read the brain first. Typical sources in a MarketingOS brain:

| Card item | Where to look first |
| --- | --- |
| Business | `business/brand/brand.md`, `CONTEXT.md` |
| Services | `business/offers/*/offer.md`, `business/strategy/strategy.md` |
| Locations and service area | `business/strategy/strategy.md`, `business/brand/brand.md`, existing site contact page |
| Audience | `business/audience/*.md` |
| Offer | `business/offers/*/offer.md` |
| Voice | `business/brand/voice.md` |
| Proof | `business/proof/*.md` |
| Primary action | `CONTEXT.md`, `business/strategy/goals.md`, the offer's call to action |

Show the card as one short list. Each line: the item, what the brain says (one
line), the source file, and a status.

```text
What I already know about Tidewater Plumbing
1. Business: two-van residential plumber, Inner West Sydney (business/brand/brand.md) - confirmed
2. Services: blocked drains, hot water, bathroom renovations (business/offers/) - confirmed
3. Service area: "Inner West" (business/strategy/strategy.md) - inferred: which suburbs?
4. Audience: homeowners with an urgent problem (business/audience/primary.md) - confirmed
5. Offer: free drain camera inspection (business/offers/drain-inspection/offer.md) - confirmed
6. Voice: plain and calm (business/brand/voice.md) - confirmed
7. Proof: Google reviews mentioned, no count (business/proof/testimonials.md) - inferred
8. Primary action: not stated - missing
Anything wrong or out of date?
```

- **confirmed**: the brain states it plainly.
- **inferred**: the brain implies it, or it is stale or vague.
- **missing**: nothing in the brain.

Corrections from the user become `source: user YYYY-MM-DD` in the brief.

## Step 3: asking only about gaps

Skip any topic the card already confirms. For the rest:

- **Batch.** In Claude Code, AskUserQuestion takes up to four questions per
  call, each with two to four options plus a free-text "Other". In Codex, send
  one message with numbered questions and lettered options, and accept short
  replies like `1a 2c 3 recommended`.
- **Recommend.** Put the recommended option first, label it "(Recommended)" and
  give the reason in one line, drawn from the brain or the business type.
- **Allow a skip.** "Not sure, use your recommendation" is always acceptable;
  record the answer as provisional.
- Two or three batches is normal. More than that usually means the card missed
  something the brain already had.

### Question bank

Pick from these; reword to fit the business.

**Goal and action**
- What should most visitors do? Call / book online / request a quote / buy /
  join a list. Recommend from the offer: urgent trades lean to call and
  same-day booking; considered purchases lean to a quote or consultation.
- What is the secondary action for people not ready yet? Recommend the brain's
  lead magnet or offer if there is one, otherwise a newsletter or callback.

**Services**
- Which services make the money? Recommend the ones the offer and strategy
  files lead with.
- Which services do you want less of? They get a mention, not a page.

**Location**
- Physical location customers visit, service area, or online only? This
  decides LocalBusiness versus Service schema and whether location pages are
  even possible.
- Which areas do you genuinely serve, and in which do you have real jobs,
  reviews or photos? Recommend listing areas on the contact and service pages
  and saving location pages for areas with distinct proof (see
  `page-rules.md`).

**Existing site**
- New site, or replacing one? If replacing: the URL, what works (pages that
  bring enquiries) and what does not. Recommend keeping URLs that earn traffic
  or links unless there is a reason to move them.

**Functionality**
- Booking, forms, shop, blog, member area, CRM or calendar links? Recommend the
  smallest set that serves the primary action. A blog needs a named person who
  will write for it.

**Proof**
- Reviews (where, how many), case studies, before and after photos, credentials,
  awards, guarantees. Recommend using only what exists today; anything planned
  becomes a `GAP:` with an owner.

**Competitors**
- Two or three competitors you rate, and one you dislike. Recommend the
  businesses that appear for the money-service searches, if research finds
  them later.

**Constraints**
- Launch date, page budget, who writes the content, compliance (licensing,
  health claims, financial advice rules). Recommend a first release of the
  pages that serve the primary action, with the rest phased.

Design references, colours and fonts are not asked here.
`mos-atomic-design-system` collects them.

## Step 4: the brief playback

One screen, plain language. Ask for a yes before research starts.

```text
Website brief: Tidewater Plumbing
Goal: same-day bookings from Inner West homeowners (primary: call or book; secondary: free drain inspection)
Money services: blocked drains, hot water. Shown less: bathroom renovations
Served areas: Marrickville, Newtown, Leichhardt (service area, no shopfront)
Existing site: replacing tidewater.example.com.au; drain pages bring most enquiries
Must have: booking form, click-to-call. Not now: shop, blog
Proof available: 140 Google reviews (4.9), licence, before and after photos
Gaps: no case studies, no team photos
Constraints: launch February 2027, eight pages maximum, owner approves copy

Research plan
- Crawl the current site and list its URLs (free)
- Search Console export: queries and landing pages, last 12 months (free)
- DataForSEO search volume for about 40 keywords (estimate US$0.10)
- Results pages and People Also Ask for the money services (estimate US$0.05)
- Competitor sitemaps (free)
Go ahead?
```

Estimates come from the provider's current price list; report the actual cost
each call returns afterwards. Record the approval in `decisions.md` as a
`brief | approved` row.
