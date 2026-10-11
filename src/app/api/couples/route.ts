import { NextResponse } from "next/server";
import db from "@/lib/db";
import { checkAuth } from "@/lib/auth";

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const goal = await db.queryOne(
      "SELECT * FROM couples_goals WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
    );

    if (!goal) {
      return NextResponse.json({ goal: null, contributions: [] });
    }

    const contributions = await db.query(
      "SELECT * FROM couples_contributions WHERE goal_id = ? ORDER BY date DESC, created_at DESC",
      [goal.id]
    );

    const targetAmount = parseFloat(String(goal.target_amount));
    const currentAmount = parseFloat(String(goal.current_amount));
    const progressPercent = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
    const remainingAmount = Math.max(0, targetAmount - currentAmount);

    // Contributor Breakdown
    let totalMe = 0;
    let totalPartner = 0;
    for (const c of contributions) {
      const amt = parseFloat(String(c.amount));
      if (c.contributor_name === (goal.creator_name || "Vos")) {
        totalMe += amt;
      } else {
        totalPartner += amt;
      }
    }

    return NextResponse.json({
      goal: {
        ...goal,
        target_amount: targetAmount,
        current_amount: currentAmount,
        progressPercent,
        remainingAmount,
        totalMe,
        totalPartner,
      },
      contributions,
    });
  } catch (err) {
    console.error("Error fetching couple goal:", err);
    return NextResponse.json({ error: "Error al obtener meta de pareja" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create_goal") {
      const { title, target_amount, target_date, category, partner_name, creator_name } = body;
      if (!title || !target_amount) {
        return NextResponse.json({ error: "Título y monto objetivo requeridos" }, { status: 400 });
      }

      const numTarget = Math.max(1000, parseFloat(target_amount));
      const cleanTitle = String(title).trim().slice(0, 150);
      const cleanCat = String(category || "viaje").trim();
      const cleanPartner = String(partner_name || "Mi Chuli").trim().slice(0, 100);
      const cleanCreator = String(creator_name || "Vos").trim().slice(0, 100);
      const randomCode = `CHULI-${Math.floor(1000 + Math.random() * 9000)}`;

      // Archive previous active goals
      await db.execute("UPDATE couples_goals SET status = 'completed' WHERE status = 'active'");

      await db.execute(
        `INSERT INTO couples_goals (title, category, target_amount, current_amount, target_date, invite_code, partner_name, creator_name, status)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'active')`,
        [cleanTitle, cleanCat, numTarget, target_date || null, randomCode, cleanPartner, cleanCreator]
      );

      const created = await db.queryOne("SELECT * FROM couples_goals WHERE invite_code = ?", [randomCode]);
      return NextResponse.json(created);
    } else if (action === "contribute") {
      const { goal_id, contributor_name, amount, note } = body;
      const numAmount = parseFloat(amount);
      if (!goal_id || isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: "Datos de aporte inválidos" }, { status: 400 });
      }

      const cleanContributor = String(contributor_name || "Vos").trim().slice(0, 100);
      const cleanNote = String(note || "Aporte al chanchito").trim().slice(0, 150);

      await db.execute(
        `INSERT INTO couples_contributions (goal_id, contributor_name, amount, note, date)
         VALUES (?, ?, ?, ?, CURRENT_DATE)`,
        [goal_id, cleanContributor, numAmount, cleanNote]
      );

      // Update goal current amount
      await db.execute(
        "UPDATE couples_goals SET current_amount = current_amount + ? WHERE id = ?",
        [numAmount, goal_id]
      );

      const updatedGoal = await db.queryOne("SELECT * FROM couples_goals WHERE id = ?", [goal_id]);
      return NextResponse.json({ success: true, goal: updatedGoal });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err) {
    console.error("Error in couples API:", err);
    return NextResponse.json({ error: "Error en metas de pareja" }, { status: 500 });
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

    // Delete associated contributions first to prevent FK constraint errors
    await db.execute("DELETE FROM couples_contributions WHERE goal_id = ?", [id]);
    await db.execute("DELETE FROM couples_goals WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting couple goal:", err);
    return NextResponse.json({ error: "Error al eliminar meta" }, { status: 500 });
  }
}
