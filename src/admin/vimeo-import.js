import { addVideo } from '../supabase.js';
import { icon, refreshIcons } from './icons.js';
import { getVideoThumb } from '../video-utils.js';
import {
  fetchAllUserVideos,
  parseVimeoUserPath,
  loadProfileUrl,
  saveProfileUrl,
  VIMEO_ACCESS_TOKEN,
} from '../vimeo-api.js';

/**
 * Vimeo'dan toplu video içe aktarma modal'ı.
 *
 * @param {{
 *   videos: Array,           // Mevcut DB videoları (mutate edilir, yeni eklenenler push edilir)
 *   showToast: Function,
 *   reRender: Function,      // Liste re-render
 * }} ctx
 */
export function showVimeoImportModal(ctx) {
  const modal = document.getElementById('adminModal');
  const content = document.getElementById('adminModalContent');

  // Modal içerik durumu
  let fetchedVideos = [];
  let selectedIds = new Set();
  let currentProfileUrl = loadProfileUrl();

  function existingIds() {
    return new Set(ctx.videos.map(v => v.vimeo_id).filter(Boolean));
  }

  function renderShell() {
    content.innerHTML = `
      <h2>${icon('download', 20)} Vimeo'dan İçe Aktar</h2>

      <div class="form-group">
        <label>${icon('user', 14)} Vimeo Profil URL'si <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">(opsiyonel — boş bırakılırsa kendi videolarınız listelenir)</span></label>
        <div style="display:flex;gap:8px;align-items:stretch;">
          <input type="text" id="vi-url" value="${escapeAttr(currentProfileUrl)}" placeholder="https://vimeo.com/kullanici-adi" style="flex:1;">
          <button type="button" class="btn btn-primary btn-sm" id="vi-fetch" style="white-space:nowrap;">${icon('refresh-cw')} Listele</button>
        </div>
      </div>

      <div id="vi-status" style="margin-top:14px;"></div>
      <div id="vi-list-wrap" style="margin-top:8px;"></div>

      <div class="modal-actions" id="vi-bottom-actions">
        <button type="button" class="btn btn-outline btn-sm" id="vi-cancel">${icon('x')} Kapat</button>
      </div>
    `;
    refreshIcons();

    document.getElementById('vi-cancel').addEventListener('click', () => {
      modal.classList.remove('show');
    });

    document.getElementById('vi-fetch').addEventListener('click', handleFetch);
    document.getElementById('vi-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleFetch();
      }
    });
  }

  async function handleFetch() {
    const urlInput = document.getElementById('vi-url');
    const fetchBtn = document.getElementById('vi-fetch');
    const status = document.getElementById('vi-status');
    const listWrap = document.getElementById('vi-list-wrap');

    const profileUrl = urlInput.value.trim();
    currentProfileUrl = profileUrl;
    saveProfileUrl(profileUrl);

    fetchBtn.disabled = true;
    const oldLabel = fetchBtn.innerHTML;
    fetchBtn.innerHTML = `${icon('loader', 14)} Yükleniyor...`;
    refreshIcons();
    status.innerHTML = `<p style="font-size:13px;color:var(--color-text-muted);">Videolar getiriliyor...</p>`;
    listWrap.innerHTML = '';

    try {
      const userPath = parseVimeoUserPath(profileUrl);
      const videos = await fetchAllUserVideos(VIMEO_ACCESS_TOKEN, userPath, (loaded, total) => {
        const totalTxt = total != null ? ` / ${total}` : '';
        status.innerHTML = `<p style="font-size:13px;color:var(--color-text-muted);">${loaded}${totalTxt} video yüklendi...</p>`;
      });

      fetchedVideos = videos;
      const existing = existingIds();
      selectedIds = new Set(
        videos.filter(v => !existing.has(v.id)).map(v => v.id)
      );

      status.innerHTML = '';
      renderResults();
    } catch (err) {
      console.error('Vimeo import error:', err);
      status.innerHTML = `<p style="color:var(--color-accent-coral);font-size:13px;">${escapeHtml(err.message || 'Bilinmeyen hata')}</p>`;
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = oldLabel;
      refreshIcons();
    }
  }

  function renderResults() {
    const listWrap = document.getElementById('vi-list-wrap');
    const bottomActions = document.getElementById('vi-bottom-actions');
    const existing = existingIds();
    const total = fetchedVideos.length;
    const newCount = fetchedVideos.filter(v => !existing.has(v.id)).length;

    if (total === 0) {
      listWrap.innerHTML = `<p style="font-size:13px;color:var(--color-text-muted);">Bu hesapta video bulunamadı.</p>`;
      bottomActions.innerHTML = `<button type="button" class="btn btn-outline btn-sm" id="vi-cancel">${icon('x')} Kapat</button>`;
      refreshIcons();
      document.getElementById('vi-cancel').addEventListener('click', () => modal.classList.remove('show'));
      return;
    }

    listWrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0;flex-wrap:wrap;">
        <p style="font-size:13px;color:var(--color-text-muted);margin:0;">
          ${total} video bulundu &middot; <strong>${newCount}</strong> yeni, ${total - newCount} zaten içe aktarılmış
        </p>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-outline btn-sm" id="vi-select-new">Yeni olanları seç</button>
          <button type="button" class="btn btn-outline btn-sm" id="vi-select-all">Tümünü seç</button>
          <button type="button" class="btn btn-outline btn-sm" id="vi-select-none">Hiçbirini seçme</button>
        </div>
      </div>

      <div id="vi-list" style="max-height:380px;overflow-y:auto;border:1px solid var(--color-border);border-radius:8px;padding:6px;">
        ${fetchedVideos.map(v => {
          const already = existing.has(v.id);
          const checked = selectedIds.has(v.id);
          const thumb = getVideoThumb('vimeo', v.id);
          return `
            <label class="vi-row" data-id="${v.id}" style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--color-border);cursor:${already ? 'not-allowed' : 'pointer'};${already ? 'opacity:0.55;' : ''}">
              <input type="checkbox" class="vi-check" data-id="${v.id}" ${checked ? 'checked' : ''} ${already ? 'disabled' : ''} style="margin:0;">
              <img src="${thumb}" alt="" loading="lazy" style="width:96px;height:54px;object-fit:cover;border-radius:4px;background:#222;flex-shrink:0;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(v.name) || '(başlıksız)'}</div>
                <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap;">
                  <span>ID: ${v.id}</span>
                  ${v.duration ? `<span>${formatDuration(v.duration)}</span>` : ''}
                  ${v.privacy && v.privacy !== 'anybody' ? `<span style="color:var(--color-accent-coral);">${escapeHtml(v.privacy)}</span>` : ''}
                  ${already ? `<span style="color:var(--color-accent-blue);">${icon('check', 11)} Zaten var</span>` : ''}
                </div>
              </div>
            </label>
          `;
        }).join('')}
      </div>
    `;

    bottomActions.innerHTML = `
      <button type="button" class="btn btn-outline btn-sm" id="vi-cancel">${icon('x')} Kapat</button>
      <button type="button" class="btn btn-primary btn-sm" id="vi-import" ${selectedIds.size === 0 ? 'disabled' : ''}>
        ${icon('download')} <span id="vi-import-count">${selectedIds.size}</span> Video İçe Aktar
      </button>
    `;
    refreshIcons();

    listWrap.querySelectorAll('.vi-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        if (cb.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateImportButton();
      });
    });

    document.getElementById('vi-select-new').addEventListener('click', () => {
      selectedIds = new Set(fetchedVideos.filter(v => !existing.has(v.id)).map(v => v.id));
      syncCheckboxes();
    });
    document.getElementById('vi-select-all').addEventListener('click', () => {
      selectedIds = new Set(fetchedVideos.filter(v => !existing.has(v.id)).map(v => v.id));
      syncCheckboxes();
    });
    document.getElementById('vi-select-none').addEventListener('click', () => {
      selectedIds = new Set();
      syncCheckboxes();
    });

    document.getElementById('vi-cancel').addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('vi-import').addEventListener('click', handleImport);
  }

  function syncCheckboxes() {
    document.querySelectorAll('.vi-check').forEach(cb => {
      if (cb.disabled) return;
      cb.checked = selectedIds.has(cb.dataset.id);
    });
    updateImportButton();
  }

  function updateImportButton() {
    const btn = document.getElementById('vi-import');
    const countEl = document.getElementById('vi-import-count');
    if (!btn || !countEl) return;
    countEl.textContent = String(selectedIds.size);
    btn.disabled = selectedIds.size === 0;
  }

  async function handleImport() {
    const importBtn = document.getElementById('vi-import');
    const status = document.getElementById('vi-status');

    const toImport = fetchedVideos.filter(v => selectedIds.has(v.id));
    if (toImport.length === 0) return;

    importBtn.disabled = true;
    const oldLabel = importBtn.innerHTML;
    importBtn.innerHTML = `${icon('loader', 14)} İçe aktarılıyor...`;
    refreshIcons();

    let successCount = 0;
    let failCount = 0;
    let nextSortOrder = ctx.videos.length;

    for (let i = 0; i < toImport.length; i++) {
      const v = toImport[i];
      status.innerHTML = `<p style="font-size:13px;color:var(--color-text-muted);">İçe aktarılıyor: ${i + 1}/${toImport.length} — ${escapeHtml(v.name)}</p>`;

      try {
        const data = {
          vimeo_url: v.link || `https://vimeo.com/${v.id}`,
          vimeo_id: v.id,
          title_en: v.name || '',
          title_tr: v.name || '',
          description_en: v.description || '',
          description_tr: v.description || '',
          thumbnail_url: getVideoThumb('vimeo', v.id),
          sort_order: nextSortOrder++,
        };
        const created = await addVideo(data);
        ctx.videos.push(created);
        successCount++;
      } catch (err) {
        console.error('Import failed for', v.id, err);
        failCount++;
      }
    }

    status.innerHTML = `<p style="font-size:13px;color:var(--color-text-muted);"><strong>${successCount}</strong> video içe aktarıldı${failCount ? `, <span style="color:var(--color-accent-coral);">${failCount}</span> başarısız` : ''}.</p>`;

    importBtn.disabled = false;
    importBtn.innerHTML = oldLabel;
    refreshIcons();

    if (successCount > 0) {
      ctx.reRender();
      ctx.showToast(`${successCount} video içe aktarıldı!`);
    }
    if (failCount > 0) {
      ctx.showToast(`${failCount} video aktarılamadı`, 'error');
    }
    if (failCount === 0 && successCount > 0) {
      setTimeout(() => modal.classList.remove('show'), 800);
    }
  }

  // ── helpers ──
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
  function formatDuration(secs) {
    const total = Math.floor(secs);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  renderShell();
  modal.classList.add('show');

  // Modal açılır açılmaz otomatik listeleme — token zaten gömülü olduğu için
  // kullanıcının ekstra bir tıklama yapmasına gerek yok.
  setTimeout(() => handleFetch(), 0);
}
