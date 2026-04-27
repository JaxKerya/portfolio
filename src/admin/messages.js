import { getContactMessages, markMessageRead, deleteContactMessage } from '../supabase.js';
import { icon, refreshIcons } from './icons.js';

/**
 * ADMIN MESSAGES TAB — View contact messages
 */
export async function renderAdminMessages(container, showToast) {
  container.innerHTML = `<p style="color:var(--color-text-muted);">Yükleniyor...</p>`;

  let messages = await getContactMessages();
  let isBusy = false;

  const reloadFromServer = async () => {
    messages = await getContactMessages();
  };

  const render = () => {
    const unread = messages.filter(m => !m.is_read).length;

    container.innerHTML = `
      <div class="admin-section-header">
        <h2>${icon('mail')} Mesajlar (${messages.length}) ${unread > 0 ? `<span style="color:var(--color-accent-blue);font-size:13px;font-weight:400;">${icon('bell-dot', 14)} ${unread} okunmamış</span>` : ''}</h2>
        <button class="btn btn-outline btn-sm" id="refreshMsgs" ${isBusy ? 'disabled' : ''}>${icon('refresh-cw')} Yenile</button>
      </div>
      <div id="messagesList">
        ${messages.length === 0
        ? `<p style="text-align:center;color:var(--color-text-muted);padding:40px 0;">${icon('inbox', 24)}<br>Henüz mesaj yok.</p>`
        : messages.map(m => `
            <div class="admin-message-item ${m.is_read ? '' : 'unread'}" data-id="${m.id}">
              <div class="admin-message-header">
                <span class="admin-message-sender">${icon('user', 14)} ${escapeHtml(m.name || 'Anonim')} &middot; ${escapeHtml(m.email || '')}</span>
                <span class="admin-message-date">${icon('clock', 12)} ${formatDate(m.created_at)}</span>
              </div>
              <div class="admin-message-subject">${escapeHtml(m.subject || 'Konu yok')}</div>
              <div class="admin-message-body">${escapeHtml(m.message || '')}</div>
              <div class="admin-message-actions">
                <button class="btn btn-outline btn-sm toggle-read-btn" data-id="${m.id}" data-read="${m.is_read}" ${isBusy ? 'disabled' : ''}>
                  ${m.is_read ? `${icon('eye-off')} Okunmadı İşaretle` : `${icon('eye')} Okundu İşaretle`}
                </button>
                <button class="btn btn-danger btn-sm delete-msg-btn" data-id="${m.id}" ${isBusy ? 'disabled' : ''}>${icon('trash-2')} Sil</button>
              </div>
            </div>
          `).join('')
      }
      </div>
    `;

    refreshIcons();
    bindEvents();
  };

  const runAction = async (action, successMsg) => {
    if (isBusy) return;
    isBusy = true;
    render();
    try {
      await action();
      // Tek doğru kaynak: DB. Lokal state'i tazele.
      await reloadFromServer();
      if (successMsg) showToast(successMsg);
    } catch (err) {
      showToast('Hata: ' + (err?.message || 'Bilinmeyen hata'), 'error');
    } finally {
      isBusy = false;
      render();
    }
  };

  function bindEvents() {
    document.getElementById('refreshMsgs').addEventListener('click', async () => {
      await runAction(async () => {}, null);
    });

    container.querySelectorAll('.toggle-read-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const isRead = btn.dataset.read === 'true';
        runAction(() => markMessageRead(id, !isRead), null);
      });
    });

    container.querySelectorAll('.delete-msg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Bu öğeyi silmek istediğinize emin misiniz?')) return;
        const id = btn.dataset.id;
        runAction(() => deleteContactMessage(id), 'Silindi!');
      });
    });
  }

  render();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
