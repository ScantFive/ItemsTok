import './style.css';
import { loadOffers, type FeedSource } from './api';
import { CITIES, DEFAULT_CITY, findCity } from './cities';
import { FavoritesStore, loadCityId, saveCityId } from './storage';
import type { City } from './types';
import { h } from './ui/dom';
import { renderCard, syncLikeButtons } from './ui/card';

type Tab = 'feed' | 'favorites';

const SOURCE_NOTES: Record<FeedSource, string> = {
  live: 'Свежие объявления с Циан',
  snapshot: 'Объявления Циан из последней выгрузки',
  demo: 'Циан сейчас недоступен — показаны демо-объявления',
};

const favorites = new FavoritesStore();
let city: City = findCity(loadCityId() ?? -1) ?? DEFAULT_CITY;
let tab: Tab = 'feed';

// Feed state; `generation` discards responses that arrive after the city changed.
let generation = 0;
let page = 0;
let source: FeedSource | null = null;
let hasMore = true;
let loading = false;
const seen = new Set<string>();

const citySelect = h(
  'select',
  { class: 'city', 'aria-label': 'Город' },
  ...CITIES.map((c) => h('option', { value: c.id, selected: c.id === city.id }, c.name)),
);
const header = h('header', { class: 'topbar' }, h('h1', { class: 'logo' }, 'ItemsTok'), citySelect);

const sourceNote = h('div', { class: 'note', hidden: true });
const feedList = h('div', { class: 'list' });
const status = h('div', { class: 'status' });
const sentinel = h('div', { class: 'sentinel' });
const feedView = h('main', { class: 'view' }, sourceNote, feedList, status, sentinel);

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
    const result = await loadOffers(city, page + 1, source);
    if (gen !== generation) return;
    page += 1;
    source = result.source;
    hasMore = result.hasMore;
    sourceNote.textContent = SOURCE_NOTES[result.source];
    sourceNote.dataset.source = result.source;
    sourceNote.hidden = false;
    for (const offer of result.offers) {
      if (seen.has(offer.id)) continue;
      seen.add(offer.id);
      feedList.append(renderCard(offer, favorites));
    }
    status.textContent = hasMore ? '' : feedList.childElementCount ? 'Это всё на сегодня' : 'Объявлений не найдено';
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
  feedList.replaceChildren();
  sourceNote.hidden = true;
  window.scrollTo({ top: 0 });
  void loadNextPage();
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
  setTab('feed');
  resetFeed();
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
