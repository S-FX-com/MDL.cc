// MDL.cc - Auth handlers (register, login, me)

import { Env } from '../types';
import { generateId, successResponse, errorResponse } from '../utils';
import { hashPassword, verifyPassword } from '../lib/password';
import { signJWT, verifyJWT } from '../lib/jwt';
import { isSuperadminUser } from '../middleware/auth';

interface RegisterBody {
  email: string;
  password: string;
  name: string;
  workspace_slug?: string; // join existing workspace on register
}

interface LoginBody {
  email: string;
  password: string;
}

export async function register(request: Request, env: Env): Promise<Response> {
  let body: RegisterBody;
  try { body = await request.json<RegisterBody>(); } catch { return errorResponse('Invalid request body', 400); }

  const { email, password, name, workspace_slug } = body;
  if (!email || !password || !name) return errorResponse('email, password and name are required', 400);
  if (!email.includes('@')) return errorResponse('Invalid email address', 400);
  if (password.length < 6) return errorResponse('Password must be at least 6 characters', 400);

  // Password sign-up is invite-only. Require a workspace_slug plus a matching
  // pending invitation for this email — otherwise refuse.
  if (!workspace_slug) {
    return errorResponse('Sign-up is by invitation only. Ask a workspace admin to invite you.', 403);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const ws = await env.DB.prepare('SELECT id FROM workspaces WHERE slug = ?')
    .bind(workspace_slug.toLowerCase().trim()).first<{ id: string }>();
  if (!ws) return errorResponse('Workspace not found', 404);

  const invite = await env.DB.prepare(
    `SELECT id FROM invitations
     WHERE workspace_id = ? AND email = ? AND status = 'pending' AND expires_at > datetime('now')
     LIMIT 1`,
  ).bind(ws.id, normalizedEmail).first();
  if (!invite) return errorResponse('No active invitation for this email at the requested workspace.', 403);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(normalizedEmail).first();
  if (existing) return errorResponse('Email already in use', 409);

  const { hash, salt } = await hashPassword(password, env.PBKDF2_SALT_PREFIX || 'mdl-cc');
  const userId = generateId();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, password_salt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(userId, normalizedEmail, name.trim(), hash, salt, now, now).run();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(generateId(), ws.id, userId, 'member', now).run();

  const token = await signJWT(
    { userId, email: normalizedEmail, name: name.trim() },
    env.JWT_SECRET
  );

  return successResponse(
    { token, user: { id: userId, email: normalizedEmail, name: name.trim() } },
    'Account created successfully'
  );
}

export async function login(request: Request, env: Env): Promise<Response> {
  let body: LoginBody;
  try { body = await request.json<LoginBody>(); } catch { return errorResponse('Invalid request body', 400); }

  const { email, password } = body;
  if (!email || !password) return errorResponse('email and password are required', 400);

  const user = await env.DB.prepare(
    `SELECT id, email, name, password_hash, password_salt FROM users WHERE email = ?`
  ).bind(email.toLowerCase().trim()).first<{
    id: string; email: string; name: string;
    password_hash: string; password_salt: string;
  }>();

  if (!user || !user.password_hash) return errorResponse('Invalid email or password', 401);

  const valid = await verifyPassword(
    password, user.password_hash, user.password_salt,
    env.PBKDF2_SALT_PREFIX || 'mdl-cc'
  );
  if (!valid) return errorResponse('Invalid email or password', 401);

  const token = await signJWT(
    { userId: user.id, email: user.email, name: user.name },
    env.JWT_SECRET
  );

  return successResponse({ token, user: { id: user.id, email: user.email, name: user.name } });
}

export async function getMe(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return errorResponse('Unauthorized', 401);

  const payload = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
  if (!payload) return errorResponse('Invalid or expired token', 401);

  const user = await env.DB.prepare(
    `SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?`
  ).bind(payload.userId as string).first<{ id: string; email: string }>();

  if (!user) return errorResponse('User not found', 404);

  // Surface the platform-superadmin flag so the web app can reveal the admin
  // backend. Computed (not just the column) so the SUPERADMIN_EMAILS bootstrap
  // allowlist counts too.
  const is_superadmin = await isSuperadminUser(env, user.id, user.email);
  return successResponse({ ...user, is_superadmin });
}

export async function updateProfile(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return errorResponse('Unauthorized', 401);

  const payload = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
  if (!payload) return errorResponse('Invalid token', 401);

  let body: { name?: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }

  if (body.name?.trim()) {
    await env.DB.prepare(`UPDATE users SET name = ?, updated_at = ? WHERE id = ?`)
      .bind(body.name.trim(), new Date().toISOString(), payload.userId as string).run();
  }

  const user = await env.DB.prepare(`SELECT id, email, name, avatar_url FROM users WHERE id = ?`)
    .bind(payload.userId as string).first();
  return successResponse(user);
}
