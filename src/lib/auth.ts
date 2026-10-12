import crypto from "crypto";
import db from "./db";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "finanzas_auth_session";
let sessionsReady: Promise<void> | null = null;
let recoveryReady: Promise<void> | null = null;

export interface User {
  id: number;
  email: string;
  name: string;
  pin_hash: string;
  currency_symbol: string;
  currency_code: string;
  budget_al_pedo_limit: number;
  budget_variable_limit: number;
  emergency_fund_saved: number;
  account_bank: string;
  account_type: string;
  account_last4: string;
  account_base_balance: number;
  created_at: string;
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${crypto.scryptSync(pin, salt, 64).toString("hex")}`;
}

function pinMatches(pin: string, stored: string): boolean {
  try {
    const parts = stored.split(":");
    const expected = parts.length === 3 && parts[0] === "scrypt"
      ? Buffer.from(parts[2], "hex")
      : Buffer.from(stored, "hex");
    const actual = parts.length === 3 && parts[0] === "scrypt"
      ? crypto.scryptSync(pin, parts[1], expected.length)
      : crypto.createHash("sha256").update(pin).digest();
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch { return false; }
}

async function ensureSessionsTable() {
  if (!sessionsReady) {
    sessionsReady = db.execute(`CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )`).then(() => undefined).catch((error) => {
      sessionsReady = null;
      throw error;
    });
  }
  await sessionsReady;
}

async function ensureRecoveryTable() {
  if (!recoveryReady) {
    recoveryReady = db.execute(`CREATE TABLE IF NOT EXISTS auth_recovery_codes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      code_hash CHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).then(() => undefined).catch((error) => {
      recoveryReady = null;
      throw error;
    });
  }
  await recoveryReady;
}

export async function createRecoveryCode(user: User, currentPin: string): Promise<string | null> {
  if (!pinMatches(currentPin.trim(), user.pin_hash)) return null;
  await ensureRecoveryTable();
  const raw = crypto.randomBytes(16).toString("hex").toUpperCase();
  const code = raw.match(/.{1,8}/g)!.join("-");
  await db.execute(
    `INSERT INTO auth_recovery_codes (user_id, code_hash, created_at) VALUES (?, ?, NOW())
     ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, created_at = NOW()`,
    [user.id, crypto.createHash("sha256").update(raw.toLowerCase()).digest("hex")]
  );
  return code;
}

export async function resetPinWithRecovery(email: string, code: string, newPin: string): Promise<boolean> {
  const normalized = code.replace(/[-\s]/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(normalized) || !/^\d{6,12}$/.test(newPin)) return false;
  const user = await db.queryOne<User>("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
  if (!user) return false;
  await ensureRecoveryTable();
  await ensureSessionsTable();
  const codeHash = crypto.createHash("sha256").update(normalized).digest("hex");
  return db.withTransaction(async () => {
    const consumed = await db.execute(
      "DELETE FROM auth_recovery_codes WHERE user_id = ? AND code_hash = ?",
      [user.id, codeHash]
    );
    if (consumed !== 1) return false;
    await db.execute("UPDATE users SET pin_hash = ? WHERE id = ?", [hashPin(newPin), user.id]);
    await db.execute("DELETE FROM auth_sessions WHERE user_id = ?", [user.id]);
    return true;
  });
}

export async function isPinConfigured(): Promise<boolean> {
  const row = await db.queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM users");
  return Number(row?.count || 0) > 0;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    await ensureSessionsTable();
    return await db.queryOne<User>(
      `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > NOW()`,
      [crypto.createHash("sha256").update(token).digest("hex")]
    );
  } catch { return null; }
}

export async function verifyUserLogin(email: string, pin: string): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!email.trim() || !pin) return { success: false, error: "Ingresá tu correo y PIN" };
  try {
    const user = await db.queryOne<User>("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
    if (!user) {
      crypto.scryptSync(pin.trim(), "unknown-account-salt", 64);
      return { success: false, error: "Correo o PIN incorrecto" };
    }
    if (!pinMatches(pin.trim(), user.pin_hash)) {
      return { success: false, error: "Correo o PIN incorrecto" };
    }
    if (!user.pin_hash.startsWith("scrypt:")) {
      await db.execute("UPDATE users SET pin_hash = ? WHERE id = ?", [hashPin(pin.trim()), user.id]);
    }
    return { success: true, user };
  } catch { return { success: false, error: "No se pudo iniciar sesión" }; }
}

export async function registerUser(name: string, email: string, pin: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 100) return { success: false, error: "Ingresá un nombre de 2 a 100 caracteres" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { success: false, error: "Ingresá un correo válido" };
  if (!/^\d{6,12}$/.test(pin)) return { success: false, error: "Elegí un PIN de 6 a 12 números" };
  try {
    const user = await db.queryOne<User>(
      `INSERT INTO users (name, email, pin_hash, currency_symbol, currency_code,
       budget_al_pedo_limit, budget_variable_limit, emergency_fund_saved,
       account_bank, account_type, account_last4, account_base_balance)
       VALUES (?, ?, ?, '₲', 'PYG', 500000, 1500000, 0, '', '', '', 0)
       RETURNING *`,
      [cleanName, cleanEmail, hashPin(pin)]
    );
    return user ? { success: true, user } : { success: false, error: "No se pudo crear la cuenta" };
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return { success: false, error: "Este correo ya está registrado" };
    }
    return { success: false, error: "No se pudo crear la cuenta" };
  }
}

