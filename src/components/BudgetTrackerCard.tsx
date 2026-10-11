"use client";

import React, { useState } from "react";
import { FinancialMetrics, calculateBudgetGauge } from "@/lib/finance-engine";
import { AlertTriangle, Flame, ShoppingCart, Sliders, Check, X, ShieldAlert } from "lucide-react";

interface BudgetTrackerCardProps {
  metrics: FinancialMetrics;
  currencySymbol: string;
  budgetAlPedoLimit: number;
  budgetVariableLimit: number;
  onUpdateBudgets: (newAlPedo: number, newVariable: number) => Promise<void>;
}

export default function BudgetTrackerCard({
  metrics,
  currencySymbol,
  budgetAlPedoLimit,
  budgetVariableLimit,
  onUpdateBudgets,
}: BudgetTrackerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempAlPedo, setTempAlPedo] = useState(budgetAlPedoLimit.toString());
  const [tempVariable, setTempVariable] = useState(budgetVariableLimit.toString());
  const [isSaving, setIsSaving] = useState(false);

  const formatMoney = (val: number) => {
    return Math.round(val).toLocaleString("es-PY");
  };

  const alPedoGauge = calculateBudgetGauge(metrics.expenses.al_pedo, budgetAlPedoLimit);
  const variableGauge = calculateBudgetGauge(metrics.expenses.variable, budgetVariableLimit);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const parsedAlPedo = Math.max(0, parseInt(tempAlPedo.replace(/\D/g, "") || "0", 10));
      const parsedVariable = Math.max(0, parseInt(tempVariable.replace(/\D/g, "") || "0", 10));
      await onUpdateBudgets(parsedAlPedo, parsedVariable);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTempAlPedo(budgetAlPedoLimit.toString());
    setTempVariable(budgetVariableLimit.toString());
    setIsEditing(false);
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
              Presupuesto Inteligente & Techos
              <span className="rounded bg-orange-950 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 border border-orange-800/60 uppercase">
                Semáforo
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Límites máximos para evitar fugas de plata antes de fin de mes.
            </p>
          </div>
        </div>

        {!isEditing ? (
          <button
            onClick={() => {
              setTempAlPedo(budgetAlPedoLimit.toString());
              setTempVariable(budgetVariableLimit.toString());
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition active:scale-95"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ajustar Topes</span>
          </button>
        ) : null}
      </div>

      {/* Edit Form Modal/Inline */}
      {isEditing && (
        <form
          onSubmit={handleSave}
          className="mb-5 rounded-2xl border border-slate-700 bg-slate-950 p-3.5 sm:p-4 space-y-3"
        >
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-emerald-400" />
            Configurar Topes Máximos Mensuales
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                🔥 Tope Gastos Al Pedo ({currencySymbol})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={tempAlPedo}
                onChange={(e) => setTempAlPedo(e.target.value)}
                placeholder="Ej: 500000"
                className="w-full h-9 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">
                Límite para gustos prescindibles.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                🛒 Tope Gastos Variables ({currencySymbol})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={tempVariable}
                onChange={(e) => setTempVariable(e.target.value)}
                placeholder="Ej: 1500000"
                className="w-full h-9 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">
                Límite para salidas, súper, ocio, etc.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleCancel}
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
              {isSaving ? "Guardando..." : "Guardar Topes"}
            </button>
          </div>
        </form>
      )}

      {/* Two Progress Trackers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Al Pedo Tracker */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-3.5 sm:p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 shrink-0">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Gastos Al Pedo
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Tope: {currencySymbol} {formatMoney(budgetAlPedoLimit)}
                  </p>
                </div>
              </div>

              {/* Semáforo Badge */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${alPedoGauge.badgeBg}`}
              >
                <span>
                  {alPedoGauge.status === "safe"
                    ? "🟢"
                    : alPedoGauge.status === "warning"
                    ? "🟡"
                    : "🔴"}
                </span>
                <span>{alPedoGauge.label}</span>
              </span>
            </div>

            {/* Consumed vs Limit */}
            <div className="flex items-baseline justify-between mt-3 mb-1">
              <span className="text-[11px] text-slate-400">Consumido este mes:</span>
              <div className="text-right">
                <span className={`font-mono text-sm sm:text-base font-black ${alPedoGauge.textColor}`}>
                  {currencySymbol} {formatMoney(alPedoGauge.spent)}
                </span>
                <span className="text-[11px] font-mono text-slate-500 ml-1">
                  / {currencySymbol} {formatMoney(alPedoGauge.limit)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-500 rounded-full ${alPedoGauge.progressColor}`}
                style={{ width: `${Math.min(100, alPedoGauge.percent)}%` }}
              />
            </div>

            {/* Status Footer */}
            <div className="flex flex-wrap items-center justify-between gap-1 mt-2 text-[10px] font-medium">
              <span className="text-slate-400 font-mono">
                {alPedoGauge.percent.toFixed(0)}% consumido
              </span>
              {alPedoGauge.isOver ? (
                <span className="text-rose-400 font-bold flex items-center gap-0.5">
                  <AlertTriangle className="h-3 w-3 inline" />
                  Excedido por {currencySymbol}{" "}
                  {formatMoney(alPedoGauge.spent - alPedoGauge.limit)}
                </span>
              ) : (
                <span className="text-emerald-400 font-bold">
                  Margen restante: {currencySymbol}{" "}
                  {formatMoney(alPedoGauge.remaining)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Variables Tracker */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/60 p-3.5 sm:p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Gastos Variables
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Tope: {currencySymbol} {formatMoney(budgetVariableLimit)}
                  </p>
                </div>
              </div>

              {/* Semáforo Badge */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${variableGauge.badgeBg}`}
              >
                <span>
                  {variableGauge.status === "safe"
                    ? "🟢"
                    : variableGauge.status === "warning"
                    ? "🟡"
                    : "🔴"}
                </span>
                <span>{variableGauge.label}</span>
              </span>
            </div>

            {/* Consumed vs Limit */}
            <div className="flex items-baseline justify-between mt-3 mb-1">
              <span className="text-[11px] text-slate-400">Consumido este mes:</span>
              <div className="text-right">
                <span className={`font-mono text-sm sm:text-base font-black ${variableGauge.textColor}`}>
                  {currencySymbol} {formatMoney(variableGauge.spent)}
                </span>
                <span className="text-[11px] font-mono text-slate-500 ml-1">
                  / {currencySymbol} {formatMoney(variableGauge.limit)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-500 rounded-full ${variableGauge.progressColor}`}
                style={{ width: `${Math.min(100, variableGauge.percent)}%` }}
              />
            </div>

            {/* Status Footer */}
            <div className="flex flex-wrap items-center justify-between gap-1 mt-2 text-[10px] font-medium">
              <span className="text-slate-400 font-mono">
                {variableGauge.percent.toFixed(0)}% consumido
              </span>
              {variableGauge.isOver ? (
                <span className="text-rose-400 font-bold flex items-center gap-0.5">
                  <AlertTriangle className="h-3 w-3 inline" />
                  Excedido por {currencySymbol}{" "}
                  {formatMoney(variableGauge.spent - variableGauge.limit)}
                </span>
              ) : (
                <span className="text-emerald-400 font-bold">
                  Margen restante: {currencySymbol}{" "}
                  {formatMoney(variableGauge.remaining)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
