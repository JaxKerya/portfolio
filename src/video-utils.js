/**
 * Video platform yardımcıları — Vimeo + YouTube
 *
 * DB şeması (vimeo_url, vimeo_id) korunur ama generic "video URL/ID" olarak
 * kullanılır. Platform her zaman URL'den çalışma anında çıkarılır.
 */

const VIMEO_RE = /(?:vimeo\.com\/(?:channels\/[\w-]+\/|groups\/[\w-]+\/videos\/|video\/)?)(\d+)/i;
const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/i;

/**
 * URL'den platform tespit et.
 * @returns {'vimeo' | 'youtube' | null}
 */
export function detectPlatform(url) {
  if (!url) return null;
  if (YOUTUBE_RE.test(url)) return 'youtube';
  if (VIMEO_RE.test(url)) return 'vimeo';
  return null;
}

/**
 * Platforma göre video ID'sini çıkarır.
 */
export function extractVideoId(url, platform = null) {
  if (!url) return '';
  const p = platform || detectPlatform(url);
  if (p === 'youtube') {
    const m = url.match(YOUTUBE_RE);
    return m ? m[1] : '';
  }
  if (p === 'vimeo') {
    const m = url.match(VIMEO_RE);
    return m ? m[1] : '';
  }
  return '';
}

/**
 * Video kapak resmi URL'si.
 * - Vimeo: vumbnail.com (dış servis, 16:9)
 * - YouTube: i.ytimg.com — maxresdefault denenir, yoksa <img onerror> ile hqdefault'a düşer
 */
export function getVideoThumb(platform, id) {
  if (!id) return '';
  if (platform === 'youtube') return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  if (platform === 'vimeo') return `https://vumbnail.com/${id}.jpg`;
  return '';
}

/**
 * YouTube için maxresdefault yoksa fallback URL'si (her video için var olan).
 */
export function getYoutubeFallbackThumb(id) {
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

/**
 * Embed iframe URL'si.
 */
export function getEmbedUrl(platform, id) {
  if (!id) return '';
  if (platform === 'youtube') {
    return `https://www.youtube.com/embed/${id}?modestbranding=1&rel=0&playsinline=1`;
  }
  if (platform === 'vimeo') {
    return `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`;
  }
  return '';
}

/**
 * Bir video kaydından (DB satırı) platform + id + embed/thumb url'leri tek seferde üretir.
 * @param {{ vimeo_url?: string, vimeo_id?: string, thumbnail_url?: string }} v
 */
export function resolveVideo(v) {
  const url = v?.vimeo_url || '';
  const platform = detectPlatform(url);
  const id = v?.vimeo_id || extractVideoId(url, platform);
  return {
    platform,
    id,
    autoThumb: getVideoThumb(platform, id),
    embedUrl: getEmbedUrl(platform, id),
  };
}

/**
 * <img> elementine YouTube fallback davranışı ekler:
 * maxres yüklenemezse hqdefault'a, o da olmazsa olduğu gibi bırakır.
 */
export function attachYoutubeThumbFallback(imgEl, id) {
  if (!imgEl || !id) return;
  let triedFallback = false;
  imgEl.addEventListener('error', () => {
    if (triedFallback) return;
    triedFallback = true;
    imgEl.src = getYoutubeFallbackThumb(id);
  });
}
