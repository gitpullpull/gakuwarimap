export type CategoryBudgetPolicy = "boosted";

export type StudentDiscountCategoryId =
  | "food_drink"
  | "karaoke_amusement"
  | "movie_theater"
  | "ticketed_venue"
  | "hair_care"
  | "beauty_services"
  | "study_space"
  | "study_retail"
  | "fashion"
  | "fitness";

export interface StudentDiscountCategoryDefinition {
  id: StudentDiscountCategoryId;
  label: string;
  aliases: string[];
  placeTypes: string[];
  searchBias: number;
  candidateBias: number;
  studentSignalScore: number;
  evidenceTerms: string[];
  promptExamples: string[];
  budgetPolicy: CategoryBudgetPolicy;
}

export interface StudentDiscountSearchProfileDefinition {
  id: string;
  label: string;
  categoryId: StudentDiscountCategoryId;
  aliases: string[];
  bias: number;
  type?: string;
  defaultKeyword?: string;
}

export interface PreparedCategory extends StudentDiscountCategoryDefinition {
  normalizedAliases: string[];
}

export interface PreparedSearchProfile extends StudentDiscountSearchProfileDefinition {
  normalizedAliases: string[];
  budgetPolicy: CategoryBudgetPolicy;
}

export interface AliasMatch {
  categoryId: StudentDiscountCategoryId;
  profileId: string;
  alias: string;
}

export interface SearchProfileSelection {
  matchedCategoryIds: StudentDiscountCategoryId[];
  matchedAliases: string[];
  matchedProfiles: PreparedSearchProfile[];
  preferredProfileIds: string[];
  apiBoostEnabled: boolean;
  budgetPolicy: Record<string, CategoryBudgetPolicy>;
  broadOnlyReason?: string;
}

export interface ShopCategoryMatch {
  category: PreparedCategory;
  matchedAliases: string[];
  matchedByPlaceType: boolean;
}

export interface CategoryShopInput {
  name: string;
  address?: string;
  types?: string[];
}

