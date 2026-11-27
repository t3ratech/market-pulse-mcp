# Founder pack — T3rnel Market Pulse MCP

Condensed founder pack. Consumer panel simulated inline (~10 personas).

## Idea

Dependency-free MCP server (`@t3ratech/market-pulse-mcp`, npm + remote
streamable-HTTP, no key needed) exposing 11 read-only tools over the
Market Pulse evidence index: graded agent-work lanes (bounty boards,
agent marketplaces, job feeds) with hash-chained payout evidence. Answers
"where can an AI agent actually earn, and has anyone been paid?"

## Board verdict

- **Offers lens — 8/10, FUND.** Razor-sharp offer aimed at a real, growing
  persona: autonomous agents that must pick revenue lanes. "Evidence-
  backed payout grades" is honest and verifiable — rare in a hype market.
- **Monopoly lens — 7/10, FUND IF.** The evidence index + hash-chained
  grades + the *proprietary dataset of agent-work lane liveness* is a
  genuine data moat nobody else collects systematically. But the MCP
  server itself is thin — its value is entirely the index behind it.
- **Product lens — 8/10, FUND.** No deps, Node 20+, remote endpoint,
  plugin bundle, every client covered. Correctly free — it's a data
  product's distribution layer.

**Vote: 2 FUND, 1 FUND IF. Average 7.7.**

### Conditions
1. The website (market-pulse.t3ratech.co.zw) and MCP must stay in lockstep
   — the MCP is only as fresh as the index.
2. Monetize eventually: free MCP is the funnel; the paid layer is
   alerts/monitoring/API depth, not the tools themselves.
3. Keep the "no key needed" promise — friction kills agent adoption.

## Competitors & gap

- **Nothing direct.** No competitor publishes graded, evidence-backed
  agent-work lane data. Adjacent: bounty-board aggregators (no grading),
  agent-marketplace directories (self-reported), generic "AI jobs" sites
  (human jobs).
- **Gap to own:** "the only source that tells an agent which work lanes
  actually pay — with receipts." Own the category; it's early.

## Buyer panel (quick)

| Persona | Uses it? | Reason |
|---|---|---|
| Autonomous agent (Devin-style) picking work | Yes | "Directly answers 'where do I earn' — core input" |
| Agent-platform operator | Yes | "Feeds job routing/dispatch decisions" |
| Indie hacker running job bots | Yes | "Stops wasting cycles on dead lanes" |
| Bounty hunter (human) | Yes | "Same question, human version" |
| AI safety researcher | Yes | "Payout-evidence dataset is research-grade" |
| Casual user | No | "No jobs for me here — agent work only" |
| Enterprise procurement | No | "Too niche; not their problem" |
| Competitor platform | Maybe | "Could scrape it — hash-chain makes tampering evident" |
| Journalist/researcher | Yes | "Citable evidence on agent labor markets" |
| Skeptic | Maybe→Yes | "'Has anyone been paid?' framing converts doubters" |

**Adoption rate ~70% among target persona.** Top objections: young index
(some lanes "Unknown" grade), agent-only focus excludes humans,
recency of grades.

## Pricing

- MCP + read tools: **free forever** (correct — distribution).
- Paid future layers on the website: **Market Pulse Pro $9–19/mo** —
  payout alerts (lane grade changes), historical grade trends, full
  evidence export, API depth beyond MCP read tools, custom lane watches.
- The index itself is the asset; MCP proves it works.

## Offer

"Where can your agent actually earn — and has anyone been paid? Grades
backed by hash-chained payout evidence, free over MCP."

## CFO sketch

- COGS ≈ $0 for MCP (static/Worker). Index collection is the real cost —
  automated, mostly free sources.
- Revenue: Pro subscription on the website once alert value proven.
- Break-even trivial; this is a land-grab for category ownership.

## Marketing

- Channels: agent-builder communities, MCP directories (already spread
  across clients), Show HN "we graded every agent job board", agent-
  economy Twitter/X, the agent-work-marketplaces skill ecosystem.
- Hooks: "115 applications → 0 responses. We measure which lanes actually
  pay." / "Receipts, not promises."
- Every agent that adopts this becomes a distribution node for the
  whole T3rnel stack.

## Ops / launch

- Keep the hash-chain verification public and documented — it's the
  trust mechanism.
- Index freshness is the product; automate lane re-grading on a cadence.
- Guard against gaming: lanes could fabricate payout evidence — the
  evidence chain must record provenance.

## Plan verdict

**Category-defining, profitable via land-grab.** Strongest product-market
fit in the catalog. Protect the evidence integrity above all; everything
else is distribution.
