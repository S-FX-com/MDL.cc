import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Link2, MousePointerClick, TrendingUp, ArrowUpRight, ExternalLink } from 'lucide-react';
import { stats, DashboardStats } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

export default function Dashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const response = await stats.dashboard();
    if (response.success && response.data) {
      setData(response.data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Dashboard</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">
          Welcome to MDL.cc - the middle-point between you and your audience
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="badge badge-primary">Total</span>
          </div>
          <div className="stat-value mt-4">{data?.total_links.toLocaleString() || 0}</div>
          <div className="stat-label">Active Links</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <MousePointerClick className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="badge badge-gray">All Time</span>
          </div>
          <div className="stat-value mt-4">{data?.total_clicks.toLocaleString() || 0}</div>
          <div className="stat-label">Total Clicks</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="badge badge-primary">Today</span>
          </div>
          <div className="stat-value mt-4">{data?.today_clicks.toLocaleString() || 0}</div>
          <div className="stat-label">Clicks Today</div>
        </div>
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clicks Chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-dark-900 dark:text-white mb-4">Clicks Over Time</h3>
          <div className="h-64">
            {data?.weekly_clicks && data.weekly_clicks.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.weekly_clicks}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => format(parseISO(date), 'EEE')}
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg, #1e293b)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#f8fafc',
                    }}
                    labelFormatter={(date) => format(parseISO(date as string), 'MMM d, yyyy')}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-dark-400 dark:text-dark-500">
                No click data yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Links */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-dark-100 dark:border-dark-700">
            <h3 className="font-semibold text-dark-900 dark:text-white">Recent Links</h3>
            <Link to="/links" className="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1">
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-dark-100 dark:divide-dark-700">
            {data?.recent_links && data.recent_links.length > 0 ? (
              data.recent_links.map((link) => (
                <Link
                  key={link.id}
                  to={`/links/${link.id}`}
                  className="flex items-center justify-between p-4 hover:bg-dark-50 dark:hover:bg-dark-800/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-dark-900 dark:text-white truncate">
                      {link.title || link.short_code}
                    </p>
                    <p className="text-sm text-primary-500 truncate">mdl.cc/{link.short_code}</p>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <span className="text-sm text-dark-500 dark:text-dark-400">
                      {link.click_count || 0} clicks
                    </span>
                    <ExternalLink className="w-4 h-4 text-dark-400" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-dark-400 dark:text-dark-500">
                No links yet. Create your first link!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Performing Links */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-dark-100 dark:border-dark-700">
          <h3 className="font-semibold text-dark-900 dark:text-white">Top Performing Links</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-dark-500 dark:text-dark-400 border-b border-dark-100 dark:border-dark-700">
                <th className="p-4 font-medium">Link</th>
                <th className="p-4 font-medium">Destination</th>
                <th className="p-4 font-medium text-right">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
              {data?.top_links && data.top_links.length > 0 ? (
                data.top_links.map((link, index) => (
                  <tr key={link.id} className="hover:bg-dark-50 dark:hover:bg-dark-800/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-dark-100 dark:bg-dark-700 flex items-center justify-center text-sm font-medium text-dark-600 dark:text-dark-400">
                          {index + 1}
                        </span>
                        <Link
                          to={`/links/${link.id}`}
                          className="font-medium text-primary-500 hover:text-primary-600"
                        >
                          mdl.cc/{link.short_code}
                        </Link>
                      </div>
                    </td>
                    <td className="p-4 text-dark-600 dark:text-dark-300 truncate max-w-xs">
                      {link.original_url}
                    </td>
                    <td className="p-4 text-right font-medium text-dark-900 dark:text-white">
                      {link.click_count?.toLocaleString() || 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-dark-400 dark:text-dark-500">
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
