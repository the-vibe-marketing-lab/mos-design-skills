#!/usr/bin/env bun
// Runs check-setup.ts on a bare PATH (a fresh computer) and checks it reports
// every tool as missing, exits 1, and prints nothing that looks like a secret.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const home = mkdtempSync(join(tmpdir(), "mos-auth-test-"));
const bunDir = dirname(process.execPath);
const p = Bun.spawnSync([process.execPath, join(here, "check-setup.ts"), "--json"], {
  cwd: home,
  env: { HOME: home, PATH: bunDir, CLOUDFLARE_API_TOKEN: "test-secret-value-123" },
  stdout: "pipe",
  stderr: "pipe",
});
const out = p.stdout.toString();
const fails: string[] = [];
let res: any;
try { res = JSON.parse(out); } catch { fails.push("output is not JSON"); }
if (p.exitCode !== 1) fails.push(`expected exit 1 on a bare machine, got ${p.exitCode}`);
if (res) {
  const status = Object.fromEntries(res.items.map((i: any) => [i.id, i.status]));
  for (const id of ["git", "node", "github", "cloudflare", "mos"]) if (status[id] !== "missing") fails.push(`${id} should be missing, got ${status[id]}`);
  if (status.bun !== "ready") fails.push("bun should be ready");
  if (res.ready !== false) fails.push("ready should be false");
}
if (out.includes("test-secret-value-123") || p.stderr.toString().includes("test-secret-value-123")) fails.push("a token value was printed");
if (fails.length) { console.error("check-setup test FAILED:\n  " + fails.join("\n  ")); process.exit(1); }
console.log("check-setup test passed: bare machine reports 5 missing, Bun ready, exit 1, no secret printed.");
