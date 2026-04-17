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

// ============ LINKS ============

export async function createLink(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<CreateLinkRequest>();

    if (!body.url || !isValidUrl(body.url)) {
      return errorResponse('Invalid URL provided');
    }

    // Generate or validate short code
    let shortCode = body.custom_code || generateShortCode();

    if (body.custom_code) {
      if (!isValidShortCode(body.custom_code)) {
        return errorResponse('Invalid custom code. Use 3-50 alphanumeric characters, hyphens, or underscores.');
      }

      // Check if code already exists
      const existing = await env.URL_KV.get(body.custom_code);
      if (existing) {
        return errorResponse('This custom code is already in use');
      }
    } else {
      // Ensure generated code is unique
      let attempts = 0;
      while (attempts < 5) {
        const existing = await env.URL_KV.get(shortCode);
        if (!existing) break;
        shortCode = generateShortCode();
        attempts++;
      }
    }

    // Auto-fetch title if not provided
    const title = body.title || (await fetchPageTitle(body.url));

    const id = generateId();
    const now = new Date().toISOString();

    // Validate domain_id: only use it if it actually exists in the domains table.
    // Custom domains stored locally in the webapp have client-generated UUIDs that
    // don't exist in the DB, so we bypass the FK constraint by falling back to null.
    let domainId: string | null = null;
    if (body.domain_id) {
      const domainRow = await env.DB.prepare('SELECT id FROM domains WHERE id = ?')
        .bind(body.domain_id)
        .first<{ id: string }>();
      if (domainRow) domainId = domainRow.id;
    }

    // Insert into D1
    await env.DB.prepare(
      `INSERT INTO links (id, short_code, original_url, title, description, group_id, domain_id, password, expires_at, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
      .bind(
        id,
        shortCode,
        body.url,
        title,
        body.description || null,
        body.group_id || null,
        domainId,
        body.password || null,
        body.expires_at || null,
        now,
        now
      )
      .run();

    // Store in KV for fast redirects
    const kvData: KVLinkData = {
      url: body.url,
      password: body.password,
      expires_at: body.expires_at,
      is_active: true,
      link_id: id,
    };

    await env.URL_KV.put(shortCode, JSON.stringify(kvData));

    // Handle tags
    if (body.tags && body.tags.length > 0) {
      for (const tagName of body.tags) {
        const tagId = generateId();
        // Create tag if not exists
        await env.DB.prepare(
          `INSERT OR IGNORE INTO tags (id, user_id, name) VALUES (?, 'anonymous', ?)`
        )
          .bind(tagId, tagName)
          .run();

        // Get tag ID
        const tag = await env.DB.prepare('SELECT id FROM tags WHERE name = ? LIMIT 1')
          .bind(tagName)
          .first<{ id: string }>();

        if (tag) {
          await env.DB.prepare('INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)')
            .bind(id, tag.id)
            .run();
        }
      }
    }

    const link = await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(id).first<Link>();

    return successResponse(
      {
        ...link,
        short_url: `https://mdl.cc/${shortCode}`,
      },
      'Link created successfully'
    );
  } catch (error) {
    console.error('Error creating link:', error);
    return errorResponse('Failed to create link', 500);
  }
}

