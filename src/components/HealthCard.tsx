"use client";

import React from "react";
import { FinancialHealth, FinancialMetrics } from "@/lib/finance-engine";
import { Activity, ShieldCheck, AlertTriangle, ShieldAlert, TrendingUp } from "lucide-react";

interface HealthCardProps {
  metrics: FinancialMetrics;
  currencySymbol: string;
}

export default function HealthCard({ metrics }: HealthCardProps) {
  const { health, savingsRate, fixedExpenseRatio, alPedoRatio } = metrics;

  const getIcon = (level: string) => {
    switch (level) {
      case "EXCELENTE":
        return <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />;
      case "BUENA":
        return <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-teal-400" />;
      case "AGUANTABLE":
        return <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />;
      case "MALA":
        return <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />;
      case "SUPER_MALA":
      default:
        return <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500" />;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-4 sm:p-6 shadow-xl">
      {/* Background glow according to health level */}
      <div
        className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
          health.level === "EXCELENTE"
            ? "bg-emerald-500"
            : health.level === "BUENA"
            ? "bg-teal-500"
            : health.level === "AGUANTABLE"
            ? "bg-amber-500"
            : health.level === "MALA"
            ? "bg-orange-500"
            : "bg-rose-600"
        }`}
      />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        {/* Score & Semáforo Header */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Circular Score Badge */}
          <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 flex-col items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-950 shadow-inner">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
              {health.score}
            </span>
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Puntos / 100
            </span>
            {/* Visual bottom indicator bar */}
            <div className="absolute bottom-1.5 h-1 w-10 sm:w-12 rounded-full overflow-hidden bg-slate-800">
              <div
                className={`h-full transition-all duration-700 ${
                  health.score >= 80
                    ? "bg-emerald-400"
                    : health.score >= 65
                    ? "bg-teal-400"
                    : health.score >= 45
                    ? "bg-amber-400"
                    : health.score >= 25
                    ? "bg-orange-400"
                    : "bg-rose-500"
                }`}
                style={{ width: `${health.score}%` }}
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-400">
                Salud Financiera
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide ${health.badgeColor}`}
              >
                {getIcon(health.level)}
                <span>{health.label}</span>
              </span>
            </div>
            <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
              {health.summary}
            </p>
          </div>
        </div>

        {/* 3 Key Ratios Grid (Mobile-friendly 3 columns) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 border-t border-slate-800/80 pt-3 sm:border-t-0 sm:pt-0 shrink-0">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-2 sm:p-3 text-center">
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 truncate">Superávit</div>
            <div
              className={`text-sm sm:text-base font-bold font-mono mt-0.5 ${
                savingsRate >= 15
                  ? "text-emerald-400"
                  : savingsRate >= 0
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {savingsRate > 0 ? `+${savingsRate.toFixed(1)}%` : `${savingsRate.toFixed(1)}%`}
            </div>
            <div className="text-[8px] sm:text-[9px] text-slate-500 mt-0.5">Margen</div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-2 sm:p-3 text-center">
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 truncate">Gastos Fijos</div>
            <div
              className={`text-sm sm:text-base font-bold font-mono mt-0.5 ${
                fixedExpenseRatio <= 50
                  ? "text-emerald-400"
                  : fixedExpenseRatio <= 65
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {fixedExpenseRatio.toFixed(1)}%
            </div>
            <div className="text-[8px] sm:text-[9px] text-slate-500 mt-0.5">Rigidez</div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-2 sm:p-3 text-center">
            <div className="text-[9px] sm:text-[10px] uppercase font-bold text-orange-400 truncate">Al Pedo</div>
            <div
              className={`text-sm sm:text-base font-bold font-mono mt-0.5 ${
                alPedoRatio <= 8
                  ? "text-emerald-400"
                  : alPedoRatio <= 18
                  ? "text-amber-400"
                  : "text-orange-400"
              }`}
            >
              {alPedoRatio.toFixed(1)}%
            </div>
            <div className="text-[8px] sm:text-[9px] text-slate-500 mt-0.5">Fuga</div>
          </div>
        </div>
      </div>

      {/* Actionable Insights / Recommendations (hidden on mobile to make the view clean and lightweight) */}
      {health.recommendations.length > 0 && (
        <div className="hidden md:block mt-5 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-1.5">
            <TrendingUp className="h-4 w-4 shrink-0" />
            <span>Diagnóstico & Consejos Accionables:</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {health.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">•</span>
                <span className="leading-snug">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
