#!/usr/bin/env bun
/**
 * init-system.ts — scaffold the design system into a target repo.
 *
 * v2 (schemaVersion 2, the default): everything lives under ONE root,
 * <repo>/design-system/, so an agent opens design-system/README.md and can
 * reach every other file by a predictable path. See
 * references/output-structure.md for the contract.
 *
 * Creates the directory shape, copies the token skeleton, the chrome stylesheet
 * and the doc templates, and writes STATE.json. It deliberately does NOT
 * generate any stage page content: those are judgement, and inventing them here
 * would let the scaffold pre-empt decisions the review gates exist to make.
 *
 * Existing non-v2 systems are never scaffolded over. Evidence of one:
 *   - in the target: docs/design-system/STATE.json, design-system/docs/STATE.json,
 *     public/atomic-framework/*.html, or a design-system/STATE.json without
 *     schemaVersion 2
 *   - in a sibling brand repo: discover-brand.ts reports existingAtomicSystem
 *     for this brand (e.g. hand-built stage pages next to the brand doc)
 * A system with a STATE.json is "v1"; a hand-built one without (stage pages in
 * public/atomic-framework/, or next to the brand doc in a sibling repo) is
 * "legacy". Either way it is extended in place, in its own conventions, and
 * nothing is scaffolded. --schema 1 scaffolds the original v1 layout in the
 * target for extending such a system; verify-stage.ts --legacy <dir> checks a
 * legacy one. Migrating to v2 is a deliberate, human-reviewed step: --migrate
 * prints the v1 → v2 path mapping and moves nothing.
 *
 * Usage:
 *   bun init-system.ts --target <repo> [--brand-name "..."] [--themes light,dark]
 *                      [--schema 1|2] [--migrate [--scaffold]] [--siblings <dir>] [--no-discover]
 *                      [--force] [--json]
 *   bun init-system.ts --target <repo> --page <file>[,<file>…]|all [--force]
 *
 *   --schema 1      scaffold the v1 layout (only for extending an existing v1/legacy
 *                   system; refused when a v2 system exists)
 *   --migrate       print the → v2 path mapping for a v1/legacy system; moves nothing
 *   --migrate --scaffold   also create the empty v2 tree alongside (never overwrites)
 *   --siblings      passed to discover-brand.ts (default: its own default)
 *   --no-discover   skip the sibling-repo check (tests, offline)
 *   --page          write stage page(s) (index.html, atoms.html, icons.html …) from
 *                   assets/shell.html with the rail nav emitted whole — aria-current
 *                   on exactly one entry — and brand/number/title/footer filled.
 *                   The stage's own content stays as {{PLACEHOLDERS}} to fill.
 *
 * Exit: 0 ok (including "v1 system found") · 1 failure · 2 cannot run
 * Safe to re-run: existing files are left alone unless --force is passed.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(HERE, "..", "assets");

const argv = process.argv.slice(2);
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--")
    ? argv[i + 1]
    : undefined;
};
const has = (n: string) => argv.includes(`--${n}`);

const target = resolve(flag("target") ?? process.cwd());
// --migrate never overwrites: the v2 tree is scaffolded alongside, not over.
const force = has("force") && !has("migrate");
const asJson = has("json");
const migrate = has("migrate");
const schema = Number(flag("schema") ?? "2");

if (!existsSync(target)) {
  console.error(`✗ Target does not exist: ${target}`);
  process.exit(2);
}
if (schema !== 1 && schema !== 2) {
  console.error(`✗ --schema must be 1 or 2`);
  process.exit(2);
}

const brandName = flag("brand-name") ?? basename(target);
const themes = (flag("themes") ?? "light,dark")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const ROOT = "design-system";

// ---------------------------------------------------------------------------
// Shared scaffold helpers
// ---------------------------------------------------------------------------

const created: string[] = [];
const skipped: string[] = [];

const ensureDir = (rel: string) => {
  const p = join(target, rel);
  if (!existsSync(p)) {
    mkdirSync(p, { recursive: true });
    created.push(`${rel}/`);
  }
};

const write = (rel: string, content: string) => {
  const p = join(target, rel);
  if (existsSync(p) && !force) {
    skipped.push(rel);
    return;
  }
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  created.push(rel);
};

const copy = (from: string, rel: string) => {
  const p = join(target, rel);
  if (existsSync(p) && !force) {
    skipped.push(rel);
    return;
  }
  mkdirSync(dirname(p), { recursive: true });
  copyFileSync(from, p);
  created.push(rel);
};

/** Copy a doc template when the skill ships one, else write the fallback. */
const template = (name: string, rel: string, fallback: string, fill: Record<string, string> = {}) => {
  const src = join(ASSETS, "docs", name);
  let text = existsSync(src) ? readFileSync(src, "utf8") : fallback;
  for (const [k, v] of Object.entries(fill)) text = text.replaceAll(`{{${k}}}`, v);
  write(rel, text);
};

