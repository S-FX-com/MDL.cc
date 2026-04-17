-- Clean slate for links + rebuild domains table for workspace-scoped custom domains.
-- Links that predate workspace support have no workspace_id and cause cross-workspace leaks.
-- Per product decision, wipe them rather than try to back-fill.

DELETE FROM clicks       WHERE link_id IN (SELECT id FROM links WHERE workspace_id IS NULL);
DELETE FROM daily_stats  WHERE link_id IN (SELECT id FROM links WHERE workspace_id IS NULL);
DELETE FROM link_tags    WHERE link_id IN (SELECT id FROM links WHERE workspace_id IS NULL);
DELETE FROM qr_configs   WHERE link_id IN (SELECT id FROM links WHERE workspace_id IS NULL);
DELETE FROM links        WHERE workspace_id IS NULL;

-- Rebuild domains: attach to a workspace, track verification + default-per-workspace.
-- SQLite can't add FKs via ALTER, so we rebuild.
DROP TABLE IF EXISTS domains;

CREATE TABLE domains (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    domain       TEXT UNIQUE NOT NULL,
    verified     INTEGER NOT NULL DEFAULT 0,
    is_default   INTEGER NOT NULL DEFAULT 0,
    verify_token TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at  DATETIME,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domains_workspace_id ON domains(workspace_id);
CREATE INDEX IF NOT EXISTS idx_domains_domain       ON domains(domain);
