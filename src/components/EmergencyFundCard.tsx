"use client";

import React, { useState } from "react";
import { FinancialMetrics, calculateEmergencyFundAnalysis } from "@/lib/finance-engine";
import { ShieldCheck, Edit3, Check, TrendingUp, Landmark, Lightbulb } from "lucide-react";

interface EmergencyFundCardProps {
  metrics: FinancialMetrics;
  currencySymbol: string;
  emergencyFundSaved: number;
  onUpdateEmergencyFund: (saved: number) => Promise<void>;
}

export default function EmergencyFundCard({
  metrics,
  currencySymbol,
  emergencyFundSaved,
  onUpdateEmergencyFund,
}: EmergencyFundCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempSaved, setTempSaved] = useState(emergencyFundSaved.toString());
  const [isSaving, setIsSaving] = useState(false);

  const formatMoney = (val: number) => {
    return Math.round(val).toLocaleString("es-PY");
  };

  const analysis = calculateEmergencyFundAnalysis(
    metrics.expenses.fijo,
    emergencyFundSaved,
    metrics.netSavings
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const parsed = Math.max(0, parseInt(tempSaved.replace(/\D/g, "") || "0", 10));
      await onUpdateEmergencyFund(parsed);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
              Blindaje & Colchón de Emergencia
              <span className="rounded bg-teal-950 px-1.5 py-0.5 text-[9px] font-bold text-teal-400 border border-teal-800/60 uppercase">
                Paraguay
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Fondo de reserva ante imprevistos basado en tus gastos fijos reales.
            </p>
          </div>
        </div>

        {!isEditing ? (
          <button
            onClick={() => {
              setTempSaved(emergencyFundSaved.toString());
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition active:scale-95"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Actualizar Ahorro</span>
          </button>
        ) : null}
      </div>

      {/* Edit Form */}
      {isEditing && (
        <form
          onSubmit={handleSave}
          className="mb-5 rounded-2xl border border-slate-700 bg-slate-950 p-3.5 sm:p-4 space-y-3"
        >
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Landmark className="h-4 w-4 text-emerald-400" />
            ¿Cuánto dinero tenés guardado actualmente como fondo de emergencia?
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-500">
                {currencySymbol}
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={tempSaved}
                onChange={(e) => setTempSaved(e.target.value)}
                placeholder="Ej: 3000000"
                className="w-full h-9 rounded-xl border border-slate-700 bg-slate-900 pl-8 pr-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
              >
                <Check className="h-3.5 w-3.5" />
                {isSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            Incluye cajas de ahorro a la vista, CDA disponible o fondos monetarios que puedas disponer de inmediato.
          </p>
        </form>
      )}

      {/* 3 Metric Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Fixed Expenses Base */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Tus Gastos Fijos / Mes
          </span>
          <div className="mt-1 font-mono text-sm sm:text-base font-black text-slate-200">
            {currencySymbol} {formatMoney(analysis.fixedMonthlyExpense)}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Alquiler, ANDE, Essap, servicios básicos.
          </p>
        </div>

        {/* 3 Months Cushion */}
        <div className="rounded-2xl border border-teal-800/40 bg-teal-950/20 p-3 sm:p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
              Colchón Mínimo (3 Meses)
            </span>
            <span className="text-[10px] font-bold text-teal-300 font-mono">
              3 × Fijos
            </span>
          </div>
          <div className="mt-1 font-mono text-sm sm:text-base font-black text-teal-300">
            {currencySymbol} {formatMoney(analysis.min3Months)}
          </div>
          <p className="text-[10px] text-teal-400/80 mt-0.5">
            Blindaje básico ante pérdida de trabajo o salud.
          </p>
        </div>

        {/* 6 Months Cushion */}
        <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-3 sm:p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Colchón Óptimo (6 Meses)
            </span>
            <span className="text-[10px] font-bold text-emerald-300 font-mono">
              6 × Fijos
            </span>
          </div>
          <div className="mt-1 font-mono text-sm sm:text-base font-black text-emerald-300">
            {currencySymbol} {formatMoney(analysis.opt6Months)}
          </div>
          <p className="text-[10px] text-emerald-400/80 mt-0.5">
            Paz mental absoluta e inmunidad financiera.
          </p>
        </div>
      </div>

      {/* Progress Section */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-1.5">
            <Landmark className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-white">
              Tu Fondo Guardado:
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-emerald-400">
              {currencySymbol} {formatMoney(analysis.currentSaved)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono font-bold text-slate-300">
              {analysis.progressMin.toFixed(0)}% de la meta de 3 meses
            </span>
          </div>
        </div>

        {/* Dual Goal Progress Bar */}
        <div className="relative pt-1">
          <div className="h-3.5 w-full rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                analysis.progressMin >= 100
                  ? "bg-gradient-to-r from-teal-500 to-emerald-400"
                  : "bg-teal-500"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  analysis.opt6Months > 0
                    ? (analysis.currentSaved / analysis.opt6Months) * 100
                    : 0
                )}%`,
              }}
            />
          </div>

          {/* Markers */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400 mt-1.5">
            <span className="hidden sm:inline">0</span>
            <span className="font-semibold text-teal-400">
              Meta 3m: {currencySymbol} {formatMoney(analysis.min3Months)}
            </span>
            <span className="font-semibold text-emerald-400">
              Meta 6m: {currencySymbol} {formatMoney(analysis.opt6Months)}
            </span>
          </div>
        </div>

        {/* Actionable Strategy Tip */}
        <div className="flex items-start gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
          <Lightbulb className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-slate-300">
            {analysis.progressMin >= 100 ? (
              <span className="text-emerald-300 font-semibold">
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 shrink-0" /> ¡Excelente blindaje! Ya tenés cubierto tu colchón mínimo de 3 meses.</span>
                {analysis.progressOpt < 100 && analysis.monthsToOptWithSurplus ? (
                  <span>
                    {" "}Con tu ahorro actual de {currencySymbol}{" "}
                    {formatMoney(metrics.netSavings)}/mes, completás los 6 meses en{" "}
                    <b>{analysis.monthsToOptWithSurplus} meses</b>.
                  </span>
                ) : null}
              </span>
            ) : analysis.monthsToMinWithSurplus ? (
              <span>
                Te faltan <b>{currencySymbol} {formatMoney(analysis.missingForMin)}</b> para el mínimo. Ahorrando tu superávit mensual actual (<b>{currencySymbol} {formatMoney(metrics.netSavings)}</b>), lo completás en solo <b>{analysis.monthsToMinWithSurplus} meses</b>.
              </span>
            ) : (
              <span>
                Te faltan <b>{currencySymbol} {formatMoney(analysis.missingForMin)}</b> para blindar 3 meses de gastos fijos. Recordá colocar este fondo en una cuenta con rendimiento en Guaraníes (a la vista o CDA escalonado).
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
