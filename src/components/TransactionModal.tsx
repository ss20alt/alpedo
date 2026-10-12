"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  PlusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Flame,
  Check,
} from "lucide-react";
import { Transaction } from "@/lib/finance-engine";
import { triggerHaptic } from "@/lib/haptics";
import FinanceIcon from "@/components/FinanceIcon";
import { getParaguayDateString } from "@/lib/date-utils";
import { trapDialogTab } from "@/lib/dialog-keyboard";

export interface TransactionPreset {
  description: string;
  amount: number;
  category: "fijo" | "variable" | "pasivo" | "al_pedo";
  isRecurring?: boolean;
}

interface TransactionModalProps {
  userId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  currencySymbol: string;
  editingTransaction?: Transaction | null;
  initialPreset?: TransactionPreset | null;
}

export default function TransactionModal({
  userId,
  isOpen,
  onClose,
  onSaved,
  currencySymbol,
  editingTransaction,
  initialPreset,
}: TransactionModalProps) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState<"fijo" | "variable" | "pasivo" | "al_pedo">("fijo");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getParaguayDateString());
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [offlineNote, setOfflineNote] = useState<{ amount: string; description: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const draftReady = useRef(false);
  const draftKey = `alpedo_transaction_draft_${userId}`;

  // Native Drag-to-Dismiss state
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    draftReady.current = false;
    const timer = window.setTimeout(() => {
      if (editingTransaction) {
        setDraftNotice(null);
        setType(editingTransaction.type);
        setCategory(editingTransaction.category);
        setAmount(editingTransaction.amount.toString());
        setDescription(editingTransaction.description);
        setDate(editingTransaction.date);
        setIsRecurring(Boolean(editingTransaction.is_recurring));
      } else if (initialPreset) {
        setDraftNotice(null);
        setType("expense");
        setCategory(initialPreset.category);
        setAmount(initialPreset.amount > 0 ? initialPreset.amount.toString() : "");
        setDescription(initialPreset.description);
        setDate(getParaguayDateString());
        setIsRecurring(Boolean(initialPreset.isRecurring));
      } else {
        setType("expense");
        setCategory("variable");
        setAmount("");
        setDescription("");
        setDate(getParaguayDateString());
        setIsRecurring(false);
        try {
          const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
          if (saved && typeof saved === "object") {
            if (saved.type === "income" || saved.type === "expense") setType(saved.type);
            if (["fijo", "variable", "pasivo", "al_pedo"].includes(saved.category)) setCategory(saved.category);
            if (typeof saved.amount === "string") setAmount(saved.amount);
            if (typeof saved.description === "string") setDescription(saved.description);
            if (typeof saved.date === "string") setDate(saved.date);
            setIsRecurring(Boolean(saved.isRecurring));
            setDraftNotice("Borrador recuperado de este dispositivo.");
          } else setDraftNotice(null);
        } catch { setDraftNotice(null); }
      }
      setError(null);
      try {
        const noteKey = `alpedo_offline_capture_${userId}`;
        const note = JSON.parse(localStorage.getItem(noteKey) || "null");
        setOfflineNote(!editingTransaction && note && String(note.userId) === String(userId) && typeof note.amount === "string" && typeof note.description === "string" ? note : null);
      } catch { setOfflineNote(null); }
      setDragOffsetY(0);
      draftReady.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editingTransaction, initialPreset, isOpen, draftKey, userId]);

  useEffect(() => {
    if (!isOpen || editingTransaction || !draftReady.current) return;
    try {
      if (!amount && !description) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ type, category, amount, description, date, isRecurring }));
    } catch { /* El navegador puede impedir el almacenamiento local. */ }
  }, [isOpen, editingTransaction, draftKey, type, category, amount, description, date, isRecurring]);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, [isOpen]);

  const handleTypeChange = (newType: "income" | "expense") => {
    triggerHaptic("selection");
    setType(newType);
    if (newType === "income") {
      setCategory("fijo");
    } else {
      setCategory("variable");
    }
  };

  const handleCategoryChange = (newCat: "fijo" | "variable" | "pasivo" | "al_pedo") => {
    triggerHaptic("selection");
    setCategory(newCat);
  };

  // Quick Amount Increments (in Paraguayan Guaraníes)
  const addAmount = (increment: number) => {
    triggerHaptic("light");
    const current = parseFloat(amount) || 0;
    const next = current + increment;
    setAmount(next.toString());
  };

  const clearAmount = () => {
    triggerHaptic("medium");
    setAmount("");
  };

  // Smart Merchant Heuristics
  const lowerDesc = description.trim().toLowerCase();
  const isAlPedoSuggested =
    type === "expense" &&
    category !== "al_pedo" &&
    (lowerDesc.includes("biggie") ||
      lowerDesc.includes("lomito") ||
      lowerDesc.includes("cerveza") ||
      lowerDesc.includes("birra") ||
      lowerDesc.includes("bar") ||
      lowerDesc.includes("vino") ||
      lowerDesc.includes("pedidosya") ||
      lowerDesc.includes("burger") ||
      lowerDesc.includes("mcdonald") ||
      lowerDesc.includes("tragos") ||
      lowerDesc.includes("juego") ||
      lowerDesc.includes("steam") ||
      lowerDesc.includes("casino") ||
      lowerDesc.includes("snack"));

  const applyAlPedoSuggestion = () => {
    triggerHaptic("success");
    setCategory("al_pedo");
  };

  // Touch Drag-to-Dismiss handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartY.current;
    if (delta > 0) {
      // Dragging down
      setDragOffsetY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 90) {
      triggerHaptic("medium");
      onClose();
    } else {
      setDragOffsetY(0);
    }
    setIsDragging(false);
    touchStartY.current = null;
  };

  if (!isOpen) return null;

  const paraguayFrequentMerchants = ["Bolt", "Biggie", "Jaha", "Superseis", "Stock", "PedidosYa"];

  const quickPresets =
    type === "income"
      ? ["Salario Principal", "Trabajo Extra / Changa", "Comisiones / Ventas", "Intereses CDA / Inversión", "Alquiler Cobrado"]
      : category === "al_pedo"
      ? ["Bolt", "Biggie", "PedidosYa", "Lomitería / Snacks", "Salida / Bar", "Suscripción sin uso"]
      : category === "fijo"
      ? ["Alquiler", "Factura ANDE", "Factura Essap", "Internet / Tigo / Personal / Claro", "Jaha / Pasaje", "Expensas"]
      : ["Biggie", "Bolt", "Superseis", "Stock", "Combustible / Nafta", "Farmacia Punto Farma"];

  const detailSuggestions = Array.from(
    new Set(type === "expense" ? [...quickPresets, ...paraguayFrequentMerchants] : quickPresets),
  );

  const formattedAmountPreview = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return null;
    return `${currencySymbol} ${Math.round(num).toLocaleString("es-PY")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      triggerHaptic("warning");
      setError("Ingresá un monto válido mayor a 0");
      return;
    }

    if (!description.trim()) {
      triggerHaptic("warning");
      setError("Ingresá una descripción");
      return;
    }

    if (!isOnline && !editingTransaction) {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ type, category, amount, description: description.trim(), date, isRecurring }));
        onClose();
      } catch {
        setError("No se pudo guardar el borrador en este dispositivo.");
      }
      return;
    }

    setLoading(true);
    try {
      const url = "/api/transactions";
      const method = editingTransaction ? "PUT" : "POST";
      const body = {
        id: editingTransaction ? editingTransaction.id : undefined,
        type,
        category,
        amount: numAmount,
        description: description.trim(),
        date,
        is_recurring: isRecurring ? 1 : 0,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        triggerHaptic("warning");
        setError(err.error || "Error al guardar");
      } else {
        triggerHaptic("success");
        if (!editingTransaction) localStorage.removeItem(draftKey);
        onSaved();
        onClose();
      }
    } catch {
      triggerHaptic("warning");
      setError(editingTransaction ? "Sin conexión. No se pudo actualizar el movimiento." : "Sin conexión. El borrador queda guardado en este dispositivo; envialo cuando vuelvas a estar en línea.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 overflow-hidden select-none"
      role="dialog" aria-modal="true" aria-label={editingTransaction ? "Editar movimiento" : "Nuevo movimiento"}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
        trapDialogTab(event);
      }}
    >
      <div
        className="mobile-sheet-viewport-94 w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] border-t sm:border border-slate-100 bg-white p-4 sm:p-6 shadow-2xl flex flex-col text-slate-900 animate-in fade-in slide-in-from-bottom-6 duration-200"
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Mobile Drag Indicator Handle (Interactive touch gesture area) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full pt-1 pb-3 cursor-grab active:cursor-grabbing sm:hidden flex flex-col items-center justify-center"
        >
          <div className="h-1.5 w-14 rounded-full bg-slate-300" />
        </div>

        {/* Modal Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0"
        >
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-[#1656DB] shrink-0" />
            <span>{editingTransaction ? "Editar Movimiento" : "Cargar Movimiento"}</span>
          </h2>
          <button
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition active:scale-95"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-bold shrink-0">
            {error}
          </div>
        )}
        {!isOnline && !editingTransaction && <p role="status" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Sin conexión. Podés guardar un borrador en este dispositivo y enviarlo cuando vuelvas a estar en línea.</p>}
        {draftNotice && !error && <p role="status" className="mt-2 text-xs font-semibold text-blue-700">{draftNotice}</p>}
        {offlineNote && !editingTransaction && !initialPreset && <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-slate-700">
          <p className="font-bold">Nota sin conexión: {offlineNote.description} · {currencySymbol}{Number(offlineNote.amount).toLocaleString("es-PY")}</p>
          <button type="button" disabled={Boolean(amount || description)} onClick={() => {
            setType("expense");
            setCategory("variable");
            setAmount(offlineNote.amount);
            setDescription(offlineNote.description);
            setDate(getParaguayDateString());
            localStorage.removeItem(`alpedo_offline_capture_${userId}`);
            setOfflineNote(null);
            setDraftNotice("Nota recuperada. Revisá los datos antes de guardar.");
          }} className="mt-2 min-h-11 rounded-lg bg-[#1656DB] px-4 font-bold text-white disabled:opacity-50">{amount || description ? "Terminá tu borrador para recuperarla" : "Recuperar nota"}</button>
        </div>}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 mt-2">
          <div className="flex-1 overflow-y-auto overscroll-contain no-scrollbar space-y-3 py-1.5 pr-0.5">
            {/* Tipo: Ingreso o Gasto */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Tipo de Movimiento
              </label>
              <div role="group" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100/80 p-1">
                <button
                  type="button"
                  aria-pressed={type === "income"}
                  onClick={() => handleTypeChange("income")}
                  className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                    type === "income"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <ArrowUpCircle className={`h-4 w-4 shrink-0 ${type === "income" ? "text-emerald-600" : "text-slate-400"}`} />
                  Ingreso (+)
                </button>
                <button
                  type="button"
                  aria-pressed={type === "expense"}
                  onClick={() => handleTypeChange("expense")}
                  className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                    type === "expense"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <ArrowDownCircle className={`h-4 w-4 shrink-0 ${type === "expense" ? "text-rose-500" : "text-slate-400"}`} />
                  Gasto (-)
                </button>
              </div>
            </div>

            {/* Categoría según el tipo */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Categoría
              </label>
              {type === "income" ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    aria-label="Ingreso fijo: salario base"
                    aria-pressed={category === "fijo"}
                    onClick={() => handleCategoryChange("fijo")}
                    className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-medium transition active:scale-[0.98] ${
                      category === "fijo"
                        ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
                        : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="briefcase" className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate">Fijo</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Ingreso variable: extras y ventas"
                    aria-pressed={category === "variable"}
                    onClick={() => handleCategoryChange("variable")}
                    className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-medium transition active:scale-[0.98] ${
                      category === "variable"
                        ? "border-teal-200 bg-teal-50/80 text-teal-800"
                        : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="trend" className="h-4 w-4 shrink-0 text-teal-600" />
                    <span className="truncate">Variable</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Ingreso pasivo: CDA y rentas"
                    aria-pressed={category === "pasivo"}
                    onClick={() => handleCategoryChange("pasivo")}
                    className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-medium transition active:scale-[0.98] ${
                      category === "pasivo"
                        ? "border-cyan-200 bg-cyan-50/80 text-cyan-800"
                        : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="wallet" className="h-4 w-4 shrink-0 text-cyan-600" />
                    <span className="truncate">Pasivo</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    aria-label="Gasto fijo: alquiler y servicios"
                    aria-pressed={category === "fijo"}
                    onClick={() => handleCategoryChange("fijo")}
                    className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-medium transition active:scale-[0.98] ${
                      category === "fijo"
                        ? "border-slate-200 bg-white text-slate-800 shadow-sm"
                        : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="home" className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate">Fijo</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Gasto variable: supermercado y nafta"
                    aria-pressed={category === "variable"}
                    onClick={() => handleCategoryChange("variable")}
                    className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-medium transition active:scale-[0.98] ${
                      category === "variable"
                        ? "border-amber-200 bg-amber-50/80 text-amber-800"
                        : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="cart" className="h-4 w-4 shrink-0 text-amber-600" />
                    <span className="truncate">Variable</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Gasto al pedo: caprichos"
                    aria-pressed={category === "al_pedo"}
                    onClick={() => handleCategoryChange("al_pedo")}
                    className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-medium transition active:scale-[0.98] ${
                      category === "al_pedo"
                        ? "border-orange-200 bg-orange-50/80 text-orange-700"
                        : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="flame" className="h-4 w-4 shrink-0 text-orange-500" />
                    <span className="truncate">Al pedo</span>
                  </button>
                </div>
              )}
            </div>

            {/* Monto con Tipografía Grande y Steppers Táctiles */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="transaction-amount" className="text-xs font-medium text-slate-500">
                  Monto ({currencySymbol})
                </label>
                {formattedAmountPreview() && (
                  <span className="text-xs font-mono font-semibold text-blue-600 animate-in fade-in">
                    {formattedAmountPreview()}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-3 text-xl font-semibold text-slate-400">
                  {currencySymbol}
                </span>
                <input
                  id="transaction-amount"
                  type="number"
                  step="any"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-12 font-mono text-2xl font-semibold text-slate-900 placeholder-slate-400 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {amount && (
                  <button
                    type="button"
                    onClick={clearAmount}
                    aria-label="Limpiar monto"
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90"
                    title="Limpiar monto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Atajos táctiles para sumar importes habituales */}
              <div className="mt-2 flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                <span className="shrink-0 text-[11px] font-medium text-slate-400">
                  Sumar
                </span>
                <button
                  type="button"
                  onClick={() => addAmount(10000)}
                  aria-label="Sumar 10 mil guaraníes"
                  className="min-h-10 shrink-0 rounded-full bg-slate-100/80 px-3 py-1 text-xs font-mono font-medium text-slate-600 transition hover:bg-slate-200/80 active:scale-95"
                >
                  +10k
                </button>
                <button
                  type="button"
                  onClick={() => addAmount(25000)}
                  aria-label="Sumar 25 mil guaraníes"
                  className="min-h-10 shrink-0 rounded-full bg-slate-100/80 px-3 py-1 text-xs font-mono font-medium text-slate-600 transition hover:bg-slate-200/80 active:scale-95"
                >
                  +25k
                </button>
                <button
                  type="button"
                  onClick={() => addAmount(50000)}
                  aria-label="Sumar 50 mil guaraníes"
                  className="min-h-10 shrink-0 rounded-full bg-slate-100/80 px-3 py-1 text-xs font-mono font-medium text-slate-600 transition hover:bg-slate-200/80 active:scale-95"
                >
                  +50k
                </button>
                <button
                  type="button"
                  onClick={() => addAmount(100000)}
                  aria-label="Sumar 100 mil guaraníes"
                  className="min-h-10 shrink-0 rounded-full bg-slate-100/80 px-3 py-1 text-xs font-mono font-medium text-slate-600 transition hover:bg-slate-200/80 active:scale-95"
                >
                  +100k
                </button>
                <button
                  type="button"
                  onClick={() => addAmount(500000)}
                  aria-label="Sumar 500 mil guaraníes"
                  className="min-h-10 shrink-0 rounded-full bg-slate-100/80 px-3 py-1 text-xs font-mono font-medium text-slate-600 transition hover:bg-slate-200/80 active:scale-95"
                >
                  +500k
                </button>
              </div>
            </div>

            {/* Descripción con Chips Táctiles y Smart Suggestion */}
            <div>
              <label htmlFor="transaction-description" className="mb-1 block text-xs font-medium text-slate-500">
                Detalle / Descripción
              </label>
              <input
                id="transaction-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Bolt, Biggie, Lomito, ANDE..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-base font-medium text-slate-900 placeholder-slate-400 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 sm:text-sm"
              />

              {/* Smart Al Pedo Suggestion Banner */}
              {isAlPedoSuggested && (
                <div className="mt-2 flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50/60 p-2.5 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                    <span className="text-xs font-bold text-orange-800 truncate">
                      ¿Este gasto es capricho?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={applyAlPedoSuggestion}
                    className="min-h-9 shrink-0 rounded-xl border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-50 active:scale-95"
                  >
                    Marcar ¡Al Pedo!
                  </button>
                </div>
              )}

              <div
                className="mt-2 flex items-center gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar scroll-smooth pb-1 lg:w-full lg:flex-wrap lg:overflow-visible lg:pb-0"
                aria-label="Sugerencias para el detalle"
              >
                <span className="shrink-0 text-[11px] font-medium text-slate-400 lg:basis-full">
                  Sugerencias
                </span>
                {detailSuggestions.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={description === preset}
                    onClick={() => {
                      triggerHaptic("light");
                      setDescription(preset);
                    }}
                    className={`min-h-10 shrink-0 rounded-full px-3 py-1 text-xs font-medium transition active:scale-95 lg:min-h-9 lg:px-2.5 ${
                      description === preset
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha & Recurrente */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label htmlFor="transaction-date" className="mb-1 block text-xs font-medium text-slate-500">
                  Fecha
                </label>
                <input
                  id="transaction-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-800 transition focus:border-blue-400 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col justify-end">
                <span className="mb-1 block text-xs font-medium text-slate-500">Repetición</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isRecurring}
                  onClick={() => {
                    triggerHaptic("selection");
                    setIsRecurring((current) => !current);
                  }}
                  className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
                >
                  <span className="truncate">Cada mes</span>
                  <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${isRecurring ? "bg-[#1656DB]" : "bg-slate-300"}`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isRecurring ? "translate-x-5" : "translate-x-1"}`} />
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Botones de acción anclados abajo con pb-safe y feedback táctil */}
          <div className="mt-1 flex shrink-0 items-center gap-2 border-t border-slate-100 pt-3 pb-safe">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                if (!editingTransaction) {
                  try { localStorage.removeItem(draftKey); } catch { /* El navegador puede impedir el almacenamiento local. */ }
                }
                onClose();
              }}
              className="h-12 shrink-0 rounded-2xl px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1656DB] text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{loading ? "Guardando..." : editingTransaction ? "Actualizar" : isOnline ? "Guardar Movimiento" : "Guardar borrador"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

