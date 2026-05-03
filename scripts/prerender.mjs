/**
 * scripts/prerender.mjs
 *
 * Vite build'in ÜRETTİĞİ `dist/index.html`'i şablon olarak alıp her route için
 * (HEM English HEM Turkish dilinde) statik HTML üretir.
 *
 * URL şeması:
 *   - English (default):
 *       /                           → dist/index.html
 *       /info, /contact             → dist/info/index.html, dist/contact/index.html
 *       /video/:id                  → dist/video/:id/index.html
 *   - Turkish:
 *       /tr                         → dist/tr/index.html
 *       /tr/info, /tr/contact       → dist/tr/info/index.html, ...
 *       /tr/video/:id               → dist/tr/video/:id/index.html
 *
 * Her HTML kendi dilinde `<title>`, `description`, OG/Twitter, canonical,
 * hreflang ve JSON-LD ile gelir — bu sayede sosyal medya bot'ları, Bing,
 * Yandex, DuckDuckGo gibi JS render etmeyen crawler'lar her sayfada doğru
 * metadata görür.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SITE, abs, socialLinks } from '../src/site-config.js';
import {
  personSchema,
  videoSchema,
  breadcrumbSchema,
  faqSchema,
  contactPageSchema,
  aboutPageSchema,
  collectionPageSchema,
} from '../src/seo.js';
import {
  detectPlatform,
  extractVideoId,
  getVideoThumb,
  getEmbedUrl,
} from '../src/video-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const SUPABASE_URL = 'https://klboimyqmnskaghdgfaq.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsYm9pbXlxbW5za2FnaGRnZmFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDkxNDIsImV4cCI6MjA3NDAyNTE0Mn0.g-_A4o91e4h7NEEIKOrINuaB4S0mrB7qaD3ol1wzuz0';

/* ───────────── Şablon ───────────── */

let TEMPLATE = '';
try {
  TEMPLATE = readFileSync(join(DIST, 'index.html'), 'utf8');
} catch (err) {
  console.error('[prerender] dist/index.html bulunamadı. Önce `npm run build` çalıştırın.');
  console.error(err.message);
  process.exit(1);
}

/* ───────────── Yardımcılar ───────────── */

