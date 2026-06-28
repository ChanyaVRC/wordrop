// POST /api/start  { id }  ->  { token, attemptsLeft }
//
// Confirms the puzzle exists and issues a signed session token. This endpoint is the main
// rate-limit choke point: minting fresh sessions is how a brute-forcer would reset the
// 6-guess cap, so we throttle it per IP.

import {
  json,
  readJson,
  getSecret,
  clientIp,
  rateLimit,
  MAX_ATTEMPTS,
  TOKEN_TTL_SECONDS,
} from "../_shared/util.js";
import { sign } from "../_shared/jwt.js";

export async function onRequestPost({ request, env }) {
  const kv = env.WORDLE_KV;
  if (!kv) return json({ error: "server_misconfigured" }, 500);

  const ok = await rateLimit(kv, `start:${clientIp(request)}`, 30, 600);
  if (!ok) return json({ error: "rate_limited", message: "アクセスが多すぎます。少し待ってください。" }, 429);

  const body = await readJson(request);
  const id = body && typeof body.id === "string" ? body.id : "";
  if (!/^[0-9A-Za-z]{1,40}$/.test(id)) return json({ error: "invalid_id" }, 400);

  const stored = await kv.get(`game:${id}`);
  if (!stored) return json({ error: "not_found", message: "このパズルは存在しないか期限切れです。" }, 404);

  const token = await sign(
    { id, attempts: 0, solved: false },
    getSecret(env),
    TOKEN_TTL_SECONDS
  );

  return json({ token, attemptsLeft: MAX_ATTEMPTS, maxAttempts: MAX_ATTEMPTS });
}
