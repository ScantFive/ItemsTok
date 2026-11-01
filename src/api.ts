import { fetchViaApi } from './cian/client';
import { CIAN_SEARCH_URL, buildSearchBody } from './cian/query';
import { parseSearchResponse } from './cian/parse';
import { DEMO_PAGES, demoOffers } from './demo';
import { EMPTY_FILTERS, matches, type Filters } from './filters';
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

/** Every offer the feed can show for a city, when it is known up front (snapshot or demo). */
export interface Catalog {
  offers: Offer[];
  source: 'snapshot' | 'demo';
  updatedAt?: string;
}

/** Snapshot if one exists, otherwise null (callers then try live or demo). */
async function snapshotCatalog(city: City): Promise<Catalog | null> {
  try {
    const snapshot = await fetchSnapshot(city);
    const offers = snapshot.offers ?? [];
    return offers.length > 0 ? { offers, source: 'snapshot', updatedAt: snapshot.updatedAt } : null;
  } catch {
    return null;
  }
}

function demoCatalog(city: City): Catalog {
  const offers = Array.from({ length: DEMO_PAGES }, (_, i) => demoOffers(city, i + 1)).flat();
  return { offers, source: 'demo' };
}

/** What the filter panel works with: the snapshot, or demo data when there is no snapshot and no live source. */
export async function loadCatalog(city: City): Promise<Catalog | null> {
  return (await snapshotCatalog(city)) ?? (liveConfigured() ? null : demoCatalog(city));
}

function pageOf(catalog: Catalog, page: number, filters: Filters): FeedPage {
  const all = catalog.offers.filter((o) => matches(o, filters));
  const start = (page - 1) * SNAPSHOT_PAGE_SIZE;
  return {
    offers: all.slice(start, start + SNAPSHOT_PAGE_SIZE),
    hasMore: start + SNAPSHOT_PAGE_SIZE < all.length,
    source: catalog.source,
    updatedAt: catalog.updatedAt,
  };
}

/**
 * Loads one feed page. The first page decides the source (snapshot exported from the
 * owner's browser → live CIAN, if configured → demo data); later pages stick to the
 * same source so the feed stays consistent. Filters are applied before paginating
 * where the whole list is known, and per page for live data.
 */
export async function loadOffers(
  city: City,
  page: number,
  source: FeedSource | null,
  filters: Filters = EMPTY_FILTERS,
): Promise<FeedPage> {
  if (source === null || source === 'snapshot') {
    const catalog = await snapshotCatalog(city);
    if (catalog) return pageOf(catalog, page, filters);
    if (source === 'snapshot') throw new Error('snapshot unavailable');
  }

  if ((source === null && liveConfigured()) || source === 'live') {
    try {
      const offers = await fetchLive(city, page);
      if (offers.length > 0 || source === 'live') {
        return { offers: offers.filter((o) => matches(o, filters)), hasMore: offers.length > 0, source: 'live' };
      }
    } catch (e) {
      if (source === 'live') throw e;
      console.info('[itemstok] live CIAN fetch failed, falling back', e);
    }
  }

  return pageOf(demoCatalog(city), page, filters);
}
