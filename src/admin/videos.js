import {
  getVideos, addVideo, updateVideo, deleteVideo, updateVideoOrder,
  bulkDeleteVideos, bulkSetActive,
} from '../supabase.js';
import { icon, refreshIcons } from './icons.js';
import {
  detectPlatform,
  extractVideoId,
  getVideoThumb,
  resolveVideo,
  attachYoutubeThumbFallback,
} from '../video-utils.js';
import { showVimeoImportModal } from './vimeo-import.js';
import { attachUploader } from './uploader.js';

const PLATFORM_LABEL = {
  vimeo: 'Vimeo',
  youtube: 'YouTube',
};

function platformBadge(platform) {
  if (!platform) return '';
  const label = PLATFORM_LABEL[platform] || platform;
  const ic = platform === 'youtube' ? 'youtube' : 'video';
  return `<span style="font-size:11px;color:var(--color-text-muted);display:inline-flex;align-items:center;gap:4px;">${icon(ic, 12)} ${label}</span>`;
}

/**
 * ADMIN VIDEOS TAB — CRUD + drag & drop ordering + bulk operations
 */
export async function renderAdminVideos(container, showToast) {
  container.innerHTML = `<p style="color:var(--color-text-muted);">Yükleniyor...</p>`;

  // Admin tüm videoları görür (taslaklar dahil)
  const videos = await getVideos({ includeInactive: true });
  const selected = new Set();

  const render = () => {
    const activeCount = videos.filter(v => v.is_active !== false).length;
    const draftCount = videos.length - activeCount;

    container.innerHTML = `
      <div class="admin-section-header">
        <h2>${icon('film')} Videolar (${videos.length}) <span style="font-size:13px;font-weight:400;color:var(--color-text-muted);">— ${activeCount} yayında${draftCount ? `, ${draftCount} taslak` : ''}</span></h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" id="importVimeoBtn" title="Vimeo profilinizden videoları toplu içe aktarın">${icon('download')} Vimeo'dan İçe Aktar</button>
          <button class="btn btn-primary btn-sm" id="addVideoBtn">${icon('plus')} Video Ekle</button>
        </div>
      </div>

      <div id="bulkBar" style="display:${selected.size > 0 ? 'flex' : 'none'};align-items:center;gap:10px;padding:10px 12px;margin-bottom:12px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:6px;flex-wrap:wrap;">
        <span style="font-size:13px;color:var(--color-text-muted);"><strong id="bulkCount">${selected.size}</strong> seçili</span>
        <div style="flex:1;"></div>
        <button class="btn btn-outline btn-sm" id="bulkActivateBtn">${icon('eye', 14)} Yayına Al</button>
        <button class="btn btn-outline btn-sm" id="bulkDeactivateBtn">${icon('eye-off', 14)} Taslak Yap</button>
        <button class="btn btn-danger btn-sm" id="bulkDeleteBtn">${icon('trash-2', 14)} Seçilenleri Sil</button>
        <button class="btn btn-outline btn-sm" id="bulkClearBtn" title="Seçimi temizle">${icon('x', 14)}</button>
      </div>

      <div style="display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:12px;color:var(--color-text-muted);">
        <input type="checkbox" id="selectAllCheckbox" ${videos.length > 0 && selected.size === videos.length ? 'checked' : ''}>
        <label for="selectAllCheckbox" style="cursor:pointer;">Tümünü seç</label>
      </div>

      <div id="videoList">
        ${videos.map((v, i) => {
          const { platform, autoThumb, id: vId } = resolveVideo(v);
          const isCustomThumb = v.thumbnail_url && v.thumbnail_url !== autoThumb;
          const displayThumb = v.thumbnail_url || autoThumb;
          const ytFallbackAttr = (!isCustomThumb && platform === 'youtube' && vId)
            ? `data-platform="youtube" data-vid="${vId}"`
            : '';
          const isActive = v.is_active !== false;
          const isSelected = selected.has(v.id);
          return `
          <div class="admin-video-item${isActive ? '' : ' is-draft'}${isSelected ? ' is-selected' : ''}" draggable="true" data-id="${v.id}" data-index="${i}" style="${!isActive ? 'opacity:0.55;' : ''}${isSelected ? 'background:rgba(76,165,255,0.08);' : ''}">
            <input type="checkbox" class="video-select-checkbox" data-id="${v.id}" ${isSelected ? 'checked' : ''} title="Seç">
            <span class="drag-handle">${icon('grip-vertical', 18)}</span>
            <img class="admin-video-thumb" src="${displayThumb}" alt="" ${ytFallbackAttr}>
            <div class="admin-video-info">
              <h3>${v.title_en || v.title_tr || 'Başlıksız'}</h3>
              <p>${v.vimeo_url || ''}</p>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:2px;">
                ${platformBadge(platform)}
                ${isCustomThumb ? `<span style="font-size:11px;color:var(--color-accent-blue);">${icon('image', 12)} Özel kapak</span>` : ''}
                ${!isActive ? `<span style="font-size:11px;color:var(--color-accent-coral);font-weight:600;">${icon('eye-off', 12)} TASLAK</span>` : ''}
              </div>
            </div>
            <div class="admin-video-actions">
              <button class="btn btn-outline btn-sm toggle-active-btn" data-id="${v.id}" title="${isActive ? 'Taslak yap (sitede gizle)' : 'Yayına al (sitede göster)'}">${icon(isActive ? 'eye' : 'eye-off')}</button>
              <button class="btn btn-outline btn-sm edit-video-btn" data-id="${v.id}" title="Düzenle">${icon('pencil')}</button>
              <button class="btn btn-danger btn-sm delete-video-btn" data-id="${v.id}" title="Sil">${icon('trash-2')}</button>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    `;

    refreshIcons();

    // YouTube thumbnail fallback
    container.querySelectorAll('.admin-video-thumb[data-platform="youtube"]').forEach(img => {
      attachYoutubeThumbFallback(img, img.dataset.vid);
    });

    document.getElementById('addVideoBtn').addEventListener('click', () => showVideoModal(null, videos, container, showToast, render));

    document.getElementById('importVimeoBtn').addEventListener('click', () => {
      showVimeoImportModal({ videos, showToast, reRender: render });
    });

    container.querySelectorAll('.edit-video-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const video = videos.find(v => v.id === btn.dataset.id);
        if (video) showVideoModal(video, videos, container, showToast, render);
      });
    });

    container.querySelectorAll('.delete-video-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu öğeyi silmek istediğinize emin misiniz?')) return;
        try {
          await deleteVideo(btn.dataset.id);
          const idx = videos.findIndex(v => v.id === btn.dataset.id);
          if (idx !== -1) videos.splice(idx, 1);
          selected.delete(btn.dataset.id);
          render();
          showToast('Silindi!');
        } catch (err) {
          showToast('Hata: ' + err.message, 'error');
        }
      });
    });

    // Yayında / Taslak toggle (göz ikonu)
    container.querySelectorAll('.toggle-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const video = videos.find(v => v.id === id);
        if (!video) return;
        const newActive = video.is_active === false; // toggle
        try {
          const updated = await updateVideo(id, { is_active: newActive });
          const idx = videos.findIndex(v => v.id === id);
          if (idx !== -1) videos[idx] = { ...videos[idx], ...updated };
          render();
          showToast(newActive ? 'Yayına alındı' : 'Taslak yapıldı');
        } catch (err) {
          showToast('Hata: ' + err.message, 'error');
        }
      });
    });

    // Bireysel checkbox'lar
    container.querySelectorAll('.video-select-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        if (cb.checked) selected.add(cb.dataset.id);
        else selected.delete(cb.dataset.id);
        render();
      });
      // Checkbox'a basınca drag tetiklenmesin
      cb.addEventListener('click', (e) => e.stopPropagation());
    });

    // Tümünü seç
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        if (selectAll.checked) videos.forEach(v => selected.add(v.id));
        else selected.clear();
        render();
      });
    }

    // Bulk actions
    const bulkActivate = document.getElementById('bulkActivateBtn');
    const bulkDeactivate = document.getElementById('bulkDeactivateBtn');
    const bulkDelete = document.getElementById('bulkDeleteBtn');
    const bulkClear = document.getElementById('bulkClearBtn');

    if (bulkActivate) bulkActivate.addEventListener('click', () => bulkAction('activate'));
    if (bulkDeactivate) bulkDeactivate.addEventListener('click', () => bulkAction('deactivate'));
    if (bulkDelete) bulkDelete.addEventListener('click', () => bulkAction('delete'));
    if (bulkClear) bulkClear.addEventListener('click', () => { selected.clear(); render(); });

    setupDragDrop(container, videos, showToast);
  };

  async function bulkAction(action) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    if (action === 'delete') {
      if (!confirm(`${ids.length} videoyu silmek istediğinize emin misiniz?`)) return;
      try {
        await bulkDeleteVideos(ids);
        for (const id of ids) {
          const idx = videos.findIndex(v => v.id === id);
          if (idx !== -1) videos.splice(idx, 1);
        }
        selected.clear();
        render();
        showToast(`${ids.length} video silindi`);
      } catch (err) {
        showToast('Toplu silme hatası: ' + err.message, 'error');
      }
      return;
    }

    const isActive = action === 'activate';
    try {
      await bulkSetActive(ids, isActive);
      for (const id of ids) {
        const idx = videos.findIndex(v => v.id === id);
        if (idx !== -1) videos[idx] = { ...videos[idx], is_active: isActive };
      }
      render();
      showToast(`${ids.length} video ${isActive ? 'yayına alındı' : 'taslak yapıldı'}`);
    } catch (err) {
      showToast('Toplu güncelleme hatası: ' + err.message, 'error');
    }
  }

  render();
}

function setupDragDrop(container, videos, showToast) {
  const list = document.getElementById('videoList');
  if (!list) return;

  let draggedEl = null;

  list.addEventListener('dragstart', (e) => {
    draggedEl = e.target.closest('.admin-video-item');
    if (draggedEl) {
      draggedEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  list.addEventListener('dragend', () => {
    if (draggedEl) draggedEl.classList.remove('dragging');
    draggedEl = null;
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterEl = getDragAfterElement(list, e.clientY);
    if (draggedEl) {
      if (afterEl) {
        list.insertBefore(draggedEl, afterEl);
      } else {
        list.appendChild(draggedEl);
      }
    }
  });

  list.addEventListener('drop', async (e) => {
    e.preventDefault();
    const items = list.querySelectorAll('.admin-video-item');
    const orderedIds = Array.from(items).map(item => item.dataset.id);
    try {
      await updateVideoOrder(orderedIds);
      const sortedVideos = orderedIds.map(id => videos.find(v => v.id === id)).filter(Boolean);
      videos.length = 0;
      videos.push(...sortedVideos);
      showToast('Kaydedildi!');
    } catch (err) {
      showToast('Sıralama hatası', 'error');
    }
  });
}

function getDragAfterElement(list, y) {
  const items = [...list.querySelectorAll('.admin-video-item:not(.dragging)')];
  return items.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function showVideoModal(video, videos, container, showToast, reRender) {
  const modal = document.getElementById('adminModal');
  const content = document.getElementById('adminModalContent');
  const isEdit = !!video;

  const existingThumb = video?.thumbnail_url || '';
  const initialResolved = video ? resolveVideo(video) : { platform: null, id: '', autoThumb: '' };
  const hasCustomThumb = existingThumb && existingThumb !== initialResolved.autoThumb;

  content.innerHTML = `
    <h2>${isEdit ? `${icon('pencil', 20)} Video Düzenle` : `${icon('plus', 20)} Yeni Video Ekle`}</h2>
    <form id="videoForm">
      <div class="form-group">
        <label>${icon('link')} Video URL <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">— Vimeo veya YouTube</span></label>
        <input type="url" id="vf-url" value="${video?.vimeo_url || ''}" required placeholder="https://vimeo.com/123456789  veya  https://youtu.be/abcdEFGhijk">
        <p id="vf-platform-hint" style="font-size:12px;margin:6px 0 0 0;color:var(--color-text-muted);min-height:16px;"></p>
      </div>

      <div class="admin-lang-tabs" style="margin-top:16px;">
        <button type="button" class="admin-lang-tab active" data-lang="en">${icon('languages', 14)} İngilizce</button>
        <button type="button" class="admin-lang-tab" data-lang="tr">${icon('languages', 14)} Türkçe</button>
      </div>

      <div class="vf-lang-pane" data-lang-pane="en">
        <div class="form-group">
          <label>Başlık (İngilizce)</label>
          <input type="text" id="vf-title-en" value="${video?.title_en || ''}" required>
        </div>
        <div class="form-group">
          <label>Açıklama (İngilizce)</label>
          <textarea id="vf-desc-en" rows="3">${video?.description_en || ''}</textarea>
        </div>
      </div>

      <div class="vf-lang-pane" data-lang-pane="tr" style="display:none;">
        <div class="form-group">
          <label>Başlık (Türkçe) <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">— boş bırakılırsa İngilizce başlık kullanılır</span></label>
          <input type="text" id="vf-title-tr" value="${video?.title_tr || ''}">
        </div>
        <div class="form-group">
          <label>Açıklama (Türkçe) <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">— boş bırakılırsa İngilizce açıklama kullanılır</span></label>
          <textarea id="vf-desc-tr" rows="3">${video?.description_tr || ''}</textarea>
        </div>
      </div>

      <div class="form-group" style="margin-top:16px;" id="vf-thumb-group">
        <label>${icon('image')} Özel Kapak Resmi <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">(isteğe bağlı)</span></label>
        <input type="url" id="vf-thumb" value="${hasCustomThumb ? existingThumb : ''}" placeholder="https://ornek.com/kapak.jpg veya aşağıdan yükleyin">
        <div id="vf-thumb-preview" style="margin-top:10px;display:${hasCustomThumb || initialResolved.id ? '' : 'none'};">
          <p style="font-size:11px;margin:0 0 6px 0;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Önizleme</p>
          <img id="vf-thumb-img" src="${hasCustomThumb ? existingThumb : initialResolved.autoThumb}" alt="" style="max-width:200px;border-radius:6px;border:1px solid var(--color-border);display:block;">
          <p id="vf-thumb-label" style="font-size:11px;margin-top:4px;color:var(--color-text-muted);">${hasCustomThumb ? 'Özel kapak resmi' : (initialResolved.platform ? `${PLATFORM_LABEL[initialResolved.platform]} otomatik kapak` : '')}</p>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline btn-sm" id="cancelVideoModal">${icon('x')} İptal</button>
        <button type="submit" class="btn btn-primary btn-sm">${icon('check')} ${isEdit ? 'Güncelle' : 'Ekle'}</button>
      </div>
    </form>
  `;

  refreshIcons();

  const thumbInput = document.getElementById('vf-thumb');
  const thumbPreview = document.getElementById('vf-thumb-preview');
  const thumbImg = document.getElementById('vf-thumb-img');
  const thumbLabel = document.getElementById('vf-thumb-label');
  const urlInput = document.getElementById('vf-url');
  const platformHint = document.getElementById('vf-platform-hint');

  // Otomatik thumbnail'in ne olduğunu hatırlamak için (YT fallback için)
  let currentAutoPlatform = null;
  let currentAutoId = '';
  let triedYtFallback = false;

  function updateThumbPreview() {
    const customUrl = thumbInput.value.trim();
    const url = urlInput.value.trim();
    const platform = detectPlatform(url);
    const vid = extractVideoId(url, platform);

    // Platform ipucu
    if (!url) {
      platformHint.textContent = '';
      platformHint.style.color = 'var(--color-text-muted)';
    } else if (platform) {
      platformHint.innerHTML = `${icon(platform === 'youtube' ? 'youtube' : 'video', 12)} ${PLATFORM_LABEL[platform]} algılandı`;
      platformHint.style.color = 'var(--color-text-muted)';
      refreshIcons();
    } else {
      platformHint.textContent = 'Tanınmayan URL — Vimeo veya YouTube linki yapıştırın.';
      platformHint.style.color = 'var(--color-accent-coral)';
    }

    triedYtFallback = false;
    if (customUrl) {
      currentAutoPlatform = null;
      currentAutoId = '';
      thumbImg.src = customUrl;
      thumbLabel.textContent = 'Özel kapak resmi';
      thumbLabel.style.color = 'var(--color-text-muted)';
      thumbPreview.style.display = '';
    } else if (platform && vid) {
      currentAutoPlatform = platform;
      currentAutoId = vid;
      thumbImg.src = getVideoThumb(platform, vid);
      thumbLabel.textContent = `${PLATFORM_LABEL[platform]} otomatik kapak`;
      thumbLabel.style.color = 'var(--color-text-muted)';
      thumbPreview.style.display = '';
    } else {
      currentAutoPlatform = null;
      currentAutoId = '';
      thumbPreview.style.display = 'none';
    }
  }

  thumbImg.addEventListener('error', () => {
    // YouTube maxres yoksa hqdefault'a düş
    if (!thumbInput.value.trim() && currentAutoPlatform === 'youtube' && currentAutoId && !triedYtFallback) {
      triedYtFallback = true;
      thumbImg.src = `https://i.ytimg.com/vi/${currentAutoId}/hqdefault.jpg`;
      return;
    }
    if (thumbInput.value.trim()) {
      thumbLabel.textContent = 'Resim yüklenemedi - URL doğru mu?';
      thumbLabel.style.color = 'var(--color-accent-coral)';
    }
  });
  thumbImg.addEventListener('load', () => {
    if (thumbInput.value.trim()) {
      thumbLabel.textContent = 'Özel kapak resmi';
    } else if (currentAutoPlatform) {
      thumbLabel.textContent = `${PLATFORM_LABEL[currentAutoPlatform]} otomatik kapak`;
    }
    thumbLabel.style.color = 'var(--color-text-muted)';
  });

  thumbInput.addEventListener('input', updateThumbPreview);
  urlInput.addEventListener('input', updateThumbPreview);

  // Drag & drop / dosya yükleme widget'ı (URL alanına yazar)
  attachUploader({
    urlInput: thumbInput,
    folder: 'thumbnails',
    showToast,
    container: document.getElementById('vf-thumb-group'),
  });

  // İlk açılışta platform ipucunu göstermek için tetikle
  updateThumbPreview();

  // Dil sekmeleri (içerik için TR/EN)
  content.querySelectorAll('.admin-lang-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      content.querySelectorAll('.admin-lang-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const lang = tab.dataset.lang;
      content.querySelectorAll('.vf-lang-pane').forEach(pane => {
        pane.style.display = pane.dataset.langPane === lang ? '' : 'none';
      });
    });
  });

  // Cancel
  document.getElementById('cancelVideoModal').addEventListener('click', () => {
    modal.classList.remove('show');
  });

  // Submit
  document.getElementById('videoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('vf-url').value.trim();
    const platform = detectPlatform(url);
    const videoId = extractVideoId(url, platform);

    if (!platform || !videoId) {
      showToast('Tanınmayan video URL\'si. Vimeo veya YouTube linki yapıştırın.', 'error');
      return;
    }

    const titleTr = document.getElementById('vf-title-tr').value.trim();
    const descTr = document.getElementById('vf-desc-tr').value.trim();
    const titleEn = document.getElementById('vf-title-en').value.trim();
    const descEn = document.getElementById('vf-desc-en').value.trim();
    const customThumb = thumbInput.value.trim();

    // Ana dil EN; TR alanları boş bırakılırsa EN değerine fallback
    // NOT: vimeo_url/vimeo_id sütunları artık generic "video URL/ID" anlamında kullanılıyor.
    const data = {
      vimeo_url: url,
      vimeo_id: videoId,
      title_en: titleEn,
      title_tr: titleTr || titleEn,
      description_en: descEn,
      description_tr: descTr || descEn,
      thumbnail_url: customThumb || getVideoThumb(platform, videoId),
    };

    try {
      if (isEdit) {
        const updated = await updateVideo(video.id, data);
        const idx = videos.findIndex(v => v.id === video.id);
        if (idx !== -1) videos[idx] = { ...videos[idx], ...updated };
      } else {
        data.sort_order = videos.length;
        const created = await addVideo(data);
        videos.push(created);
      }
      modal.classList.remove('show');
      reRender();
      showToast('Kaydedildi!');
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
    }
  });

  modal.classList.add('show');
}
