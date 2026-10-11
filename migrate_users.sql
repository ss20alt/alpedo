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
  account_bank VARCHAR(100) DEFAULT '',
  account_type VARCHAR(100) DEFAULT '',
  account_last4 VARCHAR(10) DEFAULT '',
  account_base_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- La primera cuenta se crea mediante el registro, sin datos de demostración.
