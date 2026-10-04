#!/usr/bin/env node
/**
 * Generates src/tools.json — the tool list this package serves — from the Market
 * Pulse service. Two sources, same output:
 *
 *   node scripts/sync-tools.mjs            from the service source in the T3rnel monorepo
 *   node scripts/sync-tools.mjs --live     from the deployed /mcp endpoint
 *   node scripts/sync-tools.mjs --check    fail if the committed file differs (add --live
 *                                          to compare against production instead)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const out = fileURLToPath(new URL("../src/tools.json", import.meta.url));
const live = process.argv.includes("--live");
const check = process.argv.includes("--check");

async function fromSource() {
  const rest = fileURLToPath(new URL("../../../websites/t3rnel-market-pulse/src/api/rest.mjs", import.meta.url));
  const { mcpTools } = await import(pathToFileURL(rest).href);
  return mcpTools;
}

async function fromLive() {
  const base = process.env.MARKET_PULSE_BASE_URL || "https://market-pulse.t3ratech.co.zw";
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "user-agent": "market-pulse-mcp-sync" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  if (!res.ok) throw new Error(`tools/list answered HTTP ${res.status}`);
  return (await res.json()).result.tools;
}

const tools = JSON.parse(JSON.stringify(await (live ? fromLive() : fromSource())));
const next = `${JSON.stringify(tools, null, 2)}\n`;
if (check) {
  const current = readFileSync(out, "utf8");
  if (current !== next) {
    console.error(`src/tools.json differs from ${live ? "the live /mcp endpoint" : "the Market Pulse source"} — run: node scripts/sync-tools.mjs${live ? " --live" : ""}`);
    process.exit(1);
  }
  console.log(`src/tools.json matches ${live ? "production" : "the service source"} (${tools.length} tools)`);
} else {
  writeFileSync(out, next);
  console.log(`wrote src/tools.json (${tools.length} tools)`);
}
