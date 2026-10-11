"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Sparkles,
  Flame,
  ShoppingCart,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Wallet,
  RotateCcw,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface CueroModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  budgetAlPedoLimit: number;
  budgetVariableLimit: number;
  onTransactionCreated: () => void;
}

interface CueroResult {
  status: "SEGURO" | "PRECAUCION" | "PELIGRO";
  headline: string;
  badgeColor: string;
  aiMessage: string;
  financials: {
    amount: number;
    description: string;
    category: "al_pedo" | "variable";
    daysRemaining: number;
    dailyBudgetAfter: number;
    projectedNetSavings: number;
    percentAfter: number;
    remainingInBudget: number;
  };
}

export default function CueroModal({
  isOpen,
  onClose,
  currencySymbol,
  budgetAlPedoLimit,
  budgetVariableLimit,
  onTransactionCreated,
}: CueroModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"al_pedo" | "variable">("al_pedo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CueroResult | null>(null);
  const [registering, setRegistering] = useState(false);

  // Native Drag-to-Dismiss state
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setDragOffsetY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 90) {
      triggerHaptic("medium");
      handleClose();
    } else {
      setDragOffsetY(0);
    }
    setIsDragging(false);
    touchStartY.current = null;
  };

  const addAmount = (increment: number) => {
    triggerHaptic("light");
    const current = parseFloat(amount.replace(/\D/g, "")) || 0;
    setAmount((current + increment).toString());
  };

  const clearAmount = () => {
    triggerHaptic("medium");
    setAmount("");
  };


  if (!isOpen) return null;

  const formatMoney = (val: number) => {
    return Math.round(val).toLocaleString("es-PY");
  };

  const handleConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseInt(amount.replace(/\D/g, "") || "0", 10);
    if (!numAmount || numAmount <= 0) {
      triggerHaptic("error");
      setError("Ingresá un monto válido mayor a ₲ 0");
      return;
    }

    triggerHaptic("light");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          description: description.trim() || (category === "al_pedo" ? "Gusto Al Pedo" : "Compra Variable"),
          category,
          budgetAlPedoLimit,
          budgetVariableLimit,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        triggerHaptic("error");
        setError(data.error || "Ocurrió un error al consultar");
      } else {
        triggerHaptic("success");
        setResult(data);
      }
    } catch {
      triggerHaptic("error");
      setError("Error de conexión al consultar al Kape.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterExpense = async () => {
    if (!result) return;
    triggerHaptic("light");
    setRegistering(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "expense",
          category: result.financials.category,
          amount: result.financials.amount,
          description: result.financials.description || "Gasto consultado con el Kape",
          date: new Date().toISOString().split("T")[0],
          is_recurring: 0,
        }),
      });

      if (res.ok) {
        triggerHaptic("success");
        onTransactionCreated();
        handleClose();
      }
    } catch {
      triggerHaptic("error");
      setError("Error al registrar el gasto");
    } finally {
      setRegistering(false);
    }
  };

  const handleReset = () => {
    triggerHaptic("light");
    setResult(null);
    setAmount("");
    setDescription("");
    setError(null);
  };

  const handleClose = () => {
    triggerHaptic("light");
    handleReset();
    onClose();
  };

  const quickIdeas = [
    { label: "Delivery Cena", amount: "85000", cat: "al_pedo" as const },
    { label: "Lomito Árabe", amount: "35000", cat: "al_pedo" as const },
    { label: "Farra / Salida", amount: "150000", cat: "al_pedo" as const },
    { label: "Súper Express", amount: "90000", cat: "variable" as const },
    { label: "Ropa / Zapa", amount: "350000", cat: "al_pedo" as const },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 overflow-hidden">
      <div
        style={
          dragOffsetY > 0
            ? {
                transform: `translateY(${dragOffsetY}px)`,
                transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }
            : undefined
        }
        className="w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] border border-slate-100 bg-white p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col text-slate-900 animate-in fade-in slide-in-from-bottom-6 duration-200"
      >
        {/* Drag handle mobile */}
        <div
          className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-slate-300 active:bg-slate-400 sm:hidden shrink-0 touch-none cursor-grab"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-700 font-black text-2xl shadow-sm shrink-0">
              🧉
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                ¿Me da el cuero?
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Consultá al Kape antes de quemar tu plata en la calle.
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition active:scale-95"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-bold shrink-0">
            {error}
          </div>
        )}

        {/* Content Body */}
        <div className="mt-3 overflow-y-auto no-scrollbar flex-1 pr-0.5 pb-safe space-y-4">
          {!result ? (
            /* 1. INPUT FORM */
            <form onSubmit={handleConsult} className="space-y-4">
              {/* Monto */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  ¿Cuánto querés gastar? ({currencySymbol})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-lg font-black text-[#1656DB]">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Ej: 150000"
                    className="w-full h-14 rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-xl font-black text-slate-900 font-mono placeholder:text-slate-400 focus:bg-white focus:border-[#1656DB] focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition"
                    autoFocus
                  />
                </div>

                {/* Quick Amount Increment Steppers */}
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => addAmount(25000)}
                    className="flex-1 rounded-xl bg-slate-100 py-1.5 text-xs font-bold font-mono text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                  >
                    +25k
                  </button>
                  <button
                    type="button"
                    onClick={() => addAmount(50000)}
                    className="flex-1 rounded-xl bg-slate-100 py-1.5 text-xs font-bold font-mono text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                  >
                    +50k
                  </button>
                  <button
                    type="button"
                    onClick={() => addAmount(100000)}
                    className="flex-1 rounded-xl bg-slate-100 py-1.5 text-xs font-bold font-mono text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                  >
                    +100k
                  </button>
                  <button
                    type="button"
                    onClick={() => addAmount(250000)}
                    className="flex-1 rounded-xl bg-slate-100 py-1.5 text-xs font-bold font-mono text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                  >
                    +250k
                  </button>
                  {amount && (
                    <button
                      type="button"
                      onClick={clearAmount}
                      className="rounded-xl bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 active:scale-95 transition"
                      title="Limpiar monto"
                    >
                      AC
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Gasto rápido habitual:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickIdeas.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setAmount(q.amount);
                        setDescription(q.label);
                        setCategory(q.cat);
                      }}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition active:scale-95"
                    >
                      {q.label} (₲ {formatMoney(Number(q.amount))})
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  ¿En qué querés gastar? (Opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Lomitería con los kps, Delivery sushi, Ropa..."
                  className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#1656DB] focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition"
                />
              </div>

              {/* Tipo de Gasto */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  ¿Qué tipo de compra es?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setCategory("al_pedo");
                    }}
                    className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs font-bold border transition ${
                      category === "al_pedo"
                        ? "bg-orange-50 text-orange-600 border-orange-200 shadow-sm"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>Gusto Al Pedo 🔥</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setCategory("variable");
                    }}
                    className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs font-bold border transition ${
                      category === "variable"
                        ? "bg-blue-50 text-[#1656DB] border-blue-200 shadow-sm"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4 text-[#1656DB]" />
                    <span>Necesidad / Útil 🛒</span>
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#1656DB] py-3.5 px-4 text-sm font-black text-white shadow-lg shadow-blue-600/25 hover:bg-blue-600 active:scale-[0.99] transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Consultando al Kape con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                    <span>Consultar: ¿Me da el cuero?</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* 2. RESULT & VERDICT VIEW */
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Verdict Banner */}
              <div
                className={`rounded-[26px] border p-4.5 text-center ${
                  result.status === "SEGURO"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : result.status === "PRECAUCION"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-2xl mb-1.5">
                  {result.status === "SEGURO" && <CheckCircle2 className="h-7 w-7 text-emerald-600" />}
                  {result.status === "PRECAUCION" && <AlertTriangle className="h-7 w-7 text-amber-600" />}
                  {result.status === "PELIGRO" && <XCircle className="h-7 w-7 text-rose-600" />}
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  {result.headline}
                </h3>
                <span className="text-xs font-mono font-bold mt-1 inline-block opacity-80">
                  Gasto evaluado: {currencySymbol} {formatMoney(result.financials.amount)}
                </span>
              </div>

              {/* Chat Bubble from El Kape (Gemini Flash AI) */}
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4.5 relative">
                <div className="flex items-center gap-2.5 mb-2.5 pb-2.5 border-b border-slate-200/80">
                  <div className="h-8 w-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-sm shadow-xs">
                    🧉
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block leading-tight">
                      El Kape Financiero
                    </span>
                    <span className="text-[10px] font-bold text-[#1656DB]">
                      Veredicto con IA
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold italic">
                  "{result.aiMessage}"
                </p>
              </div>

              {/* Financial Breakdown Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold uppercase tracking-wider">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    Días restantes
                  </span>
                  <div className="font-mono text-sm sm:text-base font-black text-slate-900 mt-1">
                    {result.financials.daysRemaining} días
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold uppercase tracking-wider">
                    <Wallet className="h-3 w-3 text-[#1656DB]" />
                    Margen diario restante
                  </span>
                  <div
                    className={`font-mono text-sm sm:text-base font-black mt-1 ${
                      result.financials.dailyBudgetAfter > 25000
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {currencySymbol} {formatMoney(result.financials.dailyBudgetAfter)} / día
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleRegisterExpense}
                  disabled={registering}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#1656DB] py-3.5 px-4 text-xs font-black text-white hover:bg-blue-600 active:scale-95 transition shadow-md shadow-blue-600/20"
                >
                  {registering ? (
                    <span>Registrando gasto en el sistema...</span>
                  ) : (
                    <>
                      <span>¡Lo compré igual! (Registrar como Gasto)</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 py-3 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Probar otro monto</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 px-3 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
                  >
                    Cerrar y no gastar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
