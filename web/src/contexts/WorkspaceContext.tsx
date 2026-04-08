import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  role: string;
}

export interface TeamMember {
  id: string;
  email: string;
  name?: string;
  user_id?: string;
  workspaceIds: string[];
  status: 'pending' | 'active';
  invitedAt: string;
  role?: 'member' | 'admin';
}

export interface CustomDomain {
  id: string;
  domain: string;
  workspaceId: string;
  verified: boolean;
  addedAt: string;
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
  assignMemberWorkspace: (memberId: string, workspaceId: string, assign: boolean) => void;
  removeMember: (memberId: string) => void;
  addDomain: (domain: string, workspaceId: string) => void;
  verifyDomain: (id: string) => Promise<boolean>;
  removeDomain: (id: string) => void;
  regenerateInviteCode: () => string;
  associateLinkWithWorkspace: (linkId: string, workspaceId: string) => void;
  reloadWorkspaces: () => Promise<void>;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

const S = {
  activeWsId:    'mdl-active-workspace',
  hasAgency:     'mdl-has-agency',
  teamMembers:   'mdl-team-members',
  customDomains: 'mdl-custom-domains',
  inviteCode:    'mdl-invite-code',
  linkWorkspaces: 'mdl-link-workspaces',
};

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
  const [teamMembers, setTeamMembers]     = useState<TeamMember[]>(() => load(S.teamMembers, []));
  const [customDomains, setCustomDomains] = useState<CustomDomain[]>(() => load(S.customDomains, []));
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
      const data = await res.json() as { success: boolean; data?: Workspace[] };
      if (data.success && data.data) {
        const ws = data.data.map(w => ({
          ...w,
          role: (w.role === 'owner' ? 'Admin' : 'Member') as string,
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
        // Si tiene más de 1 workspace, habilitar Agency
        if (ws.length > 1) {
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

  useEffect(() => {
    reloadWorkspaces();
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

    const ws: Workspace = { ...data.data, role: 'Admin' };
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

  const inviteMemberByEmail = useCallback(async (email: string, workspaceIds: string[], role: 'member' | 'admin' = 'member') => {
    const wsNames = workspaces
      .filter(w => workspaceIds.includes(w.id))
      .map(w => w.name).join(', ');
    const workspaceName = wsNames || workspaces[0]?.name || 'MDL.cc';

    await authFetch('/api/invites', {
      method: 'POST',
      body: JSON.stringify({ email, workspaceName, inviteCode, role }),
    });

    const member: TeamMember = {
      id: crypto.randomUUID(),
      email,
      workspaceIds,
      status: 'pending',
      invitedAt: new Date().toISOString(),
      role,
    };
    const updated = [...teamMembers, member];
    setTeamMembers(updated);
    save(S.teamMembers, updated);
  }, [teamMembers, workspaces, inviteCode]);

  const assignMemberWorkspace = useCallback((memberId: string, workspaceId: string, assign: boolean) => {
    const updated = teamMembers.map(m => {
      if (m.id !== memberId) return m;
      const ids = assign
        ? [...new Set([...m.workspaceIds, workspaceId])]
        : m.workspaceIds.filter(id => id !== workspaceId);
      return { ...m, workspaceIds: ids };
    });
    setTeamMembers(updated);
    save(S.teamMembers, updated);
  }, [teamMembers]);

  const removeMember = useCallback((memberId: string) => {
    const updated = teamMembers.filter(m => m.id !== memberId);
    setTeamMembers(updated);
    save(S.teamMembers, updated);
  }, [teamMembers]);

  const addDomain = useCallback((domain: string, workspaceId: string) => {
    const d: CustomDomain = {
      id: crypto.randomUUID(),
      domain: domain.trim().toLowerCase().replace(/^https?:\/\//, ''),
      workspaceId,
      verified: false,
      addedAt: new Date().toISOString(),
    };
    const updated = [...customDomains, d];
    setCustomDomains(updated);
    save(S.customDomains, updated);
  }, [customDomains]);

  const verifyDomain = useCallback(async (id: string): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 1800));
    const updated = customDomains.map(d => d.id === id ? { ...d, verified: true } : d);
    setCustomDomains(updated);
    save(S.customDomains, updated);
    return true;
  }, [customDomains]);

  const removeDomain = useCallback((id: string) => {
    const updated = customDomains.filter(d => d.id !== id);
    setCustomDomains(updated);
    save(S.customDomains, updated);
  }, [customDomains]);

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
      assignMemberWorkspace,
      removeMember,
      addDomain,
      verifyDomain,
      removeDomain,
      regenerateInviteCode,
      associateLinkWithWorkspace,
      reloadWorkspaces,
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
