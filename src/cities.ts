import type { City } from './types';

/** Region ids as used by CIAN (`region=` in its search URLs). */
export const CITIES: City[] = [
  { id: 1, name: 'Москва' },
  { id: 2, name: 'Санкт-Петербург' },
];

export const DEFAULT_CITY = CITIES[0];

export function findCity(id: number): City | undefined {
  return CITIES.find((c) => c.id === id);
}
