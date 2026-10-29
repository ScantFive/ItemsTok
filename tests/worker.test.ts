// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle } from '../worker/index';

const env = { ALLOWED_ORIGINS: 'https://scantfive.github.io,http://localhost:5173' };
const cianBody = { data: { offersSerialized: [{ cianId: 7, bargainTerms: { priceRur: 50000 } }] } };
const req = (path: string, origin?: string, method = 'GET') =>
  new Request(`https://proxy.example${path}`, { method, headers: origin ? { Origin: origin } : {} });

afterEach(() => vi.unstubAllGlobals());

describe('CIAN proxy worker', () => {
  it('returns parsed offers with CORS for an allowed origin', async () => {
    const fetchMock = vi.fn(async () => Response.json(cianBody));
    vi.stubGlobal('fetch', fetchMock);
    const res = await handle(req('/search?region=1&page=2', 'https://scantfive.github.io'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://scantfive.github.io');
    expect((await res.json()).offers[0]).toMatchObject({ id: '7', price: 50000 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('api.cian.ru');
    expect(JSON.parse(init.body as string).jsonQuery).toMatchObject({ region: { value: [1] }, page: { value: 2 } });
  });

  it('rejects other origins, bad params and other paths', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect((await handle(req('/search?region=1', 'https://evil.example'), env)).status).toBe(403);
    expect((await handle(req('/search?region=abc'), env)).status).toBe(400);
    expect((await handle(req('/search?region=1&page=999'), env)).status).toBe(400);
    expect((await handle(req('/anything?url=https://x'), env)).status).toBe(404);
    expect((await handle(req('/search?region=1', undefined, 'POST'), env)).status).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports when CIAN answers with an anti-bot page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })));
    const res = await handle(req('/search?region=1'), env);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('cian_blocked');
  });
});

describe('/debug', () => {
  it('reports what CIAN answers for each probe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html><title>Captcha</title><body>Подтвердите, что вы не робот smartcaptcha</body></html>', {
        headers: { 'content-type': 'text/html' },
      })),
    );
    const res = await handle(req('/debug'), env);
    const body = await res.json();
    expect(body.probes).toHaveLength(3);
    expect(body.probes[0]).toMatchObject({ status: 200, title: 'Captcha', markers: { captcha: true, smartCaptcha: true } });
    expect(body.probes[0].text).toContain('не робот');
  });
});
