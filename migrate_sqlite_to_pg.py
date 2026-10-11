import sqlite3
import psycopg2
import os

sqlite_path = "/home/ubuntu/finanzas-inteligentes/data/finanzas.db"
pg_conn_str = "postgresql://alpedo_user:AlPedoPy2026_SecPass!@127.0.0.1:5432/alpedo_db"

if not os.path.exists(sqlite_path):
    print("SQLite DB not found at", sqlite_path)
    exit(1)

s_conn = sqlite3.connect(sqlite_path)
s_cur = s_conn.cursor()

p_conn = psycopg2.connect(pg_conn_str)
p_cur = p_conn.cursor()

# 1. Migrate settings
s_cur.execute("SELECT key, value FROM settings")
for k, v in s_cur.fetchall():
    p_cur.execute("""
        INSERT INTO settings (key, value) VALUES (%s, %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    """, (k, v))
print("Settings migrated.")

# 2. Migrate transactions
s_cur.execute("SELECT id, type, category, amount, description, date, is_recurring, created_at FROM transactions")
txs = s_cur.fetchall()
migrated_txs = 0
for row in txs:
    id_val, type_val, cat_val, amt_val, desc_val, date_val, rec_val, created_val = row
    p_cur.execute("""
        INSERT INTO transactions (id, type, category, amount, description, date, is_recurring, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
    """, (str(id_val), type_val, cat_val, amt_val, desc_val, date_val, bool(rec_val), created_val))
    migrated_txs += 1
print(f"Transactions migrated: {migrated_txs} rows.")

# 3. Migrate loan simulations
try:
    s_cur.execute("SELECT id, title, amount, installments, monthly_payment, interest_rate, total_payment, notes, created_at FROM loan_simulations")
    for row in s_cur.fetchall():
        p_cur.execute("""
            INSERT INTO loan_simulations (id, title, amount, installments, monthly_payment, interest_rate, total_payment, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, row)
    print("Loan simulations migrated.")
except Exception as e:
    print("Loan simulations note:", e)

# 4. Migrate savings challenge
try:
    s_cur.execute("SELECT id, salary, start_month, completed_months FROM savings_challenge")
    for row in s_cur.fetchall():
        p_cur.execute("""
            INSERT INTO savings_challenge (id, salary, start_month, completed_months)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET salary = EXCLUDED.salary, completed_months = EXCLUDED.completed_months
        """, row)
    print("Savings challenge migrated.")
except Exception as e:
    print("Savings challenge note:", e)

p_conn.commit()

# Verify counts in PostgreSQL
p_cur.execute("SELECT count(*) FROM transactions")
print("PostgreSQL Total Transactions:", p_cur.fetchone()[0])

s_conn.close()
p_conn.close()
print("Migration completed successfully!")
