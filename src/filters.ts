import type { Metro, Offer } from './types';

export interface Filters {
  priceMin: number | null;
  priceMax: number | null;
  /** Station names; an offer matches if any of its stations is selected. */
  stations: string[];
  /** Max minutes on foot to a (selected, if any) station. */
  maxWalk: number | null;
}

export const EMPTY_FILTERS: Filters = { priceMin: null, priceMax: null, stations: [], maxWalk: null };

export function offerStations(offer: Offer): Metro[] {
  if (offer.metros && offer.metros.length > 0) return offer.metros;
  return offer.metro ? [offer.metro] : [];
}

export function matches(offer: Offer, f: Filters): boolean {
  if (f.priceMin !== null && offer.price < f.priceMin) return false;
  if (f.priceMax !== null && offer.price > f.priceMax) return false;
  if (f.stations.length === 0 && f.maxWalk === null) return true;

  let stations = offerStations(offer);
  if (f.stations.length > 0) stations = stations.filter((m) => f.stations.includes(m.name));
  if (f.maxWalk !== null) {
    const limit = f.maxWalk;
    stations = stations.filter((m) => m.onFoot && m.minutes !== null && m.minutes <= limit);
  }
  return stations.length > 0;
}

export function activeCount(f: Filters): number {
  return (f.priceMin !== null || f.priceMax !== null ? 1 : 0) + (f.stations.length > 0 ? 1 : 0) + (f.maxWalk !== null ? 1 : 0);
}

/** Stations present in the offers with how many offers each, alphabetically. */
export function stationCounts(offers: Offer[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const offer of offers) {
    for (const name of new Set(offerStations(offer).map((m) => m.name))) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b, 'ru'));
}

const rub = new Intl.NumberFormat('ru-RU');

/** Short human summary, e.g. "до 80 000 ₽ · м. Маяковская +2 · ≤ 10 мин пешком". */
export function describe(f: Filters): string {
  const parts: string[] = [];
  if (f.priceMin !== null && f.priceMax !== null) parts.push(`${rub.format(f.priceMin)}–${rub.format(f.priceMax)} ₽`);
  else if (f.priceMin !== null) parts.push(`от ${rub.format(f.priceMin)} ₽`);
  else if (f.priceMax !== null) parts.push(`до ${rub.format(f.priceMax)} ₽`);
  if (f.stations.length > 0) {
    parts.push(`м. ${f.stations[0]}${f.stations.length > 1 ? ` +${f.stations.length - 1}` : ''}`);
  }
  if (f.maxWalk !== null) parts.push(`≤ ${f.maxWalk} мин пешком`);
  return parts.join(' · ');
}

const key = (cityId: number) => `itemstok:filters:${cityId}`;
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

export function loadFilters(cityId: number): Filters {
  try {
    const raw = JSON.parse(localStorage.getItem(key(cityId)) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...EMPTY_FILTERS };
    return {
      priceMin: numOrNull(raw.priceMin),
      priceMax: numOrNull(raw.priceMax),
      stations: Array.isArray(raw.stations) ? raw.stations.filter((s: unknown) => typeof s === 'string') : [],
      maxWalk: numOrNull(raw.maxWalk),
    };
  } catch {
    return { ...EMPTY_FILTERS };
  }
}

export function saveFilters(cityId: number, f: Filters): void {
  try {
    localStorage.setItem(key(cityId), JSON.stringify(f));
  } catch {
    // Filters then only last for this visit.
  }
}
