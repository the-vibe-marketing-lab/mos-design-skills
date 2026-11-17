#!/usr/bin/env bun
/**
 * test-check-site-plan.ts: regression suite for check-site-plan.ts.
 *
 * A validator that only ever passes converts "unchecked" into "checked and
 * fine". So each case copies the passing fixture (fixtures/valid-plan), breaks
 * exactly one thing, and asserts the validator fails with the expected message.
 * A case that passes when it should fail is a hole in the validator.
 *
 * Usage: bun test-check-site-plan.ts [--keep]
 * Exit:  0 every case behaved correctly · 1 one or more holes
 */

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "fixtures", "valid-plan");
const VALIDATOR = join(HERE, "check-site-plan.ts");
const ROOT = mkdtempSync(join(tmpdir(), "site-plan-test-"));
const keep = process.argv.includes("--keep");

type Mutation = (dir: string) => void;
type Case = {
  name: string;
  mutate: Mutation;
  args?: string[];
  expectPass: boolean;
  expectMessage?: string;
};

/** Replace one exact string in a fixture file; throws if it is absent, so a stale case cannot pass silently. */
function edit(file: string, from: string, to: string): Mutation {
  return (dir: string): void => {
    const path = join(dir, file);
    const text = readFileSync(path, "utf8");
    if (!text.includes(from)) throw new Error(`mutation target not found in ${file}: ${from.slice(0, 60)}`);
    writeFileSync(path, text.replace(from, to));
  };
}

const remove = (file: string): Mutation => (dir: string): void => unlinkSync(join(dir, file));
const none: Mutation = (): void => {};

const cases: Case[] = [
  { name: "valid plan passes", mutate: none, expectPass: true, expectMessage: "PASS (final): 7 pages, 9 intents" },
  { name: "valid plan passes in draft mode", mutate: none, args: ["--draft"], expectPass: true, expectMessage: "PASS (draft)" },
  {
    name: "duplicate intent: two pages claim I-02",
    mutate: edit("site-plan.md", "- Primary intent: I-03", "- Primary intent: I-02"),
    expectPass: false,
    expectMessage: "I-02 is the primary or covered intent of more than one page (P-02 and P-03)",
  },
  {
    name: "missing CTA on P-05",
    mutate: edit("site-plan.md", "- Primary CTA: Book a job\n", ""),
    expectPass: false,
    expectMessage: "P-05: missing Primary CTA",
  },
  {
    name: "unlabelled evidence on I-03",
    mutate: edit("site-plan.md", "no volume data (S-03) | observed | P-03 |", "no volume data (S-03) |  | P-03 |"),
    expectPass: false,
    expectMessage: "I-03: evidence label is missing",
  },
  {
    name: "unknown evidence label",
    mutate: edit("site-plan.md", "(S-04) | observed | P-04 |", "(S-04) | estimated | P-04 |"),
    expectPass: false,
    expectMessage: 'evidence label "estimated" is not measured, observed or assumed',
  },
  {
    name: "measured claim with no number",
    mutate: edit("site-plan.md", "| 410 impressions in 90 days (S-01) | measured |", "| Lots of impressions (S-01) | measured |"),
    expectPass: false,
    expectMessage: "I-08: measured evidence must state the number it measured",
  },
  {
    name: "observed claim cites a source that does not exist",
    mutate: edit("site-plan.md", "seen 2026-11-18 (S-04) | observed | P-04 |", "seen 2026-11-18 (S-09) | observed | P-04 |"),
    expectPass: false,
    expectMessage: "I-04: cites S-09, which is not in research/sources.md",
  },
  {
    name: "observed claim cites no source",
    mutate: edit("site-plan.md", "DIY intent, out of scope for this site (S-03)", "DIY intent, out of scope for this site"),
    expectPass: false,
    expectMessage: "I-09: observed evidence must cite a source ID",
  },
  {
    name: "duplicate URL",
    mutate: edit("site-plan.md", "- URL: /hot-water/", "- URL: /blocked-drains/"),
    expectPass: false,
    expectMessage: "URL /blocked-drains is also used by P-02",
  },
  {
    name: "missing title tag",
    mutate: edit("site-plan.md", "- Title tag: Free Drain Camera Inspection | Tidewater Plumbing\n", ""),
    expectPass: false,
    expectMessage: "P-07: missing Title tag",
  },
  {
    name: "proof with neither source nor GAP marker",
    mutate: edit("site-plan.md", "- Proof: Offer terms (source: business/offers/drain-inspection/offer.md)", "- Proof: Offer terms"),
    expectPass: false,
    expectMessage: 'P-07: proof "Offer terms" needs a (source: ...) or must be marked GAP:',
  },
  {
    name: "location page without a served area",
    mutate: edit("site-plan.md", "- Served area: Marrickville (source: business/strategy/strategy.md)\n", ""),
    expectPass: false,
    expectMessage: "P-04: location page has no served area",
  },
  {
    name: "location page for an area the brief does not list",
    mutate: edit("site-plan.md", "- Served area: Marrickville (source:", "- Served area: Parramatta (source:"),
    expectPass: false,
    expectMessage: 'served area "parramatta" is not in the brief\'s Areas served list',
  },
  {
    name: "location page without distinct content",
    mutate: edit("site-plan.md", "- Distinct content: 38 local jobs this year", "- Distinct content: TBC\n- Notes: 38 local jobs this year"),
    expectPass: false,
    expectMessage: "P-04: location page has no distinct content",
  },
  {
    name: "brief item without provenance",
    mutate: edit("site-plan.md", "- Voice: Plain and calm, no scare tactics (source: business/brand/voice.md)", "- Voice: Plain and calm, no scare tactics"),
    expectPass: false,
    expectMessage: '"voice" has no (source: ...) or GAP: marker',
  },
  {
    name: "sitemap.csv title differs from the spec",
    mutate: edit("sitemap.csv", "Book a plumber,I-06", "Get in touch,I-06"),
    expectPass: false,
    expectMessage: 'P-06: h1 "Get in touch" does not match site-plan.md "Book a plumber"',
  },
  {
    name: "sitemap.csv missing a page",
    mutate: edit("sitemap.csv", "P-07,/free-drain-inspection/,lead,Free Drain Camera Inspection | Tidewater Plumbing,Free drain camera inspection with any blocked drain job,I-07,Claim a free inspection,P-01\n", ""),
    expectPass: false,
    expectMessage: "P-07: page is in site-plan.md but missing from sitemap.csv",
  },
  {
    name: "redirect target not in the sitemap",
    mutate: edit("site-plan.md", "| redirect | /about/ |", "| redirect | /our-story/ |"),
    expectPass: false,
    expectMessage: 'redirect target "/our-story/" is not a URL in the sitemap',
  },
  {
    name: "intent map assigns an intent to a page that does not list it",
    mutate: edit("site-plan.md", "- Also covers: I-08\n", ""),
    expectPass: false,
    expectMessage: "I-08: assigned to P-01, but that page does not list it",
  },
  {
    name: "missing required section",
    mutate: edit("site-plan.md", "## Research gaps", "## Notes"),
    expectPass: false,
    expectMessage: 'missing section "## Research gaps"',
  },
  {
    name: "missing research/sources.md",
    mutate: remove("research/sources.md"),
    expectPass: false,
    expectMessage: "research/sources.md is missing",
  },
  {
    name: "page approval not recorded",
    mutate: edit("decisions.md", "| 2026-11-18 | P-03 | approved | |\n", ""),
    expectPass: false,
    expectMessage: "P-03: no approval recorded for this page",
  },
  {
    name: "unrecorded approval is allowed in draft mode",
    mutate: edit("decisions.md", "| 2026-11-18 | P-03 | approved | |\n", ""),
    args: ["--draft"],
    expectPass: true,
    expectMessage: "PASS (draft)",
  },
  {
    name: "plan not approved",
    mutate: edit("decisions.md", "| 2026-11-18 | plan | approved | Owner approved the full plan |", "| 2026-11-18 | plan | deferred | Owner wants to sleep on it |"),
    expectPass: false,
    expectMessage: 'no "plan | approved" row',
  },
];

