import { fetchViaApi } from './cian/client';
import { CIAN_SEARCH_URL, buildSearchBody } from './cian/query';
import { parseSearchResponse } from './cian/parse';
import { DEMO_PAGES, demoOffers } from './demo';
import type { City, Offer, OffersPage, Snapshot } from './types';

export type FeedSource = 'live' | 'snapshot' | 'demo';

const SNAPSHOT_PAGE_SIZE = 10;
const LIVE_TIMEOUT_MS = 8000;

/**
 * Optional live source, configured at build time: our own CIAN proxy (VITE_CIAN_API, see worker/)
 * or a generic CORS proxy prefix (VITE_CORS_PROXY, target URL appended URL-encoded).
 * Without either, the feed shows the snapshot exported from the owner's computer.
 */
function liveConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CIAN_API || import.meta.env.VITE_CORS_PROXY);
}

async function fetchLive(city: City, page: number): Promise<Offer[]> {
  const api = import.meta.env.VITE_CIAN_API as string | undefined;
  if (api) return fetchViaApi(api, city.id, page, LIVE_TIMEOUT_MS);
  const proxy = import.meta.env.VITE_CORS_PROXY as string;
  const res = await fetch(proxy + encodeURIComponent(CIAN_SEARCH_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSearchBody(city.id, page)),
    signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseSearchResponse(await res.json());
}

const snapshotCache = new Map<number, Promise<Snapshot>>();

function fetchSnapshot(city: City): Promise<Snapshot> {
  let cached = snapshotCache.get(city.id);
  if (!cached) {
    cached = fetch(`${import.meta.env.BASE_URL}data/${city.id}.json`, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Snapshot>;
      });
    cached.catch(() => snapshotCache.delete(city.id));
    snapshotCache.set(city.id, cached);
  }
  return cached;
}

export type FeedPage = OffersPage & { source: FeedSource; updatedAt?: string };

/**
 * Loads one feed page. The first page decides the source (snapshot exported from the
 * owner's computer → live CIAN, if configured → demo data); later pages stick to the
 * same source so the feed stays consistent.
 */
export async function loadOffers(city: City, page: number, source: FeedSource | null): Promise<FeedPage> {
  if (source === null || source === 'snapshot') {
    try {
      const snapshot = await fetchSnapshot(city);
      const all = snapshot.offers ?? [];
      if (all.length > 0) {
        const start = (page - 1) * SNAPSHOT_PAGE_SIZE;
        const offers = all.slice(start, start + SNAPSHOT_PAGE_SIZE);
        return {
          offers,
          hasMore: start + SNAPSHOT_PAGE_SIZE < all.length,
          source: 'snapshot',
          updatedAt: snapshot.updatedAt,
        };
      }
    } catch (e) {
      if (source === 'snapshot') throw e;
    }
  }

  if ((source === null && liveConfigured()) || source === 'live') {
    try {
      const offers = await fetchLive(city, page);
      if (offers.length > 0 || source === 'live') {
        return { offers, hasMore: offers.length > 0, source: 'live' };
      }
    } catch (e) {
      if (source === 'live') throw e;
      console.info('[itemstok] live CIAN fetch failed, falling back', e);
    }
  }

  return { offers: demoOffers(city, page), hasMore: page < DEMO_PAGES, source: 'demo' };
}
