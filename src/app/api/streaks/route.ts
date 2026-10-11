import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getParaguayDateString } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

interface FriendCodeSetting {
  key: string;
  value: string;
}

function friendCodeSettingKey(userId: number) {
  // Keep the original code for the legacy account so existing shared codes still work.
  return userId === 1 ? "my_friend_code" : `my_friend_code_${userId}`;
}

async function getOrCreateFriendCode(userId: number) {
  const key = friendCodeSettingKey(userId);
  const existing = await db.queryOne<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  if (existing?.value) return existing.value;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `ALPEDO-${randomBytes(3).toString("hex").toUpperCase()}`;
    const duplicate = await db.queryOne<{ key: string }>(
      "SELECT key FROM settings WHERE value = ? AND (key = 'my_friend_code' OR key ~ '^my_friend_code_[0-9]+$') LIMIT 1",
      [code]
    );
    if (duplicate) continue;

    await db.execute(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING",
      [key, code]
    );
    const saved = await db.queryOne<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [key]
    );
    if (saved?.value) return saved.value;
  }

  throw new Error("No se pudo crear un código de amistad único");
}

function userIdFromFriendCodeSetting(setting: FriendCodeSetting): number | null {
  if (setting.key === "my_friend_code") return 1;
  const match = /^my_friend_code_(\d+)$/.exec(setting.key);
  return match ? Number(match[1]) : null;
}

function daysBetween(startDate: string, endDate: string) {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : null;
  if (!start || !end) return 0;

  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
}

interface StreakValue {
  days: number | null;
  source: "last_al_pedo" | "tracking_start" | "unknown";
}

async function getStreakDays(userId: number, initializeTracking = false): Promise<StreakValue> {
  const lastAlPedo = await db.queryOne<{ date: string }>(
    `SELECT date::text AS date
     FROM transactions
     WHERE type = 'expense' AND category = 'al_pedo'
       AND (user_id = ? OR (user_id IS NULL AND ? = 1))
     ORDER BY date DESC
     LIMIT 1`,
    [userId, userId]
  );

  const today = getParaguayDateString();
  if (lastAlPedo?.date) return { days: daysBetween(lastAlPedo.date, today), source: "last_al_pedo" };

  const trackingKey = `streak_tracking_start_${userId}`;
  let trackingStart = await db.queryOne<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [trackingKey]
  );

  if (!trackingStart && initializeTracking) {
    await db.execute(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING",
      [trackingKey, today]
    );
    trackingStart = await db.queryOne<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [trackingKey]
    );
  }

  return trackingStart?.value
    ? { days: daysBetween(trackingStart.value, today), source: "tracking_start" }
    : { days: null, source: "unknown" };
}

async function findAccountByFriendCode(code: string) {
  const setting = await db.queryOne<FriendCodeSetting>(
    `SELECT key, value
     FROM settings
     WHERE value = ? AND (key = 'my_friend_code' OR key ~ '^my_friend_code_[0-9]+$')
     LIMIT 1`,
    [code]
  );
  if (!setting) return null;

  const userId = userIdFromFriendCodeSetting(setting);
  if (!userId) return null;

  const account = await db.queryOne<{ id: number }>("SELECT id FROM users WHERE id = ?", [userId]);
  return account ? { id: userId } : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const [myFriendCode, myStreakDays, friendRows] = await Promise.all([
      getOrCreateFriendCode(user.id),
      getStreakDays(user.id, true),
      db.query<{ friend_code: string; friend_name: string }>(
        "SELECT friend_code, friend_name FROM friend_streaks WHERE user_id = ? ORDER BY friend_name ASC",
        [user.id]
      ),
    ]);

    const friends = await Promise.all(
      friendRows.map(async (friend) => {
        const account = await findAccountByFriendCode(friend.friend_code);
        const streak = account ? await getStreakDays(account.id) : { days: null, source: "unknown" as const };
        return {
          ...friend,
          connected: Boolean(account),
          streak_count: streak.days,
        };
      })
    );

    return NextResponse.json(
      {
        myFriendCode,
        myStreakDays: myStreakDays.days ?? 0,
        streakSource: myStreakDays.source,
        friends,
        leaderboard: [],
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("Error in streaks API:", err);
    return NextResponse.json({ error: "No pudimos cargar tus rachas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();

    if (body.action === "add_friend") {
      const code = typeof body.friend_code === "string" ? body.friend_code.trim().toUpperCase() : "";
      const name = typeof body.friend_name === "string" ? body.friend_name.trim() : "";
      if (!code || !name) {
        return NextResponse.json({ error: "Ingresá el código y el apodo de tu amigo." }, { status: 400 });
      }
      if (code.length > 30 || name.length > 40) {
        return NextResponse.json({ error: "Revisá el largo del código y del apodo." }, { status: 400 });
      }

      const ownCode = await getOrCreateFriendCode(user.id);
      if (code === ownCode) {
        return NextResponse.json({ error: "Ese es tu propio código. Pedile el suyo a tu amigo." }, { status: 400 });
      }

      const friendAccount = await findAccountByFriendCode(code);
      if (!friendAccount) {
        return NextResponse.json(
          { error: "No encontramos ese código. Pedile a tu amigo que lo copie desde su sección Rachas." },
          { status: 404 }
        );
      }

      await db.execute(
        `INSERT INTO friend_streaks (user_id, friend_code, friend_name, streak_type)
         VALUES (?, ?, ?, 'control_al_pedo')
         ON CONFLICT (user_id, friend_code) DO UPDATE SET friend_name = EXCLUDED.friend_name`,
        [user.id, code, name]
      );

      return NextResponse.json({ success: true });
    }

    if (body.action === "delete_friend") {
      const code = typeof body.friend_code === "string" ? body.friend_code.trim().toUpperCase() : "";
      if (!code) return NextResponse.json({ error: "Código requerido." }, { status: 400 });

      await db.execute("DELETE FROM friend_streaks WHERE user_id = ? AND friend_code = ?", [user.id, code]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    console.error("Error in streaks POST API:", err);
    return NextResponse.json({ error: "No pudimos actualizar el duelo. Probá de nuevo." }, { status: 500 });
  }
}
