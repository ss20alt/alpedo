BEGIN;

ALTER TABLE couples_goals
  ADD COLUMN IF NOT EXISTS partner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_couples_goals_partner_status
  ON couples_goals (partner_user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_couples_goals_one_active_partner
  ON couples_goals (partner_user_id)
  WHERE status = 'active' AND partner_user_id IS NOT NULL;

ALTER TABLE couples_contributions
  ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_couples_contributions_goal_user_date
  ON couples_contributions (goal_id, contributor_user_id, date DESC);

CREATE TABLE IF NOT EXISTS streak_leaderboard_optins (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(40) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_streak_leaderboard_enabled
  ON streak_leaderboard_optins (enabled, updated_at DESC);

COMMIT;
