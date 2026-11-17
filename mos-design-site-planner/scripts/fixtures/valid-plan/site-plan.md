# Site plan: Tidewater Plumbing

Fictional fixture for `check-site-plan.ts`. Status: approved 2026-11-18.

## Website brief

- Business: Tidewater Plumbing, a two-van residential plumbing business in Sydney's Inner West (source: business/brand/brand.md)
- Primary action: Call or book a same-day job online (source: user 2026-11-18)
- Secondary action: Request a free drain camera inspection (source: business/offers/drain-inspection/offer.md)
- Money services: Blocked drains, hot water repairs (source: business/strategy/strategy.md; confirmed by user 2026-11-18)
- Services to show less: Bathroom renovations (source: user 2026-11-18)
- Areas served: Marrickville, Newtown, Leichhardt (source: business/strategy/strategy.md)
- Location type: Service area business with no shopfront (source: user 2026-11-18)
- Audience: Inner West homeowners and property managers with an urgent plumbing problem (source: business/audience/primary.md)
- Offer: Free drain camera inspection with any blocked drain job (source: business/offers/drain-inspection/offer.md)
- Voice: Plain and calm, no scare tactics (source: business/brand/voice.md)
- Proof: 140 Google reviews averaging 4.9, licence number, before and after photos (source: business/proof/testimonials.md)
- Site status: Replacing the current site, which ranks for drain queries but converts poorly on mobile (source: user 2026-11-18)
- Functionality: Online booking form and click-to-call; no shop, no blog for now (source: user 2026-11-18)
- Constraints: Launch by February 2027, eight pages maximum, owner approves all copy (source: user 2026-11-18)
- Case studies: GAP: no written case studies yet; owner to supply three jobs with photos

## Search-intent map

| ID | Intent | Example queries | Evidence | Label | Page |
|---|---|---|---|---|---|
| I-01 | Find a local plumber they can trust | tidewater plumbing; plumber inner west | 320 clicks in 90 days on brand and generic queries (S-01) | measured | P-01 |
| I-02 | Get a blocked drain cleared today | blocked drain plumber; blocked drain sydney | 1,900 impressions in 90 days (S-01); 880 monthly searches in AU (S-02) | measured | P-02 |
| I-03 | Repair or replace a hot water system | hot water repairs; hot water system not working | Autocomplete suggestions seen 2026-11-18, no volume data (S-03) | observed | P-03 |
| I-04 | Blocked drain plumber in Marrickville | plumber marrickville; blocked drain marrickville | Local pack and People Also Ask seen 2026-11-18 (S-04) | observed | P-04 |
| I-05 | Check who runs the business before booking | tidewater plumbing reviews; tidewater plumbing licence | Common check before letting a trade into the home; no data gathered | assumed | P-05 |
| I-06 | Contact or book the business | tidewater plumbing phone | Navigational; follows from the primary action | assumed | P-06 |
| I-07 | Decide whether a drain camera inspection is worth it | drain camera inspection cost | People Also Ask "How much does a CCTV drain inspection cost?" seen 2026-11-18 (S-04) | observed | P-07 |
| I-08 | Emergency plumber now | emergency plumber inner west | 410 impressions in 90 days (S-01) | measured | P-01 |
| I-09 | Unblock a drain yourself | how to unblock a drain | DIY intent, out of scope for this site (S-03) | observed | none |

## Sitemap

```text
/                          P-01 Home
├── /blocked-drains/        P-02 Blocked drains
│   └── /plumber-marrickville/  P-04 Marrickville
├── /hot-water/             P-03 Hot water repairs
├── /free-drain-inspection/ P-07 Drain inspection offer
├── /about/                 P-05 About
└── /contact/               P-06 Contact
```

### P-01 Home

- URL: /
- Type: home
- Title tag: Inner West Plumber, Same-Day Jobs | Tidewater Plumbing
- H1: Same-day plumbing for Sydney's Inner West
- Purpose: Route urgent visitors to a booking and everyone else to the right service
- Primary intent: I-01
- Also covers: I-08
- Primary CTA: Book a same-day job
- Proof:
  - 140 Google reviews averaging 4.9 (source: business/proof/testimonials.md)
  - Licence number in the header (source: business/brand/brand.md)
- Sections:
  1. Hero with the primary action and phone number
  2. Money services: blocked drains, hot water
  3. Reviews
  4. Areas served
  5. Drain inspection offer
- Internal links: /blocked-drains/, /hot-water/, /free-drain-inspection/, /contact/
- Schema: Plumber (LocalBusiness)

### P-02 Blocked drains

