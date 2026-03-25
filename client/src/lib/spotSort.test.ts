import { describe, expect, it } from "vitest";
import {
  buildSpotBrowseQueryInput,
  buildSpotSearchQueryInput,
  isSpotSortBy,
  SPOT_SORT_OPTIONS,
} from "./spotSort";

describe("spot sort helpers", () => {
  it("exposes the shared sort options", () => {
    expect(SPOT_SORT_OPTIONS).toEqual([
      { value: "newest", label: "新着順" },
      { value: "rating", label: "口コミ評価順" },
      { value: "discountRate", label: "割引率順" },
      { value: "name", label: "名前順" },
    ]);
  });

  it("recognizes valid sort values", () => {
    expect(isSpotSortBy("discountRate")).toBe(true);
    expect(isSpotSortBy("rating")).toBe(true);
    expect(isSpotSortBy("distance")).toBe(false);
  });

  it("builds browse queries with the selected sort", () => {
    expect(
      buildSpotBrowseQueryInput({
        categoryId: 3,
        sortBy: "discountRate",
        page: 2,
        pageSize: 12,
      })
    ).toEqual({
      categoryId: 3,
      sortBy: "discountRate",
      limit: 12,
      offset: 24,
    });
  });

  it("builds search queries with the selected sort", () => {
    expect(
      buildSpotSearchQueryInput({
        searchTerm: "渋谷",
        sortBy: "rating",
        limit: 50,
      })
    ).toEqual({
      search: "渋谷",
      sortBy: "rating",
      limit: 50,
    });
  });
});
