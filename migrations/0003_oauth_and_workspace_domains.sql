-- OAuth (Microsoft 365) + workspace domain auto-join.
--
-- 1. Link a user to their Microsoft account; mark when the email is verified
--    by an identity provider so we can trust it for domain-based auto-join.
-- 2. workspace_domains: an org claims an email domain; matching users joining
--    via a verified provider are auto-added to that workspace.
--
-- password_hash/password_salt were already added in an earlier slot and are
-- already nullable (no NOT NULL constraint), so SSO-only users are supported.

ALTER TABLE users ADD COLUMN microsoft_id   TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_microsoft_id
  ON users(microsoft_id) WHERE microsoft_id IS NOT NULL;

-- One verified domain → one workspace (UNIQUE on domain) to keep auto-join
-- unambiguous. Mode lets the owner pause auto-join without deleting the row.
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
