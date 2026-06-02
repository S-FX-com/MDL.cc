import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { domains as domainsApi, Domain as ApiDomain, DomainValidationRecord } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  // Display role used by the UI ('Admin' for owner/admin, 'Member' otherwise).
  role: string;
  // Raw role from the server — needed for permission checks (e.g. only
  // owner/admin can add or remove other members in a workspace).
  rawRole?: 'owner' | 'admin' | 'member';
}

export interface TeamMember {
  // Stable per-row id: workspace_member.id for active rows,
  // invitation.id for pending rows.
  id: string;
  email: string;
  name?: string;
  user_id?: string;
  workspaceIds: string[];
  status: 'pending' | 'active';
  invitedAt: string;
  role?: 'member' | 'admin' | 'owner';
  // For pending rows we need (workspace_id, invitation_id) to cancel.
  // For active rows we need (workspace_id, member_id) to remove. We carry
  // the source workspace alongside the row id; for users active in multiple
  // workspaces we merge into one row and keep the membership map for the UI.
  membershipsByWorkspace?: Record<string, string>; // workspace_id -> workspace_members.id
  pendingInvites?: Array<{ workspace_id: string; invitation_id: string }>;
}

export interface CustomDomain {
  id: string;
  domain: string;
  workspaceId: string;
  verified: boolean;
  addedAt: string;
  isDefault?: boolean;
  verifyToken?: string | null;
  verifyHost?: string;
  // Cloudflare for SaaS provisioning state.
  cfStatus?: string | null;
  cfSslStatus?: string | null;
  cnameTarget?: string | null;
  validationRecords?: DomainValidationRecord[];
}

function toCustomDomain(d: ApiDomain): CustomDomain {
  return {
    id: d.id,
    domain: d.domain,
    workspaceId: d.workspace_id,
    verified: d.verified,
    addedAt: d.created_at,
    isDefault: d.is_default,
    verifyToken: d.verify_token,
    verifyHost: d.verify_host,
    cfStatus: d.cf_status,
    cfSslStatus: d.cf_ssl_status,
    cnameTarget: d.cname_target,
    validationRecords: d.validation_records ?? [],
  };
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeWorkspace: Workspace | undefined;
  hasAgency: boolean;
  teamMembers: TeamMember[];
  customDomains: CustomDomain[];
  inviteCode: string;
  linkWorkspaces: Record<string, string>;
  loadingWorkspaces: boolean;
  // Actions
  setActiveWorkspaceId: (id: string) => void;
  createAgency: () => void;
  addWorkspace: (name: string) => Promise<Workspace>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  inviteMemberByEmail: (email: string, workspaceIds: string[], role?: 'member' | 'admin') => Promise<void>;
  addMemberToWorkspace: (email: string, workspaceId: string, role?: 'member' | 'admin') => Promise<void>;
  removeMemberFromWorkspace: (member: TeamMember, workspaceId: string) => Promise<void>;
  removeMember: (member: TeamMember) => Promise<void>;
  reloadTeamMembers: () => Promise<void>;
  addDomain: (domain: string, workspaceId: string) => Promise<CustomDomain>;
  verifyDomain: (id: string) => Promise<boolean>;
  removeDomain: (id: string) => Promise<void>;
  setDefaultDomain: (domainId: string) => Promise<void>;
  getDefaultDomain: (workspaceId: string) => CustomDomain | undefined;
  reloadDomains: () => Promise<void>;
  regenerateInviteCode: () => string;
  associateLinkWithWorkspace: (linkId: string, workspaceId: string) => void;
  reloadWorkspaces: () => Promise<void>;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

const S = {
  activeWsId:       'mdl-active-workspace',
  hasAgency:        'mdl-has-agency',
  inviteCode:       'mdl-invite-code',
  linkWorkspaces:   'mdl-link-workspaces',
};

// Stale keys from earlier versions that kept rows client-side. They're
// purged on mount so old data can't shadow API-sourced state.
const LEGACY_KEYS = ['mdl-custom-domains', 'mdl-default-domain-ids', 'mdl-team-members'];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((n) => chars[n % chars.length])
    .join('');
}

// ── API helper ───────────────────────────────────────────────────────────────

function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('mdl-auth-token');
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

