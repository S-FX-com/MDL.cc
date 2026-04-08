import { useState } from 'react';
import { Mail, Link2, Copy, Check, RefreshCw, Plus, Trash2, Clock, UserCheck } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

export default function Invitations() {
  useAuth();
  const {
    activeWorkspace, teamMembers,
    inviteCode, inviteMemberByEmail, removeMember, regenerateInviteCode,
  } = useWorkspace();

  const [tab, setTab]         = useState<'email' | 'link'>('email');
  const [email, setEmail]     = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'sent' | 'error'>('idle');
  const [copied, setCopied]   = useState(false);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@') || sending) return;
    setSending(true);
    setStatus('idle');
    try {
      await inviteMemberByEmail(email.trim(), [activeWorkspace?.id ?? ''].filter(Boolean));
      setEmail('');
      setStatus('sent');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`https://mdl.cc/join?code=${inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pending = teamMembers.filter(m => m.status === 'pending');
  const active  = teamMembers.filter(m => m.status === 'active');

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
      {pending.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-dark-100 dark:border-dark-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-dark-900 dark:text-white">
              Pending <span className="text-dark-400 font-normal">({pending.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-dark-100 dark:divide-dark-700">
            {pending.map(m => (
              <div key={m.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {m.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-900 dark:text-white">{m.email}</p>
                    <p className="text-xs text-dark-400">
                      Invited {new Date(m.invitedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-gray">Pending</span>
                  <button
                    onClick={() => { if (confirm(`Cancel invite for ${m.email}?`)) removeMember(m.id); }}
                    className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active members */}
      {active.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-dark-100 dark:border-dark-700 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            <h2 className="font-semibold text-dark-900 dark:text-white">
              Members <span className="text-dark-400 font-normal">({active.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-dark-100 dark:divide-dark-700">
            {active.map(m => (
              <div key={m.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {(m.name || m.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-900 dark:text-white">{m.name || m.email}</p>
                    <p className="text-xs text-dark-400">{m.email}</p>
                  </div>
                </div>
                <span className="badge badge-green">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {teamMembers.length === 0 && (
        <div className="card p-12 text-center">
          <Mail className="w-10 h-10 mx-auto mb-3 text-dark-300 dark:text-dark-600" />
          <p className="font-medium text-dark-700 dark:text-dark-300">No invitations yet</p>
          <p className="text-sm text-dark-400 mt-1">Invite your first team member above</p>
        </div>
      )}
    </div>
  );
}
