import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadChannelConfig, withChannelHeaders, ChannelConfigError, CHANNEL_TIERS } from "../mcpize/channel-fetch.js";
import { channelToken, stageTierProject, TIERS } from "../scripts/lib/mcpize-project.mjs";
import { startStub, json, toolResult } from "./helpers.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const SECRET = "channel-master-secret-for-tests";
// Known answers, computed once and pinned in the service repository's tests too: the two
// implementations (WebCrypto in the Worker, node:crypto here) must agree byte for byte.
const VECTORS = {
  basic: "5cf8f712507a50b176a61fb50c1fd151687f22e0c632381075b06fdc69f56dcb",
  pro: "902cbbf84de7e95d5880dc0f95fc0cb6f54fbdbe6d59605ea202c90fa38fdc55",
  max: "51dad0f8d63474e4c1ab596730b741ea3bc2e357626038b62faae2955d29f0e3",
  operator: "212f0c87b750b80a2fd93463bcf87c21e01949bb72fe8e19dfd9725c088bce71",
};
const GOOD_TOKEN = VECTORS.pro;

test("tokens match the service's known answers, one distinct token per tier", () => {
  for (const tier of TIERS) assert.equal(channelToken(SECRET, tier), VECTORS[tier], tier);
  assert.equal(new Set(Object.values(VECTORS)).size, 4);
  assert.deepEqual(CHANNEL_TIERS, TIERS);
});

test("channel config accepts a tier and its token and refuses anything else, never echoing the token", () => {
  assert.deepEqual(loadChannelConfig({ MARKET_PULSE_CHANNEL_TIER: "pro", MARKET_PULSE_CHANNEL_TOKEN: GOOD_TOKEN }), { tier: "pro", token: GOOD_TOKEN });
  for (const tier of [undefined, "", "free", "PRO", "enterprise"]) {
    assert.throws(() => loadChannelConfig({ MARKET_PULSE_CHANNEL_TIER: tier, MARKET_PULSE_CHANNEL_TOKEN: GOOD_TOKEN }), error => error instanceof ChannelConfigError && /MARKET_PULSE_CHANNEL_TIER/.test(error.message));
  }
  const bad = "not-hex-but-secret-looking-0123456789";
  for (const token of [undefined, "", "abc", GOOD_TOKEN.toUpperCase(), GOOD_TOKEN + "0", bad]) {
    assert.throws(() => loadChannelConfig({ MARKET_PULSE_CHANNEL_TIER: "pro", MARKET_PULSE_CHANNEL_TOKEN: token }), error => {
      assert.match(error.message, /MARKET_PULSE_CHANNEL_TOKEN/);
      assert.ok(!error.message.includes(bad));
      return true;
    });
  }
});

test("the claim is added to requests for the service's origin only, and existing headers survive", async () => {
  const seen = [];
  const fake = async (input, init) => { seen.push({ input, headers: new Headers(init?.headers) }); return new Response("{}"); };
  const wrapped = withChannelHeaders(fake, { origin: "https://market-pulse.example/mcp", tier: "pro", token: GOOD_TOKEN });
  await wrapped("https://market-pulse.example/mcp", { headers: { authorization: "Bearer mpk_live_buyerkey1234", "content-type": "application/json" } });
  await wrapped(new URL("https://market-pulse.example/other"), {});
  await wrapped("https://elsewhere.example/mcp", { headers: { authorization: "Bearer mpk_live_buyerkey1234" } });
  const [a, b, c] = seen;
  for (const call of [a, b]) {
    assert.equal(call.headers.get("x-market-pulse-channel"), "mcpize");
    assert.equal(call.headers.get("x-market-pulse-channel-tier"), "pro");
    assert.equal(call.headers.get("x-market-pulse-channel-token"), GOOD_TOKEN);
  }
  assert.equal(a.headers.get("authorization"), "Bearer mpk_live_buyerkey1234");
  assert.equal(a.headers.get("content-type"), "application/json");
  for (const name of ["x-market-pulse-channel", "x-market-pulse-channel-tier", "x-market-pulse-channel-token"]) {
    assert.equal(c.headers.get(name), null, `${name} must never leave for another origin`);
  }
});

function run(env, lines) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, "mcpize/entry.js")], { env: { PATH: process.env.PATH, ...env }, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", d => { stdout += d; });
    child.stderr.on("data", d => { stderr += d; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr, messages: stdout.split("\n").filter(Boolean).map(l => JSON.parse(l)) }));
    for (const line of lines) child.stdin.write(`${line}\n`);
    child.stdin.end();
  });
}

test("entry.js end to end: the buyer's key and the channel claim both reach the service", async () => {
  const stub = await startStub((req, res) => json(res, 200, { jsonrpc: "2.0", id: req.body.id, result: toolResult({ tier: "pro" }) }));
  try {
    const { code, messages } = await run(
      { MARKET_PULSE_BASE_URL: stub.baseUrl, MARKET_PULSE_API_KEY: "mpk_live_buyerkey1234", MARKET_PULSE_CHANNEL_TIER: "pro", MARKET_PULSE_CHANNEL_TOKEN: GOOD_TOKEN },
      [JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "pulse_account", arguments: {} } })],
    );
    assert.equal(code, 0);
    assert.deepEqual(messages[0].result.structuredContent, { tier: "pro" });
    const [seen] = stub.requests;
    assert.equal(seen.headers.authorization, "Bearer mpk_live_buyerkey1234");
    assert.equal(seen.headers["x-market-pulse-channel"], "mcpize");
    assert.equal(seen.headers["x-market-pulse-channel-tier"], "pro");
    assert.equal(seen.headers["x-market-pulse-channel-token"], GOOD_TOKEN);
  } finally { await stub.close(); }
});

