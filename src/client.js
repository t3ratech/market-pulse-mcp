// One job: forward a validated tools/call to the Market Pulse MCP endpoint and turn
// every way that can go wrong into a message a model can act on. The API key is read
// from configuration and written only into the Authorization header of a request to
// the configured origin; it appears in no error text and no log line.

const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;

export class RemoteError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createClient({ baseUrl, apiKey, timeoutMs, userAgent, fetchImpl = fetch }) {
  let nextId = 1;

  async function rpc(method, params) {
    const headers = { "content-type": "application/json", accept: "application/json", "user-agent": userAgent };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/mcp`, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
    } catch (error) {
      if (error?.name === "TimeoutError") throw new RemoteError(`Market Pulse did not answer within ${timeoutMs} ms (${baseUrl}). Retry, or raise MARKET_PULSE_TIMEOUT_MS.`);
      throw new RemoteError(`Could not reach Market Pulse at ${baseUrl}: ${error?.cause?.code || error?.message || "network error"}. Check the connection; nothing was changed.`);
    }
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
      throw new RemoteError(`Market Pulse answered with ${declared} bytes, over the ${MAX_RESPONSE_BYTES}-byte limit. Narrow the query with a filter.`, { status: response.status });
    }
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new RemoteError("Market Pulse answered with more data than this server will relay. Narrow the query with a filter.", { status: response.status });
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new RemoteError(`Market Pulse answered HTTP ${response.status} with a body that is not JSON.`, { status: response.status });
    }
    if (response.status === 401) throw new RemoteError(body?.error?.message || body?.message || "Market Pulse rejected the API key (unknown, revoked or mistyped). Unset MARKET_PULSE_API_KEY for the free tier.", { status: 401, code: body?.error?.code ?? null });
    if (response.status === 429) throw new RemoteError(body?.message || "Market Pulse daily pull budget is exhausted for this tier. Call pulse_account to see the quota and where to upgrade.", { status: 429, code: "quota_exceeded" });
    if (!response.ok) throw new RemoteError(body?.error?.message || body?.message || `Market Pulse answered HTTP ${response.status}.`, { status: response.status, code: body?.error?.code ?? null });
    if (body?.error) throw new RemoteError(body.error.message || "Market Pulse refused the call.", { status: response.status, code: body.error.code ?? null });
    return body.result;
  }

  return {
    callTool: (name, args) => rpc("tools/call", { name, arguments: args }),
    listTools: async () => (await rpc("tools/list", {})).tools,
  };
}
