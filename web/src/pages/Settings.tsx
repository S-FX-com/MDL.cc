import { useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Globe,
  Key,
  Shield,
  Code,
  ExternalLink,
  User,
  Building2,
  Users,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';

type ThemeOption = 'light' | 'dark' | 'system';

// ---------------------------------------------------------------------------
// Workspace / profile data persisted in localStorage
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
  displayName: 'mdl-display-name',
  workspaceName: 'mdl-workspace-name',
  workspaces: 'mdl-workspaces',
};

function getStoredWorkspaces(): { id: string; name: string; role: string }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.workspaces);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [{ id: 'default', name: localStorage.getItem(STORAGE_KEYS.workspaceName) || 'My Workspace', role: 'Admin' }];
}

function saveWorkspaces(ws: { id: string; name: string; role: string }[]) {
  localStorage.setItem(STORAGE_KEYS.workspaces, JSON.stringify(ws));
}

// ---------------------------------------------------------------------------

export default function Settings() {
  const { setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>(
    (localStorage.getItem('mdl-theme') as ThemeOption) || 'system'
  );

  // Profile
  const [displayName, setDisplayName] = useState(localStorage.getItem(STORAGE_KEYS.displayName) || '');
  const [displayNameSaved, setDisplayNameSaved] = useState(false);

  // Workspace editing
  const [workspaces, setWorkspaces] = useState(getStoredWorkspaces);
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [editingWsName, setEditingWsName] = useState('');
  const [showNewWsForm, setShowNewWsForm] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  const handleThemeChange = (newTheme: ThemeOption) => {
    setSelectedTheme(newTheme);
    if (newTheme === 'system') {
      localStorage.removeItem('mdl-theme');
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(systemTheme);
    } else {
      setTheme(newTheme);
    }
  };

  const saveDisplayName = () => {
    localStorage.setItem(STORAGE_KEYS.displayName, displayName);
    setDisplayNameSaved(true);
    setTimeout(() => setDisplayNameSaved(false), 2000);
  };

  const startEditWs = (ws: { id: string; name: string }) => {
    setEditingWsId(ws.id);
    setEditingWsName(ws.name);
  };

  const saveWsName = () => {
    if (!editingWsName.trim()) return;
    const updated = workspaces.map((w) =>
      w.id === editingWsId ? { ...w, name: editingWsName.trim() } : w
    );
    setWorkspaces(updated);
    saveWorkspaces(updated);
    // Also update the legacy key for the sidebar
    const current = updated.find((w) => w.id === editingWsId);
    if (current) localStorage.setItem(STORAGE_KEYS.workspaceName, current.name);
    setEditingWsId(null);
  };

  const cancelEditWs = () => setEditingWsId(null);

  const createWorkspace = () => {
    if (!newWsName.trim()) return;
    const newWs = { id: crypto.randomUUID(), name: newWsName.trim(), role: 'Admin' };
    const updated = [...workspaces, newWs];
    setWorkspaces(updated);
    saveWorkspaces(updated);
    setNewWsName('');
    setShowNewWsForm(false);
  };

  const deleteWorkspace = (id: string) => {
    if (workspaces.length === 1) return; // keep at least one
    if (!confirm('Remove this workspace?')) return;
    const updated = workspaces.filter((w) => w.id !== id);
    setWorkspaces(updated);
    saveWorkspaces(updated);
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
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Settings</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">Customize your MDL.cc experience</p>
      </div>

      {/* ── Profile ─────────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">Profile</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">Your personal display information</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
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
                {displayNameSaved ? <Check className="w-4 h-4" /> : null}
                {displayNameSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Workspaces ───────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="font-semibold text-dark-900 dark:text-white">Workspaces</h2>
                <p className="text-sm text-dark-500 dark:text-dark-400">
                  Manage your workspaces and agency
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNewWsForm(!showNewWsForm)}
              className="btn btn-secondary btn-sm gap-1"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </button>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {/* New workspace form */}
          {showNewWsForm && (
            <div className="flex gap-2 p-3 rounded-xl border border-dashed border-dark-300 dark:border-dark-600">
              <input
                type="text"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="Workspace name"
                className="input flex-1 py-1.5"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createWorkspace();
                  if (e.key === 'Escape') setShowNewWsForm(false);
                }}
              />
              <button onClick={createWorkspace} className="btn btn-primary btn-sm">Create</button>
              <button onClick={() => setShowNewWsForm(false)} className="btn btn-secondary btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center justify-between p-4 bg-dark-50 dark:bg-dark-800 rounded-xl"
            >
              {editingWsId === ws.id ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <input
                    type="text"
                    value={editingWsName}
                    onChange={(e) => setEditingWsName(e.target.value)}
                    className="input flex-1 py-1.5"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveWsName();
                      if (e.key === 'Escape') cancelEditWs();
                    }}
                  />
                  <button onClick={saveWsName} className="btn btn-primary btn-sm">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelEditWs} className="btn btn-secondary btn-sm">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">{ws.name[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-medium text-dark-900 dark:text-white">{ws.name}</p>
                    <p className="text-xs text-dark-500 dark:text-dark-400">Role: {ws.role}</p>
                  </div>
                </div>
              )}

              {editingWsId !== ws.id && (
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary">{ws.role}</span>
                  <button
                    onClick={() => startEditWs(ws)}
                    className="p-1.5 rounded hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors"
                    title="Rename workspace"
                  >
                    <Edit2 className="w-4 h-4 text-dark-400" />
                  </button>
                  {workspaces.length > 1 && (
                    <button
                      onClick={() => deleteWorkspace(ws.id)}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                      title="Remove workspace"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Team Members ─────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">Team Members</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                People with access to this workspace
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm text-dark-500 dark:text-dark-400">
            Invite team members to collaborate in your workspace.
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="colleague@example.com"
              className="input flex-1"
            />
            <button className="btn btn-secondary gap-1">
              <Plus className="w-4 h-4" />
              Invite
            </button>
          </div>
          <p className="text-xs text-dark-400 dark:text-dark-500">
            Invitations are managed in the Invitations page.
          </p>
        </div>
      </div>

      {/* ── Appearance ───────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Sun className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">Appearance</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                Customize how MDL.cc looks on your device
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
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
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                )}
              >
                <option.icon
                  className={clsx(
                    'w-6 h-6',
                    selectedTheme === option.value ? 'text-primary-500' : 'text-dark-400'
                  )}
                />
                <span
                  className={clsx(
                    'text-sm font-medium',
                    selectedTheme === option.value
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-dark-600 dark:text-dark-400'
                  )}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-sm text-dark-500 dark:text-dark-400 mt-3">
            {selectedTheme === 'system'
              ? 'MDL.cc will automatically match your system preference.'
              : `MDL.cc is set to ${selectedTheme} mode.`}
          </p>
        </div>
      </div>

      {/* ── Default Domain ───────────────────────────────────────────────────── */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">Default Domain</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                Choose your default short link domain
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <p className="font-medium text-dark-900 dark:text-white">mdl.cc</p>
                <p className="text-xs text-dark-500 dark:text-dark-400">Default domain</p>
              </div>
            </div>
            <span className="badge badge-primary">Active</span>
          </div>
          <p className="text-sm text-dark-500 dark:text-dark-400 mt-3">
            Want to use your own domain? Contact us to set up branded links.
          </p>
        </div>
      </div>

      {/* ── API Access ───────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">API Access</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                Integrate MDL.cc with your applications
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
            <p className="text-sm text-dark-500 dark:text-dark-400 mb-2">API Endpoint</p>
            <code className="text-sm font-mono text-dark-900 dark:text-white">https://mdl.cc/api</code>
          </div>
          <div>
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-3">
              Use our REST API to create and manage links programmatically.
            </p>
            <button className="btn btn-secondary">
              <Code className="w-4 h-4" />
              View API Documentation
            </button>
          </div>
        </div>
      </div>

      {/* ── About ────────────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">About MDL.cc</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                The middle-point between you and your audience
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Version</p>
              <p className="font-medium text-dark-900 dark:text-white">1.0.0</p>
            </div>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Platform</p>
              <p className="font-medium text-dark-900 dark:text-white">Cloudflare Workers</p>
            </div>
          </div>
          <div className="pt-4 border-t border-dark-100 dark:border-dark-700">
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-4">
              MDL.cc is built on Cloudflare's global edge network for maximum speed and reliability.
            </p>
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
