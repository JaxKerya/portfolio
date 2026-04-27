/**
 * i18n — Locale yükleme + URL path-prefix tabanlı dil yönetimi.
 *
 * URL şeması:
 *   English (default):  /  /info  /contact  /video/:id
 *   Turkish:            /tr  /tr/info  /tr/contact  /tr/video/:id
 *
 * Eski `?lang=tr` query param ile gelen istekler tek seferlik
 * `/tr/...` URL'sine yumuşak yönlendirilir (geri uyumluluk).
 */
import trLocale from './locales/tr.json';
import enLocale from './locales/en.json';
import {
  splitLocalePath,
  localizedPath,
  getCurrentLang,
  getCurrentPath,
  DEFAULT_LANG,
} from './router.js';

const translations = { tr: trLocale, en: enLocale };
let currentLang = DEFAULT_LANG;

/**
 * URL → localStorage → tarayıcı sırasıyla dil tespit eder.
 * Path prefix YOKSA eski `?lang=tr` query param'larını da değerlendir
 * (geriye doğru uyumluluk).
 */
export function detectLanguage() {
  // 1) URL path prefix (ana yöntem) — yalnızca prefix EXPLICIT verilmişse.
  const split = splitLocalePath(window.location.pathname);
  if (split.hasExplicitLang && translations[split.lang]) return split.lang;

  // 2) Eski query param — geriye doğru uyumluluk
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  if (urlLang && translations[urlLang]) return urlLang;

  // 3) localStorage
  const saved = localStorage.getItem('preferred-language');
  if (saved && translations[saved]) return saved;

  // 4) Tarayıcı
  const browser = navigator.language.slice(0, 2);
  if (translations[browser]) return browser;

  return DEFAULT_LANG;
}

/**
 * URL'i mevcut dile uygun hale getirir.
 * - `?lang=tr` query param'larını siler ve gerekirse path'e prefix ekler.
 * - Path zaten dile uygunsa hiçbir şey yapmaz.
 */
function syncUrlToLang(lang) {
  const url = new URL(window.location);
  // Eski ?lang= query param'ı temizle
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang');
  }

  // Path'i dile göre yeniden inşa et
  const split = splitLocalePath(url.pathname);
  const newPath = localizedPath(split.logicalPath, lang);

  if (newPath !== url.pathname || url.search !== '') {
    url.pathname = newPath;
    window.history.replaceState({}, '', url.toString());
  }
}

export function initI18n() {
  currentLang = detectLanguage();
  document.documentElement.lang = currentLang;

  syncUrlToLang(currentLang);

  applyTranslations();
  updateLangToggle();

  // URL → i18n state senkronizasyonu.
  // Browser back/forward (popstate) ve programatik navigate (routechange)
  // sırasında URL'deki path prefix dilden farklıysa dili güncelle.
  // Aksi halde i18n state ile path uyumsuz kalabilir.
  const syncFromUrl = () => {
    const fromUrl = getCurrentLang();
    if (translations[fromUrl] && fromUrl !== currentLang) {
      currentLang = fromUrl;
      document.documentElement.lang = currentLang;
      applyTranslations();
      updateLangToggle();
    }
  };
  window.addEventListener('popstate', syncFromUrl);
  window.addEventListener('routechange', syncFromUrl);
}

export function setLanguage(lang) {
  if (!translations[lang] || lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem('preferred-language', lang);
  document.documentElement.lang = lang;

  // URL'i yeni dile göre yeniden inşa et — pushState (geri tuşu çalışsın)
  const logicalPath = getCurrentPath();
  const newPath = localizedPath(logicalPath, lang);
  if (newPath !== window.location.pathname) {
    window.history.pushState({}, '', newPath);
  }

  applyTranslations();
  updateLangToggle();

  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
}

export function t(key, fallback) {
  const keys = key.split('.');
  let val = translations[currentLang];
  for (const k of keys) {
    if (val && typeof val === 'object' && k in val) {
      val = val[k];
    } else {
      return fallback || key;
    }
  }
  return val || fallback || key;
}

export function getLang() {
  return currentLang;
}

export function toggleLanguage() {
  setLanguage(currentLang === 'tr' ? 'en' : 'tr');
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
      el.placeholder = text;
    } else {
      const children = Array.from(el.childNodes);
      const textNodes = children.filter(n => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (textNodes.length === 1) {
        textNodes[0].textContent = text;
      } else {
        el.textContent = text;
      }
    }
  });
}

function updateLangToggle() {
  const btn = document.getElementById('langToggle');
  if (btn) {
    btn.querySelector('.lang-current').textContent = currentLang.toUpperCase();
  }
}