- URL: /blocked-drains/
- Type: service
- Parent: P-01
- Title tag: Blocked Drain Plumber in the Inner West | Tidewater Plumbing
- H1: Blocked drains cleared the same day
- Purpose: Convert people with a blocked drain right now
- Primary intent: I-02
- Primary CTA: Book a same-day drain job
- Proof:
  - Before and after drain camera stills (source: business/proof/testimonials.md)
  - GAP: owner to supply one written blocked-drain case study
- Sections:
  1. Hero with call and booking
  2. What we do on a blocked drain job
  3. Pricing approach
  4. Reviews mentioning drains
  5. FAQs from People Also Ask
- Internal links: /free-drain-inspection/, /plumber-marrickville/, /contact/
- Schema: Service

### P-03 Hot water repairs

- URL: /hot-water/
- Type: service
- Parent: P-01
- Title tag: Hot Water Repairs, Same Day | Tidewater Plumbing
- H1: Hot water repairs and replacements
- Purpose: Win repair and replacement jobs for failed hot water systems
- Primary intent: I-03
- Primary CTA: Book a hot water repair
- Proof: Licence number and brands serviced (source: business/brand/brand.md)
- Sections:
  1. Hero with call and booking
  2. Repair or replace: how we decide
  3. Systems we service
  4. Reviews
- Internal links: /contact/, /about/
- Schema: Service

### P-04 Marrickville

- URL: /plumber-marrickville/
- Type: location
- Parent: P-02
- Title tag: Plumber in Marrickville, Blocked Drains | Tidewater Plumbing
- H1: Your Marrickville plumber
- Purpose: Rank and convert for Marrickville searches, where most jobs come from
- Primary intent: I-04
- Primary CTA: Book a Marrickville job
- Served area: Marrickville (source: business/strategy/strategy.md)
- Distinct content: 38 local jobs this year with photos, local reviews and terrace-house drain issues specific to the suburb (source: business/proof/testimonials.md)
- Proof:
  - Reviews from Marrickville customers (source: business/proof/testimonials.md)
- Sections:
  1. Hero naming the suburb
  2. Local jobs with photos
  3. Terrace-house drain problems
  4. Local reviews
- Internal links: /blocked-drains/, /contact/
- Schema: Service with areaServed

### P-05 About

- URL: /about/
- Type: about
- Parent: P-01
- Title tag: About Tidewater Plumbing, Licensed Inner West Plumbers
- H1: Who turns up at your door
- Purpose: Build trust before someone lets a trade into their home
- Primary intent: I-05
- Primary CTA: Book a job
- Proof:
  - Licence and insurance details (source: business/brand/brand.md)
  - GAP: team photos not yet taken
- Sections:
  1. The owner and the team
  2. Licences and insurance
  3. How we work
- Internal links: /contact/, /blocked-drains/
- Schema: AboutPage

### P-06 Contact

- URL: /contact/
- Type: contact
- Parent: P-01
- Title tag: Contact Tidewater Plumbing, Book a Plumber
- H1: Book a plumber
- Purpose: Take bookings and calls with the least friction
- Primary intent: I-06
- Primary CTA: Submit a booking request
- Proof: Response-time promise (source: business/offers/drain-inspection/offer.md)
- Sections:
  1. Booking form
  2. Phone and hours
  3. Areas served
- Internal links: /
- Schema: ContactPage

### P-07 Drain inspection offer

- URL: /free-drain-inspection/
- Type: lead
- Parent: P-01
- Title tag: Free Drain Camera Inspection | Tidewater Plumbing
- H1: Free drain camera inspection with any blocked drain job
- Purpose: Capture people researching drain problems before they are urgent
- Primary intent: I-07
- Primary CTA: Claim a free inspection
- Proof: Offer terms (source: business/offers/drain-inspection/offer.md)
- Sections:
  1. The offer and its terms
  2. What the camera shows
  3. Booking form
- Internal links: /blocked-drains/, /contact/
- Schema: Offer

## Migration map

| Old URL | Evidence | Label | Action | Target |
|---|---|---|---|---|
| /services/drains.html | 1,100 clicks in 12 months and 6 referring domains (S-01, S-05) | measured | redirect | /blocked-drains/ |
| /about-us.html | 40 clicks in 12 months (S-01) | measured | redirect | /about/ |
| /contact/ | 85 clicks in 12 months (S-01) | measured | keep | /contact/ |
| /specials.html | 0 clicks in 12 months and no referring domains (S-01, S-05) | measured | retire | |

## Research gaps

- No keyword volume for hot water queries: the DataForSEO run covered drain queries only.
- AI-answer check not run; optional follow-on with mos-geo-brand-360.
