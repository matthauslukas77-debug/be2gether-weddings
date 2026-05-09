/* ═══════════════════════════════════════════════════
   be2gether weddings — JavaScript Interactions
   ═══════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

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

    // Close on link click
    navLinks.querySelectorAll('a:not(.btn)').forEach(link => {
      link.addEventListener('click', () => {
        if (navLinks.classList.contains('open')) toggleMenu();
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
