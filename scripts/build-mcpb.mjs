#!/usr/bin/env node
/**
 * Builds the MCPB bundle for Claude Desktop and Smithery's stdio release path.
 *
 * The manifest is derived, not typed: version and description from package.json, the
 * tool list (with full input schemas — Smithery builds its server card from them) from
 * src/tools.json, which is what the server answers tools/list with.
 *
 *   node scripts/build-mcpb.mjs           build build/market-pulse-mcp-<version>.mcpb
 *   node scripts/build-mcpb.mjs --check   verify the manifest without writing the zip
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outDir = join(root, "build");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const tools = JSON.parse(readFileSync(join(root, "src", "tools.json"), "utf8"));

export function buildManifest() {
  return {
    manifest_version: "0.3",
    name: "market-pulse-mcp",
    display_name: "T3rnel Market Pulse",
    version: pkg.version,
    description: pkg.description,
    long_description:
      "Market Pulse grades the places an autonomous agent can find paid work — bounty boards, agent " +
      "marketplaces, job feeds — from recorded evidence, and publishes the evidence hash-chained.\n\n" +
      `This server gives any MCP client ${tools.length} read-only tools over it: list lanes, ask whether ` +
      "to bid on one, read the evidence behind a grade, list live agent job listings, and search a directory " +
      "of agent models, tools and MCP servers.\n\n" +
      "It works without a key on the free tier. A Market Pulse API key raises the daily pull budget and shows " +
      "new listings sooner. Paid tiers buy delivery capacity, never a grade.",
    author: { name: "T3raTech Solutions (Pvt) Ltd", email: "t3ratech.dev@gmail.com", url: "https://market-pulse.t3ratech.co.zw" },
    repository: { type: "git", url: pkg.repository.url.replace(/^git\+/, "") },
    homepage: pkg.homepage,
    documentation: "https://github.com/t3ratech/market-pulse-mcp#readme",
    support: pkg.bugs.url,
    icon: "icon.png",
    license: pkg.license,
    keywords: pkg.keywords,
    privacy_policies: ["https://market-pulse.t3ratech.co.zw/privacy"],
    server: {
      type: "node",
      entry_point: "server/src/server.js",
      mcp_config: {
        command: "node",
        args: ["${__dirname}/server/src/server.js"],
        env: { MARKET_PULSE_API_KEY: "${user_config.api_key}", MARKET_PULSE_TIMEOUT_MS: "${user_config.timeout_ms}" },
      },
    },
    tools: tools.map(tool => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })),
    tools_generated: false,
    user_config: {
      api_key: { type: "string", title: "Market Pulse API key (optional)", description: "Starts with mpk_. Create one at https://market-pulse.t3ratech.co.zw/account. Leave empty for the free tier.", sensitive: true, default: "", required: false },
      timeout_ms: { type: "string", title: "Per-call timeout (ms)", description: "How long a single call may take before it fails rather than hanging the client.", default: "30000", required: false },
    },
    compatibility: { platforms: ["darwin", "win32", "linux"], runtimes: { node: pkg.engines.node } },
  };
}

function assertNoExternalDependencies() {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
  if (Object.keys(deps).length > 0) throw new Error(`build-mcpb: the bundle ships no node_modules, but package.json declares ${Object.keys(deps).join(", ")}`);
}

function build({ check }) {
  assertNoExternalDependencies();
  const manifest = buildManifest();
  if (check) {
    console.log(`manifest ok: ${manifest.name} ${manifest.version}, ${manifest.tools.length} tools`);
    return manifest;
  }
  const staging = join(outDir, "mcpb");
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  writeFileSync(join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  cpSync(join(root, "src"), join(staging, "server", "src"), { recursive: true });
  cpSync(join(root, "README.md"), join(staging, "README.md"));
  const runtimePkg = { name: pkg.name, version: pkg.version, description: pkg.description, license: pkg.license, type: pkg.type, bin: pkg.bin, engines: pkg.engines };
  writeFileSync(join(staging, "server", "package.json"), `${JSON.stringify(runtimePkg, null, 2)}\n`);
  const icon = join(root, "assets", "icon.png");
  if (!existsSync(icon)) throw new Error(`build-mcpb: no icon at ${icon}, and the manifest names one`);
  cpSync(icon, join(staging, "icon.png"));
  const bundle = join(outDir, `${manifest.name}-${manifest.version}.mcpb`);
  rmSync(bundle, { force: true });
  execFileSync("zip", ["-q", "-r", "-X", bundle, "."], { cwd: staging });
  const sha = execFileSync("sha256sum", [bundle], { encoding: "utf8" }).split(" ")[0];
  console.log(`bundle : ${bundle}\nversion: ${manifest.version}\ntools  : ${manifest.tools.length}\nbytes  : ${readFileSync(bundle).length}\nsha256 : ${sha}`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build({ check: process.argv.includes("--check") });
