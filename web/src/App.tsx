import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Links from './pages/Links';
import LinkDetail from './pages/LinkDetail';
import Groups from './pages/Groups';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Invitations from './pages/Invitations';
import Login from './pages/Login';
import Register from './pages/Register';
import WorkspaceEntry from './pages/WorkspaceEntry';
import Join from './pages/Join';
import { useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#010619' }}>
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/workspace" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public auth flow: workspace → login → register */}
      <Route path="/workspace" element={<PublicRoute><WorkspaceEntry /></PublicRoute>} />
      <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register"  element={<PublicRoute><Register /></PublicRoute>} />
      {/* Invite acceptance — accessible logged in or out */}
      <Route path="/join" element={<Join />} />

      {/* Protected app */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="links" element={<Links />} />
        <Route path="links/:id" element={<LinkDetail />} />
        <Route path="groups" element={<Groups />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="invitations" element={<Invitations />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
