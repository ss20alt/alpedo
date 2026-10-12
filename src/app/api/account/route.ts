import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  deleteAccountWithPin,
  getAuthLoginWaitSeconds,
  getCurrentUser,
  recordAuthLoginFailure,
} from "@/lib/auth";
import { readLimitedJsonObject } from "@/lib/request-validation";
import { enforceUserMutationRateLimit } from "@/lib/security";

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await enforceUserMutationRateLimit(req, user.id, "account-delete", 10);
  if (limited) return limited;

  const parsedBody = await readLimitedJsonObject(req);
  if (!parsedBody.ok) {
    const tooLarge = parsedBody.reason === "too_large";
    return NextResponse.json(
      { error: tooLarge ? "La solicitud supera el tamaño permitido" : "Formato JSON inválido" },
      { status: tooLarge ? 413 : 400 }
    );
  }
  const body = parsedBody.value;

  const pin = typeof body.pin === "string" ? body.pin : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
  if (confirmation !== "ELIMINAR MI CUENTA" || email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Confirmá la frase y el correo exactos de la cuenta" }, { status: 400 });
  }
  if (!/^\d{6,12}$/.test(pin)) {
    return NextResponse.json({ error: "Ingresá tu PIN actual de 6 a 12 números" }, { status: 400 });
  }

  try {
    const waitSeconds = await getAuthLoginWaitSeconds(user.email);
    if (waitSeconds > 0) {
      return NextResponse.json(
        { error: `Demasiados intentos. Esperá ${waitSeconds} segundos.` },
        { status: 429 }
      );
    }
    const deleted = await deleteAccountWithPin(user.id, pin);
    if (!deleted) {
      await recordAuthLoginFailure(user.email);
      return NextResponse.json({ error: "El PIN actual es incorrecto" }, { status: 400 });
    }
    try {
      await clearSessionCookie();
    } catch (cookieError) {
      // The DB session was already revoked atomically with account deletion.
      console.error("Could not clear the deleted account cookie:", cookieError);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "No se pudo eliminar la cuenta. No se aplicaron cambios." }, { status: 500 });
  }
}
