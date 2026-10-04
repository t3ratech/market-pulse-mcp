<!-- doc-version: 1.0.0 | last-reviewed: 2026-10-04 | owner: release-engineer -->

# Changelog

## Unreleased — 2026-10-04 (no change to the published npm package)

- **MCPize is now one paid listing per tier** (Basic, Pro, Max, Operator), each with a single plan
  priced from the service's own plan catalog; buying one activates that tier on the buyer's own
  Market Pulse account through WavePay. The deployment entrypoint (`mcpize/entry.js`), the deploy and
  verification scripts and the per-tier manifest live outside `src/` and outside the npm tarball.
  This replaces the earlier single managed-access plan.
- **Tier notices** — the service now returns a `tierNotice` on `pulse_jobs`, `pulse_lanes`,
  `pulse_lane_detail`, `pulse_should_i_bid` and `pulse_account` for free and Basic callers (hidden
  listings, bids already placed, plan prices and delays, upgrade links). Tool definitions are
  unchanged, so `tools.json` and 1.0.0 are untouched. The bundled skill now instructs agents to relay
  the notice.

## 1.0.0 — 2026-10-04

First release.

- Stdio MCP server over the hosted Market Pulse service: `pulse_lanes`, `pulse_lane_detail`,
  `pulse_should_i_bid`, `pulse_evidence`, `pulse_jobs`, `pulse_stats`, `pulse_methodology`,
  `pulse_resources`, `pulse_resource_detail`, `pulse_account`. All read-only; the free tier
  needs no key.
- Tool definitions carry titles, annotations, output schemas and descriptions that state
  purpose, routing to sibling tools, behaviour and return shape.
- Arguments are validated locally against the published schema; refusals name the argument
  and the values that work.
- Startup configuration validation: a malformed key, a plaintext non-local origin or an
  out-of-range timeout stops the server with a message naming the variable.
- Agent skill `market-pulse`, a Claude Code plugin manifest and marketplace, an MCPB bundle
  for Claude Desktop, and registry manifests for the official MCP Registry, Smithery,
  Glama and MCPize.
- Service-side fixes shipped alongside: the `pulse_lanes` filters now publish their closed
  enums (they were silently absent, so a bad `grade` returned an empty list), and
  `pulse_evidence` returns an object rather than a bare array.
