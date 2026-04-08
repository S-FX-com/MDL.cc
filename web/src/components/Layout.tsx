import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Link2,
  FolderOpen,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
  Plus,
  Users,
  ChevronDown,
  Check,
  LogOut,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import CreateLinkModal from './CreateLinkModal';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard',   href: '/',          icon: LayoutDashboard },
  { name: 'Links',       href: '/links',     icon: Link2 },
  { name: 'Groups',      href: '/groups',    icon: FolderOpen },
  { name: 'Analytics',   href: '/analytics', icon: BarChart3 },
  { name: 'Invitations', href: '/invitations', icon: Users },
  { name: 'Settings',    href: '/settings',  icon: Settings },
];

export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  const { activeWorkspace, workspaces, setActiveWorkspaceId } = useWorkspace();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [topBarUrl, setTopBarUrl]       = useState('');
  const [wsSwitcherOpen, setWsSwitcherOpen] = useState(false);
  const wsSwitcherRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || user?.email || 'Usuario';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Close workspace switcher when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wsSwitcherRef.current && !wsSwitcherRef.current.contains(e.target as Node)) {
        setWsSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const switchWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    setWsSwitcherOpen(false);
  };

  return (
    <div className="min-h-screen" style={{ background: theme === 'dark' ? '#181e25' : '#ffffff' }}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(24,30,37,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-60 flex flex-col',
          'transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          background: theme === 'dark' ? '#181e25' : '#ffffff',
          borderRight: theme === 'dark' ? '1px solid #2d3748' : '1px solid #f2f3f5',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5" style={{ borderBottom: theme === 'dark' ? '1px solid #2d3748' : '1px solid #f2f3f5' }}>
          <NavLink to="/" className="flex items-center gap-2.5 select-none">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#1456f0' }}
            >
              <Link2 className="w-4 h-4 text-white" />
            </div>
            <div className="leading-none">
              <span
                className="font-display font-semibold text-xl"
                style={{ color: theme === 'dark' ? '#f0f0f0' : '#181e25' }}
              >
                MDL
              </span>
              <span style={{ color: '#1456f0', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '1.25rem' }}>
                .cc
              </span>
            </div>
          </NavLink>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: '#8e8e93' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shorten button */}
        <div className="px-4 py-4">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="btn btn-primary btn-pill w-full"
            style={{ background: '#1456f0' }}
          >
            <Plus className="w-4 h-4" />
            Shorten Link
          </button>
        </div>

        {/* ── Workspace switcher (above Dashboard) ─────────────────────────── */}
        <div className="px-3 pb-2" ref={wsSwitcherRef}>
          <div className="relative">
            <button
              onClick={() => setWsSwitcherOpen((v) => !v)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl transition-colors text-left"
              style={{ background: theme === 'dark' ? '#1e2633' : '#f0f0f0' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = theme === 'dark' ? '#2d3748' : '#e5e7eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = theme === 'dark' ? '#1e2633' : '#f0f0f0'; }}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: '#1456f0' }}
              >
                <span className="text-white font-bold text-xs">
                  {activeWorkspace?.name?.[0]?.toUpperCase() ?? 'W'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: theme === 'dark' ? '#f0f0f0' : '#181e25' }}>
                  {activeWorkspace?.name ?? 'Workspace'}
                </p>
                <p className="text-xs" style={{ color: '#8e8e93' }}>Workspace</p>
              </div>
              <ChevronDown
                className="w-4 h-4 shrink-0 transition-transform"
                style={{
                  color: '#8e8e93',
                  transform: wsSwitcherOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {/* Dropdown */}
            {wsSwitcherOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1 rounded-xl py-1 shadow-xl z-50"
                style={{
                  background: theme === 'dark' ? '#1e2633' : '#ffffff',
                  border: theme === 'dark' ? '1px solid #2d3748' : '1px solid #e5e7eb',
                }}
              >
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => switchWorkspace(ws.id)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
                    onMouseEnter={(e) => { e.currentTarget.style.background = theme === 'dark' ? '#2d3748' : '#f0f0f0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: '#1456f0' }}
                    >
                      <span className="text-white font-bold" style={{ fontSize: '10px' }}>
                        {ws.name[0].toUpperCase()}
                      </span>
                    </div>
                    <span
                      className="text-xs font-medium flex-1 truncate"
                      style={{ color: theme === 'dark' ? '#f0f0f0' : '#181e25' }}
                    >
                      {ws.name}
                    </span>
                    {ws.id === activeWorkspace?.id && (
                      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#1456f0' }} />
                    )}
                  </button>
                ))}
                <div
                  className="mx-3 my-1"
                  style={{ borderTop: theme === 'dark' ? '1px solid #2d3748' : '1px solid #f2f3f5' }}
                />
                <button
                  onClick={() => { setWsSwitcherOpen(false); setSidebarOpen(false); navigate('/settings'); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
                  onMouseEnter={(e) => { e.currentTarget.style.background = theme === 'dark' ? '#2d3748' : '#f0f0f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Settings className="w-3.5 h-3.5 shrink-0" style={{ color: '#8e8e93' }} />
                  <span className="text-xs" style={{ color: '#8e8e93' }}>Manage Workspaces</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: user display + theme toggle */}
        <div
          className="p-4 space-y-3"
          style={{ borderTop: theme === 'dark' ? '1px solid #2d3748' : '1px solid #f2f3f5' }}
        >
          {/* User display + logout */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setSidebarOpen(false); navigate('/settings'); }}
              className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl transition-colors text-left"
              onMouseEnter={(e) => { e.currentTarget.style.background = theme === 'dark' ? '#2d3748' : '#f0f0f0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs"
                style={{ background: '#6366f1' }}
              >
                {displayName[0]?.toUpperCase() ?? 'U'}
              </div>
              <span
                className="text-xs font-semibold truncate"
                style={{ color: theme === 'dark' ? '#f0f0f0' : '#181e25' }}
              >
                {displayName}
              </span>
            </button>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-2 rounded-lg transition-colors shrink-0"
              style={{ color: '#8e8e93' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = theme === 'dark' ? '#2d3748' : '#f0f0f0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors"
            style={{ color: '#8e8e93' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = theme === 'dark' ? '#2d3748' : '#f0f0f0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {theme === 'dark' ? (
              <><Sun className="w-4 h-4 text-yellow-400" /><span className="text-xs font-medium">Light Mode</span></>
            ) : (
              <><Moon className="w-4 h-4" /><span className="text-xs font-medium">Dark Mode</span></>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 h-16"
          style={{
            background: theme === 'dark' ? 'rgba(24, 30, 37, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: theme === 'dark' ? '1px solid #2d3748' : '1px solid #f2f3f5',
          }}
        >
          <div className="flex items-center justify-between h-full px-5 gap-4">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg transition-colors"
              style={{ color: '#8e8e93' }}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick-create URL input */}
            <div className="hidden md:flex flex-1 max-w-lg">
              <div className="relative w-full">
                <input
                  type="text"
                  value={topBarUrl}
                  onChange={(e) => setTopBarUrl(e.target.value)}
                  placeholder="Paste a long URL to shorten…"
                  className="input"
                  style={{
                    paddingRight: '100px',
                    borderRadius: '9999px',
                    background: theme === 'dark' ? '#222831' : '#f8f9fa',
                    border: theme === 'dark' ? '1.5px solid #334155' : '1.5px solid #e5e7eb',
                    fontSize: '13px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && topBarUrl.trim()) setCreateModalOpen(true);
                  }}
                />
                <button
                  onClick={() => { if (topBarUrl.trim()) setCreateModalOpen(true); }}
                  className="btn btn-primary btn-pill btn-sm"
                  style={{
                    position: 'absolute',
                    right: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#1456f0',
                    fontSize: '13px',
                    padding: '6px 16px',
                  }}
                >
                  Shorten
                </button>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl transition-colors"
                title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                style={{ color: '#8e8e93' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = theme === 'dark' ? '#2d3748' : '#f0f0f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-5 lg:p-7">
          <Outlet />
        </main>
      </div>

      {/* Modal */}
      <CreateLinkModal
        open={createModalOpen}
        onClose={() => { setCreateModalOpen(false); setTopBarUrl(''); }}
        initialUrl={topBarUrl}
      />
    </div>
  );
}
