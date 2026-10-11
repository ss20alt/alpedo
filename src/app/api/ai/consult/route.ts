import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { calculateFinancialMetrics, Transaction } from "@/lib/finance-engine";
import { getParaguayDateString } from "@/lib/date-utils";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const amount = Number(body?.amount);
    const description = typeof body?.description === "string"
      ? body.description.trim().slice(0, 150)
      : "Gasto consultado";
    const category = body.category === "variable" ? "variable" : "al_pedo";
    const budgetAlPedoLimit = Math.max(0, Number(user.budget_al_pedo_limit) || 500000);
    const budgetVariableLimit = Math.max(0, Number(user.budget_variable_limit) || 1500000);

    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000_000) {
      return NextResponse.json({ error: "Ingresá un monto válido mayor a 0" }, { status: 400 });
    }

    // Current month in PY
    const today = getParaguayDateString();
    const currentMonth = today.slice(0, 7);
    const [year, month] = currentMonth.split("-").map(Number);
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const daysRemaining = Math.max(1, lastDayOfMonth - Number(today.slice(8)) + 1);

    // Fetch transactions
    const rows = await db.query<Transaction>(
      "SELECT * FROM transactions WHERE date >= ? AND date < ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))",
      [`${currentMonth}-01`, new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), user.id, user.id]
    );
    const metrics = calculateFinancialMetrics(rows);

    // Evaluate Financial Impact
    const projectedNetSavings = metrics.netSavings - amount;
    const isAlPedo = category === "al_pedo";
    const currentCategorySpent = isAlPedo ? metrics.expenses.al_pedo : metrics.expenses.variable;
    const categoryLimit = isAlPedo ? budgetAlPedoLimit : budgetVariableLimit;
    const newCategorySpent = currentCategorySpent + amount;
    const percentAfter = categoryLimit > 0 ? (newCategorySpent / categoryLimit) * 100 : 100;
    const remainingInBudget = Math.max(0, categoryLimit - newCategorySpent);

    const projectedFreeMargin = Math.max(0, metrics.freeMargin - amount);
    const dailyBudgetAfter = Math.max(0, Math.round(projectedFreeMargin / daysRemaining));

    // Mathematical status
    let status: "SEGURO" | "PRECAUCION" | "PELIGRO" = "SEGURO";
    let headline = "Hay margen según tus registros";
    let badgeColor = "bg-emerald-950 text-emerald-300 border-emerald-600";

    if (projectedNetSavings < 0 || percentAfter > 110) {
      status = "PELIGRO";
      headline = "Este gasto dejaría el mes en rojo";
      badgeColor = "bg-rose-950 text-rose-300 border-rose-700";
    } else if (percentAfter >= 75 || dailyBudgetAfter < 20000) {
      status = "PRECAUCION";
      headline = "Este gasto ajustaría tu margen";
      badgeColor = "bg-amber-950 text-amber-300 border-amber-600";
    }

    // Call Google Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    let aiMessage = "";

    if (apiKey) {
      try {
        const prompt = `Sos el asistente de finanzas de alpedo.app. Respondé en español paraguayo natural, claro y respetuoso.
La persona consulta cómo impactaría una compra en los movimientos que registró.

DATOS DEL GASTO:
- Quiere gastar: ₲ ${amount.toLocaleString("es-PY")} en "${description}".
- Tipo de gasto: ${isAlPedo ? 'Gusto al pedo / capricho prescindible' : 'Gasto variable del mes'}.

RESUMEN DE MOVIMIENTOS REGISTRADOS:
- Veredicto matemático de la app: ${status}
- Días que le faltan para terminar el mes: ${daysRemaining} días.
- Margen diario estimado tras el gasto: ₲ ${dailyBudgetAfter.toLocaleString("es-PY")} por día.
- Balance neto registrado tras el gasto: ₲ ${projectedNetSavings.toLocaleString("es-PY")}.
- Porcentaje consumido de su tope de presupuesto: ${percentAfter.toFixed(0)}%.

INSTRUCCIONES:
- Respondé en una o dos frases concretas, sin insultos, exageraciones ni consejos absolutos.
- Aclará que la conclusión depende de los movimientos cargados y puede faltar algún pago.
- Mencioná el margen cuando aporte a la decisión. Sin asteriscos ni títulos.`;

        const modelsCascade = [...new Set([
          process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
          "gemini-3.6-flash",
        ])];

        for (const model of modelsCascade) {
          try {
            if (!/^[a-z0-9.-]+$/.test(model)) continue;
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
              {
                method: "POST",
                signal: AbortSignal.timeout(4000),
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                }),
              }
            );

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              const candidateText =
                geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (candidateText) {
                aiMessage = candidateText;
                break; // Model responded successfully! Exit cascade
              }
            } else {
              console.warn(`Gemini model ${model} returned HTTP ${geminiRes.status}. Escalating to next fallback model...`);
            }
          } catch (modelErr) {
            console.warn(`Network error on model ${model}:`, modelErr);
          }
        }
      } catch (geminiErr) {
        console.error("Gemini AI overall error:", geminiErr);
      }
    }

    // High quality offline fallback if AI is unavailable
    if (!aiMessage) {
      if (status === "PELIGRO") {
        aiMessage = isAlPedo
          ? `Según tus registros, este gasto de ₲ ${amount.toLocaleString("es-PY")} dejaría el mes en rojo. Revisá si podés esperar.`
          : "Según tus registros, este gasto dejaría el mes en déficit. Revisá tus próximos pagos antes de decidir.";
      } else if (status === "PRECAUCION") {
        aiMessage = `El margen quedaría ajustado. Si gastás esto, te quedarían ₲ ${dailyBudgetAfter.toLocaleString(
          "es-PY"
        )} por día para los ${daysRemaining} días que quedan de mes. Pensalo bien.`;
      } else {
        aiMessage = "Según los movimientos registrados, este gasto entra en tu margen. Comprobá si tenés pagos próximos que aún no cargaste.";
      }
    }

    return NextResponse.json({
      status,
      headline,
      badgeColor,
      aiMessage,
      financials: {
        amount,
        description,
        category,
        daysRemaining,
        dailyBudgetAfter,
        projectedNetSavings,
        percentAfter,
        remainingInBudget,
        currentIncome: metrics.totalIncome,
      },
    });
  } catch (err) {
    console.error("Error in Cuero AI consultation:", err);
    return NextResponse.json({ error: "Error al consultar al Kape Financiero" }, { status: 500 });
  }
}