const CATEGORY_DEFINITIONS: StudentDiscountCategoryDefinition[] = [
  {
    id: "food_drink",
    label: "Food / Drink",
    aliases: [
      "cafe",
      "coffee",
      "カフェ",
      "喫茶",
      "コーヒー",
      "restaurant",
      "food",
      "lunch",
      "dinner",
      "レストラン",
      "ランチ",
      "ごはん",
      "定食",
      "ラーメン",
      "うどん",
      "ファミレス",
      "ファストフード",
      "居酒屋",
      "焼肉",
      "寿司",
      "イタリアン",
      "バーガー",
      "burger",
    ],
    placeTypes: ["cafe", "restaurant", "bakery", "meal_takeaway"],
    searchBias: 18,
    candidateBias: 16,
    studentSignalScore: 4,
    evidenceTerms: [
      "学割",
      "学生割引",
      "学生証",
      "学生限定",
      "クーポン",
      "学生セット",
      "学生応援",
    ],
    promptExamples: ["学生証提示", "学生限定クーポン", "学生メニュー"],
    budgetPolicy: "boosted",
  },
  {
    id: "karaoke_amusement",
    label: "Karaoke / Amusement",
    aliases: [
      "karaoke",
      "カラオケ",
      "まねきねこ",
      "ジャンカラ",
      "ビッグエコー",
      "round1",
      "ラウンドワン",
      "ボウリング",
      "darts",
      "ダーツ",
      "billiards",
      "ビリヤード",
      "game center",
      "ゲームセンター",
      "アミューズメント",
    ],
    placeTypes: ["karaoke", "bowling_alley", "amusement_center"],
    searchBias: 24,
    candidateBias: 22,
    studentSignalScore: 8,
    evidenceTerms: [
      "学生料金",
      "大学生料金",
      "学生フリータイム",
      "中高生料金",
      "学生パック",
      "学割",
    ],
    promptExamples: ["学生フリータイム", "学生パック", "中高生料金"],
    budgetPolicy: "boosted",
  },
  {
    id: "movie_theater",
    label: "Movie Theater",
    aliases: ["movie", "cinema", "theater", "映画", "映画館", "シネマ", "劇場"],
    placeTypes: ["movie_theater"],
    searchBias: 24,
    candidateBias: 22,
    studentSignalScore: 8,
    evidenceTerms: ["学生料金", "大学生料金", "高校生料金", "学生チケット", "学割", "シネマ"],
    promptExamples: ["学生チケット", "大学生料金", "高校生料金"],
    budgetPolicy: "boosted",
  },
  {
    id: "ticketed_venue",
    label: "Ticketed Venue",
    aliases: [
      "aquarium",
      "水族館",
      "museum",
      "博物館",
      "美術館",
      "zoo",
      "動物園",
      "遊園地",
      "amusement park",
      "テーマパーク",
      "展望台",
      "art gallery",
      "アートギャラリー",
    ],
    placeTypes: ["museum", "art_gallery", "amusement_park", "aquarium", "zoo"],
    searchBias: 20,
    candidateBias: 20,
    studentSignalScore: 8,
    evidenceTerms: ["学生料金", "大学生料金", "高校生料金", "学生チケット", "入場料", "学割"],
    promptExamples: ["学生入場料", "大学生料金", "高校生料金"],
    budgetPolicy: "boosted",
  },
  {
    id: "hair_care",
    label: "Hair Care",
    aliases: [
      "hair",
      "beauty",
      "salon",
      "barber",
      "美容室",
      "理容室",
      "ヘアサロン",
      "床屋",
      "バーバー",
      "カット",
      "カラー",
      "パーマ",
    ],
    placeTypes: ["hair_care", "beauty_salon"],
    searchBias: 26,
    candidateBias: 26,
    studentSignalScore: 10,
    evidenceTerms: ["学割U24", "学生カット", "学生限定", "ホットペッパー", "minimo", "学割"],
    promptExamples: ["学割U24", "学生カット", "学生限定クーポン"],
    budgetPolicy: "boosted",
  },
  {
    id: "beauty_services",
    label: "Beauty Services",
    aliases: [
      "nail",
      "ネイル",
      "まつエク",
      "eyelash",
      "まつ毛パーマ",
      "まつパ",
      "eyebrow",
      "眉毛",
      "エステ",
      "esthetic",
      "脱毛",
      "リラク",
    ],
    placeTypes: ["beauty_salon", "spa"],
    searchBias: 22,
    candidateBias: 20,
    studentSignalScore: 8,
    evidenceTerms: ["学割", "学生限定", "U24", "クーポン", "学生価格", "キャンペーン"],
    promptExamples: ["U24", "学生限定クーポン", "学生価格"],
    budgetPolicy: "boosted",
  },
  {
    id: "study_space",
    label: "Study Space",
    aliases: [
      "漫画喫茶",
      "マンガ喫茶",
      "manga cafe",
      "ネットカフェ",
      "internet cafe",
      "自習室",
      "コワーキング",
      "coworking",
      "study room",
      "自習",
      "ネットルーム",
    ],
    placeTypes: ["library"],
    searchBias: 18,
    candidateBias: 14,
    studentSignalScore: 4,
    evidenceTerms: ["学割", "学生応援", "学生証", "学生料金", "学生パック", "フリータイム"],
    promptExamples: ["学生パック", "学生料金", "学生証提示"],
    budgetPolicy: "boosted",
  },
  {
    id: "study_retail",
    label: "Study Retail",
    aliases: [
      "book",
      "books",
      "書店",
      "本屋",
      "文具",
      "文房具",
      "stationery",
      "画材",
      "学習用品",
      "参考書",
      "教科書",
    ],
    placeTypes: ["book_store"],
    searchBias: 14,
    candidateBias: 14,
    studentSignalScore: 4,
    evidenceTerms: ["学割", "学生応援", "学生証", "参考書", "教科書", "キャンペーン"],
    promptExamples: ["学生応援価格", "学生証提示", "学習用品割引"],
    budgetPolicy: "boosted",
  },
  {
    id: "fashion",
    label: "Fashion",
    aliases: [
      "fashion",
      "apparel",
      "clothing",
      "アパレル",
      "ファッション",
      "洋服",
      "靴",
      "シューズ",
      "スポーツウェア",
      "スニーカー",
    ],
    placeTypes: ["clothing_store", "shoe_store"],
    searchBias: 12,
    candidateBias: 12,
    studentSignalScore: 4,
    evidenceTerms: ["学割", "学生限定", "学生応援", "アプリ", "クーポン", "学生証"],
    promptExamples: ["学生限定", "学生証提示", "アプリクーポン"],
    budgetPolicy: "boosted",
  },
  {
    id: "fitness",
    label: "Fitness",
    aliases: [
      "gym",
      "fitness",
      "ジム",
      "フィットネス",
      "ヨガ",
      "yoga",
      "クライミング",
      "bouldering",
      "ボルダリング",
      "プール",
      "swim",
      "サウナ",
      "スタジオ",
      "pilates",
      "ピラティス",
    ],
    placeTypes: ["gym", "spa", "stadium", "swimming_pool"],
    searchBias: 12,
    candidateBias: 12,
    studentSignalScore: 4,
    evidenceTerms: ["学割", "学生プラン", "学生会員", "学生証", "キャンペーン", "学生コース"],
    promptExamples: ["学生プラン", "学生会員", "学生コース"],
    budgetPolicy: "boosted",
  },
];

