import { addContactMessage, verifyTurnstile } from '../supabase.js';
import { t, getLang } from '../i18n.js';
import { setMeta, contactPageSchema, breadcrumbSchema } from '../seo.js';
import { SITE } from '../site-config.js';
import { TURNSTILE_SITE_KEY, CAPTCHA_ENABLED } from '../config.js';

const COOLDOWN_KEY = 'lastContactMessageTime';
const COOLDOWN_MS = 5 * 60 * 1000; // 5 dakika
const MIN_FORM_TIME_MS = 3000;     // formu doldurmak için minimum süre (bot tespiti)
const MAX_NAME_LEN = 100;
const MAX_SUBJECT_LEN = 200;
const MAX_MESSAGE_LEN = 2000;
const MIN_MESSAGE_LEN = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * CONTACT PAGE — Form + spam/abuse protection (honeypot, time check, rate limit, Turnstile)
 */
export async function renderContact(container) {
  const lang = getLang();
  const isTr = lang === 'tr';

  setMeta({
    title: isTr ? 'İletişim' : 'Contact',
    description: isTr
      ? 'Rabia Göl ile iletişime geçin — 3D karakter animasyonu projeleri ve iş fırsatları için.'
      : 'Get in touch with Rabia Göl — for 3D character animation projects and work opportunities.',
    type: 'website',
    path: '/contact',
    locale: isTr ? 'tr_TR' : 'en_US',
    keywords: SITE.keywords.join(', '),
    structuredData: [
      contactPageSchema({ lang }),
      breadcrumbSchema([
        { name: isTr ? 'Ana Sayfa' : 'Home', url: '/' },
        { name: isTr ? 'İletişim' : 'Contact', url: '/contact' },
      ]),
    ],
  });

  container.innerHTML = `
    <div class="contact-page">
      <h1>${t('contact.title')}</h1>
      <form class="contact-form" id="contactForm" novalidate>
        <div class="form-group">
          <label for="contact-name">${t('contact.name')}</label>
          <input type="text" id="contact-name" name="name" maxlength="${MAX_NAME_LEN}" required>
        </div>
        <div class="form-group">
          <label for="contact-email">${t('contact.email')}</label>
          <input type="email" id="contact-email" name="email" required>
        </div>
        <div class="form-group">
          <label for="contact-subject">${t('contact.subject')}</label>
          <input type="text" id="contact-subject" name="subject" maxlength="${MAX_SUBJECT_LEN}" required>
        </div>
        <div class="form-group">
          <label for="contact-message">${t('contact.message')}</label>
          <textarea id="contact-message" name="message" maxlength="${MAX_MESSAGE_LEN}" required></textarea>
        </div>

        <!-- Honeypot: gerçek kullanıcılar bunu görmez; botlar genelde her input'u doldurur. -->
        <div class="hp-field" aria-hidden="true">
          <label for="contact-website">Website (do not fill this out):</label>
          <input type="text" id="contact-website" name="website" tabindex="-1" autocomplete="off">
        </div>

        ${CAPTCHA_ENABLED ? `
        <div class="form-group" id="turnstileContainer" style="display:flex;justify-content:center;margin:8px 0 4px;"></div>
        ` : ''}

        <button type="submit" class="form-submit" id="contactSubmit">${t('contact.send')}</button>
      </form>
    </div>
  `;

  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('contactSubmit');
  const honeypot = document.getElementById('contact-website');

  // Sayfa yüklenme zamanı (formu çok hızlı gönderen botları yakalamak için)
  const formLoadTime = Date.now();

  // Turnstile widget durumu
  let turnstileToken = '';
  let turnstileWidgetId = null;

  if (CAPTCHA_ENABLED) {
    initTurnstile({
      lang,
      onToken: (token) => { turnstileToken = token || ''; },
      onWidgetReady: (id) => { turnstileWidgetId = id; },
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const subject = form.subject.value.trim();
    const message = form.message.value.trim();

    // 1) Honeypot kontrolü — bot tespiti
    if (honeypot && honeypot.value !== '') {
      console.warn('[contact] honeypot tetiklendi');
      showToast(t('contact.errSpam'), 'error');
      return;
    }

    // 2) Form çok hızlı gönderildi mi? (bot tespiti)
    if (Date.now() - formLoadTime < MIN_FORM_TIME_MS) {
      console.warn('[contact] form çok hızlı gönderildi');
      showToast(t('contact.errTooFast'), 'error');
      return;
    }

    // 3) Rate limit — son mesajdan bu yana 5 dakika geçti mi?
    const lastSent = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
    if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - (Date.now() - lastSent);
      const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
      showToast(t('contact.errCooldown').replace('{minutes}', minutes), 'error');
      return;
    }

    // 4) Alan validasyonu
    if (!name || !email || !subject || !message) {
      showToast(t('contact.error'), 'error');
      return;
    }
    if (name.length > MAX_NAME_LEN) {
      showToast(t('contact.errNameLong'), 'error');
      return;
    }
    if (subject.length > MAX_SUBJECT_LEN) {
      showToast(t('contact.errSubjectLong'), 'error');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      showToast(t('contact.errInvalidEmail'), 'error');
      return;
    }
    if (message.length < MIN_MESSAGE_LEN) {
      showToast(t('contact.errMessageShort'), 'error');
      return;
    }
    if (message.length > MAX_MESSAGE_LEN) {
      showToast(t('contact.errMessageLong'), 'error');
      return;
    }

    // 5) Captcha — token var mı?
    if (CAPTCHA_ENABLED) {
      if (!turnstileToken) {
        showToast(t('contact.captchaPending'), 'error');
        return;
      }
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = t('contact.sending');

    try {
      // 6) Captcha doğrulamasını sunucuya yaptır
      if (CAPTCHA_ENABLED) {
        const verify = await verifyTurnstile(turnstileToken);
        if (!verify || verify.success !== true) {
          console.warn('[contact] turnstile doğrulama başarısız:', verify);
          showToast(t('contact.captchaFailed'), 'error');
          resetTurnstile(turnstileWidgetId);
          turnstileToken = '';
          return;
        }
      }

      // 7) Mesajı kaydet
      await addContactMessage({ name, email, subject, message });
      localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
      showToast(t('contact.success'), 'success');
      form.reset();
      resetTurnstile(turnstileWidgetId);
      turnstileToken = '';
    } catch (err) {
      console.error('Contact form error:', err);
      showToast(t('contact.error'), 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

/**
 * Turnstile widget'ını ilgili container'a render eder.
 * Cloudflare script'i async yüklendiği için window.turnstile hazır
 * olana kadar bekleriz.
 */
function initTurnstile({ lang, onToken, onWidgetReady }) {
  const containerEl = document.getElementById('turnstileContainer');
  if (!containerEl) return;

  let attempts = 0;
  const maxAttempts = 60; // ~6 saniye

  const tryRender = () => {
    if (typeof window.turnstile === 'undefined') {
      attempts += 1;
      if (attempts >= maxAttempts) {
        console.warn('[contact] turnstile script yüklenemedi');
        return;
      }
      setTimeout(tryRender, 100);
      return;
    }

    try {
      const id = window.turnstile.render(containerEl, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        language: lang === 'tr' ? 'tr' : 'en',
        callback: (token) => onToken(token),
        'error-callback': () => onToken(''),
        'expired-callback': () => onToken(''),
        'timeout-callback': () => onToken(''),
      });
      onWidgetReady(id);
    } catch (err) {
      console.error('[contact] turnstile render hatası:', err);
    }
  };

  tryRender();
}

function resetTurnstile(widgetId) {
  if (typeof window.turnstile === 'undefined') return;
  try {
    if (widgetId != null) window.turnstile.reset(widgetId);
    else window.turnstile.reset();
  } catch (err) {
    console.warn('[contact] turnstile reset hatası:', err);
  }
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
