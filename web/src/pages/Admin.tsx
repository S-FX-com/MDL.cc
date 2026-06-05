import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Building2, Users, Link2, Globe, MousePointerClick,
  Search, Trash2, Edit2, Check, X, ChevronLeft, Loader2,
  AlertCircle, UserPlus, Crown, ShieldCheck, ShieldOff,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  admin,
  type AdminOverview, type AdminWorkspace, type AdminWorkspaceDetail, type AdminUser,
} from '../lib/api';
import clsx from 'clsx';

type Tab = 'overview' | 'workspaces' | 'users';

// ── Small building blocks ──────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: number | string; accent: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1a` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div>
          <p className="text-2xl font-display font-semibold leading-none text-neutral-900 dark:text-white">{value}</p>
          <p className="text-xs mt-1 text-neutral-500 dark:text-neutral-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Banner({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div className={clsx(
      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm mb-4',
      kind === 'error'
        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    )}>
      <AlertCircle className="w-4 h-4 shrink-0" />
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    owner: 'badge-accent', admin: 'badge-primary', member: 'badge-gray',
  };
  return <span className={clsx('badge', map[role] ?? 'badge-gray')}>{role}</span>;
}

// ── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    admin.overview().then(r => {
      if (r.success && r.data) setData(r.data);
      else setError(r.error || 'Failed to load overview');
    });
  }, []);

  if (error) return <Banner kind="error">{error}</Banner>;
  if (!data) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>;

  const t = data.totals;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatTile icon={Building2} label="Workspaces" value={t.workspaces} accent="#5b8ffe" />
        <StatTile icon={Users} label="Users" value={t.users} accent="#00c7f9" />
        <StatTile icon={Link2} label="Links" value={t.links} accent="#10b981" />
        <StatTile icon={MousePointerClick} label="Total clicks" value={t.clicks} accent="#f59e0b" />
        <StatTile icon={Globe} label="Branded domains" value={t.domains} accent="#8888ff" />
        <StatTile icon={Shield} label="Superadmins" value={t.superadmins} accent="#ef4444" />
      </div>

      <div className="card">
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-700">
          <h2 className="font-semibold text-neutral-900 dark:text-white">Newest workspaces</h2>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
          {data.recent_workspaces.map(w => (
            <div key={w.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium truncate text-neutral-900 dark:text-white">{w.name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {w.owner_email ?? 'no owner'} · {new Date(w.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{w.member_count}</span>
                <span className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" />{w.link_count}</span>
              </div>
            </div>
          ))}
          {data.recent_workspaces.length === 0 && (
            <p className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">No workspaces yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Workspace detail drawer ─────────────────────────────────────────────────

function WorkspaceDetail({ id, onBack, onChanged }: {
  id: string; onBack: () => void; onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AdminWorkspaceDetail | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    admin.getWorkspace(id).then(r => {
      if (r.success && r.data) { setDetail(r.data); setName(r.data.workspace.name); }
      else setError(r.error || 'Failed to load workspace');
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveName = async () => {
    const r = await admin.updateWorkspace(id, { name });
    if (r.success) { setEditingName(false); setMsg('Workspace renamed'); load(); onChanged(); }
    else setError(r.error || 'Rename failed');
  };

  const del = async () => {
    if (!confirm(`Delete workspace "${detail?.workspace.name}"? This removes all its links, members, groups and domains. This cannot be undone.`)) return;
    const r = await admin.deleteWorkspace(id);
    if (r.success) { onChanged(); onBack(); }
    else setError(r.error || 'Delete failed');
  };

  const addMember = async () => {
    if (!newMemberEmail.trim()) return;
    setBusy(true); setError(''); setMsg('');
    const r = await admin.addMember(id, { email: newMemberEmail.trim() });
    setBusy(false);
    if (r.success) { setNewMemberEmail(''); setMsg('Member added'); load(); }
    else setError(r.error || 'Could not add member');
  };

  const changeRole = async (memberId: string, role: 'member' | 'admin') => {
    const r = await admin.updateMemberRole(id, memberId, role);
    if (r.success) load(); else setError(r.error || 'Could not change role');
  };

  const removeMember = async (memberId: string) => {
    const r = await admin.removeMember(id, memberId);
    if (r.success) load(); else setError(r.error || 'Could not remove member');
  };

  const makeOwner = async (userId: string) => {
    const r = await admin.updateWorkspace(id, { owner_id: userId });
    if (r.success) { setMsg('Ownership transferred'); load(); onChanged(); }
    else setError(r.error || 'Could not transfer ownership');
  };

  if (!detail) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>;
  }

  const ws = detail.workspace;
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="btn btn-ghost btn-sm">
        <ChevronLeft className="w-4 h-4" /> All workspaces
      </button>

      {error && <Banner kind="error">{error}</Banner>}
      {msg && <Banner kind="success">{msg}</Banner>}

      {/* Header card */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input className="input flex-1 py-1.5" value={name} autoFocus
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }} />
                <button onClick={saveName} className="btn btn-primary btn-sm"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setEditingName(false); setName(ws.name); }} className="btn btn-secondary btn-sm"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-semibold text-neutral-900 dark:text-white truncate">{ws.name}</h2>
                <button onClick={() => setEditingName(true)} className="btn btn-ghost btn-xs"><Edit2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
              /{ws.slug} · owner {ws.owner_email ?? '—'}
            </p>
          </div>
          <button onClick={del} className="btn btn-danger btn-sm shrink-0"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="text-center py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
            <p className="text-lg font-semibold text-neutral-900 dark:text-white">{detail.counts.link_count}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Links</p>
          </div>
          <div className="text-center py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
            <p className="text-lg font-semibold text-neutral-900 dark:text-white">{detail.counts.click_count}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Clicks</p>
          </div>
          <div className="text-center py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
            <p className="text-lg font-semibold text-neutral-900 dark:text-white">{detail.counts.group_count}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Groups</p>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="card">
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900 dark:text-white">Members ({detail.members.length})</h3>
        </div>
        <div className="p-4 flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-700">
          <input className="input flex-1" placeholder="existing user's email…" value={newMemberEmail}
            onChange={e => setNewMemberEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addMember(); }} />
          <button onClick={addMember} disabled={busy} className="btn btn-primary btn-sm">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Add
          </button>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
          {detail.members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3 gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate text-neutral-900 dark:text-white">{m.name || m.email}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <RoleBadge role={m.role} />
                {m.role !== 'owner' && (
                  <>
                    <select value={m.role}
                      onChange={e => changeRole(m.id, e.target.value as 'member' | 'admin')}
                      className="input py-1 text-xs" style={{ width: 'auto' }}>
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </select>
                    <button onClick={() => makeOwner(m.user_id)} title="Make owner" className="btn btn-ghost btn-xs"><Crown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeMember(m.id)} title="Remove" className="btn btn-ghost btn-xs"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Domains */}
      {(detail.domains.length > 0 || detail.email_domains.length > 0) && (
        <div className="card">
          <div className="p-5 border-b border-neutral-100 dark:border-neutral-700">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Domains</h3>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {detail.domains.map(d => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <span className="font-mono text-sm text-neutral-900 dark:text-white">{d.domain}</span>
                <div className="flex items-center gap-2">
                  {d.is_default ? <span className="badge badge-primary">default</span> : null}
                  <span className={clsx('badge', d.verified ? 'badge-success' : 'badge-warning')}>
                    {d.verified ? 'verified' : 'pending'}
                  </span>
                </div>
              </div>
            ))}
            {detail.email_domains.map(d => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <span className="font-mono text-sm text-neutral-900 dark:text-white">@{d.domain}</span>
                <span className="badge badge-info">auto-join: {d.auto_join_mode}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Workspaces tab ──────────────────────────────────────────────────────────

function WorkspacesTab() {
  const [rows, setRows] = useState<AdminWorkspace[] | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback((q?: string) => {
    admin.listWorkspaces(q).then(r => {
      if (r.success && r.data) setRows(r.data);
      else setError(r.error || 'Failed to load workspaces');
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return <WorkspaceDetail id={selected} onBack={() => setSelected(null)} onChanged={() => load(search)} />;
  }

  return (
    <div className="space-y-4">
      {error && <Banner kind="error">{error}</Banner>}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Search workspaces or owners…"
          value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value); }} />
      </div>

      {!rows ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {rows.map(w => (
              <button key={w.id} onClick={() => setSelected(w.id)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <div className="min-w-0">
                  <p className="font-medium truncate text-neutral-900 dark:text-white">{w.name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {w.owner_email ?? 'no owner'} · /{w.slug}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{w.member_count}</span>
                  <span className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" />{w.link_count}</span>
                  <span className="flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5" />{w.click_count}</span>
                  {w.domain_count > 0 && <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{w.domain_count}</span>}
                </div>
              </button>
            ))}
            {rows.length === 0 && (
              <p className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">No workspaces match.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Users tab ───────────────────────────────────────────────────────────────

function UsersTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback((q?: string) => {
    admin.listUsers(q).then(r => {
      if (r.success && r.data) setRows(r.data);
      else setError(r.error || 'Failed to load users');
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (u: AdminUser) => {
    const next = !u.is_superadmin;
    if (next && !confirm(`Grant platform superadmin to ${u.email}? They will be able to oversee and configure every workspace.`)) return;
    const r = await admin.setSuperadmin(u.id, next);
    if (r.success) load(search); else setError(r.error || 'Update failed');
  };

  return (
    <div className="space-y-4">
      {error && <Banner kind="error">{error}</Banner>}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Search users by name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value); }} />
      </div>

      {!rows ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {rows.map(u => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate text-neutral-900 dark:text-white flex items-center gap-2">
                    {u.name || u.email}
                    {!!u.is_superadmin && <span className="badge badge-danger">superadmin</span>}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {u.email} · {u.workspace_count} workspace{u.workspace_count === 1 ? '' : 's'}
                    {u.has_microsoft ? ' · Microsoft' : ''}
                  </p>
                </div>
                <button
                  onClick={() => toggle(u)}
                  disabled={u.id === user?.id && !!u.is_superadmin}
                  title={u.id === user?.id && !!u.is_superadmin ? "You can't revoke your own access" : undefined}
                  className={clsx('btn btn-sm shrink-0', u.is_superadmin ? 'btn-secondary' : 'btn-primary')}>
                  {u.is_superadmin ? <><ShieldOff className="w-4 h-4" /> Revoke</> : <><ShieldCheck className="w-4 h-4" /> Make admin</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page shell ──────────────────────────────────────────────────────────────

export default function Admin() {
  useTheme();
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',   label: 'Overview',   icon: Shield },
    { id: 'workspaces', label: 'Workspaces', icon: Building2 },
    { id: 'users',      label: 'Users',      icon: Users },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#ef4444 0%,#f59e0b 100%)' }}>
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-semibold text-neutral-900 dark:text-white">Platform Admin</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Oversee and configure every workspace on MDL.cc</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
            )}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'workspaces' && <WorkspacesTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}
