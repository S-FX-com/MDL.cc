-- Add workspace_id to existing links table
ALTER TABLE links ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_links_workspace_id ON links(workspace_id);
