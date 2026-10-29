// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://spb.cian.ru/cat.php?deal_type=rent&region=2&p=3"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import source from '../src/bookmarklet/export.js?raw';
import { parseOffer } from '../src/cian/parse';

const offer = (id: number) => ({ cianId: id, bargainTerms: { priceRur: 60000 }, roomsCount: 1, photos: [] });
const win = window as unknown as Record<string, unknown>;

let saved: Blob | null;
let alerts: string[];

beforeEach(() => {
  saved = null;
  alerts = [];
  vi.stubGlobal('alert', (m: string) => alerts.push(m));
  URL.createObjectURL = vi.fn((b: Blob) => {
    saved = b;
    return 'blob:x';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete win._cianConfig;
});

const runBookmarklet = () => new Function(source)();

describe('export bookmarklet', () => {
  it('saves offers and the search query from the CIAN page state', async () => {
    win._cianConfig = {
      'frontend-serp': [
        { key: 'config', value: { other: [1, 2] } },
        {
          key: 'initialState',
          value: {
            results: { offers: [offer(11), offer(12)], jsonQuery: { _type: 'flatrent', region: { type: 'terms', value: [2] }, page: { type: 'term', value: 3 } } },
          },
        },
      ],
    };
    runBookmarklet();
    expect(saved).not.toBeNull();
    const data = JSON.parse(await saved!.text());
    expect(data).toMatchObject({ format: 'itemstok-export', regionId: 2, page: 3, type: 'flatrent' });
    expect(data.offers.map(parseOffer).map((o: { id: string }) => o.id)).toEqual(['11', '12']);
    expect(alerts[0]).toContain('сохранено объявлений — 2');
  });

  it('falls back to the URL for region and page', async () => {
    win._cianConfig = { serp: [{ key: 'state', value: { list: [offer(5)] } }] };
    runBookmarklet();
    expect(JSON.parse(await saved!.text())).toMatchObject({ regionId: 2, page: 3 });
  });

  it('explains when the page has no offers', () => {
    win._cianConfig = { 'frontend-offer-card': [{ key: 'x', value: {} }] };
    runBookmarklet();
    expect(saved).toBeNull();
    expect(alerts[0]).toContain('не нашлось объявлений');
  });
});
