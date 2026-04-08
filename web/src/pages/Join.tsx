import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link2, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTheme } from '../contexts/ThemeContext';

interface InviteInfo {
  email: string;
  workspace_name: string;
  workspace_slug: string;
  workspace_id: string;
}

type Mode = 'loading' | 'invalid' | 'login' | 'register' | 'accepting' | 'done';

export default function Join() {
  const [params] = useSearchParams();
  const code = params.get('code') ?? '';
  const { login, register, user } = useAuth();
  const { reloadWorkspaces } = useWorkspace();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [mode, setMode]         = useState<Mode>('loading');
  const [invite, setInvite]     = useState<InviteInfo | null>(null);
  const [error, setError]       = useState('');
  const [invalidMsg, setInvalidMsg] = useState('');

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!code) { setInvalidMsg('No invite code provided.'); setMode('invalid'); return; }
    fetch(`/api/invites/validate?code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then((data: { success: boolean; valid?: boolean; error?: string; invitation?: InviteInfo }) => {
        if (!data.valid) { setInvalidMsg(data.error || 'Invalid invitation.'); setMode('invalid'); return; }
        setInvite(data.invitation!);
        setEmail(data.invitation!.email);
        if (user) { acceptNow(data.invitation!); return; }
        setMode('login');
      })
      .catch(() => { setInvalidMsg('Could not validate invitation.'); setMode('invalid'); });
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  async function acceptNow(inv: InviteInfo) {
    setMode('accepting');
    try {
      const t = localStorage.getItem('mdl-auth-token');
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!data.success) throw new Error(data.error);
      await reloadWorkspaces();
      sessionStorage.setItem('mdl-workspace-slug', inv.workspace_slug);
      setMode('done');
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept invitation');
      setMode('login');
    }
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await login(email, password);
      await acceptNow(invite!);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await register(name, email, password, invite!.workspace_slug);
      await acceptNow(invite!);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
      setSubmitting(false);
    }
  };

  const bgColor   = isDark ? '#0f172a' : '#f8fafc';
  const cardColor = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '1px solid #2d3748' : '1px solid #e5e7eb';
  const textPrimary = isDark ? '#f0f0f0' : '#181e25';
  const textMuted = '#8e8e93';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';
  const inputBorder = isDark ? '1.5px solid #334155' : '1.5px solid #e5e7eb';
  const labelColor = isDark ? '#94a3b8' : '#6b7280';
  const badgeBg = isDark ? '#0f172a' : '#f0f4ff';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
        background: bgColor,
      }}
    >
      <div style={{ width: '100%', maxWidth: '384px' }}>
        <div
          style={{
            background: cardColor,
            border: cardBorder,
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', justifyContent: 'center' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#1456f0', flexShrink: 0,
            }}>
              <Link2 style={{ width: '20px', height: '20px', color: '#ffffff' }} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '24px', color: textPrimary }}>
              MDL<span style={{ color: '#1456f0' }}>.cc</span>
            </span>
          </div>

          {/* Loading */}
          {mode === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
              <Loader2 style={{ width: '32px', height: '32px', color: '#1456f0', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '14px', color: textMuted }}>Validating invitation…</p>
            </div>
          )}

          {/* Invalid */}
          {mode === 'invalid' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0', textAlign: 'center' }}>
              <XCircle style={{ width: '40px', height: '40px', color: '#f87171' }} />
              <h2 style={{ fontWeight: 600, fontSize: '18px', color: textPrimary }}>Invalid Invitation</h2>
              <p style={{ fontSize: '14px', color: textMuted }}>{invalidMsg}</p>
            </div>
          )}

          {/* Accepting */}
          {mode === 'accepting' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0', textAlign: 'center' }}>
              <Loader2 style={{ width: '32px', height: '32px', color: '#1456f0', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '14px', color: textMuted }}>Joining workspace…</p>
            </div>
          )}

          {/* Done */}
          {mode === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0', textAlign: 'center' }}>
              <CheckCircle2 style={{ width: '40px', height: '40px', color: '#34d399' }} />
              <h2 style={{ fontWeight: 600, fontSize: '18px', color: textPrimary }}>
                Welcome to {invite?.workspace_name}!
              </h2>
              <p style={{ fontSize: '14px', color: textMuted }}>Redirecting to your workspace…</p>
            </div>
          )}

          {/* Login / Register */}
          {(mode === 'login' || mode === 'register') && invite && (
            <>
              {/* Workspace badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '24px', padding: '10px 12px',
                borderRadius: '12px', background: badgeBg,
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#1456f0', flexShrink: 0,
                }}>
                  <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '13px' }}>
                    {invite.workspace_name[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: textPrimary }}>{invite.workspace_name}</p>
                  <p style={{ fontSize: '12px', color: textMuted }}>You've been invited to join</p>
                </div>
              </div>

              {/* Tabs */}
              <div style={{
                display: 'flex', gap: '4px', padding: '4px',
                borderRadius: '12px', marginBottom: '20px',
                background: isDark ? '#0f172a' : '#f0f0f0',
              }}>
                {(['login', 'register'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setMode(t)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: '8px',
                      fontSize: '14px', fontWeight: 500,
                      border: 'none', cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: mode === t ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                      color: mode === t ? textPrimary : textMuted,
                      boxShadow: mode === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {t === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              {error && (
                <div style={{
                  marginBottom: '16px', padding: '12px 16px',
                  borderRadius: '12px', fontSize: '14px',
                  background: '#fee2e2', color: '#dc2626',
                }}>
                  {error}
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: labelColor }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      className="input w-full"
                      style={{ background: inputBg, border: inputBorder, color: textPrimary, opacity: 0.6, cursor: 'not-allowed' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: labelColor }}>
                      Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="input w-full"
                        style={{ background: inputBg, border: inputBorder, color: textPrimary, paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        style={{
                          position: 'absolute', right: '12px', top: '50%',
                          transform: 'translateY(-50%)', background: 'none',
                          border: 'none', cursor: 'pointer', color: textMuted,
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {showPw ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary w-full"
                    style={{ background: '#1456f0', marginTop: '4px' }}
                  >
                    {submitting ? 'Signing in…' : 'Sign in & Join'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: labelColor }}>
                      Full name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      placeholder="Your name"
                      className="input w-full"
                      style={{ background: inputBg, border: inputBorder, color: textPrimary }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: labelColor }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      className="input w-full"
                      style={{ background: inputBg, border: inputBorder, color: textPrimary, opacity: 0.6, cursor: 'not-allowed' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: labelColor }}>
                      Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Minimum 6 characters"
                        className="input w-full"
                        style={{ background: inputBg, border: inputBorder, color: textPrimary, paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        style={{
                          position: 'absolute', right: '12px', top: '50%',
                          transform: 'translateY(-50%)', background: 'none',
                          border: 'none', cursor: 'pointer', color: textMuted,
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {showPw ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary w-full"
                    style={{ background: '#1456f0', marginTop: '4px' }}
                  >
                    {submitting ? 'Creating account…' : 'Create account & Join'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
