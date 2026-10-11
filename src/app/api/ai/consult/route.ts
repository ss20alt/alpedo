import { NextResponse } from "next/server";
import db from "@/lib/db";
import { checkAuth } from "@/lib/auth";
import { calculateFinancialMetrics, Transaction } from "@/lib/finance-engine";

export async function POST(req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const amount = Math.max(0, parseInt(String(body.amount || "0").replace(/\D/g, ""), 10));
    const description = (body.description || "Gusto espontáneo").trim();
    const category = body.category === "variable" ? "variable" : "al_pedo";
    const budgetAlPedoLimit = Math.max(0, Number(body.budgetAlPedoLimit) || 500000);
    const budgetVariableLimit = Math.max(0, Number(body.budgetVariableLimit) || 1500000);

    if (amount <= 0) {
      return NextResponse.json({ error: "Ingresá un monto válido mayor a 0" }, { status: 400 });
    }

    // Current month in PY
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, lastDayOfMonth - now.getDate() + 1);

    // Fetch transactions
    const rows = await db.query<Transaction>(
      "SELECT * FROM transactions WHERE date::text LIKE ? || '%'",
      [currentMonth]
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
    let headline = "¡Te da el cuero, metéle!";
    let badgeColor = "bg-emerald-950 text-emerald-300 border-emerald-600";

    if (projectedNetSavings < 0 || percentAfter > 110) {
      status = "PELIGRO";
      headline = "¡Ni se te ocurra kp, te vas a fundir!";
      badgeColor = "bg-rose-950 text-rose-300 border-rose-700";
    } else if (percentAfter >= 75 || dailyBudgetAfter < 20000) {
      status = "PRECAUCION";
      headline = "Pensalo dos veces: te deja con lo justo";
      badgeColor = "bg-amber-950 text-amber-300 border-amber-600";
    }

    // Call Google Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    let aiMessage = "";

    if (apiKey) {
      try {
        const prompt = `Sos "El Kape Financiero", un compadre paraguayo de confianza, divertido, sabio y picante que vive en una app de finanzas personales en Asunción, Paraguay.
El usuario te está preguntando si LE DA EL CUERO para hacer un gasto antes de pagar.

DATOS DEL GASTO:
- Quiere gastar: ₲ ${amount.toLocaleString("es-PY")} en "${description}".
- Tipo de gasto: ${isAlPedo ? 'Gusto al pedo / capricho prescindible' : 'Gasto variable del mes'}.

SU ESTADO FINANCIERO REAL:
- Veredicto matemático de la app: ${status}
- Días que le faltan para terminar el mes: ${daysRemaining} días.
- Su margen diario para sobrevivir si hace este gasto: ₲ ${dailyBudgetAfter.toLocaleString("es-PY")} por día.
- Su superávit/ahorro neto si gasta esto: ₲ ${projectedNetSavings.toLocaleString("es-PY")}.
- Porcentaje consumido de su tope de presupuesto: ${percentAfter.toFixed(0)}%.

INSTRUCCIONES:
- Respondé en 1 o máximo 2 oraciones breves y contundentes.
- Usá jerga cotidiana paraguaya natural (ej: kp, metéle, tranquilopa, nde tavyrón, arroz quesú, mandioca, etc.) con humor sincero.
- Si el veredicto es PELIGRO: retalo con gracia, decile que el mes no terminó y que cocine algo en su casa.
- Si es PRECAUCION: advertile que le va a apretar el cinto y le quedará poco por día.
- Si es SEGURO: dale luz verde para que disfrute sin culpa.
- No uses asteriscos, ni títulos, solo el mensaje que le dirías al oído.`;

        // Official Google Gemini model cascade in priority order:
        // 1. gemini-2.0-flash (Latest fast, high intelligence model)
        // 2. gemini-1.5-flash (Reliable fast model)
        // 3. gemini-1.5-flash-8b (Ultra lightweight fallback)
        const modelsCascade = [
          "gemini-2.0-flash",
          "gemini-1.5-flash",
          "gemini-1.5-flash-8b",
        ];

        for (const model of modelsCascade) {
          try {
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
          ? `¡Nde tavyrón kp! Ya quemaste casi todo tu tope de gustos este mes. Si gastás estos ₲ ${amount.toLocaleString(
              "es-PY"
            )}, vas a terminar cerrando en rojo. ¡Metéle arroz quesú y aguantá!`
          : `Cuidado kp: este gasto te va a poner en déficit. Si no es 100% de vida o muerte, patealo para el mes que viene.`;
      } else if (status === "PRECAUCION") {
        aiMessage = `Te da el cuero raspando la olla, kp. Si gastás esto, te van a sobrar apenas ₲ ${dailyBudgetAfter.toLocaleString(
          "es-PY"
        )} por día para los ${daysRemaining} días que quedan de mes. Pensalo bien.`;
      } else {
        aiMessage = `¡Metéle nomás ya kp! Tus números están sólidos, tenés margen de sobra en tu tope y no te va a mover la aguja. ¡Disfrutá sin culpa!`;
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
