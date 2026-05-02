# Search Console & Webmaster Tools Kurulumu

> Site canlıya çıktıktan sonra **mutlaka** yapılması gereken kayıtlar.
> Bunlar olmadan Google ve Bing siteni hızlı/etkili indekslemez.
> Tahmini toplam süre: **15 dakika**.

---

## 1) Google Search Console

### 1.1 Property ekle

1. https://search.google.com/search-console/welcome adresine git.
2. **Domain** seçeneğini seç (DNS doğrulama).
3. `rabiagol.com` yaz, **Continue**.
4. Ekrana çıkan **TXT record**'u kopyala (örn: `google-site-verification=abc123...`).
5. Domain sağlayıcına git (Cloudflare / Namecheap / GoDaddy / vs.):
   - DNS ayarlarına TXT kaydı ekle:
     - **Type**: TXT
     - **Name**: `@` (veya boş bırak — root domain)
     - **Value**: `google-site-verification=abc123...`
     - **TTL**: 3600 (veya auto)
6. Kayıt sonrası 1-5 dakika bekle, Search Console'da **Verify** butonuna bas.

> Alternatif: HTML dosya yöntemi de var (Google verification dosyasını `public/` klasörüne ekle), ama Domain doğrulama daha güçlü çünkü tüm subdomain'leri kapsar.

### 1.2 Sitemap submit et

Verify olduktan sonra:

1. Sol menüden **Sitemaps**'e tıkla.
2. URL kutusuna `sitemap.xml` yaz, **Submit** bas.
3. Birkaç saat içinde "Success" durumuna geçmeli, **Discovered URLs** sayısı görünür.

### 1.3 İlk URL'leri manuel index'e gönder

Hızlandırmak için ana sayfaları manuel istek at:

1. Üst kutuya `https://rabiagol.com/` yapıştır → **Request Indexing**
2. Aynısı için: `/info`, `/contact`, ana videolar

> Manuel istek günde ~10 URL ile sınırlı. Sitemap zaten sürekli olarak indeksleniyor olacak.

### 1.4 Önemli ayarlar

- **Settings → Crawl rate**: Otomatik kalsın.
- **Settings → International targeting**: Geri ekran. (Türkiye seçmek istersen ayarlayabilirsin ama site iki dilli, otomatik bırakmak daha iyi.)

---

## 2) Bing Webmaster Tools

### 2.1 Site ekle

1. https://www.bing.com/webmasters adresine git.
2. Microsoft hesabınla giriş yap.
3. **Add a site** → `https://rabiagol.com` yaz.

### 2.2 Doğrulama (3 yöntem var, en kolayı *Import from Google*)

**A) Import from Google Search Console** *(en hızlı, önerim)*:
- Bing Webmaster ekranındaki **Import** butonuna tıkla.
- Google hesabını yetkilendir → Bing otomatik doğrulasın.

**B) DNS TXT** (Google'a benzer):
- Bing'in verdiği `BingSiteAuth=...` değerini DNS TXT kaydı olarak ekle.

**C) HTML meta tag**:
- `<meta name="msvalidate.01" content="...">` etiketini `index.html`'e ekle.

> A yöntemi en pratik ve tek tıkla biter.

### 2.3 Sitemap submit

1. Sol menü → **Sitemaps**.
2. `https://rabiagol.com/sitemap.xml` yaz → **Submit**.

### 2.4 Bing IndexNow

Bing daha agresif crawler için **IndexNow** API'sini kullanıyor. Yeni içerik eklediğinde anında haber verme:

1. Bing Webmaster → **IndexNow**
2. **Generate API key** → key dosyası iniyor (örn: `abc123.txt`).
3. Bu dosyayı `public/` klasörüne koy ve commit'le.
4. Yeni video eklediğinde Bing otomatik bilgilendirilebilir (manuel veya programatik).

> IndexNow opsiyonel ama Bing'de hızlı sıralama için faydalı.

---

## 3) Yandex Webmaster (Türkiye için bonus)

Türkiye'de hâlâ Yandex kullanan kullanıcı oranı az değil:

1. https://webmaster.yandex.com/sites/
2. Add site → `https://rabiagol.com`
3. **HTML file** veya **Meta tag** ile doğrula.
4. Sitemap submit: `https://rabiagol.com/sitemap.xml`

---

## 4) Sonrası — İlk hafta takibi

