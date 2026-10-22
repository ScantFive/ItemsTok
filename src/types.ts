export interface Metro {
  name: string;
  minutes: number | null;
  onFoot: boolean;
}

export type OfferSource = 'cian' | 'demo';

export interface Offer {
  id: string;
  url: string;
  photos: string[];
  /** Monthly rent in rubles. */
  price: number;
  /** 0 = studio, null = unknown. */
  rooms: number | null;
  area: number | null;
  floor: number | null;
  floorsTotal: number | null;
  address: string;
  metro: Metro | null;
  description: string;
  publishedAt: number | null;
  source: OfferSource;
}

export interface City {
  /** CIAN region id. */
  id: number;
  name: string;
}

export interface OffersPage {
  offers: Offer[];
  hasMore: boolean;
}

export interface Snapshot {
  regionId: number;
  updatedAt: string;
  offers: Offer[];
}
