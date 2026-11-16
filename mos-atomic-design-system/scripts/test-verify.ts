#!/usr/bin/env bun
/**
 * test-verify.ts — regression suite for the gate and the scaffold.
 *
 * A verification script that only ever passes is worse than none: it converts
 * "unchecked" into "checked and fine". So each case below builds a valid
 * fixture, breaks exactly one thing, and asserts the gate catches it. If a case
 * reports MISSED, verify-stage.ts has a hole.
 *
 * Three fixture families:
 *   v1    the original layout (docs/ + public/ + src/), scaffolded with
 *         init-system --schema 1 — v1 systems must keep verifying unchanged
 *   v2    one design-system/ root, tiered tokens, one spec per component
 *   init  init-system's routing: v2 by default, never over a v1 or legacy
 *         system in the target or in a sibling brand repo, --schema 1, --migrate
 *   legacy verify-stage --legacy <dir>: generic checks on a hand-built system
 *
 * Usage: bun test-verify.ts [--keep]
 * Exit:  0 all cases behave correctly · 1 one or more holes
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(tmpdir(), `ads-test-${process.pid}`);
const BASE_V1 = join(ROOT, "base-v1");
const BASE_V2 = join(ROOT, "base-v2");
const keep = process.argv.includes("--keep");

const sh = (cmd: string[]) => Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
const script = (name: string, ...args: string[]) => sh([process.execPath, join(HERE, name), ...args]);

// ---------------------------------------------------------------------------
// Token fillers
// ---------------------------------------------------------------------------

const V1_TOKEN_VALUES: Record<string, string> = {
  COLOR_SCHEME: "dark", COLOR_BASE: "#0b0c0e", COLOR_RAISED: "#16181c",
  COLOR_CONTRAST: "#f7f7f4", COLOR_ACCENT: "#4f6bff", COLOR_LINE: "#26292e",
  COLOR_TEXT_BODY: "rgb(247 247 244 / 78%)", COLOR_TEXT_MUTED: "rgb(247 247 244 / 55%)",
  COLOR_TEXT_SUBTLE: "rgb(247 247 244 / 50%)", COLOR_FOCUS: "#93a4ff",
  FONT_DISPLAY: '"General Sans", system-ui, sans-serif',
  FONT_SANS: '"Inter", system-ui, sans-serif',
  FONT_MONO: '"JetBrains Mono", ui-monospace, monospace',
  TYPE_HERO: "clamp(3rem, 8vw, 7rem)", TYPE_H2: "clamp(2rem, 4vw, 3.5rem)",
  TYPE_H3: "1.25rem", TYPE_BODY: "1rem", TYPE_SMALL: "0.875rem",
  LEADING_DISPLAY: "0.98", LEADING_BODY: "1.65",
  TRACKING_HERO: "-0.04em", TRACKING_LABEL: "0.07em",
  CONTAINER_WIDE: "75rem", CONTAINER_READING: "45rem",
  SECTION_SPACE: "clamp(6rem, 12vw, 10rem)", SECTION_SPACE_NARROW: "clamp(4rem, 10vw, 6rem)",
  RADIUS_SM: "0.375rem", RADIUS_MD: "0.75rem", FOCUS_RING: "0 0 0 3px rgb(79 107 255 / 38%)",
};

function hslHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

const LIGHTNESS: Record<string, number> = { 50: 97, 100: 93, 200: 85, 300: 74, 400: 62, 500: 50, 600: 42, 700: 34, 800: 26, 900: 18 };
const HUES: Record<string, [number, number]> = {
  PRIMARY: [174, 70], NEUTRAL: [215, 12], RED: [2, 75], GREEN: [142, 60], AMBER: [38, 90], BLUE: [214, 80],
};
const V2_NAMED: Record<string, string> = {
  PRIMARY_HUE: "teal",
  NEUTRAL_HUE: "slate",
  COLOR_SCHEME: "light dark",
  FONT_DISPLAY: '"General Sans", system-ui, sans-serif',
  FONT_SANS: '"Inter", system-ui, sans-serif',
  FONT_MONO: '"JetBrains Mono", ui-monospace, monospace',
  CONTAINER_WIDE: "75rem",
  CONTAINER_READING: "45rem",
  SHADOW_SM: "0 1px 2px rgb(0 0 0 / 8%)",
  SHADOW_MD: "0 4px 12px rgb(0 0 0 / 10%)",
  SHADOW_LG: "0 12px 32px rgb(0 0 0 / 14%)",
};

/** Resolve every {{PLACEHOLDER}} in the v2 tokens skeleton with plausible sample values. */
export function fillV2Tokens(css: string): string {
  return css.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => {
    if (key in V2_NAMED) return V2_NAMED[key];
    const m = key.match(/^([A-Z]+)_(\d+)$/);
    if (m && HUES[m[1]] && LIGHTNESS[m[2]] !== undefined) {
      const [h, s] = HUES[m[1]];
      return hslHex(h, s, LIGHTNESS[m[2]]);
    }
    throw new Error(`no sample value for {{${key}}}`);
  });
}

// ---------------------------------------------------------------------------
// Shared page builders
// ---------------------------------------------------------------------------

const RAIL: [string, string, string][] = [
  ["index.html", "00", "System map"], ["foundations.html", "01", "Foundations"],
  ["atoms.html", "02", "Atoms"], ["molecules.html", "03", "Molecules"],
  ["organisms.html", "04", "Organisms"], ["templates.html", "05", "Templates"],
  ["pages.html", "06", "Pages"], ["rules.html", "07", "Rules"],
];

const page = (current: string, num: string, title: string, sections: string) => `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${title} · Fixture</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <a class="skip-link" href="#content">Skip to content</a>
    <div class="shell">
      <aside class="rail" aria-label="Design system navigation">
        <a class="wordmark rail-brand-full" href="index.html">Fixture Co</a>
        <div>
          <p class="rail-kicker">Design system</p>
          <nav class="stage-nav" aria-label="Design system stages">
${RAIL.map(([h, n, l]) => `            <a href="${h}"${h === current ? ' aria-current="page"' : ""}><span class="number">${n}</span><span>${l}</span></a>`).join("\n")}
          </nav>
        </div>
        <p class="rail-footer">Private · no-index</p>
      </aside>
      <div class="page">
        <header class="page-header">
          <p class="eyebrow">${num} · ${title}</p>
          <h1>${title}</h1>
          <p>Fixture.</p>
          <span class="status">Fixture</span>
        </header>
        <main class="content" id="content">
${sections}
        </main>
        <footer class="footer"><span>Fixture · v0.1</span><a href="molecules.html">Next →</a></footer>
      </div>
    </div>
  </body>
</html>
`;

const ATOMS: [string, string, string, string][] = [
  ["A-01", "Button", "button", '<button type="button" class="btn">Join</button>'],
  ["A-02", "Text link", "text-link", '<a href="#content" class="tlink">Read more</a>'],
  ["A-03", "Eyebrow", "eyebrow", '<span class="eyebrow">Label</span>'],
  ["A-04", "Divider", "divider", '<hr class="rule" />'],
  ["A-05", "Wordmark", "wordmark", '<span class="wordmark">Fixture Co</span>'],
  ["A-06", "Monogram", "monogram", '<span class="monogram">fc</span>'],
];

const specimen = (id: string, name: string, body: string) => `            <article class="specimen" id="${id}">
              <header class="specimen__head">
                <div><span class="card-label">${id}</span><h3>${name}</h3></div>
                <span class="specimen__usage">Core</span>
              </header>
              <div class="specimen__stage">${body}</div>
              <p class="specimen__note">All required states shown.</p>
            </article>`;

const atomSections = `          <section class="section" aria-labelledby="a-title">
            <div class="section-head">
              <div><span class="section-number">02.1</span><h2 id="a-title">Actions</h2></div>
              <p>Smallest interactive units.</p>
            </div>
            <div class="specimen-grid specimen-grid--3">
${ATOMS.slice(0, 3).map((a) => specimen(a[0], a[1], a[3])).join("\n")}
            </div>
          </section>
          <section class="section" aria-labelledby="b-title">
            <div class="section-head">
              <div><span class="section-number">02.2</span><h2 id="b-title">Marks</h2></div>
              <p>Identity and separation.</p>
            </div>
            <div class="specimen-grid specimen-grid--3">
${ATOMS.slice(3).map((a) => specimen(a[0], a[1], a[3])).join("\n")}
            </div>
          </section>`;

// Sub-stage page marks its PARENT in the rail, since 02A has no own entry.
const iconsPage = page("atoms.html", "02A", "Icons",
  `          <section class="section" aria-labelledby="i-title">
            <div class="section-head">
              <div><span class="section-number">02A.1</span><h2 id="i-title">Icons</h2></div>
              <p>One grid, one stroke weight.</p>
            </div>
          </section>`);

const organismsPage = page("organisms.html", "04", "Organisms",
  `          <section class="section" aria-labelledby="o-title">
            <div class="section-head"><div><span class="section-number">04.1</span><h2 id="o-title">Global</h2></div><p>Why.</p></div>
            <article class="organism-specimen" data-organism="O-01">
              <header class="organism-specimen__head">
                <div><span class="card-label">O-01</span><h3>Site header</h3></div>
                <p class="organism-recipe"><span>Built from</span> nothing in particular</p>
              </header>
              <div class="organism-stage organism-stage--compact"></div>
              <p class="organism-note">Note.</p>
            </article>
          </section>`);

