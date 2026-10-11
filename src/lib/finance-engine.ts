export interface Transaction {
  id: string;
  type: "income" | "expense";
  category: "fijo" | "variable" | "pasivo" | "al_pedo";
  amount: number;
  description: string;
  date: string;
  is_recurring?: number;
  created_at?: string;
}

export type HealthLevel = "EXCELENTE" | "BUENA" | "AGUANTABLE" | "MALA" | "SUPER_MALA";

export interface FinancialHealth {
  score: number; // 0 to 100
  level: HealthLevel;
  label: string;
  badgeColor: string;
  textColor: string;
  summary: string;
  recommendations: string[];
}

export interface FinancialMetrics {
  totalIncome: number;
  incomes: {
    fijo: number;
    variable: number;
    pasivo: number;
  };
  totalExpenses: number;
  expenses: {
    fijo: number;
    variable: number;
    al_pedo: number;
  };
  netSavings: number;
  savingsRate: number; // %
  fixedExpenseRatio: number; // %
  alPedoRatio: number; // %
  passiveIncomeCoverage: number; // % of fixed expenses covered by passive income
  freeMargin: number; // Available money before non-essentials
  health: FinancialHealth;
}

export interface LoanSimulationImpact {
  loanAmount: number;
  installments: number;
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  debtToIncomeRatio: number; // % of recorded income; displayed only when income exists
  projectedNetSavings: number;
  projectedSavingsRate: number;
  currentHealth: FinancialHealth;
  projectedHealth: FinancialHealth;
  verdict: {
    status: "SEGURO" | "VIABLE" | "AGUANTABLE" | "RIESGOSO" | "PELIGRO_ASFIXIA";
    title: string;
    description: string;
    badgeColor: string;
  };
  canCoverWithAlPedoSavings: boolean;
  alPedoCutNeededPercent: number;
}

/**
 * Evaluates health score and state based on financial indicators
 */
