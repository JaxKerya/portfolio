/**
 * scripts/generate-sitemap.mjs
 *
 * Build sırasında Supabase'den aktif videoları çekip
 * `public/sitemap.xml`'i bu videolarla doldurur.
 *
 * Vite build çalıştırılmadan önce `npm run prebuild` adımı tarafından
 * tetiklenir (package.json'da tanımlı). Vite `public/` klasörünü
 * doğrudan `dist/`'e kopyaladığı için bu yaklaşım yeterli.
 *
 * Hata durumunda build'i kırmak istemiyoruz; bunun yerine bilgi mesajı
 * basıp mevcut sitemap.xml ile devam ediyoruz.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'public', 'sitemap.xml');

const SITE = 'https://rabiagol.com';
const SUPABASE_URL = 'https://klboimyqmnskaghdgfaq.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsYm9pbXlxbW5za2FnaGRnZmFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDkxNDIsImV4cCI6MjA3NDAyNTE0Mn0.g-_A4o91e4h7NEEIKOrINuaB4S0mrB7qaD3ol1wzuz0';

const today = new Date().toISOString().slice(0, 10);

/* ───────────── Yardımcılar ───────────── */

const VIMEO_RE = /(?:vimeo\.com\/(?:channels\/[\w-]+\/|groups\/[\w-]+\/videos\/|video\/)?)(\d+)/i;
const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/i;

function detectPlatform(url) {
  if (!url) return null;
  if (YOUTUBE_RE.test(url)) return 'youtube';
  if (VIMEO_RE.test(url)) return 'vimeo';
  return null;
}

function extractVideoId(url, platform) {
  if (!url) return null;
  if (platform === 'youtube') {
    const m = url.match(YOUTUBE_RE);
    return m ? m[1] : null;
  }
  if (platform === 'vimeo') {
    const m = url.match(VIMEO_RE);
    return m ? m[1] : null;
  }
  return null;
}

function autoThumb(platform, id) {
  if (!platform || !id) return null;
  if (platform === 'youtube') return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  if (platform === 'vimeo') return `https://vumbnail.com/${id}.jpg`;
  return null;
}

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtDate(input) {
  if (!input) return today;
  try {
    return new Date(input).toISOString().slice(0, 10);
  } catch {
    return today;
  }
}

/* ───────────── Supabase'den veri çek ───────────── */

async function fetchActiveVideos() {
  const url =
    `${SUPABASE_URL}/rest/v1/videos?select=*&is_active=eq.true&order=sort_order.asc`;

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
    console.warn(`[sitemap] Supabase'den video çekilemedi: ${err?.message || err}`);
    return [];
  }
}

/* ───────────── XML kur ───────────── */

/**
 * Mantıksal path'i (ör. "/info") iki dilin URL'sine çevirir.
 *   /info        → en
 *   /tr/info     → tr
 *   /            → en
 *   /tr          → tr
 */
function localizedUrl(logicalPath, lang) {
  let p = logicalPath || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (lang === 'tr') return p === '/' ? `${SITE}/tr` : `${SITE}/tr${p}`;
  return `${SITE}${p}`;
}

/**
 * Verilen mantıksal path için iki dilli (EN + TR) <url> blokları üretir.
 * Her bir URL kendi içinde TÜM hreflang varyasyonlarını listeler — Google
 * dokümantasyonuna göre her alternatif sayfa kendi dilinde de bu listeyi
 * tekrarlamalıdır.
 */
function urlsForPath({ path, lastmod, changefreq, priority, extraXml = '' }) {
  const enUrl = localizedUrl(path, 'en');
  const trUrl = localizedUrl(path, 'tr');
  const hreflang = `
    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>
    <xhtml:link rel="alternate" hreflang="tr" href="${trUrl}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}"/>`;

  return [
    `
  <url>
    <loc>${enUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${hreflang}${extraXml}
  </url>`,
    `
  <url>
    <loc>${trUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${(parseFloat(priority) - 0.1).toFixed(1)}</priority>${hreflang}${extraXml}
  </url>`,
  ];
}

function buildSitemap(videos) {
  const urls = [];

  // Ana sayfa (en + tr)
  urls.push(...urlsForPath({
    path: '/',
    lastmod: today,
    changefreq: 'weekly',
    priority: '1.0',
  }));

  // Hakkımda
  urls.push(...urlsForPath({
    path: '/info',
    lastmod: today,
    changefreq: 'monthly',
    priority: '0.8',
  }));

  // İletişim
  urls.push(...urlsForPath({
    path: '/contact',
    lastmod: today,
    changefreq: 'monthly',
    priority: '0.7',
  }));

  // Videolar
  videos.forEach((v) => {
    const platform = detectPlatform(v.vimeo_url);
    const vidId = extractVideoId(v.vimeo_url, platform);
    const thumb = v.thumbnail_url || autoThumb(platform, vidId);

    const titleEn = v.title_en || v.title_tr || 'Untitled';
    const titleTr = v.title_tr || v.title_en || 'Başlıksız';
    const descEn = v.description_en || v.description_tr || titleEn;
    const descTr = v.description_tr || v.description_en || titleTr;

    const lastmod = fmtDate(v.updated_at || v.created_at);
    const upload = fmtDate(v.created_at);

    let videoBlock = '';
    if (thumb) {
      videoBlock = `
    <image:image>
      <image:loc>${escapeXml(thumb)}</image:loc>
      <image:title>${escapeXml(titleEn)}</image:title>
      <image:caption>${escapeXml(descEn).slice(0, 200)}</image:caption>
    </image:image>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumb)}</video:thumbnail_loc>
      <video:title>${escapeXml(titleEn)}</video:title>
      <video:description>${escapeXml(descEn).slice(0, 2000)}</video:description>
      ${v.vimeo_url ? `<video:content_loc>${escapeXml(v.vimeo_url)}</video:content_loc>` : ''}
      <video:player_loc>${SITE}/video/${escapeXml(v.id)}</video:player_loc>
      <video:publication_date>${upload}T00:00:00+00:00</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:live>no</video:live>
      <video:platform relationship="allow">web</video:platform>
      <video:tag>3D animation</video:tag>
      <video:tag>character animation</video:tag>
      <video:tag>Maya</video:tag>
      <video:tag>Rabia Göl</video:tag>
      <video:category>Animation</video:category>
      <video:uploader info="${SITE}">Rabia Göl</video:uploader>
    </video:video>`;
    }

    urls.push(...urlsForPath({
      path: `/video/${escapeXml(v.id)}`,
      lastmod,
      changefreq: 'monthly',
      priority: '0.9',
      extraXml: videoBlock,
    }));
    // İleride TR varyantına ayrı description vermek isteyenler için elimizde.
    void descTr;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Bu dosya scripts/generate-sitemap.mjs tarafından otomatik üretilir.
  Elle değiştirme: \`npm run build\` veya \`npm run sitemap\` her seferinde üzerine yazar.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls.join('\n')}
</urlset>
`;
}

/* ───────────── Çalıştır ───────────── */

async function main() {
  const videos = await fetchActiveVideos();
  console.log(`[sitemap] ${videos.length} aktif video bulundu`);

  const xml = buildSitemap(videos);
  writeFileSync(OUT_PATH, xml, 'utf8');
  console.log(`[sitemap] yazıldı → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('[sitemap] beklenmeyen hata:', err);
  // Build'i kırmıyoruz: mevcut sitemap.xml ile devam edilecek.
  process.exit(0);
});