export async function getLinks(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const groupId = url.searchParams.get('group_id');
    const search = url.searchParams.get('search');
    const offset = (page - 1) * limit;

    let query = `
      SELECT l.*,
        COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count,
        g.name as group_name, g.color as group_color
      FROM links l
      LEFT JOIN link_groups g ON l.group_id = g.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

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

    const links = await env.DB.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM links WHERE 1=1';
    const countParams: (string | number)[] = [];

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
      links: links.results,
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

export async function getLink(linkId: string, env: Env): Promise<Response> {
  try {
    const link = await env.DB.prepare(
      `SELECT l.*,
        COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count,
        g.name as group_name, g.color as group_color
       FROM links l
       LEFT JOIN link_groups g ON l.group_id = g.id
       WHERE l.id = ?`
    )
      .bind(linkId)
      .first();

    if (!link) {
      return errorResponse('Link not found', 404);
    }

    // Get tags
    const tags = await env.DB.prepare(
      `SELECT t.* FROM tags t
       JOIN link_tags lt ON t.id = lt.tag_id
       WHERE lt.link_id = ?`
    )
      .bind(linkId)
      .all<Tag>();

    return successResponse({
      ...link,
      tags: tags.results,
      short_url: `https://mdl.cc/${link.short_code}`,
    });
  } catch (error) {
    console.error('Error fetching link:', error);
    return errorResponse('Failed to fetch link', 500);
  }
}

export async function updateLink(linkId: string, request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<UpdateLinkRequest>();

    // Get existing link
    const existing = await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(linkId).first<Link>();

    if (!existing) {
      return errorResponse('Link not found', 404);
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

      // Update KV cache
      const kvData: KVLinkData = {
        url: body.url || existing.original_url,
        password: body.password !== undefined ? body.password || undefined : existing.password || undefined,
        expires_at: body.expires_at !== undefined ? body.expires_at || undefined : existing.expires_at || undefined,
        is_active: body.is_active !== undefined ? body.is_active : !!existing.is_active,
        link_id: linkId,
      };

      await env.URL_KV.put(existing.short_code, JSON.stringify(kvData));
    }

    const updated = await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(linkId).first<Link>();

    return successResponse(updated, 'Link updated successfully');
  } catch (error) {
    console.error('Error updating link:', error);
    return errorResponse('Failed to update link', 500);
  }
}

