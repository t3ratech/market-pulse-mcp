import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer, SERVER_VERSION, SERVER_NAME } from "../src/server.js";
import { createClient } from "../src/client.js";
import { TOOLS } from "../src/tools.js";
import { startStub, json, toolResult } from "./helpers.js";

const serverPath = fileURLToPath(new URL("../src/server.js", import.meta.url));
const request = (method, params, id = 1) => ({ jsonrpc: "2.0", id, method, params });

async function withServer(handler, fn, clientExtra = {}) {
  const stub = await startStub(handler);
  const client = createClient({ baseUrl: stub.baseUrl, apiKey: null, timeoutMs: 5000, userAgent: "t", ...clientExtra });
  try { return await fn(createServer({ client }), stub); } finally { await stub.close(); }
}
const echo = (req, res) => json(res, 200, { jsonrpc: "2.0", id: req.body.id, result: toolResult({ echoed: req.body.params }) });

test("initialize echoes a supported protocol version and falls back to the newest otherwise", async () => {
  await withServer(echo, async server => {
    for (const asked of ["2025-06-18", "2025-03-26", "2024-11-05"]) {
      const r = (await server.handle(request("initialize", { protocolVersion: asked }))).result;
      assert.equal(r.protocolVersion, asked);
      assert.equal(r.serverInfo.name, SERVER_NAME);
      assert.equal(r.serverInfo.version, SERVER_VERSION);
      assert.deepEqual(r.capabilities, { tools: { listChanged: false } });
      assert.match(r.instructions, /pulse_should_i_bid/);
    }
    assert.equal((await server.handle(request("initialize", { protocolVersion: "1999-01-01" }))).result.protocolVersion, "2025-06-18");
    assert.equal((await server.handle(request("initialize", undefined))).result.protocolVersion, "2025-06-18");
  });
});

test("tools/list answers from the shipped definitions with no network call", async () => {
  await withServer(echo, async (server, stub) => {
    const r = (await server.handle(request("tools/list"))).result;
    assert.deepEqual(r.tools, TOOLS);
    assert.equal(stub.requests.length, 0, "tools/list must not touch the network — registries introspect in a sandbox");
  });
});

test("notifications get no reply, ping gets an empty result", async () => {
  await withServer(echo, async server => {
    assert.equal(await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
    assert.equal(await server.handle({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1 } }), null);
    assert.deepEqual(await server.handle(request("ping")), { jsonrpc: "2.0", id: 1, result: {} });
  });
});

test("an unknown method is -32601 for a request and silent for a notification", async () => {
  await withServer(echo, async server => {
    assert.equal((await server.handle(request("resources/list"))).error.code, -32601);
    assert.equal(await server.handle({ jsonrpc: "2.0", method: "resources/list" }), null);
  });
});

test("malformed messages are -32600 and carry the id when there is one", async () => {
  await withServer(echo, async server => {
    for (const bad of [null, {}, { jsonrpc: "1.0", method: "ping", id: 4 }, { jsonrpc: "2.0", id: 5 }, { jsonrpc: "2.0", id: 6, method: 7 }]) {
      const r = await server.handle(bad);
      assert.equal(r.error.code, -32600);
    }
    assert.equal((await server.handle({ jsonrpc: "2.0", id: 5 })).id, 5);
  });
});

test("a batch is answered in one array, minus notifications", async () => {
  await withServer(echo, async server => {
    const r = await server.handle([request("ping", undefined, 1), { jsonrpc: "2.0", method: "notifications/initialized" }, request("tools/list", undefined, 2)]);
    assert.equal(r.length, 2);
    assert.deepEqual(r.map(x => x.id), [1, 2]);
    assert.equal(await server.handle([{ jsonrpc: "2.0", method: "notifications/initialized" }]), null);
  });
});

test("an unknown tool is -32602 listing the tools that exist, and costs no request", async () => {
  await withServer(echo, async (server, stub) => {
    const r = await server.handle(request("tools/call", { name: "pulse_nope", arguments: {} }));
    assert.equal(r.error.code, -32602);
    assert.match(r.error.message, /pulse_nope/);
    assert.match(r.error.message, /pulse_lanes/);
    assert.equal((await server.handle(request("tools/call", {}))).error.code, -32602);
    assert.equal(stub.requests.length, 0);
  });
});

test("a call forwards name and arguments and returns the service's result verbatim", async () => {
  await withServer(echo, async (server, stub) => {
    const r = (await server.handle(request("tools/call", { name: "pulse_lanes", arguments: { grade: "A" } }))).result;
    assert.deepEqual(r.structuredContent.echoed, { name: "pulse_lanes", arguments: { grade: "A" } });
    assert.equal(stub.requests.length, 1);
  });
});

test("omitted arguments are forwarded as an empty object", async () => {
  await withServer(echo, async (server, stub) => {
    await server.handle(request("tools/call", { name: "pulse_stats" }));
    assert.deepEqual(stub.requests[0].body.params.arguments, {});
  });
});

test("an invalid argument is refused as a tool result, before any network call", async () => {
  await withServer(echo, async (server, stub) => {
    const r = (await server.handle(request("tools/call", { name: "pulse_lanes", arguments: { grade: "Z" } }))).result;
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /one of: A, B, C, F, Unknown/);
    assert.equal(stub.requests.length, 0, "a bad argument must never cost the user a pull from their quota");
  });
});

