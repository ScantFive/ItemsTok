import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadOffers } from '../src/api';

const city = { id: 4777, name: 'Казань' };
const cianBody = {
  data: { offersSerialized: [{ cianId: 1, bargainTerms: { priceRur: 30000 } }] },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('loadOffers', () => {
  it('uses live CIAN data when the proxy works', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(cianBody)));
    const res = await loadOffers(city, 1, null);
    expect(res.source).toBe('live');
    expect(res.offers[0].id).toBe('1');
  });

  it('falls back to the snapshot, then to demo data', async () => {
    const snapshot = { regionId: 4777, updatedAt: '', offers: Array.from({ length: 15 }, (_, i) => ({ id: `s${i}` })) };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.includes('data/4777.json') ? json(snapshot) : json({}, 403))),
    );
    const first = await loadOffers(city, 1, null);
    expect(first).toMatchObject({ source: 'snapshot', hasMore: true });
    expect(first.offers).toHaveLength(10);
    const second = await loadOffers(city, 2, 'snapshot');
    expect(second).toMatchObject({ source: 'snapshot', hasMore: false });
    expect(second.offers).toHaveLength(5);

    vi.stubGlobal('fetch', vi.fn(async () => json({}, 404)));
    const demo = await loadOffers({ id: 2, name: 'Санкт-Петербург' }, 1, null);
    expect(demo.source).toBe('demo');
    expect(demo.offers.length).toBeGreaterThan(0);
  });
});
