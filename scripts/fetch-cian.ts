/**
 * Downloads CIAN rent offers into public/data/<regionId>.json for the static site.
 * Meant to run on the owner's computer (CIAN challenges datacenter IPs with a captcha);
 * `npm run update-data` runs it and publishes the result.
 *
 * Cities that fail keep their previous file. If CIAN asks for a captcha the run stops
 * right away instead of retrying.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { CITIES } from '../src/cities.ts';
import { CianBlockedError, fetchCianDirect, fetchViaApi } from '../src/cian/client.ts';
import type { Offer, Snapshot } from '../src/types.ts';

const PAGES = Number(process.env.CIAN_PAGES ?? 3);
const DELAY_MS = 2000;
const OUT_DIR = new URL('../public/data/', import.meta.url);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const API = process.env.CIAN_API_URL;
const fetchPage = (regionId: number, page: number): Promise<Offer[]> =>
  API ? fetchViaApi(API, regionId, page, 20000) : fetchCianDirect(regionId, page, 20000);

await mkdir(OUT_DIR, { recursive: true });
let saved = 0;
let blocked = false;

for (const city of CITIES) {
  if (blocked) break;
  const offers = new Map<string, Offer>();
  for (let page = 1; page <= PAGES; page++) {
    try {
      const batch = await fetchPage(city.id, page);
      batch.forEach((o) => offers.set(o.id, o));
      if (batch.length === 0) break;
    } catch (e) {
      if (e instanceof CianBlockedError) {
        console.warn(`[${city.name}] Циан попросил капчу — останавливаемся. Попробуйте позже.`);
        blocked = true;
      } else {
        console.warn(`[${city.name}] страница ${page}: ошибка — ${(e as Error).message}`);
      }
      break;
    }
    await sleep(DELAY_MS);
  }
  if (offers.size === 0) {
    console.warn(`[${city.name}] объявлений нет, оставляем прежнюю выгрузку`);
    continue;
  }
  const snapshot: Snapshot = { regionId: city.id, updatedAt: new Date().toISOString(), offers: [...offers.values()] };
  await writeFile(new URL(`${city.id}.json`, OUT_DIR), JSON.stringify(snapshot));
  console.log(`[${city.name}] сохранено объявлений: ${offers.size}`);
  saved++;
}

console.log(saved ? `Готово: обновлено городов — ${saved} из ${CITIES.length}` : 'Ничего не скачано.');
process.exitCode = saved ? 0 : 1;
