/**
 * Pre-fetches CIAN rent offers into public/data/<regionId>.json.
 * Runs in CI before the GitHub Pages build so the static site has data even when
 * the browser cannot reach CIAN. Failures are logged but never fail the build:
 * the app then falls back to demo data.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { CITIES } from '../src/cities.ts';
import { fetchCianDirect, fetchViaApi } from '../src/cian/client.ts';
import type { Offer, Snapshot } from '../src/types.ts';

const PAGES = Number(process.env.CIAN_PAGES ?? 3);
const OUT_DIR = new URL('../public/data/', import.meta.url);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// When the proxy worker is deployed, go through it: CIAN blocks GitHub runners directly.
const API = process.env.CIAN_API_URL;
const fetchPage = (regionId: number, page: number): Promise<Offer[]> =>
  API ? fetchViaApi(API, regionId, page, 20000) : fetchCianDirect(regionId, page, 20000);

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
