// workspace_domains: an email-domain claim that lets matching users auto-join
// a workspace on their first verified sign-in (currently only Microsoft 365).
//
// Constraints:
//   - Only workspace owners/admins can add or remove a domain.
//   - A domain can belong to at most one workspace (UNIQUE in schema).
//   - Free-mail providers and obvious public domains are blocked to prevent
//     someone from claiming "gmail.com" and vacuuming up unrelated users.
//   - "auto_join_mode" is currently 'off' | 'auto'. We keep the column even
//     though there are two values to leave room for a future 'request' mode.

import { Env } from '../types';
import { generateId, successResponse, errorResponse } from '../utils';
import { getAuthUser } from '../middleware/auth';

interface DomainRow {
  id: string;
  workspace_id: string;
  domain: string;
  auto_join_mode: string;
  created_at: string;
}

const BLOCKED_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.es', 'yahoo.com.mx',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com',
  'aol.com', 'gmx.com', 'gmx.net',
  'mail.com', 'zoho.com', 'yandex.com',
]);

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '');
}

function isValidDomain(d: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d);
}

async function assertAdmin(env: Env, userId: string, workspaceId: string) {
  const row = await env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).bind(workspaceId, userId).first<{ role: string }>();
  if (!row || !['owner', 'admin'].includes(row.role)) {
    return errorResponse('Forbidden', 403);
  }
  return null;
}

function serialize(r: DomainRow) {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    domain: r.domain,
    auto_join_mode: r.auto_join_mode,
    created_at: r.created_at,
  };
}

// ── List domains for a workspace ────────────────────────────────────────────
export async function listWorkspaceDomains(wsId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const membership = await env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).bind(wsId, user.id).first();
  if (!membership) return errorResponse('Forbidden', 403);

  const rows = await env.DB.prepare(
    'SELECT * FROM workspace_domains WHERE workspace_id = ? ORDER BY created_at ASC'
  ).bind(wsId).all<DomainRow>();

  return successResponse(rows.results.map(serialize));
}

// ── Add a domain to a workspace ─────────────────────────────────────────────
export async function addWorkspaceDomain(wsId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const forbidden = await assertAdmin(env, user.id, wsId);
  if (forbidden) return forbidden;

  let body: { domain: string; auto_join_mode?: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }

  const domain = normalizeDomain(body.domain || '');
  if (!domain || !isValidDomain(domain)) return errorResponse('Invalid domain', 400);
  if (BLOCKED_DOMAINS.has(domain)) {
    return errorResponse('Public email providers (gmail.com, outlook.com, etc.) cannot be claimed', 400);
  }

  const mode = body.auto_join_mode === 'off' ? 'off' : 'auto';

  const dupe = await env.DB.prepare(
    'SELECT workspace_id FROM workspace_domains WHERE domain = ?'
  ).bind(domain).first<{ workspace_id: string }>();
  if (dupe) {
    return errorResponse(
      dupe.workspace_id === wsId
        ? 'Domain already added to this workspace'
        : 'This domain is already claimed by another workspace',
      409,
    );
  }

  const id = generateId();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workspace_domains (id, workspace_id, domain, auto_join_mode, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, wsId, domain, mode, now).run();

  const row = await env.DB.prepare(
    'SELECT * FROM workspace_domains WHERE id = ?'
  ).bind(id).first<DomainRow>();

  return successResponse(serialize(row!), 'Domain added');
}

// ── Update mode (off/auto) ──────────────────────────────────────────────────
export async function updateWorkspaceDomain(wsId: string, domainId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const forbidden = await assertAdmin(env, user.id, wsId);
  if (forbidden) return forbidden;

  let body: { auto_join_mode?: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }
  const mode = body.auto_join_mode === 'off' ? 'off' : body.auto_join_mode === 'auto' ? 'auto' : null;
  if (!mode) return errorResponse('auto_join_mode must be "off" or "auto"', 400);

  const result = await env.DB.prepare(
    'UPDATE workspace_domains SET auto_join_mode = ? WHERE id = ? AND workspace_id = ?'
  ).bind(mode, domainId, wsId).run();

  if (!result.success || result.meta.changes === 0) {
    return errorResponse('Domain not found', 404);
  }

  const row = await env.DB.prepare(
    'SELECT * FROM workspace_domains WHERE id = ?'
  ).bind(domainId).first<DomainRow>();
  return successResponse(serialize(row!));
}

// ── Remove a domain ─────────────────────────────────────────────────────────
export async function removeWorkspaceDomain(wsId: string, domainId: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const forbidden = await assertAdmin(env, user.id, wsId);
  if (forbidden) return forbidden;

  await env.DB.prepare(
    'DELETE FROM workspace_domains WHERE id = ? AND workspace_id = ?'
  ).bind(domainId, wsId).run();

  return successResponse(null, 'Domain removed');
}
