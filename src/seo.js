/**
 * Sayfa bazlı SEO/OG meta tag ve JSON-LD yönetimi.
 *
 * SPA olduğumuz için meta tag'ler her route değişiminde elle güncellenir.
 * Sosyal medya bot'ları (Twitter, LinkedIn, vs.) genelde JS çalıştırmaz —
 * bu nedenle anlık rich preview için pre-render veya SSR gerekir;
 * yine de Google ve modern crawler'lar JS'i render ettiğinden bu yaklaşım
 * çoğu durumda çalışır. Showcase/portföy için yeterli.
 *
 * index.html'de yer alan statik JSON-LD'ler (Person, WebSite, ProfessionalService)
 * her sayfada görünür. setMeta(...) ek olarak sayfaya özel JSON-LD ekler.
 */

import { SITE, abs, socialLinks } from './site-config.js';

const DEFAULTS = {
  siteName: SITE.name,
  baseTitle: `${SITE.name} — ${SITE.jobTitle.en}`,
  description: SITE.description.en,
  url: `${SITE.domain}/`,
  image: abs(SITE.ogImage),
  type: 'website',
  locale: 'en_US',
  twitterHandle: '',
};

/**
 * Mantıksal path'i belirtilen dilin URL'sine çevirir.
 * "/info" + "tr" → "/tr/info"   |  "/info" + "en" → "/info"
 * (Router'daki localizedPath ile aynı mantık; burada Node prerender de
 * kullanabilsin diye yerel kopyası tutuluyor.)
 */
export function localizedSeoPath(logicalPath = '/', lang = 'en') {
  let p = String(logicalPath || '/');
  if (!p.startsWith('/')) p = `/${p}`;
  // Eğer zaten /tr/ prefix'i varsa kazı
  const m = p.match(/^\/(tr)(\/|$)/);
  if (m) p = '/' + p.slice(3).replace(/^\/+/, '');
  if (p === '') p = '/';
  if (lang === 'tr') return p === '/' ? '/tr' : `/tr${p}`;
  return p;
}

const STRUCT_DATA_ID_PREFIX = 'seo-structured-data';

/**
 * @typedef {object} MetaOpts
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [path] - Mantıksal path ("/info"). Verilirse url + hreflang otomatik üretilir.
 * @property {string} [url]  - Açıkça verilirse path'i ezer.
 * @property {string} [image]
 * @property {string} [imageAlt]
 * @property {'website'|'article'|'video.other'|'profile'} [type]
 * @property {'en_US'|'tr_TR'} [locale]
 * @property {string} [keywords]
 * @property {object|object[]|null} [structuredData]
 * @property {boolean} [noindex]
 */

/**
 * Sayfa için meta tag'leri, hreflang link'lerini ve sayfa-özel
 * structured data'yı set eder.
 * @param {MetaOpts} opts
 */
