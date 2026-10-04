// What turns a purchase on MCPize into a tier on the buyer's own Market Pulse
// account: every request this deployment sends to the Market Pulse service carries a
// channel claim — the channel, the tier this listing sells, and a token that proves
// the claim (HMAC of channel+tier under a secret only the service and the operator
// hold). The buyer's own key rides in Authorization as usual, so the service knows
// *whose* account to entitle. The claim goes to the service's origin and nowhere else.

export const CHANNEL = "mcpize";
export const CHANNEL_TIERS = ["basic", "pro", "max", "operator"];

export class ChannelConfigError extends Error {}

export function loadChannelConfig(env = process.env) {
  const tier = (env.MARKET_PULSE_CHANNEL_TIER ?? "").trim();
  const token = (env.MARKET_PULSE_CHANNEL_TOKEN ?? "").trim();
  if (!CHANNEL_TIERS.includes(tier)) throw new ChannelConfigError(`MARKET_PULSE_CHANNEL_TIER must be one of: ${CHANNEL_TIERS.join(", ")}`);
  if (!/^[0-9a-f]{64}$/.test(token)) throw new ChannelConfigError("MARKET_PULSE_CHANNEL_TOKEN must be the 64-character hex token for this tier");
  return { tier, token };
}

export function withChannelHeaders(fetchImpl, { origin, tier, token }) {
  const serviceOrigin = new URL(origin).origin;
  return (input, init = {}) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    if (new URL(url).origin !== serviceOrigin) return fetchImpl(input, init);
    const headers = new Headers(init.headers);
    headers.set("x-market-pulse-channel", CHANNEL);
    headers.set("x-market-pulse-channel-tier", tier);
    headers.set("x-market-pulse-channel-token", token);
    return fetchImpl(input, { ...init, headers });
  };
}
