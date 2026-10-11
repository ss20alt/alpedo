import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getParaguayDateString } from "@/lib/date-utils";
import { calculateFinancialMetrics, Transaction } from "@/lib/finance-engine";
import crypto from "crypto";
import type { DbParameter } from "@/lib/db";

export const dynamic = "force-dynamic";

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1_000_000_000_000;
}

function validCategory(type: unknown, category: unknown): boolean {
  return type === "income"
    ? ["fijo", "variable", "pasivo"].includes(String(category))
    : type === "expense" && ["fijo", "variable", "al_pedo"].includes(String(category));
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // e.g. "2026-10"

    let queryStr = "SELECT * FROM transactions WHERE (user_id = ? OR (user_id IS NULL AND ? = 1))";
    const params: DbParameter[] = [user.id, user.id];

    if (month && month !== "all") {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
      }
      const [year, monthNumber] = month.split("-").map(Number);
      queryStr += " AND date >= ? AND date < ?";
      params.push(`${month}-01`, new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10));
    }

    queryStr += " ORDER BY date DESC, created_at DESC";

    const rows = await db.query<Transaction>(queryStr, params);
    const metrics = calculateFinancialMetrics(rows);

    // Get all distinct available months for selector for this user
    const monthsRows = await db.query<{ month: string }>(
      "SELECT DISTINCT to_char(date, 'YYYY-MM') as month FROM transactions WHERE (user_id = ? OR (user_id IS NULL AND ? = 1)) ORDER BY month DESC",
      [user.id, user.id]
    );
    const availableMonths = monthsRows.map((r) => r.month);

    const historyEndMonth =
      month && month !== "all" ? month : getParaguayDateString().slice(0, 7);
    const [historyEndYear, historyEndMonthNumber] = historyEndMonth.split("-").map(Number);
    const historyStart = new Date(Date.UTC(historyEndYear, historyEndMonthNumber - 12, 1))
      .toISOString()
      .slice(0, 7);
    const historyEndExclusive = new Date(Date.UTC(historyEndYear, historyEndMonthNumber, 1))
      .toISOString()
      .slice(0, 7);
    const monthlyHistoryRows = await db.query<{
      month: string;
      total_expenses: number;
      total_income: number;
      al_pedo_expenses: number;
    }>(
      `SELECT 
        to_char(date, 'YYYY-MM') as month,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' AND category = 'al_pedo' THEN amount ELSE 0 END) as al_pedo_expenses
       FROM transactions
       WHERE date >= ? AND date < ?
         AND (user_id = ? OR (user_id IS NULL AND ? = 1))
       GROUP BY to_char(date, 'YYYY-MM')
       ORDER BY month ASC`,
      [`${historyStart}-01`, `${historyEndExclusive}-01`, user.id, user.id]
    );

    const recurringExpenses = await db.query<Transaction>(
      `SELECT DISTINCT ON (LOWER(TRIM(description))) *
       FROM transactions
       WHERE is_recurring = true AND type = 'expense'
         AND (user_id = ? OR (user_id IS NULL AND ? = 1))
       ORDER BY LOWER(TRIM(description)), date DESC, created_at DESC`,
      [user.id, user.id]
    );

    return NextResponse.json(
      {
        transactions: rows,
        metrics,
        availableMonths,
        monthlyHistory: monthlyHistoryRows,
        recurringExpenses,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    console.error("Error fetching transactions:", err);
    return NextResponse.json({ error: "Error al obtener movimientos" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, category, amount, description, date, is_recurring } = body;

    if (!type || !["income", "expense"].includes(type)) {
      return NextResponse.json({ error: "Tipo inválido (debe ser income o expense)" }, { status: 400 });
    }

    const validCategories =
      type === "income" ? ["fijo", "variable", "pasivo"] : ["fijo", "variable", "al_pedo"];

    if (!category || !validCategories.includes(category)) {
      return NextResponse.json({ error: `Categoría inválida para ${type}` }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (!validAmount(numAmount)) {
      return NextResponse.json({ error: "El monto debe ser un número válido mayor a 0" }, { status: 400 });
    }

    if (!description || typeof description !== "string" || description.trim() === "") {
      return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });
    }
    const cleanDesc = description.trim().slice(0, 150);

    if (date !== undefined && !validDate(date)) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    const txDate = date || getParaguayDateString();
    const id = crypto.randomUUID();

    await db.execute(
      `INSERT INTO transactions (id, type, category, amount, description, date, is_recurring, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, type, category, numAmount, cleanDesc, txDate, Boolean(is_recurring), user.id]
    );

    const created = await db.queryOne("SELECT * FROM transactions WHERE id = ? AND user_id = ?", [id, user.id]);
    return NextResponse.json(created);
  } catch (err) {
    console.error("Error creating transaction:", err);
    return NextResponse.json({ error: "Error al guardar el movimiento" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, type, category, amount, description, date, is_recurring } = body;

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "ID de movimiento requerido" }, { status: 400 });
    }

    if (!validCategory(type, category)) {
      return NextResponse.json({ error: "Tipo o categoría inválidos" }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (!validAmount(numAmount)) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    if (!description || typeof description !== "string" || description.trim() === "") {
      return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });
    }
    const cleanDesc = description.trim().slice(0, 150);

    if (date !== undefined && !validDate(date)) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    const txDate = date || getParaguayDateString();

    const affected = await db.execute(
      `UPDATE transactions
       SET type = ?, category = ?, amount = ?, description = ?, date = ?, is_recurring = ?
       WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))`,
      [type, category, numAmount, cleanDesc, txDate, Boolean(is_recurring), id, user.id, user.id]
    );

    if (affected === 0) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    const updated = await db.queryOne(
      "SELECT * FROM transactions WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))",
      [id, user.id, user.id]
    );
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating transaction:", err);
    return NextResponse.json({ error: "Error al actualizar movimiento" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const all = searchParams.get("all");

    if (all === "true") {
      await db.execute(
        "DELETE FROM transactions WHERE user_id = ? OR (user_id IS NULL AND ? = 1)",
        [user.id, user.id]
      );
      return NextResponse.json({ success: true, message: "Todos tus movimientos han sido eliminados" });
    }

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await db.execute(
      "DELETE FROM transactions WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))",
      [id, user.id, user.id]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting transaction:", err);
    return NextResponse.json({ error: "Error al eliminar movimiento" }, { status: 500 });
  }
}
