#!/usr/bin/env node
// Entrypoint of the MCPize deployments (one listing per Market Pulse tier). It runs the
// published server unchanged and adds the channel claim to its requests to the service.
// It is deliberately outside src/ and outside the npm tarball: the npm package is the
// free, keyless server; this file exists only inside the MCPize image.
import { loadConfig, ConfigError } from "../src/config.js";
import { main } from "../src/server.js";
import { loadChannelConfig, withChannelHeaders, ChannelConfigError } from "./channel-fetch.js";

try {
  const { baseUrl } = loadConfig();
  const { tier, token } = loadChannelConfig();
  globalThis.fetch = withChannelHeaders(globalThis.fetch, { origin: baseUrl, tier, token });
} catch (error) {
  if (error instanceof ConfigError || error instanceof ChannelConfigError) {
    process.stderr.write(`market-pulse-mcp (mcpize): ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
await main();
