-- Add gist-based personalization columns to customizations table
ALTER TABLE customizations ADD COLUMN featured_repos TEXT;   -- JSON array: ["repo-a", "repo-b"]
ALTER TABLE customizations ADD COLUMN featured_topics TEXT;  -- JSON array: ["rust", "nushell"]
