// The tool definitions are generated from the Market Pulse service's own source by
// scripts/sync-tools.mjs and committed as tools.json, so this package can answer
// tools/list with no network (registries introspect a server in a sandbox) and so a
// drift from the live service is a failing check, not a listing that lies.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const TOOLS = JSON.parse(readFileSync(fileURLToPath(new URL("./tools.json", import.meta.url)), "utf8"));

export function findTool(name) {
  return TOOLS.find(tool => tool.name === name);
}