// ── Context ──────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [workspaces, setWorkspaces]       = useState<Workspace[]>([]);
  const [activeWsId, setActiveWsId]       = useState(() => load<string>(S.activeWsId, ''));
  const [hasAgency, setHasAgency]         = useState(() => load<boolean>(S.hasAgency, false));
  const [teamMembers, setTeamMembers]     = useState<TeamMember[]>([]);
  const [customDomains, setCustomDomains] = useState<CustomDomain[]>([]);
  const [linkWorkspaces, setLinkWorkspaces] = useState<Record<string, string>>(() => load(S.linkWorkspaces, {}));
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [inviteCode] = useState<string>(() => {
    const stored = localStorage.getItem(S.inviteCode);
    if (stored) return stored;
    const code = generateCode();
    localStorage.setItem(S.inviteCode, code);
    return code;
  });

  // ── Cargar workspaces desde la API ──────────────────────────────────────

  const reloadWorkspaces = useCallback(async () => {
    const token = localStorage.getItem('mdl-auth-token');
    if (!token) {
      setWorkspaces([]);
      setLoadingWorkspaces(false);
      return;
    }
    try {
      setLoadingWorkspaces(true);
      const res = await authFetch('/api/workspaces');
      const data = await res.json() as { success: boolean; data?: Array<Workspace & { role: 'owner' | 'admin' | 'member' }> };
      if (data.success && data.data) {
        const ws: Workspace[] = data.data.map(w => ({
          ...w,
          rawRole: w.role,
          role: w.role === 'owner' || w.role === 'admin' ? 'Admin' : 'Member',
        }));
        setWorkspaces(ws);
        // Activar primer workspace si no hay uno activo o el activo ya no existe
        if (ws.length > 0) {
          // If coming from workspace entry page, activate that workspace
          const sessionSlug = sessionStorage.getItem('mdl-workspace-slug');
          const sessionMatch = sessionSlug ? ws.find(w => w.slug === sessionSlug) : null;

          if (sessionMatch) {
            setActiveWsId(sessionMatch.id);
            save(S.activeWsId, sessionMatch.id);
            sessionStorage.removeItem('mdl-workspace-slug');
            sessionStorage.removeItem('mdl-workspace-name');
          } else {
            const saved = localStorage.getItem(S.activeWsId);
            const valid = ws.find(w => w.id === saved);
            if (!valid) {
              setActiveWsId(ws[0].id);
              save(S.activeWsId, ws[0].id);
            }
          }
        }
        // Enable Agency whenever user has at least one workspace
        if (ws.length >= 1) {
          setHasAgency(true);
          save(S.hasAgency, true);
        }
      }
    } catch (e) {
      console.error('Error cargando workspaces:', e);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  // ── Domains (server-authoritative) ──────────────────────────────────────

  const reloadDomains = useCallback(async () => {
    if (!localStorage.getItem('mdl-auth-token')) {
      setCustomDomains([]);
      return;
    }
    const res = await domainsApi.list();
    if (res.success && res.data) {
      setCustomDomains(res.data.map(toCustomDomain));
    }
  }, []);

  useEffect(() => {
    // One-time cleanup: purge localStorage state that predates the API.
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
    reloadWorkspaces();
    reloadDomains();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWsId(id);
    save(S.activeWsId, id);
  }, []);

  const createAgency = useCallback(() => {
    setHasAgency(true);
    save(S.hasAgency, true);
  }, []);

  const addWorkspace = useCallback(async (name: string): Promise<Workspace> => {
    const res = await authFetch('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    const data = await res.json() as { success: boolean; data?: Workspace; error?: string };
    if (!data.success || !data.data) throw new Error(data.error || 'Error creando workspace');

    const ws: Workspace = { ...data.data, role: 'Admin', rawRole: 'owner' };
    setWorkspaces(prev => [...prev, ws]);
    setHasAgency(true);
    save(S.hasAgency, true);
    return ws;
  }, []);

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    const res = await authFetch(`/api/workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    const data = await res.json() as { success: boolean; data?: Workspace };
    if (data.success && data.data) {
      setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, name: data.data!.name } : w));
    }
  }, []);

  const deleteWorkspace = useCallback(async (id: string) => {
    if (workspaces.length <= 1) return;
    await authFetch(`/api/workspaces/${id}`, { method: 'DELETE' });
    setWorkspaces(prev => prev.filter(w => w.id !== id));
    if (activeWsId === id) {
      const next = workspaces.find(w => w.id !== id);
      if (next) setActiveWorkspaceId(next.id);
    }
  }, [workspaces, activeWsId, setActiveWorkspaceId]);

  // ── Team members (server-authoritative) ─────────────────────────────────
  //
  // Each visible row is one person. For every workspace the current user
  // belongs to we fetch:
  //   - GET /api/workspaces/:id/members      (active memberships)
  //   - GET /api/workspaces/:id/invitations  (pending invitations)
  // and merge them by lower-cased email. Domain auto-join rows show up
  // here because they're real rows in workspace_members. Pending rows
  // disappear from the list automatically once accepted (server updates
  // invitation.status, so it no longer matches the pending filter).

  type ApiMember = {
    id: string; role: 'owner' | 'admin' | 'member'; joined_at: string;
    user_id: string; email: string; name: string | null;
  };
  type ApiInvitation = {
    id: string; email: string; role: 'admin' | 'member';
    status: string; created_at: string; expires_at: string;
  };

  const reloadTeamMembers = useCallback(async () => {
    if (!localStorage.getItem('mdl-auth-token')) { setTeamMembers([]); return; }
    if (workspaces.length === 0) { setTeamMembers([]); return; }

    const settled = await Promise.allSettled(
      workspaces.flatMap(ws => [
        authFetch(`/api/workspaces/${ws.id}/members`)
          .then(r => r.json() as Promise<{ success: boolean; data?: ApiMember[] }>)
          .then(j => ({ ws_id: ws.id, kind: 'members' as const, rows: j.success ? (j.data ?? []) : [] })),
        authFetch(`/api/workspaces/${ws.id}/invitations`)
          .then(r => r.json() as Promise<{ success: boolean; data?: ApiInvitation[] }>)
          .then(j => ({ ws_id: ws.id, kind: 'invites' as const, rows: j.success ? (j.data ?? []) : [] })),
      ]),
    );

    const byEmail = new Map<string, TeamMember>();
    for (const r of settled) {
      if (r.status !== 'fulfilled') continue;
      const { ws_id, kind, rows } = r.value;
      for (const row of rows) {
        const key = row.email.toLowerCase();
        const existing = byEmail.get(key);
        if (kind === 'members') {
          const m = row as ApiMember;
          const merged: TeamMember = existing ?? {
            id: m.id,
            email: m.email,
            name: m.name ?? undefined,
            user_id: m.user_id,
            workspaceIds: [],
            status: 'active',
            invitedAt: m.joined_at,
            role: m.role,
            membershipsByWorkspace: {},
            pendingInvites: [],
          };
          merged.status = 'active'; // active always wins over pending
          merged.user_id = m.user_id;
          merged.name = merged.name ?? (m.name ?? undefined);
          merged.role = merged.role === 'owner' ? 'owner' : m.role;
          if (!merged.workspaceIds.includes(ws_id)) merged.workspaceIds.push(ws_id);
          merged.membershipsByWorkspace = { ...(merged.membershipsByWorkspace ?? {}), [ws_id]: m.id };
          byEmail.set(key, merged);
        } else {
          const inv = row as ApiInvitation;
          const merged: TeamMember = existing ?? {
            id: inv.id,
            email: inv.email,
            workspaceIds: [],
            status: 'pending',
            invitedAt: inv.created_at,
            role: inv.role,
            membershipsByWorkspace: {},
            pendingInvites: [],
          };
          if (!merged.workspaceIds.includes(ws_id)) merged.workspaceIds.push(ws_id);
          merged.pendingInvites = [...(merged.pendingInvites ?? []), { workspace_id: ws_id, invitation_id: inv.id }];
          byEmail.set(key, merged);
        }
      }
    }

    const list = Array.from(byEmail.values()).sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return a.email.localeCompare(b.email);
    });
    setTeamMembers(list);
  }, [workspaces]);

  const inviteMemberByEmail = useCallback(async (email: string, workspaceIds: string[], role: 'member' | 'admin' = 'member') => {
    // The invite endpoint takes a workspaceName per call; fire one per
    // selected workspace so a single email can be invited to multiple.
    const targets = workspaces.filter(w => workspaceIds.includes(w.id));
    if (targets.length === 0) throw new Error('Pick at least one workspace');

    const results = await Promise.all(targets.map(ws =>
      authFetch('/api/invites', {
        method: 'POST',
        body: JSON.stringify({ email, workspaceName: ws.name, role }),
      }).then(r => r.json()).catch(() => ({ success: false }))
    ));
    if (!results.some(r => (r as { success: boolean }).success)) {
      throw new Error('Failed to send invitation');
    }

    await reloadTeamMembers();
  }, [workspaces, reloadTeamMembers]);

  const addMemberToWorkspace = useCallback(async (
    email: string, workspaceId: string, role: 'member' | 'admin' = 'member',
  ) => {
    const res = await authFetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json() as { success: boolean; error?: string };
    if (!data.success) throw new Error(data.error || 'Could not add member');
    await reloadTeamMembers();
  }, [reloadTeamMembers]);

  const removeMemberFromWorkspace = useCallback(async (member: TeamMember, workspaceId: string) => {
    const memberRowId = member.membershipsByWorkspace?.[workspaceId];
    if (!memberRowId) return;
    const res = await authFetch(
      `/api/workspaces/${workspaceId}/members/${memberRowId}`,
      { method: 'DELETE' },
    );
    const data = await res.json() as { success: boolean; error?: string };
    if (!data.success) throw new Error(data.error || 'Could not remove member');
    await reloadTeamMembers();
  }, [reloadTeamMembers]);

  const removeMember = useCallback(async (member: TeamMember) => {
    if (member.status === 'active' && member.membershipsByWorkspace) {
      await Promise.all(Object.entries(member.membershipsByWorkspace).map(([wsId, memberId]) =>
        authFetch(`/api/workspaces/${wsId}/members/${memberId}`, { method: 'DELETE' })
      ));
    } else if (member.status === 'pending' && member.pendingInvites) {
      await Promise.all(member.pendingInvites.map(p =>
        authFetch(`/api/workspaces/${p.workspace_id}/invitations/${p.invitation_id}`, { method: 'DELETE' })
      ));
    }
    await reloadTeamMembers();
  }, [reloadTeamMembers]);

  // Refresh team-members from the server whenever the set of workspaces
  // changes (initial load, workspace added/removed, token refresh).
  useEffect(() => {
    reloadTeamMembers();
  }, [reloadTeamMembers]);

  const addDomain = useCallback(async (domain: string, workspaceId: string): Promise<CustomDomain> => {
    const res = await domainsApi.create({ domain, workspace_id: workspaceId });
    if (!res.success || !res.data) throw new Error(res.error || 'Failed to add domain');
    const added = toCustomDomain(res.data);
    // The server auto-promotes the first domain to is_default, so a reload keeps state in sync.
    await reloadDomains();
    return added;
  }, [reloadDomains]);

  const setDefaultDomain = useCallback(async (domainId: string) => {
    const res = await domainsApi.setDefault(domainId);
    if (res.success) await reloadDomains();
  }, [reloadDomains]);

  const getDefaultDomain = useCallback((workspaceId: string): CustomDomain | undefined => {
    return customDomains.find(d => d.workspaceId === workspaceId && d.isDefault && d.verified);
  }, [customDomains]);

  const verifyDomain = useCallback(async (id: string): Promise<boolean> => {
    const res = await domainsApi.verify(id);
    if (res.success && res.data) {
      await reloadDomains();
      return true;
    }
    return false;
  }, [reloadDomains]);

  const removeDomain = useCallback(async (id: string) => {
    const res = await domainsApi.delete(id);
    if (res.success) await reloadDomains();
  }, [reloadDomains]);

  const associateLinkWithWorkspace = useCallback((linkId: string, workspaceId: string) => {
    setLinkWorkspaces(prev => {
      const updated = { ...prev, [linkId]: workspaceId };
      save(S.linkWorkspaces, updated);
      return updated;
    });
  }, []);

  const regenerateInviteCode = useCallback((): string => {
    const code = generateCode();
    localStorage.setItem(S.inviteCode, code);
    return code;
  }, []);

  const activeWorkspace = workspaces.find(w => w.id === activeWsId) ?? workspaces[0];

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspaceId: activeWsId,
      activeWorkspace,
      hasAgency,
      teamMembers,
      customDomains,
      inviteCode,
      linkWorkspaces,
      loadingWorkspaces,
      setActiveWorkspaceId,
      createAgency,
      addWorkspace,
      renameWorkspace,
      deleteWorkspace,
      inviteMemberByEmail,
      addMemberToWorkspace,
      removeMemberFromWorkspace,
      removeMember,
      reloadTeamMembers,
      addDomain,
      verifyDomain,
      removeDomain,
      setDefaultDomain,
      getDefaultDomain,
      regenerateInviteCode,
      associateLinkWithWorkspace,
      reloadWorkspaces,
      reloadDomains,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}
