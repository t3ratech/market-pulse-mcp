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

### Managed access on MCPize (paid)

Prefer not to manage a key? The [MCPize listing](https://mcpize.com) hosts this server and
bills a subscription; calls go through the publisher's key, so a subscriber needs no
Market Pulse account. It is paid access only. The npm package above remains free.

## Where it is listed

[![T3rnel Market Pulse MCP server](https://glama.ai/mcp/servers/t3ratech/market-pulse-mcp/badges/score.svg)](https://glama.ai/mcp/servers/t3ratech/market-pulse-mcp)

| Directory | Link |
|---|---|
| npm | [@t3ratech/market-pulse-mcp](https://www.npmjs.com/package/@t3ratech/market-pulse-mcp) |
| Official MCP Registry | [io.github.t3ratech/market-pulse](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.t3ratech/market-pulse) |
| Glama | [glama.ai/mcp/servers/t3ratech/market-pulse-mcp](https://glama.ai/mcp/servers/t3ratech/market-pulse-mcp) |
| Smithery | [t3ratech-dev/market-pulse](https://smithery.ai/servers/t3ratech-dev/market-pulse) |
| MCPize (managed, paid) | [t3ratech-market-pulse-mcp](https://mcpize.com/mcp/t3ratech-market-pulse-mcp) |
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