const spec = (id: string, name: string, level: string, page: string) => `---
id: ${id}
name: ${name}
level: ${level}
status: draft
composes: []
tokens: [--color-text-action, --color-border-focus]
specimen: reference/${page}.html#${id}
---

# ${id} ${name}

## Purpose

The single job of the ${name.toLowerCase()}.

## Anatomy

1. Container

## Props / variants

| Prop | Values | Default |
| ---- | ------ | ------- |
| type | primary | primary |

## States

| State | Visual change | Tokens |
| ----- | ------------- | ------ |
| default | base | \`--color-text-action\` |
| hover | darker | \`--color-text-action-hover\` |
| focus | shared focus ring | \`--color-border-focus\` |
| disabled | muted | \`--color-text-disabled\` |

## Sizes

n/a — one size.

## Behaviour & responsive

Wraps at narrow widths.

## Accessibility

Native element; keyboard reachable; 44px target.

## Markup

\`\`\`html
<span class="x">${name}</span>
\`\`\`

## Do / Don't

- Do keep one job.
`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildV1() {
  mkdirSync(join(BASE_V1, "public"), { recursive: true });
  mkdirSync(join(BASE_V1, "src"), { recursive: true });
  const init = script("init-system.ts", "--target", BASE_V1, "--brand-name", "Fixture Co", "--schema", "1", "--json");
  if (init.exitCode !== 0) throw new Error(`v1 scaffold failed: ${init.stderr}`);

  const tokPath = join(BASE_V1, "src/styles/tokens.css");
  let tok = readFileSync(tokPath, "utf8");
  for (const [k, v] of Object.entries(V1_TOKEN_VALUES)) tok = tok.replaceAll(`{{${k}}}`, v);
  writeFileSync(tokPath, tok);

  const ref = join(BASE_V1, "public/atomic-framework");
  writeFileSync(join(ref, "atoms.html"), page("atoms.html", "02", "Atoms", atomSections));
  writeFileSync(join(ref, "icons.html"), iconsPage);
  writeFileSync(join(ref, "styles.css"), readFileSync(join(ref, "styles.css"), "utf8") + `
/* ---- A-nn — atoms ---- */
.btn { background: var(--color-accent); border: 1px solid var(--color-accent);
  border-radius: var(--radius-pill); color: var(--color-text);
  min-height: 2.75rem; padding: var(--s3) var(--s5); }
.btn:focus-visible { box-shadow: var(--focus-ring); }
.tlink { color: var(--color-text); }
.rule { border: 0; border-top: 1px solid var(--color-border); }
`);

  const sp = join(BASE_V1, "docs/design-system/STATE.json");
  const st = JSON.parse(readFileSync(sp, "utf8"));
  st.brand.docPath = "business/brand/guidelines/brand-guidelines.md";
  st.brand.confirmedByUser = true;
  st.inventory.atoms = ATOMS.length;
  st.stages[0].status = "approved";
  st.stages[1].status = "approved";
  st.stages[2].status = "built";
  writeFileSync(sp, JSON.stringify(st, null, 2));
}

function buildV2() {
  mkdirSync(BASE_V2, { recursive: true });
  const init = script("init-system.ts", "--target", BASE_V2, "--brand-name", "Fixture Co", "--no-discover", "--json");
  if (init.exitCode !== 0) throw new Error(`v2 scaffold failed: ${init.stderr}`);

  const ds = join(BASE_V2, "design-system");
  const tokPath = join(ds, "tokens/tokens.css");
  writeFileSync(tokPath, fillV2Tokens(readFileSync(tokPath, "utf8")));

  const ref = join(ds, "reference");
  writeFileSync(join(ref, "atoms.html"), page("atoms.html", "02", "Atoms", atomSections));
  writeFileSync(join(ref, "icons.html"), iconsPage);
  writeFileSync(join(ref, "styles.css"), readFileSync(join(ref, "styles.css"), "utf8") + `
/* ---- A-nn — atoms ---- */
.btn { background: var(--color-surface-action); border: var(--border-width-sm) solid var(--color-border-action);
  border-radius: var(--radius-round); color: var(--color-text-on-action);
  min-height: var(--size-touch-target); padding: var(--space-3) var(--space-6); }
.btn:hover { background: var(--color-surface-action-hover); }
.tlink { color: var(--color-text-action); }
.rule { border: 0; border-top: var(--border-width-sm) solid var(--color-border-default); }
`);
  for (const [id, name, slug] of ATOMS) {
    writeFileSync(join(ds, "components/atoms", `${id}-${slug}.md`), spec(id, name, "atom", "atoms"));
  }

  const sp = join(ds, "STATE.json");
  const st = JSON.parse(readFileSync(sp, "utf8"));
  st.brand.docPath = "business/brand/guidelines/brand-guidelines.md";
  st.brand.confirmedByUser = true;
  st.inventory.atoms = ATOMS.length;
  st.stages[0].status = "approved";
  st.stages[1].status = "approved";
  st.stages[2].status = "built";
  writeFileSync(sp, JSON.stringify(st, null, 2) + "\n");

  const bi = script("build-index.ts", "--target", BASE_V2);
  if (bi.exitCode !== 0) throw new Error(`build-index failed: ${bi.stdout}${bi.stderr}`);
}

// ---------------------------------------------------------------------------
// Verify cases
// ---------------------------------------------------------------------------

const edit = (root: string, rel: string, fn: (s: string) => string) =>
  writeFileSync(join(root, rel), fn(readFileSync(join(root, rel), "utf8")));

const patchJson = (root: string, rel: string, fn: (s: any) => void) => {
  const p = join(root, rel);
  const s = JSON.parse(readFileSync(p, "utf8"));
  fn(s);
  writeFileSync(p, JSON.stringify(s, null, 2));
};

interface Case { fixture: "v1" | "v2"; name: string; expect: string; stage?: string; break: (root: string) => void }

// v1 paths
const A1 = "public/atomic-framework/atoms.html";
const C1 = "public/atomic-framework/styles.css";
const S1 = "docs/design-system/STATE.json";
// v2 paths
const DS = "design-system";
const A2 = `${DS}/reference/atoms.html`;
const C2 = `${DS}/reference/styles.css`;
const T2 = `${DS}/tokens/tokens.css`;
const S2 = `${DS}/STATE.json`;
const SPEC = (id: string, slug: string) => `${DS}/components/atoms/${id}-${slug}.md`;

