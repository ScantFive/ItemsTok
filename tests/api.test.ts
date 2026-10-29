import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadOffers } from '../src/api';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const snapshot = (n: number) => ({
  regionId: 4777,
  updatedAt: '2026-10-29T10:00:00.000Z',
  offers: Array.from({ length: n }, (_, i) => ({ id: `s${i}` })),
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('loadOffers', () => {
  it('serves the exported snapshot first, paginated, without calling CIAN', async () => {
    const fetchMock = vi.fn(async (url: string) => (url.includes('data/4777.json') ? json(snapshot(15)) : json({}, 500)));
    vi.stubGlobal('fetch', fetchMock);
    const city = { id: 4777, name: 'Казань' };

    const first = await loadOffers(city, 1, null);
    expect(first).toMatchObject({ source: 'snapshot', hasMore: true, updatedAt: '2026-10-29T10:00:00.000Z' });
    expect(first.offers).toHaveLength(10);
    const second = await loadOffers(city, 2, 'snapshot');
    expect(second).toMatchObject({ source: 'snapshot', hasMore: false });
    expect(second.offers).toHaveLength(5);
    expect(fetchMock.mock.calls.every(([url]) => url.includes('data/'))).toBe(true);
  });

  it('shows demo data when there is no snapshot and no live source', async () => {
    const fetchMock = vi.fn(async () => json({}, 404));
    vi.stubGlobal('fetch', fetchMock);
    const res = await loadOffers({ id: 2, name: 'Санкт-Петербург' }, 1, null);
    expect(res.source).toBe('demo');
    expect(res.offers.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('uses the CIAN proxy when configured and no snapshot exists', async () => {
    vi.stubEnv('VITE_CIAN_API', 'https://proxy.example');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('https://proxy.example/search?region=4897&page=1') ? json({ offers: [{ id: 'p1' }] }) : json({}, 404),
      ),
    );
    const res = await loadOffers({ id: 4897, name: 'Новосибирск' }, 1, null);
    expect(res.source).toBe('live');
    expect(res.offers[0].id).toBe('p1');
  });
});
