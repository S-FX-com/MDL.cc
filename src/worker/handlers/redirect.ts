// MDL.cc - Fast Redirect Handler
// Priority: SPEED - KV lookup first, DB fallback only if needed.
//
// Short codes live at two path shapes:
//   • mdl.cc/m{code}            (default shared domain)
//   • <custom-domain>/{code}    (workspace-branded domain)
//
// We use a workspace-scoped KV key when resolving branded domains so two
// workspaces can own the same short_code without collisions.

import { Env, KVLinkData } from '../types';
import { generateId, parseUserAgent, hashIP, getToday } from '../utils';
import { findDomainByHost } from './domains';
import { buildPreviewResponse } from './preview';

export async function handleRedirect(
  shortCode: string,
  request: Request,
  env: Env,
  workspaceId: string | null = null,
): Promise<Response> {
  const kvKey = workspaceId ? `ws:${workspaceId}:${shortCode}` : shortCode;

  // 1. KV lookup - fastest path (< 10ms globally)
  const kvData = await env.URL_KV.get<KVLinkData>(kvKey, 'json');

  if (kvData) {
    const gate = evaluate(kvData, request, shortCode);
    if (gate) return gate;
    (request as any).ctx?.waitUntil?.(trackClick(kvData.link_id, request, env));
    return servePreview(env, request, kvData, workspaceId);
  }

  // 2. DB fallback — scoped to the workspace when branded, global on mdl.cc.
  const link = workspaceId
    ? await env.DB.prepare(
        'SELECT id, original_url, password, expires_at, is_active, title, description FROM links WHERE short_code = ? AND workspace_id = ? LIMIT 1',
      ).bind(shortCode, workspaceId).first<DbLink>()
    : await env.DB.prepare(
        'SELECT id, original_url, password, expires_at, is_active, title, description FROM links WHERE short_code = ? LIMIT 1',
      ).bind(shortCode).first<DbLink>();

  if (!link) return new Response('Link not found', { status: 404 });

  const kvFromDb: KVLinkData = {
    url: link.original_url,
    password: link.password || undefined,
    expires_at: link.expires_at || undefined,
    is_active: !!link.is_active,
    link_id: link.id,
    title: link.title,
    description: link.description,
  };

  const gate = evaluate(kvFromDb, request, shortCode);
  if (gate) return gate;

  // Cache for next time; TTL short enough that deletes propagate quickly.
  env.URL_KV.put(kvKey, JSON.stringify(kvFromDb), { expirationTtl: 86400 });

  (request as any).ctx?.waitUntil?.(trackClick(link.id, request, env));
  return servePreview(env, request, kvFromDb, workspaceId);
}

// Serve the OG-tagged interstitial HTML. The redirect itself happens via
// <meta refresh> + JS in the body (see preview.ts) so social unfurlers see
// the metadata before any browser navigation.
async function servePreview(
  env: Env,
  request: Request,
  data: KVLinkData,
  workspaceId: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const shortUrl = `${url.protocol}//${url.host}${url.pathname}`;

  let workspaceName: string | null = null;
  if (workspaceId) {
    try {
      const ws = await env.DB.prepare('SELECT name FROM workspaces WHERE id = ? LIMIT 1')
        .bind(workspaceId).first<{ name: string }>();
      workspaceName = ws?.name ?? null;
    } catch {
      // Non-fatal — fall back to MDL.cc branding.
    }
  }

  return buildPreviewResponse(env, {
    destination: data.url,
    shortUrl,
    workspaceName,
    linkTitle: data.title ?? null,
    linkDescription: data.description ?? null,
  });
}

// Resolve a request to either a default (mdl.cc) or branded redirect, or null if
// the path isn't a redirect target.
export async function routeRedirect(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host === 'mdl.cc' || host === 'www.mdl.cc' || host.endsWith('.workers.dev') || host === 'localhost') {
    // Default shared domain: mdl.cc/m{code}
    const m = path.match(/^\/m([a-zA-Z0-9_-]{3,50})$/);
    if (!m) return null;
    return handleRedirect(m[1], request, env, null);
  }

  // Custom domain: entire subdomain is dedicated, path is the code.
  const m = path.match(/^\/([a-zA-Z0-9_-]{3,50})$/);
  if (!m) return null;

  const domain = await findDomainByHost(env, host);
  if (!domain) return new Response('Domain not configured', { status: 404 });

  return handleRedirect(m[1], request, env, domain.workspace_id);
}