function escAttr(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escText(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Mantıksal path'i (ör. "/info") iki dilin URL'sine çevirir.
 *   ("/info", "tr") → "/tr/info"
 *   ("/info", "en") → "/info"
 *   ("/", "tr")     → "/tr"
 */
function localizedPath(logicalPath = '/', lang = 'en') {
  let p = String(logicalPath || '/');
  if (!p.startsWith('/')) p = `/${p}`;
  if (lang === 'tr') return p === '/' ? '/tr' : `/tr${p}`;
  return p;
}

/**
 * Template içindeki <meta> etiketinin `content`'ini değiştirir.
 */
function replaceMeta(html, attr, key, value) {
  if (value === undefined || value === null) return html;
  const re = new RegExp(`(<meta\\s+${attr}=\"${key}\"[^>]*content=\")[^\"]*(\")`, 'i');
  if (re.test(html)) {
    return html.replace(re, `$1${escAttr(value)}$2`);
  }
  const tag = `  <meta ${attr}="${key}" content="${escAttr(value)}">\n`;
  return html.replace('</head>', `${tag}</head>`);
}

function replaceTitle(html, value) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escText(value)}</title>`);
}

function replaceCanonical(html, url) {
  if (!url) return html;
  if (/<link\s+rel="canonical"/i.test(html)) {
    return html.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/i,
      `$1${escAttr(url)}$2`,
    );
  }
  return html.replace('</head>', `  <link rel="canonical" href="${escAttr(url)}">\n</head>`);
}

function replaceHreflang(html, urlsByLang) {
  let out = html.replace(/<link\s+rel="alternate"\s+hreflang="[^"]+"[^>]*>\n?/gi, '');
  const block = Object.entries(urlsByLang)
    .map(([lang, u]) => `  <link rel="alternate" hreflang="${lang}" href="${escAttr(u)}">`)
    .join('\n');
  return out.replace('</head>', `${block}\n</head>`);
}

function injectJsonLd(html, schemas) {
  if (!schemas || schemas.length === 0) return html;
  const blocks = schemas
    .filter(Boolean)
    .map((obj, i) => {
      const json = JSON.stringify(obj).replace(/</g, '\\u003c');
      return `  <script type="application/ld+json" data-seo="page" id="seo-structured-data-${i}">${json}</script>`;
    })
    .join('\n');
  return html.replace('</head>', `${blocks}\n</head>`);
}

function setHtmlLang(html, lang) {
  return html.replace(/<html[^>]*\blang="[^"]*"/i, `<html lang="${lang}"`);
}

/**
 * Statik nav linklerinin href'lerini ilgili dile göre rewrite eder.
 * (Header logo, ana menü, mobil nav). Bu sayede Turkish sayfaları
 * `/tr/info` gibi linklerle gelir; SPA hydrate olmadan bile linkler
 * doğru hedefe gider.
 */
function rewriteNavLinks(html, lang) {
  const internalPaths = ['/', '/info', '/contact'];
  return html.replace(/<a\s+([^>]*?)href="([^"]+)"([^>]*)>/gi, (match, before, href, after) => {
    if (!internalPaths.includes(href)) return match;
    const localized = localizedPath(href, lang);
    return `<a ${before}href="${localized}"${after}>`;
  });
}

function buildPage({
  html: baseHtml,
  title,
  description,
  url,
  image,
  imageAlt,
  type = 'website',
  locale = 'en_US',
  keywords,
  schemas = [],
  hreflang,
  noindex = false,
  lang = 'en',
}) {
  let html = baseHtml;
  const isTr = lang === 'tr';
  // Tutarlı format: "<title> — Rabia Göl" (live setMeta ile aynı).
  // Title verilmediyse anasayfa fallback'i kullanılır.
  const baseTitle = `${SITE.name} — ${isTr ? SITE.jobTitle.tr : SITE.jobTitle.en}`;
  const fullTitle = title ? `${title} — ${SITE.name}` : baseTitle;

  html = setHtmlLang(html, lang);
  html = replaceTitle(html, fullTitle);
  html = replaceMeta(html, 'name', 'title', fullTitle);
  html = replaceMeta(html, 'name', 'description', description || SITE.description.en);
  if (keywords) html = replaceMeta(html, 'name', 'keywords', keywords);
  html = replaceMeta(
    html,
    'name',
    'robots',
    noindex
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  );

  // Open Graph
  html = replaceMeta(html, 'property', 'og:title', fullTitle);
  html = replaceMeta(html, 'property', 'og:description', description || SITE.description.en);
  html = replaceMeta(html, 'property', 'og:type', type);
  html = replaceMeta(html, 'property', 'og:url', url);
  html = replaceMeta(html, 'property', 'og:image', image || abs(SITE.ogImage));
  html = replaceMeta(html, 'property', 'og:image:alt', imageAlt || fullTitle);
  html = replaceMeta(html, 'property', 'og:locale', locale);
  html = replaceMeta(
    html,
    'property',
    'og:locale:alternate',
    locale === 'tr_TR' ? 'en_US' : 'tr_TR',
  );

  // Twitter
  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = replaceMeta(html, 'name', 'twitter:url', url);
  html = replaceMeta(html, 'name', 'twitter:title', fullTitle);
  html = replaceMeta(html, 'name', 'twitter:description', description || SITE.description.en);
  html = replaceMeta(html, 'name', 'twitter:image', image || abs(SITE.twitterImage));
  html = replaceMeta(html, 'name', 'twitter:image:alt', imageAlt || fullTitle);

  if (url) html = replaceCanonical(html, url);
  if (hreflang) html = replaceHreflang(html, hreflang);

  if (schemas && schemas.length > 0) html = injectJsonLd(html, schemas);

  html = rewriteNavLinks(html, lang);

  return html;
}

/**
 * `routePath` mantıksal path ("/info"). `lang` kullanılarak fiziksel
 * dosya yoluna çevrilir.
 */
function writePage(routePath, lang, html) {
  const physicalPath = localizedPath(routePath, lang);
  let dir;
  let outPath;
  if (physicalPath === '/') {
    dir = DIST;
    outPath = join(DIST, 'index.html');
  } else {
    dir = join(DIST, physicalPath.replace(/^\//, ''));
    outPath = join(dir, 'index.html');
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, html, 'utf8');
}

/* ───────────── Supabase ───────────── */

async function fetchActiveVideos() {
  const url = `${SUPABASE_URL}/rest/v1/videos?select=*&is_active=eq.true&order=sort_order.asc`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[prerender] Supabase'den video çekilemedi: ${err?.message || err}`);
    return [];
  }
}

