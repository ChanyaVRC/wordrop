// Minimal JWT (HS256) using Web Crypto — available in the Cloudflare Workers runtime.
//
// The token carries the play-session state ({ id, attempts, solved }) signed with a
// server secret. The client cannot forge or tamper with it, so we can enforce the
// 6-guess limit statelessly (no KV write per guess).

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlJson(obj) {
  return b64urlEncode(enc.encode(JSON.stringify(obj)));
}

async function importKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Constant-time-ish comparison of two equal-length byte arrays.
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Sign a payload. `ttlSeconds` controls the exp claim (default 1 day).
export async function sign(payload, secret, ttlSeconds = 86400) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(body)}`;
  const key = await importKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(signingInput))
  );
  return `${signingInput}.${b64urlEncode(sig)}`;
}

// Verify a token. Returns the payload object on success, or null on any failure
// (bad shape, bad signature, expired).
export async function verify(token, secret) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const signingInput = `${h}.${p}`;
  const key = await importKey(secret);
  let expected;
  try {
    expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, enc.encode(signingInput))
    );
  } catch {
    return null;
  }
  let given;
  try {
    given = b64urlDecode(s);
  } catch {
    return null;
  }
  if (!bytesEqual(expected, given)) return null;

  let payload;
  try {
    payload = JSON.parse(dec.decode(b64urlDecode(p)));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) return null;
  return payload;
}
