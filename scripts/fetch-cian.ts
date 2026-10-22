/**
 * Pre-fetches CIAN rent offers into public/data/<regionId>.json.
 * Runs in CI before the GitHub Pages build so the static site has data even when
 * the browser cannot reach CIAN. Failures are logged but never fail the build:
 * the app then falls back to demo data.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { CITIES } from '../src/cities.ts';
import { CIAN_SEARCH_URL, buildSearchBody } from '../src/cian/query.ts';
import { parseSearchResponse } from '../src/cian/parse.ts';
import type { Offer, Snapshot } from '../src/types.ts';

const PAGES = Number(process.env.CIAN_PAGES ?? 3);
const OUT_DIR = new URL('../public/data/', import.meta.url);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(regionId: number, page: number): Promise<Offer[]> {
  const res = await fetch(CIAN_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      Origin: 'https://www.cian.ru',
      Referer: 'https://www.cian.ru/',
    },
    body: JSON.stringify(buildSearchBody(regionId, page)),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseSearchResponse(await res.json());
}

await mkdir(OUT_DIR, { recursive: true });
let total = 0;

for (const city of CITIES) {
  const offers = new Map<string, Offer>();
  for (let page = 1; page <= PAGES; page++) {
    try {
      const batch = await fetchPage(city.id, page);
      batch.forEach((o) => offers.set(o.id, o));
      if (batch.length === 0) break;
    } catch (e) {
      console.warn(`[${city.name}] page ${page} failed: ${(e as Error).message}`);
      break;
    }
    await sleep(1500);
  }
  if (offers.size === 0) continue;
  const snapshot: Snapshot = { regionId: city.id, updatedAt: new Date().toISOString(), offers: [...offers.values()] };
  await writeFile(new URL(`${city.id}.json`, OUT_DIR), JSON.stringify(snapshot));
  console.log(`[${city.name}] saved ${offers.size} offers`);
  total += offers.size;
}

console.log(total ? `Done: ${total} offers` : 'No offers fetched; the site will use live/demo data');
