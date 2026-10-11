-- Assign existing couple goals to the legacy owner (user 1) and scope future reads by account.
ALTER TABLE couples_goals
  ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_couples_goals_user_status
  ON couples_goals (user_id, status, created_at DESC);
