import test from "node:test";
import assert from "node:assert/strict";
import { validateToolArgs } from "../src/validate.js";
import { TOOLS } from "../src/tools.js";

const tool = name => TOOLS.find(t => t.name === name);

test("a required argument that is missing, null or empty is named", () => {
  for (const args of [{}, { slug: null }, { slug: "" }]) {
    const message = validateToolArgs(tool("pulse_lane_detail"), args);
    assert.match(message, /"slug" is required/);
    assert.doesNotMatch(message, /undefined/);
  }
});

test("an unknown argument is refused by name, listing what is accepted", () => {
  const message = validateToolArgs(tool("pulse_stats"), { bogus: 1 });
  assert.match(message, /unknown argument "bogus"/);
  assert.match(message, /Accepted: none/);
  assert.match(validateToolArgs(tool("pulse_lanes"), { gradee: "A" }), /Accepted: grade, access/);
});

test("prototype-pollution keys are unknown arguments, not accepted", () => {
  for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
    const args = JSON.parse(`{"${key}": 1}`);
    assert.match(validateToolArgs(tool("pulse_lanes"), args), /unknown argument/, key);
  }
});

test("an enum refusal names the values that work", () => {
  const message = validateToolArgs(tool("pulse_lanes"), { grade: "Z" });
  assert.match(message, /"grade" must be one of: .*A.*F/);
  assert.match(message, /"Z"/);
});

test("a boolean argument refuses a string because a truthy read inverts it", () => {
  assert.match(validateToolArgs(tool("pulse_resources"), { free: "false" }), /JSON boolean/);
  assert.equal(validateToolArgs(tool("pulse_resources"), { free: false }), null);
});

test("integers are bounded by the published schema, both ends", () => {
  assert.match(validateToolArgs(tool("pulse_jobs"), { limit: 0 }), />= 1/);
  assert.match(validateToolArgs(tool("pulse_jobs"), { limit: 501 }), /<= 500/);
  assert.match(validateToolArgs(tool("pulse_jobs"), { limit: 1.5 }), /integer/);
  assert.match(validateToolArgs(tool("pulse_jobs"), { limit: "10" }), /integer/);
  assert.equal(validateToolArgs(tool("pulse_jobs"), { limit: 1 }), null);
  assert.equal(validateToolArgs(tool("pulse_jobs"), { limit: 500 }), null);
  assert.match(validateToolArgs(tool("pulse_resources"), { minStars: -1 }), />= 0/);
});

test("a string argument refuses a number or an object", () => {
  assert.match(validateToolArgs(tool("pulse_jobs"), { q: 5 }), /must be a string/);
  assert.match(validateToolArgs(tool("pulse_jobs"), { q: { a: 1 } }), /must be a string/);
});

test("null is a value no schema declares: refused, with the instruction to omit it", () => {
  assert.match(validateToolArgs(tool("pulse_resources"), { minStars: null }), /omit the argument/);
});

test("arguments that are not an object are refused", () => {
  for (const bad of [null, [], "x", 5]) assert.match(validateToolArgs(tool("pulse_stats"), bad), /JSON object/);
});

test("a fully valid call passes, including every optional argument at once", () => {
  assert.equal(validateToolArgs(tool("pulse_resources"), { kind: Object.keys({}).length ? "" : tool("pulse_resources").inputSchema.properties.kind.enum[0], category: "x", q: "y", cap: "rag", free: true, minStars: 10, sort: tool("pulse_resources").inputSchema.properties.sort.enum[0], tag: "a,b" }), null);
});

test("every tool accepts the empty call exactly when it has no required arguments", () => {
  for (const t of TOOLS) {
    const needs = (t.inputSchema.required || []).length > 0;
    assert.equal(validateToolArgs(t, {}) !== null, needs, t.name);
  }
});
