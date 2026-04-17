import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  Edit,
  BarChart3,
  QrCode,
  Filter,
  Check,
  Link2,
} from 'lucide-react';
import { links, Link as LinkType, LinksResponse, groups as groupsApi, LinkGroup, shortLinkHref, shortLinkDisplay } from '../lib/api';
import { format, parseISO } from 'date-fns';
import CreateLinkModal from '../components/CreateLinkModal';
import { useWorkspace } from '../contexts/WorkspaceContext';

export default function Links() {
  const { activeWorkspaceId } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<LinksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedGroup, setSelectedGroup] = useState(searchParams.get('group') || '');
  const [groups, setGroups] = useState<LinkGroup[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    groupsApi.list().then((res) => {
      if (res.success && res.data) {
        setGroups(res.data);
      }
    });
  }, []);

  useEffect(() => {
    loadLinks();
  }, [page, selectedGroup, search, activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLinks = async () => {
    setLoading(true);
    const response = await links.list({
      page,
      limit: 20,
      group_id: selectedGroup || undefined,
      search: search || undefined,
      workspace_id: activeWorkspaceId || undefined,
    });
    if (response.success && response.data) {
      setData(response.data);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams((prev) => {
      if (search) {
        prev.set('search', search);
      } else {
        prev.delete('search');
      }
      prev.set('page', '1');
      return prev;
    });
  };

  const handleGroupFilter = (groupId: string) => {
    setSelectedGroup(groupId);
    setSearchParams((prev) => {
      if (groupId) {
        prev.set('group', groupId);
      } else {
        prev.delete('group');
      }
      prev.set('page', '1');
      return prev;
    });
  };

  const copyLink = async (link: LinkType) => {
    await navigator.clipboard.writeText(shortLinkHref(link));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return;
    await links.delete(linkId);
    loadLinks();
    setActiveMenu(null);
  };

  const openMenu = (linkId: string) => {
    if (activeMenu === linkId) {
      setActiveMenu(null);
      return;
    }
    const btn = menuButtonRefs.current[linkId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setActiveMenu(linkId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Links</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            Manage all your shortened links
          </p>
        </div>
        <button onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Create Link
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search links..."
              className="input pl-10"
            />
          </div>
        </form>

        {/* Group Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-dark-400" />
          <select
            value={selectedGroup}
            onChange={(e) => handleGroupFilter(e.target.value)}
            className="input py-2"
          >
            <option value="">All Groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Links Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data?.links && data.links.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-dark-500 dark:text-dark-400 border-b border-dark-100 dark:border-dark-700 bg-dark-50 dark:bg-dark-800/50">
                    <th className="p-4 font-medium">Short Link</th>
                    <th className="p-4 font-medium">Original URL</th>
                    <th className="p-4 font-medium">Group</th>
                    <th className="p-4 font-medium text-right">Clicks</th>
                    <th className="p-4 font-medium">Created</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                  {data.links.map((link) => (
                    <tr key={link.id} className="hover:bg-dark-50 dark:hover:bg-dark-800/50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/links/${link.id}`}
                            className="font-medium text-primary-500 hover:text-primary-600"
                          >
                            {shortLinkDisplay(link)}
                          </Link>
                          <button
                            onClick={() => copyLink(link)}
                            className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                            title="Copy link"
                          >
                            {copiedId === link.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-dark-400" />
                            )}
                          </button>
                          <a
                            href={shortLinkHref(link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                            title="Open link"
                          >
                            <ExternalLink className="w-4 h-4 text-dark-400" />
                          </a>
                        </div>
                        {link.title && (
                          <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                            {link.title}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-dark-600 dark:text-dark-300 truncate max-w-xs">
                          {link.original_url}
                        </p>
                      </td>
                      <td className="p-4">
                        {link.group_name ? (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: `${link.group_color}20`,
                              color: link.group_color,
                            }}
                          >
                            {link.group_name}
                          </span>
                        ) : (
                          <span className="text-dark-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-medium text-dark-900 dark:text-white">
                          {link.click_count?.toLocaleString() || 0}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-dark-500 dark:text-dark-400">
                          {format(parseISO(link.created_at), 'MMM d, yyyy')}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/links/${link.id}`}
                            className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                            title="View analytics"
                          >
                            <BarChart3 className="w-4 h-4 text-dark-500" />
                          </Link>
                          <a
                            href={`/api/qr?code=${link.short_code}&size=200`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                            title="Download QR"
                          >
                            <QrCode className="w-4 h-4 text-dark-500" />
                          </a>
                          <button
                            ref={(el) => { menuButtonRefs.current[link.id] = el; }}
                            onClick={() => openMenu(link.id)}
                            className="p-2 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4 text-dark-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-dark-100 dark:border-dark-700">
                <p className="text-sm text-dark-500 dark:text-dark-400">
                  Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.pagination.total)} of{' '}
                  {data.pagination.total} links
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setSearchParams((prev) => {
                        prev.set('page', String(page - 1));
                        return prev;
                      })
                    }
                    disabled={page === 1}
                    className="btn btn-secondary btn-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setSearchParams((prev) => {
                        prev.set('page', String(page + 1));
                        return prev;
                      })
                    }
                    disabled={page >= data.pagination.pages}
                    className="btn btn-secondary btn-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-dark-100 dark:bg-dark-800 flex items-center justify-center mb-4">
              <Link2 className="w-8 h-8 text-dark-400" />
            </div>
            <h3 className="font-medium text-dark-900 dark:text-white mb-1">No links found</h3>
            <p className="text-dark-500 dark:text-dark-400 mb-4">
              {search ? 'Try a different search term' : 'Create your first link to get started'}
            </p>
            <button onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" />
              Create Link
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateLinkModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => loadLinks()}
      />

      {/* Three-dot dropdown — rendered at the root level (fixed) to escape overflow:hidden */}
      {activeMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
          <div
            className="fixed z-50 w-40 py-1 card shadow-xl"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <Link
              to={`/links/${activeMenu}`}
              className="flex items-center gap-2 px-4 py-2 text-sm text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700"
              onClick={() => setActiveMenu(null)}
            >
              <Edit className="w-4 h-4" />
              Edit
            </Link>
            <button
              onClick={() => deleteLink(activeMenu)}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-dark-100 dark:hover:bg-dark-700"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
