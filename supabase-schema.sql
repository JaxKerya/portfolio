-- ============================================
-- Rabia Göl Portfolio — Supabase Schema
-- Yeni tablolar (mevcut admin_users ve contact_messages korunuyor)
-- ============================================

-- Videos tablosu
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title_tr TEXT NOT NULL,
  title_en TEXT,
  description_tr TEXT,
  description_en TEXT,
  vimeo_url TEXT NOT NULL,
  vimeo_id TEXT NOT NULL,
  thumbnail_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Info Content tablosu
CREATE TABLE IF NOT EXISTS info_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE,
  content_tr TEXT,
  content_en TEXT,
  sort_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: videos tablosu herkese oku izni
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Videos public read" ON videos
  FOR SELECT USING (true);

CREATE POLICY "Videos admin full access" ON videos
  FOR ALL USING (true);

-- RLS: info_content tablosu herkese oku izni
ALTER TABLE info_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Info public read" ON info_content
  FOR SELECT USING (true);

CREATE POLICY "Info admin full access" ON info_content
  FOR ALL USING (true);

-- ============================================
-- Başlangıç verileri (isteğe bağlı)
-- ============================================

-- Info content için varsayılan bölümler
INSERT INTO info_content (section_key, content_tr, content_en, sort_order) VALUES
  ('photo_url', '', '', 0),
  ('bio', 'Merhaba! Ben Rabia Göl, profesyonel bir 3D Karakter Animatörüyüm. Karakter animasyonu ve hikaye anlatımına odaklanmış yaratıcı projeler geliştiriyorum.', 'Hello! I am Rabia Göl, a professional 3D Character Animator. I develop creative projects focused on character animation and storytelling.', 1),
  ('awards', '', '', 2),
  ('skills', 'Maya, 3D Animation, Character Animation, Storytelling', 'Maya, 3D Animation, Character Animation, Storytelling', 3),
  ('experience', '', '', 4),
  ('contact_info', 'contact@rabiagol.com', 'contact@rabiagol.com', 5),
  ('resume_url', '', '', 6)
ON CONFLICT (section_key) DO NOTHING;
