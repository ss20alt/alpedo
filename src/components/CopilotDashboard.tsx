"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  FinancialMetrics,
  Transaction,
} from "@/lib/finance-engine";
import {
  HelpCircle,
  ChevronRight,
  BookOpen,
  CreditCard,
  Flame,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Check,
  X,
  Zap,
  Share2,
  Gauge,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import FinanceIcon from "@/components/FinanceIcon";
import {
  formatParaguayMonthLabel,
  getParaguayDateString,
} from "@/lib/date-utils";

export interface MonthlyHistoryItem {
  month: string;
  total_expenses: number;
  total_income: number;
  al_pedo_expenses: number;
}

const monthLabels = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const monthFullNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface CopilotDashboardProps {
  userId: number;
  metrics: FinancialMetrics;
  transactions: Transaction[];
  monthlyHistory?: MonthlyHistoryItem[];
  recurringExpenses?: Transaction[];
  currencySymbol: string;
  selectedMonth: string;
  budgetAlPedoLimit: number;
  budgetVariableLimit: number;
  emergencyFundSaved: number;
  accountBank?: string;
  accountType?: string;
  accountLast4?: string;
  accountBaseBalance?: number;
  privacyMode?: boolean;
  onUpdateAccount?: (bank: string, type: string, last4: string, baseBalance: number) => Promise<void>;
  onSelectMonth?: (month: string) => void;
  onAddNew: () => void;
  onAddNewWithPreset?: (preset: { description: string; amount: number; category: "fijo" | "variable" | "pasivo" | "al_pedo"; isRecurring?: boolean }) => void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenCuero: () => void;
  onOpenTransactions: (filter?: string) => void;
  onOpenCategories: () => void;
  onStartTour?: () => void;
}

export default function CopilotDashboard({
  userId,
  metrics,
  transactions,
  monthlyHistory = [],
  recurringExpenses = [],
  currencySymbol,
  selectedMonth,
  budgetAlPedoLimit,
  budgetVariableLimit,
  accountBank = "",
  accountType = "",
  accountLast4 = "",
  accountBaseBalance = 0,
  privacyMode = false,
  onUpdateAccount,
  onSelectMonth,
  onAddNew,
  onAddNewWithPreset,
  onEditTransaction,
  onOpenCuero,
  onOpenTransactions,
  onOpenCategories,
  onStartTour,
}: CopilotDashboardProps) {

  // Persistence for reviewed status per month
  const [reviewed, setReviewed] = useState(false);
  const [timeframe, setTimeframe] = useState<"1W" | "1M" | "3M" | "YTD" | "1Y">("1M");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Edit Account Form State
  const [editBank, setEditBank] = useState(accountBank);
  const [editType, setEditType] = useState(accountType);
  const [editLast4, setEditLast4] = useState(accountLast4);
  const [editBaseBalance, setEditBaseBalance] = useState(String(accountBaseBalance || 0));
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem(`reviewed_month_${userId}_${selectedMonth}`);
      setReviewed(stored === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedMonth, userId]);

  const handleToggleReviewed = () => {
    const next = !reviewed;
    setReviewed(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(`reviewed_month_${userId}_${selectedMonth}`, next ? "true" : "false");
    }
  };

  const handleAddRecurring = () => {
    if (onAddNewWithPreset) {
      onAddNewWithPreset({
        description: "",
        amount: 0,
        category: "fijo",
        isRecurring: true,
      });
      return;
    }
    onAddNew();
  };

  const formatMoney = useCallback((val: number) => {
    if (privacyMode) return "••••••";
    return Math.round(val).toLocaleString("es-PY");
  }, [privacyMode]);


  // Calculations for Copilot hero card
  const leftToSpend = metrics.totalIncome - metrics.totalExpenses;
  const totalBudgeted = metrics.totalIncome;
  const isUnderBudget = metrics.netSavings >= 0;
  const [paraguayYear, paraguayMonth, paraguayDay] = getParaguayDateString().split("-").map(Number);

  // Transactions to review (first 3 recent expenses)
  const recentExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .slice(0, 3);
  }, [transactions]);

  // Dynamic Day-by-Day Spending Curve
  const { pathD, areaD, currentPoint, daysInMonth, dailyPoints, lastActiveDay, isCurrentMonth } = useMemo(() => {
    // Determine days in current selected month
    const parts = selectedMonth.split("-");
    const year = parseInt(parts[0], 10) || paraguayYear;
    const monthIndex = (parseInt(parts[1], 10) || paraguayMonth) - 1;
    const numDays = new Date(year, monthIndex + 1, 0).getDate();
    const chartMonthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

    // Map daily expenses
    const dayExpenses: Record<number, number> = {};
    for (let d = 1; d <= numDays; d++) dayExpenses[d] = 0;

    transactions.forEach((tx) => {
      if (tx.type === "expense" && tx.date) {
        const txMonth = tx.date.slice(0, 7);
        if (txMonth !== chartMonthKey) return;
        const txDay = parseInt(tx.date.split("-")[2], 10);
        if (txDay >= 1 && txDay <= numDays) {
          dayExpenses[txDay] = (dayExpenses[txDay] || 0) + tx.amount;
        }
      }
    });

    // Find the latest day with transactions or today's day if current month
    const isCurrentMonth = paraguayYear === year && paraguayMonth - 1 === monthIndex;
    const todayDay = paraguayDay;
    
    let maxTxDay = 1;
    for (let d = 1; d <= numDays; d++) {
      if (dayExpenses[d] > 0) maxTxDay = d;
    }
    const activeDay = isCurrentMonth ? Math.min(numDays, Math.max(todayDay, maxTxDay)) : maxTxDay;

    // Build SVG coordinates
    // SVG viewBox: 0 0 400 130. usable X: 25 to 375, usable Y: 25 to 110
    const points: Array<{ x: number; y: number; day: number; cumulative: number; dailyTotal: number }> = [];
    const allPoints: Array<{ x: number; y: number; day: number; cumulative: number; dailyTotal: number }> = [];
    let cum = 0;

    for (let d = 1; d <= numDays; d++) {
      cum += dayExpenses[d] || 0;
      const x = 25 + ((d - 1) / Math.max(1, numDays - 1)) * 350;
      // Y: when cum = 0, y = 105. When cum = totalBudgeted, y = 40.
      const ratio = totalBudgeted > 0 ? cum / totalBudgeted : 0;
      // Invert so higher spending moves the line upward
      const y = Math.max(30, Math.min(115, 108 - ratio * 72));
      const point = { x, y, day: d, cumulative: cum, dailyTotal: dayExpenses[d] || 0 };
      allPoints.push(point);
      if (d <= activeDay) points.push(point);
    }

    if (points.length === 0) {
      points.push({ x: 25, y: 108, day: 1, cumulative: 0, dailyTotal: 0 });
    }

    // Build smooth cubic bezier SVG path
    let pD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      pD += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const last = points[points.length - 1];
    const aD = `${pD} L ${last.x} 128 L ${points[0].x} 128 Z`;

    return {
      pathD: pD,
      areaD: aD,
      currentPoint: last,
      daysInMonth: numDays,
      dailyPoints: allPoints,
      lastActiveDay: activeDay,
      isCurrentMonth,
    };
  }, [transactions, selectedMonth, totalBudgeted, paraguayYear, paraguayMonth, paraguayDay]);

  const [selectedChartDay, setSelectedChartDay] = useState<number | null>(null);
  const selectedPoint = selectedChartDay === null
    ? null
    : dailyPoints.find((point) => point.day === selectedChartDay) ?? null;
  const chartPoint = selectedPoint ?? currentPoint;
  const selectedDayIsFuture = Boolean(selectedPoint && isCurrentMonth && selectedPoint.day > lastActiveDay);
  const monthShortNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const selectedMonthIndex = selectedMonth === "all" ? paraguayMonth - 1 : Number(selectedMonth.split("-")[1]) - 1;
  const selectedDateLabel = `${chartPoint.day} ${monthShortNames[Math.max(0, Math.min(11, selectedMonthIndex))]}`;
  const chartDateTicks = Array.from(new Set([
    1,
    Math.round((daysInMonth - 1) * 0.25) + 1,
    Math.round((daysInMonth - 1) * 0.5) + 1,
    Math.round((daysInMonth - 1) * 0.75) + 1,
    daysInMonth,
  ]));

  const selectChartDayAt = (clientX: number, rect: DOMRect) => {
    if (!rect.width || daysInMonth <= 0) return;
    const relativeX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dataX = 25 + relativeX * 350;
    const day = Math.max(1, Math.min(daysInMonth, Math.round(((dataX - 25) / 350) * (daysInMonth - 1) + 1)));
    setSelectedChartDay(day);
  };

  // 12-Month Bar Chart Data (Image 2 style)
  const currentYear = useMemo(() => {
    return selectedMonth && selectedMonth !== "all"
      ? selectedMonth.substring(0, 4)
      : String(paraguayYear);
  }, [selectedMonth, paraguayYear]);

  const { monthsData, totalSpentThisYear, avgMonthlySpent, maxMonthVal } = useMemo(() => {
    const historyMap = new Map<string, MonthlyHistoryItem>();
    monthlyHistory.forEach((h) => {
      historyMap.set(h.month, h);
    });

    const data = monthLabels.map((lbl, idx) => {
      const monthKey = `${currentYear}-${String(idx + 1).padStart(2, "0")}`;
      const item = historyMap.get(monthKey);
      
      let val = item ? Number(item.total_expenses) : 0;
      let alPedo = item ? Number(item.al_pedo_expenses) : 0;

      // If viewing current month, ensure metrics.totalExpenses is synchronized
      if (selectedMonth === monthKey && metrics.totalExpenses > 0) {
        val = metrics.totalExpenses;
        alPedo = metrics.expenses.al_pedo;
      }

      const isActive = selectedMonth === monthKey;
      const isOver = val > totalBudgeted * 0.85;

      return {
        label: lbl,
        fullName: monthFullNames[idx],
        monthKey,
        val,
        alPedo,
        active: isActive,
        over: isOver,
        hasData: val > 0,
      };
    });

    const monthsWithData = data.filter((month) => month.val > 0).length;
    const totalYear = data.reduce((total, month) => total + month.val, 0);
    const maxVal = Math.max(...data.map((m) => m.val), totalBudgeted, 1000000);
    const avg = monthsWithData > 0 ? Math.round(totalYear / monthsWithData) : 0;

    return {
      monthsData: data,
      totalSpentThisYear: totalYear,
      avgMonthlySpent: avg,
      maxMonthVal: maxVal,
    };
  }, [monthlyHistory, currentYear, selectedMonth, metrics, totalBudgeted]);

  // Subcategory Breakdown for Dynamic Ring Gauges
  const subcategoryTotals = useMemo(() => {
    let transport = 0;
    let health = 0;
    let services = 0;

    transactions.forEach((tx) => {
      if (tx.type === "expense") {
        const desc = tx.description.toLowerCase();
        if (/transporte|combustible|nafta|bolt|uber|pasaje|jaha|estacionamiento/.test(desc)) {
          transport += tx.amount;
        } else if (/farmacia|salud|medico|remedio|clinica|sanatorio|dentista/.test(desc)) {
          health += tx.amount;
        } else if (/internet|abono|celular|spotify|netflix|ande|essap|luz|agua/.test(desc)) {
          services += tx.amount;
        }
      }
    });

    return {
      transport,
      health,
      services,
    };
  }, [transactions]);

  // Timeframe Net Flow Calculations (Patrimonio & Cuentas)
  const { timeframeNetSavings, timeframeMargin, timeframeLabel } = useMemo(() => {
    const activeMonth = selectedMonth === "all"
      ? `${paraguayYear}-${String(paraguayMonth).padStart(2, "0")}`
      : selectedMonth;
    const monthParts = activeMonth.split("-").map(Number);
    const selectedYear = monthParts[0] || paraguayYear;
    const selectedMonthIndex = (monthParts[1] || paraguayMonth) - 1;
    const isCurrentMonth = selectedYear === paraguayYear && selectedMonthIndex === paraguayMonth - 1;
    const selectedMonthEndDay = isCurrentMonth
      ? paraguayDay
      : new Date(Date.UTC(selectedYear, selectedMonthIndex + 1, 0)).getUTCDate();
    const selectedMonthEnd = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, "0")}-${String(selectedMonthEndDay).padStart(2, "0")}`;
    const trailingMonthStart = (monthsBack: number) => {
      const date = new Date(Date.UTC(selectedYear, selectedMonthIndex - monthsBack, 1));
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    };

    if (timeframe === "1W") {
      // Last 7 days within the selected month (or through today for the current month).
      const endDate = new Date(`${selectedMonthEnd}T00:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() - 6);
      const sevenDaysStr = endDate.toISOString().slice(0, 10);
      
      let inc = 0;
      let exp = 0;
      transactions.forEach((t) => {
        if (t.date >= sevenDaysStr && t.date <= selectedMonthEnd) {
          if (t.type === "income") inc += t.amount;
          if (t.type === "expense") exp += t.amount;
        }
      });
      const net = inc - exp;
      const margin = inc > 0 ? (net / inc) * 100 : 0;
      return { timeframeNetSavings: net, timeframeMargin: margin, timeframeLabel: "7 días" };
    }

    if (timeframe === "1M") {
      return {
        timeframeNetSavings: metrics.netSavings,
        timeframeMargin: metrics.savingsRate,
        timeframeLabel: "este mes",
      };
    }

    if (timeframe === "3M") {
      const startMonth = trailingMonthStart(2);
      const recent3 = monthlyHistory.filter((h) => h.month >= startMonth && h.month <= activeMonth);
      const inc = recent3.reduce((acc, h) => acc + Number(h.total_income || 0), 0);
      const exp = recent3.reduce((acc, h) => acc + Number(h.total_expenses || 0), 0);
      const net = inc - exp;
      const margin = inc > 0 ? (net / inc) * 100 : 0;
      return { timeframeNetSavings: net, timeframeMargin: margin, timeframeLabel: "en 3 meses" };
    }

    if (timeframe === "YTD" || timeframe === "1Y") {
      const startMonth = timeframe === "YTD" ? `${selectedYear}-01` : trailingMonthStart(11);
      const periodHistory = monthlyHistory.filter((h) => h.month >= startMonth && h.month <= activeMonth);
      const inc = periodHistory.reduce((acc, h) => acc + Number(h.total_income || 0), 0);
      const exp = periodHistory.reduce((acc, h) => acc + Number(h.total_expenses || 0), 0);
      const net = inc - exp;
      const margin = inc > 0 ? (net / inc) * 100 : 0;
      return {
        timeframeNetSavings: net,
        timeframeMargin: margin,
        timeframeLabel: timeframe === "YTD" ? "este año" : "12 meses",
      };
    }

    return { timeframeNetSavings: metrics.netSavings, timeframeMargin: metrics.savingsRate, timeframeLabel: "este mes" };
  }, [timeframe, transactions, metrics, monthlyHistory, selectedMonth, paraguayYear, paraguayMonth, paraguayDay]);

  const estimatedNetWorth = accountBaseBalance || 0;

  // Registered recurring expenses; dates alone do not confirm payment.
  const upcomingBills = useMemo(() => {
    const today = Number(getParaguayDateString().split("-")[2]);
    return recurringExpenses
      .filter((t) => t.type === "expense")
      .map((t) => {
        const day = parseInt(t.date.split("-")[2], 10) || 1;
        const daysLeft = day - today;
        let status = "";
        let isPast = false;

        if (daysLeft === 0) {
          status = "Día registrado: hoy";
        } else if (daysLeft > 0) {
          status = `Día registrado: ${day}`;
        } else {
          status = `Día registrado: ${day}`;
          isPast = true;
        }

        return {
          ...t,
          dueDay: day,
          daysLeft,
          status,
          isPast,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [recurringExpenses]);

  // Handle Save Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateAccount) return;
    try {
      setIsSavingAccount(true);
      await onUpdateAccount(
        editBank.trim() || "BANCO ITAÚ",
        editType.trim() || "Caja de Ahorro Principal",
        editLast4.trim() || "4291",
        parseFloat(editBaseBalance) || 0
      );
      setShowAccountModal(false);
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Spending Pace / Velocity Calculation (e.g. YNAB / Copilot / Spendee)
  const spendingPace = useMemo(() => {
    const parts = selectedMonth.split("-");
    const year = parseInt(parts[0], 10) || paraguayYear;
    const monthIndex = (parseInt(parts[1], 10) || paraguayMonth) - 1;
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();

    const isCurrent = paraguayYear === year && paraguayMonth - 1 === monthIndex;
    const currentDay = isCurrent ? Math.min(totalDays, Math.max(1, paraguayDay)) : totalDays;

    const monthElapsedPercent = Math.round((currentDay / totalDays) * 100);
    const budgetTotal = totalBudgeted;
    const hasBudgetBaseline = budgetTotal > 0;
    const budgetSpentPercent = hasBudgetBaseline
      ? Math.min(100, Math.round((metrics.totalExpenses / budgetTotal) * 100))
      : null;

    // Ideal spending target for today
    const idealSpentToday = (budgetTotal / totalDays) * currentDay;
    const diff = metrics.totalExpenses - idealSpentToday;

    // Projected month-end savings based on current daily burn rate
    const dailyBurnRate = currentDay > 0 ? metrics.totalExpenses / currentDay : 0;
    const projectedTotalExpense = dailyBurnRate * totalDays;
    const projectedSavings = metrics.totalIncome - projectedTotalExpense;

    let status: "optimo" | "al_limite" | "acelerado";
    let message = "";

    if (!hasBudgetBaseline) {
      status = "al_limite";
      message = "Registrá tus ingresos para comparar tus gastos con un presupuesto.";
    } else if (diff < -50000) {
      status = "optimo";
      message = `Vas ${currencySymbol} ${formatMoney(Math.abs(diff))} por debajo de lo previsto.`;
    } else if (diff <= 50000) {
      status = "al_limite";
      message = "Vas al ritmo previsto para este día del mes.";
    } else {
      status = "acelerado";
      message = `Gastaste ${currencySymbol} ${formatMoney(diff)} más de lo previsto para hoy.`;
    }

    return {
      currentDay,
      totalDays,
      monthElapsedPercent,
      budgetSpentPercent,
      hasBudgetBaseline,
      diff,
      projectedSavings,
      dailyBurnRate,
      status,
      message,
    };
  }, [selectedMonth, metrics, totalBudgeted, currencySymbol, paraguayYear, paraguayMonth, paraguayDay, formatMoney]);

  const handleShareScorecard = async () => {
    triggerHaptic("medium");
    const monthName = selectedMonth === "all" ? "Histórico Total" : formatParaguayMonthLabel(selectedMonth);
    const text = `Mi cierre financiero (${monthName}) · alpedo.app\n` +
      `Ingresos: ${currencySymbol} ${formatMoney(metrics.totalIncome)}\n` +
      `Gastos totales: ${currencySymbol} ${formatMoney(metrics.totalExpenses)}\n` +
      `Ahorro neto: ${currencySymbol} ${formatMoney(metrics.netSavings)}\n` +
      `Gastos Al Pedo: ${currencySymbol} ${formatMoney(metrics.expenses.al_pedo)}\n` +
      `${metrics.totalIncome > 0 ? `Indicador del mes: ${metrics.health.score}/100` : "Indicador del mes: sin datos"}\n` +
      `Controlando mis finanzas con alpedo.app`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Mi Resumen Financiero en alpedo.app",
          text,
        });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 3000);
    }
  };

  return (
      <div className="space-y-4 pb-8 sm:space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
      <div className="xl:col-span-8">
      {/* 1. COPILOT HERO CARD: "₲ 287.000 restante de ₲ 1.095.000 presupuestado este mes" (Reference Image 1) */}
      <div id="tour-hero-card" className="app-mobile-surface relative rounded-[26px] sm:rounded-[32px] bg-white p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100/90 overflow-hidden">

        {/* Top Info Header */}
        <div className="flex items-start justify-between">
          <div className="w-full text-center">
            <h2 className="flex min-w-0 flex-col items-center justify-center gap-0.5 pr-4 pl-4 text-slate-900 sm:flex-row sm:items-baseline sm:gap-2">
              <span className="max-w-full break-all text-[clamp(1.45rem,7.7vw,1.875rem)] font-extrabold tracking-tight sm:text-4xl">{currencySymbol} {formatMoney(leftToSpend)}</span>
              <span className="text-sm font-bold text-slate-600 sm:text-2xl">balance del mes</span>
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-1">
              Ingresos registrados: {currencySymbol} {formatMoney(totalBudgeted)}
            </p>
          </div>
          <button
            onClick={() => setShowInfoModal(true)}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition active:scale-95"
            aria-label="Cómo se calcula el balance del mes"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] font-semibold text-slate-600" aria-label="Leyenda del gráfico">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-emerald-500" />Gasto real</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-3 border-t border-dashed border-slate-400" />Ritmo ideal</span>
        </div>

        {/* Gasto acumulado frente al ritmo ideal */}
        <div className="relative mt-1 h-32 w-full sm:h-40">
          {/* Daily spend tooltip; the monthly cumulative remains the default view. */}
          <div
            className="absolute z-10 flex max-w-[calc(100%-12px)] flex-col items-center pointer-events-none transition-[left,top] duration-150"
            style={{
              left: selectedPoint ? "50%" : `${(currentPoint.x / 400) * 100}%`,
              top: selectedPoint ? "0%" : `${(currentPoint.y / 150) * 100}%`,
              transform: selectedPoint ? "translate(-50%, 0)" : "translate(-50%, -100%)",
            }}
          >
            {selectedPoint ? (
              <div className={`rounded-xl px-3 py-1.5 text-center text-white shadow-md ${isUnderBudget ? "bg-emerald-600 shadow-emerald-600/20" : "bg-red-600 shadow-red-600/20"}`}>
                <p className="text-[9px] font-bold uppercase tracking-wide text-white/80">{selectedDateLabel}{selectedDayIsFuture ? " · Próximo" : " · Gasto del día"}</p>
                <p className="text-[11px] font-extrabold leading-tight">
                  {selectedDayIsFuture ? "Ese día todavía no llegó" : `${currencySymbol} ${formatMoney(chartPoint.dailyTotal)} gastado`}
                </p>
                {!selectedDayIsFuture && <p className="text-[9px] font-semibold text-white/80">Acumulado: {currencySymbol} {formatMoney(chartPoint.cumulative)}</p>}
              </div>
            ) : (
              <>
                <div className={`rounded-full px-3 py-1 text-[11px] font-extrabold shadow-md ${isUnderBudget ? "bg-emerald-500 text-white shadow-emerald-500/25" : "bg-red-500 text-white shadow-red-500/25"}`}>
                  <span>{currencySymbol} {formatMoney(currentPoint.cumulative)} gastado</span>
                </div>
                <div className={`h-2.5 w-0.5 ${isUnderBudget ? "bg-emerald-500" : "bg-red-500"}`} />
                <div className={`h-3 w-3 rounded-full border-2 border-white shadow-sm ring-2 ${isUnderBudget ? "bg-emerald-500 ring-emerald-200" : "bg-red-500 ring-red-200"}`} />
              </>
            )}
          </div>

          <svg
            className="h-full w-full overflow-visible rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-crosshair touch-pan-y"
            viewBox="0 0 400 150"
            preserveAspectRatio="none"
            role="group"
            tabIndex={0}
            aria-label="Gráfica interactiva de gastos diarios"
            aria-describedby="daily-spending-chart-hint"
            onPointerDown={(event) => selectChartDayAt(event.clientX, event.currentTarget.getBoundingClientRect())}
            onPointerMove={(event) => {
              if (event.pointerType === "mouse") selectChartDayAt(event.clientX, event.currentTarget.getBoundingClientRect());
            }}
            onKeyDown={(event) => {
              const currentDay = selectedChartDay ?? currentPoint.day;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setSelectedChartDay(Math.max(1, currentDay - 1));
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setSelectedChartDay(Math.min(daysInMonth, currentDay + 1));
              } else if (event.key === "Home") {
                event.preventDefault();
                setSelectedChartDay(1);
              } else if (event.key === "End") {
                event.preventDefault();
                setSelectedChartDay(daysInMonth);
              }
            }}
          >
            <defs>
              <linearGradient id="copilotGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isUnderBudget ? "#22C55E" : "#EF4444"}
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor={isUnderBudget ? "#22C55E" : "#EF4444"}
                  stopOpacity="0.0"
                />
              </linearGradient>
            </defs>

            {/* Transparent hit area so a tap anywhere in the plot selects that date. */}
            <rect x="0" y="0" width="400" height="150" fill="transparent" pointerEvents="all" />

            {/* Dotted budget trajectory line */}
            <path
              d="M 25 108 Q 180 75 375 35"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="2.5"
              strokeDasharray="6,6"
            />

            {/* Area gradient under actual trend */}
            <path d={areaD} fill="url(#copilotGradient)" />

            {/* Actual spending pace curve (green line) */}
            <path
              d={pathD}
              fill="none"
              stroke={isUnderBudget ? "#22C55E" : "#EF4444"}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {selectedPoint && !selectedDayIsFuture && (
              <>
                <line x1={chartPoint.x} x2={chartPoint.x} y1={chartPoint.y} y2="128" stroke="#0F172A" strokeOpacity="0.25" strokeDasharray="3 3" />
                <circle cx={chartPoint.x} cy={chartPoint.y} r="5.5" fill={isUnderBudget ? "#059669" : "#DC2626"} stroke="white" strokeWidth="2.5" />
              </>
            )}

            {chartDateTicks.map((day) => {
              const x = 25 + ((day - 1) / Math.max(1, daysInMonth - 1)) * 350;
              return (
                <g key={day} aria-hidden="true">
                  <line x1={x} x2={x} y1="130" y2="134" stroke="#CBD5E1" strokeWidth="1" />
                  <text x={x} y="146" textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">{day}</text>
                </g>
              );
            })}
          </svg>
          <p id="daily-spending-chart-hint" className="sr-only">Seleccioná una fecha para ver cuánto gastaste ese día. También podés usar las flechas del teclado para cambiar de día.</p>
        </div>
        {!selectedPoint && (
          <p className="-mt-1 text-center text-[9px] font-medium text-slate-400">
            <span className="md:hidden">Tocá la gráfica para ver cuánto gastaste cada día</span>
            <span className="hidden md:inline">Seleccioná una fecha de la gráfica para ver cuánto gastaste ese día</span>
          </p>
        )}

        {/* Quick Health Summary Pill Tags (Image 1 footer) */}
        <div className="mt-3 grid grid-cols-3 gap-1 border-t border-slate-100 pt-3 text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <span
              className={`flex h-2 w-2 rounded-full ${
                metrics.totalIncome <= 0
                  ? "bg-slate-300"
                  : metrics.health.score >= 80
                  ? "bg-emerald-500"
                  : metrics.health.score >= 50
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            />
            <span>
              Indicador:{" "}
              <strong
                className={
                  metrics.totalIncome <= 0
                    ? "text-slate-500"
                    : metrics.health.score >= 80
                    ? "text-emerald-600"
                    : metrics.health.score >= 50
                    ? "text-amber-600"
                    : "text-red-600"
                }
              >
                {metrics.totalIncome > 0 ? `${metrics.health.score}/100` : "Sin datos"}
              </strong>
            </span>
          </div>
          <div className="text-center text-slate-600 font-semibold">
            Fijos:{" "}
            <strong className="text-slate-700">
              {metrics.totalIncome > 0 ? `${metrics.fixedExpenseRatio.toFixed(1)}%` : "Sin datos"}
            </strong>
          </div>
          <div className="text-right text-slate-600 font-semibold">
            Margen:{" "}
            <strong
              className={
                metrics.totalIncome <= 0
                  ? "text-slate-500"
                  : metrics.savingsRate >= 0 ? "text-emerald-600" : "text-red-600"
              }
            >
              {metrics.totalIncome > 0
                ? `${metrics.savingsRate >= 0 ? "+" : ""}${metrics.savingsRate.toFixed(1)}%`
                : "Sin datos"}
            </strong>
          </div>
        </div>
      </div>
      </div>

      {/* 1.25 SPENDING PACE GAUGE & QUICK SHARING (Copilot & YNAB Benchmark) */}
      <div className="xl:col-span-4 xl:flex xl:items-center">
      <div id="tour-spending-pace" className="app-mobile-surface rounded-[28px] bg-white p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100 xl:flex xl:flex-col xl:justify-center">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-sm font-bold ${
              spendingPace.status === "optimo"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : spendingPace.status === "al_limite"
                ? "bg-amber-50 text-amber-600 border border-amber-200"
                : "bg-rose-50 text-rose-600 border border-rose-200"
            }`}>
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight">
                Ritmo del mes
              </h3>
              <p className="text-[11px] text-slate-600 font-semibold">
                Día {spendingPace.currentDay} de {spendingPace.totalDays} ({spendingPace.monthElapsedPercent}% del mes)
              </p>
            </div>
          </div>

          {/* Diagnosis Badge */}
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
            spendingPace.status === "optimo"
              ? "bg-emerald-100 text-emerald-800"
              : spendingPace.status === "al_limite"
              ? "bg-amber-100 text-amber-800"
              : "bg-rose-100 text-rose-800"
          }`}>
            <span aria-hidden="true" className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${spendingPace.status === "optimo" ? "bg-emerald-500" : spendingPace.status === "al_limite" ? "bg-amber-500" : "bg-rose-500"}`} />
            {!spendingPace.hasBudgetBaseline ? "Sin ingresos" : spendingPace.status === "optimo" ? "Dentro del ritmo" : spendingPace.status === "al_limite" ? "Cerca del límite" : "Por encima del ritmo"}
          </span>
        </div>

        {/* Dual Progress Bars: Time Elapsed vs Budget Consumed */}
        <div className="space-y-2 mb-3">
          <div>
            <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
              <span>Mes transcurrido</span>
              <span className="font-mono text-slate-600">{spendingPace.monthElapsedPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-slate-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, spendingPace.monthElapsedPercent)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
              <span>Presupuesto consumido</span>
              <span className={`font-mono font-black ${
                spendingPace.budgetSpentPercent !== null && spendingPace.budgetSpentPercent > spendingPace.monthElapsedPercent
                  ? "text-rose-600"
                  : spendingPace.budgetSpentPercent === null
                  ? "text-slate-500"
                  : "text-emerald-600"
              }`}>
                {spendingPace.budgetSpentPercent === null ? "Sin datos" : `${spendingPace.budgetSpentPercent}%`}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  spendingPace.status === "optimo"
                    ? "bg-emerald-500"
                    : spendingPace.status === "al_limite"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${spendingPace.budgetSpentPercent ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 font-medium mb-3 leading-snug">
          {spendingPace.message}
        </p>

      </div>
      </div>
      </div>

      {/* 1.5 NATIVE MOBILE SPEED DIAL: 1-Tap Daily Paraguayan Spends Carousel */}
      <div id="tour-quick-spend" className="space-y-1.5">

        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span>Gasto Rápido 1-Toque</span>
          </h3>
          <span className="text-[10px] text-slate-400 font-bold">Frecuentes PY</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5 select-none lg:grid lg:grid-cols-6 lg:gap-3">
          <button
            onClick={() => {
              triggerHaptic("medium");
              if (onAddNewWithPreset) {
                onAddNewWithPreset({ description: "Bolt", amount: 25000, category: "variable" });
              } else {
                onAddNew();
              }
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200/80 px-3.5 py-2.5 shadow-sm hover:border-blue-400 hover:shadow-md transition active:scale-95 shrink-0 group"
          >
            <FinanceIcon name="car" className="h-4 w-4 text-slate-600 transition-transform group-hover:scale-110" />
            <div className="text-left">
              <div className="text-xs font-black text-slate-900 leading-none">Bolt</div>
              <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{currencySymbol} 25.000</div>
            </div>
          </button>

          <button
            onClick={() => {
              triggerHaptic("medium");
              if (onAddNewWithPreset) {
                onAddNewWithPreset({ description: "Biggie Express", amount: 45000, category: "variable" });
              } else {
                onAddNew();
              }
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200/80 px-3.5 py-2.5 shadow-sm hover:border-emerald-400 hover:shadow-md transition active:scale-95 shrink-0 group"
          >
            <FinanceIcon name="cart" className="h-4 w-4 text-slate-600 transition-transform group-hover:scale-110" />
            <div className="text-left">
              <div className="text-xs font-black text-slate-900 leading-none">Biggie</div>
              <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{currencySymbol} 45.000</div>
            </div>
          </button>

          <button
            onClick={() => {
              triggerHaptic("medium");
              if (onAddNewWithPreset) {
                onAddNewWithPreset({ description: "Lomito / Cena", amount: 30000, category: "al_pedo" });
              } else {
                onAddNew();
              }
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-orange-200/80 bg-orange-50/20 px-3.5 py-2.5 shadow-sm hover:border-orange-400 hover:shadow-md transition active:scale-95 shrink-0 group"
          >
            <FinanceIcon name="utensils" className="h-4 w-4 text-orange-600 transition-transform group-hover:scale-110" />
            <div className="text-left">
              <div className="text-xs font-black text-orange-950 leading-none flex items-center gap-1">
                Lomito
                <Flame className="h-3 w-3 text-orange-500" />
              </div>
              <div className="text-[10px] font-mono font-bold text-orange-600/80 mt-0.5">{currencySymbol} 30.000</div>
            </div>
          </button>

          <button
            onClick={() => {
              triggerHaptic("medium");
              if (onAddNewWithPreset) {
                onAddNewWithPreset({ description: "Café / Meriendas", amount: 15000, category: "variable" });
              } else {
                onAddNew();
              }
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200/80 px-3.5 py-2.5 shadow-sm hover:border-amber-400 hover:shadow-md transition active:scale-95 shrink-0 group"
          >
            <FinanceIcon name="coffee" className="h-4 w-4 text-amber-700 transition-transform group-hover:scale-110" />
            <div className="text-left">
              <div className="text-xs font-black text-slate-900 leading-none">Café</div>
              <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{currencySymbol} 15.000</div>
            </div>
          </button>

          <button
            onClick={() => {
              triggerHaptic("medium");
              if (onAddNewWithPreset) {
                onAddNewWithPreset({ description: "Combustible / Nafta", amount: 100000, category: "variable" });
              } else {
                onAddNew();
              }
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200/80 px-3.5 py-2.5 shadow-sm hover:border-blue-400 hover:shadow-md transition active:scale-95 shrink-0 group"
          >
            <FinanceIcon name="fuel" className="h-4 w-4 text-slate-600 transition-transform group-hover:scale-110" />
            <div className="text-left">
              <div className="text-xs font-black text-slate-900 leading-none">Nafta</div>
              <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{currencySymbol} 100.000</div>
            </div>
          </button>

          <button
            onClick={() => {
              triggerHaptic("medium");
              if (onAddNewWithPreset) {
                onAddNewWithPreset({ description: "Capricho", amount: 0, category: "al_pedo" });
              } else {
                onAddNew();
              }
            }}
            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-orange-600 text-white px-3.5 py-2.5 shadow-sm hover:bg-orange-700 transition active:scale-95 shrink-0 group"
          >
            <Flame className="h-4 w-4" />
            <div className="text-left">
              <div className="text-xs font-black leading-none">¡Al Pedo!</div>
              <div className="text-[10px] font-bold text-white/80 mt-0.5">Cargar directo</div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. COPILOT "TO REVIEW" CARD: Recent Transactions to review */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase">
            PARA REVISAR
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleShareScorecard}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg px-1 text-[11px] font-bold text-slate-500 hover:text-blue-700 active:text-blue-800 transition"
              aria-label={copiedShare ? "Resumen copiado" : "Compartir resumen del mes"}
            >
              {copiedShare ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5 text-emerald-600" />}
              <span>{copiedShare ? "Copiado" : "Compartir"}</span>
            </button>
            <button
              onClick={() => onOpenTransactions()}
              className="flex min-h-10 items-center gap-0.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition"
            >
              <span>Ver todos</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className={`app-mobile-surface rounded-[24px] bg-white p-4 sm:p-5 shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-slate-100 ${recentExpenses.length === 0 ? "lg:flex lg:items-center lg:gap-6" : ""}`}>
          <p className={`text-center text-[11px] font-bold text-slate-400 mb-3 tracking-tight ${recentExpenses.length === 0 ? "lg:mb-0 lg:shrink-0 lg:text-left" : ""}`}>
            Hoy hasta ahora
          </p>

          {recentExpenses.length === 0 ? (
            <div className={`py-5 text-center text-xs text-slate-400 ${recentExpenses.length === 0 ? "lg:flex-1 lg:py-0 lg:text-left" : ""}`}>
              No hay movimientos pendientes de revisión.
            </div>
          ) : (
            <div className="space-y-3">
              {recentExpenses.map((tx) => {
                const initial = tx.description.charAt(0).toUpperCase() || "M";
                const isAlPedo = tx.category === "al_pedo";
                const isFixed = tx.category === "fijo";
                return (
                  <div
                    key={tx.id}
                    onClick={() => onEditTransaction(tx)}
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-50/80 p-2 rounded-xl transition active:scale-[0.99]"
                    title="Seleccionar para editar o cambiar categoría"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 font-black text-slate-700 text-xs shadow-sm">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                          {tx.description}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tx.date}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          isAlPedo
                            ? "bg-red-50 text-red-600 border border-red-200/60"
                            : "bg-blue-50 text-blue-600 border border-blue-200/60"
                        }`}
                      >
                        <><FinanceIcon name={isAlPedo ? "flame" : isFixed ? "home" : "briefcase"} className="mr-1 h-3 w-3" />{isAlPedo ? "AL PEDO" : isFixed ? "FIJO" : "VARIABLE"}</>
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {currencySymbol} {formatMoney(tx.amount)}
                        </span>
                        {!reviewed && (
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`mt-4 pt-3 border-t border-slate-100 ${recentExpenses.length === 0 ? "lg:hidden" : ""}`}>
            <button
              onClick={handleToggleReviewed}
              disabled={recentExpenses.length === 0}
              aria-label={recentExpenses.length === 0 ? "No hay movimientos para revisar" : undefined}
              className={`w-full py-3 rounded-full text-xs font-black tracking-wide transition active:scale-[0.98] ${
                recentExpenses.length === 0
                  ? "cursor-not-allowed bg-slate-50 text-slate-400"
                  : reviewed
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                  : "bg-[#EEF4FF] text-[#1D64E5] hover:bg-blue-100"
              }`}
            >
              {recentExpenses.length === 0
                ? "SIN MOVIMIENTOS PARA REVISAR"
                : reviewed ? "✓ TODOS REVISADOS (Seleccionar para desmarcar)" : "MARCAR COMO REVISADO"}
            </button>
          </div>
        </div>
      </div>

      {/* 3. COPILOT "BUDGETS" SECTION: Dynamic Circular Progress Gauges with Emojis */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase">
            PRESUPUESTOS
          </h3>
          <button
            onClick={onOpenCategories}
            className="flex items-center gap-0.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition"
          >
            <span>Comercios & Rubros</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Horizontal scrolling ring gauges */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-1 lg:justify-around">
          {/* Ring 1: Gastos Superfluos (Al Pedo) */}
          <button
            type="button"
            onClick={() => onOpenTransactions("al_pedo")}
            aria-label="Ver movimientos de gastos Al Pedo"
            className="flex flex-col items-center shrink-0 w-20 text-center cursor-pointer group active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
            title="Filtrar gastos Al Pedo"
          >
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" stroke="#FEE2E2" strokeWidth="4" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="#EF4444"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="125"
                  strokeDashoffset={Math.max(
                    0,
                    125 - 125 * (metrics.expenses.al_pedo / Math.max(1, budgetAlPedoLimit))
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <FinanceIcon name="shopping" className="absolute h-5 w-5 text-red-500 transition-transform group-hover:scale-110" />
            </div>
            <span className="text-xs font-extrabold text-slate-900 mt-2">
              {currencySymbol} {formatMoney(metrics.expenses.al_pedo)}
            </span>
            <span
              className={`text-[10px] font-bold ${
                metrics.expenses.al_pedo > budgetAlPedoLimit
                  ? "text-red-500"
                  : "text-slate-400"
              }`}
            >
              {metrics.expenses.al_pedo > budgetAlPedoLimit ? "excedido" : "gastado"}
            </span>
          </button>

          {/* Ring 2: Gastos Fijos (Casa / Alquiler) */}
          <button
            type="button"
            onClick={() => onOpenTransactions("fijo")}
            aria-label="Ver movimientos de gastos fijos"
            className="flex flex-col items-center shrink-0 w-20 text-center cursor-pointer group active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
            title="Filtrar gastos fijos"
          >
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" stroke="#E0E7FF" strokeWidth="4" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="#4F46E5"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="125"
                  strokeDashoffset={Math.max(
                    0,
                    125 - 125 * (metrics.expenses.fijo / Math.max(1, totalBudgeted * 0.4))
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <FinanceIcon name="home" className="absolute h-5 w-5 text-indigo-600 transition-transform group-hover:scale-110" />
            </div>
            <span className="text-xs font-extrabold text-slate-900 mt-2">
              {currencySymbol} {formatMoney(metrics.expenses.fijo)}
            </span>
            <span className="text-[10px] font-bold text-slate-400">gastado</span>
          </button>

          {/* Ring 3: Gastos Variables (Comida & Super) */}
          <button
            type="button"
            onClick={() => onOpenTransactions("variable")}
            aria-label="Ver movimientos de gastos variables"
            className="flex flex-col items-center shrink-0 w-20 text-center cursor-pointer group active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
            title="Filtrar gastos variables"
          >
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" stroke="#FEF3C7" strokeWidth="4" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="#F59E0B"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="125"
                  strokeDashoffset={Math.max(
                    0,
                    125 - 125 * (metrics.expenses.variable / Math.max(1, budgetVariableLimit))
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <FinanceIcon name="utensils" className="absolute h-5 w-5 text-amber-600 transition-transform group-hover:scale-110" />
            </div>
            <span className="text-xs font-extrabold text-slate-900 mt-2">
              {currencySymbol} {formatMoney(metrics.expenses.variable)}
            </span>
            <span className="text-[10px] font-bold text-slate-400">gastado</span>
          </button>

          {/* Ring 4: Transporte & Nafta (Dynamic) */}
          <div className="flex flex-col items-center shrink-0 w-20 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" stroke="#DCFCE7" strokeWidth="4" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="#10B981"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="125"
                  strokeDashoffset={Math.max(0, 125 - 125 * (subcategoryTotals.transport / 300000))}
                  strokeLinecap="round"
                />
              </svg>
              <FinanceIcon name="car" className="absolute h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-xs font-extrabold text-slate-900 mt-2">
              {currencySymbol} {formatMoney(subcategoryTotals.transport)}
            </span>
            <span className="text-[10px] font-bold text-slate-400">gastado</span>
          </div>

          {/* Ring 5: Salud & Medicamentos (Dynamic) */}
          <div className="flex flex-col items-center shrink-0 w-20 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" stroke="#FFE4E6" strokeWidth="4" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="#F43F5E"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="125"
                  strokeDashoffset={Math.max(0, 125 - 125 * (subcategoryTotals.health / 200000))}
                  strokeLinecap="round"
                />
              </svg>
              <FinanceIcon name="pill" className="absolute h-5 w-5 text-rose-600" />
            </div>
            <span className="text-xs font-extrabold text-slate-900 mt-2">
              {currencySymbol} {formatMoney(subcategoryTotals.health)}
            </span>
            <span className="text-[10px] font-bold text-slate-400">gastado</span>
          </div>

          {/* Ring 6: Conectividad & Servicios (Dynamic) */}
          <div className="flex flex-col items-center shrink-0 w-20 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" stroke="#FEE2E2" strokeWidth="4" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="#8B5CF6"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="125"
                  strokeDashoffset={Math.max(0, 125 - 125 * (subcategoryTotals.services / 250000))}
                  strokeLinecap="round"
                />
              </svg>
              <FinanceIcon name="zap" className="absolute h-5 w-5 text-violet-600" />
            </div>
            <span className="text-xs font-extrabold text-slate-900 mt-2">
              {currencySymbol} {formatMoney(subcategoryTotals.services)}
            </span>
            <span className="text-[10px] font-bold text-slate-400">gastado</span>
          </div>
        </div>
      </div>

      {/* 4. COPILOT "MONTHLY SPENDING" BAR CHART & METRICS (Reference Image 2) */}
      <div className="app-mobile-surface rounded-[28px] bg-white p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100">
        <div className="text-center">
          <p className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">
            GASTO MENSUAL
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {currencySymbol} {formatMoney(metrics.totalExpenses)}
            </span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                metrics.totalIncome <= 0
                  ? "bg-slate-300"
                  : metrics.totalExpenses > totalBudgeted * 0.9 ? "bg-red-500" : "bg-emerald-500"
              }`}
            />
          </div>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            {metrics.totalExpenses <= 0
              ? "Sin gastos registrados este mes"
              : metrics.expenses.al_pedo > 0
                ? `${currencySymbol} ${formatMoney(metrics.expenses.al_pedo)} en gastos Al Pedo`
                : "Sin gastos Al Pedo este mes"}
          </p>
        </div>

        {/* 12 Months Bar Chart - Completely Clickable & Dynamic */}
        <div className="grid grid-cols-1 gap-0 lg:mt-6 lg:grid-cols-5 lg:gap-6">
        <div className="min-w-0 lg:col-span-3">
        <div className="relative mt-6 border-t border-slate-100 pt-6 lg:mt-0 lg:border-t-0 lg:pt-0">
          {/* Target Budget Line Indicator with Badge (Image 2 style) */}
          <div className="absolute right-0 top-3 flex items-center gap-1 text-[10px] font-black text-white bg-slate-900 px-2 py-0.5 rounded-md shadow-sm">
            <span>{currencySymbol} {formatMoney(totalBudgeted)}</span>
          </div>

          <div className="flex items-end justify-between h-32 gap-1 sm:gap-1.5 pt-6 px-1">
            {monthsData.map((m, idx) => {
              const heightPercent =
                maxMonthVal > 0 ? Math.min(100, Math.max(12, (m.val / maxMonthVal) * 100)) : 12;

              return (
                <div
                  key={idx}
                  onClick={() => onSelectMonth && onSelectMonth(m.monthKey)}
                  className="flex flex-col items-center justify-end h-full gap-1.5 flex-1 cursor-pointer group"
                  title={`${m.fullName} ${currentYear}: ${currencySymbol} ${formatMoney(m.val)}${
                    m.alPedo > 0 ? ` (${currencySymbol} ${formatMoney(m.alPedo)} al pedo)` : ""
                  }`}
                >
                  <div className="w-full flex items-end justify-center h-24">
                    <div
                      className={`w-full max-w-[14px] rounded-t-md transition-all group-hover:scale-y-105 ${
                        m.active
                          ? m.over
                            ? "bg-red-500 shadow-md shadow-red-500/30 ring-2 ring-red-200"
                            : "bg-emerald-500 shadow-md shadow-emerald-500/30 ring-2 ring-emerald-200"
                          : m.hasData
                          ? "bg-emerald-400 hover:bg-emerald-500"
                          : "bg-slate-200 hover:bg-slate-300"
                      }`}
                      style={{ height: `${heightPercent}%`, minHeight: "10px" }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-black shrink-0 transition-transform ${
                      m.active
                        ? "text-slate-950 font-black scale-125"
                        : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  >
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Yearly Real Metrics Row (Image 2 style) */}
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400">Total gastado este año</span>
            <span className="font-extrabold text-slate-800">
              {currencySymbol} {formatMoney(totalSpentThisYear)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400">Promedio mensual este año</span>
            <span className="font-extrabold text-slate-800">
              {currencySymbol} {formatMoney(avgMonthlySpent)}
            </span>
          </div>
        </div>

        {/* Categories Breakdown Table (Image 2 style) */}
        </div>
        <div className="min-w-0 lg:col-span-2 lg:border-l lg:border-slate-100 lg:pl-6">
        <div className="mt-6 space-y-4 border-t border-slate-100 pt-4 lg:mt-0 lg:border-t-0 lg:pt-0">
          <p className="text-center text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
            MÉTRICAS POR RUBRO
          </p>

          {/* Row 1: Hogar / Fijos */}
          <div className="text-center space-y-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-600">
              HOGAR & FIJOS
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div>
                <div className="text-[10px] font-bold text-slate-400">GASTADO</div>
                <div className="font-black text-slate-800">
                  {currencySymbol} {formatMoney(metrics.expenses.fijo)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">PRESUPUESTO</div>
                <div className="font-black text-slate-800">
                  {currencySymbol} {formatMoney(totalBudgeted * 0.4)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">DIFERENCIA</div>
                <div className="font-black text-slate-800 flex items-center justify-center gap-0.5">
                  <span>
                    {currencySymbol}{" "}
                    {formatMoney(Math.abs(totalBudgeted * 0.4 - metrics.expenses.fijo))}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      metrics.expenses.fijo <= totalBudgeted * 0.4 ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Alquiler / Servicios Recurrentes */}
          <div className="text-center space-y-1 pt-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600">
              <span className="inline-flex items-center gap-1"><FinanceIcon name="home" className="h-3 w-3" /> Alquiler & servicios</span>
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div>
                <div className="text-[10px] font-bold text-slate-400">GASTADO</div>
                <div className="font-black text-slate-800">
                  {currencySymbol} {formatMoney(metrics.expenses.fijo)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">PRESUPUESTO</div>
                <div className="font-black text-slate-800">
                  {currencySymbol} {formatMoney(metrics.expenses.fijo)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">ESTADO</div>
                <div className="font-black text-emerald-600 flex items-center justify-center gap-0.5">
                  <span>AL DÍA</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Superfluos / Al Pedo */}
          <div className="text-center space-y-1 pt-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-600">
              <span className="inline-flex items-center gap-1"><FinanceIcon name="flame" className="h-3 w-3" /> Gastos Al Pedo</span>
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div>
                <div className="text-[10px] font-bold text-slate-400">GASTADO</div>
                <div className="font-black text-slate-800">
                  {currencySymbol} {formatMoney(metrics.expenses.al_pedo)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">TECHO MÁX</div>
                <div className="font-black text-slate-800">
                  {currencySymbol} {formatMoney(budgetAlPedoLimit)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">RESULTADO</div>
                <div
                  className={`font-black flex items-center justify-center gap-0.5 ${
                    metrics.expenses.al_pedo > budgetAlPedoLimit
                      ? "text-red-600"
                      : "text-emerald-600"
                  }`}
                >
                  <span>
                    {metrics.expenses.al_pedo > budgetAlPedoLimit
                      ? "EXCEDIDO"
                      : "CONTROLADO"}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      metrics.expenses.al_pedo > budgetAlPedoLimit
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>

      {/* 5. COPILOT "ACCOUNTS & NET WORTH" (Reference Image 3) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase">
            PATRIMONIO & CUENTAS
          </h3>
          <button
            onClick={() => setShowAccountModal(true)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
          >
            Detalles ›
          </button>
        </div>

        <div className="app-mobile-surface rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100">
          <div className="text-center">
            <p className="text-[11px] font-bold text-slate-400">Saldo de cuenta declarado</p>
            <div className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
              {currencySymbol} {formatMoney(estimatedNetWorth)}
            </div>
            <div
              className={`inline-flex items-center gap-1 text-xs font-black mt-1 ${
                timeframeMargin >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {timeframeMargin >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {timeframeNetSavings >= 0 ? "+" : "−"}{currencySymbol} {formatMoney(Math.abs(timeframeNetSavings))}
                <span className="font-semibold text-slate-400"> · {timeframeMargin.toFixed(1)}% · {timeframeLabel}</span>
              </span>
            </div>
          </div>

          {/* Timeframe pill selector (1W, 1M, 3M, YTD, 1Y) - Interactive */}
          <div className="flex items-center justify-center gap-1 mt-4 p-1 rounded-full bg-slate-100/80 max-w-xs mx-auto">
            {(["1W", "1M", "3M", "YTD", "1Y"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition active:scale-95 ${
                  timeframe === tf
                    ? "bg-white text-slate-900 shadow-sm font-black"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Realistic Red Mini Bank Card Representation (Image 3 style) */}
          <div
            onClick={() => setShowAccountModal(true)}
            className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 p-2 rounded-2xl transition active:scale-[0.99]"
            title="Abrir para personalizar cuenta y saldo bancario"
          >
            <div className="flex items-center gap-3">
              {/* Mini Credit/Debit Card visual */}
              <div className="relative h-11 w-16 rounded-lg bg-gradient-to-tr from-red-600 via-rose-600 to-rose-500 text-white p-1.5 shadow-md flex flex-col justify-between shrink-0">
                <span className="text-[7px] font-black tracking-tighter uppercase truncate">
                  {accountBank || "TU CUENTA"}
                </span>
                <div className="flex items-center justify-between">
                  <div className="h-2 w-3 rounded-sm bg-amber-300/80" />
                  <span className="text-[6px] font-mono tracking-widest">
                    •• {privacyMode ? "••••" : accountLast4}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs font-extrabold text-slate-800">
                  {accountType || "Agregar cuenta"}
                </div>
                <div className="text-[10px] text-slate-400">Saldo declarado</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs sm:text-sm font-black text-slate-900">
                {currencySymbol} {formatMoney(accountBaseBalance || 0)}
              </div>
              <div
                className={`text-[10px] font-bold ${
                  metrics.savingsRate >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                Actualizado por vos
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
      {/* 6. COPILOT "UPCOMING BILLS" SECTION (Reference Image 3) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase">
            GASTOS RECURRENTES
          </h3>
          <button
            onClick={() => onOpenTransactions("recurring")}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
          >
            Recurrentes ›
          </button>
        </div>

        {upcomingBills.length === 0 ? (
          <div className="rounded-2xl bg-white p-4 text-center border border-slate-100 text-xs text-slate-400">
            No tenés servicios o pagos recurrentes registrados aún.
            <button
              onClick={handleAddRecurring}
              className="mt-2 block mx-auto text-blue-600 font-bold hover:underline"
            >
              + Agregar gasto recurrente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingBills.slice(0, 4).map((bill) => (
              <div
                key={bill.id}
                onClick={() => onEditTransaction(bill)}
                className="rounded-2xl bg-white p-3.5 shadow-sm border border-slate-100 hover:border-slate-200 cursor-pointer transition active:scale-[0.99]"
                title="Abrir para editar"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      bill.isPast
                        ? "bg-slate-100 text-slate-500"
                        : bill.daysLeft === 0
                        ? "bg-amber-100 text-amber-700 font-black"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {bill.status}
                  </span>
                  <span className="text-[10px] text-slate-400">Día {bill.dueDay}</span>
                </div>
                <div className="text-xs font-black text-slate-800 mt-1.5 truncate">
                  {bill.description}
                </div>
                <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                  {currencySymbol} {formatMoney(bill.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. AI purchase assistant */}
      <div
        id="tour-cuero-card"
        className="relative isolate overflow-hidden rounded-[26px] border border-blue-300/20 bg-gradient-to-br from-[#0B5EAE] via-[#08549F] to-[#074B90] p-4 text-white shadow-[0_8px_24px_rgba(6,58,126,0.14)] sm:p-5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/[0.045]"
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl ring-1 ring-inset ring-white/10">
            <FinanceIcon name="brand" className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-extrabold leading-tight text-white sm:text-[15px]">
              ¿Me da el cuero?
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-blue-100">
              Revisá si una compra entra en tu presupuesto.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCuero}
            aria-label="Consultar con ¿Me da el cuero?"
            title="Consultar con el asistente"
            className="flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white text-xs font-bold text-blue-900 shadow-sm transition-[transform,background-color,box-shadow] duration-200 ease-out hover:bg-blue-50 hover:shadow-md active:scale-[0.97] min-[400px]:w-auto min-[400px]:px-3.5"
          >
            <span className="sr-only min-[400px]:not-sr-only">Consultar</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      </div>
      {/* MODAL: Gestionar Cuenta & Saldo Bancario */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-slate-900 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-red-600" />
                <h3 className="text-base font-black text-slate-900">
                  Configurar Cuenta & Saldo
                </h3>
              </div>
              <button
                onClick={() => setShowAccountModal(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Entidad Financiera
                </label>
                <input
                  type="text"
                  required
                  value={editBank}
                  onChange={(e) => setEditBank(e.target.value)}
                  placeholder="Ej: BANCO ITAÚ, UENO, CONTINENTAL"
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Nombre de la Cuenta
                </label>
                <input
                  type="text"
                  required
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  placeholder="Ej: Caja de Ahorro Principal"
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Últimos 4 Dígitos
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editLast4}
                    onChange={(e) => setEditLast4(e.target.value)}
                    placeholder="4291"
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-mono font-bold text-center focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Saldo Base ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editBaseBalance}
                    onChange={(e) => setEditBaseBalance(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-mono font-bold focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md transition active:scale-95"
                >
                  {isSavingAccount ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-slate-900">
            <h3 className="text-lg font-black text-slate-900">¿Cómo calculamos tu restante?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Tomamos tus <strong>ingresos registrados</strong> del mes ({currencySymbol}{" "}
              {formatMoney(totalBudgeted)}) y le restamos tus gastos actuales acumulados (
              {currencySymbol} {formatMoney(metrics.totalExpenses)}).
            </p>
            <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3 text-xs font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">Ingresos del mes:</span>
                <span className="font-bold text-slate-900">
                  {currencySymbol} {formatMoney(totalBudgeted)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gastos realizados:</span>
                <span className="font-bold text-red-600">
                  -{currencySymbol} {formatMoney(metrics.totalExpenses)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-black">
                <span>Disponible restante:</span>
                <span className="text-emerald-600">
                  {currencySymbol} {formatMoney(leftToSpend)}
                </span>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {onStartTour && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setShowInfoModal(false);
                    onStartTour();
                  }}
                  className="w-full py-2.5 rounded-full bg-blue-50 border border-blue-200 text-[#1656DB] text-xs font-black hover:bg-blue-100 transition flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Ver guía de la app</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="w-full py-2.5 rounded-full bg-slate-900 text-white text-xs font-black hover:bg-slate-800 transition active:scale-95"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
