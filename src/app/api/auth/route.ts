import { NextResponse } from "next/server";
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
  getAuthLoginWaitSeconds,
  recordAuthLoginFailure,
  clearAuthLoginFailures,
} from "@/lib/auth";
import { readLimitedJsonObject } from "@/lib/request-validation";
import { clientRateLimitKey, rateLimitResponse, scopedRateLimitResponse } from "@/lib/security";

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
    const ipKey = clientRateLimitKey(req, "auth");
    if (ipKey) {
      const limited = await rateLimitResponse(ipKey, 40, 60, "auth");
      if (limited) return limited;
    }

    const parsedRequest = await readLimitedJsonObject(req, 8 * 1024);
    if (!parsedRequest.ok) {
      const tooLarge = parsedRequest.reason === "too_large";
      return NextResponse.json(
        { error: tooLarge ? "La solicitud supera el tamaño permitido" : "Formato JSON inválido" },
        { status: tooLarge ? 413 : 400 }
      );
    }
    const parsedBody = parsedRequest.value;

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
    if (action === "register" && clientKey) {
      const limited = await scopedRateLimitResponse(req, {
        scope: "auth-register",
        identity: clientKey,
        identityMaximum: 3,
        windowSeconds: 60 * 60,
        ipMaximum: 10,
      });
      if (limited) return limited;
    }
    if (action === "login" || action === "reset_pin") {
      const limited = await scopedRateLimitResponse(req, {
        scope: `auth-${action}`,
        identity: clientKey,
        identityMaximum: action === "login" ? 10 : 5,
        windowSeconds: action === "login" ? 15 * 60 : 60 * 60,
        ipMaximum: action === "login" ? 50 : 20,
      });
      if (limited) return limited;
    }
    if (action === "login" || action === "reset_pin") {
      if (!clientKey || clientKey.length > 255 || (action === "login" && !pin)) {
        return NextResponse.json({ error: "Ingresá el correo de tu cuenta" }, { status: 400 });
      }
      const waitSeconds = await getAuthLoginWaitSeconds(clientKey);
      if (waitSeconds > 0) {
        return NextResponse.json(
          { error: `Demasiados intentos. Esperá ${waitSeconds} segundos.` },
          { status: 429 }
        );
      }
    }

    if (action === "create_recovery_code") {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      const limited = await scopedRateLimitResponse(req, {
        scope: "auth-recovery-code",
        identity: String(user.id),
        identityMaximum: 4,
        windowSeconds: 60 * 60,
      });
      if (limited) return limited;
      const recoveryKey = user.email.toLowerCase();
      if (await getAuthLoginWaitSeconds(recoveryKey)) {
        return NextResponse.json({ error: "Demasiados intentos. Intentá más tarde." }, { status: 429 });
      }
      const code = await createRecoveryCode(user, pin);
      if (!code) {
        await recordAuthLoginFailure(recoveryKey);
        return NextResponse.json({ error: "PIN actual incorrecto" }, { status: 400 });
      }
      await clearAuthLoginFailures(recoveryKey);
      return NextResponse.json({ code }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "reset_pin") {
      const recoveryCode = typeof body.recoveryCode === "string" ? body.recoveryCode : "";
      if (!/^\d{6,12}$/.test(newPin)) {
        return NextResponse.json({ error: "El nuevo PIN debe tener de 6 a 12 números" }, { status: 400 });
      }
      const changed = await resetPinWithRecovery(email, recoveryCode, newPin);
      if (!changed) {
        await recordAuthLoginFailure(clientKey);
        return NextResponse.json({ error: "Correo o código de recuperación incorrecto" }, { status: 400 });
      }
      await clearAuthLoginFailures(clientKey);
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
      await clearAuthLoginFailures(clientKey);

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
        await recordAuthLoginFailure(clientKey);

        return NextResponse.json(
          { error: authResult.error || "PIN o credenciales incorrectas" },
          { status: 401 }
        );
      }

      // Success
      await clearAuthLoginFailures(clientKey);
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
      const limited = await scopedRateLimitResponse(req, {
        scope: "auth-change-pin",
        identity: String(user.id),
        identityMaximum: 5,
        windowSeconds: 60 * 60,
      });
      if (limited) return limited;
      if (!/^\d{6,12}$/.test(newPin)) {
        return NextResponse.json({ error: "El nuevo PIN debe tener entre 6 y 12 números" }, { status: 400 });
      }
      const waitSeconds = await getAuthLoginWaitSeconds(user.email);
      if (waitSeconds > 0) {
        return NextResponse.json(
          { error: `Demasiados intentos. Esperá ${waitSeconds} segundos.` },
          { status: 429 }
        );
      }
      if (!(await changePinForUser(user, oldPin, newPin))) {
        await recordAuthLoginFailure(user.email);
        return NextResponse.json({ error: "El PIN actual es incorrecto" }, { status: 400 });
      }
      await clearAuthLoginFailures(user.email);
      await createSessionCookie(user.id);
      return NextResponse.json({ success: true, message: "PIN actualizado exitosamente" });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Error en el servidor de autenticación" }, { status: 500 });
  }
}
