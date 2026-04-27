import { getInfoContent } from '../supabase.js';
import { t, getLang } from '../i18n.js';
import {
  setMeta,
  personSchema,
  aboutPageSchema,
  faqSchema,
  breadcrumbSchema,
} from '../seo.js';
import { SITE, abs } from '../site-config.js';

/**
 * INFO PAGE — Photo + bio/awards/contact (2-column layout)
 */
export async function renderInfo(container) {
  const lang = getLang();

  container.innerHTML = `
    <div class="info-page">
      <div class="skeleton" style="aspect-ratio:3/4;"></div>
      <div>
        <div class="skeleton" style="height:200px;margin-bottom:20px;"></div>
        <div class="skeleton" style="height:100px;"></div>
      </div>
    </div>
  `;

  try {
    const sections = await getInfoContent();

    // Build a map of section_key -> content
    // Ana dil EN; TR alanı boşsa EN'e fallback
    const infoMap = {};
    sections.forEach(s => {
      infoMap[s.section_key] = lang === 'tr'
        ? (s.content_tr || s.content_en || '')
        : (s.content_en || s.content_tr || '');
    });

    const photoUrl = infoMap['photo_url'] || '/logo.png';
    const bio = infoMap['bio'] || '';
    const awards = infoMap['awards'] || '';
    const contactInfo = infoMap['contact_info'] || '';
    const resumeUrl = infoMap['resume_url'] || '';
    const skills = infoMap['skills'] || '';
    const experience = infoMap['experience'] || '';

    // SEO: bio'nun ilk paragrafını description olarak kullan
    const isTr = lang === 'tr';
    const seoDesc = bio
      ? bio.replace(/\s+/g, ' ').trim().slice(0, 200)
      : (isTr
          ? 'Rabia Göl hakkında — Profesyonel 3D Karakter Animatörü.'
          : 'About Rabia Göl — Professional 3D Character Animator.');
    const customPhoto = photoUrl && photoUrl !== '/logo.png' ? photoUrl : undefined;
    const seoImage = customPhoto ? abs(customPhoto) : undefined;

    // Site-config'deki FAQ'yı dile göre dönüştür
    const faqList = SITE.faq.map((entry) => ({
      q: isTr ? entry.tr.q : entry.en.q,
      a: isTr ? entry.tr.a : entry.en.a,
    }));

    setMeta({
      title: isTr ? 'Hakkımda' : 'About',
      description: seoDesc,
      type: 'profile',
      image: seoImage,
      imageAlt: isTr ? 'Rabia Göl — 3D Karakter Animatörü' : 'Rabia Göl — 3D Character Animator',
      path: '/info',
      locale: isTr ? 'tr_TR' : 'en_US',
      keywords: SITE.keywords.join(', '),
      structuredData: [
        personSchema({
          image: seoImage,
          jobTitle: isTr ? SITE.jobTitle.tr : SITE.jobTitle.en,
        }),
        aboutPageSchema({ lang }),
        faqSchema(faqList),
        breadcrumbSchema([
          { name: isTr ? 'Ana Sayfa' : 'Home', url: '/' },
          { name: isTr ? 'Hakkımda' : 'About', url: '/info' },
        ]),
      ],
    });

    container.innerHTML = `
      <div class="info-page">
        <div>
          <img src="${photoUrl}" alt="Rabia Göl" class="info-photo">
        </div>
        <div class="info-content">
          ${bio ? `
            <div class="info-section">
              <h2 class="info-section-title">${t('info.title')}</h2>
              <p>${bio.replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}

          ${awards ? `
            <div class="info-section">
              <h2 class="info-section-title">${t('info.awards')}</h2>
              <p>${awards.replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}

          ${skills ? `
            <div class="info-section">
              <h2 class="info-section-title">${t('info.skills')}</h2>
              <p>${skills.replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}

          ${experience ? `
            <div class="info-section">
              <h2 class="info-section-title">${t('info.experience')}</h2>
              <p>${experience.replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}

          ${contactInfo ? `
            <div class="info-section">
              <h2 class="info-section-title">${t('info.contact')}</h2>
              <p>${contactInfo.replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}

          ${resumeUrl ? `
            <div class="info-section">
              <a href="${resumeUrl}" target="_blank" rel="noopener"><strong>${t('info.resume')}</strong></a>
            </div>
          ` : ''}
        </div>
      </div>
    `;

  } catch (err) {
    console.error('Info render error:', err);
    container.innerHTML = `<p style="text-align:center;padding:80px 0;color:var(--color-text-muted);">Error loading info.</p>`;
  }
}
