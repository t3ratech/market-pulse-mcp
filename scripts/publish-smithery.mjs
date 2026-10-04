#!/usr/bin/env node
/**
 * Publishes the stdio release to Smithery as an MCPB bundle (the web form takes only an
 * HTTPS URL). Every field derives from the bundle's own manifest.
 *
 *   node scripts/publish-smithery.mjs --dry-run   print exactly what would be sent
 *   node scripts/publish-smithery.mjs             publish
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const NAMESPACE = process.env.SMITHERY_NAMESPACE ?? "t3ratech-dev";
const SERVER_ID = process.env.SMITHERY_SERVER_ID ?? "market-pulse";
const API = "https://api.smithery.ai";

function credential() {
  const key = process.env.T3RATECH_SMITHERY_API_KEY;
  if (!key) throw new Error("publish-smithery: T3RATECH_SMITHERY_API_KEY is not set in the environment");
  return key;
}

const { buildManifest } = await import(join(root, "scripts", "build-mcpb.mjs"));
const manifest = buildManifest();
const bundlePath = join(root, "build", `${manifest.name}-${manifest.version}.mcpb`);
if (!existsSync(bundlePath)) throw new Error(`publish-smithery: no bundle at ${bundlePath}. Run: node scripts/build-mcpb.mjs`);

const properties = {};
for (const [variable, reference] of Object.entries(manifest.server.mcp_config.env)) {
  const entry = manifest.user_config[reference.match(/^\$\{user_config\.([a-z_]+)\}$/)?.[1]];
  if (entry) properties[variable] = { type: "string", title: entry.title, description: entry.description, ...(entry.default ? { default: entry.default } : {}) };
}
const payload = {
  type: "stdio",
  runtime: "node",
  configSchema: { type: "object", properties, required: [] },
  serverCard: {
    serverInfo: { name: manifest.name, title: manifest.display_name, version: manifest.version, websiteUrl: manifest.homepage, description: manifest.description },
    tools: manifest.tools,
  },
};
const url = `${API}/servers/${encodeURIComponent(`${NAMESPACE}/${SERVER_ID}`)}/releases`;
if (process.argv.includes("--dry-run")) {
  console.log(`PUT ${url}\nbundle: ${bundlePath} (${readFileSync(bundlePath).length} bytes)`);
  console.log(JSON.stringify(payload, null, 2).slice(0, 1500));
} else {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append("bundle", new Blob([readFileSync(bundlePath)]), `${manifest.name}-${manifest.version}.mcpb`);
  const response = await fetch(url, { method: "PUT", headers: { Authorization: `Bearer ${credential()}` }, body: form });
  console.log(`PUT ${url}\nHTTP ${response.status}\n${(await response.text()).slice(0, 1500)}`);
  if (!response.ok) process.exitCode = 1;
}
