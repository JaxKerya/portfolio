import { getInfoContent, upsertInfoContent } from '../supabase.js';
import { icon, refreshIcons } from './icons.js';
import { attachUploader } from './uploader.js';

const INFO_SECTIONS = [
  { key: 'photo_url', label: 'Profil Fotoğrafı URL', type: 'input', icon: 'image', langSpecific: false },
  { key: 'bio', label: 'Biyografi', type: 'textarea', icon: 'user', langSpecific: true },
  { key: 'awards', label: 'Ödüller', type: 'textarea', icon: 'award', langSpecific: true },
  { key: 'skills', label: 'Yetenekler', type: 'textarea', icon: 'zap', langSpecific: true },
  { key: 'experience', label: 'Deneyim', type: 'textarea', icon: 'briefcase', langSpecific: true },
  { key: 'contact_info', label: 'İletişim Bilgisi', type: 'textarea', icon: 'phone', langSpecific: false },
  { key: 'resume_url', label: 'CV URL', type: 'input', icon: 'file-down', langSpecific: false },
];

/**
 * ADMIN INFO EDITOR — TR ve EN içeriği ayrı sekmelerde düzenleme.
 * UI metinleri Türkçe; içerik ise iki dilde de eklenebilir.
 */
export async function renderAdminInfo(container, showToast) {
  container.innerHTML = `<p style="color:var(--color-text-muted);">Yükleniyor...</p>`;

  const existing = await getInfoContent();
  const dataMap = {};
  existing.forEach(s => { dataMap[s.section_key] = s; });

  let activeLang = 'en';

  const render = () => {
    container.innerHTML = `
      <div class="admin-section-header">
        <h2>${icon('file-text')} Hakkımda İçeriği</h2>
        <div class="admin-lang-tabs">
          <button type="button" class="admin-lang-tab ${activeLang === 'en' ? 'active' : ''}" data-lang="en">${icon('languages', 14)} İngilizce</button>
          <button type="button" class="admin-lang-tab ${activeLang === 'tr' ? 'active' : ''}" data-lang="tr">${icon('languages', 14)} Türkçe</button>
        </div>
      </div>
      <p style="font-size:12px;color:var(--color-text-muted);margin:-8px 0 16px 0;">
        ${activeLang === 'en'
          ? 'Şu an İngilizce içeriği düzenliyorsun. (Sitenin ana dili İngilizce.)'
          : 'Şu an Türkçe içeriği düzenliyorsun. Boş bırakırsan ilgili bölüm Türkçe ziyaretçilere İngilizce metnini gösterir.'}
      </p>
      <form id="infoEditorForm">
        ${INFO_SECTIONS.map(sec => {
          const val = dataMap[sec.key];
          // Dilden bağımsız alanlar (foto/CV/iletişim) her iki sekmede de aynı içeriği gösterir.
          // Ana dil EN olduğu için EN değeri öncelikli; eski kayıtlarda EN boşsa TR'ye fallback.
          const content = sec.langSpecific
            ? (activeLang === 'en' ? (val?.content_en || '') : (val?.content_tr || ''))
            : (val?.content_en || val?.content_tr || '');

          let inputHtml;
          if (sec.type === 'textarea') {
            inputHtml = `<textarea id="info-${sec.key}" rows="4">${content}</textarea>`;
          } else {
            inputHtml = `<input type="${sec.key === 'photo_url' || sec.key === 'resume_url' ? 'url' : 'text'}" id="info-${sec.key}" value="${content}" style="width:100%;font-family:var(--font-body);font-size:14px;padding:12px;border:1px solid var(--color-border);border-radius:4px;outline:none;" placeholder="${sec.key === 'photo_url' ? 'https://ornek.com/foto.jpg' : sec.key === 'resume_url' ? 'https://ornek.com/cv.pdf' : ''}">`;
          }

          const hintHtml = sec.key === 'photo_url'
            ? `<p style="font-size:12px;color:var(--color-text-muted);margin:4px 0 8px 0;">Önerilen oran <strong>3:4 (dikey)</strong> &middot; ideal boyut <strong>900 × 1200 px</strong> (en az 600 × 800 px). Farklı oranlar otomatik olarak bu çerçeveye kırpılır.</p>`
            : '';

          const previewHtml = sec.key === 'photo_url'
            ? `
              <div id="photo-preview-wrap" style="margin-top:10px;display:${content ? '' : 'none'};">
                <p style="font-size:11px;margin:0 0 6px 0;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Önizleme</p>
                <img id="photo-preview-img" src="${content}" alt="" style="max-width:200px;max-height:240px;border-radius:6px;border:1px solid var(--color-border);display:block;object-fit:cover;">
                <p id="photo-preview-error" style="font-size:11px;margin-top:4px;color:var(--color-accent-coral);display:none;">Resim yüklenemedi - URL doğru mu?</p>
              </div>
            `
            : '';

          // Dilden bağımsız alanlarda küçük bir bilgi etiketi göster
          const langBadge = !sec.langSpecific
            ? `<span style="font-size:11px;color:var(--color-text-muted);font-weight:400;margin-left:8px;">(her iki dilde ortak)</span>`
            : '';

          return `
            <div class="admin-info-section" data-section="${sec.key}">
              <h3>${icon(sec.icon)} ${sec.label}${langBadge}</h3>
              ${hintHtml}
              ${inputHtml}
              ${previewHtml}
            </div>
          `;
        }).join('')}
        <button type="submit" class="btn btn-primary" style="margin-top:8px;">${icon('save')} Kaydet</button>
      </form>
    `;

    refreshIcons();
    bindPhotoPreview();
    bindLangTabs();

    // Profil fotoğrafı için yükleme widget'ı
    const photoInput = document.getElementById('info-photo_url');
    const photoSection = container.querySelector('[data-section="photo_url"]');
    if (photoInput && photoSection) {
      attachUploader({
        urlInput: photoInput,
        folder: 'photos',
        showToast,
        container: photoSection,
      });
    }

    // CV/Resume için PDF de yüklenebilsin (görsel değil ama aynı bucket'a)
    // Şimdilik sadece görsel destekli; CV için manuel URL kalsın.

    document.getElementById('infoEditorForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      saveCurrentValues(activeLang, dataMap);

      try {
        for (const sec of INFO_SECTIONS) {
          const d = dataMap[sec.key] || {};
          if (sec.langSpecific) {
            await upsertInfoContent(sec.key, d.content_tr || '', d.content_en || '');
          } else {
            // Dilden bağımsız alanlar her iki kolona da aynı değerle yazılır
            const shared = d.content_en || d.content_tr || '';
            await upsertInfoContent(sec.key, shared, shared);
          }
        }
        showToast('Kaydedildi!');
      } catch (err) {
        showToast('Hata: ' + err.message, 'error');
      }
    });
  };

  function bindLangTabs() {
    container.querySelectorAll('.admin-lang-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.dataset.lang === activeLang) return;
        // Mevcut input değerlerini aktif dile göre kaydet, sonra dili değiştir
        saveCurrentValues(activeLang, dataMap);
        activeLang = tab.dataset.lang;
        render();
      });
    });
  }

  function bindPhotoPreview() {
    const photoInput = document.getElementById('info-photo_url');
    const wrap = document.getElementById('photo-preview-wrap');
    const img = document.getElementById('photo-preview-img');
    const errorMsg = document.getElementById('photo-preview-error');
    if (!photoInput || !wrap || !img || !errorMsg) return;

    const update = () => {
      const url = photoInput.value.trim();
      if (url) {
        img.src = url;
        wrap.style.display = '';
      } else {
        wrap.style.display = 'none';
      }
      errorMsg.style.display = 'none';
    };

    img.addEventListener('error', () => {
      if (photoInput.value.trim()) {
        errorMsg.style.display = '';
      }
    });
    img.addEventListener('load', () => {
      errorMsg.style.display = 'none';
    });

    photoInput.addEventListener('input', update);
  }

  render();
}

function saveCurrentValues(lang, dataMap) {
  INFO_SECTIONS.forEach(sec => {
    const el = document.getElementById(`info-${sec.key}`);
    if (!el) return;
    if (!dataMap[sec.key]) {
      dataMap[sec.key] = { section_key: sec.key, content_tr: '', content_en: '' };
    }
    if (sec.langSpecific) {
      if (lang === 'en') {
        dataMap[sec.key].content_en = el.value;
      } else {
        dataMap[sec.key].content_tr = el.value;
      }
    } else {
      // Dilden bağımsız alanlar (foto/CV/iletişim): ana dil EN olduğu için
      // content_en'e yaz; kaydederken her iki kolona da kopyalanır.
      dataMap[sec.key].content_en = el.value;
      dataMap[sec.key].content_tr = el.value;
    }
  });
}
