"use client";

import React, { useState, useRef } from "react";
import { trapDialogTab } from "@/lib/dialog-keyboard";
import {
  X,
  MessageCircle,
  Flame,
  ShoppingCart,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Wallet,
  RotateCcw,
  ChevronDown,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import FinanceIcon from "@/components/FinanceIcon";
import { getParaguayDateString } from "@/lib/date-utils";

interface CueroModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
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
  onTransactionCreated,
}: CueroModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"al_pedo" | "variable">("al_pedo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CueroResult | null>(null);
  const [registering, setRegistering] = useState(false);
  const [showQuickIdeas, setShowQuickIdeas] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

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
    setError(null);
  };

  const clearAmount = () => {
    triggerHaptic("medium");
    setAmount("");
    setError(null);
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
          date: getParaguayDateString(),
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
    setShowQuickIdeas(false);
    setShowDescription(false);
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/45 px-0 pt-3 sm:items-center sm:p-4 sm:backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Consultar gasto"
      onKeyDown={(event) => {
        if (event.key === "Escape") handleClose();
        trapDialogTab(event);
      }}
    >
      <div
        style={
          dragOffsetY > 0
            ? {
                transform: `translateY(${dragOffsetY}px)`,
                transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }
            : undefined
        }
        className="mobile-sheet-viewport-92 flex w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border-x border-t border-slate-200 bg-white text-slate-900 shadow-[0_-12px_40px_rgba(15,23,42,0.16)] animate-in fade-in slide-in-from-bottom-6 duration-200 sm:rounded-[28px] sm:border sm:shadow-2xl"
      >
        <div className="shrink-0 px-4 pt-2 sm:px-6">
          {/* Drag handle mobile */}
          <div
            className="mx-auto mb-3 h-1 w-10 touch-none cursor-grab rounded-full bg-slate-300 active:bg-slate-400 sm:hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200/80 bg-amber-50 text-amber-700 shadow-sm">
                <FinanceIcon name="brand" className="h-6 w-6 text-amber-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                  ¿Me da el cuero?
                </h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Revisá una compra con tus números.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-95"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 shrink-0 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 sm:mx-6">
            {error}
          </div>
        )}

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-safe no-scrollbar sm:px-6">
          {!result ? (
            /* 1. INPUT FORM */
            <form id="cuero-consult-form" onSubmit={handleConsult} className="space-y-5 pb-2">
              {/* Monto */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-600" htmlFor="cuero-amount">
                  Monto de la compra
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-extrabold text-[#1656DB]">
                    {currencySymbol}
                  </span>
                  <input
                    id="cuero-amount"
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ej: 150000"
                    inputMode="numeric"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-12 font-mono text-lg font-extrabold text-slate-900 transition-colors placeholder:font-semibold placeholder:text-slate-400 focus:border-[#1656DB] focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                  {amount && (
                    <button
                      type="button"
                      onClick={clearAmount}
                      aria-label="Limpiar monto"
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400">Sumar rápido</span>
                  <div className="flex gap-1.5">
                    {[25_000, 50_000, 100_000, 250_000].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => addAmount(value)}
                        className="min-h-9 min-w-10 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
                      >
                        +{value / 1000}k
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Collapsible frequent purchases */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  aria-expanded={showQuickIdeas}
                  onClick={() => setShowQuickIdeas((visible) => !visible)}
                  className="flex min-h-12 w-full items-center gap-3 px-3.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  <ShoppingCart aria-hidden="true" className="h-4 w-4 shrink-0 text-[#1656DB]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-700">Usar un gasto frecuente</span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">5 ejemplos listos para cargar</span>
                  </span>
                  <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${showQuickIdeas ? "rotate-180" : ""}`} />
                </button>
                {showQuickIdeas && (
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/70 p-3">
                    {quickIdeas.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setAmount(q.amount);
                          setDescription(q.label);
                          setCategory(q.cat);
                          setError(null);
                          setShowDescription(true);
                          setShowQuickIdeas(false);
                        }}
                        className="flex min-h-12 min-w-0 flex-col justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/50 active:scale-[0.98]"
                      >
                        <span className="truncate text-[11px] font-bold text-slate-700">{q.label}</span>
                        <span className="mt-0.5 text-[10px] font-semibold text-slate-400">{currencySymbol} {formatMoney(Number(q.amount))}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div>
                {!showDescription ? (
                  <button
                    type="button"
                    onClick={() => setShowDescription(true)}
                    className="flex min-h-10 items-center gap-2 rounded-xl px-1 text-xs font-semibold text-[#1656DB] transition-colors hover:text-blue-700 active:opacity-70"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Agregar detalle <span className="font-normal text-slate-400">(opcional)</span>
                  </button>
                ) : (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="cuero-description" className="text-xs font-bold text-slate-600">Detalle de la compra</label>
                      <button type="button" onClick={() => setShowDescription(false)} className="px-1 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700">Ocultar</button>
                    </div>
                    <input
                      id="cuero-description"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ej.: cena, ropa o transporte"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 transition-colors placeholder:text-slate-400 focus:border-[#1656DB] focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                )}
              </div>

              {/* Tipo de Gasto */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-600">
                  Tipo de compra
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={category === "al_pedo"}
                    onClick={() => {
                      triggerHaptic("selection");
                      setCategory("al_pedo");
                    }}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-2.5 text-xs font-bold transition-colors active:scale-[0.98] ${
                      category === "al_pedo"
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>Gusto Al Pedo</span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={category === "variable"}
                    onClick={() => {
                      triggerHaptic("selection");
                      setCategory("variable");
                    }}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-2.5 text-xs font-bold transition-colors active:scale-[0.98] ${
                      category === "variable"
                        ? "border-blue-200 bg-blue-50 text-[#1656DB]"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4 text-[#1656DB]" />
                    <span>Necesidad / útil</span>
                  </button>
                </div>
              </div>

            </form>
          ) : (
            /* 2. RESULT & VERDICT VIEW */
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Verdict Banner */}
              <div
                className={`rounded-3xl border p-4 ${
                  result.status === "SEGURO"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : result.status === "PRECAUCION"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80">
                    {result.status === "SEGURO" && <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
                    {result.status === "PRECAUCION" && <AlertTriangle className="h-6 w-6 text-amber-600" />}
                    {result.status === "PELIGRO" && <XCircle className="h-6 w-6 text-rose-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-left text-base font-extrabold leading-tight tracking-tight sm:text-lg">
                      {result.headline}
                    </h3>
                    <p className="mt-1 text-left text-xs font-semibold opacity-75">
                      Evaluación de {currencySymbol} {formatMoney(result.financials.amount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Bubble from El Kape (Gemini Flash AI) */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-200 bg-amber-50">
                    <FinanceIcon name="brand" className="h-4 w-4 text-amber-700" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold leading-tight text-slate-800">Tu recomendación</span>
                    <span className="text-[10px] text-slate-400">Basada en tus movimientos</span>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-slate-700">
                  {result.aiMessage}
                </p>
              </div>

              {/* Financial Breakdown Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50 p-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold leading-tight text-slate-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    Días restantes
                  </span>
                  <div className="mt-2 font-mono text-sm font-extrabold text-slate-900 sm:text-base">
                    {result.financials.daysRemaining} días
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50 p-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold leading-tight text-slate-500">
                    <Wallet className="h-3.5 w-3.5 shrink-0 text-[#1656DB]" />
                    Margen diario restante
                  </span>
                  <div
                    className={`mt-2 break-words font-mono text-sm font-extrabold sm:text-base ${
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
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={handleRegisterExpense}
                  disabled={registering}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1656DB] px-4 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-[transform,background-color,box-shadow] duration-200 hover:bg-blue-700 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                >
                  {registering ? (
                    <span>Registrando…</span>
                  ) : (
                    <>
                      <span>Registrar este gasto</span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 active:scale-[0.99]"
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  <span>Evaluar otra compra</span>
                </button>
              </div>
            </div>
          )}
        </div>
        {!result && (
          <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white px-4 pt-3 pb-safe sm:px-6">
            <button
              type="submit"
              form="cuero-consult-form"
              disabled={loading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1656DB] px-4 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-[transform,background-color,box-shadow] duration-200 hover:bg-blue-700 hover:shadow-lg active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Analizando tu compra…</span>
                </>
              ) : (
                <>
                  <MessageCircle aria-hidden="true" className="h-4 w-4 text-blue-100" />
                  <span>Consultar compra</span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="mt-2 flex items-start justify-center gap-1.5 px-1 text-center text-[10px] leading-snug text-slate-400">
              <ShieldCheck aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>Si usás IA, Google Gemini recibe el monto y un resumen numérico de tus movimientos; no tu correo.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
