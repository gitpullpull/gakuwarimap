export const EXTERNAL_BASELINE_CATEGORIES = [
  { name: "カラオケ", icon: "music", color: "yellow" },
  { name: "カフェ", icon: "coffee", color: "mint" },
  { name: "映画", icon: "film", color: "lilac" },
  { name: "書店", icon: "book", color: "peach" },
  { name: "ショッピング", icon: "shopping", color: "coral" },
  { name: "美容", icon: "beauty", color: "pink" },
] as const;

export const SHIBUYA_VERIFICATION_POINT = {
  lat: 35.6595,
  lng: 139.7005,
} as const;

export const SHIBUYA_VERIFICATION_RADIUS_METERS = 200;

export const VERIFICATION_PAGE_PATHS = [
  "/",
  "/spots",
  "/submit",
  "/agent",
] as const;

export const VERIFICATION_REVIEW_NAME = "Local External Verify";
