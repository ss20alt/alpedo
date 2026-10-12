import { NextResponse } from "next/server";
import { getParaguayDateString } from "@/lib/date-utils";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import crypto from "node:crypto";
import { readLimitedJsonObject } from "@/lib/request-validation";
import { enforceUserMutationRateLimit, rateLimitResponse, scopedRateLimitResponse } from "@/lib/security";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const limited = await rateLimitResponse(`backup-export:user:${user.id}`, 6, 60 * 60, "backup-export");
  if (limited) return limited;

  try {
    const transactions = await db.query(
      "SELECT * FROM transactions WHERE user_id = ? OR (user_id IS NULL AND ? = 1)",
      [user.id, user.id]
    );
    const simulations = await db.query("SELECT * FROM loan_simulations WHERE user_id = ?", [user.id]);
    const settings = user.id === 1
      ? await db.query("SELECT key, value FROM settings WHERE key IN ('app_name')")
      : [];
    const savingsChallenge = await db.query("SELECT * FROM savings_challenge WHERE user_id = ?", [user.id]);
    const couplesGoals = await db.query(
      "SELECT * FROM couples_goals WHERE user_id = ? OR partner_user_id = ? OR (user_id IS NULL AND ? = 1)",
      [user.id, user.id, user.id]
    );
    const couplesContributions = await db.query(
      `SELECT cc.* FROM couples_contributions cc
       INNER JOIN couples_goals cg ON cg.id = cc.goal_id
       WHERE cg.user_id = ? OR cg.partner_user_id = ? OR (cg.user_id IS NULL AND ? = 1)`,
      [user.id, user.id, user.id]
    );
    const friendStreaks = await db.query("SELECT friend_code, friend_name FROM friend_streaks WHERE user_id = ?", [user.id]);

    const backupData = {
      version: "2.1-postgres",
      exported_at: new Date().toISOString(),
      transactions,
      simulations,
      settings,
      savings_challenge: savingsChallenge,
      couples_goals: couplesGoals,
      couples_contributions: couplesContributions,
      friend_streaks: friendStreaks,
    };

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename=alpedo_backup_${getParaguayDateString()}.json`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Backup export error:", err);
    return NextResponse.json({ error: "Error al exportar respaldo" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const writeLimited = await enforceUserMutationRateLimit(req, user.id, "backup-write", 20);
  if (writeLimited) return writeLimited;
  const restoreLimited = await scopedRateLimitResponse(req, {
    scope: "backup-restore",
    identity: String(user.id),
    identityMaximum: 3,
    windowSeconds: 60 * 60,
    ipMaximum: 10,
  });
  if (restoreLimited) return restoreLimited;

  try {
    const parsedBody = await readLimitedJsonObject(req, 2_000_000);
    if (!parsedBody.ok) {
      const tooLarge = parsedBody.reason === "too_large";
      return NextResponse.json(
        { error: tooLarge ? "El respaldo supera 2 MB" : "El respaldo no es JSON válido" },
        { status: tooLarge ? 413 : 400 }
      );
    }
    const data = parsedBody.value;
    if (!data || !Array.isArray(data.transactions) || data.transactions.length > 5000) {
      return NextResponse.json({ error: "Formato de respaldo inválido" }, { status: 400 });
    }
    const backupTransactions = data.transactions as Array<{
      id: string; type: string; category: string; amount: number | string;
      description: string; date: string; is_recurring?: boolean; created_at?: string;
    }>;
    const allowedSizes: Record<string, number> = {
      savings_challenge: 1, couples_goals: 200, couples_contributions: 5000,
      friend_streaks: 500, simulations: 500,
    };
    for (const [key, max] of Object.entries(allowedSizes)) {
      const rows = data[key];
      if (rows !== undefined && (!Array.isArray(rows) || rows.length > max)) {
        return NextResponse.json({ error: `Sección inválida: ${key}` }, { status: 400 });
      }
    }

    for (const t of backupTransactions) {
      if (
        !t || typeof t.id !== "string" || t.id.length > 100 ||
        !["income", "expense"].includes(t.type) ||
        !(t.type === "income" ? ["fijo", "variable", "pasivo"] : ["fijo", "variable", "al_pedo"]).includes(t.category) ||
        !Number.isFinite(Number(t.amount)) || Number(t.amount) <= 0 ||
        typeof t.description !== "string" || !t.description.trim() ||
        typeof t.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)
      ) {
        return NextResponse.json({ error: "El respaldo contiene movimientos inválidos" }, { status: 400 });
      }
    }

    return await db.withTransaction(async () => {
    let restored = 0;
    let skipped = 0;
    let remapped = 0;
    // 1. Restore Transactions
    for (const t of backupTransactions) {
      const existing = await db.queryOne<{ user_id: number | null }>("SELECT user_id FROM transactions WHERE id = ?", [t.id]);
      let transactionId = t.id;
      if (existing && existing.user_id !== user.id && !(existing.user_id === null && user.id === 1)) {
        const digest = crypto.createHash("sha256").update(`${user.id}:${t.id}`).digest("hex");
        transactionId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
        remapped += 1;
      }
      const affected = await db.execute(
        `INSERT INTO transactions (id, user_id, type, category, amount, description, date, is_recurring, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           type = EXCLUDED.type,
           category = EXCLUDED.category,
           amount = EXCLUDED.amount,
           description = EXCLUDED.description,
           date = EXCLUDED.date,
           is_recurring = EXCLUDED.is_recurring
         WHERE transactions.user_id = EXCLUDED.user_id OR (transactions.user_id IS NULL AND EXCLUDED.user_id = 1)`,
        [
          transactionId,
          user.id,
          t.type,
          t.category,
          Number(t.amount),
          t.description,
          t.date,
          Boolean(t.is_recurring),
          t.created_at || new Date().toISOString(),
        ]
      );
      if (affected) restored += 1;
      else skipped += 1;
    }

    // 2. Restore Savings Challenge
    if (data.savings_challenge && Array.isArray(data.savings_challenge)) {
      for (const c of data.savings_challenge) {
        const challengeId = user.id === 1 ? "default" : `user-${user.id}`;
        const affected = await db.execute(
          `INSERT INTO savings_challenge (id, salary, start_month, completed_months, updated_at, user_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             salary = EXCLUDED.salary,
             start_month = EXCLUDED.start_month,
             completed_months = EXCLUDED.completed_months,
             updated_at = EXCLUDED.updated_at
           WHERE savings_challenge.user_id = EXCLUDED.user_id`,
          [
            challengeId,
            parseFloat(c.salary),
            c.start_month,
            typeof c.completed_months === "string" ? c.completed_months : JSON.stringify(c.completed_months || []),
            c.updated_at || new Date().toISOString(),
            user.id,
          ]
        );
        if (affected) restored += 1;
        else skipped += 1;
      }
    }

    // 3. Restore Couples Goals
    if (data.couples_goals && Array.isArray(data.couples_goals)) {
      for (const g of data.couples_goals) {
        if (!g || !Number.isInteger(Number(g.id)) || typeof g.invite_code !== "string" || !g.invite_code) { skipped += 1; continue; }
        const isGoalOwner = Number(g.user_id ?? user.id) === user.id || (g.user_id == null && user.id === 1);
        const isGoalPartner = Number(g.partner_user_id) === user.id;
        if (!isGoalOwner && !isGoalPartner) { skipped += 1; continue; }
        if (isGoalPartner && !isGoalOwner) {
          const linkedGoal = await db.queryOne<{ id: number }>(
            "SELECT id FROM couples_goals WHERE id = ? AND partner_user_id = ?",
            [g.id, user.id]
          );
          if (!linkedGoal) { skipped += 1; continue; }
          continue;
        }
        const conflictingGoals = await db.query<{ user_id: number | null }>("SELECT user_id FROM couples_goals WHERE id = ? OR invite_code = ?", [g.id, g.invite_code]);
        if (conflictingGoals.some((goal) => goal.user_id !== user.id && !(goal.user_id === null && user.id === 1))) { skipped += 1; continue; }
        const affected = await db.execute(
          `INSERT INTO couples_goals (id, title, category, target_amount, current_amount, target_date, invite_code, partner_name, creator_name, status, created_at, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             target_amount = EXCLUDED.target_amount,
             current_amount = EXCLUDED.current_amount,
             status = EXCLUDED.status
           WHERE couples_goals.user_id = EXCLUDED.user_id`,
          [
            g.id,
            g.title,
            g.category || "viaje",
            parseFloat(g.target_amount),
            parseFloat(g.current_amount || 0),
            g.target_date || null,
            g.invite_code,
            g.partner_name,
            g.creator_name,
            g.status || "active",
            g.created_at || new Date().toISOString(),
            user.id,
          ]
        );
        if (affected) restored += 1;
        else skipped += 1;
      }
    }

    // 4. Restore Couples Contributions
    if (data.couples_contributions && Array.isArray(data.couples_contributions)) {
      for (const cc of data.couples_contributions) {
        const contributionUserId = Number.isInteger(Number(cc.contributor_user_id)) && Number(cc.contributor_user_id) === user.id
          ? user.id
          : null;
        const affected = await db.execute(
          `INSERT INTO couples_contributions (id, goal_id, contributor_name, contributor_user_id, amount, note, date, created_at)
           SELECT ?, cg.id, ?, ?, ?, ?, ?, ? FROM couples_goals cg WHERE cg.id = ? AND (cg.user_id = ? OR cg.partner_user_id = ?)
           ON CONFLICT (id) DO NOTHING`,
          [
            cc.id,
            cc.contributor_name,
            contributionUserId,
            parseFloat(cc.amount),
            cc.note,
            cc.date,
            cc.created_at || new Date().toISOString(),
            cc.goal_id,
            user.id,
            user.id,
          ]
        );
        if (affected) restored += 1;
        else skipped += 1;
      }
    }

    // 5. Restore Friend Streaks
    if (data.friend_streaks && Array.isArray(data.friend_streaks)) {
      for (const f of data.friend_streaks) {
        const affected = await db.execute(
          `INSERT INTO friend_streaks (user_id, friend_code, friend_name, streak_type)
           VALUES (?, ?, ?, 'control_al_pedo')
           ON CONFLICT (user_id, friend_code) DO UPDATE SET
             friend_name = EXCLUDED.friend_name`,
          [
            user.id,
            f.friend_code,
            f.friend_name,
          ]
        );
        if (affected) restored += 1;
        else skipped += 1;
      }
    }

    // 6. Restore saved loan simulations for the signed-in account only.
    if (data.simulations && Array.isArray(data.simulations)) {
      for (const simulation of data.simulations) {
        const amount = Number(simulation?.amount);
        const installments = Number(simulation?.installments);
        const monthlyPayment = Number(simulation?.monthly_payment);
        const interestRate = Number(simulation?.interest_rate || 0);
        const totalPayment = simulation?.total_payment === undefined
          ? monthlyPayment * installments
          : Number(simulation.total_payment);
        if (
          !simulation?.id || typeof simulation.title !== "string" || !simulation.title.trim() ||
          !Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999_999 ||
          !Number.isInteger(installments) || installments < 1 || installments > 120 ||
          !Number.isFinite(monthlyPayment) || monthlyPayment <= 0 || monthlyPayment > 9_999_999_999_999 ||
          !Number.isFinite(interestRate) || interestRate < 0 || interestRate > 200 ||
          !Number.isFinite(totalPayment) || totalPayment < amount || totalPayment > 9_999_999_999_999 ||
          Math.abs(totalPayment - monthlyPayment * installments) > 1
        ) { skipped += 1; continue; }
        const affected = await db.execute(
          `INSERT INTO loan_simulations (id, user_id, title, amount, installments, monthly_payment, interest_rate, total_payment, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             amount = EXCLUDED.amount,
             installments = EXCLUDED.installments,
             monthly_payment = EXCLUDED.monthly_payment,
             interest_rate = EXCLUDED.interest_rate,
             total_payment = EXCLUDED.total_payment,
             notes = EXCLUDED.notes
           WHERE loan_simulations.user_id = EXCLUDED.user_id`,
          [
            simulation.id,
            user.id,
            simulation.title.trim().slice(0, 255),
            amount,
            installments,
            monthlyPayment,
            interestRate,
            totalPayment,
            typeof simulation.notes === "string" ? simulation.notes.slice(0, 2000) : null,
            simulation.created_at || new Date().toISOString(),
          ]
        );
        if (affected) restored += 1;
        else skipped += 1;
      }
    }

    return NextResponse.json({ success: true, restored, skipped, remapped });
    });
  } catch (err) {
    console.error("Backup import error:", err);
    return NextResponse.json({ error: "Error al restaurar respaldo" }, { status: 500 });
  }
}