/* ───────────── Yardımcı: hreflang seti ───────────── */

function hreflangFor(logicalPath) {
  return {
    en: `${SITE.domain}${localizedPath(logicalPath, 'en')}`,
    tr: `${SITE.domain}${localizedPath(logicalPath, 'tr')}`,
    'x-default': `${SITE.domain}${localizedPath(logicalPath, 'en')}`,
  };
}

/* ───────────── Route'lar ───────────── */

function buildHomePage(videos, lang) {
  const isTr = lang === 'tr';
  const url = `${SITE.domain}${localizedPath('/', lang)}`;
  const itemListVideos = videos.map((v) => {
    const platform = detectPlatform(v.vimeo_url);
    const id = extractVideoId(v.vimeo_url, platform);
    const title = isTr
      ? (v.title_tr || v.title_en || 'Başlıksız')
      : (v.title_en || v.title_tr || 'Untitled');
    return {
      id: v.id,
      title,
      thumbnailUrl: v.thumbnail_url || (id ? getVideoThumb(platform, id) : null),
    };
  });
  const heroImage = itemListVideos[0]?.thumbnailUrl
    ? abs(itemListVideos[0].thumbnailUrl)
    : abs(SITE.ogImage);

  return buildPage({
    html: TEMPLATE,
    title: undefined,
    description: isTr ? SITE.description.tr : SITE.description.en,
    url,
    image: heroImage,
    type: 'website',
    locale: isTr ? 'tr_TR' : 'en_US',
    lang,
    keywords: SITE.keywords.join(', '),
    hreflang: hreflangFor('/'),
    schemas: [
      personSchema({ jobTitle: isTr ? SITE.jobTitle.tr : SITE.jobTitle.en }),
      collectionPageSchema({ url, lang, videos: itemListVideos }),
      breadcrumbSchema([{ name: isTr ? 'Ana Sayfa' : 'Home', url: localizedPath('/', lang) }]),
    ],
  });
}

function buildInfoPage(lang) {
  const isTr = lang === 'tr';
  const url = `${SITE.domain}${localizedPath('/info', lang)}`;
  const faqList = SITE.faq.map((f) => ({
    q: isTr ? f.tr.q : f.en.q,
    a: isTr ? f.tr.a : f.en.a,
  }));
  return buildPage({
    html: TEMPLATE,
    title: isTr ? 'Hakkımda' : 'About',
    description: isTr
      ? 'Rabia Göl — Antalya merkezli profesyonel 3D karakter animatörü. Biyografi, yetenekler, eğitim ve SSS.'
      : 'Rabia Göl — Professional 3D Character Animator based in Antalya, Turkey. Bio, skills, education and FAQ.',
    url,
    image: abs(SITE.ogImage),
    imageAlt: isTr ? 'Rabia Göl — 3D Karakter Animatörü' : 'Rabia Göl — 3D Character Animator',
    type: 'profile',
    locale: isTr ? 'tr_TR' : 'en_US',
    lang,
    keywords: SITE.keywords.join(', '),
    hreflang: hreflangFor('/info'),
    schemas: [
      personSchema({ jobTitle: isTr ? SITE.jobTitle.tr : SITE.jobTitle.en }),
      aboutPageSchema({ url, lang }),
      faqSchema(faqList),
      breadcrumbSchema([
        { name: isTr ? 'Ana Sayfa' : 'Home', url: localizedPath('/', lang) },
        { name: isTr ? 'Hakkımda' : 'About', url: localizedPath('/info', lang) },
      ]),
    ],
  });
}

