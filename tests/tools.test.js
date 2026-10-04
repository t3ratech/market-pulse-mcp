import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TOOLS, findTool } from "../src/tools.js";

const read = rel => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");

// Glama scores each tool description on behaviour, conciseness, completeness,
// parameters, purpose and usage guidelines. These are the deterministic parts of that
// rubric, so a tool added later is written to it the day it is added.
test("there are exactly ten tools with unique snake_case names", () => {
  assert.equal(TOOLS.length, 10);
  assert.equal(new Set(TOOLS.map(t => t.name)).size, 10);
  for (const t of TOOLS) assert.match(t.name, /^pulse_[a-z_]+$/);
});

test("every description states purpose, routing, behaviour and what it returns", () => {
  const weak = [];
  for (const t of TOOLS) {
    const d = t.description;
    const problems = [];
    if (d.length < 280) problems.push(`too thin (${d.length})`);
    if (d.length > 1400) problems.push(`too long to front-load (${d.length})`);
    if (!/\b(Use|Call)\b/.test(d)) problems.push("no usage guidance");
    if (!/(do not use|\b(?:use|call) pulse_[a-z_]+)/i.test(d)) problems.push("no routing to a sibling tool");
    if (!/read-only/i.test(d)) problems.push("does not disclose behaviour");
    if (!/\bReturns\b/.test(d)) problems.push("does not describe its return");
    if (problems.length) weak.push(`${t.name}: ${problems.join("; ")}`);
  }
  assert.deepEqual(weak, []);
});

test("a description never routes to a tool that does not exist", () => {
  const names = new Set(TOOLS.map(t => t.name));
  for (const t of TOOLS) for (const ref of t.description.match(/pulse_[a-z_]+/g) || []) assert.ok(names.has(ref), `${t.name} refers to ${ref}`);
});

test("every argument has a description, and closed sets publish their enum", () => {
  for (const t of TOOLS) {
    assert.equal(t.inputSchema.additionalProperties, false, `${t.name} must reject unknown arguments`);
    for (const [arg, schema] of Object.entries(t.inputSchema.properties)) assert.ok(schema.description?.length > 15, `${t.name}.${arg} is undescribed`);
  }
  const lanes = findTool("pulse_lanes").inputSchema.properties;
  assert.deepEqual(lanes.grade.enum, ["A", "B", "C", "F", "Unknown"]);
  assert.deepEqual(lanes.access.enum, ["accessible", "blocked"]);
  assert.deepEqual(lanes.automation.enum, ["permitted", "silent", "restricted", "unknown"]);
  assert.deepEqual(lanes.freshness.enum, ["fresh", "aging", "stale", "historical"]);
});

test("every tool has a title, honest annotations and a described object output schema", () => {
  for (const t of TOOLS) {
    assert.ok(t.title && t.title.length >= 8, t.name);
    assert.equal(t.annotations.title, t.title);
    assert.equal(t.annotations.readOnlyHint, true, `${t.name}: nothing here writes`);
    assert.equal(t.annotations.destructiveHint, false);
    assert.equal(t.outputSchema.type, "object");
    for (const [k, p] of Object.entries(t.outputSchema.properties)) assert.ok(p.description, `${t.name} output ${k} undescribed`);
  }
  // pulse_jobs refreshes the live collection for pro+ callers and reaches external sources.
  assert.equal(findTool("pulse_jobs").annotations.idempotentHint, false);
  assert.equal(findTool("pulse_jobs").annotations.openWorldHint, true);
  assert.equal(findTool("pulse_stats").annotations.idempotentHint, true);
});

test("the README documents every tool, and states the real count", () => {
  const readme = read("README.md");
  for (const t of TOOLS) assert.ok(readme.includes(`\`${t.name}\``), `README is missing ${t.name}`);
  assert.match(readme, new RegExp(`any MCP client ${TOOLS.length} read-only tools`));
  assert.match(readme, new RegExp(`All ${["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][TOOLS.length]} are read-only`));
});

test("the changelog names every tool the release ships", () => {
  const log = read("CHANGELOG.md");
  for (const t of TOOLS) assert.ok(log.includes(t.name), t.name);
});
