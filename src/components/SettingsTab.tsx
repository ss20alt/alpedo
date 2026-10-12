"use client";

import React, { useState } from "react";
import {
  Settings,
  Shield,
  Download,
  Upload,
  Database,
  Check,
  AlertCircle,
  LogOut,
  FileSpreadsheet,
  Trash2,
  HelpCircle,
  BookOpen,
  Share2,
  KeyRound,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import ConfirmDialog from "@/components/ConfirmDialog";
import AccountDeletionDialog from "@/components/AccountDeletionDialog";
import { percentile75, readPerformanceSamples, type PerformanceSamples } from "@/lib/performance";

interface SettingsTabProps {
  currentUser?: { id: number; name: string; email: string } | null;
  onRefreshData: () => void;
  onLogout: () => void;
  onStartTour?: () => void;
}

export default function SettingsTab({
  currentUser,
  onRefreshData,
  onLogout,
  onStartTour,
}: SettingsTabProps) {

  // Change PIN state
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [recoveryPin, setRecoveryPin] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);

  // Seed demo state
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // Clear data state
  const [clearing, setClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingBackup, setPendingBackup] = useState<{ name: string; data: Record<string, unknown>; details: string } | null>(null);
  const [restoringBackup, setRestoringBackup] = useState(false);

  // Invite link state
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [webVitals, setWebVitals] = useState<PerformanceSamples | null>(null);

  const handleCopyInviteLink = () => {
    triggerHaptic("selection");
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
    }
  };

  // Change PIN
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    if (!/^\d{6,12}$/.test(newPin)) {
      setPinError("El nuevo PIN debe tener de 6 a 12 números");
      return;
    }

    setPinLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_pin",
          oldPin,
          newPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || "Error al cambiar el PIN");
      } else {
        setPinSuccess("PIN de esta cuenta actualizado. Se cerraron las otras sesiones.");
        setRecoveryCode(null);
        setOldPin("");
        setNewPin("");
        setTimeout(() => setPinSuccess(null), 3000);
      }
    } catch {
      setPinError("Sin conexión. No se pudo cambiar el PIN.");
    } finally {
      setPinLoading(false);
    }
  };

  const handleGenerateRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoveryLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_recovery_code", pin: recoveryPin }),
      });
      const data = await res.json();
      if (!res.ok) setRecoveryError(data.error || "No se pudo generar el código");
      else {
        setRecoveryCode(data.code);
        setRecoveryCopied(false);
        setRecoveryPin("");
      }
    } catch {
      setRecoveryError("Sin conexión. Intentá de nuevo.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Load demo seed
  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        setSeedSuccess(true);
        onRefreshData();
        setTimeout(() => setSeedSuccess(false), 3000);
      }
    } finally {
      setSeeding(false);
    }
  };

  // Clear all transactions for production clean slate
  const handleClearAllTransactions = async () => {
    setConfirmClear(false);
    setClearing(true);
    try {
      const res = await fetch("/api/transactions?all=true", { method: "DELETE" });
      if (res.ok) {
        triggerHaptic("success");
        setClearSuccess(true);
        onRefreshData();
        setTimeout(() => setClearSuccess(false), 3500);
      } else {
        setBackupNotice({ type: "error", text: "No se pudieron eliminar los movimientos. Intentá de nuevo." });
      }
    } catch {
      setBackupNotice({ type: "error", text: "Sin conexión. Los movimientos no se eliminaron." });
    } finally {
      setClearing(false);
    }
  };

  // Preview locally before modifying account data.
  const handleUploadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("El respaldo supera 2 MB.");
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray((parsed as Record<string, unknown>).transactions)) throw new Error("El archivo no tiene movimientos válidos.");
      const data = parsed as Record<string, unknown>;
      const sections = [["transactions", "movimientos"], ["savings_challenge", "retos"], ["couples_goals", "metas"], ["couples_contributions", "aportes"], ["friend_streaks", "rachas"], ["simulations", "simulaciones"]] as const;
      const details = sections.map(([key, label]) => `${Array.isArray(data[key]) ? data[key].length : 0} ${label}`).join(", ");
      setPendingBackup({ name: file.name, data, details });
      setBackupNotice(null);
    } catch (error) {
      setBackupNotice({ type: "error", text: error instanceof Error ? error.message : "Archivo inválido." });
    } finally {
      e.target.value = "";
    }
  };

  const handleConfirmBackup = async () => {
    if (!pendingBackup) return;
    setRestoringBackup(true);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingBackup.data),
      });
      if (res.ok) {
        const result = await res.json();
        triggerHaptic("success");
        setBackupNotice({ type: result.skipped > 0 ? "error" : "success", text: `${result.restored} registros restaurados${result.remapped ? ` (${result.remapped} movimientos reasignados a esta cuenta)` : ""}${result.skipped ? `; ${result.skipped} omitidos por conflicto o datos inválidos` : ""}.` });
        onRefreshData();
      } else {
        triggerHaptic("error");
        const data = await res.json().catch(() => null);
        setBackupNotice({ type: "error", text: data?.error || "No se pudo restaurar la copia." });
      }
    } catch {
      triggerHaptic("error");
      setBackupNotice({ type: "error", text: "Sin conexión. No se pudo restaurar la copia." });
    } finally {
      setPendingBackup(null);
      setRestoringBackup(false);
    }
  };

  return (
    <div id="tour-settings-card" className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      {/* 0. Perfil de Usuario & Enlace para Compartir */}
      <div className="app-mobile-surface rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50/20 to-white p-5 sm:p-6 shadow-[0_4px_24px_rgba(22,86,219,0.06)] text-slate-900 md:col-span-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#104BC9] to-[#2563EB] flex items-center justify-center text-white shadow-md shadow-blue-600/25 shrink-0 text-xl font-black">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {currentUser?.name || "Usuario de Prueba"}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Activo
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {currentUser?.email || ""}
              </p>
              <p className="flex items-center gap-1.5 text-[11px] text-[#1656DB] font-semibold mt-0.5">
                <Shield className="h-3.5 w-3.5 shrink-0" /> Iniciá sesión con tu correo y PIN
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="flex-1 sm:flex-none h-10 px-3.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#1656DB] text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition"
              title="Copiar enlace para que otros se registren y prueben"
            >
              {copiedInvite ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Enlace copiado</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  <span>Compartir enlace</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onLogout();
              }}
              className="flex-1 sm:flex-none h-10 px-3.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Moneda & Formato */}
      <div className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900 md:col-span-2 md:flex md:items-center md:justify-between md:gap-6">
        <div className="md:max-w-2xl">
          <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 mb-1">
            <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-[#1656DB] shrink-0" />
            <span>Formato de Moneda</span>
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium mb-4 sm:mb-5 md:mb-0">
            Los movimientos se registran en guaraníes paraguayos. No se realiza conversión de monedas.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 md:min-w-[280px] md:text-center">
          ₲ Guaraní paraguayo · PYG
        </div>
      </div>

      {/* 2. PIN y acceso */}
      <div className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />
          <span>Cambiar PIN</span>
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 font-medium mb-4 sm:mb-5">
          Actualizá el PIN que usás para iniciar sesión.
        </p>

        <form onSubmit={handleChangePin} className="space-y-3.5 sm:space-y-4">
          <div>
            <label htmlFor="settings-current-pin" className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              PIN Actual
            </label>
            <input
              id="settings-current-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value)}
              placeholder="••••"
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label htmlFor="settings-new-pin" className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Nuevo PIN (6 a 12 números)
            </label>
            <input
              id="settings-new-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="••••"
              minLength={6}
              maxLength={12}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          {pinError && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}

          {pinSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
              <Check className="h-4 w-4" />
              <span>{pinSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={pinLoading || !oldPin || !newPin}
            onClick={() => triggerHaptic("light")}
            className="w-full sm:w-auto h-11 flex items-center justify-center rounded-xl bg-slate-900 px-6 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 active:scale-95 transition"
          >
            {pinLoading ? "Actualizando..." : "Actualizar PIN"}
          </button>
        </form>
      </div>

      <div className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 text-slate-900">
        <h3 className="flex items-center gap-2 text-sm font-black"><KeyRound className="h-5 w-5 text-[#1656DB]" /> Recuperar acceso</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">Generá un código de respaldo y guardalo fuera de esta app. Sirve una sola vez si olvidás tu PIN. Al generar otro, el anterior deja de funcionar.</p>
        <form onSubmit={handleGenerateRecoveryCode} className="mt-4 flex flex-col gap-2">
          <label htmlFor="recovery-current-pin" className="text-xs font-bold text-slate-600">Confirmá tu PIN actual</label>
          <input id="recovery-current-pin" type="password" inputMode="numeric" autoComplete="current-password" value={recoveryPin} onChange={(e) => setRecoveryPin(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base" />
          <button type="submit" disabled={recoveryLoading || !recoveryPin} className="h-11 rounded-xl bg-[#1656DB] px-4 text-xs font-black text-white disabled:opacity-50">{recoveryLoading ? "Generando…" : "Generar código de respaldo"}</button>
        </form>
        {recoveryError && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">{recoveryError}</p>}
        {recoveryCode && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-900">Copialo ahora: no volverá a mostrarse.</p>
          <code className="mt-2 block break-all text-sm font-bold text-slate-900 select-text">{recoveryCode}</code>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void navigator.clipboard.writeText(recoveryCode).then(() => setRecoveryCopied(true)).catch(() => setRecoveryError("No se pudo copiar. Seleccioná el código y guardalo manualmente."))} className="h-10 rounded-xl bg-white px-4 text-xs font-bold text-[#1656DB] border border-blue-200">{recoveryCopied ? "Copiado" : "Copiar"}</button>
            <button type="button" onClick={() => setRecoveryCode(null)} className="h-10 rounded-xl px-4 text-xs font-bold text-slate-600">Ya lo guardé</button>
          </div>
        </div>}
      </div>

      {/* 3. Base de Datos & Copias de Seguridad */}
      <div className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />
          <span>Respaldos y exportación</span>
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 font-medium mb-4 sm:mb-5">
          Descargá un respaldo completo o restaurá una copia anterior. También podés exportar tus movimientos en CSV.
        </p>

        <div className="space-y-3">
          <a
            href="/api/backup"
            download
            onClick={() => triggerHaptic("light")}
            className="flex w-full h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition"
          >
            <Download className="h-4 w-4 text-[#1656DB]" />
            <span>Descargar Respaldo Completo (JSON)</span>
          </a>

          <a
            href="/api/transactions/export"
            download
            onClick={() => triggerHaptic("light")}
            className="flex w-full h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Exportar Movimientos a Excel (CSV)</span>
          </a>

          <label className="flex w-full h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 cursor-pointer transition">
            <Upload className="h-4 w-4 text-cyan-600" />
            <span>Restaurar Copia desde JSON</span>
            <input type="file" accept=".json" onChange={handleUploadBackup} className="hidden" />
          </label>
        </div>
      </div>

      {/* 4. Datos de Prueba & Sesión */}
      <div className="app-mobile-surface rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900 flex flex-col justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 mb-1">
            <Database className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 shrink-0" />
          <span>Datos de prueba</span>
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium mb-3">
            Cargá datos de ejemplo o eliminá los movimientos registrados.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            {process.env.NODE_ENV !== "production" && <button
              onClick={() => {
                triggerHaptic("light");
                handleSeedDemo();
              }}
              disabled={seeding || clearing}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-orange-50 border border-orange-200 px-4 text-xs font-black text-orange-700 hover:bg-orange-100 active:scale-95 transition"
            >
              <Database className="h-4 w-4 text-orange-500" />
              <span>{seeding ? "Cargando..." : "Cargar Demo Paraguay"}</span>
            </button>}

            <button
              onClick={() => { triggerHaptic("warning"); setConfirmClear(true); }}
              disabled={clearing || seeding}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 text-xs font-black text-rose-700 hover:bg-rose-100 active:scale-95 transition"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              <span>{clearing ? "Vaciando..." : "Limpiar Movimientos"}</span>
            </button>
          </div>

          {seedSuccess && (
            <p className="mt-2 text-xs font-bold text-emerald-600">
              Datos de ejemplo cargados.
            </p>
          )}

          {clearSuccess && (
            <p className="mt-2 text-xs font-bold text-emerald-600">
              Movimientos eliminados.
            </p>
          )}
          {backupNotice && <p role="status" aria-live="polite" className={`mt-2 text-xs font-bold ${backupNotice.type === "error" ? "text-rose-700" : "text-emerald-700"}`}>{backupNotice.text}</p>}
        </div>

      </div>

      {currentUser && <section aria-labelledby="delete-account-heading" className="rounded-[28px] border border-rose-200 bg-white p-4 shadow-[0_4px_24px_rgba(190,18,60,0.04)] text-slate-900 sm:p-6 md:col-span-2">
        <h3 id="delete-account-heading" className="flex items-center gap-2 text-sm font-black text-rose-800">
          <Trash2 className="h-4 w-4" /> Eliminar cuenta
        </h3>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-600">
          Borrá permanentemente tu perfil y sus datos. Antes podés descargar un respaldo completo desde «Respaldos y exportación».
        </p>
        <button type="button" onClick={() => setConfirmDeleteAccount(true)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-800 transition hover:bg-rose-100 active:scale-[0.99] sm:w-auto">
          <Trash2 className="h-4 w-4" /> Eliminar mi cuenta y mis datos
        </button>
      </section>}

      {/* 5. Guía Interactiva & Tour del Sistema */}
      <div className="app-mobile-surface rounded-[28px] border border-slate-200 bg-white p-4 sm:p-6 text-slate-900 md:col-span-2">
        <h3 className="text-sm font-black">Rendimiento en este dispositivo</h3>
        <p className="mt-1 text-xs text-slate-500">Mediciones locales de carga, respuesta al toque, estabilidad y carga de datos. Se conservan hasta 30 muestras por métrica, sin datos de tu cuenta.</p>
        <button type="button" onClick={() => setWebVitals(readPerformanceSamples())} className="mt-3 min-h-11 rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-700">Ver mediciones</button>
        {webVitals && <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
          {(["LCP", "INP", "CLS", "DATA"] as const).map((name) => {
            const values = (webVitals[name] || []).map((sample) => sample.value);
            const p75 = percentile75(values);
            const target = { LCP: 2500, INP: 200, CLS: 0.1, DATA: 1500 }[name];
            return <div key={name} className="rounded-xl bg-slate-50 p-3"><strong className="block">{name}</strong><span className={p75 === null ? "text-slate-500" : p75 <= target ? "text-emerald-700" : "text-amber-700"}>{p75 === null ? "Pendiente" : name === "CLS" ? p75.toFixed(3) : `${Math.round(p75)} ms`}</span><small className="block text-slate-500">{values.length} muestras · P75</small></div>;
          })}
        </div>}
        {webVitals && <p className="mt-2 text-[11px] text-slate-500">DATA mide la respuesta de tus movimientos; su meta de 1,5 s es orientativa. LCP, INP y CLS son métricas del navegador. Medí varias cargas e interacciones en un teléfono real.</p>}
      </div>
      <div className="app-mobile-surface rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 p-4 sm:p-6 shadow-[0_4px_24px_rgba(22,86,219,0.06)] text-slate-900 md:col-span-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/80 px-2.5 py-0.5 text-[10px] font-black text-[#1656DB]">
              <BookOpen className="h-3 w-3" />
              <span>AYUDA</span>
            </div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#1656DB] shrink-0" />
              <span>Guía de alpedo.app</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium max-w-xl">
              ¿Querés repasar cómo funciona cada sección, el asistente ¿Me da el cuero? o el control de gastos? Volvé a iniciar el recorrido guiado cuando quieras.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              if (onStartTour) onStartTour();
            }}
            className="w-full sm:w-auto h-11 px-5 rounded-xl bg-[#1656DB] text-xs font-black text-white hover:bg-blue-600 active:scale-95 transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 shrink-0"
          >
            <BookOpen className="h-4 w-4 text-blue-200" />
            <span>Ver recorrido</span>
          </button>
        </div>
      </div>
      {confirmClear && <ConfirmDialog title="¿Eliminar todos los movimientos?" description="Se borrarán los gastos e ingresos de esta cuenta. Esta acción no se puede deshacer. Descargá un respaldo antes si querés conservarlos." confirmLabel="Eliminar" destructive busy={clearing} onCancel={() => setConfirmClear(false)} onConfirm={() => void handleClearAllTransactions()} />}
      {confirmDeleteAccount && currentUser && <AccountDeletionDialog email={currentUser.email} userId={currentUser.id} onCancel={() => setConfirmDeleteAccount(false)} onComplete={() => { setConfirmDeleteAccount(false); void onLogout(); }} />}
      {pendingBackup && <ConfirmDialog title="Restaurar respaldo" description={`Archivo: ${pendingBackup.name}. Contiene ${pendingBackup.details}. Puede actualizar datos que ya existen en esta cuenta. Los movimientos de otra cuenta se reasignarán cuando sea posible. Revisá que sea el archivo correcto antes de continuar.`} confirmLabel="Restaurar" busy={restoringBackup} onCancel={() => { if (!restoringBackup) setPendingBackup(null); }} onConfirm={() => void handleConfirmBackup()} />}
    </div>
  );
}