export async function changePinForUser(user: User, oldPin: string, newPin: string): Promise<boolean> {
  if (!pinMatches(oldPin.trim(), user.pin_hash) || !/^\d{6,12}$/.test(newPin)) return false;
  await ensureSessionsTable();
  await ensureRecoveryTable();
  await db.withTransaction(async () => {
    await db.execute("UPDATE users SET pin_hash = ? WHERE id = ?", [hashPin(newPin), user.id]);
    await db.execute("DELETE FROM auth_sessions WHERE user_id = ?", [user.id]);
    await db.execute("DELETE FROM auth_recovery_codes WHERE user_id = ?", [user.id]);
  });
  return true;
}

/** Permanently removes one account and its private data after PIN verification. */
export async function deleteAccountWithPin(userId: number, currentPin: string): Promise<boolean> {
  if (!Number.isInteger(userId) || userId < 1 || !/^\d{6,12}$/.test(currentPin)) return false;
  await ensureSessionsTable();
  await ensureRecoveryTable();

  return db.withTransaction(async () => {
    const user = await db.queryOne<User>("SELECT * FROM users WHERE id = ? FOR UPDATE", [userId]);
    if (!user || !pinMatches(currentPin, user.pin_hash)) return false;

    const friendCodeKey = userId === 1 ? "my_friend_code" : `my_friend_code_${userId}`;
    const friendCode = await db.queryOne<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [friendCodeKey]
    );

    // Remove references to this participant while preserving other users' own data.
    if (friendCode?.value) {
      await db.execute("DELETE FROM friend_streaks WHERE friend_code = ?", [friendCode.value]);
    }
    await db.execute("DELETE FROM friend_streaks WHERE user_id = ?", [userId]);
    await db.execute("DELETE FROM streak_leaderboard_optins WHERE user_id = ?", [userId]);

    // A goal owned by this account (and its full contribution history) is deleted.
    await db.execute(
      "DELETE FROM couples_contributions WHERE goal_id IN (SELECT id FROM couples_goals WHERE user_id = ?)",
      [userId]
    );
    await db.execute("DELETE FROM couples_goals WHERE user_id = ?", [userId]);
    // Preserve another person's goal and total, but detach and anonymize this participant.
    await db.execute(
      "UPDATE couples_contributions SET contributor_user_id = NULL, contributor_name = 'Cuenta eliminada' WHERE contributor_user_id = ?",
      [userId]
    );
    await db.execute(
      "UPDATE couples_goals SET partner_user_id = NULL, partner_name = NULL WHERE partner_user_id = ?",
      [userId]
    );

    await db.execute("DELETE FROM transactions WHERE user_id = ? OR (user_id IS NULL AND ? = 1)", [userId, userId]);
    await db.execute("DELETE FROM loan_simulations WHERE user_id = ?", [userId]);
    await db.execute("DELETE FROM savings_challenge WHERE user_id = ?", [userId]);
    await db.execute("DELETE FROM auth_sessions WHERE user_id = ?", [userId]);
    await db.execute("DELETE FROM auth_recovery_codes WHERE user_id = ?", [userId]);
    await db.execute("DELETE FROM auth_login_limits WHERE LOWER(email) = LOWER(?)", [user.email]);

    const accountKeys = [
      friendCodeKey,
      `streak_tracking_start_${userId}`,
      `my_friend_code_${userId}`,
    ];
    if (userId === 1) {
      accountKeys.push(
        "budget_al_pedo_limit",
        "budget_variable_limit",
        "emergency_fund_saved",
        "account_bank",
        "account_type",
        "account_last4",
        "account_base_balance",
      );
    }
    await db.execute(
      `DELETE FROM settings WHERE key IN (${accountKeys.map(() => "?").join(", ")})`,
      accountKeys
    );

    return (await db.execute("DELETE FROM users WHERE id = ?", [userId])) === 1;
  });
}

export async function isAuthenticated(): Promise<boolean> { return (await getCurrentUser()) !== null; }
export async function checkAuth(): Promise<boolean> { return (await getCurrentUser()) !== null; }

export async function createSessionCookie(userId: number): Promise<string> {
  await ensureSessionsTable();
  await db.execute("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
  const token = crypto.randomBytes(32).toString("hex");
  await db.execute(
    "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL '30 days')",
    [crypto.createHash("sha256").update(token).digest("hex"), userId]
  );
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.ENABLE_HTTPS === "true", sameSite: "lax",
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await ensureSessionsTable();
    await db.execute("DELETE FROM auth_sessions WHERE token_hash = ?", [crypto.createHash("sha256").update(token).digest("hex")]);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
