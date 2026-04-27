/**
 * Vimeo API istemcisi — tarayıcıdan doğrudan kullanılır.
 *
 * Vimeo'nun resmi API'si CORS destekler ve tarayıcıdan çağrılabilir.
 *
 * NOT (güvenlik): Aşağıdaki Personal Access Token sadece OKUMA yetkisindedir
 * (Public/Private scope, video silme/yükleme yok). Bundle'a gömüldüğü için
 * teknik olarak ifşa olmuş sayılır; bu kabul edilebilir bir trade-off — biri
 * ele geçirse en fazla zaten Vimeo'da public olan video listemizi görür.
 * İptal/yenileme: https://developer.vimeo.com/apps
 */
export const VIMEO_ACCESS_TOKEN = '9624d0a7bf2fda3a43f6b63d0bf87b41';

const VIMEO_API_BASE = 'https://api.vimeo.com';
const VIMEO_ACCEPT = 'application/vnd.vimeo.*+json;version=3.4';

/**
 * Profil URL'sinden veya kullanıcı adından Vimeo API user yolunu çıkarır.
 * - "https://vimeo.com/user12345" → "users/user12345"
 * - "https://vimeo.com/john"      → "users/john"
 * - "john"                         → "users/john"
 * - boş / null                     → "me"
 */
export function parseVimeoUserPath(input) {
  if (!input || !input.trim()) return 'me';
  let s = input.trim();
  s = s.replace(/^https?:\/\/(www\.)?vimeo\.com\/?/i, '');
  s = s.replace(/\/.*$/, ''); // Sonraki yol parçalarını at (videos vs.)
  s = s.replace(/[?#].*$/, '');
  if (!s) return 'me';
  return `users/${s}`;
}

/**
 * Vimeo URI'sinden video ID'sini çıkarır: "/videos/76979871" → "76979871"
 */
function extractIdFromUri(uri) {
  if (!uri) return '';
  const m = uri.match(/\/videos\/(\d+)/);
  return m ? m[1] : '';
}

/**
 * Vimeo API'den verilen yolun tüm sayfalarını toplar.
 * Sayfalama Vimeo'nun `paging.next` alanı ile sürdürülür.
 *
 * @param {string} token  - Vimeo Personal Access Token
 * @param {string} userPath - "me" veya "users/{id_or_slug}"
 * @param {(loaded: number, total: number|null) => void} [onProgress]
 * @returns {Promise<Array>} Vimeo video kayıtları
 */
export async function fetchAllUserVideos(token, userPath, onProgress) {
  if (!token) throw new Error('Vimeo Access Token gerekli.');

  const fields = 'uri,name,description,link,duration,created_time,privacy.view';
  const perPage = 100;
  let url = `${VIMEO_API_BASE}/${userPath}/videos?per_page=${perPage}&fields=${encodeURIComponent(fields)}&sort=date&direction=desc`;

  const all = [];
  let total = null;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `bearer ${token}`,
        Accept: VIMEO_ACCEPT,
      },
    });

    if (!res.ok) {
      let message = `Vimeo API hatası (HTTP ${res.status})`;
      try {
        const errBody = await res.json();
        if (errBody?.developer_message) message = errBody.developer_message;
        else if (errBody?.error) message = errBody.error;
      } catch (_) { /* JSON parse fail — keep generic message */ }

      if (res.status === 401) {
        throw new Error('Token geçersiz veya süresi dolmuş.');
      }
      if (res.status === 404) {
        throw new Error('Vimeo kullanıcısı bulunamadı. URL\'yi kontrol edin.');
      }
      if (res.status === 429) {
        throw new Error('Vimeo API limit aşıldı. Birkaç dakika sonra tekrar deneyin.');
      }
      throw new Error(message);
    }

    const json = await res.json();
    if (total === null && typeof json.total === 'number') total = json.total;
    if (Array.isArray(json.data)) {
      all.push(...json.data);
      if (onProgress) onProgress(all.length, total);
    }

    // paging.next → "/users/.../videos?page=2&per_page=100" (relative)
    const nextRel = json?.paging?.next;
    if (nextRel) {
      url = nextRel.startsWith('http') ? nextRel : `${VIMEO_API_BASE}${nextRel}`;
    } else {
      url = null;
    }
  }

  return all.map(v => ({
    id: extractIdFromUri(v.uri),
    name: v.name || '',
    description: v.description || '',
    link: v.link || (extractIdFromUri(v.uri) ? `https://vimeo.com/${extractIdFromUri(v.uri)}` : ''),
    duration: v.duration || 0,
    privacy: v.privacy?.view || null,
  })).filter(v => v.id);
}

// ─── İsteğe bağlı profil URL kaydı (localStorage) ───
// Token artık koda gömülü olduğundan saklamaya gerek yok; yalnızca
// kullanıcı farklı bir Vimeo profili kullanmak isterse hatırlanır.
const URL_KEY = 'vimeo_import_url';

export function saveProfileUrl(profileUrl) {
  try {
    localStorage.setItem(URL_KEY, profileUrl || '');
  } catch (_) { /* yoksay */ }
}

export function loadProfileUrl() {
  try {
    return localStorage.getItem(URL_KEY) || '';
  } catch (_) {
    return '';
  }
}
