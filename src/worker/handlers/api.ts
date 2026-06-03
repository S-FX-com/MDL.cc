// MDL.cc - API Handlers for Link Management

import { Env, Link, LinkGroup, Tag, CreateLinkRequest, UpdateLinkRequest, KVLinkData, AnalyticsData } from '../types';
import {
  generateId,
  generateShortCode,
  isValidUrl,
  isValidShortCode,
  successResponse,
  errorResponse,
  fetchPageTitle,
} from '../utils';
import { getAuthUser } from '../middleware/auth';

// KV entries are authoritative on write but always re-derivable from D1, so we
// cap them with a TTL. The redirect handler repopulates on miss. Keeping this
// in one place means create/update/redirect all agree on the cache lifetime.
const KV_TTL_SECONDS = 86400;

// ── Auth helpers ─────────────────────────────────────────────────────────────

// True when the user belongs to the workspace. All link/group/tag data is
// workspace-scoped, so every handler gates on this to prevent cross-tenant
// reads and writes.
async function isMember(env: Env, userId: string, workspaceId: string | null): Promise<boolean> {
  if (!workspaceId) return false;
  const row = await env.DB.prepare(
    'SELECT 1 AS ok FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1',
  ).bind(workspaceId, userId).first<{ ok: number }>();
  return !!row;
}

// ── Short-URL host resolution ─────────────────────────────────────────────────
//
// The DB stays uniform: links keep their short_code and we don't force a
// domain_id on them. The branded host is applied only when we SERVE the link.
//
// Precedence for the host shown to the user:
//   1. The link's own branded domain (domain_host) — set explicitly at create
//      time, so honour it.
//   2. The workspace's default verified custom domain — so every link in a
//      workspace that has a branded domain surfaces as go.example.com/{code}
//      instead of mdl.cc/m{code}, without rewriting stored rows.
//   3. mdl.cc/m{code} — the shared fallback (note the "m" prefix that keeps
//      app routes safe on the apex; branded hosts are dedicated so they don't
//      need it).
//
// getDefaultDomainHost is the per-workspace lookup; resolve it ONCE per request
// (a list returns many links from a single workspace) and pass it to buildShortUrl.

async function getDefaultDomainHost(env: Env, workspaceId: string | null): Promise<string | null> {
  if (!workspaceId) return null;
  const row = await env.DB.prepare(
    'SELECT domain FROM domains WHERE workspace_id = ? AND is_default = 1 AND verified = 1 LIMIT 1',
  ).bind(workspaceId).first<{ domain: string }>();
  return row?.domain ?? null;
}

function buildShortUrl(
  shortCode: string,
  linkDomainHost: string | null,
  workspaceDefaultHost: string | null,
): string {
  const host = linkDomainHost ?? workspaceDefaultHost;
  return host ? `https://${host}/${shortCode}` : `https://mdl.cc/m${shortCode}`;
}

// ============ LINKS ============

