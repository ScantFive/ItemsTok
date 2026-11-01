import './style.css';
import { loadCatalog, loadOffers, type FeedPage, type FeedSource } from './api';
import { CITIES, DEFAULT_CITY, findCity } from './cities';
import { EMPTY_FILTERS, activeCount, describe, loadFilters, saveFilters, type Filters } from './filters';
import { FavoritesStore, loadCityId, saveCityId } from './storage';
import type { City, Offer } from './types';
import { fromHtml, h } from './ui/dom';
import { renderCard, syncLikeButtons } from './ui/card';
import { openFiltersPanel } from './ui/filters-panel';
import { FILTER } from './ui/icons';

type Tab = 'feed' | 'favorites';

const SOURCE_NOTES: Record<FeedSource, string> = {
  live: 'Свежие объявления с Циан',
  snapshot: 'Объявления Циан из последней выгрузки',
  demo: 'Для этого города ещё нет выгрузки с Циан — показаны демо-объявления',
};

function sourceNoteText(page: FeedPage): string {
  if (page.source !== 'snapshot' || !page.updatedAt) return SOURCE_NOTES[page.source];
  const date = new Date(page.updatedAt);
  if (Number.isNaN(date.getTime())) return SOURCE_NOTES.snapshot;
  const when = date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return `Объявления Циан, выгрузка от ${when}`;
}

const favorites = new FavoritesStore();
let city: City = findCity(loadCityId() ?? -1) ?? DEFAULT_CITY;
let tab: Tab = 'feed';
let filters: Filters = loadFilters(city.id);

// Feed state; `generation` discards responses that arrive after the city changed.
let generation = 0;
let page = 0;
let source: FeedSource | null = null;
let hasMore = true;
let loading = false;
const seen = new Set<string>();
const shown: Offer[] = [];

const citySelect = h(
  'select',
  { class: 'city', 'aria-label': 'Город' },
  ...CITIES.map((c) => h('option', { value: c.id, selected: c.id === city.id }, c.name)),
);
const filterBadge = h('span', { class: 'badge' });
const filterBtn = h('button', { class: 'filter-btn', type: 'button', 'aria-label': 'Фильтры' }, fromHtml(FILTER), 'Фильтры', filterBadge);
const header = h(
  'header',
  { class: 'topbar' },
  h('h1', { class: 'logo' }, 'ItemsTok'),
  h('div', { class: 'topbar__actions' }, filterBtn, citySelect),
);

const sourceNote = h('div', { class: 'note', hidden: true });
const summaryBtn = h('button', { class: 'summary', type: 'button', onclick: () => void openFilters() });
const filterSummary = h(
  'div',
  { class: 'filter-summary', hidden: true },
  summaryBtn,
  h('button', { class: 'link', type: 'button', onclick: () => applyFilters({ ...EMPTY_FILTERS, stations: [] }) }, 'Сбросить'),
);
const feedList = h('div', { class: 'list' });
const status = h('div', { class: 'status' });
const sentinel = h('div', { class: 'sentinel' });
const feedView = h('main', { class: 'view' }, sourceNote, filterSummary, feedList, status, sentinel);

const favList = h('div', { class: 'list' });
const favEmpty = h(
  'div',
  { class: 'empty' },
  h('p', {}, 'Здесь появятся понравившиеся квартиры.'),
  h('p', { class: 'muted' }, 'Нажмите ♥ или дважды коснитесь фото в ленте.'),
);
const favView = h('main', { class: 'view', hidden: true }, favEmpty, favList);

const feedTab = h('button', { class: 'tab', type: 'button', 'aria-current': 'page' }, 'Лента');
const favCount = h('span', { class: 'badge' });
const favTab = h('button', { class: 'tab', type: 'button' }, 'Избранное ', favCount);
const nav = h('nav', { class: 'tabbar' }, feedTab, favTab);

document.querySelector('#app')!.replaceChildren(header, feedView, favView, nav);

