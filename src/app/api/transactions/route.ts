import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getParaguayDateString } from "@/lib/date-utils";
import { calculateFinancialMetrics, Transaction } from "@/lib/finance-engine";
import crypto from "crypto";
import type { DbParameter } from "@/lib/db";
import { readLimitedJsonObject } from "@/lib/request-validation";
import { enforceUserMutationRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1_000_000_000_000;
}

function validType(value: unknown): value is "income" | "expense" {
  return value === "income" || value === "expense";
}

function validCategory(type: unknown, category: unknown): category is "fijo" | "variable" | "pasivo" | "al_pedo" {
  return type === "income"
    ? category === "fijo" || category === "variable" || category === "pasivo"
    : type === "expense" && (category === "fijo" || category === "variable" || category === "al_pedo");
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // e.g. "2026-10"
    const isHistory = month === "all";
    const isListRequest = searchParams.get("list") === "true";
    const isFullRequest = searchParams.get("full") === "true";

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

    if (isListRequest) {
      const limit = Number(searchParams.get("limit") || 40);
      const offset = Number(searchParams.get("offset") || 0);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
        return NextResponse.json({ error: "Página inválida" }, { status: 400 });
      }
      const filters: string[] = [];
      const filterParams: DbParameter[] = [...params];
      const type = searchParams.get("type");
      const category = searchParams.get("category");
      const search = searchParams.get("search")?.trim() || "";
      const amount = searchParams.get("amount");
      if (type && type !== "all") {
        if (!['income', 'expense'].includes(type)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
        filters.push("type = ?"); filterParams.push(type);
      }
      if (category && category !== "all") {
        if (!["fijo", "variable", "pasivo", "al_pedo"].includes(category)) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
        filters.push("category = ?"); filterParams.push(category);
      }
      if (search) {
        if (search.length > 100) return NextResponse.json({ error: "Búsqueda demasiado larga" }, { status: 400 });
        filters.push("description ILIKE ?"); filterParams.push(`%${search}%`);
      }
      if (searchParams.get("recurring") === "true") filters.push("is_recurring = true");
      if (amount === "big") filters.push("type = 'expense' AND amount > 100000");
      if (amount === "ant") filters.push("type = 'expense' AND amount < 30000");
      const where = `${queryStr}${filters.length ? ` AND ${filters.map((f) => `(${f})`).join(" AND ")}` : ""}`;
      const order = ({ amount_desc: "amount DESC", amount_asc: "amount ASC", date_asc: "date ASC, created_at ASC", date_desc: "date DESC, created_at DESC" } as Record<string, string>)[searchParams.get("sort") || "date_desc"];
      if (!order) return NextResponse.json({ error: "Orden inválido" }, { status: 400 });
      const totals = await db.queryOne<{ count: number; expense_sum: number }>(`SELECT COUNT(*)::integer AS count, COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense_sum FROM (${where}) AS scoped`, filterParams);
      const transactions = await db.query<Transaction>(`${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [...filterParams, limit, offset]);
      return NextResponse.json({ transactions, total: totals?.count || 0, expenseSum: totals?.expense_sum || 0 }, { headers: { "Cache-Control": "no-store" } });
    }

    const rowQuery = `${queryStr} ORDER BY date DESC, created_at DESC`;
    const rows = await db.query<Transaction>(isHistory && !isFullRequest ? `${rowQuery} LIMIT 40` : rowQuery, params);
    const metricRows = isHistory
      ? await db.query<Transaction>(`${queryStr.replace("SELECT *", "SELECT type, category, SUM(amount) AS amount")} GROUP BY type, category`, params)
      : rows;
    const metrics = calculateFinancialMetrics(metricRows);
    const totalCount = isHistory
      ? Number((await db.queryOne<{ count: number }>(`${queryStr.replace("SELECT *", "SELECT COUNT(*)::integer AS count")}`, params))?.count || 0)
      : rows.length;

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
        totalCount,
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
  const limited = await enforceUserMutationRateLimit(req, user.id, "transactions-write");
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
    const { type, category, amount, description, date, is_recurring } = body;

    if (!validType(type)) {
      return NextResponse.json({ error: "Tipo inválido (debe ser income o expense)" }, { status: 400 });
    }

    if (!validCategory(type, category)) {
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
    const txDate = typeof date === "string" ? date : getParaguayDateString();
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
  const limited = await enforceUserMutationRateLimit(req, user.id, "transactions-write");
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
    const { id, type, category, amount, description, date, is_recurring } = body;

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "ID de movimiento requerido" }, { status: 400 });
    }

    if (!validType(type) || !validCategory(type, category)) {
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
    const txDate = typeof date === "string" ? date : getParaguayDateString();

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
  const limited = await enforceUserMutationRateLimit(req, user.id, "transactions-write");
  if (limited) return limited;

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

    const deleted = await db.execute(
      "DELETE FROM transactions WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))",
      [id, user.id, user.id]
    );
    if (deleted === 0) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting transaction:", err);
    return NextResponse.json({ error: "Error al eliminar movimiento" }, { status: 500 });
  }
}