const STAGE_NAMES = ["Discover", "Foundations", "Atoms", "Molecules", "Organisms", "Templates", "Pages"];
const STAGE_PAGES = [
  ["index.html"],
  ["foundations.html"],
  ["atoms.html", "icons.html"],
  ["molecules.html"],
  ["organisms.html"],
  ["templates.html"],
  ["pages.html", "rules.html"],
];

// ---------------------------------------------------------------------------
// Existing-system detection — never scaffold v2 over a non-v2 system
// ---------------------------------------------------------------------------

interface V1System {
  /** v1 = built by this skill (has STATE.json); legacy = hand-built, no STATE.json. */
  kind: "v1" | "legacy";
  signals: string[];
  statePath: string | null;
  layout: { docs: string; reference: string; tokens: string } | null;
}

function detectV1InTarget(): V1System | null {
  const signals: string[] = [];
  let statePath: string | null = null;

  for (const rel of ["docs/design-system/STATE.json", "design-system/docs/STATE.json"]) {
    if (existsSync(join(target, rel))) {
      signals.push(rel);
      statePath ??= rel;
    }
  }
  const legacyRef = join(target, "public/atomic-framework");
  if (existsSync(legacyRef)) {
    const html = readdirSync(legacyRef).filter((f) => f.endsWith(".html"));
    if (html.length) signals.push(`public/atomic-framework/ (${html.length} html)`);
  }
  const rootState = join(target, ROOT, "STATE.json");
  if (existsSync(rootState)) {
    // Only reached when readV2State() said it is not v2.
    try {
      JSON.parse(readFileSync(rootState, "utf8"));
      signals.push(`${ROOT}/STATE.json (no schemaVersion 2)`);
      statePath ??= `${ROOT}/STATE.json`;
    } catch {
      signals.push(`${ROOT}/STATE.json (unparseable)`);
    }
  }
  if (!signals.length) return null;

  let layout: V1System["layout"] = null;
  if (statePath) {
    try {
      layout = JSON.parse(readFileSync(join(target, statePath), "utf8")).layout ?? null;
    } catch {
      /* fall through to defaults */
    }
  }
  return { kind: statePath ? "v1" : "legacy", signals, statePath, layout };
}

/**
 * Ask discover-brand whether THIS brand already has atomic-design artifacts
 * somewhere else — typically hand-built stage pages next to the brand doc in a
 * sibling brain repo, with an empty site repo as the target.
 */
function detectSiblingSystem(): string[] {
  if (has("no-discover")) return [];
  const args = [process.execPath, join(HERE, "discover-brand.ts"), "--target", target, "--json"];
  const siblings = flag("siblings");
  if (siblings) args.push("--siblings", resolve(siblings));
  const res = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });
  try {
    const out = JSON.parse(res.stdout.toString());
    const paths = new Set<string>();
    for (const c of [out.best, ...(out.candidates ?? [])]) {
      for (const p of c?.existingAtomicSystem ?? []) paths.add(p);
    }
    return [...paths].sort();
  } catch {
    return []; // discovery is advisory; its absence must not block a scaffold
  }
}