const CASES: Case[] = [
  // ---- v1: the original suite, unchanged behaviour
  { fixture: "v1", name: "raw hex in a component rule", expect: "raw values",
    break: (r) => edit(r, C1, (s) => s + "\n.x { color: #ff0000; }\n") },
  { fixture: "v1", name: "literal font-family in a component rule", expect: "raw values",
    break: (r) => edit(r, C1, (s) => s + "\n.y { font-family: Arial, sans-serif; }\n") },
  { fixture: "v1", name: "gap in the A-nn sequence", expect: "contiguity",
    break: (r) => edit(r, A1, (s) => s.replaceAll("A-04", "A-07")) },
  { fixture: "v1", name: "duplicate specimen ID", expect: "contiguity",
    break: (r) => edit(r, A1, (s) => s.replaceAll("A-05", "A-04")) },
  { fixture: "v1", name: "unpadded ID (A-6)", expect: "contiguity",
    break: (r) => { edit(r, A1, (s) => s.replaceAll("A-06", "A-6")); patchJson(r, S1, (s) => { s.inventory.atoms = null; }); } },
  { fixture: "v1", name: "noindex removed", expect: "noindex",
    break: (r) => edit(r, A1, (s) => s.replace(/<meta name="robots"[^>]*>/, "")) },
  { fixture: "v1", name: "skip link removed", expect: "skip link",
    break: (r) => edit(r, A1, (s) => s.replace(/<a class="skip-link"[^<]*<\/a>/, "")) },
  { fixture: "v1", name: "main landmark removed", expect: "main landmark",
    break: (r) => edit(r, A1, (s) => s.replace('id="content"', 'id="body"')) },
  { fixture: "v1", name: "two rail entries marked current", expect: "rail current",
    break: (r) => edit(r, A1, (s) => s.replace('href="molecules.html"', 'href="molecules.html" aria-current="page"')) },
  { fixture: "v1", name: "section aria-labelledby removed", expect: "section labels",
    break: (r) => edit(r, A1, (s) => s.replace(' aria-labelledby="a-title"', "")) },
  { fixture: "v1", name: "raw colour in an inline style", expect: "inline styles",
    break: (r) => edit(r, A1, (s) => s.replace('class="specimen__stage"', 'class="specimen__stage" style="background:#123456"')) },
  { fixture: "v1", name: "focus-visible stripped", expect: "focus",
    break: (r) => edit(r, C1, (s) => s.split("\n").filter((l) => !l.includes("focus-visible")).join("\n")) },
  { fixture: "v1", name: "token placeholder left unresolved", expect: "tokens resolved",
    break: (r) => edit(r, "src/styles/tokens.css", (s) => s + "\n:root { --extra: {{COLOR_MISSING}}; }\n") },
  { fixture: "v1", name: "declared inventory disagrees with the page", expect: "contiguity",
    break: (r) => patchJson(r, S1, (s) => { s.inventory.atoms = 9; }) },
  { fixture: "v1", name: "stage approved ahead of its predecessor", expect: "state ordering",
    break: (r) => patchJson(r, S1, (s) => { s.stages[0].status = "pending"; }) },
  { fixture: "v1", name: "organism recipe naming no molecules", expect: "organism recipes", stage: "4",
    break: (r) => {
      writeFileSync(join(r, "public/atomic-framework/organisms.html"), organismsPage);
      patchJson(r, S1, (s) => { s.stages[3].status = "approved"; s.stages[4].status = "built"; s.inventory.organisms = 1; });
    } },

  // ---- v2: shared checks still work on the new paths
  { fixture: "v2", name: "raw hex in a component rule", expect: "raw values",
    break: (r) => edit(r, C2, (s) => s + "\n.x { color: #ff0000; }\n") },
  { fixture: "v2", name: "raw hex in a custom property outside tokens.css", expect: "raw values",
    break: (r) => edit(r, C2, (s) => s + "\n:root { --local-accent: #ff0000; }\n") },
  { fixture: "v2", name: "gap in the A-nn sequence", expect: "contiguity",
    break: (r) => edit(r, A2, (s) => s.replaceAll("A-04", "A-07")) },
  { fixture: "v2", name: "noindex removed", expect: "noindex",
    break: (r) => edit(r, A2, (s) => s.replace(/<meta name="robots"[^>]*>/, "")) },
  { fixture: "v2", name: "two rail entries marked current", expect: "rail current",
    break: (r) => edit(r, A2, (s) => s.replace('href="molecules.html"', 'href="molecules.html" aria-current="page"')) },
  { fixture: "v2", name: "focus-visible stripped", expect: "focus",
    break: (r) => edit(r, C2, (s) => s.split("\n").filter((l) => !l.includes("focus-visible")).join("\n")) },
  { fixture: "v2", name: "token placeholder left unresolved", expect: "tokens resolved",
    break: (r) => edit(r, T2, (s) => s.replace("--brand-teal-300: ", "--brand-teal-300: {{PRIMARY_300}}; --x: ")) },
  { fixture: "v2", name: "organism recipe naming no molecules", expect: "organism recipes", stage: "4",
    break: (r) => {
      writeFileSync(join(r, DS, "reference/organisms.html"), organismsPage);
      patchJson(r, S2, (s) => { s.stages[3].status = "approved"; s.stages[4].status = "built"; s.inventory.organisms = 1; });
    } },

  // ---- v2: new checks
  { fixture: "v2", name: "missing @tier alias marker", expect: "tier markers",
    break: (r) => edit(r, T2, (s) => s.replace("/* @tier alias */", "/* alias */")) },
  { fixture: "v2", name: "tier markers out of order", expect: "tier markers",
    break: (r) => edit(r, T2, (s) => s.replace("/* @tier alias */", "/* @tier TMP */").replace("/* @tier brand */", "/* @tier alias */").replace("/* @tier TMP */", "/* @tier brand */")) },
  { fixture: "v2", name: "component CSS using --brand-*", expect: "tier discipline",
    break: (r) => edit(r, C2, (s) => s + "\n.x { color: var(--brand-teal-500); }\n") },
  { fixture: "v2", name: "component CSS using --alias-*", expect: "tier discipline",
    break: (r) => edit(r, C2, (s) => s + "\n.x { color: var(--alias-primary-500); }\n") },
  { fixture: "v2", name: "inline style using --brand-*", expect: "tier discipline",
    break: (r) => edit(r, A2, (s) => s.replace('class="specimen__stage"', 'class="specimen__stage" style="color: var(--brand-teal-500)"')) },
  { fixture: "v2", name: "missing spec md for A-03", expect: "component specs",
    break: (r) => unlinkSync(join(r, SPEC("A-03", "eyebrow"))) },
  { fixture: "v2", name: "spec frontmatter id mismatch", expect: "component specs",
    break: (r) => edit(r, SPEC("A-02", "text-link"), (s) => s.replace("id: A-02", "id: A-20")) },
  { fixture: "v2", name: "spec missing the Accessibility section", expect: "component specs",
    break: (r) => edit(r, SPEC("A-01", "button"), (s) => s.replace("## Accessibility", "## Notes")) },
  { fixture: "v2", name: "incomplete colour scale (green-300 removed)", expect: "colour scales",
    break: (r) => edit(r, T2, (s) => s.split("\n").filter((l) => !l.includes("--brand-green-300:")).join("\n").replace("var(--brand-green-300)", "var(--brand-green-400)")) },
  { fixture: "v2", name: "required mapped token missing (border-focus)", expect: "mapped tokens",
    break: (r) => edit(r, T2, (s) => s.split("\n").filter((l) => !l.includes("--color-border-focus:")).join("\n")) },
  { fixture: "v2", name: "declared theme has no block", expect: "theme blocks",
    break: (r) => patchJson(r, S2, (s) => { s.themes = ["light", "dark", "sepia"]; }) },
  { fixture: "v2", name: "README.md missing", expect: "README index",
    break: (r) => unlinkSync(join(r, DS, "README.md")) },
  { fixture: "v2", name: "mapped colour skips the alias tier", expect: "tier chain",
    break: (r) => edit(r, T2, (s) => s.replace("--color-text-muted: var(--alias-neutral-600);", "--color-text-muted: var(--brand-slate-600);")) },
  { fixture: "v2", name: "raw literal in the alias tier", expect: "tier chain",
    break: (r) => edit(r, T2, (s) => s.replace("--alias-white: var(--brand-white);", "--alias-white: #ffffff;")) },
  { fixture: "v2", name: "dark theme colour skips the alias tier", expect: "tier chain",
    break: (r) => edit(r, T2, (s) => s.replace("  --color-text-heading: var(--alias-neutral-50);", "  --color-text-heading: var(--brand-slate-50);")) },
  { fixture: "v2", name: "icons.html has I-nn specimens but no icons.md", expect: "component specs",
    break: (r) => edit(r, `${DS}/reference/icons.html`, (s) => s.replace("<p>One grid, one stroke weight.</p>", "<p>One grid.</p><span class=\"card-label\">I-01</span><span class=\"card-label\">I-02</span>")) },

  // ---- review round 1: tier chain classified by token, not file position (HIGH #2)
  { fixture: "v2", name: "dark override with a literal placed after @tier responsive", expect: "tier chain",
    break: (r) => edit(r, T2, (s) => s + '\n[data-theme="dark"] { --color-text-body: #fff; }\n') },
  { fixture: "v2", name: "mapped token redeclared in a second :root", expect: "tier chain",
    break: (r) => edit(r, T2, (s) => s + "\n:root { --color-text-heading: var(--alias-neutral-800); }\n") },
  // (MED #3)
  { fixture: "v2", name: "dangling reference (typo in alias name)", expect: "not defined",
    break: (r) => edit(r, T2, (s) => s.replace("--color-text-body: var(--alias-neutral-800);", "--color-text-body: var(--alias-nuetral-800);")) },
  { fixture: "v2", name: "literal hidden in a var() fallback", expect: "fallback",
    break: (r) => edit(r, T2, (s) => s.replace("--color-text-muted: var(--alias-neutral-600);", "--color-text-muted: var(--alias-neutral-600, #ff0000);")) },
  { fixture: "v2", name: "partial literal inside calc()", expect: "mixes a literal",
    break: (r) => edit(r, T2, (s) => s.replace("--space-3: var(--alias-space-300);", "--space-3: calc(var(--alias-space-300) + 3px);")) },
  { fixture: "v2", name: "colour token referencing a space token", expect: "tier chain",
    break: (r) => edit(r, T2, (s) => s.replace("--color-text-subtle: var(--alias-neutral-500);", "--color-text-subtle: var(--space-2);")) },
  { fixture: "v2", name: "colour token referencing a non-colour alias", expect: "not a colour",
    break: (r) => edit(r, T2, (s) => s.replace("--color-text-subtle: var(--alias-neutral-500);", "--color-text-subtle: var(--alias-space-200);")) },
  // (MED #4) strict literals in component CSS and inline styles
  { fixture: "v2", name: "rgb() literal in component CSS", expect: "literal colour function",
    break: (r) => edit(r, C2, (s) => s + "\n.x { color: rgb(255 0 0); }\n") },
  { fixture: "v2", name: "named colour in component CSS", expect: "named colour",
    break: (r) => edit(r, C2, (s) => s + "\n.x { background: red; }\n") },
  { fixture: "v2", name: "px literal in component CSS", expect: "literal 12px",
    break: (r) => edit(r, C2, (s) => s + "\n.x { padding: 12px; }\n") },
  { fixture: "v2", name: "ms literal in component CSS", expect: "literal 200ms",
    break: (r) => edit(r, C2, (s) => s + "\n.x { transition: opacity 200ms; }\n") },
  { fixture: "v2", name: "rem literal in a style=\"\" attribute", expect: "inline styles",
    break: (r) => edit(r, A2, (s) => s.replace('class="specimen__stage"', 'class="specimen__stage" style="padding: 1rem"')) },
  { fixture: "v2", name: "hsl() literal in a <style> block", expect: "inline styles",
    break: (r) => edit(r, A2, (s) => s.replace("</head>", "<style>.y { color: hsl(0 100% 50%); }</style></head>")) },
  // (MED #10) spec contents
  { fixture: "v2", name: "spec composes an ID that has no spec", expect: "composes",
    break: (r) => edit(r, SPEC("A-02", "text-link"), (s) => s.replace("composes: []", "composes: [A-09]")) },
  { fixture: "v2", name: "icons.md without an Accessibility section", expect: "icons.md",
    break: (r) => {
      edit(r, `${DS}/reference/icons.html`, (s) => s.replace("<p>One grid, one stroke weight.</p>", "<p>Set.</p><span class=\"card-label\">I-01</span>"));
      writeFileSync(join(r, DS, "components/atoms/icons.md"), "---\nid: I-nn\nname: Icon set\nlevel: atom\nstatus: draft\n---\n\n# Icons\n\n## Grid\n\n20px on a 24 art-board.\n");
    } },
];

/** Warnings that must NOT fail the gate but must be reported. */
interface WarnCase { name: string; expect: string; stage?: string; break: (root: string) => void | Promise<void> }
const WARN_CASES: WarnCase[] = [
  { name: "README index stale after adding a spec", expect: "stale",
    break: (r) => writeFileSync(join(r, SPEC("A-07", "badge")), spec("A-07", "Badge", "atom", "atoms")) },
  { name: "number scale off the 4px grid", expect: "4px grid",
    break: (r) => edit(r, T2, (s) => s.replace("--brand-scale-150: 0.375rem;", "--brand-scale-150: 0.4375rem;")) },
  { name: "spec without a Sizes section", expect: "Sizes",
    break: (r) => edit(r, SPEC("A-04", "divider"), (s) => s.replace("## Sizes", "## Notes")) },
  { name: "spec frontmatter tokens list a --brand-* token", expect: "mapped/responsive tokens only",
    break: (r) => edit(r, SPEC("A-04", "divider"), (s) => s.replace("tokens: [--color-text-action", "tokens: [--brand-teal-500, --color-text-action")) },
];

