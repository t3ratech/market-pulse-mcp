import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { TOOLS } from "../src/tools.js";
import { buildManifest } from "../scripts/build-mcpb.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = rel => readFileSync(join(root, rel), "utf8");
const json = rel => JSON.parse(read(rel));
const pkg = json("package.json");

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "SKILL.md must open with a front-matter block");
  const name = m[1].match(/^name:\s*(.+)$/m)?.[1].trim();
  const description = m[1].match(/^description:\s*(.+)$/m)?.[1].trim();
  return { name, description, raw: m[1] };
}

test("every version source states the same version", () => {
  const out = execFileSync(process.execPath, [join(root, "scripts/set-version.mjs"), "--check"], { encoding: "utf8" }).trim();
  assert.equal(out, pkg.version);
});

test("the skill's front matter parses and fits the 1024-character description limit", () => {
  const fm = frontmatter(read("agent-skills/market-pulse/SKILL.md"));
  assert.equal(fm.name, "market-pulse");
  assert.ok(fm.description.length > 100 && fm.description.length <= 1024, `description is ${fm.description.length} chars`);
  assert.match(fm.description, /Use when/);
  assert.match(fm.raw, /"version":\s*"\d+\.\d+\.\d+"/);
});

test("the skill references only tools that exist, and teaches every one that decides or verifies", () => {
  const text = read("agent-skills/market-pulse/SKILL.md");
  const names = new Set(TOOLS.map(t => t.name));
  for (const ref of text.match(/pulse_[a-z_]+/g)) assert.ok(names.has(ref), `skill refers to unknown tool ${ref}`);
  for (const t of TOOLS) assert.ok(text.includes(t.name), `skill never mentions ${t.name}`);
});

test("the skill states the independence guarantee and never promises payment", () => {
  const text = read("agent-skills/market-pulse/SKILL.md");
  assert.match(text, /no one can buy a grade/i);
  assert.match(text, /not\s+that payment is certain/i);
  assert.match(text, /cannot apply, bid or move money/i);
});

test("the plugin manifest points at files that exist and its server runs this package", () => {
  const plugin = json(".claude-plugin/plugin.json");
  assert.equal(plugin.name, "market-pulse");
  assert.ok(existsSync(join(root, plugin.skills, "market-pulse", "SKILL.md")));
  assert.deepEqual(plugin.mcpServers["market-pulse"], { command: "npx", args: ["-y", pkg.name] });
  assert.equal(plugin.license, pkg.license);
  const market = json(".claude-plugin/marketplace.json");
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(market.plugins[0].source, "./");
});

test("server.json names the npm package and the remote, and matches package.json", () => {
  const server = json("server.json");
  assert.equal(server.name, pkg.mcpName);
  assert.equal(server.packages[0].identifier, pkg.name);
  assert.equal(server.packages[0].transport.type, "stdio");
  assert.equal(server.remotes[0].url, "https://market-pulse.t3ratech.co.zw/mcp");
  assert.ok(server.description.length <= 100, "the registry caps descriptions at 100 characters");
  const key = server.packages[0].environmentVariables.find(v => v.name === "MARKET_PULSE_API_KEY");
  assert.equal(key.isSecret, true);
  assert.equal(key.isRequired, false);
  assert.match(server.repository.url, /t3ratech\/market-pulse-mcp$/);
});

test("glama.json carries what Glama reads: maintainer, licence and the npm package", () => {
  const glama = json("glama.json");
  assert.deepEqual(glama.maintainers, ["t3ratech"]);
  assert.equal(glama.license, "Apache-2.0");
  assert.equal(glama.npm, pkg.name);
  assert.ok(existsSync(join(root, "LICENSE")));
  assert.match(read("LICENSE"), /Apache License/);
});

test("the Dockerfile builds a non-root stdio image from a pinned base with no secrets", () => {
  const docker = read("Dockerfile");
  assert.match(docker, /^FROM node:\d+-alpine$/m, "pin a major, not latest");
  assert.match(docker, /^USER node$/m);
  assert.match(docker, /ENTRYPOINT \["node", "src\/server\.js"\]/);
  assert.doesNotMatch(docker, /MARKET_PULSE_API_KEY|mpk_|ENV .*KEY|ARG .*KEY/i);
  for (const dir of ["src", "agent-skills"]) assert.ok(existsSync(join(root, dir)));
});

