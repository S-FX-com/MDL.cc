// Microsoft 365 (Azure AD) OAuth2 sign-in / sign-up.
//
// Flow:
//   1. /api/auth/microsoft/start  — generate state + PKCE, redirect to MS.
//   2. /api/auth/microsoft/callback — exchange code, validate ID token, upsert
//      user, run domain auto-join, redirect back to /login#token=...
//
// Multi-tenant + personal: we use the /common endpoint so any work, school, or
// personal Microsoft account can sign in. Email comes from the ID token claim
// and is considered verified (Microsoft has authenticated the user against
// that mailbox).

import { Env } from '../types';
import { generateId, errorResponse } from '../utils';
import { signJWT } from '../lib/jwt';

// Microsoft's /common authority works for multi-tenant + personal accounts.
const MS_AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
// 'openid profile email' is enough; we don't need Graph access for sign-in.
const MS_SCOPES    = 'openid profile email';

// State + PKCE verifier live in URL_KV for the ~5 min round-trip. Short TTL
// keeps the namespace clean and limits replay window.
const STATE_TTL_SEC = 600;

interface MsIdTokenClaims {
  oid?: string;          // Stable per-user GUID (preferred for linking)
  sub?: string;          // Fallback subject id
  email?: string;
  preferred_username?: string;
  name?: string;
}

function redirectUri(env: Env, request: Request): string {
  const origin = env.APP_URL?.replace(/\/$/, '') || new URL(request.url).origin;
  return `${origin}/api/auth/microsoft/callback`;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
}

// ── Start: redirect the browser to Microsoft's authorize endpoint ───────────
export async function microsoftStart(request: Request, env: Env): Promise<Response> {
  if (!env.MS_CLIENT_ID) return errorResponse('Microsoft sign-in is not configured', 503);

  const url = new URL(request.url);
  // Optional next= and workspace= survive the round-trip so we can land the
  // user where they expected. Workspace slug is informational only — actual
  // membership is decided by domain match on callback.
  const next = url.searchParams.get('next') || '/';
  const workspace = url.searchParams.get('workspace') || '';

  // PKCE: random verifier, S256 challenge.
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = b64url(verifierBytes);
  const codeChallenge = b64url(await sha256(codeVerifier));

  const state = b64url(crypto.getRandomValues(new Uint8Array(24)));

  // Stash verifier + next-url under the state key. KV is fine here — single
  // read + delete on callback, low volume.
  await env.URL_KV.put(
    `msauth:${state}`,
    JSON.stringify({ codeVerifier, next, workspace }),
    { expirationTtl: STATE_TTL_SEC },
  );

  const params = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(env, request),
    response_mode: 'query',
    scope: MS_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // Force account chooser so users with multiple MS accounts can pick.
    prompt: 'select_account',
  });

  return Response.redirect(`${MS_AUTHORITY}/authorize?${params.toString()}`, 302);
}

