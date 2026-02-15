import { describe, expect, it } from "vitest";
import { getHighlightRanges, searchItems } from "../src/utils/search";

describe("searchItems", () => {
  it("scores and sorts matching settings", () => {
    const result = searchItems(
      [
        { id: "1", label: "Theme" },
        { id: "2", label: "Notifications" }
      ],
      "them"
    );

    expect(result[0]?.id).toBe("1");
    expect(result[0]?.score).toBeGreaterThan(0);
  });
});

describe("getHighlightRanges", () => {
  it("returns matched ranges for highlight rendering", () => {
    expect(getHighlightRanges("Theme setting", "theme")).toEqual([{ start: 0, end: 5 }]);
  });
});
