// MDL.cc - Workspace handlers

import { Env } from '../types';
import { generateId, successResponse, errorResponse, jsonResponse } from '../utils';
import { getAuthUser } from '../middleware/auth';

export async function lookupWorkspace(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug')?.toLowerCase().trim();
  if (!slug) return errorResponse('slug is required', 400);

  const ws = await env.DB.prepare('SELECT id, name, slug FROM workspaces WHERE slug = ?')
    .bind(slug).first<{ id: string; name: string; slug: string }>();

  if (!ws) return jsonResponse({ success: false, found: false, message: 'Workspace not found' });
  return jsonResponse({ success: true, found: true, workspace: ws });
}

export async function getWorkspaces(request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const rows = await env.DB.prepare(`
    SELECT w.id, w.name, w.slug, w.owner_id, w.created_at, w.updated_at, wm.role
    FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?
    ORDER BY w.created_at ASC
  `).bind(user.id).all();

  return successResponse(rows.results);
}

export async function createWorkspace(request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  let body: { name: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }
  if (!body.name?.trim()) return errorResponse('Workspace name is required', 400);

  const id = generateId();
  const slug = `${body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id.slice(0, 6)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, body.name.trim(), slug, user.id, now, now).run();

  await env.DB.prepare(
    `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(generateId(), id, user.id, 'owner', now).run();

  const ws = await env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(id).first();
  return successResponse({ ...ws, role: 'owner' }, 'Workspace created');
}

export async function updateWorkspace(wsId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const member = await env.DB.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(wsId, user.id).first<{ role: string }>();

  if (!member || !['owner', 'admin'].includes(member.role)) return errorResponse('Forbidden', 403);

  let body: { name: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }
  if (!body.name?.trim()) return errorResponse('Name is required', 400);

  await env.DB.prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?')
    .bind(body.name.trim(), new Date().toISOString(), wsId).run();

  const ws = await env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(wsId).first();
  return successResponse({ ...ws, role: member.role });
}

export async function deleteWorkspace(wsId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const ws = await env.DB.prepare('SELECT owner_id FROM workspaces WHERE id = ?')
    .bind(wsId).first<{ owner_id: string }>();
  if (!ws) return errorResponse('Workspace not found', 404);
  if (ws.owner_id !== user.id) return errorResponse('Only the owner can delete this workspace', 403);

  await env.DB.prepare('DELETE FROM workspaces WHERE id = ?').bind(wsId).run();
  return successResponse(null, 'Workspace deleted');
}

export async function getWorkspaceMembers(wsId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const membership = await env.DB.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(wsId, user.id).first();
  if (!membership) return errorResponse('Forbidden', 403);

  const members = await env.DB.prepare(`
    SELECT wm.id, wm.role, wm.joined_at,
           u.id as user_id, u.email, u.name, u.avatar_url
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = ?
    ORDER BY wm.joined_at ASC
  `).bind(wsId).all();

  return successResponse(members.results);
}

// Add an *existing* user to a workspace by email. Open sign-up is disabled
// elsewhere (auth.register is invite-gated), so this endpoint only succeeds
// for users that already have an account — making it safe for owners and
// admins to drop existing teammates into more of their workspaces without
// resending a full invitation email.
export async function addWorkspaceMember(wsId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const requester = await env.DB.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
  ).bind(wsId, user.id).first<{ role: string }>();
  if (!requester || !['owner', 'admin'].includes(requester.role)) {
    return errorResponse('Forbidden', 403);
  }

  let body: { email?: string; role?: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }

  const email = (body.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) return errorResponse('A valid email is required', 400);
  const role = body.role === 'admin' ? 'admin' : 'member';

  const target = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?',
  ).bind(email).first<{ id: string }>();
  if (!target) {
    return errorResponse('That user does not have an MDL.cc account yet. Send an invitation instead.', 404);
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
  ).bind(wsId, target.id).first<{ id: string }>();
  if (existing) {
    return errorResponse('User is already a member of this workspace', 409);
  }

  const id = generateId();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, wsId, target.id, role, now).run();

  const row = await env.DB.prepare(`
    SELECT wm.id, wm.role, wm.joined_at,
           u.id as user_id, u.email, u.name, u.avatar_url
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.id = ?
  `).bind(id).first();
  return successResponse(row, 'Member added');
}

export async function updateMemberRole(wsId: string, memberId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const requester = await env.DB.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(wsId, user.id).first<{ role: string }>();
  if (!requester || requester.role !== 'owner') return errorResponse('Only the owner can change roles', 403);

  let body: { role: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid body', 400); }
  if (!['member', 'admin'].includes(body.role)) return errorResponse('Role must be member or admin', 400);

  const target = await env.DB.prepare(
    `SELECT role FROM workspace_members WHERE id = ? AND workspace_id = ?`
  ).bind(memberId, wsId).first<{ role: string }>();
  if (!target) return errorResponse('Member not found', 404);
  if (target.role === 'owner') return errorResponse('Cannot change the owner role', 403);

  await env.DB.prepare(`UPDATE workspace_members SET role = ? WHERE id = ? AND workspace_id = ?`)
    .bind(body.role, memberId, wsId).run();

  return successResponse({ role: body.role }, 'Role updated');
}

export async function removeWorkspaceMember(wsId: string, memberId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const requester = await env.DB.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(wsId, user.id).first<{ role: string }>();
  if (!requester || !['owner', 'admin'].includes(requester.role)) return errorResponse('Forbidden', 403);

  // Prevent removing the owner
  const target = await env.DB.prepare(
    `SELECT role FROM workspace_members WHERE id = ? AND workspace_id = ?`
  ).bind(memberId, wsId).first<{ role: string }>();
  if (!target) return errorResponse('Member not found', 404);
  if (target.role === 'owner') return errorResponse('Cannot remove the workspace owner', 403);

  await env.DB.prepare(`DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?`)
    .bind(memberId, wsId).run();

  return successResponse(null, 'Member removed');
}
