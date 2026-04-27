import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://klboimyqmnskaghdgfaq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsYm9pbXlxbW5za2FnaGRnZmFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDkxNDIsImV4cCI6MjA3NDAyNTE0Mn0.g-_A4o91e4h7NEEIKOrINuaB4S0mrB7qaD3ol1wzuz0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Videos ───
/**
 * @param {{ includeInactive?: boolean }} [opts]
 *   includeInactive=true → admin paneli için pasif (taslak) videolar da döner.
 *   varsayılan false → public site sadece aktif videoları görür.
 */
export async function getVideos(opts = {}) {
  let query = supabase.from('videos').select('*');
  if (!opts.includeInactive) query = query.eq('is_active', true);
  query = query.order('sort_order', { ascending: true });
  const { data, error } = await query;
  if (error) { console.error('getVideos:', error); return []; }
  return data;
}

export async function getVideoById(id) {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error('getVideoById:', error); return null; }
  return data;
}

export async function addVideo(video) {
  const { data, error } = await supabase
    .from('videos')
    .insert([video])
    .select();
  if (error) throw error;
  return data[0];
}

export async function updateVideo(id, updates) {
  const { data, error } = await supabase
    .from('videos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteVideo(id) {
  const { error } = await supabase
    .from('videos')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function updateVideoOrder(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('videos')
      .update({ sort_order: i })
      .eq('id', orderedIds[i]);
  }
}

/**
 * Birden fazla videoyu tek seferde sil.
 */
export async function bulkDeleteVideos(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const { error } = await supabase
    .from('videos')
    .delete()
    .in('id', ids);
  if (error) throw error;
}

/**
 * Birden fazla videonun is_active alanını topluca güncelle.
 */
export async function bulkSetActive(ids, isActive) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const { error } = await supabase
    .from('videos')
    .update({ is_active: !!isActive, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}

// ─── Storage (uploads) ───
const UPLOAD_BUCKET = 'uploads';

/**
 * Bir File/Blob'u Supabase Storage'a yükler ve public URL döner.
 *
 * @param {File|Blob} file - Yüklenecek dosya
 * @param {string} [folder='thumbnails'] - Bucket içindeki klasör (örn. "thumbnails", "photos")
 * @returns {Promise<{ url: string, path: string }>}
 */
export async function uploadFile(file, folder = 'thumbnails') {
  if (!file) throw new Error('Dosya bulunamadı.');

  const ext = (file.name || '').split('.').pop()?.toLowerCase() || 'bin';
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : 'bin';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${safeExt}`;
  const path = `${folder}/${filename}`;

  const { error } = await supabase
    .storage
    .from(UPLOAD_BUCKET)
    .upload(path, file, {
      contentType: file.type || undefined,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) throw error;

  const { data: pub } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl, path };
}

// ─── Info Content ───
export async function getInfoContent() {
  const { data, error } = await supabase
    .from('info_content')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) { console.error('getInfoContent:', error); return []; }
  return data;
}

export async function upsertInfoContent(sectionKey, contentTr, contentEn) {
  const { data, error } = await supabase
    .from('info_content')
    .upsert({
      section_key: sectionKey,
      content_tr: contentTr,
      content_en: contentEn,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'section_key' })
    .select();
  if (error) throw error;
  return data[0];
}

// ─── Turnstile (Captcha) ───
/**
 * Cloudflare Turnstile token'ını Edge Function üzerinden doğrular.
 * @param {string} token - Turnstile widget'ından alınan token
 * @returns {Promise<{ success: boolean, errors?: string[] }>}
 */
export async function verifyTurnstile(token) {
  if (!token) return { success: false, errors: ['no-token'] };

  try {
    const { data, error } = await supabase.functions.invoke('verify-turnstile', {
      body: { token },
    });
    if (error) {
      console.error('verifyTurnstile invoke error:', error);
      return { success: false, errors: ['invoke-failed'] };
    }
    return data || { success: false, errors: ['empty-response'] };
  } catch (err) {
    console.error('verifyTurnstile error:', err);
    return { success: false, errors: ['exception'] };
  }
}

// ─── Contact Messages ───
export async function addContactMessage(msg) {
  // Use RPC function to bypass RLS (same approach as old portfolio)
  const { data, error } = await supabase
    .rpc('insert_contact_message', {
      p_name: msg.name,
      p_email: msg.email,
      p_subject: msg.subject,
      p_message: msg.message,
      p_ip_address: null,
    });
  if (error) throw error;
  return data;
}

export async function getContactMessages() {
  // Use RPC to bypass RLS (same approach as old portfolio)
  const { data, error } = await supabase
    .rpc('get_contact_messages_admin');
  if (error) { console.error('getContactMessages:', error); return []; }
  return data || [];
}

export async function markMessageRead(id, isRead) {
  // Önce normal update'i dene
  const { data, error } = await supabase
    .from('contact_messages')
    .update({ is_read: isRead, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();

  if (!error && data && data.length > 0) {
    return data[0];
  }

  // RLS engeli vb. -- RPC fallback
  const rpcName = isRead ? 'mark_message_as_read' : 'mark_message_as_unread';
  const { data: rpcData, error: rpcError } = await supabase
    .rpc(rpcName, { message_id: id });

  if (rpcError) throw rpcError;
  // RPC başarı zarfını kontrol et: { success: bool, error?: string, data?: any }
  if (rpcData && typeof rpcData === 'object' && 'success' in rpcData && !rpcData.success) {
    throw new Error(rpcData.error || 'RPC işlemi başarısız');
  }
  return rpcData;
}

export async function deleteContactMessage(id) {
  // Önce normal delete'i dene
  const { data, error } = await supabase
    .from('contact_messages')
    .delete()
    .eq('id', id)
    .select('id');

  if (!error && data && data.length > 0) {
    return data[0];
  }

  // RLS engeli vb. -- RPC fallback
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('delete_contact_message', { message_id: id });

  if (rpcError) throw rpcError;
  if (rpcData && typeof rpcData === 'object' && 'success' in rpcData && !rpcData.success) {
    throw new Error(rpcData.error || 'Silme işlemi başarısız');
  }
  return rpcData;
}

// ─── Admin Auth ───
export async function authenticateAdmin(username, password) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('username', username)
    .eq('password_hash', password)
    .eq('is_active', true)
    .single();
  if (error) return null;
  return data;
}
