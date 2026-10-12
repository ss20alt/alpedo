"use client";

import React, { useState } from "react";
import { FinancialMetrics } from "@/lib/finance-engine";
import { PieChart, TrendingUp } from "lucide-react";
import FinanceIcon, { type FinanceIconName } from "@/components/FinanceIcon";

interface ExpenseDonutChartProps {
  metrics: FinancialMetrics;
  currencySymbol: string;
}

interface Segment {
  key: string;
  label: string;
  shortLabel: string;
  amount: number;
  color: string;
  hoverColor: string;
  textColor: string;
  bgLight: string;
  icon: FinanceIconName;
}

export default function ExpenseDonutChart({
  metrics,
  currencySymbol,
}: ExpenseDonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const formatMoney = (val: number) => {
    return Math.round(val).toLocaleString("es-PY");
  };

  const savingsAmount = metrics.netSavings > 0 ? metrics.netSavings : 0;
  const totalBase =
    metrics.totalIncome > 0
      ? Math.max(metrics.totalIncome, metrics.totalExpenses)
      : metrics.totalExpenses;

  const rawSegments: Segment[] = [
    {
      key: "fijo",
      label: "Gastos Fijos",
      shortLabel: "Fijos",
      amount: metrics.expenses.fijo,
      color: "#64748b", // slate-500
      hoverColor: "#94a3b8", // slate-400
      textColor: "text-slate-300",
      bgLight: "bg-slate-800/80 border-slate-700",
      icon: "home",
    },
    {
      key: "variable",
      label: "Gastos Variables",
      shortLabel: "Variables",
      amount: metrics.expenses.variable,
      color: "#f59e0b", // amber-500
      hoverColor: "#fbbf24", // amber-400
      textColor: "text-amber-400",
      bgLight: "bg-amber-950/40 border-amber-800/50",
      icon: "cart",
    },
    {
      key: "al_pedo",
      label: "Gastos Al Pedo",
      shortLabel: "Al Pedo",
      amount: metrics.expenses.al_pedo,
      color: "#f97316", // orange-500
      hoverColor: "#fb923c", // orange-400
      textColor: "text-orange-400",
      bgLight: "bg-orange-950/40 border-orange-800/50",
      icon: "flame",
    },
    {
      key: "ahorro",
      label: "Ahorro / Superávit",
      shortLabel: "Ahorro",
      amount: savingsAmount,
      color: "#10b981", // emerald-500
      hoverColor: "#34d399", // emerald-400
      textColor: "text-emerald-400",
      bgLight: "bg-emerald-950/40 border-emerald-800/50",
      icon: "piggyBank",
    },
  ];

  // Only segments with amount > 0
  const activeSegments = rawSegments.filter((s) => s.amount > 0);

  // SVG Geometry
  const size = 200;
  const center = size / 2;
  const radius = 70;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  // Compute strokeDasharray & strokeDashoffset
  let accumulatedPercent = 0;
  const renderedSegments = activeSegments.map((segment) => {
    const fraction = totalBase > 0 ? segment.amount / totalBase : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    // SVG circle starts at (center + r, center) = 3 o'clock. We rotate -90deg so it starts at 12 o'clock.
    const strokeDashoffset = -(accumulatedPercent * circumference);
    const percentOfIncome =
      metrics.totalIncome > 0
        ? (segment.amount / metrics.totalIncome) * 100
        : totalBase > 0
        ? (segment.amount / totalBase) * 100
        : 0;

    accumulatedPercent += fraction;

    return {
      ...segment,
      fraction,
      strokeDasharray,
      strokeDashoffset,
      percentOfIncome,
    };
  });

  const activeSegment = renderedSegments.find((s) => s.key === hoveredKey);

  if (totalBase <= 0) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl text-center">
        <p className="text-xs text-slate-400">Sin movimientos para graficar este mes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <PieChart className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
              Distribución de ingresos y gastos
            </h3>
            <p className="text-[11px] text-slate-400">
              Así se reparten los ingresos registrados entre gastos y ahorro.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
          Base: {currencySymbol} {formatMoney(totalBase)}
        </span>
      </div>

      {/* Main Content: SVG Donut on Left/Top, Interactive Legend on Right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Donut SVG Container */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full transform -rotate-90"
            >
              {/* Background Track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="#1e293b"
                strokeWidth={strokeWidth}
              />

              {/* Segments */}
              {renderedSegments.map((seg) => {
                const isHovered = hoveredKey === seg.key;
                return (
                  <circle
                    key={seg.key}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={isHovered ? seg.hoverColor : seg.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredKey(seg.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() =>
                      setHoveredKey(hoveredKey === seg.key ? null : seg.key)
                    }
                  />
                );
              })}
            </svg>

            {/* Center Label (Interactive on hover/tap) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2 max-w-[125px] mx-auto">
              {activeSegment ? (
                <>
                  <FinanceIcon name={activeSegment.icon} className={`h-4 w-4 ${activeSegment.textColor}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 truncate max-w-[110px]">
                    {activeSegment.shortLabel}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-black font-mono leading-tight truncate max-w-[110px] ${activeSegment.textColor}`}
                  >
                    {currencySymbol} {formatMoney(activeSegment.amount)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800/90 rounded-full px-2 py-0.2 mt-0.5 border border-slate-700">
                    {activeSegment.percentOfIncome.toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  {metrics.netSavings >= 0 ? (
                    <>
                      <TrendingUp className="h-4 w-4 text-emerald-400 mb-0.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Ahorro Real
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono text-emerald-400 leading-tight">
                        {metrics.savingsRate.toFixed(0)}%
                      </span>
                      <span className="text-[9px] text-slate-400 truncate max-w-[110px]">
                        {currencySymbol} {formatMoney(metrics.netSavings)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="text-rose-500"><FinanceIcon name="alert" /></span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                        Déficit
                      </span>
                      <span className="text-xs sm:text-sm font-black font-mono text-rose-400 leading-tight truncate max-w-[110px]">
                        -{currencySymbol} {formatMoney(Math.abs(metrics.netSavings))}
                      </span>
                      <span className="text-[9px] text-rose-300">
                        ({Math.abs(metrics.savingsRate).toFixed(0)}% en rojo)
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <span className="text-[10px] text-slate-500 mt-1">
            Tocá un segmento para ver el detalle
          </span>
        </div>

        {/* Legend List (Interactive) */}
        <div className="md:col-span-7 space-y-2">
          {rawSegments.map((seg) => {
            const isHovered = hoveredKey === seg.key;
            const percentOfIncome =
              metrics.totalIncome > 0
                ? (seg.amount / metrics.totalIncome) * 100
                : totalBase > 0
                ? (seg.amount / totalBase) * 100
                : 0;

            return (
              <div
                key={seg.key}
                onMouseEnter={() => setHoveredKey(seg.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() =>
                  setHoveredKey(hoveredKey === seg.key ? null : seg.key)
                }
                className={`flex items-center justify-between rounded-xl border p-2.5 sm:p-3 transition-all cursor-pointer ${
                  isHovered
                    ? "bg-slate-800 border-slate-600 scale-[1.01] shadow-md"
                    : `${seg.bgLight} hover:bg-slate-800/60`
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="h-3.5 w-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: seg.color }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">
                        {seg.label}
                      </span>
                      <FinanceIcon name={seg.icon} className={`h-3.5 w-3.5 ${seg.textColor}`} />
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {seg.amount > 0 ? (
                        <span>
                          {percentOfIncome.toFixed(1)}% del total mensual
                        </span>
                      ) : (
                        <span className="italic text-slate-500">Sin consumo</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-mono text-xs sm:text-sm font-black ${seg.textColor}`}>
                    {currencySymbol} {formatMoney(seg.amount)}
                  </div>
                  {seg.amount > 0 && (
                    <div className="text-[10px] font-mono text-slate-400">
                      {percentOfIncome.toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
