import { EMPTY_FILTERS, matches, stationCounts, type Filters } from '../filters';
import type { Offer } from '../types';
import { h } from './dom';

const PRICE_PRESETS = [50000, 80000, 120000];
const WALK_OPTIONS = [5, 10, 15, 20];
const rub = new Intl.NumberFormat('ru-RU');

const parsePrice = (value: string): number | null => {
  const n = Number(value.replace(/\D/g, ''));
  return value.trim() === '' || !Number.isFinite(n) ? null : n;
};

/**
 * Bottom sheet with price, metro and walking-time filters. Works on a draft copy;
 * `onApply` gets the result only when the user confirms.
 */
export function openFiltersPanel(opts: {
  cityName: string;
  offers: Offer[];
  current: Filters;
  onApply: (f: Filters) => void;
}): void {
  const draft: Filters = { ...opts.current, stations: [...opts.current.stations] };
  const allStations = stationCounts(opts.offers).map(([name]) => name);

  const minInput = h('input', { class: 'field', inputmode: 'numeric', placeholder: 'от', 'aria-label': 'Цена от' });
  const maxInput = h('input', { class: 'field', inputmode: 'numeric', placeholder: 'до', 'aria-label': 'Цена до' });
  const fmt = (n: number | null) => (n === null ? '' : rub.format(n));
  minInput.value = fmt(draft.priceMin);
  maxInput.value = fmt(draft.priceMax);
  const onPriceInput = () => {
    draft.priceMin = parsePrice(minInput.value);
    draft.priceMax = parsePrice(maxInput.value);
    refresh();
  };
  minInput.addEventListener('input', onPriceInput);
  maxInput.addEventListener('input', onPriceInput);
  // Reformat with thousands separators once the user leaves the field.
  [minInput, maxInput].forEach((el) => el.addEventListener('blur', () => (el.value = fmt(parsePrice(el.value)))));

  const presets = h(
    'div',
    { class: 'chips' },
    ...PRICE_PRESETS.map((p) =>
      h('button', {
        class: 'chip',
        type: 'button',
        onclick: () => {
          draft.priceMin = null;
          draft.priceMax = p;
          minInput.value = '';
          maxInput.value = fmt(p);
          refresh();
        },
      }, `до ${p / 1000} тыс.`),
    ),
  );

  const walkSelect = h(
    'select',
    { class: 'field', 'aria-label': 'Пешком до метро' },
    h('option', { value: '' }, 'не важно'),
    ...WALK_OPTIONS.map((m) => h('option', { value: m, selected: draft.maxWalk === m }, `не дальше ${m} мин`)),
  );
  walkSelect.addEventListener('change', () => {
    draft.maxWalk = walkSelect.value ? Number(walkSelect.value) : null;
    refresh();
  });

  const search = h('input', { class: 'field', type: 'search', placeholder: 'Найти станцию', 'aria-label': 'Найти станцию' });
  const selectedChips = h('div', { class: 'chips' });
  const stationList = h('div', { class: 'stations' });
  search.addEventListener('input', renderStations);

  function toggleStation(name: string, on: boolean) {
    draft.stations = on ? [...draft.stations, name] : draft.stations.filter((s) => s !== name);
    refresh();
  }

  function renderStations() {
    // Counts reflect the price and walking filters, so a station shows how many offers it would add.
    const counts = new Map(stationCounts(opts.offers.filter((o) => matches(o, { ...draft, stations: [] }))));
    const q = search.value.trim().toLowerCase().replace(/ё/g, 'е');
    const visible = allStations.filter((name) => name.toLowerCase().replace(/ё/g, 'е').includes(q));
    stationList.replaceChildren(
      ...(visible.length
        ? visible.map((name) => {
            const count = counts.get(name) ?? 0;
            const box = h('input', { type: 'checkbox', checked: draft.stations.includes(name) });
            box.addEventListener('change', () => toggleStation(name, box.checked));
            return h(
              'label',
              { class: count ? 'station' : 'station station--none' },
              box,
              h('span', {}, name),
              h('span', { class: 'muted' }, String(count)),
            );
          })
        : [h('p', { class: 'muted' }, allStations.length ? 'Станция не найдена' : 'В объявлениях нет данных о метро')]),
    );
  }

  const applyBtn = h('button', { class: 'btn primary', type: 'button' });
  const resetBtn = h('button', {
    class: 'btn',
    type: 'button',
    onclick: () => {
      Object.assign(draft, { ...EMPTY_FILTERS, stations: [] });
      minInput.value = maxInput.value = search.value = '';
      walkSelect.value = '';
      refresh();
    },
  }, 'Сбросить');

  function refresh() {
    selectedChips.replaceChildren(
      ...draft.stations.map((name) =>
        h('button', { class: 'chip on', type: 'button', onclick: () => toggleStation(name, false) }, `${name} ✕`),
      ),
    );
    renderStations();
    const n = opts.offers.filter((o) => matches(o, draft)).length;
    applyBtn.textContent = n ? `Показать ${n}` : 'Ничего не найдено';
    applyBtn.disabled = n === 0;
  }

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('no-scroll');
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  applyBtn.addEventListener('click', () => {
    if (draft.priceMin !== null && draft.priceMax !== null && draft.priceMin > draft.priceMax) {
      [draft.priceMin, draft.priceMax] = [draft.priceMax, draft.priceMin];
    }
    close();
    opts.onApply(draft);
  });

  const sheet = h(
    'div',
    { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Фильтры' },
    h(
      'div',
      { class: 'sheet__head' },
      h('h2', {}, `Фильтры · ${opts.cityName}`),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Закрыть', onclick: close }, '✕'),
    ),
    h(
      'div',
      { class: 'sheet__body' },
      h('h3', {}, 'Цена, ₽ в месяц'),
      h('div', { class: 'row' }, minInput, h('span', { class: 'muted' }, '—'), maxInput),
      presets,
      h('h3', {}, 'Пешком до метро'),
      walkSelect,
      h('h3', {}, 'Метро'),
      h('p', { class: 'muted hint' }, 'Число — сколько объявлений подходит с учётом цены и времени до метро.'),
      search,
      selectedChips,
      stationList,
    ),
    h('div', { class: 'sheet__foot' }, resetBtn, applyBtn),
  );
  const overlay = h('div', { class: 'overlay' }, sheet);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  document.addEventListener('keydown', onKey);
  document.body.classList.add('no-scroll');
  document.body.append(overlay);
  refresh();
}
