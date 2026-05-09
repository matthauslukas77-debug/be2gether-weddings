/* ═══════════════════════════════════════════════════
   be2gether weddings — JavaScript Interactions
   ═══════════════════════════════════════════════════ */

// ── WhatsApp floating action button (injected on every page) ──
function initWhatsAppFab() {
  if (document.querySelector('.wa-fab')) return;
  const href = 'https://wa.me/491734758590?text=Hallo%20Miriam%2C%20ich%20interessiere%20mich%20f%C3%BCr%20deine%20Hochzeitsplanung.';
  const a = document.createElement('a');
  a.className = 'wa-fab';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Direkt per WhatsApp anfragen');
  a.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="white" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.272-.099-.47-.149-.669.15-.198.297-.768.967-.941 1.166-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg><span class="wa-fab__label">Direkt anfragen</span>';
  document.body.appendChild(a);
}

// ── Cookie consent banner (DSGVO) ──
function initCookieBanner() {
  const KEY = 'b2g_cookie_consent';
  try { if (localStorage.getItem(KEY) === '1') return; } catch (e) {}
  if (document.querySelector('.cookie-banner')) return;
  const el = document.createElement('div');
  el.className = 'cookie-banner';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Cookie-Hinweis');
  el.innerHTML = '<div class="cookie-banner__inner"><p>Wir verwenden Cookies, um eure Erfahrung auf unserer Website zu verbessern. Mehr erfahrt ihr in unserer <a href="datenschutz.html">Datenschutzerklärung</a>.</p><button type="button" class="btn btn--primary cookie-banner__accept">Akzeptieren</button></div>';
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
  el.querySelector('.cookie-banner__accept').addEventListener('click', () => {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    el.classList.remove('open');
    setTimeout(() => el.remove(), 400);
  });
}

document.addEventListener('DOMContentLoaded', () => {

  initWhatsAppFab();
  initCookieBanner();

  // ── Sticky Navbar ──
  const navbar = document.getElementById('navbar');
  if (navbar) {
    const onScroll = () => {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Mobile Menu ──
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  const overlay = document.getElementById('mobileOverlay');

  if (hamburger && navLinks) {
    const toggleMenu = () => {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open');
      document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
    };

    hamburger.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', toggleMenu);

    // Close on link click — explicitly navigate so the menu state change
    // can never block the browser's default click→navigate behavior.
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        if (!navLinks.classList.contains('open')) return;
        const href = link.getAttribute('href');
        const isExternal = link.target === '_blank' || /^https?:|^mailto:|^tel:/i.test(href || '');
        // Tear down menu state immediately
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
        // Same-tab internal nav: take over so a stalled animation can't swallow the click
        if (href && !isExternal) {
          e.preventDefault();
          window.location.href = href;
        }
      });
    });
  }

  // ── FAQ Accordion ──
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const answer = item.querySelector('.faq-answer');
      const isOpen = item.classList.contains('open');

      // Close all others
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        if (openItem !== item) {
          openItem.classList.remove('open');
          openItem.querySelector('.faq-answer').style.maxHeight = '0';
        }
      });

      // Toggle current
      item.classList.toggle('open', !isOpen);
      answer.style.maxHeight = isOpen ? '0' : answer.scrollHeight + 'px';
    });
  });

  // ── Scroll Reveal (IntersectionObserver) ──
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .stagger-children');

  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  } else {
    // Fallback: show everything
    revealElements.forEach(el => el.classList.add('visible'));
  }

  // ── Count-up stat counters (data-count-to / data-count-suffix) ──
  const counters = document.querySelectorAll('[data-count-to]');
  if (counters.length > 0 && 'IntersectionObserver' in window) {
    const fmt = (n) => Math.round(n).toLocaleString('de-DE');
    const tween = (el, target, suffix, duration = 1800) => {
      const start = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const counterIO = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = parseFloat(el.dataset.countTo);
        const suffix = el.dataset.countSuffix || '';
        if (!isNaN(target)) tween(el, target, suffix);
        obs.unobserve(el);
      });
    }, { threshold: 0.45 });
    counters.forEach((el) => counterIO.observe(el));
  } else {
    counters.forEach((el) => {
      const t = parseFloat(el.dataset.countTo);
      const s = el.dataset.countSuffix || '';
      if (!isNaN(t)) el.textContent = Math.round(t).toLocaleString('de-DE') + s;
    });
  }

  // ── Impressionen lightbox (3 home boxes → carousel of more images) ──
  const impressionsLightbox = document.getElementById('impressionsLightbox');
  const impressionsBoxes = document.querySelectorAll('.home-impressions__box[data-impression-key]');
  if (impressionsLightbox && impressionsBoxes.length > 0) {
    const lbImg = impressionsLightbox.querySelector('.lightbox__img');
    const lbCaption = impressionsLightbox.querySelector('.lightbox__caption');
    const lbClose = impressionsLightbox.querySelector('.lightbox__close');
    const lbPrev = impressionsLightbox.querySelector('.lightbox__nav--prev');
    const lbNext = impressionsLightbox.querySelector('.lightbox__nav--next');
    let images = [];
    let idx = 0;
    let title = '';

    const render = () => {
      if (!images.length) return;
      const item = images[idx];
      const src = typeof item === 'string' ? item : item.src;
      const cap = typeof item === 'string' ? '' : (item.caption || '');
      lbImg.src = src;
      lbImg.alt = cap || title;
      lbCaption.textContent = cap || (title ? `${title} — ${idx + 1} / ${images.length}` : `${idx + 1} / ${images.length}`);
    };
    let dataset = null;
    try {
      const raw = document.getElementById('impressionsData');
      if (raw) dataset = JSON.parse(raw.textContent || '{}');
    } catch { dataset = null; }
    const open = (boxKey) => {
      const data = dataset && dataset[boxKey];
      if (!data || !Array.isArray(data.images) || data.images.length === 0) return;
      images = data.images;
      title = data.title || '';
      idx = 0;
      render();
      impressionsLightbox.classList.add('open');
      impressionsLightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      impressionsLightbox.classList.remove('open');
      impressionsLightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      lbImg.src = '';
    };
    const next = () => { if (!images.length) return; idx = (idx + 1) % images.length; render(); };
    const prev = () => { if (!images.length) return; idx = (idx - 1 + images.length) % images.length; render(); };

    impressionsBoxes.forEach((box) => {
      box.addEventListener('click', () => open(box.dataset.impressionKey));
    });
    lbClose.addEventListener('click', close);
    lbPrev.addEventListener('click', prev);
    lbNext.addEventListener('click', next);
    impressionsLightbox.addEventListener('click', (e) => { if (e.target === impressionsLightbox) close(); });
    document.addEventListener('keydown', (e) => {
      if (!impressionsLightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    });
  }

  // ── Smooth anchor scrolling ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ── Active nav link highlight ──
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar__links a:not(.btn)').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

});
