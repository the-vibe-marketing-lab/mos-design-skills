#!/usr/bin/env bun
/**
 * verify-stage.ts — the deterministic gate before a human sees a stage.
 *
 * The point is not to judge design; a script can't. The point is to catch the
 * mechanical failures that waste a reviewer's attention — a missing focus
 * treatment, a renumbered specimen, a raw hex that escaped the token layer —
 * so the review is spent on decisions rather than defects.
 *
 * The core idea is borrowed from the reference build's Playwright specs: the
 * spec sheet and the test are the same artifact, so the inventory cannot
 * silently drift.
 *
 * Two layouts. A STATE.json with schemaVersion 2 (design-system/STATE.json) gets
 * the v2 checks on top of the shared ones: tier markers, full colour scales,
 * required mapped tokens, theme blocks, tier discipline in component CSS, one
 * spec .md per specimen ID, and the README index. A v1 STATE.json (no
 * schemaVersion) runs the original v1 checks unchanged — v1 systems are
 * extended in place, not held to a contract they were never built against.
 *
 * A hand-built LEGACY system with no STATE.json (stage pages next to a brand
 * doc, an old public/atomic-framework/) has no inventory to check against, so
 * --legacy <dir> runs only the generic checks over the HTML/CSS in that folder:
 * noindex, no raw values outside a tokens file, and a visible :focus-visible
 * rule reachable from every page that has something to focus.
 *
 * Usage:
 *   bun verify-stage.ts --target <repo> --stage <n>
 *   bun verify-stage.ts --target <repo> --all
 *   bun verify-stage.ts --legacy <dir>
 *   bun verify-stage.ts --target <repo> --stage 3 --json
 *
 * Exit: 0 all checks pass · 1 one or more failures · 2 cannot run
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inferType, mapVars, parseTokensCss, resolveLiteral, scanVars, varOnly, type ParsedTokens, type Tier } from "./export-tokens.ts";
import { currentSection, expectedReadmeSections, extractIds, parseFrontmatter, readSpecs, strippedOf, type Section } from "./build-index.ts";

const argv = process.argv.slice(2);
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--")
    ? argv[i + 1]
    : undefined;
};
const has = (n: string) => argv.includes(`--${n}`);

const target = resolve(flag("target") ?? process.cwd());
const asJson = has("json");
const all = has("all");
const stageArg = flag("stage");

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

type Level = "error" | "warn";
interface Finding {
  level: Level;
  check: string;
  detail: string;
  file?: string;
}

const findings: Finding[] = [];
const passes: string[] = [];

/**
 * Dedupe on push. Shared artifacts (styles.css, tokens.css) get checked once
 * per stage during --all, and repeating the same failure seven times buries the
 * ones that only appear once.
 */
const seenFindings = new Set<string>();
const record = (level: Level, check: string, detail: string, file?: string) => {
  const key = `${level}|${check}|${detail}|${file ?? ""}`;
  if (seenFindings.has(key)) return;
  seenFindings.add(key);
  findings.push({ level, check, detail, file });
};
const fail = (check: string, detail: string, file?: string) =>
  record("error", check, detail, file);
const warn = (check: string, detail: string, file?: string) =>
  record("warn", check, detail, file);
const pass = (check: string) => {
  if (!passes.includes(check)) passes.push(check);
};


// ---------------------------------------------------------------------------
// Legacy mode — generic checks only, no STATE.json
// ---------------------------------------------------------------------------

function rawValueProblems(css: string): string[] {
  const body = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@font-face\s*\{[^}]*\}/g, "")
    .replace(/--[\w-]+\s*:[^;}]*/g, "");
  const out: string[] = [];
  const hexes = [...new Set(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])];
  if (hexes.length) out.push(`${hexes.length} raw hex value(s) in component rules: ${hexes.slice(0, 6).join(", ")}`);
  const fonts = [...new Set((body.match(/font-family:\s*[^;{}]+/g) ?? []).filter((d) => !/var\(--/.test(d)))];
  if (fonts.length) out.push(`${fonts.length} font-family declaration(s) not using a token: ${fonts.slice(0, 3).join(" | ")}`);
  return out;
}

/** Interactive elements a keyboard user can land on (on the stripped page). */
function interactiveCount(stripped: string): number {
  const re = /<(button|select|textarea)\b|<a\b[^>]*\shref=|<input\b(?![^>]*type="hidden")|\stabindex="(?!-1")/gi;
  return (stripped.match(re) ?? []).length;
}

/**
 * True when some rule whose selector uses :focus-visible (not only inside
 * :not(...)) sets a visible property. `outline: none` on its own is the
 * opposite of a focus treatment.
 */
function hasVisibleFocus(css: string): boolean {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of body.matchAll(/([^{}]*):focus-visible([^{}]*)\{([^}]*)\}/g)) {
    const selector = `${m[1]}:focus-visible${m[2]}`.replace(/:not\([^)]*\)/g, "");
    if (!/:focus-visible/.test(selector)) continue;
    const decl = m[3];
    if (/(box-shadow|border(-[\w-]+)?|text-decoration(-[\w-]+)?|background(-color)?)\s*:/.test(decl)) return true;
    if (/outline(-(width|style|color))?\s*:(?!\s*(none|0|0px)\s*(;|!|$))/.test(decl)) return true;
  }
  return false;
}

