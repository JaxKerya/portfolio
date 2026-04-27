import { getVideos } from '../supabase.js';
import { t, getLang } from '../i18n.js';
import { resolveVideo, attachYoutubeThumbFallback } from '../video-utils.js';
import { setMeta, personSchema, collectionPageSchema, breadcrumbSchema } from '../seo.js';
import { SITE, abs } from '../site-config.js';
import { localizedPath } from '../router.js';

/**
 * HOME PAGE — 3-column video grid
 */
export async function renderHome(container) {
  const lang = getLang();
  const isTr = lang === 'tr';

  // İlk render: meta'yı (videolar yüklenmeden) sabit değerlerle set et;
  // videolar geldiğinde ItemList'i refresh edeceğiz.
  setMeta({
    title: undefined, // ana sayfada baseTitle kullanılır
    description: isTr ? SITE.description.tr : SITE.description.en,
    type: 'website',
    locale: isTr ? 'tr_TR' : 'en_US',
    keywords: SITE.keywords.join(', '),
    path: '/',
    structuredData: [
      personSchema({
        jobTitle: isTr ? SITE.jobTitle.tr : SITE.jobTitle.en,
      }),
      breadcrumbSchema([
        { name: isTr ? 'Ana Sayfa' : 'Home', url: '/' },
      ]),
    ],
  });

  container.innerHTML = `
    <div class="video-grid" id="videoGrid">
      ${Array(6).fill('').map(() => `
        <div class="video-card skeleton" style="aspect-ratio:16/9;"></div>
      `).join('')}
    </div>
  `;

  try {
    const videos = await getVideos();
    const grid = document.getElementById('videoGrid');

    if (!videos || videos.length === 0) {
      grid.innerHTML = `<p style="text-align:center;color:var(--color-text-muted);grid-column:1/-1;padding:60px 0;">${t('home.empty')}</p>`;
      return;
    }

    grid.innerHTML = videos.map(video => {
      const { platform, id: vid, autoThumb } = resolveVideo(video);
      const thumb = video.thumbnail_url || autoThumb;
      const title = isTr
        ? (video.title_tr || video.title_en || '')
        : (video.title_en || video.title_tr || '');

      const usingAutoThumb = !video.thumbnail_url || video.thumbnail_url === autoThumb;
      const ytFallbackAttr = (platform === 'youtube' && usingAutoThumb)
        ? `data-platform="youtube" data-vid="${vid}"`
        : '';

      return `
        <a href="${localizedPath(`/video/${video.id}`, lang)}" class="video-card" data-id="${video.id}">
          <img src="${thumb}" alt="${title}" loading="lazy" ${ytFallbackAttr}>
          <div class="card-overlay">
            <div class="card-title">${title}</div>
          </div>
        </a>
      `;
    }).join('');

    // YouTube maxres -> hqdefault fallback
    grid.querySelectorAll('img[data-platform="youtube"]').forEach(img => {
      attachYoutubeThumbFallback(img, img.dataset.vid);
    });

    // Videolar yüklendi — ItemList'i içerecek şekilde structured data'yı tazele.
    const itemListVideos = videos.map((video) => {
      const { autoThumb } = resolveVideo(video);
      const title = isTr
        ? (video.title_tr || video.title_en || 'Untitled')
        : (video.title_en || video.title_tr || 'Untitled');
      return {
        id: video.id,
        title,
        thumbnailUrl: video.thumbnail_url || autoThumb,
      };
    });

    setMeta({
      title: undefined,
      description: isTr ? SITE.description.tr : SITE.description.en,
      type: 'website',
      locale: isTr ? 'tr_TR' : 'en_US',
      keywords: SITE.keywords.join(', '),
      path: '/',
      image: itemListVideos[0]?.thumbnailUrl
        ? abs(itemListVideos[0].thumbnailUrl)
        : undefined,
      structuredData: [
        personSchema({
          jobTitle: isTr ? SITE.jobTitle.tr : SITE.jobTitle.en,
        }),
        collectionPageSchema({ lang, videos: itemListVideos }),
        breadcrumbSchema([
          { name: isTr ? 'Ana Sayfa' : 'Home', url: '/' },
        ]),
      ],
    });

  } catch (err) {
    console.error('Home render error:', err);
  }
}
