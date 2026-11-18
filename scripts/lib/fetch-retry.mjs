// fetch that survives a transient network failure: retries with backoff, and when it finally gives up it throws a
// one-line Error (not undici's stack) so a caller can report it as a failed check instead of crashing.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function reason(error) {
  const cause = error?.cause;
  return cause?.code || cause?.message || error?.message || String(error);
}

export async function fetchRetry(url, init = {}, { tries = 3, backoffMs = 3000, timeoutMs = 15000, fetchImpl = fetch } = {}) {
  let last;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      last = error;
      if (attempt + 1 < tries) await sleep(backoffMs * 3 ** attempt);
    }
  }
  throw new Error(`network error after ${tries} tries: ${reason(last)}`);
}
