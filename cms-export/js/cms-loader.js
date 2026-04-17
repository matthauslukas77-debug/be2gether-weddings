/* ═══════════════════════════════════════════════════
   CMS Loader — hydrates pages from JSON + localStorage
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  const page = document.body.dataset.cmsPage;
  if (!page) return;

  const STORAGE_KEY = 'cms_' + page;
  const SITE_KEY = 'cms_site';

  function get(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
  }

  function deepMerge(base, override) {
    if (override === undefined) return base;
    if (Array.isArray(override)) return override;
    if (base && override && typeof base === 'object' && typeof override === 'object') {
      const out = Array.isArray(base) ? base.slice() : { ...base };
      for (const k of Object.keys(override)) out[k] = deepMerge(base[k], override[k]);
      return out;
    }
    return override;
  }

  function applyBindings(root, data) {
    root.querySelectorAll('[data-cms]').forEach(el => {
      const v = get(data, el.dataset.cms);
      if (v != null) el.innerHTML = v;
    });
    root.querySelectorAll('[data-cms-text]').forEach(el => {
      const v = get(data, el.dataset.cmsText);
      if (v != null) el.textContent = v;
    });
    root.querySelectorAll('[data-cms-src]').forEach(el => {
      const v = get(data, el.dataset.cmsSrc);
      if (v) el.src = v;
    });
    root.querySelectorAll('[data-cms-href]').forEach(el => {
      const v = get(data, el.dataset.cmsHref);
      if (v) el.href = v;
    });
    root.querySelectorAll('[data-cms-alt]').forEach(el => {
      const v = get(data, el.dataset.cmsAlt);
      if (v) el.alt = v;
    });
    root.querySelectorAll('[data-cms-bg]').forEach(el => {
      const v = get(data, el.dataset.cmsBg);
      if (v) el.style.backgroundImage = `url('${v}')`;
    });
  }

  function applyMeta(data) {
    if (!data.meta) return;
    if (data.meta.title) document.title = data.meta.title;
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl && data.meta.description) descEl.setAttribute('content', data.meta.description);
  }

  async function loadJson(path) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) return {};
      return await res.json();
    } catch (e) {
      return {};
    }
  }

  async function init() {
    const [siteBase, pageBase] = await Promise.all([
      loadJson('data/site.json'),
      loadJson('data/' + page + '.json'),
    ]);

    let siteOverride = {};
    let pageOverride = {};
    try { siteOverride = JSON.parse(localStorage.getItem(SITE_KEY) || '{}'); } catch {}
    try { pageOverride = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch {}

    const site = deepMerge(siteBase, siteOverride);
    const pageData = deepMerge(pageBase, pageOverride);
    const data = { ...pageData, site };

    applyBindings(document, data);
    applyMeta(data);

    document.documentElement.classList.add('cms-ready');
    document.dispatchEvent(new CustomEvent('cms:ready', { detail: data }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
