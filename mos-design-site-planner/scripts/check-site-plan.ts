#!/usr/bin/env bun
/**
 * check-site-plan.ts: deterministic validator for a mos-design-site-planner output folder.
 *
 * Reads <dir>/site-plan.md, <dir>/sitemap.csv, <dir>/research/sources.md and
 * <dir>/decisions.md, and checks the rules a planner can break without noticing:
 * one page per intent, unique URLs, a CTA, title, H1 and proof (or GAP:) on
 * every page, an evidence label on every intent and migration claim, measured
 * and observed claims traced to a dated source, location pages tied to a served
 * area with distinct content, redirect targets that exist, sitemap.csv matching
 * the specs, and (unless --draft) a recorded approval for every page and the plan.
 *
 * The file formats are documented in references/output-format.md.
 *
 * Usage: bun check-site-plan.ts <site-plan-dir> [--draft] [--json]
 * Exit:  0 pass (warnings allowed) · 1 one or more errors · 2 usage error
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type Issue = { file: string; where: string; message: string };

type Table = { header: string[]; rows: string[][] };

type Field = { inline: string; items: string[] };

type Page = {
  id: string;
  name: string;
  fields: Map<string, Field>;
};

const LABELS = new Set(["measured", "observed", "assumed"]);
const PAGE_TYPES = new Set([
  "home", "service", "location", "about", "contact", "lead",
  "blog-index", "article", "utility", "other",
]);
const ACTIONS = new Set(["keep", "merge", "redirect", "retire"]);
const DECISIONS = new Set(["approved", "edited", "added", "removed", "deferred", "rejected"]);
const REQUIRED_SECTIONS = ["Website brief", "Search-intent map", "Sitemap", "Migration map", "Research gaps"];
const REQUIRED_BRIEF_KEYS = ["business", "primary action", "money services", "areas served", "audience", "offer"];
const REQUIRED_PAGE_FIELDS = [
  "URL", "Type", "Title tag", "H1", "Purpose", "Primary intent",
  "Primary CTA", "Proof", "Sections", "Internal links", "Schema",
];
const CSV_COLUMNS = ["page_id", "url", "type", "title_tag", "h1", "primary_intent", "primary_cta"];
const EMPTY_VALUES = new Set(["", "-", "none", "tbc", "tbd", "todo", "n/a"]);

const errors: Issue[] = [];
const warnings: Issue[] = [];
const err = (file: string, where: string, message: string): void => { errors.push({ file, where, message }); };
const warn = (file: string, where: string, message: string): void => { warnings.push({ file, where, message }); };

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Remove fenced code blocks so a sitemap tree or example never parses as data. */
function stripFences(text: string): string {
  return text.replace(/^```[\s\S]*?^```[ \t]*$/gm, "");
}

/** Split markdown into H2 sections keyed by lowercased heading text. */
function h2Sections(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = stripFences(text).split(/^## +/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim().toLowerCase();
    out.set(heading, nl === -1 ? "" : part.slice(nl + 1));
  }
  return out;
}

function splitRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

/** First markdown table in the text, or null. Header names are lowercased. */
function firstTable(text: string): Table | null {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    if (!/^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) continue;
    const header = splitRow(lines[i]).map((h) => h.toLowerCase());
    const rows: string[][] = [];
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith("|"); j++) {
      const cells = splitRow(lines[j]);
      while (cells.length < header.length) cells.push("");
      rows.push(cells);
    }
    return { header, rows };
  }
  return null;
}

function col(table: Table, ...names: string[]): number {
  for (const name of names) {
    const idx = table.header.indexOf(name);
    if (idx !== -1) return idx;
  }
  return -1;
}

