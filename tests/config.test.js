import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, ConfigError, DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS } from "../src/config.js";

test("defaults to the production origin, no key and the documented timeout", () => {
  assert.deepEqual(loadConfig({}), { baseUrl: DEFAULT_BASE_URL, apiKey: null, timeoutMs: DEFAULT_TIMEOUT_MS });
});

test("an empty key variable means no key, not an invalid one", () => {
  assert.equal(loadConfig({ MARKET_PULSE_API_KEY: "   " }).apiKey, null);
});

test("a well-formed key is accepted and trimmed", () => {
  assert.equal(loadConfig({ MARKET_PULSE_API_KEY: "  mpk_live_abcdef123456  " }).apiKey, "mpk_live_abcdef123456");
});

test("a key that is not a Market Pulse key is refused, and the refusal never echoes it", () => {
  const secret = "sk-this-is-some-other-providers-secret";
  assert.throws(() => loadConfig({ MARKET_PULSE_API_KEY: secret }), error => {
    assert.ok(error instanceof ConfigError);
    assert.match(error.message, /MARKET_PULSE_API_KEY/);
    assert.ok(!error.message.includes(secret), "the rejected value must not appear in the message");
    return true;
  });
});

test("a key too short to be real is refused", () => {
  assert.throws(() => loadConfig({ MARKET_PULSE_API_KEY: "mpk_x" }), /MARKET_PULSE_API_KEY/);
});

test("plaintext http is refused for any host that is not this machine", () => {
  assert.throws(() => loadConfig({ MARKET_PULSE_BASE_URL: "http://market-pulse.example.com" }), /https/);
  assert.throws(() => loadConfig({ MARKET_PULSE_BASE_URL: "http://10.0.0.5:8899" }), /https/);
  assert.equal(loadConfig({ MARKET_PULSE_BASE_URL: "http://127.0.0.1:8899" }).baseUrl, "http://127.0.0.1:8899");
  assert.equal(loadConfig({ MARKET_PULSE_BASE_URL: "http://localhost:8899" }).baseUrl, "http://localhost:8899");
});

test("an origin carrying credentials, a query or a fragment is refused", () => {
  for (const bad of ["https://user:pw@x.example", "https://x.example/?a=1", "https://x.example/#frag"]) {
    assert.throws(() => loadConfig({ MARKET_PULSE_BASE_URL: bad }), /bare origin/, bad);
  }
});

test("a non-URL base is refused and trailing slashes are normalised away", () => {
  assert.throws(() => loadConfig({ MARKET_PULSE_BASE_URL: "not a url" }), /valid URL/);
  assert.equal(loadConfig({ MARKET_PULSE_BASE_URL: "https://x.example///" }).baseUrl, "https://x.example");
});

test("timeout must be an integer inside the documented bounds", () => {
  for (const bad of ["abc", "999", "300001", "1.5", "-5"]) {
    assert.throws(() => loadConfig({ MARKET_PULSE_TIMEOUT_MS: bad }), /MARKET_PULSE_TIMEOUT_MS/, bad);
  }
  assert.equal(loadConfig({ MARKET_PULSE_TIMEOUT_MS: "1000" }).timeoutMs, 1000);
  assert.equal(loadConfig({ MARKET_PULSE_TIMEOUT_MS: "300000" }).timeoutMs, 300000);
});
