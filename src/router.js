/**
 * Minimal HTML5 history-based SPA router with locale-prefixed paths.
 *
 * URL şeması:
 *   - English (default):  /  /info  /contact  /video/:id
 *   - Turkish:            /tr  /tr/info  /tr/contact  /tr/video/:id
 *
 * Router içeride mantıksal path ile çalışır (`/info`); `/tr/` prefix'i
 * `getCurrentLang()` ile dile çevrilir, `localizedPath()` ile geri konur.
 *
 * `<a href="/info">` tıklamalarına attach olur; modifier tuş, target="_blank",
 * dış link ve `#anchor` durumlarında native davranışı bozmaz.
 * Vercel rewrite kuralları: `/tr/*` → `/tr/index.html`, geri kalanı `/index.html`.
 */

const SUPPORTED_LANGS = ['tr'];          // English default, Turkish prefix'li
export const DEFAULT_LANG = 'en';

const routes = {};
let currentCleanup = null;

export function route(path, handler) {
  routes[path] = handler;
}

/* ───────────── Locale path yardımcıları ───────────── */

/**
 * URL pathname'inden lang prefix'ini çıkarıp { lang, logicalPath, hasExplicitLang } döner.
 *   "/tr/info"   → { lang: "tr", logicalPath: "/info", hasExplicitLang: true }
 *   "/info"      → { lang: "en", logicalPath: "/info", hasExplicitLang: false }
 *   "/tr"        → { lang: "tr", logicalPath: "/", hasExplicitLang: true }
 *   "/"          → { lang: "en", logicalPath: "/", hasExplicitLang: false }
 *
 * `hasExplicitLang` ile path açıkça lang prefix'i belirtmiş mi anlarız —
 * önemli, çünkü `<a href="/info">` (lang-agnostic) link'ler mevcut dili
 * KORUMALI; lang'i sessizce English'e döndürmemeliler.
 */
export function splitLocalePath(rawPath = '/') {
  let p = rawPath || '/';
  if (!p.startsWith('/')) p = `/${p}`;

  const parts = p.split('/').filter(Boolean);
  if (parts.length > 0 && SUPPORTED_LANGS.includes(parts[0])) {
    const lang = parts[0];
    const rest = '/' + parts.slice(1).join('/');
    return {
      lang,
      logicalPath: rest === '/' ? '/' : rest,
      hasExplicitLang: true,
    };
  }
  return { lang: DEFAULT_LANG, logicalPath: p, hasExplicitLang: false };
}

/**
 * Mantıksal path'i belirtilen dilin URL'sine çevirir.
 *   ("/info", "tr") → "/tr/info"
 *   ("/info", "en") → "/info"
 *   ("/", "tr")     → "/tr"
 */
export function localizedPath(logicalPath = '/', lang = DEFAULT_LANG) {
  let p = String(logicalPath || '/');
  if (!p.startsWith('/')) p = `/${p}`;

  // Verilen path zaten bir lang-prefix'i içeriyorsa önce kazıyalım
  const split = splitLocalePath(p);
  p = split.logicalPath;

  if (lang && SUPPORTED_LANGS.includes(lang)) {
    return p === '/' ? `/${lang}` : `/${lang}${p}`;
  }
  return p;
}

/**
 * Şu anda URL'de görünen dili döner ("en" | "tr").
 */
export function getCurrentLang() {
  return splitLocalePath(window.location.pathname).lang;
}

/**
 * Route eşleştirme için kullanılan mantıksal path (lang prefix'i çıkarılmış).
 */
export function getCurrentPath() {
  return splitLocalePath(window.location.pathname).logicalPath;
}

/**
 * Aktif dilde ve verilen mantıksal path'e gezinir.
 *   navigate("/info")           → mevcut dilde göster (lang prefix yoksa)
 *   navigate("/info", "tr")     → dili tr'ye çevirip git
 *   navigate("/tr/info")        → açıkça tr olarak yorumlanır → tr'ye geçer
 *
 * `<a href="/info">` (lang-agnostic) linkleri mevcut dili KORUR;
 * sadece `<a href="/tr/info">` veya `<a href="/info" lang="en">` benzeri
 * açık talimatlar dili değiştirir.
 */
