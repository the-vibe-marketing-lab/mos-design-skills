#!/usr/bin/env bun
/**
 * export-tokens.ts — tokens/tokens.css → tokens/tokens.json + tokens/TOKENS.md
 *
 * tokens.css is canonical; these two files are views of it for machines and
 * for people. Both are regenerated from scratch every run and carry a
 * "do not hand-edit" header. Output is deterministic: tokens in source order,
 * mode keys sorted, no timestamps — so an unchanged tokens.css produces a
 * byte-identical diff-free export.
 *
 * tokens.json follows the W3C Design Tokens Community Group (DTCG) format:
 *   - top-level groups are the tiers: brand, alias, mapped, responsive
 *   - the tier prefix is dropped inside brand/alias, so --brand-blue-500 is
 *     brand.blue.500 and --alias-primary-500 is alias.primary.500; mapped and
 *     responsive keep their full name (--color-text-body → mapped.color.text.body)
 *   - a name that would be both a token and a group (color-text-action vs
 *     color-text-action-hover) keeps the tail hyphenated: color.text.action-hover
 *   - var() references become DTCG aliases, e.g. "{brand.blue.500}"
 *   - $type is one of color, dimension, fontFamily, fontWeight, duration,
 *     cubicBezier, number — inferred from the resolved value; omitted when none
 *     fits (shadows, clamp()), so no tool is lied to
 *   - dimensions and durations stay CSS strings ("1rem", "200ms")
 *
 * DEPRECATED. Tokens inside the /* @deprecated *\/ block at the end of the
 * mapped tier (old names kept for back-compat) get "$deprecated": true and a
 * table of their own in TOKENS.md.
 *
 * Declarations may wrap over several lines; a comment inside a wrapped value
 * (or on the line the value ends) becomes that token's $description.
 *
 * MODES. DTCG has no native modes yet, so non-default values live under the
 * token's $extensions as { "modes": { "<mode>": <value> } }. $value is always
 * the default (the :root value, i.e. STATE.json themes[0]). Mode names:
 *   - a theme name ("dark", "light") from [data-theme="…"] blocks
 *   - "mobile" from the @media (max-width) override in the responsive tier
 *   - "reduced-motion" from @media (prefers-reduced-motion: reduce)
 * The root $extensions["com.rdg.design-system"] lists defaultTheme, themes and
 * modes so a consumer (export-figma.ts, Tokens Studio) can split collections.
 *
 * Usage: bun export-tokens.ts --target <repo> [--json]
 * Exit:  0 written · 1 tokens.css has unresolved placeholders or no tiers · 2 cannot run
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const TIERS = ["brand", "alias", "mapped", "responsive"] as const;
export type Tier = (typeof TIERS)[number];

export interface TierMarker {
  tier: Tier;
  line: number;
}

export interface Decl {
  name: string;
  value: string;
  comment: string | null;
  /** "default", a theme name, "mobile", "reduced-motion", or a raw media query. */
  mode: string;
  /** How a theme mode was declared: attribute block or prefers-color-scheme media. */
  via: "root" | "attr" | "media";
  tier: Tier | null;
  /** Inside the "@deprecated" block: an old name kept for back-compat. */
  deprecated: boolean;
  line: number;
}

export interface Token {
  name: string;
  tier: Tier | null;
  deprecated: boolean;
  value: string;
  comment: string | null;
  line: number;
  modes: Record<string, string>;
}

