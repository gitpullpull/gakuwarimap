export type SpotSortBy = "newest" | "rating" | "discountRate" | "name";

export const SPOT_SORT_OPTIONS: Array<{ value: SpotSortBy; label: string }> = [
  { value: "newest", label: "新着順" },
  { value: "rating", label: "口コミ評価順" },
  { value: "discountRate", label: "割引率順" },
  { value: "name", label: "名前順" },
];

export function isSpotSortBy(value: string): value is SpotSortBy {
  return SPOT_SORT_OPTIONS.some((option) => option.value === value);
}

export function buildSpotBrowseQueryInput(params: {
  categoryId?: number;
  sortBy: SpotSortBy;
  page: number;
  pageSize: number;
}) {
  return {
    categoryId: params.categoryId,
    sortBy: params.sortBy,
    limit: params.pageSize,
    offset: params.page * params.pageSize,
  };
}

export function buildSpotSearchQueryInput(params: {
  searchTerm: string;
  sortBy: SpotSortBy;
  limit: number;
}) {
  return {
    search: params.searchTerm,
    sortBy: params.sortBy,
    limit: params.limit,
  };
}
