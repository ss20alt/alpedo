import { NextResponse } from "next/server";
import db from "@/lib/db";
import { checkAuth } from "@/lib/auth";

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // 1. Get or create user friend code
    let friendCodeRow = await db.queryOne<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'my_friend_code'"
    );

    if (!friendCodeRow) {
      const generatedCode = `ALPEDO-${Math.floor(1000 + Math.random() * 9000)}`;
      await db.execute(
        "INSERT INTO settings (key, value) VALUES ('my_friend_code', ?) ON CONFLICT (key) DO NOTHING",
        [generatedCode]
      );
      friendCodeRow = { value: generatedCode };
    }

    // 2. Calculate current streak based on transactions
    // How many days since the last 'al_pedo' expense
    const lastAlPedo = await db.queryOne<{ date: string }>(
      "SELECT date FROM transactions WHERE category = 'al_pedo' ORDER BY date DESC LIMIT 1"
    );

    let streakDays = 14; // Default motivating streak if no al_pedo expense ever recorded
    if (lastAlPedo && lastAlPedo.date) {
      const [y, m, d] = lastAlPedo.date.split("-").map(Number);
      const lastMidnight = new Date(y, m - 1, d).getTime();
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const diffDays = Math.max(0, Math.floor((todayMidnight - lastMidnight) / (1000 * 60 * 60 * 24)));
      streakDays = diffDays;
    }

    // 3. Community Leaderboard (Top Paraguayo)
    const communityLeaderboard = [
      { rank: 1, name: "El_Rey_Del_Lomito", badge: "👑 Ñandejára del Ahorro", streak: 42, city: "Asunción" },
      { rank: 2, name: "Vos (Tu Racha)", badge: streakDays >= 30 ? "🔥 Kape Mbarete" : "⚡ Kape en Racha", streak: streakDays, city: "Paraguay", isMe: true },
      { rank: 3, name: "Ahorrista_Luque", badge: "🛡️ Blindado", streak: 19, city: "Luque" },
      { rank: 4, name: "Mandioca_Power", badge: "💪 Firme", streak: 14, city: "San Lorenzo" },
      { rank: 5, name: "Terere_Inmortal", badge: "🧉 En Carrera", streak: 9, city: "CDE" },
    ].sort((a, b) => b.streak - a.streak).map((item, index) => ({ ...item, rank: index + 1 }));

    // 4. Friend duels from database
    const friendRows = await db.query("SELECT * FROM friend_streaks ORDER BY streak_count DESC");

    return NextResponse.json({
      myFriendCode: friendCodeRow.value,
      myStreakDays: streakDays,
      leaderboard: communityLeaderboard,
      friends: friendRows,
    });
  } catch (err) {
    console.error("Error in streaks API:", err);
    return NextResponse.json({ error: "Error al obtener rachas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "add_friend") {
      const { friend_code, friend_name } = body;
      if (!friend_code || !friend_name) {
        return NextResponse.json({ error: "Código y apodo requeridos" }, { status: 400 });
      }

      const randomStreak = Math.floor(3 + Math.random() * 18);
      await db.execute(
        `INSERT INTO friend_streaks (friend_code, friend_name, streak_count)
         VALUES (?, ?, ?)
         ON CONFLICT (friend_code) DO UPDATE SET friend_name = EXCLUDED.friend_name`,
        [String(friend_code).trim().toUpperCase(), String(friend_name).trim(), randomStreak]
      );

      return NextResponse.json({ success: true });
    }

    if (action === "delete_friend") {
      const { friend_code } = body;
      if (!friend_code) {
        return NextResponse.json({ error: "Código requerido" }, { status: 400 });
      }
      await db.execute("DELETE FROM friend_streaks WHERE friend_code = ?", [String(friend_code).trim()]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    console.error("Error in streaks POST API:", err);
    return NextResponse.json({ error: "Error al procesar racha" }, { status: 500 });
  }
}