export interface ParsedTokens {
  markers: TierMarker[];
  decls: Decl[];
  tokens: Map<string, Token>;
  /** Themes declared via [data-theme="x"] blocks. */
  attrThemes: Set<string>;
  /** Themes declared via @media (prefers-color-scheme: x) :root:not([data-theme]). */
  mediaThemes: Set<string>;
  /** First word of the :root color-scheme, if any. */
  rootScheme: string | null;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

function modeOf(stack: string[]): { mode: string; via: Decl["via"] } | null {
  const media = stack.filter((s) => s.startsWith("@media"));
  const sel = stack.filter((s) => !s.startsWith("@")).at(-1) ?? "";
  const attr = sel.match(/\[data-theme=["']?([\w-]+)["']?\]/);
  if (attr && !/:not\(\s*\[data-theme/.test(sel)) return { mode: attr[1], via: "attr" };
  if (!/^:root\b/.test(sel.trim())) return null; // component rules are not tokens
  if (!media.length) return { mode: "default", via: "root" };
  const q = media.join(" and ");
  const scheme = q.match(/prefers-color-scheme:\s*([\w-]+)/);
  if (scheme) return { mode: scheme[1], via: "media" };
  if (/prefers-reduced-motion/.test(q)) return { mode: "reduced-motion", via: "media" };
  if (/max-width/.test(q)) return { mode: "mobile", via: "media" };
  return { mode: q.replace(/^@media\s*/, "").replace(/\s+/g, " "), via: "media" };
}

export function parseTokensCss(css: string): ParsedTokens {
  const markers: TierMarker[] = [];
  const decls: Decl[] = [];
  const attrThemes = new Set<string>();
  const mediaThemes = new Set<string>();
  let rootScheme: string | null = null;

  const stack: string[] = [];
  let buf = "";
  let bufLine = 1;
  let line = 1;
  let tier: Tier | null = null;
  let last: { decl: Decl; endLine: number } | null = null;
  // The deprecated block: from a top-level /* @deprecated */ marker until the
  // next @tier marker, or from one inside a block until that block closes.
  let deprecatedTop = false;
  let deprecatedDepth: number | null = null;
  // A comment met mid-value (wrapped declarations) documents that declaration.
  let pendingComment: string | null = null;

  const flushDecl = () => {
    const text = buf.trim();
    buf = "";
    const comment = pendingComment;
    pendingComment = null;
    if (!text || !stack.length) return;
    const m = text.match(/^(--[\w-]+)\s*:\s*([\s\S]*)$/);
    const ctx = modeOf(stack);
    if (!ctx) return;
    if (!m) {
      const cs = text.match(/^color-scheme\s*:\s*([\s\S]+)$/);
      if (cs && ctx.mode === "default" && !rootScheme) rootScheme = cs[1].trim().split(/\s+/)[0];
      return;
    }
    if (ctx.via === "attr") attrThemes.add(ctx.mode);
    const isScheme = ctx.via === "media" && /prefers-color-scheme/.test(stack.join(" "));
    if (isScheme) mediaThemes.add(ctx.mode);
    const decl: Decl = {
      name: m[1],
      value: m[2].replace(/\s+/g, " ").trim(),
      comment,
      mode: ctx.mode,
      via: ctx.via,
      tier,
      deprecated: deprecatedTop || (deprecatedDepth !== null && stack.length >= deprecatedDepth),
      line: bufLine,
    };
    decls.push(decl);
    last = { decl, endLine: line };
  };

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end;
      const text = css.slice(i + 2, stop).trim();
      const startLine = line;
      const marker = text.match(/^@tier\s+(brand|alias|mapped|responsive)\b/);
      if (marker && stack.length === 0) {
        tier = marker[1] as Tier;
        markers.push({ tier, line: startLine });
        deprecatedTop = false;
      } else if (/^@deprecated\b/.test(text)) {
        if (stack.length === 0) deprecatedTop = true;
        else deprecatedDepth = stack.length;
      } else if (buf.trim()) {
        // Inside a wrapped value: keep the comment for the declaration being read.
        pendingComment = text.replace(/\s+/g, " ");
      } else if (last && last.endLine === startLine) {
        // A trailing comment on the same line documents the declaration.
        last.decl.comment = text.replace(/\s+/g, " ");
      }
      for (let j = i; j < stop; j++) if (css[j] === "\n") line++;
      i = stop + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = css.indexOf(ch, i + 1);
      const stop = end === -1 ? css.length - 1 : end;
      if (!buf.trim()) bufLine = line;
      buf += css.slice(i, stop + 1);
      i = stop;
      continue;
    }
    if (ch === "\n") line++;
    if (ch === "{") {
      stack.push(buf.trim().replace(/\s+/g, " "));
      buf = "";
      last = null;
      continue;
    }
    if (ch === "}") {
      flushDecl();
      if (deprecatedDepth !== null && stack.length <= deprecatedDepth) deprecatedDepth = null;
      stack.pop();
      buf = "";
      last = null;
      continue;
    }
    if (ch === ";") {
      flushDecl();
      continue;
    }
    if (!buf.trim() && !/\s/.test(ch)) bufLine = line;
    buf += ch;
  }

  // Fold declarations into tokens. The tier is where the DEFAULT (:root)
  // declaration sits; a mobile override of a mapped token stays mapped.
  const tokens = new Map<string, Token>();
  for (const d of decls) {
    if (d.mode !== "default") continue;
    const existing = tokens.get(d.name);
    if (existing) {
      existing.value = d.value; // later :root wins, as in the cascade
      existing.comment = d.comment ?? existing.comment;
      continue;
    }
    tokens.set(d.name, {
      name: d.name,
      tier: d.tier,
      deprecated: d.deprecated,
      value: d.value,
      comment: d.comment,
      line: d.line,
      modes: {},
    });
  }
  for (const d of decls) {
    if (d.mode === "default") continue;
    const t = tokens.get(d.name);
    if (!t) {
      // Declared only inside a mode block: surface it rather than drop it.
      // $value falls back to the first mode's value so no consumer ever sees "".
      const note = `declared only in mode "${d.mode}"`;
      tokens.set(d.name, {
        name: d.name,
        tier: d.tier,
        deprecated: d.deprecated,
        value: d.value,
        comment: d.comment ? `${d.comment} (${note})` : note,
        line: d.line,
        modes: { [d.mode]: d.value },
      });
      continue;
    }
    // The [data-theme] block is authoritative; the media copy mirrors it.
    if (d.via === "media" && d.mode in t.modes) continue;
    t.modes[d.mode] = d.value;
  }

  return { markers, decls, tokens, attrThemes, mediaThemes, rootScheme };
}

// ---------------------------------------------------------------------------
// Names → DTCG paths
// ---------------------------------------------------------------------------

export function tokenPaths(tokens: Iterable<Token>): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  for (const t of tokens) {
    const bare = t.name.replace(/^--/, "");
    const tier = t.tier ?? "mapped";
    const rest = tier === "brand" || tier === "alias" ? bare.replace(new RegExp(`^${tier}-`), "") : bare;
    paths.set(t.name, [tier, ...rest.split("-")]);
  }
  // Resolve token-vs-group collisions: if A's path is a strict prefix of B's,
  // B's tail joins onto A's last segment with a hyphen. Repeat to a fixpoint.
  let changed = true;
  while (changed) {
    changed = false;
    const entries = [...paths.entries()];
    for (const [, a] of entries) {
      for (const [bn, b] of entries) {
        if (b.length > a.length && a.every((seg, i) => b[i] === seg)) {
          paths.set(bn, [...a.slice(0, -1), [a.at(-1), ...b.slice(a.length)].join("-")]);
          changed = true;
        }
      }
      if (changed) break;
    }
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Values and types
// ---------------------------------------------------------------------------

export interface VarRef {
  name: string;
  /** Raw fallback text after the comma, or null. May itself contain var(). */
  fallback: string | null;
  start: number;
  /** Index just past the closing paren. */
  end: number;
}

/**
 * Top-level var() references in a value, found with a balanced-paren scan so
 * nested fallbacks — var(--a, var(--b, calc(1px + 2px))) — are one reference,
 * not three mangled ones. Quoted strings are skipped.
 */
export function scanVars(value: string): VarRef[] {
  const out: VarRef[] = [];
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf("var(", i);
    if (at === -1) break;
    if (at > 0 && /[\w-]/.test(value[at - 1])) {
      i = at + 4;
      continue;
    }
    let depth = 0;
    let comma = -1;
    let j = at + 3;
    let quote: string | null = null;
    for (; j < value.length; j++) {
      const c = value[j];
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) break;
      } else if (c === "," && depth === 1 && comma === -1) comma = j;
    }
    out.push({
      name: value.slice(at + 4, comma === -1 ? j : comma).trim(),
      fallback: comma === -1 ? null : value.slice(comma + 1, j).trim(),
      start: at,
      end: Math.min(j + 1, value.length),
    });
    i = j + 1;
  }
  return out;
}

/** The referenced name when the whole value is a single var(), else null. */
export function varOnly(value: string): string | null {
  const v = value.trim();
  const refs = scanVars(v);
  return refs.length === 1 && refs[0].start === 0 && refs[0].end === v.length ? refs[0].name : null;
}

/** Replace every top-level var() with fn(ref); text outside var() is kept. */
export function mapVars(value: string, fn: (r: VarRef) => string): string {
  let out = "";
  let last = 0;
  for (const r of scanVars(value)) {
    out += value.slice(last, r.start) + fn(r);
    last = r.end;
  }
  return out + value.slice(last);
}
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|hwb)\(.*\)|transparent|currentcolor|white|black)$/i;

