import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Link2, MousePointerClick, TrendingUp, ArrowUpRight, ExternalLink } from 'lucide-react';
import { stats, DashboardStats } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

// Minimax-style stat accent colors
const STATS = [
  {
    label: 'Active Links',
    badge: 'Total',
    icon: Link2,
    key: 'total_links' as const,
    iconBg: '#eef2ff',
    iconColor: '#1456f0',
  },
  {
    label: 'Total Clicks',
    badge: 'All Time',
    icon: MousePointerClick,
    key: 'total_clicks' as const,
    iconBg: '#eff6ff',
    iconColor: '#3b82f6',
  },
  {
    label: 'Clicks Today',
    badge: 'Today',
    icon: TrendingUp,
    key: 'today_clicks' as const,
    iconBg: '#e8ffea',
    iconColor: '#16a34a',
  },
];

export default function Dashboard() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { activeWorkspaceId } = useWorkspace();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    stats.dashboard(activeWorkspaceId || undefined).then((response) => {
      if (!cancelled && response.success && response.data) setData(response.data);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#1456f0', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-2xl font-semibold" style={{ color: dark ? '#f0f0f0' : '#181e25' }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8e8e93', fontFamily: '"DM Sans", sans-serif' }}>
          Welcome to MDL.cc — the middle-point between you and your audience
        </p>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATS.map(({ label, badge, icon: Icon, key, iconBg, iconColor }) => (
          <div key={key} className="stat-card card-hover">
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: iconBg }}
              >
                <Icon className="w-5 h-5" style={{ color: iconColor }} />
              </div>
              <span
                className="badge"
                style={{ background: dark ? '#2d3748' : '#f0f0f0', color: dark ? '#94a3b8' : '#45515e', fontSize: '11px', fontWeight: 600 }}
              >
                {badge}
              </span>
            </div>
            <div className="stat-value">{(data?.[key] ?? 0).toLocaleString()}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Charts & lists ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clicks over time */}
        <div className="card p-6">
          <h3
            className="font-display font-semibold mb-4"
            style={{ fontSize: '15px', color: dark ? '#f0f0f0' : '#181e25' }}
          >
            Clicks Over Time
          </h3>
          <div className="h-64">
            {data?.weekly_clicks && data.weekly_clicks.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.weekly_clicks}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => format(parseISO(d), 'EEE')}
                    stroke="#d1d5db"
                    tick={{ fill: '#8e8e93', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#d1d5db"
                    tick={{ fill: '#8e8e93', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#181e25',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#f0f0f0',
                      fontSize: '12px',
                      padding: '8px 12px',
                      boxShadow: 'rgba(44, 30, 116, 0.16) 0px 8px 20px',
                    }}
                    labelFormatter={(d) => format(parseISO(d as string), 'MMM d, yyyy')}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#1456f0"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#1456f0', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm" style={{ color: '#8e8e93' }}>
                No click data yet
              </div>
            )}
          </div>
        </div>

        {/* Recent links */}
        <div className="card overflow-hidden">
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: `1px solid ${dark ? '#2d3748' : '#f2f3f5'}` }}
          >
            <h3 className="font-display font-semibold" style={{ fontSize: '15px', color: dark ? '#f0f0f0' : '#181e25' }}>
              Recent Links
            </h3>
            <Link
              to="/links"
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: '#1456f0' }}
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div>
            {data?.recent_links && data.recent_links.length > 0 ? (
              data.recent_links.map((link) => (
                <Link
                  key={link.id}
                  to={`/links/${link.id}`}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors"
                  style={{ borderBottom: `1px solid ${dark ? '#2d3748' : '#f8f9fa'}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : '#fafafa'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: dark ? '#f0f0f0' : '#181e25' }}>
                      {link.title || link.short_code}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: '#1456f0' }}>
                      mdl.cc/m/{link.short_code}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="text-xs" style={{ color: '#8e8e93' }}>
                      {link.click_count || 0} clicks
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" style={{ color: '#d1d5db' }} />
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-10 text-center text-sm" style={{ color: '#8e8e93' }}>
                No links yet. Create your first link!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Top performing links ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${dark ? '#2d3748' : '#f2f3f5'}` }}
        >
          <h3 className="font-display font-semibold" style={{ fontSize: '15px', color: dark ? '#f0f0f0' : '#181e25' }}>
            Top Performing Links
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${dark ? '#2d3748' : '#f2f3f5'}` }}>
                {['Link', 'Destination', 'Clicks'].map((col, i) => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-xs font-semibold"
                    style={{ color: '#8e8e93', textAlign: i === 2 ? 'right' : 'left' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.top_links && data.top_links.length > 0 ? (
                data.top_links.map((link, index) => (
                  <tr
                    key={link.id}
                    style={{ borderBottom: `1px solid ${dark ? '#2d3748' : '#f8f9fa'}` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = dark ? 'rgba(255,255,255,0.04)' : '#fafafa'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: dark ? 'rgba(20,86,240,0.15)' : '#eef2ff', color: dark ? '#60a5fa' : '#1456f0' }}
                        >
                          {index + 1}
                        </span>
                        <Link
                          to={`/links/${link.id}`}
                          className="text-sm font-medium"
                          style={{ color: dark ? '#60a5fa' : '#1456f0' }}
                        >
                          mdl.cc/m/{link.short_code}
                        </Link>
                      </div>
                    </td>
                    <td
                      className="px-5 py-3.5 text-sm truncate max-w-xs"
                      style={{ color: dark ? '#8e8e93' : '#45515e' }}
                    >
                      {link.original_url}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold" style={{ color: dark ? '#f0f0f0' : '#181e25' }}>
                      {link.click_count?.toLocaleString() || 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm" style={{ color: '#8e8e93' }}>
                    No data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