export function navigate(path, lang = null) {
  let p = String(path || '/');
  if (p.startsWith('#')) p = p.slice(1) || '/';
  if (!p.startsWith('/')) p = `/${p}`;

  const split = splitLocalePath(p);
  const targetLang = lang || (split.hasExplicitLang ? split.lang : getCurrentLang());
  const target = localizedPath(split.logicalPath, targetLang);

  if (target !== window.location.pathname + window.location.search) {
    window.history.pushState({}, '', target);
  }
  window.dispatchEvent(new CustomEvent('routechange'));
}

export function getParams() {
  const path = getCurrentPath();
  for (const pattern of Object.keys(routes)) {
    const match = matchRoute(pattern, path);
    if (match) return match.params;
  }
  return {};
}

function matchRoute(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return { params };
}

/* ───────────── Link click interceptor ───────────── */

function attachLinkInterceptor() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const link = e.target.closest('a[href]');
    if (!link) return;

    const target = link.getAttribute('target');
    if (target && target !== '_self') return;

    const href = link.getAttribute('href');
    if (!href) return;
    if (link.hasAttribute('download')) return;
    if ((link.getAttribute('rel') || '').includes('external')) return;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (href.startsWith('http://') || href.startsWith('https://')) return;
    if (href.startsWith('#')) return; // sayfa içi anchor

    e.preventDefault();
    navigate(href);
  });
}

/* ───────────── Boot ───────────── */

export function startRouter() {
  const handleRoute = async () => {
    const path = getCurrentPath();
    const app = document.getElementById('app');

    let matched = false;
    for (const [pattern, handler] of Object.entries(routes)) {
      const match = matchRoute(pattern, path);
      if (match) {
        if (currentCleanup) {
          currentCleanup();
          currentCleanup = null;
        }

        app.classList.remove('page-active');
        app.classList.add('page-enter');

        const cleanup = await handler(app, match.params);
        if (typeof cleanup === 'function') currentCleanup = cleanup;

        requestAnimationFrame(() => {
          app.classList.remove('page-enter');
          app.classList.add('page-active');
        });

        updateActiveNav(path);
        updateNavLinkLocales();
        window.scrollTo(0, 0);
        matched = true;
        break;
      }
    }

    if (!matched) {
      navigate('/');
    }
  };

  attachLinkInterceptor();

  window.addEventListener('popstate', handleRoute);
  window.addEventListener('routechange', handleRoute);

  // Eski hash'ler (#/info) için geri uyumluluk
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const target = window.location.hash.slice(1) || '/';
    window.history.replaceState({}, '', target);
  }

  handleRoute();
}

/* ───────────── Nav state ───────────── */

function updateActiveNav(logicalPath) {
  document.querySelectorAll('.main-nav .nav-link, .mobile-nav .nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    const split = splitLocalePath(href);
    const linkLogicalPath = split.logicalPath;
    const isActive =
      linkLogicalPath === logicalPath ||
      (logicalPath === '/' && (linkLogicalPath === '/' || linkLogicalPath === ''));
    link.classList.toggle('active', isActive);
  });
}

/**
 * Sayfa içindeki nav link'lerini aktif dile göre rewrite eder.
 * (Header logo + menü + mobil nav). Diğer içerik linkleri zaten
 * şablonlarda `localizedPath()` ile üretilir.
 */
function updateNavLinkLocales() {
  const lang = getCurrentLang();
  document.querySelectorAll(
    '.main-nav .nav-link, .mobile-nav .nav-link, .logo-link',
  ).forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;
    const split = splitLocalePath(href);
    link.setAttribute('href', localizedPath(split.logicalPath, lang));
  });
}
