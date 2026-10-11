import { NextResponse } from "next/server";
import {
  isAuthenticated,
  isPinConfigured,
  getCurrentUser,
  verifyUserLogin,
  registerUser,
  setMasterPin,
  createSessionCookie,
  clearSessionCookie,
  verifyPin,
} from "@/lib/auth";

// In-Memory Rate Limiter against brute-force attacks
interface RateLimitRecord {
  attempts: number;
  blockedUntil: number;
}
const loginAttempts = new Map<string, RateLimitRecord>();

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "default_client";
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
  });
}

export async function POST(req: Request) {
  try {
    const clientKey = getClientIdentifier(req);
    const now = Date.now();
    const rateLimit = loginAttempts.get(clientKey);

    // Check rate limit timeout
    if (rateLimit && rateLimit.blockedUntil > now) {
      const waitSeconds = Math.ceil((rateLimit.blockedUntil - now) / 1000);
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Por seguridad, esperá ${waitSeconds} segundos.` },
        { status: 429 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Formato JSON inválido" }, { status: 400 });
    }

    const { action, name, email, pin, oldPin, newPin } = body || {};

    // 1. REGISTRATION (Crear cuenta nueva para probar y compartir)
    if (action === "register") {
      if (!name || name.trim().length < 2) {
        return NextResponse.json({ error: "Ingresá tu nombre o apodo (mínimo 2 letras)" }, { status: 400 });
      }
      if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "Ingresá un correo electrónico válido" }, { status: 400 });
      }
      if (!pin || pin.trim().length < 4) {
        return NextResponse.json({ error: "El PIN debe tener al menos 4 números" }, { status: 400 });
      }

      const regResult = await registerUser(name, email, pin);
      if (!regResult.success || !regResult.user) {
        return NextResponse.json({ error: regResult.error || "Error al registrar cuenta" }, { status: 400 });
      }

      // Automatically create session for the registered user
      await createSessionCookie(regResult.user.id);
      loginAttempts.delete(clientKey);

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

    // 2. LOGIN (Iniciar sesión por Email + PIN o PIN directo)
    if (action === "login") {
      let authResult;
      if (email && email.trim().length > 0) {
        // Login by Email + PIN
        authResult = await verifyUserLogin(email.trim(), pin ? pin.trim() : "");
      } else {
        // Direct PIN keypad unlock
        authResult = await verifyUserLogin(pin ? pin.trim() : "");
      }

      if (!authResult.success || !authResult.user) {
        // Record failed attempt
        const record = loginAttempts.get(clientKey) || { attempts: 0, blockedUntil: 0 };
        record.attempts += 1;
        if (record.attempts >= 5) {
          record.blockedUntil = now + 30000; // 30 seconds block
          record.attempts = 0;
        }
        loginAttempts.set(clientKey, record);

        return NextResponse.json(
          { error: authResult.error || "PIN o credenciales incorrectas" },
          { status: 401 }
        );
      }

      // Success
      loginAttempts.delete(clientKey);
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

    // 4. SETUP (Initial pin setup)
    if (action === "setup") {
      if (await isPinConfigured()) {
        return NextResponse.json({ error: "El sistema ya está configurado" }, { status: 400 });
      }
      if (!pin || pin.trim().length < 4) {
        return NextResponse.json({ error: "El PIN debe tener al menos 4 caracteres" }, { status: 400 });
      }
      await setMasterPin(pin);
      await createSessionCookie(1);
      loginAttempts.delete(clientKey);
      return NextResponse.json({ success: true, message: "PIN configurado exitosamente" });
    }

    // 5. CHANGE PIN
    if (action === "change_pin") {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      const validOld = await verifyPin(oldPin);
      if (!validOld) {
        return NextResponse.json({ error: "El PIN actual es incorrecto" }, { status: 400 });
      }
      if (!newPin || newPin.trim().length < 4) {
        return NextResponse.json({ error: "El nuevo PIN debe tener al menos 4 caracteres" }, { status: 400 });
      }
      await setMasterPin(newPin);
      return NextResponse.json({ success: true, message: "PIN actualizado exitosamente" });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error: any) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Error en el servidor de autenticación" }, { status: 500 });
  }
}
