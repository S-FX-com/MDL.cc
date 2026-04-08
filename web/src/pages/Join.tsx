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

type Mode = 'loading' | 'invalid' | 'signin' | 'register' | 'accepting' | 'done';

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
      .then((data: { success: boolean; valid?: boolean; user_exists?: boolean; error?: string; invitation?: InviteInfo }) => {
        if (!data.valid) { setInvalidMsg(data.error || 'Invalid invitation.'); setMode('invalid'); return; }
        setInvite(data.invitation!);
        setEmail(data.invitation!.email);
        if (user) { acceptNow(data.invitation!); return; }
        // Auto-detect: if they already have an account → sign in; otherwise → register
        setMode(data.user_exists ? 'signin' : 'register');
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
      setMode('signin');
    }
  }

  const handleSignIn = async (e: FormEvent) => {
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

  // ── Style tokens ──────────────────────────────────────────────────────────
  const bgColor     = isDark ? '#0f172a' : '#f8fafc';
  const cardColor   = isDark ? '#1e293b' : '#ffffff';
  const cardBorder  = isDark ? '1px solid #2d3748' : '1px solid #e5e7eb';
  const textPrimary = isDark ? '#f0f0f0' : '#181e25';
  const textMuted   = '#8e8e93';
  const inputBg     = isDark ? '#0f172a' : '#f8fafc';
  const inputBorder = isDark ? '1.5px solid #334155' : '1.5px solid #e5e7eb';
  const labelColor  = isDark ? '#94a3b8' : '#6b7280';
  const badgeBg     = isDark ? '#0f172a' : '#f0f4ff';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 16px', borderRadius: '10px',
    border: inputBorder, background: inputBg, color: textPrimary,
    fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 500,
    marginBottom: '6px', color: labelColor,
  };
  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '11px 20px', borderRadius: '8px',
    background: '#1456f0', color: '#ffffff', border: 'none',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif', marginTop: '8px',
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '0 16px', background: bgColor,
    }}>
      <div style={{ width: '100%', maxWidth: '384px' }}>
        <div style={{
          background: cardColor, border: cardBorder, borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px', justifyContent: 'center' }}>
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

          {/* ── Loading ── */}
          {mode === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px 0' }}>
              <Loader2 style={{ width: '32px', height: '32px', color: '#1456f0', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '14px', color: textMuted }}>Validating invitation…</p>
            </div>
          )}

          {/* ── Invalid ── */}
          {mode === 'invalid' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px 0', textAlign: 'center' }}>
              <XCircle style={{ width: '40px', height: '40px', color: '#f87171' }} />
              <h2 style={{ fontWeight: 600, fontSize: '18px', color: textPrimary, margin: 0 }}>Invalid Invitation</h2>
              <p style={{ fontSize: '14px', color: textMuted, margin: 0 }}>{invalidMsg}</p>
            </div>
          )}

          {/* ── Accepting ── */}
          {mode === 'accepting' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px 0', textAlign: 'center' }}>
              <Loader2 style={{ width: '32px', height: '32px', color: '#1456f0', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '14px', color: textMuted }}>Joining workspace…</p>
            </div>
          )}

          {/* ── Done ── */}
          {mode === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px 0', textAlign: 'center' }}>
              <CheckCircle2 style={{ width: '40px', height: '40px', color: '#34d399' }} />
              <h2 style={{ fontWeight: 600, fontSize: '18px', color: textPrimary, margin: 0 }}>
                Welcome to {invite?.workspace_name}!
              </h2>
              <p style={{ fontSize: '14px', color: textMuted, margin: 0 }}>Redirecting to your workspace…</p>
            </div>
          )}

          {/* ── Sign in (existing user) ── */}
          {mode === 'signin' && invite && (
            <>
              {/* Workspace badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '20px', padding: '10px 14px',
                borderRadius: '12px', background: badgeBg,
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#1456f0',
                }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>
                    {invite.workspace_name[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: textPrimary }}>{invite.workspace_name}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>You've been invited to join</p>
                </div>
              </div>

              <h1 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600, color: textPrimary }}>Sign in to accept</h1>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: textMuted }}>
                Your account already exists. Sign in to join this workspace.
              </p>

              {error && (
                <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#fee2e2', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSignIn}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingRight: '40px' }}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: textMuted,
                      display: 'flex', alignItems: 'center', padding: 0,
                    }}>
                      {showPw ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Signing in…' : 'Sign in & Join'}
                </button>
              </form>
            </>
          )}

          {/* ── Register (new user) ── */}
          {mode === 'register' && invite && (
            <>
              {/* Workspace badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '20px', padding: '10px 14px',
                borderRadius: '12px', background: badgeBg,
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#1456f0',
                }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>
                    {invite.workspace_name[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: textPrimary }}>{invite.workspace_name}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>You've been invited to join</p>
                </div>
              </div>

              <h1 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600, color: textPrimary }}>Create your account</h1>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: textMuted }}>
                Set a password to activate your account and join this workspace.
              </p>

              {error && (
                <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#fee2e2', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Your name"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      style={{ ...inputStyle, paddingRight: '40px' }}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: textMuted,
                      display: 'flex', alignItems: 'center', padding: 0,
                    }}>
                      {showPw ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Creating account…' : 'Create account & Join'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
