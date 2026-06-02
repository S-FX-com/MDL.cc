-- Scope link groups and tags to a workspace.
--
-- Previously groups and tags were created with a hardcoded user_id of
-- 'anonymous' and were global across every workspace. They are now owned by the
-- creating user and scoped to a workspace, matching how links are isolated.
--
-- These columns are new, so the ALTERs are safe to run once on an existing
-- database. Run this migration before (or together with) deploying the worker
-- build that scopes groups/tags by workspace — the API writes to these columns.

ALTER TABLE link_groups ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_link_groups_workspace_id ON link_groups(workspace_id);

ALTER TABLE tags ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tags_workspace_id ON tags(workspace_id);
