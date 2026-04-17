/* ═══════════════════════════════════════════════════
   CMS Loader — hydrates pages from JSON + Supabase overrides
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  const page = document.body.dataset.cmsPage;
  if (!page) return;

  const cfg = window.CMS_CONFIG;
  const sb = (cfg && window.supabase)
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    : null;

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

  // Render <template> blocks for arrays so the user can add unlimited items.
  // Markup pattern:
  //   <div data-cms-each="gallery">
  //     <template><img data-cms-src="image" data-cms-alt="alt"></template>
  //     ... existing static items get removed before re-render ...
  //   </div>
  function processArrays(root, data) {
    root.querySelectorAll('[data-cms-each]').forEach(container => {
      const path = container.dataset.cmsEach;
      const arr = get(data, path);
      if (!Array.isArray(arr)) return;
      const tpl = container.querySelector(':scope > template');
      if (!tpl) return;
      // Strip everything except the <template> itself.
      Array.from(container.children).forEach(c => { if (c.tagName !== 'TEMPLATE') c.remove(); });
      arr.forEach(item => {
        const frag = tpl.content.cloneNode(true);
        applyBindings(frag, item);
        container.appendChild(frag);
      });
    });
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

  async function loadOverrides() {
    if (!sb) return { site: {}, page: {} };
    try {
      const { data, error } = await sb
        .from(cfg.table)
        .select('page_id, data')
        .in('page_id', ['site', page]);
      if (error) return { site: {}, page: {} };
      const map = {};
      for (const row of data || []) map[row.page_id] = row.data || {};
      return { site: map.site || {}, page: map[page] || {} };
    } catch (e) {
      return { site: {}, page: {} };
    }
  }

  async function init() {
    const [siteBase, pageBase, overrides] = await Promise.all([
      loadJson('data/site.json'),
      loadJson('data/' + page + '.json'),
      loadOverrides(),
    ]);

    const site = deepMerge(siteBase, overrides.site);
    const pageData = deepMerge(pageBase, overrides.page);
    const data = { ...pageData, site };

    processArrays(document, data);
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