İlk hafta günlük 1-2 dk kontrol et:

### Google Search Console'da bak:
- **Coverage / Pages**: "Indexed" sayısı artıyor mu?
- **Performance**: Hangi aramalar gelmeye başladı?
- **Enhancements / Core Web Vitals**: Yeşil mi?
- **Enhancements / Mobile Usability**: Sorun var mı?
- **Enhancements / Video**: Video schema'ları görünüyor mu?

### Yapılması gerekenler:
- [ ] Search Console'da `Performance` raporunu Türkçe + İngilizce dil filtreleriyle ayrı ayrı incele.
- [ ] `Coverage` raporunda hata olan sayfa varsa düzelt.
- [ ] `URL Inspection` aracıyla manuel olarak rastgele 2-3 URL'i kontrol et: "URL is on Google" görüyor olmalısın.

---

## 5) Eski portfolyodan geçişte yapılacaklar

Eğer eski domain'den (`old-portfolio.something`) bu yeni siteye geçiyorsan:

1. **Eski Search Console'a** girip **Settings → Change of Address**'i kullan.
2. Eski domain'in DNS'inde 301 redirect kur:
   - Tüm eski path'leri `https://rabiagol.com/<aynı path>` veya `https://rabiagol.com/`'a yönlendir.
3. Eski sitemap'i Search Console'da `Remove`.
4. Yeni domain'e geçtikten sonra eski rank'ler 1-2 hafta içinde yeni domain'e taşınır.

> Yeni domain ise (eski sayfa hiç yoktu), bu adıma gerek yok.

---

## 6) Hızlandırma — Sosyal sinyaller

Search Console + Bing kayıt yaptıktan sonra:

- **LinkedIn profil**: portfolyo URL'i ekli olduğundan emin ol.
- **Vimeo profil**: bio'da `https://rabiagol.com` olsun.
- **Instagram bio**: link.
- **GitHub** (varsa): profile link ekle.
- **Behance / ArtStation**: portfolyo link.

Bu yüksek-otorite siteler `https://rabiagol.com`'a backlink verince Google domain'i daha hızlı keşfeder ve daha güvenli sayar.

---

## 7) Kontrol checklist (hızlı geçiş)

```
[ ] Google Search Console — domain doğrulandı
[ ] Google Search Console — sitemap submit edildi
[ ] Google Search Console — ana sayfalar manuel index'e gönderildi
[ ] Bing Webmaster — site eklendi (Google'dan import)
[ ] Bing Webmaster — sitemap submit edildi
[ ] Yandex Webmaster — site eklendi (opsiyonel)
[ ] LinkedIn / Vimeo / Instagram bio'larında link güncel
[ ] Site canlıda — robots.txt ve sitemap.xml fetch edilebiliyor
[ ] Schema.org Structured Data Test — https://search.google.com/test/rich-results
[ ] PageSpeed Insights — https://pagespeed.web.dev (en az 90+ olmalı)
```

---

## 8) Faydalı doğrulama araçları

Her deploy sonrası bu testleri çalıştırmak iyi olur:

| Araç | Amaç |
|---|---|
| https://search.google.com/test/rich-results | JSON-LD doğru mu? |
| https://www.opengraph.xyz/url/<url> | OG kart önizlemesi |
| https://cards-dev.twitter.com/validator | Twitter card |
| https://www.linkedin.com/post-inspector | LinkedIn unfurl |
| https://pagespeed.web.dev/ | Lighthouse + CWV |
| https://www.xml-sitemaps.com/validate-xml-sitemap.html | Sitemap validation |
| https://validator.schema.org/ | Schema.org validator |

---

## 9) Yapay zeka botları (bonus)

`public/llms.txt` zaten hazır. Ek olarak:

- **OpenAI ChatGPT plugin / browsing**: `robots.txt`'te `GPTBot` ve `OAI-SearchBot` Allow.
- **Anthropic Claude**: `ClaudeBot`, `Claude-Web`, `anthropic-ai` Allow.
- **Perplexity**: `PerplexityBot` Allow.
- **Google AI training**: `Google-Extended` Allow (Bard ve Gemini sitende eğitilebilir).

Hepsi mevcut `public/robots.txt`'te ayarlandı. AI'larda site referans verildiğinde "Rabia Göl" olarak çıkma şansı yüksek.
