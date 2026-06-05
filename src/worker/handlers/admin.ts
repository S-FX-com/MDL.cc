// MDL.cc - Superadmin handlers
//
// Platform-level oversight and configuration. Every handler here gates on
// getSuperadmin() and then operates ACROSS workspaces — deliberately bypassing
// the per-workspace membership scoping that the normal product API enforces.
// This is the only place in the worker allowed to read/write data the caller
// does not belong to, so the superadmin check is non-negotiable on every route.

import { Env } from '../types';
import { generateId, successResponse, errorResponse } from '../utils';
import { getAuthUser, getSuperadmin, isSuperadminUser } from '../middleware/auth';

// Resolve the caller and enforce superadmin. Returns the user on success, or a
// Response (401/403) the route should return as-is.
async function requireSuperadmin(
  request: Request,
  env: Env,
): Promise<{ id: string; email: string } | Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);
  if (!(await isSuperadminUser(env, user.id, user.email))) {
    return errorResponse('Forbidden — superadmin only', 403);
  }
  return user;
}

// GET /api/admin/overview — platform-wide totals + recent activity.
export async function getPlatformOverview(request: Request, env: Env): Promise<Response> {
  const auth = await requireSuperadmin(request, env);
  if (auth instanceof Response) return auth;

  const [workspaces, users, links, domains, clicks, superadmins] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS c FROM workspaces').first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS c FROM links').first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS c FROM domains').first<{ c: number }>(),
    env.DB.prepare('SELECT COALESCE(SUM(click_count), 0) AS c FROM daily_stats').first<{ c: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS c FROM users WHERE is_superadmin = 1').first<{ c: number }>(),
  ]);

  const recentWorkspaces = await env.DB.prepare(`
    SELECT w.id, w.name, w.slug, w.created_at,
           u.email AS owner_email,
           (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) AS member_count,
           (SELECT COUNT(*) FROM links l WHERE l.workspace_id = w.id) AS link_count
    FROM workspaces w
    LEFT JOIN users u ON u.id = w.owner_id
    ORDER BY w.created_at DESC
    LIMIT 8
  `).all();

  return successResponse({
    totals: {
      workspaces: workspaces?.c ?? 0,
      users: users?.c ?? 0,
      links: links?.c ?? 0,
      domains: domains?.c ?? 0,
      clicks: clicks?.c ?? 0,
      superadmins: superadmins?.c ?? 0,
    },
    recent_workspaces: recentWorkspaces.results,
  });
}

// GET /api/admin/workspaces — every workspace with owner + aggregate counts.
export async function listAllWorkspaces(request: Request, env: Env): Promise<Response> {
  const auth = await requireSuperadmin(request, env);
  if (auth instanceof Response) return auth;

  const search = new URL(request.url).searchParams.get('search')?.trim();

  let query = `
    SELECT w.id, w.name, w.slug, w.owner_id, w.created_at, w.updated_at,
           u.email AS owner_email, u.name AS owner_name,
           (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) AS member_count,
           (SELECT COUNT(*) FROM links l WHERE l.workspace_id = w.id) AS link_count,
           (SELECT COUNT(*) FROM domains d WHERE d.workspace_id = w.id) AS domain_count,
           COALESCE((
             SELECT SUM(ds.click_count) FROM daily_stats ds
             JOIN links l ON ds.link_id = l.id
             WHERE l.workspace_id = w.id
           ), 0) AS click_count
    FROM workspaces w
    LEFT JOIN users u ON u.id = w.owner_id
  `;
  const params: string[] = [];
  if (search) {
    query += ' WHERE w.name LIKE ? OR w.slug LIKE ? OR u.email LIKE ?';
    const p = `%${search}%`;
    params.push(p, p, p);
  }
  query += ' ORDER BY w.created_at DESC';

  const rows = await env.DB.prepare(query).bind(...params).all();
  return successResponse(rows.results);
}

