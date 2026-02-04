import { Outlet, NavLink } from 'react-router-dom';
import { useState } from 'react';
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
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import CreateLinkModal from './CreateLinkModal';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Links', href: '/links', icon: Link2 },
  { name: 'Groups', href: '/groups', icon: FolderOpen },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-dark-900 border-r border-dark-200 dark:border-dark-800',
          'transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-dark-200 dark:border-dark-800">
            <NavLink to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-xl text-dark-900 dark:text-white">MDL</span>
                <span className="text-primary-500">.cc</span>
              </div>
            </NavLink>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Create Link Button */}
          <div className="p-4">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="btn btn-primary w-full"
            >
              <Plus className="w-4 h-4" />
              Shorten Link
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) =>
                  clsx('nav-item', isActive && 'nav-item-active')
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* Theme Toggle & Tagline */}
          <div className="p-4 border-t border-dark-200 dark:border-dark-800">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm text-dark-600 dark:text-dark-400">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5 text-dark-500" />
                  <span className="text-sm text-dark-600 dark:text-dark-400">Dark Mode</span>
                </>
              )}
            </button>
            <p className="mt-3 px-3 text-xs text-dark-400 dark:text-dark-500">
              The middle-point between you and your audience.
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-dark-900/80 backdrop-blur-md border-b border-dark-200 dark:border-dark-800">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick create input - desktop */}
            <div className="hidden md:flex flex-1 max-w-xl mx-4">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Paste your long URL here..."
                  className="input pr-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      setCreateModalOpen(true);
                    }
                  }}
                />
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-primary btn-sm"
                >
                  Shorten
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-dark-500" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Create Link Modal */}
      <CreateLinkModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  );
}
