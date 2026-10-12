const { Pool } = require("pg");

const databaseUrl = process.env.ACCOUNT_DELETION_TEST_DATABASE_URL;
const baseUrl = process.env.ACCOUNT_DELETION_TEST_BASE_URL || "http://127.0.0.1:3002";
if (!databaseUrl) throw new Error("Set ACCOUNT_DELETION_TEST_DATABASE_URL to an isolated localhost database.");
if (!new Set(["localhost", "127.0.0.1", "::1"]).has(new URL(databaseUrl).hostname)) {
  throw new Error("Refusing to run destructive account-deletion tests outside localhost.");
}
if (!new Set(["localhost", "127.0.0.1", "::1"]).has(new URL(baseUrl).hostname)) {
  throw new Error("Refusing to send account-deletion tests outside localhost.");
}

const pool = new Pool({ connectionString: databaseUrl });
let qaAccount;
let ownerAccount;
let lockoutAccount;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sessionCookie(response) {
  const value = response.headers.get("set-cookie") || "";
  return /finanzas_auth_session=[^;]+/.exec(value)?.[0] || "";
}

async function registerAccount(label) {
  const email = `qa-delete-${label}-${Date.now()}@example.invalid`;
  const pin = "806241";
  const response = await fetch(`${baseUrl}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", name: `QA deletion ${label}`, email, pin }),
  });
  const data = await response.json();
  assert(response.ok && data.user?.id, `QA registration failed (${response.status}).`);
  const cookie = sessionCookie(response);
  assert(cookie, "Registration did not issue its session cookie.");
  return { id: data.user.id, email, pin, cookie };
}

async function deleteViaApi(account, values = {}) {
  const response = await fetch(`${baseUrl}/api/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: account.cookie },
    body: JSON.stringify({
      email: account.email,
      pin: account.pin,
      confirmation: "ELIMINAR MI CUENTA",
      ...values,
    }),
  });
  return { response, data: await response.json().catch(() => ({})) };
}