test("a service refusal reaches the model as a tool error it can act on", async () => {
  await withServer((req, res) => json(res, 200, { jsonrpc: "2.0", id: req.body.id, error: { code: -32602, message: "unknown lane: nope" } }), async server => {
    const r = (await server.handle(request("tools/call", { name: "pulse_lane_detail", arguments: { slug: "nope" } }))).result;
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /unknown lane: nope/);
  });
});

test("quota exhaustion reaches the model with the upgrade guidance", async () => {
  await withServer((req, res) => json(res, 429, { error: "quota_exceeded", message: "Daily pull budget exhausted on the free tier (20/day). Upgrade at https://x/pricing." }), async server => {
    const r = (await server.handle(request("tools/call", { name: "pulse_jobs", arguments: {} }))).result;
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /Upgrade at/);
  });
});

test("an unexpected client failure is not swallowed into a success", async () => {
  const server = createServer({ client: { callTool: async () => { throw new TypeError("boom"); } } });
  await assert.rejects(server.handle(request("tools/call", { name: "pulse_stats", arguments: {} })), /boom/);
});

test("concurrent calls are answered independently and in the right order of ids", async () => {
  await withServer((req, res) => setTimeout(() => json(res, 200, { jsonrpc: "2.0", id: req.body.id, result: toolResult({ n: req.body.params.arguments.q }) }), req.body.params.arguments.q === "slow" ? 150 : 5), async server => {
    const [a, b] = await Promise.all([
      server.handle(request("tools/call", { name: "pulse_jobs", arguments: { q: "slow" } }, "a")),
      server.handle(request("tools/call", { name: "pulse_jobs", arguments: { q: "fast" } }, "b")),
    ]);
    assert.equal(a.id, "a"); assert.equal(a.result.structuredContent.n, "slow");
    assert.equal(b.id, "b"); assert.equal(b.result.structuredContent.n, "fast");
  });
});

// --- the real process, over real stdio -------------------------------------------------

function runProcess(env, lines) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], { env: { PATH: process.env.PATH, ...env }, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", d => { stdout += d; });
    child.stderr.on("data", d => { stderr += d; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr, messages: stdout.split("\n").filter(Boolean).map(l => JSON.parse(l)) }));
    for (const line of lines) child.stdin.write(`${line}\n`);
    child.stdin.end();
  });
}

test("stdio end to end: initialize, list, call, then stdin closes mid-call and the answer still arrives", async () => {
  const stub = await startStub((req, res) => setTimeout(() => json(res, 200, { jsonrpc: "2.0", id: req.body.id, result: toolResult({ ok: true }) }), 120));
  try {
    const { code, messages } = await runProcess({ MARKET_PULSE_BASE_URL: stub.baseUrl }, [
      JSON.stringify(request("initialize", { protocolVersion: "2025-06-18" }, 1)),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      JSON.stringify(request("tools/list", undefined, 2)),
      JSON.stringify(request("tools/call", { name: "pulse_stats", arguments: {} }, 3)),
    ]);
    assert.equal(code, 0);
    assert.deepEqual(messages.map(m => m.id).sort(), [1, 2, 3]);
    assert.equal(messages.find(m => m.id === 2).result.tools.length, TOOLS.length);
    assert.deepEqual(messages.find(m => m.id === 3).result.structuredContent, { ok: true });
  } finally { await stub.close(); }
});

test("stdio: a line that is not JSON gets a parse error and the server keeps serving", async () => {
  const { code, messages } = await runProcess({}, ["this is not json", JSON.stringify(request("ping", undefined, 9))]);
  assert.equal(code, 0);
  assert.equal(messages[0].error.code, -32700);
  assert.equal(messages[0].id, null);
  assert.deepEqual(messages[1], { jsonrpc: "2.0", id: 9, result: {} });
});

test("stdio: blank lines are ignored", async () => {
  const { messages } = await runProcess({}, ["", "   ", JSON.stringify(request("ping", undefined, 1))]);
  assert.equal(messages.length, 1);
});

test("stdio: a bad key stops the server at startup with exit 1, naming the variable and not the value", async () => {
  const secret = "definitely-not-a-market-pulse-key";
  const { code, stderr, stdout } = await runProcess({ MARKET_PULSE_API_KEY: secret }, []);
  assert.equal(code, 1);
  assert.match(stderr, /MARKET_PULSE_API_KEY/);
  assert.ok(!stderr.includes(secret) && !stdout.includes(secret));
  assert.equal(stdout, "", "nothing may be written to the protocol stream when startup fails");
});

test("stdio: an insecure origin stops the server at startup", async () => {
  const { code, stderr } = await runProcess({ MARKET_PULSE_BASE_URL: "http://evil.example" }, []);
  assert.equal(code, 1);
  assert.match(stderr, /https/);
});

test("stdio: with an unreachable service a call comes back as a tool error, not a crash", async () => {
  const stub = await startStub(() => {});
  const { baseUrl } = stub;
  await stub.close();
  const { code, messages } = await runProcess({ MARKET_PULSE_BASE_URL: baseUrl }, [JSON.stringify(request("tools/call", { name: "pulse_stats", arguments: {} }, 1))]);
  assert.equal(code, 0);
  assert.equal(messages[0].result.isError, true);
  assert.match(messages[0].result.content[0].text, /Could not reach Market Pulse/);
});