export async function deleteLink(linkId: string, env: Env): Promise<Response> {
  try {
    const link = await env.DB.prepare('SELECT short_code FROM links WHERE id = ?').bind(linkId).first<{ short_code: string }>();

    if (!link) {
      return errorResponse('Link not found', 404);
    }

    // Delete from KV
    await env.URL_KV.delete(link.short_code);

    // Delete from D1 (cascades to link_tags, clicks, etc.)
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
    const body = await request.json<{ name: string; description?: string; color?: string; icon?: string }>();

    if (!body.name || body.name.trim().length === 0) {
      return errorResponse('Group name is required');
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO link_groups (id, user_id, name, description, color, icon, created_at, updated_at)
       VALUES (?, 'anonymous', ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, body.name.trim(), body.description || null, body.color || '#10B981', body.icon || 'folder', now, now)
      .run();

    const group = await env.DB.prepare('SELECT * FROM link_groups WHERE id = ?').bind(id).first<LinkGroup>();

    return successResponse(group, 'Group created successfully');
  } catch (error) {
    console.error('Error creating group:', error);
    return errorResponse('Failed to create group', 500);
  }
}

export async function getGroups(env: Env): Promise<Response> {
  try {
    const groups = await env.DB.prepare(
      `SELECT g.*, COUNT(l.id) as link_count
       FROM link_groups g
       LEFT JOIN links l ON g.id = l.group_id
       GROUP BY g.id
       ORDER BY g.name ASC`
    ).all();

    return successResponse(groups.results);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return errorResponse('Failed to fetch groups', 500);
  }
}

export async function updateGroup(groupId: string, request: Request, env: Env): Promise<Response> {
  try {
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

export async function deleteGroup(groupId: string, env: Env): Promise<Response> {
  try {
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
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    // Get link info
    const link = await env.DB.prepare('SELECT * FROM links WHERE id = ?').bind(linkId).first<Link>();
    if (!link) {
      return errorResponse('Link not found', 404);
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
    const url = new URL(request.url);
    const linkIdsParam = url.searchParams.get('link_ids');
    const linkIds = linkIdsParam ? linkIdsParam.split(',').filter(Boolean) : null;

    const hasFilter = linkIds && linkIds.length > 0;

    const placeholders = hasFilter ? linkIds!.map(() => '?').join(',') : '';

    const totalLinks = hasFilter
      ? await env.DB.prepare(`SELECT COUNT(*) as count FROM links WHERE id IN (${placeholders})`).bind(...linkIds!).first<{ count: number }>()
      : await env.DB.prepare('SELECT COUNT(*) as count FROM links').first<{ count: number }>();

    const totalClicks = hasFilter
      ? await env.DB.prepare(`SELECT COALESCE(SUM(click_count), 0) as count FROM daily_stats WHERE link_id IN (${placeholders})`).bind(...linkIds!).first<{ count: number }>()
      : await env.DB.prepare('SELECT COALESCE(SUM(click_count), 0) as count FROM daily_stats').first<{ count: number }>();

    const todayClicks = hasFilter
      ? await env.DB.prepare(`SELECT COALESCE(SUM(click_count), 0) as count FROM daily_stats WHERE date = date('now') AND link_id IN (${placeholders})`).bind(...linkIds!).first<{ count: number }>()
      : await env.DB.prepare(`SELECT COALESCE(SUM(click_count), 0) as count FROM daily_stats WHERE date = date('now')`).first<{ count: number }>();

    const recentLinks = hasFilter
      ? await env.DB.prepare(
          `SELECT l.*, COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count
           FROM links l WHERE l.id IN (${placeholders}) ORDER BY created_at DESC LIMIT 5`
        ).bind(...linkIds!).all()
      : await env.DB.prepare(
          `SELECT l.*, COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count
           FROM links l ORDER BY created_at DESC LIMIT 5`
        ).all();

    const topLinks = hasFilter
      ? await env.DB.prepare(
          `SELECT l.*, COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count
           FROM links l WHERE l.id IN (${placeholders}) ORDER BY click_count DESC LIMIT 5`
        ).bind(...linkIds!).all()
      : await env.DB.prepare(
          `SELECT l.*, COALESCE((SELECT SUM(click_count) FROM daily_stats WHERE link_id = l.id), 0) as click_count
           FROM links l ORDER BY click_count DESC LIMIT 5`
        ).all();

    const weeklyClicks = hasFilter
      ? await env.DB.prepare(
          `SELECT date, COALESCE(SUM(click_count), 0) as count
           FROM daily_stats
           WHERE date > date('now', '-7 days') AND link_id IN (${placeholders})
           GROUP BY date ORDER BY date ASC`
        ).bind(...linkIds!).all<{ date: string; count: number }>()
      : await env.DB.prepare(
          `SELECT date, COALESCE(SUM(click_count), 0) as count
           FROM daily_stats
           WHERE date > date('now', '-7 days')
           GROUP BY date ORDER BY date ASC`
        ).all<{ date: string; count: number }>();

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

export async function getTags(env: Env): Promise<Response> {
  try {
    const tags = await env.DB.prepare(
      `SELECT t.*, COUNT(lt.link_id) as link_count
       FROM tags t
       LEFT JOIN link_tags lt ON t.id = lt.tag_id
       GROUP BY t.id
       ORDER BY t.name ASC`
    ).all<Tag & { link_count: number }>();

    return successResponse(tags.results);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return errorResponse('Failed to fetch tags', 500);
  }
}

export async function createTag(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<{ name: string; color?: string }>();

    if (!body.name || body.name.trim().length === 0) {
      return errorResponse('Tag name is required');
    }

    const id = generateId();

    await env.DB.prepare(
      `INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?, 'anonymous', ?, ?, datetime('now'))`
    )
      .bind(id, body.name.trim(), body.color || '#6366F1')
      .run();

    const tag = await env.DB.prepare('SELECT * FROM tags WHERE id = ?').bind(id).first<Tag>();

    return successResponse(tag, 'Tag created successfully');
  } catch (error) {
    console.error('Error creating tag:', error);
    return errorResponse('Failed to create tag', 500);
  }
}
