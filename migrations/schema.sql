-- MDL.cc Database Schema (canonical, full current state)
-- "The middle-point between you and your audience"
--
-- This file is the single source of truth for a FRESH database and is what
-- `npm run db:migrate` applies. Every statement is idempotent (IF NOT EXISTS),
-- so re-running it against an existing database is a no-op.
--
-- The numbered files in this directory (0001…) are the incremental history for
-- databases that were provisioned from an earlier version of this schema. When
-- bringing up a brand-new database you only need this file.

-- Users (password auth + Microsoft SSO)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    password_hash TEXT,
    password_salt TEXT,
    microsoft_id TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    -- Platform-level operator flag (not a workspace role). A superadmin can
    -- oversee and configure every workspace via the /api/admin/* endpoints.
    is_superadmin INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One Microsoft account links to at most one user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_microsoft_id
  ON users(microsoft_id) WHERE microsoft_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_is_superadmin ON users(is_superadmin) WHERE is_superadmin = 1;

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, user_id)
);

-- Branded custom domains (workspace-scoped, Cloudflare for SaaS aware)
CREATE TABLE IF NOT EXISTS domains (
    id             TEXT PRIMARY KEY,
    workspace_id   TEXT NOT NULL,
    domain         TEXT UNIQUE NOT NULL,
    verified       INTEGER NOT NULL DEFAULT 0,
    is_default     INTEGER NOT NULL DEFAULT 0,
    verify_token   TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at    DATETIME,
    cf_hostname_id TEXT,
    cf_status      TEXT,
    cf_ssl_status  TEXT,
    cf_validation  TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domains_workspace_id ON domains(workspace_id);
CREATE INDEX IF NOT EXISTS idx_domains_domain       ON domains(domain);
CREATE INDEX IF NOT EXISTS idx_domains_cf_hostname  ON domains(cf_hostname_id);

-- Email-domain claims for auto-join on verified SSO
CREATE TABLE IF NOT EXISTS workspace_domains (
    id              TEXT PRIMARY KEY,
    workspace_id    TEXT NOT NULL,
    domain          TEXT NOT NULL UNIQUE,
    auto_join_mode  TEXT NOT NULL DEFAULT 'auto', -- 'off' | 'auto'
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_domains_workspace ON workspace_domains(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_domains_domain    ON workspace_domains(domain);

-- Link groups/folders (workspace-scoped)
CREATE TABLE IF NOT EXISTS link_groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#10B981',
    icon TEXT DEFAULT 'folder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_link_groups_workspace_id ON link_groups(workspace_id);

-- Links
CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    group_id TEXT,
    domain_id TEXT,
    workspace_id TEXT,
    short_code TEXT NOT NULL,
    original_url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    password TEXT,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (group_id) REFERENCES link_groups(id) ON DELETE SET NULL,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_links_short_code   ON links(short_code);
CREATE INDEX IF NOT EXISTS idx_links_user_id      ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_group_id     ON links(group_id);
CREATE INDEX IF NOT EXISTS idx_links_domain_id    ON links(domain_id);
CREATE INDEX IF NOT EXISTS idx_links_workspace_id ON links(workspace_id);

-- Tags (workspace-scoped)
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366F1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_workspace_id ON tags(workspace_id);

-- Link-Tags junction table
CREATE TABLE IF NOT EXISTS link_tags (
    link_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (link_id, tag_id),
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Per-click analytics
CREATE TABLE IF NOT EXISTS clicks (
    id TEXT PRIMARY KEY,
    link_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    country TEXT,
    city TEXT,
    region TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    referer TEXT,
    ip_hash TEXT,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clicks_link_id   ON clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_timestamp ON clicks(timestamp);
CREATE INDEX IF NOT EXISTS idx_clicks_country   ON clicks(country);

-- Daily aggregated stats for faster dashboard queries
CREATE TABLE IF NOT EXISTS daily_stats (
    id TEXT PRIMARY KEY,
    link_id TEXT NOT NULL,
    date DATE NOT NULL,
    click_count INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
    UNIQUE(link_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_link_date ON daily_stats(link_id, date);

-- QR code configurations
CREATE TABLE IF NOT EXISTS qr_configs (
    id TEXT PRIMARY KEY,
    link_id TEXT UNIQUE NOT NULL,
    foreground_color TEXT DEFAULT '#000000',
    background_color TEXT DEFAULT '#FFFFFF',
    logo_url TEXT,
    size INTEGER DEFAULT 256,
    error_correction TEXT DEFAULT 'M',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Workspace invitations (invite-only sign-up + member onboarding)
CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    invited_by TEXT,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_token        ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_workspace_id ON invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email        ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status       ON invitations(status);

-- API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    last_used_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
