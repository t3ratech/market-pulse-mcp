import test from "node:test";
import assert from "node:assert/strict";
import { createClient, RemoteError } from "../src/client.js";
import { startStub, json, toolResult } from "./helpers.js";

const UA = "market-pulse-mcp/test";
const make = (stub, extra = {}) => createClient({ baseUrl: stub.baseUrl, apiKey: null, timeoutMs: 5000, userAgent: UA, ...extra });

test("posts a JSON-RPC tools/call to /mcp with the user agent and no auth when keyless", async () => {
  const stub = await startStub((req, res) => json(res, 200, { jsonrpc: "2.0", id: req.body.id, result: toolResult({ ok: true }) }));
  try {
    const result = await make(stub).callTool("pulse_stats", {});
    assert.deepEqual(result.structuredContent, { ok: true });
    const [seen] = stub.requests;
    assert.equal(seen.method, "POST");
    assert.equal(seen.url, "/mcp");
    assert.equal(seen.headers["user-agent"], UA);
    assert.equal(seen.headers.authorization, undefined, "no key configured, so no Authorization header may be sent");
    assert.deepEqual(seen.body.params, { name: "pulse_stats", arguments: {} });
    assert.equal(seen.body.jsonrpc, "2.0");
    assert.equal(seen.body.method, "tools/call");
  } finally { await stub.close(); }
});

test("sends the key as a Bearer token only when one is configured", async () => {
  const stub = await startStub((req, res) => json(res, 200, { jsonrpc: "2.0", id: req.body.id, result: toolResult({}) }));
  try {
    await make(stub, { apiKey: "mpk_live_abcdef123456" }).callTool("pulse_stats", {});
    assert.equal(stub.requests[0].headers.authorization, "Bearer mpk_live_abcdef123456");
  } finally { await stub.close(); }
});

test("request ids are unique per call", async () => {
  const stub = await startStub((req, res) => json(res, 200, { jsonrpc: "2.0", id: req.body.id, result: toolResult({}) }));
  try {
    const client = make(stub);
    await Promise.all([client.callTool("pulse_stats", {}), client.callTool("pulse_stats", {}), client.callTool("pulse_stats", {})]);
    assert.equal(new Set(stub.requests.map(r => r.body.id)).size, 3);
  } finally { await stub.close(); }
});

test("a rejected key surfaces the service's message and never contains the key", async () => {
  const key = "mpk_live_supersecretvalue99";
  const stub = await startStub((req, res) => json(res, 401, { jsonrpc: "2.0", id: null, error: { code: -32001, message: "The API key sent in the Authorization header is not valid." } }));
  try {
    await assert.rejects(make(stub, { apiKey: key }).callTool("pulse_stats", {}), error => {
      assert.ok(error instanceof RemoteError);
      assert.equal(error.status, 401);
      assert.match(error.message, /not valid/);
      assert.ok(!error.message.includes(key));
      return true;
    });
  } finally { await stub.close(); }
});

test("quota exhaustion is a RemoteError carrying the upgrade guidance", async () => {
  const stub = await startStub((req, res) => json(res, 429, { error: "quota_exceeded", message: "Daily pull budget exhausted on the free tier (20/day). Upgrade at https://x/pricing." }));
  try {
    await assert.rejects(make(stub).callTool("pulse_jobs", {}), error => {
      assert.equal(error.status, 429);
      assert.equal(error.code, "quota_exceeded");
      assert.match(error.message, /Upgrade at/);
      return true;
    });
  } finally { await stub.close(); }
});

test("a JSON-RPC error inside a 200 is a RemoteError with the service's message", async () => {
  const stub = await startStub((req, res) => json(res, 200, { jsonrpc: "2.0", id: req.body.id, error: { code: -32602, message: "unknown lane: nope" } }));
  try {
    await assert.rejects(make(stub).callTool("pulse_lane_detail", { slug: "nope" }), error => {
      assert.match(error.message, /unknown lane: nope/);
      assert.equal(error.code, -32602);
      return true;
    });
  } finally { await stub.close(); }
});

test("a 5xx without a message still says what happened", async () => {
  const stub = await startStub((req, res) => json(res, 503, {}));
  try {
    await assert.rejects(make(stub).callTool("pulse_stats", {}), /HTTP 503/);
  } finally { await stub.close(); }
});

test("a body that is not JSON is reported with its status, not parsed blindly", async () => {
  const stub = await startStub((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<html>Just a moment...</html>"); });
  try {
    await assert.rejects(make(stub).callTool("pulse_stats", {}), /HTTP 200.*not JSON/);
  } finally { await stub.close(); }
});

test("a response over the size limit is refused rather than relayed", async () => {
  const stub = await startStub((req, res) => { res.writeHead(200, { "content-type": "application/json", "content-length": String(20 * 1024 * 1024) }); res.end(); });
  try {
    await assert.rejects(make(stub).callTool("pulse_evidence", {}), /over the .*limit/);
  } finally { await stub.close(); }
});

test("a redirect is refused: the request must never reach the redirect target", async () => {
  const target = await startStub((req, res) => json(res, 200, { jsonrpc: "2.0", id: req.body.id, result: toolResult({ reached: true }) }));
  const stub = await startStub((req, res) => { res.writeHead(307, { location: `${target.baseUrl}/mcp` }); res.end(); });
  try {
    await assert.rejects(make(stub, { apiKey: "mpk_live_abcdef123456" }).callTool("pulse_stats", {}), RemoteError);
    assert.equal(target.requests.length, 0, "following the redirect would deliver the call (and a key) to another origin");
  } finally { await stub.close(); await target.close(); }
});

test("an unanswered call fails at the timeout and says how to raise it", async () => {
  const stub = await startStub(() => { /* never answers */ });
  try {
    const started = Date.now();
    await assert.rejects(make(stub, { timeoutMs: 300 }).callTool("pulse_stats", {}), /did not answer within 300 ms.*MARKET_PULSE_TIMEOUT_MS/);
    assert.ok(Date.now() - started < 3000, "must not hang past the timeout");
  } finally { await stub.close(); }
});

test("a refused connection names the origin and says nothing was changed", async () => {
  const stub = await startStub(() => {});
  const { baseUrl } = stub;
  await stub.close();
  await assert.rejects(createClient({ baseUrl, apiKey: null, timeoutMs: 2000, userAgent: UA }).callTool("pulse_stats", {}), error => {
    assert.match(error.message, new RegExp(baseUrl.replace(/[.:/]/g, m => `\\${m}`)));
    assert.match(error.message, /nothing was changed/);
    return true;
  });
});

test("listTools returns the service's tools", async () => {
  const stub = await startStub((req, res) => json(res, 200, { jsonrpc: "2.0", id: req.body.id, result: { tools: [{ name: "pulse_stats" }] } }));
  try {
    assert.deepEqual(await make(stub).listTools(), [{ name: "pulse_stats" }]);
    assert.equal(stub.requests[0].body.method, "tools/list");
  } finally { await stub.close(); }
});