export async function createLink(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await request.json<CreateLinkRequest>();

    if (!body.url || !isValidUrl(body.url)) {
      return errorResponse('Invalid URL provided');
    }
    if (!body.workspace_id) {
      return errorResponse('workspace_id is required', 400);
    }
    if (!(await isMember(env, user.id, body.workspace_id))) {
      return errorResponse('Forbidden', 403);
    }

    // Resolve domain (must belong to the same workspace as the link) and pick the
    // KV key space. Branded links are keyed per workspace so two workspaces can
    // own the same short_code on different hostnames without colliding.
    let domainId: string | null = null;
    let brandedHost: string | null = null;
    if (body.domain_id) {
      const domainRow = await env.DB.prepare(
        'SELECT id, domain, workspace_id FROM domains WHERE id = ? AND workspace_id = ?',
      ).bind(body.domain_id, body.workspace_id).first<{ id: string; domain: string; workspace_id: string }>();
      if (!domainRow) return errorResponse('Domain not found for this workspace', 400);
      domainId = domainRow.id;
      brandedHost = domainRow.domain;
    }

    const kvKeyFor = (code: string) => brandedHost ? `ws:${body.workspace_id}:${code}` : code;

    // Generate or validate short code
    let shortCode = body.custom_code || generateShortCode();

    if (body.custom_code) {
      if (!isValidShortCode(body.custom_code)) {
        return errorResponse('Invalid custom code. Use 3-50 alphanumeric characters, hyphens, or underscores.');
      }
      const existing = await env.URL_KV.get(kvKeyFor(body.custom_code));
      if (existing) return errorResponse('This custom code is already in use');
    } else {
      let attempts = 0;
      while (attempts < 5) {
        const existing = await env.URL_KV.get(kvKeyFor(shortCode));
        if (!existing) break;
        shortCode = generateShortCode();
        attempts++;
      }
    }

    const title = body.title || (await fetchPageTitle(body.url));
    const description = body.description || null;

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO links (id, short_code, original_url, title, description, group_id, domain_id, workspace_id, password, expires_at, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
      .bind(
        id,
        shortCode,
        body.url,
        title,
        description,
        body.group_id || null,
        domainId,
        body.workspace_id,
        body.password || null,
        body.expires_at || null,
        now,
        now
      )
      .run();

    const kvData: KVLinkData = {
      url: body.url,
      password: body.password,
      expires_at: body.expires_at,
      is_active: true,
      link_id: id,
      title,
      description,
    };

    await env.URL_KV.put(kvKeyFor(shortCode), JSON.stringify(kvData), { expirationTtl: KV_TTL_SECONDS });

    // Handle tags — scoped to the link's workspace and owned by the creator.
    if (body.tags && body.tags.length > 0) {
      for (const tagName of body.tags) {
        const tagId = generateId();
        await env.DB.prepare(
          `INSERT OR IGNORE INTO tags (id, user_id, workspace_id, name) VALUES (?, ?, ?, ?)`
        )
          .bind(tagId, user.id, body.workspace_id, tagName)
          .run();

        const tag = await env.DB.prepare(
          'SELECT id FROM tags WHERE name = ? AND workspace_id = ? LIMIT 1'
        )
          .bind(tagName, body.workspace_id)
          .first<{ id: string }>();

        if (tag) {
          await env.DB.prepare('INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)')
            .bind(id, tag.id)
            .run();
        }
      }
    }

    const link = await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(id).first<Link>();

    // brandedHost is set only when the caller picked a domain explicitly; fall
    // back to the workspace default so a new link still surfaces as branded.
    const workspaceDefaultHost = await getDefaultDomainHost(env, body.workspace_id);
    const short_url = buildShortUrl(shortCode, brandedHost, workspaceDefaultHost);

    return successResponse({ ...link, short_url }, 'Link created successfully');
  } catch (error) {
    console.error('Error creating link:', error);
    return errorResponse('Failed to create link', 500);
  }
}

