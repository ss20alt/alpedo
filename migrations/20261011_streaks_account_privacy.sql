-- Keep existing friend rows with legacy account 1 and isolate future duels per account.
ALTER TABLE friend_streaks
  ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;

ALTER TABLE friend_streaks
  DROP CONSTRAINT IF EXISTS friend_streaks_friend_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_streaks_user_code
  ON friend_streaks (user_id, friend_code);

CREATE INDEX IF NOT EXISTS idx_friend_streaks_user_name
  ON friend_streaks (user_id, friend_name);
