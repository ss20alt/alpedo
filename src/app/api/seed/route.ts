import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Datos de prueba no disponibles" }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const monthStr = `${year}-${month}`;

  // Realist demo data for Paraguay in Guaraníes (₲)
  const demoTransactions = [
    // Ingresos
    { type: "income", category: "fijo", amount: 4800000, description: "Salario Principal", date: `${monthStr}-05`, is_recurring: true },
    { type: "income", category: "variable", amount: 1500000, description: "Trabajo extra / Comisiones", date: `${monthStr}-15`, is_recurring: false },
    { type: "income", category: "pasivo", amount: 450000, description: "Intereses CDA / Billetera / Inversión", date: `${monthStr}-20`, is_recurring: true },
    
    // Gastos Fijos
    { type: "expense", category: "fijo", amount: 1800000, description: "Alquiler departamento / casa", date: `${monthStr}-06`, is_recurring: true },
    { type: "expense", category: "fijo", amount: 320000, description: "Factura ANDE (Electricidad)", date: `${monthStr}-08`, is_recurring: true },
    { type: "expense", category: "fijo", amount: 85000, description: "Factura Essap (Agua)", date: `${monthStr}-09`, is_recurring: true },
    { type: "expense", category: "fijo", amount: 180000, description: "Internet Fibra y Plan Celular", date: `${monthStr}-10`, is_recurring: true },
    { type: "expense", category: "fijo", amount: 120000, description: "Suscripciones (Netflix, Spotify)", date: `${monthStr}-12`, is_recurring: true },

    // Gastos Variables Necesarios
    { type: "expense", category: "variable", amount: 1350000, description: "Supermercado (Stock / Superseis)", date: `${monthStr}-07`, is_recurring: false },
    { type: "expense", category: "variable", amount: 450000, description: "Combustible / Nafta", date: `${monthStr}-14`, is_recurring: false },
    { type: "expense", category: "variable", amount: 160000, description: "Farmacia (Punto Farma / Catedral)", date: `${monthStr}-18`, is_recurring: false },

    // "Gastos AL PEDO" (Prescindibles / Impulso)
    { type: "expense", category: "al_pedo", amount: 220000, description: "Delivery PedidosYa por flojera", date: `${monthStr}-09`, is_recurring: false },
    { type: "expense", category: "al_pedo", amount: 350000, description: "Salida nocturna / Bar en Carmelitas", date: `${monthStr}-13`, is_recurring: false },
    { type: "expense", category: "al_pedo", amount: 180000, description: "Compra impulsiva no planificada", date: `${monthStr}-21`, is_recurring: false },
    { type: "expense", category: "al_pedo", amount: 95000, description: "Cafeterías, lomitería y snacks", date: `${monthStr}-25`, is_recurring: false },
  ];

  try {
    for (const t of demoTransactions) {
      await db.execute(
        `INSERT INTO transactions (id, user_id, type, category, amount, description, date, is_recurring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), user.id, t.type, t.category, t.amount, t.description, t.date, t.is_recurring]
      );
    }

    return NextResponse.json({ success: true, count: demoTransactions.length });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: "Error al cargar datos de prueba" }, { status: 500 });
  }
}
