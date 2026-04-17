import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Edit,
  Trash2,
  QrCode,
  Check,
  Globe,
  Monitor,
  Chrome,
  MousePointerClick,
  Users,
  Download,
} from 'lucide-react';
import QRCodeDisplay, { useQRDownload } from '../components/QRCodeDisplay';
import { links, Link as LinkType, AnalyticsData } from '../lib/api';
import { format, parseISO } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function LinkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [link, setLink] = useState<LinkType | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const { ref: qrRef, download: downloadQRSvg } = useQRDownload(`mdl-cc-${id}.svg`);

  useEffect(() => {
    if (id) {
      loadLink();
      loadAnalytics();
    }
  }, [id]);

  const loadLink = async () => {
    if (!id) return;
    setLoading(true);
    const response = await links.get(id);
    if (response.success && response.data) {
      setLink(response.data);
      setEditTitle(response.data.title || '');
      setEditUrl(response.data.original_url);
    }
    setLoading(false);
  };

  const loadAnalytics = async () => {
    if (!id) return;
    const response = await links.analytics(id, 30);
    if (response.success && response.data) {
      setAnalytics(response.data);
    }
  };

  const copyLink = async () => {
    if (link) {
      await navigator.clipboard.writeText(`https://mdl.cc/m/${link.short_code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this link?')) return;
    await links.delete(id);
    navigate('/links');
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    await links.update(id, {
      title: editTitle || undefined,
      url: editUrl,
    });
    await loadLink();
    setEditMode(false);
    setSaving(false);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!link) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">Link not found</h2>
        <RouterLink to="/links" className="text-primary-500 hover:text-primary-600">
          Back to links
        </RouterLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            {editMode ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Link title"
                className="input text-xl font-bold"
              />
            ) : (
              <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
                {link.title || link.short_code}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-primary-500 font-medium">mdl.cc/m/{link.short_code}</span>
              <button
                onClick={copyLink}
                className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-dark-400" />
                )}
              </button>
              <a
                href={`https://mdl.cc/m/${link.short_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-dark-400" />
              </a>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={() => setEditMode(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditMode(true)} className="btn btn-secondary">
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button onClick={handleDelete} className="btn btn-danger">
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Link Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Destination URL */}
          <div className="card p-6">
            <h3 className="font-semibold text-dark-900 dark:text-white mb-3">Destination URL</h3>
            {editMode ? (
              <input
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                className="input"
              />
            ) : (
              <a
                href={link.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-dark-600 dark:text-dark-300 hover:text-primary-500 break-all"
              >
                {link.original_url}
              </a>
            )}
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-5 h-5 text-primary-500" />
                <span className="text-sm text-dark-500 dark:text-dark-400">Total Clicks</span>
              </div>
              <div className="stat-value mt-2">{analytics?.total_clicks.toLocaleString() || 0}</div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-dark-500 dark:text-dark-400">Unique Visitors</span>
              </div>
              <div className="stat-value mt-2">{analytics?.unique_visitors.toLocaleString() || 0}</div>
            </div>
          </div>

          {/* Clicks Over Time */}
          <div className="card p-6">
            <h3 className="font-semibold text-dark-900 dark:text-white mb-4">Clicks Over Time</h3>
            <div className="h-64">
              {analytics?.clicks_by_date && analytics.clicks_by_date.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.clicks_by_date}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(parseISO(date), 'MMM d')}
                      stroke="#64748b"
                      fontSize={12}
                    />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
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
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-dark-400">
                  No click data yet
                </div>
              )}
            </div>
          </div>

          {/* Analytics Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Device Types */}
            <div className="card p-6">
              <h3 className="font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-dark-400" />
                Devices
              </h3>
              <div className="h-48">
                {analytics?.clicks_by_device && analytics.clicks_by_device.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.clicks_by_device}
                        dataKey="count"
                        nameKey="device"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ device, percent }) =>
                          `${device} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {analytics.clicks_by_device.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-dark-400">
                    No data
                  </div>
                )}
              </div>
            </div>

            {/* Browsers */}
            <div className="card p-6">
              <h3 className="font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
                <Chrome className="w-5 h-5 text-dark-400" />
                Browsers
              </h3>
              <div className="h-48">
                {analytics?.clicks_by_browser && analytics.clicks_by_browser.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.clicks_by_browser} layout="vertical">
                      <XAxis type="number" stroke="#64748b" fontSize={12} />
                      <YAxis
                        dataKey="browser"
                        type="category"
                        stroke="#64748b"
                        fontSize={12}
                        width={60}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#f8fafc',
                        }}
                      />
                      <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-dark-400">
                    No data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Countries */}
          <div className="card p-6">
            <h3 className="font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-dark-400" />
              Top Countries
            </h3>
            {analytics?.clicks_by_country && analytics.clicks_by_country.length > 0 ? (
              <div className="space-y-3">
                {analytics.clicks_by_country.map((country, index) => (
                  <div key={country.country || 'unknown'} className="flex items-center gap-3">
                    <span className="w-6 text-sm text-dark-400">{index + 1}</span>
                    <span className="flex-1 font-medium text-dark-900 dark:text-white">
                      {country.country || 'Unknown'}
                    </span>
                    <span className="text-dark-500 dark:text-dark-400">
                      {country.count.toLocaleString()} clicks
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-400">No data yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* QR Code */}
          <div className="card p-6">
            <h3 className="font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-dark-400" />
              QR Code
            </h3>
            <div ref={qrRef} className="bg-white p-4 rounded-lg flex items-center justify-center">
              <QRCodeDisplay value={`https://mdl.cc/m/${link.short_code}`} size={192} />
            </div>
            <button onClick={downloadQRSvg} className="btn btn-secondary w-full mt-4">
              <Download className="w-4 h-4" />
              Download QR
            </button>
          </div>

          {/* Link Info */}
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-dark-900 dark:text-white">Link Details</h3>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Created</p>
              <p className="text-dark-900 dark:text-white">
                {format(parseISO(link.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Last Updated</p>
              <p className="text-dark-900 dark:text-white">
                {format(parseISO(link.updated_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
            {link.group_name && (
              <div>
                <p className="text-sm text-dark-500 dark:text-dark-400">Group</p>
                <span
                  className="badge mt-1"
                  style={{
                    backgroundColor: `${link.group_color}20`,
                    color: link.group_color,
                  }}
                >
                  {link.group_name}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Status</p>
              <span
                className={`badge mt-1 ${link.is_active ? 'badge-primary' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}
              >
                {link.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {link.password && (
              <div>
                <p className="text-sm text-dark-500 dark:text-dark-400">Password Protected</p>
                <span className="badge badge-gray mt-1">Yes</span>
              </div>
            )}
          </div>

          {/* Top Referers */}
          <div className="card p-6">
            <h3 className="font-semibold text-dark-900 dark:text-white mb-4">Top Referrers</h3>
            {analytics?.top_referers && analytics.top_referers.length > 0 ? (
              <div className="space-y-2">
                {analytics.top_referers.slice(0, 5).map((ref) => (
                  <div key={ref.referer} className="flex items-center justify-between text-sm">
                    <span className="text-dark-600 dark:text-dark-300 truncate flex-1">
                      {new URL(ref.referer).hostname}
                    </span>
                    <span className="text-dark-400 ml-2">{ref.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-400 text-sm">No referrer data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
