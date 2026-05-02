// Public yapılandırma sabitleri.
//
// Buradaki değerler frontend bundle'ına gömülür; bu yüzden YALNIZCA
// public bilgileri (site key, public URL, public bucket adı vs.)
// içermelidir. Secret/private key'ler Edge Function ortam
// değişkenlerinde tutulur.

/**
 * Cloudflare Turnstile site key (public).
 *
 * Kurulum:
 *   1. https://dash.cloudflare.com/?to=/:account/turnstile adresine git
 *   2. "Add site" → site adı ver, domain(ler)i ekle (localhost otomatik dahil)
 *   3. Widget mode: "Managed" seçili olsun
 *   4. Oluşturulan "Site Key"i buraya yapıştır
 *   5. "Secret Key"i Supabase Edge Function secret olarak ekle
 *      (TURNSTILE_SECRET adıyla)
 *
 * Boş bırakırsan captcha doğrulaması atlanır (development için).
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAADEVTZHRMT02-7Th';

/**
 * Captcha'yı geçici olarak kapatmak için true yap.
 * (localhost testlerinde Cloudflare bazen "domain not allowed" diyor;
 *  prod'a deploy ettiğimde bunu false yapacağız.)
 */
const DISABLE_CAPTCHA = false;

/**
 * Captcha kullanılsın mı? Site key boşsa veya manuel kapatılmışsa false.
 */
export const CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY) && !DISABLE_CAPTCHA;
