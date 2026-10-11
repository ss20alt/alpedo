CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  currency_symbol VARCHAR(10) DEFAULT '₲',
  currency_code VARCHAR(10) DEFAULT 'PYG',
  budget_al_pedo_limit NUMERIC DEFAULT 500000,
  budget_variable_limit NUMERIC DEFAULT 1500000,
  emergency_fund_saved NUMERIC DEFAULT 0,
  account_bank VARCHAR(100) DEFAULT 'BANCO ITAÚ',
  account_type VARCHAR(100) DEFAULT 'Caja de Ahorro Principal',
  account_last4 VARCHAR(10) DEFAULT '4291',
  account_base_balance NUMERIC DEFAULT 2500000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (id, email, name, pin_hash)
VALUES (1, 'demo@alpedo.app', 'Kape Principal', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
