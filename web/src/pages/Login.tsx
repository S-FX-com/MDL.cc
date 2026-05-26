import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getFeatures } from '../lib/features';

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
  const [msSso, setMsSso]       = useState(false);

  useEffect(() => {
    getFeatures().then(f => setMsSso(f.microsoft_sso));
    // SSO redirect dropped an error onto the URL fragment — surface it.
    if (window.location.hash.includes('error=')) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const e = params.get('error');
      if (e) {
        setError(decodeURIComponent(e));
        const url = new URL(window.location.href); url.hash = '';
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

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
      style={{ background: isDark ? '#010619' : '#f8f9fa' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-xl"
        style={{
          background: isDark ? '#1e2f47' : '#ffffff',
          border: isDark ? '1px solid #1e2f47' : '1px solid #e5e7eb',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0c1830 0%, #1c45cf 100%)' }}
          >
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <span
            className="font-display font-semibold text-2xl tracking-tight"
            style={{ color: isDark ? '#f0f2f5' : '#0c1830' }}
          >
            MDL<span style={{ color: '#00c7f9' }}>.cc</span>
          </span>
        </div>

        {workspaceName && (
          <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl" style={{ background: isDark ? '#010619' : '#eef3ff' }}>
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #5b8ffe 0%, #00c7f9 100%)' }}
            >
              <span className="text-white font-bold text-xs">{workspaceName[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: isDark ? '#f0f2f5' : '#0c1830' }}>{workspaceName}</p>
              <p className="text-xs" style={{ color: '#8e8e93' }}>mdl.cc/{workspaceSlug}</p>
            </div>
            <button onClick={() => navigate('/workspace')} className="text-xs font-semibold shrink-0" style={{ color: '#5b8ffe' }}>Change</button>
          </div>
        )}
        <h1
          className="text-xl font-semibold mb-1 text-center"
          style={{ color: isDark ? '#f8f9fa' : '#0c1830' }}
        >
          Sign in
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: '#8e8e93' }}>
          {workspaceName ? `to ${workspaceName}` : 'Welcome back'}
        </p>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{ background: '#fde8eb', color: '#dc3545' }}
          >
            {error}
          </div>
        )}

        {msSso && (
          <>
            <a
              href={`/api/auth/microsoft/start?next=${encodeURIComponent('/')}${workspaceSlug ? `&workspace=${encodeURIComponent(workspaceSlug)}` : ''}`}
              className="btn w-full mb-4 flex items-center justify-center gap-2.5 font-medium"
              style={{
                background: isDark ? '#0c1830' : '#ffffff',
                border: isDark ? '1.5px solid #1e2f47' : '1.5px solid #e5e7eb',
                color: isDark ? '#f0f2f5' : '#0c1830',
                padding: '10px 16px',
                borderRadius: '12px',
              }}
            >
              {/* Microsoft 4-square logo */}
              <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
                <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
                <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
                <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Continue with Microsoft
            </a>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: isDark ? '#1e2f47' : '#e5e7eb' }} />
              <span className="text-xs" style={{ color: '#8e8e93' }}>or</span>
              <div className="flex-1 h-px" style={{ background: isDark ? '#1e2f47' : '#e5e7eb' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
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
                background: isDark ? '#010619' : '#f8f9fa',
                border: isDark ? '1.5px solid #1e2f47' : '1.5px solid #e5e7eb',
                color: isDark ? '#f0f2f5' : '#0c1830',
              }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
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
                  background: isDark ? '#010619' : '#f8f9fa',
                  border: isDark ? '1.5px solid #1e2f47' : '1.5px solid #e5e7eb',
                  color: isDark ? '#f0f2f5' : '#0c1830',
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
            className="btn btn-primary btn-lg w-full"
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-center mt-6" style={{ color: '#8e8e93' }}>
          Sign-up is by invitation only.
        </p>
      </div>
    </div>
  );
}
