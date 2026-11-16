#!/usr/bin/env bun
/**
 * export-figma.ts — OPTIONAL. tokens/tokens.json → tokens/figma/<collection>.<mode>.json
 *
 * Not part of the gated ladder: most builds never touch Figma. Run it only when
 * someone wants the tokens as Figma Variables. It reads the generated
 * tokens.json (run build-index.ts or export-tokens.ts first) and never writes
 * STATE.json.
 *
 * One DTCG file per collection × mode, mirroring the tiers:
 *   brand.default.json        raw values
 *   alias.default.json        roles → {brand.*}
 *   mapped.<theme>.json       one per theme in STATE.json themes → {alias.*}
 *   responsive.desktop.json   type ramp, default values
 *   responsive.mobile.json    type ramp, mobile overrides applied
 *
 * Token paths keep their tier group (brand.blue.500, alias.primary.500 …) so a
 * reference in one file resolves against the token in another: import the
 * collections in tier order and Figma links the aliases across collections.
 *
 * Figma Variables only have colour, number, string and boolean types, so:
 *   - rem dimensions become px (1rem = 16px); em values stay as written
 *   - duration, cubicBezier and untyped tokens (shadows, clamp()) are left out
 *     and listed in figma/README.md — they stay in tokens.css / tokens.json
 *
 * Usage: bun export-figma.ts --target <repo> [--json]
 * Exit:  0 written · 1 tokens.json unusable · 2 cannot run
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const ti = argv.indexOf("--target");
const repo = resolve(ti !== -1 && argv[ti + 1] ? argv[ti + 1] : process.cwd());
const asJson = argv.includes("--json");

const root = join(repo, "design-system");
const jsonPath = join(root, "tokens", "tokens.json");
if (!existsSync(jsonPath)) {
  console.error(`✗ No design-system/tokens/tokens.json under ${repo}. Run build-index.ts (or export-tokens.ts) first.`);
  process.exit(2);
}

let tokens: Record<string, any>;
try {
  tokens = JSON.parse(readFileSync(jsonPath, "utf8"));
} catch (e) {
  console.error(`✗ tokens.json does not parse: ${(e as Error).message}`);
  process.exit(1);
}

const meta = tokens.$extensions?.["com.rdg.design-system"] ?? {};
const themes: string[] = Array.isArray(meta.themes) && meta.themes.length ? meta.themes : ["default"];
const defaultTheme: string = meta.defaultTheme ?? themes[0];

const FIGMA_TYPES = new Set(["color", "dimension", "number", "fontFamily", "fontWeight"]);
const skipped = new Set<string>();
/** Why each left-out token was left out, for figma/README.md. */
const skippedBy = new Map<string, Set<string>>();
function skip(path: string, node: Record<string, any>) {
  skipped.add(path);
  const v = JSON.stringify(node.$value ?? "");
  const reason = node.$deprecated
    ? "deprecated (old back-compat names — use the mapped token they point at)"
    : node.$type === "duration"
      ? "duration (no Figma variable type)"
      : node.$type === "cubicBezier"
        ? "easing / cubicBezier (no Figma variable type)"
        : /clamp\(/.test(v)
          ? "fluid clamp() (Figma variables hold one fixed value)"
          : /shadow/.test(path) || /\d+px\s+-?\d+px/.test(v)
            ? "shadow (no Figma variable type; recreate as an effect style)"
            : /em"$/.test(v)
              ? "em-relative values (letter-spacing etc.; set per text style)"
              : "untyped value";
  if (!skippedBy.has(reason)) skippedBy.set(reason, new Set());
  skippedBy.get(reason)!.add(path);
}

const remToPx = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  const m = v.match(/^(-?[\d.]+)rem$/);
  return m ? `${Number((Number(m[1]) * 16).toFixed(3))}px` : v;
};

/** Copy a tier group, choosing each token's value for `mode` (null = default). */
function pick(group: Record<string, any>, mode: string | null, path: string[]): Record<string, any> | null {
  const out: Record<string, any> = {};
  for (const key of Object.keys(group)) {
    if (key.startsWith("$")) continue;
    const node = group[key];
    if (node && typeof node === "object" && "$value" in node) {
      const type = node.$type as string | undefined;
      if (!type || !FIGMA_TYPES.has(type) || node.$deprecated) {
        skip([...path, key].join("."), node);
        continue;
      }
      const modes = node.$extensions?.modes ?? {};
      const overridden = !!mode && mode in modes;
      let value = overridden ? modes[mode!] : node.$value;
      if (type === "dimension") value = remToPx(value);
      const leaf: Record<string, unknown> = { $type: type, $value: value };
      // The trailing comment describes the default value; don't pin it on an override.
      if (node.$description && !overridden) leaf.$description = node.$description;
      out[key] = leaf;
    } else if (node && typeof node === "object") {
      const sub = pick(node, mode, [...path, key]);
      if (sub) out[key] = sub;
    }
  }
  return Object.keys(out).length ? out : null;
}

