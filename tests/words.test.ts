import { describe, it, expect } from "vitest";
import { isValidWord, randomWord, wordCount } from "../functions/_shared/words";

describe("words (Collins 5-letter dictionary)", () => {
  it("accepts real 5-letter words", () => {
    expect(isValidWord("APPLE")).toBe(true);
    expect(isValidWord("CRANE")).toBe(true);
  });

  it("rejects non-words and wrong shapes", () => {
    expect(isValidWord("ZZZZZ")).toBe(false);
    expect(isValidWord("ABCDE")).toBe(false);
    expect(isValidWord("APPL")).toBe(false);
    expect(isValidWord("APPLES")).toBe(false);
  });

  it("requires uppercase A–Z", () => {
    expect(isValidWord("apple")).toBe(false);
    expect(isValidWord("")).toBe(false);
    expect(isValidWord(123 as unknown)).toBe(false);
  });

  it("has a substantial dictionary", () => {
    expect(wordCount()).toBeGreaterThan(10000);
  });

  it("randomWord always returns a valid word", () => {
    for (let i = 0; i < 50; i++) {
      const w = randomWord();
      expect(w).toMatch(/^[A-Z]{5}$/);
      expect(isValidWord(w)).toBe(true);
    }
  });
});
