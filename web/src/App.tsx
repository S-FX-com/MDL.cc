import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Links from './pages/Links';
import LinkDetail from './pages/LinkDetail';
import Groups from './pages/Groups';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Invitations from './pages/Invitations';
import Login from './pages/Login';
import WorkspaceEntry from './pages/WorkspaceEntry';
import Join from './pages/Join';
import Landing from './pages/Landing';
import { useAuth } from './contexts/AuthContext';

function AuthSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#010619' }}>
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Root gate: unauthenticated visitors see the marketing landing page at "/",
// and any protected sub-path bounces them back to "/" instead of 404'ing
// into a broken Layout. Authenticated users get the app shell as before.
function RootGate() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthSpinner />;
  if (!user) {
    if (location.pathname !== '/') return <Navigate to="/" replace />;
    return <Landing />;
  }
  return <Layout />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Platform-superadmin gate. Non-superadmins are bounced to the dashboard rather
// than shown a broken page. The server enforces the same check on every
// /api/admin/* call, so this is a UX guard, not the security boundary.
function SuperadminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.is_superadmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public auth flow: workspace → login. Sign-up is invite-only via /join. */}
      <Route path="/workspace" element={<PublicRoute><WorkspaceEntry /></PublicRoute>} />
      <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register"  element={<Navigate to="/login" replace />} />
      {/* Invite acceptance — accessible logged in or out */}
      <Route path="/join" element={<Join />} />

      {/* Root: Landing for logged-out, app shell for logged-in */}
      <Route path="/" element={<RootGate />}>
        <Route index element={<Dashboard />} />
        <Route path="links" element={<Links />} />
        <Route path="links/:id" element={<LinkDetail />} />
        <Route path="groups" element={<Groups />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="invitations" element={<Invitations />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<SuperadminRoute><Admin /></SuperadminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