function migrationPlan(v1: V1System): [string, string, string][] {
  const docs = v1.layout?.docs ?? "docs/design-system";
  const ref = v1.layout?.reference ?? "public/atomic-framework";
  const tokens = v1.layout?.tokens ?? "src/styles/tokens.css";
  const refAbs = join(target, ref);
  const pageRefs = existsSync(refAbs)
    ? readdirSync(refAbs).filter((f) => {
        if (!f.endsWith(".html")) return false;
        try {
          return /data-page="P-\d\d"/.test(readFileSync(join(refAbs, f), "utf8"));
        } catch {
          return false;
        }
      })
    : [];
  const rows: [string, string, string][] = [
    [`${docs}/STATE.json`, `${ROOT}/STATE.json`, "add schemaVersion 2, version, themes; rewrite layout + stage map"],
    [`${docs}/DESIGN-BRIEF.md`, `${ROOT}/brief/DESIGN-BRIEF.md`, "move"],
    [`${docs}/RULES.md`, `${ROOT}/rules/RULES.md`, "move"],
    [`${docs}/COMPONENT-MAP.md`, `${ROOT}/components/<level>/<ID>-<slug>.md`, "split: one spec per ID; INDEX.md is regenerated by build-index.ts"],
    [tokens, `${ROOT}/tokens/tokens.css`, "re-tier into brand/alias/mapped/responsive; keep v1 names as deprecated aliases until the site stops using them"],
    [`${ref}/styles.css`, `${ROOT}/reference/styles.css`, "@import ../tokens/tokens.css; swap legacy token refs for mapped tokens"],
    [`${ref}/<stage>.html`, `${ROOT}/reference/<stage>.html`, "move"],
    [`${ref}/snapshots/`, `${ROOT}/reference/snapshots/`, "move (if outside the reference dir already)"],
    ...pageRefs.map(
      (f): [string, string, string] => [
        `${ref}/${f}`,
        `${ROOT}/reference/pages/<P-nn>-${f.replace(/\.html$/, "")}.html`,
        "move; stylesheet href becomes ../styles.css",
      ],
    ),
    ["(new)", `${ROOT}/README.md, CHANGELOG.md, foundations/FOUNDATIONS.md`, "write from the skill templates"],
    ["(generated)", `${ROOT}/tokens/tokens.json, tokens/TOKENS.md, components/INDEX.md`, "run build-index.ts"],
  ];
  // Only list sources that exist: a legacy system has no STATE.json, brief or
  // component map, and a plan naming them would send someone looking for ghosts.
  return rows.filter(([from]) => from.startsWith("(") || from.includes("<") || existsSync(join(target, from)));
}

/** A v2 system (schemaVersion 2) in the target — checked before anything else. */
function readV2State(): Record<string, unknown> | null {
  const p = join(target, ROOT, "STATE.json");
  if (!existsSync(p)) return null;
  try {
    const s = JSON.parse(readFileSync(p, "utf8"));
    return (s.schemaVersion ?? 1) >= 2 ? s : null;
  } catch {
    return null;
  }
}

const v2State = readV2State();
const migrateScaffold = migrate && has("scaffold");

// ---------------------------------------------------------------------------
// --page — write stage pages from assets/shell.html with the rail filled in
// ---------------------------------------------------------------------------

/** Rail order: file, number, label. icons.html is a sub-page of Atoms (02A). */
const RAIL: [string, string, string][] = [
  ["index.html", "00", "System map"],
  ["foundations.html", "01", "Foundations"],
  ["atoms.html", "02", "Atoms"],
  ["molecules.html", "03", "Molecules"],
  ["organisms.html", "04", "Organisms"],
  ["templates.html", "05", "Templates"],
  ["pages.html", "06", "Pages"],
  ["rules.html", "07", "Rules"],
];
const SUB_PAGES: Record<string, { parent: string; num: string; title: string }> = {
  "icons.html": { parent: "atoms.html", num: "02A", title: "Icons" },
};

/**
 * One stage page: the shell with the rail emitted whole (aria-current on exactly
 * one entry — the parent stage for a sub-page), the brand, stage number, title,
 * footer link and version filled. What the stage itself decides stays as
 * {{PLACEHOLDERS}} — {{LANG}}, {{BG_HEX}}, {{STAGE_INTRO}}, {{STATUS}},
 * {{SECTIONS}} — and verify-stage.ts fails a page that still has any.
 */
