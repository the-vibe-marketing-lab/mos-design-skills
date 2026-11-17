#!/usr/bin/env bun
// Readiness check for building a website with MarketingOS + EmDash.
// Reports what is installed and signed in. Never prints secret values:
// tokens are reported only as present or absent.
//
//   bun check-setup.ts            human-readable card
//   bun check-setup.ts --json     machine-readable result
//   bun check-setup.ts --brain <dir>   folder to run `mos status` in (default: cwd)

type Status = "ready" | "missing" | "attention";
interface Item { id: string; label: string; status: Status; detail: string; fix?: string }

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const brainIdx = args.indexOf("--brain");
const brainDir = brainIdx >= 0 ? args[brainIdx + 1] : process.cwd();

function run(cmd: string[], opts: { cwd?: string; timeoutMs?: number; env?: Record<string, string | undefined> } = {}): { ok: boolean; out: string; found: boolean } {
  try {
    const p = Bun.spawnSync(cmd, { cwd: opts.cwd, stdout: "pipe", stderr: "pipe", timeout: opts.timeoutMs ?? 20000, env: opts.env ?? process.env });
    const out = (p.stdout.toString() + "\n" + p.stderr.toString()).trim();
    return { ok: p.exitCode === 0, out, found: true };
  } catch {
    return { ok: false, out: "", found: false };
  }
}

const has = (bin: string) => Bun.which(bin) !== null;
const items: Item[] = [];

// Git
if (!has("git")) items.push({ id: "git", label: "Git", status: "missing", detail: "not installed", fix: "Git" });
else {
  const name = run(["git", "config", "--global", "user.name"]).out;
  const email = run(["git", "config", "--global", "user.email"]).out;
  items.push(name && email
    ? { id: "git", label: "Git", status: "ready", detail: run(["git", "--version"]).out }
    : { id: "git", label: "Git", status: "attention", detail: "installed, but commit name or email not set", fix: "Git" });
}

// Node
if (!has("node") || !has("npm")) items.push({ id: "node", label: "Node and npm", status: "missing", detail: "not installed", fix: "Node and npm" });
else {
  const v = run(["node", "--version"]).out.replace(/^v/, "");
  const major = parseInt(v.split(".")[0] ?? "0", 10);
  items.push(major >= 20
    ? { id: "node", label: "Node and npm", status: "ready", detail: `Node ${v}` }
    : { id: "node", label: "Node and npm", status: "attention", detail: `Node ${v} is too old; EmDash needs 20 or newer`, fix: "Node and npm" });
}

// Bun (if this script runs, Bun exists)
items.push({ id: "bun", label: "Bun", status: "ready", detail: `Bun ${Bun.version}` });

// GitHub
if (!has("gh")) items.push({ id: "github", label: "GitHub", status: "missing", detail: "GitHub CLI (gh) not installed", fix: "GitHub CLI and sign-in" });
else {
  const st = run(["gh", "auth", "status", "--hostname", "github.com"]);
  if (!st.ok) items.push({ id: "github", label: "GitHub", status: "missing", detail: "not signed in", fix: "GitHub CLI and sign-in" });
  else {
    const user = run(["gh", "api", "user", "--jq", ".login"]).out.split("\n")[0] || "unknown";
    const scopesLine = st.out.split("\n").find((l) => /scopes/i.test(l)) ?? "";
    const missingScopes = ["repo", "workflow"].filter((s) => scopesLine && !new RegExp(`'${s}'`).test(scopesLine));
    const helper = run(["git", "config", "--global", "--get-all", "credential.https://github.com.helper"]).out;
    const problems: string[] = [];
    if (missingScopes.length) problems.push(`missing scope: ${missingScopes.join(", ")}`);
    if (!/gh/.test(helper)) problems.push("git not using the gh login (run gh auth setup-git)");
    items.push(problems.length
      ? { id: "github", label: "GitHub", status: "attention", detail: `signed in as ${user}; ${problems.join("; ")}`, fix: "GitHub CLI and sign-in" }
      : { id: "github", label: "GitHub", status: "ready", detail: `signed in as ${user}` });
  }
}