export function setMeta(opts = {}) {
  const title = opts.title
    ? `${opts.title} — ${DEFAULTS.siteName}`
    : DEFAULTS.baseTitle;
  const description = opts.description || DEFAULTS.description;
  const image = opts.image || DEFAULTS.image;
  const imageAlt = opts.imageAlt || title;
  const type = opts.type || DEFAULTS.type;
  const locale = opts.locale || DEFAULTS.locale;
  const lang = locale.startsWith('tr') ? 'tr' : 'en';

  // URL hesaplama: opts.url > opts.path > location.href
  let canonical;
  let altEnUrl;
  let altTrUrl;
  if (opts.url) {
    canonical = opts.url;
  } else if (opts.path) {
    canonical = `${SITE.domain}${localizedSeoPath(opts.path, lang)}`;
    altEnUrl = `${SITE.domain}${localizedSeoPath(opts.path, 'en')}`;
    altTrUrl = `${SITE.domain}${localizedSeoPath(opts.path, 'tr')}`;
  } else if (typeof location !== 'undefined') {
    canonical = location.href.split('#')[0];
  } else {
    canonical = DEFAULTS.url;
  }

  document.title = title;
  document.documentElement.lang = lang;

  setMetaTag('name', 'title', title);
  setMetaTag('name', 'description', description);
  setMetaTag('name', 'robots',
    opts.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  if (opts.keywords) setMetaTag('name', 'keywords', opts.keywords);

  // Open Graph
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:type', type);
  setMetaTag('property', 'og:url', canonical);
  setMetaTag('property', 'og:image', image);
  setMetaTag('property', 'og:image:alt', imageAlt);
  setMetaTag('property', 'og:locale', locale);
  setMetaTag('property', 'og:site_name', DEFAULTS.siteName);
  const altLocale = locale === 'tr_TR' ? 'en_US' : 'tr_TR';
  setMetaTag('property', 'og:locale:alternate', altLocale);

  // Twitter Card
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);
  setMetaTag('name', 'twitter:image', image);
  setMetaTag('name', 'twitter:image:alt', imageAlt);
  if (DEFAULTS.twitterHandle) setMetaTag('name', 'twitter:site', DEFAULTS.twitterHandle);

  setCanonical(canonical);

  // hreflang — yalnızca path bazlı çağrılarda anlamlı
  if (altEnUrl && altTrUrl) {
    setHreflangLinks([
      { lang: 'en', href: altEnUrl },
      { lang: 'tr', href: altTrUrl },
      { lang: 'x-default', href: altEnUrl },
    ]);
  }

  setStructuredData(opts.structuredData);
}

function setMetaTag(attr, key, value) {
  if (!value) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setCanonical(url) {
  if (!url) return;
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

/**
 * `<link rel="alternate" hreflang="..">` etiketlerini set eder.
 * Bizim ürettiklerimizi `data-seo="hreflang"` ile işaretler — eski
 * (statik veya önceki sayfadan kalan) hreflang'leri temizler ki
 * sayfalar arası geçişte stale değerler kalmasın.
 */
function setHreflangLinks(items = []) {
  document.querySelectorAll('link[rel="alternate"][data-seo="hreflang"]').forEach((el) => el.remove());
  items.forEach(({ lang, href }) => {
    if (!href) return;
    const el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', lang);
    el.setAttribute('href', href);
    el.setAttribute('data-seo', 'hreflang');
    document.head.appendChild(el);
  });
}

/**
 * Sayfa-özel JSON-LD'yi günceller. Tek nesne veya nesne dizisi alabilir.
 * `null` verilirse mevcut sayfa-özel şemalar kaldırılır (statik şemalar
 * index.html'de kalmaya devam eder).
 */
function setStructuredData(input) {
  // Önce eski sayfa-özel scriptleri sil
  document.querySelectorAll(`script[data-seo="page"]`).forEach((s) => s.remove());

  if (input === null || input === undefined) return;

  const list = Array.isArray(input) ? input : [input];
  list.forEach((obj, idx) => {
    if (!obj || typeof obj !== 'object') return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = `${STRUCT_DATA_ID_PREFIX}-${idx}`;
    script.setAttribute('data-seo', 'page');
    try {
      script.textContent = JSON.stringify(obj);
    } catch {
      script.textContent = '';
    }
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────
// JSON-LD üreticileri
// ─────────────────────────────────────────────────────────────────────

/**
 * Person şeması — index.html'deki statik Person'a `@id` ile bağlanır,
 * gerektiğinde sayfa bazlı override için kullanılabilir.
 */
export function personSchema({ name, url, image, jobTitle, sameAs } = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE.domain}/#person`,
    name: name || SITE.name,
    url: url || `${SITE.domain}/`,
    image: image || abs(SITE.ogImage),
    jobTitle: jobTitle || SITE.jobTitle.en,
    sameAs: sameAs || socialLinks(),
  };
}

/**
 * VideoObject — Video detay sayfaları için.
 * Google'da rich result çıkma şansını artırır.
 */
export function videoSchema({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  contentUrl,
  embedUrl,
  duration,
  url,
  inLanguage,
  keywords,
} = {}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: name || '',
    description: description || name || SITE.description.en,
    thumbnailUrl: thumbnailUrl ? [thumbnailUrl] : [abs(SITE.ogImage)],
    uploadDate: uploadDate || new Date().toISOString(),
    publisher: { '@id': `${SITE.domain}/#person` },
    creator: { '@id': `${SITE.domain}/#person` },
    inLanguage: inLanguage || ['en', 'tr'],
    isFamilyFriendly: true,
    genre: 'Animation',
    copyrightHolder: { '@id': `${SITE.domain}/#person` },
  };
  if (url) data.url = url;
  if (contentUrl) data.contentUrl = contentUrl;
  if (embedUrl) data.embedUrl = embedUrl;
  if (duration) data.duration = duration;
  if (keywords) data.keywords = keywords;
  return data;
}

/**
 * BreadcrumbList — Sayfa hiyerarşisi.
 * @param {Array<{name: string, url: string}>} items
 */
export function breadcrumbSchema(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: abs(item.url),
    })),
  };
}