const plain = (s: string): string => s.replace(/[*`_]/g, "").trim();
const collapse = (s: string): string => plain(s).replace(/\s+/g, " ").trim();
const isEmpty = (s: string): boolean => EMPTY_VALUES.has(collapse(s).toLowerCase());

/**
 * Parse top-level "- Key: value" bullets. Indented lines that follow (nested
 * bullets or numbered items) belong to the previous key as items.
 */
function parseFields(text: string): Map<string, Field> {
  const fields = new Map<string, Field>();
  let current: Field | null = null;
  for (const line of text.split("\n")) {
    const top = /^[-*] +([^:]+?):\s*(.*)$/.exec(line);
    if (top) {
      current = { inline: top[2].trim(), items: [] };
      fields.set(top[1].trim().toLowerCase().replace(/\s+/g, " "), current);
      continue;
    }
    if (line.trim() === "") continue;
    if (/^\s+/.test(line) && current) {
      const item = /^\s+(?:[-*]|\d+[.)])\s+(.*)$/.exec(line);
      current.items.push((item ? item[1] : line).trim());
      continue;
    }
    current = null;
  }
  return fields;
}

const fieldText = (f: Field | undefined): string => (f ? [f.inline, ...f.items].join(" ").trim() : "");
const fieldEmpty = (f: Field | undefined): boolean =>
  !f || (isEmpty(f.inline) && f.items.every((i) => isEmpty(i)));

/** Strip "(source: ...)" provenance so the value can be compared. */
const stripProvenance = (s: string): string => s.replace(/\([^()]*source:[^()]*\)/gi, "").trim();

function normaliseUrl(raw: string): string {
  let s = plain(raw);
  if (/^https?:\/\//i.test(s)) {
    try { s = new URL(s).pathname; } catch { return s.toLowerCase(); }
  }
  s = s.split(/[?#]/)[0].toLowerCase();
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const sourceIds = (s: string): string[] => s.match(/\bS-\d{2,}\b/g) ?? [];

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** Evidence rule shared by intent rows and migration rows. */
function checkEvidence(file: string, where: string, evidence: string, labelCell: string, sources: Set<string>): void {
  const label = plain(labelCell).toLowerCase();
  if (label === "") { err(file, where, "evidence label is missing (use measured, observed or assumed)"); return; }
  if (!LABELS.has(label)) { err(file, where, `evidence label "${plain(labelCell)}" is not measured, observed or assumed`); return; }
  if (isEmpty(evidence)) { err(file, where, `${label} claim has no evidence text`); return; }
  // Source IDs and dates contain digits too, so remove them before looking for the measured number.
  const figures = evidence.replace(/\bS-\d{2,}\b/g, "").replace(/\b\d{4}-\d{2}-\d{2}\b/g, "");
  if (label === "measured" && !/\d/.test(figures)) err(file, where, "measured evidence must state the number it measured");
  if (label !== "assumed") {
    const cited = sourceIds(evidence);
    if (cited.length === 0) err(file, where, `${label} evidence must cite a source ID (S-nn) from research/sources.md`);
    for (const id of cited) if (!sources.has(id)) err(file, where, `cites ${id}, which is not in research/sources.md`);
  }
}

function checkSources(dir: string): Set<string> {
  const file = "research/sources.md";
  const ids = new Set<string>();
  const path = join(dir, "research", "sources.md");
  if (!existsSync(path)) { err(file, "file", "research/sources.md is missing"); return ids; }
  const table = firstTable(stripFences(readFileSync(path, "utf8")));
  if (!table) { err(file, "table", "no sources table found"); return ids; }
  const iId = col(table, "id");
  const iSrc = col(table, "source");
  const iDate = col(table, "date", "retrieved");
  if (iId === -1 || iSrc === -1 || iDate === -1) { err(file, "table", "sources table needs ID, Source and Date columns"); return ids; }
  for (const row of table.rows) {
    const id = plain(row[iId]);
    if (!/^S-\d{2,}$/.test(id)) { err(file, id || "row", `source ID "${id}" is not in S-nn form`); continue; }
    if (ids.has(id)) err(file, id, "duplicate source ID");
    ids.add(id);
    if (isEmpty(row[iSrc])) err(file, id, "source is blank");
    if (!/\b\d{4}-\d{2}-\d{2}\b/.test(row[iDate])) err(file, id, "date must be YYYY-MM-DD");
  }
  return ids;
}

function parseBriefAreas(brief: Map<string, Field>): string[] {
  const raw = stripProvenance(fieldText(brief.get("areas served")));
  if (/^\s*(gap:|none\b)/i.test(raw)) return [];
  return raw.split(/[,;]/).map((a) => a.trim().toLowerCase()).filter((a) => a !== "");
}

function checkBrief(body: string): Map<string, Field> {
  const file = "site-plan.md";
  const brief = parseFields(body);
  for (const key of REQUIRED_BRIEF_KEYS) {
    if (!brief.has(key)) err(file, "Website brief", `missing "${key}" (record a GAP: if it is unknown)`);
  }
  for (const [key, field] of brief) {
    const text = fieldText(field);
    if (!/source:/i.test(text) && !/\bGAP:/.test(text)) {
      err(file, "Website brief", `"${key}" has no (source: ...) or GAP: marker`);
    }
  }
  return brief;
}

type IntentRow = { id: string; page: string };

function checkIntents(body: string, sources: Set<string>): Map<string, IntentRow> {
  const file = "site-plan.md";
  const intents = new Map<string, IntentRow>();
  const table = firstTable(body);
  if (!table) { err(file, "Search-intent map", "no intent table found"); return intents; }
  const iId = col(table, "id");
  const iIntent = col(table, "intent");
  const iEv = col(table, "evidence");
  const iLabel = col(table, "label");
  const iPage = col(table, "page");
  if ([iId, iIntent, iEv, iLabel, iPage].includes(-1)) {
    err(file, "Search-intent map", "intent table needs ID, Intent, Evidence, Label and Page columns");
    return intents;
  }
  for (const row of table.rows) {
    const id = plain(row[iId]);
    if (!/^I-\d{2,}$/.test(id)) { err(file, `intent ${id || "row"}`, `intent ID "${id}" is not in I-nn form`); continue; }
    if (intents.has(id)) err(file, id, "duplicate intent ID in the intent map");
    if (isEmpty(row[iIntent])) err(file, id, "intent description is blank");
    checkEvidence(file, id, row[iEv], row[iLabel], sources);
    const page = plain(row[iPage]);
    if (!/^P-\d{2,}$/.test(page) && page.toLowerCase() !== "none") {
      err(file, id, `Page must be a page ID (P-nn) or "none", got "${page}"`);
    }
    intents.set(id, { id, page: page.toLowerCase() === "none" ? "none" : page });
  }
  return intents;
}

function parsePages(body: string): Page[] {
  const pages: Page[] = [];
  const chunks = body.split(/^### +/m).slice(1);
  for (const chunk of chunks) {
    const nl = chunk.indexOf("\n");
    const heading = (nl === -1 ? chunk : chunk.slice(0, nl)).trim();
    const m = /^(P-\d{2,})\b[:\s-]*(.*)$/.exec(heading);
    if (!m) {
      if (/^P/i.test(heading)) warn("site-plan.md", `"${heading}"`, "looks like a page heading but does not start with P-nn; it was ignored");
      continue;
    }
    pages.push({ id: m[1], name: m[2].trim(), fields: parseFields(nl === -1 ? "" : chunk.slice(nl + 1)) });
  }
  return pages;
}

function checkPages(pages: Page[], intents: Map<string, IntentRow>, areas: string[]): void {
  const file = "site-plan.md";
  if (pages.length === 0) { err(file, "Sitemap", "no page specs found (### P-01 Name)"); return; }
  const ids = new Set<string>();
  const urls = new Map<string, string>();
  const intentOwner = new Map<string, string>();
  const types: string[] = [];

  for (const page of pages) {
    const where = page.id;
    if (ids.has(page.id)) err(file, where, "duplicate page ID");
    ids.add(page.id);
    for (const key of REQUIRED_PAGE_FIELDS) {
      if (fieldEmpty(page.fields.get(key.toLowerCase()))) err(file, where, `missing ${key}`);
    }

    const type = collapse(fieldText(page.fields.get("type"))).toLowerCase();
    types.push(type);
    if (type && !PAGE_TYPES.has(type)) err(file, where, `type "${type}" is not one of ${[...PAGE_TYPES].join(", ")}`);

    const rawUrl = fieldText(page.fields.get("url"));
    if (rawUrl) {
      const url = normaliseUrl(rawUrl);
      if (!url.startsWith("/")) err(file, where, `URL "${rawUrl}" must be a path starting with /`);
      const clash = urls.get(url);
      if (clash) err(file, where, `URL ${url} is also used by ${clash}`);
      else urls.set(url, page.id);
      if (type === "home" && url !== "/") err(file, where, "the home page URL must be /");
    }

    const title = collapse(fieldText(page.fields.get("title tag")));
    if (title.length > 65) warn(file, where, `title tag is ${title.length} characters; Google usually truncates past about 60`);

    // Intent ownership: primary plus any "also covers".
    const primaryText = fieldText(page.fields.get("primary intent"));
    const primary = primaryText.match(/\bI-\d{2,}\b/)?.[0] ?? "";
    if (!primary && type !== "utility" && primaryText.trim() !== "") {
      if (/^none\b/i.test(primaryText.trim())) err(file, where, 'only utility pages may have primary intent "none"');
      else err(file, where, `primary intent "${primaryText}" must be an intent ID (I-nn)`);
    }
    const covered = [primary, ...(fieldText(page.fields.get("also covers")).match(/\bI-\d{2,}\b/g) ?? [])].filter((x) => x);
    for (const intent of covered) {
      const owner = intentOwner.get(intent);
      if (owner && owner !== page.id) {
        err(file, where, `${intent} is the primary or covered intent of more than one page (${owner} and ${page.id}); one page per intent`);
      }
      intentOwner.set(intent, page.id);
      const row = intents.get(intent);
      if (!row) err(file, where, `${intent} is not in the search-intent map`);
      else if (row.page !== page.id) err(file, where, `${intent} is assigned to ${row.page} in the intent map, not ${page.id}`);
    }

    // Proof: every item names a source or is an explicit GAP.
    const proof = page.fields.get("proof");
    if (proof && !fieldEmpty(proof)) {
      const items = proof.items.length > 0 ? proof.items : proof.inline.split(";").map((s) => s.trim()).filter((s) => s);
      for (const item of items) {
        if (!/source:/i.test(item) && !/\bGAP:/.test(item)) {
          err(file, where, `proof "${item}" needs a (source: ...) or must be marked GAP:`);
        }
      }
    }

    if (type === "location") {
      const served = page.fields.get("served area");
      const area = stripProvenance(fieldText(served)).toLowerCase();
      if (fieldEmpty(served) || /\bgap:/i.test(area)) {
        err(file, where, "location page has no served area; plan location pages only for areas the business serves");
      } else if (!areas.includes(area)) {
        err(file, where, `served area "${area}" is not in the brief's Areas served list`);
      }
      if (fieldEmpty(page.fields.get("distinct content"))) {
        err(file, where, "location page has no distinct content; a suburb-swapped copy is a doorway page");
      }
    }
  }

  for (const [id, row] of intents) {
    if (row.page !== "none" && !ids.has(row.page)) err(file, id, `assigned to ${row.page}, which has no page spec`);
    else if (row.page !== "none" && !intentOwner.has(id)) err(file, id, `assigned to ${row.page}, but that page does not list it as primary intent or in Also covers`);
  }

  const homes = types.filter((t) => t === "home").length;
  if (homes !== 1) err(file, "Sitemap", `expected exactly one home page, found ${homes}`);
  if (!types.includes("contact")) err(file, "Sitemap", "no contact page");
  if (!types.includes("about")) warn(file, "Sitemap", "no about page");
  if (!types.includes("service")) warn(file, "Sitemap", "no service page");
  if (!types.includes("lead")) warn(file, "Sitemap", "no offer or lead page");
}