export function calculateFinancialHealth(
  totalIncome: number,
  totalExpenses: number,
  expenses: { fijo: number; variable: number; al_pedo: number },
  incomes: { fijo: number; variable: number; pasivo: number }
): FinancialHealth {
  if (totalIncome <= 0 && totalExpenses <= 0) {
    return {
      score: 50,
      level: "AGUANTABLE",
      label: "Sin Datos",
      badgeColor: "bg-slate-700 text-slate-200 border-slate-600",
      textColor: "text-slate-400",
      summary: "Todavía no cargaste ingresos ni gastos este mes.",
      recommendations: ["Comenzá cargando tus ingresos fijos y tus gastos principales."],
    };
  }

  if (totalIncome <= 0 && totalExpenses > 0) {
    return {
      score: 10,
      level: "SUPER_MALA",
      label: "Super Mala",
      badgeColor: "bg-rose-950 text-rose-300 border-rose-800",
      textColor: "text-rose-500",
      summary: "Tenés gastos registrados pero ningún ingreso ingresado.",
      recommendations: ["Cargá tus ingresos para que el sistema pueda evaluar tu salud real."],
    };
  }

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = (netSavings / totalIncome) * 100;
  const fixedExpenseRatio = (expenses.fijo / totalIncome) * 100;
  const alPedoRatio = (expenses.al_pedo / totalIncome) * 100;

  // Score calculation base: 100 points
  let score = 50;

  // Savings impact (-40 to +35)
  if (savingsRate >= 30) score += 35;
  else if (savingsRate >= 20) score += 25;
  else if (savingsRate >= 10) score += 15;
  else if (savingsRate >= 0) score += 5;
  else if (savingsRate >= -10) score -= 20;
  else if (savingsRate >= -25) score -= 35;
  else score -= 45;

  // Fixed rigidity penalty or bonus (-20 to +10)
  if (fixedExpenseRatio <= 40) score += 10;
  else if (fixedExpenseRatio <= 55) score += 5;
  else if (fixedExpenseRatio > 85) score -= 25;
  else if (fixedExpenseRatio > 70) score -= 15;

  // Waste ("Al Pedo") impact (-25 to +5)
  if (alPedoRatio <= 5) score += 5;
  else if (alPedoRatio > 15 && alPedoRatio <= 25) score -= 10;
  else if (alPedoRatio > 25 && alPedoRatio <= 40) score -= 20;
  else if (alPedoRatio > 40) score -= 30;

  // Passive income bonus (+1 to +10)
  if (incomes.pasivo > 0) {
    const passiveRatio = (incomes.pasivo / totalIncome) * 100;
    if (passiveRatio >= 20) score += 10;
    else if (passiveRatio >= 5) score += 5;
  }

  // Clamp 0 to 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: HealthLevel = "AGUANTABLE";
  let label = "Aguantable";
  let badgeColor = "bg-amber-950/80 text-amber-300 border-amber-700/80";
  let textColor = "text-amber-400";
  let summary = "";
  const recommendations: string[] = [];

  if (score >= 80) {
    level = "EXCELENTE";
    label = "Excelente";
    badgeColor = "bg-emerald-950/80 text-emerald-300 border-emerald-600";
    textColor = "text-emerald-400";
    summary = "Tus finanzas están sólidas como una roca. Tenés un flujo positivo y gran capacidad de maniobra.";
  } else if (score >= 65) {
    level = "BUENA";
    label = "Buena";
    badgeColor = "bg-teal-950/80 text-teal-300 border-teal-600";
    textColor = "text-teal-400";
    summary = "Finanzas ordenadas. Cubrís todas tus necesidades y mantenés un colchón de seguridad mensual.";
  } else if (score >= 45) {
    level = "AGUANTABLE";
    label = "Aguantable";
    badgeColor = "bg-amber-950/80 text-amber-300 border-amber-600";
    textColor = "text-amber-400";
    summary = "Llegás a fin de mes, pero con margen estrecho. Un imprevisto moderado te puede poner en aprietos.";
  } else if (score >= 25) {
    level = "MALA";
    label = "Mala";
    badgeColor = "bg-orange-950/80 text-orange-300 border-orange-600";
    textColor = "text-orange-400";
    summary = "Alerta: Tus gastos están consumiendo casi la totalidad de tus ingresos o estás cerrando en rojo.";
  } else {
    level = "SUPER_MALA";
    label = "Super Mala";
    badgeColor = "bg-rose-950/90 text-rose-300 border-rose-700";
    textColor = "text-rose-500";
    summary = "Peligro de asfixia financiera: estás en déficit severo o endeudándote mes a mes para cubrir el costo de vida.";
  }

  // Generate actionable tips
  if (alPedoRatio > 15) {
    recommendations.push(
      `Tus gastos "al pedo" se comen el ${alPedoRatio.toFixed(1)}% de lo que ganás. Frenando esos gustos impulsivos recuperás aire de inmediato.`
    );
  } else if (alPedoRatio <= 8 && expenses.al_pedo > 0) {
    recommendations.push(
      `¡Buen control de gastos superfluos! Tus gastos prescindibles representan solo el ${alPedoRatio.toFixed(1)}% de tus ingresos.`
    );
  }

  if (fixedExpenseRatio > 65) {
    recommendations.push(
      `Tus gastos fijos (${fixedExpenseRatio.toFixed(1)}%) son muy altos. Si caen tus ingresos variables o perdés una fuente, te quedás sin margen.`
    );
  }

  if (savingsRate > 25) {
    recommendations.push(`Ahorrás el ${savingsRate.toFixed(1)}% mensual. Buen momento para generar ingresos pasivos o fondo de emergencia.`);
  } else if (savingsRate < 0) {
    recommendations.push(
      `Tenés un déficit de ${Math.abs(savingsRate).toFixed(1)}%. Revisá urgente los gastos variables y prescindibles para no acumular deuda.`
    );
  }

  if (incomes.pasivo > 0) {
    const coverage = expenses.fijo > 0 ? ((incomes.pasivo / expenses.fijo) * 100).toFixed(1) : "100";
    recommendations.push(`Tus ingresos pasivos cubren el ${coverage}% de tus gastos fijos.`);
  }

  if (recommendations.length === 0) {
    recommendations.push("Mantené el registro diario para tener una radiografía precisa de tus números.");
  }

  return {
    score,
    level,
    label,
    badgeColor,
    textColor,
    summary,
    recommendations,
  };
}

/**
 * Calculates all metrics for a given set of transactions
 */
export function calculateFinancialMetrics(transactions: Transaction[]): FinancialMetrics {
  const incomes = { fijo: 0, variable: 0, pasivo: 0 };
  const expenses = { fijo: 0, variable: 0, al_pedo: 0 };

  for (const t of transactions) {
    if (t.type === "income") {
      if (t.category === "fijo") incomes.fijo += t.amount;
      else if (t.category === "variable") incomes.variable += t.amount;
      else if (t.category === "pasivo") incomes.pasivo += t.amount;
    } else if (t.type === "expense") {
      if (t.category === "fijo") expenses.fijo += t.amount;
      else if (t.category === "variable") expenses.variable += t.amount;
      else if (t.category === "al_pedo") expenses.al_pedo += t.amount;
    }
  }

  const totalIncome = incomes.fijo + incomes.variable + incomes.pasivo;
  const totalExpenses = expenses.fijo + expenses.variable + expenses.al_pedo;
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  const fixedExpenseRatio = totalIncome > 0 ? (expenses.fijo / totalIncome) * 100 : 0;
  const alPedoRatio = totalIncome > 0 ? (expenses.al_pedo / totalIncome) * 100 : 0;
  const passiveIncomeCoverage = expenses.fijo > 0 ? (incomes.pasivo / expenses.fijo) * 100 : 0;
  const freeMargin = totalIncome - (expenses.fijo + expenses.variable);

  const health = calculateFinancialHealth(totalIncome, totalExpenses, expenses, incomes);

  return {
    totalIncome,
    incomes,
    totalExpenses,
    expenses,
    netSavings,
    savingsRate,
    fixedExpenseRatio,
    alPedoRatio,
    passiveIncomeCoverage,
    freeMargin,
    health,
  };
}

