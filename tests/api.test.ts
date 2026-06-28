import { describe, it, expect, beforeEach } from "vitest";
import { onRequestPost as create } from "../functions/api/create";
import { onRequestPost as start } from "../functions/api/start";
import { onRequestPost as guess } from "../functions/api/guess";

// Minimal in-memory KV stub (ignores TTL).
function makeKv() {
  const store = new Map<string, string>();
  return {
    store,
    async get(k: string) {
      return store.has(k) ? store.get(k)! : null;
    },
    async put(k: string, v: string) {
      store.set(k, v);
    },
  };
}

let kv: ReturnType<typeof makeKv>;
let env: any;

beforeEach(() => {
  kv = makeKv();
  env = { WORDLE_KV: kv, JWT_SECRET: "test-secret" };
});

function req(body: unknown) {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

const call = (handler: any, body: unknown) => handler({ request: req(body), env } as any);

async function newGame(word = "apple") {
  const cr: any = await (await call(create, { word })).json();
  const st: any = await (await call(start, { id: cr.id })).json();
  return { id: cr.id as string, token: st.token as string };
}

describe("POST /api/create", () => {
  it("creates a puzzle from a valid word and never returns the answer", async () => {
    const res = await call(create, { word: "apple" });
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(typeof data.id).toBe("string");
    expect(JSON.stringify(data)).not.toContain("APPLE");
  });

  it("rejects a word not in the dictionary", async () => {
    const res = await call(create, { word: "zzzzz" });
    expect(res.status).toBe(400);
  });

  it("rejects a wrong-length word", async () => {
    expect((await call(create, { word: "abcd" })).status).toBe(400);
  });

  it("supports random word creation", async () => {
    const res = await call(create, { random: true });
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(typeof data.id).toBe("string");
  });
});

describe("POST /api/start", () => {
  it("issues a session token for an existing puzzle", async () => {
    const cr: any = await (await call(create, { word: "crane" })).json();
    const res = await call(start, { id: cr.id });
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(typeof data.token).toBe("string");
    expect(data.maxAttempts).toBe(6);
  });

  it("returns 404 for an unknown puzzle id", async () => {
    expect((await call(start, { id: "nope12" })).status).toBe(404);
  });
});

describe("POST /api/guess", () => {
  it("scores a wrong guess, decrements attempts, and leaks no answer", async () => {
    const { token } = await newGame("crane");
    const res = await call(guess, { token, guess: "slate" });
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.feedback).toEqual(["absent", "absent", "correct", "absent", "correct"]);
    expect(data.solved).toBe(false);
    expect(data.attemptsLeft).toBe(5);
    expect(JSON.stringify(data)).not.toContain("CRANE");
  });

  it("rejects a guess not in the dictionary without consuming an attempt", async () => {
    const { token } = await newGame("crane");
    const bad = await call(guess, { token, guess: "zzzzz" });
    expect(bad.status).toBe(400);
    // original token still has full attempts: a valid guess still works
    const ok = await call(guess, { token, guess: "slate" });
    const data: any = await ok.json();
    expect(data.attemptsLeft).toBe(5);
  });

  it("reports solved on the correct word but never returns it", async () => {
    const { token } = await newGame("apple");
    const res = await call(guess, { token, guess: "apple" });
    const data: any = await res.json();
    expect(data.solved).toBe(true);
    expect(data.feedback.every((m: string) => m === "correct")).toBe(true);
    expect(JSON.stringify(data)).not.toContain("APPLE");
  });

  it("rejects a tampered token", async () => {
    const { token } = await newGame("crane");
    const [h, , s] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ id: "abc", attempts: 0, solved: false })
    ).toString("base64url");
    const res = await call(guess, { token: `${h}.${forged}.${s}`, guess: "slate" });
    expect(res.status).toBe(401);
  });

  it("enforces the 6-guess cap", async () => {
    let { token } = await newGame("crane");
    for (let i = 0; i < 6; i++) {
      const data: any = await (await call(guess, { token, guess: "slate" })).json();
      token = data.token;
    }
    const seventh = await call(guess, { token, guess: "slate" });
    expect(seventh.status).toBe(409);
  });
});
