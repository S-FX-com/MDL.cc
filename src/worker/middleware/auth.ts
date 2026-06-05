// MDL.cc - Auth middleware

import { Env } from '../types';
import { verifyJWT } from '../lib/jwt';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export async function getAuthUser(request: Request, env: Env): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const payload = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
  if (!payload) return null;

  return {
    id: payload.userId as string,
    email: payload.email as string,
    name: (payload.name as string) || null,
  };
}

// True when the user is a platform-level superadmin. Two sources grant it:
//   1. The SUPERADMIN_EMAILS bootstrap allowlist (so the first operator can
//      always get in, even on a fresh database with no flags set), and
//   2. The users.is_superadmin flag (set by another superadmin from the UI).
export async function isSuperadminUser(env: Env, userId: string, email: string): Promise<boolean> {
  const allowlist = (env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (email && allowlist.includes(email.toLowerCase())) return true;

  const row = await env.DB.prepare('SELECT is_superadmin FROM users WHERE id = ?')
    .bind(userId)
    .first<{ is_superadmin: number }>();
  return !!row?.is_superadmin;
}

// Resolve the caller and require platform superadmin. Returns null when the
// request is unauthenticated or the user is not a superadmin — handlers turn
// that into a 401/403 respectively.
export async function getSuperadmin(request: Request, env: Env): Promise<AuthUser | null> {
  const user = await getAuthUser(request, env);
  if (!user) return null;
  return (await isSuperadminUser(env, user.id, user.email)) ? user : null;
}
