"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Flame,
  CheckCircle2,
  Share2,
  PiggyBank,
  TrendingUp,
  Lightbulb,
  Check,
  CircleAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getParaguayMonthString } from "@/lib/date-utils";
import SectionSkeleton from "@/components/SectionSkeleton";
import { getPrefetchedSectionData, peekPrefetchedSectionData, refreshSectionData } from "@/lib/section-data-cache";

interface ChallengeTabProps {
  currencySymbol: string;
  userId: number;
  active?: boolean;
}

interface ChallengeData {
  salary: number;
  start_month: string;
  completed_months: number[];
}

export default function ChallengeTab({ currencySymbol, userId, active = true }: ChallengeTabProps) {
  const cachedChallenge = peekPrefetchedSectionData<ChallengeData>("/api/challenge", userId);
  const hasLoadedOnce = useRef(Boolean(cachedChallenge));
  const hasActivated = useRef(false);
  const [salary, setSalary] = useState<number>(cachedChallenge?.salary ?? 0);
  const [startMonth, setStartMonth] = useState<string>(cachedChallenge?.start_month ?? getParaguayMonthString());
  const [completedMonths, setCompletedMonths] = useState<number[]>(cachedChallenge?.completed_months ?? []);
  const [loading, setLoading] = useState<boolean>(!cachedChallenge);
  const [loadError, setLoadError] = useState("");
  const [salaryDraft, setSalaryDraft] = useState(cachedChallenge ? String(cachedChallenge.salary) : "");
  const [startMonthDraft, setStartMonthDraft] = useState(cachedChallenge?.start_month ?? getParaguayMonthString());
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [savingMonthIndex, setSavingMonthIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showAllMonths, setShowAllMonths] = useState(false);

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  // Load challenge from API
  const fetchChallenge = useCallback(async (showLoading = true, force = false) => {
      try {
        if (showLoading) setLoading(true);
        setLoadError("");
        const data = force
          ? await refreshSectionData<ChallengeData>("/api/challenge", userId)
          : await getPrefetchedSectionData<ChallengeData>("/api/challenge", userId);
        setSalary(data.salary);
        setSalaryDraft(String(data.salary));
        setStartMonth(data.start_month);
        setStartMonthDraft(data.start_month);
        setCompletedMonths(Array.isArray(data.completed_months) ? data.completed_months : []);
        hasLoadedOnce.current = true;
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "No se pudo cargar el reto.");
      } finally {
        if (showLoading) setLoading(false);
      }
    }, [userId]);

  useEffect(() => {
    if (!active) return;
    const shouldRefresh = hasActivated.current && hasLoadedOnce.current;
    hasActivated.current = true;
    const timer = window.setTimeout(() => void fetchChallenge(!hasLoadedOnce.current, shouldRefresh), 0);
    return () => window.clearTimeout(timer);
  }, [active, fetchChallenge]);

  // Save configuration only after the user finishes editing.
  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSalary = Number(salaryDraft);
    if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
      setNotice({ type: "error", text: "Ingresá un salario mensual mayor que cero." });
      return;
    }

    try {
      setIsSavingConfig(true);
      setNotice(null);
      const res = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_config", salary: parsedSalary, start_month: startMonthDraft }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar la configuración.");
      setSalary(data.salary);
      setSalaryDraft(String(data.salary));
      setStartMonth(data.start_month);
      setStartMonthDraft(data.start_month);
      hasLoadedOnce.current = true;
      void fetchChallenge(false, true);
      setNotice({ type: "success", text: "Configuración guardada." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "No se pudo guardar. Probá de nuevo." });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Toggle month completion and reflect the server result only after it saves.
  const toggleMonth = async (monthIndex: number) => {
    try {
      setSavingMonthIndex(monthIndex);
      setNotice(null);
      const res = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_month", month_index: monthIndex }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar este mes.");
      setCompletedMonths(data.completed_months);
      void fetchChallenge(false, true);
      setNotice({ type: "success", text: data.completed_months.includes(monthIndex) ? "Mes marcado como cumplido." : "Se quitó la marca de este mes." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "No se pudo guardar. Probá de nuevo." });
    } finally {
      setSavingMonthIndex(null);
    }
  };

  const formatMoney = (val: number) => Math.round(val || 0).toLocaleString("es-PY");
  const draftSalaryValue = Number(salaryDraft);
  const previewSalary = Number.isFinite(draftSalaryValue) && draftSalaryValue > 0 ? draftSalaryValue : 0;
  const previewStartMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(startMonthDraft) ? startMonthDraft : startMonth;
  const hasConfigChanges = String(salary) !== salaryDraft || startMonth !== startMonthDraft;

  // Calculate 12-month sequence details
  const getChallengeMonths = () => {
    const [startYearStr, startMonthStr] = previewStartMonth.split("-");
    const sYear = parseInt(startYearStr, 10) || new Date().getFullYear();
    const sMonth = (parseInt(startMonthStr, 10) || new Date().getMonth() + 1) - 1; // 0-indexed

    const list = [];
    let runningTotal = 0;

    for (let i = 1; i <= 12; i++) {
      const date = new Date(Date.UTC(sYear, sMonth + (i - 1), 1));
      const name = `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
      const percentage = i;
      const amount = Math.round((previewSalary * percentage) / 100);
      runningTotal += amount;

      list.push({
        index: i,
        monthName: name,
        percentage,
        amount,
        runningTotal,
        isCompleted: completedMonths.includes(i),
      });
    }
    return list;
  };

  const challengeMonths = getChallengeMonths();
  const [currentYear, currentMonth] = getParaguayMonthString().split("-").map(Number);
  const planStartDate = new Date(`${previewStartMonth}-01T00:00:00Z`);
  const currentDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  const currentPlanMonth = Math.min(12, Math.max(1,
    (currentDate.getUTCFullYear() - planStartDate.getUTCFullYear()) * 12
      + currentDate.getUTCMonth() - planStartDate.getUTCMonth() + 1,
  ));
  const totalSavedSoFar = challengeMonths
    .filter((m) => m.isCompleted)
    .reduce((acc, m) => acc + m.amount, 0);
  const totalPotentialSaved = challengeMonths[11]?.runningTotal || 0;
  const progressPercent = Math.round((completedMonths.length / 12) * 100);

  const copyShareText = async (monthIndex: number, monthName: string, amount: number, percent: number) => {
    const text = `Separé el ${percent}% de mi sueldo de ${monthName} (${currencySymbol} ${formatMoney(amount)}) para el reto de ahorro del 1%.\nMes ${monthIndex} de 12 cumplido.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(monthIndex);
      setNotice({ type: "success", text: "Mensaje copiado; ya podés pegarlo en WhatsApp." });
      window.setTimeout(() => setCopiedIndex((current) => current === monthIndex ? null : current), 2500);
    } catch {
      setNotice({ type: "error", text: "No se pudo copiar el mensaje. Revisá los permisos del navegador e intentá de nuevo." });
    }
  };

  if (loading) {
    return <SectionSkeleton label="Cargando reto de ahorro" />;
  }

  if (loadError && !hasLoadedOnce.current) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center text-rose-900" role="alert">
        <CircleAlert className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
        <p className="text-sm font-semibold">{loadError}</p>
        <button type="button" onClick={() => void fetchChallenge()} className="mt-3 min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-rose-700 shadow-sm">Reintentar</button>
      </div>
    );
  }

  return (
      <div className="space-y-4 pb-8 sm:space-y-6 sm:pb-12">
      {loadError && hasLoadedOnce.current && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <span>No se pudieron actualizar los datos. Se muestra la última información cargada.</span>
          <button type="button" onClick={() => void fetchChallenge(false, true)} className="min-h-10 shrink-0 rounded-xl bg-white px-3 font-bold text-amber-800 shadow-sm">Reintentar</button>
        </div>
      )}
      {notice && (
        <div className={`flex items-start gap-2 rounded-2xl border p-3 text-sm font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`} role="status" aria-live="polite">
          {notice.type === "success" ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="ml-auto min-h-6 px-1 text-current/70" aria-label="Cerrar aviso">×</button>
        </div>
      )}
      {/* 1. Hero Banner */}
      <div id="tour-challenge-card" className="app-mobile-surface relative overflow-hidden rounded-[24px] border border-orange-200/80 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/80 p-4 text-slate-900 shadow-[0_4px_24px_rgba(249,115,22,0.06)] sm:rounded-[28px] sm:p-7">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="app-mobile-kicker inline-flex items-center gap-1.5 rounded-full bg-orange-100 border border-orange-200 px-3 py-1 text-xs font-black text-orange-700 uppercase tracking-widest shadow-sm">
              <Flame className="h-4 w-4 text-orange-500 shrink-0 " />
              <span>RETO DE AHORRO</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Arranca el reto del 1%
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed font-medium">
              Cada vez que cobres, separá el porcentaje del mes antes de destinar el resto. El porcentaje empieza en 1% y aumenta un punto por mes; podés adaptar el monto a tu situación.
            </p>
          </div>

          <div className="app-mobile-subcard shrink-0 rounded-2xl border border-orange-200 bg-white p-3 text-center shadow-sm sm:p-4 sm:text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Total al Completar (12 Meses)
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 mt-0.5">
              {currencySymbol} {formatMoney(totalPotentialSaved)}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-1">
              {previewSalary > 0
                ? "El plan suma el 78% de un sueldo mensual"
                : "Ingresá tu salario para calcular el plan"}
            </div>
          </div>
        </div>

        {/* Regla de Oro Callout */}
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 sm:mt-5 sm:gap-3 sm:p-4">
          <Lightbulb className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="leading-relaxed font-medium">
              <strong className="text-amber-900 font-bold">Para organizarlo:</strong> podés separar el ahorro en una cuenta, un sobre o una billetera digital. Así queda aparte de tus gastos diarios.
          </div>
        </div>

        <div className="app-mobile-subcard mt-4 rounded-xl border border-orange-100 bg-white/75 p-3 text-xs text-slate-600 sm:hidden">
          <span className="font-black text-blue-700">1% → 12%</span>
          <span className="ml-2">Subí un punto por mes y marcá el ahorro cuando lo separes.</span>
        </div>

        {/* 3-Step Interactive Methodology */}
        <div className="mt-4 hidden grid-cols-1 gap-2.5 sm:grid sm:grid-cols-3">
          <div className="rounded-xl bg-white/75 border border-orange-100 p-2.5">
            <div className="text-[11px] font-black text-orange-700">Mes 1 · Empezá con 1%</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">{previewSalary > 0 ? `Con el sueldo ingresado, 1% equivale a ${currencySymbol} ${formatMoney(Math.round(previewSalary / 100))}.` : "El primer mes corresponde al 1% del sueldo ingresado."}</div>
          </div>
          <div className="rounded-xl border border-orange-100 bg-white/75 p-2.5">
            <div className="text-[11px] font-black text-orange-700">Meses 2–11 · Aumentá gradualmente</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">Cada mes subís un punto porcentual, de forma gradual y sostenida.</div>
          </div>
          <div className="rounded-xl bg-white/75 border border-orange-100 p-2.5">
            <div className="text-[11px] font-black text-orange-700">Mes 12 · Completá el plan</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">Al completar los 12 meses, el ahorro acumulado equivale al 78% de un sueldo mensual.</div>
          </div>
        </div>
      </div>

      {/* 2. Configurador de Salario & Mes de Inicio */}
      <form onSubmit={saveConfig} className="app-mobile-surface rounded-[24px] border border-slate-100 bg-white p-4 text-slate-900 shadow-[0_4px_24px_rgba(0,0,0,0.03)] sm:rounded-[28px] sm:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Configurá tu Salario para el Reto</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Los porcentajes se calculan automáticamente sobre lo que cobrás.
            </p>
          </div>

          {/* Month selector */}
          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor="challenge-start-month" className="text-xs font-bold text-slate-600">Mes de inicio</label>
            <input
              id="challenge-start-month"
              type="month"
              value={startMonthDraft}
              onChange={(e) => setStartMonthDraft(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none sm:w-auto"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div>
            <label htmlFor="challenge-salary" className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-500">
              Tu Salario Mensual ({currencySymbol})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-base font-bold text-slate-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                id="challenge-salary"
                min="1"
                step="1"
                inputMode="numeric"
                value={salaryDraft}
                onChange={(e) => setSalaryDraft(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 font-mono text-lg font-black text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Valores Rápidos en Paraguay
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "₲ 3M", val: 3000000 },
                { label: "₲ 4M", val: 4000000 },
                { label: "₲ 5M", val: 5000000 },
                { label: "₲ 7.5M", val: 7500000 },
                { label: "₲ 10M", val: 10000000 },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setSalaryDraft(String(item.val))}
                  aria-pressed={Number(salaryDraft) === item.val}
                  className={`app-mobile-choice min-h-11 rounded-xl px-3 text-xs font-mono font-bold transition active:scale-95 ${
                    Number(salaryDraft) === item.val
                      ? "bg-slate-900 text-white font-black shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button type="submit" disabled={isSavingConfig || !hasConfigChanges} className="mt-4 min-h-12 w-full rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-default disabled:opacity-60 sm:w-auto sm:min-w-48">
          {isSavingConfig ? "Guardando…" : hasConfigChanges ? "Guardar configuración" : "Configuración guardada"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          {hasConfigChanges ? "El plan muestra una vista previa. Guardá para conservar los cambios." : "El plan usa tu sueldo y mes de inicio guardados."}
        </p>
      </form>

      {/* 3. Panel de Progreso del Reto */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4">
        {/* Guardado hasta hoy */}
        <div className="flex min-w-0 flex-col justify-between rounded-[22px] border border-emerald-200/80 bg-emerald-50/60 p-3 text-slate-900 shadow-sm sm:rounded-[24px] sm:p-5">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
              Aportes marcados
            </span>
            <div className="mt-1 break-all font-mono text-lg font-black text-emerald-700 sm:text-2xl">
              {currencySymbol} {formatMoney(totalSavedSoFar)}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 font-medium">
            {completedMonths.length === 0
              ? "Marcá cada aporte después de separarlo."
              : `Suma de los ${completedMonths.length} meses marcados.`}
          </div>
        </div>

        {/* Porcentaje Cumplido */}
        <div className="app-mobile-surface flex min-w-0 flex-col justify-between rounded-[22px] border border-slate-100 bg-white p-3 text-slate-900 shadow-sm sm:rounded-[24px] sm:p-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Progreso del Reto
              </span>
              <span className="text-xs font-black text-blue-700 font-mono">
                {progressPercent}%
              </span>
            </div>
            <div className="mt-2 text-xl font-black text-slate-900 font-mono sm:text-2xl">
              {completedMonths.length} / 12 <span className="text-xs text-slate-400 font-medium">meses</span>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-label="Progreso del reto de ahorro"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
              />
            </div>
          </div>
        </div>

        {/* Meta Acumulada Anual */}
        <div className="col-span-2 flex min-w-0 flex-col justify-between rounded-[22px] border border-slate-100 bg-white p-3 text-slate-900 shadow-sm sm:col-span-1 sm:rounded-[24px] sm:p-5">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Meta al Mes 12
            </span>
            <div className="mt-1 break-words text-xl font-black text-slate-900 font-mono sm:text-2xl">
              {currencySymbol} {formatMoney(totalPotentialSaved)}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 font-medium">
            Falta guardar: <strong className="text-slate-800 font-mono font-bold">{currencySymbol} {formatMoney(Math.max(0, totalPotentialSaved - totalSavedSoFar))}</strong>
          </div>
        </div>
      </div>

      {/* 4. Roadmap de los 12 Meses */}
        <div className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600 shrink-0" />
              <span>El Plan Mes a Mes (1% al 12%)</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Marcá cada mes apenas separes tu porcentaje al cobrar.
            </p>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Total acumulado al completar: <strong className="text-emerald-600 font-mono font-black">{currencySymbol} {formatMoney(totalPotentialSaved)}</strong>
          </div>
        </div>

        {/* 12 Months Cards Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {challengeMonths.map((m) => (
            <div
              key={m.index}
              className={`${m.index !== currentPlanMonth && !showAllMonths ? "hidden sm:flex" : "flex"} rounded-2xl border p-4 flex-col justify-between transition-all ${
                m.isCompleted
                  ? "border-emerald-200 bg-emerald-50/40 shadow-sm"
                  : m.index === currentPlanMonth
                    ? "border-blue-200 bg-blue-50/50 shadow-sm"
                    : "border-slate-100 bg-slate-50/50 hover:border-slate-200 shadow-sm"
              }`}
            >
              <div>
                {/* Header card */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black font-mono ${
                        m.isCompleted
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      M{m.index}
                    </span>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">{m.monthName}</div>
                      <div className="text-[10px] text-slate-400 font-medium">Mes {m.index} del reto</div>
                    </div>
                  </div>

                  {/* Percentage Badge */}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-black font-mono border ${
                      m.isCompleted
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-orange-100 text-orange-700 border-orange-200"
                    }`}
                  >
                    {m.percentage}%
                  </span>
                </div>

                {/* Amount to separate */}
                <div className={`mt-3 rounded-xl p-3 border ${
                  m.isCompleted ? "bg-white border-emerald-100" : "bg-white border-slate-100"
                }`}>
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                    A separar este mes:
                  </div>
                  <div
                    className={`text-xl font-black font-mono mt-0.5 ${
                      m.isCompleted ? "text-emerald-600" : "text-slate-900"
                    }`}
                  >
                    {currencySymbol} {formatMoney(m.amount)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-medium">
                    <span>Acumulado hasta aquí:</span>
                    <span className="font-mono text-slate-600 font-bold">
                      {currencySymbol} {formatMoney(m.runningTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleMonth(m.index)}
                  disabled={savingMonthIndex !== null}
                  aria-label={m.isCompleted ? `Quitar marca de ${m.monthName}` : `Marcar ${m.monthName} como cumplido`}
                  aria-pressed={m.isCompleted}
                  className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-black transition active:scale-95 disabled:cursor-wait disabled:opacity-60 ${
                    m.isCompleted
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  }`}
                >
                  {m.isCompleted ? (
                    <>
                      <Check className="h-4 w-4 stroke-[3]" />
                      <span>{savingMonthIndex === m.index ? "Guardando…" : "Hecho"}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>{savingMonthIndex === m.index ? "Guardando…" : "Marcar hecho"}</span>
                    </>
                  )}
                </button>

                {/* Share Button for Group */}
                <button
                  type="button"
                  onClick={() => copyShareText(m.index, m.monthName, m.amount, m.percentage)}
                  className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95 shrink-0"
                  aria-label={`Copiar mensaje del mes ${m.index}, ${m.monthName}`}
                  disabled={savingMonthIndex !== null}
                >
                  {copiedIndex === m.index ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              {copiedIndex === m.index && (
                <div className="mt-1 text-center text-[10px] font-bold text-emerald-700" role="status" aria-live="polite">
                  Mensaje copiado. Ya podés pegarlo en WhatsApp.
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-center sm:hidden">
          <button
            type="button"
            onClick={() => setShowAllMonths((shown) => !shown)}
            aria-expanded={showAllMonths}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition active:scale-[0.98]"
          >
            {showAllMonths ? "Mostrar solo el mes actual" : `Ver ${challengeMonths.length - 1} meses restantes`}
            {showAllMonths ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
