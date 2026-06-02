import { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor, Globe, Shield, ExternalLink,
  User, Building2, Users, Edit2, Check, X, Plus, Trash2,
  Copy, RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  Loader2, Link2,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import type { TeamMember, CustomDomain } from '../contexts/WorkspaceContext';
import EmailDomainsCard from '../components/EmailDomainsCard';
import type { DomainValidationRecord } from '../lib/api';
import clsx from 'clsx';

type ThemeOption = 'light' | 'dark' | 'system';

// ── Small reusable section header ─────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  action,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-6 border-b border-neutral-100 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
            <Icon className={clsx('w-5 h-5', iconColor)} />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 dark:text-white">{title}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

// ── Inline editable field ─────────────────────────────────────────────────────
function InlineEdit({
  value,
  onSave,
  onCancel,
  placeholder = 'Enter name',
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [val, setVal] = useState(value);
  return (
    <div className="flex items-center gap-2 flex-1 mr-2">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="input flex-1 py-1.5"
        autoFocus
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(val);
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button onClick={() => onSave(val)} className="btn btn-primary btn-sm">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={onCancel} className="btn btn-secondary btn-sm">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── DNS Instructions component ────────────────────────────────────────────────
function DnsRecordsTable({ records }: { records: DomainValidationRecord[] }) {
  const typeStyle: Record<string, string> = {
    CNAME: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    TXT: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  };
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-neutral-500 dark:text-neutral-400 text-left">
            <th className="pb-1 pr-4">Type</th>
            <th className="pb-1 pr-4">Host / Name</th>
            <th className="pb-1">Value / Target</th>
          </tr>
        </thead>
        <tbody className="text-neutral-900 dark:text-white">
          {records.map((r, i) => (
            <tr key={i}>
              <td className="pr-4 py-1 align-top">
                <span className={clsx('px-1.5 py-0.5 rounded', typeStyle[r.type.toUpperCase()] ?? 'bg-neutral-200 dark:bg-neutral-700')}>
                  {r.type.toUpperCase()}
                </span>
              </td>
              <td className="pr-4 py-1 align-top break-all">{r.name}</td>
              <td className="py-1 align-top text-secondary-600 dark:text-secondary-400 break-all">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DnsInstructions({
  domain,
  verifyToken,
  verifyHost,
  records,
  cfStatus,
  cfSslStatus,
}: {
  domain: string;
  verifyToken: string;
  verifyHost: string;
  records: DomainValidationRecord[];
  cfStatus?: string | null;
  cfSslStatus?: string | null;
}) {
  const [open, setOpen] = useState(false);
  // SaaS mode: Cloudflare returned the records the customer must add (CNAME +
  // SSL validation). Legacy mode: just the _mdl-verify ownership TXT.
  const saas = records.length > 0;
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-medium text-secondary-600 dark:text-secondary-400"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        How to configure DNS
      </button>
      {open && (
        <div className="mt-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 space-y-3 text-sm">
          {saas ? (
            <>
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">
                  Add these records at <code className="font-mono">{domain}</code>'s DNS, then click <strong>Verify</strong>
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">
                  The CNAME points your domain at MDL; the TXT record(s) let Cloudflare issue the
                  TLS certificate. Works for any domain on any Cloudflare account.
                </p>
                <DnsRecordsTable records={records} />
              </div>
              {(cfStatus || cfSslStatus) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200">
                    Hostname: <strong>{cfStatus ?? 'pending'}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200">
                    Certificate: <strong>{cfSslStatus ?? 'pending'}</strong>
                  </span>
                </div>
              )}
            </>
          ) : (
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">
                Add this TXT record, then click <strong>Verify</strong>
              </p>
              <DnsRecordsTable records={[{ type: 'TXT', name: verifyHost, value: verifyToken }]} />
            </div>
          )}

          <div className="flex gap-2 items-start p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              DNS changes can take a few minutes to propagate. Click <strong>Verify</strong> once
              the records are live; the certificate is issued automatically after that.
            </p>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Need help?{' '}
            <a href="mailto:support@mdl.cc" className="text-secondary-600 dark:text-secondary-400 underline underline-offset-2">
              Contact support
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────────

export default function Settings() {
  const { setTheme } = useTheme();
  const { user, token, updateUser } = useAuth();
  const {
    workspaces, activeWorkspaceId, hasAgency,
    teamMembers, customDomains, inviteCode,
    setActiveWorkspaceId, createAgency,
    addWorkspace, renameWorkspace, deleteWorkspace,
    inviteMemberByEmail, addMemberToWorkspace, removeMemberFromWorkspace, removeMember,
    addDomain, verifyDomain, removeDomain, setDefaultDomain, getDefaultDomain, regenerateInviteCode,
  } = useWorkspace();

  // Per-member assignment toggle state (workspace pill we're currently
  // adding/removing). Used to dim the pill + suppress double-clicks.
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  const handleToggleWorkspace = async (member: TeamMember, ws: { id: string; rawRole?: string }) => {
    if (!ws.rawRole || !['owner', 'admin'].includes(ws.rawRole)) return;
    if (member.status !== 'active') return;
    if (member.role === 'owner' && member.workspaceIds.includes(ws.id)) return;

    const key = `${member.id}:${ws.id}`;
    setToggleBusy(key);
    setMemberError(null);
    try {
      if (member.workspaceIds.includes(ws.id)) {
        await removeMemberFromWorkspace(member, ws.id);
      } else {
        await addMemberToWorkspace(member.email, ws.id, member.role === 'admin' ? 'admin' : 'member');
      }
    } catch (e) {
      setMemberError(e instanceof Error ? e.message : 'Could not update membership');
      setTimeout(() => setMemberError(null), 4000);
    } finally {
      setToggleBusy(null);
    }
  };

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>(
    (localStorage.getItem('mdl-theme') as ThemeOption) || 'system'
  );

  const handleThemeChange = (t: ThemeOption) => {
    setSelectedTheme(t);
    if (t === 'system') {
      localStorage.removeItem('mdl-theme');
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      setTheme(t);
    }
  };

  // ── Profile ────────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [displayNameSaved, setDisplayNameSaved] = useState(false);

  // Sincronizar con usuario cuando cargue
  useEffect(() => {
    if (user?.name) setDisplayName(user.name);
  }, [user?.name]);

  const saveDisplayName = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: displayName }),
      });
      const data = await res.json() as { success: boolean; data?: { name: string } };
      if (data.success && data.data) updateUser({ name: data.data.name });
      setDisplayNameSaved(true);
      setTimeout(() => setDisplayNameSaved(false), 2000);
    } catch {
      // silencioso
    }
  };

  // ── Agency ────────────────────────────────────────────────────────────────
  const [agencyName, setAgencyName] = useState(
    () => localStorage.getItem('mdl-agency-name') || ''
  );
  const [agencyInput, setAgencyInput] = useState('');
  const [showAgencyForm, setShowAgencyForm] = useState(false);

  const handleCreateAgency = () => {
    if (!agencyInput.trim()) return;
    const name = agencyInput.trim();
    setAgencyName(name);
    localStorage.setItem('mdl-agency-name', name);
    createAgency();
    setShowAgencyForm(false);
    setAgencyInput('');
  };

  // ── Workspaces ────────────────────────────────────────────────────────────
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [showNewWsForm, setShowNewWsForm] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  const handleAddWorkspace = async () => {
    if (!newWsName.trim()) return;
    try {
      const ws = await addWorkspace(newWsName);
      setNewWsName('');
      setShowNewWsForm(false);
      setActiveWorkspaceId(ws.id);
    } catch {
      // silencioso
    }
  };

  // ── Team Members ──────────────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteWsIds, setInviteWsIds] = useState<string[]>([activeWorkspaceId]);
  const [inviteTab, setInviteTab] = useState<'email' | 'code'>('email');
  const [codeCopied, setCodeCopied] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@') || inviteSending) return;
    setInviteSending(true);
    setInviteStatus('idle');
    try {
      await inviteMemberByEmail(inviteEmail.trim(), inviteWsIds);
      setInviteEmail('');
      setInviteWsIds([activeWorkspaceId]);
      setInviteStatus('sent');
      setTimeout(() => setInviteStatus('idle'), 3000);
    } catch {
      setInviteStatus('error');
      setTimeout(() => setInviteStatus('idle'), 3000);
    } finally {
      setInviteSending(false);
    }
  };

  const copyInviteCode = async () => {
    await navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // ── Custom Domains ─────────────────────────────────────────────────────────
  const [domainInput, setDomainInput] = useState('');
  const [domainWsId, setDomainWsId] = useState(activeWorkspaceId);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [domainError, setDomainError] = useState('');
  const handleAddDomain = async () => {
    if (!domainInput.trim()) return;
    setDomainError('');
    try {
      await addDomain(domainInput, domainWsId);
      setDomainInput('');
    } catch (e) {
      setDomainError(e instanceof Error ? e.message : 'Failed to add domain');
    }
  };

  const [verifyError, setVerifyError] = useState<string | null>(null);
  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    setVerifyError(null);
    const ok = await verifyDomain(id);
    if (!ok) setVerifyError(id);
    setVerifyingId(null);
  };

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Settings</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">Customize your MDL.cc experience</p>
      </div>

      {/* ── 1. Profile ──────────────────────────────────────────────────────── */}
      <div className="card">
        <SectionHeader
          icon={User}
          iconBg="bg-indigo-100 dark:bg-indigo-900/30"
          iconColor="text-indigo-600 dark:text-indigo-400"
          title="Profile"
          subtitle="Your personal display information"
        />
        <div className="p-6">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Display name
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="input flex-1"
              onKeyDown={(e) => e.key === 'Enter' && saveDisplayName()}
            />
            <button
              onClick={saveDisplayName}
              className={clsx('btn', displayNameSaved ? 'btn-primary' : 'btn-secondary')}
            >
              {displayNameSaved && <Check className="w-4 h-4" />}
              {displayNameSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Agency ───────────────────────────────────────────────────────── */}
      <div className="card">
        <SectionHeader
          icon={Building2}
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          iconColor="text-violet-600 dark:text-violet-400"
          title="Agency"
          subtitle="Enables multiple workspaces and team invitations"
        />
        <div className="p-6">
          {hasAgency ? (
            <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{agencyName[0]?.toUpperCase() ?? 'A'}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-neutral-900 dark:text-white">{agencyName}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Agency account active</p>
              </div>
              <span className="badge badge-primary">Active</span>
            </div>
          ) : showAgencyForm ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                Give your agency a name. This will be used across workspaces and team invitations.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={agencyInput}
                  onChange={(e) => setAgencyInput(e.target.value)}
                  placeholder="Agency name (e.g. Acme Marketing)"
                  className="input flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateAgency();
                    if (e.key === 'Escape') setShowAgencyForm(false);
                  }}
                />
                <button onClick={handleCreateAgency} className="btn btn-primary">Create</button>
                <button onClick={() => setShowAgencyForm(false)} className="btn btn-secondary">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3 items-start p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                <AlertCircle className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-violet-900 dark:text-violet-100">
                    Agency required for advanced features
                  </p>
                  <p className="text-xs text-violet-700 dark:text-violet-300">
                    Create an Agency to unlock multiple workspaces, team member invitations, and custom branded domains.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAgencyForm(true)} className="btn btn-primary gap-2">
                <Building2 className="w-4 h-4" />
                Create Agency
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Workspaces ───────────────────────────────────────────────────── */}
      <div className="card">
        <SectionHeader
          icon={Link2}
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
          title="Workspaces"
          subtitle="Switch between and manage your workspaces"
          action={
            hasAgency ? (
              <button
                onClick={() => setShowNewWsForm(!showNewWsForm)}
                className="btn btn-secondary btn-sm gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Workspace
              </button>
            ) : null
          }
        />
        <div className="p-6 space-y-3">
          {/* Add workspace form */}
          {showNewWsForm && (
            <div className="flex gap-2 p-3 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600">
              <input
                type="text"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="Workspace name"
                className="input flex-1 py-1.5"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddWorkspace();
                  if (e.key === 'Escape') setShowNewWsForm(false);
                }}
              />
              <button onClick={handleAddWorkspace} className="btn btn-primary btn-sm">Create</button>
              <button onClick={() => setShowNewWsForm(false)} className="btn btn-secondary btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <div
                key={ws.id}
                className={clsx(
                  'flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer',
                  isActive
                    ? 'bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800'
                    : 'bg-neutral-50 dark:bg-neutral-800 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-600'
                )}
                onClick={() => editingWsId !== ws.id && setActiveWorkspaceId(ws.id)}
              >
                {editingWsId === ws.id ? (
                  <InlineEdit
                    value={ws.name}
                    onSave={(v) => { renameWorkspace(ws.id, v); setEditingWsId(null); }}
                    onCancel={() => setEditingWsId(null)}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: isActive ? '#5b8ffe' : '#64748b' }}
                    >
                      <span className="text-white font-bold text-sm">{ws.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">{ws.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Role: {ws.role}</p>
                    </div>
                  </div>
                )}

                {editingWsId !== ws.id && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isActive && <span className="badge badge-primary">Active</span>}
                    <button
                      onClick={() => setEditingWsId(ws.id)}
                      className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      title="Rename workspace"
                    >
                      <Edit2 className="w-4 h-4 text-neutral-400" />
                    </button>
                    {workspaces.length > 1 && (
                      <button
                        onClick={() => { if (confirm('Remove this workspace?')) deleteWorkspace(ws.id); }}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                        title="Remove workspace"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!hasAgency && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 pt-1">
              <span className="text-violet-600 dark:text-violet-400 font-medium">Create an Agency</span> above to add more workspaces.
            </p>
          )}
        </div>
      </div>

      {/* ── 3b. Email domains (Microsoft auto-join) ─────────────────────────── */}
      <EmailDomainsCard
        workspaceId={activeWorkspaceId}
        workspaceName={workspaces.find(w => w.id === activeWorkspaceId)?.name || 'this workspace'}
        hasAgency={hasAgency}
      />

      {/* ── 4. Team Members ─────────────────────────────────────────────────── */}
      <div className={clsx('card', !hasAgency && 'opacity-60 pointer-events-none select-none')}>
        <SectionHeader
          icon={Users}
          iconBg="bg-teal-100 dark:bg-teal-900/30"
          iconColor="text-teal-600 dark:text-teal-400"
          title="Team Members"
          subtitle={hasAgency ? 'Invite people and assign them to workspaces' : 'Requires Agency — create one above'}
        />
        <div className="p-6 space-y-5">
          {/* Invite tabs */}
          <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-fit">
            {(['email', 'code'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setInviteTab(tab)}
                className={clsx(
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                  inviteTab === tab
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400'
                )}
              >
                {tab === 'email' ? 'Invite by Email' : 'Invite by Code'}
              </button>
            ))}
          </div>

          {inviteTab === 'email' ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="input flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                />
                <button onClick={handleInvite} disabled={inviteSending} className="btn btn-primary gap-1.5">
                  <Plus className="w-4 h-4" />
                  {inviteSending ? 'Sending…' : 'Invite'}
                </button>
              </div>
              {inviteStatus === 'sent' && (
                <p className="text-xs text-emerald-500">Invitation sent!</p>
              )}
              {inviteStatus === 'error' && (
                <p className="text-xs text-red-400">Failed to send invitation. Please try again.</p>
              )}

              {/* Workspace assignment for invite */}
              <div>
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-2">
                  Assign to workspaces:
                </p>
                <div className="flex flex-wrap gap-2">
                  {workspaces.map((ws) => {
                    const selected = inviteWsIds.includes(ws.id);
                    return (
                      <button
                        key={ws.id}
                        onClick={() =>
                          setInviteWsIds(
                            selected
                              ? inviteWsIds.filter((id) => id !== ws.id)
                              : [...inviteWsIds, ws.id]
                          )
                        }
                        className={clsx(
                          'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                          selected
                            ? 'border-secondary-500 bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300'
                            : 'border-neutral-200 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300'
                        )}
                      >
                        {selected && <Check className="w-3 h-3 inline mr-1" />}
                        {ws.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                Share this code with your team. Anyone with this code can join your agency.
              </p>
              <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                <code className="flex-1 text-xl font-mono font-bold tracking-widest text-neutral-900 dark:text-white">
                  {inviteCode}
                </code>
                <button onClick={copyInviteCode} className="btn btn-secondary btn-sm gap-1.5">
                  {codeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {codeCopied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={regenerateInviteCode}
                  className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  title="Generate new code"
                >
                  <RefreshCw className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Regenerating the code will invalidate the previous one.
              </p>
            </div>
          )}

          {/* Team member list */}
          {teamMembers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-700">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Members ({teamMembers.length})
              </p>
              {teamMembers.map((member: TeamMember) => (
                <div key={member.id} className="rounded-xl border border-neutral-100 dark:border-neutral-700 overflow-hidden">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-600 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                          {member.email[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{member.email}</p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">
                          {member.workspaceIds.length === 0
                            ? 'No workspaces assigned'
                            : `${member.workspaceIds.length} workspace${member.workspaceIds.length > 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'badge',
                        member.status === 'active' ? 'badge-green' : 'badge-gray'
                      )}>
                        {member.status === 'active' ? 'Active' : 'Pending'}
                      </span>
                      {expandedMember === member.id ? (
                        <ChevronUp className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                  </div>

                  {expandedMember === member.id && (
                    <div className="p-3 border-t border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 space-y-3">
                      <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                        {member.status === 'active' ? 'Workspace access:' : 'Invited to:'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {member.status === 'active'
                          ? workspaces.map((ws) => {
                              const has = member.workspaceIds.includes(ws.id);
                              const canManage = ws.rawRole === 'owner' || ws.rawRole === 'admin';
                              const isOwnerHere = has && member.role === 'owner';
                              const disabled = !canManage || isOwnerHere || toggleBusy === `${member.id}:${ws.id}`;
                              return (
                                <button
                                  key={ws.id}
                                  onClick={() => handleToggleWorkspace(member, ws)}
                                  disabled={disabled}
                                  title={
                                    isOwnerHere ? 'Workspace owner — cannot be removed here'
                                    : !canManage ? 'You need owner/admin in this workspace to manage members'
                                    : has ? 'Remove from this workspace'
                                    : 'Add to this workspace'
                                  }
                                  className={clsx(
                                    'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                                    has
                                      ? 'border-secondary-500 bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300'
                                      : 'border-neutral-200 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300',
                                    disabled && 'opacity-60 cursor-not-allowed',
                                  )}
                                >
                                  {has && <Check className="w-3 h-3 inline mr-1" />}
                                  {ws.name}
                                  {isOwnerHere && <span className="ml-1 text-[10px] uppercase tracking-wider">owner</span>}
                                </button>
                              );
                            })
                          : workspaces
                              .filter(ws => member.workspaceIds.includes(ws.id))
                              .map((ws) => (
                                <span
                                  key={ws.id}
                                  className="px-3 py-1 rounded-full text-xs font-medium border border-secondary-500 bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300"
                                >
                                  <Check className="w-3 h-3 inline mr-1" />
                                  {ws.name}
                                </span>
                              ))}
                      </div>
                      {memberError && expandedMember === member.id && (
                        <p className="text-xs text-red-400">{memberError}</p>
                      )}
                      {member.role !== 'owner' && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove ${member.email}?`)) return;
                            try { await removeMember(member); } catch { /* surfaced upstream */ }
                          }}
                          className="btn btn-danger btn-xs gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          {member.status === 'active' ? 'Remove from all workspaces' : 'Cancel invitation'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Custom Domains ────────────────────────────────────────────────── */}
      <div className={clsx('card', !hasAgency && 'opacity-60 pointer-events-none select-none')}>
        <SectionHeader
          icon={Globe}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          title="Custom Domains"
          subtitle={hasAgency ? 'Use branded domains for your short links' : 'Requires Agency — create one above'}
        />
        <div className="p-6 space-y-5">
          {/* Add domain form */}
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Add a custom domain to create branded short links (e.g. <code className="text-secondary-600 dark:text-secondary-400">go.yourcompany.com/slug</code>).
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="go.yourcompany.com"
                className="input flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
              />
              {workspaces.length > 1 && (
                <select
                  value={domainWsId}
                  onChange={(e) => setDomainWsId(e.target.value)}
                  className="input w-auto"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
              )}
              <button onClick={handleAddDomain} className="btn btn-primary gap-1.5 shrink-0">
                <Plus className="w-4 h-4" />
                Add Domain
              </button>
            </div>
            {domainError && (
              <p className="text-sm text-red-500 dark:text-red-400">{domainError}</p>
            )}
          </div>

          {/* Default domain */}
          <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary-500 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">mdl.cc</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Shared domain</p>
              </div>
            </div>
            {!getDefaultDomain(activeWorkspaceId) && (
              <span className="badge badge-primary">Default</span>
            )}
          </div>

          {/* Custom domains list */}
          {customDomains.length > 0 && (
            <div className="space-y-3">
              {customDomains.map((d: CustomDomain) => {
                const ws = workspaces.find((w) => w.id === d.workspaceId);
                const isVerifying = verifyingId === d.id;
                const isDefault = getDefaultDomain(d.workspaceId)?.id === d.id;
                return (
                  <div key={d.id} className="rounded-xl border border-neutral-100 dark:border-neutral-700 overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-neutral-900 dark:text-white">{d.domain}</p>
                            {isDefault && <span className="badge badge-primary">Default</span>}
                          </div>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {ws ? `Workspace: ${ws.name}` : 'Unknown workspace'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isDefault && d.verified && (
                          <button
                            onClick={() => setDefaultDomain(d.id)}
                            className="btn btn-secondary btn-sm"
                          >
                            Set as default
                          </button>
                        )}
                        {d.verified ? (
                          <span className="flex items-center gap-1 badge badge-green">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <button
                            onClick={() => handleVerify(d.id)}
                            disabled={isVerifying}
                            className="btn btn-secondary btn-sm gap-1.5"
                          >
                            {isVerifying ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            {isVerifying ? 'Checking…' : 'Verify'}
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm(`Remove ${d.domain}?`)) removeDomain(d.id); }}
                          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                    {!d.verified && (
                      <DnsInstructions
                        domain={d.domain}
                        verifyToken={d.verifyToken ?? ''}
                        verifyHost={d.verifyHost ?? `_mdl-verify.${d.domain}`}
                        records={d.validationRecords ?? []}
                        cfStatus={d.cfStatus}
                        cfSslStatus={d.cfSslStatus}
                      />
                    )}
                    {verifyError === d.id && (
                      <div className="px-4 pb-3 text-xs text-red-500 dark:text-red-400">
                        Couldn't find the TXT record yet. DNS changes can take a few minutes.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 6. Appearance ───────────────────────────────────────────────────── */}
      <div className="card">
        <SectionHeader
          icon={Sun}
          iconBg="bg-secondary-100 dark:bg-secondary-900/30"
          iconColor="text-secondary-600 dark:text-secondary-400"
          title="Appearance"
          subtitle="Customize how MDL.cc looks on your device"
        />
        <div className="p-6">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
            Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleThemeChange(option.value)}
                className={clsx(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  selectedTheme === option.value
                    ? 'border-secondary-500 bg-secondary-50 dark:bg-secondary-900/20'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                )}
              >
                <option.icon
                  className={clsx('w-6 h-6', selectedTheme === option.value ? 'text-secondary-500' : 'text-neutral-400')}
                />
                <span className={clsx(
                  'text-sm font-medium',
                  selectedTheme === option.value ? 'text-secondary-600 dark:text-secondary-400' : 'text-neutral-600 dark:text-neutral-400'
                )}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">
            {selectedTheme === 'system'
              ? 'MDL.cc will automatically match your system preference.'
              : `MDL.cc is set to ${selectedTheme} mode.`}
          </p>
        </div>
      </div>

      {/* ── About ────────────────────────────────────────────────────────────── */}
      <div className="card">
        <SectionHeader
          icon={Shield}
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
          title="About MDL.cc"
          subtitle="The middle-point between you and your audience"
        />
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Version</p>
              <p className="font-medium text-neutral-900 dark:text-white font-mono">{__APP_VERSION__}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Platform</p>
              <p className="font-medium text-neutral-900 dark:text-white">Cloudflare Workers</p>
            </div>
          </div>
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-700">
            <div className="flex flex-wrap gap-3">
              <a href="#" className="btn btn-secondary btn-sm">
                Privacy Policy <ExternalLink className="w-3 h-3" />
              </a>
              <a href="#" className="btn btn-secondary btn-sm">
                Terms of Service <ExternalLink className="w-3 h-3" />
              </a>
              <a href="#" className="btn btn-secondary btn-sm">
                Contact Support <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
