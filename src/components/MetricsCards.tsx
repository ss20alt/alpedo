"use client";

import React from "react";
import { FinancialMetrics } from "@/lib/finance-engine";
import { ArrowUpRight, ArrowDownRight, Flame, Wallet } from "lucide-react";

interface MetricsCardsProps {
  metrics: FinancialMetrics;
  currencySymbol: string;
}

export default function MetricsCards({ metrics, currencySymbol }: MetricsCardsProps) {
  const { totalIncome, incomes, totalExpenses, expenses, netSavings, savingsRate, alPedoRatio } = metrics;

  const formatMoney = (val: number) => {
    return Math.round(val).toLocaleString("es-PY");
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Ingresos Totales */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Ingresos Totales</span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-white font-mono">
            {currencySymbol} {formatMoney(totalIncome)}
          </div>
        </div>

        <div className="mt-3 sm:mt-4 space-y-1 border-t border-slate-800/80 pt-2.5 sm:pt-3 text-[11px] sm:text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Fijos (Salario):</span>
            <span className="font-semibold text-slate-200 font-mono">
              {currencySymbol} {formatMoney(incomes.fijo)}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Variables (Extras):</span>
            <span className="font-semibold text-slate-200 font-mono">
              {currencySymbol} {formatMoney(incomes.variable)}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Pasivos (Inversiones):</span>
            <span className="font-semibold text-cyan-400 font-mono">
              {currencySymbol} {formatMoney(incomes.pasivo)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Gastos Necesarios (Fijos + Variables) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Gastos Necesarios</span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-white font-mono">
            {currencySymbol} {formatMoney(expenses.fijo + expenses.variable)}
          </div>
        </div>

        <div className="mt-3 sm:mt-4 space-y-1 border-t border-slate-800/80 pt-2.5 sm:pt-3 text-[11px] sm:text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Fijos (Alquiler/ANDE):</span>
            <span className="font-semibold text-slate-200 font-mono">
              {currencySymbol} {formatMoney(expenses.fijo)}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Variables (Super/Nafta):</span>
            <span className="font-semibold text-slate-200 font-mono">
              {currencySymbol} {formatMoney(expenses.variable)}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Total con Al Pedo:</span>
            <span className="font-semibold text-slate-400 font-mono">
              {currencySymbol} {formatMoney(totalExpenses)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Gastos AL PEDO (Destacado Especial) */}
      <div className="relative overflow-hidden rounded-2xl border border-orange-500/40 bg-gradient-to-b from-orange-950/30 to-slate-900 p-4 sm:p-5 shadow-lg flex flex-col justify-between">
        <div className="absolute top-0 right-0 h-16 w-16 bg-orange-500/10 rounded-full blur-xl pointer-events-none" />
        
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-orange-400 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <Flame className="h-4 w-4 shrink-0" />
              <span>Gastos AL PEDO</span>
            </div>
            <span className="rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-300">
              {alPedoRatio.toFixed(1)}% del sueldo
            </span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-orange-400 font-mono">
            {currencySymbol} {formatMoney(expenses.al_pedo)}
          </div>
        </div>

        <div className="mt-3 sm:mt-4 border-t border-orange-900/40 pt-2.5 sm:pt-3 text-[11px] sm:text-xs">
          {expenses.al_pedo > 0 ? (
            <p className="flex items-start gap-1.5 text-slate-300 leading-snug">
              <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" /> Cortando estos caprichos sumás{" "}
              <strong className="text-orange-300 font-mono font-bold">
                {currencySymbol} {formatMoney(expenses.al_pedo)}
              </strong>{" "}
              libres por mes.
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-emerald-400 font-medium">
              <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" /> ¡Excelente! No tenés gastos al pedo registrados este mes.
            </p>
          )}
        </div>
      </div>

      {/* 4. Balance Neto (Superávit / Déficit) */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 shadow-lg flex flex-col justify-between ${
          netSavings >= 0
            ? "border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-900"
            : "border-rose-500/40 bg-gradient-to-b from-rose-950/20 to-slate-900"
        }`}
      >
        <div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
              {netSavings >= 0 ? "Superávit (Ahorro)" : "Déficit Mensual"}
            </span>
            <div
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg ${
                netSavings >= 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-400"
              }`}
            >
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div
            className={`mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black font-mono ${
              netSavings >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {netSavings >= 0 ? "+" : ""}
            {currencySymbol} {formatMoney(netSavings)}
          </div>
        </div>

        <div className="mt-3 sm:mt-4 border-t border-slate-800/80 pt-2.5 sm:pt-3 text-[11px] sm:text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Tasa de Ahorro:</span>
            <span
              className={`font-bold font-mono ${
                savingsRate >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {savingsRate.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-[10px] sm:text-[11px] text-slate-500">
            {netSavings >= 0
              ? "Plata libre para ahorro o inversión."
              : "Consumiendo reservas o acumulando deuda."}
          </p>
        </div>
      </div>
    </div>
  );
}