function buildContactPage(lang) {
  const isTr = lang === 'tr';
  const url = `${SITE.domain}${localizedPath('/contact', lang)}`;
  return buildPage({
    html: TEMPLATE,
    title: isTr ? 'İletişim' : 'Contact',
    description: isTr
      ? 'Rabia Göl ile iletişime geçin — 3D karakter animasyonu projeleri ve iş fırsatları için.'
      : 'Get in touch with Rabia Göl — for 3D character animation projects and work opportunities.',
    url,
    image: abs(SITE.ogImage),
    type: 'website',
    locale: isTr ? 'tr_TR' : 'en_US',
    lang,
    keywords: SITE.keywords.join(', '),
    hreflang: hreflangFor('/contact'),
    schemas: [
      contactPageSchema({ url, lang }),
      breadcrumbSchema([
        { name: isTr ? 'Ana Sayfa' : 'Home', url: localizedPath('/', lang) },
        { name: isTr ? 'İletişim' : 'Contact', url: localizedPath('/contact', lang) },
      ]),
    ],
  });
}

function buildVideoPage(v, lang) {
  const isTr = lang === 'tr';
  const platform = detectPlatform(v.vimeo_url);
  const vidId = extractVideoId(v.vimeo_url, platform);
  const thumb =
    v.thumbnail_url || (platform && vidId ? getVideoThumb(platform, vidId) : null);
  const seoThumb = thumb ? abs(thumb) : abs(SITE.ogImage);
  const embedUrl = platform && vidId ? getEmbedUrl(platform, vidId) : undefined;

  const title = isTr
    ? (v.title_tr || v.title_en || 'Başlıksız')
    : (v.title_en || v.title_tr || 'Untitled');
  const rawDesc = isTr
    ? (v.description_tr || v.description_en || title)
    : (v.description_en || v.description_tr || title);
  const description = String(rawDesc).replace(/\s+/g, ' ').trim().slice(0, 200);
  const logicalPath = `/video/${v.id}`;
  const url = `${SITE.domain}${localizedPath(logicalPath, lang)}`;

  return buildPage({
    html: TEMPLATE,
    title,
    description,
    url,
    image: seoThumb,
    imageAlt: title,
    type: 'video.other',
    locale: isTr ? 'tr_TR' : 'en_US',
    lang,
    keywords: [title, ...SITE.keywords].filter(Boolean).join(', '),
    hreflang: hreflangFor(logicalPath),
    schemas: [
      videoSchema({
        name: title,
        description,
        thumbnailUrl: seoThumb,
        uploadDate: v.created_at,
        contentUrl: v.vimeo_url,
        embedUrl,
        url,
        inLanguage: isTr ? ['tr', 'en'] : ['en', 'tr'],
        keywords: [title, '3D animation', 'character animation', 'Maya'].join(', '),
      }),
      breadcrumbSchema([
        { name: isTr ? 'Ana Sayfa' : 'Home', url: localizedPath('/', lang) },
        { name: title || (isTr ? 'Video' : 'Video'), url: localizedPath(logicalPath, lang) },
      ]),
    ],
  });
}

/* ───────────── Çalıştır ───────────── */

const LANGS = ['en', 'tr'];

async function main() {
  void socialLinks;

  const videos = await fetchActiveVideos();
  console.log(`[prerender] ${videos.length} aktif video bulundu`);

  for (const lang of LANGS) {
    writePage('/', lang, buildHomePage(videos, lang));
    writePage('/info', lang, buildInfoPage(lang));
    writePage('/contact', lang, buildContactPage(lang));

    // Admin sayfası — noindex, SPA hydrate olması için shell yeterli
    writePage('/admin', lang, buildPage({
      html: TEMPLATE,
      title: 'Admin',
      description: 'Admin panel',
      url: `${SITE.domain}${localizedPath('/admin', lang)}`,
      type: 'website',
      locale: lang === 'tr' ? 'tr_TR' : 'en_US',
      lang,
      noindex: true,
      hreflang: hreflangFor('/admin'),
      schemas: [],
    }));

    let count = 0;
    for (const v of videos) {
      if (!v.id) continue;
      writePage(`/video/${v.id}`, lang, buildVideoPage(v, lang));
      count++;
    }
    console.log(`[prerender] ${lang}: / + /info + /contact + /admin + ${count} video sayfası yazıldı`);
  }
}

main().catch((err) => {
  console.error('[prerender] beklenmeyen hata:', err);
  process.exit(0);
});