/**
 * Simulates the impact of a loan on current finances
 */
export function simulateLoanImpact(
  metrics: FinancialMetrics,
  loanAmount: number,
  installments: number,
  monthlyPayment: number
): LoanSimulationImpact {
  const totalPayment = monthlyPayment * installments;
  const totalInterest = Math.max(0, totalPayment - loanAmount);

  // When taking a loan, the monthly payment acts as a new committed fixed expense
  const simulatedFixedExpenses = metrics.expenses.fijo + monthlyPayment;
  const simulatedExpenses = {
    ...metrics.expenses,
    fijo: simulatedFixedExpenses,
  };
  const simulatedTotalExpenses = metrics.totalExpenses + monthlyPayment;
  const projectedNetSavings = metrics.totalIncome - simulatedTotalExpenses;
  const projectedSavingsRate = metrics.totalIncome > 0 ? (projectedNetSavings / metrics.totalIncome) * 100 : 0;
  const debtToIncomeRatio = metrics.totalIncome > 0 ? (monthlyPayment / metrics.totalIncome) * 100 : 0;

  const currentHealth = metrics.health;
  const projectedHealth = calculateFinancialHealth(
    metrics.totalIncome,
    simulatedTotalExpenses,
    simulatedExpenses,
    metrics.incomes
  );

  // Can the user afford this simply by cutting "Gastos al pedo"?
  const canCoverWithAlPedoSavings = metrics.expenses.al_pedo >= monthlyPayment;
  const alPedoCutNeededPercent =
    metrics.expenses.al_pedo > 0 ? Math.min(100, Math.round((monthlyPayment / metrics.expenses.al_pedo) * 100)) : 100;

  // Verdict evaluation
  let verdictStatus: "SEGURO" | "VIABLE" | "AGUANTABLE" | "RIESGOSO" | "PELIGRO_ASFIXIA" = "VIABLE";
  let verdictTitle = "Margen disponible";
  let verdictDescription = "La cuota se compara con los ingresos y gastos registrados.";
  let verdictColor = "bg-teal-950 text-teal-300 border-teal-700";

  if (metrics.totalIncome <= 0) {
    verdictStatus = "AGUANTABLE";
    verdictTitle = "Faltan ingresos registrados";
    verdictDescription = "Registrá tus ingresos para estimar cómo esta cuota cambiaría tu margen mensual.";
    verdictColor = "bg-amber-950 text-amber-300 border-amber-700";
  } else if (projectedNetSavings < 0) {
    verdictStatus = "PELIGRO_ASFIXIA";
    verdictTitle = "Margen mensual negativo";
    verdictDescription = `Con los registros actuales, los gastos más esta cuota superarían los ingresos en ₲ ${Math.round(Math.abs(projectedNetSavings)).toLocaleString("es-PY")} al mes.`;
    verdictColor = "bg-rose-950 text-rose-300 border-rose-700";
  } else if (debtToIncomeRatio > 35 || projectedSavingsRate < 5) {
    verdictStatus = "RIESGOSO";
    verdictTitle = "Margen muy ajustado";
    verdictDescription = `La cuota representa el ${debtToIncomeRatio.toFixed(1)}% de los ingresos registrados y deja poco margen según tus gastos actuales.`;
    verdictColor = "bg-orange-950 text-orange-300 border-orange-700";
  } else if (debtToIncomeRatio > 20 || projectedHealth.level === "AGUANTABLE") {
    verdictStatus = "AGUANTABLE";
    verdictTitle = "Margen ajustado";
    verdictDescription = `La cuota representa el ${debtToIncomeRatio.toFixed(1)}% de los ingresos registrados. Revisá otros pagos que no estén cargados en la app.`;
    verdictColor = "bg-amber-950 text-amber-300 border-amber-700";
  } else if (debtToIncomeRatio <= 10 && projectedHealth.score >= 70) {
    verdictStatus = "SEGURO";
    verdictTitle = "Margen disponible";
    verdictDescription = `La cuota representa el ${debtToIncomeRatio.toFixed(1)}% de los ingresos registrados. El cálculo muestra margen positivo con los datos actuales.`;
    verdictColor = "bg-emerald-950 text-emerald-300 border-emerald-700";
  } else {
    verdictStatus = "VIABLE";
    verdictTitle = "Margen disponible";
    verdictDescription = `La cuota representa el ${debtToIncomeRatio.toFixed(1)}% de los ingresos registrados. Revisá el costo total y otros compromisos antes de comparar ofertas.`;
    verdictColor = "bg-teal-950 text-teal-300 border-teal-700";
  }

  return {
    loanAmount,
    installments,
    monthlyPayment,
    totalPayment,
    totalInterest,
    debtToIncomeRatio,
    projectedNetSavings,
    projectedSavingsRate,
    currentHealth,
    projectedHealth,
    verdict: {
      status: verdictStatus,
      title: verdictTitle,
      description: verdictDescription,
      badgeColor: verdictColor,
    },
    canCoverWithAlPedoSavings,
    alPedoCutNeededPercent,
  };
}