export function resolveLiteral(
  tokens: Map<string, Token>,
  name: string,
  mode = "default",
  seen = new Set<string>(),
): string | null {
  const t = tokens.get(name);
  if (!t || seen.has(name)) return null;
  seen.add(name);
  const v = mode !== "default" && mode in t.modes ? t.modes[mode] : t.value;
  const ref = varOnly(v);
  // A theme override on a mapped token points at alias/brand tokens, which
  // have no theme values of their own — so resolve the rest in default mode.
  return ref ? resolveLiteral(tokens, ref, "default", seen) : v;
}

type DtcgType = "color" | "dimension" | "fontFamily" | "fontWeight" | "duration" | "cubicBezier" | "number";

export function inferType(name: string, literal: string | null): DtcgType | null {
  if (literal == null) return null;
  const v = literal.trim();
  if (/weight/.test(name) && /^\d{3}$/.test(v)) return "fontWeight";
  // Only a family name is a fontFamily: --font-size-*, --font-weight-* etc. are not.
  if (/(^|-)font(-|$)/.test(name.replace(/^--/, "")) && !/(weight|size|leading|line-height|tracking)/.test(name)) return "fontFamily";
  if (COLOR.test(v)) return "color";
  if (/^cubic-bezier\(/.test(v)) return "cubicBezier";
  if (/^-?[\d.]+m?s$/.test(v)) return "duration";
  // em is relative to the element, not a fixed dimension — leave it untyped.
  if (/^-?[\d.]+(px|rem)$/.test(v)) return "dimension";
  if (v === "0" && /(scale|space|radius|width|size|offset|gutter|container)/.test(name)) return "dimension";
  if (/^-?[\d.]+$/.test(v)) return "number";
  return null;
}

function dtcgValue(raw: string, type: DtcgType | null, paths: Map<string, string[]>): unknown {
  const ref = varOnly(raw);
  if (ref && paths.has(ref)) return `{${paths.get(ref)!.join(".")}}`;
  // Embedded references (calc, color-mix) stay strings with {refs} inlined.
  if (/var\(/.test(raw)) {
    return mapVars(raw, (r) => (paths.has(r.name) ? `{${paths.get(r.name)!.join(".")}}` : raw.slice(r.start, r.end)));
  }
  switch (type) {
    case "cubicBezier": {
      const nums = raw.match(/-?[\d.]+/g)?.map(Number) ?? [];
      return nums.length === 4 ? nums : raw;
    }
    case "fontFamily":
      return raw.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    case "fontWeight":
    case "number":
      return Number(raw);
    case "dimension":
      return raw === "0" ? "0px" : raw;
    default:
      return raw;
  }
}

// ---------------------------------------------------------------------------
// Build outputs
// ---------------------------------------------------------------------------

export interface ExportOptions {
  themes?: string[];
}

export interface ExportResult {
  json: Record<string, unknown>;
  md: string;
  defaultTheme: string;
  themes: string[];
  modes: string[];
  count: number;
}

export function buildExport(parsed: ParsedTokens, opts: ExportOptions = {}): ExportResult {
  const { tokens } = parsed;
  const paths = tokenPaths(tokens.values());

  const declaredThemes = [...new Set([...parsed.attrThemes, ...parsed.mediaThemes])].sort();
  const defaultTheme = opts.themes?.[0] ?? parsed.rootScheme ?? (declaredThemes.includes("light") ? "dark" : "light");
  const themes = opts.themes?.length ? opts.themes : [defaultTheme, ...declaredThemes.filter((t) => t !== defaultTheme)];
  const modes = [...new Set([...tokens.values()].flatMap((t) => Object.keys(t.modes)))].sort();

  const json: Record<string, any> = {
    $description: "generated by scripts/export-tokens.ts from tokens/tokens.css — do not hand-edit",
    $extensions: {
      "com.rdg.design-system": {
        source: "tokens/tokens.css",
        defaultTheme,
        themes,
        modes,
        modesNote: 'non-default values live in each token\'s $extensions.modes; $value is the default',
      },
    },
  };
  for (const tier of TIERS) json[tier] = {};

  for (const t of tokens.values()) {
    const path = paths.get(t.name)!;
    const type = inferType(t.name, resolveLiteral(tokens, t.name));
    const node: Record<string, unknown> = {};
    if (type) node.$type = type;
    node.$value = dtcgValue(t.value, type, paths);
    if (t.comment) node.$description = t.comment;
    if (t.deprecated) node.$deprecated = true;
    const modeKeys = Object.keys(t.modes).sort();
    if (modeKeys.length) {
      node.$extensions = {
        modes: Object.fromEntries(modeKeys.map((m) => [m, dtcgValue(t.modes[m], type, paths)])),
      };
    }
    let group = json as Record<string, any>;
    for (const seg of path.slice(0, -1)) group = group[seg] ??= {};
    group[path.at(-1)!] = node;
  }

  // ---- TOKENS.md
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const md: string[] = [
    "<!-- generated by scripts/export-tokens.ts from tokens/tokens.css — do not hand-edit -->",
    "",
    "# Tokens",
    "",
    `Canonical source: \`tokens/tokens.css\`. Machine-readable: \`tokens/tokens.json\` (W3C DTCG).`,
    `Default theme: **${defaultTheme}**${themes.length > 1 ? ` · other themes: ${themes.filter((t) => t !== defaultTheme).join(", ")}` : ""}.`,
    `Components use **mapped** and **responsive** tokens only; mapped → alias → brand.`,
    "",
  ];
  const TITLES: Record<Tier, string> = {
    brand: "Brand — raw values, no roles",
    alias: "Alias — roles, theme-agnostic",
    mapped: "Mapped — what components use (changes per theme)",
    responsive: "Responsive — type ramp, desktop default + mobile override",
  };
  const groups: [string, Token[]][] = [
    ...TIERS.map((tier): [string, Token[]] => [
      TITLES[tier],
      [...tokens.values()].filter((t) => (t.tier ?? "mapped") === tier && !t.deprecated),
    ]),
    ["Deprecated — old names kept for back-compat; use the mapped token they point at", [...tokens.values()].filter((t) => t.deprecated)],
  ];
  for (const [title, rows] of groups) {
    if (!rows.length) continue;
    md.push(`## ${title}`, "", `| Token | Value (${defaultTheme}) | Other modes | Resolved | Notes |`, "|---|---|---|---|---|");
    for (const t of rows) {
      const lit = resolveLiteral(tokens, t.name) ?? "";
      const other = Object.keys(t.modes)
        .sort()
        .map((m) => {
          const r = resolveLiteral(tokens, t.name, m);
          return `${m}: \`${esc(t.modes[m])}\`${r && r !== t.modes[m] ? ` → \`${esc(r)}\`` : ""}`;
        })
        .join("<br>");
      md.push(
        `| \`${t.name}\` | \`${esc(t.value)}\` | ${other} | ${lit && lit !== t.value ? `\`${esc(lit)}\`` : ""} | ${esc(t.comment ?? "")} |`,
      );
    }
    md.push("");
  }

  return { json, md: md.join("\n"), defaultTheme, themes, modes, count: tokens.size };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function readThemes(root: string): string[] | undefined {
  const sp = join(root, "STATE.json");
  if (!existsSync(sp)) return undefined;
  try {
    const s = JSON.parse(readFileSync(sp, "utf8"));
    return Array.isArray(s.themes) && s.themes.length ? s.themes : undefined;
  } catch {
    return undefined;
  }
}

/** Run the export for a repo. Returns an exit code and messages. */
export function exportTokens(repo: string): { code: 0 | 1 | 2; messages: string[]; result?: ExportResult } {
  const root = join(repo, "design-system");
  const cssPath = join(root, "tokens", "tokens.css");
  if (!existsSync(cssPath)) {
    return { code: 2, messages: [`✗ No design-system/tokens/tokens.css under ${repo} — export-tokens is for v2 (schemaVersion 2) systems.`] };
  }
  const css = readFileSync(cssPath, "utf8");
  const unresolved = [...new Set(css.match(/\{\{[A-Z0-9_]+\}\}/g) ?? [])];
  if (unresolved.length) {
    return {
      code: 1,
      messages: [`✗ tokens.css still has ${unresolved.length} placeholder(s) (${unresolved.slice(0, 5).join(", ")}…). Resolve them at Stage 1, then export.`],
    };
  }
  const parsed = parseTokensCss(css);
  if (!parsed.markers.length) {
    return { code: 1, messages: ["✗ tokens.css has no /* @tier … */ markers — nothing to group by."] };
  }
  const result = buildExport(parsed, { themes: readThemes(root) });
  writeFileSync(join(root, "tokens", "tokens.json"), JSON.stringify(result.json, null, 2) + "\n");
  writeFileSync(join(root, "tokens", "TOKENS.md"), result.md);
  return {
    code: 0,
    messages: [
      `✓ ${result.count} tokens → design-system/tokens/tokens.json + TOKENS.md (default theme: ${result.defaultTheme}; modes: ${result.modes.join(", ") || "none"})`,
    ],
    result,
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--target");
  const repo = resolve(i !== -1 && argv[i + 1] ? argv[i + 1] : process.cwd());
  const out = exportTokens(repo);
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ code: out.code, messages: out.messages, count: out.result?.count ?? 0 }, null, 2));
  } else {
    for (const m of out.messages) (out.code ? console.error : console.log)(m);
  }
  process.exit(out.code);
}