// ── Internal helpers ────────────────────────────────────────────────────────

interface DbLink {
  id: string;
  original_url: string;
  password: string | null;
  expires_at: string | null;
  is_active: number;
  title: string | null;
  description: string | null;
}

function evaluate(data: KVLinkData, request: Request, shortCode: string): Response | null {
  if (!data.is_active) return new Response('This link has been deactivated', { status: 410 });
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return new Response('This link has expired', { status: 410 });
  }
  if (data.password) {
    const provided = new URL(request.url).searchParams.get('p');
    if (provided !== data.password) return createPasswordPage(shortCode);
  }
  return null;
}

async function trackClick(linkId: string, request: Request, env: Env): Promise<void> {
  try {
    const cf = (request as any).cf;
    const ua = request.headers.get('User-Agent');
    const referer = request.headers.get('Referer');
    const ip = request.headers.get('CF-Connecting-IP') || '';

    const { device, browser, os } = parseUserAgent(ua);
    const ipHash = await hashIP(ip);
    const today = getToday();

    // Decide uniqueness BEFORE inserting this click — otherwise the row we just
    // wrote always matches the "have we seen this ip today?" probe and no visitor
    // is ever counted as unique past the day's first click.
    const seen = await env.DB.prepare(
      `SELECT 1 AS ok FROM clicks
       WHERE link_id = ? AND date(timestamp) = ? AND ip_hash = ?
       LIMIT 1`,
    ).bind(linkId, today, ipHash).first<{ ok: number }>();
    const isUnique = seen ? 0 : 1;

    await env.DB.prepare(
      `INSERT INTO clicks (id, link_id, timestamp, country, city, region, device_type, browser, os, referer, ip_hash)
       VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      generateId(), linkId,
      cf?.country || null, cf?.city || null, cf?.region || null,
      device, browser, os, referer, ipHash,
    ).run();

    await env.DB.prepare(
      `INSERT INTO daily_stats (id, link_id, date, click_count, unique_visitors)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(link_id, date) DO UPDATE SET
         click_count = click_count + 1,
         unique_visitors = unique_visitors + ?`,
    ).bind(generateId(), linkId, today, isUnique, isUnique).run();
  } catch (error) {
    console.error('Error tracking click:', error);
  }
}

function createPasswordPage(_shortCode: string): Response {
  // Form posts to current URL, so shortCode isn't needed in the action — kept
  // in the signature for future customization (branding per link, etc.).
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
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      color: #f8fafc;
    }
    .container {
      background: rgba(30, 41, 59, 0.8); padding: 2.5rem; border-radius: 1rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      text-align: center; max-width: 400px; width: 90%;
    }
    .logo { font-size: 2rem; font-weight: 700; color: #1456f0; margin-bottom: 0.5rem; }
    .tagline { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1.25rem; margin-bottom: 1rem; }
    .lock-icon { font-size: 3rem; margin-bottom: 1rem; }
    form { margin-top: 1.5rem; }
    input {
      width: 100%; padding: 0.875rem 1rem; border: 2px solid #334155;
      border-radius: 0.5rem; background: #1e293b; color: #f8fafc;
      font-size: 1rem; margin-bottom: 1rem; transition: border-color 0.2s;
    }
    input:focus { outline: none; border-color: #1456f0; }
    button {
      width: 100%; padding: 0.875rem 1.5rem; background: #1456f0;
      color: white; border: none; border-radius: 0.5rem; font-size: 1rem;
      font-weight: 600; cursor: pointer; transition: background 0.2s;
    }
    button:hover { background: #0e44c2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">MDL.cc</div>
    <div class="tagline">The middle-point between you and your destination</div>
    <div class="lock-icon">🔒</div>
    <h1>This link is password protected</h1>
    <form method="GET">
      <input type="password" name="p" placeholder="Enter password" required autofocus>
      <button type="submit">Access Link →</button>
    </form>
  </div>
</body>
</html>`;
  return new Response(html, { status: 401, headers: { 'Content-Type': 'text/html' } });
}
