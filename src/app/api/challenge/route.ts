import { NextResponse } from "next/server";
import db from "@/lib/db";
import { checkAuth } from "@/lib/auth";

interface ChallengeRow {
  id: string;
  salary: number;
  start_month: string;
  completed_months: string;
  updated_at: string;
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const row = await db.queryOne<ChallengeRow>("SELECT * FROM savings_challenge WHERE id = 'default'");

    if (!row) {
      return NextResponse.json({
        salary: 3044000,
        start_month: "2026-10",
        completed_months: [],
      });
    }

    let completedList: number[] = [];
    try {
      completedList = JSON.parse(row.completed_months || "[]");
    } catch {
      completedList = [];
    }

    return NextResponse.json({
      salary: parseFloat(String(row.salary)) || 3044000,
      start_month: row.start_month || "2026-10",
      completed_months: completedList,
    });
  } catch (err) {
    console.error("Error fetching challenge:", err);
    return NextResponse.json({ error: "Error al obtener reto" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, salary, start_month, month_index } = body;

    const row = await db.queryOne<ChallengeRow>("SELECT * FROM savings_challenge WHERE id = 'default'");
    let currentSalary = row?.salary ? parseFloat(String(row.salary)) : 3044000;
    let currentStartMonth = row?.start_month ?? "2026-10";
    let completedList: number[] = [];
    try {
      completedList = JSON.parse(row?.completed_months || "[]");
    } catch {
      completedList = [];
    }

    if (action === "update_config") {
      if (salary !== undefined) {
        const parsed = parseFloat(salary);
        if (!isNaN(parsed) && parsed > 0) currentSalary = parsed;
      }
      if (start_month) {
        currentStartMonth = start_month;
      }
    } else if (action === "toggle_month") {
      const idx = parseInt(month_index);
      if (!isNaN(idx) && idx >= 1 && idx <= 12) {
        if (completedList.includes(idx)) {
          completedList = completedList.filter((m) => m !== idx);
        } else {
          completedList.push(idx);
          completedList.sort((a, b) => a - b);
        }
      }
    } else if (action === "reset") {
      completedList = [];
    }

    await db.execute(
      `INSERT INTO savings_challenge (id, salary, start_month, completed_months, updated_at)
       VALUES ('default', ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         salary = EXCLUDED.salary,
         start_month = EXCLUDED.start_month,
         completed_months = EXCLUDED.completed_months,
         updated_at = CURRENT_TIMESTAMP`,
      [currentSalary, currentStartMonth, JSON.stringify(completedList)]
    );

    return NextResponse.json({
      salary: currentSalary,
      start_month: currentStartMonth,
      completed_months: completedList,
    });
  } catch (err) {
    console.error("Error in challenge API:", err);
    return NextResponse.json({ error: "Error al actualizar reto" }, { status: 500 });
  }
}
