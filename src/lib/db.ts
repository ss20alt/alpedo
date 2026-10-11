import { Pool, types } from "pg";

// Parse PostgreSQL NUMERIC (OID 1700) as float instead of string
types.setTypeParser(1700, (val: string) => parseFloat(val));
// Parse PostgreSQL DATE (OID 1082) as YYYY-MM-DD string instead of Date object
types.setTypeParser(1082, (val: string) => val);

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://alpedo_user:AlPedoPy2026_SecPass!@127.0.0.1:5432/alpedo_db";

export type DbParameter = string | number | boolean | Date | Buffer | null | undefined;

// Global pool instance to prevent connection leaks during Next.js hot-reloads
declare global {
  var __pgPool: Pool | undefined;
}

const pool =
  global.__pgPool ||
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

/**
 * Execute a query with automatic '?' to '$1, $2...' parameter conversion
 */
export async function query<T = unknown>(sql: string, params: DbParameter[] = []): Promise<T[]> {
  let paramIdx = 1;
  const pgSql = sql.replace(/\?/g, () => `$${paramIdx++}`);
  const result = await pool.query(pgSql, params);
  return result.rows as T[];
}

/**
 * Execute a query and return a single row or null
 */
export async function queryOne<T = unknown>(sql: string, params: DbParameter[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

/**
 * Execute a mutation query (INSERT, UPDATE, DELETE) and return affected rowCount
 */
export async function execute(sql: string, params: DbParameter[] = []): Promise<number> {
  let paramIdx = 1;
  const pgSql = sql.replace(/\?/g, () => `$${paramIdx++}`);
  const result = await pool.query(pgSql, params);
  return result.rowCount || 0;
}

const db = {
  query,
  queryOne,
  execute,
  pool,
};

export default db;
