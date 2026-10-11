"use client";

import React, { useState, useMemo } from "react";
import { Transaction } from "@/lib/finance-engine";
import {
  Search,
  Flame,
  ChevronDown,
  ChevronUp,
  Tag,
  TrendingDown,
  Calendar,
  Edit2,
  Trash2,
  Layers,
  ArrowUpDown,
  Sparkles,
  ShoppingBag,
  Zap,
} from "lucide-react";

interface GroupedExpensesViewProps {
  transactions: Transaction[];
  currencySymbol: string;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onAddNewWithConcept?: (concept: string) => void;
  privacyMode?: boolean;
}

interface ExpenseGroup {
  key: string;
  name: string;
  totalAmount: number;
  count: number;
  average: number;
  transactions: Transaction[];
  categoriesCount: {
    fijo: number;
    variable: number;
    al_pedo: number;
  };
  dominantCategory: "fijo" | "variable" | "al_pedo";
  lastDate: string;
}

export default function GroupedExpensesView({
  transactions,
  currencySymbol,
  onEdit,
  onDelete,
  onAddNewWithConcept,
  privacyMode = false,
}: GroupedExpensesViewProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"total" | "frequency" | "name">("total");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const formatMoney = (val: number) => {
    if (privacyMode) return "••••••";
    return Math.round(val).toLocaleString("es-PY");
  };

  // Filter only expenses
  const expenseTransactions = useMemo(() => {
    return transactions.filter((t) => t.type === "expense");
  }, [transactions]);

  // Total expenses amount for percentage calculations
  const totalExpensesSum = useMemo(() => {
    return expenseTransactions.reduce((acc, t) => acc + t.amount, 0);
  }, [expenseTransactions]);

  // Group expenses by normalized description
  const groups: ExpenseGroup[] = useMemo(() => {
    const map = new Map<string, ExpenseGroup>();

    for (const tx of expenseTransactions) {
      const trimmed = tx.description.trim();
      if (!trimmed) continue;

      // Normalized key: lowercase without extra whitespace
      const key = trimmed.toLowerCase();

      if (!map.has(key)) {
        // Use the capitalized/original formatting for display
        const displayName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        map.set(key, {
          key,
          name: displayName,
          totalAmount: 0,
          count: 0,
          average: 0,
          transactions: [],
          categoriesCount: { fijo: 0, variable: 0, al_pedo: 0 },
          dominantCategory: "variable",
          lastDate: tx.date,
        });
      }

      const group = map.get(key)!;
      group.totalAmount += tx.amount;
      group.count += 1;
      group.transactions.push(tx);

      if (tx.category === "fijo") group.categoriesCount.fijo += 1;
      else if (tx.category === "variable") group.categoriesCount.variable += 1;
      else if (tx.category === "al_pedo") group.categoriesCount.al_pedo += 1;

      if (tx.date > group.lastDate) {
        group.lastDate = tx.date;
      }
    }

    // Determine averages and dominant category
    const list: ExpenseGroup[] = [];
    for (const group of map.values()) {
      group.average = group.count > 0 ? Math.round(group.totalAmount / group.count) : 0;

      // Sort transactions inside group from newest to oldest
      group.transactions.sort((a, b) => b.date.localeCompare(a.date));

      // Determine dominant category
      const { fijo, variable, al_pedo } = group.categoriesCount;
      if (al_pedo >= variable && al_pedo >= fijo && al_pedo > 0) {
        group.dominantCategory = "al_pedo";
      } else if (fijo >= variable && fijo >= al_pedo) {
        group.dominantCategory = "fijo";
      } else {
        group.dominantCategory = "variable";
      }

      list.push(group);
    }

    return list;
  }, [expenseTransactions]);

  // Top summary stats
  const topStats = useMemo(() => {
    if (groups.length === 0) return null;
    const sortedByTotal = [...groups].sort((a, b) => b.totalAmount - a.totalAmount);
    const sortedByFreq = [...groups].sort((a, b) => b.count - a.count);
    const totalAlPedoGroups = groups.filter((g) => g.categoriesCount.al_pedo > 0);
    const sumAlPedo = groups.reduce((acc, g) => {
      const alPedoTx = g.transactions.filter((t) => t.category === "al_pedo");
      return acc + alPedoTx.reduce((s, t) => s + t.amount, 0);
    }, 0);

    return {
      topSpent: sortedByTotal[0],
      topFreq: sortedByFreq[0],
      totalConcepts: groups.length,
      alPedoCount: totalAlPedoGroups.length,
      alPedoTotal: sumAlPedo,
    };
  }, [groups]);

  // Common quick chips for Paraguay
  const commonSuggestions = ["Bolt", "Biggie", "Jaha", "Superseis", "Stock", "PedidosYa", "Nafta"];

  // Filter and sort groups
  const filteredGroups = useMemo(() => {
    let result = groups.filter((g) => {
      if (filterCategory !== "all") {
        if (filterCategory === "al_pedo" && g.categoriesCount.al_pedo === 0) return false;
        if (filterCategory === "variable" && g.categoriesCount.variable === 0) return false;
        if (filterCategory === "fijo" && g.categoriesCount.fijo === 0) return false;
      }
      if (search.trim() && !g.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === "total") return b.totalAmount - a.totalAmount;
      if (sortBy === "frequency") return b.count - a.count;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [groups, search, sortBy, filterCategory]);

  const toggleExpand = (key: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "fijo":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
            🏠 Fijo
          </span>
        );
      case "variable":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/80">
            🛒 Variable
          </span>
        );
      case "al_pedo":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-600 border border-orange-200">
            <Flame className="h-3 w-3 text-orange-500 inline shrink-0" />
            ¡AL PEDO!
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Insights Strip (if there are groups) */}
      {topStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm text-slate-900">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              <span>Conceptos</span>
            </div>
            <div className="mt-1 text-lg sm:text-2xl font-black text-slate-900 font-mono">
              {topStats.totalConcepts}
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">Comercios / gastos únicos</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm text-slate-900">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider">
              <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
              <span>Mayor Gasto</span>
            </div>
            <div className="mt-1 text-sm sm:text-base font-extrabold text-slate-900 truncate">
              {topStats.topSpent.name}
            </div>
            <div className="text-[11px] sm:text-xs font-black text-rose-600 font-mono">
              {currencySymbol} {formatMoney(topStats.topSpent.totalAmount)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm text-slate-900">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Más Frecuente</span>
            </div>
            <div className="mt-1 text-sm sm:text-base font-extrabold text-slate-900 truncate">
              {topStats.topFreq.name}
            </div>
            <div className="text-[11px] sm:text-xs font-black text-amber-700 font-mono">
              {topStats.topFreq.count} veces ({currencySymbol} {formatMoney(topStats.topFreq.average)}/vez)
            </div>
          </div>

          <div className="rounded-2xl border border-orange-200/80 bg-orange-50/70 p-3 sm:p-4 shadow-sm text-slate-900">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-orange-600 uppercase tracking-wider">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span>Gastos Al Pedo</span>
            </div>
            <div className="mt-1 text-sm sm:text-base font-extrabold text-orange-950 truncate">
              {topStats.alPedoCount} conceptos
            </div>
            <div className="text-[11px] sm:text-xs font-black text-orange-600 font-mono">
              {currencySymbol} {formatMoney(topStats.alPedoTotal)}
            </div>
          </div>
        </div>
      )}

      {/* Main Filter & Search Card */}
      <div className="rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Gastos Agrupados por Concepto</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
              Acumula automáticamente todo lo gastado bajo el mismo nombre (ej: <strong>Bolt</strong>, <strong>Biggie</strong>, <strong>Jaha</strong>, <strong>Superseis</strong>).
            </p>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar (ej: Bolt, Biggie...)"
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold focus:outline-none transition"
            />
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 pb-1">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-600" />
            Ejemplos:
          </span>
          {commonSuggestions.map((sug) => (
            <button
              key={sug}
              onClick={() => setSearch(search === sug ? "" : sug)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition active:scale-95 ${
                search.toLowerCase() === sug.toLowerCase()
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {sug}
            </button>
          ))}
          {search && (
            <button
              onClick={() => setSearch("")}
              className="shrink-0 text-xs text-rose-600 font-bold hover:underline px-1"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Filters and Sorting Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 mt-2">
          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setFilterCategory("all")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition active:scale-95 ${
                filterCategory === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos ({groups.length})
            </button>
            <button
              onClick={() => setFilterCategory("al_pedo")}
              className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black transition active:scale-95 ${
                filterCategory === "al_pedo"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
                  : "bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100"
              }`}
            >
              <Flame className="h-3.5 w-3.5 shrink-0" />
              Gastos Al Pedo
            </button>
            <button
              onClick={() => setFilterCategory("variable")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                filterCategory === "variable"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-amber-50 text-amber-700 border border-amber-200/80 hover:bg-amber-100"
              }`}
            >
              Variables
            </button>
            <button
              onClick={() => setFilterCategory("fijo")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                filterCategory === "fijo"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
              }`}
            >
              Fijos
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Ordenar:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="total">Mayor Monto Total (₲)</option>
              <option value="frequency">Más Frecuente (Veces)</option>
              <option value="name">Alfabético (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* List of Grouped Expenses */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-[28px] border border-slate-100 bg-white p-12 text-center shadow-sm">
          <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-900">
            No se encontraron gastos con el nombre "{search}".
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">
            Cualquier gasto que cargues con el mismo nombre se acumulará automáticamente acá.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group, index) => {
            const isExpanded = Boolean(expandedGroups[group.key]);
            const percentOfTotal =
              totalExpensesSum > 0 ? (group.totalAmount / totalExpensesSum) * 100 : 0;

            return (
              <div
                key={group.key}
                className={`rounded-[24px] sm:rounded-[28px] border transition-all shadow-[0_2px_16px_rgba(0,0,0,0.02)] ${
                  group.dominantCategory === "al_pedo"
                    ? "border-orange-200/90 bg-white hover:border-orange-300 shadow-orange-500/5"
                    : "border-slate-100 bg-white hover:border-slate-200"
                }`}
              >
                {/* Main Card Header (Click to expand) */}
                <div
                  onClick={() => toggleExpand(group.key)}
                  className="p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                >
                  {/* Left info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Number Badge */}
                    <span
                      className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl font-mono text-xs sm:text-sm font-black ${
                        index === 0
                          ? "bg-amber-400 text-slate-950 shadow-sm"
                          : index === 1
                          ? "bg-slate-200 text-slate-800"
                          : index === 2
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      #{index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                          {group.name}
                        </h3>
                        {group.dominantCategory === "al_pedo" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-600 border border-orange-200">
                            <Flame className="h-3 w-3 text-orange-500 inline" />
                            Al Pedo ({group.categoriesCount.al_pedo})
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 font-mono">
                          {group.count} {group.count === 1 ? "compra / cobro" : "veces"}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 font-medium">
                        <span>Promedio: <strong className="font-mono text-slate-800 font-bold">{currencySymbol} {formatMoney(group.average)}</strong> / vez</span>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <span className="hidden sm:inline">Último: {group.lastDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Total Amount & Expand Arrow */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div
                        className={`text-base sm:text-xl font-black font-mono ${
                          group.dominantCategory === "al_pedo" ? "text-orange-600" : "text-slate-900"
                        }`}
                      >
                        {currencySymbol} {formatMoney(group.totalAmount)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono font-semibold">
                        {percentOfTotal.toFixed(1)}% del total de gastos
                      </div>
                    </div>

                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar showing portion of total expenses */}
                <div className="px-4 sm:px-5 pb-3.5">
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        group.dominantCategory === "al_pedo"
                          ? "bg-gradient-to-r from-orange-500 to-rose-500"
                          : "bg-gradient-to-r from-emerald-500 to-teal-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, percentOfTotal))}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Transactions Breakdown */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-5 rounded-b-[24px] sm:rounded-b-[28px] space-y-2 animate-in fade-in duration-200">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                      <span>Detalle de cada gasto en "{group.name}"</span>
                      <span className="font-mono text-slate-500 font-bold">{group.transactions.length} registros</span>
                    </div>

                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden bg-white">
                      {group.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-2.5 sm:p-3 hover:bg-slate-50 transition"
                        >
                          {/* Info */}
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="text-[11px] text-slate-400 font-mono font-medium flex items-center gap-1 shrink-0">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              <span>{tx.date}</span>
                            </div>
                            <div className="truncate text-xs font-bold text-slate-900">
                              {tx.description}
                            </div>
                            <div className="hidden sm:inline shrink-0">
                              {getCategoryBadge(tx.category)}
                            </div>
                          </div>

                          {/* Amount and Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-xs sm:text-sm font-black font-mono ${
                                tx.category === "al_pedo" ? "text-orange-600" : "text-slate-900"
                              }`}
                            >
                              -{currencySymbol} {formatMoney(tx.amount)}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(tx);
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                                title="Editar"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(tx.id);
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
