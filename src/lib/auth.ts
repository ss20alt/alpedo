import crypto from "crypto";
import db from "./db";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "finanzas_auth_session";
const COOKIE_SECRET = process.env.SESSION_SECRET || "finanzas-secret-key-production-change-me";

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
  return crypto.createHash("sha256").update(pin.trim()).digest("hex");
}

export function signToken(data: string): string {
  const hmac = crypto.createHmac("sha256", COOKIE_SECRET);
  hmac.update(data);
  const signature = hmac.digest("hex");
  return `${data}.${signature}`;
}

export function verifyToken(token: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [data, signature] = token.split(".");
  if (!data || !signature) return false;
  const hmac = crypto.createHmac("sha256", COOKIE_SECRET);
  hmac.update(data);
  const expectedSig = hmac.digest("hex");
  if (signature.length !== expectedSig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature, "utf-8"), Buffer.from(expectedSig, "utf-8"));
}

export async function isPinConfigured(): Promise<boolean> {
  // Check if at least 1 user exists or settings pin
  try {
    const userCount = await db.queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users");
    if (parseInt(userCount?.count || "0", 10) > 0) return true;
  } catch {
    // ignore
  }

  if (process.env.APP_PIN) return true;

  try {
    const row = await db.queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'pin_hash'");
    return Boolean(row?.value);
  } catch {
    return false;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) return null;
    if (!verifyToken(sessionCookie.value)) return null;

    const [data] = sessionCookie.value.split(".");
    let userId = 1;

    if (data.startsWith("uid_")) {
      const parts = data.split("_");
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) userId = parsed;
    }

    const user = await db.queryOne<User>("SELECT * FROM users WHERE id = ?", [userId]);
    return user || null;
  } catch {
    return null;
  }
}

export async function verifyUserLogin(
  emailOrPin: string,
  explicitPin?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const cleanInput = emailOrPin.trim();

  try {
    // Case 1: Email + PIN provided
    if (explicitPin !== undefined) {
      const user = await db.queryOne<User>(
        "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
        [cleanInput]
      );
      if (!user) {
        return { success: false, error: "Usuario o correo no encontrado" };
      }
      const enteredHash = hashPin(explicitPin);
      if (
        enteredHash.length === user.pin_hash.length &&
        crypto.timingSafeEqual(Buffer.from(enteredHash, "utf-8"), Buffer.from(user.pin_hash, "utf-8"))
      ) {
        return { success: true, user };
      }
      return { success: false, error: "PIN incorrecto" };
    }

    // Case 2: Only 4-digit PIN provided (Direct unlock)
    // Check against user 1 first (default demo user) or matching users
    const enteredHash = hashPin(cleanInput);
    const users = await db.query<User>("SELECT * FROM users ORDER BY id ASC");

    // Match exact hash
    for (const u of users) {
      if (
        enteredHash.length === u.pin_hash.length &&
        crypto.timingSafeEqual(Buffer.from(enteredHash, "utf-8"), Buffer.from(u.pin_hash, "utf-8"))
      ) {
        return { success: true, user: u };
      }
    }

    // Also check env pin fallback
    if (process.env.APP_PIN) {
      const envPin = process.env.APP_PIN.trim();
      if (
        cleanInput.length === envPin.length &&
        crypto.timingSafeEqual(Buffer.from(cleanInput, "utf-8"), Buffer.from(envPin, "utf-8"))
      ) {
        const u1 = users[0] || (await db.queryOne<User>("SELECT * FROM users WHERE id = 1"));
        if (u1) return { success: true, user: u1 };
      }
    }

    return { success: false, error: "PIN incorrecto" };
  } catch (err: any) {
    return { success: false, error: "Error en base de datos al autenticar" };
  }
}

export async function registerUser(
  name: string,
  email: string,
  pin: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPin = pin.trim();

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: "El nombre debe tener al menos 2 caracteres" };
  }
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Ingresá un correo electrónico válido" };
  }
  if (!cleanPin || cleanPin.length < 4) {
    return { success: false, error: "El PIN debe tener al menos 4 números o caracteres" };
  }

  try {
    // Check if email already exists
    const existing = await db.queryOne<{ id: number }>(
      "SELECT id FROM users WHERE LOWER(email) = LOWER(?)",
      [cleanEmail]
    );
    if (existing) {
      return { success: false, error: "Este correo ya está registrado. Probá iniciar sesión con tu PIN." };
    }

    const hashedPin = hashPin(cleanPin);

    // Insert user
    const newUser = await db.queryOne<User>(
      `INSERT INTO users (
        name, 
        email, 
        pin_hash, 
        currency_symbol, 
        currency_code, 
        budget_al_pedo_limit, 
        budget_variable_limit, 
        emergency_fund_saved, 
        account_bank, 
        account_type, 
        account_last4, 
        account_base_balance
      ) VALUES (?, ?, ?, '₲', 'PYG', 500000, 1500000, 0, 'BANCO ITAÚ', 'Caja de Ahorro Principal', '4291', 2500000)
      RETURNING *`,
      [cleanName, cleanEmail, hashedPin]
    );

    if (!newUser) {
      return { success: false, error: "No se pudo crear la cuenta" };
    }

    // Seed realistic initial Paraguayan sample transactions so the user can immediately test!
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = String(today.getMonth() + 1).padStart(2, "0");
    const dStr = (day: number) => `${curYear}-${curMonth}-${String(day).padStart(2, "0")}`;

    const starterTx = [
      {
        id: `tx_${newUser.id}_1`,
        type: "income",
        category: "fijo",
        amount: 4500000,
        description: "Sueldo mensual neto",
        date: dStr(5),
        is_recurring: true,
      },
      {
        id: `tx_${newUser.id}_2`,
        type: "expense",
        category: "fijo",
        amount: 1400000,
        description: "Alquiler / Vivienda",
        date: dStr(6),
        is_recurring: true,
      },
      {
        id: `tx_${newUser.id}_3`,
        type: "expense",
        category: "variable",
        amount: 380000,
        description: "Superseis compras del mes",
        date: dStr(8),
        is_recurring: false,
      },
      {
        id: `tx_${newUser.id}_4`,
        type: "expense",
        category: "al_pedo",
        amount: 45000,
        description: "Lomito y gaseosa nocturna",
        date: dStr(10),
        is_recurring: false,
      },
      {
        id: `tx_${newUser.id}_5`,
        type: "expense",
        category: "al_pedo",
        amount: 28000,
        description: "Bolt regreso a casa",
        date: dStr(11),
        is_recurring: false,
      },
    ];

    for (const tx of starterTx) {
      await db.execute(
        `INSERT INTO transactions (id, type, category, amount, description, date, is_recurring, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        [tx.id, tx.type, tx.category, tx.amount, tx.description, tx.date, tx.is_recurring, newUser.id]
      );
    }

    return { success: true, user: newUser };
  } catch (err: any) {
    console.error("Error registering user:", err);
    return { success: false, error: err.message || "Error al crear la cuenta" };
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const result = await verifyUserLogin(pin);
  return result.success;
}

export async function setMasterPin(pin: string): Promise<void> {
  const hashed = hashPin(pin.trim());
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ('pin_hash', ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
    [hashed]
  );
  // Also update user 1
  await db.execute("UPDATE users SET pin_hash = ? WHERE id = 1", [hashed]);
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

export async function checkAuth(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

export async function createSessionCookie(userId: number = 1): Promise<string> {
  const timestamp = Date.now().toString();
  const token = signToken(`uid_${userId}_${timestamp}`);
  const cookieStore = await cookies();
  const isHttps = process.env.ENABLE_HTTPS === "true";
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return token;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
