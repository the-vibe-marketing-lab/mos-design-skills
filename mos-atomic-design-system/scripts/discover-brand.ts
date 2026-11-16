#!/usr/bin/env bun
/**
 * discover-brand.ts — find the brand contract before designing anything.
 *
 * Brand guidelines live in at least three different places across a
 * multi-repo workspace, because conventions drifted over time. Asking a
 * human "where are your brand guidelines?" gets you a shrug or a wrong
 * path; walking the disk gets you the answer. This script does the walk,
 * ranks what it finds, and pulls out the colour and type values so Stage 1
 * has something concrete to compile.
 *
 * Usage:
 *   bun discover-brand.ts [--target <repo>] [--siblings <dir>] [--json]
 *                         [--all] [--quiet]
 *
 *   --target    repo the design system is being built for (default: cwd)
 *   --siblings  directory of sibling repos to also search (default: target's parent)
 *   --json      emit JSON only (for programmatic use)
 *   --all       include archived/superseded docs in the output
 *
 * Exit codes: 0 found something · 3 found nothing (caller should interview)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Known conventions
// ---------------------------------------------------------------------------

/**
 * Relative paths to probe inside each candidate repo, ordered roughly by how
 * canonical the convention is. Globs are avoided deliberately: a fixed list
 * is faster, fully predictable, and easy to extend when a new convention
 * shows up. `*` matches exactly one path segment.
 */
const KNOWN_PATHS = [
  // Newest convention — domain-nested under business/
  "business/brand/guidelines/brand-guidelines.md",
  "business/brand/guidelines/brand-guidelines.html",
  "business/brand/visual-identity/visual-identity.md",
  // Flat under reference/
  "reference/brand/brand-guidelines.md",
  "reference/brand/visual-identity.md",
  "reference/brand/colour-palette.md",
  "reference/brand/typography.md",
  "reference/brand-guidelines.md",
  // marketing-os canonical schema
  "business/brand/brand.md",
  "business/brand/tone-of-voice.md",
  // Legacy pre-migration shape
  "business/core/brand/brand.md",
  "business/core/brand/visual-style.md",
  "core/brand/visual-style.md",
  // Agency / per-client shapes
  "agency/brand/*.md",
  "clients/*/business/brand-guidelines.md",
  "clients/*/business/brand.md",
  "clients/*/brand-guidelines/*.md",
  // Style-guide naming
  "docs/brand/style-guide.md",
  "docs/design-system/DESIGN-BRIEF.md",
  // A design system this skill built (v2 layout) records the brand contract here
  "design-system/brief/DESIGN-BRIEF.md",
];

/** Verbal-identity files. Not visual brand, but useful context for tone. */
const VERBAL_PATHS = [
  "reference/core/soul.md",
  "reference/core/voice.md",
  "reference/core/audience.md",
  "reference/core/offer.md",
  "business/brand/positioning/positioning.md",
];

