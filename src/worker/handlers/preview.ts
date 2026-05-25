// MDL.cc - Link Preview (Open Graph)
//
// Builds the HTML that gets served instead of a bare 302 redirect, so that
// link unfurlers (WhatsApp, Slack, Discord, Facebook, X/Twitter, LinkedIn, …)
// see Open Graph metadata when someone shares a short link.
//
// Resolution order for title/description:
//   1. Per-link override (links.title / links.description set by the user)
//   2. Open Graph fetched from the destination (cached in KV for 24h)
//   3. Brand fallback (MDL.cc, or workspace name on a custom domain)
//
// The HTML also carries a <meta http-equiv="refresh"> and a JS fallback so
// regular browsers still land on the destination almost instantly.

import { Env } from '../types';

export interface PreviewMeta {
  title: string;
  description: string;
  destination: string;
  canonical: string;        // the short URL itself (mdl.cc/m… or branded)
  siteName: string;         // "MDL.cc" or workspace name
}

export interface PreviewInputs {
  destination: string;
  shortUrl: string;
  workspaceName?: string | null;
  linkTitle?: string | null;
  linkDescription?: string | null;
}

export async function buildPreviewResponse(env: Env, inputs: PreviewInputs): Promise<Response> {
  const meta = await resolveMeta(env, inputs);
  return new Response(renderHtml(meta), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Bots cache aggressively; humans pass through fast. Short TTL keeps
      // updates (renamed destination, changed title) visible quickly.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

async function resolveMeta(env: Env, inputs: PreviewInputs): Promise<PreviewMeta> {
  const siteName = inputs.workspaceName || 'MDL.cc';

  // Per-link override wins outright — operator explicitly set this.
  if (inputs.linkTitle || inputs.linkDescription) {
    return {
      title: inputs.linkTitle || siteName,
      description: inputs.linkDescription || `Shared via ${siteName}`,
      destination: inputs.destination,
      canonical: inputs.shortUrl,
      siteName,
    };
  }

  const destHost = safeHost(inputs.destination);

  const fetched = await fetchDestinationOg(env, inputs.destination);
  if (fetched && (fetched.title || fetched.description)) {
    return {
      title: fetched.title || destHost || siteName,
      description: fetched.description || `${destHost || 'Link'} — shared via ${siteName}`,
      destination: inputs.destination,
      canonical: inputs.shortUrl,
      siteName,
    };
  }

  // Total fallback: site has no metadata, or the fetch failed transiently.
  // Show the destination host so the preview at least says where it goes.
  return {
    title: destHost ? `${destHost} — via ${siteName}` : siteName,
    description: destHost
      ? `Opens ${destHost}. Shared via ${siteName}.`
      : `Shared via ${siteName} — the middle-point between you and your audience.`,
    destination: inputs.destination,
    canonical: inputs.shortUrl,
    siteName,
  };
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ── Destination OG scraping (cached) ────────────────────────────────────────

interface FetchedOg {
  title: string | null;
  description: string | null;
}

async function fetchDestinationOg(env: Env, destination: string): Promise<FetchedOg | null> {
  // Cache key prefix bumped to og2: to invalidate the old, over-aggressive miss cache.
  const cacheKey = `og2:${await hashUrl(destination)}`;
  const cached = await env.URL_KV.get<FetchedOg>(cacheKey, 'json');
  if (cached) return cached;

  const result = await scrapeOg(destination);

  // Cache policy:
  //   - Successful scrape (anything came back, even just a <title>): 24h
  //   - Fetch failed entirely (null): do NOT cache — likely transient (timeout,
  //     5xx, network). Retry on the next request.
  // A site that genuinely has no metadata still returns a non-null result with
  // null fields; that gets cached as a real answer.
  if (result !== null) {
    await env.URL_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });
  }
  return result;
}

async function scrapeOg(url: string): Promise<FetchedOg | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // Identify ourselves so well-behaved sites can allow/log us.
        'User-Agent': 'Mozilla/5.0 (compatible; MDL.cc-LinkPreview/1.0; +https://mdl.cc)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('html')) return null;

    // Only read the head; OG tags are always there and most sites are large.
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let html = '';
    const MAX = 64 * 1024; // 64 KB is plenty for <head>
    while (html.length < MAX) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.includes('</head>')) break;
    }
    reader.cancel().catch(() => {});

    return parseOg(html);
  } catch {
    return null;
  }
}

function parseOg(html: string): FetchedOg {
  const head = html.split('</head>')[0] ?? html;
  const ogTitle = matchMeta(head, 'og:title') || matchMeta(head, 'twitter:title');
  const ogDesc = matchMeta(head, 'og:description') || matchMeta(head, 'twitter:description');
  const docTitle = ogTitle || matchTitle(head);
  const metaDesc = ogDesc || matchNameMeta(head, 'description');
  return {
    title: docTitle ? decodeEntities(docTitle).slice(0, 200) : null,
    description: metaDesc ? decodeEntities(metaDesc).slice(0, 400) : null,
  };
}

function matchMeta(html: string, property: string): string | null {
  // property="og:title" content="…"  OR  content="…" property="og:title"
  const a = new RegExp(`<meta[^>]+property=["']${escapeRe(property)}["'][^>]*content=["']([^"']*)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${escapeRe(property)}["']`, 'i');
  return html.match(a)?.[1] ?? html.match(b)?.[1] ?? null;
}

function matchNameMeta(html: string, name: string): string | null {
  const a = new RegExp(`<meta[^>]+name=["']${escapeRe(name)}["'][^>]*content=["']([^"']*)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${escapeRe(name)}["']`, 'i');
  return html.match(a)?.[1] ?? html.match(b)?.[1] ?? null;
}

function matchTitle(html: string): string | null {
  return html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function hashUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── HTML rendering ──────────────────────────────────────────────────────────

function renderHtml(meta: PreviewMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const site = escapeHtml(meta.siteName);
  const canonical = escapeHtml(meta.canonical);
  const dest = escapeHtml(meta.destination);
  const destJs = JSON.stringify(meta.destination);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${canonical}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="${site}">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">

<meta http-equiv="refresh" content="0;url=${dest}">
<script>window.location.replace(${destJs});</script>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0c1830;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:2rem;text-align:center}
  a{color:#7aa7ff}
  .box{max-width:480px}
  .brand{font-weight:700;letter-spacing:.02em;margin-bottom:.5rem}
</style>
</head>
<body>
  <div class="box">
    <div class="brand">${site}</div>
    <p>Redirecting to <a href="${dest}">${dest}</a>…</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
