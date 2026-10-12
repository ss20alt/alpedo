import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readLimitedJsonObject } from "@/lib/request-validation";
import { enforceUserMutationRateLimit } from "@/lib/security";
import { getParaguayMonthString } from "@/lib/date-utils";

interface ChallengeRow {
  id: string;
  salary: number;
  start_month: string;
  completed_months: string;
  user_id: number;
  updated_at: string;
}

const defaultSalary = 0;

function getChallengeId(userId: number) {
  // Preserve the legacy row for user 1 while keeping each additional account separate.
  return userId === 1 ? "default" : `user-${userId}`;
}

function parseCompletedMonths(raw: string | undefined): number[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((month): month is number => Number.isInteger(month) && month >= 1 && month <= 12))]
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function validMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const row = await db.queryOne<ChallengeRow>(
      "SELECT * FROM savings_challenge WHERE id = ? AND user_id = ?",
      [getChallengeId(user.id), user.id]
    );

    return NextResponse.json({
      salary: row ? Number(row.salary) || defaultSalary : defaultSalary,
      start_month: row?.start_month || getParaguayMonthString(),
      completed_months: parseCompletedMonths(row?.completed_months),
    });
  } catch (err) {
    console.error("Error fetching challenge:", err);
    return NextResponse.json({ error: "Error al obtener reto" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await enforceUserMutationRateLimit(req, user.id, "challenge-write", 60);
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
    const { action } = body;
    const challengeId = getChallengeId(user.id);
    const row = await db.queryOne<ChallengeRow>(
      "SELECT * FROM savings_challenge WHERE id = ? AND user_id = ?",
      [challengeId, user.id]
    );

    let salary = row ? Number(row.salary) || defaultSalary : defaultSalary;
    let startMonth = row?.start_month || getParaguayMonthString();
    const completedMonths = parseCompletedMonths(row?.completed_months);

    if (action === "update_config") {
      if (body.salary !== undefined) {
        const parsedSalary = Number(body.salary);
        if (!Number.isFinite(parsedSalary) || parsedSalary <= 0 || parsedSalary > 9999999999999.99) {
          return NextResponse.json({ error: "Ingresá un salario válido mayor que cero" }, { status: 400 });
        }
        salary = parsedSalary;
      }
      if (body.start_month !== undefined) {
        if (!validMonth(body.start_month)) {
          return NextResponse.json({ error: "Elegí un mes de inicio válido" }, { status: 400 });
        }
        startMonth = body.start_month;
      }
    } else if (action === "toggle_month") {
      if (salary <= 0) {
        return NextResponse.json({ error: "Configurá y guardá tu salario antes de marcar aportes" }, { status: 400 });
      }
      const monthIndex = Number(body.month_index);
      if (!Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) {
        return NextResponse.json({ error: "El mes seleccionado no es válido" }, { status: 400 });
      }
      const index = completedMonths.indexOf(monthIndex);
      if (index >= 0) completedMonths.splice(index, 1);
      else completedMonths.push(monthIndex);
      completedMonths.sort((a, b) => a - b);
    } else if (action === "reset") {
      completedMonths.length = 0;
    } else {
      return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
    }

    await db.execute(
      `INSERT INTO savings_challenge (id, salary, start_month, completed_months, updated_at, user_id)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
       ON CONFLICT(id) DO UPDATE SET
         salary = EXCLUDED.salary,
         start_month = EXCLUDED.start_month,
         completed_months = EXCLUDED.completed_months,
         updated_at = CURRENT_TIMESTAMP
       WHERE savings_challenge.user_id = EXCLUDED.user_id`,
      [challengeId, salary, startMonth, JSON.stringify(completedMonths), user.id]
    );

    return NextResponse.json({ salary, start_month: startMonth, completed_months: completedMonths });
  } catch (err) {
    console.error("Error in challenge API:", err);
    return NextResponse.json({ error: "Error al actualizar reto" }, { status: 500 });
  }
}