async function loadNextPage(): Promise<void> {
  if (loading || !hasMore) return;
  loading = true;
  const gen = generation;
  status.textContent = 'Загружаем квартиры…';
  try {
    const result = await loadOffers(city, page + 1, source, filters);
    if (gen !== generation) return;
    page += 1;
    source = result.source;
    hasMore = result.hasMore;
    sourceNote.textContent = sourceNoteText(result);
    sourceNote.dataset.source = result.source;
    sourceNote.hidden = false;
    for (const offer of result.offers) {
      if (seen.has(offer.id)) continue;
      seen.add(offer.id);
      shown.push(offer);
      feedList.append(renderCard(offer, favorites));
    }
    if (hasMore) status.textContent = '';
    else if (feedList.childElementCount) status.textContent = 'Это всё на сегодня';
    else if (activeCount(filters)) {
      status.replaceChildren(
        'По фильтрам ничего не нашлось. ',
        h('button', { class: 'link', type: 'button', onclick: () => void openFilters() }, 'Изменить фильтры'),
      );
    } else status.textContent = 'Объявлений не найдено';
  } catch (e) {
    if (gen !== generation) return;
    console.error(e);
    status.replaceChildren('Не удалось загрузить. ', h('button', { class: 'link', type: 'button', onclick: () => loadNextPage() }, 'Повторить'));
  } finally {
    if (gen === generation) loading = false;
  }
  // The sentinel may still be on screen (short page), so keep filling.
  if (gen === generation && hasMore && isNearBottom()) void loadNextPage();
}

function isNearBottom(): boolean {
  return !feedView.hidden && sentinel.getBoundingClientRect().top < window.innerHeight + 800;
}

function resetFeed(): void {
  generation += 1;
  page = 0;
  source = null;
  hasMore = true;
  loading = false;
  seen.clear();
  shown.length = 0;
  feedList.replaceChildren();
  renderFilterState();
  sourceNote.hidden = true;
  window.scrollTo({ top: 0 });
  void loadNextPage();
}

function renderFilterState(): void {
  const n = activeCount(filters);
  filterBadge.textContent = n ? String(n) : '';
  filterSummary.hidden = n === 0;
  summaryBtn.textContent = describe(filters);
}

function applyFilters(next: Filters): void {
  filters = next;
  saveFilters(city.id, filters);
  resetFeed();
}

async function openFilters(): Promise<void> {
  // The panel needs the full list to offer stations and live counts; with a live-only
  // source we only know what has been shown so far.
  const catalog = await loadCatalog(city);
  openFiltersPanel({ cityName: city.name, offers: catalog?.offers ?? shown, current: filters, onApply: applyFilters });
}

function updateFavCount(): void {
  const count = favorites.all().length;
  favCount.textContent = count ? String(count) : '';
  favEmpty.hidden = count > 0;
}

function renderFavorites(): void {
  updateFavCount();
  if (tab === 'favorites') favList.replaceChildren(...favorites.all().map((o) => renderCard(o, favorites)));
}

function setTab(next: Tab): void {
  tab = next;
  feedView.hidden = next !== 'feed';
  favView.hidden = next !== 'favorites';
  const [active, inactive] = next === 'feed' ? [feedTab, favTab] : [favTab, feedTab];
  active.setAttribute('aria-current', 'page');
  inactive.removeAttribute('aria-current');
  renderFavorites();
  window.scrollTo({ top: 0 });
}

citySelect.addEventListener('change', () => {
  city = findCity(Number(citySelect.value)) ?? DEFAULT_CITY;
  saveCityId(city.id);
  filters = loadFilters(city.id);
  setTab('feed');
  resetFeed();
});
filterBtn.addEventListener('click', () => {
  setTab('feed');
  void openFilters();
});
feedTab.addEventListener('click', () => setTab('feed'));
favTab.addEventListener('click', () => setTab('favorites'));

favorites.subscribe(() => {
  updateFavCount();
  // Re-rendering the favorites list on unlike would yank cards away mid-scroll,
  // so only buttons are synced; the list is rebuilt next time the tab opens.
  syncLikeButtons(feedList, favorites);
  syncLikeButtons(favList, favorites);
});

new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) void loadNextPage();
}, { rootMargin: '800px 0px' }).observe(sentinel);

renderFavorites();
resetFeed();