/** Things that must stay GREEN: fixes for false positives. */
const PASS_CASES: WarnCase[] = [
  { name: "BEM modifier .card--brand-accent is not a tier reference", expect: "brand",
    break: (r) => edit(r, C2, (s) => s + "\n.card--brand-accent { color: var(--color-text-action); }\n") },
  { name: "inline <svg> text that looks like an ID is ignored", expect: "A-09",
    break: (r) => edit(r, A2, (s) => s.replace("<p>Smallest interactive units.</p>", "<p>Smallest interactive units.</p><svg aria-hidden=\"true\"><text>A-09</text></svg>")) },
  { name: "README with CRLF line endings is not reported stale", expect: "stale",
    break: (r) => edit(r, `${DS}/README.md`, (s) => s.replace(/\r?\n/g, "\r\n")) },
  { name: "icons.md with Grid + Accessibility satisfies the icon set", expect: "icons",
    break: (r) => {
      edit(r, `${DS}/reference/icons.html`, (s) => s.replace("<p>One grid, one stroke weight.</p>", "<p>Set.</p><span class=\"card-label\">I-01</span><span class=\"card-label\">I-02</span>"));
      writeFileSync(join(r, DS, "components/atoms/icons.md"), "---\nid: I-nn\nname: Icon set\nlevel: atom\nstatus: draft\n---\n\n# Icons\n\n## Grid\n\n20px on a 24 art-board.\n\n## Accessibility\n\nDecorative icons are aria-hidden.\n");
      script("build-index.ts", "--target", r);
    } },
];

// ---------------------------------------------------------------------------
// Init cases
// ---------------------------------------------------------------------------

interface InitCase { name: string; run: (dir: string) => string | null | Promise<string | null> } // null = pass, else reason

const INIT_CASES: InitCase[] = [
  {
    name: "empty repo → v2 layout with schemaVersion 2",
    run: (d) => {
      const t = join(d, "empty");
      mkdirSync(t, { recursive: true });
      const r = script("init-system.ts", "--target", t, "--no-discover");
      if (r.exitCode !== 0) return `exit ${r.exitCode}`;
      const st = JSON.parse(readFileSync(join(t, "design-system/STATE.json"), "utf8"));
      const dirs = ["brief", "tokens", "foundations", "components/atoms", "components/templates", "rules", "reference/pages"];
      const missing = dirs.filter((x) => !existsSync(join(t, "design-system", x)));
      if (st.schemaVersion !== 2 || st.version !== "0.0.0" || !Array.isArray(st.themes)) return "STATE.json is not v2-shaped";
      if (missing.length) return `missing ${missing.join(", ")}`;
      if (!readFileSync(join(t, "design-system/reference/styles.css"), "utf8").includes('@import url("../tokens/tokens.css")')) return "styles.css does not import ../tokens/tokens.css";
      return null;
    },
  },
  {
    name: "v1-shaped target → reports v1, creates nothing",
    run: (d) => {
      const t = join(d, "v1-target");
      mkdirSync(join(t, "docs/design-system"), { recursive: true });
      writeFileSync(join(t, "docs/design-system/STATE.json"), JSON.stringify({ version: 1, layout: { docs: "docs/design-system", reference: "public/atomic-framework", tokens: "src/styles/tokens.css" } }));
      const r = script("init-system.ts", "--target", t, "--no-discover");
      if (r.exitCode !== 0) return `exit ${r.exitCode}`;
      if (!r.stdout.toString().includes("v1 system found")) return "did not report v1";
      if (existsSync(join(t, "design-system"))) return "created design-system/ over a v1 system";
      return null;
    },
  },
  {
    name: "public/atomic-framework/*.html without STATE.json → legacy, creates nothing",
    run: (d) => {
      const t = join(d, "v1-html");
      mkdirSync(join(t, "public/atomic-framework"), { recursive: true });
      writeFileSync(join(t, "public/atomic-framework/atoms.html"), "<!doctype html>");
      const r = script("init-system.ts", "--target", t, "--no-discover");
      return r.stdout.toString().includes("legacy system — extend in place") && !existsSync(join(t, "design-system")) ? null : "not detected as legacy";
    },
  },
  {
    name: "--migrate prints the mapping and moves nothing",
    run: (d) => {
      const t = join(d, "v1-migrate");
      mkdirSync(join(t, "docs/design-system"), { recursive: true });
      writeFileSync(join(t, "docs/design-system/STATE.json"), JSON.stringify({ version: 1 }));
      writeFileSync(join(t, "docs/design-system/DESIGN-BRIEF.md"), "# brief\n");
      const r = script("init-system.ts", "--target", t, "--no-discover", "--migrate");
      const out = r.stdout.toString();
      if (r.exitCode !== 0 || !out.includes("design-system/brief/DESIGN-BRIEF.md")) return "no mapping printed";
      if (!existsSync(join(t, "docs/design-system/STATE.json")) || existsSync(join(t, "design-system"))) return "files moved";
      return null;
    },
  },
  {
    name: "sibling brand repo with a hand-built system → legacy, nothing scaffolded; --schema 1 scaffolds v1",
    run: (d) => {
      const sib = join(d, "siblings");
      const brain = join(sib, "acmehomes-brand");
      mkdirSync(join(brain, "reference/brand/atomic-design"), { recursive: true });
      writeFileSync(join(brain, "CLAUDE.md"), "# brand repo\n");
      writeFileSync(join(brain, "reference/brand/brand-guidelines.md"),
        "---\nstatus: master\n---\n# Acmehomes brand\n\n## Colour\n\n- Clay #b5651d\n- Ink #1f1a17\n- Sand #efe6da\n\n## Typography\n\nfont-family: Fraunces; body: Inter\n");
      writeFileSync(join(brain, "reference/brand/atomic-design/stage-1-foundations.html"), "<!doctype html>");
      const t = join(sib, "acmehomes-web");
      mkdirSync(t, { recursive: true });
      const r = script("init-system.ts", "--target", t, "--siblings", sib);
      const out = r.stdout.toString();
      if (r.exitCode !== 0) return `exit ${r.exitCode}: ${r.stderr}`;
      if (!out.includes("legacy system — extend in place") || !out.includes("stage-1-foundations.html")) return `sibling system not reported:\n${out}`;
      if (existsSync(join(t, "design-system"))) return "scaffolded v2 despite a sibling v1 system";
      const r1 = script("init-system.ts", "--target", t, "--siblings", sib, "--schema", "1");
      if (r1.exitCode !== 0) return `--schema 1 exit ${r1.exitCode}`;
      const sp = join(t, "design-system/docs/STATE.json");
      if (!existsSync(sp)) return "--schema 1 did not create the v1 layout";
      const st = JSON.parse(readFileSync(sp, "utf8"));
      if (st.schemaVersion !== undefined || st.version !== 1) return "--schema 1 wrote a non-v1 STATE.json";
      return null;
    },
  },
  // ---- review round 1
  {
    name: "--schema 1 on an existing v1 system fills in missing files, keeps existing ones (HIGH #1)",
    run: (d) => {
      const t = join(d, "v1-extend");
      mkdirSync(join(t, "docs/design-system"), { recursive: true });
      const layout = { docs: "docs/design-system", reference: "public/atomic-framework", tokens: "src/styles/tokens.css" };
      writeFileSync(join(t, "docs/design-system/STATE.json"), JSON.stringify({ version: 1, layout, marker: "keep-me" }));
      const r = script("init-system.ts", "--target", t, "--no-discover", "--schema", "1");
      if (r.exitCode !== 0) return `exit ${r.exitCode}: ${r.stdout}${r.stderr}`;
      if (!existsSync(join(t, "public/atomic-framework/styles.css")) || !existsSync(join(t, "src/styles/tokens.css"))) return "missing v1 files were not scaffolded";
      if (!readFileSync(join(t, "docs/design-system/STATE.json"), "utf8").includes("keep-me")) return "existing STATE.json was overwritten";
      if (existsSync(join(t, "design-system"))) return "created a v2 root";
      return null;
    },
  },
  {
    name: "v2 STATE.json wins over a leftover public/atomic-framework (MED #7)",
    run: (d) => {
      const t = join(d, "v2-plus-legacy");
      mkdirSync(join(t, "public/atomic-framework"), { recursive: true });
      writeFileSync(join(t, "public/atomic-framework/atoms.html"), "<!doctype html>");
      mkdirSync(join(t, "design-system"), { recursive: true });
      writeFileSync(join(t, "design-system/STATE.json"), JSON.stringify({ schemaVersion: 2, version: "0.1.0" }));
      const r = script("init-system.ts", "--target", t, "--no-discover");
      const out = r.stdout.toString();
      if (r.exitCode !== 0) return `exit ${r.exitCode}`;
      if (/legacy system|v1 system found/.test(out)) return "reported legacy/v1 despite a v2 STATE.json";
      if (!existsSync(join(t, "design-system/tokens/tokens.css"))) return "did not resume the v2 scaffold";
      return null;
    },
  },
  {
    name: "discover-brand reports kind \"legacy\" (not schemaVersion 1) with no STATE.json (MED #7)",
    run: (d) => {
      const t = join(d, "legacy-discover");
      mkdirSync(join(t, "public/atomic-framework"), { recursive: true });
      mkdirSync(join(d, "no-siblings"), { recursive: true });
      const r = script("discover-brand.ts", "--target", t, "--siblings", join(d, "no-siblings"), "--json");
      try {
        const sys = JSON.parse(r.stdout.toString()).existingSystemInTarget;
        return sys?.kind === "legacy" && sys.schemaVersion === null ? null : `got ${JSON.stringify(sys)}`;
      } catch {
        return `unparseable output: ${r.stdout}`;
      }
    },
  },
  {
    name: "--schema 1 is refused when a v2 system exists (MED #8)",
    run: (d) => {
      const t = join(d, "v2-no-downgrade");
      mkdirSync(join(t, "design-system"), { recursive: true });
      writeFileSync(join(t, "design-system/STATE.json"), JSON.stringify({ schemaVersion: 2 }));
      const r = script("init-system.ts", "--target", t, "--no-discover", "--schema", "1");
      if (r.exitCode !== 1) return `expected exit 1, got ${r.exitCode}`;
      if (existsSync(join(t, "design-system/docs")) || existsSync(join(t, "docs"))) return "scaffolded v1 anyway";
      return null;
    },
  },
  {
    name: "--migrate --scaffold builds the v2 tree alongside, moves and overwrites nothing (MED #9)",
    run: (d) => {
      const t = join(d, "migrate-scaffold");
      mkdirSync(join(t, "public/atomic-framework"), { recursive: true });
      writeFileSync(join(t, "public/atomic-framework/atoms.html"), "<!doctype html><!-- original -->");
      const r = script("init-system.ts", "--target", t, "--no-discover", "--migrate", "--scaffold", "--force");
      if (r.exitCode !== 0) return `exit ${r.exitCode}: ${r.stderr}`;
      if (!existsSync(join(t, "design-system/STATE.json")) || !existsSync(join(t, "design-system/tokens/tokens.css"))) return "v2 tree not scaffolded";
      if (!readFileSync(join(t, "public/atomic-framework/atoms.html"), "utf8").includes("original")) return "legacy file touched";
      // A second run must not overwrite what the first wrote, even with --force.
      writeFileSync(join(t, "design-system/README.md"), "hand-edited");
      script("init-system.ts", "--target", t, "--no-discover", "--migrate", "--scaffold", "--force");
      return readFileSync(join(t, "design-system/README.md"), "utf8") === "hand-edited" ? null : "overwrote an existing design-system/ file";
    },
  },
  {
    name: "legacy hint prints an absolute --legacy path and no v1 wording or ghost paths (LOW #17)",
    run: (d) => {
      const t = join(d, "legacy-hint");
      mkdirSync(join(t, "public/atomic-framework"), { recursive: true });
      writeFileSync(join(t, "public/atomic-framework/atoms.html"), "<!doctype html>");
      const out = script("init-system.ts", "--target", t, "--no-discover", "--migrate").stdout.toString();
      if (!out.includes(`--legacy ${join(t, "public/atomic-framework")}`)) return `no absolute --legacy path:\n${out}`;
      if (/v1 layout/.test(out)) return "legacy message mentions the v1 layout";
      if (out.includes("docs/design-system/STATE.json")) return "plan lists a non-existent docs/design-system/STATE.json";
      return null;
    },
  },
];

