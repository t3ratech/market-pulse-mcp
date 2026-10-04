<!-- doc-version: 1.0.0 | last-reviewed: 2026-10-04 | owner: release-engineer -->

# Changelog

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
