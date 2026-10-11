import { NextResponse } from "next/server";
import db from "@/lib/db";
import { checkAuth } from "@/lib/auth";

interface TransactionRow {
  date: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  is_recurring: number;
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await db.query<TransactionRow>(`
    SELECT date, type, category, amount, description, is_recurring
    FROM transactions
    ORDER BY date DESC, created_at DESC
  `);

  // Build CSV with UTF-8 BOM for Microsoft Excel compatibility
  const BOM = "\uFEFF";
  const headers = ["Fecha", "Tipo", "Categoría", "Monto (Guaraníes)", "Descripción", "Recurrente"];

  const escapeCSV = (val: string | number) => {
    const str = String(val ?? "").replace(/"/g, '""');
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
  const today = new Date().toISOString().split("T")[0];

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finanzas_movimientos_${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
