import { formatAge, formatMetro, formatPrice, formatTitle } from '../format';
import type { FavoritesStore } from '../storage';
import type { Offer } from '../types';
import { fromHtml, h } from './dom';
import { EXTERNAL, HEART, HOME, PIN } from './icons';

const FALLBACK_PHOTO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#d9d9de"/></svg>`,
  );

function carousel(offer: Offer, onDoubleTap: () => void): HTMLElement {
  const photos = offer.photos.length > 0 ? offer.photos : [FALLBACK_PHOTO];
  const track = h('div', { class: 'carousel__track' });
  photos.forEach((src, i) => {
    const img = h('img', {
      src,
      alt: `Фото ${i + 1}`,
      loading: i === 0 ? 'eager' : 'lazy',
      decoding: 'async',
      referrerpolicy: 'no-referrer',
      draggable: 'false',
    });
    img.addEventListener('error', () => img.setAttribute('src', FALLBACK_PHOTO), { once: true });
    track.append(img);
  });

  const counter = h('div', { class: 'carousel__counter' }, `1/${photos.length}`);
  const dots = h('div', { class: 'carousel__dots' }, ...photos.map((_, i) => h('span', { class: i === 0 ? 'on' : '' })));
  const burst = h('div', { class: 'carousel__burst' }, fromHtml(HEART));

  track.addEventListener(
    'scroll',
    () => {
      const index = Math.round(track.scrollLeft / track.clientWidth);
      counter.textContent = `${index + 1}/${photos.length}`;
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === index));
    },
    { passive: true },
  );

  // Instagram-style double tap: our own detection works on touch devices where dblclick is unreliable.
  let lastTap = 0;
  track.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    const now = Date.now();
    if (now - lastTap < 300) {
      fire();
      lastTap = 0;
    } else {
      lastTap = now;
    }
  });
  track.addEventListener('dblclick', fire);
  function fire() {
    onDoubleTap();
    burst.classList.remove('show');
    void burst.offsetWidth; // restart the animation
    burst.classList.add('show');
  }

  const root = h('div', { class: 'carousel' }, track, burst);
  if (photos.length > 1) root.append(counter, dots);
  return root;
}

export function renderCard(offer: Offer, favorites: FavoritesStore): HTMLElement {
  const likeBtn = h('button', {
    class: 'icon-btn like',
    type: 'button',
    'data-like': offer.id,
    'aria-label': 'В избранное',
    'aria-pressed': String(favorites.has(offer.id)),
    onclick: () => favorites.toggle(offer),
  });
  likeBtn.append(fromHtml(HEART));

  const metro = formatMetro(offer);
  const description = h('span', { class: 'post__text' }, offer.description);
  const caption = h('p', { class: 'post__caption clamped' }, description);
  if (offer.description.length > 120) {
    const more = h('button', { class: 'more', type: 'button' }, 'ещё');
    more.addEventListener('click', () => {
      caption.classList.remove('clamped');
      more.remove();
    });
    caption.append(' ', more);
  }

  const openLink = h('a', {
    class: 'icon-btn',
    href: offer.url,
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-label': 'Открыть на Циан',
    title: 'Открыть на Циан',
  });
  openLink.append(fromHtml(EXTERNAL));

  return h(
    'article',
    { class: 'post', 'data-id': offer.id },
    h(
      'header',
      { class: 'post__head' },
      h('div', { class: 'avatar' }, fromHtml(HOME)),
      h(
        'div',
        { class: 'post__meta' },
        h('div', { class: 'post__title' }, formatTitle(offer)),
        metro ? h('div', { class: 'post__sub' }, metro) : null,
      ),
    ),
    carousel(offer, () => {
      if (!favorites.has(offer.id)) favorites.toggle(offer);
    }),
    h('div', { class: 'post__actions' }, likeBtn, openLink),
    h('div', { class: 'post__price' }, formatPrice(offer.price)),
    offer.address ? h('div', { class: 'post__address' }, fromHtml(PIN), offer.address) : null,
    offer.description ? caption : null,
    offer.publishedAt ? h('time', { class: 'post__time' }, formatAge(offer.publishedAt)) : null,
  );
}

/** Keeps every like button on the page in sync with the store. */
export function syncLikeButtons(root: ParentNode, favorites: FavoritesStore): void {
  root.querySelectorAll<HTMLButtonElement>('[data-like]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(favorites.has(btn.dataset.like!)));
  });
}