function runLegacy(dirArg: string): never {
  // Relative to --target when given (init-system prints paths that way), else cwd.
  const dir = resolve(target, dirArg);
  if (!existsSync(dir)) {
    console.error(`✗ --legacy dir does not exist: ${dir}`);
    process.exit(2);
  }
  const walk = (d: string, out: string[] = []): string[] => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, out);
      else out.push(p);
    }
    return out;
  };
  const files = walk(dir);
  const html = files.filter((f) => f.endsWith(".html"));
  const css = files.filter((f) => f.endsWith(".css"));
  const rel = (f: string) => f.slice(dir.length + 1).replace(/\\/g, "/");
  if (!html.length && !css.length) {
    console.error(`✗ No .html or .css under ${dir}`);
    process.exit(2);
  }
  // Focus is judged per page: a page with something to focus needs a visible
  // :focus-visible rule in CSS that page actually loads. A single dir-wide
  // "any file mentions :focus-visible" let a brand page elsewhere in the folder
  // (or a commented-out rule) vouch for stage pages that had none.
  const cssText = new Map(css.map((f) => [resolve(f), readFileSync(f, "utf8")]));
  const dirFocus = [...cssText.values()].some(hasVisibleFocus);
  const pageStyles: { file: string; styles: string; linked: string[]; unresolved: boolean; interactive: number }[] = [];
  for (const f of html) {
    const h = readFileSync(f, "utf8");
    if (!/<meta\s+name="robots"\s+content="noindex,nofollow"/.test(h)) fail("noindex", "missing robots noindex,nofollow", rel(f));
    const s = strippedOf(h);
    const inline = [...s.matchAll(/style="([^"]*)"/g)].map((m) => m[1]).filter((x) => /#[0-9a-fA-F]{3,8}\b/.test(x) || /font-family/.test(x));
    if (inline.length) fail("no raw values in inline styles", `${inline.length} inline style(s) contain a raw colour or font`, rel(f));
    const blocks = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]);
    for (const b of blocks) for (const p of rawValueProblems(b)) fail("no raw values outside a tokens file", `<style>: ${p}`, rel(f));
    const hrefs = [...s.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)].map((m) => m[0].match(/href="([^"]+)"/)?.[1]).filter((x): x is string => !!x);
    const linked: string[] = [];
    let unresolved = false;
    for (const href of hrefs) {
      if (/^(https?:)?\/\//.test(href) || href.startsWith("/")) { unresolved = true; continue; }
      const p = resolve(join(f, ".."), href.split(/[?#]/)[0]);
      const text = cssText.get(p);
      if (text === undefined) { unresolved = true; continue; }
      linked.push(text);
      // One level of @import (a styles.css that imports the tokens file).
      for (const m of text.matchAll(/@import\s+(?:url\()?["']?([^"')\s]+)/g)) {
        const t = cssText.get(resolve(join(p, ".."), m[1]));
        if (t !== undefined) linked.push(t);
      }
    }
    pageStyles.push({ file: f, styles: blocks.join("\n"), linked, unresolved, interactive: interactiveCount(s) });
  }
  for (const f of css) {
    const c = readFileSync(f, "utf8");
    if (/token/i.test(f.split(/[\\/]/).pop() ?? "")) continue; // the tokens file holds literals by design
    for (const p of rawValueProblems(c)) fail("no raw values outside a tokens file", p, rel(f));
  }
  for (const p of pageStyles) {
    if (!p.interactive) continue; // nothing to focus, nothing to show
    const own = hasVisibleFocus(p.styles) || p.linked.some(hasVisibleFocus);
    // A stylesheet we can't read (site-absolute or remote) might hold the rule;
    // fall back to the folder's CSS rather than guess either way.
    if (own || (p.unresolved && dirFocus)) continue;
    fail(
      "visible focus treatment",
      `${p.interactive} interactive element(s) but no visible :focus-visible rule in this page's <style> blocks or linked stylesheets — keyboard users can't see where they are`,
      rel(p.file),
    );
  }
  for (const c of ["noindex", "no raw values in inline styles", "no raw values outside a tokens file", "visible focus treatment"]) {
    if (!findings.some((f) => f.check === c)) pass(c);
  }
  const errors = findings.filter((f) => f.level === "error");
  if (asJson) {
    console.log(JSON.stringify({ legacy: dir, passed: passes, errors, warnings: findings.filter((f) => f.level === "warn") }, null, 2));
  } else {
    console.log(`\nVerifying legacy system in ${dir} (generic checks only — no STATE.json)\n`);
    for (const p of passes) console.log(`  ✓ ${p}`);
    for (const e of errors) console.log(`  ✗ ${e.check}: ${e.detail}${e.file ? `  [${e.file}]` : ""}`);
    console.log(errors.length ? `\n${errors.length} failure(s).` : `\n${passes.length} check(s) passed.`);
  }
  process.exit(errors.length ? 1 : 0);
}

const legacyArg = flag("legacy");
if (legacyArg) runLegacy(legacyArg);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface State {
  schemaVersion?: number;
  themes?: string[];
  layout: { docs?: string; root?: string; reference: string; tokens: string; components?: string };
  brand: { name: string; docPath: string | null; confirmedByUser: boolean };
  inventory: Record<string, number | null>;
  stages: {
    n: number;
    name: string;
    pages: string[];
    outputs?: string[];
    status: string;
    approvedAt: string | null;
  }[];
}

function loadState(): State {
  // v2 first: one root, schemaVersion 2. A design-system/STATE.json WITHOUT a
  // schemaVersion is a v1 system and is read as one.
  const v2 = join(target, "design-system/STATE.json");
  if (existsSync(v2)) {
    const s = JSON.parse(readFileSync(v2, "utf8"));
    if ((s.schemaVersion ?? 1) >= 2) return s;
  }
  for (const rel of ["docs/design-system/STATE.json", "design-system/docs/STATE.json", "design-system/STATE.json"]) {
    const p = join(target, rel);
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  }
  console.error(
    `✗ No STATE.json under ${target}. Run init-system.ts first — verification\n` +
      `  needs the recorded inventory to check the HTML against.`,
  );
  process.exit(2);
}

const state = loadState();
const isV2 = (state.schemaVersion ?? 1) >= 2;
const refDir = join(target, state.layout.reference);
const tokensPath = join(target, state.layout.tokens);
const dsRoot = join(target, state.layout.root ?? "design-system");

const read = (p: string): string | null =>
  existsSync(p) ? readFileSync(p, "utf8") : null;

/** ID prefix owned by each stage, for contiguity checks. */
const STAGE_IDS: Record<number, { prefix: string; key: string }> = {
  2: { prefix: "A", key: "atoms" },
  3: { prefix: "M", key: "molecules" },
  4: { prefix: "O", key: "organisms" },
  5: { prefix: "T", key: "templates" },
  6: { prefix: "P", key: "pages" },
};

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkStateOrdering() {
  const check = "state ordering";
  let broken = false;
  for (let i = 1; i < state.stages.length; i++) {
    const prev = state.stages[i - 1];
    const cur = state.stages[i];
    if (cur.status === "approved" && prev.status !== "approved") {
      fail(
        check,
        `stage ${cur.n} (${cur.name}) is approved but stage ${prev.n} (${prev.name}) is "${prev.status}" — a rung cannot be approved before the one it rests on`,
      );
      broken = true;
    }
  }
  if (!broken) pass(check);
}

function checkBrandConfirmed() {
  const check = "brand source confirmed";
  if (!state.brand.docPath && !state.brand.confirmedByUser) {
    warn(
      check,
      "no brand source recorded and none confirmed — every token below is unattributed",
    );
  } else if (!state.brand.confirmedByUser) {
    warn(check, `brand doc recorded (${state.brand.docPath}) but not user-confirmed`);
  } else {
    pass(check);
  }
}

function checkPageChrome(file: string, html: string) {
  const rel = `${state.layout.reference}/${file}`;
  const isPageRef = /data-page="P-\d\d"/.test(html);

  if (!/<meta\s+name="robots"\s+content="noindex,nofollow"/.test(html)) {
    fail("noindex", "missing robots noindex,nofollow", rel);
  }
  if (!/class="skip-link"/.test(html)) {
    fail("skip link", "no skip link", rel);
  }
  // init-system.ts --page writes the shell with the rail filled and leaves the
  // stage's own content as {{PLACEHOLDERS}}; one left behind is unfinished work.
  const unfilled = [...new Set(strippedOf(html).match(/\{\{[A-Z][A-Z0-9_]*\}\}/g) ?? [])];
  if (unfilled.length) {
    fail("shell placeholders", `${unfilled.length} unfilled shell placeholder(s): ${unfilled.slice(0, 6).join(", ")}`, rel);
  }
  if (!/id="content"/.test(html)) {
    fail("main landmark", 'no element with id="content"', rel);
  }

  // Page references intentionally have no rail — see html-conventions.md.
  if (!isPageRef) {
    // Scope the rail checks to the rail itself. Specimen markup legitimately
    // contains aria-current — pagination, breadcrumbs and nav molecules all
    // use it — so counting page-wide would falsely fail any stage documenting
    // those components.
    const railMatch = html.match(
      /<nav[^>]*class="stage-nav"[^>]*>([\s\S]*?)<\/nav>/,
    );
    if (!railMatch) {
      fail("rail nav", "no <nav class=\"stage-nav\"> found", rel);
    } else {
      const railTag = railMatch[0].slice(0, railMatch[0].indexOf(">") + 1);
      if (!/aria-label=/.test(railTag)) {
        fail("rail nav", "stage-nav has no aria-label", rel);
      }
      const current = (railMatch[1].match(/aria-current="page"/g) ?? []).length;
      if (current !== 1) {
        fail(
          "rail current",
          `${current} rail entries carry aria-current="page" — exactly one must, or the rail lies about where you are. Sub-stage pages (icons, 02A) mark their PARENT stage.`,
          rel,
        );
      }
    }
    // Count on the stripped page: the shell's own doc comment mentions
    // <section class="section"> and must not count as an unlabelled section.
    const live = strippedOf(html);
    const sections = (live.match(/<section[^>]*class="[^"]*\bsection\b[^"]*"/g) ?? []).length;
    const labelled = (live.match(/<section[^>]*aria-labelledby=/g) ?? []).length;
    if (sections > 0 && labelled < sections) {
      fail(
        "section labels",
        `${sections} sections, ${labelled} with aria-labelledby`,
        rel,
      );
    }
  }
}

function checkIdContiguity(stage: number, html: string, file: string, override?: { prefix: string; key: string }) {
  const spec = override ?? STAGE_IDS[stage];
  if (!spec) return;
  const check = `${spec.prefix}-nn contiguity`;
  const rel = `${state.layout.reference}/${file}`;

  // Match one-or-more digits, not two-or-more: an unpadded "A-6" must be
  // *found* in order to be reported as unpadded. Requiring two digits made the
  // padding rule unreachable, since the offending ID simply didn't match.
  const ids = extractIds(html, spec.prefix).map((id) => id.slice(spec.prefix.length + 1));

  if (!ids.length) {
    fail(check, `no ${spec.prefix}-nn specimen IDs found (on an id="", data-*="" or .card-label)`, rel);
    return;
  }

  // Order of first appearance, deduped — the page should read 01, 02, 03…
  const seen: string[] = ids;

  const nums = seen.map(Number);
  const problems: string[] = [];
  let orderProblem: string | null = null;

  for (const [i, raw] of seen.entries()) {
    if (raw.length !== 2) {
      problems.push(`${spec.prefix}-${raw} is not zero-padded to two digits`);
    }
    if (nums[i] !== i + 1 && !orderProblem) {
      // one report is enough; the rest cascade
      orderProblem = `expected ${spec.prefix}-${String(i + 1).padStart(2, "0")} at position ${i + 1}, found ${spec.prefix}-${raw}`;
    }
  }
  if (orderProblem) {
    // A migration keeps every pre-existing ID's number, so a complete set can
    // land out of page order (A-08 before A-07). Gaps and duplicates are still
    // errors: those mean an ID was lost or reused, not just placed.
    const complete = [...nums].sort((a, b) => a - b).every((n, i) => n === i + 1);
    if (legacyMigrated && complete) {
      warn(check, `complete ${spec.prefix}-01…${spec.prefix}-${String(nums.length).padStart(2, "0")} but out of page order (${orderProblem}) — allowed because STATE.json migratedFrom is "legacy"`, rel);
    } else {
      problems.push(orderProblem);
    }
  }

  const declared = override ? undefined : state.inventory[spec.key];
  if (typeof declared === "number" && declared !== seen.length) {
    problems.push(
      `STATE.json declares ${declared} ${spec.key} but the page has ${seen.length}`,
    );
  }

  if (problems.length) {
    for (const p of problems) fail(check, p, rel);
  } else {
    pass(`${check} (${seen.length} specimens)`);
  }
}

function checkRawValues() {
  const check = "no raw values outside tokens.css";
  const css = read(join(refDir, "styles.css"));
  if (!css) {
    fail(check, "styles.css not found", `${state.layout.reference}/styles.css`);
    return;
  }

  const problems: string[] = [];

  // The rule is "no raw values in COMPONENT rules", not "no hex anywhere".
  // Three things legitimately hold literals and must be exempt, or the check
  // fires on correct code:
  //   - @font-face blocks: declaring a face requires its real name
  //   - custom-property declarations (--x: #hex): that IS the token layer,
  //     wherever the project chooses to keep it
  //   - comments and documentation examples
  const body = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@font-face\s*\{[^}]*\}/g, "")
    // Drop the right-hand side of every custom-property declaration — v1 only.
    // In v2, tokens/tokens.css is the ONLY literal source, so a token defined
    // with a raw value inside styles.css is itself the defect.
    .replace(isV2 ? /(?!)/g : /--[\w-]+\s*:[^;}]*/g, "");

  // A hex surviving that is a component hardcoding a colour — a rebrand will
  // silently miss it.
  const hexes = [...new Set(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])];
  if (hexes.length) {
    problems.push(
      `${hexes.length} raw hex value(s) in component rules: ${hexes.slice(0, 6).join(", ")}${hexes.length > 6 ? "…" : ""}`,
    );
  }

  // Named font stacks consumed outside the token layer.
  const fonts = [
    ...new Set(
      (body.match(/font-family:\s*[^;{}]+/g) ?? []).filter(
        (d) => !/var\(--/.test(d),
      ),
    ),
  ];
  if (fonts.length) {
    problems.push(
      `${fonts.length} font-family declaration(s) not using a token: ${fonts.slice(0, 3).join(" | ")}`,
    );
  }

  // v2: the component (specimen) part of styles.css may hold no literal at all.
  if (isV2) {
    const specimens = specimenCss(css);
    if (specimens === null) {
      warn(check, "no /* @specimens */ marker or A-nn banner in styles.css — the strict literal check could not find the component CSS", `${state.layout.reference}/styles.css`);
    } else {
      problems.push(...strictLiteralProblems(specimens).map((p) => `component CSS: ${p}`));
    }
  }

  if (problems.length && legacyMigrated) {
    legacyLiterals.push(...problems.map((p) => `styles.css: ${p}`));
    pass(`${check} (legacy literals deferred — see warning)`);
  } else if (problems.length) for (const p of problems) fail(check, p, "styles.css");
  else pass(check);
}

/**
 * A system migrated from a legacy one carries the old CSS's literals for a
 * while. They are counted in ONE warning rather than failing per literal, so
 * the migration can land and be tokenised over time. tokens.css stays strict.
 */
const legacyMigrated = isV2 && (state as { migratedFrom?: string }).migratedFrom === "legacy";
const legacyLiterals: string[] = [];
function reportLegacyLiterals() {
  if (!legacyLiterals.length) return;
  const files = new Set(legacyLiterals.map((l) => l.split(":")[0]));
  warn(
    "legacy literals",
    `${legacyLiterals.length} literal(s) in reference CSS / inline styles across ${files.size} file(s) — allowed because STATE.json migratedFrom is "legacy"; tokenise them over time (first: ${legacyLiterals[0].slice(0, 90)})`,
  );
}

/**
 * The component half of styles.css. The chrome above it styles the VIEWER and
 * is allowed its own literals; everything after the marker is the system.
 */
function specimenCss(css: string): string | null {
  const marker = css.search(/\/\*\s*@specimens\b/);
  if (marker !== -1) return css.slice(marker);
  const banner = css.search(/\/\*\s*-+\s*[AMOTPI]-nn\b/);
  return banner === -1 ? null : css.slice(banner);
}

const COLOUR_PROPS = /^(color|background(-color)?|border(-(top|right|bottom|left|block|inline)(-start|-end)?)?(-color)?|outline(-color)?|fill|stroke|box-shadow|text-shadow|text-decoration(-color)?|caret-color|accent-color|column-rule(-color)?)$/i;
const NAMED_COLOURS = /\b(white|black|red|green|blue|yellow|orange|purple|pink|brown|gr[ae]y|navy|teal|silver|maroon|olive|lime|aqua|fuchsia|cyan|magenta|gold|indigo|violet|crimson|coral|salmon|tomato|beige|ivory|khaki|lavender|plum|tan|turquoise|orchid|chocolate|firebrick|skyblue|steelblue|slategr[ae]y|darkgr[ae]y|lightgr[ae]y|whitesmoke|gainsboro)\b/i;
const UNIT_LITERAL = /(?<![\w.#-])-?(\d*\.?\d+)(px|rem|em|ms|s|vh|vw|vmin|vmax|ch|ex|pt|deg)\b/g;

/**
 * v2 component CSS: literals of any kind (colour, length, time) are defects.
 * Allowed without a token: 0, 100%, auto, inherit, currentColor, transparent,
 * and unitless numbers (line-height 1, z-index, flex, opacity multipliers).
 */
function strictLiteralProblems(cssText: string): string[] {
  const out = new Set<string>();
  const body = cssText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@font-face\s*\{[^}]*\}/g, "");
  const blocks = [...body.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
  // A bare declaration list (style="…") has no braces.
  if (!blocks.length && /:/.test(body)) blocks.push(body);
  for (const block of blocks) {
    for (const declText of block.split(";")) {
      const m = declText.match(/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*(!important)?\s*$/);
      if (!m) continue;
      const [, prop, rawValue] = m;
      // A var() fallback is a literal too: keep the fallback text, drop the reference.
      const unwrap = (v: string): string => mapVars(v, (r) => (r.fallback ? unwrap(r.fallback) : " "));
      const v = unwrap(rawValue);
      const where = `${prop}: ${rawValue.slice(0, 60)}`;
      if (/#[0-9a-fA-F]{3,8}\b/.test(v)) out.add(`raw hex in ${where}`);
      if (/\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(/i.test(v)) out.add(`literal colour function in ${where}`);
      if (COLOUR_PROPS.test(prop) && NAMED_COLOURS.test(v)) out.add(`named colour in ${where}`);
      for (const u of v.matchAll(UNIT_LITERAL)) {
        if (Number(u[1]) !== 0) {
          out.add(`literal ${u[0].trim()} in ${where}`);
          break;
        }
      }
      const outsideMix = v.replace(/color-mix\([^)]*\)/gi, "");
      for (const pc of outsideMix.matchAll(/(?<![\w.-])(\d*\.?\d+)%/g)) {
        if (Number(pc[1]) !== 100 && Number(pc[1]) !== 0) {
          out.add(`literal ${pc[0]} in ${where}`);
          break;
        }
      }
    }
  }
  return [...out];
}

function checkInlineStyles(file: string, html: string) {
  const rel = `${state.layout.reference}/${file}`;
  if (isV2) {
    const s = strippedOf(html);
    const problems = [
      ...[...s.matchAll(/style="([^"]*)"/g)].flatMap((m) => strictLiteralProblems(m[1]).map((p) => `style="": ${p}`)),
      ...[...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].flatMap((m) => strictLiteralProblems(m[1]).map((p) => `<style>: ${p}`)),
    ];
    if (legacyMigrated) legacyLiterals.push(...problems.map((p) => `${file}: ${p}`));
    else for (const p of problems.slice(0, 5)) fail("no raw values in inline styles", p, rel);
    return;
  }
  const inline = [...strippedOf(html).matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
  const offenders = inline.filter(
    (s) => /#[0-9a-fA-F]{3,8}\b/.test(s) || /font-family/.test(s),
  );
  if (offenders.length) {
    fail(
      "no raw values in inline styles",
      `${offenders.length} inline style(s) contain a raw colour or font: ${offenders[0].slice(0, 60)}`,
      rel,
    );
  }
}

function checkFocusTreatment() {
  const check = "visible focus treatment";
  const css = read(join(refDir, "styles.css"));
  if (!css) return;
  if (!/:focus-visible/.test(css)) {
    fail(
      check,
      "no :focus-visible rule anywhere in styles.css — keyboard users cannot see where they are",
    );
    return;
  }
  // A ring that resolves to nothing passes a naive grep, so check the global
  // rule actually sets a visible property.
  const global = css.match(/(^|\})\s*:focus-visible\s*\{([^}]*)\}/);
  if (global && !/(outline|box-shadow|border)/.test(global[2])) {
    fail(check, ":focus-visible exists but sets no visible property");
  } else {
    pass(check);
  }
}

function checkTokensResolved() {
  const check = "tokens resolved";
  const css = read(tokensPath);
  if (!css) {
    fail(check, `tokens file missing at ${state.layout.tokens}`);
    return;
  }
  const unresolved = [...new Set(css.match(/\{\{[A-Z0-9_]+\}\}/g) ?? [])];
  if (unresolved.length) {
    fail(
      check,
      `${unresolved.length} placeholder(s) still unresolved: ${unresolved.slice(0, 8).join(", ")}`,
      state.layout.tokens,
    );
  } else {
    pass(check);
  }
}

function checkOrganismRecipes(html: string, file: string) {
  const check = "organism recipes";
  const rel = `${state.layout.reference}/${file}`;
  // Count on the stripped page so markup quoted in <pre>/<code> examples is not
  // counted; match the class among others (class="organism-specimen is-wide").
  const stripped = strippedOf(html);
  const specimens = (stripped.match(/class="[^"]*\borganism-specimen\b[^"]*"/g) ?? []).length;
  const recipes = (stripped.match(/class="[^"]*\borganism-recipe\b[^"]*"/g) ?? []).length;
  if (specimens === 0) {
    fail(check, "no organism specimens found", rel);
    return;
  }
  if (recipes < specimens) {
    fail(
      check,
      `${specimens} organisms but ${recipes} recipe lines — an organism that doesn't name its molecules hides the ladder`,
      rel,
    );
    return;
  }
  // A recipe must actually reference molecule IDs, not just exist.
  // The recipe text itself may wrap its IDs in <code>, so read it from the
  // page with only comments removed.
  const empty = [...html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/class="[^"]*\borganism-recipe\b[^"]*"[^>]*>([\s\S]*?)<\/p\s*>/g)]
    .filter((m) => !/\bM-\d{2}\b/.test(m[1])).length;
  if (empty) {
    fail(check, `${empty} recipe line(s) name no M-nn molecules`, rel);
  } else {
    pass(`${check} (${specimens} organisms)`);
  }
}

function checkTemplateAttrs(html: string, file: string) {
  const check = "template data attributes";
  const rel = `${state.layout.reference}/${file}`;
  const ids = [...new Set([...strippedOf(html).matchAll(/data-template="(T-\d{2})"/g)].map((m) => m[1]))];
  if (!ids.length) {
    fail(check, "no data-template attributes found", rel);
    return;
  }
  const withStatus = (strippedOf(html).match(/data-status="(built|draft|external)"/g) ?? []).length;
  if (withStatus < ids.length) {
    fail(
      check,
      `${ids.length} templates but ${withStatus} with a valid data-status (built|draft|external)`,
      rel,
    );
  } else {
    pass(`${check} (${ids.length} templates)`);
  }
}

function checkPageRefs(stage: number) {
  const check = "page references";
  const pageFiles = [...new Set(
    [...(read(join(refDir, "pages.html")) ?? "").matchAll(/href="((?:pages\/)?[A-Za-z0-9-]+\.html)"/g)].map(
      (m) => m[1],
    ),
  )].filter((f) => !STAGE_PAGES.has(f));

  if (!pageFiles.length) {
    warn(check, "pages.html links to no page reference files");
    return;
  }
  let ok = 0;
  for (const f of pageFiles) {
    const html = read(join(refDir, f));
    if (!html) {
      fail(check, `pages.html links to ${f} but the file does not exist`);
      continue;
    }
    if (!/data-page="P-\d\d"/.test(html)) {
      fail(check, `${f} has no data-page="P-nn"`, f);
      continue;
    }
    if (!/data-template="T-\d\d"/.test(html)) {
      fail(check, `${f} does not name the T-nn it instantiates`, f);
      continue;
    }
    checkPageChrome(f, html);
    checkInlineStyles(f, html);
    ok++;
  }
  if (ok === pageFiles.length) pass(`${check} (${ok} pages)`);
}

const STAGE_PAGES = new Set([
  "index.html",
  "foundations.html",
  "atoms.html",
  "icons.html",
  "molecules.html",
  "organisms.html",
  "templates.html",
  "pages.html",
  "rules.html",
]);


// ---------------------------------------------------------------------------
// v2 checks (schemaVersion 2 only)
// ---------------------------------------------------------------------------

const TIER_ORDER = ["brand", "alias", "mapped", "responsive"] as const;
const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const STATUSES = ["error", "success", "warning", "info"];

/** Mapped tokens every v2 system must define — the states and statuses components rely on. */
export const REQUIRED_MAPPED: string[] = [
  ...["action", "action-hover", "disabled", "on-action", "placeholder"].map((r) => `--color-text-${r}`),
  ...["action", "disabled", "on-action"].map((r) => `--color-icon-${r}`),
  ...["action", "action-hover", "disabled"].map((r) => `--color-surface-${r}`),
  ...["action", "action-hover", "disabled", "focus"].map((r) => `--color-border-${r}`),
  ...["text", "surface", "border"].flatMap((g) => STATUSES.map((st) => `--color-${g}-${st}`)),
];

const COMPONENT_LEVEL: Record<string, string> = { A: "atoms", M: "molecules", O: "organisms", T: "templates" };
const REQUIRED_SECTIONS = ["Purpose", "Anatomy", "Props", "States", "Accessibility", "Markup"];

let parsedTokens: ParsedTokens | null | undefined;
function tokens(): ParsedTokens | null {
  if (parsedTokens !== undefined) return parsedTokens;
  const css = read(tokensPath);
  parsedTokens = css ? parseTokensCss(css) : null;
  return parsedTokens;
}

function checkTierMarkers() {
  const check = "tier markers";
  const t = tokens();
  if (!t) return; // "tokens resolved" already reports the missing file
  const found = t.markers.map((m) => m.tier);
  const missing = TIER_ORDER.filter((x) => !found.includes(x));
  if (missing.length) {
    fail(check, `missing /* @tier ${missing.join(" */, /* @tier ")} */ in tokens.css`, state.layout.tokens);
    return;
  }
  const dupes = found.filter((x, i) => found.indexOf(x) !== i);
  if (dupes.length || found.join() !== TIER_ORDER.join()) {
    fail(check, `tiers must appear once each in order brand → alias → mapped → responsive; found ${found.join(" → ")}`, state.layout.tokens);
    return;
  }
  pass(`${check} (brand → alias → mapped → responsive)`);
}

function checkColourScales() {
  const check = "colour scales";
  const t = tokens();
  if (!t) return;
  const hues = new Map<string, Set<number>>();
  for (const tok of t.tokens.values()) {
    if (tok.tier !== "brand") continue;
    const m = tok.name.match(/^--brand-(.+)-(\d+)$/);
    if (!m) continue;
    const lit = resolveLiteral(t.tokens, tok.name) ?? "";
    // Only colour tokens are hues; the number scale and durations also end in digits.
    if (!/^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|hwb)\(.*\))$/i.test(lit)) continue;
    if (!hues.has(m[1])) hues.set(m[1], new Set());
    hues.get(m[1])!.add(Number(m[2]));
  }
  if (!hues.size) {
    fail(check, "no --brand-<hue>-<step> colour tokens found in the brand tier", state.layout.tokens);
    return;
  }
  let ok = true;
  for (const [hue, steps] of [...hues.entries()].sort()) {
    const missing = SCALE_STEPS.filter((s) => !steps.has(s));
    if (missing.length) {
      fail(check, `--brand-${hue} is missing step(s) ${missing.join(", ")} — every hue needs the full 50–900 scale`, state.layout.tokens);
      ok = false;
    }
  }
  if (ok) pass(`${check} (${hues.size} hues × 10 steps)`);
}