function checkMigration(body: string, sitemapUrls: Set<string>, sources: Set<string>): void {
  const file = "site-plan.md";
  const table = firstTable(body);
  if (!table) {
    if (!/^\s*None:/m.test(body)) err(file, "Migration map", 'add a migration table, or a line starting "None:" with the reason (eg a new business with no site)');
    return;
  }
  const iOld = col(table, "old url");
  const iEv = col(table, "evidence");
  const iLabel = col(table, "label");
  const iAction = col(table, "action");
  const iTarget = col(table, "target");
  if ([iOld, iEv, iLabel, iAction, iTarget].includes(-1)) {
    err(file, "Migration map", "migration table needs Old URL, Evidence, Label, Action and Target columns");
    return;
  }
  for (const row of table.rows) {
    const old = normaliseUrl(row[iOld]);
    const where = `migration ${old || "row"}`;
    checkEvidence(file, where, row[iEv], row[iLabel], sources);
    const action = plain(row[iAction]).toLowerCase();
    if (!ACTIONS.has(action)) { err(file, where, `action "${plain(row[iAction])}" is not keep, merge, redirect or retire`); continue; }
    const target = plain(row[iTarget]) ? normaliseUrl(row[iTarget]) : "";
    if (action === "keep" && !sitemapUrls.has(old)) err(file, where, "kept URL is not in the sitemap");
    if ((action === "redirect" || action === "merge") && !sitemapUrls.has(target)) {
      err(file, where, `${action} target "${plain(row[iTarget])}" is not a URL in the sitemap`);
    }
  }
}