export async function getLinks(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const groupId = url.searchParams.get('group_id');
    const search = url.searchParams.get('search');
    const workspaceId = url.searchParams.get('workspace_id');
    const offset = (page - 1) * limit;

    // Strict workspace scoping — a workspace must be named and the caller must
    // belong to it. No NULL fallback: unscoped queries would leak every
    // workspace's links.
    if (!workspaceId) return errorResponse('workspace_id is required', 400);
    if (!(await isMember(env, user.id, workspaceId))) return errorResponse('Forbidden', 403);

    let query = `
      SELECT l.*,
        COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count,
        g.name as group_name, g.color as group_color,
        d.domain as domain_host
      FROM links l
      LEFT JOIN link_groups g ON l.group_id = g.id
      LEFT JOIN domains     d ON l.domain_id = d.id
      WHERE l.workspace_id = ?
    `;
    const params: (string | number)[] = [workspaceId];

    if (groupId) {
      query += ' AND l.group_id = ?';
      params.push(groupId);
    }

    if (search) {
      query += ' AND (l.short_code LIKE ? OR l.original_url LIKE ? OR l.title LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const links = await env.DB.prepare(query).bind(...params).all<
      Link & { click_count: number; group_name: string | null; group_color: string | null; domain_host: string | null }
    >();
    // One lookup for the whole list — every row belongs to the same workspace.
    const workspaceDefaultHost = await getDefaultDomainHost(env, workspaceId);
    const decorated = links.results.map(l => ({
      ...l,
      short_url: buildShortUrl(l.short_code, l.domain_host, workspaceDefaultHost),
    }));

    // Count uses the same scoping rules as the list query.
    let countQuery = 'SELECT COUNT(*) as total FROM links WHERE workspace_id = ?';
    const countParams: (string | number)[] = [workspaceId];

    if (groupId) {
      countQuery += ' AND group_id = ?';
      countParams.push(groupId);
    }

    if (search) {
      countQuery += ' AND (short_code LIKE ? OR original_url LIKE ? OR title LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();

    return successResponse({
      links: decorated,
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        pages: Math.ceil((countResult?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching links:', error);
    return errorResponse('Failed to fetch links', 500);
  }
}

export async function getLink(linkId: string, request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const link = await env.DB.prepare(
      `SELECT l.*,
        COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count,
        g.name as group_name, g.color as group_color,
        d.domain as domain_host
       FROM links l
       LEFT JOIN link_groups g ON l.group_id = g.id
       LEFT JOIN domains     d ON l.domain_id = d.id
       WHERE l.id = ?`
    )
      .bind(linkId)
      .first<Link & { domain_host: string | null }>();

    if (!link) {
      return errorResponse('Link not found', 404);
    }
    if (!(await isMember(env, user.id, link.workspace_id))) {
      return errorResponse('Forbidden', 403);
    }

    const tags = await env.DB.prepare(
      `SELECT t.* FROM tags t
       JOIN link_tags lt ON t.id = lt.tag_id
       WHERE lt.link_id = ?`
    )
      .bind(linkId)
      .all<Tag>();

    const workspaceDefaultHost = await getDefaultDomainHost(env, link.workspace_id);
    const short_url = buildShortUrl(link.short_code, link.domain_host, workspaceDefaultHost);

    return successResponse({
      ...link,
      tags: tags.results,
      short_url,
    });
  } catch (error) {
    console.error('Error fetching link:', error);
    return errorResponse('Failed to fetch link', 500);
  }
}

export async function updateLink(linkId: string, request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await request.json<UpdateLinkRequest>();

    const existing = await env.DB.prepare(
      `SELECT l.*, d.domain as domain_host
       FROM links l LEFT JOIN domains d ON l.domain_id = d.id
       WHERE l.id = ?`,
    ).bind(linkId).first<Link & { domain_host: string | null }>();

    if (!existing) {
      return errorResponse('Link not found', 404);
    }
    if (!(await isMember(env, user.id, existing.workspace_id))) {
      return errorResponse('Forbidden', 403);
    }

    if (body.url && !isValidUrl(body.url)) {
      return errorResponse('Invalid URL provided');
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.url !== undefined) {
      updates.push('original_url = ?');
      values.push(body.url);
    }
    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.group_id !== undefined) {
      updates.push('group_id = ?');
      values.push(body.group_id);
    }
    if (body.password !== undefined) {
      updates.push('password = ?');
      values.push(body.password);
    }
    if (body.expires_at !== undefined) {
      updates.push('expires_at = ?');
      values.push(body.expires_at);
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(linkId);

      await env.DB.prepare(`UPDATE links SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      // Update KV cache (keep title/description in sync so previews stay correct).
      const kvData: KVLinkData = {
        url: body.url || existing.original_url,
        password: body.password !== undefined ? body.password || undefined : existing.password || undefined,
        expires_at: body.expires_at !== undefined ? body.expires_at || undefined : existing.expires_at || undefined,
        is_active: body.is_active !== undefined ? body.is_active : !!existing.is_active,
        link_id: linkId,
        title: body.title !== undefined ? body.title || null : existing.title,
        description: body.description !== undefined ? body.description || null : existing.description,
      };

      // Honour workspace-namespaced KV keys for branded links.
      const kvKey = existing.domain_host
        ? `ws:${existing.workspace_id}:${existing.short_code}`
        : existing.short_code;
      await env.URL_KV.put(kvKey, JSON.stringify(kvData), { expirationTtl: KV_TTL_SECONDS });
    }

    const updated = await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(linkId).first<Link>();

    return successResponse(updated, 'Link updated successfully');
  } catch (error) {
    console.error('Error updating link:', error);
    return errorResponse('Failed to update link', 500);
  }
}

export async function deleteLink(linkId: string, request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const link = await env.DB.prepare(
      `SELECT l.short_code, l.workspace_id, d.domain as domain_host
       FROM links l LEFT JOIN domains d ON l.domain_id = d.id
       WHERE l.id = ?`,
    ).bind(linkId).first<{ short_code: string; workspace_id: string | null; domain_host: string | null }>();

    if (!link) {
      return errorResponse('Link not found', 404);
    }
    if (!(await isMember(env, user.id, link.workspace_id))) {
      return errorResponse('Forbidden', 403);
    }

    const kvKey = link.domain_host ? `ws:${link.workspace_id}:${link.short_code}` : link.short_code;
    await env.URL_KV.delete(kvKey);

    await env.DB.prepare('DELETE FROM links WHERE id = ?').bind(linkId).run();

    return successResponse(null, 'Link deleted successfully');
  } catch (error) {
    console.error('Error deleting link:', error);
    return errorResponse('Failed to delete link', 500);
  }
}

// ============ LINK GROUPS ============

export async function createGroup(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await request.json<{ name: string; description?: string; color?: string; icon?: string; workspace_id?: string }>();

    if (!body.name || body.name.trim().length === 0) {
      return errorResponse('Group name is required');
    }
    if (!body.workspace_id) return errorResponse('workspace_id is required', 400);
    if (!(await isMember(env, user.id, body.workspace_id))) return errorResponse('Forbidden', 403);

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO link_groups (id, user_id, workspace_id, name, description, color, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, user.id, body.workspace_id, body.name.trim(), body.description || null, body.color || '#10B981', body.icon || 'folder', now, now)
      .run();

    const group = await env.DB.prepare('SELECT * FROM link_groups WHERE id = ?').bind(id).first<LinkGroup>();

    return successResponse(group, 'Group created successfully');
  } catch (error) {
    console.error('Error creating group:', error);
    return errorResponse('Failed to create group', 500);
  }
}

export async function getGroups(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const workspaceId = new URL(request.url).searchParams.get('workspace_id');
    if (!workspaceId) return errorResponse('workspace_id is required', 400);
    if (!(await isMember(env, user.id, workspaceId))) return errorResponse('Forbidden', 403);

    const groups = await env.DB.prepare(
      `SELECT g.*, COUNT(l.id) as link_count
       FROM link_groups g
       LEFT JOIN links l ON g.id = l.group_id
       WHERE g.workspace_id = ?
       GROUP BY g.id
       ORDER BY g.name ASC`
    ).bind(workspaceId).all();

    return successResponse(groups.results);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return errorResponse('Failed to fetch groups', 500);
  }
}

export async function updateGroup(groupId: string, request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const existing = await env.DB.prepare('SELECT workspace_id FROM link_groups WHERE id = ?')
      .bind(groupId).first<{ workspace_id: string | null }>();
    if (!existing) return errorResponse('Group not found', 404);
    if (!(await isMember(env, user.id, existing.workspace_id))) return errorResponse('Forbidden', 403);

    const body = await request.json<{ name?: string; description?: string; color?: string; icon?: string }>();

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (body.name) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.color) {
      updates.push('color = ?');
      values.push(body.color);
    }
    if (body.icon) {
      updates.push('icon = ?');
      values.push(body.icon);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(groupId);

      await env.DB.prepare(`UPDATE link_groups SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();
    }

    const group = await env.DB.prepare('SELECT * FROM link_groups WHERE id = ?').bind(groupId).first<LinkGroup>();

    return successResponse(group, 'Group updated successfully');
  } catch (error) {
    console.error('Error updating group:', error);
    return errorResponse('Failed to update group', 500);
  }
}

export async function deleteGroup(groupId: string, request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const existing = await env.DB.prepare('SELECT workspace_id FROM link_groups WHERE id = ?')
      .bind(groupId).first<{ workspace_id: string | null }>();
    if (!existing) return errorResponse('Group not found', 404);
    if (!(await isMember(env, user.id, existing.workspace_id))) return errorResponse('Forbidden', 403);

    // Set links in this group to null group_id
    await env.DB.prepare('UPDATE links SET group_id = NULL WHERE group_id = ?').bind(groupId).run();

    await env.DB.prepare('DELETE FROM link_groups WHERE id = ?').bind(groupId).run();

    return successResponse(null, 'Group deleted successfully');
  } catch (error) {
    console.error('Error deleting group:', error);
    return errorResponse('Failed to delete group', 500);
  }
}

// ============ ANALYTICS ============

export async function getLinkAnalytics(linkId: string, request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const url = new URL(request.url);
    // Clamp to a sane integer window; bad input (e.g. ?days=abc) must not turn
    // into '-NaN days' (which SQLite evaluates to NULL → empty analytics).
    const daysRaw = parseInt(url.searchParams.get('days') || '30', 10);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : 30;

    // Get link info
    const link = await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(linkId).first<Link>();
    if (!link) {
      return errorResponse('Link not found', 404);
    }
    if (!(await isMember(env, user.id, link.workspace_id))) {
      return errorResponse('Forbidden', 403);
    }

    // Total clicks
    const totalClicks = await env.DB.prepare(
      'SELECT COALESCE(SUM(click_count), 0) as total FROM daily_stats WHERE link_id = ?'
    )
      .bind(linkId)
      .first<{ total: number }>();

    // Unique visitors
    const uniqueVisitors = await env.DB.prepare(
      'SELECT COALESCE(SUM(unique_visitors), 0) as total FROM daily_stats WHERE link_id = ?'
    )
      .bind(linkId)
      .first<{ total: number }>();

    // Clicks by country
    const clicksByCountry = await env.DB.prepare(
      `SELECT country, COUNT(*) as count FROM clicks
       WHERE link_id = ? AND timestamp > datetime('now', '-${days} days')
       GROUP BY country ORDER BY count DESC LIMIT 10`
    )
      .bind(linkId)
      .all<{ country: string; count: number }>();

    // Clicks by device
    const clicksByDevice = await env.DB.prepare(
      `SELECT device_type as device, COUNT(*) as count FROM clicks
       WHERE link_id = ? AND timestamp > datetime('now', '-${days} days')
       GROUP BY device_type ORDER BY count DESC`
    )
      .bind(linkId)
      .all<{ device: string; count: number }>();

    // Clicks by browser
    const clicksByBrowser = await env.DB.prepare(
      `SELECT browser, COUNT(*) as count FROM clicks
       WHERE link_id = ? AND timestamp > datetime('now', '-${days} days')
       GROUP BY browser ORDER BY count DESC`
    )
      .bind(linkId)
      .all<{ browser: string; count: number }>();

    // Clicks by date
    const clicksByDate = await env.DB.prepare(
      `SELECT date, click_count as count FROM daily_stats
       WHERE link_id = ? AND date > date('now', '-${days} days')
       ORDER BY date ASC`
    )
      .bind(linkId)
      .all<{ date: string; count: number }>();

    // Top referers
    const topReferers = await env.DB.prepare(
      `SELECT referer, COUNT(*) as count FROM clicks
       WHERE link_id = ? AND referer IS NOT NULL AND timestamp > datetime('now', '-${days} days')
       GROUP BY referer ORDER BY count DESC LIMIT 10`
    )
      .bind(linkId)
      .all<{ referer: string; count: number }>();

    const analytics: AnalyticsData = {
      total_clicks: totalClicks?.total || 0,
      unique_visitors: uniqueVisitors?.total || 0,
      clicks_by_country: clicksByCountry.results,
      clicks_by_device: clicksByDevice.results,
      clicks_by_browser: clicksByBrowser.results,
      clicks_by_date: clicksByDate.results,
      top_referers: topReferers.results,
    };

    return successResponse(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return errorResponse('Failed to fetch analytics', 500);
  }
}

export async function getDashboardStats(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspace_id');

    // Strict workspace scoping. A workspace must be named and the caller must
    // belong to it — never aggregate across tenants.
    if (!workspaceId) return errorResponse('workspace_id is required', 400);
    if (!(await isMember(env, user.id, workspaceId))) return errorResponse('Forbidden', 403);

    const totalLinks = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM links WHERE workspace_id = ?`
    ).bind(workspaceId).first<{ count: number }>();

    const totalClicks = await env.DB.prepare(
      `SELECT COALESCE(SUM(ds.click_count), 0) as count
       FROM daily_stats ds
       JOIN links l ON ds.link_id = l.id
       WHERE l.workspace_id = ?`
    ).bind(workspaceId).first<{ count: number }>();

    const todayClicks = await env.DB.prepare(
      `SELECT COALESCE(SUM(ds.click_count), 0) as count
       FROM daily_stats ds
       JOIN links l ON ds.link_id = l.id
       WHERE ds.date = date('now') AND l.workspace_id = ?`
    ).bind(workspaceId).first<{ count: number }>();

    const recentLinks = await env.DB.prepare(
      `SELECT l.*, COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count
       FROM links l WHERE l.workspace_id = ? ORDER BY l.created_at DESC LIMIT 5`
    ).bind(workspaceId).all();

    const topLinks = await env.DB.prepare(
      `SELECT l.*, COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count
       FROM links l WHERE l.workspace_id = ? ORDER BY click_count DESC LIMIT 5`
    ).bind(workspaceId).all();

    const weeklyClicks = await env.DB.prepare(
      `SELECT ds.date, COALESCE(SUM(ds.click_count), 0) as count
       FROM daily_stats ds
       JOIN links l ON ds.link_id = l.id
       WHERE ds.date > date('now', '-7 days') AND l.workspace_id = ?
       GROUP BY ds.date ORDER BY ds.date ASC`
    ).bind(workspaceId).all<{ date: string; count: number }>();

    return successResponse({
      total_links: totalLinks?.count || 0,
      total_clicks: totalClicks?.count || 0,
      today_clicks: todayClicks?.count || 0,
      recent_links: recentLinks.results,
      top_links: topLinks.results,
      weekly_clicks: weeklyClicks.results,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return errorResponse('Failed to fetch dashboard stats', 500);
  }
}

// ============ TAGS ============

export async function getTags(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const workspaceId = new URL(request.url).searchParams.get('workspace_id');
    if (!workspaceId) return errorResponse('workspace_id is required', 400);
    if (!(await isMember(env, user.id, workspaceId))) return errorResponse('Forbidden', 403);

    const tags = await env.DB.prepare(
      `SELECT t.*, COUNT(lt.link_id) as link_count
       FROM tags t
       LEFT JOIN link_tags lt ON t.id = lt.tag_id
       WHERE t.workspace_id = ?
       GROUP BY t.id
       ORDER BY t.name ASC`
    ).bind(workspaceId).all<Tag & { link_count: number }>();

    return successResponse(tags.results);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return errorResponse('Failed to fetch tags', 500);
  }
}

export async function createTag(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getAuthUser(request, env);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await request.json<{ name: string; color?: string; workspace_id?: string }>();

    if (!body.name || body.name.trim().length === 0) {
      return errorResponse('Tag name is required');
    }
    if (!body.workspace_id) return errorResponse('workspace_id is required', 400);
    if (!(await isMember(env, user.id, body.workspace_id))) return errorResponse('Forbidden', 403);

    const id = generateId();

    await env.DB.prepare(
      `INSERT INTO tags (id, user_id, workspace_id, name, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(id, user.id, body.workspace_id, body.name.trim(), body.color || '#6366F1')
      .run();

    const tag = await env.DB.prepare('SELECT * FROM tags WHERE id = ?').bind(id).first<Tag>();

    return successResponse(tag, 'Tag created successfully');
  } catch (error) {
    console.error('Error creating tag:', error);
    return errorResponse('Failed to create tag', 500);
  }
}
