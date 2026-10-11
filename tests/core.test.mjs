import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFinancialMetrics,
  calculateFinancialHealth,
  calculateBudgetGauge,
  calculateEmergencyFundAnalysis,
  simulateLoanImpact,
} from "../src/lib/finance-engine.ts";
import { getParaguayDateString, formatParaguayMonthLabel } from "../src/lib/date-utils.ts";
import { percentile75 } from "../src/lib/performance.ts";
import { rankStreakParticipants } from "../src/lib/streak-leaderboard.ts";

test("el tablero no inventa ingresos cuando la cuenta está vacía", () => {
  const metrics = calculateFinancialMetrics([]);
  assert.equal(metrics.totalIncome, 0);
  assert.equal(metrics.totalExpenses, 0);
  assert.equal(metrics.netSavings, 0);
  assert.equal(metrics.health.label, "Sin Datos");
});

test("los cálculos mensuales respetan ingresos y categorías", () => {
  const metrics = calculateFinancialMetrics([
    { id: "i", type: "income", category: "fijo", amount: 4_000_000, description: "Ingreso", date: "2026-10-01" },
    { id: "f", type: "expense", category: "fijo", amount: 1_000_000, description: "Alquiler", date: "2026-10-02" },
    { id: "v", type: "expense", category: "variable", amount: 500_000, description: "Comida", date: "2026-10-03" },
  ]);
  assert.equal(metrics.totalIncome, 4_000_000);
  assert.equal(metrics.totalExpenses, 1_500_000);
  assert.equal(metrics.netSavings, 2_500_000);
  assert.equal(metrics.expenses.fijo, 1_000_000);
});

test("un préstamo reduce el margen del mes", () => {
  const metrics = calculateFinancialMetrics([
    { id: "i", type: "income", category: "fijo", amount: 4_000_000, description: "Ingreso", date: "2026-10-01" },
  ]);
  const impact = simulateLoanImpact(metrics, 10_000_000, 12, 1_000_000);
  assert.equal(impact.projectedNetSavings, 3_000_000);
  assert.equal(impact.totalPayment, 12_000_000);
});

test("una proporción de gastos fijos superior al 85% aplica la penalización más alta", () => {
  const health = calculateFinancialHealth(
    1_000_000,
    900_000,
    { fijo: 900_000, variable: 0, al_pedo: 0 },
    { fijo: 1_000_000, variable: 0, pasivo: 0 }
  );
  assert.equal(health.score, 45);
  assert.equal(health.level, "AGUANTABLE");
});

test("el medidor de presupuesto distingue límite, precaución y exceso", () => {
  assert.equal(calculateBudgetGauge(0, 0).status, "safe");
  assert.equal(calculateBudgetGauge(70, 100).status, "warning");
  const exceeded = calculateBudgetGauge(120, 100);
  assert.equal(exceeded.status, "danger");
  assert.equal(exceeded.remaining, 0);
});

test("el fondo de emergencia calcula objetivos y tiempo sin inventar aportes", () => {
  const fund = calculateEmergencyFundAnalysis(1_000_000, 1_500_000, 500_000);
  assert.equal(fund.min3Months, 3_000_000);
  assert.equal(fund.opt6Months, 6_000_000);
  assert.equal(fund.progressMin, 50);
  assert.equal(fund.monthsToMinWithSurplus, 3);
  assert.equal(calculateEmergencyFundAnalysis(0, 0, 0).monthsToMinWithSurplus, null);
});

test("fecha y mes se calculan en Paraguay", () => {
  assert.equal(getParaguayDateString(new Date("2026-01-01T01:00:00Z")), "2025-12-31");
  assert.match(formatParaguayMonthLabel("2026-10"), /oct.*26/i);
});

test("el percentil 75 resume mediciones móviles sin valores inválidos", () => {
  assert.equal(percentile75([]), null);
  assert.equal(percentile75([120, 90, 250, 180]), 180);
  assert.equal(percentile75([100, Number.NaN, -1]), 100);
});

test("el ranking de rachas ordena días, asigna empates y descarta datos inválidos", () => {
  assert.deepEqual(rankStreakParticipants([
    { displayName: "Ana", days: 8 },
    { displayName: "Beto", days: 12 },
    { displayName: "Caro", days: 8 },
    { displayName: "   ", days: 99 },
    { displayName: "Dani", days: -1 },
  ]), [
    { displayName: "Beto", days: 12, rank: 1 },
    { displayName: "Ana", days: 8, rank: 2 },
    { displayName: "Caro", days: 8, rank: 2 },
  ]);
});
