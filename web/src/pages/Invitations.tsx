import { useState, useEffect, useCallback } from 'react';
import { Mail, Link2, Copy, Check, Plus, Trash2, Clock, UserCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import clsx from 'clsx';

interface PendingInvite {
  id: string;
  email: string;
  role: 'member' | 'admin';
  created_at: string;
  invited_by_name?: string;
}

export default function Invitations() {
  const { activeWorkspace, inviteMemberByEmail, inviteCode, regenerateInviteCode } = useWorkspace();

  const [tab, setTab]         = useState<'email' | 'link'>('email');
  const [email, setEmail]     = useState('');
  const [role, setRole]       = useState<'member' | 'admin'>('member');
  const [sending, setSending] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'sent' | 'error'>('idle');
  const [copied, setCopied]   = useState(false);

  const [pending, setPending]   = useState<PendingInvite[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchPending = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoadingList(true);
    try {
      const token = localStorage.getItem('mdl-auth-token');
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/invitations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean; data: PendingInvite[] };
      if (data.success) setPending(data.data ?? []);
    } finally {
      setLoadingList(false);
    }
  }, [activeWorkspace?.id]);

  // Fetch on mount + active workspace change + auto-refresh every 15s
  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@') || sending || !activeWorkspace) return;
    setSending(true);
    setStatus('idle');
    try {
      await inviteMemberByEmail(email.trim(), [activeWorkspace.id], role);
      setEmail('');
      setStatus('sent');
      setTimeout(() => setStatus('idle'), 3000);
      // Refresh list after sending
      setTimeout(fetchPending, 500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    } finally {
      setSending(false);
    }
  };

  const cancelInvite = async (inviteId: string, inviteEmail: string) => {
    if (!activeWorkspace || !confirm(`Cancel invite for ${inviteEmail}?`)) return;
    const token = localStorage.getItem('mdl-auth-token');
    await fetch(`/api/workspaces/${activeWorkspace.id}/invitations/${inviteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setPending(prev => prev.filter(i => i.id !== inviteId));
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`https://mdl.cc/join?code=${inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Invitations</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">
          Invite people to join {activeWorkspace?.name ?? 'your workspace'}
        </p>
      </div>

      {/* Invite card */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <Mail className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">Invite Team Members</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">Send an invite or share a link</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-dark-100 dark:bg-dark-800 rounded-xl w-fit">
            {(['email', 'link'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                  tab === t
                    ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-white shadow-sm'
                    : 'text-dark-500 dark:text-dark-400'
                )}
              >
                {t === 'email' ? 'Invite by Email' : 'Invite by Link'}
              </button>
            ))}
          </div>

          {tab === 'email' ? (
            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="input flex-1"
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                />
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as 'member' | 'admin')}
                  className="input"
                  style={{ width: 'auto', paddingRight: '32px' }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={handleInvite} disabled={sending} className="btn btn-primary gap-1.5">
                  <Plus className="w-4 h-4" />
                  {sending ? 'Sending…' : 'Send Invite'}
                </button>
              </div>

              {status === 'sent' && (
                <p className="text-xs text-emerald-500 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Invitation sent successfully
                </p>
              )}
              {status === 'error' && (
                <p className="text-xs text-red-400">Failed to send. Please try again.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-dark-600 dark:text-dark-300">
                Share this link with your team. Anyone with this link can request to join.
              </p>
              <div className="flex items-center gap-3 p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Link2 className="w-4 h-4 shrink-0 text-dark-400" />
                  <code className="text-sm font-mono text-dark-700 dark:text-dark-300 truncate">
                    mdl.cc/join?code={inviteCode}
                  </code>
                </div>
                <button onClick={copyLink} className="btn btn-secondary btn-sm gap-1.5 shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={regenerateInviteCode}
                  className="p-2 rounded-lg hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors"
                  title="Generate new code"
                >
                  <RefreshCw className="w-4 h-4 text-dark-400" />
                </button>
              </div>
              <p className="text-xs text-dark-400">Regenerating the code will invalidate the previous link.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending invitations */}
      <div className="card">
        <div className="px-6 py-4 border-b border-dark-100 dark:border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-dark-900 dark:text-white">
              Pending <span className="text-dark-400 font-normal">({pending.length})</span>
            </h2>
          </div>
          <button
            onClick={fetchPending}
            disabled={loadingList}
            className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={clsx('w-4 h-4 text-dark-400', loadingList && 'animate-spin')} />
          </button>
        </div>

        {pending.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-dark-400">No pending invitations</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-100 dark:divide-dark-700">
            {pending.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {inv.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-900 dark:text-white">{inv.email}</p>
                    <p className="text-xs text-dark-400">
                      Invited {new Date(inv.created_at).toLocaleDateString()}
                      {inv.invited_by_name && ` · by ${inv.invited_by_name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-gray">Pending</span>
                  {inv.role === 'admin' && (
                    <span className="badge badge-blue">Admin</span>
                  )}
                  <button
                    onClick={() => cancelInvite(inv.id, inv.email)}
                    className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                    title="Cancel invitation"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active members */}
      <ActiveMembers workspaceId={activeWorkspace?.id} />
    </div>
  );
}

type Member = { id: string; user_id: string; email: string; name?: string; role: string; joined_at: string };

function ActiveMembers({ workspaceId }: { workspaceId?: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string>('member');

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const token = localStorage.getItem('mdl-auth-token');
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json() as { success: boolean; data: Member[] };
    if (d.success) {
      setMembers(d.data ?? []);
      const me = d.data?.find(m => m.user_id === user?.id);
      if (me) setMyRole(me.role);
    }
  }, [workspaceId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (memberId: string, newRole: string) => {
    const token = localStorage.getItem('mdl-auth-token');
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: newRole }),
    });
    const d = await res.json() as { success: boolean; error?: string };
    if (d.success) setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    else alert(d.error ?? 'Failed to update role');
  };

  const removeMember = async (memberId: string, memberEmail: string) => {
    if (!workspaceId || !confirm(`Remove ${memberEmail} from this workspace?`)) return;
    const token = localStorage.getItem('mdl-auth-token');
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json() as { success: boolean; error?: string };
    if (d.success) setMembers(prev => prev.filter(m => m.id !== memberId));
    else alert(d.error ?? 'Failed to remove member');
  };

  const isOwner = myRole === 'owner';

  if (members.length === 0) return null;

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-dark-100 dark:border-dark-700 flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-emerald-500" />
        <h2 className="font-semibold text-dark-900 dark:text-white">
          Members <span className="text-dark-400 font-normal">({members.length})</span>
        </h2>
      </div>
      <div className="divide-y divide-dark-100 dark:divide-dark-700">
        {members.map(m => (
          <div key={m.id} className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                m.role === 'owner' ? 'bg-violet-100 dark:bg-violet-900/30' :
                m.role === 'admin' ? 'bg-blue-100 dark:bg-blue-900/30' :
                'bg-emerald-100 dark:bg-emerald-900/30'
              )}>
                <span className={clsx(
                  'text-xs font-bold',
                  m.role === 'owner' ? 'text-violet-600 dark:text-violet-400' :
                  m.role === 'admin' ? 'text-blue-600 dark:text-blue-400' :
                  'text-emerald-600 dark:text-emerald-400'
                )}>
                  {(m.name || m.email)[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-dark-900 dark:text-white">{m.name || m.email}</p>
                <p className="text-xs text-dark-400">{m.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Role — owner sees a dropdown to change, others see a badge */}
              {isOwner && m.role !== 'owner' ? (
                <select
                  value={m.role}
                  onChange={e => changeRole(m.id, e.target.value)}
                  className="input text-xs py-1 px-2"
                  style={{ width: 'auto', fontSize: '12px', padding: '4px 8px' }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className={clsx(
                  'badge',
                  m.role === 'owner' ? 'badge-gray' :
                  m.role === 'admin' ? 'badge-blue' : 'badge-green'
                )}>
                  {m.role === 'owner' && <ShieldCheck className="w-3 h-3 inline mr-0.5" />}
                  {m.role}
                </span>
              )}
              {/* Remove button — owner/admin can remove non-owners (not themselves) */}
              {['owner', 'admin'].includes(myRole) && m.role !== 'owner' && m.user_id !== user?.id && (
                <button
                  onClick={() => removeMember(m.id, m.email)}
                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                  title="Remove member"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
