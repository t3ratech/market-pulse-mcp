import http from "node:http";

// A stand-in for the Market Pulse /mcp endpoint. It records every request so a test can
// assert what crossed the wire (and what did not), and answers from a handler the test
// supplies. It is a protocol stub, not a data fake: data-bearing behaviour is verified
// against the real service by scripts/verify-live.mjs.
export async function startStub(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const record = { method: req.method, url: req.url, headers: req.headers, raw, body: raw ? JSON.parse(raw) : null };
      requests.push(record);
      handler(record, res);
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { requests, baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

export function json(res, status, payload, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(payload));
}

export function toolResult(payload) {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
}
