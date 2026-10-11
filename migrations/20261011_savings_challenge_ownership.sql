-- Keep the existing challenge with legacy user 1 and isolate future configurations by account.
ALTER TABLE savings_challenge
  ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;

ALTER TABLE savings_challenge
  ALTER COLUMN start_month SET DEFAULT to_char(CURRENT_DATE, 'YYYY-MM');

CREATE INDEX IF NOT EXISTS idx_savings_challenge_user
  ON savings_challenge (user_id);
