"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Calculator,
  ListOrdered,
  Settings,
  Plus,
  Calendar,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Flame,
  Layers,
  Heart,
  Trophy,
  Grid2X2,
  X,
  FileSpreadsheet,
  MessageCircle,
  Eye,
  EyeOff,
  HelpCircle,
} from "lucide-react";
import { Transaction, FinancialMetrics } from "@/lib/finance-engine";
import PinModal from "@/components/PinModal";
import TransactionModal, { TransactionPreset } from "@/components/TransactionModal";
import CopilotDashboard from "@/components/CopilotDashboard";
import LoanSimulator from "@/components/LoanSimulator";
import TransactionsList from "@/components/TransactionsList";
import SettingsTab from "@/components/SettingsTab";
import ChallengeTab from "@/components/ChallengeTab";
import CueroModal from "@/components/CueroModal";
import CouplesTab from "@/components/CouplesTab";
import StreaksTab from "@/components/StreaksTab";
import InteractiveTour from "@/components/InteractiveTour";
import { triggerHaptic } from "@/lib/haptics";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; email: string } | null>(null);
  const [isPinConfigured, setIsPinConfigured] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [currentTab, setCurrentTab] = useState<"dashboard" | "couples" | "streaks" | "loans" | "challenge" | "transactions" | "grouped" | "settings">("dashboard");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [monthlyHistory, setMonthlyHistory] = useState<any[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<Transaction[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  const [currencySymbol, setCurrencySymbol] = useState<string>("₲");
  const [currencyCode, setCurrencyCode] = useState<string>("PYG");

  const [budgetAlPedoLimit, setBudgetAlPedoLimit] = useState<number>(500000);
  const [budgetVariableLimit, setBudgetVariableLimit] = useState<number>(1500000);
  const [emergencyFundSaved, setEmergencyFundSaved] = useState<number>(0);

  // Bank Account & Portfolio Customization
  const [accountBank, setAccountBank] = useState<string>("BANCO ITAÚ");
  const [accountType, setAccountType] = useState<string>("Caja de Ahorro Principal");
  const [accountLast4, setAccountLast4] = useState<string>("4291");
  const [accountBaseBalance, setAccountBaseBalance] = useState<number>(2500000);

  // Active filter pass-through for Transactions tab
  const [txFilterCategory, setTxFilterCategory] = useState<string>("all");
  const [txFilterRecurring, setTxFilterRecurring] = useState<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [initialPreset, setInitialPreset] = useState<TransactionPreset | null>(null);
  const [isCueroOpen, setIsCueroOpen] = useState<boolean>(false);
  const [isToolsSheetOpen, setIsToolsSheetOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const tabsContainerRef = React.useRef<HTMLDivElement>(null);

  // Native Pull-to-Refresh state
  const [pullDistance, setPullDistance] = useState<number>(0);

  const [isPullRefreshing, setIsPullRefreshing] = useState<boolean>(false);
  const touchPullStartY = React.useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("alpedo_privacy_mode");
      if (saved === "true") setPrivacyMode(true);
    }
  }, []);

  // First-time interactive guided tour auto-trigger
  useEffect(() => {
    if (isAuthenticated && typeof window !== "undefined") {
      const tourCompleted = localStorage.getItem("alpedo_tour_completed");
      if (tourCompleted !== "true") {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated]);


  const handleNavigateTab = useCallback((tab: "dashboard" | "couples" | "streaks" | "loans" | "challenge" | "transactions" | "grouped" | "settings") => {
    setCurrentTab(tab);
  }, []);

  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeBtn = tabsContainerRef.current.querySelector<HTMLElement>(`[data-tab="${currentTab}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [currentTab]);

  const checkAuth = useCallback(async () => {
    try {
      setAuthLoading(true);
      const res = await fetch("/api/auth");
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      setIsPinConfigured(data.isPinConfigured);
      if (data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.currency_symbol) setCurrencySymbol(data.currency_symbol);
        if (data.currency_code) setCurrencyCode(data.currency_code);
        if (data.budget_al_pedo_limit !== undefined) setBudgetAlPedoLimit(Number(data.budget_al_pedo_limit) || 500000);
        if (data.budget_variable_limit !== undefined) setBudgetVariableLimit(Number(data.budget_variable_limit) || 1500000);
        if (data.emergency_fund_saved !== undefined) setEmergencyFundSaved(Number(data.emergency_fund_saved) || 0);
        if (data.account_bank) setAccountBank(data.account_bank);
        if (data.account_type) setAccountType(data.account_type);
        if (data.account_last4) setAccountLast4(data.account_last4);
        if (data.account_base_balance !== undefined) setAccountBaseBalance(Number(data.account_base_balance) || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleUpdateAccount = async (bank: string, type: string, last4: string, baseBalance: number) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_bank: bank,
          account_type: type,
          account_last4: last4,
          account_base_balance: baseBalance,
        }),
      });
      if (res.ok) {
        setAccountBank(bank);
        setAccountType(type);
        setAccountLast4(last4);
        setAccountBaseBalance(baseBalance);
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateBudgets = async (newAlPedo: number, newVariable: number) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget_al_pedo_limit: newAlPedo,
          budget_variable_limit: newVariable,
        }),
      });
      if (res.ok) {
        setBudgetAlPedoLimit(newAlPedo);
        setBudgetVariableLimit(newVariable);
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateEmergencyFund = async (saved: number) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emergency_fund_saved: saved,
        }),
      });
      if (res.ok) {
        setEmergencyFundSaved(saved);
      }
    } catch {
      // ignore
    }
  };

  const fetchData = useCallback(async (forcedMonth?: string) => {
    try {
      setDataLoading(true);
      const targetMonth = forcedMonth !== undefined ? forcedMonth : selectedMonth;
      const res = await fetch(`/api/transactions?month=${targetMonth}`);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setMetrics(data.metrics || null);
        if (data.monthlyHistory) setMonthlyHistory(data.monthlyHistory);
        if (data.recurringExpenses) setRecurringExpenses(data.recurringExpenses);
        if (data.availableMonths && data.availableMonths.length > 0) {
          setAvailableMonths(data.availableMonths);
        }
      }
    } catch {
      // ignore
    } finally {
      setDataLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
      fetchData();
    }
  }, [isAuthenticated, fetchData, fetchSettings]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch {
      // ignore
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    triggerHaptic("warning");
    if (!confirm("¿Eliminar este movimiento?")) return;
    try {
      const res = await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        triggerHaptic("medium");
        fetchData();
      }
    } catch {
      // ignore
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
    triggerHaptic("light");
    setEditingTransaction(tx);
    setInitialPreset(null);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    triggerHaptic("light");
    setEditingTransaction(null);
    setInitialPreset(null);
    setIsModalOpen(true);
  };

  const handleAddNewWithPreset = (preset: TransactionPreset) => {
    triggerHaptic("light");
    setEditingTransaction(null);
    setInitialPreset(preset);
    setIsModalOpen(true);
  };

  const handleToggleAlPedo = async (tx: Transaction) => {
    try {
      const nextCat = tx.category === "al_pedo" ? "variable" : "al_pedo";
      triggerHaptic("success");
      setTransactions((prev) =>
        prev.map((t) => (t.id === tx.id ? { ...t, category: nextCat } : t))
      );
      const res = await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tx, category: nextCat }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch {
      fetchData();
    }
  };

  // Native Pull-to-Refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (typeof window !== "undefined" && window.scrollY <= 2) {
      touchPullStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchPullStartY.current === null) return;
    if (typeof window !== "undefined" && window.scrollY <= 2) {
      const delta = e.touches[0].clientY - touchPullStartY.current;
      if (delta > 0) {
        setPullDistance(Math.min(delta * 0.42, 85));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= 55 && !isPullRefreshing) {
      setIsPullRefreshing(true);
      triggerHaptic("medium");
      await fetchData();
      triggerHaptic("success");
      setIsPullRefreshing(false);
    }
    setPullDistance(0);
    touchPullStartY.current = null;
  };

  // PWA Home Screen Shortcuts Action support (?action=new, ?action=cuero)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const action = params.get("action");
      if (action === "new") {
        handleAddNew();
      } else if (action === "cuero") {
        setIsCueroOpen(true);
      }
    }
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#EEF2F8] text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#1656DB] border-t-transparent" />
          <p className="text-xs sm:text-sm font-bold text-slate-600">Iniciando sistema financiero...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <PinModal
        isConfigured={isPinConfigured}
        onAuthenticated={() => {
          setIsAuthenticated(true);
          checkAuth();
          fetchSettings();
          fetchData();
        }}
      />
    );
  }

  const formatMoney = (val: number) => {
    return Math.round(val).toLocaleString("es-PY");
  };

  return (
    <div className="min-h-screen bg-[#EEF2F8] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Copilot Signature Royal Blue Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-[#104BC9] via-[#1656DB] to-[#1C5FE6] text-white pt-safe shadow-md pb-2.5">
        <div className="mx-auto flex max-w-lg sm:max-w-2xl md:max-w-4xl items-center justify-between px-4 sm:px-6 pt-1.5 pb-2">
          {/* Left: User Avatar & Settings Trigger */}
          <button
            onClick={() => {
              triggerHaptic("selection");
              setCurrentTab("settings");
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-white/90 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title="Mi Perfil & Ajustes"
            aria-label="Ajustes"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-[11px] font-black uppercase text-white shadow-inner">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <Settings className="h-3.5 w-3.5" />}
            </div>
            <span className="hidden sm:inline text-xs font-bold text-white/90 truncate max-w-[100px]">
              {currentUser?.name?.split(" ")[0] || "Ajustes"}
            </span>
          </button>

          {/* Center: App Title (Copilot Typography) */}
          <div
            id="tour-header-logo"
            className="flex flex-col items-center cursor-pointer select-none"
            onClick={() => setCurrentTab("dashboard")}
          >
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
              <span>alpedo</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
            </h1>
          </div>

          {/* Right: Privacy Eye Toggle + Kape AI Assistant button + Help Tour */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                triggerHaptic("selection");
                setIsTourOpen(true);
              }}
              className="p-2 rounded-full text-white/85 hover:text-white hover:bg-white/10 active:scale-95 transition"
              title="Guía interactiva & Tour del sistema"
              aria-label="Guía interactiva"
            >
              <HelpCircle className="h-5 w-5" />
            </button>

            <button
              id="tour-privacy-btn"
              onClick={() => {
                const next = !privacyMode;
                triggerHaptic("selection");
                setPrivacyMode(next);
                if (typeof window !== "undefined") {
                  localStorage.setItem("alpedo_privacy_mode", next ? "true" : "false");
                }
              }}
              className={`p-2 rounded-full transition active:scale-95 ${
                privacyMode
                  ? "bg-amber-400/25 text-amber-300 ring-1 ring-amber-400/50 shadow-sm"
                  : "text-white/85 hover:text-white hover:bg-white/10"
              }`}
              title={privacyMode ? "Modo Privacidad activo (Tocar para ver saldos)" : "Ocultar saldos (Modo Privacidad)"}
              aria-label="Modo Privacidad"
            >
              {privacyMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>

            <button
              onClick={() => setIsCueroOpen(true)}
              className="p-2 rounded-full text-white/90 hover:text-white hover:bg-white/10 active:scale-95 transition relative"
              title="Preguntale al Kape: ¿Me da el cuero?"
              aria-label="Asistente Kape"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-blue-600" />
            </button>
          </div>
        </div>

        {/* Copilot Horizontal Pill Tabs Bar & Month Selector */}
        <div className="mx-auto max-w-lg sm:max-w-2xl md:max-w-4xl px-3 sm:px-6 pt-0.5">
          <div className="flex items-center gap-2 py-1">
            {/* Horizontal pill navigation */}
            <div
              ref={tabsContainerRef}
              className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
            >
              <button
                data-tab="dashboard"
                onClick={() => setCurrentTab("dashboard")}
                className={`rounded-full px-4 py-1.5 text-xs font-black transition shrink-0 ${
                  currentTab === "dashboard"
                    ? "border border-white/90 bg-white/20 text-white shadow-sm backdrop-blur-md"
                    : "text-white/75 hover:text-white hover:bg-white/10"
                }`}
              >
                Tablero
              </button>
              <button
                data-tab="transactions"
                onClick={() => setCurrentTab("transactions")}
                className={`rounded-full px-4 py-1.5 text-xs font-black transition shrink-0 ${
                  currentTab === "transactions"
                    ? "border border-white/90 bg-white/20 text-white shadow-sm backdrop-blur-md"
                    : "text-white/75 hover:text-white hover:bg-white/10"
                }`}
              >
                Movimientos
              </button>
              <button
                data-tab="grouped"
                onClick={() => setCurrentTab("grouped")}
                className={`rounded-full px-4 py-1.5 text-xs font-black transition shrink-0 ${
                  currentTab === "grouped"
                    ? "border border-white/90 bg-white/20 text-white shadow-sm backdrop-blur-md"
                    : "text-white/75 hover:text-white hover:bg-white/10"
                }`}
              >
                Comercios
              </button>
              <button
                data-tab="couples"
                onClick={() => setCurrentTab("couples")}
                className={`rounded-full px-4 py-1.5 text-xs font-black transition shrink-0 ${
                  currentTab === "couples"
                    ? "border border-white/90 bg-white/20 text-white shadow-sm backdrop-blur-md"
                    : "text-white/75 hover:text-white hover:bg-white/10"
                }`}
              >
                Pareja
              </button>
              <button
                data-tab="challenge"
                onClick={() => setCurrentTab("challenge")}
                className={`rounded-full px-4 py-1.5 text-xs font-black transition shrink-0 ${
                  currentTab === "challenge"
                    ? "border border-white/90 bg-white/20 text-white shadow-sm backdrop-blur-md"
                    : "text-white/75 hover:text-white hover:bg-white/10"
                }`}
              >
                Reto 1%
              </button>
              <button
                data-tab="streaks"
                onClick={() => setCurrentTab("streaks")}
                className={`rounded-full px-4 py-1.5 text-xs font-black transition shrink-0 ${
                  currentTab === "streaks"
                    ? "border border-white/90 bg-white/20 text-white shadow-sm backdrop-blur-md"
                    : "text-white/75 hover:text-white hover:bg-white/10"
                }`}
              >
                Rachas
              </button>
              <button
                data-tab="loans"
                onClick={() => setCurrentTab("loans")}
                className={`rounded-full px-4 py-1.5 text-xs font-black transition shrink-0 ${
                  currentTab === "loans"
                    ? "border border-white/90 bg-white/20 text-white shadow-sm backdrop-blur-md"
                    : "text-white/75 hover:text-white hover:bg-white/10"
                }`}
              >
                Préstamos
              </button>
            </div>

            {/* Month Filter Dropdown always pinned cleanly */}
            <div className="relative shrink-0">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none rounded-full border border-white/30 bg-white/15 pl-3 pr-7 py-1 text-[11px] font-bold text-white focus:outline-none cursor-pointer backdrop-blur-md hover:bg-white/25 transition text-center"
              >
                <option value={new Date().toISOString().substring(0, 7)} className="text-slate-900 bg-white">
                  {new Date().toISOString().substring(0, 7)}
                </option>
                {availableMonths
                  .filter((m) => m !== new Date().toISOString().substring(0, 7))
                  .map((m) => (
                    <option key={m} value={m} className="text-slate-900 bg-white">
                      {m}
                    </option>
                  ))}
                <option value="all" className="text-slate-900 bg-white">Histórico</option>
              </select>
              <Calendar className="pointer-events-none absolute right-2.5 top-1.5 h-3.5 w-3.5 text-white/80" />
            </div>
          </div>
        </div>
      </header>

      {/* Native Pull-to-Refresh Floating Indicator */}
      {(pullDistance > 0 || isPullRefreshing) && (
        <div
          className="fixed top-24 inset-x-0 z-50 flex items-center justify-center pointer-events-none transition-transform duration-75"
          style={{ transform: `translateY(${Math.min(pullDistance, 55)}px)` }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xl border border-slate-200/90 text-[#1656DB]">
            {isPullRefreshing ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            ) : (
              <TrendingUp
                className="h-5 w-5 transition-transform"
                style={{
                  transform: `rotate(${Math.min(180, (pullDistance / 55) * 180)}deg)`,
                  color: pullDistance >= 55 ? "#1656DB" : "#94A3B8",
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Content Area with Touch Pull-to-Refresh */}
      <main
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="mx-auto w-full max-w-lg sm:max-w-2xl md:max-w-4xl flex-1 px-3 sm:px-6 py-4 pb-28 md:pb-12"
      >
        {dataLoading && !metrics ? (
          <div className="flex h-64 items-center justify-center text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* 1. COPILOT DASHBOARD VIEW */}
            {currentTab === "dashboard" && metrics && (
              <CopilotDashboard
                metrics={metrics}
                transactions={transactions}
                monthlyHistory={monthlyHistory}
                recurringExpenses={recurringExpenses}
                currencySymbol={currencySymbol}
                selectedMonth={selectedMonth}
                budgetAlPedoLimit={budgetAlPedoLimit}
                budgetVariableLimit={budgetVariableLimit}
                emergencyFundSaved={emergencyFundSaved}
                accountBank={accountBank}
                accountType={accountType}
                accountLast4={accountLast4}
                accountBaseBalance={accountBaseBalance}
                privacyMode={privacyMode}
                onUpdateAccount={handleUpdateAccount}
                onSelectMonth={(m) => {
                  triggerHaptic("selection");
                  setSelectedMonth(m);
                }}
                onAddNew={handleAddNew}
                onAddNewWithPreset={handleAddNewWithPreset}
                onEditTransaction={handleEditTransaction}
                onOpenCuero={() => {
                  triggerHaptic("medium");
                  setIsCueroOpen(true);
                }}
                onOpenTransactions={(filter) => {
                  triggerHaptic("selection");
                  if (filter === "fijo" || filter === "variable" || filter === "al_pedo") {
                    setTxFilterCategory(filter);
                    setTxFilterRecurring(false);
                  } else if (filter === "recurring") {
                    setTxFilterCategory("all");
                    setTxFilterRecurring(true);
                  } else {
                    setTxFilterCategory("all");
                    setTxFilterRecurring(false);
                  }
                  setCurrentTab("transactions");
                }}
                onOpenCategories={() => {
                  triggerHaptic("selection");
                  setCurrentTab("grouped");
                }}
                onStartTour={() => setIsTourOpen(true)}
              />
            )}

            {/* Fallback si no hay métricas disponibles aún */}
            {currentTab === "dashboard" && !metrics && !dataLoading && (
              <div className="flex flex-col items-center justify-center p-12 text-center rounded-[28px] border border-slate-100 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.03)] my-8">
                <p className="text-slate-600 text-sm font-semibold">No se encontraron movimientos registrados para este mes.</p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => {
                      triggerHaptic("light");
                      fetchData();
                    }}
                    className="px-5 py-2.5 bg-[#1656DB] hover:bg-blue-600 text-white text-xs font-black rounded-2xl transition shadow-md shadow-blue-600/20 active:scale-95"
                  >
                    Actualizar
                  </button>
                  <button
                    onClick={handleAddNew}
                    className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-2xl transition border border-slate-200 active:scale-95"
                  >
                    + Nuevo Movimiento
                  </button>
                </div>
              </div>
            )}

            {/* 2. METAS EN PAREJA VIEW */}
            {currentTab === "couples" && (
              <CouplesTab currencySymbol={currencySymbol} />
            )}

            {/* 3. RACHAS & DUELOS VIEW */}
            {currentTab === "streaks" && (
              <StreaksTab currencySymbol={currencySymbol} />
            )}

            {/* 4. LOANS SIMULATOR VIEW */}
            {currentTab === "loans" && metrics && (
              <LoanSimulator metrics={metrics} currencySymbol={currencySymbol} />
            )}

            {/* 5. RETO 1% VIEW */}
            {currentTab === "challenge" && (
              <ChallengeTab currencySymbol={currencySymbol} />
            )}

            {/* 6. TRANSACTIONS VIEW */}
            {currentTab === "transactions" && (
              <TransactionsList
                transactions={transactions}
                currencySymbol={currencySymbol}
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
                onAddNew={handleAddNew}
                onToggleAlPedo={handleToggleAlPedo}
                defaultView="list"
                initialCategory={txFilterCategory}
                initialRecurringOnly={txFilterRecurring}
                privacyMode={privacyMode}
              />
            )}

            {/* 7. GROUPED EXPENSES VIEW */}
            {currentTab === "grouped" && (
              <TransactionsList
                transactions={transactions}
                currencySymbol={currencySymbol}
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
                onAddNew={handleAddNew}
                onToggleAlPedo={handleToggleAlPedo}
                defaultView="grouped"
                privacyMode={privacyMode}
              />
            )}

            {/* 8. SETTINGS VIEW */}
            {currentTab === "settings" && (
              <SettingsTab
                currentUser={currentUser}
                currencySymbol={currencySymbol}
                currencyCode={currencyCode}
                onSettingsSaved={(sym, cod) => {
                  setCurrencySymbol(sym);
                  setCurrencyCode(cod);
                }}
                onRefreshData={fetchData}
                onLogout={handleLogout}
                onStartTour={() => setIsTourOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Copilot Frosted Light Bar) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 pb-safe md:hidden select-none shadow-[0_-4px_25px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-4 h-16 items-center px-2">
          {/* 1. Tablero */}
          <button
            onClick={() => {
              triggerHaptic("selection");
              setCurrentTab("dashboard");
            }}
            className={`flex flex-col items-center justify-center gap-1 h-full transition active:scale-90 ${
              currentTab === "dashboard"
                ? "text-[#1656DB] font-black"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LayoutDashboard className={`h-5 w-5 ${currentTab === "dashboard" ? "stroke-[2.5]" : ""}`} />
            <span className="text-[10px] tracking-tight">Tablero</span>
          </button>

          {/* 2. Movimientos */}
          <button
            onClick={() => {
              triggerHaptic("selection");
              setCurrentTab("transactions");
            }}
            className={`flex flex-col items-center justify-center gap-1 h-full transition active:scale-90 ${
              currentTab === "transactions"
                ? "text-[#1656DB] font-black"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <ListOrdered className={`h-5 w-5 ${currentTab === "transactions" ? "stroke-[2.5]" : ""}`} />
            <span className="text-[10px] tracking-tight">Movim.</span>
          </button>

          {/* 3. Cargar */}
          <button
            onClick={handleAddNew}
            className="flex flex-col items-center justify-center gap-1 h-full transition active:scale-90 text-[#1656DB] group"
            aria-label="Cargar Movimiento"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#104BC9] via-[#1656DB] to-[#1C5FE6] text-white font-black shadow-md shadow-blue-500/25 group-active:scale-95 transition-transform">
              <Plus className="h-5 w-5 stroke-[3]" />
            </div>
            <span className="text-[10px] font-black text-[#1656DB] tracking-tight">Cargar</span>
          </button>

          {/* 4. Más (Herramientas Sheet) */}
          <button
            onClick={() => {
              triggerHaptic("selection");
              setIsToolsSheetOpen(true);
            }}
            className={`flex flex-col items-center justify-center gap-1 h-full transition active:scale-90 ${
              currentTab === "loans" || currentTab === "settings" || currentTab === "grouped"
                ? "text-[#1656DB] font-black"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Grid2X2 className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">Más</span>
          </button>
        </div>
      </nav>

      {/* Floating Action Pill (Image 4 Copilot [ ⚙️ | + ] capsule for desktop) */}
      <div className="fixed bottom-8 right-8 z-40 hidden md:flex items-center bg-white/95 backdrop-blur-md rounded-full shadow-xl border border-slate-200/90 py-1.5 px-3.5 gap-2.5">
        <button
          onClick={() => setCurrentTab("settings")}
          className="text-slate-500 hover:text-slate-900 transition p-1"
          title="Ajustes"
        >
          <Settings className="h-4 w-4" />
        </button>
        <span className="h-4 w-px bg-slate-200" />
        <button
          onClick={handleAddNew}
          className="text-[#1656DB] hover:text-blue-700 transition p-1 font-black"
          title="Cargar Movimiento"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
        </button>
      </div>

      {/* Mobile Tools Bottom Sheet (Copilot Light Material Sheet) */}
      {isToolsSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsToolsSheetOpen(false)}
          />
          <div className="relative w-full rounded-t-3xl border-t border-slate-200 bg-white p-5 shadow-2xl z-10 pb-safe animate-in slide-in-from-bottom duration-250 text-slate-900">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Herramientas & Secciones</h3>
                <p className="text-xs text-slate-400">Funciones complementarias</p>
              </div>
              <button
                onClick={() => setIsToolsSheetOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition active:scale-95"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  triggerHaptic("selection");
                  setIsToolsSheetOpen(false);
                  setIsTourOpen(true);
                }}
                className="flex items-center gap-3 p-3.5 rounded-2xl border border-blue-200 bg-blue-50/70 text-blue-900 hover:bg-blue-100 transition active:scale-95 col-span-2"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-[#1656DB] flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900">Guía & Tour Interactivo</div>
                  <div className="text-[10px] text-slate-500">Recorrido dinámico por cada función</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setCurrentTab("loans");
                  setIsToolsSheetOpen(false);
                }}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition active:scale-95 ${
                  currentTab === "loans"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-slate-50/80 border-slate-200/80 text-slate-800 hover:bg-slate-100"
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Préstamos</div>
                  <div className="text-[10px] text-slate-500">Cuotas e impacto</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setCurrentTab("grouped");
                  setIsToolsSheetOpen(false);
                }}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition active:scale-95 ${
                  currentTab === "grouped"
                    ? "bg-cyan-50 border-cyan-500 text-cyan-700"
                    : "bg-slate-50/80 border-slate-200/80 text-slate-800 hover:bg-slate-100"
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Por Comercio</div>
                  <div className="text-[10px] text-slate-500">Bolt, Biggie, Super</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setCurrentTab("settings");
                  setIsToolsSheetOpen(false);
                }}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition active:scale-95 ${
                  currentTab === "settings"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-slate-50/80 border-slate-200/80 text-slate-800 hover:bg-slate-100"
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Ajustes & PIN</div>
                  <div className="text-[10px] text-slate-500">Moneda, respaldo, clave</div>
                </div>
              </button>

              <a
                href="/api/transactions/export"
                download
                className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-800 hover:bg-slate-100 transition active:scale-95"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Exportar Excel</div>
                  <div className="text-[10px] text-slate-500">Descargar CSV</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Floating Assistant Icon (¿Me da el cuero?) */}
      <button
        id="tour-cuero-button"
        onClick={() => setIsCueroOpen(true)}
        className="fixed bottom-20 md:bottom-24 right-4 md:right-8 z-40 flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-tr from-[#104BC9] via-[#1656DB] to-[#1C5FE6] text-white font-black text-2xl shadow-xl shadow-blue-600/35 border-2 border-white active:scale-90 hover:scale-105 transition-transform duration-200"
        title="Preguntale al Kape: ¿Me da el cuero?"
        aria-label="Asistente Kape"
      >
        <span>🧉</span>
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[8px] font-black text-slate-950 shadow border border-white">
          ✨
        </span>
      </button>

      {/* Transaction Modal (Bottom Sheet on mobile with native gestures) */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
          setInitialPreset(null);
        }}
        onSaved={fetchData}
        currencySymbol={currencySymbol}
        editingTransaction={editingTransaction}
        initialPreset={initialPreset}
      />

      {/* Cuero Modal (Gemini AI Consult) */}
      <CueroModal
        isOpen={isCueroOpen}
        onClose={() => setIsCueroOpen(false)}
        currencySymbol={currencySymbol}
        budgetAlPedoLimit={budgetAlPedoLimit}
        budgetVariableLimit={budgetVariableLimit}
        onTransactionCreated={fetchData}
      />

      {/* Interactive Onboarding Tour */}
      <InteractiveTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateTab={handleNavigateTab}
      />
    </div>
  );
}

