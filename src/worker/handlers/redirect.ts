// MDL.cc - Fast Redirect Handler
// Priority: SPEED - KV lookup first, DB fallback only if needed

import { Env, KVLinkData, Click } from '../types';
import { generateId, parseUserAgent, hashIP, getToday } from '../utils';

export async function handleRedirect(
  shortCode: string,
  request: Request,
  env: Env
): Promise<Response> {
  // 1. KV lookup - fastest path (< 10ms globally)
  const kvData = await env.URL_KV.get<KVLinkData>(shortCode, 'json');

  if (kvData) {
    // Check if link is active
    if (!kvData.is_active) {
      return new Response('This link has been deactivated', { status: 410 });
    }

    // Check expiration
    if (kvData.expires_at && new Date(kvData.expires_at) < new Date()) {
      return new Response('This link has expired', { status: 410 });
    }

    // Check password protection
    if (kvData.password) {
      const providedPassword = new URL(request.url).searchParams.get('p');
      if (providedPassword !== kvData.password) {
        return createPasswordPage(shortCode);
      }
    }

    // Track click asynchronously (don't block redirect)
    request.ctx?.waitUntil?.(trackClick(kvData.link_id, request, env));

    // Fast redirect
    return Response.redirect(kvData.url, 302);
  }

  // 2. DB fallback (in case KV is stale)
  const link = await env.DB.prepare(
    'SELECT id, original_url, password, expires_at, is_active FROM links WHERE short_code = ? LIMIT 1'
  )
    .bind(shortCode)
    .first<{
      id: string;
      original_url: string;
      password: string | null;
      expires_at: string | null;
      is_active: number;
    }>();

  if (!link) {
    return new Response('Link not found', { status: 404 });
  }

  if (!link.is_active) {
    return new Response('This link has been deactivated', { status: 410 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return new Response('This link has expired', { status: 410 });
  }

  if (link.password) {
    const providedPassword = new URL(request.url).searchParams.get('p');
    if (providedPassword !== link.password) {
      return createPasswordPage(shortCode);
    }
  }

  // Update KV cache for next time
  const kvDataToCache: KVLinkData = {
    url: link.original_url,
    password: link.password || undefined,
    expires_at: link.expires_at || undefined,
    is_active: true,
    link_id: link.id,
  };

  // Cache in KV (don't await)
  env.URL_KV.put(shortCode, JSON.stringify(kvDataToCache), {
    expirationTtl: 86400, // 24 hours
  });

  // Track click
  request.ctx?.waitUntil?.(trackClick(link.id, request, env));

  return Response.redirect(link.original_url, 302);
}

// Track click analytics
async function trackClick(linkId: string, request: Request, env: Env): Promise<void> {
  try {
    const cf = (request as any).cf;
    const ua = request.headers.get('User-Agent');
    const referer = request.headers.get('Referer');
    const ip = request.headers.get('CF-Connecting-IP') || '';

    const { device, browser, os } = parseUserAgent(ua);
    const ipHash = await hashIP(ip);
    const today = getToday();

    // Insert click record
    await env.DB.prepare(
      `INSERT INTO clicks (id, link_id, timestamp, country, city, region, device_type, browser, os, referer, ip_hash)
       VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        generateId(),
        linkId,
        cf?.country || null,
        cf?.city || null,
        cf?.region || null,
        device,
        browser,
        os,
        referer,
        ipHash
      )
      .run();

    // Update daily stats (upsert)
    await env.DB.prepare(
      `INSERT INTO daily_stats (id, link_id, date, click_count, unique_visitors)
       VALUES (?, ?, ?, 1, 1)
       ON CONFLICT(link_id, date) DO UPDATE SET
         click_count = click_count + 1,
         unique_visitors = unique_visitors + CASE
           WHEN NOT EXISTS (
             SELECT 1 FROM clicks
             WHERE link_id = ? AND date(timestamp) = ? AND ip_hash = ?
             LIMIT 1
           ) THEN 1 ELSE 0
         END`
    )
      .bind(generateId(), linkId, today, linkId, today, ipHash)
      .run();
  } catch (error) {
    console.error('Error tracking click:', error);
  }
}

// Simple password protection page
function createPasswordPage(shortCode: string): Response {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Protected Link - MDL.cc</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f8fafc;
    }
    .container {
      background: rgba(30, 41, 59, 0.8);
      padding: 2.5rem;
      border-radius: 1rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      text-align: center;
      max-width: 400px;
      width: 90%;
    }
    .logo {
      font-size: 2rem;
      font-weight: 700;
      color: #10b981;
      margin-bottom: 0.5rem;
    }
    .tagline {
      color: #94a3b8;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }
    .lock-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    form { margin-top: 1.5rem; }
    input {
      width: 100%;
      padding: 0.875rem 1rem;
      border: 2px solid #334155;
      border-radius: 0.5rem;
      background: #1e293b;
      color: #f8fafc;
      font-size: 1rem;
      margin-bottom: 1rem;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #10b981;
    }
    button {
      width: 100%;
      padding: 0.875rem 1.5rem;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #059669; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">MDL.cc</div>
    <div class="tagline">The middle-point between you and your destination</div>
    <div class="lock-icon">🔒</div>
    <h1>This link is password protected</h1>
    <form action="/${shortCode}" method="GET">
      <input type="password" name="p" placeholder="Enter password" required autofocus>
      <button type="submit">Access Link →</button>
    </form>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 401,
    headers: { 'Content-Type': 'text/html' },
  });
}