async function changePinViaApi(account, oldPin = "000000") {
  const response = await fetch(`${baseUrl}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: account.cookie },
    body: JSON.stringify({ action: "change_pin", oldPin, newPin: "123456" }),
  });
  return { response, data: await response.json().catch(() => ({})) };
}

async function accountExists(id) {
  return (await pool.query("SELECT 1 FROM users WHERE id = $1", [id])).rowCount === 1;
}

async function cleanup(account) {
  if (!account || !(await accountExists(account.id))) return;
  try {
    await pool.query("DELETE FROM auth_login_limits WHERE LOWER(email) = LOWER($1)", [account.email]);
    await deleteViaApi(account);
  } catch {
    // Best-effort cleanup for the two explicitly created QA accounts only.
  }
}

async function run() {
  await pool.query(`CREATE TABLE IF NOT EXISTS auth_recovery_codes (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const initialCount = Number((await pool.query("SELECT COUNT(*)::int AS count FROM users")).rows[0].count);
  qaAccount = await registerAccount("participant");
  ownerAccount = await registerAccount("owner");
  lockoutAccount = await registerAccount("lockout");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await changePinViaApi(lockoutAccount);
    assert(result.response.status === 400, `Wrong PIN attempt ${attempt + 1} returned ${result.response.status}.`);
  }
  const blockedPinChange = await changePinViaApi(lockoutAccount);
  assert(blockedPinChange.response.status === 429, `PIN change lockout returned ${blockedPinChange.response.status}.`);
  await pool.query("DELETE FROM auth_login_limits WHERE LOWER(email) = LOWER($1)", [lockoutAccount.email]);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await deleteViaApi(lockoutAccount, { pin: "000000" });
    assert(result.response.status === 400, `Wrong deletion PIN attempt ${attempt + 1} returned ${result.response.status}.`);
    assert(await accountExists(lockoutAccount.id), "Account was deleted after an incorrect PIN.");
  }
  const blockedDeletion = await deleteViaApi(lockoutAccount, { pin: lockoutAccount.pin });
  assert(blockedDeletion.response.status === 429, `Account-deletion lockout returned ${blockedDeletion.response.status}.`);
  await pool.query("DELETE FROM auth_login_limits WHERE LOWER(email) = LOWER($1)", [lockoutAccount.email]);
  const lockoutCleanup = await deleteViaApi(lockoutAccount);
  assert(lockoutCleanup.response.ok, "Could not clean up the lockout QA account.");
  lockoutAccount = null;
  console.log("PASS PIN change and account deletion lock after five incorrect attempts");

  const qaCode = `QA-${qaAccount.id}-CODE`;
  const ownedGoalId = (await pool.query(
    `INSERT INTO couples_goals (title, target_amount, current_amount, invite_code, user_id)
     VALUES ('QA owned goal', 10000, 2000, $1, $2) RETURNING id`,
    [`QA-OWNED-${qaAccount.id}`, qaAccount.id],
  )).rows[0].id;
  const sharedGoalId = (await pool.query(
    `INSERT INTO couples_goals (title, target_amount, current_amount, invite_code, user_id, partner_user_id, partner_name, creator_name)
     VALUES ('QA partner goal', 50000, 12345, $1, $2, $3, 'QA participant', 'QA owner') RETURNING id`,
    [`QA-SHARED-${qaAccount.id}`, ownerAccount.id, qaAccount.id],
  )).rows[0].id;

  await pool.query(
    `INSERT INTO couples_contributions (goal_id, contributor_name, contributor_user_id, amount)
     VALUES ($1, 'QA creator', $2, 2000), ($3, 'QA participant', $4, 2345), ($3, 'QA owner', $5, 10000)`,
    [ownedGoalId, qaAccount.id, sharedGoalId, qaAccount.id, ownerAccount.id],
  );
  await pool.query(
    `INSERT INTO transactions (id, type, category, amount, description, date, user_id)
     VALUES ($1, 'expense', 'variable', 1500, 'QA transaction', CURRENT_DATE, $2),
            ($3, 'expense', 'variable', 2400, 'Owner transaction', CURRENT_DATE, $4)`,
    [`qa-del-${qaAccount.id}`, qaAccount.id, `qa-owner-${ownerAccount.id}`, ownerAccount.id],
  );
  await pool.query(
    `INSERT INTO loan_simulations (id, user_id, title, amount, installments, monthly_payment, total_payment)
     VALUES ($1, $2, 'QA loan', 10000, 2, 5000, 10000)`,
    [`qa-loan-${qaAccount.id}`, qaAccount.id],
  );
  await pool.query(
    `INSERT INTO savings_challenge (id, salary, start_month, completed_months, user_id)
     VALUES ($1, 100000, to_char(CURRENT_DATE, 'YYYY-MM'), '[]', $2)`,
    [`qa-challenge-${qaAccount.id}`, qaAccount.id],
  );
  await pool.query(
    `INSERT INTO friend_streaks (user_id, friend_code, friend_name)
     VALUES ($1, $2, 'QA friend'), ($3, $4, 'QA account')`,
    [qaAccount.id, `QA-FRIEND-${qaAccount.id}`, ownerAccount.id, qaCode],
  );
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2), ($3, '2026-10-01')`,
    [`my_friend_code_${qaAccount.id}`, qaCode, `streak_tracking_start_${qaAccount.id}`],
  );
  await pool.query(
    "INSERT INTO streak_leaderboard_optins (user_id, display_name, enabled) VALUES ($1, 'QA deletion', TRUE)",
    [qaAccount.id],
  );
  await pool.query(
    "INSERT INTO auth_recovery_codes (user_id, code_hash) VALUES ($1, repeat('a', 64))",
    [qaAccount.id],
  );
  await pool.query("INSERT INTO auth_login_limits (email, attempts) VALUES ($1, 2)", [qaAccount.email]);

  for (const invalid of [
    { email: "wrong@example.invalid" },
    { confirmation: "ELIMINAR" },
    { pin: "000000" },
  ]) {
    const result = await deleteViaApi(qaAccount, invalid);
    assert(result.response.status === 400, `Invalid confirmation unexpectedly returned ${result.response.status}.`);
    assert(await accountExists(qaAccount.id), "Account was deleted after invalid confirmation.");
  }
  console.log("PASS invalid email, phrase, and PIN leave the account intact");

  const result = await deleteViaApi(qaAccount);
  assert(result.response.ok && result.data.success, `Valid deletion failed (${result.response.status}).`);
  assert(!(await accountExists(qaAccount.id)), "User record remains.");
  for (const table of ["transactions", "loan_simulations", "savings_challenge", "friend_streaks", "auth_sessions", "auth_recovery_codes", "streak_leaderboard_optins"]) {
    const rows = await pool.query(`SELECT 1 FROM ${table} WHERE user_id = $1 LIMIT 1`, [qaAccount.id]);
    assert(rows.rowCount === 0, `Private rows remain in ${table}.`);
  }
  assert((await pool.query("SELECT 1 FROM couples_goals WHERE user_id = $1", [qaAccount.id])).rowCount === 0, "Owned goal remains.");
  assert((await pool.query("SELECT 1 FROM settings WHERE key = $1", [`my_friend_code_${qaAccount.id}`])).rowCount === 0, "Friend code remains.");
  assert((await pool.query("SELECT 1 FROM friend_streaks WHERE friend_code = $1", [qaCode])).rowCount === 0, "References to the deleted friend code remain.");

  const goal = (await pool.query("SELECT partner_user_id, current_amount FROM couples_goals WHERE id = $1", [sharedGoalId])).rows[0];
  assert(goal && goal.partner_user_id === null && Number(goal.current_amount) === 12345, "Other account's shared goal was not preserved and detached.");
  const contribution = (await pool.query(
    "SELECT contributor_user_id, contributor_name, amount FROM couples_contributions WHERE goal_id = $1 AND amount = 2345",
    [sharedGoalId],
  )).rows[0];
  assert(contribution && contribution.contributor_user_id === null && contribution.contributor_name === "Cuenta eliminada" && Number(contribution.amount) === 2345, "Shared contribution was not anonymized with its amount preserved.");
  assert((await pool.query("SELECT 1 FROM transactions WHERE id = $1", [`qa-owner-${ownerAccount.id}`])).rowCount === 1, "Another account's transaction was deleted.");
  assert(Number((await pool.query("SELECT COUNT(*)::int AS count FROM users")).rows[0].count) === initialCount + 1, "Unexpected user count after deletion.");
  console.log("PASS private data removed; other account data and shared-goal totals preserved");

  const ownerResult = await deleteViaApi(ownerAccount);
  assert(ownerResult.response.ok, "QA owner cleanup failed.");
  ownerAccount = null;
  assert(Number((await pool.query("SELECT COUNT(*)::int AS count FROM users")).rows[0].count) === initialCount, "QA accounts were not fully cleaned up.");
  console.log("PASS QA accounts cleaned; initial local account count restored");
}

run()
  .catch((error) => {
    console.error("FAIL", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup(qaAccount);
    await cleanup(ownerAccount);
    await pool.end();
  });
