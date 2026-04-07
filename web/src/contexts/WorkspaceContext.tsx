import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  role: 'Admin' | 'Member';
}

export interface TeamMember {
  id: string;
  email: string;
  workspaceIds: string[];
  status: 'pending' | 'active';
  invitedAt: string;
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
  // Actions
  setActiveWorkspaceId: (id: string) => void;
  createAgency: () => void;
  addWorkspace: (name: string) => Workspace;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => void;
  inviteMemberByEmail: (email: string, workspaceIds: string[]) => void;
  assignMemberWorkspace: (memberId: string, workspaceId: string, assign: boolean) => void;
  removeMember: (memberId: string) => void;
  addDomain: (domain: string, workspaceId: string) => void;
  verifyDomain: (id: string) => Promise<boolean>;
  removeDomain: (id: string) => void;
  regenerateInviteCode: () => string;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

const S = {
  workspaces:    'mdl-workspaces',
  activeWsId:    'mdl-active-workspace',
  hasAgency:     'mdl-has-agency',
  teamMembers:   'mdl-team-members',
  customDomains: 'mdl-custom-domains',
  inviteCode:    'mdl-invite-code',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
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

function defaultWorkspaces(): Workspace[] {
  const stored = localStorage.getItem(S.workspaces);
  if (stored) {
    try { return JSON.parse(stored); } catch {}
  }
  // Try to pick up legacy key from old Settings.tsx
  const legacyName = localStorage.getItem('mdl-workspace-name') || 'My Workspace';
  return [{ id: 'default', name: legacyName, role: 'Admin' }];
}

// ── Context ──────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces]       = useState<Workspace[]>(defaultWorkspaces);
  const [activeWsId, setActiveWsId]       = useState(() => load<string>(S.activeWsId, 'default'));
  const [hasAgency, setHasAgency]         = useState(() => load<boolean>(S.hasAgency, false));
  const [teamMembers, setTeamMembers]     = useState<TeamMember[]>(() => load(S.teamMembers, []));
  const [customDomains, setCustomDomains] = useState<CustomDomain[]>(() => load(S.customDomains, []));
  const [inviteCode, setInviteCode]       = useState<string>(() => {
    const stored = localStorage.getItem(S.inviteCode);
    return stored || generateCode();
  });

  // Persist invite code on first load
  useEffect(() => {
    if (!localStorage.getItem(S.inviteCode)) {
      localStorage.setItem(S.inviteCode, inviteCode);
    }
  }, [inviteCode]);

  const persist = useCallback((ws: Workspace[]) => {
    setWorkspaces(ws);
    save(S.workspaces, ws);
    // Keep legacy key in sync (first workspace name)
    if (ws[0]) localStorage.setItem('mdl-workspace-name', ws[0].name);
  }, []);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWsId(id);
    save(S.activeWsId, id);
  }, []);

  const createAgency = useCallback(() => {
    setHasAgency(true);
    save(S.hasAgency, true);
  }, []);

  const addWorkspace = useCallback((name: string): Workspace => {
    const ws: Workspace = { id: crypto.randomUUID(), name: name.trim(), role: 'Admin' };
    const updated = [...workspaces, ws];
    persist(updated);
    return ws;
  }, [workspaces, persist]);

  const renameWorkspace = useCallback((id: string, name: string) => {
    const updated = workspaces.map((w) => w.id === id ? { ...w, name: name.trim() } : w);
    persist(updated);
  }, [workspaces, persist]);

  const deleteWorkspace = useCallback((id: string) => {
    if (workspaces.length <= 1) return;
    const updated = workspaces.filter((w) => w.id !== id);
    persist(updated);
    if (activeWsId === id) {
      const next = updated[0]?.id ?? '';
      setActiveWorkspaceId(next);
    }
  }, [workspaces, activeWsId, persist, setActiveWorkspaceId]);

  const inviteMemberByEmail = useCallback((email: string, workspaceIds: string[]) => {
    const member: TeamMember = {
      id: crypto.randomUUID(),
      email,
      workspaceIds,
      status: 'pending',
      invitedAt: new Date().toISOString(),
    };
    const updated = [...teamMembers, member];
    setTeamMembers(updated);
    save(S.teamMembers, updated);
  }, [teamMembers]);

  const assignMemberWorkspace = useCallback((memberId: string, workspaceId: string, assign: boolean) => {
    const updated = teamMembers.map((m) => {
      if (m.id !== memberId) return m;
      const ids = assign
        ? [...new Set([...m.workspaceIds, workspaceId])]
        : m.workspaceIds.filter((id) => id !== workspaceId);
      return { ...m, workspaceIds: ids };
    });
    setTeamMembers(updated);
    save(S.teamMembers, updated);
  }, [teamMembers]);

  const removeMember = useCallback((memberId: string) => {
    const updated = teamMembers.filter((m) => m.id !== memberId);
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
    // Simulate async DNS check — in production this calls an API endpoint
    await new Promise((r) => setTimeout(r, 1800));
    // For demo: mark as verified
    const updated = customDomains.map((d) => d.id === id ? { ...d, verified: true } : d);
    setCustomDomains(updated);
    save(S.customDomains, updated);
    return true;
  }, [customDomains]);

  const removeDomain = useCallback((id: string) => {
    const updated = customDomains.filter((d) => d.id !== id);
    setCustomDomains(updated);
    save(S.customDomains, updated);
  }, [customDomains]);

  const regenerateInviteCode = useCallback((): string => {
    const code = generateCode();
    setInviteCode(code);
    localStorage.setItem(S.inviteCode, code);
    return code;
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeWsId) ?? workspaces[0];

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspaceId: activeWsId,
      activeWorkspace,
      hasAgency,
      teamMembers,
      customDomains,
      inviteCode,
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