test("the MCPize manifest is paid-managed: the publisher's key is a secret, never a per-user credential", () => {
  const y = read("mcpize.yaml");
  assert.match(y, /^runtime: container$/m);
  assert.match(y, /^secrets:\n  - name: MARKET_PULSE_API_KEY\n    required: true$/m, "MCPize rejects a secret that does not say whether it is required");
  assert.doesNotMatch(y, /^credentials/m, "subscribers must not be asked for a Market Pulse key");
  assert.doesNotMatch(y, /mpk_/);
  assert.match(y, /paid access buys delivery, not verdicts/i);
});

test("Smithery config exposes the key and timeout and nothing else", () => {
  const y = read("smithery.yaml");
  assert.match(y, /type: stdio/);
  assert.match(y, /MARKET_PULSE_API_KEY/);
  assert.match(y, /@t3ratech\/market-pulse-mcp/);
  assert.doesNotMatch(y, /mpk_[A-Za-z0-9]{8,}/);
});

test("the MCPB manifest is derived: same version, same tools with full schemas, a sensitive key field", () => {
  const m = buildManifest();
  assert.equal(m.version, pkg.version);
  assert.deepEqual(m.tools.map(t => t.name), TOOLS.map(t => t.name));
  for (const t of m.tools) assert.equal(typeof t.inputSchema, "object", `Smithery rejects a tool with no inputSchema (${t.name})`);
  assert.equal(m.user_config.api_key.sensitive, true);
  assert.equal(m.user_config.api_key.required, false);
  assert.ok(existsSync(join(root, "assets", m.icon.replace(/^/, ""))) || existsSync(join(root, "assets", "icon.png")));
  assert.match(m.long_description, new RegExp(`${TOOLS.length} read-only tools`));
});

test("the runtime imports nothing outside node: and the package declares no dependencies", () => {
  assert.equal(pkg.dependencies, undefined);
  const specifiers = [];
  for (const file of readdirSync(join(root, "src")).filter(f => f.endsWith(".js"))) {
    for (const m of read(`src/${file}`).matchAll(/(?:from|import\()\s*"([^"]+)"/g)) specifiers.push(m[1]);
  }
  for (const s of specifiers) assert.ok(s.startsWith("node:") || s.startsWith("./") || s.startsWith("../"), `${s} is an external import`);
});

test("the published tarball contains the runtime, skill and plugin — and not tests, scripts or secrets", () => {
  const out = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" }));
  const files = out[0].files.map(f => f.path);
  for (const must of ["src/server.js", "src/tools.json", "src/client.js", "agent-skills/market-pulse/SKILL.md", ".claude-plugin/plugin.json", "README.md", "LICENSE", "NOTICE", "package.json"]) {
    assert.ok(files.includes(must), `tarball is missing ${must}`);
  }
  for (const f of files) assert.doesNotMatch(f, /^(tests|scripts|build|node_modules|\.github)\/|\.env|mcpize\.yaml|Dockerfile/, `tarball must not ship ${f}`);
  assert.ok(out[0].size < 60 * 1024, `tarball is ${out[0].size} bytes`);
});

test("no file in the repository contains a real-looking Market Pulse key or another provider's secret", () => {
  const walk = dir => readdirSync(dir).flatMap(name => {
    // tests/ holds deliberately fake fixture keys; everything that ships or documents is scanned.
    if (["node_modules", ".git", "build", "tests"].includes(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  const patterns = [/mpk_(live|test)_[A-Za-z0-9_-]{12,}/, /sk-[A-Za-z0-9]{20,}/, /ghp_[A-Za-z0-9]{20,}/, /npm_[A-Za-z0-9]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
  for (const file of walk(root).filter(f => !/\.(png)$/.test(f))) {
    const text = readFileSync(file, "utf8");
    for (const p of patterns) assert.doesNotMatch(text, p, `${file} matches ${p}`);
  }
});

test("the licence header and NOTICE name the right owner and reserve the marks", () => {
  assert.match(read("NOTICE"), /T3raTech Solutions \(Pvt\) Ltd/);
  assert.match(read("NOTICE"), /Trademarks/);
  assert.equal(pkg.license, "Apache-2.0");
});

test("the README's listing table links only to https destinations and keeps the MCPize listing honest about being paid", () => {
  const readme = read("README.md");
  const section = readme.split("## Where it is listed")[1].split("## Configuration")[0];
  const links = [...section.matchAll(/\]\((https?:[^)]+)\)/g)].map(m => m[1]);
  assert.ok(links.length >= 7);
  for (const link of links) assert.match(link, /^https:\/\//, link);
  assert.match(section, /MCPize \(managed, paid\)/);
  assert.match(section, /glama\.ai\/mcp\/servers\/t3ratech\/market-pulse-mcp\/badges\/score\.svg/);
});
