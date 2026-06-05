-- Platform superadmin flag.
--
-- A superadmin is a *platform-level* operator (not a workspace role) who can
-- oversee and configure every workspace, user, and domain across the entire
-- MDL.cc instance — bypassing the per-workspace membership scoping that gates
-- the normal product API.
--
-- The column is additive and defaults to 0, so this ALTER is safe to run once
-- against an existing database. Bootstrap access is also granted by the
-- SUPERADMIN_EMAILS worker var (comma-separated allowlist), so the very first
-- operator can sign in and promote others from the admin UI without a manual
-- database edit.

ALTER TABLE users ADD COLUMN is_superadmin INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_is_superadmin ON users(is_superadmin) WHERE is_superadmin = 1;