// ---------------------------------------------------------------------------
// Tool cases — export/build-index behaviour
// ---------------------------------------------------------------------------

const TOOL_CASES: InitCase[] = [
  {
    name: "build-index refuses a README with BEGIN but no END marker (MED #6)",
    run: (d) => {
      const t = join(d, "broken-marker");
      cpSync(BASE_V2, t, { recursive: true });
      const p = join(t, DS, "README.md");
      const broken = readFileSync(p, "utf8").replace("<!-- END GENERATED: inventory -->", "") + "\nHand-written tail.\n";
      writeFileSync(p, broken);
      const r = script("build-index.ts", "--target", t);
      if (r.exitCode !== 1) return `expected exit 1, got ${r.exitCode}`;
      return readFileSync(p, "utf8") === broken ? null : "README was modified";
    },
  },
  {
    name: "balanced var() scanner handles nested fallbacks (MED #5)",
    run: async () => {
      const { scanVars, varOnly } = await import("./export-tokens.ts");
      const v = "var(--a, var(--b, calc(1px + 2px)))";
      const refs = scanVars(v);
      if (refs.length !== 1 || refs[0].name !== "--a" || refs[0].fallback !== "var(--b, calc(1px + 2px))") return JSON.stringify(refs);
      if (varOnly(v) !== "--a") return "varOnly failed on a nested fallback";
      if (varOnly("calc(var(--a) + var(--b))") !== null) return "varOnly accepted a calc()";
      return null;
    },
  },
  {
    name: "export typing: font-size is not fontFamily, em is untyped, mode-only token has a $value (LOW #12/#13)",
    run: async () => {
      const { parseTokensCss, buildExport } = await import("./export-tokens.ts");
      const css = `/* @tier brand */\n:root { --brand-font-size-lg: 1.25rem; --brand-font-sans: "Inter", sans-serif; }\n/* @tier alias */\n:root {}\n/* @tier mapped */\n:root {}\n/* @tier responsive */\n:root { --text-h1-tracking: -0.02em; }\n@media (max-width: 40rem) { :root { --text-only-mobile: 1rem; } }\n`;
      const j = buildExport(parseTokensCss(css)).json as any;
      if (j.brand.font["size-lg"]?.$type === "fontFamily" || j.brand.font.size?.lg?.$type === "fontFamily") return "font-size typed as fontFamily";
      if (j.brand.font.sans.$type !== "fontFamily") return "font family lost its type";
      if (j.responsive.text.h1.tracking.$type !== undefined) return "em typed as dimension";
      const mo = j.responsive.text.only.mobile;
      if (!mo.$value || mo.$value === "") return "mode-only token has an empty $value";
      return null;
    },
  },
  {
    name: "icons.md is counted on its own row, not as an atom (LOW #18)",
    run: (d) => {
      const t = join(d, "icons-count");
      cpSync(BASE_V2, t, { recursive: true });
      writeFileSync(join(t, DS, "components/atoms/icons.md"), "---\nid: I-nn\nname: Icon set\nlevel: atom\nstatus: draft\n---\n\n## Grid\n\nx\n\n## Accessibility\n\ny\n");
      script("build-index.ts", "--target", t);
      const idx = readFileSync(join(t, DS, "components/INDEX.md"), "utf8");
      if (!/\| Atoms \| 0 \| 6 \| 0 \| 6 \|/.test(idx)) return "icons.md counted as an atom";
      if (!/\| Icons \(set\) \|/.test(idx)) return "no Icons row";
      return null;
    },
  },
];

// ---------------------------------------------------------------------------
// Legacy cases — verify-stage --legacy <dir>, no STATE.json
// ---------------------------------------------------------------------------

function buildLegacy(dir: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "tokens.css"), ":root { --ink: #1f1a17; --clay: #b5651d; }\n");
  writeFileSync(join(dir, "styles.css"), ".btn { color: var(--ink); }\n:focus-visible { outline: 2px solid var(--clay); }\n");
  writeFileSync(join(dir, "stage-1-foundations.html"),
    '<!doctype html><html><head><meta name="robots" content="noindex,nofollow" /><link rel="stylesheet" href="styles.css" /></head><body><main id="content"><p>Foundations</p><button class="btn" type="button">Go</button></main></body></html>');
}

/** A legacy stage page that carries its CSS inline, the way hand-built systems usually do. */
const legacyInlinePage = (css: string, body: string) =>
  `<!doctype html><html><head><meta name="robots" content="noindex,nofollow" /><style>${css}</style></head><body><main id="content">${body}</main></body></html>`;

const LEGACY_CASES: { name: string; expect: string; break: (dir: string) => void }[] = [
  { name: "noindex removed", expect: "noindex",
    break: (d) => edit(d, "stage-1-foundations.html", (s) => s.replace(/<meta name="robots"[^>]*>/, "")) },
  { name: "raw hex in a component rule", expect: "raw values",
    break: (d) => edit(d, "styles.css", (s) => s + ".x { color: #ff0000; }\n") },
  { name: "focus-visible stripped", expect: "focus",
    break: (d) => edit(d, "styles.css", (s) => s.split("\n").filter((l) => !l.includes("focus-visible")).join("\n")) },
  // F1 — iteration 3: focus is judged per page, and a comment or `outline: none` is not a focus treatment.
  { name: "focus-visible only inside a CSS comment", expect: "focus",
    break: (d) => edit(d, "styles.css", (s) => s.replace(/(:focus-visible[^\n]*)/, "/* $1 */")) },
  { name: "focus-visible that only removes the outline", expect: "focus",
    break: (d) => edit(d, "styles.css", (s) => s.replace(/:focus-visible \{[^}]*\}/, ":focus-visible { outline: none; }")) },
  { name: "interactive page with no focus rule of its own, while another page has one", expect: "focus",
    break: (d) => writeFileSync(join(d, "stage-2-atoms.html"),
      legacyInlinePage(".chip { color: var(--ink); }", '<a class="chip" href="#x">Chip</a><input type="text" />')) },
];

/** Legacy fixtures that must stay green — the focus check only bites where there is something to focus. */
const LEGACY_PASS_CASES: { name: string; change: (dir: string) => void }[] = [
  { name: "no interactive elements → no focus rule needed",
    change: (d) => {
      edit(d, "styles.css", (s) => s.split("\n").filter((l) => !l.includes("focus-visible")).join("\n"));
      edit(d, "stage-1-foundations.html", (s) => s.replace(/<button[^>]*>Go<\/button>/, ""));
    } },
  { name: "focus rule in the page's own <style> block counts",
    change: (d) => writeFileSync(join(d, "stage-2-atoms.html"),
      legacyInlinePage(".chip { color: var(--ink); }\n.chip:focus-visible { outline: 2px solid var(--clay); outline-offset: 2px; }", '<a class="chip" href="#x">Chip</a>')) },
];

// ---------------------------------------------------------------------------
// Iteration 2 — findings from the TVML migration and eval runs
// ---------------------------------------------------------------------------

/** Insert text at the end of the mapped tier (just before the responsive marker). */
const beforeResponsive = (css: string, text: string) => css.replace("/* @tier responsive */", `${text}\n\n/* @tier responsive */`);
const DEPRECATED_OK = "/* @deprecated */\n:root {\n  --base: var(--color-surface-page); /* v1 name */\n  --ink: var(--color-text-heading);\n}";

const markStage1Built = (r: string) => patchJson(r, S2, (s) => { s.stages[1].status = "built"; s.stages[2].status = "pending"; });
const foundationsWith = (body: string) =>
  page("foundations.html", "01", "Foundations",
    `          <section class="section" aria-labelledby="f-title">
            <div class="section-head"><div><span class="section-number">01.1</span><h2 id="f-title">Colour</h2></div><p>Scales.</p></div>
            ${body}
          </section>`);

