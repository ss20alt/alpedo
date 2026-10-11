"use client";

import React, { useState, useMemo, useRef } from "react";
import { Transaction } from "@/lib/finance-engine";
import {
  Search,
  Flame,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  Edit2,
  Filter,
  Calendar,
  X,
  Layers,
  ListOrdered,
  FileSpreadsheet,
  ArrowUpDown,
  Zap,
} from "lucide-react";
import FinanceIcon from "@/components/FinanceIcon";
import GroupedExpensesView from "./GroupedExpensesView";
import { triggerHaptic } from "@/lib/haptics";
import { formatParaguayDateLabel } from "@/lib/date-utils";

interface TransactionsListProps {
  transactions: Transaction[];
  currencySymbol: string;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
  onToggleAlPedo?: (tx: Transaction) => void;
  defaultView?: "list" | "grouped";
  initialCategory?: string;
  initialRecurringOnly?: boolean;
  privacyMode?: boolean;
}

function SwipeableTransactionItem({
  tx,
  currencySymbol,
  formatMoney,
  getCategoryBadge,
  onEdit,
  onDelete,
  onToggleAlPedo,
}: {
  tx: Transaction;
  currencySymbol: string;
  formatMoney: (val: number) => string;
  getCategoryBadge: (tx: Transaction) => React.ReactNode;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onToggleAlPedo?: (tx: Transaction) => void;
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Only respond if movement is horizontal
    if (Math.abs(deltaX) > Math.abs(deltaY) + 5) {
      // Swipe limits: left up to -135px, right up to 75px
      const clamped = Math.max(-135, Math.min(75, deltaX));
      setSwipeOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeOffset < -45) {
      triggerHaptic("selection");
      setSwipeOffset(-130);
    } else if (swipeOffset > 35) {
      triggerHaptic("selection");
      setSwipeOffset(75);
    } else {
      setSwipeOffset(0);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const resetSwipe = () => {
    setSwipeOffset(0);
  };

  const isAlPedo = tx.category === "al_pedo";

  return (
    <div className="relative overflow-hidden bg-slate-100 select-none border-b border-slate-100 last:border-b-0">
      {/* Background action reveal tray */}
      {/* Right side background (revealed on swipe left) */}
      <div className="absolute inset-y-0 right-0 flex items-stretch z-0">
        {tx.type === "expense" && onToggleAlPedo && (
          <button
            onClick={() => {
              triggerHaptic("medium");
              resetSwipe();
              onToggleAlPedo(tx);
            }}
            className={`flex flex-col items-center justify-center w-16 px-2 text-white font-extrabold text-[10px] transition active:opacity-90 ${
              isAlPedo ? "bg-amber-500" : "bg-orange-500"
            }`}
            title="Marcar / Desmarcar Al Pedo"
          >
            <Flame className="h-4 w-4 mb-0.5" />
            <span>{isAlPedo ? "Quitar" : "Al Pedo"}</span>
          </button>
        )}
        <button
          onClick={() => {
            triggerHaptic("heavy");
            resetSwipe();
            onDelete(tx.id);
          }}
          className="flex flex-col items-center justify-center w-16 px-2 bg-rose-600 text-white font-extrabold text-[10px] transition active:opacity-90"
          title="Eliminar movimiento"
        >
          <Trash2 className="h-4 w-4 mb-0.5" />
          <span>Borrar</span>
        </button>
      </div>

      {/* Left side background (revealed on swipe right) */}
      <div className="absolute inset-y-0 left-0 flex items-stretch z-0">
        <button
          onClick={() => {
            triggerHaptic("light");
            resetSwipe();
            onEdit(tx);
          }}
          className="flex flex-col items-center justify-center w-20 px-2 bg-[#1656DB] text-white font-extrabold text-[10px] transition active:opacity-90"
          title="Editar movimiento"
        >
          <Edit2 className="h-4 w-4 mb-0.5" />
          <span>Editar</span>
        </button>
      </div>

      {/* Foreground card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (swipeOffset !== 0) resetSwipe();
        }}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="relative z-10 flex items-start sm:items-center justify-between p-3 sm:p-3.5 bg-white hover:bg-slate-50/90 transition-colors gap-2 sm:gap-4"
      >
        {/* Left: Info */}
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div
            className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl mt-0.5 sm:mt-0 ${
              tx.type === "income"
                ? "bg-emerald-50 text-emerald-600"
                : tx.category === "al_pedo"
                ? "bg-orange-50 text-orange-500"
                : "bg-rose-50 text-rose-500"
            }`}
          >
            {tx.type === "income" ? (
              <ArrowUpCircle className="h-5 w-5" />
            ) : tx.category === "al_pedo" ? (
              <Flame className="h-5 w-5" />
            ) : (
              <ArrowDownCircle className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-extrabold text-slate-900 break-words line-clamp-2 leading-snug">
              {tx.description}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] sm:text-[11px] text-slate-400 mt-1">
              <span className="flex items-center gap-1 shrink-0 text-slate-400 font-semibold">
                <Calendar className="h-3 w-3 text-slate-400" />
                {formatParaguayDateLabel(tx.date)}
              </span>
              {getCategoryBadge(tx)}
              {tx.is_recurring ? (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[8px] sm:text-[9px] text-slate-500 uppercase font-mono font-bold">
                  Rec.
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right: Amount & Actions */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 shrink-0">
          <span
            className={`text-xs sm:text-sm md:text-base font-black font-mono whitespace-nowrap text-right ${
              tx.type === "income"
                ? "text-emerald-600"
                : tx.category === "al_pedo"
                ? "text-orange-600"
                : "text-slate-900"
            }`}
          >
            {tx.type === "income" ? "+" : "-"}
            {currencySymbol} {formatMoney(tx.amount)}
          </span>

          {/* Desktop action buttons */}
          <div className="hidden sm:flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => {
                triggerHaptic("light");
                onEdit(tx);
              }}
              className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-90 transition"
              title="Editar"
              aria-label="Editar movimiento"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                triggerHaptic("heavy");
                onDelete(tx.id);
              }}
              className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 active:scale-90 transition"
              title="Eliminar"
              aria-label="Eliminar movimiento"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransactionsList({
  transactions,
  currencySymbol,
  onEdit,
  onDelete,
  onAddNew,
  onToggleAlPedo,
  defaultView = "list",
  initialCategory = "all",
  initialRecurringOnly = false,
  privacyMode = false,
}: TransactionsListProps) {
  const [viewMode, setViewMode] = useState<"list" | "grouped">(defaultView);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">(() => {
    if (initialCategory === "fijo" || initialCategory === "variable" || initialCategory === "al_pedo") return "expense";
    if (initialCategory === "pasivo") return "income";
    return "all";
  });
  const [filterCategory, setFilterCategory] = useState<string>(initialCategory || "all");
  const [filterRecurring, setFilterRecurring] = useState<boolean>(initialRecurringOnly);
  const [amountFilter, setAmountFilter] = useState<"all" | "big" | "ant">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const formatMoney = (val: number) => {
    if (privacyMode) return "••••••";
    return Math.round(val).toLocaleString("es-PY");
  };

  const uniqueConceptsCount = useMemo(() => {
    const set = new Set<string>();
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const k = t.description.trim().toLowerCase();
        if (k) set.add(k);
      });
    return set.size;
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterRecurring && !t.is_recurring) return false;
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (search.trim() && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (amountFilter === "big" && (t.type !== "expense" || t.amount <= 100000)) return false;
      if (amountFilter === "ant" && (t.type !== "expense" || t.amount >= 30000)) return false;
      return true;
    });
  }, [transactions, filterRecurring, filterType, filterCategory, search, amountFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "amount_desc":
        return list.sort((a, b) => b.amount - a.amount);
      case "amount_asc":
        return list.sort((a, b) => a.amount - b.amount);
      case "date_asc":
        return list.sort((a, b) => a.date.localeCompare(b.date));
      case "date_desc":
      default:
        return list.sort((a, b) => b.date.localeCompare(a.date));
    }
  }, [filtered, sortBy]);

  const filteredExpenseSum = useMemo(() => {
    return filtered
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => acc + t.amount, 0);
  }, [filtered]);

  const getCategoryBadge = (t: Transaction) => {
    if (t.type === "income") {
      switch (t.category) {
        case "fijo":
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/80">
              <><FinanceIcon name="briefcase" className="h-3 w-3" /> Fijo</>
            </span>
          );
        case "variable":
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 border border-teal-200/80">
              <><FinanceIcon name="trend" className="h-3 w-3" /> Var.</>
            </span>
          );
        case "pasivo":
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700 border border-cyan-200/80">
              <><FinanceIcon name="wallet" className="h-3 w-3" /> Pasivo</>
            </span>
          );
      }
    } else {
      switch (t.category) {
        case "fijo":
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
              <><FinanceIcon name="home" className="h-3 w-3" /> Fijo</>
            </span>
          );
        case "variable":
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/80">
              <><FinanceIcon name="cart" className="h-3 w-3" /> Var.</>
            </span>
          );
        case "al_pedo":
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-600 border border-orange-200">
              <Flame className="h-3 w-3 text-orange-500 inline shrink-0" />
              ¡AL PEDO!
            </span>
          );
      }
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* View Switcher Bar (Segmented Control) */}
      <div className="rounded-full border border-slate-200/80 bg-slate-200/60 p-1 flex gap-1 shadow-inner">
        <button
          onClick={() => setViewMode("list")}
          className={`flex-1 flex min-h-11 items-center justify-center gap-1.5 sm:gap-2 rounded-full py-2 sm:py-2.5 px-3 sm:px-4 text-xs sm:text-sm font-extrabold transition active:scale-[0.99] ${
            viewMode === "list"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <ListOrdered className="h-4 w-4 shrink-0" />
          <span className="truncate">Movimientos ({transactions.length})</span>
        </button>

        <button
          onClick={() => setViewMode("grouped")}
          className={`flex-1 flex min-h-11 items-center justify-center gap-1.5 sm:gap-2 rounded-full py-2 sm:py-2.5 px-3 sm:px-4 text-xs sm:text-sm font-extrabold transition active:scale-[0.99] ${
            viewMode === "grouped"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm font-black"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Layers className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="flex items-center gap-1 sm:gap-1.5 truncate">
            <span className="truncate">Por Comercio</span>
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[10px] font-mono font-black shrink-0">
              {uniqueConceptsCount}
            </span>
          </div>
        </button>
      </div>

      {/* Interactive Gesture & Feature Guide Pill */}
      {viewMode === "list" && (
        <div className="flex items-center justify-between rounded-2xl bg-blue-50/70 border border-blue-100/90 px-3.5 py-2 text-[11px] text-[#1656DB] font-semibold">
          <div className="flex items-center gap-2">
            <FinanceIcon name="moveHorizontal" className="h-4 w-4 shrink-0" />
            <span>
              <strong>Deslizá a la derecha</strong> para editar, o a la <strong>izquierda</strong> para marcar <span className="text-orange-600 font-black">Al Pedo</span> o borrar.
            </span>
          </div>
        </div>
      )}

      {viewMode === "grouped" && (
        <div className="flex items-center justify-between rounded-2xl bg-cyan-50/70 border border-cyan-100/90 px-3.5 py-2 text-[11px] text-cyan-800 font-semibold">
          <div className="flex items-center gap-2">
            <FinanceIcon name="store" className="h-4 w-4 shrink-0" />
            <span>
              <strong>Guía de Comercios:</strong>{" "}
              <span className="sm:hidden">Agrupamos gastos con el mismo nombre para ver en qué se va tu plata.</span>
              <span className="hidden sm:inline">Agrupa automáticamente tus gastos repetidos en Biggie, Bolt, súper y combustible para identificar fugas de dinero hormiga.</span>
            </span>
          </div>
        </div>
      )}

      {/* Conditionally Render: Grouped View OR Chronological List */}
      {viewMode === "grouped" ? (
        <div id="tour-grouped-view">
          <GroupedExpensesView
            transactions={transactions}
            currencySymbol={currencySymbol}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      ) : (
        <div id="tour-transactions-list" className="rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
          {/* Title & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 sm:pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                Movimientos ({filtered.length})
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">
                Registro cronológico detallado de tus ingresos y gastos.
              </p>
            </div>

            {/* Search Input & Excel Export */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por detalle..."
                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold focus:outline-none transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <a
                href="/api/transactions/export"
                download
                className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition active:scale-95 shrink-0"
                title="Descargar en Excel (CSV)"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </a>
            </div>
          </div>

          {/* Compact mobile filter disclosure; full controls remain visible on larger screens. */}
          <button
            type="button"
            aria-expanded={showMobileFilters}
            onClick={() => setShowMobileFilters((open) => !open)}
            className="sm:hidden mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700"
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              Filtros y orden
              {(() => {
                const activeFilters = Number(filterType !== "all" || filterCategory !== "all") + Number(filterRecurring) + Number(amountFilter !== "all");
                return activeFilters > 0 ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                    {activeFilters} activo{activeFilters > 1 ? "s" : ""}
                  </span>
                ) : null;
              })()}
            </span>
            <span className="text-slate-400">{showMobileFilters ? "Ocultar" : "Mostrar"}</span>
          </button>

          {/* Filter Chips & Sorting Control */}
          <div className={`${showMobileFilters ? "block" : "hidden"} sm:block space-y-2.5 py-3 border-b border-slate-100`}>
            {/* Row 1: Tipo & Categoría */}
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1 shrink-0 mr-0.5 uppercase tracking-wider">
                <Filter className="h-3 w-3" />
                Tipo:
              </span>

              <button
                onClick={() => {
                  setFilterType("all");
                  setFilterCategory("all");
                }}
                className={`min-h-11 shrink-0 rounded-full px-3 py-2 text-xs font-extrabold transition active:scale-95 ${
                  filterType === "all" && filterCategory === "all"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => {
                  setFilterType("income");
                  setFilterCategory("all");
                }}
                className={`min-h-11 shrink-0 rounded-full px-3 py-2 text-xs font-extrabold transition active:scale-95 ${
                  filterType === "income"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100"
                }`}
              >
                Ingresos
              </button>
              <button
                onClick={() => {
                  setFilterType("expense");
                  setFilterCategory("all");
                }}
                className={`min-h-11 shrink-0 rounded-full px-3 py-2 text-xs font-extrabold transition active:scale-95 ${
                  filterType === "expense" && filterCategory !== "al_pedo"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100"
                }`}
              >
                Gastos
              </button>

              <button
                onClick={() => {
                  setFilterType("expense");
                  setFilterCategory("al_pedo");
                }}
                className={`min-h-11 shrink-0 flex items-center gap-1 rounded-full px-3 py-2 text-xs font-black transition active:scale-95 ${
                  filterCategory === "al_pedo"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
                    : "bg-orange-50 text-orange-600 border border-orange-200/80 hover:bg-orange-100"
                }`}
              >
                <Flame className="h-3.5 w-3.5 shrink-0" />
                ¡Al Pedo!
              </button>

              <button
                onClick={() => setFilterRecurring(!filterRecurring)}
                className={`min-h-11 shrink-0 flex items-center gap-1 rounded-full px-3 py-2 text-xs font-black transition active:scale-95 ${
                  filterRecurring
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100"
                }`}
              >
                <Zap className="h-3.5 w-3.5 shrink-0" />
                Recurrentes
              </button>
            </div>

            {/* Row 2: Impact Filters (Montos) & Ordenamiento */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {/* Filtro Rápido de Impacto por Monto */}
              <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1 shrink-0 mr-0.5 uppercase tracking-wider">
                  <Zap className="h-3 w-3 text-amber-500" />
                  Monto:
                </span>

                <button
                  onClick={() => setAmountFilter("all")}
                  className={`min-h-11 shrink-0 rounded-full px-2.5 py-2 text-[11px] font-bold transition ${
                    amountFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Cualquiera
                </button>

                <button
                  onClick={() => setAmountFilter("big")}
                  className={`min-h-11 shrink-0 flex items-center gap-1 rounded-full px-2.5 py-2 text-[11px] font-bold transition ${
                    amountFilter === "big"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-rose-50 text-rose-700 border border-rose-200/70 hover:bg-rose-100"
                  }`}
                >
                  <span className="inline-flex items-center gap-1"><FinanceIcon name="flame" className="h-3.5 w-3.5" /> Grandes (&gt;100k)</span>
                </button>

                <button
                  onClick={() => setAmountFilter("ant")}
                  className={`min-h-11 shrink-0 flex items-center gap-1 rounded-full px-2.5 py-2 text-[11px] font-bold transition ${
                    amountFilter === "ant"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-amber-50 text-amber-800 border border-amber-200/70 hover:bg-amber-100"
                  }`}
                >
                  <span className="inline-flex items-center gap-1"><FinanceIcon name="bug" className="h-3.5 w-3.5" /> Hormiga (&lt;30k)</span>
                </button>
              </div>

              {/* Selector de Ordenamiento */}
              <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  <span>Ordenar:</span>
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "date_desc" | "date_asc" | "amount_desc" | "amount_asc")}
                  className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="date_desc">Más recientes</option>
                  <option value="date_asc">Más antiguos</option>
                  <option value="amount_desc">Mayor monto</option>
                  <option value="amount_asc">Menor monto</option>
                </select>
              </div>
            </div>

            {/* Banner de Impacto si hay filtro activo */}
            {amountFilter !== "all" && (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
                <span className="text-slate-600 font-medium">
                  {amountFilter === "big" ? "Total en gastos grandes (> ₲ 100.000):" : "Fuga total en gastos hormiga (< ₲ 30.000):"}
                  <b className="ml-1 text-slate-900 font-mono font-black">
                    {currencySymbol} {formatMoney(filteredExpenseSum)}
                  </b>
                  <span className="text-slate-400 ml-1">({filtered.length} movs.)</span>
                </span>
                <button
                  onClick={() => setAmountFilter("all")}
                  className="text-[11px] text-[#1656DB] hover:underline font-bold"
                >
                  Quitar filtro
                </button>
              </div>
            )}
          </div>

          {/* Hint for mobile swipe */}
          <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 font-medium">
            <span>{sorted.length} movimiento(s)</span>
            <span className="hidden sm:inline">Tocar para ver opciones</span>
          </div>

          {/* Transactions List with Native Swipe Gestures */}
          {sorted.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-400">No se encontraron movimientos con los filtros aplicados.</p>
              <button
                onClick={() => {
                  triggerHaptic("light");
                  onAddNew();
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1656DB] px-5 py-2.5 text-xs font-black text-white hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-500/20"
              >
                + Cargar Movimiento
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {sorted.map((tx) => (
                <SwipeableTransactionItem
                  key={tx.id}
                  tx={tx}
                  currencySymbol={currencySymbol}
                  formatMoney={formatMoney}
                  getCategoryBadge={getCategoryBadge}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleAlPedo={onToggleAlPedo}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
