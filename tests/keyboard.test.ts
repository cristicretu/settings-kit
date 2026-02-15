import { describe, expect, it } from "vitest";
import { getNextIndex } from "../src/utils/keyboard";

describe("getNextIndex", () => {
  it("wraps forward", () => {
    expect(getNextIndex(2, 3, "next")).toBe(0);
  });

  it("wraps backward", () => {
    expect(getNextIndex(0, 3, "prev")).toBe(2);
  });
});
