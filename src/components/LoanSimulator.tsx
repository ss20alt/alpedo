"use client";

import React, { useState, useEffect } from "react";
import { FinancialMetrics, simulateLoanImpact, LoanSimulationImpact } from "@/lib/finance-engine";
import { Calculator, ShieldAlert, CheckCircle2, AlertTriangle, Sparkles, BookmarkPlus, Trash2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface LoanSimulatorProps {
  metrics: FinancialMetrics;
  currencySymbol: string;
}

interface SavedSimulation {
  id: string;
  title: string;
  amount: number;
  installments: number;
  monthly_payment: number;
  interest_rate: number;
  total_payment: number;
  notes?: string;
  created_at: string;
}

export default function LoanSimulator({ metrics, currencySymbol }: LoanSimulatorProps) {
  const [loanAmount, setLoanAmount] = useState<number>(10000000);
  const [installments, setInstallments] = useState<number>(12);
  const [calculationMode, setCalculationMode] = useState<"fixed_installment" | "interest_rate">("fixed_installment");
  const [monthlyPaymentInput, setMonthlyPaymentInput] = useState<number>(980000);
  const [interestRateInput, setInterestRateInput] = useState<number>(18);
  const [simulationTitle, setSimulationTitle] = useState("");
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);
  const [savingLoading, setSavingLoading] = useState(false);

  const loadSaved = async () => {
    try {
      const res = await fetch("/api/simulations");
      if (res.ok) {
        const data = await res.json();
        setSavedSimulations(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  // Standard Banking French Amortization (Sistema Francés)
  const calculateFrenchPayment = (principal: number, annualRatePercent: number, months: number): number => {
    if (annualRatePercent <= 0 || months <= 0) return Math.round(principal / Math.max(1, months));
    const r = annualRatePercent / 100 / 12;
    const factor = Math.pow(1 + r, months);
    if (factor === 1) return Math.round(principal / months);
    const payment = principal * (r * factor) / (factor - 1);
    return Math.round(payment);
  };

  const effectiveMonthlyPayment =
    calculationMode === "fixed_installment"
      ? monthlyPaymentInput
      : calculateFrenchPayment(loanAmount, interestRateInput, installments);

  const impact: LoanSimulationImpact = simulateLoanImpact(
    metrics,
    loanAmount,
    installments,
    effectiveMonthlyPayment
  );

  const formatMoney = (val: number) => {
    return Math.round(val).toLocaleString("es-PY");
  };

  const handleSaveSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulationTitle.trim()) return;

    setSavingLoading(true);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: simulationTitle.trim(),
          amount: loanAmount,
          installments,
          monthly_payment: effectiveMonthlyPayment,
          interest_rate: calculationMode === "interest_rate" ? interestRateInput : 0,
          total_payment: effectiveMonthlyPayment * installments,
        }),
      });

      if (res.ok) {
        setSimulationTitle("");
        loadSaved();
      }
    } finally {
      setSavingLoading(false);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      const res = await fetch(`/api/simulations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedSimulations((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Configuration Card */}
      <div id="tour-loans-card" className="rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
              <span>Simulador de Préstamos</span>
            </h2>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              Evaluá si la cuota es viable <strong>antes</strong> de endeudarte.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex w-full sm:w-auto items-center gap-1 rounded-full bg-slate-100 p-1 border border-slate-200/80 shadow-inner">
            <button
              onClick={() => setCalculationMode("fixed_installment")}
              className={`flex-1 sm:flex-initial rounded-full px-3.5 py-2 text-xs font-extrabold transition active:scale-95 ${
                calculationMode === "fixed_installment"
                  ? "bg-white text-slate-900 font-black shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Valor de Cuota
            </button>
            <button
              onClick={() => setCalculationMode("interest_rate")}
              className={`flex-1 sm:flex-initial rounded-full px-3.5 py-2 text-xs font-extrabold transition active:scale-95 ${
                calculationMode === "interest_rate"
                  ? "bg-white text-slate-900 font-black shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Calcular por Tasa %
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 border-t border-slate-100 pt-4 sm:pt-6">
          {/* 1. Monto del Préstamo */}
          <div>
            <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Monto a Solicitar ({currencySymbol})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-base font-bold text-slate-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="numeric"
                value={loanAmount || ""}
                onChange={(e) => setLoanAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-lg font-black text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
              />
            </div>
            {/* Quick chips en Guaraníes */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[2000000, 5000000, 10000000, 20000000, 50000000].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setLoanAmount(quick)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-mono font-bold transition active:scale-95 ${
                    loanAmount === quick
                      ? "bg-slate-900 text-white font-black shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {currencySymbol} {quick / 1000000}M
                </button>
              ))}
            </div>
          </div>

          {/* 2. Plazo en Cuotas */}
          <div>
            <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Plazo (Meses / Cuotas)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              inputMode="numeric"
              value={installments || ""}
              onChange={(e) => setInstallments(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-black text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[3, 6, 12, 18, 24, 36].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setInstallments(m)}
                  className={`flex-1 min-w-[42px] h-8 flex items-center justify-center rounded-xl text-xs font-mono font-bold transition active:scale-95 ${
                    installments === m
                      ? "bg-slate-900 text-white font-black shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* 3. Cuota o Tasa */}
          <div>
            {calculationMode === "fixed_installment" ? (
              <>
                <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Cuota Mensual Estimada ({currencySymbol})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-base font-bold text-slate-400">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="numeric"
                    value={monthlyPaymentInput || ""}
                    onChange={(e) => setMonthlyPaymentInput(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-lg font-black text-emerald-600 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500 font-medium">
                  Total a devolver:{" "}
                  <strong className="text-slate-900 font-mono font-black">
                    {currencySymbol} {formatMoney(effectiveMonthlyPayment * installments)}
                  </strong>
                </div>
              </>
            ) : (
              <>
                <label className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Tasa Anual / Recargo (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={interestRateInput || ""}
                  onChange={(e) => setInterestRateInput(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-black text-emerald-600 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
                <div className="mt-2 text-xs text-slate-500 font-medium">
                  Cuota calculada:{" "}
                  <strong className="text-emerald-600 font-mono font-black">
                    {currencySymbol} {formatMoney(effectiveMonthlyPayment)}/mes
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3-Step Interactive Banking Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-slate-100 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 font-black text-xs text-blue-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px]">1</span>
            <span>Monto & Plazo</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            Ajustá el importe y los meses. A mayor plazo, menor cuota pero más interés acumulado.
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 font-black text-xs text-emerald-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px]">2</span>
            <span>Regla del 30%</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            Una cuota prudente no debe superar el 30% de tus ingresos netos mensuales.
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 font-black text-xs text-amber-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px]">3</span>
            <span>Semáforo de Riesgo</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            Te avisa en verde si es viable, o en rojo si compromete tu capacidad de ahorro y supervivencia.
          </p>
        </div>
      </div>

      {/* Resultados de Impacto y Veredicto (Grid Responsivo) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Veredicto & Alerta Principal */}
        <div className={`rounded-[28px] border p-5 sm:p-6 shadow-sm flex flex-col justify-between ${
          impact.verdict.status === "PELIGRO_ASFIXIA"
            ? "border-rose-200 bg-rose-50/80 text-rose-950"
            : impact.verdict.status === "RIESGOSO" || impact.verdict.status === "AGUANTABLE"
            ? "border-amber-200 bg-amber-50/80 text-amber-950"
            : "border-emerald-200 bg-emerald-50/80 text-emerald-950"
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              {impact.verdict.status === "PELIGRO_ASFIXIA" ? (
                <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-rose-600 shrink-0" />
              ) : impact.verdict.status === "RIESGOSO" ? (
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 shrink-0" />
              ) : impact.verdict.status === "AGUANTABLE" ? (
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
              )}
              <span className="text-[11px] font-black uppercase tracking-wider opacity-80">
                Veredicto Financiero
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black">{impact.verdict.title}</h3>
            <p className="mt-2 text-xs sm:text-sm opacity-90 leading-relaxed font-medium">
              {impact.verdict.description}
            </p>
          </div>

          <div className="mt-5 border-t border-black/10 pt-3 space-y-1.5 text-xs font-semibold">
            <div className="flex justify-between">
              <span>Cuota mensual:</span>
              <span className="font-black font-mono">
                {currencySymbol} {formatMoney(impact.monthlyPayment)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Interés / Recargo total:</span>
              <span className="font-black font-mono">
                {currencySymbol} {formatMoney(impact.totalInterest)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Devolución ({impact.installments} cuotas):</span>
              <span className="font-black font-mono">
                {currencySymbol} {formatMoney(impact.totalPayment)}
              </span>
            </div>
          </div>
        </div>

        {/* Comparador: Antes vs Después */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900 flex flex-col justify-between">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3 sm:mb-4">
              Comparativa de Salud Financiera
            </h4>

            {/* Health comparison cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Actual */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-center">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Hoy (Sin Crédito)</span>
                <div className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-0.5">
                  {impact.currentHealth.score} <span className="text-xs text-slate-400 font-normal">pts</span>
                </div>
                <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${impact.currentHealth.badgeColor}`}>
                  {impact.currentHealth.label}
                </div>
              </div>

              {/* Con Préstamo */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-center">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Con este Préstamo</span>
                <div className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-0.5">
                  {impact.projectedHealth.score} <span className="text-xs text-slate-400 font-normal">pts</span>
                </div>
                <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${impact.projectedHealth.badgeColor}`}>
                  {impact.projectedHealth.label}
                </div>
              </div>
            </div>

            {/* Impact stats */}
            <div className="mt-4 space-y-2 text-xs text-slate-600 font-medium">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>Tu sueldo libre restante:</span>
                <span
                  className={`font-mono font-black ${
                    impact.projectedNetSavings >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {impact.projectedNetSavings >= 0 ? "+" : ""}
                  {currencySymbol} {formatMoney(impact.projectedNetSavings)} / mes
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>La cuota consume de tu ingreso:</span>
                <span
                  className={`font-mono font-black ${
                    impact.debtToIncomeRatio > 30 ? "text-rose-600" : "text-slate-900"
                  }`}
                >
                  {impact.debtToIncomeRatio.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200/80 font-medium">
            {impact.projectedHealth.level === "EXCELENTE" || impact.projectedHealth.level === "BUENA" ? (
              <span className="text-emerald-700 font-bold">
                ✅ Tu capacidad financiera absorbe la cuota sin comprometer tus necesidades.
              </span>
            ) : impact.projectedHealth.level === "AGUANTABLE" ? (
              <span className="text-amber-800 font-bold">
                ⚠️ Vas a llegar justo a fin de mes. Evitá asumir otros compromisos mientras pagues esto.
              </span>
            ) : (
              <span className="text-rose-700 font-bold">
                🛑 Este préstamo te empuja a zona de peligro económico. Revisá reducir monto o extender cuotas.
              </span>
            )}
          </div>
        </div>

        {/* El "Factor Gastos al Pedo" & Guardar */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-orange-600 mb-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Factor: "Gastos Al Pedo"</span>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-3.5 sm:p-4 text-xs text-slate-700">
              {impact.canCoverWithAlPedoSavings ? (
                <div>
                  <p className="font-black text-orange-800 mb-1">
                    🎯 ¡Tenés la plata ahí mismo!
                  </p>
                  <p className="leading-relaxed">
                    Tus gastos al pedo ({currencySymbol} {formatMoney(metrics.expenses.al_pedo)}) son mayores a esta cuota ({currencySymbol} {formatMoney(impact.monthlyPayment)}).
                  </p>
                  <p className="mt-2 text-slate-800">
                    Podés pagar este préstamo al 100% solo eliminando el{" "}
                    <strong className="text-orange-600 font-mono font-black">
                      {impact.alPedoCutNeededPercent}%
                    </strong>{" "}
                    de tus salidas o deliveries innecesarios.
                  </p>
                </div>
              ) : metrics.expenses.al_pedo > 0 ? (
                <div>
                  <p className="font-black text-orange-800 mb-1">
                    💡 Ayuda para pagar la cuota
                  </p>
                  <p className="leading-relaxed">
                    Si cortás tus gastos al pedo ({currencySymbol} {formatMoney(metrics.expenses.al_pedo)}), ya cubrís el{" "}
                    <strong className="text-orange-600 font-mono font-black">
                      {((metrics.expenses.al_pedo / impact.monthlyPayment) * 100).toFixed(0)}%
                    </strong>{" "}
                    del valor de cada cuota.
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 font-medium">
                  No tenés gastos superfluos registrados. La cuota impactará directamente sobre tu ahorro o margen libre.
                </p>
              )}
            </div>
          </div>

          {/* Form to Save Simulation */}
          <form onSubmit={handleSaveSimulation} className="mt-5 border-t border-slate-100 pt-3">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Guardar simulación para comparar
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={simulationTitle}
                onChange={(e) => setSimulationTitle(e.target.value)}
                placeholder="Ej: Banco Itaú, Crédito Moto..."
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 font-semibold focus:outline-none transition"
              />
              <button
                type="submit"
                disabled={savingLoading || !simulationTitle.trim()}
                className="h-11 flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 transition active:scale-95 shrink-0"
              >
                <BookmarkPlus className="h-4 w-4 text-emerald-400" />
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Simulaciones Guardadas */}
      {savedSimulations.length > 0 && (
        <div className="rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
          <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider mb-3 sm:mb-4">
            Simulaciones Guardadas ({savedSimulations.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedSimulations.map((sim) => (
              <div
                key={sim.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 sm:p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-extrabold text-slate-900 truncate">{sim.title}</span>
                    <button
                      onClick={() => handleDeleteSaved(sim.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-600 font-medium">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monto:</span>
                      <span className="font-mono font-black text-slate-900">
                        {currencySymbol} {formatMoney(sim.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cuotas:</span>
                      <span className="font-mono font-bold text-slate-700">{sim.installments} meses</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cuota:</span>
                      <span className="font-mono font-black text-emerald-600">
                        {currencySymbol} {formatMoney(sim.monthly_payment)} / mes
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLoanAmount(sim.amount);
                    setInstallments(sim.installments);
                    setMonthlyPaymentInput(sim.monthly_payment);
                    setCalculationMode("fixed_installment");
                  }}
                  className="mt-3 w-full h-9 rounded-xl bg-white border border-slate-200 text-center text-xs font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95"
                >
                  Cargar en Simulador
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
