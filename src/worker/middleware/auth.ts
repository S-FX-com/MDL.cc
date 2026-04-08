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
