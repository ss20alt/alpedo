import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getParaguayDateString } from "@/lib/date-utils";

interface ActiveGoalRow {
  id: number;
  target_amount: number;
  current_amount: number;
  creator_name: string | null;
  [key: string]: unknown;
}

interface ContributionRow {
  id: number;
  amount: number;
  contributor_name: string;
  [key: string]: unknown;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const goal = await db.queryOne<ActiveGoalRow>(
      "SELECT * FROM couples_goals WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [user.id]
    );

    if (!goal) {
      return NextResponse.json({ goal: null, contributions: [] });
    }

    const contributions = await db.query<ContributionRow>(
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
  const user = await getCurrentUser();
  if (!user) {
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

      const numTarget = Number(target_amount);
      if (!Number.isFinite(numTarget) || numTarget < 1000) {
        return NextResponse.json({ error: "El monto objetivo debe ser de al menos ₲ 1.000" }, { status: 400 });
      }
      const cleanTitle = String(title).trim().slice(0, 150);
      const allowedCategories = new Set(["viaje", "auto", "casa", "boda", "ahorro"]);
      const requestedCategory = String(category || "viaje").trim();
      const cleanCat = allowedCategories.has(requestedCategory) ? requestedCategory : "viaje";
      if (!cleanTitle) {
        return NextResponse.json({ error: "Escribí un nombre para la meta" }, { status: 400 });
      }
      if (target_date) {
        const parsedDate = typeof target_date === "string" ? new Date(`${target_date}T12:00:00.000Z`) : null;
        const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === target_date;
        if (!isValidDate || target_date < getParaguayDateString()) {
          return NextResponse.json({ error: "La fecha debe ser válida, hoy o una fecha futura" }, { status: 400 });
        }
      }
      const cleanPartner = String(partner_name || "Mi pareja").trim().slice(0, 100);
      const cleanCreator = String(creator_name || user.name || "Vos").trim().slice(0, 100);
      const randomCode = `CHULI-${Math.floor(1000 + Math.random() * 9000)}`;

      // Archive only this account's previous active goal.
      await db.execute("UPDATE couples_goals SET status = 'completed' WHERE user_id = ? AND status = 'active'", [user.id]);

      await db.execute(
        `INSERT INTO couples_goals (title, category, target_amount, current_amount, target_date, invite_code, partner_name, creator_name, status, user_id)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'active', ?)`,
        [cleanTitle, cleanCat, numTarget, target_date || null, randomCode, cleanPartner, cleanCreator, user.id]
      );

      const created = await db.queryOne("SELECT * FROM couples_goals WHERE invite_code = ? AND user_id = ?", [randomCode, user.id]);
      return NextResponse.json(created);
    } else if (action === "contribute") {
      const { goal_id, contributor_name, amount, note } = body;
      const numAmount = Number(amount);
      if (!goal_id || !Number.isFinite(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: "Datos de aporte inválidos" }, { status: 400 });
      }

      const ownedGoal = await db.queryOne<{ id: number }>(
        "SELECT id FROM couples_goals WHERE id = ? AND user_id = ? AND status = 'active'",
        [goal_id, user.id]
      );
      if (!ownedGoal) {
        return NextResponse.json({ error: "No encontramos una meta activa para esta cuenta" }, { status: 404 });
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
        "UPDATE couples_goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?",
        [numAmount, goal_id, user.id]
      );

      const updatedGoal = await db.queryOne("SELECT * FROM couples_goals WHERE id = ? AND user_id = ?", [goal_id, user.id]);
      return NextResponse.json({ success: true, goal: updatedGoal });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err) {
    console.error("Error in couples API:", err);
    return NextResponse.json({ error: "Error en metas de pareja" }, { status: 500 });
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

    const ownedGoal = await db.queryOne<{ id: number }>(
      "SELECT id FROM couples_goals WHERE id = ? AND user_id = ?",
      [id, user.id]
    );
    if (!ownedGoal) {
      return NextResponse.json({ error: "No encontramos esta meta en tu cuenta" }, { status: 404 });
    }

    // Delete associated contributions only after confirming the goal belongs to this account.
    await db.execute("DELETE FROM couples_contributions WHERE goal_id = ?", [id]);
    await db.execute("DELETE FROM couples_goals WHERE id = ? AND user_id = ?", [id, user.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting couple goal:", err);
    return NextResponse.json({ error: "Error al eliminar meta" }, { status: 500 });
  }
}
