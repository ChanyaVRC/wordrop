// POST /api/create  { word } | { random: true }  ->  { id }
//
// Validates the setter's word against the Collins dictionary and stores it in KV under a
// fresh opaque id. The word itself is never returned to any client.

import type { Env } from "../_shared/types";
import { isValidWord, randomWord } from "../_shared/words";
import {
  json,
  readJson,
  genId,
  clientIp,
  rateLimit,
  GAME_TTL_SECONDS,
} from "../_shared/util";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const kv = env.WORDLE_KV;
  if (!kv) return json({ error: "server_misconfigured" }, 500);

  // Light throttle on puzzle creation per IP.
  const ok = await rateLimit(kv, `create:${clientIp(request)}`, 60, 600);
  if (!ok) return json({ error: "rate_limited" }, 429);

  const body = await readJson(request);

  let raw: string;
  if (body && body.random === true) {
    // Server picks a random Collins word; the client never sees which one.
    raw = randomWord();
  } else {
    raw = body && typeof body.word === "string" ? body.word.trim().toUpperCase() : "";
    if (!/^[A-Z]{5}$/.test(raw)) {
      return json({ error: "invalid_format", message: "5文字のアルファベットで入力してください。" }, 400);
    }
    if (!isValidWord(raw)) {
      return json(
        { error: "not_in_dictionary", message: "コリンズ辞書にない単語です。別の単語を試してください。" },
        400
      );
    }
  }

  // Short ids mean collisions are possible (if unlikely), so retry on an existing key.
  let id = genId();
  for (let i = 0; i < 5; i++) {
    if (!(await kv.get(`game:${id}`))) break;
    id = genId();
  }

  await kv.put(
    `game:${id}`,
    JSON.stringify({ word: raw, createdAt: Date.now() }),
    { expirationTtl: GAME_TTL_SECONDS }
  );

  return json({ id });
};