/**
 * FAQPage — info sayfası için.
 * @param {Array<{q: string, a: string}>} qaList
 */
export function faqSchema(qaList = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qaList.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

/**
 * ContactPage — iletişim sayfası için.
 */
export function contactPageSchema({ url, lang = 'en' } = {}) {
  const isTr = lang === 'tr';
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: isTr ? 'İletişim - Rabia Göl' : 'Contact - Rabia Göl',
    description: isTr
      ? '3D karakter animasyonu projeleri için Rabia Göl ile iletişime geçin.'
      : 'Get in touch with Rabia Göl for 3D character animation projects.',
    url: url || `${SITE.domain}${localizedSeoPath('/contact', lang)}`,
    inLanguage: isTr ? 'tr-TR' : 'en-US',
    mainEntity: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: SITE.contact.email,
      availableLanguage: ['English', 'Turkish'],
      areaServed: { '@type': 'Country', name: SITE.location.countryName },
    },
    potentialAction: {
      '@type': 'CommunicateAction',
      recipient: { '@id': `${SITE.domain}/#person` },
    },
  };
}

/**
 * AboutPage — info/hakkımda sayfası için.
 */
export function aboutPageSchema({ url, lang = 'en' } = {}) {
  const isTr = lang === 'tr';
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: isTr ? 'Hakkımda - Rabia Göl' : 'About - Rabia Göl',
    description: isTr
      ? 'Rabia Göl hakkında — profesyonel 3D karakter animatörü.'
      : 'About Rabia Göl — professional 3D character animator.',
    url: url || `${SITE.domain}${localizedSeoPath('/info', lang)}`,
    inLanguage: isTr ? 'tr-TR' : 'en-US',
    mainEntity: { '@id': `${SITE.domain}/#person` },
  };
}

/**
 * CollectionPage — Ana sayfanın video listesi için.
 * `videos` parametresi ItemList'e dönüşür.
 */
export function collectionPageSchema({ url, lang = 'en', videos = [] } = {}) {
  const isTr = lang === 'tr';
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isTr ? 'Portfolyo - Rabia Göl' : 'Portfolio - Rabia Göl',
    description: isTr
      ? 'Rabia Göl\'ün 3D karakter animasyonu portfolyosu.'
      : 'Rabia Göl\'s 3D character animation portfolio.',
    url: url || `${SITE.domain}${localizedSeoPath('/', lang)}`,
    inLanguage: isTr ? 'tr-TR' : 'en-US',
    isPartOf: { '@id': `${SITE.domain}/#website` },
    about: { '@id': `${SITE.domain}/#person` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: videos.length,
      itemListElement: videos.map((v, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${SITE.domain}${localizedSeoPath(`/video/${v.id}`, lang)}`,
        name: v.title,
        ...(v.thumbnailUrl ? { image: v.thumbnailUrl } : {}),
      })),
    },
  };
}