let holes = 0;
for (const [i, c] of cases.entries()) {
  const dir = join(ROOT, `case-${String(i).padStart(2, "0")}`);
  cpSync(FIXTURE, dir, { recursive: true });
  try {
    c.mutate(dir);
  } catch (e) {
    holes++;
    console.log(`  ✗ ${c.name}: ${(e as Error).message}`);
    continue;
  }
  const run = Bun.spawnSync([process.execPath, VALIDATOR, dir, ...(c.args ?? [])], { stdout: "pipe", stderr: "pipe" });
  const out = `${run.stdout.toString()}${run.stderr.toString()}`;
  const passed = run.exitCode === 0;
  const messageOk = !c.expectMessage || out.includes(c.expectMessage);
  if (passed === c.expectPass && messageOk) {
    console.log(`  ✓ ${c.name}`);
  } else {
    holes++;
    const why = passed !== c.expectPass ? `exit ${run.exitCode}, expected ${c.expectPass ? 0 : 1}` : `message not found: ${c.expectMessage}`;
    console.log(`  ✗ ${c.name} (${why})\n${out.split("\n").map((l) => `      ${l}`).join("\n")}`);
  }
}

const resolved = resolve(ROOT);
if (keep) {
  console.log(`Kept fixtures at ${resolved}`);
} else if (dirname(resolved) === resolve(tmpdir()) && basename(resolved).startsWith("site-plan-test-") && existsSync(resolved)) {
  rmSync(resolved, { recursive: true, force: true });
}

const caught = cases.filter((c) => !c.expectPass).length;
console.log(holes === 0
  ? `All ${cases.length} site-plan checks behaved correctly (${caught} broken plans caught, ${cases.length - caught} valid plans passed).`
  : `${holes} of ${cases.length} site-plan checks MISSED.`);
process.exitCode = holes === 0 ? 0 : 1;