function renderStagePage(file: string, brand: string, version: string): string {
  const sub = SUB_PAGES[file];
  const current = sub?.parent ?? file;
  const idx = RAIL.findIndex(([f]) => f === current);
  if (idx === -1) throw new Error(`not a stage page: ${file} (expected one of ${[...RAIL.map(([f]) => f), ...Object.keys(SUB_PAGES)].join(", ")})`);
  const [, num, title] = sub ? [file, sub.num, sub.title] : RAIL[idx];
  // A sub-page's "next" is the stage after its parent; the last page loops home.
  const next = RAIL[idx + 1] ?? RAIL[0];
  const nav = RAIL.map(
    ([f, n, l]) =>
      `            <a href="${f}"${f === current ? ' aria-current="page"' : ""}><span class="number">${n}</span><span>${l}</span></a>`,
  ).join("\n");
  const monogram = brand.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || brand.slice(0, 2);
  let shell = readFileSync(join(ASSETS, "shell.html"), "utf8");
  shell = shell.replace(
    /<!--[\s\S]*?-->/,
    `<!--\n  ${num} · ${title} — written by init-system.ts --page from assets/shell.html.\n  Still to fill: {{LANG}} {{BG_HEX}} {{STAGE_INTRO}} {{STATUS}} {{SECTIONS}}.\n  The rail below is generated; re-run --page --force rather than hand-editing\n  it in one page, or the set desyncs. noindex is not optional.\n-->`,
  );
  shell = shell.replace(/(<nav class="stage-nav"[^>]*>)[\s\S]*?(\s*<\/nav>)/, `$1\n${nav}$2`);
  const fill: Record<string, string> = {
    BRAND_NAME: brand,
    WORDMARK: brand,
    MONOGRAM: monogram,
    STAGE_NUM: num,
    STAGE_TITLE: title,
    NEXT_HREF: next[0],
    NEXT_LABEL: next[2],
    VERSION: `v${version}`,
  };
  for (const [k, v] of Object.entries(fill)) shell = shell.replaceAll(`{{${k}}}`, v);
  return shell;
}

const pageArg = flag("page");
if (pageArg) {
  const v1Here = v2State ? null : detectV1InTarget();
  const reference = v2State
    ? ((v2State.layout as { reference?: string } | undefined)?.reference ?? `${ROOT}/reference`)
    : v1Here?.layout?.reference;
  if (!reference) {
    console.error(`✗ --page needs an existing system: no design-system/STATE.json (or v1 STATE.json with a layout) under ${target}. Scaffold first.`);
    process.exit(2);
  }
  const statePath = v2State ? join(target, ROOT, "STATE.json") : join(target, v1Here!.statePath!);
  const st = JSON.parse(readFileSync(statePath, "utf8"));
  const brand = flag("brand-name") ?? st.brand?.name ?? basename(target);
  const version = typeof st.version === "string" ? st.version : "0.0.0";
  const files = pageArg === "all" ? [...RAIL.map(([f]) => f), ...Object.keys(SUB_PAGES)] : pageArg.split(",").map((f) => f.trim()).filter(Boolean);
  for (const f of files) {
    try {
      write(`${reference}/${f}`, renderStagePage(f, brand, version));
    } catch (e) {
      console.error(`✗ ${(e as Error).message}`);
      process.exit(2);
    }
  }
  if (asJson) console.log(JSON.stringify({ target, reference, created, skipped }, null, 2));
  else {
    for (const c of created) console.log(`  + ${c}`);
    for (const s of skipped) console.log(`  · ${s} (exists — pass --force to regenerate the shell)`);
  }
  process.exit(0);
}

if (v2State) {
  if (schema === 1) {
    console.error(`✗ ${ROOT}/STATE.json is already schemaVersion 2 — refusing --schema 1. A v2 system is never downgraded.`);
    process.exit(1);
  }
  if (migrate) {
    console.log(`• ${ROOT}/ is already a v2 system — nothing to migrate.`);
    process.exit(0);
  }
}

const v1 = v2State ? null : detectV1InTarget();

if (v1 && schema === 1) {
  // Extending a v1/legacy system: fill in whatever its layout is missing, keep the rest.
  finishV1(scaffoldV1(v1.layout ?? undefined), `extending the ${v1.kind} system already in this target`);
}

