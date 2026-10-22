import type { Offer } from './types';

const rub = new Intl.NumberFormat('ru-RU');

export function formatPrice(price: number): string {
  return `${rub.format(price)} ₽/мес`;
}

export function formatTitle(o: Offer): string {
  const rooms = o.rooms === null ? 'Квартира' : o.rooms === 0 ? 'Студия' : `${o.rooms}-комн. квартира`;
  const parts = [rooms];
  if (o.area !== null) parts.push(`${o.area} м²`);
  if (o.floor !== null) parts.push(o.floorsTotal !== null ? `${o.floor}/${o.floorsTotal} эт.` : `${o.floor} эт.`);
  return parts.join(' · ');
}

export function formatMetro(o: Offer): string {
  if (!o.metro) return '';
  const { name, minutes, onFoot } = o.metro;
  if (minutes === null) return `м. ${name}`;
  return `м. ${name} · ${minutes} мин ${onFoot ? 'пешком' : 'на транспорте'}`;
}

export function formatAge(ts: number | null, now = Date.now()): string {
  if (ts === null) return '';
  const minutes = Math.max(0, Math.round((now - ts) / 60000));
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  return `${days} дн назад`;
}
