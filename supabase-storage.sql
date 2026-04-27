-- ============================================
-- Supabase Storage — "uploads" bucket
-- Custom thumbnail / profil fotoğrafı yüklemeleri için
-- Bu dosyayı Supabase Dashboard → SQL Editor üzerinde bir kez çalıştırın.
-- ============================================

-- Public bucket oluştur (zaten varsa atla)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,                                    -- public read
  10 * 1024 * 1024,                        -- 10 MB max
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public okuma izni (resimler herkese görünür olmalı)
DROP POLICY IF EXISTS "uploads_public_read" ON storage.objects;
CREATE POLICY "uploads_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');

-- Anon kullanıcı yükleyebilsin (admin login zaten anon key ile çalışıyor)
-- NOT: Admin paneline kim giriyorsa o yükleyebilir; sitemizde anon key
-- public ama admin sayfası kendi auth tablosuna karşı doğrulanıyor.
DROP POLICY IF EXISTS "uploads_anon_insert" ON storage.objects;
CREATE POLICY "uploads_anon_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads');

-- Anon kullanıcı kendi yüklediği dosyayı silebilsin/güncelleyebilsin
DROP POLICY IF EXISTS "uploads_anon_update" ON storage.objects;
CREATE POLICY "uploads_anon_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'uploads');

DROP POLICY IF EXISTS "uploads_anon_delete" ON storage.objects;
CREATE POLICY "uploads_anon_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'uploads');