const SEARCH_PROFILE_DEFINITIONS: StudentDiscountSearchProfileDefinition[] = [
  {
    id: "cafe",
    label: "Cafe",
    categoryId: "food_drink",
    aliases: ["cafe", "coffee", "カフェ", "喫茶", "コーヒー"],
    type: "cafe",
    defaultKeyword: "カフェ",
    bias: 18,
  },
  {
    id: "restaurant",
    label: "Restaurant",
    categoryId: "food_drink",
    aliases: [
      "restaurant",
      "food",
      "lunch",
      "dinner",
      "レストラン",
      "ランチ",
      "ごはん",
      "定食",
      "ラーメン",
      "うどん",
      "ファミレス",
      "ファストフード",
      "居酒屋",
      "焼肉",
      "寿司",
      "イタリアン",
      "バーガー",
      "burger",
    ],
    type: "restaurant",
    defaultKeyword: "レストラン",
    bias: 16,
  },
  {
    id: "movie_theater",
    label: "Movie Theater",
    categoryId: "movie_theater",
    aliases: ["movie", "cinema", "theater", "映画", "映画館", "シネマ", "劇場"],
    type: "movie_theater",
    defaultKeyword: "映画",
    bias: 24,
  },
  {
    id: "karaoke_amusement",
    label: "Karaoke / Amusement",
    categoryId: "karaoke_amusement",
    aliases: [
      "karaoke",
      "カラオケ",
      "まねきねこ",
      "ジャンカラ",
      "ビッグエコー",
      "round1",
      "ラウンドワン",
      "ボウリング",
      "darts",
      "ダーツ",
      "billiards",
      "ビリヤード",
      "game center",
      "ゲームセンター",
      "アミューズメント",
    ],
    defaultKeyword: "カラオケ",
    bias: 23,
  },
  {
    id: "hair_care",
    label: "Hair Care",
    categoryId: "hair_care",
    aliases: [
      "hair",
      "beauty",
      "salon",
      "barber",
      "美容室",
      "理容室",
      "ヘアサロン",
      "床屋",
      "バーバー",
      "カット",
      "カラー",
      "パーマ",
    ],
    type: "hair_care",
    defaultKeyword: "美容室",
    bias: 26,
  },
  {
    id: "beauty_services",
    label: "Beauty Services",
    categoryId: "beauty_services",
    aliases: [
      "nail",
      "ネイル",
      "まつエク",
      "eyelash",
      "まつ毛パーマ",
      "まつパ",
      "眉毛",
      "エステ",
      "脱毛",
    ],
    defaultKeyword: "ネイル",
    bias: 22,
  },
  {
    id: "ticketed_venue",
    label: "Ticketed Venue",
    categoryId: "ticketed_venue",
    aliases: [
      "aquarium",
      "水族館",
      "museum",
      "博物館",
      "美術館",
      "zoo",
      "動物園",
      "遊園地",
      "amusement park",
      "テーマパーク",
      "展望台",
    ],
    defaultKeyword: "水族館",
    bias: 20,
  },
  {
    id: "study_space",
    label: "Study Space",
    categoryId: "study_space",
    aliases: [
      "漫画喫茶",
      "マンガ喫茶",
      "manga cafe",
      "ネットカフェ",
      "internet cafe",
      "自習室",
      "コワーキング",
      "coworking",
      "study room",
      "自習",
      "ネットルーム",
    ],
    defaultKeyword: "漫画喫茶",
    bias: 18,
  },
  {
    id: "book_store",
    label: "Book Store",
    categoryId: "study_retail",
    aliases: [
      "book",
      "books",
      "書店",
      "本屋",
      "文具",
      "文房具",
      "stationery",
      "画材",
      "学習用品",
      "参考書",
      "教科書",
    ],
    type: "book_store",
    defaultKeyword: "書店",
    bias: 14,
  },
  {
    id: "clothing_store",
    label: "Clothing Store",
    categoryId: "fashion",
    aliases: [
      "fashion",
      "apparel",
      "clothing",
      "アパレル",
      "ファッション",
      "洋服",
      "靴",
      "シューズ",
      "スポーツウェア",
      "スニーカー",
    ],
    type: "clothing_store",
    defaultKeyword: "アパレル",
    bias: 12,
  },
  {
    id: "gym",
    label: "Fitness",
    categoryId: "fitness",
    aliases: [
      "gym",
      "fitness",
      "ジム",
      "フィットネス",
      "ヨガ",
      "yoga",
      "クライミング",
      "bouldering",
      "ボルダリング",
      "プール",
      "swim",
      "サウナ",
      "スタジオ",
      "pilates",
      "ピラティス",
    ],
    defaultKeyword: "ジム",
    bias: 12,
  },
];