const collections: { file: string; tier: string; mode: string | null; label: string }[] = [
  { file: "brand.default.json", tier: "brand", mode: null, label: "Brand — raw values" },
  { file: "alias.default.json", tier: "alias", mode: null, label: "Alias — roles" },
  ...themes.map((t) => ({
    file: `mapped.${t}.json`,
    tier: "mapped",
    mode: t === defaultTheme ? null : t,
    label: `Mapped — ${t} theme`,
  })),
  { file: "responsive.desktop.json", tier: "responsive", mode: null, label: "Responsive — desktop" },
  { file: "responsive.mobile.json", tier: "responsive", mode: "mobile", label: "Responsive — mobile" },
];

const outDir = join(root, "tokens", "figma");
mkdirSync(outDir, { recursive: true });
const written: string[] = [];

for (const c of collections) {
  const group = tokens[c.tier];
  if (!group) continue;
  const body = pick(group, c.mode, [c.tier]) ?? {};
  const doc = {
    $description: `${c.label}. generated by scripts/export-figma.ts from tokens/tokens.json — do not hand-edit`,
    [c.tier]: body,
  };
  writeFileSync(join(outDir, c.file), JSON.stringify(doc, null, 2) + "\n");
  written.push(c.file);
}

// Modes with no collection here: themes become mapped.<theme>, mobile becomes
// responsive.mobile; anything else (reduced-motion, print …) is dropped.
const allModes: string[] = Array.isArray(meta.modes) ? meta.modes : [];
const droppedModes = allModes.filter((m) => !themes.includes(m) && m !== "mobile").sort();

const readme = `<!-- generated by scripts/export-figma.ts — do not hand-edit -->

# Figma export (optional)

These files are Figma-ready copies of \`../tokens.json\`, one W3C DTCG file per
collection × mode. \`../tokens.css\` stays canonical: change tokens there, then
re-run \`build-index.ts\` and \`export-figma.ts\`. Never edit these by hand, and
never edit variables in Figma expecting them to flow back.

| File | Figma collection | Mode |
|---|---|---|
${written.map((f) => { const [col, mode] = f.replace(/\.json$/, "").split("."); return `| \`${f}\` | ${col} | ${mode} |`; }).join("\n")}

## Import with Figma Variables (native)

Figma can import variables from DTCG \`.json\` files (Variables panel → import).
Order matters, because aliases resolve against collections that already exist:

1. \`brand.default.json\` → collection **brand**.
2. \`alias.default.json\` → collection **alias** (its values alias \`brand\`).
3. \`mapped.${defaultTheme}.json\` → collection **mapped**, mode **${defaultTheme}**${themes.length > 1 ? `; then add ${themes.filter((t) => t !== defaultTheme).map((t) => `mode **${t}** from \`mapped.${t}.json\``).join(", ")}` : ""}.
4. \`responsive.desktop.json\` → collection **responsive**, mode **desktop**; add mode **mobile** from \`responsive.mobile.json\`.

Paths keep their tier prefix (\`brand.blue.500\`, \`alias.primary.500\`), so a
reference like \`{alias.primary.600}\` in the mapped file links to the variable
imported from the alias file. If the importer in your Figma version rejects a
file, fall back to Tokens Studio below — do not hand-recreate variables.

## Fallback: Tokens Studio

Load \`../tokens.json\` (or these files as token sets) in the Tokens Studio
plugin, create one theme per mode, and export to Figma Variables from there.

## Not exported

Figma variables hold colour, number, string or boolean — one fixed value per
mode. rem is converted to px (1rem = 16px). Everything else stays in
\`../tokens.css\` / \`../tokens.json\`:

**Modes dropped:** ${droppedModes.length ? droppedModes.map((m) => `\`${m}\``).join(", ") + " — Figma has no media-query modes; the values live in tokens.css" : "none"}.

**Tokens left out (${skipped.size}):**
${skippedBy.size ? [...skippedBy.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([reason, set]) => `- ${reason}: ${[...set].sort().map((s) => `\`${s}\``).join(", ")}`).join("\n") : "- none"}

Mapped layout tokens with a mobile override (gutter, section space) export their
desktop value only; the mobile value lives in tokens.css.
`;
writeFileSync(join(outDir, "README.md"), readme);

if (asJson) {
  console.log(JSON.stringify({ target: repo, written: [...written, "README.md"], skipped: [...skipped].sort() }, null, 2));
} else {
  console.log(`✓ ${written.length} collection file(s) + README.md → design-system/tokens/figma/`);
  for (const f of written) console.log(`    + ${f}`);
  if (skipped.size) console.log(`  ${skipped.size} token(s) with no Figma variable type left out (listed in figma/README.md)`);
}
