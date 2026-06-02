-- Workspace invitations.
--
-- This table is used by the invite-only sign-up flow (email.ts, auth.ts,
-- microsoft.ts) but was missing from the committed migration history. It is
-- created idempotently here so any database that lacks it is brought up to
-- date; on databases that already have it this is a no-op.
--
-- Note: password_hash / password_salt / microsoft_id / email_verified on the
-- users table were added in an earlier (uncommitted) slot and are part of the
-- canonical schema.sql. Fresh databases should be provisioned from schema.sql,
-- which already includes all of the above.

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
