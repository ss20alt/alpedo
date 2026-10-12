import { NextResponse } from "next/server";
import { getParaguayDateString } from "@/lib/date-utils";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/security";

interface TransactionRow {
  date: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  is_recurring: number;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const limited = await rateLimitResponse(`transaction-export:user:${user.id}`, 20, 60 * 60, "transaction-export");
  if (limited) return limited;

  const rows = await db.query<TransactionRow>(`
    SELECT date, type, category, amount, description, is_recurring
    FROM transactions
    WHERE user_id = ? OR (user_id IS NULL AND ? = 1)
    ORDER BY date DESC, created_at DESC
  `, [user.id, user.id]);

  // Build CSV with UTF-8 BOM for Microsoft Excel compatibility
  const BOM = "\uFEFF";
  const headers = ["Fecha", "Tipo", "Categoría", "Monto (Guaraníes)", "Descripción", "Recurrente"];

  const escapeCSV = (val: string | number) => {
    const raw = String(val ?? "");
    const safe = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    const str = safe.replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [headers.map(escapeCSV).join(",")];

  for (const row of rows) {
    const typeLabel = row.type === "income" ? "Ingreso" : "Gasto";
    let categoryLabel = row.category;
    if (row.category === "al_pedo") categoryLabel = "¡Al Pedo!";
    else if (row.category === "fijo") categoryLabel = "Fijo";
    else if (row.category === "variable") categoryLabel = "Variable";
    else if (row.category === "pasivo") categoryLabel = "Pasivo";

    csvRows.push([
      escapeCSV(row.date),
      escapeCSV(typeLabel),
      escapeCSV(categoryLabel),
      escapeCSV(Math.round(row.amount)),
      escapeCSV(row.description),
      escapeCSV(row.is_recurring ? "Sí" : "No"),
    ].join(","));
  }

  const csvContent = BOM + csvRows.join("\r\n");
  const today = getParaguayDateString();

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finanzas_movimientos_${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
