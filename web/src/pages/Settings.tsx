import { useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Globe,
  Key,
  Bell,
  Shield,
  Code,
  ExternalLink,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';

type ThemeOption = 'light' | 'dark' | 'system';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>(
    localStorage.getItem('mdl-theme') as ThemeOption || 'system'
  );

  const handleThemeChange = (newTheme: ThemeOption) => {
    setSelectedTheme(newTheme);
    if (newTheme === 'system') {
      localStorage.removeItem('mdl-theme');
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(systemTheme);
    } else {
      setTheme(newTheme);
    }
  };

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Settings</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">
          Customize your MDL.cc experience
        </p>
      </div>

      {/* Appearance */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Sun className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">Appearance</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                Customize how MDL.cc looks on your device
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
            Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleThemeChange(option.value)}
                className={clsx(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  selectedTheme === option.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                )}
              >
                <option.icon
                  className={clsx(
                    'w-6 h-6',
                    selectedTheme === option.value
                      ? 'text-primary-500'
                      : 'text-dark-400'
                  )}
                />
                <span
                  className={clsx(
                    'text-sm font-medium',
                    selectedTheme === option.value
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-dark-600 dark:text-dark-400'
                  )}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-sm text-dark-500 dark:text-dark-400 mt-3">
            {selectedTheme === 'system'
              ? 'MDL.cc will automatically match your system preference.'
              : `MDL.cc is set to ${selectedTheme} mode.`}
          </p>
        </div>
      </div>

      {/* Default Domain */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">Default Domain</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                Choose your default short link domain
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <p className="font-medium text-dark-900 dark:text-white">mdl.cc</p>
                <p className="text-xs text-dark-500 dark:text-dark-400">Default domain</p>
              </div>
            </div>
            <span className="badge badge-primary">Active</span>
          </div>
          <p className="text-sm text-dark-500 dark:text-dark-400 mt-3">
            Want to use your own domain? Contact us to set up branded links.
          </p>
        </div>
      </div>

      {/* API Access */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">API Access</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                Integrate MDL.cc with your applications
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
            <p className="text-sm text-dark-500 dark:text-dark-400 mb-2">API Endpoint</p>
            <code className="text-sm font-mono text-dark-900 dark:text-white">
              https://mdl.cc/api
            </code>
          </div>
          <div>
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-3">
              Use our REST API to create and manage links programmatically.
            </p>
            <button className="btn btn-secondary">
              <Code className="w-4 h-4" />
              View API Documentation
            </button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="p-6 border-b border-dark-100 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="font-semibold text-dark-900 dark:text-white">About MDL.cc</h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                The middle-point between you and your audience
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Version</p>
              <p className="font-medium text-dark-900 dark:text-white">1.0.0</p>
            </div>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Platform</p>
              <p className="font-medium text-dark-900 dark:text-white">Cloudflare Workers</p>
            </div>
          </div>
          <div className="pt-4 border-t border-dark-100 dark:border-dark-700">
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-4">
              MDL.cc is built on Cloudflare's global edge network for maximum speed and reliability.
              We're the middle-point that connects you to your audience, no matter where they are.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#" className="btn btn-secondary btn-sm">
                Privacy Policy
                <ExternalLink className="w-3 h-3" />
              </a>
              <a href="#" className="btn btn-secondary btn-sm">
                Terms of Service
                <ExternalLink className="w-3 h-3" />
              </a>
              <a href="#" className="btn btn-secondary btn-sm">
                Contact Support
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
