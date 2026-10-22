# ItemsTok

Лента объявлений об аренде квартир с [Циан](https://www.cian.ru) в стиле Instagram.
TypeScript + Vite, без фреймворков.

- лента карточек с каруселью фото, бесконечная прокрутка;
- ♥ или двойной тап по фото — добавить в избранное;
- выбор города (запоминается);
- избранное хранится локально в `localStorage` браузера (целиком, вместе с данными объявления).

## Откуда берутся объявления

У Циан нет публичного API и CORS-заголовков, поэтому статический сайт на GitHub Pages
не может ходить к нему напрямую. Приложение пробует источники по очереди:

1. **Живой запрос** к Циан через собственный прокси на Cloudflare Workers (`worker/`, см. ниже),
   если задан `VITE_CIAN_API`; иначе через публичный CORS-прокси `corsproxy.io`
   (или свой: `VITE_CORS_PROXY="https://my-proxy/?url="`).
2. **Снимок** `data/<id региона>.json`, который GitHub Action выгружает с Циан при каждом
   деплое и по расписанию раз в 6 часов (`npm run fetch:cian`).
3. **Демо-данные** — если Циан недоступен совсем, чтобы ленту всё равно можно было посмотреть.

Над лентой показывается, какой источник сработал.

## Запуск локально

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # юнит-тесты
npm run fetch:cian   # (необязательно) выгрузить снимок Циан в public/data
npm run build        # сборка в dist/
```

## GitHub Pages

Workflow `.github/workflows/deploy.yml` на каждый пуш (и раз в 6 часов) запускает тесты,
выгружает снимок Циан (ошибка не ломает сборку), собирает проект и публикует `dist/` в ветку `gh-pages`.

Один раз в репозитории: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
ветка **`gh-pages`**, папка **`/ (root)`**. Сайт: `https://<владелец>.github.io/<репозиторий>/`.

Публиковать саму ветку с исходниками нельзя — там несобранный TypeScript, и страница будет пустой.

## Прокси для Циан (Cloudflare Worker)

`worker/index.ts` — узкий прокси: `GET /search?region=1&page=1` → `{ offers: [...] }`.
Он ходит только в поиск аренды Циан, разбирает ответ, кэширует его на 10 минут и отвечает
браузеру только с сайтов из `ALLOWED_ORIGINS` (`worker/wrangler.toml`). Бесплатного тарифа Cloudflare
(100 000 запросов в день) хватает с запасом.

Развернуть через GitHub Actions (ничего не ставя локально):

1. Зарегистрироваться на [dash.cloudflare.com](https://dash.cloudflare.com) (бесплатно).
2. **Account ID**: Workers & Pages → справа в панели «Account ID».
3. **API token**: My Profile → API Tokens → Create Token → шаблон «Edit Cloudflare Workers».
4. В репозитории GitHub: Settings → Secrets and variables → Actions → **Secrets**:
   `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID`.
5. Actions → «Deploy CIAN proxy (Cloudflare Worker)» → Run workflow. В логе будет адрес вида
   `https://itemstok-cian.<ваш-поддомен>.workers.dev`.
6. Settings → Secrets and variables → Actions → **Variables**: `CIAN_API_URL` = этот адрес.
7. Перезапустить «Deploy to GitHub Pages» — сайт и выгрузка снимка начнут ходить через прокси.

Проверка: откройте `https://itemstok-cian.<поддомен>.workers.dev/search?region=1` — должен прийти
JSON с `offers`. Ошибка `cian_blocked` значит, что Циан не пускает и Cloudflare — тогда остаются демо-данные.

Локально: `cd worker && npx wrangler login && npx wrangler deploy`, а для разработки
`npx wrangler dev` и `VITE_CIAN_API=http://localhost:8787 npm run dev`.
