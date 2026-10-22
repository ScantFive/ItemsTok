import { CIAN_SEARCH_URL, buildSearchBody } from './cian/query';
import { parseSearchResponse } from './cian/parse';
import { DEMO_PAGES, demoOffers } from './demo';
import type { City, Offer, OffersPage, Snapshot } from './types';

export type FeedSource = 'live' | 'snapshot' | 'demo';

const SNAPSHOT_PAGE_SIZE = 10;
const LIVE_TIMEOUT_MS = 8000;

/**
 * CIAN does not send CORS headers, so a browser can reach its API only through a proxy.
 * Override with VITE_CORS_PROXY at build time; the target URL is appended URL-encoded.
 */
const PROXIES: string[] = (import.meta.env.VITE_CORS_PROXY as string | undefined)
  ? [import.meta.env.VITE_CORS_PROXY as string]
  : ['https://corsproxy.io/?url='];

async function fetchLive(city: City, page: number): Promise<Offer[]> {
  let lastError: unknown = new Error('no proxies configured');
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(CIAN_SEARCH_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSearchBody(city.id, page)),
        signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseSearchResponse(await res.json());
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

const snapshotCache = new Map<number, Promise<Offer[]>>();

function fetchSnapshot(city: City): Promise<Offer[]> {
  let cached = snapshotCache.get(city.id);
  if (!cached) {
    cached = fetch(`${import.meta.env.BASE_URL}data/${city.id}.json`, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Snapshot>;
      })
      .then((s) => s.offers ?? []);
    cached.catch(() => snapshotCache.delete(city.id));
    snapshotCache.set(city.id, cached);
  }
  return cached;
}

/**
 * Loads one feed page. The first page decides the source (live CIAN → pre-fetched
 * snapshot → demo data); later pages stick to the same source so the feed stays consistent.
 */
export async function loadOffers(
  city: City,
  page: number,
  source: FeedSource | null,
): Promise<OffersPage & { source: FeedSource }> {
  if (source === null || source === 'live') {
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

  if (source === null || source === 'snapshot') {
    try {
      const all = await fetchSnapshot(city);
      if (all.length > 0) {
        const start = (page - 1) * SNAPSHOT_PAGE_SIZE;
        const offers = all.slice(start, start + SNAPSHOT_PAGE_SIZE);
        return { offers, hasMore: start + SNAPSHOT_PAGE_SIZE < all.length, source: 'snapshot' };
      }
    } catch (e) {
      if (source === 'snapshot') throw e;
    }
  }

  return { offers: demoOffers(city, page), hasMore: page < DEMO_PAGES, source: 'demo' };
}
