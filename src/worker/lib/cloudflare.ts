// Cloudflare for SaaS — Custom Hostnames API client.
//
// Branded workspace domains are served via Cloudflare for SaaS: each domain is
// registered as a Custom Hostname on the mdl.cc zone, the customer CNAMEs it to
// CF_CNAME_TARGET (e.g. cname.mdl.cc), and Cloudflare proxies it to the zone's
// fallback origin (the worker). This module wraps the three calls we need:
// create, get (status), and delete.
//
// Everything here is a no-op unless saasConfigured(env) is true, so the rest of
// the app degrades gracefully to the legacy _mdl-verify TXT flow in dev or when
// SaaS isn't set up.

import { Env } from '../types';

const CF_API = 'https://api.cloudflare.com/client/v4';

export function saasConfigured(env: Env): boolean {
  return Boolean(env.CF_API_TOKEN && env.CF_ZONE_ID);
}

export function cnameTarget(env: Env): string {
  return env.CF_CNAME_TARGET || 'cname.mdl.cc';
}

// A DNS record the customer must create for validation, normalised for display.
export interface ValidationRecord {
  type: string;   // 'TXT' | 'CNAME' | 'HTTP'
  name: string;
  value: string;
}

export interface CustomHostnameState {
  id: string;
  status: string;       // CF hostname status: 'pending' | 'active' | 'blocked' | ...
  sslStatus: string;    // CF ssl status: 'pending_validation' | 'active' | ...
  records: ValidationRecord[];
}

type CfResponse<T> = {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: T;
};

interface CfCustomHostname {
  id: string;
  hostname: string;
  status?: string;
  ssl?: {
    status?: string;
    validation_records?: { txt_name?: string; txt_value?: string; http_url?: string; http_body?: string }[];
  };
  ownership_verification?: { type?: string; name?: string; value?: string };
  ownership_verification_http?: { http_url?: string; http_body?: string };
}

function headers(env: Env): HeadersInit {
  return {
    Authorization: `Bearer ${env.CF_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

// Pull the customer-facing validation records out of a CF custom-hostname object.
function extractRecords(env: Env, ch: CfCustomHostname): ValidationRecord[] {
  const records: ValidationRecord[] = [];

  // 1. The routing CNAME — always the same target, shown so the customer knows
  //    where to point the hostname.
  records.push({ type: 'CNAME', name: ch.hostname, value: cnameTarget(env) });

  // 2. Hostname ownership pre-validation (TXT) — present until the CNAME routes.
  const ov = ch.ownership_verification;
  if (ov?.name && ov.value) {
    records.push({ type: (ov.type || 'TXT').toUpperCase(), name: ov.name, value: ov.value });
  }

  // 3. SSL/DCV validation records (TXT method).
  for (const r of ch.ssl?.validation_records ?? []) {
    if (r.txt_name && r.txt_value) {
      records.push({ type: 'TXT', name: r.txt_name, value: r.txt_value });
    }
  }

  return records;
}

function toState(env: Env, ch: CfCustomHostname): CustomHostnameState {
  return {
    id: ch.id,
    status: ch.status || 'pending',
    sslStatus: ch.ssl?.status || 'pending_validation',
    records: extractRecords(env, ch),
  };
}

export type CfResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createCustomHostname(env: Env, hostname: string): Promise<CfResult<CustomHostnameState>> {
  try {
    const res = await fetch(`${CF_API}/zones/${env.CF_ZONE_ID}/custom_hostnames`, {
      method: 'POST',
      headers: headers(env),
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: { min_tls_version: '1.2' },
          bundle_method: 'ubiquitous',
          wildcard: false,
        },
      }),
    });
    const json = (await res.json()) as CfResponse<CfCustomHostname>;
    if (!json.success || !json.result) {
      return { ok: false, error: json.errors?.[0]?.message || 'Cloudflare rejected the custom hostname' };
    }
    return { ok: true, data: toState(env, json.result) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to reach Cloudflare' };
  }
}

export async function getCustomHostname(env: Env, id: string): Promise<CfResult<CustomHostnameState>> {
  try {
    const res = await fetch(`${CF_API}/zones/${env.CF_ZONE_ID}/custom_hostnames/${id}`, {
      headers: headers(env),
    });
    const json = (await res.json()) as CfResponse<CfCustomHostname>;
    if (!json.success || !json.result) {
      return { ok: false, error: json.errors?.[0]?.message || 'Custom hostname not found' };
    }
    return { ok: true, data: toState(env, json.result) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to reach Cloudflare' };
  }
}

export async function deleteCustomHostname(env: Env, id: string): Promise<void> {
  try {
    await fetch(`${CF_API}/zones/${env.CF_ZONE_ID}/custom_hostnames/${id}`, {
      method: 'DELETE',
      headers: headers(env),
    });
  } catch {
    // Best-effort — the local row is removed regardless.
  }
}

// A custom hostname is considered live (verified) only when both the hostname
// and its certificate are active.
export function isLive(state: { status: string; sslStatus: string }): boolean {
  return state.status === 'active' && state.sslStatus === 'active';
}
