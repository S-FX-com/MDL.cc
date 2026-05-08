import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, ArrowRight, Plus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function WorkspaceEntry() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [slug, setSlug]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    const val = slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (!val) return;
    setLoading(true);
    setError('');

    try {
      const res  = await fetch(`/api/workspaces/lookup?slug=${encodeURIComponent(val)}`);
      const data = await res.json() as { success: boolean; found: boolean; workspace?: { name: string; slug: string } };

      if (data.found && data.workspace) {
        sessionStorage.setItem('mdl-workspace-slug', data.workspace.slug);
        sessionStorage.setItem('mdl-workspace-name', data.workspace.name);
        navigate('/login');
      } else {
        setError(`No workspace found for "${val}". Check the URL or create a new one.`);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: isDark ? '#010619' : '#f8f9fa' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center ring-accent"
            style={{ background: 'linear-gradient(135deg, #0c1830 0%, #1c45cf 100%)' }}
          >
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-semibold text-2xl tracking-tight" style={{ color: isDark ? '#f0f2f5' : '#0c1830' }}>
            MDL<span style={{ color: '#00c7f9' }}>.cc</span>
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-xl"
          style={{
            background: isDark ? '#1e2f47' : '#ffffff',
            border: isDark ? '1px solid #1e2f47' : '1px solid #e5e7eb',
          }}
        >
          <h1 className="text-xl font-semibold mb-1" style={{ color: isDark ? '#f8f9fa' : '#0c1830' }}>
            Sign in to your workspace
          </h1>
          <p className="text-sm mb-6" style={{ color: '#8e8e93' }}>
            Enter your workspace URL to continue
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#fde8eb', color: '#dc3545' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleContinue} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                Workspace URL
              </label>
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{
                  border: isDark ? '1.5px solid #1e2f47' : '1.5px solid #e5e7eb',
                  background: isDark ? '#010619' : '#f8f9fa',
                }}
              >
                <span className="px-3 py-2.5 text-sm shrink-0" style={{ color: '#8e8e93' }}>
                  mdl.cc/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="your-workspace"
                  autoFocus
                  className="flex-1 bg-transparent outline-none py-2.5 pr-3 text-sm"
                  style={{ color: isDark ? '#f0f2f5' : '#0c1830' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !slug.trim()}
              className="btn btn-primary btn-lg w-full gap-2"
            >
              {loading ? 'Looking up…' : 'Continue'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        {/* Create new workspace */}
        <div
          className="mt-4 rounded-2xl p-5"
          style={{
            background: isDark ? '#1e2f47' : '#ffffff',
            border: isDark ? '1px solid #1e2f47' : '1px solid #e5e7eb',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: isDark ? '#f0f2f5' : '#0c1830' }}>
                New to MDL.cc?
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#8e8e93' }}>
                Create a workspace for your team
              </p>
            </div>
            <button
              onClick={() => navigate('/register')}
              className="btn btn-secondary btn-sm gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Create workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
