"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Heart,
  Plane,
  Car,
  Home,
  Gem,
  Target,
  Plus,
  Copy,
  CheckCircle2,
  Clock,
  Trash2,
  PiggyBank,
  Wallet,
  CircleAlert,
  Check,
} from "lucide-react";
import FinanceIcon, { type FinanceIconName } from "@/components/FinanceIcon";
import { formatParaguayDateLabel, getParaguayDateString } from "@/lib/date-utils";
import ConfirmDialog from "@/components/ConfirmDialog";

interface CouplesGoal {
  id: number;
  title: string;
  category: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  invite_code: string | null;
  partner_user_id?: number | null;
  partner_name: string;
  creator_name: string;
  status: string;
  isOwner: boolean;
  isShared: boolean;
  myContributorName: string;
  progressPercent: number;
  remainingAmount: number;
  totalCreator: number;
  totalPartner: number;
}

interface Contribution {
  id: number;
  contributor_name: string;
  amount: number;
  note?: string;
  date: string;
}

interface CouplesTabProps {
  currencySymbol?: string;
}

async function copyTextWithFallback(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API can be unavailable on the HTTP address used by the VPS.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.setAttribute("aria-hidden", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  textArea.style.left = "0";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    textArea.remove();
  }
  return copied;
}

export default function CouplesTab({ currencySymbol = "₲" }: CouplesTabProps) {
  const [goal, setGoal] = useState<CouplesGoal | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmCloseGoal, setConfirmCloseGoal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // New goal form state
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("viaje");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [partnerName, setPartnerName] = useState("");

  // Contribution form state
  const [contribAmount, setContribAmount] = useState("");
  const [contribNote, setContribNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCouplesData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setLoadError("");
      const res = await fetch("/api/couples", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudieron cargar las metas de pareja.");
      }
      setGoal(data.goal);
      setContributions(data.contributions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar la meta compartida.";
      setLoadError(message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const resetNewGoal = () => {
    setTitle("");
    setCategory("viaje");
    setTargetAmount("");
    setTargetDate("");
    setPartnerName("");
    setShowNewGoal(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchCouplesData(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void fetchCouplesData(false);
    }, 30_000);
    const refreshOnFocus = () => void fetchCouplesData(false);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [fetchCouplesData]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/couples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_goal",
          title,
          category,
          target_amount: targetAmount,
          target_date: targetDate,
          partner_name: partnerName,
        }),
      });

      if (res.ok) {
        resetNewGoal();
        setNotice({ type: "success", text: "Meta creada. Ya podés empezar a registrar aportes." });
        await fetchCouplesData();
      } else {
        const data = await res.json().catch(() => null);
        setNotice({ type: "error", text: data?.error || "No se pudo crear la meta. Revisá los datos e intentá de nuevo." });
      }
    } catch {
      setNotice({ type: "error", text: "No se pudo conectar para crear la meta. Probá de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal || !contribAmount) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/couples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "contribute",
          goal_id: goal.id,
          amount: contribAmount,
          note: contribNote,
        }),
      });

      if (res.ok) {
        setContribAmount("");
        setContribNote("");
        setNotice({ type: "success", text: "Aporte sumado a la meta." });
        await fetchCouplesData();
      } else {
        const data = await res.json().catch(() => null);
        setNotice({ type: "error", text: data?.error || "No se pudo registrar el aporte. Revisá el monto e intentá de nuevo." });
      }
    } catch {
      setNotice({ type: "error", text: "No se pudo conectar para registrar el aporte. Probá de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsJoining(true);
    setNotice(null);
    try {
      const res = await fetch("/api/couples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join_goal", invite_code: joinCode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo vincular la meta. Revisá el código.");
      setJoinCode("");
      setNotice({ type: "success", text: "Meta vinculada. Los aportes y el progreso se sincronizan entre las dos cuentas." });
      await fetchCouplesData();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "No se pudo vincular la meta." });
    } finally {
      setIsJoining(false);
    }
  };

  const handleDeleteGoal = async () => {
    if (!goal?.invite_code) return;
    setConfirmCloseGoal(false);

    try {
      const res = await fetch(`/api/couples?id=${goal.id}`, { method: "DELETE" });
      if (res.ok) {
        setGoal(null);
        setContributions([]);
        setNotice({ type: "success", text: "Meta cerrada." });
      } else {
        setNotice({ type: "error", text: "No se pudo cerrar la meta. Actualizá la pantalla e intentá de nuevo." });
      }
    } catch {
      setNotice({ type: "error", text: "No se pudo conectar para cerrar la meta." });
    }
  };

  const formatMoney = (val: number) => Math.round(val || 0).toLocaleString("es-PY");

  const copyInvite = async () => {
    const inviteCode = goal?.invite_code;
    if (!inviteCode) return;
    try {
      const didCopy = await copyTextWithFallback(inviteCode);
      if (!didCopy) throw new Error("Clipboard unavailable");
      setCopied(true);
      setNotice({ type: "success", text: "Código copiado. Podés pegarlo en tu mensaje." });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setNotice({ type: "error", text: "No se pudo copiar. Mantené presionado el código visible para seleccionarlo." });
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "viaje":
        return <Plane className="h-6 w-6 text-blue-400" />;
      case "auto":
        return <Car className="h-6 w-6 text-blue-400" />;
      case "casa":
        return <Home className="h-6 w-6 text-blue-400" />;
      case "boda":
        return <Gem className="h-6 w-6 text-blue-400" />;
      default:
        return <Heart className="h-6 w-6 text-blue-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center" role="status" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" aria-hidden="true" />
        <span className="sr-only">Cargando metas compartidas</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center text-rose-900" role="alert">
        <CircleAlert className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
        <p className="text-sm font-semibold">{loadError}</p>
        <button type="button" onClick={() => void fetchCouplesData()} className="mt-3 min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-rose-700 shadow-sm">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-1 pb-8 sm:space-y-6 sm:pb-12">
      {notice && (
        <div className={`flex items-start gap-2 rounded-2xl border p-3 text-sm font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`} role="status" aria-live="polite">
          {notice.type === "success" ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="ml-auto min-h-6 px-1 text-current/70" aria-label="Cerrar aviso">×</button>
        </div>
      )}
      {/* Header Banner */}
      <div id="tour-couples-card" className="app-mobile-surface relative overflow-hidden rounded-[24px] border border-blue-200/80 bg-white p-4 shadow-sm text-slate-900 sm:rounded-[28px] sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="app-mobile-kicker inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-black text-blue-700 mb-3 shadow-sm">
              <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500" />
              Módulo Pareja • Ahorro Juntos
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Metas Compartidas con tu Pareja
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-xl font-medium">
              Vinculá dos cuentas para compartir una meta y sus aportes. Los movimientos y saldos personales permanecen privados.
            </p>
          </div>

          {!goal && !showNewGoal && (
            <button
              onClick={() => { resetNewGoal(); setShowNewGoal(true); }}
              className="app-mobile-primary inline-flex min-h-11 items-center gap-2 self-start rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-rose-700 transition active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Crear Meta Juntos
            </button>
          )}
        </div>

        {/* 3-Step Interactive Mini-Guide */}
        <div className="mt-6 pt-5 border-t border-blue-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="app-mobile-subcard rounded-2xl bg-white/80 border border-blue-100 p-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-blue-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px]">1</span>
              <span>Definí la meta</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Elegí qué quieren lograr: Camboriú, el auto o el chanchito común.
            </p>
          </div>

          <div className="app-mobile-subcard rounded-2xl bg-white/80 border border-blue-100 p-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-blue-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px]">2</span>
              <span>Aportes privados</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Cada aporte queda identificado con la cuenta que lo registra; tus movimientos personales quedan aparte.
            </p>
          </div>

          <div className="app-mobile-subcard rounded-2xl bg-white/80 border border-blue-100 p-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-blue-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px]">3</span>
              <span>Compartí el código</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              La otra persona acepta el código una vez y la meta aparece vinculada en ambas cuentas.
            </p>
          </div>
        </div>
      </div>

      {/* CREATE NEW GOAL FORM */}
      {showNewGoal && !goal && (
        <form
          onSubmit={handleCreateGoal}
          className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900 space-y-5 sm:rounded-[28px] sm:p-8"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Definir Nueva Meta en Pareja
            </h3>
            <button
              type="button"
              onClick={resetNewGoal}
              className="min-h-11 rounded-xl px-3 text-xs text-slate-500 hover:text-slate-700 font-bold"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="couple-goal-title" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                ¿Qué quieren lograr juntos?
              </label>
              <input
                type="text"
                id="couple-goal-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Vacaciones en Florianópolis"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 font-semibold focus:bg-white focus:border-blue-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="couple-partner-name" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Apodo o Nombre de tu Pareja
              </label>
              <input
                type="text"
                id="couple-partner-name"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Ej: Mi Chuli, María, Guille..."
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 font-semibold focus:bg-white focus:border-blue-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="couple-target-amount" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Monto Objetivo Total ({currencySymbol})
              </label>
              <input
                type="number"
                id="couple-target-amount"
                min="1000"
                step="1"
                inputMode="numeric"
                required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="Ej: 12000000"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 font-mono font-black focus:bg-white focus:border-blue-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="couple-target-date" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Fecha Estimada
              </label>
              <input
                type="date"
                id="couple-target-date"
                min={getParaguayDateString()}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 font-semibold focus:bg-white focus:border-blue-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Tipo de Meta
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "viaje", label: "Viaje / Vacaciones", icon: "plane" as FinanceIconName },
                { id: "auto", label: "Auto / Moto", icon: "car" as FinanceIconName },
                { id: "casa", label: "Depto / Muebles", icon: "home" as FinanceIconName },
                { id: "boda", label: "Casorio / Fiesta", icon: "ring" as FinanceIconName },
                { id: "ahorro", label: "Ahorro libre", icon: "target" as FinanceIconName },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                  className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    category === c.id
                      ? "bg-blue-500 text-white shadow-md shadow-blue-500/20 font-black"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <FinanceIcon name={c.icon} className="h-4 w-4 shrink-0" />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="app-mobile-primary w-full min-h-12 rounded-2xl bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 transition active:scale-[0.98]"
          >
            {isSubmitting ? "Creando meta..." : "¡Iniciar Meta Compartida!"}
          </button>
        </form>
      )}

      {/* EMPTY STATE TEMPLATES */}
      {!goal && !showNewGoal && (
        <div className="app-mobile-surface rounded-[24px] border border-blue-100 bg-white p-4 shadow-[0_4px_24px_rgba(244,63,94,0.04)] text-slate-900 space-y-5 sm:rounded-[28px] sm:p-8 sm:space-y-6">
          <form onSubmit={handleJoinGoal} className="app-mobile-subcard rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:flex sm:items-end sm:gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="couples-join-code" className="block text-xs font-black text-blue-900">¿Te invitaron a una meta?</label>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Pegá el código que te compartió tu pareja. Al aceptar, ambos verán el objetivo, los aportes y el progreso.</p>
              <input
                id="couples-join-code"
                type="text"
                required
                maxLength={30}
                autoCapitalize="characters"
                autoComplete="off"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="Ej.: JUNTOS-AB12CD34"
                className="mt-2 h-11 w-full rounded-xl border border-blue-200 bg-white px-3 font-mono text-sm font-bold tracking-wide text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button type="submit" disabled={isJoining || !joinCode.trim()} className="app-mobile-primary mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-extrabold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60 active:scale-[0.98] sm:mt-0 sm:w-auto">
              {isJoining ? "Vinculando…" : "Aceptar invitación"}
            </button>
          </form>

          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl shadow-sm border border-blue-100">
              <PiggyBank className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Todavía no crearon un chanchito juntos
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Elegí una plantilla rápida o creá una meta a tu medida para empezar a sumar aportes juntos con tu pareja.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {[
              {
                title: "Viaje a Camboriú fin de año",
                cat: "viaje",
                target: 12000000,
                desc: "Pasajes, posada y caipirinhas en la playa",
                icon: "plane" as FinanceIconName,
              },
              {
                title: "Entrega inicial para el auto",
                cat: "auto",
                target: 15000000,
                desc: "Primer paso para comprar nuestro vehículo",
                icon: "car" as FinanceIconName,
              },
              {
                title: "Muebles & Deco para el Dpto",
                cat: "casa",
                target: 6000000,
                desc: "Heladera, sommier y sillón para la sala",
                icon: "home" as FinanceIconName,
              },
              {
                title: "Fiesta o Casamiento soñado",
                cat: "boda",
                target: 30000000,
                desc: "El gran día con familia y amigos",
                icon: "ring" as FinanceIconName,
              },
            ].map((tpl) => (
              <button
                key={tpl.title}
                type="button"
                onClick={() => {
                  setPartnerName("");
                  setTargetDate("");
                  setTitle(tpl.title);
                  setCategory(tpl.cat);
                  setTargetAmount(String(tpl.target));
                  setShowNewGoal(true);
                }}
                className="flex min-h-[88px] items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:bg-blue-50/50 hover:border-blue-200 active:scale-[0.99] group sm:gap-3.5 sm:p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
                  <FinanceIcon name={tpl.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                    {tpl.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {tpl.desc}
                  </div>
                  <div className="text-xs font-mono font-black text-slate-700 mt-1.5">
                    Meta: {currencySymbol} {formatMoney(tpl.target)}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="pt-2 text-center">
            <button
              onClick={() => { resetNewGoal(); setShowNewGoal(true); }}
              className="app-mobile-primary inline-flex min-h-11 items-center gap-2 rounded-2xl bg-rose-600 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Definir Meta Personalizada</span>
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE GOAL VIEW */}
      {goal && (
        <div className="space-y-6">
          {goal.isOwner && !goal.isShared && (
            <form onSubmit={handleJoinGoal} className="app-mobile-subcard rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:flex sm:items-end sm:gap-3">
              <div className="min-w-0 flex-1">
                <label htmlFor="couples-join-code-active" className="block text-xs font-black text-blue-900">¿Te invitaron a una meta compartida?</label>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Al aceptar, tu meta personal actual se archivará con sus aportes guardados.</p>
                <input
                  id="couples-join-code-active"
                  type="text"
                  required
                  maxLength={30}
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="Código de invitación"
                  className="mt-2 h-11 w-full rounded-xl border border-blue-200 bg-white px-3 font-mono text-sm font-bold tracking-wide text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button type="submit" disabled={isJoining || !joinCode.trim()} className="app-mobile-primary mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-extrabold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60 active:scale-[0.98] sm:mt-0 sm:w-auto">
                {isJoining ? "Vinculando…" : "Aceptar invitación"}
              </button>
            </form>
          )}

          {/* Main Shared Goal Card */}
          <div className="app-mobile-surface relative space-y-5 overflow-hidden rounded-[24px] border border-blue-200/80 bg-white p-4 text-slate-900 shadow-sm sm:rounded-[28px] sm:p-8 sm:space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200">
                  {getCategoryIcon(goal.category)}
                </div>
                <div className="min-w-0">
                  <h3 className="break-words text-xl font-black text-slate-900 sm:text-2xl">{goal.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                    <span>Meta de: <strong>{goal.creator_name || "Vos"}</strong> y <strong>{goal.partner_name}</strong></span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${goal.isShared ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {goal.isShared ? "SINCRONIZADA" : "ESPERANDO INVITACIÓN"}
                    </span>
                    {goal.target_date && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatParaguayDateLabel(String(goal.target_date).slice(0, 10))}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start">
                {goal.isOwner && (
                  <button
                    onClick={() => setConfirmCloseGoal(true)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Cerrar meta compartida"
                    title="Cerrar meta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {goal.isOwner && goal.invite_code && !goal.isShared && (
              <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Código para invitar</p>
                  <code className="mt-1 block select-all break-all font-mono text-sm font-black tracking-wide text-slate-900" aria-label="Código de invitación seleccionable">
                    {goal.invite_code}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => void copyInvite()}
                  aria-label={copied ? "Código de invitación copiado" : "Copiar código de invitación"}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-xs font-black text-blue-700 transition hover:bg-blue-100 active:scale-[0.98]"
                >
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  {copied ? "¡Copiado!" : "Copiar código"}
                </button>
              </div>
            )}

            {/* Huge Progress Visual */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="min-w-0">
                  <span className="block break-words text-2xl font-black text-slate-900 font-mono sm:inline sm:text-4xl">
                    {currencySymbol} {formatMoney(goal.current_amount)}
                  </span>
                  <span className="text-xs font-bold text-slate-500 sm:ml-2 sm:text-sm">
                    de {currencySymbol} {formatMoney(goal.target_amount)}
                  </span>
                </div>
                <div className="shrink-0 text-xl font-black font-mono text-blue-600 sm:text-3xl">
                  {goal.progressPercent}%
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200/80">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${goal.progressPercent}%` }}
                  role="progressbar"
                  aria-label="Progreso de la meta compartida"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={goal.progressPercent}
                />
              </div>

              {/* Milestones Road */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 text-center pt-3 border-t border-slate-100 text-[11px] sm:text-xs text-slate-500 font-medium">
                <div className={goal.progressPercent >= 25 ? "text-blue-600 font-bold" : ""}>
                  <span className="flex flex-col items-center gap-1"><Target className="h-4 w-4" />25% Primer tramo</span>
                </div>
                <div className={goal.progressPercent >= 50 ? "text-blue-600 font-bold" : ""}>
                  <span className="flex flex-col items-center gap-1"><Target className="h-4 w-4" />50% Mitad del camino</span>
                </div>
                <div className={goal.progressPercent >= 75 ? "text-blue-600 font-bold" : ""}>
                  <span className="flex flex-col items-center gap-1"><Wallet className="h-4 w-4" />75% Cerca de la meta</span>
                </div>
                <div className={goal.progressPercent >= 100 ? "text-emerald-600 font-bold" : ""}>
                  <span className="flex flex-col items-center gap-1"><CheckCircle2 className="h-4 w-4" />100% ¡Logrado!</span>
                </div>
              </div>
            </div>

            {/* Split Contributions stats */}
            <div className="grid grid-cols-2 gap-2 pt-2 sm:gap-3">
              <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50 p-3 sm:p-4">
                <span className="text-xs text-slate-500 block font-bold mb-1">
                  Aporte de {goal.creator_name || "Vos"}:
                </span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {currencySymbol} {formatMoney(goal.totalCreator)}
                </span>
              </div>
              <div className="min-w-0 rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3 sm:p-4">
                <span className="text-xs text-blue-700 block font-bold mb-1">
                  Aporte de {goal.partner_name}:
                </span>
                <span className="break-all text-base font-black text-blue-700 font-mono sm:text-lg">
                  {currencySymbol} {formatMoney(goal.totalPartner)}
                </span>
              </div>
            </div>

            {/* Add Contribution Form */}
            <form
              onSubmit={handleAddContribution}
              className="rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4 space-y-3"
            >
              <div className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                <PiggyBank className="h-4 w-4 text-blue-600" />
                Sumar un Aporte al Chanchito Compartido
              </div>
              <p className="text-[11px] text-slate-600">El aporte se registra a nombre de {goal.myContributorName}; la otra cuenta no puede atribuirlo por vos.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="couple-contribution-amount" className="sr-only">Monto del aporte en {currencySymbol}</label>
                  <input
                    type="number"
                    id="couple-contribution-amount"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    required
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    placeholder="Monto (₲)"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="couple-contribution-note" className="sr-only">Nota opcional del aporte</label>
                  <input
                    type="text"
                    id="couple-contribution-note"
                    value={contribNote}
                    onChange={(e) => setContribNote(e.target.value)}
                    placeholder="Nota (Ej: Cocinamos en casa)"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !contribAmount}
                className="w-full min-h-11 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 transition disabled:opacity-50 active:scale-[0.98]"
              >
                {isSubmitting ? "Sumando..." : "Sumar aporte al pozo"}
              </button>
            </form>

            {/* Contributions History */}
            {contributions.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Historial de Aportes Recientes:
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                  {contributions.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 sm:flex-1">
                        <span className="font-extrabold text-slate-900">{c.contributor_name}</span>
                        {c.note && <span className="ml-2 text-slate-500 italic">{c.note}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:shrink-0">
                        <span className="font-mono font-black text-blue-600">
                          +{currencySymbol} {formatMoney(c.amount)}
                        </span>
                        <span className="text-[11px] text-slate-600 font-medium">{formatParaguayDateLabel(String(c.date).slice(0, 10))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {confirmCloseGoal && <ConfirmDialog title="¿Cerrar esta meta compartida?" description="La meta dejará de mostrarse para ambos participantes. Guardá un respaldo si necesitás conservar el historial." confirmLabel="Cerrar meta" destructive onCancel={() => setConfirmCloseGoal(false)} onConfirm={() => void handleDeleteGoal()} />}
    </div>
  );
}
