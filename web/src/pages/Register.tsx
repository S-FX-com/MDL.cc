import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Link2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Register() {
  const { register } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const workspaceSlug = sessionStorage.getItem('mdl-workspace-slug') ?? undefined;
  const workspaceName = sessionStorage.getItem('mdl-workspace-name');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    setError('');
    try {
      await register(name.trim(), email.trim(), password, workspaceSlug);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: isDark ? '#0f172a' : '#f8fafc' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-xl"
        style={{
          background: isDark ? '#1e293b' : '#ffffff',
          border: isDark ? '1px solid #2d3748' : '1px solid #e5e7eb',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#1456f0' }}>
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <span
            className="font-display font-semibold text-2xl"
            style={{ color: isDark ? '#f0f0f0' : '#181e25' }}
          >
            MDL<span style={{ color: '#1456f0' }}>.cc</span>
          </span>
        </div>

        {workspaceName && (
          <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl" style={{ background: isDark ? '#0f172a' : '#f0f4ff' }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: '#1456f0' }}>
              <span className="text-white font-bold text-xs">{workspaceName[0].toUpperCase()}</span>
            </div>
            <p className="text-xs font-semibold flex-1 truncate" style={{ color: isDark ? '#f0f0f0' : '#181e25' }}>
              Joining <span style={{ color: '#1456f0' }}>{workspaceName}</span>
            </p>
            <button onClick={() => navigate('/workspace')} className="shrink-0" style={{ color: '#8e8e93' }}>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <h1
          className="text-xl font-semibold mb-1 text-center"
          style={{ color: isDark ? '#f8fafc' : '#181e25' }}
        >
          Create account
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: '#8e8e93' }}>
          {workspaceName ? `to join ${workspaceName}` : 'Get started for free'}
        </p>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{ background: '#fee2e2', color: '#dc2626' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: isDark ? '#94a3b8' : '#6b7280' }}
            >
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              required
              className="input w-full"
              style={{
                background: isDark ? '#0f172a' : '#f8fafc',
                border: isDark ? '1.5px solid #334155' : '1.5px solid #e5e7eb',
                color: isDark ? '#f0f0f0' : '#181e25',
              }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: isDark ? '#94a3b8' : '#6b7280' }}
            >
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="input w-full"
              style={{
                background: isDark ? '#0f172a' : '#f8fafc',
                border: isDark ? '1.5px solid #334155' : '1.5px solid #e5e7eb',
                color: isDark ? '#f0f0f0' : '#181e25',
              }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: isDark ? '#94a3b8' : '#6b7280' }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                className="input w-full pr-10"
                style={{
                  background: isDark ? '#0f172a' : '#f8fafc',
                  border: isDark ? '1.5px solid #334155' : '1.5px solid #e5e7eb',
                  color: isDark ? '#f0f0f0' : '#181e25',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#8e8e93' }}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
            style={{ background: '#1456f0', marginTop: '8px' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-center mt-6" style={{ color: '#8e8e93' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#1456f0', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
