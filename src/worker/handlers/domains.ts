// MDL.cc - Custom domain handlers
//
// Domains are scoped to a workspace. The redirect handler uses the request hostname
// to look up which workspace's short codes should be served. Verification is a TXT
// record check against verify_token so we know the operator controls the domain.

import { Env } from '../types';
import { generateId, successResponse, errorResponse } from '../utils';
import { getAuthUser } from '../middleware/auth';
import {
  saasConfigured,
  cnameTarget,
  createCustomHostname,
  getCustomHostname,
  deleteCustomHostname,
  isLive,
  ValidationRecord,
} from '../lib/cloudflare';

interface DomainRow {
  id: string;
  workspace_id: string;
  domain: string;
  verified: number;
  is_default: number;
  verify_token: string | null;
  created_at: string;
  verified_at: string | null;
  cf_hostname_id: string | null;
  cf_status: string | null;
  cf_ssl_status: string | null;
  cf_validation: string | null;
}

// ── Auth helper ─────────────────────────────────────────────────────────────
async function assertWorkspaceAccess(
  env: Env,
  userId: string,
  workspaceId: string,
  requireAdmin = false,
): Promise<{ ok: true; role: string } | { ok: false; response: Response }> {
  const row = await env.DB.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
  ).bind(workspaceId, userId).first<{ role: string }>();
  if (!row) return { ok: false, response: errorResponse('Forbidden', 403) };
  if (requireAdmin && !['owner', 'admin'].includes(row.role)) {
    return { ok: false, response: errorResponse('Forbidden', 403) };
  }
  return { ok: true, role: row.role };
}

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function isValidDomain(d: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d);
}

// ── List all domains for all workspaces the user belongs to ─────────────────
export async function listDomains(request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const rows = await env.DB.prepare(`
    SELECT d.*
    FROM domains d
    JOIN workspace_members wm ON wm.workspace_id = d.workspace_id
    WHERE wm.user_id = ?
    ORDER BY d.created_at ASC
  `).bind(user.id).all<DomainRow>();

  return successResponse(rows.results.map(serialize));
}

// ── Create a new domain ─────────────────────────────────────────────────────
export async function createDomain(request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  let body: { domain: string; workspace_id: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }

  const domain = normalizeDomain(body.domain || '');
  if (!domain || !isValidDomain(domain)) return errorResponse('Invalid domain', 400);
  if (!body.workspace_id) return errorResponse('workspace_id is required', 400);

  const access = await assertWorkspaceAccess(env, user.id, body.workspace_id, true);
  if (!access.ok) return access.response;

  // Protect the platform apex from being claimed.
  if (domain === 'mdl.cc' || domain.endsWith('.mdl.cc')) {
    return errorResponse('This domain is reserved', 400);
  }

  const dupe = await env.DB.prepare('SELECT id FROM domains WHERE domain = ?')
    .bind(domain).first<{ id: string }>();
  if (dupe) return errorResponse('This domain is already registered', 409);

  const existingDefault = await env.DB.prepare(
    'SELECT id FROM domains WHERE workspace_id = ? AND is_default = 1 LIMIT 1',
  ).bind(body.workspace_id).first<{ id: string }>();

  const id = generateId();
  const verifyToken = `mdl-verify-${generateId().replace(/-/g, '').slice(0, 24)}`;
  const now = new Date().toISOString();

  // When Cloudflare for SaaS is configured, register the custom hostname first
  // so we can store its id + validation records. If CF rejects it (e.g. already
  // claimed on the zone, or a bad token) we surface the error and add nothing.
  let cfId: string | null = null;
  let cfStatus: string | null = null;
  let cfSslStatus: string | null = null;
  let cfValidation: string | null = null;
  if (saasConfigured(env)) {
    const ch = await createCustomHostname(env, domain);
    if (!ch.ok) return errorResponse(`Cloudflare could not add this domain: ${ch.error}`, 502);
    cfId = ch.data.id;
    cfStatus = ch.data.status;
    cfSslStatus = ch.data.sslStatus;
    cfValidation = JSON.stringify({ cname_target: cnameTarget(env), records: ch.data.records });
  }

  await env.DB.prepare(
    `INSERT INTO domains (id, workspace_id, domain, verified, is_default, verify_token, created_at,
                          cf_hostname_id, cf_status, cf_ssl_status, cf_validation)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, body.workspace_id, domain, existingDefault ? 0 : 1, verifyToken, now,
    cfId, cfStatus, cfSslStatus, cfValidation,
  ).run();

  const row = await env.DB.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first<DomainRow>();
  const message = saasConfigured(env)
    ? 'Domain added. Point it to Cloudflare with the CNAME below, then verify.'
    : 'Domain added. Configure DNS to verify.';
  return successResponse(serialize(row!), message);
}

// ── Verify a domain via TXT record ──────────────────────────────────────────
// Cloudflare Workers can't do raw DNS queries, so we use DNS-over-HTTPS.
export async function verifyDomain(id: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const row = await env.DB.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first<DomainRow>();
  if (!row) return errorResponse('Domain not found', 404);

  const access = await assertWorkspaceAccess(env, user.id, row.workspace_id, true);
  if (!access.ok) return access.response;

  // Cloudflare for SaaS path: ask Cloudflare for the live hostname + cert state.
  // The domain is only "verified" (and thus served by the redirect handler) once
  // both the hostname and its certificate are active.
  if (saasConfigured(env) && row.cf_hostname_id) {
    const ch = await getCustomHostname(env, row.cf_hostname_id);
    if (!ch.ok) return errorResponse(`Cloudflare lookup failed: ${ch.error}`, 502);

    const live = isLive(ch.data);
    const validation = JSON.stringify({ cname_target: cnameTarget(env), records: ch.data.records });
    await env.DB.prepare(
      `UPDATE domains
         SET cf_status = ?, cf_ssl_status = ?, cf_validation = ?,
             verified = ?, verified_at = COALESCE(verified_at, ?)
       WHERE id = ?`,
    ).bind(
      ch.data.status, ch.data.sslStatus, validation,
      live ? 1 : 0, live ? new Date().toISOString() : null, id,
    ).run();

    const updated = await env.DB.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first<DomainRow>();
    if (!live) {
      return errorResponse(
        `Not active yet — hostname: ${ch.data.status}, certificate: ${ch.data.sslStatus}. ` +
        `Add the CNAME and validation records below; this can take a few minutes after DNS propagates.`,
        400,
      );
    }
    return successResponse(serialize(updated!), 'Domain verified');
  }

  if (row.verified) return successResponse(serialize(row));
  if (!row.verify_token) return errorResponse('Domain has no verify token', 500);

  const verifyHost = verifyHostFor(row.domain);

  let verified = false;
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(verifyHost)}&type=TXT`,
      { headers: { accept: 'application/dns-json' } },
    );
    if (res.ok) {
      const dns = await res.json<{ Answer?: { data: string }[] }>();
      const records = dns.Answer?.map(a => a.data.replace(/^"|"$/g, '').replace(/"\s*"/g, '')) ?? [];
      verified = records.some(r => r === row.verify_token);
    }
  } catch {
    // Swallow — will be reported as unverified below.
  }

  if (!verified) {
    return errorResponse(
      `Could not find TXT record "${row.verify_token}" at ${verifyHost}. DNS changes can take a few minutes to propagate.`,
      400,
    );
  }

  await env.DB.prepare(
    'UPDATE domains SET verified = 1, verified_at = ? WHERE id = ?',
  ).bind(new Date().toISOString(), id).run();

  const updated = await env.DB.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first<DomainRow>();
  return successResponse(serialize(updated!), 'Domain verified');
}

