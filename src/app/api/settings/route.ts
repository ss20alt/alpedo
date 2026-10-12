import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readLimitedJsonObject } from "@/lib/request-validation";
import type { DbParameter } from "@/lib/db";
import { enforceUserMutationRateLimit } from "@/lib/security";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const rows = user.id === 1
      ? await db.query<{ key: string; value: string }>(
          "SELECT key, value FROM settings WHERE key IN ('app_name')"
        )
      : [];
    const settingsObj: Record<string, string> = {};
    for (const r of rows) {
      if (r.key !== "pin_hash") {
        settingsObj[r.key] = r.value;
      }
    }

    // Overlay user-specific settings
    settingsObj["user_name"] = user.name;
    settingsObj["user_email"] = user.email;
    settingsObj["currency_symbol"] = "₲";
    settingsObj["currency_code"] = "PYG";
    settingsObj["budget_al_pedo_limit"] = String(user.budget_al_pedo_limit ?? 500000);
    settingsObj["budget_variable_limit"] = String(user.budget_variable_limit ?? 1500000);
    settingsObj["emergency_fund_saved"] = String(user.emergency_fund_saved ?? 0);
    settingsObj["account_bank"] = user.account_bank || "";
    settingsObj["account_type"] = user.account_type || "";
    settingsObj["account_last4"] = user.account_last4 || "";
    settingsObj["account_base_balance"] = String(user.account_base_balance ?? 0);

    return NextResponse.json(settingsObj, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Error fetching settings:", err);
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const limited = await enforceUserMutationRateLimit(req, user.id, "settings-write");
  if (limited) return limited;

  try {
    const parsedBody = await readLimitedJsonObject(req);
    if (!parsedBody.ok) {
      const tooLarge = parsedBody.reason === "too_large";
      return NextResponse.json(
        { error: tooLarge ? "La solicitud supera el tamaño permitido" : "Formato JSON inválido" },
        { status: tooLarge ? 413 : 400 }
      );
    }
    const body = parsedBody.value;
    if ((body.currency_code !== undefined && body.currency_code !== "PYG") ||
        (body.currency_symbol !== undefined && body.currency_symbol !== "₲")) {
      return NextResponse.json({ error: "Por ahora solo se admiten importes en guaraníes" }, { status: 400 });
    }
    for (const key of ["budget_al_pedo_limit", "budget_variable_limit", "emergency_fund_saved", "account_base_balance"]) {
      if (body[key] !== undefined && (typeof body[key] !== "number" ||
          !Number.isFinite(body[key]) || Number(body[key]) < 0 || Number(body[key]) > 1_000_000_000_000)) {
        return NextResponse.json({ error: `Monto inválido: ${key}` }, { status: 400 });
      }
    }
    for (const key of ["account_bank", "account_type", "name"]) {
      if (body[key] !== undefined && (typeof body[key] !== "string" || String(body[key]).length > 100)) {
        return NextResponse.json({ error: `Texto inválido: ${key}` }, { status: 400 });
      }
    }
    if (body.account_last4 !== undefined &&
        (typeof body.account_last4 !== "string" || !/^\d{0,4}$/.test(body.account_last4))) {
      return NextResponse.json({ error: "Los últimos dígitos de cuenta no son válidos" }, { status: 400 });
    }

    // Update in users table
    const updates: string[] = [];
    const params: DbParameter[] = [];

    const userFields = [
      "budget_al_pedo_limit",
      "budget_variable_limit",
      "emergency_fund_saved",
      "account_bank",
      "account_type",
      "account_last4",
      "account_base_balance",
      "name",
    ];

    for (const field of userFields) {
      const value = body[field];
      if (typeof value === "string" || typeof value === "number") {
        updates.push(`${field} = ?`);
        params.push(value);
      }
    }

    if (updates.length > 0) {
      params.push(user.id);
      await db.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    }

    // Also update global settings fallback if user 1
    if (user.id === 1) {
      const allowedKeys = [
        "app_name",
        "budget_al_pedo_limit",
        "budget_variable_limit",
        "emergency_fund_saved",
        "account_bank",
        "account_type",
        "account_last4",
        "account_base_balance",
      ];
      for (const key of allowedKeys) {
        const value = body[key];
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          const val = String(value);
          await db.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
            [key, val]
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating settings:", err);
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 });
  }
}
