import { useState, useEffect, useMemo } from 'react';
import { X, Link2, Copy, Check, ChevronDown, ChevronUp, Zap, Settings2, Download } from 'lucide-react';
import { links, groups as groupsApi, LinkGroup, CreateLinkPayload, Link as LinkType } from '../lib/api';
import QRCodeDisplay, { useQRDownload } from './QRCodeDisplay';
import clsx from 'clsx';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface CreateLinkModalProps {
  open: boolean;
  onClose: () => void;
  initialUrl?: string;
  onSuccess?: (link: LinkType) => void;
}

// Quick-create mode: shown when a URL is passed from the top bar
// Presents "Keep" (auto-code) or "Customize" (expand full form) options
type QuickMode = 'confirm' | 'customize';

export default function CreateLinkModal({ open, onClose, initialUrl = '', onSuccess }: CreateLinkModalProps) {
  const { activeWorkspaceId, customDomains, getDefaultDomain } = useWorkspace();
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
  // If opened from the top bar with a URL, start in "confirm" quick mode
  const [quickMode, setQuickMode] = useState<QuickMode | null>(null);
  const { ref: qrRef, download: downloadQR } = useQRDownload('mdl-cc-qr.svg');

  // Domains available for the active workspace (only verified — unverified ones
  // can't serve redirects yet, so they'd create dead links).
  const workspaceDomains = useMemo(
    () => customDomains.filter(d => d.workspaceId === activeWorkspaceId && d.verified),
    [customDomains, activeWorkspaceId]
  );
  const defaultDomain = getDefaultDomain(activeWorkspaceId);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');

  // Load groups
  useEffect(() => {
    if (open && activeWorkspaceId) {
      groupsApi.list(activeWorkspaceId).then((res) => {
        if (res.success && res.data) {
          setGroups(res.data);
        }
      });
    }
  }, [open, activeWorkspaceId]);

  // Reset form when modal opens/closes
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
      // If a URL was pasted into the top bar, show the quick confirm step
      setQuickMode(initialUrl.trim() ? 'confirm' : null);
      // Default to the workspace's default domain
      setSelectedDomainId(defaultDomain?.id ?? '');
    }
  }, [open, initialUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: CreateLinkPayload = { url, workspace_id: activeWorkspaceId || undefined };
      if (customCode) payload.custom_code = customCode;
      if (title) payload.title = title;
      if (groupId) payload.group_id = groupId;
      if (password) payload.password = password;
      if (selectedDomainId) payload.domain_id = selectedDomainId;

      const response = await links.create(payload);

      if (response.success && response.data) {
        // The API returns a pre-built short_url (branded host or mdl.cc/m{code}).
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

  // ── Success screen ──────────────────────────────────────────────────────────
  if (createdLink) {
    const shortUrl = createdLink.short_url?.replace('https://', '') ?? `mdl.cc/m${createdLink.short_code}`;
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-content max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-500/15 flex items-center justify-center ring-1 ring-accent-100 dark:ring-accent-500/20">
                <Link2 className="w-5 h-5 text-accent-500 dark:text-accent-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Link Created!</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Your short link is ready</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Short URL */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">YOUR SHORT LINK:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono text-secondary-600 dark:text-secondary-400">
                  {shortUrl}
                </code>
                <button
                  onClick={copyToClipboard}
                  className={clsx('btn btn-sm', copied ? 'btn-primary' : 'btn-secondary')}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Original URL */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">ORIGINAL URL:</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 truncate">{createdLink.original_url}</p>
            </div>

            {/* QR Code preview */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl flex items-center gap-4">
              <div ref={qrRef} className="w-20 h-20 rounded-lg bg-white flex items-center justify-center p-1 shrink-0">
                <QRCodeDisplay value={createdLink.short_url ?? `https://mdl.cc/m${createdLink.short_code}`} size={72} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-neutral-900 dark:text-white">QR Code</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Scan to visit your link</p>
              </div>
              <button
                onClick={downloadQR}
                className="btn btn-secondary btn-sm gap-1.5 shrink-0"
                title="Download QR code as SVG"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn btn-secondary flex-1">Done</button>
              <button
                onClick={() => { setCreatedLink(null); setUrl(''); setQuickMode(null); }}
                className="btn btn-primary flex-1"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Quick confirm screen (top-bar flow) ─────────────────────────────────────
  if (quickMode === 'confirm') {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-content max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-500/15 flex items-center justify-center ring-1 ring-accent-100 dark:ring-accent-500/20">
                <Link2 className="w-5 h-5 text-accent-500 dark:text-accent-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Shorten Your Link</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Create a short, memorable link</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* URL preview */}
          <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl mb-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">DESTINATION URL:</p>
            <p className="text-sm text-neutral-700 dark:text-neutral-200 break-all">{url}</p>
          </div>

          {/* Auto-generated code preview */}
          <div className="p-4 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-xl mb-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">SHORT LINK (auto-generated):</p>
            <p className="text-lg font-mono font-semibold text-secondary-600 dark:text-secondary-400">
              {defaultDomain ? `${defaultDomain.domain}/` : 'mdl.cc/m'}<span className="opacity-60">••••••</span>
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              A unique code will be assigned automatically
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setQuickMode('customize')}
              className="btn btn-secondary flex-1 gap-2"
            >
              <Settings2 className="w-4 h-4" />
              Customize
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={loading}
              className="btn btn-accent flex-1 gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Keep &amp; Shorten
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Full form ───────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-500/15 flex items-center justify-center ring-1 ring-accent-100 dark:ring-accent-500/20">
              <Link2 className="w-5 h-5 text-accent-500 dark:text-accent-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Shorten Your Link</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Create a short, memorable link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
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
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Custom Alias (optional)
            </label>
            <div className="flex items-center gap-2">
              {workspaceDomains.length > 0 ? (
                <select
                  value={selectedDomainId}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
                  className="input w-auto text-sm text-neutral-600 dark:text-neutral-300 pr-6"
                >
                  <option value="">mdl.cc/m</option>
                  {workspaceDomains.map(d => (
                    <option key={d.id} value={d.id}>{d.domain}/</option>
                  ))}
                </select>
              ) : (
                <span className="text-neutral-400 dark:text-neutral-500 text-sm">mdl.cc/m</span>
              )}
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                placeholder="my-link"
                className="input flex-1"
                pattern="[a-zA-Z0-9_-]+"
              />
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Leave empty for an auto-generated code
            </p>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Advanced Options
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
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

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Group / Folder
                </label>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="input">
                  <option value="">No group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
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

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !url}
            className="btn btn-accent btn-lg w-full"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Shorten <span className="ml-1">→</span></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
