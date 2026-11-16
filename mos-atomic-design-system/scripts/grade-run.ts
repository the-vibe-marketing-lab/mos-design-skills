#!/usr/bin/env bun
/**
 * grade-run.ts — score one eval run's outputs against the mechanical assertions.
 *
 * Deliberately layout-agnostic: it globs the output tree for HTML and CSS
 * rather than reading STATE.json, because baseline runs won't follow the
 * skill's layout and grading them by the skill's own conventions would rig the
 * comparison.
 *
 * Judgement assertions (is a value genuinely traceable? is a gap stated
 * honestly?) are left as passed:null for a human or a reading pass to fill —
 * scripting them would produce confident nonsense.
 *
 * v2 graders (evals 0 and 2) read the design-system/ root when one exists:
 * tier markers, full scales, mapped state + status tokens, tier discipline in
 * component CSS, per-atom spec files, tokens.json, the standard focus ring.
 * Eval 1 extends a LEGACY system, so it is graded on NOT scaffolding v2 and the
 * stage-page / ID / verify-stage graders (which assume a skill-built system)
 * are not applied to it.
 *
 * Usage: bun grade-run.ts --run <run-dir> --eval <0|1|2> [--json]
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { parseTokensCss, resolveLiteral } from "./export-tokens.ts";
import { extractIds, strippedOf } from "./build-index.ts";

const argv = process.argv.slice(2);
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};
const runDir = resolve(flag("run") ?? process.cwd());
const evalId = Number(flag("eval") ?? "0");
const outputs = existsSync(join(runDir, "outputs")) ? join(runDir, "outputs") : runDir;

/**
 * Brand document each eval must resolve (eval 2 must resolve none).
 *
 * Matched as "names this brand's repo AND a brand-doc filename" rather than as
 * one exact path substring. An earlier version required the literal string
 * `reference/brand/brand-guidelines.md`, which a run split across two lines of
 * prose — scoring a run that had correctly found and used the real document as
 * a failure. An assertion that can only be satisfied by one formatting of a
 * true fact measures formatting, not the fact.
 */
const EXPECTED_BRAND: Record<
  number,
  { repo?: string; files?: string[]; mustNot: string[] }
> = {
  0: {
    repo: "cedar-studio-brain",
    files: ["brand-guidelines.md"],
    mustNot: ["harbour", "northwind", "unrelated-agency", "unrelated-shop"],
  },
  1: {
    repo: "harbour-homes",
    files: ["brand-guidelines.md", "colour-palette.md", "typography.md"],
    mustNot: ["cedar", "northwind", "unrelated-agency"],
  },
  2: { mustNot: ["cedar", "harbour", "unrelated-agency", "unrelated-shop", "unrelated-brain"] },
};

// ---------------------------------------------------------------------------
// Collect files
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".git") continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(outputs);
const read = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

const htmlFiles = files.filter((f) => f.endsWith(".html"));
const cssFiles = files.filter((f) => f.endsWith(".css"));
const mdFiles = files.filter((f) => f.endsWith(".md"));

