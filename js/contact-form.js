/* ═══════════════════════════════════════════════════
   Contact form — POST to Supabase Edge Function
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  const form = document.getElementById('contactForm');
  if (!form) return;

  const cfg = window.CMS_CONFIG;
  const FUNCTION_URL = cfg && cfg.supabaseUrl ? `${cfg.supabaseUrl}/functions/v1/contact` : null;

  const submitBtn = form.querySelector('.kontakt-form__submit');
  const submitLabel = form.querySelector('.kontakt-form__submit-label');
  const errorEl = document.getElementById('formError');
  const successEl = document.getElementById('formSuccess');

  function setError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!FUNCTION_URL) {
      setError('Konfigurationsfehler — bitte schreib mir direkt eine WhatsApp-Nachricht.');
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    // Drop the consent flag — only used for client-side gate
    delete data.consent;
    data.submittedAt = new Date().toISOString();
    data.userAgent = navigator.userAgent;
    data.referer = document.referrer || '';

    submitBtn.disabled = true;
    const originalLabel = submitLabel.textContent;
    submitLabel.textContent = 'Wird gesendet …';

    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${body ? ' — ' + body.slice(0, 160) : ''}`);
      }

      form.hidden = true;
      successEl.hidden = false;
      successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      console.error('Contact form submit failed:', err);
      setError('Da ist leider etwas schiefgelaufen. Versuche es bitte nochmal — oder schreib mir direkt auf WhatsApp.');
      submitBtn.disabled = false;
      submitLabel.textContent = originalLabel;
    }
  });
})();
