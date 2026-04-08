import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Link2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Login() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const workspaceName = sessionStorage.getItem('mdl-workspace-name');
  const workspaceSlug = sessionStorage.getItem('mdl-workspace-slug');

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
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
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: isDark ? '#f0f0f0' : '#181e25' }}>{workspaceName}</p>
              <p className="text-xs" style={{ color: '#8e8e93' }}>mdl.cc/{workspaceSlug}</p>
            </div>
            <button onClick={() => navigate('/workspace')} className="text-xs shrink-0" style={{ color: '#1456f0' }}>Change</button>
          </div>
        )}
        <h1
          className="text-xl font-semibold mb-1 text-center"
          style={{ color: isDark ? '#f8fafc' : '#181e25' }}
        >
          Sign in
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: '#8e8e93' }}>
          {workspaceName ? `to ${workspaceName}` : 'Welcome back'}
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
                placeholder="••••••••"
                required
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-center mt-6" style={{ color: '#8e8e93' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#1456f0', fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