function checkMappedTokens() {
  const check = "mapped tokens";
  const t = tokens();
  if (!t) return;
  const missing = REQUIRED_MAPPED.filter((n) => t.tokens.get(n)?.tier !== "mapped");
  if (missing.length) {
    fail(
      check,
      `${missing.length} required mapped token(s) missing from the mapped tier: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`,
      state.layout.tokens,
    );
  } else {
    pass(`${check} (${REQUIRED_MAPPED.length} state + status tokens)`);
  }
  // Touch target: interactive components size against one token, not a literal 44px.
  if (t.tokens.get("--size-touch-target")?.tier !== "mapped") {
    warn(check, "no --size-touch-target in the mapped tier (e.g. var(--brand-size-touch) = 44px) — interactive targets have no token to size against", state.layout.tokens);
  }
}

function checkThemes() {
  const check = "theme blocks";
  const t = tokens();
  if (!t) return;
  const themes = state.themes ?? [];
  if (!themes.length) {
    warn(check, "STATE.json declares no themes — record the default theme (and any others)");
    return;
  }
  const colourTokens = [...t.tokens.values()].filter((x) => x.tier === "mapped" && !x.deprecated && x.name.startsWith("--color-") && !x.name.endsWith("-fixed"));
  let ok = true;
  for (const theme of themes.slice(1)) {
    if (!t.attrThemes.has(theme)) {
      fail(check, `STATE.json declares theme "${theme}" but tokens.css has no [data-theme="${theme}"] block`, state.layout.tokens);
      ok = false;
      continue;
    }
    if (!t.mediaThemes.has(theme)) {
      warn(check, `no @media (prefers-color-scheme: ${theme}) { :root:not([data-theme]) … } block — the OS preference is ignored`, state.layout.tokens);
    }
    const unthemed = colourTokens.filter((x) => !(theme in x.modes));
    if (unthemed.length) {
      warn(check, `${unthemed.length} mapped colour token(s) keep their ${themes[0]} value in "${theme}": ${unthemed.slice(0, 4).map((x) => x.name).join(", ")} — suffix -fixed if intended`, state.layout.tokens);
    }
  }
  const extra = [...t.attrThemes].filter((x) => !themes.includes(x));
  if (extra.length) warn(check, `tokens.css has theme block(s) not declared in STATE.json: ${extra.join(", ")}`);
  if (ok) pass(`${check} (${themes.join(", ")})`);
}

