import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

async function seed() {
  console.log("🌱 Seeding database...");

  // Insert categories
  const categoryData = [
    { name: "グルメ", icon: "utensils", color: "coral" },
    { name: "カフェ", icon: "coffee", color: "mint" },
    { name: "ショッピング", icon: "shopping", color: "yellow" },
    { name: "美容・理容", icon: "scissors", color: "lilac" },
    { name: "書店・文具", icon: "book", color: "peach" },
    { name: "ジム・スポーツ", icon: "gym", color: "mint" },
    { name: "エンタメ", icon: "film", color: "pink" },
    { name: "ファッション", icon: "fashion", color: "lilac" },
  ];

  for (const cat of categoryData) {
    await db.execute(sql`INSERT IGNORE INTO categories (name, icon, color) VALUES (${cat.name}, ${cat.icon}, ${cat.color})`);
  }
  console.log("✅ Categories inserted");

  // Get category IDs
  const cats = await db.execute(sql`SELECT id, name FROM categories`);
  const catRows = cats[0] || cats;
  const catMap = {};
  for (const c of catRows) {
    catMap[c.name] = c.id;
  }

  // Insert spots (Tokyo area)
  const spotData = [
    {
      name: "学生食堂 渋谷店",
      description: "渋谷駅から徒歩3分。学生に人気の定食屋さん。ボリューム満点のランチが学割でさらにお得に。",
      address: "東京都渋谷区道玄坂2-1-1",
      lat: "35.6590000",
      lng: "139.6985000",
      categoryId: catMap["グルメ"],
      discountDetail: "学生証提示でランチメニュー全品100円引き。ドリンクバー無料サービス付き。",
      discountRate: "100円引き",
      phone: "03-1234-5678",
      openingHours: "月-金 11:00-22:00\n土日祝 11:00-21:00",
      avgRating: 4.2,
      reviewCount: 15,
      isVerified: 1,
    },
    {
      name: "カフェ・ミント 新宿店",
      description: "おしゃれな内装と美味しいコーヒーが自慢のカフェ。Wi-Fi完備で勉強にも最適。",
      address: "東京都新宿区新宿3-38-1",
      lat: "35.6896000",
      lng: "139.7006000",
      categoryId: catMap["カフェ"],
      discountDetail: "学生証提示でドリンク全品20%OFF。テスト期間中は深夜営業あり。",
      discountRate: "20%OFF",
      phone: "03-2345-6789",
      openingHours: "毎日 8:00-23:00",
      avgRating: 4.5,
      reviewCount: 28,
      isVerified: 1,
    },
    {
      name: "ブックオフ 池袋サンシャイン通り店",
      description: "教科書から漫画まで幅広い品揃え。学生の味方です。",
      address: "東京都豊島区東池袋1-22-10",
      lat: "35.7295000",
      lng: "139.7134000",
      categoryId: catMap["書店・文具"],
      discountDetail: "学生証提示で中古教科書・参考書が15%OFF。まとめ買いでさらにお得。",
      discountRate: "15%OFF",
      phone: "03-3456-7890",
      openingHours: "毎日 10:00-21:00",
      avgRating: 3.8,
      reviewCount: 12,
      isVerified: 1,
    },
    {
      name: "カットスタジオ 原宿",
      description: "トレンドに敏感な原宿の美容室。学生カットがリーズナブル。",
      address: "東京都渋谷区神宮前1-19-11",
      lat: "35.6702000",
      lng: "139.7027000",
      categoryId: catMap["美容・理容"],
      discountDetail: "学生カット2,500円（通常4,000円）。カラーも学割で30%OFF。",
      discountRate: "30%OFF",
      phone: "03-4567-8901",
      openingHours: "火-日 10:00-20:00\n月曜定休",
      avgRating: 4.0,
      reviewCount: 8,
      isVerified: 0,
    },
    {
      name: "ラーメン二郎 三田本店",
      description: "言わずと知れた二郎系ラーメンの総本山。学生にも大人気。",
      address: "東京都港区三田2-16-4",
      lat: "35.6487000",
      lng: "139.7414000",
      categoryId: catMap["グルメ"],
      discountDetail: "学生証提示で大盛り無料。トッピング1品サービス。",
      discountRate: "大盛り無料",
      phone: "03-5678-9012",
      openingHours: "月-土 11:00-15:00, 17:00-21:00\n日曜定休",
      avgRating: 4.6,
      reviewCount: 42,
      isVerified: 1,
    },
    {
      name: "GU 渋谷店",
      description: "トレンドファッションがプチプラで手に入る。学生の強い味方。",
      address: "東京都渋谷区宇田川町33-6",
      lat: "35.6614000",
      lng: "139.6980000",
      categoryId: catMap["ファッション"],
      discountDetail: "毎週水曜日は学生デー。学生証提示で全品5%OFF。アプリクーポン併用可。",
      discountRate: "5%OFF",
      openingHours: "毎日 10:00-21:00",
      avgRating: 3.5,
      reviewCount: 6,
      isVerified: 1,
    },
    {
      name: "TOHOシネマズ 新宿",
      description: "最新映画を大スクリーンで。学割で映画をもっと身近に。",
      address: "東京都新宿区歌舞伎町1-19-1",
      lat: "35.6945000",
      lng: "139.7013000",
      categoryId: catMap["エンタメ"],
      discountDetail: "学生証提示で一般料金1,500円（通常1,900円）。毎週水曜はさらに1,200円。",
      discountRate: "400円引き",
      phone: "050-6868-5063",
      openingHours: "上映スケジュールによる",
      avgRating: 4.3,
      reviewCount: 35,
      isVerified: 1,
    },
    {
      name: "エニタイムフィットネス 高田馬場店",
      description: "24時間営業のジム。学生の健康維持をサポート。",
      address: "東京都新宿区高田馬場1-26-5",
      lat: "35.7125000",
      lng: "139.7038000",
      categoryId: catMap["ジム・スポーツ"],
      discountDetail: "学生プラン月額5,980円（通常7,480円）。入会金・事務手数料無料。",
      discountRate: "月1,500円引き",
      phone: "03-6789-0123",
      openingHours: "24時間営業",
      avgRating: 4.1,
      reviewCount: 18,
      isVerified: 1,
    },
    {
      name: "丸亀製麺 秋葉原店",
      description: "本格讃岐うどんをリーズナブルに。学生のお腹を満たします。",
      address: "東京都千代田区外神田4-14-1",
      lat: "35.6983000",
      lng: "139.7710000",
      categoryId: catMap["グルメ"],
      discountDetail: "学生証提示でかけうどん（並）にトッピング1品無料。天ぷら1品サービス。",
      discountRate: "トッピング無料",
      openingHours: "毎日 11:00-22:00",
      avgRating: 3.9,
      reviewCount: 10,
      isVerified: 0,
    },
    {
      name: "ドトールコーヒー 東大前店",
      description: "東京大学の近くにある落ち着いたカフェ。勉強する学生で賑わう。",
      address: "東京都文京区本郷6-2-9",
      lat: "35.7120000",
      lng: "139.7620000",
      categoryId: catMap["カフェ"],
      discountDetail: "学生証提示でMサイズ以上のドリンク50円引き。モーニングセットは100円引き。",
      discountRate: "50円引き",
      openingHours: "月-金 7:00-22:00\n土日祝 8:00-21:00",
      avgRating: 4.0,
      reviewCount: 22,
      isVerified: 1,
    },
    {
      name: "ユニクロ 銀座店",
      description: "ベーシックアイテムが揃う大型店舗。学生にも嬉しい学割あり。",
      address: "東京都中央区銀座6-9-5",
      lat: "35.6712000",
      lng: "139.7640000",
      categoryId: catMap["ファッション"],
      discountDetail: "学生アプリ会員限定で毎月15日は全品10%OFF。オンライン併用可。",
      discountRate: "10%OFF",
      openingHours: "毎日 10:00-21:00",
      avgRating: 3.7,
      reviewCount: 9,
      isVerified: 1,
    },
    {
      name: "カラオケ館 渋谷本店",
      description: "渋谷で人気のカラオケ店。学割で思いっきり歌おう。",
      address: "東京都渋谷区宇田川町30-4",
      lat: "35.6620000",
      lng: "139.6975000",
      categoryId: catMap["エンタメ"],
      discountDetail: "学生証提示で室料30%OFF。フリータイムは学生限定価格1,200円。ドリンクバー付き。",
      discountRate: "30%OFF",
      phone: "03-7890-1234",
      openingHours: "毎日 11:00-翌5:00",
      avgRating: 4.4,
      reviewCount: 31,
      isVerified: 1,
    },
  ];

  for (const spot of spotData) {
    await db.execute(sql`INSERT INTO spots (name, description, address, lat, lng, categoryId, discountDetail, discountRate, phone, openingHours, avgRating, reviewCount, isVerified)
      VALUES (${spot.name}, ${spot.description}, ${spot.address}, ${spot.lat}, ${spot.lng},
              ${spot.categoryId}, ${spot.discountDetail}, ${spot.discountRate ?? null},
              ${spot.phone ?? null}, ${spot.openingHours ?? null},
              ${spot.avgRating}, ${spot.reviewCount}, ${spot.isVerified})`);
  }
  console.log("✅ Spots inserted");

  // Get spot IDs
  const spotsResult = await db.execute(sql`SELECT id, name FROM spots`);
  const spotRows = spotsResult[0] || spotsResult;
  const spotMap = {};
  for (const s of spotRows) {
    spotMap[s.name] = s.id;
  }

  const reviewData = [
    { spotName: "学生食堂 渋谷店", userName: "たけし", rating: 5, comment: "ボリューム満点でコスパ最高！学生証見せるだけで100円引きは嬉しい。" },
    { spotName: "学生食堂 渋谷店", userName: "さくら", rating: 4, comment: "お昼時は混むけど、味は間違いなし。唐揚げ定食がおすすめ。" },
    { spotName: "カフェ・ミント 新宿店", userName: "ゆうき", rating: 5, comment: "Wi-Fi速いし、コンセントもあるから勉強に最適。カフェラテが美味しい！" },
    { spotName: "カフェ・ミント 新宿店", userName: "あおい", rating: 4, comment: "テスト前の深夜営業が本当にありがたい。静かで集中できる。" },
    { spotName: "ラーメン二郎 三田本店", userName: "けんた", rating: 5, comment: "大盛り無料は神。ニンニクマシマシで最高のラーメン体験。" },
    { spotName: "ラーメン二郎 三田本店", userName: "みさき", rating: 4, comment: "量がすごい！女子にはちょっと多いかも。でも味は最高。" },
    { spotName: "TOHOシネマズ 新宿", userName: "りょう", rating: 4, comment: "水曜日の学割は本当にお得。IMAXも学割適用されるのが嬉しい。" },
    { spotName: "カラオケ館 渋谷本店", userName: "はるか", rating: 5, comment: "フリータイム1,200円は安すぎ！ドリンクバー付きだし、部屋もきれい。" },
    { spotName: "エニタイムフィットネス 高田馬場店", userName: "だいち", rating: 4, comment: "24時間使えるのが便利。朝活にも夜トレにも対応できる。" },
    { spotName: "ドトールコーヒー 東大前店", userName: "なつみ", rating: 4, comment: "朝のモーニングセットが学割で安くなるのは嬉しい。静かで勉強しやすい。" },
  ];

  for (const review of reviewData) {
    const spotId = spotMap[review.spotName];
    if (!spotId) continue;
    await db.execute(sql`INSERT INTO reviews (spotId, userName, rating, comment) VALUES (${spotId}, ${review.userName}, ${review.rating}, ${review.comment})`);
  }
  console.log("✅ Reviews inserted");

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
