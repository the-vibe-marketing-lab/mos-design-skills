#!/usr/bin/env bun
/**
 * check-skill.ts: package hygiene for mos-design-site-planner.
 *
 * The pack-level scripts/check-package.mjs covers mos-atomic-design-system
 * only, so this runs the equivalent checks for this skill: identity, required
 * files, portable paths, resolvable relative links, valid evals, no em dashes
 * and no private business names.
 *
 * Usage: bun check-skill.ts
 * Exit:  0 clean · 1 one or more errors
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NAME = "mos-design-site-planner";
const errors: string[] = [];

const REQUIRED = [
  "SKILL.md",
  "agents/openai.yaml",
  "evals/evals.json",
  "references/interview.md",
  "references/research.md",
  "references/page-rules.md",
  "references/output-format.md",
  "scripts/check-site-plan.ts",
  "scripts/test-check-site-plan.ts",
  "scripts/fixtures/valid-plan/site-plan.md",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

for (const file of REQUIRED) if (!existsSync(join(SKILL, file))) errors.push(`missing ${file}`);

// Built from parts so this file does not match its own checks.
const EM_DASH = String.fromCharCode(0x2014);
const PRIVATE_NAMES = new RegExp(["Rumble", "Digital"].join(" ") + "|" + ["Prosperity", "Media"].join(" "), "i");

const files = walk(SKILL);
for (const file of files) {
  const rel = relative(SKILL, file);
  const text = readFileSync(file, "utf8");
  if (/C:[/\\]Users[/\\]|\/mnt\/c\/Users|~\/Desktop|\/home\/[a-z]/.test(text)) errors.push(`${rel}: private workspace path`);
  if (text.includes(EM_DASH)) errors.push(`${rel}: contains an em dash`);
  if (PRIVATE_NAMES.test(text)) errors.push(`${rel}: names a private business`);
  // Templates link to files generated in the target project, so skip them.
  if (!file.endsWith(".md") || rel.startsWith(`assets${sep}`)) continue;
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^(?:https?:|#|mailto:)/.test(link) || link.includes("<")) continue;
    if (!existsSync(resolve(dirname(file), link.split("#")[0]))) errors.push(`${rel}: missing linked file ${link}`);
  }
}

const entry = existsSync(join(SKILL, "SKILL.md")) ? readFileSync(join(SKILL, "SKILL.md"), "utf8") : "";
const front = /^---\n([\s\S]*?)\n---/.exec(entry)?.[1] ?? "";
if (!new RegExp(`^name: ${NAME}$`, "m").test(front)) errors.push(`SKILL.md frontmatter name is not ${NAME}`);
const description = /^description: "?(.*?)"?$/m.exec(front)?.[1] ?? "";
if (description.length === 0) errors.push("SKILL.md has no description");
if (description.length > 1024) errors.push(`SKILL.md description is ${description.length} characters (limit 1024)`);

const agents = existsSync(join(SKILL, "agents/openai.yaml")) ? readFileSync(join(SKILL, "agents/openai.yaml"), "utf8") : "";
if (!agents.includes(`$${NAME}`)) errors.push(`agents/openai.yaml default_prompt does not invoke $${NAME}`);

type EvalCase = { id: number; name: string; prompt: string; expected_output: string };
type Assertion = { id: string; text: string; applies_to: number[] };
type Evals = { skill_name: string; evals: EvalCase[]; assertions: Assertion[] };
try {
  const evals = JSON.parse(readFileSync(join(SKILL, "evals/evals.json"), "utf8")) as Evals;
  if (evals.skill_name !== NAME) errors.push(`evals.json skill_name is not ${NAME}`);
  const ids = new Set(evals.evals.map((e) => e.id));
  for (const e of evals.evals) if (!e.prompt || !e.expected_output) errors.push(`eval ${e.id} is missing prompt or expected_output`);
  for (const a of evals.assertions) {
    for (const id of a.applies_to) if (!ids.has(id)) errors.push(`assertion ${a.id} applies to unknown eval ${id}`);
  }
} catch (e) {
  errors.push(`evals/evals.json does not parse: ${(e as Error).message}`);
}

console.log(JSON.stringify({ skill: NAME, files: files.length, errors, passed: errors.length === 0 }, null, 2));
if (errors.length) process.exitCode = 1;
