// Small shared helpers for the API functions.

export const MAX_ATTEMPTS = 6;
export const GAME_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 1 day per play session

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Reads the JWT secret from the environment. In local dev wrangler.toml provides a
// throwaway default; in production it must be set via `wrangler pages secret put JWT_SECRET`.
export function getSecret(env) {
  return env.JWT_SECRET || "dev-insecure-secret-change-me";
}

const ID_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Short, URL-safe game id. 6 base62 chars ≈ 5.7e10 combinations — short enough to share
// comfortably, with collisions handled by a check-and-retry in the create handler.
export function genId(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return out;
}

export function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || "0.0.0.0";
}

// Best-effort fixed-window rate limiter backed by KV. Returns true if the request is
// allowed, false if the limit is exceeded. KV is eventually consistent, so this is a
// soft throttle (good enough to make brute-forcing impractical at friends-scale), not a
// hard guarantee.
export async function rateLimit(kv, key, limit, windowSeconds) {
  if (!kv) return true;
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const k = `rl:${key}:${window}`;
  const current = parseInt((await kv.get(k)) || "0", 10);
  if (current >= limit) return false;
  await kv.put(k, String(current + 1), { expirationTtl: windowSeconds + 5 });
  return true;
}
