// Everything that can be decided without talking to MCPize: what a tier's deployment
// image contains, and the token that proves it may activate that tier.
import { createHmac } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const TIERS = ["basic", "pro", "max", "operator"];

/** Same construction as the service's channelToken(): HMAC-SHA256 over the claim, hex. */
export function channelToken(secret, tier) {
  return createHmac("sha256", secret).update(`market-pulse:channel:mcpize:${tier}`).digest("hex");
}

// Staged OUTSIDE this repository on purpose: `mcpize deploy` asks the git remote of the working
// directory which server it belongs to, so a tier staged inside the repo is silently deployed to
// whichever server that repository already owns — every tier would land on the first listing.
export function stageTierProject(tier, outDir = join(tmpdir(), "market-pulse-mcpize", tier)) {
  if (!TIERS.includes(tier)) throw new Error(`unknown tier "${tier}"; known: ${TIERS.join(", ")}`);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "mcpize"), { recursive: true });
  cpSync(join(root, "src"), join(outDir, "src"), { recursive: true });
  for (const file of ["entry.js", "channel-fetch.js"]) cpSync(join(root, "mcpize", file), join(outDir, "mcpize", file));
  // A per-tier package name keeps each MCPize server record distinct; the code is the published code.
  const staged = { name: `${pkg.name}-${tier}`, version: pkg.version, description: pkg.description, license: pkg.license, type: pkg.type, engines: pkg.engines, private: true };
  writeFileSync(join(outDir, "package.json"), `${JSON.stringify(staged, null, 2)}\n`);
  writeFileSync(join(outDir, "Dockerfile"), [
    "FROM node:22-alpine",
    "WORKDIR /app",
    "COPY package.json ./",
    "COPY src ./src",
    "COPY mcpize ./mcpize",
    "ENV NODE_ENV=production",
    "USER node",
    'ENTRYPOINT ["node", "mcpize/entry.js"]',
    "",
  ].join("\n"));
  cpSync(join(root, "mcpize", "mcpize.template.yaml"), join(outDir, "mcpize.yaml"));
  return outDir;
}
