#!/usr/bin/env node
/**
 * T3rnel Market Pulse MCP server.
 *
 * Market Pulse grades the places an autonomous agent can find paid work — bounty
 * boards, agent marketplaces, job feeds — from evidence, and publishes the evidence
 * hash-chained. This server exposes that index to any MCP client over stdio.
 *
 *   { "mcpServers": { "market-pulse": {
 *       "command": "npx", "args": ["-y", "@t3ratech/market-pulse-mcp"]
 *   } } }
 *
 * No key is needed. Set MARKET_PULSE_API_KEY (create one at
 * https://market-pulse.t3ratech.co.zw/account) to raise the daily pull budget and
 * see new job listings sooner. Paid tiers buy delivery capacity, never a grade.
 */
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TOOLS, findTool } from "./tools.js";
import { loadConfig, ConfigError } from "./config.js";
import { createClient, RemoteError } from "./client.js";
import { validateToolArgs } from "./validate.js";

const require = createRequire(import.meta.url);
export const { version: SERVER_VERSION } = require("../package.json");
export const SERVER_NAME = "market-pulse";
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS =
  "Market Pulse is an evidence-backed index of where autonomous agents can find paid work. " +
  "Start with pulse_lanes to shortlist lanes, call pulse_should_i_bid before committing effort to one, " +
  "and read pulse_evidence to verify a grade. All tools are read-only and work without a key on the free tier; " +
  "Unknown is a valid answer and means unmeasured, not failed. Call pulse_account to see the tier and daily quota.";

function refusal(text) {
  return { content: [{ type: "text", text }], isError: true };
}

export function createServer({ client, tools = TOOLS }) {
  async function callTool(params) {
    const tool = tools.find(t => t.name === params?.name);
    if (!tool) {
      return { error: { code: -32602, message: `unknown tool: ${params?.name}. Available: ${tools.map(t => t.name).join(", ")}` } };
    }
    const args = params.arguments ?? {};
    const invalid = validateToolArgs(tool, args);
    if (invalid) return { result: refusal(invalid) };
    try {
      return { result: await client.callTool(tool.name, args) };
    } catch (error) {
      if (error instanceof RemoteError) return { result: refusal(error.message) };
      throw error;
    }
  }

  async function handleOne(message) {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return { jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32600, message: "invalid JSON-RPC 2.0 request" } };
    }
    const { id, method, params } = message;
    const isNotification = id === undefined;
    const ok = result => (isNotification ? null : { jsonrpc: "2.0", id, result });
    const fail = (code, text) => (isNotification ? null : { jsonrpc: "2.0", id, error: { code, message: text } });
    switch (method) {
      case "initialize": {
        const asked = params?.protocolVersion;
        return ok({
          protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, title: "T3rnel Market Pulse", version: SERVER_VERSION },
          instructions: INSTRUCTIONS,
        });
      }
      case "notifications/initialized":
      case "notifications/cancelled":
        return null;
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools });
      case "tools/call": {
        const { result, error } = await callTool(params);
        return error ? fail(error.code, error.message) : ok(result);
      }
      default:
        return fail(-32601, `method not found: ${method}`);
    }
  }

  return {
    async handle(message) {
      if (Array.isArray(message)) {
        const replies = (await Promise.all(message.map(handleOne))).filter(r => r !== null);
        return replies.length ? replies : null;
      }
      return handleOne(message);
    },
  };
}

export async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`market-pulse-mcp: ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
  const client = createClient({ ...config, userAgent: `market-pulse-mcp/${SERVER_VERSION}` });
  const server = createServer({ client });
  const send = payload => process.stdout.write(`${JSON.stringify(payload)}\n`);
  const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const inFlight = new Set();
  reader.on("line", line => {
    if (!line.trim()) return;
    const work = (async () => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
        return;
      }
      try {
        const reply = await server.handle(message);
        if (reply) send(reply);
      } catch (error) {
        send({ jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32603, message: `internal error: ${error.message}` } });
      }
    })();
    inFlight.add(work);
    work.finally(() => inFlight.delete(work));
  });
  // A client that closes stdin while a call is outstanding still gets its answer.
  reader.on("close", async () => {
    await Promise.allSettled([...inFlight]);
    process.exit(0);
  });
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();
