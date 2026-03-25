import type { AgentShop } from "../agent";

type Coordinates = {
  lat: number;
  lng: number;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceKm = (a: Coordinates, b: Coordinates) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
};

export const LOCAL_AGENT_DEFAULT_LOCATION = {
  lat: 35.6595,
  lng: 139.7005,
} as const;

const LOCAL_AGENT_FIXTURES: AgentShop[] = [
  {
    name: "カラオケ館 渋谷本店",
    address: "東京都渋谷区宇田川町25-6",
    place_id: "local-karaokekan-shibuya",
    website: "https://karaokekan.jp/",
    lat: 35.6606,
    lng: 139.6999,
    rating: 4.0,
    types: ["karaoke", "entertainment"],
  },
  {
    name: "ラウンドワン 渋谷店",
    address: "東京都渋谷区宇田川町32-20",
    place_id: "local-round1-shibuya",
    website: "https://www.round1.co.jp/",
    lat: 35.6615,
    lng: 139.6986,
    rating: 3.9,
    types: ["bowling_alley", "amusement_center"],
  },
  {
    name: "GU 渋谷店",
    address: "東京都渋谷区宇田川町32-13",
    place_id: "local-gu-shibuya",
    website: "https://www.gu-global.com/jp/",
    lat: 35.6613,
    lng: 139.6982,
    rating: 3.8,
    types: ["clothing_store", "store"],
  },
  {
    name: "TOHOシネマズ 渋谷",
    address: "東京都渋谷区道玄坂2-6-17",
    place_id: "local-toho-shibuya",
    website: "https://hlo.tohotheater.jp/net/schedule/028/TNPI2000J01.do",
    lat: 35.6597,
    lng: 139.6988,
    rating: 4.1,
    types: ["movie_theater", "entertainment"],
  },
  {
    name: "まねきねこ 渋谷本店",
    address: "東京都渋谷区宇田川町13-11",
    place_id: "local-manekineko-shibuya",
    website: "https://www.karaokemanekineko.jp/",
    lat: 35.6619,
    lng: 139.7011,
    rating: 4.0,
    types: ["karaoke", "bar"],
  },
];

export const getLocalAgentFixtures = ({
  lat,
  lng,
  radiusMeters,
  keyword,
  type,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  keyword?: string;
  type?: string;
}): AgentShop[] => {
  const center = { lat, lng };
  const radiusKm = radiusMeters / 1000;
  const normalizedKeyword = keyword?.trim().toLowerCase();
  const normalizedType = type?.trim().toLowerCase();

  return LOCAL_AGENT_FIXTURES.filter((shop) => {
    const distance = distanceKm(center, { lat: shop.lat, lng: shop.lng });
    if (distance > radiusKm) {
      return false;
    }

    if (
      normalizedKeyword &&
      !`${shop.name} ${shop.address}`.toLowerCase().includes(normalizedKeyword)
    ) {
      return false;
    }

    if (
      normalizedType &&
      !shop.types?.some((shopType) => shopType.toLowerCase().includes(normalizedType))
    ) {
      return false;
    }

    return true;
  }).sort((left, right) => {
    const leftDistance = distanceKm(center, { lat: left.lat, lng: left.lng });
    const rightDistance = distanceKm(center, { lat: right.lat, lng: right.lng });
    return leftDistance - rightDistance;
  });
};
