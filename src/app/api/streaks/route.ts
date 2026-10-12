import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getParaguayDateString } from "@/lib/date-utils";
import { rankStreakParticipants } from "@/lib/streak-leaderboard";

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

async function getCommunityLeaderboard() {
  const optIns = await db.query<{ user_id: number; display_name: string }>(
    "SELECT user_id, display_name FROM streak_leaderboard_optins WHERE enabled = TRUE ORDER BY updated_at ASC"
  );
  if (optIns.length === 0) return [];

  const userIds = optIns.map(({ user_id }) => Number(user_id));
  const placeholders = userIds.map(() => "?").join(", ");
  const lastActivityRows = await db.query<{ user_id: number | null; date: string }>(
    `SELECT user_id, MAX(date)::text AS date
     FROM transactions
     WHERE type = 'expense' AND category = 'al_pedo'
       AND (user_id IN (${placeholders}) OR (user_id IS NULL AND ? = 1))
     GROUP BY user_id`,
    [...userIds, userIds.includes(1) ? 1 : 0]
  );
  const trackingRows = await db.query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key LIKE 'streak_tracking_start_%'"
  );
  const lastActivityByUser = new Map(lastActivityRows.map((row) => [Number(row.user_id), row.date]));
  const legacyLastActivity = lastActivityByUser.get(0);
  const trackingByUser = new Map(
    trackingRows.map(({ key, value }) => [Number(key.replace("streak_tracking_start_", "")), value])
  );
  const today = getParaguayDateString();

  const ranked = rankStreakParticipants(optIns.map(({ user_id, display_name }) => {
    const id = Number(user_id);
    const lastActivity = lastActivityByUser.get(id) || (id === 1 ? legacyLastActivity : undefined);
    const trackingStart = trackingByUser.get(id);
    const days = lastActivity ? daysBetween(lastActivity, today) : trackingStart ? daysBetween(trackingStart, today) : 0;
    return { displayName: display_name, days };
  }));

  return ranked;
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

  const account = await db.queryOne<{ id: number; name: string }>(
    "SELECT id, name FROM users WHERE id = ?",
    [userId]
  );
  return account ? { id: Number(account.id), name: account.name } : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const [myFriendCode, myStreakDays, friendRows, leaderboardPreference, leaderboard] = await Promise.all([
      getOrCreateFriendCode(user.id),
      getStreakDays(user.id, true),
      db.query<{ friend_code: string; friend_name: string }>(
        "SELECT friend_code, friend_name FROM friend_streaks WHERE user_id = ? ORDER BY friend_name ASC",
        [user.id]
      ),
      db.queryOne<{ display_name: string }>(
        "SELECT display_name FROM streak_leaderboard_optins WHERE user_id = ? AND enabled = TRUE",
        [user.id]
      ),
      getCommunityLeaderboard(),
    ]);

    const friends = await Promise.all(
      friendRows.map(async (friend) => {
        const account = await findAccountByFriendCode(friend.friend_code);
        if (account && account.id !== user.id) {
          // Older versions only stored the duel for the person who entered the code.
          // Create the missing reverse row without overwriting a nickname they chose.
          await db.execute(
            `INSERT INTO friend_streaks (user_id, friend_code, friend_name, streak_type)
             VALUES (?, ?, ?, 'control_al_pedo')
             ON CONFLICT (user_id, friend_code) DO NOTHING`,
            [account.id, myFriendCode, user.name || "Amigo"]
          );
        }
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
        leaderboardEnabled: Boolean(leaderboardPreference),
        leaderboardName: leaderboardPreference?.display_name || "",
        leaderboard,
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
      if (!code) {
        return NextResponse.json({ error: "Ingresá el código de invitación." }, { status: 400 });
      }
      if (code.length > 30) {
        return NextResponse.json({ error: "Revisá el largo del código de invitación." }, { status: 400 });
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
      if (friendAccount.id === user.id) {
        return NextResponse.json({ error: "Ese es tu propio código. Pedile el suyo a tu amigo." }, { status: 400 });
      }

      await db.withTransaction(async () => {
        // The code owner and the person entering it are linked immediately.
        // Existing aliases are preserved independently on each account.
        await db.execute(
          `INSERT INTO friend_streaks (user_id, friend_code, friend_name, streak_type)
           VALUES (?, ?, ?, 'control_al_pedo')
           ON CONFLICT (user_id, friend_code) DO NOTHING`,
          [user.id, code, friendAccount.name || "Amigo"]
        );
        await db.execute(
          `INSERT INTO friend_streaks (user_id, friend_code, friend_name, streak_type)
           VALUES (?, ?, ?, 'control_al_pedo')
           ON CONFLICT (user_id, friend_code) DO NOTHING`,
          [friendAccount.id, ownCode, user.name || "Amigo"]
        );
      });

      return NextResponse.json({ success: true, linkedForBoth: true });
    }

    if (body.action === "rename_friend") {
      const code = typeof body.friend_code === "string" ? body.friend_code.trim().toUpperCase() : "";
      const name = typeof body.friend_name === "string"
        ? body.friend_name.trim().replace(/\s+/g, " ")
        : "";
      if (!code || code.length > 30) {
        return NextResponse.json({ error: "Revisá el código del duelo." }, { status: 400 });
      }
      if (name.length < 2 || name.length > 40) {
        return NextResponse.json({ error: "El apodo debe tener entre 2 y 40 caracteres." }, { status: 400 });
      }

      const updated = await db.execute(
        "UPDATE friend_streaks SET friend_name = ? WHERE user_id = ? AND friend_code = ?",
        [name, user.id, code]
      );
      if (updated === 0) {
        return NextResponse.json({ error: "Ese duelo ya no está en tu lista." }, { status: 404 });
      }

      return NextResponse.json({ success: true, friend_name: name });
    }

    if (body.action === "delete_friend") {
      const code = typeof body.friend_code === "string" ? body.friend_code.trim().toUpperCase() : "";
      if (!code) return NextResponse.json({ error: "Código requerido." }, { status: 400 });

      const existingLink = await db.queryOne<{ id: number }>(
        "SELECT id FROM friend_streaks WHERE user_id = ? AND friend_code = ?",
        [user.id, code]
      );
      if (!existingLink) {
        return NextResponse.json({ error: "Ese duelo ya no está en tu lista." }, { status: 404 });
      }

      const friendAccount = await findAccountByFriendCode(code);
      const ownCode = await getOrCreateFriendCode(user.id);
      await db.withTransaction(async () => {
        await db.execute("DELETE FROM friend_streaks WHERE user_id = ? AND friend_code = ?", [user.id, code]);
        if (friendAccount && friendAccount.id !== user.id) {
          await db.execute(
            "DELETE FROM friend_streaks WHERE user_id = ? AND friend_code = ?",
            [friendAccount.id, ownCode]
          );
        }
      });
      return NextResponse.json({ success: true, unlinkedForBoth: true });
    }

    if (body.action === "leaderboard_opt_in") {
      if (body.enabled === false) {
        await db.execute("DELETE FROM streak_leaderboard_optins WHERE user_id = ?", [user.id]);
        return NextResponse.json({ success: true, enabled: false });
      }

      const displayName = typeof body.display_name === "string" ? body.display_name.trim().replace(/\s+/g, " ") : "";
      if (displayName.length < 2 || displayName.length > 30) {
        return NextResponse.json({ error: "Elegí un apodo de 2 a 30 caracteres para el ranking." }, { status: 400 });
      }

      await getStreakDays(user.id, true);
      await db.execute(
        `INSERT INTO streak_leaderboard_optins (user_id, display_name, enabled, updated_at)
         VALUES (?, ?, TRUE, NOW())
         ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, enabled = TRUE, updated_at = NOW()`,
        [user.id, displayName]
      );
      return NextResponse.json({ success: true, enabled: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    console.error("Error in streaks POST API:", err);
    return NextResponse.json({ error: "No pudimos actualizar el duelo. Probá de nuevo." }, { status: 500 });
  }
}
