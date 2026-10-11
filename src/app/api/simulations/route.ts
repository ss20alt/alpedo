import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

const MAX_AMOUNT = 9_999_999_999_999;
const MAX_INSTALLMENTS = 120;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const rows = await db.query(
      "SELECT * FROM loan_simulations WHERE user_id = ? ORDER BY created_at DESC",
      [user.id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Error fetching simulations:", err);
    return NextResponse.json({ error: "Error al obtener simulaciones" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "El contenido enviado no es JSON válido" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Datos de simulación inválidos" }, { status: 400 });
    }
    const { title, amount, installments, monthly_payment, interest_rate, total_payment, notes } = body as Record<string, unknown>;
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const numAmount = Number(amount);
    const numInst = Number(installments);
    const numMonthly = Number(monthly_payment);
    const numRate = interest_rate === undefined || interest_rate === null ? 0 : Number(interest_rate);
    const numTotal = total_payment === undefined || total_payment === null
      ? numMonthly * numInst
      : Number(total_payment);
    const cleanNotes = typeof notes === "string" ? notes.trim() : "";

    if (!cleanTitle || cleanTitle.length > 255) {
      return NextResponse.json({ error: "El nombre debe tener entre 1 y 255 caracteres" }, { status: 400 });
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > MAX_AMOUNT) {
      return NextResponse.json({ error: "Ingresá un monto válido" }, { status: 400 });
    }
    if (!Number.isInteger(numInst) || numInst < 1 || numInst > MAX_INSTALLMENTS) {
      return NextResponse.json({ error: "El plazo debe ser de 1 a 120 meses" }, { status: 400 });
    }
    if (!Number.isFinite(numMonthly) || numMonthly <= 0 || numMonthly > MAX_AMOUNT) {
      return NextResponse.json({ error: "Ingresá una cuota mensual válida" }, { status: 400 });
    }
    if (!Number.isFinite(numRate) || numRate < 0 || numRate > 9999.99) {
      return NextResponse.json({ error: "Ingresá una tasa válida" }, { status: 400 });
    }
    if (!Number.isFinite(numTotal) || numTotal <= 0 || numTotal > MAX_AMOUNT) {
      return NextResponse.json({ error: "El total a devolver excede el rango permitido" }, { status: 400 });
    }
    if (cleanNotes.length > 2000) {
      return NextResponse.json({ error: "Las notas no pueden superar 2.000 caracteres" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.execute(
      `INSERT INTO loan_simulations (id, user_id, title, amount, installments, monthly_payment, interest_rate, total_payment, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, cleanTitle, numAmount, numInst, numMonthly, numRate, numTotal, cleanNotes || null]
    );

    const created = await db.queryOne("SELECT * FROM loan_simulations WHERE id = ? AND user_id = ?", [id, user.id]);
    return NextResponse.json(created);
  } catch (err) {
    console.error("Error saving simulation:", err);
    return NextResponse.json({ error: "Error al guardar simulación" }, { status: 500 });
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

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await db.execute("DELETE FROM loan_simulations WHERE id = ? AND user_id = ?", [id, user.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting simulation:", err);
    return NextResponse.json({ error: "Error al eliminar simulación" }, { status: 500 });
  }
}