export interface BudgetGauge {
  limit: number;
  spent: number;
  percent: number;
  remaining: number;
  isOver: boolean;
  status: "safe" | "warning" | "danger";
  label: string;
  badgeBg: string;
  textColor: string;
  progressColor: string;
}

export function calculateBudgetGauge(spent: number, limit: number): BudgetGauge {
  const percent = limit > 0 ? (spent / limit) * 100 : 0;
  const remaining = Math.max(0, limit - spent);
  if (limit <= 0) {
    return {
      limit: 0,
      spent,
      percent: 0,
      remaining: 0,
      isOver: false,
      status: "safe",
      label: "Sin límite fijado",
      badgeBg: "bg-slate-800 text-slate-300 border-slate-700",
      textColor: "text-slate-400",
      progressColor: "bg-slate-500",
    };
  }

  if (percent > 100) {
    return {
      limit,
      spent,
      percent,
      remaining: 0,
      isOver: true,
      status: "danger",
      label: "¡Te pasaste de tu presupuesto!",
      badgeBg: "bg-rose-950/80 text-rose-300 border-rose-700",
      textColor: "text-rose-400",
      progressColor: "bg-rose-500",
    };
  } else if (percent >= 70) {
    return {
      limit,
      spent,
      percent,
      remaining,
      isOver: false,
      status: "warning",
      label: "¡Alerta de precaución!",
      badgeBg: "bg-amber-950/80 text-amber-300 border-amber-700",
      textColor: "text-amber-400",
      progressColor: "bg-amber-500",
    };
  } else {
    return {
      limit,
      spent,
      percent,
      remaining,
      isOver: false,
      status: "safe",
      label: "En zona segura",
      badgeBg: "bg-emerald-950/80 text-emerald-300 border-emerald-700",
      textColor: "text-emerald-400",
      progressColor: "bg-emerald-500",
    };
  }
}

export interface EmergencyFundAnalysis {
  fixedMonthlyExpense: number;
  min3Months: number;
  opt6Months: number;
  currentSaved: number;
  progressMin: number;
  progressOpt: number;
  monthsToMinWithSurplus: number | null;
  monthsToOptWithSurplus: number | null;
  missingForMin: number;
  missingForOpt: number;
}

export function calculateEmergencyFundAnalysis(
  fixedMonthlyExpense: number,
  currentSaved: number,
  monthlySurplus: number
): EmergencyFundAnalysis {
  const min3Months = fixedMonthlyExpense * 3;
  const opt6Months = fixedMonthlyExpense * 6;
  const progressMin = min3Months > 0 ? Math.min(100, (currentSaved / min3Months) * 100) : 0;
  const progressOpt = opt6Months > 0 ? Math.min(100, (currentSaved / opt6Months) * 100) : 0;
  const missingForMin = Math.max(0, min3Months - currentSaved);
  const missingForOpt = Math.max(0, opt6Months - currentSaved);

  const monthsToMinWithSurplus =
    monthlySurplus > 0 && missingForMin > 0 ? Math.ceil(missingForMin / monthlySurplus) : null;
  const monthsToOptWithSurplus =
    monthlySurplus > 0 && missingForOpt > 0 ? Math.ceil(missingForOpt / monthlySurplus) : null;

  return {
    fixedMonthlyExpense,
    min3Months,
    opt6Months,
    currentSaved,
    progressMin,
    progressOpt,
    monthsToMinWithSurplus,
    monthsToOptWithSurplus,
    missingForMin,
    missingForOpt,
  };
}
