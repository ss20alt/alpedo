ALTER TABLE loan_simulations
  ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_loan_simulations_user_created
  ON loan_simulations (user_id, created_at DESC);
