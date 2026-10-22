export const CIAN_SEARCH_URL = 'https://api.cian.ru/search-offers/v2/search-offers-desktop/';

/** Body for the CIAN search API: long-term flat rent in the given region. */
export function buildSearchBody(regionId: number, page: number) {
  return {
    jsonQuery: {
      _type: 'flatrent',
      engine_version: { type: 'term', value: 2 },
      region: { type: 'terms', value: [regionId] },
      for_day: { type: 'term', value: '!1' },
      sort: { type: 'term', value: 'creation_date_desc' },
      page: { type: 'term', value: page },
    },
  };
}
