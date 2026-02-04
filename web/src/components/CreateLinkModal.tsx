import { useState, useEffect } from 'react';
import { X, Link2, Copy, Check, QrCode, ChevronDown, ChevronUp } from 'lucide-react';
import { links, groups as groupsApi, LinkGroup, CreateLinkPayload, Link as LinkType } from '../lib/api';
import clsx from 'clsx';

interface CreateLinkModalProps {
  open: boolean;
  onClose: () => void;
  initialUrl?: string;
  onSuccess?: (link: LinkType) => void;
}

export default function CreateLinkModal({ open, onClose, initialUrl = '', onSuccess }: CreateLinkModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [customCode, setCustomCode] = useState('');
  const [title, setTitle] = useState('');
  const [groupId, setGroupId] = useState('');
  const [password, setPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState<LinkType | null>(null);
  const [copied, setCopied] = useState(false);
  const [groups, setGroups] = useState<LinkGroup[]>([]);

  // Load groups
  useEffect(() => {
    if (open) {
      groupsApi.list().then((res) => {
        if (res.success && res.data) {
          setGroups(res.data);
        }
      });
    }
  }, [open]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setCustomCode('');
      setTitle('');
      setGroupId('');
      setPassword('');
      setShowAdvanced(false);
      setError('');
      setCreatedLink(null);
      setCopied(false);
    }
  }, [open, initialUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: CreateLinkPayload = { url };
      if (customCode) payload.custom_code = customCode;
      if (title) payload.title = title;
      if (groupId) payload.group_id = groupId;
      if (password) payload.password = password;

      const response = await links.create(payload);

      if (response.success && response.data) {
        setCreatedLink(response.data);
        onSuccess?.(response.data);
      } else {
        setError(response.error || 'Failed to create link');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (createdLink?.short_url) {
      await navigator.clipboard.writeText(createdLink.short_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark-900 dark:text-white">
                {createdLink ? 'Link Created!' : 'Shorten Your Link'}
              </h2>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                {createdLink ? 'Your short link is ready' : 'Create a short, memorable link'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdLink ? (
          // Success state
          <div className="space-y-4">
            {/* Short URL display */}
            <div className="p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
              <p className="text-xs text-dark-500 dark:text-dark-400 mb-2">YOUR SHORT LINK:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono text-primary-600 dark:text-primary-400">
                  {createdLink.short_url?.replace('https://', '')}
                </code>
                <button
                  onClick={copyToClipboard}
                  className={clsx(
                    'btn btn-sm',
                    copied ? 'btn-primary' : 'btn-secondary'
                  )}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Original URL */}
            <div className="p-4 bg-dark-50 dark:bg-dark-800 rounded-xl">
              <p className="text-xs text-dark-500 dark:text-dark-400 mb-1">ORIGINAL URL:</p>
              <p className="text-sm text-dark-600 dark:text-dark-300 truncate">
                {createdLink.original_url}
              </p>
            </div>

            {/* QR Code preview */}
            <div className="p-4 bg-dark-50 dark:bg-dark-800 rounded-xl flex items-center gap-4">
              <img
                src={`/api/qr?code=${createdLink.short_code}&size=80`}
                alt="QR Code"
                className="w-20 h-20 rounded-lg bg-white"
              />
              <div>
                <p className="font-medium text-dark-900 dark:text-white">QR Code</p>
                <p className="text-sm text-dark-500 dark:text-dark-400 mb-2">
                  Scan to visit your link
                </p>
                <button className="btn btn-sm btn-secondary">
                  <QrCode className="w-4 h-4" />
                  Customize
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn btn-secondary flex-1">
                Done
              </button>
              <button
                onClick={() => {
                  setCreatedLink(null);
                  setUrl('');
                }}
                className="btn btn-primary flex-1"
              >
                Create Another
              </button>
            </div>
          </div>
        ) : (
          // Form state
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                Destination URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/your-long-url"
                className="input"
                required
                autoFocus
              />
            </div>

            {/* Custom Code Input */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                Custom Alias (optional)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-dark-400 dark:text-dark-500 text-sm">mdl.cc/</span>
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="my-link"
                  className="input flex-1"
                  pattern="[a-zA-Z0-9_-]+"
                />
              </div>
              <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">
                Leave empty for an auto-generated code
              </p>
            </div>

            {/* Advanced Options Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-200"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Advanced Options
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-2 border-t border-dark-200 dark:border-dark-700">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My awesome link"
                    className="input"
                  />
                </div>

                {/* Group */}
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                    Group / Folder
                  </label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="input"
                  >
                    <option value="">No group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                    Password Protection
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Optional password"
                    className="input"
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !url}
              className="btn btn-primary btn-lg w-full"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Shorten <span className="ml-1">→</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
