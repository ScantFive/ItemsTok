import './style.css';
import source from './bookmarklet/export.js?raw';

const href = 'javascript:' + encodeURIComponent(source.replace(/\/\*[\s\S]*?\*\//g, '').trim());

const link = document.querySelector<HTMLAnchorElement>('#bookmarklet')!;
const code = document.querySelector<HTMLTextAreaElement>('#code')!;
link.href = href;
link.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Эту кнопку нужно перетащить на панель закладок, а затем нажимать на странице поиска Циан.');
});
code.value = href;
document.querySelector('#copy')!.addEventListener('click', async () => {
  code.select();
  try {
    await navigator.clipboard.writeText(href);
  } catch {
    document.execCommand('copy');
  }
});