function normalizeText(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}

function isAliasMatch(normalizedValue: string, normalizedAlias: string): boolean {
  if (!normalizedValue || !normalizedAlias) {
    return false;
  }

  return (
    normalizedValue.includes(normalizedAlias) ||
    (normalizedValue.length >= 3 && normalizedAlias.includes(normalizedValue))
  );
}

const PREPARED_CATEGORIES: PreparedCategory[] = CATEGORY_DEFINITIONS.map((category) => ({
  ...category,
  normalizedAliases: category.aliases.map((alias) => normalizeText(alias)).filter(Boolean),
}));

const CATEGORY_BY_ID = new Map(
  PREPARED_CATEGORIES.map((category) => [category.id, category] as const)
);

const PREPARED_SEARCH_PROFILES: PreparedSearchProfile[] = SEARCH_PROFILE_DEFINITIONS.map(
  (profile) => ({
    ...profile,
    normalizedAliases: profile.aliases.map((alias) => normalizeText(alias)).filter(Boolean),
    budgetPolicy: CATEGORY_BY_ID.get(profile.categoryId)?.budgetPolicy ?? "boosted",
  })
);

export function getPreparedSearchProfiles(): PreparedSearchProfile[] {
  return PREPARED_SEARCH_PROFILES.map((profile) => ({
    ...profile,
    aliases: [...profile.aliases],
    normalizedAliases: [...profile.normalizedAliases],
  }));
}

