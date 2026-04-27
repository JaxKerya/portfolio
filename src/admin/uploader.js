import { uploadFile } from '../supabase.js';
import { icon, refreshIcons } from './icons.js';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

/**
 * URL input alanına bir "yükle" butonu + drag&drop bölgesi ekler.
 * URL alanı kullanıcı tarafından elle de doldurulabilir; yükleme yapılırsa
 * elde edilen public URL otomatik olarak input'a yazılır.
 *
 * @param {{
 *   urlInput: HTMLInputElement,    // hedef URL <input>
 *   folder?: string,               // bucket içindeki klasör (örn. "thumbnails")
 *   onUploaded?: (url: string) => void,
 *   showToast: Function,
 *   container: HTMLElement,        // urlInput'un komşusu olarak yerleştirilir
 * }} opts
 */
export function attachUploader(opts) {
  const { urlInput, folder = 'thumbnails', onUploaded, showToast, container } = opts;
  if (!urlInput || !container) return;

  // Eğer aynı container'a daha önce uploader bağlandıysa tekrar ekleme
  if (container.querySelector('[data-uploader-root]')) return;

  const wrap = document.createElement('div');
  wrap.dataset.uploaderRoot = '';
  wrap.style.marginTop = '8px';
  wrap.innerHTML = `
    <label class="uploader-dropzone" style="
      display:flex;align-items:center;justify-content:center;gap:8px;
      padding:14px;border:1.5px dashed var(--color-border);border-radius:6px;
      background:var(--color-bg);cursor:pointer;transition:border-color 0.15s,background 0.15s;
      font-size:13px;color:var(--color-text-muted);text-align:center;">
      ${icon('upload', 16)}
      <span class="uploader-text">Resim yüklemek için tıklayın veya buraya sürükleyin</span>
      <input type="file" accept="image/*" style="display:none;" data-uploader-input>
    </label>
    <p style="font-size:11px;margin:4px 0 0 0;color:var(--color-text-muted);">
      Maks. 10 MB &middot; PNG, JPG, WEBP, GIF
    </p>
    <div data-uploader-progress style="display:none;margin-top:6px;font-size:12px;color:var(--color-text-muted);"></div>
  `;
  container.appendChild(wrap);
  refreshIcons();

  const dropzone = wrap.querySelector('.uploader-dropzone');
  const fileInput = wrap.querySelector('[data-uploader-input]');
  const textEl = wrap.querySelector('.uploader-text');
  const progressEl = wrap.querySelector('[data-uploader-progress]');

  function setText(t) {
    textEl.textContent = t;
  }

  async function handleFile(file) {
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      showToast('Sadece görsel dosyaları yükleyebilirsiniz', 'error');
      return;
    }
    if (file.size > MAX_BYTES) {
      showToast('Dosya çok büyük (en fazla 10 MB)', 'error');
      return;
    }

    progressEl.style.display = '';
    progressEl.innerHTML = `${icon('loader', 12)} Yükleniyor: <strong>${escapeHtml(file.name)}</strong>...`;
    refreshIcons();
    dropzone.style.opacity = '0.6';
    dropzone.style.pointerEvents = 'none';

    try {
      const { url } = await uploadFile(file, folder);
      urlInput.value = url;
      // İlgili "input" event'ini de tetikle ki önizleme/güncelleme dinleyicileri devreye girsin
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      progressEl.innerHTML = `${icon('check', 12)} <span style="color:var(--color-accent-blue);">Yüklendi</span>`;
      refreshIcons();
      if (onUploaded) onUploaded(url);
      showToast('Resim yüklendi');
    } catch (err) {
      console.error('Upload failed:', err);
      progressEl.innerHTML = `<span style="color:var(--color-accent-coral);">Yükleme hatası: ${escapeHtml(err.message || 'bilinmeyen')}</span>`;
      showToast('Yükleme hatası: ' + (err.message || 'bilinmeyen'), 'error');
    } finally {
      dropzone.style.opacity = '';
      dropzone.style.pointerEvents = '';
      fileInput.value = '';
    }
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.style.borderColor = 'var(--color-accent-blue)';
      dropzone.style.background = 'rgba(76, 165, 255, 0.05)';
      setText('Bırakmak için fareyi serbest bırakın');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.style.borderColor = '';
      dropzone.style.background = '';
      setText('Resim yüklemek için tıklayın veya buraya sürükleyin');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  // Yapıştırma desteği (Ctrl+V ile resim)
  dropzone.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
