/**
 * Cloudflare Worker: a narrow CIAN proxy for ItemsTok.
 *
 *   GET /search?region=<CIAN region id>&page=<1..50>  →  { offers: Offer[] }
 *
 * It only ever calls the CIAN rent search, so it can't be abused as an open proxy,
 * and it only grants CORS to origins listed in ALLOWED_ORIGINS.
 */
import { CianBlockedError, fetchCianDirect } from '../src/cian/client';

export interface Env {
  /** Comma-separated list of allowed origins, e.g. "https://user.github.io,http://localhost:5173". */
  ALLOWED_ORIGINS?: string;
}

const CACHE_SECONDS = 600;

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' };
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

async function search(url: URL): Promise<Response> {
  const region = Number(url.searchParams.get('region'));
  const page = Number(url.searchParams.get('page') ?? '1');
  if (!Number.isInteger(region) || region <= 0 || !Number.isInteger(page) || page < 1 || page > 50) {
    return json({ error: 'bad_request' }, 400);
  }
  try {
    const offers = await fetchCianDirect(region, page);
    return json({ offers }, 200, { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` });
  } catch (e) {
    const blocked = e instanceof CianBlockedError;
    console.error('CIAN request failed:', (e as Error).message);
    return json({ error: blocked ? 'cian_blocked' : 'cian_unavailable', message: (e as Error).message }, 502);
  }
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);

  if (request.headers.get('Origin') && !cors['Access-Control-Allow-Origin']) {
    return json({ error: 'origin_not_allowed' }, 403);
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, cors);
  if (url.pathname === '/') return json({ ok: true, usage: '/search?region=1&page=1' }, 200, cors);
  if (url.pathname !== '/search') return json({ error: 'not_found' }, 404, cors);

  // Cache successful searches at the edge so a busy feed doesn't hammer CIAN.
  const cache = typeof caches !== 'undefined' ? await caches.open('cian-search') : null;
  const cacheKey = new Request(url.toString());
  let response = await cache?.match(cacheKey);
  if (!response) {
    response = await search(url);
    if (response.ok) await cache?.put(cacheKey, response.clone());
  }
  const out = new Response(response.body, response);
  Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
  return out;
}

export default { fetch: handle };
