import type { Offer } from './types';

const FAVORITES_KEY = 'itemstok:favorites';
const CITY_KEY = 'itemstok:city';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or disabled (private mode); favorites then live for the session only.
  }
}

/**
 * Favorites are stored as full offer copies so the favorites tab works
 * even when the offer is no longer in the feed.
 */
export class FavoritesStore {
  private items: Offer[];
  private listeners = new Set<() => void>();

  constructor() {
    const stored = read<unknown>(FAVORITES_KEY, []);
    this.items = Array.isArray(stored) ? (stored as Offer[]) : [];
  }

  all(): Offer[] {
    return [...this.items];
  }

  has(id: string): boolean {
    return this.items.some((o) => o.id === id);
  }

  toggle(offer: Offer): boolean {
    const liked = !this.has(offer.id);
    this.items = liked ? [offer, ...this.items] : this.items.filter((o) => o.id !== offer.id);
    write(FAVORITES_KEY, this.items);
    this.listeners.forEach((fn) => fn());
    return liked;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function loadCityId(): number | null {
  const id = read<unknown>(CITY_KEY, null);
  return typeof id === 'number' ? id : null;
}

export function saveCityId(id: number): void {
  write(CITY_KEY, id);
}
