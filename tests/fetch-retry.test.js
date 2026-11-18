import test from "node:test";
import assert from "node:assert/strict";
import { fetchRetry } from "../scripts/lib/fetch-retry.mjs";

const fast = { backoffMs: 1, timeoutMs: 1000 };

test("a transient failure is retried and the answer is returned", async () => {
  let calls = 0;
  const impl = async () => { if (++calls < 3) throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }); return { status: 200 }; };
  const res = await fetchRetry("https://x.test", {}, { ...fast, fetchImpl: impl });
  assert.equal(res.status, 200);
  assert.equal(calls, 3);
});

test("after the last try it throws ONE short line naming the cause, not a stack dump", async () => {
  const impl = async () => { throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }); };
  await assert.rejects(fetchRetry("https://x.test", {}, { ...fast, tries: 2, fetchImpl: impl }), (e) => {
    assert.match(e.message, /^network error after 2 tries: UND_ERR_CONNECT_TIMEOUT$/);
    assert.equal(e.message.includes("\n"), false);
    return true;
  });
});

test("an HTTP error status is an answer, not a failure: it is returned unretried", async () => {
  let calls = 0;
  const impl = async () => { calls++; return { status: 503 }; };
  const res = await fetchRetry("https://x.test", {}, { ...fast, fetchImpl: impl });
  assert.equal(res.status, 503);
  assert.equal(calls, 1);
});

test("every attempt carries a timeout signal", async () => {
  let signal;
  await fetchRetry("https://x.test", {}, { ...fast, fetchImpl: async (_u, init) => { signal = init.signal; return { status: 200 }; } });
  assert.ok(signal instanceof AbortSignal);
});