/** An organisms page whose first <code> example closes as "</code\n>". */
function organismsWithWrappedCode(r: string) {
  writeFileSync(join(r, DS, "reference/organisms.html"), page("organisms.html", "04", "Organisms",
    `          <section class="section" aria-labelledby="o-title">
            <div class="section-head"><div><span class="section-number">04.1</span><h2 id="o-title">Global</h2></div>
              <p>Example: <code>&lt;article class="organism-specimen"&gt;</code
              >.</p></div>
            <article class="organism-specimen" id="O-01" data-organism="O-01">
              <header class="organism-specimen__head">
                <div><span class="card-label">O-01</span><h3>Site header</h3></div>
                <p class="organism-recipe"><span>Built from</span> <code>M-01</code> nav</p>
              </header>
              <div class="organism-stage"></div>
            </article>
            <p>Second example: <code>O-02</code>.</p>
          </section>`));
  writeFileSync(join(r, DS, "components/organisms/O-01-site-header.md"), spec("O-01", "Site header", "organism", "organisms"));
  patchJson(r, S2, (s) => {
    s.stages[2].status = "approved";
    s.stages[3].status = "approved";
    s.stages[4].status = "built";
    s.inventory.organisms = 1;
  });
}

CASES.push(
  { fixture: "v2", name: "deprecated token pointing at an alias token", expect: "deprecated",
    break: (r) => edit(r, T2, (s) => beforeResponsive(s, "/* @deprecated */\n:root { --base: var(--alias-neutral-50); }")) },
  { fixture: "v2", name: "deprecated token pointing at a brand token", expect: "deprecated",
    break: (r) => edit(r, T2, (s) => beforeResponsive(s, "/* @deprecated */\n:root { --paper: var(--brand-slate-50); }")) },
  { fixture: "v2", name: "migratedFrom legacy keeps tokens.css strict", expect: "tier chain",
    break: (r) => {
      patchJson(r, S2, (s) => { s.migratedFrom = "legacy"; });
      edit(r, T2, (s) => s.replace("--alias-white: var(--brand-white);", "--alias-white: #ffffff;"));
    } },
  { fixture: "v2", name: "swatch on foundations.html showing a different token than its data-token", expect: "tier discipline", stage: "1",
    break: (r) => {
      markStage1Built(r);
      writeFileSync(join(r, DS, "reference/foundations.html"),
        foundationsWith('<span data-token="--brand-teal-500" style="background: var(--brand-teal-600)"></span>'));
    } },
);

WARN_CASES.push(
  { name: "migratedFrom legacy turns reference-CSS literals into one warning", expect: "legacy literals",
    break: (r) => {
      patchJson(r, S2, (s) => { s.migratedFrom = "legacy"; });
      edit(r, C2, (s) => s + "\n.x { padding: 12px; color: #ff0000; transition: opacity 200ms; }\n");
      edit(r, A2, (s) => s.replace('class="specimen__stage"', 'class="specimen__stage" style="padding: 1rem"'));
    } },
  { name: "missing --size-touch-target", expect: "size-touch-target",
    break: (r) => edit(r, T2, (s) => s.split("\n").filter((l) => !l.includes("--size-touch-target:")).join("\n")) },
);

PASS_CASES.push(
  { name: "@deprecated block pointing at mapped tokens", expect: "deprecated",
    break: (r) => edit(r, T2, (s) => beforeResponsive(s, DEPRECATED_OK)) },
  { name: "prose \"A-01 to A-12\" is not read as specimen IDs", expect: "contiguity",
    break: (r) => edit(r, A2, (s) => s.replace("<p>Smallest interactive units.</p>", "<p>Smallest interactive units — A-01 to A-12 eventually.</p>")) },
  { name: "brand scale extended past 1400 and round at 999px", expect: "4px grid",
    break: (r) => edit(r, T2, (s) => s.replace("--brand-scale-round: 9999px;", "--brand-scale-1500: 10rem; /* 160px */\n  --brand-scale-1600: 12rem; /* 192px */\n  --brand-scale-round: 999px;")) },
  { name: "organism page with a </code\\n> closing tag counts its organisms", expect: "organism", stage: "4",
    break: (r) => organismsWithWrappedCode(r) },
  { name: "swatch exemption: data-token brand swatch on foundations.html", expect: "tier discipline", stage: "1",
    break: (r) => {
      markStage1Built(r);
      writeFileSync(join(r, DS, "reference/foundations.html"),
        foundationsWith('<span data-token="--brand-teal-500" style="background: var(--brand-teal-500)"></span><span data-token="--alias-primary-600" style="background: var(--alias-primary-600)"></span>'));
    } },
);

INIT_CASES.push(
  {
    name: "empty folders get a .gitkeep so the scaffold survives a commit (S7)",
    run: (d) => {
      const t = join(d, "gitkeep");
      mkdirSync(t, { recursive: true });
      script("init-system.ts", "--target", t, "--no-discover");
      const missing = ["components/molecules", "reference/pages", "reference/snapshots"].filter((x) => !existsSync(join(t, "design-system", x, ".gitkeep")));
      return missing.length ? `no .gitkeep in ${missing.join(", ")}` : null;
    },
  },
  {
    name: "--migrate --scaffold alongside a v1 system (S7)",
    run: (d) => {
      const t = join(d, "migrate-v1");
      mkdirSync(join(t, "docs/design-system"), { recursive: true });
      writeFileSync(join(t, "docs/design-system/STATE.json"), JSON.stringify({ version: 1, keep: true }));
      const r = script("init-system.ts", "--target", t, "--no-discover", "--migrate", "--scaffold");
      if (r.exitCode !== 0) return `exit ${r.exitCode}`;
      if (!existsSync(join(t, "design-system/STATE.json"))) return "v2 tree not scaffolded";
      return readFileSync(join(t, "docs/design-system/STATE.json"), "utf8").includes('"keep":true') ? null : "v1 STATE.json touched";
    },
  },
  {
    name: "sibling brand folder without .git or CLAUDE.md is discovered (S8)",
    run: (d) => {
      const sib = join(d, "sibs");
      mkdirSync(join(sib, "zephyr-brand/reference/brand"), { recursive: true });
      writeFileSync(join(sib, "zephyr-brand/reference/brand/brand-guidelines.md"), "# Zephyr\n\n## Colour\n\n- Sky #3a7bd5\n- Ink #111111\n- Mist #eeeeee\n");
      const t = join(sib, "zephyr-web");
      mkdirSync(t, { recursive: true });
      const r = script("discover-brand.ts", "--target", t, "--siblings", sib, "--json");
      try {
        const out = JSON.parse(r.stdout.toString());
        return out.best?.repoName === "zephyr-brand" ? null : `best was ${out.best?.repoName ?? "none"}`;
      } catch {
        return `unparseable: ${r.stdout}`;
      }
    },
  },
);

TOOL_CASES.push(
  {
    name: "wrapped multi-line token value + comment inside it exports cleanly (S9)",
    run: async () => {
      const { parseTokensCss, buildExport } = await import("./export-tokens.ts");
      const css = `/* @tier brand */\n:root {\n  --brand-font-sans:\n    "Inter",\n    system-ui, /* body face */\n    sans-serif;\n  --brand-blue-500: #3a7bd5;\n}\n/* @tier alias */\n:root {}\n/* @tier mapped */\n:root {}\n/* @tier responsive */\n:root {}\n`;
      const j = buildExport(parseTokensCss(css)).json as any;
      const f = j.brand.font.sans;
      if (JSON.stringify(f.$value) !== JSON.stringify(["Inter", "system-ui", "sans-serif"])) return `value ${JSON.stringify(f.$value)}`;
      if (f.$description !== "body face") return `description ${f.$description}`;
      return j.brand.blue["500"].$value === "#3a7bd5" ? null : "next token lost";
    },
  },
  {
    name: "deprecated tokens export $deprecated and get their own TOKENS.md table (S1)",
    run: async () => {
      const { parseTokensCss, buildExport } = await import("./export-tokens.ts");
      const css = beforeResponsive(fillV2Tokens(readFileSync(join(HERE, "..", "assets", "tokens.css"), "utf8")), DEPRECATED_OK);
      const out = buildExport(parseTokensCss(css));
      const j = out.json as any;
      if (j.mapped.base?.$deprecated !== true) return `mapped.base = ${JSON.stringify(j.mapped.base)}`;
      if (j.mapped.base.$value !== "{mapped.color.surface.page}") return `ref ${j.mapped.base.$value}`;
      if (!/## Deprecated[\s\S]*`--base`/.test(out.md)) return "no Deprecated table";
      return j.mapped.color.text.heading.$deprecated ? "live token marked deprecated" : null;
    },
  },
  {
    name: "legacy status counted on its own in INDEX + README inventory (S4)",
    run: (d) => {
      const t = join(d, "legacy-status");
      cpSync(BASE_V2, t, { recursive: true });
      edit(t, SPEC("A-01", "button"), (s) => s.replace("status: draft", "status: legacy"));
      script("build-index.ts", "--target", t);
      const idx = readFileSync(join(t, DS, "components/INDEX.md"), "utf8");
      if (!/\| Atoms \| 0 \| 5 \| 1 \| 6 \|/.test(idx)) return "Atoms row not 0 ready / 5 draft / 1 legacy / 6";
      return /1 legacy/.test(readFileSync(join(t, DS, "README.md"), "utf8")) ? null : "README inventory has no legacy count";
    },
  },
  {
    name: "README file index summarises components/ instead of one line per spec (S6)",
    run: () => {
      const readme = readFileSync(join(BASE_V2, DS, "README.md"), "utf8");
      if (/A-01-button\.md/.test(readme)) return "README lists individual spec files";
      if (!/atoms\/ \(6 specs: 6 draft — listed in components\/INDEX\.md\)/.test(readme)) return "no summarised atoms line";
      return readme.split("\n").length <= 150 ? null : `README is ${readme.split("\n").length} lines`;
    },
  },
  {
    name: "single migratedFrom warning, not one per literal (S3)",
    run: (d) => {
      const t = join(d, "migrated");
      cpSync(BASE_V2, t, { recursive: true });
      patchJson(t, S2, (s) => { s.migratedFrom = "legacy"; });
      edit(t, C2, (s) => s + "\n.x { padding: 12px; margin: 8px; color: #ff0000; }\n.y { gap: 4px; }\n");
      const { code, out } = verify(t, "2");
      const lines = out.split("\n").filter((l) => l.includes("⚠") && l.includes("legacy literals"));
      if (code !== 0) return `exit ${code}`;
      return lines.length === 1 && /\b[4-9]\d* literal/.test(lines[0]) ? null : `${lines.length} legacy line(s): ${lines.join(" | ")}`;
    },
  },
  {
    name: "status borders reach 3:1 (600 light / 400 dark) with -subtle at 200 (S12)",
    run: () => {
      const css = readFileSync(join(HERE, "..", "assets", "tokens.css"), "utf8");
      const need = ["--color-border-error: var(--alias-error-600)", "--color-border-error: var(--alias-error-400)", "--color-border-error-subtle: var(--alias-error-200)", "--size-touch-target: var(--brand-size-touch)", "--brand-size-touch: 44px"];
      const missing = need.filter((n) => !css.includes(n));
      return missing.length ? `skeleton missing: ${missing.join(", ")}` : null;
    },
  },
  {
    name: "stage rail scrolls inside its own container at 375px (S11, CSS assertion)",
    run: () => {
      const css = readFileSync(join(HERE, "..", "assets", "styles-base.css"), "utf8");
      const narrow = css.slice(css.indexOf("@media (max-width: 48rem)"));
      const nav = narrow.match(/\.stage-nav\s*\{([^}]*)\}/)?.[1] ?? "";
      const rail = narrow.match(/\.rail\s*\{([^}]*)\}/)?.[1] ?? "";
      if (!/overflow-x:\s*auto|flex-wrap:\s*wrap/.test(nav)) return ".stage-nav neither scrolls nor wraps";
      if (!/min-width:\s*0/.test(nav) || !/min-width:\s*0/.test(rail)) return "min-width: 0 chain missing — the strip widens the page";
      return null;
    },
  },
  {
    name: "export-figma README lists dropped modes and left-out tokens by reason (S13)",
    run: (d) => {
      const t = join(d, "figma");
      cpSync(BASE_V2, t, { recursive: true });
      const r = script("export-figma.ts", "--target", t);
      if (r.exitCode !== 0) return `exit ${r.exitCode}`;
      const md = readFileSync(join(t, DS, "tokens/figma/README.md"), "utf8");
      const need = ["`reduced-motion`", "duration", "shadow", "easing"];
      const missing = need.filter((n) => !md.includes(n));
      return missing.length ? `README missing: ${missing.join(", ")}` : null;
    },
  },
);

