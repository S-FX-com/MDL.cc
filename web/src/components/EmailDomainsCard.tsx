// Allowed email domains for a workspace. When set, users who sign in via a
// verified provider (Microsoft 365) with a matching email domain are auto-added
// as members. Public free-mail domains are blocked server-side.

import { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

interface WorkspaceDomain {
  id: string;
  workspace_id: string;
  domain: string;
  auto_join_mode: 'auto' | 'off';
  created_at: string;
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  hasAgency: boolean;
}

export default function EmailDomainsCard({ workspaceId, workspaceName, hasAgency }: Props) {
  const { token } = useAuth();
  const [domains, setDomains] = useState<WorkspaceDomain[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const load = async () => {
    if (!workspaceId || !token) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/email-domains`, { headers });
      const data = await res.json() as { success: boolean; data?: WorkspaceDomain[] };
      if (data.success && data.data) setDomains(data.data);
    } catch { /* silent */ }
  };

  useEffect(() => { load(); }, [workspaceId, token]);

  const add = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/email-domains`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ domain: input.trim() }),
      });
      const data = await res.json() as { success: boolean; data?: WorkspaceDomain; error?: string };
      if (!data.success) {
        setError(data.error || 'Failed to add domain');
        return;
      }
      setInput('');
      await load();
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this domain? Users with matching emails will no longer auto-join.')) return;
    await fetch(`/api/workspaces/${workspaceId}/email-domains/${id}`, { method: 'DELETE', headers });
    await load();
  };

  const toggle = async (d: WorkspaceDomain) => {
    const next = d.auto_join_mode === 'auto' ? 'off' : 'auto';
    await fetch(`/api/workspaces/${workspaceId}/email-domains/${d.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ auto_join_mode: next }),
    });
    await load();
  };

  return (
    <div className={clsx('card', !hasAgency && 'opacity-60 pointer-events-none select-none')}>
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-100 dark:bg-cyan-900/30">
            <Globe className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 dark:text-white">Email domains</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {hasAgency
                ? `Anyone with an email at these domains can join ${workspaceName} via Microsoft sign-in`
                : 'Requires Agency — create one above'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="yourcompany.com"
            className="input flex-1"
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button onClick={add} disabled={loading} className="btn btn-primary gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />
            {loading ? 'Adding…' : 'Add domain'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {domains.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
            No domains added yet. Add a domain to let teammates auto-join.
          </p>
        ) : (
          <div className="space-y-2">
            {domains.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 dark:border-neutral-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white">@{d.domain}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {d.auto_join_mode === 'auto' ? 'Auto-join enabled' : 'Auto-join paused'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(d)}
                    className={clsx(
                      'btn btn-sm',
                      d.auto_join_mode === 'auto' ? 'btn-secondary' : 'btn-primary'
                    )}
                  >
                    {d.auto_join_mode === 'auto' ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