// Cloudflare
{
  const tokenSet = Boolean(process.env.CLOUDFLARE_API_TOKEN);
  const cmd = has("wrangler") ? ["wrangler", "whoami"] : has("npx") ? ["npx", "--yes", "wrangler@latest", "whoami"] : null;
  if (!cmd) items.push({ id: "cloudflare", label: "Cloudflare", status: "missing", detail: "needs Node first (Wrangler runs through npx)", fix: "Cloudflare (Wrangler) sign-in" });
  else {
    // Wrangler reads a .env in the folder it runs from, so a stale token there can
    // hide a working browser login. Check in the brain folder, then from a neutral one.
    // Bun itself auto-loads a .env from the current folder into process.env, so the
    // neutral check also drops the Cloudflare token variables to test the browser login alone.
    const loginOnlyEnv = { ...process.env, CLOUDFLARE_API_TOKEN: undefined, CLOUDFLARE_API_KEY: undefined, CLOUDFLARE_EMAIL: undefined };
    const who = (cwd: string, env?: Record<string, string | undefined>) => {
      const w = run(cmd, { cwd, timeoutMs: 90000, env });
      const email = w.out.match(/associated with the email\s+(\S+?)\.?\s*$/m)?.[1] ?? w.out.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
      const account = w.out.match(/│\s*([^│\n]+?)\s*│\s*[0-9a-f]{32}\s*│/)?.[1];
      const signedIn = w.ok && !!email && !/Invalid access token|not authenticated|You are not logged in/i.test(w.out);
      return { signedIn, email, account, rejected: /Invalid access token|9109/.test(w.out) };
    };
    const here = who(brainDir);
    const neutral = here.signedIn ? here : who(require("node:os").tmpdir(), loginOnlyEnv);
    const name = (r: typeof here) => [r.email, r.account && `account "${r.account}"`].filter(Boolean).join(", ");
    if (here.signedIn) {
      items.push({ id: "cloudflare", label: "Cloudflare", status: "ready", detail: `signed in as ${name(here)}. Confirm this is the account the website belongs to` });
    } else if (neutral.signedIn) {
      items.push({ id: "cloudflare", label: "Cloudflare", status: "attention", detail: `signed in as ${name(neutral)}, but a rejected token in this folder's .env or environment overrides it`, fix: "Cloudflare (Wrangler) sign-in" });
    } else items.push({ id: "cloudflare", label: "Cloudflare", status: "missing", detail: here.rejected || tokenSet ? "an API token is set but Cloudflare rejected it" : "not signed in", fix: "Cloudflare (Wrangler) sign-in" });
  }
}

// MarketingOS
if (!has("mos")) items.push({ id: "mos", label: "MarketingOS", status: "missing", detail: "mos CLI not installed", fix: "MarketingOS CLI, skills and brain" });
else {
  const ver = run(["mos", "--version"]).out;
  const st = run(["mos", "status"], { cwd: brainDir, timeoutMs: 60000 });
  const notBrain = /not (a|inside a) (marketing|brain)|no brain|could not find/i.test(st.out);
  const errors = (st.out.match(/\[error\]/g) ?? []).length;
  const warnings = (st.out.match(/\[warning\]/g) ?? []).length;
  if (notBrain) items.push({ id: "mos", label: "MarketingOS", status: "attention", detail: `${ver}; no brain found in ${brainDir}`, fix: "MarketingOS CLI, skills and brain" });
  else if (errors) items.push({ id: "mos", label: "MarketingOS", status: "attention", detail: `${ver}; brain has ${errors} error(s), ${warnings} warning(s)`, fix: "MarketingOS CLI, skills and brain" });
  else items.push({ id: "mos", label: "MarketingOS", status: "ready", detail: `${ver}; brain OK${warnings ? ` (${warnings} warnings, not blocking)` : ""}` });
}

const ready = items.every((i) => i.status === "ready");
if (asJson) console.log(JSON.stringify({ ready, brainDir, items }, null, 2));
else {
  const mark: Record<Status, string> = { ready: "READY    ", missing: "MISSING  ", attention: "ATTENTION" };
  for (const i of items) console.log(`${mark[i.status]}  ${i.label.padEnd(14)} ${i.detail}${i.fix ? `  -> fixes.md: ${i.fix}` : ""}`);
  console.log(ready ? "\nAll set. Next: create the site with EmDash, then run mos-design-site-planner." : "\nNot ready yet. Fix the items above in order, then run this again.");
}
process.exit(ready ? 0 : 1);