const tokenFile = cssFiles.find((f) => /token/i.test(basename(f)));
// <style> blocks count as CSS. Hand-built legacy pages keep all their CSS
// inline; reading only .css files scored a legacy run that HAD :focus-visible
// rules as "no :focus-visible anywhere".
const styleBlocks = htmlFiles.flatMap((f) => [...strippedOf(read(f)).matchAll(/<style[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]));
const allCss = [...cssFiles.map(read), ...styleBlocks].join("\n");
const allHtml = htmlFiles.map(read).join("\n");
const allMd = mdFiles.map(read).join("\n");
const brief = mdFiles.find((f) => /brief|design-system|README/i.test(basename(f)));

const atomsPage = htmlFiles.find((f) => /atom/i.test(basename(f)));
const foundationsPage = htmlFiles.find((f) => /foundation/i.test(basename(f)));

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

interface Result { id: string; text: string; passed: boolean | null; evidence: string }
const results: Result[] = [];

/** Assertions that assume a skill-built (v2) system are not applied to the legacy-extension eval. */
const NOT_APPLIED: Record<number, string[]> = {
  1: ["stage-pages-exist", "atom-ids-contiguous", "verify-stage-passes"],
};
const add = (id: string, text: string, passed: boolean | null, evidence: string) => {
  if ((NOT_APPLIED[evalId] ?? []).includes(id)) return;
  results.push({ id, text, passed, evidence });
};

// -- files produced at all
add(
  "artifacts-produced",
  "Produced .html and .md design system artifacts",
  htmlFiles.length > 0 && mdFiles.length > 0,
  `${htmlFiles.length} html, ${mdFiles.length} md, ${cssFiles.length} css`,
);

// -- brand source
{
  const exp = EXPECTED_BRAND[evalId];
  const haystack = (allMd + "\n" + files.filter((f) => f.endsWith(".json")).map(read).join("\n")).toLowerCase();
  const wrong = exp.mustNot.filter((b) => {
    // Only count a foreign brand name if it appears as a brand SOURCE path.
    const re = new RegExp(`[\\w./-]*${b}[\\w./-]*/(business|reference)/brand`, "i");
    return re.test(haystack);
  });
  if (evalId === 2) {
    const saysNone = /no brand (document|doc|guidelines)|none found|nothing written down|no existing brand|greenfield/i.test(allMd);
    add(
      "brand-source-correct",
      "Brand source: correctly reports that no brand document exists for this brand, and borrows none",
      wrong.length === 0 && saysNone,
      wrong.length ? `borrowed from: ${wrong.join(", ")}` : saysNone ? "states no brand doc found" : "does not state the absence explicitly",
    );
  } else {
    const namesRepo = !!exp.repo && haystack.includes(exp.repo.toLowerCase());
    const namedFiles = (exp.files ?? []).filter((f) => haystack.includes(f.toLowerCase()));
    const found = namesRepo && namedFiles.length > 0;
    add(
      "brand-source-correct",
      `Brand source: resolves this brand's own document (${exp.repo} — ${(exp.files ?? []).join(" / ")})`,
      found && wrong.length === 0,
      found
        ? wrong.length
          ? `found, but also references foreign brand(s): ${wrong.join(", ")}`
          : `names ${exp.repo} and ${namedFiles.join(", ")}`
        : `repo named: ${namesRepo}; brand files named: ${namedFiles.join(", ") || "none"}`,
    );
  }
}

// -- tokens
{
  const css = tokenFile ? read(tokenFile) : allCss;
  const placeholders = [...new Set(css.match(/\{\{[A-Z_]+\}\}/g) ?? [])];
  const roles = [...new Set(css.match(/--[\w-]*(color|bg|text|surface|border|accent|focus|ink|paper)[\w-]*\s*:/gi) ?? [])];
  const fonts = [...new Set(css.match(/--[\w-]*font[\w-]*\s*:/gi) ?? [])];
  add(
    "tokens-resolved",
    "tokens: a token stylesheet exists with no unresolved placeholders, >=5 semantic colour roles and a display/body font pair",
    !!css && placeholders.length === 0 && roles.length >= 5 && fonts.length >= 2,
    `${tokenFile ? basename(tokenFile) : "no dedicated token file"} · ${placeholders.length} placeholders · ${roles.length} colour roles · ${fonts.length} font tokens`,
  );
}

// -- inspiration map
{
  // Scope to the Inspiration Map section only. Counting every 4-cell table row
  // in every markdown file scored unrelated tables (and their own header rows)
  // as completed map entries, which inflated the result.
  // Slice explicitly rather than with a lookahead terminator. An earlier
  // version ended the capture with `\Z`, which JavaScript does not support —
  // it is parsed as a literal "Z", so the section truncated at the first
  // capital Z inside the table and the check reported zero rows on a
  // perfectly good map.
  const headingRe = /^#{1,4}[^\n]*$/gm;
  const headings = [...allMd.matchAll(headingRe)];
  const startIdx = headings.findIndex((h) => /inspiration map/i.test(h[0]));
  const hasMap = startIdx !== -1;
  const section = hasMap
    ? allMd.slice(
        headings[startIdx].index! + headings[startIdx][0].length,
        headings[startIdx + 1]?.index ?? allMd.length,
      )
    : "";
  const rows = (section.match(/^\|.*\|\s*$/gm) ?? []).filter(
    (r) =>
      !/^\|[\s|:-]*$/.test(r) && // separator
      !/what we (take|leave)/i.test(r) && // header
      !/\{\{[A-Z_]+\}\}/.test(r), // unfilled template placeholder
  );
  // A row is complete only when the last two cells both carry real content.
  const complete = rows.filter((r) => {
    const cells = r.split("|").slice(1, -1).map((c) => c.trim());
    // Three columns (Reference | Take | Leave, as a legacy ATOMIC-NOTES.md
    // writes it) is a complete row too; requiring four scored a filled map as empty.
    if (cells.length < 3) return false;
    if (cells.slice(-2).every((c) => /^\**\s*(what we )?(take|leave)\b/i.test(c))) return false; // header
    return cells.slice(-2).every((c) => c.length > 3 && !/^[-–—]+$/.test(c));
  });
  add(
    "inspiration-map-complete",
    "Inspiration Map present with a row per source, each filling in BOTH take and leave",
    hasMap && complete.length >= 2,
    `map heading: ${hasMap} · ${rows.length} table rows, ${complete.length} with both take+leave filled`,
  );
}

// -- stage page chrome
{
  const pages = [foundationsPage, atomsPage].filter(Boolean) as string[];
  const problems: string[] = [];
  for (const p of pages) {
    const h = read(p);
    if (!/robots"?\s+content="noindex/i.test(h)) problems.push(`${basename(p)}: no noindex`);
    if (!/skip-link|skip to content/i.test(h)) problems.push(`${basename(p)}: no skip link`);
    if (!/id="content"/.test(h)) problems.push(`${basename(p)}: no id="content"`);
    const rail = h.match(/<nav[^>]*>([\s\S]*?)<\/nav>/);
    const cur = rail ? (rail[1].match(/aria-current="page"/g) ?? []).length : 0;
    if (cur !== 1) problems.push(`${basename(p)}: ${cur} aria-current in first nav`);
  }
  add(
    "stage-pages-exist",
    "Stage pages (foundations + atoms) exist with noindex, skip link, id=\"content\", and exactly one aria-current in the rail",
    pages.length === 2 && problems.length === 0,
    pages.length < 2 ? `only ${pages.length}/2 stage pages found` : problems.length ? problems.join("; ") : "all chrome checks pass on both pages",
  );
}

// -- atom IDs
{
  const h = atomsPage ? read(atomsPage) : "";
  // Same reader as verify-stage.ts: IDs only from id="", data-*="" and
  // .card-label — never prose, so an intro saying "A-01 to A-12" isn't scored
  // as two specimens with a gap.
  const ids = extractIds(h, "A").map((id) => id.slice(2));
  const padded = ids.every((i) => i.length === 2);
  const contiguous = ids.every((v, i) => Number(v) === i + 1);
  add(
    "atom-ids-contiguous",
    "atoms.html carries zero-padded A-nn IDs, contiguous from A-01, no gaps or duplicates",
    ids.length > 0 && padded && contiguous,
    ids.length === 0 ? "no A-nn IDs found" : `${ids.length} IDs: A-${ids.join(", A-")} · padded=${padded} contiguous=${contiguous}`,
  );
}

// -- focus
{
  const hasRule = /:focus-visible/.test(allCss);
  const global = allCss.match(/(^|\})\s*:focus-visible\s*\{([^}]*)\}/);
  const visible = hasRule && (!global || /(outline|box-shadow|border)/.test(global[2]));
  add(
    "focus-visible-present",
    "A :focus-visible rule exists and sets a visible property",
    hasRule && visible,
    hasRule ? (visible ? "present and sets a visible property" : "present but sets nothing visible") : "no :focus-visible anywhere",
  );
}

