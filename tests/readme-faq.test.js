// The README's Questions section is what a retrieval engine quotes about this
// server (ISSUE-439). It may only say what the package does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { TOOLS } from "../src/tools.js";
import { DEFAULT_BASE_URL } from "../src/config.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const readme = readFileSync(join(root, "README.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const section = readme.split(/^## Questions$/m)[1]?.split(/^## /m)[0] ?? "";
const qa = [...section.matchAll(/^### (.+)\n\n([\s\S]*?)(?=\n### |\n*$)/gm)].map(m => ({ q: m[1], a: m[2].trim() }));

test("the README answers the questions people ask, each with a direct answer first", () => {
  assert.ok(qa.length >= 8, `only ${qa.length} questions`);
  for (const { q, a } of qa) {
    assert.ok(q.endsWith("?"), q);
    assert.ok(a.length > 40, `${q}: answer too thin`);
    assert.ok(/^[A-Z`]/.test(a), `${q}: answer should open with a statement`);
  }
});

test("the tool count the FAQ states is the count the server ships", () => {
  const counts = [...section.matchAll(/\b(\d+) read-only tools\b|\ball (\d+) tools are read-only\b|\ball (\d+) are read-only\b/g)];
  assert.ok(counts.length >= 1);
  for (const [, a, b, c] of counts) assert.equal(Number(a ?? b ?? c), TOOLS.length);
  assert.match(section, new RegExp(`all ${TOOLS.length} tools are read-only`));
  const readOnly = TOOLS.every(t => t.annotations?.readOnlyHint === true);
  assert.ok(readOnly, "the FAQ says every tool is read-only; every tool must say so too");
});

test("the install command in the FAQ is this package's own name", () => {
  assert.ok(section.includes(`npx -y ${pkg.name}`));
  assert.ok(section.includes(DEFAULT_BASE_URL + "/mcp"), "the remote endpoint the FAQ names must be the configured service origin");
});

test("the FAQ names only tools that exist", () => {
  const named = [...section.matchAll(/`(pulse_[a-z_]+)`/g)].map(m => m[1]);
  assert.ok(named.length >= 3);
  for (const n of named) assert.ok(TOOLS.some(t => t.name === n), `${n} is not a tool`);
});

test("the FAQ never claims paid tiers change grades", () => {
  assert.match(section, /never changes a grade|cannot change a grade/i);
  assert.doesNotMatch(section, /pay(ing)? (to|for) (a )?(better|higher) grade/i);
});

test("the grade vocabulary matches the one in the opening paragraph", () => {
  for (const g of ["verified payout", "payout evidence", "live", "failure evidence", "Unknown"]) {
    assert.ok(readme.slice(0, readme.indexOf("## Install")).replace(/\s+/g, " ").includes(g), `opening lacks ${g}`);
    assert.ok(section.includes(g), `FAQ lacks ${g}`);
  }
});
