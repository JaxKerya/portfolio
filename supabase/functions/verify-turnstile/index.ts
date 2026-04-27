// Supabase Edge Function: verify-turnstile
//
// Cloudflare Turnstile token'ını doğrular. Frontend, contact formunu
// göndermeden önce bu function'ı çağırır; success=true dönerse mesaj
// Supabase'e yazılır.
//
// Beklenen secrets:
//   TURNSTILE_SECRET - Cloudflare Turnstile secret key
//
// İstek:    POST { token: string }
// Yanıt:    { success: boolean, errors?: string[] }

// @ts-ignore - Deno global runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// @ts-ignore - Deno global
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET');

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  if (!TURNSTILE_SECRET) {
    console.error('TURNSTILE_SECRET env eksik');
    return jsonResponse(
      { success: false, error: 'TURNSTILE_SECRET missing' },
      { status: 500 },
    );
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
  if (!token) {
    return jsonResponse({ success: false, error: 'No token' }, { status: 400 });
  }

  // İstemci IP'sini Cloudflare'a ileterek doğrulamayı güçlendir.
  const remoteIp =
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';

  const formData = new FormData();
  formData.append('secret', TURNSTILE_SECRET);
  formData.append('response', token);
  if (remoteIp) formData.append('remoteip', remoteIp);

  try {
    const resp = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: formData,
    });
    const data = await resp.json();

    return jsonResponse({
      success: data?.success === true,
      errors: data?.['error-codes'] ?? [],
      hostname: data?.hostname ?? null,
    });
  } catch (err) {
    console.error('Turnstile doğrulama hatası:', err);
    return jsonResponse(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
});
