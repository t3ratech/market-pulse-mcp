// The plans, as the service sells them — read from the service (pulse_account's `plans`),
// never typed here. Prices on the MCPize listings must equal these, and copy that quotes a
// number takes it from here.
export const SERVICE = process.env.MARKET_PULSE_BASE_URL || "https://market-pulse.t3ratech.co.zw";

export async function fetchPlans() {
  return (await fetchOffers()).plans;
}

/** {freeTier, plans} exactly as pulse_account reports them. */
export async function fetchOffers() {
  const res = await fetch(`${SERVICE}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "user-agent": "market-pulse-mcp-release" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "pulse_account", arguments: {} } }),
  });
  if (!res.ok) throw new Error(`pulse_account answered HTTP ${res.status}`);
  const out = (await res.json()).result?.structuredContent;
  if (!Array.isArray(out?.plans) || out.plans.length === 0 || !out.freeTier) throw new Error("the service did not return its plans and free tier");
  return { freeTier: out.freeTier, plans: out.plans };
}

const money = n => `$${n}`;

/** The words for one tier's MCPize listing and plan. Every figure comes from `plan` or the service. */
export function listingCopy(plan, free) {
  const pulls = plan.pullsPerDay == null ? "unmetered daily pulls" : `${plan.pullsPerDay.toLocaleString("en-US")} pulls a day`;
  return {
    tier: plan.tier,
    price: plan.pricePerMonthUsd,
    name: `T3rnel Market Pulse — ${plan.name}`,
    planName: plan.name,
    shortDescription: `Subscribe to the ${plan.name} tier of T3rnel Market Pulse and it activates on your own Market Pulse account: job listings ${plan.listingDelay} after they post (free: ${free.listingDelay}), ${pulls}, the same evidence-graded lanes and should-I-bid advice on every tier. 10 read-only tools; paid access buys delivery, never a grade.`,
    planDescription: `${plan.name} on your own Market Pulse account — listings ${plan.listingDelay} after they post, ${pulls}. ${plan.note}. Connect with your Market Pulse API key; the tier then works on every surface, not just here.`,
  };
}

export function longDescription(plan, allPlans, free) {
  const rows = allPlans.map(p => `| ${p.name} | ${money(p.pricePerMonthUsd)}/mo | ${p.listingDelay} | ${p.pullsPerDay == null ? "unmetered" : p.pullsPerDay.toLocaleString("en-US")} |`).join("\n");
  return `## ${plan.name}: the tier you pay for here is the tier on your Market Pulse account

T3rnel Market Pulse grades the places an autonomous agent can find paid work — bounty boards, agent marketplaces, job feeds — from recorded evidence, and publishes the evidence hash-chained so a grade can be checked instead of trusted.

**How this listing works.** You pay MCPize for the **${plan.name}** plan. When you connect, MCPize asks for your Market Pulse API key (create one free at https://market-pulse.t3ratech.co.zw/account, or with \`POST /api/v1/agents/register\`). On your first call, Market Pulse activates **${plan.name}** on *that* account through its billing rail (WavePay) — the same entitlement a purchase on the Market Pulse site creates — so the tier and the fresher data work through every surface: this gateway, the open-source npm package, the REST API and the website.

| Tier | Price | Listings visible after | Pulls per day |
|---|---|---|---|
| Free | $0 | ${free.listingDelay} | ${free.pullsPerDay.toLocaleString("en-US")} |
${rows}

Every tier reads the same grades, ranks and evidence. **Paid tiers buy delivery — how soon you see job listings and how many pulls a day you get — never a grade.**

### 10 read-only tools
\`pulse_lanes\`, \`pulse_lane_detail\`, \`pulse_should_i_bid\`, \`pulse_evidence\`, \`pulse_jobs\`, \`pulse_stats\`, \`pulse_methodology\`, \`pulse_resources\`, \`pulse_resource_detail\`, \`pulse_account\`.

Prefer to run it yourself, free? \`npx -y @t3ratech/market-pulse-mcp\` (Apache-2.0, https://github.com/t3ratech/market-pulse-mcp) — no key needed.`;
}
