# Email Bildirim + Captcha Kurulum Rehberi

Bu rehber **Madde 4 (Resend ile email bildirimi)** ve **Madde 12 (Cloudflare Turnstile captcha)** özelliklerini canlıya almak için gereken tüm adımları içerir.

---

## 1) Cloudflare Turnstile (Captcha) — ÜCRETSİZ

### 1.1 Site oluştur

1. https://dash.cloudflare.com/?to=/:account/turnstile adresine git (Cloudflare hesabın yoksa ücretsiz aç)
2. **Add site** → şu bilgileri gir:
   - **Site name**: `Rabia Göl Portfolio` (istediğin ad)
   - **Domain**: prod domain'in (örn. `rabiagol.com`). Birden fazla ekleyebilirsin. `localhost` otomatik dahildir.
   - **Widget mode**: `Managed` (önerilen)
3. **Create** → karşına iki key gelecek:
   - **Site Key** (public, frontend'de) → kodda kullanılacak
   - **Secret Key** (private) → Supabase'e secret olarak eklenecek

### 1.2 Site Key'i frontend'e ekle

`src/config.js` dosyasını aç ve şu satırı güncelle:

```js
export const TURNSTILE_SITE_KEY = '0x4AAAAAADEVTZHRMT02-7Th'; // <-- Cloudflare'den aldığın site key
```

> Boş string bırakırsan captcha tamamen devre dışı kalır (development için kullanışlı).

---

## 2) Resend (Email Bildirim) — ÜCRETSİZ (ayda 3000 mail)

### 2.1 Hesap aç

1. https://resend.com → **Sign Up** (Google/GitHub ile hızlıca açabilirsin)
2. **API Keys** sayfasına git → **Create API Key**
   - Name: `portfolio-notify`
   - Permission: `Sending access` (yeterli)
3. Oluşturulan key'i kopyala — **bir daha gösterilmez**, kaybetmemen lazım.

### 2.2 Gönderici adresi

İki seçenek var:

**A) Hızlı başlangıç (test):**  
Resend default olarak `onboarding@resend.dev` adresinden mail göndermene izin verir, ama sadece kayıt olduğun email'e mail atabilir. Yani notification email'in Resend hesabınla aynı olmalı.

**B) Kendi domain'in (önerilen, prod için):**  
Domain'in varsa (örn. `rabiagol.com`):

1. Resend → **Domains** → **Add Domain** → `rabiagol.com`
2. Sana verilen DNS kayıtlarını domain DNS panelinde ekle (genelde 3 TXT/MX kaydı)
3. Doğrulama tamamlanınca `noreply@rabiagol.com` gibi bir adresten mail atabilirsin

---

## 3) Supabase Edge Functions Deploy

İki yol var: **Dashboard (kolay)** veya **CLI (hızlı)**.

### 3.A — Dashboard ile (kod yapıştırma) — TAVSİYE EDİLEN

1. Supabase Dashboard → **Edge Functions** sekmesi
2. **Deploy a new function** → adı: `verify-turnstile`
3. Editor açılınca `supabase/functions/verify-turnstile/index.ts` dosyasının içeriğini kopyala-yapıştır
4. **Deploy function**
5. Aynı işlemi `notify-new-message` için tekrar et — kod: `supabase/functions/notify-new-message/index.ts`

