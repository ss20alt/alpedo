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
        const note = JSON.parse(localStorage.getItem("alpedo_offline_capture") || "null");
        setOfflineNote(!editingTransaction && note && typeof note.amount === "string" && typeof note.description === "string" ? note : null);
      } catch { setOfflineNote(null); }
      setDragOffsetY(0);
      draftReady.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editingTransaction, initialPreset, isOpen, draftKey]);

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
        className="mobile-sheet-viewport-94 w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] border-t sm:border border-slate-100 bg-white p-4 sm:p-6 shadow-2xl flex flex-col text-slate-900 animate-in fade-in slide-in-from-bottom-6 duration-200"
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
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition active:scale-95"
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
            localStorage.removeItem("alpedo_offline_capture");
            setOfflineNote(null);
            setDraftNotice("Nota recuperada. Revisá los datos antes de guardar.");
          }} className="mt-2 min-h-11 rounded-lg bg-[#1656DB] px-4 font-bold text-white disabled:opacity-50">{amount || description ? "Terminá tu borrador para recuperarla" : "Recuperar nota"}</button>
        </div>}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 mt-2">
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 py-2 pr-0.5">
            {/* Tipo: Ingreso o Gasto */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Tipo de Movimiento
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleTypeChange("income")}
                  className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold border transition active:scale-[0.98] ${
                    type === "income"
                      ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-500 shadow-sm"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <ArrowUpCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  Ingreso (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange("expense")}
                  className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold border transition active:scale-[0.98] ${
                    type === "expense"
                      ? "bg-rose-50 text-rose-700 border-2 border-rose-500 shadow-sm"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <ArrowDownCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  Gasto (-)
                </button>
              </div>
            </div>

            {/* Categoría según el tipo */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Categoría
              </label>
              {type === "income" ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCategoryChange("fijo")}
                    className={`rounded-xl p-2.5 sm:p-3 text-center text-xs font-bold border transition active:scale-[0.98] ${
                      category === "fijo"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-500 shadow-sm"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="briefcase" className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
                    <div>Fijo</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">Salario base</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange("variable")}
                    className={`rounded-xl p-2.5 sm:p-3 text-center text-xs font-bold border transition active:scale-[0.98] ${
                      category === "variable"
                        ? "bg-teal-50 text-teal-800 border-teal-500 shadow-sm"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="trend" className="mx-auto mb-1 h-5 w-5 text-teal-600" />
                    <div>Variable</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">Extras / Ventas</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange("pasivo")}
                    className={`rounded-xl p-2.5 sm:p-3 text-center text-xs font-bold border transition active:scale-[0.98] ${
                      category === "pasivo"
                        ? "bg-cyan-50 text-cyan-800 border-cyan-500 shadow-sm"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="wallet" className="mx-auto mb-1 h-5 w-5 text-cyan-600" />
                    <div>Pasivo</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">CDA / Rentas</div>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCategoryChange("fijo")}
                    className={`rounded-xl p-2.5 sm:p-3 text-center text-xs font-bold border transition active:scale-[0.98] ${
                      category === "fijo"
                        ? "bg-slate-800 text-white border-slate-900 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="home" className="mx-auto mb-1 h-5 w-5 text-slate-600" />
                    <div>Gasto Fijo</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">Alquiler/ANDE</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange("variable")}
                    className={`rounded-xl p-2.5 sm:p-3 text-center text-xs font-bold border transition active:scale-[0.98] ${
                      category === "variable"
                        ? "bg-amber-50 text-amber-800 border-amber-500 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="cart" className="mx-auto mb-1 h-5 w-5 text-amber-600" />
                    <div>Variable</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">Super / Nafta</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange("al_pedo")}
                    className={`rounded-xl p-2.5 sm:p-3 text-center text-xs font-black border relative overflow-hidden transition active:scale-[0.98] ${
                      category === "al_pedo"
                        ? "bg-orange-50 text-orange-600 border-orange-500 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <FinanceIcon name="flame" className="mx-auto mb-1 h-5 w-5 text-orange-600" />
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="h-3 w-3 text-orange-500 inline" />
                      ¡AL PEDO!
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">Caprichos</div>
                  </button>
                </div>
              )}
            </div>

            {/* Monto con Tipografía Grande y Steppers Táctiles */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="transaction-amount" className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Monto ({currencySymbol})
                </label>
                {formattedAmountPreview() && (
                  <span className="text-xs font-mono font-black text-blue-600 animate-in fade-in">
                    {formattedAmountPreview()}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-3 text-xl font-bold text-slate-400">
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-12 py-3 text-2xl font-black text-slate-900 font-mono placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  autoFocus
                />
                {amount && (
                  <button
                    type="button"
                    onClick={clearAmount}
                    className="absolute right-3 top-3 h-8 w-8 rounded-lg bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs font-black transition active:scale-90"
                    title="Limpiar monto"
                  >
                    AC
                  </button>
                )}
              </div>

              {/* Native Quick Steppers Chips (+10k, +25k, +50k, +100k, +500k) */}
              <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                  Sumar:
                </span>
                <button
                  type="button"
                  onClick={() => addAmount(10000)}
                  className="min-h-10 shrink-0 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 text-xs font-mono font-bold transition active:scale-95 border border-slate-200/60"
                >
                  +10k
                </button>
                <button
                  type="button"
                  onClick={() => addAmount(25000)}
                  className="min-h-10 shrink-0 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 text-xs font-mono font-bold transition active:scale-95 border border-slate-200/60"
                >
                  +25k
                </button>
                <button
                  type="button"
                  onClick={() => addAmount(50000)}
                  className="min-h-10 shrink-0 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 text-xs font-mono font-bold transition active:scale-95 border border-slate-200/60"
                >
                  +50k
                </button>
                <button
                  type="button"
                  onClick={() => addAmount(100000)}
                  className="min-h-10 shrink-0 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1656DB] px-2.5 py-1 text-xs font-mono font-black transition active:scale-95 border border-blue-200/60"
                >
                  +100k
                </button>
                <button
                  type="button"
                  onClick={() => addAmount(500000)}
                  className="min-h-10 shrink-0 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1656DB] px-2.5 py-1 text-xs font-mono font-black transition active:scale-95 border border-blue-200/60"
                >
                  +500k
                </button>
              </div>
            </div>

            {/* Descripción con Chips Táctiles y Smart Suggestion */}
            <div>
              <label htmlFor="transaction-description" className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Detalle / Descripción
              </label>
              <input
                id="transaction-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Bolt, Biggie, Lomito, ANDE..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 font-semibold transition"
              />

              {/* Smart Al Pedo Suggestion Banner */}
              {isAlPedoSuggested && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-2.5 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                    <span className="text-xs font-bold text-orange-800 truncate">
                      ¿Este gasto es capricho?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={applyAlPedoSuggestion}
                    className="shrink-0 rounded-lg bg-orange-500 text-white px-2.5 py-1 text-xs font-black shadow-sm hover:bg-orange-600 transition active:scale-95"
                  >
                    Marcar ¡Al Pedo!
                  </button>
                </div>
              )}

              {/* Quick chips con scroll horizontal táctil */}
              {type === "expense" && (
                <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                    Frecuentes:
                  </span>
                  {paraguayFrequentMerchants.map((merchant) => (
                    <button
                      key={merchant}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setDescription(merchant);
                      }}
                      className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition active:scale-95"
                    >
                      {merchant}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {quickPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setDescription(preset);
                    }}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition active:scale-95"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha & Recurrente */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label htmlFor="transaction-date" className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Fecha
                </label>
                <input
                  id="transaction-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 font-semibold focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 font-bold cursor-pointer hover:bg-slate-100 transition">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => {
                      triggerHaptic("selection");
                      setIsRecurring(e.target.checked);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">Repite cada mes</span>
                </label>
              </div>
            </div>
          </div>

          {/* Botones de acción anclados abajo con pb-safe y feedback táctil */}
          <div className="flex items-center gap-2.5 border-t border-slate-100 pt-3 pb-safe shrink-0 mt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                if (!editingTransaction) {
                  try { localStorage.removeItem(draftKey); } catch { /* El navegador puede impedir el almacenamiento local. */ }
                }
                onClose();
              }}
              className="flex-1 h-12 rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] h-12 flex items-center justify-center gap-2 rounded-xl bg-[#1656DB] text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-md shadow-blue-500/20 active:scale-[0.98]"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>{loading ? "Guardando..." : editingTransaction ? "Actualizar" : isOnline ? "Guardar Movimiento" : "Guardar borrador"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

