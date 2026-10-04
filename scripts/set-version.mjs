#!/usr/bin/env node
/**
 * The only way a version changes. Every file that states one is written here, so
 * nothing can be edited by hand and left disagreeing — a registry entry that names an
 * npm version which does not exist is a broken listing for however long the gap lasts.
 *
 *   node scripts/set-version.mjs 1.2.0   write every source
 *   node scripts/set-version.mjs --check print the one version, or fail listing the odd ones out
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const file = rel => fileURLToPath(new URL(rel, root));
const read = rel => JSON.parse(readFileSync(file(rel), "utf8"));
const write = (rel, value) => writeFileSync(file(rel), `${JSON.stringify(value, null, 2)}\n`);

const SKILL = "agent-skills/market-pulse/SKILL.md";
const skillVersion = text => text.match(/"version":\s*"([^"]+)"/)?.[1];

const sources = {
  "package.json": { get: () => read("package.json").version, set: v => { const j = read("package.json"); j.version = v; write("package.json", j); } },
  "server.json version": { get: () => read("server.json").version, set: v => { const j = read("server.json"); j.version = v; write("server.json", j); } },
  "server.json packages[0].version": { get: () => read("server.json").packages[0].version, set: v => { const j = read("server.json"); j.packages[0].version = v; write("server.json", j); } },
  ".claude-plugin/plugin.json": { get: () => read(".claude-plugin/plugin.json").version, set: v => { const j = read(".claude-plugin/plugin.json"); j.version = v; write(".claude-plugin/plugin.json", j); } },
  ".claude-plugin/marketplace.json metadata": { get: () => read(".claude-plugin/marketplace.json").metadata.version, set: v => { const j = read(".claude-plugin/marketplace.json"); j.metadata.version = v; write(".claude-plugin/marketplace.json", j); } },
  ".claude-plugin/marketplace.json plugin": { get: () => read(".claude-plugin/marketplace.json").plugins[0].version, set: v => { const j = read(".claude-plugin/marketplace.json"); j.plugins[0].version = v; write(".claude-plugin/marketplace.json", j); } },
  [`${SKILL} metadata`]: {
    get: () => skillVersion(readFileSync(file(SKILL), "utf8")),
    set: v => writeFileSync(file(SKILL), readFileSync(file(SKILL), "utf8").replace(/("version":\s*")[^"]+(")/, `$1${v}$2`)),
  },
};

const arg = process.argv[2];
if (arg === "--check") {
  const found = Object.fromEntries(Object.entries(sources).map(([name, s]) => [name, s.get()]));
  const versions = new Set(Object.values(found));
  if (versions.size !== 1) {
    console.error("version sources disagree:");
    for (const [name, v] of Object.entries(found)) console.error(`  ${v ?? "MISSING"}  ${name}`);
    process.exit(1);
  }
  console.log([...versions][0]);
} else if (/^\d+\.\d+\.\d+$/.test(arg || "")) {
  for (const s of Object.values(sources)) s.set(arg);
  console.log(`set ${arg} in ${Object.keys(sources).length} sources`);
} else {
  console.error("usage: set-version.mjs <x.y.z> | --check");
  process.exit(2);
}