// ── Callback: exchange code, validate token, upsert user, redirect home ─────
export async function microsoftCallback(request: Request, env: Env): Promise<Response> {
  if (!env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET) {
    return errorResponse('Microsoft sign-in is not configured', 503);
  }

  const url = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err   = url.searchParams.get('error');

  if (err) return redirectWithError(env, request, `Microsoft sign-in failed: ${err}`);
  if (!code || !state) return redirectWithError(env, request, 'Missing code or state');

  const stashRaw = await env.URL_KV.get(`msauth:${state}`);
  if (!stashRaw) return redirectWithError(env, request, 'Sign-in link expired, please try again');
  await env.URL_KV.delete(`msauth:${state}`);

  let stash: { codeVerifier: string; next: string; workspace: string };
  try { stash = JSON.parse(stashRaw); } catch {
    return redirectWithError(env, request, 'Invalid sign-in state');
  }

  // Exchange the auth code for tokens.
  const tokenRes = await fetch(`${MS_AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MS_CLIENT_ID,
      client_secret: env.MS_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(env, request),
      code_verifier: stash.codeVerifier,
      scope: MS_SCOPES,
    }),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    console.error('MS token exchange failed', tokenRes.status, detail);
    return redirectWithError(env, request, 'Could not complete Microsoft sign-in');
  }

  const tokenJson = await tokenRes.json<{ id_token?: string; access_token?: string }>();
  if (!tokenJson.id_token) return redirectWithError(env, request, 'No id_token returned by Microsoft');

  // We trust the id_token because we just received it over TLS directly from
  // the Microsoft token endpoint in response to our own client_secret — no
  // need to fetch JWKS and verify signatures in this trust model.
  const claims = decodeIdTokenClaims(tokenJson.id_token);
  if (!claims) return redirectWithError(env, request, 'Could not read Microsoft profile');

  const email = (claims.email || claims.preferred_username || '').toLowerCase().trim();
  const msId  = claims.oid || claims.sub || '';
  if (!email || !msId) return redirectWithError(env, request, 'Microsoft profile is missing email');

  // Upsert user. Three cases:
  //   a) already linked via microsoft_id → reuse
  //   b) email exists (password user) → link microsoft_id + mark verified
  //   c) new user → insert
  const now = new Date().toISOString();
  let userRow = await env.DB.prepare(
    'SELECT id, email, name FROM users WHERE microsoft_id = ?'
  ).bind(msId).first<{ id: string; email: string; name: string | null }>();

  if (!userRow) {
    userRow = await env.DB.prepare(
      'SELECT id, email, name FROM users WHERE email = ?'
    ).bind(email).first<{ id: string; email: string; name: string | null }>();

    if (userRow) {
      await env.DB.prepare(
        'UPDATE users SET microsoft_id = ?, email_verified = 1, updated_at = ? WHERE id = ?'
      ).bind(msId, now, userRow.id).run();
    } else {
      const id = generateId();
      const name = (claims.name || email.split('@')[0]).trim();
      await env.DB.prepare(
        `INSERT INTO users (id, email, name, microsoft_id, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      ).bind(id, email, name, msId, now, now).run();
      userRow = { id, email, name };
    }
  }

  // Domain auto-join: if the email's domain is claimed by a workspace with
  // auto_join_mode = 'auto', add this user as a 'member' (idempotent).
  // Falls back to creating a personal workspace only if no domain match AND
  // the user has zero memberships (first sign-in).
  const emailDomain = email.split('@')[1] || '';
  if (emailDomain) {
    const claim = await env.DB.prepare(
      `SELECT workspace_id FROM workspace_domains
       WHERE domain = ? AND auto_join_mode = 'auto' LIMIT 1`
    ).bind(emailDomain).first<{ workspace_id: string }>();

    if (claim) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role, joined_at)
         VALUES (?, ?, ?, 'member', ?)`
      ).bind(generateId(), claim.workspace_id, userRow.id, now).run();
    }
  }

  // Ensure the user has at least one workspace. If they don't (no domain
  // claim, no prior membership), create a personal one — keeps parity with
  // password register flow.
  const memberCount = await env.DB.prepare(
    'SELECT COUNT(*) as c FROM workspace_members WHERE user_id = ?'
  ).bind(userRow.id).first<{ c: number }>();

  if (!memberCount || memberCount.c === 0) {
    const wsId = generateId();
    const baseName = (userRow.name || email.split('@')[0]).trim();
    const wsSlug = `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${wsId.slice(0, 6)}`;
    await env.DB.prepare(
      `INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(wsId, `${baseName}'s Workspace`, wsSlug, userRow.id, now, now).run();
    await env.DB.prepare(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
       VALUES (?, ?, ?, 'owner', ?)`
    ).bind(generateId(), wsId, userRow.id, now).run();
  }

  const jwt = await signJWT(
    { userId: userRow.id, email: userRow.email, name: userRow.name || '' },
    env.JWT_SECRET,
  );

  // Hand the token back via URL fragment so it never hits the server log /
  // referrer header. Login.tsx reads it on mount.
  const target = new URL(stash.next || '/', new URL(request.url).origin);
  target.hash = `token=${encodeURIComponent(jwt)}`;
  return Response.redirect(target.toString(), 302);
}

function decodeIdTokenClaims(idToken: string): MsIdTokenClaims | null {
  const parts = idToken.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    return JSON.parse(atob(padded)) as MsIdTokenClaims;
  } catch {
    return null;
  }
}

function redirectWithError(env: Env, request: Request, message: string): Response {
  const origin = env.APP_URL?.replace(/\/$/, '') || new URL(request.url).origin;
  const target = new URL('/login', origin);
  target.hash = `error=${encodeURIComponent(message)}`;
  return Response.redirect(target.toString(), 302);
}
