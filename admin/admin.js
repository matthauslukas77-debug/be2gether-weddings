/* ═══════════════════════════════════════════════════
   be2gether CMS — Admin Panel Logic (Supabase-backed)
   ═══════════════════════════════════════════════════ */

// Global error catchers — surface anything silent into the login error box.
function _showGlobalErr(msg) {
  const box = document.getElementById('loginError');
  if (box) { box.style.color = '#c00'; box.textContent = msg; }
  else { console.error(msg); }
}
window.addEventListener('error', (e) => _showGlobalErr('JS-Fehler: ' + (e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => _showGlobalErr('Promise-Fehler: ' + (e.reason?.message || e.reason)));

(function () {
  'use strict';

  // ── Supabase client (lazy — never throws at script load) ─
  let _sb = null;
  function sbClient() {
    if (_sb) return _sb;
    if (!window.CMS_CONFIG) throw new Error('CMS-Konfiguration fehlt (cms-config.js nicht geladen).');
    if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase SDK nicht geladen (CDN blockiert?).');
    _sb = window.supabase.createClient(window.CMS_CONFIG.supabaseUrl, window.CMS_CONFIG.supabaseAnonKey);
    return _sb;
  }
  function adminEmail() { return window.CMS_CONFIG?.adminEmail; }
  function tableName() { return window.CMS_CONFIG?.table || 'cms_content'; }

  const PAGES = [
    {
      id: 'impressionen',
      label: 'Impressionen',
      icon: 'ph-images',
      preview: '../impressionen.html',
      section: 'pages',
      // Only these top-level keys are exposed in the editor.
      fields: ['gallery'],
      sectionLabels: { gallery: 'Bildergalerie' },
    },
    {
      id: 'blog',
      label: 'Blog',
      icon: 'ph-newspaper',
      preview: '../blog.html',
      section: 'pages',
      fields: ['posts'],
      sectionLabels: { posts: 'Blog-Artikel' },
      itemHideKeys: ['slug'],
      itemCollapsible: true,
      itemTitleKey: 'title',
    },
  ];

  // Friendly labels for fields (German). Fallback to humanized key.
  const FIELD_LABELS = {
    meta: 'SEO / Browser-Tab',
    title: 'Titel',
    description: 'Beschreibung',
    subtitle: 'Untertitel',
    label: 'Kleiner Label-Text',
    text: 'Text',
    ctaText: 'Button-Text',
    scrollText: 'Scroll-Hinweis',
    centerImage: 'Bild (Mitte)',
    image: 'Bild',
    images: 'Bilder',
    logo: 'Logo',
    problemsHeading: 'Überschrift (Probleme)',
    solutionsHeading: 'Überschrift (Lösungen)',
    problems: 'Probleme',
    solutions: 'Lösungen',
    items: 'Einträge',
    hero: 'Hero-Bereich',
    challenges: 'Herausforderungen',
    services: 'Leistungen',
    steps: 'Schritte',
    about: 'Über mich',
    testimonials: 'Kundenstimmen',
    faq: 'FAQ',
    location: 'Standort',
    ctaBanner: 'CTA-Banner',
    ctaBanner1: 'CTA-Banner (oben)',
    ctaBanner2: 'CTA-Banner (unten)',
    gallery: 'Galerie',
    credits: 'Bildnachweise',
    posts: 'Blog-Artikel',
    form: 'Kontaktformular',
    info: 'Kontakt-Infos',
    brand: 'Marke',
    contact: 'Kontakt',
    social: 'Social Media',
    footer: 'Footer',
    promise: 'Versprechen',
    funFacts: 'Fun Facts',
    question: 'Frage',
    answer: 'Antwort',
    link: 'Link',
    date: 'Datum',
    excerpt: 'Vorschau-Text',
    heroImage: 'Hero-Bild (Detail-Seite)',
    intro: 'Einleitung',
    body: 'Inhalt',
    author: 'Autor',
    paragraph1: 'Absatz 1',
    paragraph2: 'Absatz 2',
    intro: 'Einleitung',
    submitText: 'Absenden-Button',
    privacyText: 'Datenschutz-Hinweis',
    name: 'Name',
    address: 'Adresse',
    phone: 'Telefon',
    phoneLink: 'Telefon-Link',
    email: 'E-Mail',
    emailLink: 'E-Mail-Link',
    tagline: 'Tagline (lang)',
    taglineShort: 'Tagline (kurz)',
    copyright: 'Copyright',
    seo: 'SEO-Keywords',
    instagram: 'Instagram URL',
    facebook: 'Facebook URL',
    alt: 'Alt-Text',
    googleLinkText: 'Google-Link Text',
    googleLinkUrl: 'Google-Link URL',
    id: 'ID (intern)'
  };

  const IMAGE_FIELD_RE = /^(image|img|bg|photo|logo|src|thumbnail|thumb)$|image$|Img$|Bg$|Photo$|Logo$/i;
  const LONG_TEXT_RE = /^(text|paragraph|answer|excerpt|intro|description|tagline|taglineShort|privacyText|credits)/i;

  // ── State ────────────────────────────────────────
  let currentPageId = null;
  let basePageData = null;
  let currentData = null;
  let dirty = false;
  // Cache of all overrides loaded from Supabase: { [page_id]: data }
  const overrides = {};

  // ── DOM refs ─────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const el = {
    loginScreen: $('#loginScreen'),
    adminApp:    $('#adminApp'),
    loginForm:   $('#loginForm'),
    loginPassword: $('#loginPassword'),
    loginError:  $('#loginError'),
    pageNav:     $('#pageNav'),
    pageTitle:   $('#pageTitle'),
    crumb:       $('#crumb'),
    editor:      $('#editor'),
    btnPreview:  $('#btnPreview'),
    btnSave:     $('#btnSave'),
    btnResetPage:$('#btnResetPage'),
    btnResetAll: $('#btnResetAll'),
    btnExport:   $('#btnExport'),
    btnImport:   $('#btnImport'),
    importFile:  $('#importFile'),
    btnLogout:   $('#btnLogout'),
    savedToast:  $('#savedToast'),
  };

  // ── Utilities ────────────────────────────────────
  function humanize(key) {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  function isImagePath(key) { return IMAGE_FIELD_RE.test(key); }

  function isLongText(key, value) {
    if (LONG_TEXT_RE.test(key)) return true;
    if (typeof value === 'string' && value.length > 80) return true;
    return false;
  }

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

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

  function showToast(text) {
    el.savedToast.querySelector('i')?.remove();
    const i = document.createElement('i');
    i.className = 'ph ph-check-circle';
    el.savedToast.prepend(i);
    el.savedToast.lastChild.textContent = ' ' + text;
    el.savedToast.classList.add('show');
    setTimeout(() => el.savedToast.classList.remove('show'), 2200);
  }

  async function loadJson(path) {
    const res = await fetch(path + '?t=' + Date.now(), { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load ' + path);
    return res.json();
  }

  // ── Auth (Supabase) ──────────────────────────────
  async function isAuthenticated() {
    try {
      const { data } = await sbClient().auth.getSession();
      return !!data.session;
    } catch (e) {
      console.error('isAuthenticated:', e);
      return false;
    }
  }

  async function login(pw) {
    try {
      const { error } = await sbClient().auth.signInWithPassword({
        email: adminEmail(),
        password: pw,
      });
      return { ok: !error, error };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  async function logout() {
    try { await sbClient().auth.signOut(); } catch (e) { /* ignore */ }
    location.reload();
  }

  function showLogin() {
    el.loginScreen.hidden = false;
    el.adminApp.hidden = true;
    setTimeout(() => el.loginPassword.focus(), 100);
  }
  function showAdmin() {
    el.loginScreen.hidden = true;
    el.adminApp.hidden = false;
  }

  // ── Supabase content I/O ─────────────────────────
  async function loadAllOverrides() {
    const { data, error } = await sbClient().from(tableName()).select('page_id, data');
    if (error) throw error;
    for (const k of Object.keys(overrides)) delete overrides[k];
    for (const row of data || []) overrides[row.page_id] = row.data || {};
    // Auto-prune fields that are no longer editable in the current admin
    // (e.g. meta.title left over from a previous admin version).
    for (const pageDef of PAGES) {
      if (!pageDef.fields?.length) continue;
      const existing = overrides[pageDef.id];
      if (!existing) continue;
      const cleaned = Object.fromEntries(
        Object.entries(existing).filter(([k]) => pageDef.fields.includes(k))
      );
      if (Object.keys(cleaned).length !== Object.keys(existing).length) {
        if (Object.keys(cleaned).length === 0) await deleteOverride(pageDef.id);
        else await upsertOverride(pageDef.id, cleaned);
      }
    }
  }

  async function upsertOverride(pageId, diff) {
    const { error } = await sbClient().from(tableName()).upsert(
      { page_id: pageId, data: diff },
      { onConflict: 'page_id' }
    );
    if (error) throw error;
    overrides[pageId] = diff;
  }

  async function deleteOverride(pageId) {
    const { error } = await sbClient().from(tableName()).delete().eq('page_id', pageId);
    if (error) throw error;
    delete overrides[pageId];
  }

  function getOverride(pageId) {
    return overrides[pageId] || {};
  }

  // ── Sidebar ──────────────────────────────────────
  function renderNav() {
    const byGroup = {};
    PAGES.forEach(p => {
      if (!byGroup[p.section]) byGroup[p.section] = [];
      byGroup[p.section].push(p);
    });

    let html = '';
    const sectionOrder = [
      { key: 'pages',  label: 'Seiten' },
      { key: 'global', label: 'Global' },
    ];
    sectionOrder.forEach(s => {
      if (!byGroup[s.key]) return;
      html += `<div class="nav-section-label">${s.label}</div>`;
      byGroup[s.key].forEach(p => {
        html += `<button class="nav-item" data-page="${p.id}"><i class="ph ${p.icon}"></i> ${p.label}</button>`;
      });
    });
    el.pageNav.innerHTML = html;

    el.pageNav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
  }

  function markActiveNav(pageId) {
    el.pageNav.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.page === pageId);
    });
  }

  // ── Page switching ───────────────────────────────
  async function switchPage(pageId) {
    if (dirty) {
      if (!confirm('Ungespeicherte Änderungen gehen verloren. Trotzdem wechseln?')) return;
    }
    currentPageId = pageId;
    dirty = false;
    markActiveNav(pageId);

    const meta = PAGES.find(p => p.id === pageId);
    el.pageTitle.textContent = meta.label;
    el.crumb.textContent = meta.section === 'global' ? 'Global' : 'Seite';
    if (meta.preview) {
      el.btnPreview.href = meta.preview;
      el.btnPreview.style.display = '';
    } else {
      el.btnPreview.style.display = 'none';
    }

    el.editor.innerHTML = '<div class="empty">Lade…</div>';

    try {
      const path = pageId === 'site' ? '../data/site.json' : `../data/${pageId}.json`;
      basePageData = await loadJson(path);
      const override = getOverride(pageId);
      currentData = deepMerge(deepClone(basePageData), override);
      renderEditor();
    } catch (e) {
      el.editor.innerHTML = `<div class="empty">Fehler beim Laden: ${e.message}</div>`;
    }
  }

  // Compute diff between base and edited — only store changed fields
  function computeDiff(base, edited) {
    if (Array.isArray(edited)) {
      return JSON.stringify(base) === JSON.stringify(edited) ? undefined : edited;
    }
    if (edited && typeof edited === 'object') {
      const out = {};
      for (const k of Object.keys(edited)) {
        const d = computeDiff(base ? base[k] : undefined, edited[k]);
        if (d !== undefined) out[k] = d;
      }
      return Object.keys(out).length ? out : undefined;
    }
    return base === edited ? undefined : edited;
  }

  // ── Editor rendering ─────────────────────────────
  function renderEditor() {
    el.editor.innerHTML = '';
    const meta = PAGES.find(p => p.id === currentPageId);
    const allKeys = Object.keys(currentData);
    const keys = meta?.fields?.length
      ? meta.fields.filter(k => allKeys.includes(k))
      : allKeys;

    keys.forEach(key => {
      const labelOverride = meta?.sectionLabels?.[key];
      const group = renderSectionGroup(key, currentData[key], [key], labelOverride);
      el.editor.appendChild(group);
    });
  }

  function renderSectionGroup(key, value, path, labelOverride) {
    const group = document.createElement('div');
    group.className = 'section-group';

    const header = document.createElement('div');
    header.className = 'section-group__header';
    header.innerHTML = `
      <div class="section-group__title">
        <i class="ph ${iconForSection(key)}"></i>
        <h2>${labelOverride || humanize(key)}</h2>
      </div>
      <i class="ph ph-caret-down section-group__toggle"></i>
    `;
    header.addEventListener('click', () => group.classList.toggle('collapsed'));
    group.appendChild(header);

    const body = document.createElement('div');
    body.className = 'section-group__body';
    body.appendChild(renderValue(value, path));
    group.appendChild(body);

    return group;
  }

  function iconForSection(key) {
    const map = {
      meta: 'ph-tag', hero: 'ph-star', challenges: 'ph-puzzle-piece', services: 'ph-sparkle',
      steps: 'ph-list-numbers', about: 'ph-user', testimonials: 'ph-quotes', faq: 'ph-question',
      location: 'ph-map-pin', ctaBanner: 'ph-megaphone', ctaBanner1: 'ph-megaphone',
      ctaBanner2: 'ph-megaphone', gallery: 'ph-images', credits: 'ph-info',
      posts: 'ph-newspaper', form: 'ph-envelope', info: 'ph-address-book',
      brand: 'ph-shield-star', contact: 'ph-phone', social: 'ph-share-network',
      footer: 'ph-windows-logo', promise: 'ph-handshake'
    };
    return map[key] || 'ph-pencil-simple';
  }

  function renderValue(value, path) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '1.1rem';

    if (Array.isArray(value)) {
      container.appendChild(renderArray(value, path));
    } else if (value && typeof value === 'object') {
      for (const k of Object.keys(value)) {
        container.appendChild(renderField(k, value[k], path.concat(k)));
      }
    } else {
      container.appendChild(renderLeaf('', value, path));
    }

    return container;
  }

  function renderField(key, value, path) {
    if (Array.isArray(value)) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const label = document.createElement('label');
      label.textContent = humanize(key);
      wrap.appendChild(label);
      wrap.appendChild(renderArray(value, path));
      return wrap;
    }
    if (value && typeof value === 'object') {
      const wrap = document.createElement('div');
      wrap.className = 'repeater-item';
      const h = document.createElement('div');
      h.className = 'repeater-item__header';
      h.innerHTML = `<div class="repeater-item__index">${humanize(key)}</div>`;
      wrap.appendChild(h);
      const body = document.createElement('div');
      body.className = 'repeater-item__body';
      for (const k of Object.keys(value)) {
        body.appendChild(renderField(k, value[k], path.concat(k)));
      }
      wrap.appendChild(body);
      return wrap;
    }
    return renderLeaf(key, value, path);
  }

  function renderLeaf(key, value, path) {
    const isImage = isImagePath(key);
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.textContent = humanize(key);
    field.appendChild(label);

    if (isImage) {
      field.appendChild(renderImageField(value, path));
    } else if (key === 'body' && window.Quill) {
      field.appendChild(renderRichText(value, path));
    } else if (isLongText(key, value)) {
      const ta = document.createElement('textarea');
      ta.value = value == null ? '' : String(value);
      ta.rows = Math.min(8, Math.max(3, (String(value || '').split('\n').length + 1)));
      ta.addEventListener('input', () => { setAtPath(currentData, path, ta.value); dirty = true; });
      field.appendChild(ta);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = value == null ? '' : String(value);
      inp.addEventListener('input', () => { setAtPath(currentData, path, inp.value); dirty = true; });
      field.appendChild(inp);
    }

    return field;
  }

  function renderRichText(value, path) {
    const wrap = document.createElement('div');
    wrap.style.background = '#fff';
    wrap.style.borderRadius = 'var(--radius)';
    const editorDiv = document.createElement('div');
    editorDiv.style.minHeight = '300px';
    wrap.appendChild(editorDiv);
    // Quill must be in the DOM before init.
    queueMicrotask(() => {
      const q = new window.Quill(editorDiv, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image'],
            ['clean'],
          ],
        },
      });
      q.root.innerHTML = value == null ? '' : String(value);
      q.on('text-change', () => {
        setAtPath(currentData, path, q.root.innerHTML);
        dirty = true;
      });
    });
    return wrap;
  }

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function ensureSlugs(data) {
    if (data && Array.isArray(data.posts)) {
      data.posts.forEach(p => {
        if (!p.slug && p.title) p.slug = slugify(p.title);
      });
    }
  }

  function renderImageField(value, path) {
    const wrap = document.createElement('div');
    wrap.className = 'image-field';

    const preview = document.createElement('div');
    preview.className = 'image-field__preview';
    updatePreview(preview, value);

    const controls = document.createElement('div');
    controls.className = 'image-field__controls';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'Bild-URL oder Pfad (z.B. images/foto.jpg)';
    urlInput.value = value || '';
    urlInput.addEventListener('input', () => {
      setAtPath(currentData, path, urlInput.value);
      updatePreview(preview, urlInput.value);
      dirty = true;
    });
    controls.appendChild(urlInput);

    const buttons = document.createElement('div');
    buttons.className = 'image-field__buttons';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) {
        alert('Bild ist zu groß (max. 3 MB).\nFür größere Bilder die URL angeben.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        urlInput.value = dataUrl;
        setAtPath(currentData, path, dataUrl);
        updatePreview(preview, dataUrl);
        dirty = true;
      };
      reader.readAsDataURL(file);
    });

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'btn btn--outline btn--sm';
    uploadBtn.innerHTML = '<i class="ph ph-upload"></i> Bild hochladen';
    uploadBtn.addEventListener('click', () => fileInput.click());

    buttons.appendChild(uploadBtn);
    buttons.appendChild(fileInput);

    controls.appendChild(buttons);

    const hint = document.createElement('div');
    hint.className = 'image-field__hint';
    hint.textContent = 'Tipp: Bilder aus dem /images/-Ordner als Pfad angeben, eigene Bilder hochladen (max. 3 MB).';
    controls.appendChild(hint);

    wrap.appendChild(preview);
    wrap.appendChild(controls);
    return wrap;
  }

  function updatePreview(el, value) {
    el.innerHTML = '';
    if (!value) { el.textContent = 'Kein Bild'; return; }
    const img = document.createElement('img');
    img.src = value.startsWith('data:') || value.startsWith('http') ? value : '../' + value;
    img.onerror = () => { el.innerHTML = '<span>Bild nicht gefunden</span>'; };
    el.appendChild(img);
  }

  function renderArray(arr, path) {
    const wrap = document.createElement('div');
    wrap.className = 'repeater';

    arr.forEach((item, idx) => {
      wrap.appendChild(renderArrayItem(item, idx, path, wrap));
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'repeater-add';
    addBtn.innerHTML = '<i class="ph ph-plus"></i> Eintrag hinzufügen';
    addBtn.addEventListener('click', () => {
      const template = templateFor(arr);
      const currentArr = getAtPath(currentData, path) || [];
      currentArr.push(template);
      setAtPath(currentData, path, currentArr);
      dirty = true;
      wrap.replaceWith(renderArray(currentArr, path));
    });
    wrap.appendChild(addBtn);

    return wrap;
  }

  function renderArrayItem(item, idx, parentPath, wrapRef) {
    const meta = PAGES.find(p => p.id === currentPageId);
    const collapsible = !!meta?.itemCollapsible;
    const titleKey = meta?.itemTitleKey;
    const itemTitle = (titleKey && item && item[titleKey]) ? String(item[titleKey]) : '';

    const itemWrap = document.createElement('div');
    itemWrap.className = 'repeater-item' + (collapsible ? ' collapsed' : '');

    const header = document.createElement('div');
    header.className = 'repeater-item__header';
    const labelText = itemTitle || `Eintrag ${idx + 1}`;
    const caret = collapsible
      ? '<i class="ph ph-caret-down repeater-item__toggle" style="margin-right:.5rem"></i>'
      : '';
    header.innerHTML = `
      <div class="repeater-item__index" style="display:flex;align-items:center;flex:1;min-width:0">
        ${caret}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${labelText.replace(/</g,'&lt;')}</span>
      </div>
      <div class="repeater-item__actions">
        <button type="button" title="Nach oben" data-action="up"><i class="ph ph-arrow-up"></i></button>
        <button type="button" title="Nach unten" data-action="down"><i class="ph ph-arrow-down"></i></button>
        <button type="button" class="remove" title="Entfernen" data-action="remove"><i class="ph ph-trash"></i></button>
      </div>
    `;
    if (collapsible) {
      header.style.cursor = 'pointer';
      header.addEventListener('click', (e) => {
        // Don't toggle when clicking action buttons.
        if (e.target.closest('[data-action]')) return;
        itemWrap.classList.toggle('collapsed');
      });
    }
    itemWrap.appendChild(header);

    const body = document.createElement('div');
    body.className = 'repeater-item__body';

    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const hide = meta?.itemHideKeys || [];
      for (const k of Object.keys(item)) {
        if (hide.includes(k)) continue;
        body.appendChild(renderField(k, item[k], parentPath.concat(idx, k)));
      }
    } else {
      body.appendChild(renderLeaf('', item, parentPath.concat(idx)));
    }
    itemWrap.appendChild(body);

    header.querySelector('[data-action="up"]').addEventListener('click', () => moveItem(parentPath, idx, -1, wrapRef));
    header.querySelector('[data-action="down"]').addEventListener('click', () => moveItem(parentPath, idx, 1, wrapRef));
    header.querySelector('[data-action="remove"]').addEventListener('click', () => {
      if (!confirm('Eintrag wirklich entfernen?')) return;
      const arr = getAtPath(currentData, parentPath);
      arr.splice(idx, 1);
      setAtPath(currentData, parentPath, arr);
      dirty = true;
      wrapRef.replaceWith(renderArray(arr, parentPath));
    });

    return itemWrap;
  }

  function moveItem(path, idx, dir, wrapRef) {
    const arr = getAtPath(currentData, path);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    const [x] = arr.splice(idx, 1);
    arr.splice(newIdx, 0, x);
    setAtPath(currentData, path, arr);
    dirty = true;
    wrapRef.replaceWith(renderArray(arr, path));
  }

  function templateFor(arr) {
    if (arr.length === 0) return '';
    const sample = arr[0];
    if (typeof sample === 'string') return '';
    if (Array.isArray(sample)) return [];
    if (typeof sample === 'object' && sample !== null) {
      const out = {};
      for (const k of Object.keys(sample)) {
        const v = sample[k];
        if (typeof v === 'string') out[k] = '';
        else if (typeof v === 'number') out[k] = 0;
        else if (Array.isArray(v)) out[k] = [];
        else if (v && typeof v === 'object') out[k] = templateFor([v]);
        else out[k] = '';
      }
      return out;
    }
    return null;
  }

  // ── Path helpers ─────────────────────────────────
  function getAtPath(obj, path) {
    return path.reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  }
  function setAtPath(obj, path, value) {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      if (cur[k] == null) cur[k] = (typeof path[i + 1] === 'number') ? [] : {};
      cur = cur[k];
    }
    cur[path[path.length - 1]] = value;
  }

  // ── Save / Reset ─────────────────────────────────
  async function save() {
    ensureSlugs(currentData);
    const fullDiff = computeDiff(basePageData, currentData) || {};
    // If this page has a field whitelist, drop any keys outside it so old
    // non-editable overrides (left from earlier admin versions) don't persist.
    const meta = PAGES.find(p => p.id === currentPageId);
    const diff = meta?.fields?.length
      ? Object.fromEntries(Object.entries(fullDiff).filter(([k]) => meta.fields.includes(k)))
      : fullDiff;
    try {
      if (Object.keys(diff).length === 0) {
        await deleteOverride(currentPageId);
      } else {
        await upsertOverride(currentPageId, diff);
      }
      dirty = false;
      showToast('Änderungen gespeichert');
    } catch (e) {
      alert('Speichern fehlgeschlagen: ' + (e.message || e));
    }
  }

  async function resetPage() {
    if (!confirm(`Wirklich alle Änderungen auf "${PAGES.find(p=>p.id===currentPageId).label}" zurücksetzen?`)) return;
    try {
      await deleteOverride(currentPageId);
      dirty = false;
      switchPage(currentPageId);
      showToast('Seite zurückgesetzt');
    } catch (e) {
      alert('Zurücksetzen fehlgeschlagen: ' + (e.message || e));
    }
  }

  async function resetAll() {
    if (!confirm('Wirklich ALLE Änderungen auf ALLEN Seiten zurücksetzen?')) return;
    try {
      const ids = Object.keys(overrides);
      await Promise.all(ids.map(id => deleteOverride(id)));
      dirty = false;
      switchPage(currentPageId);
      showToast('Alles zurückgesetzt');
    } catch (e) {
      alert('Zurücksetzen fehlgeschlagen: ' + (e.message || e));
    }
  }

  // ── Export / Import ──────────────────────────────
  function exportAll() {
    const payload = {
      exportedAt: new Date().toISOString(),
      brand: 'be2gether weddings CMS',
      data: {}
    };
    PAGES.forEach(p => {
      const ov = getOverride(p.id);
      if (ov && Object.keys(ov).length) payload.data[p.id] = ov;
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `be2gether-cms-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Export heruntergeladen');
  }

  function importAll(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const payload = JSON.parse(reader.result);
        const data = payload.data || payload;
        let count = 0;
        for (const pageId of Object.keys(data)) {
          if (PAGES.find(p => p.id === pageId)) {
            await upsertOverride(pageId, data[pageId]);
            count++;
          }
        }
        showToast(`${count} Seiten importiert`);
        switchPage(currentPageId);
      } catch (e) {
        alert('Import fehlgeschlagen: ' + (e.message || e));
      }
    };
    reader.readAsText(file);
  }

  // ── Wire up events ───────────────────────────────
  function bindEvents() {
    if (!el.loginForm) { _showGlobalErr('loginForm-Element nicht gefunden im DOM.'); return; }

    async function attemptLogin() {
      el.loginError.style.color = '';
      el.loginError.textContent = 'Prüfe Login…';
      try {
        const { ok, error } = await login(el.loginPassword.value);
        if (!ok) {
          el.loginError.style.color = '#c00';
          el.loginError.textContent = error?.message?.includes('Invalid')
            ? 'Passwort falsch.'
            : 'Login fehlgeschlagen: ' + (error?.message || 'unbekannter Fehler');
          el.loginPassword.value = '';
          el.loginPassword.focus();
          return;
        }
        el.loginError.textContent = '';
        await boot();
      } catch (e) {
        el.loginError.style.color = '#c00';
        el.loginError.textContent = 'Fehler: ' + (e.message || e);
      }
    }

    el.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      attemptLogin();
    });
    // Belt-and-suspenders: also bind directly to the submit button.
    const submitBtn = el.loginForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      attemptLogin();
    });

    el.btnSave.addEventListener('click', save);
    el.btnResetPage.addEventListener('click', resetPage);
    el.btnResetAll.addEventListener('click', resetAll);
    el.btnExport.addEventListener('click', exportAll);
    el.btnImport.addEventListener('click', () => el.importFile.click());
    el.importFile.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) importAll(f);
      e.target.value = '';
    });
    el.btnLogout.addEventListener('click', () => {
      if (dirty && !confirm('Ungespeicherte Änderungen gehen verloren. Abmelden?')) return;
      logout();
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !el.adminApp.hidden) {
        e.preventDefault();
        save();
      }
    });

    window.addEventListener('beforeunload', (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  // ── Boot ─────────────────────────────────────────
  async function boot() {
    showAdmin();
    renderNav();
    try {
      await loadAllOverrides();
    } catch (e) {
      console.error('Konnte CMS-Inhalte nicht laden:', e);
      alert('CMS-Inhalte konnten nicht geladen werden: ' + (e.message || e));
    }
    switchPage(PAGES[0].id);
  }

  async function init() {
    try {
      bindEvents();
    } catch (e) {
      console.error('bindEvents failed:', e);
      el.loginError && (el.loginError.textContent = 'Init-Fehler: ' + (e.message || e));
      return;
    }
    if (await isAuthenticated()) boot();
    else showLogin();
  }

  init();
})();
