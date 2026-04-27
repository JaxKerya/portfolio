import { getVideoById, getVideos } from '../supabase.js';
import { t, getLang } from '../i18n.js';
import { resolveVideo, attachYoutubeThumbFallback, getVideoThumb } from '../video-utils.js';
import { setMeta, videoSchema, breadcrumbSchema } from '../seo.js';
import { SITE, abs } from '../site-config.js';
import { localizedPath } from '../router.js';

/**
 * VIDEO DETAIL PAGE — Vimeo/YouTube embed + info + bottom grid
 */
export async function renderVideo(container, params) {
  const lang = getLang();
  const { id } = params;

  container.innerHTML = `
    <div class="video-detail">
      <div class="video-embed-wrapper skeleton" style="aspect-ratio:16/9;"></div>
    </div>
  `;

  try {
    const [video, allVideos] = await Promise.all([
      getVideoById(id),
      getVideos()
    ]);

    if (!video) {
      container.innerHTML = `<p style="text-align:center;padding:80px 0;color:var(--color-text-muted);">Video not found.</p>`;
      return;
    }

    const { embedUrl, platform, id: vidId, autoThumb } = resolveVideo(video);
    const title = lang === 'tr'
      ? (video.title_tr || video.title_en || '')
      : (video.title_en || video.title_tr || '');
    const desc = lang === 'tr'
      ? (video.description_tr || video.description_en || '')
      : (video.description_en || video.description_tr || '');

    // SEO + sosyal paylaşım kartları
    const isTr = lang === 'tr';
    const seoThumb = video.thumbnail_url || autoThumb || getVideoThumb(platform, vidId);
    const seoThumbAbs = seoThumb ? abs(seoThumb) : undefined;
    const videoLogicalPath = `/video/${id}`;
    const seoDesc = (desc || title || SITE.description.en).replace(/\s+/g, ' ').trim().slice(0, 200);

    setMeta({
      title,
      description: seoDesc,
      type: 'video.other',
      image: seoThumbAbs,
      imageAlt: title,
      path: videoLogicalPath,
      locale: isTr ? 'tr_TR' : 'en_US',
      keywords: [title, ...SITE.keywords].filter(Boolean).join(', '),
      structuredData: [
        videoSchema({
          name: title,
          description: seoDesc,
          thumbnailUrl: seoThumbAbs,
          uploadDate: video.created_at,
          contentUrl: video.vimeo_url,
          embedUrl,
          url: `${SITE.domain}${videoLogicalPath}`,
          inLanguage: isTr ? ['tr', 'en'] : ['en', 'tr'],
          keywords: [title, '3D animation', 'character animation', 'Maya'].join(', '),
        }),
        breadcrumbSchema([
          { name: isTr ? 'Ana Sayfa' : 'Home', url: '/' },
          { name: title || (isTr ? 'Video' : 'Video'), url: videoLogicalPath },
        ]),
      ],
    });

    // Find prev/next
    const currentIndex = allVideos.findIndex(v => v.id === id);
    const prev = currentIndex > 0 ? allVideos[currentIndex - 1] : null;
    const next = currentIndex < allVideos.length - 1 ? allVideos[currentIndex + 1] : null;

    container.innerHTML = `
      <div class="video-detail">
        <div class="video-embed-wrapper">
          ${embedUrl
            ? `<iframe src="${embedUrl}"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowfullscreen></iframe>`
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);">Video kaynağı tanınamadı.</div>`
          }
        </div>

        <div class="video-meta">
          <h1>${title}</h1>
          ${desc ? `<p class="video-description">${desc}</p>` : ''}
        </div>

        <div class="video-nav">
          <a href="${localizedPath('/', lang)}">${t('video.backToHome')}</a>
          <div class="nav-arrows">
            ${prev
              ? `<a href="${localizedPath(`/video/${prev.id}`, lang)}">${t('video.prev')}</a>`
              : `<span class="disabled">${t('video.prev')}</span>`
            }
            <span style="color:var(--color-text-muted);">/</span>
            ${next
              ? `<a href="${localizedPath(`/video/${next.id}`, lang)}">${t('video.next')}</a>`
              : `<span class="disabled">${t('video.next')}</span>`
            }
          </div>
        </div>

        <div class="detail-grid-section">
          <div class="video-grid" id="detailVideoGrid">
            ${allVideos.map(v => {
              const r = resolveVideo(v);
              const thumb = v.thumbnail_url || r.autoThumb;
              const vTitle = lang === 'tr'
                ? (v.title_tr || v.title_en || '')
                : (v.title_en || v.title_tr || '');
              const usingAutoThumb = !v.thumbnail_url || v.thumbnail_url === r.autoThumb;
              const ytFallbackAttr = (r.platform === 'youtube' && usingAutoThumb)
                ? `data-platform="youtube" data-vid="${r.id}"`
                : '';
              return `
                <a href="${localizedPath(`/video/${v.id}`, lang)}" class="video-card ${v.id === id ? 'current' : ''}" data-id="${v.id}">
                  <img src="${thumb}" alt="${vTitle}" loading="lazy" ${ytFallbackAttr}>
                  <div class="card-overlay">
                    <div class="card-title">${vTitle}</div>
                  </div>
                </a>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    const detailGrid = document.getElementById('detailVideoGrid');
    if (detailGrid) {
      detailGrid.querySelectorAll('img[data-platform="youtube"]').forEach(img => {
        attachYoutubeThumbFallback(img, img.dataset.vid);
      });
    }

  } catch (err) {
    console.error('Video render error:', err);
    container.innerHTML = `<p style="text-align:center;padding:80px 0;color:var(--color-text-muted);">Error loading video.</p>`;
  }
}