if (v1 && !migrateScaffold) {
  const plan = migrate ? migrationPlan(v1) : null;
  if (asJson) {
    console.log(JSON.stringify({ target, kind: v1.kind, where: "target", signals: v1.signals, created: [], migrationPlan: plan }, null, 2));
    process.exit(0);
  }
  console.log(
    v1.kind === "v1"
      ? `\n• v1 system found — extend in place. Nothing scaffolded.`
      : `\n• legacy system — extend in place. Nothing scaffolded (hand-built, no STATE.json).`,
  );
  for (const s of v1.signals) console.log(`    ${s}`);
  if (v1.kind === "legacy") {
    const dir = join(target, v1.layout?.reference ?? "public/atomic-framework");
    console.log(`  Check it with: verify-stage.ts --legacy ${dir}`);
  }
  if (plan) printPlan(plan);
  else if (v1.kind === "v1") {
    console.log(`\n  Keep building in the v1 layout. Pass --migrate to print the v1 → v2\n  mapping if the user asks to migrate.`);
  } else {
    console.log(`\n  Keep extending it in its own conventions. Pass --migrate to print the\n  path mapping to v2 if the user asks to migrate.`);
  }
  process.exit(0);
}

if (migrate && !v1) {
  console.log(`• No v1 or legacy system found under ${target} — nothing to migrate.`);
  process.exit(0);
}

function printPlan(plan: [string, string, string][]) {
  console.log(`\n  → v2 path mapping (plan only — nothing was moved):\n`);
  for (const [from, to, how] of plan) console.log(`    ${from}\n      → ${to}\n        ${how}`);
  console.log(
    `\n  Moving is a deliberate, human-reviewed step: agree the plan, move with git mv\n` +
      `  so history follows, then re-run verify-stage.ts on every approved stage.\n` +
      `  --migrate --scaffold creates the empty v2 tree alongside to move into.`,
  );
}

if (migrateScaffold && v1) {
  console.log(`\n• ${v1.kind} system found — scaffolding the v2 tree ALONGSIDE it (--migrate --scaffold).`);
  console.log(`  Nothing is moved and no existing file is overwritten.`);
  printPlan(migrationPlan(v1));
}