function checkCsv(dir: string, pages: Page[]): Set<string> {
  const file = "sitemap.csv";
  const urls = new Set<string>();
  const path = join(dir, "sitemap.csv");
  if (!existsSync(path)) { err(file, "file", "sitemap.csv is missing"); return urls; }
  const rows = parseCsv(readFileSync(path, "utf8"));
  if (rows.length === 0) { err(file, "file", "sitemap.csv is empty"); return urls; }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) { err(file, "header", `missing columns: ${missing.join(", ")}`); return urls; }
  const idx = (name: string): number => header.indexOf(name);

  const byId = new Map<string, string[]>();
  for (const row of rows.slice(1)) {
    const id = row[idx("page_id")]?.trim() ?? "";
    if (byId.has(id)) err(file, id, "duplicate page_id");
    byId.set(id, row);
    if (row[idx("url")]) urls.add(normaliseUrl(row[idx("url")]));
  }

  const specIds = new Set(pages.map((p) => p.id));
  for (const id of byId.keys()) if (!specIds.has(id)) err(file, id, "row has no matching page spec in site-plan.md");

  const compare: Array<[string, string]> = [
    ["url", "url"], ["type", "type"], ["title_tag", "title tag"], ["h1", "h1"], ["primary_cta", "primary cta"],
  ];
  for (const page of pages) {
    const row = byId.get(page.id);
    if (!row) { err(file, page.id, "page is in site-plan.md but missing from sitemap.csv"); continue; }
    for (const [csvCol, field] of compare) {
      const spec = fieldText(page.fields.get(field));
      const csv = row[idx(csvCol)] ?? "";
      const a = csvCol === "url" ? normaliseUrl(spec) : collapse(spec);
      const b = csvCol === "url" ? normaliseUrl(csv) : collapse(csv);
      if (a !== b) err(file, page.id, `${csvCol} "${collapse(csv)}" does not match site-plan.md "${collapse(spec)}"`);
    }
    const specIntent = fieldText(page.fields.get("primary intent")).match(/\bI-\d{2,}\b/)?.[0] ?? collapse(fieldText(page.fields.get("primary intent")));
    if (collapse(row[idx("primary_intent")] ?? "") !== specIntent) {
      err(file, page.id, `primary_intent "${collapse(row[idx("primary_intent")] ?? "")}" does not match site-plan.md "${specIntent}"`);
    }
    if (idx("parent") !== -1) {
      const specParent = fieldText(page.fields.get("parent")).match(/\bP-\d{2,}\b/)?.[0] ?? "";
      if (collapse(row[idx("parent")] ?? "") !== specParent) {
        err(file, page.id, `parent "${collapse(row[idx("parent")] ?? "")}" does not match site-plan.md "${specParent}"`);
      }
    }
  }
  return urls;
}

