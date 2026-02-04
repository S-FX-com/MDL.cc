import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Links from './pages/Links';
import LinkDetail from './pages/LinkDetail';
import Groups from './pages/Groups';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="links" element={<Links />} />
        <Route path="links/:id" element={<LinkDetail />} />
        <Route path="groups" element={<Groups />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
