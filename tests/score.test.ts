import { describe, it, expect } from "vitest";
import { score, isSolved } from "../functions/_shared/score";

describe("score", () => {
  it("marks an exact match all correct", () => {
    expect(score("APPLE", "APPLE")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
    expect(isSolved(score("APPLE", "APPLE"))).toBe(true);
  });

  it("marks absent letters", () => {
    expect(score("APPLE", "ZZZZZ")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
  });

  it("handles a simple present (wrong position)", () => {
    // answer CRANE, guess SLATE -> A and E correct, rest absent
    expect(score("CRANE", "SLATE")).toEqual([
      "absent",
      "absent",
      "correct",
      "absent",
      "correct",
    ]);
  });

  it("handles duplicate letters in the guess (greens consume first)", () => {
    // answer ABIDE has one E; guess GEESE -> only the final E (green) counts
    expect(score("ABIDE", "GEESE")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "correct",
    ]);
  });

  it("assigns yellows from the leftover pool left to right", () => {
    // answer LEVEL, guess EAGLE -> E present, L present, second E present
    expect(score("LEVEL", "EAGLE")).toEqual([
      "present",
      "absent",
      "absent",
      "present",
      "present",
    ]);
  });

  it("isSolved is false when any tile is not correct", () => {
    expect(isSolved(["correct", "correct", "present", "correct", "correct"])).toBe(false);
  });
});
