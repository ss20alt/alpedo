import { NextResponse } from "next/server";
import db from "@/lib/db";
import { checkAuth } from "@/lib/auth";
import crypto from "crypto";

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const rows = await db.query("SELECT * FROM loan_simulations ORDER BY created_at DESC");
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Error fetching simulations:", err);
    return NextResponse.json({ error: "Error al obtener simulaciones" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, amount, installments, monthly_payment, interest_rate, total_payment, notes } = body;

    if (!title || !amount || !installments || !monthly_payment) {
      return NextResponse.json({ error: "Campos obligatorios faltantes" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const numAmount = parseFloat(amount);
    const numInst = parseInt(installments);
    const numMonthly = parseFloat(monthly_payment);
    const numRate = parseFloat(interest_rate || 0);
    const numTotal = parseFloat(total_payment || numMonthly * numInst);

    await db.execute(
      `INSERT INTO loan_simulations (id, title, amount, installments, monthly_payment, interest_rate, total_payment, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title.trim(), numAmount, numInst, numMonthly, numRate, numTotal, notes ? notes.trim() : null]
    );

    const created = await db.queryOne("SELECT * FROM loan_simulations WHERE id = ?", [id]);
    return NextResponse.json(created);
  } catch (err) {
    console.error("Error saving simulation:", err);
    return NextResponse.json({ error: "Error al guardar simulación" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await db.execute("DELETE FROM loan_simulations WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting simulation:", err);
    return NextResponse.json({ error: "Error al eliminar simulación" }, { status: 500 });
  }
}
