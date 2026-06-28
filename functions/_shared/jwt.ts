// Minimal JWT (HS256) using Web Crypto — available in the Cloudflare Workers runtime.
//
// The token carries the play-session state ({ id, attempts, solved }) signed with a
// server secret. The client cannot forge or tamper with it, so we can enforce the
// 6-guess limit statelessly (no KV write per guess).

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface SessionPayload {
  id: string;
  attempts: number;
  solved: boolean;
  iat?: number;
  exp?: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlJson(obj: unknown): string {
  return b64urlEncode(enc.encode(JSON.stringify(obj)));
}

function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Constant-time-ish comparison of two equal-length byte arrays.
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Sign a payload. `ttlSeconds` controls the exp claim (default 1 day).
export async function sign(
  payload: Omit<SessionPayload, "iat" | "exp">,
  secret: string,
  ttlSeconds = 86400
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const body: SessionPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(body)}`;
  const key = await importKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(signingInput))
  );
  return `${signingInput}.${b64urlEncode(sig)}`;
}

// Verify a token. Returns the payload on success, or null on any failure
// (bad shape, bad signature, expired).
export async function verify(
  token: unknown,
  secret: string
): Promise<SessionPayload | null> {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const signingInput = `${h}.${p}`;
  const key = await importKey(secret);
  let expected: Uint8Array;
  try {
    expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, enc.encode(signingInput))
    );
  } catch {
    return null;
  }
  let given: Uint8Array;
  try {
    given = b64urlDecode(s);
  } catch {
    return null;
  }
  if (!bytesEqual(expected, given)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(dec.decode(b64urlDecode(p))) as SessionPayload;
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) return null;
  return payload;
}
