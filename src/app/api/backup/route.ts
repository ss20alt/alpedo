import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const transactions = await db.query(
      "SELECT * FROM transactions WHERE user_id = ? OR (user_id IS NULL AND ? = 1)",
      [user.id, user.id]
    );
    const simulations = await db.query("SELECT * FROM loan_simulations");
    const settings = await db.query("SELECT key, value FROM settings WHERE key != 'pin_hash'");
    const savingsChallenge = await db.query("SELECT * FROM savings_challenge");
    const couplesGoals = await db.query("SELECT * FROM couples_goals");
    const couplesContributions = await db.query("SELECT * FROM couples_contributions");
    const friendStreaks = await db.query("SELECT * FROM friend_streaks");

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
        "Content-Disposition": `attachment; filename=alpedo_backup_${new Date().toISOString().split("T")[0]}.json`,
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

  try {
    const data = await req.json();
    if (!data.transactions || !Array.isArray(data.transactions)) {
      return NextResponse.json({ error: "Formato de respaldo inválido" }, { status: 400 });
    }

    // 1. Restore Transactions
    for (const t of data.transactions) {
      await db.execute(
        `INSERT INTO transactions (id, user_id, type, category, amount, description, date, is_recurring, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           type = EXCLUDED.type,
           category = EXCLUDED.category,
           amount = EXCLUDED.amount,
           description = EXCLUDED.description,
           date = EXCLUDED.date,
           is_recurring = EXCLUDED.is_recurring`,
        [
          t.id,
          user.id,
          t.type,
          t.category,
          parseFloat(t.amount),
          t.description,
          t.date,
          Boolean(t.is_recurring),
          t.created_at || new Date().toISOString(),
        ]
      );
    }

    // 2. Restore Savings Challenge
    if (data.savings_challenge && Array.isArray(data.savings_challenge)) {
      for (const c of data.savings_challenge) {
        await db.execute(
          `INSERT INTO savings_challenge (id, salary, start_month, completed_months, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             salary = EXCLUDED.salary,
             start_month = EXCLUDED.start_month,
             completed_months = EXCLUDED.completed_months,
             updated_at = EXCLUDED.updated_at`,
          [
            c.id,
            parseFloat(c.salary),
            c.start_month,
            typeof c.completed_months === "string" ? c.completed_months : JSON.stringify(c.completed_months || []),
            c.updated_at || new Date().toISOString(),
          ]
        );
      }
    }

    // 3. Restore Couples Goals
    if (data.couples_goals && Array.isArray(data.couples_goals)) {
      for (const g of data.couples_goals) {
        await db.execute(
          `INSERT INTO couples_goals (id, title, category, target_amount, current_amount, target_date, invite_code, partner_name, creator_name, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             target_amount = EXCLUDED.target_amount,
             current_amount = EXCLUDED.current_amount,
             status = EXCLUDED.status`,
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
          ]
        );
      }
    }

    // 4. Restore Couples Contributions
    if (data.couples_contributions && Array.isArray(data.couples_contributions)) {
      for (const cc of data.couples_contributions) {
        await db.execute(
          `INSERT INTO couples_contributions (id, goal_id, contributor_name, amount, note, date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
          [
            cc.id,
            cc.goal_id,
            cc.contributor_name,
            parseFloat(cc.amount),
            cc.note,
            cc.date,
            cc.created_at || new Date().toISOString(),
          ]
        );
      }
    }

    // 5. Restore Friend Streaks
    if (data.friend_streaks && Array.isArray(data.friend_streaks)) {
      for (const f of data.friend_streaks) {
        await db.execute(
          `INSERT INTO friend_streaks (friend_code, friend_name, streak_count, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (friend_code) DO UPDATE SET
             friend_name = EXCLUDED.friend_name,
             streak_count = EXCLUDED.streak_count,
             updated_at = EXCLUDED.updated_at`,
          [
            f.friend_code,
            f.friend_name,
            parseInt(f.streak_count, 10),
            f.updated_at || new Date().toISOString(),
          ]
        );
      }
    }

    return NextResponse.json({ success: true, count: data.transactions.length });
  } catch (err) {
    console.error("Backup import error:", err);
    return NextResponse.json({ error: "Error al restaurar respaldo" }, { status: 500 });
  }
}
