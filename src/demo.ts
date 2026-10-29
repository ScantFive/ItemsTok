import type { City, Offer } from './types';

const STREETS = ['Ленина', 'Гагарина', 'Пушкина', 'Садовая', 'Мира', 'Советская', 'Лесная', 'Набережная', 'Школьная', 'Победы'];
const METROS = ['Центральная', 'Парковая', 'Вокзальная', 'Университет', 'Площадь Мира', 'Речной вокзал'];
const BLURBS = [
  'Светлая квартира после ремонта, вся мебель и техника. Рядом парк и супермаркет.',
  'Тихий двор, окна во двор. Можно с животными по договорённости.',
  'Панорамные окна, кухня-гостиная, кондиционер. Сдаётся на длительный срок.',
  'Уютная квартира в зелёном районе, до метро несколько минут пешком.',
  'Новый дом, закрытая территория, подземный паркинг.',
];

/** Deterministic PRNG so the same city/page always yields the same demo feed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export const DEMO_PAGES = 5;
const PAGE_SIZE = 10;

export function demoOffers(city: City, page: number): Offer[] {
  const rand = rng(city.id * 1000 + page);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const base = city.id === 1 ? 70000 : 50000;

  return Array.from({ length: PAGE_SIZE }, (_, i) => {
    const id = `demo-${city.id}-${page}-${i}`;
    const rooms = Math.floor(rand() * 4);
    const floorsTotal = 5 + Math.floor(rand() * 20);
    const photoCount = 2 + Math.floor(rand() * 3);
    return {
      id,
      url: `https://www.cian.ru/snyat-kvartiru/`,
      photos: Array.from({ length: photoCount }, (_, k) => `https://picsum.photos/seed/${id}-${k}/900/900`),
      price: Math.round((base + rooms * 15000 + rand() * 30000) / 1000) * 1000,
      rooms,
      area: Math.round(25 + rooms * 18 + rand() * 20),
      floor: 1 + Math.floor(rand() * floorsTotal),
      floorsTotal,
      address: `${city.name}, ул. ${pick(STREETS)}, ${1 + Math.floor(rand() * 120)}`,
      metro: { name: pick(METROS), minutes: 3 + Math.floor(rand() * 20), onFoot: rand() > 0.3 },
      description: pick(BLURBS),
      publishedAt: Date.now() - Math.floor(rand() * 7 * 24 * 3600 * 1000),
      source: 'demo',
    } satisfies Offer;
  });
}