// GET /api/admin/workspaces/:id — full detail: members, domains, counts.
export async function getWorkspaceDetailAdmin(wsId: string, request: Request, env: Env): Promise<Response> {
  const auth = await requireSuperadmin(request, env);
  if (auth instanceof Response) return auth;

  const workspace = await env.DB.prepare(`
    SELECT w.id, w.name, w.slug, w.owner_id, w.created_at, w.updated_at,
           u.email AS owner_email, u.name AS owner_name
    FROM workspaces w
    LEFT JOIN users u ON u.id = w.owner_id
    WHERE w.id = ?
  `).bind(wsId).first();
  if (!workspace) return errorResponse('Workspace not found', 404);

  const [members, domains, emailDomains, counts] = await Promise.all([
    env.DB.prepare(`
      SELECT wm.id, wm.role, wm.joined_at,
             u.id AS user_id, u.email, u.name, u.avatar_url
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ?
      ORDER BY wm.joined_at ASC
    `).bind(wsId).all(),
    env.DB.prepare(`
      SELECT id, domain, verified, is_default, cf_status, cf_ssl_status, created_at, verified_at
      FROM domains WHERE workspace_id = ? ORDER BY created_at ASC
    `).bind(wsId).all(),
    env.DB.prepare(`
      SELECT id, domain, auto_join_mode, created_at
      FROM workspace_domains WHERE workspace_id = ? ORDER BY created_at ASC
    `).bind(wsId).all(),
    env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM links l WHERE l.workspace_id = ?1) AS link_count,
        (SELECT COUNT(*) FROM link_groups g WHERE g.workspace_id = ?1) AS group_count,
        COALESCE((
          SELECT SUM(ds.click_count) FROM daily_stats ds
          JOIN links l ON ds.link_id = l.id WHERE l.workspace_id = ?1
        ), 0) AS click_count
    `).bind(wsId).first<{ link_count: number; group_count: number; click_count: number }>(),
  ]);

  return successResponse({
    workspace,
    members: members.results,
    domains: domains.results,
    email_domains: emailDomains.results,
    counts: counts ?? { link_count: 0, group_count: 0, click_count: 0 },
  });
}

// PUT /api/admin/workspaces/:id — rename and/or reassign the owner.
export async function updateWorkspaceAdmin(wsId: string, request: Request, env: Env): Promise<Response> {
  const auth = await requireSuperadmin(request, env);
  if (auth instanceof Response) return auth;

  const ws = await env.DB.prepare('SELECT id, owner_id FROM workspaces WHERE id = ?')
    .bind(wsId).first<{ id: string; owner_id: string }>();
  if (!ws) return errorResponse('Workspace not found', 404);

  let body: { name?: string; owner_id?: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }

  const updates: string[] = [];
  const values: string[] = [];

  if (body.name !== undefined) {
    if (!body.name.trim()) return errorResponse('Name cannot be empty', 400);
    updates.push('name = ?');
    values.push(body.name.trim());
  }

  if (body.owner_id !== undefined && body.owner_id !== ws.owner_id) {
    const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(body.owner_id).first<{ id: string }>();
    if (!target) return errorResponse('New owner not found', 404);

    // The new owner must hold an 'owner' membership row. Promote an existing
    // membership or create one, then demote the previous owner to admin so the
    // workspace keeps exactly one owner.
    const existing = await env.DB.prepare(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    ).bind(wsId, body.owner_id).first<{ id: string }>();
    if (existing) {
      await env.DB.prepare('UPDATE workspace_members SET role = ? WHERE id = ?')
        .bind('owner', existing.id).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(generateId(), wsId, body.owner_id, 'owner', new Date().toISOString()).run();
    }
    await env.DB.prepare(
      `UPDATE workspace_members SET role = 'admin' WHERE workspace_id = ? AND user_id = ? AND role = 'owner'`,
    ).bind(wsId, ws.owner_id).run();

    updates.push('owner_id = ?');
    values.push(body.owner_id);
  }

  if (updates.length === 0) return errorResponse('Nothing to update', 400);

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(wsId);
  await env.DB.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const updated = await env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(wsId).first();
  return successResponse(updated, 'Workspace updated');
}

// DELETE /api/admin/workspaces/:id — remove a workspace and all its data.
// D1 foreign keys cascade (members, links, groups, domains, invitations); the
// matching KV redirect entries expire on their own TTL.
export async function deleteWorkspaceAdmin(wsId: string, request: Request, env: Env): Promise<Response> {
  const auth = await requireSuperadmin(request, env);
  if (auth instanceof Response) return auth;

  const ws = await env.DB.prepare('SELECT id FROM workspaces WHERE id = ?').bind(wsId).first();
  if (!ws) return errorResponse('Workspace not found', 404);

  await env.DB.prepare('DELETE FROM workspaces WHERE id = ?').bind(wsId).run();
  return successResponse(null, 'Workspace deleted');
}

// POST /api/admin/workspaces/:id/members — add an existing user to any workspace.
export async function addWorkspaceMemberAdmin(wsId: string, request: Request, env: Env): Promise<Response> {
  const auth = await requireSuperadmin(request, env);
  if (auth instanceof Response) return auth;

  const ws = await env.DB.prepare('SELECT id FROM workspaces WHERE id = ?').bind(wsId).first();
  if (!ws) return errorResponse('Workspace not found', 404);

  let body: { email?: string; role?: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }

  const email = (body.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) return errorResponse('A valid email is required', 400);
  const role = body.role === 'admin' ? 'admin' : 'member';

  const target = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email).first<{ id: string }>();
  if (!target) return errorResponse('That user does not have an account yet', 404);

  const existing = await env.DB.prepare(
    'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
  ).bind(wsId, target.id).first<{ id: string }>();
  if (existing) return errorResponse('User is already a member of this workspace', 409);

  const id = generateId();
  await env.DB.prepare(
    'INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, wsId, target.id, role, new Date().toISOString()).run();

  const row = await env.DB.prepare(`
    SELECT wm.id, wm.role, wm.joined_at, u.id AS user_id, u.email, u.name, u.avatar_url
    FROM workspace_members wm JOIN users u ON u.id = wm.user_id WHERE wm.id = ?
  `).bind(id).first();
  return successResponse(row, 'Member added');
}

// PATCH /api/admin/workspaces/:id/members/:memberId — change a member's role.
export async function updateMemberRoleAdmin(
  wsId: string, memberId: string, request: Request, env: Env,
): Promise<Response> {
  const auth = await requireSuperadmin(request, env);
  if (auth instanceof Response) return auth;

  let body: { role?: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }
  if (!body.role || !['member', 'admin'].includes(body.role)) {
    return errorResponse('Role must be member or admin', 400);
  }

  const target = await env.DB.prepare(
    'SELECT role FROM workspace_members WHERE id = ? AND workspace_id = ?',
  ).bind(memberId, wsId).first<{ role: string }>();
  if (!target) return errorResponse('Member not found', 404);
  // The owner role is reassigned via PUT /workspaces/:id (owner_id), not here,
  // so a workspace always keeps exactly one owner.
  if (target.role === 'owner') return errorResponse('Reassign ownership from the workspace settings instead', 400);

  await env.DB.prepare('UPDATE workspace_members SET role = ? WHERE id = ? AND workspace_id = ?')
    .bind(body.role, memberId, wsId).run();
  return successResponse({ role: body.role }, 'Role updated');
}

// DELETE /api/admin/workspaces/:id/members/:memberId — remove a member.
export async function removeWorkspaceMemberAdmin(
  wsId: string, memberId: string, request: Request, env: Env,
): Promise<Response> {
  const auth = await requireSuperadmin(request, env);
  if (auth instanceof Response) return auth;

  const target = await env.DB.prepare(
    'SELECT role FROM workspace_members WHERE id = ? AND workspace_id = ?',
  ).bind(memberId, wsId).first<{ role: string }>();
  if (!target) return errorResponse('Member not found', 404);
  if (target.role === 'owner') {
    return errorResponse('Cannot remove the workspace owner — reassign ownership first', 400);
  }

  await env.DB.prepare('DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?')
    .bind(memberId, wsId).run();
  return successResponse(null, 'Member removed');
}

// GET /api/admin/users — every user with workspace count + superadmin flag.
export async function listAllUsers(request: Request, env: Env): Promise<Response> {
  const auth = await requireSuperadmin(request, env);
  if (auth instanceof Response) return auth;

  const search = new URL(request.url).searchParams.get('search')?.trim();

  let query = `
    SELECT u.id, u.email, u.name, u.avatar_url, u.is_superadmin, u.created_at,
           (u.microsoft_id IS NOT NULL) AS has_microsoft,
           (SELECT COUNT(*) FROM workspace_members wm WHERE wm.user_id = u.id) AS workspace_count
    FROM users u
  `;
  const params: string[] = [];
  if (search) {
    query += ' WHERE u.email LIKE ? OR u.name LIKE ?';
    const p = `%${search}%`;
    params.push(p, p);
  }
  query += ' ORDER BY u.created_at DESC LIMIT 500';

  const rows = await env.DB.prepare(query).bind(...params).all();
  return successResponse(rows.results);
}

// PATCH /api/admin/users/:id — grant or revoke platform superadmin.
export async function updateUserAdmin(userId: string, request: Request, env: Env): Promise<Response> {
  const caller = await getSuperadmin(request, env);
  if (!caller) {
    const user = await getAuthUser(request, env);
    return errorResponse(user ? 'Forbidden — superadmin only' : 'Unauthorized', user ? 403 : 401);
  }

  let body: { is_superadmin?: boolean };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }
  if (typeof body.is_superadmin !== 'boolean') {
    return errorResponse('is_superadmin (boolean) is required', 400);
  }

  const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(userId).first<{ id: string }>();
  if (!target) return errorResponse('User not found', 404);

  // Guard against self-demotion so an operator can't accidentally lock
  // themselves out of the admin backend.
  if (userId === caller.id && body.is_superadmin === false) {
    return errorResponse('You cannot revoke your own superadmin access', 400);
  }

  await env.DB.prepare('UPDATE users SET is_superadmin = ?, updated_at = ? WHERE id = ?')
    .bind(body.is_superadmin ? 1 : 0, new Date().toISOString(), userId).run();

  return successResponse({ id: userId, is_superadmin: body.is_superadmin }, 'User updated');
}
