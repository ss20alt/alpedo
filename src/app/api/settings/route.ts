import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const rows = await db.query<{ key: string; value: string }>("SELECT key, value FROM settings");
    const settingsObj: Record<string, string> = {};
    for (const r of rows) {
      if (r.key !== "pin_hash") {
        settingsObj[r.key] = r.value;
      }
    }

    // Overlay user-specific settings
    settingsObj["user_name"] = user.name;
    settingsObj["user_email"] = user.email;
    settingsObj["currency_symbol"] = user.currency_symbol || settingsObj["currency_symbol"] || "₲";
    settingsObj["currency_code"] = user.currency_code || settingsObj["currency_code"] || "PYG";
    settingsObj["budget_al_pedo_limit"] = String(user.budget_al_pedo_limit ?? 500000);
    settingsObj["budget_variable_limit"] = String(user.budget_variable_limit ?? 1500000);
    settingsObj["emergency_fund_saved"] = String(user.emergency_fund_saved ?? 0);
    settingsObj["account_bank"] = user.account_bank || "BANCO ITAÚ";
    settingsObj["account_type"] = user.account_type || "Caja de Ahorro Principal";
    settingsObj["account_last4"] = user.account_last4 || "4291";
    settingsObj["account_base_balance"] = String(user.account_base_balance ?? 2500000);

    return NextResponse.json(settingsObj);
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

  try {
    const body = await req.json();

    // Update in users table
    const updates: string[] = [];
    const params: any[] = [];

    const userFields = [
      "currency_symbol",
      "currency_code",
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
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
      }
    }

    if (updates.length > 0) {
      params.push(user.id);
      await db.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    }

    // Also update global settings fallback if user 1
    if (user.id === 1) {
      const allowedKeys = [
        "currency_symbol",
        "currency_code",
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
        if (body[key] !== undefined) {
          const val = String(body[key]);
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
