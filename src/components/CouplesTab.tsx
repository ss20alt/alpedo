"use client";

import React, { useState, useEffect } from "react";
import {
  Heart,
  Plane,
  Car,
  Home,
  Gem,
  Sparkles,
  Plus,
  Share2,
  CheckCircle2,
  Clock,
  Trash2,
  PiggyBank,
  PartyPopper,
  Flame,
} from "lucide-react";

interface CouplesGoal {
  id: number;
  title: string;
  category: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  invite_code: string;
  partner_name: string;
  creator_name: string;
  status: string;
  progressPercent: number;
  remainingAmount: number;
  totalMe: number;
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

export default function CouplesTab({ currencySymbol = "₲" }: CouplesTabProps) {
  const [goal, setGoal] = useState<CouplesGoal | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // New goal form state
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [title, setTitle] = useState("Viaje a Camboriú fin de año");
  const [category, setCategory] = useState("viaje");
  const [targetAmount, setTargetAmount] = useState("12000000");
  const [targetDate, setTargetDate] = useState("2026-12-31");
  const [partnerName, setPartnerName] = useState("Mi Chuli");

  // Contribution form state
  const [contribAmount, setContribAmount] = useState("");
  const [contribBy, setContribBy] = useState("Vos");
  const [contribNote, setContribNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCouplesData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/couples");
      if (res.ok) {
        const data = await res.json();
        setGoal(data.goal);
        setContributions(data.contributions || []);
      }
    } catch (err) {
      console.error("Error loading couples goal:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCouplesData();
  }, []);

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
        setShowNewGoal(false);
        await fetchCouplesData();
      }
    } catch (err) {
      console.error("Error creating goal:", err);
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
          contributor_name: contribBy,
          amount: contribAmount,
          note: contribNote,
        }),
      });

      if (res.ok) {
        setContribAmount("");
        setContribNote("");
        await fetchCouplesData();
      }
    } catch (err) {
      console.error("Error adding contribution:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async () => {
    if (!goal) return;
    if (!confirm("¿Querés cerrar esta meta compartida?")) return;

    try {
      const res = await fetch(`/api/couples?id=${goal.id}`, { method: "DELETE" });
      if (res.ok) {
        setGoal(null);
        setContributions([]);
      }
    } catch (err) {
      console.error("Error deleting goal:", err);
    }
  };

  const formatMoney = (val: number) => Math.round(val || 0).toLocaleString("es-PY");

  const copyInvite = () => {
    if (!goal) return;
    const text = `¡Amor! Creé nuestra meta "${goal.title}" en alpedo.app. Sumate con este código: ${goal.invite_code}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "viaje":
        return <Plane className="h-6 w-6 text-pink-400" />;
      case "auto":
        return <Car className="h-6 w-6 text-pink-400" />;
      case "casa":
        return <Home className="h-6 w-6 text-pink-400" />;
      case "boda":
        return <Gem className="h-6 w-6 text-pink-400" />;
      default:
        return <Heart className="h-6 w-6 text-pink-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div id="tour-couples-card" className="relative overflow-hidden rounded-[28px] border border-pink-200/80 bg-gradient-to-br from-pink-50/70 via-white to-rose-50/80 p-6 sm:p-8 shadow-[0_4px_24px_rgba(244,63,94,0.06)] text-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-100 px-3 py-1 text-xs font-black text-pink-700 mb-3 shadow-sm">
              <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500 animate-pulse" />
              Módulo Pareja • Ahorro Juntos
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Metas Compartidas con tu Pareja
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-xl font-medium">
              Ahorren juntos para el viaje de fin de año, el auto o el depto. Cada uno mantiene sus gastos privados y solo comparten el chanchito común.
            </p>
          </div>

          {!goal && !showNewGoal && (
            <button
              onClick={() => setShowNewGoal(true)}
              className="inline-flex items-center gap-2 self-start rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-3 text-sm font-black text-white shadow-md shadow-pink-500/20 hover:opacity-95 transition active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Crear Meta Juntos
            </button>
          )}
        </div>

        {/* 3-Step Interactive Mini-Guide */}
        <div className="mt-6 pt-5 border-t border-pink-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/80 border border-pink-100 p-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-pink-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-100 text-[10px]">1</span>
              <span>Definí la meta</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Elegí qué quieren lograr: Camboriú, el auto o el chanchito común.
            </p>
          </div>

          <div className="rounded-2xl bg-white/80 border border-pink-100 p-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-rose-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-[10px]">2</span>
              <span>Aportes privados</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Cada uno suma plata. Tu pareja ve el progreso sin ver tus otros gastos personales.
            </p>
          </div>

          <div className="rounded-2xl bg-white/80 border border-pink-100 p-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-purple-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[10px]">3</span>
              <span>Código Kp WhatsApp</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Enviá el enlace de invitación para que ambos celulares sincronicen el avance.
            </p>
          </div>
        </div>
      </div>

      {/* CREATE NEW GOAL FORM */}
      {showNewGoal && !goal && (
        <form
          onSubmit={handleCreateGoal}
          className="rounded-[28px] border border-slate-100 bg-white p-6 sm:p-8 space-y-5 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-500" />
              Definir Nueva Meta en Pareja
            </h3>
            <button
              type="button"
              onClick={() => setShowNewGoal(false)}
              className="text-xs text-slate-400 hover:text-slate-700 font-bold"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                ¿Qué quieren lograr juntos?
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Vacaciones en Florianópolis"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 font-semibold focus:bg-white focus:border-pink-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Apodo o Nombre de tu Pareja
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Ej: Mi Chuli, María, Guille..."
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 font-semibold focus:bg-white focus:border-pink-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Monto Objetivo Total ({currencySymbol})
              </label>
              <input
                type="number"
                min="1000"
                step="any"
                required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="Ej: 12000000"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 font-mono font-black focus:bg-white focus:border-pink-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Fecha Estimada
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 font-semibold focus:bg-white focus:border-pink-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Tipo de Meta
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "viaje", label: "Viaje / Vacaciones", icon: "✈️" },
                { id: "auto", label: "Auto / Moto", icon: "🚗" },
                { id: "casa", label: "Depto / Muebles", icon: "🏠" },
                { id: "boda", label: "Casorio / Fiesta", icon: "💍" },
                { id: "ahorro", label: "Ahorro Libre", icon: "🎯" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    category === c.id
                      ? "bg-pink-500 text-white shadow-md shadow-pink-500/20 font-black"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <span>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-sm font-black text-white hover:opacity-95 shadow-md shadow-pink-500/20 transition active:scale-[0.98]"
          >
            {isSubmitting ? "Creando meta..." : "¡Iniciar Meta Compartida!"}
          </button>
        </form>
      )}

      {/* EMPTY STATE TEMPLATES */}
      {!goal && !showNewGoal && (
        <div className="rounded-[28px] border border-pink-100 bg-white p-6 sm:p-8 space-y-6 shadow-[0_4px_24px_rgba(244,63,94,0.04)] text-slate-900">
          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50 text-3xl shadow-sm border border-pink-100">
              🐷
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
                icon: "🏖️",
              },
              {
                title: "Entrega inicial para el auto",
                cat: "auto",
                target: 15000000,
                desc: "Primer paso para comprar nuestro vehículo",
                icon: "🚗",
              },
              {
                title: "Muebles & Deco para el Dpto",
                cat: "hogar",
                target: 6000000,
                desc: "Heladera, sommier y sillón para la sala",
                icon: "🛋️",
              },
              {
                title: "Fiesta o Casamiento soñado",
                cat: "anillo",
                target: 30000000,
                desc: "El gran día con familia y amigos",
                icon: "💍",
              },
            ].map((tpl) => (
              <button
                key={tpl.title}
                type="button"
                onClick={() => {
                  setTitle(tpl.title);
                  setCategory(tpl.cat);
                  setTargetAmount(String(tpl.target));
                  setShowNewGoal(true);
                }}
                className="flex items-start gap-3.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-pink-50/50 hover:border-pink-200 transition text-left active:scale-[0.99] group"
              >
                <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">
                  {tpl.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-pink-600 transition-colors">
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
              onClick={() => setShowNewGoal(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 text-xs font-black text-white shadow-md shadow-pink-500/20 hover:opacity-95 transition active:scale-95"
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
          {/* Main Shared Goal Card */}
          <div className="rounded-[28px] border border-pink-200/80 bg-white p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-[0_4px_24px_rgba(244,63,94,0.06)] text-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 border border-pink-200">
                  {getCategoryIcon(goal.category)}
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">{goal.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                    <span>Meta de: <strong>{goal.creator_name || "Vos"}</strong> y <strong>{goal.partner_name}</strong></span>
                    {goal.target_date && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {goal.target_date}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyInvite}
                  className="flex items-center gap-1.5 rounded-xl border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-black text-pink-700 hover:bg-pink-100 transition"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {copied ? "¡Copiado!" : `Código: ${goal.invite_code}`}
                </button>
                <button
                  onClick={handleDeleteGoal}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 transition"
                  title="Eliminar meta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Huge Progress Visual */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
                    {currencySymbol} {formatMoney(goal.current_amount)}
                  </span>
                  <span className="text-sm font-bold text-slate-400 ml-2">
                    de {currencySymbol} {formatMoney(goal.target_amount)}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-pink-600">
                  {goal.progressPercent}%
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 transition-all duration-700"
                  style={{ width: `${goal.progressPercent}%` }}
                />
              </div>

              {/* Milestones Road */}
              <div className="grid grid-cols-4 text-center pt-2 border-t border-slate-100 text-[11px] sm:text-xs text-slate-500 font-medium">
                <div className={goal.progressPercent >= 25 ? "text-pink-600 font-bold" : ""}>
                  ✈️ 25% Pasajes
                </div>
                <div className={goal.progressPercent >= 50 ? "text-pink-600 font-bold" : ""}>
                  🏨 50% Hospedaje
                </div>
                <div className={goal.progressPercent >= 75 ? "text-pink-600 font-bold" : ""}>
                  🍹 75% Viáticos
                </div>
                <div className={goal.progressPercent >= 100 ? "text-emerald-600 font-bold" : ""}>
                  🏆 100% ¡Logrado!
                </div>
              </div>
            </div>

            {/* Split Contributions stats */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                <span className="text-xs text-slate-500 block font-bold mb-1">
                  Aporte de {goal.creator_name || "Vos"}:
                </span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {currencySymbol} {formatMoney(goal.totalMe)}
                </span>
              </div>
              <div className="rounded-2xl border border-pink-200/80 bg-pink-50/50 p-4">
                <span className="text-xs text-pink-700 block font-bold mb-1">
                  Aporte de {goal.partner_name}:
                </span>
                <span className="text-lg font-black text-pink-700 font-mono">
                  {currencySymbol} {formatMoney(goal.totalPartner)}
                </span>
              </div>
            </div>

            {/* Add Contribution Form */}
            <form
              onSubmit={handleAddContribution}
              className="rounded-2xl border border-pink-200/60 bg-pink-50/40 p-4 space-y-3"
            >
              <div className="text-xs font-black text-pink-900 flex items-center gap-1.5">
                <PiggyBank className="h-4 w-4 text-pink-600" />
                Sumar un Aporte al Chanchito Compartido
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    placeholder="Monto (₲)"
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 font-mono font-bold focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div>
                  <select
                    value={contribBy}
                    onChange={(e) => setContribBy(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 font-semibold focus:border-pink-500 focus:outline-none"
                  >
                    <option value={goal.creator_name || "Vos"}>Aporta: {goal.creator_name || "Vos"}</option>
                    <option value={goal.partner_name}>Aporta: {goal.partner_name}</option>
                  </select>
                </div>

                <div>
                  <input
                    type="text"
                    value={contribNote}
                    onChange={(e) => setContribNote(e.target.value)}
                    placeholder="Nota (Ej: Cocinamos en casa)"
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 font-medium focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !contribAmount}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-xs font-black text-white hover:opacity-95 shadow-md shadow-pink-500/20 transition disabled:opacity-50 active:scale-[0.98]"
              >
                {isSubmitting ? "Sumando..." : "Sumar Aporte al Pozo 🐷"}
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
                      className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">{c.contributor_name}</span>
                        {c.note && <span className="text-slate-500 italic">• "{c.note}"</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-pink-600">
                          +{currencySymbol} {formatMoney(c.amount)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{c.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
