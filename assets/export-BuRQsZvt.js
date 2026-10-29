import"./style-5DzNpTjs.js";var e=`javascript:`+encodeURIComponent(`/*
 * ItemsTok bookmarklet: run on a CIAN rent search page the user has open in their own browser.
 * It saves the offers that page already shows to a JSON file; nothing is requested from CIAN.
 * Import the files with \`npm run import-data\`.
 * Plain ES2017 without line comments, because it ends up in a javascript: URL.
 */
(function () {
  var MAX_DEPTH = 14;

  function isOffer(v) {
    return v && typeof v === 'object' && 'cianId' in v && 'bargainTerms' in v;
  }

  function walk(node, depth, seen, test) {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || seen.has(node)) return null;
    seen.add(node);
    if (test(node)) return node;
    var values = Array.isArray(node) ? node : Object.keys(node).map(function (k) {
      try { return node[k]; } catch (e) { return null; }
    });
    for (var i = 0; i < values.length; i++) {
      var found = walk(values[i], depth + 1, seen, test);
      if (found) return found;
    }
    return null;
  }

  function find(test) {
    var roots = [window._cianConfig, window.__INITIAL_STATE__, window.__NEXT_DATA__];
    for (var i = 0; i < roots.length; i++) {
      var found = walk(roots[i], 0, new Set(), test);
      if (found) return found;
    }
    return null;
  }

  if (!/(^|\\.)cian\\.ru$/.test(location.hostname)) {
    alert('ItemsTok: откройте поиск аренды квартир на cian.ru и нажмите закладку там.');
    return;
  }

  var offers = find(function (v) { return Array.isArray(v) && v.length > 0 && v.every(isOffer); });
  if (!offers) {
    alert('ItemsTok: на этой странице не нашлось объявлений. Откройте список объявлений (поиск аренды), а не карточку квартиры.');
    return;
  }

  var holder = find(function (v) { return !Array.isArray(v) && v.jsonQuery && typeof v.jsonQuery === 'object'; });
  var query = holder ? holder.jsonQuery : {};
  var params = new URLSearchParams(location.search);
  var term = function (q, key) { return q[key] && q[key].value; };
  var regionValue = term(query, 'region');
  var regionId = Number(Array.isArray(regionValue) ? regionValue[0] : regionValue) || Number(params.get('region')) || null;
  var page = Number(term(query, 'page')) || Number(params.get('p')) || 1;
  var type = query._type || null;

  if (type && type !== 'flatrent') {
    if (!confirm('ItemsTok: похоже, это не аренда квартир (' + type + '). Всё равно сохранить?')) return;
  }

  var data = {
    format: 'itemstok-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    url: location.href,
    regionId: regionId,
    page: page,
    type: type,
    offers: offers,
  };
  var name = 'itemstok-' + (regionId || 'unknown') + '-p' + page + '-' + Date.now() + '.json';
  var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  alert('ItemsTok: сохранено объявлений — ' + offers.length + ' (страница ' + page + '). Файл: ' + name);
})();
`.replace(/\/\*[\s\S]*?\*\//g,``).trim()),t=document.querySelector(`#bookmarklet`),n=document.querySelector(`#code`);t.href=e,t.addEventListener(`click`,e=>{e.preventDefault(),alert(`Эту кнопку нужно перетащить на панель закладок, а затем нажимать на странице поиска Циан.`)}),n.value=e,document.querySelector(`#copy`).addEventListener(`click`,async()=>{n.select();try{await navigator.clipboard.writeText(e)}catch{document.execCommand(`copy`)}});