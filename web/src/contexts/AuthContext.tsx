import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url?: string | null;
  // Platform-level operator flag. Set from /api/auth/me; gates the admin UI.
  is_superadmin?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, workspaceSlug?: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const TOKEN_KEY = 'mdl-auth-token';

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // On mount, capture a token from an SSO callback (#token=...) if present in
  // the URL. This puts the provider into an authenticated state immediately
  // without an extra re-render.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.includes('token=')) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const ssoToken = params.get('token');
    if (ssoToken) {
      localStorage.setItem(TOKEN_KEY, ssoToken);
      setToken(ssoToken);
      // Clear the fragment so a refresh doesn't re-process the token.
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // On mount, verify any saved token
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) {
      setLoading(false);
      return;
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then(r => r.json())
      .then((res: { success: boolean; data?: AuthUser }) => {
        if (res.success && res.data) {
          setUser(res.data);
          setToken(savedToken);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as {
      success: boolean;
      error?: string;
      data?: { token: string; user: AuthUser };
    };
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to sign in');
    }
    localStorage.setItem(TOKEN_KEY, data.data.token);
    setToken(data.data.token);
    setUser(data.data.user);
    // The login response doesn't include the platform-superadmin flag; pull the
    // canonical record from /me so the admin UI appears without a reload.
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${data.data.token}` } })
      .then(r => r.json())
      .then((me: { success: boolean; data?: AuthUser }) => {
        if (me.success && me.data) setUser(me.data);
      })
      .catch(() => {});
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, workspaceSlug?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, workspace_slug: workspaceSlug }),
    });
    const data = await res.json() as {
      success: boolean;
      error?: string;
      data?: { token: string; user: AuthUser };
    };
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to create account');
    }
    localStorage.setItem(TOKEN_KEY, data.data.token);
    setToken(data.data.token);
    setUser(data.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    // Also clear workspace data from localStorage
    ['mdl-workspaces', 'mdl-active-workspace', 'mdl-has-agency',
     'mdl-team-members', 'mdl-custom-domains', 'mdl-invite-code',
     'mdl-link-workspaces', 'mdl-display-name', 'mdl-default-domain-ids'].forEach(k => localStorage.removeItem(k));
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
