"use client";

import React, { useState, useEffect } from "react";
import { FinancialMetrics, simulateLoanImpact, LoanSimulationImpact } from "@/lib/finance-engine";
import { Calculator, ShieldAlert, CheckCircle2, AlertTriangle, Flame, BookmarkPlus, Trash2, Info, ChevronDown } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";

const MAX_LOAN_AMOUNT = 9_999_999_999_999;
const MAX_INSTALLMENTS = 120;
const MAX_ANNUAL_RATE = 200;

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
  const [loanAmountInput, setLoanAmountInput] = useState("10000000");
  const [installmentsInput, setInstallmentsInput] = useState("12");
  const [calculationMode, setCalculationMode] = useState<"fixed_installment" | "interest_rate">("fixed_installment");
  const [monthlyPaymentInput, setMonthlyPaymentInput] = useState("980000");
  const [interestRateInput, setInterestRateInput] = useState("18");
  const [simulationTitle, setSimulationTitle] = useState("");
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);
  const [savingLoading, setSavingLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [savedLoadError, setSavedLoadError] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [simulationToDelete, setSimulationToDelete] = useState<{ id: string; title: string } | null>(null);

  const loanAmount = Number(loanAmountInput);
  const installmentsValue = Number(installmentsInput);
  const installments = Number.isInteger(installmentsValue) ? installmentsValue : 0;
  const monthlyPaymentValue = Number(monthlyPaymentInput);
  const interestRateValue = Number(interestRateInput);

  const loadSaved = async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch("/api/simulations");
      if (!res.ok) throw new Error("No se pudieron cargar las simulaciones");
      const data = await res.json();
      setSavedSimulations(Array.isArray(data) ? data : []);
      setSavedLoadError(false);
    } catch {
      setSavedLoadError(true);
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSaved(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Standard Banking French Amortization (Sistema Francés)
  const calculateFrenchPayment = (principal: number, annualRatePercent: number, months: number): number => {
    if (!Number.isFinite(principal) || !Number.isFinite(annualRatePercent) || months <= 0) return 0;
    if (annualRatePercent <= 0) return Math.round(principal / months);
    const r = annualRatePercent / 100 / 12;
    const factor = Math.pow(1 + r, months);
    if (!Number.isFinite(factor) || factor === 1) return Math.round(principal / months);
    const payment = principal * (r * factor) / (factor - 1);
    return Number.isFinite(payment) ? Math.round(payment) : 0;
  };

  const effectiveMonthlyPayment =
    calculationMode === "fixed_installment"
      ? monthlyPaymentValue
      : calculateFrenchPayment(loanAmount, interestRateValue, installments);

  const totalPaymentEstimate = effectiveMonthlyPayment * installments;
  const isValidLoanInputs =
    Number.isFinite(loanAmount) && loanAmount > 0 && loanAmount <= MAX_LOAN_AMOUNT &&
    installments >= 1 && installments <= MAX_INSTALLMENTS &&
    (calculationMode === "fixed_installment"
      ? Number.isFinite(monthlyPaymentValue) && monthlyPaymentValue > 0 && monthlyPaymentValue <= MAX_LOAN_AMOUNT
      : interestRateInput.trim() !== "" && Number.isFinite(interestRateValue) && interestRateValue >= 0 && interestRateValue <= MAX_ANNUAL_RATE) &&
    Number.isFinite(effectiveMonthlyPayment) && effectiveMonthlyPayment > 0 &&
    Number.isFinite(totalPaymentEstimate) && totalPaymentEstimate <= MAX_LOAN_AMOUNT &&
    totalPaymentEstimate >= loanAmount;

  const validationMessage =
    !Number.isFinite(loanAmount) || loanAmount <= 0 || loanAmount > MAX_LOAN_AMOUNT
      ? "Ingresá un monto mayor a cero dentro del rango permitido."
      : installments < 1 || installments > MAX_INSTALLMENTS
      ? "El plazo debe estar entre 1 y 120 meses."
      : calculationMode === "fixed_installment" &&
        (!Number.isFinite(monthlyPaymentValue) || monthlyPaymentValue <= 0 || monthlyPaymentValue > MAX_LOAN_AMOUNT)
      ? "Ingresá una cuota mensual mayor a cero."
      : calculationMode === "interest_rate" &&
        (interestRateInput.trim() === "" || !Number.isFinite(interestRateValue) || interestRateValue < 0 || interestRateValue > MAX_ANNUAL_RATE)
      ? "La tasa anual debe estar entre 0% y 200%."
      : totalPaymentEstimate < loanAmount
      ? "El total de las cuotas no puede ser menor al monto solicitado."
      : "El total estimado supera el rango que puede calcularse.";

  // Keep a finite fallback while the user is editing an incomplete field.
  const impact: LoanSimulationImpact = simulateLoanImpact(
    metrics,
    Number.isFinite(loanAmount) && loanAmount > 0 ? loanAmount : 1,
    installments > 0 && installments <= MAX_INSTALLMENTS ? installments : 1,
    Number.isFinite(effectiveMonthlyPayment) && effectiveMonthlyPayment > 0 ? effectiveMonthlyPayment : 1
  );

  const formatMoney = (val: number) => {
    return Math.round(val).toLocaleString("es-PY");
  };

  const handleSaveSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulationTitle.trim() || !isValidLoanInputs) return;

    setSavingLoading(true);
    setSaveFeedback("");
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: simulationTitle.trim(),
          amount: loanAmount,
          installments,
          monthly_payment: effectiveMonthlyPayment,
          interest_rate: calculationMode === "interest_rate" ? interestRateValue : 0,
          total_payment: totalPaymentEstimate,
        }),
      });

      if (!res.ok) throw new Error("No se pudo guardar la simulación. Revisá los datos e intentá otra vez.");
      const saved = await res.json();
      setSavedSimulations((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
      setSimulationTitle("");
      setSaveFeedback("Simulación guardada para comparar.");
    } catch (error) {
      setSaveFeedback(error instanceof Error ? error.message : "No se pudo guardar la simulación.");
    } finally {
      setSavingLoading(false);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    setSimulationToDelete(null);
    try {
      const res = await fetch(`/api/simulations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedSimulations((prev) => prev.filter((s) => s.id !== id));
      } else {
        setSaveFeedback("No se pudo eliminar. Probá de nuevo.");
      }
    } catch {
      setSaveFeedback("No se pudo eliminar. Revisá tu conexión e intentá otra vez.");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Configuration Card */}
      <div id="tour-loans-card" className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
              <span>Simulador de Préstamos</span>
            </h2>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              Compará escenarios con los ingresos y gastos que registraste.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex w-full sm:w-auto items-center gap-1 rounded-full bg-slate-100 p-1 border border-slate-200/80 shadow-inner">
            <button
              type="button"
              aria-pressed={calculationMode === "fixed_installment"}
              onClick={() => setCalculationMode("fixed_installment")}
              className={`min-h-11 flex-1 whitespace-nowrap rounded-full px-3 text-xs font-extrabold transition active:scale-95 ${
                calculationMode === "fixed_installment"
                  ? "bg-white text-slate-900 font-black shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Cuota conocida
            </button>
            <button
              type="button"
              aria-pressed={calculationMode === "interest_rate"}
              onClick={() => setCalculationMode("interest_rate")}
              className={`min-h-11 flex-1 whitespace-nowrap rounded-full px-3 text-xs font-extrabold transition active:scale-95 ${
                calculationMode === "interest_rate"
                  ? "bg-white text-slate-900 font-black shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Tasa anual
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 border-t border-slate-100 pt-4 sm:pt-6">
          {/* 1. Monto del Préstamo */}
          <div>
            <label htmlFor="loan-amount" className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Monto a Solicitar ({currencySymbol})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-base font-bold text-slate-500">
                {currencySymbol}
              </span>
              <input
                id="loan-amount"
                type="number"
                min="1"
                max={MAX_LOAN_AMOUNT}
                step="1000"
                inputMode="numeric"
                aria-label={`Monto a solicitar en ${currencySymbol}`}
                aria-invalid={!Number.isFinite(loanAmount) || loanAmount <= 0 || loanAmount > MAX_LOAN_AMOUNT}
                value={loanAmountInput}
                onChange={(e) => setLoanAmountInput(e.target.value)}
                className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-lg font-black text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
              />
            </div>
            {/* Quick chips en Guaraníes */}
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {[2000000, 5000000, 10000000, 20000000, 50000000].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  aria-pressed={loanAmount === quick}
                  onClick={() => setLoanAmountInput(String(quick))}
                  className={`app-mobile-choice min-h-11 min-w-0 rounded-xl px-1 text-[11px] sm:text-xs font-mono font-bold transition active:scale-95 ${
                    loanAmount === quick
                      ? "bg-slate-900 text-white font-black shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {quick / 1000000}M
                </button>
              ))}
            </div>
          </div>

          {/* 2. Plazo en Cuotas */}
          <div>
            <label htmlFor="loan-installments" className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Plazo (Meses / Cuotas)
            </label>
            <input
              id="loan-installments"
              type="number"
              min="1"
              max={MAX_INSTALLMENTS}
              inputMode="numeric"
              aria-invalid={installments < 1 || installments > MAX_INSTALLMENTS}
              value={installmentsInput}
              onChange={(e) => setInstallmentsInput(e.target.value)}
              className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-black text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
            <div className="mt-2 grid grid-cols-6 gap-1.5">
              {[3, 6, 12, 18, 24, 36].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={installments === m}
                  onClick={() => setInstallmentsInput(String(m))}
                  className={`app-mobile-choice min-h-11 min-w-0 flex items-center justify-center rounded-xl text-[11px] font-mono font-bold transition active:scale-95 ${
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
                <label htmlFor="loan-monthly-payment" className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Cuota Mensual Estimada ({currencySymbol})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-base font-bold text-slate-500">
                    {currencySymbol}
                  </span>
                  <input
                    id="loan-monthly-payment"
                    type="number"
                    min="1"
                    max={MAX_LOAN_AMOUNT}
                    step="1000"
                    inputMode="numeric"
                    aria-label={`Cuota mensual estimada en ${currencySymbol}`}
                    aria-invalid={!Number.isFinite(monthlyPaymentValue) || monthlyPaymentValue <= 0 || monthlyPaymentValue > MAX_LOAN_AMOUNT}
                    value={monthlyPaymentInput}
                    onChange={(e) => setMonthlyPaymentInput(e.target.value)}
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-lg font-black text-emerald-600 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500 font-medium">
                  {isValidLoanInputs ? (
                    <>Total estimado a devolver:{" "}
                      <strong className="text-slate-900 font-mono font-black">
                        {currencySymbol} {formatMoney(totalPaymentEstimate)}
                      </strong>
                    </>
                  ) : <span className="text-amber-800">Completá datos válidos para ver el total.</span>}
                </div>
              </>
            ) : (
              <>
                <label htmlFor="loan-interest-rate" className="block text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Tasa anual (%)
                </label>
                <input
                  id="loan-interest-rate"
                  type="number"
                  min="0"
                  max={MAX_ANNUAL_RATE}
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Tasa anual porcentual"
                  aria-invalid={interestRateInput.trim() === "" || !Number.isFinite(interestRateValue) || interestRateValue < 0 || interestRateValue > MAX_ANNUAL_RATE}
                  value={interestRateInput}
                  onChange={(e) => setInterestRateInput(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-black text-emerald-600 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
                <div className="mt-2 text-xs text-slate-500 font-medium">
                  {isValidLoanInputs ? (
                    <>Cuota estimada:{" "}
                      <strong className="text-emerald-600 font-mono font-black">
                        {currencySymbol} {formatMoney(effectiveMonthlyPayment)} / mes
                      </strong>
                    </>
                  ) : <span className="text-amber-800">Completá datos válidos para calcular la cuota.</span>}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Estimación con sistema francés; no incluye seguros ni comisiones.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {isValidLoanInputs ? (
      <>
      <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-2 text-left marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <span className="flex min-w-0 items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="min-w-0">
              <span className="block text-xs font-extrabold text-slate-800">Cómo leer esta estimación</span>
              <span className="block truncate text-[11px] text-slate-500">Se basa en tus ingresos y gastos registrados</span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-2 border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600 sm:grid-cols-3">
          <p>La cuota se calcula con el monto, el plazo y el método que elegiste.</p>
          <p>La relación cuota/ingresos usa los ingresos registrados; otros compromisos pueden cambiar tu margen.</p>
          <p>No incluye seguros, comisiones ni otros cargos. Compará el costo total y las condiciones de la oferta.</p>
        </div>
      </details>

      {/* Resultados de Impacto estimado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5" aria-label="Impacto estimado del préstamo">
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
                Impacto estimado
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
              <span>Diferencia respecto al capital:</span>
              <span className="font-black font-mono">
                {totalPaymentEstimate - loanAmount > 0 ? "+" : ""}{currencySymbol} {formatMoney(totalPaymentEstimate - loanAmount)}
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
        <div className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900 flex flex-col justify-between">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3 sm:mb-4">
              Indicador de tus finanzas
            </h4>
            <p className="-mt-2 mb-3 text-[11px] text-slate-500">Puntaje interno calculado con tus registros.</p>

            {/* Health comparison cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Actual */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-center">
                <span className="text-[11px] font-bold text-slate-600 uppercase">Hoy (Sin Crédito)</span>
                <div className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-0.5">
                  {metrics.totalIncome > 0 ? impact.currentHealth.score : "—"} <span className="text-xs text-slate-500 font-normal">{metrics.totalIncome > 0 ? "pts" : ""}</span>
                </div>
                <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${impact.currentHealth.badgeColor}`}>
                  {metrics.totalIncome > 0 ? impact.currentHealth.label : "Sin ingresos"}
                </div>
              </div>

              {/* Con Préstamo */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-center">
                <span className="text-[11px] font-bold text-slate-600 uppercase">Con este Préstamo</span>
                <div className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-0.5">
                  {metrics.totalIncome > 0 ? impact.projectedHealth.score : "—"} <span className="text-xs text-slate-500 font-normal">{metrics.totalIncome > 0 ? "pts" : ""}</span>
                </div>
                <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${impact.projectedHealth.badgeColor}`}>
                  {metrics.totalIncome > 0 ? impact.projectedHealth.label : "Sin ingresos"}
                </div>
              </div>
            </div>

            {/* Impact stats */}
            <div className="mt-4 space-y-2 text-xs text-slate-600 font-medium">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>Margen mensual estimado:</span>
                <span
                  className={`font-mono font-black ${
                    impact.projectedNetSavings >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {metrics.totalIncome > 0
                    ? `${impact.projectedNetSavings >= 0 ? "+" : ""}${currencySymbol} ${formatMoney(impact.projectedNetSavings)} / mes`
                    : "Registrá ingresos para calcular"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>Cuota / ingresos registrados:</span>
                <span
                  className={`font-mono font-black ${
                    impact.projectedNetSavings < 0 ? "text-rose-600" : "text-slate-900"
                  }`}
                >
                  {metrics.totalIncome > 0 ? `${impact.debtToIncomeRatio.toFixed(1)}%` : "Sin datos"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200/80 font-medium">
            {metrics.totalIncome <= 0 ? (
              <span className="text-slate-600 font-semibold">
                Sin ingresos registrados, este indicador no puede estimar el margen mensual.
              </span>
            ) : impact.projectedHealth.level === "EXCELENTE" || impact.projectedHealth.level === "BUENA" ? (
              <span className="text-emerald-700 font-semibold">
                El indicador queda positivo con los datos cargados. Los gastos no registrados no aparecen en este cálculo.
              </span>
            ) : impact.projectedHealth.level === "AGUANTABLE" ? (
              <span className="text-amber-800 font-semibold">
                Con estos datos, el margen queda ajustado. Revisá otros pagos que no estén registrados.
              </span>
            ) : (
              <span className="text-rose-700 font-semibold">
                Con estos datos, la cuota supera el margen mensual calculado. Revisá el monto, el plazo o tus registros.
              </span>
            )}
          </div>
        </div>

        {/* El "Factor Gastos al Pedo" & Guardar */}
        <div className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-orange-600 mb-2">
              <Flame className="h-4 w-4 shrink-0" />
              <span>Escenario de ajuste opcional</span>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-3.5 sm:p-4 text-xs text-slate-700">
              {metrics.expenses.al_pedo > 0 ? (
                <p className="leading-relaxed">
                  Tus gastos registrados como &quot;Al Pedo&quot; suman {currencySymbol} {formatMoney(metrics.expenses.al_pedo)} al mes. Si decidís reducirlos, equivalen al{" "}
                  <strong className="text-orange-700 font-mono font-black"> {((metrics.expenses.al_pedo / impact.monthlyPayment) * 100).toFixed(0)}%</strong> de esta cuota.
                </p>
              ) : (
                <p className="text-slate-500 font-medium">
                  No hay gastos en esta categoría para comparar. La cuota se descuenta del margen mensual estimado.
                </p>
              )}
            </div>
          </div>

          {/* Form to Save Simulation */}
          <form onSubmit={handleSaveSimulation} className="mt-5 border-t border-slate-100 pt-3">
            <label htmlFor="loan-simulation-title" className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Guardar simulación para comparar
            </label>
            <div className="flex gap-2">
              <input
                id="loan-simulation-title"
                type="text"
                value={simulationTitle}
                maxLength={255}
                onChange={(e) => { setSimulationTitle(e.target.value); setSaveFeedback(""); }}
                placeholder="Ej: Banco Itaú, Crédito Moto..."
                className="w-full min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 font-semibold focus:outline-none transition"
              />
              <button
                type="submit"
                disabled={savingLoading || !simulationTitle.trim() || !isValidLoanInputs}
                className="min-h-11 flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 transition active:scale-95 shrink-0"
              >
                <BookmarkPlus className="h-4 w-4 text-emerald-400" />
                {savingLoading ? "Guardando" : "Guardar"}
              </button>
            </div>
            {saveFeedback && <p role="status" aria-live="polite" className="mt-2 text-xs font-semibold text-slate-600">{saveFeedback}</p>}
          </form>
        </div>
      </div>
      </>
      ) : (
        <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {validationMessage}
        </p>
      )}

      {/* Simulaciones Guardadas */}
      {savedSimulations.length > 0 && (
        <div className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
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
                      type="button"
                      aria-label={`Eliminar simulación ${sim.title}`}
                      onClick={() => setSimulationToDelete({ id: sim.id, title: sim.title })}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-600 font-medium">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monto:</span>
                      <span className="font-mono font-black text-slate-900">
                        {currencySymbol} {formatMoney(sim.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cuotas:</span>
                      <span className="font-mono font-bold text-slate-700">{sim.installments} meses</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cuota:</span>
                      <span className="font-mono font-black text-emerald-600">
                        {currencySymbol} {formatMoney(sim.monthly_payment)} / mes
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLoanAmountInput(String(sim.amount));
                    setInstallmentsInput(String(sim.installments));
                    setMonthlyPaymentInput(String(sim.monthly_payment));
                    setCalculationMode("fixed_installment");
                    setSaveFeedback("");
                  }}
                  className="mt-3 w-full min-h-11 rounded-xl bg-white border border-slate-200 text-center text-xs font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95"
                >
                  Cargar en Simulador
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {loadingSaved && savedSimulations.length === 0 && (
        <p role="status" className="px-2 text-xs text-slate-500">Cargando simulaciones guardadas…</p>
      )}
      {savedLoadError && (
        <button
          type="button"
          onClick={() => void loadSaved()}
          className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-left text-xs font-semibold text-amber-900"
        >
          No se pudieron cargar tus simulaciones. Tocá para reintentar.
        </button>
      )}
      {simulationToDelete && <ConfirmDialog title="¿Eliminar simulación?" description={`Se eliminará “${simulationToDelete.title}” de tus simulaciones guardadas.`} confirmLabel="Eliminar" destructive onCancel={() => setSimulationToDelete(null)} onConfirm={() => void handleDeleteSaved(simulationToDelete.id)} />}
    </div>
  );
}
