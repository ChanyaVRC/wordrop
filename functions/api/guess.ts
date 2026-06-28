// POST /api/guess  { token, guess }  ->  { feedback, solved, attemptsLeft, token }
//
// Scores a single guess server-side and returns ONLY the colors plus a refreshed session
// token (with the attempt counter incremented). The answer is never returned — not on a
// win, not on a loss.

import type { Env } from "../_shared/types";
import { isValidWord } from "../_shared/words";
import { score, isSolved } from "../_shared/score";
import { verify, sign } from "../_shared/jwt";
import {
  json,
  readJson,
  getSecret,
  clientIp,
  rateLimit,
  MAX_ATTEMPTS,
  TOKEN_TTL_SECONDS,
} from "../_shared/util";

interface StoredGame {
  word: string;
  createdAt: number;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const kv = env.WORDLE_KV;
  if (!kv) return json({ error: "server_misconfigured" }, 500);

  // Safety throttle in addition to the per-session 6-guess cap below.
  const ok = await rateLimit(kv, `guess:${clientIp(request)}`, 120, 600);
  if (!ok) return json({ error: "rate_limited" }, 429);

  const body = await readJson(request);
  const secret = getSecret(env);

  const payload = await verify(body && body.token, secret);
  if (!payload) return json({ error: "invalid_token", message: "セッションが無効です。再読み込みしてください。" }, 401);

  if (payload.solved) return json({ error: "already_solved" }, 409);
  if (payload.attempts >= MAX_ATTEMPTS) return json({ error: "no_attempts_left" }, 409);

  const guess = body && typeof body.guess === "string" ? body.guess.trim().toUpperCase() : "";
  if (!/^[A-Z]{5}$/.test(guess)) {
    return json({ error: "invalid_format", message: "5文字のアルファベットで入力してください。" }, 400);
  }
  if (!isValidWord(guess)) {
    // Invalid guesses do NOT consume an attempt.
    return json({ error: "not_in_dictionary", message: "辞書にない単語です。" }, 400);
  }

  const stored = await kv.get(`game:${payload.id}`);
  if (!stored) return json({ error: "not_found", message: "このパズルは存在しないか期限切れです。" }, 410);
  const { word } = JSON.parse(stored) as StoredGame;

  const feedback = score(word, guess);
  const solved = isSolved(feedback);
  const attempts = payload.attempts + 1;

  const token = await sign(
    { id: payload.id, attempts, solved },
    secret,
    TOKEN_TTL_SECONDS
  );

  return json({
    feedback,
    solved,
    attemptsLeft: MAX_ATTEMPTS - attempts,
    token,
  });
};
