import { describe, it, expect } from "vitest";
import { sign, verify } from "../functions/_shared/jwt";

const SECRET = "test-secret";

describe("jwt", () => {
  it("round-trips a payload", async () => {
    const token = await sign({ id: "abc", attempts: 2, solved: false }, SECRET, 60);
    const payload = await verify(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.id).toBe("abc");
    expect(payload!.attempts).toBe(2);
    expect(payload!.solved).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await sign({ id: "abc", attempts: 0, solved: false }, SECRET, 60);
    expect(await verify(token, "wrong-secret")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await sign({ id: "abc", attempts: 5, solved: false }, SECRET, 60);
    const [h, , s] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ id: "abc", attempts: 0, solved: false })
    ).toString("base64url");
    expect(await verify(`${h}.${forged}.${s}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await sign({ id: "x", attempts: 0, solved: false }, SECRET, -10);
    expect(await verify(token, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verify("not-a-jwt", SECRET)).toBeNull();
    expect(await verify("", SECRET)).toBeNull();
    expect(await verify(undefined, SECRET)).toBeNull();
  });
});
