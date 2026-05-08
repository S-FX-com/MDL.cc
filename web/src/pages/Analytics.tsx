import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  MousePointerClick,
  Users,
  Globe,
  Monitor,
  ArrowUpRight,
} from 'lucide-react';
import { stats, DashboardStats, shortLinkDisplay } from '../lib/api';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { useWorkspace } from '../contexts/WorkspaceContext';

export default function Analytics() {
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

  // Generate last 7 days for empty state
  const emptyChartData = Array.from({ length: 7 }, (_, i) => ({
    date: format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'),
    count: 0,
  }));

  const chartData = data?.weekly_clicks?.length ? data.weekly_clicks : emptyChartData;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Analytics</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Track performance across all your links
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center">
              <MousePointerClick className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Clicks</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {data?.total_clicks.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Today</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {data?.today_clicks.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Active Links</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {data?.total_links.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Avg/Link</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {data?.total_links ? Math.round(data.total_clicks / data.total_links) : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-neutral-900 dark:text-white">Click Activity</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Last 7 days</p>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(parseISO(date), 'EEE')}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e2f47',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f8f9fa',
                }}
                labelFormatter={(date) => format(parseISO(date as string), 'EEEE, MMM d')}
                formatter={(value: number) => [value.toLocaleString(), 'Clicks']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#clickGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Clicked */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-neutral-700">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Top Performing Links</h3>
            <Link to="/links" className="text-sm text-secondary-500 hover:text-secondary-600 flex items-center gap-1">
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {data?.top_links && data.top_links.length > 0 ? (
              data.top_links.map((link, index) => (
                <Link
                  key={link.id}
                  to={`/links/${link.id}`}
                  className="flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-secondary-500 truncate">
                        {shortLinkDisplay(link)}
                      </p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                        {link.title || link.original_url}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-neutral-900 dark:text-white ml-4">
                    {link.click_count?.toLocaleString() || 0}
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-neutral-400 dark:text-neutral-500">
                No link data yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Links */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-neutral-700">
            <h3 className="font-semibold text-neutral-900 dark:text-white">Recently Created</h3>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {data?.recent_links && data.recent_links.length > 0 ? (
              data.recent_links.map((link) => (
                <Link
                  key={link.id}
                  to={`/links/${link.id}`}
                  className="flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-secondary-500 truncate">
                      {shortLinkDisplay(link)}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                      {link.title || link.original_url}
                    </p>
                  </div>
                  <span className="text-sm text-neutral-400 ml-4">
                    {format(parseISO(link.created_at), 'MMM d')}
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-neutral-400 dark:text-neutral-500">
                No links yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="card p-6 bg-gradient-to-r from-secondary-500/10 to-blue-500/10 border-secondary-200 dark:border-secondary-800">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary-500 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Detailed Analytics Per Link
            </h3>
            <p className="text-neutral-600 dark:text-neutral-300 mt-1">
              Click on any link to see detailed analytics including geographic data, device breakdowns, referrer sources, and click trends over time.
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
              MDL.cc - The middle-point between you and your audience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
