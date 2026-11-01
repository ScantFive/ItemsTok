import { beforeEach, describe as group, expect, it } from 'vitest';
import { EMPTY_FILTERS, activeCount, describe, loadFilters, matches, saveFilters, stationCounts, type Filters } from '../src/filters';
import type { Offer } from '../src/types';

const offer = (price: number, metros: Array<[string, number, boolean]>, legacy = false): Offer => {
  const list = metros.map(([name, minutes, onFoot]) => ({ name, minutes, onFoot }));
  return {
    id: String(price),
    url: '',
    photos: [],
    price,
    rooms: 1,
    area: null,
    floor: null,
    floorsTotal: null,
    address: '',
    metro: list[0] ?? null,
    ...(legacy ? {} : { metros: list }),
    description: '',
    publishedAt: null,
    source: 'cian',
  };
};
const f = (patch: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...patch });

const cheapNearMayak = offer(50000, [['Маяковская', 5, true], ['Белорусская', 15, true]]);
const pricyFarSokol = offer(150000, [['Сокол', 25, false]]);
const legacyBelor = offer(70000, [['Белорусская', 8, true]], true);

group('matches', () => {
  it('filters by price range', () => {
    expect(matches(cheapNearMayak, f({ priceMax: 60000 }))).toBe(true);
    expect(matches(pricyFarSokol, f({ priceMax: 60000 }))).toBe(false);
    expect(matches(cheapNearMayak, f({ priceMin: 60000 }))).toBe(false);
  });

  it('matches any listed station, not only the nearest', () => {
    expect(matches(cheapNearMayak, f({ stations: ['Белорусская'] }))).toBe(true);
    expect(matches(pricyFarSokol, f({ stations: ['Белорусская'] }))).toBe(false);
    expect(matches(legacyBelor, f({ stations: ['Белорусская'] }))).toBe(true);
  });

  it('limits walking time, to the selected stations when there are any', () => {
    expect(matches(cheapNearMayak, f({ maxWalk: 10 }))).toBe(true);
    expect(matches(pricyFarSokol, f({ maxWalk: 30 }))).toBe(false); // by transport
    expect(matches(cheapNearMayak, f({ stations: ['Белорусская'], maxWalk: 10 }))).toBe(false);
    expect(matches(cheapNearMayak, f({ stations: ['Белорусская'], maxWalk: 15 }))).toBe(true);
  });
});

group('helpers', () => {
  it('counts offers per station once', () => {
    expect(stationCounts([cheapNearMayak, pricyFarSokol, legacyBelor])).toEqual([
      ['Белорусская', 2],
      ['Маяковская', 1],
      ['Сокол', 1],
    ]);
  });

  it('summarises active filters', () => {
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
    const full = f({ priceMin: 40000, priceMax: 80000, stations: ['Маяковская', 'Сокол'], maxWalk: 10 });
    expect(activeCount(full)).toBe(3);
    expect(describe(full).replace(/\s/g, ' ')).toBe('40 000–80 000 ₽ · м. Маяковская +1 · ≤ 10 мин пешком');
    expect(describe(f({ priceMax: 80000 })).replace(/\s/g, ' ')).toBe('до 80 000 ₽');
  });
});

group('persistence', () => {
  beforeEach(() => localStorage.clear());

  it('keeps filters per city and ignores junk', () => {
    saveFilters(1, f({ priceMax: 90000, stations: ['Сокол'] }));
    expect(loadFilters(1)).toEqual(f({ priceMax: 90000, stations: ['Сокол'] }));
    expect(loadFilters(2)).toEqual(EMPTY_FILTERS);
    localStorage.setItem('itemstok:filters:2', '{"priceMin":"x","stations":[1,"Сокол"]}');
    expect(loadFilters(2)).toEqual(f({ stations: ['Сокол'] }));
  });
});
