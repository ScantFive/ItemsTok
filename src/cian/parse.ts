import type { Metro, Offer } from '../types';

// The CIAN API is undocumented, so every field is read defensively.
type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function parsePhotos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isObj)
    .map((p) => str(p.fullUrl) || str(p.thumbnail2Url) || str(p.thumbnailUrl))
    .filter(Boolean);
}

function parseMetro(geo: Json): Metro | null {
  const list = Array.isArray(geo.undergrounds) ? geo.undergrounds.filter(isObj) : [];
  if (list.length === 0) return null;
  const m = list[0];
  return {
    name: str(m.name),
    minutes: num(m.time),
    onFoot: str(m.transportType) !== 'transport',
  };
}

function parseAddress(geo: Json): string {
  if (str(geo.userInput)) return str(geo.userInput);
  if (!Array.isArray(geo.address)) return '';
  return geo.address
    .filter(isObj)
    .map((a) => str(a.fullName) || str(a.name))
    .filter(Boolean)
    .join(', ');
}

export function parseOffer(raw: unknown): Offer | null {
  if (!isObj(raw)) return null;
  const id = num(raw.cianId) ?? num(raw.id);
  if (id === null) return null;

  const terms = isObj(raw.bargainTerms) ? raw.bargainTerms : {};
  const price = num(terms.priceRur) ?? num(terms.price);
  if (price === null) return null;

  const geo = isObj(raw.geo) ? raw.geo : {};
  const building = isObj(raw.building) ? raw.building : {};
  const isStudio = raw.flatType === 'studio' || raw.isApartments === 'studio';
  const published = num(raw.addedTimestamp);

  return {
    id: String(id),
    url: str(raw.fullUrl) || `https://www.cian.ru/rent/flat/${id}/`,
    photos: parsePhotos(raw.photos),
    price,
    rooms: isStudio ? 0 : num(raw.roomsCount),
    area: num(raw.totalArea),
    floor: num(raw.floorNumber),
    floorsTotal: num(building.floorsCount),
    address: parseAddress(geo),
    metro: parseMetro(geo),
    description: str(raw.description),
    publishedAt: published === null ? null : published * 1000,
    source: 'cian',
  };
}

/** Extracts offers from a CIAN search API response. */
export function parseSearchResponse(body: unknown): Offer[] {
  const data = isObj(body) && isObj(body.data) ? body.data : null;
  const list = data && Array.isArray(data.offersSerialized) ? data.offersSerialized : [];
  return list.map(parseOffer).filter((o): o is Offer => o !== null);
}