> Her iki function da **tek-dosya** olarak yazıldı (CORS helper'ı inline). Dashboard'dan kopyala-yapıştır sorunsuz çalışır.

### 3.B — CLI ile (gelişmiş)

```powershell
# 1) Supabase CLI kur (Windows için)
scoop install supabase
# veya: npm i -g supabase  (npm versiyonu deprecated, scoop daha güvenilir)

# 2) Login
supabase login

# 3) Projeye link
supabase link --project-ref klboimyqmnskaghdgfaq

# 4) Deploy
supabase functions deploy verify-turnstile
supabase functions deploy notify-new-message
```

---

## 4) Edge Function Secrets

Function'lar deploy edildikten sonra environment variable'larını eklemen gerek.

### Dashboard:
1. Supabase → **Edge Functions** → ilgili function'a tıkla → **Secrets** sekmesi
2. Şu secret'ları ekle:

**`verify-turnstile`** için:
| Key | Value |
|---|---|
| `TURNSTILE_SECRET` | Cloudflare'den aldığın **Secret Key** |

**`notify-new-message`** için:
| Key | Value |
|---|---|
| `RESEND_API_KEY` | Resend'den aldığın API key (`re_...`) |
| `NOTIFY_EMAIL` | Bildirim alacağın email (örn. `rabia@gmail.com`) |
| `FROM_EMAIL` | Gönderici adresi. Test için: `onboarding@resend.dev`. Prod için: `noreply@rabiagol.com` |

### CLI alternatifi:
```powershell
supabase secrets set TURNSTILE_SECRET=0xAAA... 
supabase secrets set RESEND_API_KEY=re_xxx 
supabase secrets set NOTIFY_EMAIL=rabia@gmail.com 
supabase secrets set FROM_EMAIL=onboarding@resend.dev
```

---

## 5) Database Webhook (Yeni mesajda email tetikleyici)

Email function'ının otomatik tetiklenmesi için, `contact_messages` tablosuna her INSERT'te webhook çağrısı yapılması gerek.

1. Supabase Dashboard → **Database** → **Webhooks**
2. **Create a new hook** → bilgiler:
   - **Name**: `notify-new-contact-message`
   - **Table**: `contact_messages`
   - **Events**: ☑ `Insert` (sadece bu)
   - **Type**: `Supabase Edge Functions` (varsa) **VEYA** `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://klboimyqmnskaghdgfaq.supabase.co/functions/v1/notify-new-message`
   - **HTTP Headers**:
     - `Content-Type`: `application/json`
     - `Authorization`: `Bearer SUPABASE_SERVICE_ROLE_KEY` _(veya anon key — function public)_
3. **Confirm**

> Webhook payload'u otomatik olarak `{ type, table, record, old_record }` formatında yollanır; function bunu zaten doğru parse ediyor.

### Test:

İletişim formundan kendine bir test mesajı gönder. **Edge Functions → Logs** sekmesinden function'ın çağrıldığını doğrulayabilirsin. NOTIFY_EMAIL adresine mail düşmesi 5–30 saniye sürebilir.

---

## 6) Tamamlanma Kontrolü

Aşağıdakileri tek tek işaretleyerek ilerleyebilirsin:

- [ ] Cloudflare Turnstile site oluşturuldu, site key + secret key alındı
- [ ] `src/config.js` içinde `TURNSTILE_SITE_KEY` güncellendi
- [ ] Resend hesabı oluşturuldu, API key alındı
- [ ] `verify-turnstile` Edge Function deploy edildi
- [ ] `notify-new-message` Edge Function deploy edildi
- [ ] `verify-turnstile` secret'ı eklendi: `TURNSTILE_SECRET`
- [ ] `notify-new-message` secret'ları eklendi: `RESEND_API_KEY`, `NOTIFY_EMAIL`, `FROM_EMAIL`
- [ ] Database webhook oluşturuldu (`contact_messages` INSERT → `notify-new-message`)
- [ ] Test: Contact formundan mesaj gönder, captcha çıkıyor mu, email düşüyor mu?

---

## 7) Sorun Giderme

| Sorun | Çözüm |
|---|---|
| Captcha widget hiç görünmüyor | `TURNSTILE_SITE_KEY` boş bırakılmış. `src/config.js`'e gerçek key'i ekle. |
| Captcha "domain mismatch" hatası | Cloudflare panelinde domain listesine sitenin domain'ini ekle. |
| Email gelmiyor | 1) Resend → Logs sekmesinde mail durumu kontrol. 2) Spam klasörüne bak. 3) `FROM_EMAIL` doğrulanmamış domain ise `onboarding@resend.dev`'e geri dön. |
| Edge function "RESEND_API_KEY missing" | Function Secrets'ı eklenmemiş. Bölüm 4'ü tekrar uygula. |
| Webhook çağrılmıyor | Dashboard → Database → Webhooks → ilgili hook → "Recent deliveries" sekmesinden hata mesajını gör. |