/**
 * Raw literals live only in the brand and responsive tiers. Colour, radius and
 * border width must go mapped → alias → brand without skipping; space, motion,
 * shadow and font may map straight onto brand.
 */
function checkTierChain() {
  const check = "tier chain";
  const t = tokens();
  if (!t) return;
  const problems: string[] = [];

  // A token's tier is where it is DEFINED (its :root declaration) or what its
  // prefix says — never where an override happens to sit in the file. An
  // override placed after /* @tier responsive */ is still a mapped token.
  const tierOf = (name: string): Tier | null =>
    name.startsWith("--brand-") ? "brand" : name.startsWith("--alias-") ? "alias" : (t.tokens.get(name)?.tier ?? null);
  const colourLiteral = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(|\b(white|black|red|green|blue|gr[ae]y|transparent)\b/i;
  const unitLiteral = /(?<![\w.#-])-?\d*\.?\d+(px|rem|em|ms|s|vh|vw|%|deg)\b/;

  // One definition per token. A second :root for the same name silently wins
  // the cascade and hides from every tier-scoped rule.
  const defaults = new Map<string, number[]>();
  for (const d of t.decls) if (d.mode === "default") defaults.set(d.name, [...(defaults.get(d.name) ?? []), d.line]);
  for (const [name, lines] of defaults) {
    if (lines.length > 1) problems.push(`${name} is declared in more than one :root (lines ${lines.join(", ")}) — define once, override only in theme/media blocks`);
  }

  for (const d of t.decls) {
    const tier = tierOf(d.name) ?? d.tier;
    const label = `${d.name}${d.mode !== "default" ? ` (${d.mode})` : ""}`;

    // Every reference, in every tier, must resolve — a typo is a silent fallback to nothing.
    const walk = (value: string) => {
      for (const r of scanVars(value)) {
        if (!t.tokens.has(r.name)) problems.push(`${label} references ${r.name}, which is not defined`);
        if (r.fallback !== null) {
          if (tier === "alias" || tier === "mapped") {
            const fb = mapVars(r.fallback, () => " ");
            if (colourLiteral.test(fb) || unitLiteral.test(fb)) problems.push(`${label} hides a literal in a var() fallback: ${d.value}`);
          }
          walk(r.fallback);
        }
      }
    };
    walk(d.value);

    // The @deprecated block keeps old names alive for back-compat. Each one is
    // a pointer to a live token components may use — mapped or responsive
    // (e.g. --font-size-h1: var(--text-h1-size)) — never alias/brand, never a literal.
    if (d.deprecated) {
      const ref = varOnly(d.value);
      const to = ref ? t.tokens.get(ref) : undefined;
      if (!to || (to.tier !== "mapped" && to.tier !== "responsive") || to.deprecated || /^--(brand|alias)-/.test(ref ?? "")) {
        problems.push(`${label} is deprecated and must point at a mapped or responsive token (e.g. var(--color-surface-page), var(--text-h1-size)), not ${d.value}`);
      }
      continue;
    }

    if (tier !== "alias" && tier !== "mapped") continue;
    const refs = scanVars(d.value);
    // Zero is not a design value: the reduced-motion block zeroes durations.
    if (!refs.length && /^0(ms|s|px|rem)?$/.test(d.value.trim())) continue;
    if (!refs.length) {
      problems.push(`${label} holds a literal (${d.value}) in the ${tier} tier — raw values belong in brand or responsive`);
      continue;
    }
    const leftover = mapVars(d.value, () => " ");
    if (colourLiteral.test(leftover) || unitLiteral.test(leftover)) {
      problems.push(`${label} mixes a literal into a reference in the ${tier} tier: ${d.value}`);
    }

    if (tier !== "mapped") continue;
    const kind = d.name.match(/^--(color|radius|border-width)-/)?.[1];
    if (!kind) continue;
    for (const r of refs) {
      if (!r.name.startsWith("--alias-")) {
        problems.push(`${label} must reference an --alias-* token (mapped → alias → brand), not ${r.name}`);
        continue;
      }
      if (kind === "color" && t.tokens.has(r.name) && inferType(r.name, resolveLiteral(t.tokens, r.name)) !== "color") {
        problems.push(`${label} is a colour but references ${r.name}, which is not a colour`);
      }
      if (kind === "radius" && !r.name.startsWith("--alias-radius-")) problems.push(`${label} must reference an --alias-radius-* token, not ${r.name}`);
      if (kind === "border-width" && !r.name.startsWith("--alias-border-width-")) problems.push(`${label} must reference an --alias-border-width-* token, not ${r.name}`);
    }
  }
  const unique = [...new Set(problems)];
  if (unique.length) {
    for (const p of unique.slice(0, 10)) fail(check, p, state.layout.tokens);
    if (unique.length > 10) fail(check, `…and ${unique.length - 10} more`, state.layout.tokens);
  } else pass(`${check} (literals only in brand + responsive)`);
}

function checkScaleGrid() {
  const check = "4px grid";
  const t = tokens();
  if (!t) return;
  const off: string[] = [];
  for (const tok of t.tokens.values()) {
    if (!/^--brand-scale-\d+$/.test(tok.name)) continue; // scale-round is a sentinel, not a step
    const m = tok.value.match(/^(-?[\d.]+)(px|rem)?$/);
    if (!m) continue;
    const px = m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
    if (px === 0 || px === 1 || px === 2 || px === 6) continue; // hairline, focus offset, and the contract's 150 step
    if (Math.abs(px % 4) > 1e-9) off.push(`${tok.name} (${px}px)`);
  }
  if (off.length) warn(check, `number-scale value(s) off the 4px grid: ${off.join(", ")}`, state.layout.tokens);
  else pass(check);
}

/** Drop var(<token>) from the style of any tag whose data-token names that brand/alias token. */
function withoutSwatchRefs(html: string): string {
  return html.replace(/<[a-z][^>]*\bdata-token\s*=\s*"(--(?:brand|alias)-[\w-]+)"[^>]*>/gi, (tag, token: string) =>
    tag.replace(/style\s*=\s*"([^"]*)"/, (_m, style: string) => `style="${mapVars(style, (r) => (r.name === token && !r.fallback ? " " : style.slice(r.start, r.end)))}"`),
  );
}

/** Component CSS and inline styles may use mapped/responsive tokens only. */
function checkTierDiscipline(files: string[]) {
  const check = "tier discipline";
  const problems: [string, string][] = [];
  const css = read(join(refDir, "styles.css"));
  if (css) {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const refs = [...new Set(body.match(/(?<![\w-])--(brand|alias)-[\w-]+/g) ?? [])];
    if (refs.length) problems.push([`${state.layout.reference}/styles.css`, `references ${refs.length} brand/alias token(s): ${refs.slice(0, 5).join(", ")}`]);
  }
  for (const f of files) {
    const html = read(join(refDir, f));
    if (!html) continue;
    // Swatch exemption: on foundations.html only, an element that declares
    // data-token="--brand-…|--alias-…" may show THAT token in its inline style —
    // it is how the raw scales get displayed. Nowhere else, no other token.
    const s = f === "foundations.html" ? withoutSwatchRefs(strippedOf(html)) : strippedOf(html);
    const inline = [...s.matchAll(/style="([^"]*)"/g)].map((m) => m[1]).join(" ");
    const blocks = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join(" ");
    const refs = [...new Set(`${inline} ${blocks}`.match(/(?<![\w-])--(brand|alias)-[\w-]+/g) ?? [])];
    if (refs.length) problems.push([`${state.layout.reference}/${f}`, `inline styles reference brand/alias token(s): ${refs.slice(0, 5).join(", ")}`]);
    if (/#[0-9a-fA-F]{3,8}\b/.test(blocks)) {
      const msg = "a <style> block holds a raw hex — tokens/tokens.css is the only literal source";
      if (legacyMigrated) legacyLiterals.push(`${f}: ${msg}`);
      else problems.push([`${state.layout.reference}/${f}`, msg]);
    }
  }
  if (problems.length) for (const [file, d] of problems) fail(check, `${d} — components use mapped (+ responsive) tokens only`, file);
  else pass(`${check} (mapped + responsive only)`);
}

/** Every specimen ID on the stage page has components/<level>/<ID>-*.md with the required sections. */
function checkComponentSpecs(stage: number, html: string, file: string) {
  const spec = STAGE_IDS[stage];
  if (!spec || !COMPONENT_LEVEL[spec.prefix]) return;
  const check = "component specs";
  const level = COMPONENT_LEVEL[spec.prefix];
  const dir = join(target, state.layout.components ?? "design-system/components", level);
  const relDir = `${state.layout.components ?? "design-system/components"}/${level}`;
  const ids = extractIds(html, spec.prefix).filter((id) => /-\d{2}$/.test(id));
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")) : [];
  let ok = 0;
  for (const id of ids) {
    const f = files.find((x) => x.startsWith(`${id}-`));
    if (!f) {
      fail(check, `${id} has no spec — expected ${relDir}/${id}-<slug>.md`, `${state.layout.reference}/${file}`);
      continue;
    }
    const md = read(join(dir, f)) ?? "";
    const fm = parseFrontmatter(md);
    if (!fm || fm.id !== id) {
      fail(check, `frontmatter id is "${fm?.id ?? "missing"}", expected "${id}"`, `${relDir}/${f}`);
      continue;
    }
    const missing = REQUIRED_SECTIONS.filter((h) => !new RegExp(`^#{2,3}\\s+${h}\\b`, "m").test(md));
    const optional = OPTIONAL_SECTIONS.filter(([, re]) => !re.test(md)).map(([n]) => n);
    if (optional.length) {
      warn(check, `missing section(s) ${optional.join(", ")} — keep the heading and write "n/a — <reason>" rather than dropping it`, `${relDir}/${f}`);
    }
    const composes = Array.isArray(fm.composes) ? fm.composes : fm.composes ? [fm.composes] : [];
    const unknown = composes.filter((c) => !knownIds().has(c));
    if (unknown.length) {
      fail(check, `composes: ${unknown.join(", ")} — no spec for ${unknown.length === 1 ? "that ID" : "those IDs"} in components/`, `${relDir}/${f}`);
    }
    const tokensField = Array.isArray(fm.tokens) ? fm.tokens : fm.tokens ? [fm.tokens] : [];
    const tiered = tokensField.filter((x) => /^--(brand|alias)-/.test(x));
    if (tiered.length) {
      warn(check, `tokens: lists ${tiered.join(", ")} — components use mapped/responsive tokens only`, `${relDir}/${f}`);
    }
    if (missing.length) {
      fail(check, `missing section heading(s): ${missing.join(", ")}`, `${relDir}/${f}`);
      continue;
    }
    if (unknown.length) continue;
    ok++;
  }
  if (ids.length && ok === ids.length) pass(`${check} (${ok} ${level})`);
}

/** Sections a spec should carry but may mark "n/a" — a warning, not a gate. */
const OPTIONAL_SECTIONS: [string, RegExp][] = [
  ["Sizes", /^#{2,3}\s+Sizes\b/m],
  ["Behaviour & responsive", /^#{2,3}\s+Behaviou?r\b/m],
  ["Do / Don't", /^#{2,3}\s+Do\b/m],
];

let idCache: Set<string> | null = null;
/** Every component ID that has a spec on disk (filename prefix or frontmatter id). */
function knownIds(): Set<string> {
  if (idCache) return idCache;
  idCache = new Set();
  for (const s of readSpecs(dsRoot)) {
    idCache.add(s.id);
    const fromName = s.path.split("/").pop()!.match(/^([AMOT]-\d+)/)?.[1];
    if (fromName) idCache.add(fromName);
  }
  return idCache;
}

/** Icons carry I-nn IDs on icons.html and share ONE spec: components/atoms/icons.md. */
function checkIcons(html: string, file: string) {
  if (!extractIds(html, "I").length) return;
  checkIdContiguity(2, html, file, { prefix: "I", key: "icons" });
  const rel = `${state.layout.components ?? "design-system/components"}/atoms/icons.md`;
  const md = read(join(target, rel));
  if (md === null) {
    fail("component specs", `icons.html has I-nn specimens but ${rel} is missing — the icon set shares one spec`, `${state.layout.reference}/${file}`);
    return;
  }
  const body = md.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---/, "").replace(/<!--[\s\S]*?-->/g, "");
  const missing = [
    /^#{2,3}\s+(Anatomy|Grid)\b/m.test(body) ? null : "Anatomy (or Grid)",
    /^#{2,3}\s+Accessibility\b/m.test(body) ? null : "Accessibility",
  ].filter(Boolean);
  const prose = body.replace(/^#.*$/gm, "").replace(/\{\{[A-Z0-9_]+\}\}/g, "").trim();
  if (missing.length) fail("component specs", `icons.md is missing section heading(s): ${missing.join(", ")}`, rel);
  else if (!prose) fail("component specs", "icons.md has headings but no content", rel);
  else pass("component specs (icon set)");
}

function checkReadme() {
  const check = "README index";
  const p = join(dsRoot, "README.md");
  const readme = read(p);
  if (!readme) {
    fail(check, "design-system/README.md is missing — it is the entry point every agent opens first");
    return;
  }
  const expected = expectedReadmeSections(dsRoot);
  let ok = true;
  for (const section of Object.keys(expected) as Section[]) {
    const cur = currentSection(readme.replace(/\r\n/g, "\n"), section);
    if (cur === null) {
      warn(check, `no generated ${section} section — run build-index.ts`, "design-system/README.md");
      ok = false;
    } else if (cur !== expected[section].trim()) {
      warn(check, `generated ${section} section is stale vs. the files on disk — run build-index.ts`, "design-system/README.md");
      ok = false;
    }
  }
  if (ok) pass(check);
}

function checkStageOutputs(n: number) {
  const stage = state.stages.find((s) => s.n === n);
  for (const out of stage?.outputs ?? []) {
    if (!existsSync(join(dsRoot, out))) warn("stage outputs", `design-system/${out} not found`);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function verifyStage(n: number) {
  const stage = state.stages.find((s) => s.n === n);
  if (!stage) {
    console.error(`✗ No stage ${n} in STATE.json`);
    process.exit(2);
  }

  for (const file of stage.pages) {
    const html = read(join(refDir, file));
    if (!html) {
      fail("page exists", `${file} not found`, `${state.layout.reference}/${file}`);
      continue;
    }
    checkPageChrome(file, html);
    checkInlineStyles(file, html);
    if (n in STAGE_IDS && file !== "icons.html" && file !== "rules.html") {
      checkIdContiguity(n, html, file);
      if (isV2) checkComponentSpecs(n, html, file);
    }
    if (isV2 && file === "icons.html") checkIcons(html, file);
    if (n === 4) checkOrganismRecipes(html, file);
    if (n === 5) checkTemplateAttrs(html, file);
  }

  if (n >= 1) checkTokensResolved();
  if (n >= 1) checkRawValues();
  if (n >= 2) checkFocusTreatment();
  if (n === 6) checkPageRefs(n);

  if (isV2) {
    checkReadme();
    checkStageOutputs(n);
    if (n >= 1) {
      checkTierMarkers();
      // Structure checks need real names: skip them while placeholders remain
      // ("tokens resolved" has already failed the stage in that case).
      if (!/\{\{[A-Z0-9_]+\}\}/.test(read(tokensPath) ?? "")) {
        checkColourScales();
        checkMappedTokens();
        checkTierChain();
        checkThemes();
        checkScaleGrid();
      }
      checkTierDiscipline(stage.pages);
    }
  }
}

checkStateOrdering();
checkBrandConfirmed();

const stagesToCheck = all
  ? state.stages.filter((s) => s.status !== "pending").map((s) => s.n)
  : [Number(stageArg ?? NaN)];

if (!all && Number.isNaN(stagesToCheck[0])) {
  console.error("✗ Pass --stage <n> or --all");
  process.exit(2);
}

for (const n of stagesToCheck) verifyStage(n);
reportLegacyLiterals();

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const errors = findings.filter((f) => f.level === "error");
const warns = findings.filter((f) => f.level === "warn");

if (asJson) {
  console.log(
    JSON.stringify(
      { target, schemaVersion: isV2 ? 2 : 1, stages: stagesToCheck, passed: passes, errors, warnings: warns },
      null,
      2,
    ),
  );
  process.exit(errors.length ? 1 : 0);
}

const label = all ? "all built stages" : `stage ${stagesToCheck[0]}`;
console.log(`\nVerifying ${label} in ${state.brand.name} (schema v${isV2 ? 2 : 1})\n`);

for (const p of passes) console.log(`  ✓ ${p}`);
for (const w of warns) {
  console.log(`  ⚠ ${w.check}: ${w.detail}${w.file ? `  [${w.file}]` : ""}`);
}
for (const e of errors) {
  console.log(`  ✗ ${e.check}: ${e.detail}${e.file ? `  [${e.file}]` : ""}`);
}

console.log();
if (errors.length) {
  console.log(
    `${errors.length} failure(s), ${warns.length} warning(s). Fix these before\n` +
      `showing the stage — a reviewer's attention is better spent on decisions\n` +
      `than on defects a script can find.`,
  );
  process.exit(1);
}
console.log(
  `${passes.length} check(s) passed${warns.length ? `, ${warns.length} warning(s)` : ""}.\n` +
    `Ready for visual review: interceptor open file://${refDir}/…`,
);
