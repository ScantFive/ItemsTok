import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesStore, loadCityId, saveCityId } from '../src/storage';
import { demoOffers } from '../src/demo';

const [a, b] = demoOffers({ id: 1, name: 'Москва' }, 1);

describe('FavoritesStore', () => {
  beforeEach(() => localStorage.clear());

  it('toggles and persists favorites across instances', () => {
    const store = new FavoritesStore();
    expect(store.toggle(a)).toBe(true);
    expect(store.toggle(b)).toBe(true);
    expect(store.all().map((o) => o.id)).toEqual([b.id, a.id]);

    const reloaded = new FavoritesStore();
    expect(reloaded.has(a.id)).toBe(true);
    expect(reloaded.toggle(a)).toBe(false);
    expect(new FavoritesStore().all().map((o) => o.id)).toEqual([b.id]);
  });

  it('notifies subscribers', () => {
    const store = new FavoritesStore();
    const fn = vi.fn();
    store.subscribe(fn);
    store.toggle(a);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('survives corrupted storage', () => {
    localStorage.setItem('itemstok:favorites', '{broken');
    expect(new FavoritesStore().all()).toEqual([]);
  });
});

describe('city persistence', () => {
  beforeEach(() => localStorage.clear());

  it('saves and loads the selected city', () => {
    expect(loadCityId()).toBeNull();
    saveCityId(4777);
    expect(loadCityId()).toBe(4777);
  });
});
