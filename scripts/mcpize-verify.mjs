#!/usr/bin/env node
/**
 * Verifies the MCPize listings against the service's own plans:
 *   - one public listing per tier, each with exactly one plan named for the tier
 *   - that plan costs what the tier costs on Market Pulse (the catalog, read live)
 *   - no free tier, and no listing copy promising a free key
 *   - the gateway refuses an unauthenticated call (HTTP 401)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchPlans } from "./lib/plans.mjs";

const servers = JSON.parse(readFileSync(fileURLToPath(new URL("../mcpize/servers.json", import.meta.url)), "utf8"));
const plans = await fetchPlans();
let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); if (!ok) failed++; };

for (const plan of plans) {
  const entry = servers[plan.tier];
  if (!entry) { check(`${plan.tier}: has an MCPize listing`, false, "missing from mcpize/servers.json"); continue; }
  const page = await (await fetch(`https://mcpize.com/mcp/${entry.slug}`, { headers: { "user-agent": "Mozilla/5.0" } })).text();
  const text = page.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  // Only the buying surfaces count: the description's comparison table lists every tier's price.
  const billing = /Monthly billing\s*\$\s?(\d+(?:\.\d+)?)\s*\/\s*month/.exec(text)?.[1];
  const cards = text.includes("Start using this server") ? text.split("Start using this server")[1].split("You'll need")[0] : "";
  const cardPrices = [...cards.matchAll(/\$\s?(\d+(?:\.\d+)?)\s*\/\s*mo/g)].map(m => Number(m[1]));
  const getButtons = [...cards.matchAll(/Get [A-Za-z]+ →/g)].length;
  check(`${plan.tier}: listing page is public`, text.includes(plan.name), entry.slug);
  check(`${plan.tier}: the plan costs $${plan.pricePerMonthUsd}/mo like the tier does on Market Pulse`, Number(billing) === plan.pricePerMonthUsd && cardPrices.length === 1 && cardPrices[0] === plan.pricePerMonthUsd, `billing ${billing}, plan card ${JSON.stringify(cardPrices)}`);
  check(`${plan.tier}: exactly one plan, named for the tier`, getButtons === 1 && cards.includes(`Get ${plan.name} →`), `${getButtons} plan button(s)`);
  check(`${plan.tier}: no free plan is offered`, !/\$\s?0\s*\/\s*mo|\bFree\b/.test(cards));
  const needs = text.includes("Start using this server") ? text.split("Start using this server")[1].split("MCPize The marketplace")[0] : "";
  check(`${plan.tier}: connecting asks for the buyer's own Market Pulse key`, /You'll need\s+MARKET_PULSE_API_KEY/.test(needs));
  const gateway = await fetch(`https://${entry.slug}.mcpize.run/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
  check(`${plan.tier}: the gateway refuses an unauthenticated call`, gateway.status === 401, `HTTP ${gateway.status}`);
}
console.log(failed ? `\n${failed} check(s) failed` : "\nMCPize listings agree with the service's plans");
process.exit(failed ? 1 : 0);
