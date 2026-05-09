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

  function deepMerge(base, override, key) {
    if (override === undefined) return base;
    // Galleries are JSON-authoritative — Supabase override of the gallery list
    // would otherwise replace the full list with whatever is stored.
    if (key === 'gallery' && Array.isArray(base)) return base;
    if (Array.isArray(override)) return override;
    if (base && override && typeof base === 'object' && typeof override === 'object') {
      const out = Array.isArray(base) ? base.slice() : { ...base };
      for (const k of Object.keys(override)) out[k] = deepMerge(base[k], override[k], k);
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
        // Skip items flagged as hidden — used for staged content (e.g. a service
        // slot that's prepared in CMS but not yet ready to go live).
        if (item && item.hidden === true) return;
        const frag = tpl.content.cloneNode(true);
        applyBindings(frag, item);
        container.appendChild(frag);
      });
    });
  }

  // When applyBindings runs on the whole document, skip anything inside a
  // [data-cms-each] container — those bindings are item-scoped and were
  // already resolved per-item by processArrays.
  function inEachScope(el) {
    return typeof el.closest === 'function' && el.closest('[data-cms-each]') !== null;
  }

  function applyBindings(root, data, opts) {
    const skipEach = opts?.skipEach;
    function each(sel, fn) {
      root.querySelectorAll(sel).forEach(el => {
        if (skipEach && inEachScope(el)) return;
        fn(el);
      });
    }
    each('[data-cms]', el => {
      const v = get(data, el.dataset.cms);
      if (v != null) el.innerHTML = v;
    });
    each('[data-cms-text]', el => {
      const v = get(data, el.dataset.cmsText);
      if (v != null) el.textContent = v;
    });
    each('[data-cms-src]', el => {
      const v = get(data, el.dataset.cmsSrc);
      if (v) el.src = v;
    });
    each('[data-cms-href]', el => {
      const v = get(data, el.dataset.cmsHref);
      if (v) el.href = v;
    });
    // Template href: data-cms-href-tpl="blog/post.html?slug={slug}" — {key}
    // tokens get replaced with values from the current data scope.
    each('[data-cms-href-tpl]', el => {
      const tpl = el.dataset.cmsHrefTpl;
      const out = tpl.replace(/\{([^}]+)\}/g, (_, k) => {
        const v = get(data, k);
        return v == null ? '' : encodeURIComponent(v);
      });
      el.href = out;
    });
    each('[data-cms-alt]', el => {
      const v = get(data, el.dataset.cmsAlt);
      if (v) el.alt = v;
    });
    each('[data-cms-bg]', el => {
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

  function render(data) {
    processArrays(document, data);
    applyBindings(document, data, { skipEach: true });
    applyMeta(data);
  }

  async function init() {
    // Phase 1 — paint from local JSON immediately. No Supabase wait.
    const [siteBase, pageBase] = await Promise.all([
      loadJson('data/site.json'),
      loadJson('data/' + page + '.json'),
    ]);

    let data = { ...pageBase, site: siteBase };
    render(data);
    document.documentElement.classList.add('cms-ready');
    document.dispatchEvent(new CustomEvent('cms:ready', { detail: data }));

    // Phase 2 — enhance with Supabase overrides if any (slower, may not arrive)
    const overrides = await loadOverrides();
    const hasOverrides =
      Object.keys(overrides.site || {}).length ||
      Object.keys(overrides.page || {}).length;
    if (hasOverrides) {
      const site = deepMerge(siteBase, overrides.site);
      const pageData = deepMerge(pageBase, overrides.page);
      data = { ...pageData, site };
      render(data);
      document.dispatchEvent(new CustomEvent('cms:enhanced', { detail: data }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