if (schema === 2 && !v2State && !v1) {
  const sibling = detectSiblingSystem();
  if (sibling.length) {
    if (asJson) {
      console.log(JSON.stringify({ target, kind: "legacy", where: "sibling", signals: sibling, created: [] }, null, 2));
      process.exit(0);
    }
    console.log(`\n• legacy system — extend in place. This brand already has atomic-design artifacts:`);
    for (const p of sibling) console.log(`    ${p}`);
    console.log(
      `\n  Nothing scaffolded. Only systems the user has asked to migrate move to v2;\n` +
        `  everything else is extended in its own conventions. Read those artifacts\n` +
        `  (verify-stage.ts --legacy <their folder> checks them), then re-run with\n` +
        `  --schema 1 if the extension needs the v1 layout in this target.`,
    );
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// v1 scaffold (--schema 1) — the original layout, kept for extending v1 systems
// ---------------------------------------------------------------------------

function scaffoldV1(existing?: { docs: string; reference: string; tokens: string }) {
  const isSiteRepo = existsSync(join(target, "public")) || existsSync(join(target, "src"));
  const layout =
    existing ??
    (isSiteRepo
      ? { docs: "docs/design-system", reference: "public/atomic-framework", tokens: "src/styles/tokens.css" }
      : { docs: "design-system/docs", reference: "design-system/reference", tokens: "design-system/reference/tokens.css" });

  ensureDir(layout.docs);
  ensureDir(layout.reference);
  ensureDir(`${layout.reference}/snapshots`);
  copy(join(ASSETS, "v1", "tokens.css"), layout.tokens);

  const chrome = readFileSync(join(ASSETS, "v1", "styles-base.css"), "utf8");
  const tokensRel = layout.tokens.startsWith(layout.reference)
    ? `./${basename(layout.tokens)}`
    : `${layout.reference.split("/").filter(Boolean).map(() => "..").join("/")}/${layout.tokens}`;
  write(
    `${layout.reference}/styles.css`,
    `/* ${brandName} — design system reference stylesheet.
   Order mirrors the ladder: chrome, then A-nn, M-nn, O-nn, T-nn, P-nn under
   banner comments. Append; never interleave. */

@import url("${tokensRel}");

${chrome}`,
  );
  for (const doc of ["DESIGN-BRIEF.md", "COMPONENT-MAP.md", "RULES.md"]) {
    template(doc, `${layout.docs}/${doc}`, `# ${brandName} — ${doc.replace(/\.md$/, "")}\n`);
  }
  write(
    `${layout.docs}/STATE.json`,
    JSON.stringify(
      {
        version: 1,
        brand: { name: brandName, docPath: null, visualContract: null, confirmedByUser: false },
        layout,
        inventory: { atoms: null, molecules: null, organisms: null, templates: null, pages: null },
        stages: STAGE_NAMES.map((name, n) => ({
          n,
          name,
          pages: STAGE_PAGES[n],
          status: "pending",
          approvedAt: null,
          notes: [],
        })),
      },
      null,
      2,
    ) + "\n",
  );
  return layout;
}

function finishV1(layout: { docs: string; reference: string; tokens: string }, why: string): never {
  if (asJson) {
    console.log(JSON.stringify({ target, brandName, schemaVersion: 1, layout, created, skipped }, null, 2));
    process.exit(0);
  }
  console.log(`\n✓ Scaffolded "${brandName}" in the v1 layout (--schema 1) into ${target}`);
  console.log(
    `  why: ${why}. --schema 1 keeps the conventions someone already\n` +
      `  approved; new brands get v2.`,
  );
  console.log(`  docs ${layout.docs} · reference ${layout.reference} · tokens ${layout.tokens}`);
  for (const c of created) console.log(`    + ${c}`);
  for (const s of skipped) console.log(`    · ${s} (left alone)`);
  process.exit(0);
}

if (schema === 1) finishV1(scaffoldV1(), "this brand's existing system is v1 or legacy");

// ---------------------------------------------------------------------------
// v2 scaffold
// ---------------------------------------------------------------------------

const layout = {
  root: ROOT,
  brief: `${ROOT}/brief`,
  tokens: `${ROOT}/tokens/tokens.css`,
  foundations: `${ROOT}/foundations`,
  components: `${ROOT}/components`,
  rules: `${ROOT}/rules`,
  reference: `${ROOT}/reference`,
};

/** Outputs each stage owns, relative to design-system/. Pages are relative to reference/. */
const STAGE_OUTPUTS = [
  ["brief/DESIGN-BRIEF.md", "README.md"],
  ["tokens/tokens.css", "tokens/tokens.json", "tokens/TOKENS.md", "foundations/FOUNDATIONS.md"],
  ["components/atoms/", "components/INDEX.md"],
  ["components/molecules/", "components/INDEX.md"],
  ["components/organisms/", "components/INDEX.md"],
  ["components/templates/", "components/INDEX.md"],
  ["reference/pages/", "rules/RULES.md"],
];

const V2_DIRS = [
  ROOT,
  layout.brief,
  `${ROOT}/tokens`,
  layout.foundations,
  `${layout.components}/atoms`,
  `${layout.components}/molecules`,
  `${layout.components}/organisms`,
  `${layout.components}/templates`,
  layout.rules,
  layout.reference,
  `${layout.reference}/pages`,
  `${layout.reference}/snapshots`,
];
for (const d of V2_DIRS) ensureDir(d);

// Tokens: the skeleton, placeholders intact. Stage 1 resolves them.
copy(join(ASSETS, "tokens.css"), layout.tokens);

// The reference stylesheet starts as chrome only. Specimen styles get appended
// under banner comments as each stage is built — see html-conventions.md.
const chrome = readFileSync(join(ASSETS, "styles-base.css"), "utf8");
write(
  `${layout.reference}/styles.css`,
  `/* ${brandName} — design system reference stylesheet.
   Mapped (+ responsive) tokens only; never --brand-* or --alias-*.
   Order mirrors the ladder: chrome, then A-nn, M-nn, O-nn, T-nn, P-nn under
   banner comments. Append; never interleave. */

@import url("../tokens/tokens.css");

${chrome.replace(/\s*$/, "")}

/* @specimens — everything below is component CSS. Mapped (+ responsive)
   tokens only and no literals at all (no hex, px, rem, ms): verify-stage.ts
   enforces it. The chrome above styles the viewer and is exempt. */
`,
);

// Doc templates. Only the facts known now are filled; the rest stay as
// placeholders for the stage that owns them.
const known = { BRAND_NAME: brandName, VERSION: "0.0.0", THEMES: themes.join(", ") };
template("DESIGN-BRIEF.md", `${layout.brief}/DESIGN-BRIEF.md`, `# ${brandName} — design brief\n`, known);
template("RULES.md", `${layout.rules}/RULES.md`, `# ${brandName} — design system rules\n`, known);
template("FOUNDATIONS.md", `${layout.foundations}/FOUNDATIONS.md`, `# ${brandName} — foundations\n`, known);
template(
  "CHANGELOG.md",
  `${ROOT}/CHANGELOG.md`,
  `# Changelog\n\nOne entry per approved stage or publish. Semver: 0.x until Pages is approved.\n`,
  known,
);
template(
  "README.md",
  `${ROOT}/README.md`,
  `# ${brandName} design system\n\nSTART HERE. Tokens: import \`design-system/tokens/tokens.css\`.\n\n` +
    `## Files\n\n<!-- BEGIN GENERATED: file-index — scripts/build-index.ts, do not hand-edit -->\n<!-- END GENERATED: file-index -->\n\n` +
    `## Inventory\n\n<!-- BEGIN GENERATED: inventory — scripts/build-index.ts, do not hand-edit -->\n<!-- END GENERATED: inventory -->\n`,
  known,
);

write(
  `${ROOT}/STATE.json`,
  JSON.stringify(
    {
      schemaVersion: 2,
      // Semver of the system itself: each approved stage bumps it (0.x until
      // Pages is approved, then 1.0.0) and appends CHANGELOG.md.
      version: "0.0.0",
      brand: {
        name: brandName,
        docPath: null,
        visualContract: null,
        confirmedByUser: false,
      },
      // First entry is the default theme (the :root values in tokens.css);
      // every other entry needs a [data-theme="…"] block.
      themes,
      layout,
      // Counts are written as each stage is approved, and verify-stage.ts
      // asserts the HTML matches. Nothing here is authoritative until the
      // stage that owns it has been approved.
      inventory: {
        atoms: null,
        molecules: null,
        organisms: null,
        templates: null,
        pages: null,
      },
      stages: STAGE_NAMES.map((name, n) => ({
        n,
        name,
        pages: STAGE_PAGES[n],
        outputs: STAGE_OUTPUTS[n],
        status: "pending", // pending | built | approved | stale
        approvedAt: null,
        notes: [],
      })),
    },
    null,
    2,
  ) + "\n",
);

// Git does not track empty folders: without a placeholder the scaffold's shape
// (components/molecules/, reference/pages/ …) vanishes on the first commit.
for (const d of V2_DIRS) {
  const p = join(target, d);
  if (existsSync(p) && readdirSync(p).length === 0) write(`${d}/.gitkeep`, "");
}

if (asJson) {
  console.log(JSON.stringify({ target, brandName, schemaVersion: 2, layout, themes, created, skipped }, null, 2));
  process.exit(0);
}

console.log(`\n✓ Scaffolded "${brandName}" into ${target}/${ROOT} (schemaVersion 2)`);
console.log(`  themes: ${themes.join(", ")} (default: ${themes[0]})`);
if (created.length) {
  console.log(`\n  created (${created.length}):`);
  for (const c of created) console.log(`    + ${c}`);
}
if (skipped.length) {
  console.log(`\n  left alone (${skipped.length}) — pass --force to overwrite:`);
  for (const s of skipped) console.log(`    · ${s}`);
}
console.log(
  `\nNext: Stage 0. Resolve the brand source, snapshot inspiration URLs into\n` +
    `${layout.reference}/snapshots/, and fill ${layout.brief}/DESIGN-BRIEF.md.\n` +
    `Tokens stay as placeholders until Stage 1; run build-index.ts after each approval.`,
);