export function getCategoryById(
  categoryId: StudentDiscountCategoryId
): PreparedCategory | undefined {
  const category = CATEGORY_BY_ID.get(categoryId);
  if (!category) {
    return undefined;
  }

  return {
    ...category,
    aliases: [...category.aliases],
    normalizedAliases: [...category.normalizedAliases],
    placeTypes: [...category.placeTypes],
    evidenceTerms: [...category.evidenceTerms],
    promptExamples: [...category.promptExamples],
  };
}

export function matchKeywordAliases(keyword?: string): AliasMatch[] {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return [];
  }

  const matches: AliasMatch[] = [];
  for (const profile of PREPARED_SEARCH_PROFILES) {
    for (const alias of profile.normalizedAliases) {
      if (!isAliasMatch(normalizedKeyword, alias)) {
        continue;
      }

      matches.push({
        categoryId: profile.categoryId,
        profileId: profile.id,
        alias: profile.aliases[profile.normalizedAliases.indexOf(alias)] ?? alias,
      });
    }
  }

  return matches;
}

export function selectCategorySearchProfiles(keyword?: string): SearchProfileSelection {
  const aliasMatches = matchKeywordAliases(keyword);
  const matchedProfiles = PREPARED_SEARCH_PROFILES.filter((profile) =>
    aliasMatches.some((match) => match.profileId === profile.id)
  ).sort((left, right) => right.bias - left.bias);

  const matchedAliases = Array.from(
    new Set(aliasMatches.map((match) => match.alias).filter(Boolean))
  );
  const matchedCategoryIds = Array.from(
    new Set(aliasMatches.map((match) => match.categoryId))
  );
  const budgetPolicy = Object.fromEntries(
    matchedCategoryIds.map((categoryId) => [
      categoryId,
      CATEGORY_BY_ID.get(categoryId)?.budgetPolicy ?? "boosted",
    ])
  ) as Record<string, CategoryBudgetPolicy>;
  const normalizedKeyword = normalizeText(keyword);

  return {
    matchedCategoryIds,
    matchedAliases,
    matchedProfiles,
    preferredProfileIds: matchedProfiles.map((profile) => profile.id),
    apiBoostEnabled: matchedProfiles.length > 0,
    budgetPolicy,
    broadOnlyReason:
      normalizedKeyword && matchedProfiles.length === 0 ? "keyword_not_in_catalog" : undefined,
  };
}

export function getDefaultSpecialtyProfiles(): PreparedSearchProfile[] {
  return PREPARED_SEARCH_PROFILES
    .filter((profile) => Boolean(profile.defaultKeyword))
    .sort((left, right) => right.bias - left.bias)
    .map((profile) => ({
      ...profile,
      aliases: [...profile.aliases],
      normalizedAliases: [...profile.normalizedAliases],
    }));
}

export function categorizeShop(input: CategoryShopInput): ShopCategoryMatch[] {
  const normalizedText = normalizeText(
    `${input.name} ${input.address ?? ""} ${(input.types ?? []).join(" ")}`
  );
  const shopTypes = new Set((input.types ?? []).map((type) => normalizeText(type)));

  return PREPARED_CATEGORIES.map((category) => {
    const matchedAliases = category.normalizedAliases
      .filter((alias) => normalizedText.includes(alias))
      .map((alias) => category.aliases[category.normalizedAliases.indexOf(alias)] ?? alias);
    const matchedByPlaceType = category.placeTypes.some((type) =>
      shopTypes.has(normalizeText(type))
    );

    return {
      category,
      matchedAliases: Array.from(new Set(matchedAliases)),
      matchedByPlaceType,
    };
  })
    .filter((match) => match.matchedByPlaceType || match.matchedAliases.length > 0)
    .sort((left, right) => {
      if (right.category.candidateBias !== left.category.candidateBias) {
        return right.category.candidateBias - left.category.candidateBias;
      }

      return right.category.searchBias - left.category.searchBias;
    });
}
