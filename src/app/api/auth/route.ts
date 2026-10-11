import { NextResponse } from "next/server";
import db from "@/lib/db";
import {
  isPinConfigured,
  getCurrentUser,
  verifyUserLogin,
  registerUser,
  changePinForUser,
  createSessionCookie,
  clearSessionCookie,
  createRecoveryCode,
  resetPinWithRecovery,
} from "@/lib/auth";

let loginLimitsReady: Promise<void> | null = null;

async function ensureLoginLimits() {
  if (!loginLimitsReady) {
    loginLimitsReady = db.execute(`CREATE TABLE IF NOT EXISTS auth_login_limits (
      email TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      blocked_until TIMESTAMPTZ
    )`).then(() => undefined).catch((error) => {
      loginLimitsReady = null;
      throw error;
    });
  }
  await loginLimitsReady;
}

async function recordFailedLogin(email: string) {
  await db.execute(
    `INSERT INTO auth_login_limits (email, attempts) VALUES (?, 1)
     ON CONFLICT (email) DO UPDATE SET
       attempts = CASE
         WHEN auth_login_limits.blocked_until IS NOT NULL AND auth_login_limits.blocked_until <= NOW()
         THEN 1 ELSE auth_login_limits.attempts + 1 END,
       blocked_until = CASE
         WHEN auth_login_limits.blocked_until IS NOT NULL AND auth_login_limits.blocked_until <= NOW()
         THEN NULL
         WHEN auth_login_limits.attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes'
         ELSE NULL END`,
    [email]
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const user = await getCurrentUser();
  const configured = await isPinConfigured();

  return NextResponse.json({
    authenticated: user !== null,
    isPinConfigured: configured,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          currency_symbol: user.currency_symbol,
          currency_code: user.currency_code,
        }
      : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    let parsedBody: unknown;
    try {
      parsedBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Formato JSON inválido" }, { status: 400 });
    }

    if (!isRecord(parsedBody)) {
      return NextResponse.json({ error: "Formato JSON inválido" }, { status: 400 });
    }
    const body = parsedBody;
    const action = typeof body.action === "string" ? body.action : "";
    const name = typeof body.name === "string" ? body.name : "";
    const email = typeof body.email === "string" ? body.email : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    const oldPin = typeof body.oldPin === "string" ? body.oldPin : "";
    const newPin = typeof body.newPin === "string" ? body.newPin : "";
    const clientKey = email.trim().toLowerCase();
    if (action === "login" || action === "reset_pin") {
      if (!clientKey || clientKey.length > 255 || (action === "login" && !pin)) {
        return NextResponse.json({ error: "Ingresá el correo de tu cuenta" }, { status: 400 });
      }
      await ensureLoginLimits();
      const rateLimit = await db.queryOne<{ blocked_until: Date | null }>(
        "SELECT blocked_until FROM auth_login_limits WHERE email = ?", [clientKey]
      );
      if (rateLimit?.blocked_until && new Date(rateLimit.blocked_until).getTime() > Date.now()) {
        const waitSeconds = Math.ceil((new Date(rateLimit.blocked_until).getTime() - Date.now()) / 1000);
        return NextResponse.json(
          { error: `Demasiados intentos. Esperá ${waitSeconds} segundos.` },
          { status: 429 }
        );
      }
    }

    if (action === "create_recovery_code") {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      const recoveryKey = user.email.toLowerCase();
      await ensureLoginLimits();
      const limit = await db.queryOne<{ blocked_until: Date | null }>(
        "SELECT blocked_until FROM auth_login_limits WHERE email = ?", [recoveryKey]
      );
      if (limit?.blocked_until && new Date(limit.blocked_until).getTime() > Date.now()) {
        return NextResponse.json({ error: "Demasiados intentos. Intentá más tarde." }, { status: 429 });
      }
      const code = await createRecoveryCode(user, pin);
      if (!code) {
        await recordFailedLogin(recoveryKey);
        return NextResponse.json({ error: "PIN actual incorrecto" }, { status: 400 });
      }
      await db.execute("DELETE FROM auth_login_limits WHERE email = ?", [recoveryKey]);
      return NextResponse.json({ code }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "reset_pin") {
      const recoveryCode = typeof body.recoveryCode === "string" ? body.recoveryCode : "";
      if (!/^\d{6,12}$/.test(newPin)) {
        return NextResponse.json({ error: "El nuevo PIN debe tener de 6 a 12 números" }, { status: 400 });
      }
      const changed = await resetPinWithRecovery(email, recoveryCode, newPin);
      if (!changed) {
        await recordFailedLogin(clientKey);
        return NextResponse.json({ error: "Correo o código de recuperación incorrecto" }, { status: 400 });
      }
      await db.execute("DELETE FROM auth_login_limits WHERE email = ?", [clientKey]);
      return NextResponse.json({ success: true, message: "PIN actualizado. Iniciá sesión con el nuevo PIN." });
    }

    // 1. REGISTRATION (Crear cuenta nueva para probar y compartir)
    if (action === "register") {
      if (!name || name.trim().length < 2) {
        return NextResponse.json({ error: "Ingresá tu nombre o apodo (mínimo 2 letras)" }, { status: 400 });
      }
      if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "Ingresá un correo electrónico válido" }, { status: 400 });
      }
      if (!/^\d{6,12}$/.test(pin)) {
        return NextResponse.json({ error: "El PIN debe tener entre 6 y 12 números" }, { status: 400 });
      }

      const regResult = await registerUser(name, email, pin);
      if (!regResult.success || !regResult.user) {
        return NextResponse.json({ error: regResult.error || "Error al registrar cuenta" }, { status: 400 });
      }

      // Automatically create session for the registered user
      await createSessionCookie(regResult.user.id);
      await ensureLoginLimits();
      await db.execute("DELETE FROM auth_login_limits WHERE email = ?", [clientKey]);

      return NextResponse.json({
        success: true,
        message: `¡Bienvenido a alpedo.app, ${regResult.user.name}! Cuenta creada exitosamente.`,
        user: {
          id: regResult.user.id,
          name: regResult.user.name,
          email: regResult.user.email,
        },
      });
    }

    // Login is always scoped to one account.
    if (action === "login") {
      const authResult = await verifyUserLogin(email, pin);

      if (!authResult.success || !authResult.user) {
        await recordFailedLogin(clientKey);

        return NextResponse.json(
          { error: authResult.error || "PIN o credenciales incorrectas" },
          { status: 401 }
        );
      }

      // Success
      await db.execute("DELETE FROM auth_login_limits WHERE email = ?", [clientKey]);
      await createSessionCookie(authResult.user.id);

      return NextResponse.json({
        success: true,
        message: `Bienvenido de nuevo, ${authResult.user.name}`,
        user: {
          id: authResult.user.id,
          name: authResult.user.name,
          email: authResult.user.email,
        },
      });
    }

    // 3. LOGOUT
    if (action === "logout") {
      await clearSessionCookie();
      return NextResponse.json({ success: true, message: "Sesión cerrada correctamente" });
    }

    // Change only the authenticated account's PIN.
    if (action === "change_pin") {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      if (!/^\d{6,12}$/.test(newPin)) {
        return NextResponse.json({ error: "El nuevo PIN debe tener entre 6 y 12 números" }, { status: 400 });
      }
      if (!(await changePinForUser(user, oldPin, newPin))) {
        return NextResponse.json({ error: "El PIN actual es incorrecto" }, { status: 400 });
      }
      await createSessionCookie(user.id);
      return NextResponse.json({ success: true, message: "PIN actualizado exitosamente" });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Error en el servidor de autenticación" }, { status: 500 });
  }
}
