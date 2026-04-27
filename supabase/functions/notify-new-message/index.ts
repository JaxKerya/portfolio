// Supabase Edge Function: notify-new-message
//
// Database webhook tarafından çağrılır. contact_messages tablosuna yeni
// satır eklendiğinde Resend üzerinden bildirim email'i gönderir.
//
// Beklenen secrets:
//   RESEND_API_KEY    - https://resend.com/api-keys
//   NOTIFY_EMAIL      - Bildirimi alacak adres (örn. rabia@example.com)
//   FROM_EMAIL        - Gönderici adres. Doğrulanmış bir domain yoksa
//                       "onboarding@resend.dev" kullanılabilir.

// @ts-ignore - Deno global runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// @ts-ignore - Deno global
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
// @ts-ignore - Deno global
const NOTIFY_EMAIL = Deno.env.get('NOTIFY_EMAIL');
// @ts-ignore - Deno global
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildHtml(record: Record<string, unknown>): string {
  const name = escapeHtml(record.name);
  const email = escapeHtml(record.email);
  const subject = escapeHtml(record.subject);
  const message = escapeHtml(record.message).replace(/\n/g, '<br>');
  const createdAt = record.created_at
    ? new Date(String(record.created_at)).toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
    })
    : '';

  return `<!doctype html>
<html lang="tr">
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f0f0f;color:#eaeaea;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:24px;border:1px solid #2a2a2a;">
    <h2 style="margin:0 0 16px;color:#4ca5ff;">Yeni İletişim Mesajı</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:6px 0;color:#888;width:90px;">İsim:</td>
        <td style="padding:6px 0;">${name}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#888;">Email:</td>
        <td style="padding:6px 0;"><a href="mailto:${email}" style="color:#4ca5ff;">${email}</a></td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#888;">Konu:</td>
        <td style="padding:6px 0;">${subject}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#888;">Tarih:</td>
        <td style="padding:6px 0;">${createdAt}</td>
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #2a2a2a;margin:18px 0;">
    <div style="white-space:pre-wrap;line-height:1.6;color:#eaeaea;">${message}</div>
    <p style="margin-top:24px;color:#666;font-size:12px;">
      Bu bildirim portfolyo sitesinin iletişim formundan otomatik olarak gönderildi.
    </p>
  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY env eksik');
    return jsonResponse({ success: false, error: 'RESEND_API_KEY missing' }, { status: 500 });
  }
  if (!NOTIFY_EMAIL) {
    console.error('NOTIFY_EMAIL env eksik');
    return jsonResponse({ success: false, error: 'NOTIFY_EMAIL missing' }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Database webhook payload: { type, table, schema, record, old_record }
  // Manuel test için: doğrudan record nesnesi de kabul ediyoruz.
  const record = body?.record || body;

  if (!record || typeof record !== 'object') {
    return jsonResponse({ success: false, error: 'No record' }, { status: 400 });
  }

  const subject = String(record.subject ?? '(Konu yok)').slice(0, 120);
  const replyTo = String(record.email ?? '').trim();

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFY_EMAIL],
        subject: `[Portfolio] ${subject}`,
        html: buildHtml(record),
        reply_to: replyTo || undefined,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Resend hatası:', resp.status, errText);
      return jsonResponse(
        { success: false, error: `Resend ${resp.status}`, detail: errText },
        { status: 502 },
      );
    }

    const data = await resp.json();
    return jsonResponse({ success: true, id: data?.id ?? null });
  } catch (err) {
    console.error('Email gönderilemedi:', err);
    return jsonResponse(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
});
