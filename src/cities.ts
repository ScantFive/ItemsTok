import type { City } from './types';

/** Region ids as used by the CIAN search API. */
export const CITIES: City[] = [
  { id: 1, name: 'Москва' },
  { id: 2, name: 'Санкт-Петербург' },
  { id: 4897, name: 'Новосибирск' },
  { id: 4743, name: 'Екатеринбург' },
  { id: 4777, name: 'Казань' },
  { id: 4885, name: 'Нижний Новгород' },
  { id: 4820, name: 'Краснодар' },
  { id: 4966, name: 'Самара' },
  { id: 4959, name: 'Ростов-на-Дону' },
  { id: 4998, name: 'Сочи' },
];

export const DEFAULT_CITY = CITIES[0];

export function findCity(id: number): City | undefined {
  return CITIES.find((c) => c.id === id);
}
