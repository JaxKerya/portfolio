import { authenticateAdmin } from '../supabase.js';
import { renderAdminVideos } from './videos.js';
import { renderAdminInfo } from './info-editor.js';
import { renderAdminMessages } from './messages.js';
import { icon, refreshIcons } from './icons.js';
import { setMeta } from '../seo.js';

const ADMIN_SESSION_KEY = 'admin_session';

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY));
  } catch { return null; }
}

function setSession(user) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * ADMIN PANEL — Login + Dashboard
 */
export async function renderAdmin(container) {
  // Bot indeksleme: admin asla aranmamalı; robots.txt ek olarak meta noindex
  setMeta({
    title: 'Admin',
    description: 'Admin panel — private',
    noindex: true,
    structuredData: null,
  });

  document.getElementById('site-header').style.display = 'none';
  document.getElementById('site-footer').style.display = 'none';
  container.style.maxWidth = '1100px';
  container.style.padding = '0';

  const session = getSession();
  if (session) {
    renderDashboard(container, session);
  } else {
    renderLogin(container);
  }

  return () => {
    document.getElementById('site-header').style.display = '';
    document.getElementById('site-footer').style.display = '';
    container.style.maxWidth = '';
    container.style.padding = '';
    const modal = document.getElementById('adminModal');
    if (modal) modal.remove();
  };
}

function renderLogin(container) {
  container.innerHTML = `
    <div class="admin-login">
      <div class="admin-login-box">
        <h1>Admin Panel</h1>
        <p>Portfolyo yönetim sistemi</p>
        <form id="adminLoginForm">
          <div class="form-group">
            <label for="admin-user">Kullanıcı Adı</label>
            <input type="text" id="admin-user" required>
          </div>
          <div class="form-group" style="margin-top:16px;">
            <label for="admin-pass">Şifre</label>
            <input type="password" id="admin-pass" required>
          </div>
          <button type="submit" class="form-submit" style="margin-top:24px;width:100%;text-align:center;">Giriş Yap</button>
          <p id="loginError" style="color:var(--color-accent-coral);font-size:13px;margin-top:12px;display:none;"></p>
        </form>
      </div>
    </div>
  `;

  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-user').value.trim();
    const password = document.getElementById('admin-pass').value;
    const errEl = document.getElementById('loginError');

    try {
      const user = await authenticateAdmin(username, password);
      if (user) {
        setSession(user);
        renderDashboard(container, user);
      } else {
        errEl.textContent = 'Geçersiz kullanıcı adı veya şifre.';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = 'Bağlantı hatası.';
      errEl.style.display = 'block';
    }
  });
}

function renderDashboard(container, user) {
  container.innerHTML = `
    <div class="admin-dashboard">
      <div class="admin-top-bar">
        <h1>${icon('layout-dashboard', 22)} Admin Panel</h1>
        <div class="admin-actions">
          <a href="/" class="btn btn-outline btn-sm">${icon('external-link')} Siteyi Gör</a>
          <button class="btn btn-outline btn-sm" id="adminLogout">${icon('log-out')} Çıkış</button>
        </div>
      </div>

      <div class="admin-tabs">
        <button class="admin-tab active" data-tab="videos">${icon('film')} Videolar</button>
        <button class="admin-tab" data-tab="info">${icon('file-text')} Hakkımda İçeriği</button>
        <button class="admin-tab" data-tab="messages">${icon('mail')} Mesajlar</button>
      </div>

      <div id="adminVideos" class="admin-section active"></div>
      <div id="adminInfo" class="admin-section"></div>
      <div id="adminMessages" class="admin-section"></div>
    </div>
  `;

  // Create modal in document.body
  let modal = document.getElementById('adminModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'adminModal';
    modal.innerHTML = '<div class="modal-box" id="adminModalContent"></div>';
    document.body.appendChild(modal);
  }

  refreshIcons();

  // Logout
  document.getElementById('adminLogout').addEventListener('click', () => {
    clearSession();
    renderLogin(container);
  });

  // Tabs
  const tabs = container.querySelectorAll('.admin-tab');
  const sections = {
    videos: document.getElementById('adminVideos'),
    info: document.getElementById('adminInfo'),
    messages: document.getElementById('adminMessages'),
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      Object.values(sections).forEach(s => s.classList.remove('active'));
      sections[tab.dataset.tab].classList.add('active');

      if (tab.dataset.tab === 'info' && !sections.info.dataset.loaded) {
        renderAdminInfo(sections.info, showToast);
        sections.info.dataset.loaded = 'true';
      }
      if (tab.dataset.tab === 'messages' && !sections.messages.dataset.loaded) {
        renderAdminMessages(sections.messages, showToast);
        sections.messages.dataset.loaded = 'true';
      }
    });
  });

  renderAdminVideos(sections.videos, showToast);
}

export { showToast };
