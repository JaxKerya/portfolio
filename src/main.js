// Self-hosted fontlar — Google CDN yerine npm paketinden bundle ediyoruz.
// Privacy + performans (LCP) için kritik: harici DNS + connect adımı kalkıyor.
// Sadece "latin" + "latin-ext" subset'leri (TR karakterler için latin-ext yeterli).
import '@fontsource/inter/latin-300.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-ext-700.css';

import '@fontsource/manrope/latin-300.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-ext-400.css';
import '@fontsource/manrope/latin-ext-500.css';
import '@fontsource/manrope/latin-ext-600.css';
import '@fontsource/manrope/latin-ext-700.css';

import './style.css';
import { route, startRouter } from './router.js';
import { initI18n, toggleLanguage } from './i18n.js';
import { renderHome } from './pages/home.js';
import { renderVideo } from './pages/video.js';
import { renderInfo } from './pages/info.js';
import { renderContact } from './pages/contact.js';
import { renderAdmin } from './admin/admin.js';

// ─── Register Routes ───
route('/', (container) => renderHome(container));
route('/video/:id', (container, params) => renderVideo(container, params));
route('/info', (container) => renderInfo(container));
route('/contact', (container) => renderContact(container));
route('/admin', (container) => renderAdmin(container));

// ─── Initialize ───
document.addEventListener('DOMContentLoaded', () => {
  // i18n
  initI18n();

  // Language toggle
  const langBtn = document.getElementById('langToggle');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      toggleLanguage();
      window.dispatchEvent(new CustomEvent('routechange'));
    });
  }

  // Start router
  startRouter();

  // Re-render on language change for dynamic content
  document.addEventListener('languageChanged', () => {
    window.dispatchEvent(new CustomEvent('routechange'));
  });
});