// ── Set a domain as workspace default ───────────────────────────────────────
export async function setDefaultDomain(id: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const row = await env.DB.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first<DomainRow>();
  if (!row) return errorResponse('Domain not found', 404);

  const access = await assertWorkspaceAccess(env, user.id, row.workspace_id, true);
  if (!access.ok) return access.response;

  await env.DB.batch([
    env.DB.prepare('UPDATE domains SET is_default = 0 WHERE workspace_id = ?').bind(row.workspace_id),
    env.DB.prepare('UPDATE domains SET is_default = 1 WHERE id = ?').bind(id),
  ]);

  const updated = await env.DB.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first<DomainRow>();
  return successResponse(serialize(updated!));
}

// ── Delete a domain ─────────────────────────────────────────────────────────
export async function deleteDomain(id: string, request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  const row = await env.DB.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first<DomainRow>();
  if (!row) return errorResponse('Domain not found', 404);

  const access = await assertWorkspaceAccess(env, user.id, row.workspace_id, true);
  if (!access.ok) return access.response;

  // Tear down the Cloudflare custom hostname so the same domain can be re-added.
  if (saasConfigured(env) && row.cf_hostname_id) {
    await deleteCustomHostname(env, row.cf_hostname_id);
  }

  await env.DB.prepare('DELETE FROM domains WHERE id = ?').bind(id).run();

  // Promote another domain to default if we just removed the default.
  if (row.is_default) {
    const next = await env.DB.prepare(
      'SELECT id FROM domains WHERE workspace_id = ? ORDER BY created_at ASC LIMIT 1',
    ).bind(row.workspace_id).first<{ id: string }>();
    if (next) {
      await env.DB.prepare('UPDATE domains SET is_default = 1 WHERE id = ?').bind(next.id).run();
    }
  }

  return successResponse(null, 'Domain removed');
}

// ── Lookup (used by redirect handler; not HTTP-exposed) ─────────────────────
export async function findDomainByHost(env: Env, host: string): Promise<DomainRow | null> {
  const domain = host.toLowerCase();
  const row = await env.DB.prepare(
    'SELECT * FROM domains WHERE domain = ? AND verified = 1 LIMIT 1',
  ).bind(domain).first<DomainRow>();
  return row ?? null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
// TXT record always lives at _mdl-verify.<full-domain>, regardless of whether
// the customer added a root domain or a subdomain. Keeps DNS instructions simple.
function verifyHostFor(domain: string): string {
  return `_mdl-verify.${domain}`;
}

function serialize(r: DomainRow) {
  let validationRecords: ValidationRecord[] = [];
  let cnameTargetValue: string | null = null;
  if (r.cf_validation) {
    try {
      const parsed = JSON.parse(r.cf_validation) as { cname_target?: string; records?: ValidationRecord[] };
      validationRecords = parsed.records ?? [];
      cnameTargetValue = parsed.cname_target ?? null;
    } catch {
      // Ignore malformed cache — UI just won't show records until next refresh.
    }
  }
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    domain: r.domain,
    verified: !!r.verified,
    is_default: !!r.is_default,
    verify_token: r.verify_token,
    verify_host: `_mdl-verify.${r.domain}`,
    created_at: r.created_at,
    verified_at: r.verified_at,
    // Cloudflare for SaaS status (null when SaaS isn't configured).
    cf_status: r.cf_status,
    cf_ssl_status: r.cf_ssl_status,
    cname_target: cnameTargetValue,
    validation_records: validationRecords,
  };
}
