import { BROWSER_HEADERS } from '../src/cian/client';
import { CIAN_SEARCH_URL, buildSearchBody } from '../src/cian/query';

/** What CIAN answers to the worker, so we can tell an anti-bot page from a changed API. */
interface Probe {
  name: string;
  status?: number;
  contentType?: string | null;
  finalUrl?: string;
  server?: string | null;
  length?: number;
  title?: string;
  markers?: Record<string, boolean>;
  text?: string;
  error?: string;
}

const MARKERS = {
  captcha: /captcha/i,
  smartCaptcha: /smartcaptcha|showcaptcha/i,
  accessDenied: /доступ ограничен|access denied|forbidden/i,
  offersJson: /offersSerialized/,
  serpState: /_cianConfig/,
};

async function probe(name: string, url: string, init: RequestInit): Promise<Probe> {
  try {
    const res = await fetch(url, { ...init, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ?? '';
    const text = body
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    return {
      name,
      status: res.status,
      contentType: res.headers.get('content-type'),
      finalUrl: res.url,
      server: res.headers.get('server'),
      length: body.length,
      title,
      markers: Object.fromEntries(Object.entries(MARKERS).map(([k, re]) => [k, re.test(body)])),
      text,
    };
  } catch (e) {
    return { name, error: (e as Error).message };
  }
}

export async function diagnose(request: Request): Promise<unknown> {
  const body = JSON.stringify(buildSearchBody(1, 1));
  const { Origin: _o, Referer: _r, ...plainHeaders } = BROWSER_HEADERS;
  const htmlHeaders = {
    'User-Agent': BROWSER_HEADERS['User-Agent'],
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': BROWSER_HEADERS['Accept-Language'],
  };
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf;
  return {
    worker: { colo: cf?.colo ?? null, country: cf?.country ?? null },
    probes: await Promise.all([
      probe('api, browser headers', CIAN_SEARCH_URL, { method: 'POST', headers: BROWSER_HEADERS, body }),
      probe('api, no Origin/Referer', CIAN_SEARCH_URL, { method: 'POST', headers: plainHeaders, body }),
      probe(
        'html search page',
        'https://www.cian.ru/cat.php?deal_type=rent&engine_version=2&offer_type=flat&region=1&type=4',
        { headers: htmlHeaders },
      ),
    ]),
  };
}
