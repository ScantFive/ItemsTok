/**
 * Imports files saved by the "ItemsTok: сохранить" bookmarklet (see export.html),
 * writes public/data/<regionId>.json, commits and pushes so GitHub Pages rebuilds.
 *
 *   npm run import-data                      # looks in ~/Downloads
 *   npm run import-data -- path/to/files...  # files or folders
 *   npm run import-data -- --no-push
 *
 * Per city only the latest export session is used (files saved within 3 hours of the
 * newest one), so old downloads don't mix into fresh data.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { CITIES } from '../src/cities.ts';
import { parseOffer } from '../src/cian/parse.ts';
import type { Offer, Snapshot } from '../src/types.ts';

const SESSION_MS = 3 * 60 * 60 * 1000;
const OUT_DIR = new URL('../public/data/', import.meta.url);

interface ExportFile {
  path: string;
  regionId: number | null;
  page: number;
  exportedAt: number;
  offers: unknown[];
}

async function collectPaths(inputs: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const input of inputs) {
    const path = resolve(input);
    if (!existsSync(path)) {
      console.warn(`Не найдено: ${path}`);
      continue;
    }
    if ((await stat(path)).isDirectory()) {
      for (const name of await readdir(path)) {
        if (/^itemstok-.*\.json$/.test(name)) out.push(join(path, name));
      }
    } else {
      out.push(path);
    }
  }
  return out;
}

async function readExport(path: string): Promise<ExportFile | null> {
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    if (data?.format !== 'itemstok-export' || !Array.isArray(data.offers)) return null;
    return {
      path,
      regionId: typeof data.regionId === 'number' ? data.regionId : null,
      page: Number(data.page) || 1,
      exportedAt: Date.parse(data.exportedAt) || 0,
      offers: data.offers,
    };
  } catch {
    return null;
  }
}

function run(cmd: string, args: string[], allowFail = false): number {
  const code = spawnSync(cmd, args, { stdio: 'inherit' }).status ?? 1;
  if (code !== 0 && !allowFail) {
    console.error(`\nКоманда не выполнилась: ${cmd} ${args.join(' ')}`);
    process.exit(code);
  }
  return code;
}

const args = process.argv.slice(2);
const noPush = args.includes('--no-push');
const inputs = args.filter((a) => !a.startsWith('--'));
if (inputs.length === 0) inputs.push(join(homedir(), 'Downloads'));

const exports = (await Promise.all((await collectPaths(inputs)).map(readExport))).filter(
  (e): e is ExportFile => e !== null,
);
if (exports.length === 0) {
  console.error(`Не найдено файлов itemstok-*.json в: ${inputs.join(', ')}`);
  console.error('Сохраните объявления закладкой «ItemsTok: сохранить» или укажите путь к файлам.');
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
let written = 0;

for (const city of CITIES) {
  const files = exports.filter((e) => e.regionId === city.id);
  if (files.length === 0) {
    console.log(`[${city.name}] файлов нет — оставляем прежние данные`);
    continue;
  }
  const latest = Math.max(...files.map((f) => f.exportedAt));
  const session = files.filter((f) => latest - f.exportedAt <= SESSION_MS).sort((a, b) => a.page - b.page);

  const offers = new Map<string, Offer>();
  for (const file of session) {
    for (const raw of file.offers) {
      const offer = parseOffer(raw);
      if (offer && !offers.has(offer.id)) offers.set(offer.id, offer);
    }
  }
  if (offers.size === 0) {
    console.warn(`[${city.name}] в файлах не удалось разобрать ни одного объявления — пропускаем`);
    continue;
  }
  const snapshot: Snapshot = {
    regionId: city.id,
    updatedAt: new Date(latest || Date.now()).toISOString(),
    offers: [...offers.values()],
  };
  await writeFile(new URL(`${city.id}.json`, OUT_DIR), JSON.stringify(snapshot));
  const pages = [...new Set(session.map((f) => f.page))].join(', ');
  console.log(`[${city.name}] объявлений: ${offers.size} (страницы ${pages}, файлов: ${session.length})`);
  written++;
}

const unknown = exports.filter((e) => !CITIES.some((c) => c.id === e.regionId));
if (unknown.length) console.warn(`Пропущено файлов других городов: ${unknown.length}`);
if (written === 0) {
  console.error('Нечего сохранять.');
  process.exit(1);
}

run('git', ['add', 'public/data']);
// `git diff --cached --quiet` exits 1 when something is staged.
if (run('git', ['diff', '--cached', '--quiet', '--', 'public/data'], true) === 0) {
  console.log('\nДанные не изменились — отправлять нечего.');
  process.exit(0);
}
run('git', ['commit', '-m', 'Update CIAN offers from browser export', '--', 'public/data']);
if (noPush) {
  console.log('\nЗакоммичено. Отправьте на GitHub командой: git push');
} else {
  run('git', ['push']);
  console.log('\nОтправлено. Сайт обновится через 1–2 минуты (вкладка Actions → Deploy to GitHub Pages).');
}
