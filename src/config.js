// Environment is parsed once, at startup, and a bad value stops the server with a
// message naming the variable. A key that is silently ignored would serve the free
// tier to someone who is paying, and nothing downstream would disagree.

export const DEFAULT_BASE_URL = "https://market-pulse.t3ratech.co.zw";
export const DEFAULT_TIMEOUT_MS = 30000;

export class ConfigError extends Error {}

function isLoopback(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function loadConfig(env = process.env) {
  const rawBase = (env.MARKET_PULSE_BASE_URL ?? DEFAULT_BASE_URL).trim();
  let url;
  try {
    url = new URL(rawBase);
  } catch {
    throw new ConfigError("MARKET_PULSE_BASE_URL is not a valid URL");
  }
  // The key travels in an Authorization header, so plaintext is refused for any
  // host that is not this machine.
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
    throw new ConfigError("MARKET_PULSE_BASE_URL must be https (http is accepted only for localhost)");
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new ConfigError("MARKET_PULSE_BASE_URL must be a bare origin, with no credentials, query or fragment");
  }
  const baseUrl = `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;

  const rawKey = env.MARKET_PULSE_API_KEY;
  let apiKey = null;
  if (rawKey !== undefined && rawKey.trim() !== "") {
    apiKey = rawKey.trim();
    if (!/^mpk_[A-Za-z0-9_-]{8,}$/.test(apiKey)) {
      throw new ConfigError("MARKET_PULSE_API_KEY is not a Market Pulse key (they start with mpk_). Create one at " + DEFAULT_BASE_URL + "/account or unset the variable to use the free tier");
    }
  }

  const rawTimeout = env.MARKET_PULSE_TIMEOUT_MS;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (rawTimeout !== undefined && rawTimeout.trim() !== "") {
    timeoutMs = Number(rawTimeout);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) {
      throw new ConfigError("MARKET_PULSE_TIMEOUT_MS must be an integer between 1000 and 300000");
    }
  }
  return { baseUrl, apiKey, timeoutMs };
}