// ---------------------------------------------------------------------------
// Iteration 3 — eval findings (F1 legacy focus is in LEGACY_CASES above)
// ---------------------------------------------------------------------------

/**
 * Flip the fixture to a dark-default system: :root holds the default theme and
 * the other one lives in [data-theme="light"] + a prefers-color-scheme: light
 * block. Only the structure is flipped — the verifier checks structure, and
 * themes[0] in STATE.json names the default.
 */
function makeDarkDefault(r: string) {
  edit(r, T2, (s) =>
    s
      .replace('[data-theme="dark"]', '[data-theme="light"]')
      .replace("prefers-color-scheme: dark", "prefers-color-scheme: light")
      .replace(/(\[data-theme="light"\] \{\s*color-scheme:) dark;/, "$1 light;")
      .replace(/(prefers-color-scheme: light\) \{\s*:root:not\(\[data-theme\]\) \{\s*color-scheme:) dark;/, "$1 light;")
      .replace("color-scheme: light dark;", "color-scheme: dark light;"));
  patchJson(r, S2, (s) => { s.themes = ["dark", "light"]; });
}

/** Fill the stage-owned placeholders that init-system --page leaves behind. */
const fillShell = (html: string, sections: string) =>
  html
    .replaceAll("{{LANG}}", "en-AU")
    .replaceAll("{{BG_HEX}}", "#ffffff")
    .replaceAll("{{STAGE_INTRO}}", "Smallest interactive units.")
    .replaceAll("{{STATUS}}", "Fixture")
    .replaceAll("{{SECTIONS}}", () => sections);

CASES.push(
  { fixture: "v2", name: "stage page with an unfilled shell placeholder (F4)", expect: "placeholder",
    break: (r) => edit(r, A2, (s) => s.replace("<p>Fixture.</p>", "<p>{{STAGE_INTRO}}</p>")) },
);

PASS_CASES.push(
  { name: "dark-default theme: :root dark, [data-theme=light] + prefers-color-scheme: light (F5)", expect: "theme",
    break: (r) => makeDarkDefault(r) },
  { name: "@deprecated token pointing at a responsive token (F10)", expect: "deprecated",
    break: (r) => edit(r, T2, (s) => beforeResponsive(s, "/* @deprecated */\n:root {\n  --font-size-h1: var(--text-h1-size);\n  --base: var(--color-surface-page);\n}")) },
);

/** Swap two specimen IDs on the atoms page: the set stays complete, the order doesn't. */
const swapAtomIds = (r: string, a: string, b: string) =>
  edit(r, A2, (s) => s.replaceAll(a, "A-XX").replaceAll(b, a).replaceAll("A-XX", b));

WARN_CASES.push(
  { name: "migratedFrom legacy: complete IDs out of page order warn instead of failing (F11)", expect: "out of page order",
    break: (r) => {
      patchJson(r, S2, (s) => { s.migratedFrom = "legacy"; });
      swapAtomIds(r, "A-04", "A-05");
    } },
);

CASES.push(
  { fixture: "v2", name: "out-of-order IDs still fail without migratedFrom (F11)", expect: "contiguity",
    break: (r) => swapAtomIds(r, "A-04", "A-05") },
  { fixture: "v2", name: "migratedFrom legacy: a gap in the IDs still fails (F11)", expect: "contiguity",
    break: (r) => {
      patchJson(r, S2, (s) => { s.migratedFrom = "legacy"; });
      edit(r, A2, (s) => s.replaceAll("A-06", "A-07"));
    } },
);

INIT_CASES.push(
  {
    name: "init then discover: the scaffolded brief is never ranked as a brand source (F2)",
    run: (d) => {
      const t = join(d, "acme-web");
      mkdirSync(t, { recursive: true });
      mkdirSync(join(d, "none"), { recursive: true });
      script("init-system.ts", "--target", t, "--no-discover");
      const r = script("discover-brand.ts", "--target", t, "--siblings", join(d, "none"), "--json");
      const out = JSON.parse(r.stdout.toString());
      if (out.best) return `ranked ${out.best.relPath} as the brand source`;
      if (r.exitCode !== 3) return `exit ${r.exitCode}, expected 3 (nothing found)`;
      return out.skippedTemplates?.length === 1 ? null : `skippedTemplates: ${JSON.stringify(out.skippedTemplates)}`;
    },
  },
  {
    name: "a brief with its placeholders deleted is still the template; a filled one ranks (F2)",
    run: (d) => {
      const t = join(d, "acme-web");
      mkdirSync(t, { recursive: true });
      mkdirSync(join(d, "none"), { recursive: true });
      script("init-system.ts", "--target", t, "--no-discover");
      const rel = "design-system/brief/DESIGN-BRIEF.md";
      edit(t, rel, (s) => s.replace(/\{\{[A-Z0-9_]+\}\}/g, ""));
      const disc = () => JSON.parse(script("discover-brand.ts", "--target", t, "--siblings", join(d, "none"), "--json").stdout.toString());
      if (disc().best) return "an emptied template was ranked";
      edit(t, rel, (s) => s + "\n## Colour\n\n- Ink #111111 at 900\n- Sky #3a7bd5 at 600\n- Mist #eeeeee at 100\n\n## Typography\n\nInter for body; Fraunces for display.\n");
      return disc().best ? null : "a filled brief was skipped";
    },
  },
  {
    name: "init-system --page writes the rail with one aria-current per page; the result passes the gate (F4)",
    run: (d) => {
      const t = join(d, "pages");
      cpSync(BASE_V2, t, { recursive: true });
      const r = script("init-system.ts", "--target", t, "--page", "all", "--force");
      if (r.exitCode !== 0) return `exit ${r.exitCode}: ${r.stderr}`;
      const ref = join(t, DS, "reference");
      const expectCurrent: Record<string, string> = {
        "index.html": "index.html", "foundations.html": "foundations.html", "atoms.html": "atoms.html", "icons.html": "atoms.html",
        "molecules.html": "molecules.html", "organisms.html": "organisms.html", "templates.html": "templates.html",
        "pages.html": "pages.html", "rules.html": "rules.html",
      };
      for (const [file, cur] of Object.entries(expectCurrent)) {
        const html = readFileSync(join(ref, file), "utf8");
        const nav = html.match(/<nav[^>]*class="stage-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
        const marked = [...nav.matchAll(/<a href="([^"]+)" aria-current="page"/g)].map((m) => m[1]);
        if (marked.length !== 1 || marked[0] !== cur) return `${file}: aria-current on ${JSON.stringify(marked)}, expected ${cur}`;
        if (!html.includes("Fixture Co")) return `${file}: brand name not filled`;
      }
      if (!readFileSync(join(ref, "icons.html"), "utf8").includes("02A · Icons")) return "icons.html eyebrow is not 02A";
      // Fill the stage-owned placeholders and the generated page must pass the gate.
      writeFileSync(join(ref, "atoms.html"), fillShell(readFileSync(join(ref, "atoms.html"), "utf8"), atomSections));
      writeFileSync(join(ref, "icons.html"), iconsPage);
      const v = verify(t, "2");
      return v.code === 0 ? null : `generated atoms.html fails the gate:\n${v.out}`;
    },
  },
);

TOOL_CASES.push(
  {
    name: "dark default exports defaultTheme dark and a light mode (F5)",
    run: (d) => {
      const t = join(d, "dark");
      cpSync(BASE_V2, t, { recursive: true });
      makeDarkDefault(t);
      const r = script("export-tokens.ts", "--target", t);
      if (r.exitCode !== 0) return `exit ${r.exitCode}: ${r.stdout}${r.stderr}`;
      const j = JSON.parse(readFileSync(join(t, DS, "tokens/tokens.json"), "utf8"));
      const meta = j.$extensions?.["com.rdg.design-system"];
      if (meta?.defaultTheme !== "dark") return `defaultTheme ${meta?.defaultTheme}`;
      if (!j.mapped?.color?.text?.heading?.$extensions?.modes?.light) return "no light mode on a themed token";
      return /Default theme: \*\*dark\*\*/.test(readFileSync(join(t, DS, "tokens/TOKENS.md"), "utf8")) ? null : "TOKENS.md does not name dark as default";
    },
  },
  {
    name: "grade-run reads IDs like the verifier, counts <style> CSS, accepts a 3-column map (F8)",
    run: (d) => {
      const run = join(d, "run");
      const out = join(run, "outputs");
      mkdirSync(out, { recursive: true });
      const cards = ["A-01", "A-02", "A-03"].map((id) => `<article id="${id}"><span class="card-label">${id}</span><button type="button">x</button></article>`).join("");
      writeFileSync(join(out, "atoms.html"),
        `<!doctype html><html><head><meta name="robots" content="noindex,nofollow" /><style>button:focus-visible { outline: 2px solid var(--focus); }</style></head><body><main id="content"><p>Atoms A-01 to A-12 eventually.</p>${cards}</main></body></html>`);
      writeFileSync(join(out, "ATOMIC-NOTES.md"),
        "# Notes\n\n### Inspiration map\n\n| Reference | Take | Leave |\n| --- | --- | --- |\n| site-a.com | Photo ratios for the media frame | The navy palette and its claims voice |\n| site-b.com | Text-link CTAs over stacked buttons | The mega-menu depth |\n\n## Next\n");
      const r = script("grade-run.ts", "--run", run, "--eval", "0", "--json");
      const g = JSON.parse(r.stdout.toString());
      const get = (id: string) => g.expectations.find((e: { id: string }) => e.id === id);
      const problems = ["atom-ids-contiguous", "focus-visible-present", "inspiration-map-complete"]
        .filter((id) => get(id)?.passed !== true)
        .map((id) => `${id}: ${get(id)?.evidence}`);
      return problems.length ? problems.join(" | ") : null;
    },
  },
);

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function verify(root: string, stage: string) {
  const res = script("verify-stage.ts", "--target", root, "--stage", stage);
  return { code: res.exitCode, out: res.stdout.toString() + res.stderr.toString() };
}

if (import.meta.main) {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
  buildV1();
  buildV2();

  let holes = 0;

  // Sanity: the untouched fixtures must pass, or every "caught" below is meaningless.
  for (const [label, base] of [["v1", BASE_V1], ["v2", BASE_V2]] as const) {
    const clean = verify(base, "2");
    if (clean.code !== 0) {
      console.error(`✗ The unmodified ${label} fixture FAILS verification. Fix this before trusting any case below.\n`);
      console.error(clean.out);
      process.exit(1);
    }
    console.log(`✓ baseline ${label} fixture passes cleanly${clean.out.includes("⚠") ? " (with warnings)" : ""}`);
  }

  // Generated files are idempotent: a second build-index changes nothing.
  const again = script("build-index.ts", "--target", BASE_V2).stdout.toString();
  if (!/INDEX\.md[^\n]*unchanged/.test(again) || !/README\.md[^\n]*unchanged/.test(again)) {
    console.log("  ✗ build-index is not idempotent:\n" + again);
    holes++;
  } else console.log("✓ build-index is idempotent");
  try {
    const tj = JSON.parse(readFileSync(join(BASE_V2, DS, "tokens/tokens.json"), "utf8"));
    if (tj.alias?.primary?.["500"]?.$value !== "{brand.teal.500}") throw new Error("alias ref not preserved");
    if (!tj.mapped?.color?.text?.heading?.$extensions?.modes?.dark) throw new Error("dark mode missing");
    console.log("✓ tokens.json parses, keeps {refs} and modes");
  } catch (e) {
    console.log(`  ✗ tokens.json: ${(e as Error).message}`);
    holes++;
  }

  console.log("\nAdversarial cases — each breaks one thing and must be caught:\n");
  for (const [i, c] of CASES.entries()) {
    const root = join(ROOT, `case-${i}`);
    cpSync(c.fixture === "v1" ? BASE_V1 : BASE_V2, root, { recursive: true });
    c.break(root);
    const { code, out } = verify(root, c.stage ?? "2");
    const caught = code === 1 && out.includes("✗");
    const rightReason = caught && out.toLowerCase().includes(c.expect.toLowerCase());
    const tag = `[${c.fixture}]`;
    if (rightReason) {
      console.log(`  ✓ caught          ${tag} ${c.name}`);
    } else if (caught) {
      // Caught, but by a different check — the intended rule may still have a hole.
      holes++; // the intended rule may still have a hole
      console.log(`  ~ caught (other)  ${tag} ${c.name}`);
      console.log(`                    expected a "${c.expect}" failure; got: ${(out.match(/✗ [^\n]+/) ?? ["none"])[0].trim()}`);
    } else {
      console.log(`  ✗ MISSED          ${tag} ${c.name}`);
      holes++;
    }
    if (!keep) rmSync(root, { recursive: true, force: true });
  }

  console.log("\nWarning cases — must warn without failing the gate:\n");
  for (const [i, c] of WARN_CASES.entries()) {
    const root = join(ROOT, `warn-${i}`);
    cpSync(BASE_V2, root, { recursive: true });
    c.break(root);
    const { code, out } = verify(root, c.stage ?? "2");
    const warned = out.split("\n").some((l) => l.includes("⚠") && l.toLowerCase().includes(c.expect.toLowerCase()));
    // A new spec beyond the page's IDs is not an error; only the stale index is.
    if (warned && code === 0) console.log(`  ✓ warned          [v2] ${c.name}`);
    else {
      console.log(`  ✗ ${warned ? "FAILED GATE" : "NOT WARNED "}     [v2] ${c.name}`);
      holes++;
    }
    if (!keep) rmSync(root, { recursive: true, force: true });
  }

  console.log("\nLegacy mode (--legacy <dir>) — generic checks, no STATE.json:\n");
  {
    const base = join(ROOT, "legacy-base");
    buildLegacy(base);
    const clean = script("verify-stage.ts", "--legacy", base);
    if (clean.exitCode !== 0) {
      console.log(`  ✗ baseline legacy fixture fails:\n${clean.stdout}`);
      holes++;
    } else console.log("  ✓ baseline legacy fixture passes");
    for (const [i, c] of LEGACY_CASES.entries()) {
      const dir = join(ROOT, `legacy-${i}`);
      cpSync(base, dir, { recursive: true });
      c.break(dir);
      const res = script("verify-stage.ts", "--legacy", dir);
      const out = res.stdout.toString();
      if (res.exitCode === 1 && out.toLowerCase().includes(c.expect.toLowerCase())) console.log(`  ✓ caught          [legacy] ${c.name}`);
      else {
        console.log(`  ✗ MISSED          [legacy] ${c.name}`);
        holes++;
      }
      if (!keep) rmSync(dir, { recursive: true, force: true });
    }
    for (const [i, c] of LEGACY_PASS_CASES.entries()) {
      const dir = join(ROOT, `legacy-pass-${i}`);
      cpSync(base, dir, { recursive: true });
      c.change(dir);
      const res = script("verify-stage.ts", "--legacy", dir);
      if (res.exitCode === 0) console.log(`  ✓ green           [legacy] ${c.name}`);
      else {
        console.log(`  ✗ FALSE POSITIVE  [legacy] ${c.name}\n${res.stdout}`);
        holes++;
      }
      if (!keep) rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log("\nFalse-positive guards — must stay green:\n");
  for (const [i, c] of PASS_CASES.entries()) {
    const root = join(ROOT, `pass-${i}`);
    cpSync(BASE_V2, root, { recursive: true });
    await c.break(root);
    const { code, out } = verify(root, c.stage ?? "2");
    const flagged = out.split("\n").filter((l) => /^\s*[✗⚠]/.test(l)).join("\n");
    if (code === 0 && !flagged.includes(c.expect)) console.log(`  ✓ green           [v2] ${c.name}`);
    else {
      console.log(`  ✗ FALSE POSITIVE  [v2] ${c.name}\n${flagged}`);
      holes++;
    }
    if (!keep) rmSync(root, { recursive: true, force: true });
  }

  for (const [label, list] of [["init-system routing", INIT_CASES], ["export / build-index", TOOL_CASES]] as const) {
    console.log(`\n${label}:\n`);
    for (const [i, c] of list.entries()) {
      const dir = join(ROOT, `${label.split(" ")[0]}-${i}`);
      mkdirSync(dir, { recursive: true });
      const why = await c.run(dir);
      if (why === null) console.log(`  ✓ ${c.name}`);
      else {
        console.log(`  ✗ ${c.name}\n      ${why}`);
        holes++;
      }
      if (!keep) rmSync(dir, { recursive: true, force: true });
    }
  }

  const total =
    CASES.length + WARN_CASES.length + PASS_CASES.length + INIT_CASES.length + TOOL_CASES.length + LEGACY_CASES.length + LEGACY_PASS_CASES.length + 3;
  console.log();
  if (holes) console.log(`${holes} of ${total} check(s) failed — the gate or the scaffold has a hole.`);
  else
    console.log(
      `All ${total} checks behaved correctly (${CASES.length} caught, ${WARN_CASES.length} warned, ` +
        `${PASS_CASES.length} green, ${LEGACY_CASES.length + LEGACY_PASS_CASES.length + 1} legacy, ${INIT_CASES.length} init, ` +
        `${TOOL_CASES.length + 2} export/index).`,
    );
  if (keep) console.log(`Fixtures kept at ${ROOT}`);
  else rmSync(ROOT, { recursive: true, force: true });
  process.exit(holes ? 1 : 0);
}
