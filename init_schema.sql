-- alpedo_db Full Schema for PostgreSQL

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK(type IN ('income', 'expense')),
  category VARCHAR(50) NOT NULL CHECK(category IN ('fijo', 'variable', 'pasivo', 'al_pedo')),
  amount NUMERIC(15, 2) NOT NULL CHECK(amount >= 0),
  description TEXT NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  user_id INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions (type, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);

CREATE TABLE IF NOT EXISTS loan_simulations (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  installments INTEGER NOT NULL,
  monthly_payment NUMERIC(15, 2) NOT NULL,
  interest_rate NUMERIC(6, 2) DEFAULT 0,
  total_payment NUMERIC(15, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS savings_challenge (
  id VARCHAR(64) PRIMARY KEY,
  salary NUMERIC(15, 2) NOT NULL DEFAULT 3044000,
  start_month VARCHAR(10) NOT NULL DEFAULT '2026-10',
  completed_months TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Metas en Pareja (alpedo.app)
CREATE TABLE IF NOT EXISTS couples_goals (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'viaje',
  target_amount NUMERIC(15, 2) NOT NULL,
  current_amount NUMERIC(15, 2) DEFAULT 0,
  target_date DATE,
  invite_code VARCHAR(30) UNIQUE NOT NULL,
  partner_name VARCHAR(150),
  creator_name VARCHAR(150) DEFAULT 'Vos',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS couples_contributions (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER REFERENCES couples_goals(id) ON DELETE CASCADE,
  contributor_name VARCHAR(150) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  note VARCHAR(255),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rachas con Amigos & Duelos
CREATE TABLE IF NOT EXISTS friend_streaks (
  id SERIAL PRIMARY KEY,
  friend_code VARCHAR(30) UNIQUE NOT NULL,
  friend_name VARCHAR(150) NOT NULL,
  streak_count INTEGER DEFAULT 1,
  streak_type VARCHAR(50) DEFAULT 'control_al_pedo',
  last_checkin_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default Settings
INSERT INTO settings (key, value) VALUES 
('currency_symbol', '₲'),
('currency_code', 'PYG'),
('app_name', 'alpedo.app'),
('budget_al_pedo_limit', '500000'),
('budget_variable_limit', '1500000'),
('emergency_fund_saved', '0')
ON CONFLICT (key) DO NOTHING;

-- Default Savings Challenge
INSERT INTO savings_challenge (id, salary, start_month, completed_months)
VALUES ('default', 3044000, '2026-10', '[]')
ON CONFLICT (id) DO NOTHING;
