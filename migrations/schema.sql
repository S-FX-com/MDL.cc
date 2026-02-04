-- MDL.cc Database Schema
-- "The middle-point between you and your audience"

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Domains (for branded links)
CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Link groups/folders
CREATE TABLE IF NOT EXISTS link_groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#10B981',
    icon TEXT DEFAULT 'folder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Links table
CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    group_id TEXT,
    domain_id TEXT,
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
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);

-- Create index for fast short_code lookups
CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_group_id ON links(group_id);
CREATE INDEX IF NOT EXISTS idx_links_domain_id ON links(domain_id);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366F1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

-- Link-Tags junction table
CREATE TABLE IF NOT EXISTS link_tags (
    link_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (link_id, tag_id),
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Click analytics table (aggregated for performance)
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

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_timestamp ON clicks(timestamp);
CREATE INDEX IF NOT EXISTS idx_clicks_country ON clicks(country);

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
