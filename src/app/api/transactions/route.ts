import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { calculateFinancialMetrics, Transaction } from "@/lib/finance-engine";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // e.g. "2026-10"

    let queryStr = "SELECT * FROM transactions WHERE (user_id = ? OR (user_id IS NULL AND ? = 1))";
    const params: any[] = [user.id, user.id];

    if (month && month !== "all") {
      queryStr += " AND date::text LIKE ?";
      params.push(`${month}%`);
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

    const currentYear =
      month && month !== "all" ? month.substring(0, 4) : String(new Date().getFullYear());
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
       WHERE to_char(date, 'YYYY') = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))
       GROUP BY to_char(date, 'YYYY-MM')
       ORDER BY month ASC`,
      [currentYear, user.id, user.id]
    );

    const recurringExpenses = await db.query<Transaction>(
      "SELECT * FROM transactions WHERE is_recurring = true AND type = 'expense' AND (user_id = ? OR (user_id IS NULL AND ? = 1)) ORDER BY date ASC",
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

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !isFinite(numAmount) || numAmount > 1000000000000) {
      return NextResponse.json({ error: "El monto debe ser un número válido mayor a 0" }, { status: 400 });
    }

    if (!description || typeof description !== "string" || description.trim() === "") {
      return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });
    }
    const cleanDesc = description.trim().slice(0, 150);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const txDate = date && dateRegex.test(date) ? date : new Date().toISOString().split("T")[0];
    const id = crypto.randomUUID();

    await db.execute(
      `INSERT INTO transactions (id, type, category, amount, description, date, is_recurring, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, type, category, numAmount, cleanDesc, txDate, Boolean(is_recurring), user.id]
    );

    const created = await db.queryOne("SELECT * FROM transactions WHERE id = ?", [id]);
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

    if (!id) {
      return NextResponse.json({ error: "ID de movimiento requerido" }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !isFinite(numAmount) || numAmount > 1000000000000) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    if (!description || typeof description !== "string" || description.trim() === "") {
      return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });
    }
    const cleanDesc = description.trim().slice(0, 150);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const txDate = date && dateRegex.test(date) ? date : new Date().toISOString().split("T")[0];

    await db.execute(
      `UPDATE transactions
       SET type = ?, category = ?, amount = ?, description = ?, date = ?, is_recurring = ?
       WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))`,
      [type, category, numAmount, cleanDesc, txDate, Boolean(is_recurring), id, user.id, user.id]
    );

    const updated = await db.queryOne("SELECT * FROM transactions WHERE id = ?", [id]);
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
