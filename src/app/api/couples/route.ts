import { randomBytes } from "node:crypto";
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
  contributor_user_id?: number | null;
  [key: string]: unknown;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const goal = await db.queryOne<ActiveGoalRow & { partner_user_id: number | null; user_id: number }>(
      "SELECT * FROM couples_goals WHERE (user_id = ? OR partner_user_id = ?) AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [user.id, user.id]
    );

    if (!goal) {
      return NextResponse.json({ goal: null, contributions: [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
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
    let totalCreator = 0;
    let totalPartner = 0;
    for (const c of contributions) {
      const amt = parseFloat(String(c.amount));
      const isCreator = c.contributor_user_id != null
        ? Number(c.contributor_user_id) === Number(goal.user_id)
        : c.contributor_name === (goal.creator_name || "Vos");
      const isPartner = c.contributor_user_id != null
        ? Number(c.contributor_user_id) === Number(goal.partner_user_id)
        : c.contributor_name === goal.partner_name && c.contributor_name !== (goal.creator_name || "Vos");
      if (isCreator) totalCreator += amt;
      if (isPartner) {
        totalPartner += amt;
      }
    }

    const isOwner = Number(goal.user_id) === user.id;
    const creatorName = goal.creator_name || "Vos";
    const partnerName = goal.partner_name || "Tu pareja";

    return NextResponse.json({
      goal: {
        ...goal,
        invite_code: isOwner ? goal.invite_code : null,
        target_amount: targetAmount,
        current_amount: currentAmount,
        progressPercent,
        remainingAmount,
        totalCreator,
        totalPartner,
        isOwner,
        isShared: Boolean(goal.partner_user_id),
        myContributorName: isOwner ? creatorName : partnerName,
      },
      contributions,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
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
      const { title, target_amount, target_date, category, partner_name } = body;
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
      const cleanCreator = String(user.name || "Vos").trim().slice(0, 100);
      const randomCode = `JUNTOS-${randomBytes(8).toString("hex").toUpperCase()}`;

      const existingMembership = await db.queryOne<{ id: number }>(
        "SELECT id FROM couples_goals WHERE status = 'active' AND (partner_user_id = ? OR (user_id = ? AND partner_user_id IS NOT NULL)) LIMIT 1",
        [user.id, user.id]
      );
      if (existingMembership) {
        return NextResponse.json({ error: "Ya participás en una meta compartida activa. Cerrala antes de crear otra." }, { status: 409 });
      }

      // Archive only this account's previous active goal.
      const created = await db.withTransaction(async () => {
        await db.execute("UPDATE couples_goals SET status = 'completed' WHERE user_id = ? AND status = 'active'", [user.id]);
        await db.execute(
          `INSERT INTO couples_goals (title, category, target_amount, current_amount, target_date, invite_code, partner_name, creator_name, status, user_id)
           VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'active', ?)`,
          [cleanTitle, cleanCat, numTarget, target_date || null, randomCode, cleanPartner, cleanCreator, user.id]
        );
        return db.queryOne("SELECT * FROM couples_goals WHERE invite_code = ? AND user_id = ?", [randomCode, user.id]);
      });
      return NextResponse.json(created);
    } else if (action === "join_goal") {
      const code = typeof body.invite_code === "string" ? body.invite_code.trim().toUpperCase() : "";
      if (!code || code.length > 30) {
        return NextResponse.json({ error: "Ingresá un código de invitación válido." }, { status: 400 });
      }

      const joinedGoal = await db.withTransaction(async () => {
        const invitedGoal = await db.queryOne<{ id: number; user_id: number; partner_user_id: number | null; partner_name: string | null; creator_name: string | null; status: string }>(
          "SELECT id, user_id, partner_user_id, partner_name, creator_name, status FROM couples_goals WHERE invite_code = ? AND status = 'active' FOR UPDATE",
          [code]
        );
        if (!invitedGoal) return { error: "No encontramos una invitación activa con ese código.", status: 404 as const };
        if (Number(invitedGoal.user_id) === user.id) return { error: "No podés aceptar tu propia invitación.", status: 400 as const };
        if (Number(invitedGoal.partner_user_id) === user.id) return { goalId: invitedGoal.id };
        if (invitedGoal.partner_user_id) return { error: "Esta meta ya está vinculada a otra cuenta.", status: 409 as const };

        const existingMembership = await db.queryOne<{ id: number }>(
          "SELECT id FROM couples_goals WHERE status = 'active' AND (partner_user_id = ? OR (user_id = ? AND partner_user_id IS NOT NULL)) LIMIT 1",
          [user.id, user.id]
        );
        if (existingMembership) {
          return { error: "Ya participás en otra meta compartida activa.", status: 409 as const };
        }

        // Preserve a personal goal and its history when this user accepts the shared goal.
        await db.execute(
          "UPDATE couples_goals SET status = 'completed' WHERE user_id = ? AND partner_user_id IS NULL AND status = 'active'",
          [user.id]
        );
        if (invitedGoal.partner_name && invitedGoal.partner_name !== (invitedGoal.creator_name || "Vos")) {
          await db.execute(
            "UPDATE couples_contributions SET contributor_user_id = ? WHERE goal_id = ? AND contributor_user_id IS NULL AND contributor_name = ?",
            [user.id, invitedGoal.id, invitedGoal.partner_name]
          );
        }
        await db.execute(
          "UPDATE couples_goals SET partner_user_id = ?, partner_name = ? WHERE id = ? AND partner_user_id IS NULL AND status = 'active'",
          [user.id, user.name, invitedGoal.id]
        );
        return { goalId: invitedGoal.id };
      });

      if ("error" in joinedGoal) {
        return NextResponse.json({ error: joinedGoal.error }, { status: joinedGoal.status });
      }
      return NextResponse.json({ success: true, goalId: joinedGoal.goalId });
    } else if (action === "contribute") {
      const { goal_id, amount, note } = body;
      const numAmount = Number(amount);
      if (!goal_id || !Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 1_000_000_000_000) {
        return NextResponse.json({ error: "Datos de aporte inválidos" }, { status: 400 });
      }

      const cleanNote = String(note || "Aporte al chanchito").trim().slice(0, 150);

      const updatedGoal = await db.withTransaction(async () => {
        const ownedGoal = await db.queryOne<{ id: number; user_id: number; partner_user_id: number | null; creator_name: string | null; partner_name: string | null }>(
          "SELECT id, user_id, partner_user_id, creator_name, partner_name FROM couples_goals WHERE id = ? AND status = 'active' AND (user_id = ? OR partner_user_id = ?) FOR UPDATE",
          [goal_id, user.id, user.id]
        );
        if (!ownedGoal) return null;
        const contributorName = Number(ownedGoal.user_id) === user.id
          ? ownedGoal.creator_name || "Vos"
          : ownedGoal.partner_name || user.name;
        await db.execute(
          `INSERT INTO couples_contributions (goal_id, contributor_name, contributor_user_id, amount, note, date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [goal_id, contributorName, user.id, numAmount, cleanNote, getParaguayDateString()]
        );
        await db.execute(
          "UPDATE couples_goals SET current_amount = current_amount + ? WHERE id = ? AND status = 'active'",
          [numAmount, goal_id]
        );
        return db.queryOne("SELECT * FROM couples_goals WHERE id = ?", [goal_id]);
      });
      if (!updatedGoal) {
        return NextResponse.json({ error: "No encontramos una meta activa para esta cuenta" }, { status: 404 });
      }
      return NextResponse.json({ success: true, goal: updatedGoal });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err) {
    console.error("Error in couples API:", err);
    if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
      return NextResponse.json({ error: "Ya participás en una meta activa o esta invitación fue aceptada por otra cuenta." }, { status: 409 });
    }
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
    await db.withTransaction(async () => {
      await db.execute("DELETE FROM couples_contributions WHERE goal_id = ?", [id]);
      await db.execute("DELETE FROM couples_goals WHERE id = ? AND user_id = ?", [id, user.id]);
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting couple goal:", err);
    return NextResponse.json({ error: "Error al eliminar meta" }, { status: 500 });
  }
}