test("entry.js with no buyer key still sends the claim, so the service can say how to link an account", async () => {
  const stub = await startStub((req, res) => json(res, 401, { jsonrpc: "2.0", id: null, error: { code: -32001, message: "This MCPize plan (Pro) activates on your own Market Pulse account, and no key was sent." } }));
  try {
    const { messages } = await run(
      { MARKET_PULSE_BASE_URL: stub.baseUrl, MARKET_PULSE_CHANNEL_TIER: "pro", MARKET_PULSE_CHANNEL_TOKEN: GOOD_TOKEN },
      [JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "pulse_account", arguments: {} } })],
    );
    assert.equal(stub.requests[0].headers.authorization, undefined);
    assert.equal(messages[0].result.isError, true);
    assert.match(messages[0].result.content[0].text, /activates on your own Market Pulse account/);
  } finally { await stub.close(); }
});

test("entry.js fails fast on a missing or malformed channel config, naming the variable and never the value", async () => {
  const cases = [
    [{ MARKET_PULSE_CHANNEL_TIER: "pro" }, /MARKET_PULSE_CHANNEL_TOKEN/],
    [{ MARKET_PULSE_CHANNEL_TOKEN: GOOD_TOKEN }, /MARKET_PULSE_CHANNEL_TIER/],
    [{ MARKET_PULSE_CHANNEL_TIER: "free", MARKET_PULSE_CHANNEL_TOKEN: GOOD_TOKEN }, /MARKET_PULSE_CHANNEL_TIER/],
    [{ MARKET_PULSE_CHANNEL_TIER: "pro", MARKET_PULSE_CHANNEL_TOKEN: "deadbeef-secret-looking" }, /MARKET_PULSE_CHANNEL_TOKEN/],
    [{ MARKET_PULSE_CHANNEL_TIER: "pro", MARKET_PULSE_CHANNEL_TOKEN: GOOD_TOKEN, MARKET_PULSE_BASE_URL: "http://evil.example" }, /https/],
  ];
  for (const [env, pattern] of cases) {
    const { code, stderr, stdout } = await run(env, []);
    assert.equal(code, 1, JSON.stringify(env));
    assert.match(stderr, pattern);
    assert.ok(!stderr.includes("deadbeef-secret-looking") && !stderr.includes(GOOD_TOKEN));
    assert.equal(stdout, "");
  }
});

test("each tier's staged project is the published code plus the entrypoint, in a non-root image", () => {
  for (const tier of TIERS) {
    const dir = stageTierProject(tier);
    const files = (d, prefix = "") => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? files(p, `${prefix}${n}/`) : [`${prefix}${n}`]; });
    const staged = files(dir);
    for (const must of ["Dockerfile", "mcpize.yaml", "package.json", "mcpize/entry.js", "mcpize/channel-fetch.js", "src/server.js", "src/tools.json"]) assert.ok(staged.includes(must), `${tier} is missing ${must}`);
    for (const f of staged) assert.doesNotMatch(f, /^(tests|scripts|\.github|node_modules)\/|\.env|servers\.json|^\.mcpize/, `${tier} must not ship ${f}`);
    const docker = readFileSync(join(dir, "Dockerfile"), "utf8");
    assert.match(docker, /^USER node$/m);
    assert.match(docker, /ENTRYPOINT \["node", "mcpize\/entry\.js"\]/);
    assert.match(docker, /COPY mcpize \.\/mcpize/);
    assert.doesNotMatch(docker, /MARKET_PULSE|mpk_|TOKEN|SECRET/, "the image carries no secret; they are injected at runtime");
    assert.equal(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name, `@t3ratech/market-pulse-mcp-${tier}`);
    assert.equal(readFileSync(join(dir, "mcpize.yaml"), "utf8"), readFileSync(join(root, "mcpize/mcpize.template.yaml"), "utf8"));
  }
});

test("the staged server code is byte-identical to what npm publishes", () => {
  const dir = stageTierProject("pro");
  for (const f of readdirSync(join(root, "src"))) assert.equal(readFileSync(join(dir, "src", f), "utf8"), readFileSync(join(root, "src", f), "utf8"), f);
});

test("the MCPize manifest: tier and token are deployment secrets, the buyer's key is a required per-user credential", () => {
  const y = readFileSync(join(root, "mcpize/mcpize.template.yaml"), "utf8");
  assert.match(y, /^runtime: container$/m);
  assert.match(y, /args:\n    - mcpize\/entry\.js$/m);
  assert.match(y, /^secrets:\n  - name: MARKET_PULSE_CHANNEL_TIER\n    required: true/m);
  assert.match(y, /  - name: MARKET_PULSE_CHANNEL_TOKEN\n    required: true/m);
  assert.match(y, /^credentials:\n  - name: MARKET_PULSE_API_KEY\n    required: true/m);
  assert.match(y, /mapping:\n      env: MARKET_PULSE_API_KEY/);
  assert.match(y, /^credentials_mode: per_user$/m);
  assert.doesNotMatch(y, /mpk_[A-Za-z0-9]{8,}/);
  assert.match(y, /never a grade/i);
});

test("the entrypoint and MCPize files are not in the npm tarball", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const f of pkg.files) assert.doesNotMatch(f, /mcpize/, `${f} would publish the MCPize deployment code`);
  assert.ok(existsSync(join(root, "mcpize/entry.js")));
});
