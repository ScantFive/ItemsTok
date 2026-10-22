import { describe, expect, it } from 'vitest';
import { parseOffer, parseSearchResponse } from '../src/cian/parse';

const rawOffer = {
  cianId: 301234567,
  fullUrl: 'https://www.cian.ru/rent/flat/301234567/',
  bargainTerms: { priceRur: 85000, currency: 'rur' },
  roomsCount: 2,
  totalArea: '54.3',
  floorNumber: 7,
  building: { floorsCount: 17 },
  geo: {
    userInput: 'Москва, ул. Профсоюзная, 12',
    undergrounds: [{ name: 'Академическая', time: 6, transportType: 'walk' }],
  },
  photos: [{ fullUrl: 'https://cdn.cian.site/1.jpg' }, { thumbnailUrl: 'https://cdn.cian.site/2-t.jpg' }, {}],
  description: 'Хорошая квартира',
  addedTimestamp: 1700000000,
};

describe('parseOffer', () => {
  it('maps a CIAN offer to the app model', () => {
    expect(parseOffer(rawOffer)).toEqual({
      id: '301234567',
      url: 'https://www.cian.ru/rent/flat/301234567/',
      photos: ['https://cdn.cian.site/1.jpg', 'https://cdn.cian.site/2-t.jpg'],
      price: 85000,
      rooms: 2,
      area: 54.3,
      floor: 7,
      floorsTotal: 17,
      address: 'Москва, ул. Профсоюзная, 12',
      metro: { name: 'Академическая', minutes: 6, onFoot: true },
      description: 'Хорошая квартира',
      publishedAt: 1700000000000,
      source: 'cian',
    });
  });

  it('builds address from parts and detects studios', () => {
    const o = parseOffer({
      id: 5,
      flatType: 'studio',
      bargainTerms: { price: 40000 },
      geo: { address: [{ fullName: 'Казань' }, { name: 'Баумана' }] },
    })!;
    expect(o.rooms).toBe(0);
    expect(o.address).toBe('Казань, Баумана');
    expect(o.url).toBe('https://www.cian.ru/rent/flat/5/');
    expect(o.metro).toBeNull();
  });

  it('rejects offers without id or price', () => {
    expect(parseOffer({ bargainTerms: { priceRur: 1 } })).toBeNull();
    expect(parseOffer({ cianId: 1 })).toBeNull();
    expect(parseOffer('nope')).toBeNull();
  });
});

describe('parseSearchResponse', () => {
  it('skips invalid offers and tolerates malformed bodies', () => {
    expect(parseSearchResponse({ data: { offersSerialized: [rawOffer, {}, null] } })).toHaveLength(1);
    expect(parseSearchResponse({})).toEqual([]);
    expect(parseSearchResponse(null)).toEqual([]);
  });
});