// -- raw values
{
  const body = allCss
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@font-face\s*\{[^}]*\}/g, "")
    .replace(/--[\w-]+\s*:[^;}]*/g, "");
  const hexes = [...new Set(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])];
  const fonts = [...new Set((body.match(/font-family:\s*[^;{}]+/g) ?? []).filter((d) => !/var\(--/.test(d)))];
  const inline = [...allHtml.matchAll(/style="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((s) => /#[0-9a-fA-F]{3,8}\b/.test(s) || /font-family/.test(s));
  add(
    "no-raw-values",
    "No raw hex or literal font-family in component rules or inline styles (token definitions and @font-face excepted)",
    hexes.length === 0 && fonts.length === 0 && inline.length === 0,
    `${hexes.length} raw hex${hexes.length ? ` (${hexes.slice(0, 4).join(", ")})` : ""} · ${fonts.length} literal font-family · ${inline.length} offending inline styles`,
  );
}

// -- the skill's own gate
{
  const vf = files.find((f) => /verify-stage/.test(basename(f)));
  if (!vf) {
    add("verify-stage-passes", "verify-stage.ts --stage 2 passes", null, "no verify-stage output captured (expected for baseline runs)");
  } else {
    const out = read(vf);
    const failures = (out.match(/✗/g) ?? []).length;
    add(
      "verify-stage-passes",
      "verify-stage.ts --stage 2 reports zero failures",
      failures === 0,
      failures === 0 ? "clean" : `${failures} failure(s): ${(out.match(/✗ [^\n]+/g) ?? []).slice(0, 3).join(" | ")}`,
    );
  }
}


// ---------------------------------------------------------------------------
// v2 assertions
// ---------------------------------------------------------------------------

const rel = (f: string) => f.slice(outputs.length + 1).replace(/\\/g, "/");
const v2States = files
  .filter((f) => /(^|[\\/])design-system[\\/]STATE\.json$/.test(f))
  .filter((f) => {
    try {
      return (JSON.parse(read(f)).schemaVersion ?? 1) >= 2;
    } catch {
      return false;
    }
  });
const v2Root = v2States.length ? dirname(v2States[0]) : null;
const inRoot = (p: string) => (v2Root ? join(v2Root, p) : "");
const noRoot = "no design-system/STATE.json with schemaVersion 2 in the outputs";

const STATUSES = ["error", "success", "warning", "info"];
/** Same set verify-stage.ts requires. */
const MAPPED_STATE = [
  ...["action", "action-hover", "disabled", "on-action", "placeholder"].map((r) => `--color-text-${r}`),
  ...["action", "disabled", "on-action"].map((r) => `--color-icon-${r}`),
  ...["action", "action-hover", "disabled"].map((r) => `--color-surface-${r}`),
  ...["action", "action-hover", "disabled", "focus"].map((r) => `--color-border-${r}`),
];
const MAPPED_STATUS = ["text", "surface", "border"].flatMap((g) => STATUSES.map((st) => `--color-${g}-${st}`));

if (evalId === 1) {
  add(
    "no-v2-scaffold",
    "The legacy Harbour Homes system is extended in place: no design-system/STATE.json with schemaVersion 2 is created",
    v2States.length === 0,
    v2States.length ? `v2 STATE.json written at ${v2States.map(rel).join(", ")}` : "no v2 STATE.json anywhere in the outputs",
  );
  add("legacy-extended", "The existing hand-built system is extended in its own conventions (not replaced or migrated unasked)", null, "judgement — requires reading the brief and the new artifacts against the legacy ones");
} else {
  // -- single root
  {
    const need = ["README.md", "brief/DESIGN-BRIEF.md", "tokens/tokens.css", "reference"];
    const missing = v2Root ? need.filter((n) => !existsSync(inRoot(n))) : need;
    const stray = files.map(rel).filter((f) => /(^|\/)docs\/design-system\/|(^|\/)public\/atomic-framework\/|(^|\/)src\/styles\/tokens\.css$/.test(f));
    add(
      "v2-single-root",
      "All output lives under one design-system/ root with README.md, STATE.json (schemaVersion 2), brief/DESIGN-BRIEF.md, tokens/tokens.css and reference/ — nothing in v1 paths",
      !!v2Root && missing.length === 0 && stray.length === 0,
      !v2Root ? noRoot : `${missing.length ? `missing: ${missing.join(", ")}` : "all present"}${stray.length ? ` · v1-path files: ${stray.slice(0, 3).join(", ")}` : ""}`,
    );
  }

  const tokCss = v2Root && existsSync(inRoot("tokens/tokens.css")) ? read(inRoot("tokens/tokens.css")) : "";
  const parsed = tokCss ? parseTokensCss(tokCss) : null;

  // -- tier markers
  {
    const order = parsed?.markers.map((m) => m.tier).join(" → ") ?? "";
    add(
      "tier-markers",
      "tokens/tokens.css has the four @tier markers (brand, alias, mapped, responsive) in that order",
      order === "brand → alias → mapped → responsive",
      parsed ? `markers: ${order || "none"}` : noRoot,
    );
  }

  // -- full colour scales
  {
    const hues = new Map<string, Set<string>>();
    for (const t of parsed?.tokens.values() ?? []) {
      const m = t.name.match(/^--brand-(.+)-(\d+)$/);
      if (!m || t.tier !== "brand") continue;
      const lit = resolveLiteral(parsed!.tokens, t.name) ?? "";
      if (!/^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|hwb)\(.*\))$/i.test(lit)) continue;
      if (!hues.has(m[1])) hues.set(m[1], new Set());
      hues.get(m[1])!.add(m[2]);
    }
    const steps = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
    const short = [...hues.entries()].filter(([, s]) => !steps.every((x) => s.has(x))).map(([h]) => h);
    add(
      "full-colour-scales",
      "Every brand colour hue defines the full 50–900 scale (≥10 steps)",
      hues.size >= 2 && short.length === 0,
      parsed ? `${hues.size} hue(s)${short.length ? `; incomplete: ${short.join(", ")}` : ", all complete"}` : noRoot,
    );
  }

  // -- mapped state + status tokens
  for (const [id, text, list] of [
    ["mapped-state-tokens", "The mapped tier defines the required state tokens (action, action-hover, disabled, on-action, placeholder, focus)", MAPPED_STATE],
    ["mapped-status-tokens", "The mapped tier defines text/surface/border tokens for error, success, warning and info", MAPPED_STATUS],
  ] as const) {
    const missing = parsed ? list.filter((n) => parsed.tokens.get(n)?.tier !== "mapped") : list;
    add(id, text, !!parsed && missing.length === 0, parsed ? (missing.length ? `missing: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}` : `all ${list.length} present`) : noRoot);
  }

  // -- components use mapped tokens only
  {
    const offenders: string[] = [];
    const refCss = v2Root ? read(inRoot("reference/styles.css")).replace(/\/\*[\s\S]*?\*\//g, "") : "";
    const cssRefs = [...new Set(refCss.match(/(?<![\w-])--(brand|alias)-[\w-]+/g) ?? [])];
    if (cssRefs.length) offenders.push(`styles.css: ${cssRefs.slice(0, 3).join(", ")}`);
    for (const f of htmlFiles.filter((f) => !v2Root || f.startsWith(join(v2Root, "reference")))) {
      const h = read(f).replace(/<!--[\s\S]*?-->/g, "").replace(/<(pre|code)[\s\S]*?<\/\1>/gi, "");
      const styles = [...h.matchAll(/style="([^"]*)"/g), ...h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join(" ");
      const refs = [...new Set(styles.match(/(?<![\w-])--(brand|alias)-[\w-]+/g) ?? [])];
      if (refs.length) offenders.push(`${basename(f)}: ${refs.slice(0, 3).join(", ")}`);
    }
    add(
      "components-mapped-only",
      "No component/specimen CSS or inline style references a --brand- or --alias- token",
      !!v2Root && offenders.length === 0,
      !v2Root ? noRoot : offenders.length ? offenders.join("; ") : "reference CSS and inline styles use mapped/responsive tokens only",
    );
  }

  // -- per-atom spec files
  {
    const SECTIONS: [string, RegExp][] = [
      ["Purpose", /^#{2,3}\s+Purpose\b/m],
      ["Anatomy", /^#{2,3}\s+Anatomy\b/m],
      ["Props / variants", /^#{2,3}\s+Props\b/m],
      ["States", /^#{2,3}\s+States\b/m],
      ["Sizes", /^#{2,3}\s+Sizes\b/m],
      ["Behaviour & responsive", /^#{2,3}\s+Behaviou?r\b/m],
      ["Accessibility", /^#{2,3}\s+Accessibility\b/m],
      ["Markup", /^#{2,3}\s+Markup\b/m],
      ["Do / Don't", /^#{2,3}\s+Do\b/m],
    ];
    const FM = ["id", "name", "level", "status", "composes", "tokens", "specimen"];
    const atomsHtml = v2Root && existsSync(inRoot("reference/atoms.html")) ? read(inRoot("reference/atoms.html")) : "";
    const ids = extractIds(atomsHtml, "A");
    const specDir = inRoot("components/atoms");
    const specs = v2Root && existsSync(specDir) ? readdirSync(specDir).filter((f) => f.endsWith(".md")) : [];
    const problems: string[] = [];
    for (const id of ids) {
      const matches = specs.filter((f) => f.startsWith(`${id}-`));
      if (matches.length !== 1) {
        problems.push(`${id}: ${matches.length} spec files`);
        continue;
      }
      const md = read(join(specDir, matches[0]));
      const fm = md.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const missingFm = FM.filter((k) => !new RegExp(`^${k}:`, "m").test(fm));
      const positions = SECTIONS.map(([, re]) => md.search(re));
      const missingSec = SECTIONS.filter((_, i) => positions[i] === -1).map(([n]) => n);
      const present = positions.filter((x) => x !== -1);
      const ordered = present.every((x, i) => i === 0 || x > present[i - 1]);
      if (missingFm.length) problems.push(`${id}: frontmatter missing ${missingFm.join(", ")}`);
      if (missingSec.length) problems.push(`${id}: missing ${missingSec.join(", ")}`);
      else if (!ordered) problems.push(`${id}: sections out of order`);
    }
    add(
      "atom-spec-files",
      "components/atoms/ holds exactly one <ID>-<slug>.md per A-nn in atoms.html, with full frontmatter and every spec section in order",
      !!v2Root && ids.length > 0 && problems.length === 0,
      !v2Root ? noRoot : !ids.length ? "no A-nn IDs in reference/atoms.html" : problems.length ? problems.slice(0, 4).join("; ") : `${ids.length} spec(s), all complete`,
    );
  }

  // -- tokens.json
  {
    const p = inRoot("tokens/tokens.json");
    let ok = false;
    let ev = noRoot;
    if (v2Root) {
      if (!existsSync(p)) ev = "tokens/tokens.json not found";
      else {
        try {
          const j = JSON.parse(read(p));
          ok = typeof j === "object" && j !== null;
          ev = `parses; top-level groups: ${Object.keys(j).filter((k) => !k.startsWith("$")).join(", ")}`;
        } catch (e) {
          ev = `does not parse: ${(e as Error).message}`;
        }
      }
    }
    add("tokens-json-valid", "design-system/tokens/tokens.json exists and parses as JSON", ok, ev);
  }

  // -- focus ring standard
  {
    const nonToken = cssFiles.filter((f) => !/token/i.test(basename(f))).map(read).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...nonToken.matchAll(/:focus-visible[^{]*\{([^}]*)\}/g)].map((m) => m[1]);
    const std = rules.some((r) => /var\(--focus-ring-width\)/.test(r) && /var\(--color-border-focus\)/.test(r));
    add(
      "focus-ring-standard",
      "A :focus-visible rule uses var(--focus-ring-width) and var(--color-border-focus)",
      std,
      rules.length ? (std ? "standard focus ring present" : `${rules.length} :focus-visible rule(s), none use both tokens`) : "no :focus-visible rule",
    );
  }
}

// -- judgement calls, left for a reading pass
add("tokens-traceable", "Every token value is traceable to the brand document or a named inspiration source", null, "judgement — requires reading the brief against tokens.css");
add("atom-states-shown", "Interactive atoms are shown in their required states, not default only", null, "judgement — requires viewing the rendered page");
add("gaps-stated-honestly", "Unavailable inputs (Mobbin, failed snapshots, missing brand doc) are recorded as explicit gaps", null, "judgement — requires reading the brief");
if (evalId === 1) add("existing-system-respected", "Pre-existing atomic-design artifacts are noticed and extension proposed over replacement", null, "judgement — requires reading the brief");
if (evalId === 2) add("no-brand-borrowing", "Derived values are labelled provisional rather than presented as brand decisions", null, "judgement — requires reading the brief");

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const scored = results.filter((r) => r.passed !== null);
const passed = scored.filter((r) => r.passed).length;
const grading = {
  expectations: results,
  summary: {
    passed,
    failed: scored.length - passed,
    total: scored.length,
    pass_rate: scored.length ? Number((passed / scored.length).toFixed(4)) : 0,
    ungraded_judgement_calls: results.length - scored.length,
  },
};

writeFileSync(join(runDir, "grading.json"), JSON.stringify(grading, null, 2) + "\n");

if (argv.includes("--json")) {
  console.log(JSON.stringify(grading, null, 2));
} else {
  console.log(`\n${basename(resolve(runDir, ".."))}/${basename(runDir)} — ${passed}/${scored.length} mechanical (${(grading.summary.pass_rate * 100).toFixed(0)}%)`);
  for (const r of results) {
    const mark = r.passed === null ? "?" : r.passed ? "✓" : "✗";
    console.log(`  ${mark} ${r.text}`);
    if (r.passed !== true) console.log(`      ${r.evidence}`);
  }
}