function checkDecisions(dir: string, pages: Page[]): void {
  const file = "decisions.md";
  const path = join(dir, "decisions.md");
  if (!existsSync(path)) { err(file, "file", "decisions.md is missing"); return; }
  const table = firstTable(stripFences(readFileSync(path, "utf8")));
  if (!table) { err(file, "table", "no decisions table found"); return; }
  const iDate = col(table, "date");
  const iPage = col(table, "page");
  const iDecision = col(table, "decision");
  if ([iDate, iPage, iDecision].includes(-1)) { err(file, "table", "decisions table needs Date, Page and Decision columns"); return; }
  const latest = new Map<string, string>();
  for (const row of table.rows) {
    const subject = plain(row[iPage]);
    const decision = plain(row[iDecision]).toLowerCase();
    if (!DECISIONS.has(decision)) err(file, subject || "row", `decision "${decision}" is not one of ${[...DECISIONS].join(", ")}`);
    if (!/\b\d{4}-\d{2}-\d{2}\b/.test(row[iDate])) err(file, subject || "row", "date must be YYYY-MM-DD");
    latest.set(subject.toLowerCase(), decision);
  }
  for (const page of pages) {
    const last = latest.get(page.id.toLowerCase());
    if (last !== "approved") err(file, page.id, last ? `latest decision is "${last}", not approved` : "no approval recorded for this page");
  }
  if (latest.get("plan") !== "approved") err(file, "plan", 'no "plan | approved" row; the plan is not approved yet');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  const args = process.argv.slice(2);
  const draft = args.includes("--draft");
  const json = args.includes("--json");
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir || args.includes("--help")) {
    console.log("Usage: bun check-site-plan.ts <site-plan-dir> [--draft] [--json]\n  --draft  skip the approval check in decisions.md (use before the approval loop)");
    return dir ? 0 : 2;
  }
  if (!existsSync(dir) || !statSync(dir).isDirectory()) { console.error(`Not a directory: ${dir}`); return 2; }

  const planPath = join(dir, "site-plan.md");
  let summary = { pages: 0, intents: 0 };
  if (!existsSync(planPath)) {
    err("site-plan.md", "file", "site-plan.md is missing");
  } else {
    const sections = h2Sections(readFileSync(planPath, "utf8"));
    for (const name of REQUIRED_SECTIONS) {
      if (!sections.has(name.toLowerCase())) err("site-plan.md", "sections", `missing section "## ${name}"`);
    }
    const sources = checkSources(dir);
    const brief = checkBrief(sections.get("website brief") ?? "");
    const intents = checkIntents(sections.get("search-intent map") ?? "", sources);
    const pages = parsePages(sections.get("sitemap") ?? "");
    checkPages(pages, intents, parseBriefAreas(brief));
    const specUrls = new Set(pages.map((p) => normaliseUrl(fieldText(p.fields.get("url")))));
    checkCsv(dir, pages);
    if (sections.has("migration map")) checkMigration(sections.get("migration map") ?? "", specUrls, sources);
    if (sections.has("research gaps") && (sections.get("research gaps") ?? "").trim() === "") {
      err("site-plan.md", "Research gaps", 'section is empty; list the gaps or write "None"');
    }
    if (!draft) checkDecisions(dir, pages);
    summary = { pages: pages.length, intents: intents.size };
  }

  const passed = errors.length === 0;
  if (json) {
    console.log(JSON.stringify({ passed, mode: draft ? "draft" : "final", summary, errors, warnings }, null, 2));
  } else {
    for (const e of errors) console.log(`ERROR  ${e.file}  ${e.where}: ${e.message}`);
    for (const w of warnings) console.log(`WARN   ${w.file}  ${w.where}: ${w.message}`);
    console.log(`${passed ? "PASS" : "FAIL"} (${draft ? "draft" : "final"}): ${summary.pages} pages, ${summary.intents} intents, ${errors.length} errors, ${warnings.length} warnings`);
  }
  return passed ? 0 : 1;
}

process.exitCode = main();
