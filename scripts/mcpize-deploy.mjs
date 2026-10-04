#!/usr/bin/env node
/**
 * Deploys the per-tier MCPize listings.
 *
 *   node scripts/mcpize-deploy.mjs <basic|pro|max|operator|all> [--dry-run]
 *
 * Needs, from the environment (never from a file in this repo):
 *   MCPIZE_TOKEN                          MCPize CLI token (T3RATECH_MCPIZE_API_TOKEN in the monorepo .env)
 *   MARKET_PULSE_MCPIZE_CHANNEL_SECRET    the master secret the service verifies tokens against
 *
 * Each tier gets its own MCPize server record (ids recorded in mcpize/servers.json; staged in the system temp directory, never inside this
 * repository — mcpize matches a working directory to a server by its git remote),
 * its tier and its tier-bound token as secrets, and the buyer's Market Pulse key as a
 * per-user credential (declared in the manifest). Prices live in the MCPize dashboard
 * and are checked against the service's billing catalog by scripts/mcpize-verify.mjs.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TIERS, root, stageTierProject, channelToken } from "./lib/mcpize-project.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const target = args.find(a => !a.startsWith("--"));
if (!target || (target !== "all" && !TIERS.includes(target))) {
  console.error(`usage: mcpize-deploy.mjs <${TIERS.join("|")}|all> [--dry-run]`);
  process.exit(2);
}
const need = name => {
  const v = process.env[name];
  if (!v) { console.error(`mcpize-deploy: ${name} is not set in the environment`); process.exit(1); }
  return v;
};
const serversPath = join(root, "mcpize", "servers.json");
const servers = existsSync(serversPath) ? JSON.parse(readFileSync(serversPath, "utf8")) : {};
const cli = (cwd, cliArgs, input) => execFileSync("npx", ["-y", "mcpize@1.2.1", ...cliArgs], { cwd, input, encoding: "utf8", env: { ...process.env, MCPIZE_TOKEN: need("MCPIZE_TOKEN") }, stdio: ["pipe", "pipe", "inherit"], timeout: 600000 });

for (const tier of target === "all" ? TIERS : [target]) {
  const dir = stageTierProject(tier);
  console.log(`${tier}: staged ${dir}`);
  if (dryRun) continue;
  const secret = need("MARKET_PULSE_MCPIZE_CHANNEL_SECRET");
  const linkDir = join(dir, ".mcpize");
  const linkFile = join(linkDir, "project.json");
  if (servers[tier]?.id) {
    mkdirSync(linkDir, { recursive: true });
    writeFileSync(linkFile, `${JSON.stringify({ serverId: servers[tier].id, serverName: servers[tier].name }, null, 2)}\n`);
  }
  console.log(cli(dir, ["deploy", "-y", "--skip-wizard", "--notes", `market-pulse ${tier} channel listing`]).split("\n").slice(-6).join("\n"));
  // mcpize writes .mcpize/project.json when it creates or links a server. If a server was created
  // but the file is missing, the id is in the dashboard (/developer/servers/<id>): record it in
  // mcpize/servers.json and rerun — a tier without a recorded server is never guessed.
  if (!existsSync(linkFile)) throw new Error(`mcpize-deploy: ${tier} deployed but ${linkFile} was not written; add its server id to mcpize/servers.json and rerun`);
  const linked = JSON.parse(readFileSync(linkFile, "utf8"));
  const slug = /^Slug:\s*(\S+)/m.exec(cli(dir, ["status"]))?.[1];
  if (!slug) throw new Error(`mcpize-deploy: could not read the slug of ${linked.serverId} from "mcpize status"`);
  servers[tier] = { id: linked.serverId, name: linked.serverName, slug };
  mkdirSync(join(root, "mcpize"), { recursive: true });
  writeFileSync(serversPath, `${JSON.stringify(servers, null, 2)}\n`);
  // Values travel on stdin: they never appear in a process listing or a shell history.
  cli(dir, ["secrets", "set", "--server", linked.serverId, "--required", "MARKET_PULSE_CHANNEL_TIER"], tier);
  cli(dir, ["secrets", "set", "--server", linked.serverId, "--required", "MARKET_PULSE_CHANNEL_TOKEN"], channelToken(secret, tier));
  console.log(cli(dir, ["deploy", "-y", "--skip-wizard", "--notes", `apply ${tier} channel secrets`]).split("\n").slice(-4).join("\n"));
  console.log(`${tier}: server ${linked.serverId} deployed`);
}
