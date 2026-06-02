import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  Edit,
  Trash2,
  Link2,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { groups as groupsApi, LinkGroup, CreateGroupPayload } from '../lib/api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import clsx from 'clsx';

const GROUP_COLORS = [
  '#10B981', // Green
  '#5b8ffe', // Blue
  '#F59E0B', // Amber
  '#dc3545', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

export default function Groups() {
  const { activeWorkspaceId } = useWorkspace();
  const [groups, setGroups] = useState<LinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LinkGroup | null>(null);
  const [formData, setFormData] = useState<CreateGroupPayload>({
    name: '',
    description: '',
    color: GROUP_COLORS[0],
  });
  const [saving, setSaving] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, [activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGroups = async () => {
    if (!activeWorkspaceId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const response = await groupsApi.list(activeWorkspaceId);
    if (response.success && response.data) {
      setGroups(response.data);
    }
    setLoading(false);
  };

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '', color: GROUP_COLORS[0] });
    setModalOpen(true);
  };

  const openEditModal = (group: LinkGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color,
    });
    setModalOpen(true);
    setActiveMenu(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);

    if (editingGroup) {
      await groupsApi.update(editingGroup.id, formData);
    } else {
      await groupsApi.create({ ...formData, workspace_id: activeWorkspaceId });
    }

    await loadGroups();
    setModalOpen(false);
    setSaving(false);
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? Links in this group will be ungrouped.')) {
      return;
    }
    await groupsApi.delete(groupId);
    await loadGroups();
    setActiveMenu(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Groups</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Organize your links into folders for better management
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div key={group.id} className="card card-hover p-5 relative">
              {/* Menu Button */}
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setActiveMenu(activeMenu === group.id ? null : group.id)}
                  className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4 text-neutral-400" />
                </button>
                {activeMenu === group.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-36 py-1 card shadow-lg">
                      <button
                        onClick={() => openEditModal(group)}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(group.id)}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Group Icon & Name */}
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${group.color}20` }}
                >
                  <FolderOpen className="w-6 h-6" style={{ color: group.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-neutral-900 dark:text-white truncate">
                    {group.name}
                  </h3>
                  {group.description && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                      {group.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Link Count */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
                <Link2 className="w-4 h-4 text-neutral-400" />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {(group as any).link_count || 0} links
                </span>
                <Link
                  to={`/links?group=${group.id}`}
                  className="ml-auto text-sm text-secondary-500 hover:text-secondary-600"
                >
                  View links →
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="font-medium text-neutral-900 dark:text-white mb-1">No groups yet</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-4 text-center max-w-sm">
            Create groups to organize your links by campaign, project, or category
          </p>
          <button onClick={openCreateModal} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Create Group
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                {editingGroup ? 'Edit Group' : 'Create Group'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Marketing Campaign"
                  className="input"
                  required
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this group"
                  className="input resize-none"
                  rows={3}
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {GROUP_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={clsx(
                        'w-8 h-8 rounded-lg transition-transform',
                        formData.color === color && 'ring-2 ring-offset-2 ring-neutral-400 scale-110'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">PREVIEW:</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${formData.color}20` }}
                  >
                    <FolderOpen className="w-5 h-5" style={{ color: formData.color }} />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {formData.name || 'Group Name'}
                    </p>
                    {formData.description && (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                        {formData.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !formData.name.trim()} className="btn btn-primary flex-1">
                  {saving ? 'Saving...' : editingGroup ? 'Update Group' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
