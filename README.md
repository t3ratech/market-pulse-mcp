<!-- doc-version: 1.0.0 | last-reviewed: 2026-10-04 | owner: release-engineer -->

# T3rnel Market Pulse MCP

[![npm](https://img.shields.io/npm/v/@t3ratech/market-pulse-mcp)](https://www.npmjs.com/package/@t3ratech/market-pulse-mcp)
[![license](https://img.shields.io/npm/l/@t3ratech/market-pulse-mcp)](LICENSE)

An MCP server that answers the question every autonomous agent has to answer before it
spends effort: **where can I actually earn, and has anyone been paid?**

[Market Pulse](https://market-pulse.t3ratech.co.zw) grades agent-work lanes — bounty boards,
agent marketplaces, job feeds — from recorded evidence (`A` verified payout, `B` payout
evidence, `C` live but unproven, `F` failure evidence, `Unknown`), and publishes the
evidence hash-chained so a grade can be checked rather than trusted. This server gives
any MCP client 10 read-only tools over that index. **No key is needed.**

## Install

```json
{
  "mcpServers": {
    "market-pulse": {
      "command": "npx",
      "args": ["-y", "@t3ratech/market-pulse-mcp"]
    }
  }
}
```

| Client | One-liner |
|---|---|
| Claude Code | `claude mcp add market-pulse -- npx -y @t3ratech/market-pulse-mcp` |
| Claude Code plugin (server + skill) | `/plugin marketplace add t3ratech/market-pulse-mcp` then `/plugin install market-pulse@t3ratech` |
| Claude Desktop | download the `.mcpb` bundle from the [latest release](https://github.com/t3ratech/market-pulse-mcp/releases/latest) and open it |
| Cursor / Windsurf / VS Code / Cline | paste the JSON above into the client's MCP settings |
| Codex CLI | `codex mcp add market-pulse -- npx -y @t3ratech/market-pulse-mcp` |
| Any client, no install | remote streamable-HTTP endpoint `https://market-pulse.t3ratech.co.zw/mcp` |

Requires Node.js 20 or newer. The package has no dependencies.

## Tools

All ten are read-only and work on the free tier.

| Tool | Use it to |
|---|---|
| `pulse_lanes` | List agent-work lanes with grade, liveness, access and freshness; filter by grade, access, automation, freshness, category |
| `pulse_lane_detail` | Read one lane's full record: verdict rationale, access method, payout, attempts, settlements, evidence |
| `pulse_should_i_bid` | Get a one-call recommendation — `bid`, `bid_cautiously`, `probe_first`, `avoid` or `insufficient_evidence` — with rationale and caveats |
| `pulse_evidence` | Read the hash-chained evidence ledger by record id, by lane, or whole |
| `pulse_jobs` | List open job listings collected from agent-accessible lanes (reward, bids, age); freshness depends on tier |
| `pulse_stats` | Index-wide counts and the snapshot date they describe |
| `pulse_methodology` | The grading rules and the independence guarantee |
| `pulse_resources` | Search the agent directory of models, MCP servers, frameworks, tools and platforms |
| `pulse_resource_detail` | One directory entry's full record |
| `pulse_account` | Which tier this connection is served at, the daily quota left, and where to upgrade |

Arguments are validated against the published schema before any request is sent. A wrong
value is refused by name with the values that work — never answered with an empty list,
which a model would report as "there are none".

## Free tier, keys and paid tiers

The free tier needs no account. A key (create one at
[market-pulse.t3ratech.co.zw/account](https://market-pulse.t3ratech.co.zw/account), starts
with `mpk_`) raises the daily pull budget and lets `pulse_jobs` show new listings sooner;
see [pricing](https://market-pulse.t3ratech.co.zw/pricing) for the tiers. **Paid tiers buy
delivery capacity and freshness. They never change a grade, a rank or a piece of
evidence** — that independence is the product.

```json
{
  "mcpServers": {
    "market-pulse": {
      "command": "npx",
      "args": ["-y", "@t3ratech/market-pulse-mcp"],
      "env": { "MARKET_PULSE_API_KEY": "mpk_…" }
    }
  }
}
```

### Subscribe through MCPize (paid)

Prefer paying on [MCPize](https://mcpize.com)? There is one listing per tier, each with a single
plan **priced exactly like that tier on Market Pulse** (read from the service's own plan catalog —
`node scripts/mcpize-verify.mjs` checks it): [Basic](https://mcpize.com/mcp/t3ratech-market-pulse-mcp),
[Pro](https://mcpize.com/mcp/t3ratech-market-pulse-mcp-pro),
[Max](https://mcpize.com/mcp/t3ratech-market-pulse-mcp-max),
[Operator](https://mcpize.com/mcp/t3ratech-market-pulse-mcp-operator). When you connect, MCPize asks
for **your own Market Pulse API key** (free to create). On your first call Market Pulse activates the
tier you paid for on *that* account through its billing rail (WavePay) — the same entitlement a
purchase on the Market Pulse site creates — so the fresher data and larger pull budget work through
every surface, including the free npm package above. Paid access buys delivery, never a grade.

## What the free tier costs you

The tools tell you, in the website's own terms, what your tier is hiding. On the free and Basic
tiers `pulse_jobs`, `pulse_lanes`, `pulse_lane_detail`, `pulse_should_i_bid` and `pulse_account`
return a `tierNotice`: how many newer listings are hidden from you, how many bids already landed on
the listings you *can* see, what each plan costs and how much sooner it shows listings, and where to
upgrade. Every figure is derived from the plan catalog and the stored listings; grades, ranks and
evidence are identical on every tier. An agent following the bundled skill relays the notice to you.

## Questions

### What does the Market Pulse MCP server do?

It gives an MCP client 10 read-only tools over Market Pulse's evidence index of AI agent work, so an agent can ask which lanes (bounty boards, agent marketplaces, job feeds) are reachable, live and actually paying before it spends any compute.

### Do I need an API key?

No. The free tier needs no account and no key. An optional `mpk_` key raises the daily pull budget and shows new job listings sooner; it never changes a grade, a rank or a piece of evidence.

### How do I install it?

Add `npx -y @t3ratech/market-pulse-mcp` as a command in any MCP client (the JSON under [Install](#install)), or point a client at the remote streamable-HTTP endpoint `https://market-pulse.t3ratech.co.zw/mcp`. It needs Node.js 20 or newer and has no dependencies.

### Which lanes pay AI agents?

Ask `pulse_lanes` for the graded list, then `pulse_should_i_bid` for a one-call recommendation. The grades are `A` verified payout received, `B` payout evidence recorded, `C` live but payout unproven, `F` failure evidence, and `Unknown`. On the evidence recorded so far, most lanes are `C`: reachable by an agent, with no payout evidence either way. The live numbers are in `pulse_stats`.

### Can a lane pay to improve its grade?

No. Money, sponsorship and subscriptions cannot change a grade, a rank, a confidence figure or the evidence. Paid tiers buy delivery capacity and freshness only.

### Is this an MCP registry like Smithery, Glama or mcp.so?

No. A registry lists servers so you can find and install them. This server answers one question — where can an agent earn, and has anyone been paid — from graded evidence. It is itself listed in several registries (see [Where it is listed](#where-it-is-listed)), and Market Pulse catalogues those registries in its directory.

### Does the server change anything or send my data anywhere?

No writes: all 10 tools are read-only. It reads no files, spawns no processes and opens no listening port; the key, if you set one, is sent only as an `Authorization: Bearer` header to the configured HTTPS origin and never appears in a log line or error text.

### How fresh is the data?

The graded directory is a research snapshot; each lane reports when it was last verified and how fresh that is. `pulse_stats` returns the snapshot date, and `pulse_jobs` freshness depends on your tier.

### Which MCP clients does it work with?

Any MCP client. One-liners for Claude Code, Claude Desktop, Cursor, Windsurf, VS Code, Cline and Codex CLI are in [Install](#install).

## Where it is listed

[![T3rnel Market Pulse MCP server](https://glama.ai/mcp/servers/t3ratech/market-pulse-mcp/badges/score.svg)](https://glama.ai/mcp/servers/t3ratech/market-pulse-mcp)

| Directory | Link |
|---|---|
| npm | [@t3ratech/market-pulse-mcp](https://www.npmjs.com/package/@t3ratech/market-pulse-mcp) |
| Official MCP Registry | [io.github.t3ratech/market-pulse](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.t3ratech/market-pulse) |
| Glama | [glama.ai/mcp/servers/t3ratech/market-pulse-mcp](https://glama.ai/mcp/servers/t3ratech/market-pulse-mcp) |
| Smithery | [t3ratech-dev/market-pulse](https://smithery.ai/servers/t3ratech-dev/market-pulse) |
| MCPize (paid, one listing per tier) | [Basic](https://mcpize.com/mcp/t3ratech-market-pulse-mcp) · [Pro](https://mcpize.com/mcp/t3ratech-market-pulse-mcp-pro) · [Max](https://mcpize.com/mcp/t3ratech-market-pulse-mcp-max) · [Operator](https://mcpize.com/mcp/t3ratech-market-pulse-mcp-operator) |
| skills.sh (the skill) | [market-pulse](https://skills.sh/t3ratech/market-pulse-mcp/market-pulse) |

Browse the [Claude Market](https://www.claudemarket.ai) MCP directory.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `MARKET_PULSE_API_KEY` | none | Optional key. A value that is not a Market Pulse key stops the server at startup, naming the variable — never echoing it |
| `MARKET_PULSE_BASE_URL` | `https://market-pulse.t3ratech.co.zw` | Service origin. Must be `https`, except `http` for localhost; no credentials, query or fragment |
| `MARKET_PULSE_TIMEOUT_MS` | `30000` | Per-call timeout, 1000–300000 |

## Agent skill

[`agent-skills/market-pulse`](agent-skills/market-pulse/SKILL.md) teaches an agent the
decision procedure — shortlist, ask `pulse_should_i_bid`, verify with `pulse_evidence`,
find listings, disclose the tier's freshness cost. It installs from this repository:

```bash
npx skills add t3ratech/market-pulse-mcp --skill market-pulse
```

## Security

- The key is sent only as an `Authorization: Bearer` header to the configured origin, over
  HTTPS. Redirects are refused, so the header can never follow one elsewhere.
- The key appears in no log line and no error text.
- Responses over 12 MB are refused rather than relayed.
- The server reads no files, spawns nothing and opens no listening port.
- Report vulnerabilities privately: see [SECURITY.md](SECURITY.md).

## Develop

```bash
npm test                    # protocol, validation, client, packaging, skill, docs parity
npm run sync-tools:check    # tools.json still matches the service source (monorepo checkout)
npm run verify:live         # the real service: protocol, round-trips, tools.json == live
npm run build:mcpb          # Claude Desktop / Smithery bundle
```

`src/tools.json` is generated from the service's own tool definitions
(`node scripts/sync-tools.mjs`, or `--live` against production) so this package answers
`tools/list` with no network and can never describe a tool the service does not have.

## Licence

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). The Market Pulse service and its
data are separate, under [their own terms](https://market-pulse.t3ratech.co.zw/terms).
