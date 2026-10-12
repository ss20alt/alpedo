import { NextResponse } from "next/server";
import { clearSessionCookie, deleteAccountWithPin, getCurrentUser } from "@/lib/auth";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Formato JSON inválido" }, { status: 400 });
  }
  if (!isRecord(body)) return NextResponse.json({ error: "Formato JSON inválido" }, { status: 400 });

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
    const deleted = await deleteAccountWithPin(user.id, pin);
    if (!deleted) return NextResponse.json({ error: "El PIN actual es incorrecto" }, { status: 400 });
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
