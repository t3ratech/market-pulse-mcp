#!/usr/bin/env node
/**
 * Verifies this package against the real, deployed Market Pulse service — the checks
 * a protocol stub cannot make. Run it before every release and after every deploy of
 * either side:
 *
 *   node scripts/verify-live.mjs                      anonymous, free tier
 *   MARKET_PULSE_API_KEY=mpk_… node scripts/verify-live.mjs   also proves the keyed path
 *
 * It spawns the server exactly as an MCP client would (stdio) and speaks the protocol.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const serverPath = fileURLToPath(new URL("../src/server.js", import.meta.url));
const shipped = JSON.parse(readFileSync(fileURLToPath(new URL("../src/tools.json", import.meta.url)), "utf8"));
const keyed = Boolean(process.env.MARKET_PULSE_API_KEY);

const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "inherit"], env: process.env });
const waiting = new Map();
let buffer = "";
child.stdout.on("data", chunk => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i);
    buffer = buffer.slice(i + 1);
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    waiting.get(message.id)?.(message);
  }
});
let nextId = 1;
const rpc = (method, params) => new Promise(resolve => {
  const id = nextId++;
  waiting.set(id, resolve);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
});
const tool = async (name, args = {}) => (await rpc("tools/call", { name, arguments: args })).result;

const checks = [];
const check = async (name, fn) => {
  try { await fn(); checks.push([name, "ok"]); console.log(`ok   ${name}`); }
  catch (error) { checks.push([name, error.message]); console.log(`FAIL ${name}\n     ${error.message}`); }
};

await check("initialize", async () => {
  const r = (await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify-live", version: "0" } })).result;
  assert.equal(r.serverInfo.name, "market-pulse");
});
await check("shipped tools.json equals the live service's tool list, byte for byte", async () => {
  const res = await fetch(`${process.env.MARKET_PULSE_BASE_URL || "https://market-pulse.t3ratech.co.zw"}/mcp`, { method: "POST", headers: { "content-type": "application/json", "user-agent": "market-pulse-mcp-verify" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
  const live = (await res.json()).result.tools;
  assert.deepEqual(live, shipped, "run: node scripts/sync-tools.mjs --live");
});
await check("pulse_stats returns structured, dated counts", async () => {
  const r = await tool("pulse_stats");
  assert.ok(!r.isError, r.content?.[0]?.text);
  assert.ok(r.structuredContent.lanes > 0 && r.structuredContent.snapshotAt);
});
await check("pulse_lanes + pulse_should_i_bid round-trip on a real slug", async () => {
  const lanes = (await tool("pulse_lanes", { access: "accessible" })).structuredContent;
  assert.ok(lanes.count > 0);
  const advice = (await tool("pulse_should_i_bid", { lane: lanes.lanes[0].slug })).structuredContent;
  assert.ok(["bid", "bid_cautiously", "probe_first", "avoid", "insufficient_evidence"].includes(advice.recommendation));
});
await check("pulse_evidence returns an object whose chain hashes are present", async () => {
  const r = (await tool("pulse_evidence", { lane: (await tool("pulse_lanes")).structuredContent.lanes[0].slug })).structuredContent;
  assert.equal(r.count, r.records.length);
});
await check("a bad enum is refused locally with the values that work", async () => {
  const r = await tool("pulse_lanes", { grade: "Z" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /one of: A, B, C, F, Unknown/);
});
await check("pulse_account reports the tier this connection is served at", async () => {
  const r = await tool("pulse_account");
  assert.ok(!r.isError, r.content?.[0]?.text);
  assert.equal(r.structuredContent.authenticated, keyed);
});
if (keyed) {
  await check("keyed: pulse_jobs answers at a paid or free tier with a tier field", async () => {
    const r = await tool("pulse_jobs", { limit: 5 });
    assert.ok(!r.isError, r.content?.[0]?.text);
    assert.ok(r.structuredContent.tier);
  });
}
child.stdin.end();
const failed = checks.filter(([, outcome]) => outcome !== "ok");
console.log(`\n${checks.length - failed.length}/${checks.length} live checks passed${keyed ? " (keyed)" : " (anonymous)"}`);
process.exit(failed.length ? 1 : 0);
