import type { Offer } from '../types';
import { parseSearchResponse } from './parse';
import { CIAN_SEARCH_URL, buildSearchBody } from './query';

const BROWSER_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Origin: 'https://www.cian.ru',
  Referer: 'https://www.cian.ru/',
};

/** CIAN answered with something other than search results (usually an anti-bot HTML page). */
export class CianBlockedError extends Error {}

/** Server-side call to the CIAN search API (worker, CI script). Browsers can't do this because of CORS. */
export async function fetchCianDirect(regionId: number, page: number, timeoutMs = 15000): Promise<Offer[]> {
  const res = await fetch(CIAN_SEARCH_URL, {
    method: 'POST',
    headers: BROWSER_HEADERS,
    body: JSON.stringify(buildSearchBody(regionId, page)),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new CianBlockedError(`CIAN returned ${res.status} ${type || 'no content-type'}`);
  if (!res.ok) throw new Error(`CIAN HTTP ${res.status}`);
  return parseSearchResponse(await res.json());
}

/** Calls our own proxy (worker/), which returns already parsed offers. */
export async function fetchViaApi(baseUrl: string, regionId: number, page: number, timeoutMs = 10000): Promise<Offer[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/search?region=${regionId}&page=${page}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  const body = (await res.json()) as { offers?: Offer[] };
  return Array.isArray(body.offers) ? body.offers : [];
}