/** Directories never worth walking. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".astro",
  ".vercel",
  ".next",
  "vendor",
  "__pycache__",
  ".venv",
  "test-results",
  "worktrees",
  ".claude",
]);

/** Path fragments that mark a doc as superseded rather than current. */
const ARCHIVE_MARKERS = ["_archive", "/archive/", "backup", ".bak", "-old"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Frontmatter {
  canonical?: boolean;
  status?: string;
  type?: string;
  version?: string;
  last_updated?: string;
  updated?: string;
  supersedes?: string;
  /** Sibling docs that carry part of the contract (colour-palette.md etc). */
  companions?: string[];
  /** Some repos already have an atomic system and record it here. */
  "atomic-design"?: string[];
  visual?: string;
}

/**
 * How much of the VISUAL contract a document actually carries. This drives
 * routing, not ranking: a positioning-only doc is the right brand source and
 * still leaves colour and type to be interviewed. Conflating "found a brand
 * doc" with "have a visual contract" is how a system ends up inventing a
 * palette and calling it the brand.
 */
type VisualContract = "full" | "partial" | "verbal-only";

interface Candidate {
  path: string;
  repo: string;
  repoName: string;
  relPath: string;
  convention: string;
  score: number;
  archived: boolean;
  /** Same repo as the target, or a repo whose name shares a brand token. */
  sameFamily: boolean;
  frontmatter: Frontmatter;
  headings: string[];
  extracted: Extracted;
  visualContract: VisualContract;
  /** Resolved absolute paths of companion docs that exist on disk. */
  companions: string[];
  /** Existing atomic-design artifacts this brand already has, if any. */
  existingAtomicSystem: string[];
  reasons: string[];
}

interface Extracted {
  colours: { hex: string; label?: string }[];
  fonts: string[];
  hasColourSection: boolean;
  hasTypeSection: boolean;
  bytes: number;
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--")
    ? argv[i + 1]
    : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);

const target = resolve(flag("target") ?? process.cwd());
const siblingsDir = resolve(flag("siblings") ?? dirname(target));
const asJson = has("json");
const includeArchived = has("all");
const quiet = has("quiet") || asJson;

const log = (msg: string) => {
  if (!quiet) console.log(msg);
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseFrontmatter(text: string): Frontmatter {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm: Record<string, unknown> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const raw = kv[2].trim();
    // Inline arrays: tags: [a, b] / companions: [x.md, y.md]
    if (raw.startsWith("[") && raw.endsWith("]")) {
      fm[kv[1]] = raw
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }
    const val = raw.replace(/^["']|["']$/g, "");
    fm[kv[1]] = val === "true" ? true : val === "false" ? false : val;
  }
  return fm as Frontmatter;
}

/**
 * Classify how much of the visual contract is present. Sections alone aren't
 * enough — a heading called "Colour" above a TODO is not a contract — so this
 * requires actual extracted values.
 */
function classifyVisual(e: Extracted): VisualContract {
  const hasColour = e.hasColourSection && e.colours.length >= 3;
  const hasType = e.hasTypeSection && e.fonts.length >= 1;
  if (hasColour && hasType) return "full";
  if (hasColour || hasType) return "partial";
  return "verbal-only";
}

/**
 * Pull the values Stage 1 actually needs. Brand docs write colour as a
 * markdown table or a definition list; either way the hex is the anchor, and
 * the nearest preceding capitalised word is almost always its name.
 */
function extract(text: string): Extracted {
  const colours: { hex: string; label?: string }[] = [];
  const seen = new Set<string>();

  // Table rows and list items containing a hex value.
  const hexLine = /^[^\n]*?#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b[^\n]*$/gm;
  for (const line of text.match(hexLine) ?? []) {
    const hexes = line.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) ?? [];
    for (const hex of hexes) {
      const key = hex.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Name = first cell of a table row, or the bolded/leading token.
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      let label: string | undefined;
      if (cells.length > 1) label = cells[0].replace(/\*\*/g, "");
      else {
        const lead = line.match(/\*\*(.+?)\*\*|^[-*]\s*([A-Z][\w ]{1,24})/);
        label = (lead?.[1] ?? lead?.[2])?.trim();
      }
      if (label && (label.startsWith("#") || label.length > 32)) label = undefined;
      colours.push({ hex: hex.toLowerCase(), label });
    }
  }

  // Font families: named faces near typography language, plus quoted stacks.
  const fonts = new Set<string>();
  const fontPatterns = [
    /\b(General Sans|Inter|JetBrains Mono|Space Grotesk|Satoshi|Geist|IBM Plex(?: \w+)?|Söhne|Suisse(?: \w+)?|Helvetica(?: Neue)?|Roboto(?: Mono)?|Open Sans|Lato|Montserrat|Poppins|Playfair Display|Fraunces|Instrument Serif|GT \w+|Neue \w+|SF Pro(?: \w+)?|Recoleta|Cabinet Grotesk)\b/g,
    /font-family:\s*([^;\n]+)/g,
  ];
  for (const re of fontPatterns) {
    for (const m of text.matchAll(re)) {
      const v = (m[1] ?? m[0]).trim();
      if (v && v.length < 80) fonts.add(v);
    }
  }

  return {
    colours,
    fonts: [...fonts],
    hasColourSection: /##+ .*(colour|color|palette)/i.test(text),
    hasTypeSection: /##+ .*(typograph|type ?scale|typeface|font)/i.test(text),
    bytes: Buffer.byteLength(text),
  };
}

function headingsOf(text: string): string[] {
  return (text.match(/^#{1,3} .+$/gm) ?? []).map((h) => h.trim()).slice(0, 40);
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/** Expand a single-segment `*` in a known path against the filesystem. */
function expand(root: string, pattern: string): string[] {
  if (!pattern.includes("*")) {
    const p = join(root, pattern);
    return existsSync(p) && statSync(p).isFile() ? [p] : [];
  }
  const segs = pattern.split("/");
  let dirs = [root];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const last = i === segs.length - 1;
    const next: string[] = [];
    for (const d of dirs) {
      if (!existsSync(d)) continue;
      if (seg === "*" || seg.includes("*")) {
        const re = new RegExp(
          `^${seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
        );
        let entries: string[];
        try {
          entries = readdirSync(d);
        } catch {
          continue;
        }
        for (const e of entries) {
          if (SKIP_DIRS.has(e) || !re.test(e)) continue;
          const p = join(d, e);
          try {
            const st = statSync(p);
            if (last ? st.isFile() : st.isDirectory()) next.push(p);
          } catch {
            /* unreadable, skip */
          }
        }
      } else {
        const p = join(d, seg);
        if (!existsSync(p)) continue;
        try {
          const st = statSync(p);
          if (last ? st.isFile() : st.isDirectory()) next.push(p);
        } catch {
          /* skip */
        }
      }
    }
    dirs = next;
  }
  return dirs;
}

function isRepo(dir: string): boolean {
  return existsSync(join(dir, ".git")) || existsSync(join(dir, "CLAUDE.md"));
}

function holdsBrandDoc(dir: string): boolean {
  return KNOWN_PATHS.some((pattern) => expand(dir, pattern).length > 0);
}

function candidateRepos(): string[] {
  const repos = new Set<string>();
  if (existsSync(target)) repos.add(target);

  if (existsSync(siblingsDir)) {
    let entries: string[] = [];
    try {
      entries = readdirSync(siblingsDir);
    } catch {
      /* unreadable */
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e) || e.startsWith(".")) continue;
      const p = join(siblingsDir, e);
      try {
        // A brand folder copied in without .git or CLAUDE.md still counts when
        // it holds a brand doc at a known convention — that IS the signal.
        if (statSync(p).isDirectory() && (isRepo(p) || holdsBrandDoc(p))) repos.add(p);
      } catch {
        /* skip */
      }
    }
  }
  return [...repos];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Split a repo name into meaningful tokens, dropping the generic suffixes
 * that every repo in a workspace shares and which therefore carry no signal.
 */
/** Frontmatter status values that mean "this is the live one". */
const CANONICAL_STATUSES = new Set(["active", "master", "current", "canonical"]);

const GENERIC_TOKENS = new Set([
  "main",
  "branch",
  "hq",
  "web",
  "website",
  "next",
  "repo",
  "skills",
  "brain",
  "app",
  "site",
  "mb",
]);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[-_.\s]+/)
    .filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t));
}

/**
 * Ranking is explicit rather than clever so a wrong pick is debuggable —
 * every candidate carries the reasons that produced its score.
 */
function score(c: Omit<Candidate, "score" | "reasons">): {
  score: number;
  reasons: string[];
} {
  let s = 0;
  const why: string[] = [];
  const add = (n: number, r: string) => {
    s += n;
    why.push(`${n > 0 ? "+" : ""}${n} ${r}`);
  };

  // Locality dominates everything. The primary question is not "is this a
  // good brand document" but "is this the RIGHT BRAND at all" — a immaculate
  // canonical doc for someone else's brand is worse than a scrappy one for
  // this brand. Weight residence far above metadata quality accordingly.
  if (c.repo === target) {
    add(150, "lives in the target repo");
  } else {
    // A site repo rarely holds its own brand doc; the brain repo next door
    // does. Shared name tokens ("tvml-website-next" ↔ "cedar-studio-brain")
    // identify which brain belongs to which build.
    const shared = nameTokens(basename(target)).filter((t) =>
      nameTokens(c.repoName).includes(t),
    );
    if (shared.length) {
      add(80, `repo name shares "${shared.join("/")}" with target`);
    } else {
      // Different brand entirely. Still worth listing — the brain may be
      // named unrecognisably — but it must never outrank a local match.
      add(-60, "different repo family to the target");
    }
  }

  if (c.frontmatter.canonical === true) add(100, "frontmatter canonical: true");
  // "master" and "canonical" mean the same thing in different repos' schemas.
  if (CANONICAL_STATUSES.has((c.frontmatter.status ?? "").toLowerCase())) {
    add(50, `frontmatter status: ${c.frontmatter.status}`);
  }
  if (c.frontmatter.type?.includes("brand")) add(30, "frontmatter type is brand");
  if (c.archived) add(-500, "archived or superseded");

  // A doc that actually specifies colour and type is worth more than a stub
  // that merely has the right filename.
  if (c.extracted.hasColourSection) add(25, "has a colour section");
  if (c.extracted.hasTypeSection) add(25, "has a typography section");
  if (c.extracted.colours.length >= 3) add(20, `${c.extracted.colours.length} colour values`);
  if (c.extracted.fonts.length >= 1) add(10, `${c.extracted.fonts.length} font families`);
  if (c.extracted.bytes < 400) add(-40, "looks like an empty stub");

  if (/brand-guidelines\.md$/.test(c.path)) add(15, "canonical filename");
  if (/\.html$/.test(c.path)) add(-20, "rendered preview, not source");

  // Recency, mildly. A 2024 doc marked canonical still beats a fresh stub.
  const d = c.frontmatter.last_updated;
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const months =
      (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months <= 6) add(15, "updated within 6 months");
    else if (months > 24) add(-10, "not updated in 2+ years");
  }

  return { score: s, reasons: why };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const repos = candidateRepos();
log(`Searching ${repos.length} repo(s) for a brand contract…`);

const candidates: Candidate[] = [];
const verbal: { path: string; repo: string }[] = [];
const skippedTemplates: { path: string; why: string }[] = [];

// ---------------------------------------------------------------------------
// Templates are never brand sources
// ---------------------------------------------------------------------------

/**
 * init-system.ts copies this skill's DESIGN-BRIEF.md template into
 * design-system/brief/ (v1: docs/design-system/). Unfilled, it has the right
 * filename, a "Colour" heading and example hexes — enough to outrank nothing at
 * all, which is exactly the wrong answer: the run would compile its own empty
 * template as "the brand". So a file with unresolved {{PLACEHOLDERS}}, or a
 * brief that still reads as the template, is reported as skipped, not ranked.
 */
const SKILL_ROOT = resolve(import.meta.dir, "..");
const PLACEHOLDER = /\{\{[A-Z][A-Z0-9_]*\}\}/;
const BRIEF_DIR = /(^|[\\/])(design-system[\\/]brief|design-system[\\/]docs|docs[\\/]design-system)[\\/]/;
let templateLines: RegExp[] | null = null;

function briefTemplateLines(): RegExp[] {
  if (templateLines) return templateLines;
  const p = join(SKILL_ROOT, "assets", "docs", "DESIGN-BRIEF.md");
  const text = existsSync(p) ? readFileSync(p, "utf8") : "";
  // Whitespace is ignored on both sides, so "- **Created:** {{DATE}}" still
  // matches a line whose placeholder was simply deleted.
  templateLines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ""))
    .filter(Boolean)
    // A line that is (nearly) all placeholder, like "{{STRATEGIC_DIRECTION}}",
    // would match any filled-in line and hide real content — drop those.
    .filter((l) => !PLACEHOLDER.test(l) || l.replace(/\{\{[A-Z0-9_]+\}\}/g, "").replace(/[|*_:`#>-]/g, "").length >= 4)
    .map((l) => new RegExp(`^${l.split(/\{\{[A-Z0-9_]+\}\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`));
  return templateLines;
}

/** A brief with fewer than three lines the template doesn't already have is still the template. */
function stillTemplate(text: string): boolean {
  const lines = briefTemplateLines();
  if (!lines.length) return false;
  const novel = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ""))
    .filter(Boolean)
    .filter((l) => !lines.some((re) => re.test(l)));
  return novel.length < 3;
}

function templateReason(path: string, text: string): string | null {
  if (resolve(path).toLowerCase().startsWith(SKILL_ROOT.toLowerCase())) return "part of this skill (a template, not a brand)";
  const ph = text.match(PLACEHOLDER);
  if (ph) return `unresolved placeholder ${ph[0]} — an unfilled template`;
  if (BRIEF_DIR.test(path) && stillTemplate(text)) return "scaffolded design brief that still matches the skill's template";
  return null;
}

for (const repo of repos) {
  for (const pattern of KNOWN_PATHS) {
    for (const path of expand(repo, pattern)) {
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      const skipWhy = templateReason(path, text);
      if (skipWhy) {
        skippedTemplates.push({ path, why: skipWhy });
        continue;
      }
      const lower = path.toLowerCase();
      const archived = ARCHIVE_MARKERS.some((m) => lower.includes(m));
      const frontmatter = parseFrontmatter(text);

      // Some brands split the contract across companion files — the master doc
      // declares them in frontmatter and the palette lives next door. Read
      // them in before classifying, or the master looks incomplete and gets
      // wrongly demoted.
      const dir = join(path, "..");
      const companions: string[] = [];
      let merged = text;
      for (const c of frontmatter.companions ?? []) {
        const p = join(dir, c);
        if (!existsSync(p)) continue;
        companions.push(p);
        try {
          merged += "\n" + readFileSync(p, "utf8");
        } catch {
          /* unreadable companion, ignore */
        }
      }

      // An existing atomic system is the single most useful thing to know
      // before building one: it means resume/extend, not start over.
      const existingAtomicSystem: string[] = [];
      for (const a of frontmatter["atomic-design"] ?? []) {
        const p = join(dir, a);
        if (existsSync(p)) existingAtomicSystem.push(p);
      }
      // Hand-built systems are not always declared in frontmatter: an
      // atomic-design/ folder of HTML next to the brand doc is the same fact.
      const adDir = join(dir, "atomic-design");
      if (existsSync(adDir) && statSync(adDir).isDirectory()) {
        for (const f of readdirSync(adDir).filter((f) => f.endsWith(".html")).sort()) {
          const p = join(adDir, f);
          if (!existingAtomicSystem.includes(p)) existingAtomicSystem.push(p);
        }
      }

      const extracted = extract(merged);
      const sharedTokens =
        repo === target
          ? ["self"]
          : nameTokens(basename(target)).filter((t) =>
              nameTokens(basename(repo)).includes(t),
            );
      const base: Omit<Candidate, "score" | "reasons"> = {
        path,
        repo,
        repoName: basename(repo),
        relPath: relative(repo, path),
        convention: pattern,
        archived,
        sameFamily: sharedTokens.length > 0,
        frontmatter,
        headings: headingsOf(text),
        extracted,
        visualContract: classifyVisual(extracted),
        companions,
        existingAtomicSystem,
      };
      candidates.push({ ...base, ...score(base) });
    }
  }
  for (const pattern of VERBAL_PATHS) {
    for (const path of expand(repo, pattern)) {
      verbal.push({ path, repo: basename(repo) });
    }
  }
}

const visible = includeArchived
  ? candidates
  : candidates.filter((c) => !c.archived);
visible.sort((a, b) => b.score - a.score);

/**
 * Partition before ranking. Brand identity is a hard boundary, not a weight:
 * once any document belonging to the target's own family exists, a document
 * from a different brand cannot be the answer no matter how well written it
 * is. Scoring alone let a polished doc from an unrelated brand win, which is
 * the worst possible failure here — it silently designs the wrong brand.
 */
const family = visible.filter((c) => c.sameFamily);

/**
 * A system this skill already built in the TARGET. v2 is one root with
 * schemaVersion 2; anything else with a STATE.json (or the v1 reference folder)
 * is v1 and is extended in place rather than rebuilt.
 */
function systemInTarget(): { kind: "v2" | "v1" | "legacy"; schemaVersion: 1 | 2 | null; path: string } | null {
  // v2 first: a design-system/STATE.json with schemaVersion 2 wins over anything else.
  const v2 = join(target, "design-system/STATE.json");
  if (existsSync(v2)) {
    try {
      const s = JSON.parse(readFileSync(v2, "utf8"));
      if ((s.schemaVersion ?? 1) >= 2) return { kind: "v2", schemaVersion: 2, path: "design-system/STATE.json" };
    } catch {
      /* unparseable: treat as v1 below */
    }
    return { kind: "v1", schemaVersion: 1, path: "design-system/STATE.json" };
  }
  for (const rel of ["docs/design-system/STATE.json", "design-system/docs/STATE.json"]) {
    if (existsSync(join(target, rel))) return { kind: "v1", schemaVersion: 1, path: rel };
  }
  // Hand-built with no STATE.json: legacy, not v1 — there is no schema to speak of.
  if (existsSync(join(target, "public/atomic-framework"))) {
    return { kind: "legacy", schemaVersion: null, path: "public/atomic-framework" };
  }
  return null;
}
const existingSystemInTarget = systemInTarget();
const foreign = visible.filter((c) => !c.sameFamily);
const best = family[0] ?? null;

const result = {
  target,
  targetName: basename(target),
  /** An atomic system already in the target: { kind: v2|v1|legacy, schemaVersion, path } or null. */
  existingSystemInTarget,
  reposSearched: repos.length,
  found: visible.length,
  /** null when nothing in the target's own family was found. */
  best,
  /** Set when only other brands' docs exist — caller must interview. */
  noFamilyMatch: best === null && foreign.length > 0,
  candidates: family,
  otherBrands: foreign,
  archivedCount: candidates.filter((c) => c.archived).length,
  /** Files at a known path that were NOT ranked because they are templates. */
  skippedTemplates,
  verbalIdentity: verbal.filter(
    (v) =>
      v.repo === basename(target) ||
      nameTokens(basename(target)).some((t) => nameTokens(v.repo).includes(t)),
  ),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(best ? 0 : 3);
}

if (existingSystemInTarget) {
  console.log(
    existingSystemInTarget.kind === "v2"
      ? `\n⚠ Atomic system exists in the target (v2): ${existingSystemInTarget.path} — resume it, don't restart.`
      : existingSystemInTarget.kind === "v1"
        ? `\n⚠ Atomic system exists in the target (v1): ${existingSystemInTarget.path} — extend it in place, in its v1 layout.`
        : `\n⚠ Legacy (hand-built) system in the target: ${existingSystemInTarget.path} — extend it in place, in its own conventions.`,
  );
}

if (skippedTemplates.length) {
  console.log(`\n  Skipped ${skippedTemplates.length} template file(s) — never a brand source:`);
  for (const s of skippedTemplates.slice(0, 4)) console.log(`    ${relative(target, s.path) || s.path}: ${s.why}`);
}

if (!best) {
  console.log(
    `\n✗ No brand contract found for "${basename(target)}" in ${repos.length} repo(s).\n` +
      `  Ask whether one exists somewhere this script doesn't know to look —\n` +
      `  an unfamiliar filename is far more likely than no document at all.`,
  );
  if (foreign.length) {
    console.log(
      `\n  ${foreign.length} brand doc(s) exist for OTHER brands. Do not use them:\n` +
        `  borrowing another brand's palette is how two products end up looking\n` +
        `  like the same product.`,
    );
    for (const c of foreign.slice(0, 4)) {
      console.log(`    ${c.repoName}: ${c.relPath}`);
    }
  }
  if (result.verbalIdentity.length) {
    console.log(
      `\n  Verbal identity IS available for this brand (${result.verbalIdentity.length} file(s)) —\n` +
        `  good for tone, but it carries no colour or type:`,
    );
    for (const v of result.verbalIdentity.slice(0, 6)) {
      console.log(`    ${v.repo}: ${v.path}`);
    }
  }
  process.exit(3);
}

console.log(
  `\n✓ ${family.length} candidate(s) for "${basename(target)}". Best match first.\n`,
);
for (const [i, c] of family.slice(0, 6).entries()) {
  const mark = i === 0 ? "▶" : " ";
  console.log(`${mark} [${c.score}] ${c.repoName} — ${c.relPath}`);
  const fm = c.frontmatter;
  const fmBits = [
    fm.canonical === true ? "canonical" : null,
    fm.status ? `status=${fm.status}` : null,
    fm.version ? `v${fm.version}` : null,
    fm.last_updated ?? null,
  ].filter(Boolean);
  if (fmBits.length) console.log(`    ${fmBits.join(" · ")}`);
  const verdict = {
    full: "visual contract: FULL",
    partial: "visual contract: PARTIAL",
    "verbal-only": "visual contract: NONE (verbal only)",
  }[c.visualContract];
  console.log(
    `    ${c.extracted.colours.length} colours · ${c.extracted.fonts.length} fonts · ${(c.extracted.bytes / 1024).toFixed(1)} KB · ${verdict}`,
  );
  if (c.companions.length) {
    console.log(`    companions merged: ${c.companions.length}`);
  }
  if (c.existingAtomicSystem.length) {
    console.log(
      `    ⚠ already has ${c.existingAtomicSystem.length} atomic-design artifact(s) — extend, don't restart`,
    );
  }
  if (i === 0) {
    console.log(`    why: ${c.reasons.join(", ")}`);
    if (c.extracted.colours.length) {
      const preview = c.extracted.colours
        .slice(0, 6)
        .map((x) => (x.label ? `${x.label} ${x.hex}` : x.hex))
        .join(" · ");
      console.log(`    colours: ${preview}`);
    }
    if (c.extracted.fonts.length) {
      console.log(`    fonts: ${c.extracted.fonts.slice(0, 4).join(" · ")}`);
    }
  }
  console.log();
}

if (result.archivedCount && !includeArchived) {
  console.log(
    `  (${result.archivedCount} archived/superseded doc(s) hidden — pass --all to see them)`,
  );
}
if (foreign.length) {
  console.log(
    `  (${foreign.length} doc(s) for other brands excluded — different brand, not a candidate)`,
  );
}
if (result.verbalIdentity.length) {
  console.log(
    `  Verbal identity also available: ${result.verbalIdentity.length} file(s).`,
  );
}

// The routing signal. "Found a brand doc" and "have a visual contract" are
// different facts, and only the second one lets Stage 1 compile tokens.
if (best.visualContract !== "full") {
  const missing =
    best.visualContract === "verbal-only"
      ? "colour AND typography"
      : best.extracted.colours.length >= 3
        ? "typography"
        : "colour";
  console.log(
    `\n⚠ This document carries no ${missing} contract.\n` +
      `  It is still the right brand source — use it for positioning and principles —\n` +
      `  but ${missing} must be interviewed or derived from inspiration snapshots,\n` +
      `  then written BACK to the brand doc so the next run finds it.`,
  );
}
if (best.existingAtomicSystem.length) {
  console.log(
    `\n⚠ This brand already has ${best.existingAtomicSystem.length} atomic-design artifact(s):`,
  );
  for (const p of best.existingAtomicSystem) console.log(`    ${p}`);
  console.log(
    `  Read them before building. Extending an approved system beats replacing it.`,
  );
}

console.log(
  `\nConfirm the pick with the user before compiling tokens. A wrong brand source\n` +
    `is the one error that invalidates every stage downstream.`,
);
