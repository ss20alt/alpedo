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
  User,
  Share2,
  Copy,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface SettingsTabProps {
  currentUser?: { id: number; name: string; email: string } | null;
  currencySymbol: string;
  currencyCode: string;
  onSettingsSaved: (symbol: string, code: string) => void;
  onRefreshData: () => void;
  onLogout: () => void;
  onStartTour?: () => void;
}

export default function SettingsTab({
  currentUser,
  currencySymbol,
  currencyCode,
  onSettingsSaved,
  onRefreshData,
  onLogout,
  onStartTour,
}: SettingsTabProps) {
  const [symbol, setSymbol] = useState(currencySymbol);

  const [code, setCode] = useState(currencyCode);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyMsg, setCurrencyMsg] = useState<string | null>(null);

  // Change PIN state
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  // Seed demo state
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // Clear data state
  const [clearing, setClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  // Invite link state
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleCopyInviteLink = () => {
    triggerHaptic("selection");
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
    }
  };

  // Save currency settings
  const handleSaveCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCurrency(true);
    setCurrencyMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency_symbol: symbol,
          currency_code: code,
        }),
      });

      if (res.ok) {
        onSettingsSaved(symbol, code);
        setCurrencyMsg("Configuración de moneda guardada.");
        setTimeout(() => setCurrencyMsg(null), 3000);
      }
    } finally {
      setSavingCurrency(false);
    }
  };

  // Change PIN
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    if (newPin.length < 4) {
      setPinError("El nuevo PIN debe tener al menos 4 caracteres");
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
        setPinSuccess("PIN maestro modificado con éxito.");
        setOldPin("");
        setNewPin("");
        setTimeout(() => setPinSuccess(null), 3000);
      }
    } finally {
      setPinLoading(false);
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
    triggerHaptic("warning");
    const confirmDelete = window.confirm(
      "¿Estás seguro de que deseas eliminar TODOS los movimientos registrados? Esta acción te dejará con la base de datos limpia para tus finanzas reales."
    );
    if (!confirmDelete) return;

    setClearing(true);
    try {
      const res = await fetch("/api/transactions?all=true", { method: "DELETE" });
      if (res.ok) {
        triggerHaptic("success");
        setClearSuccess(true);
        onRefreshData();
        setTimeout(() => setClearSuccess(false), 3500);
      }
    } finally {
      setClearing(false);
    }
  };

  // Download backup
  const handleDownloadBackup = () => {
    triggerHaptic("light");
    window.location.href = "/api/backup";
  };

  // Upload backup
  const handleUploadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        triggerHaptic("success");
        alert("¡Copia de seguridad restaurada correctamente!");
        onRefreshData();
      } else {
        triggerHaptic("error");
        alert("Error al restaurar el archivo.");
      }
    } catch {
      triggerHaptic("error");
      alert("El archivo seleccionado no es un JSON de respaldo válido.");
    }
  };

  return (
    <div id="tour-settings-card" className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      {/* 0. Perfil de Usuario & Enlace para Compartir */}
      <div className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50/20 to-white p-5 sm:p-6 shadow-[0_4px_24px_rgba(22,86,219,0.06)] text-slate-900 md:col-span-2">
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
                {currentUser?.email || "demo@alpedo.app"}
              </p>
              <p className="flex items-center gap-1.5 text-[11px] text-[#1656DB] font-semibold mt-0.5">
                <Shield className="h-3.5 w-3.5 shrink-0" /> Tus datos están aislados y protegidos por tu PIN
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
                  <span className="text-emerald-700">¡Enlace Copiado!</span>
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
      <div className="rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 mb-1">
          <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-[#1656DB] shrink-0" />
          <span>Formato de Moneda</span>
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 font-medium mb-4 sm:mb-5">
          Definí cómo se visualizan los montos en la aplicación.
        </p>

        <form onSubmit={handleSaveCurrency} className="space-y-3.5 sm:space-y-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Símbolo de Moneda
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="₲"
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 font-mono font-bold focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Código / Nombre (Ej: PYG, USD)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PYG"
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 font-mono font-bold focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          {currencyMsg && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
              <Check className="h-4 w-4" />
              <span>{currencyMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={savingCurrency}
            onClick={() => triggerHaptic("light")}
            className="w-full sm:w-auto h-11 flex items-center justify-center rounded-xl bg-[#1656DB] px-6 text-xs font-black text-white hover:bg-blue-700 active:scale-95 transition shadow-md shadow-blue-500/20"
          >
            {savingCurrency ? "Guardando..." : "Guardar Preferencias"}
          </button>
        </form>
      </div>

      {/* 2. PIN Maestro & Seguridad */}
      <div className="rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />
          <span>Cambiar PIN Maestro</span>
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 font-medium mb-4 sm:mb-5">
          Cambiá la clave de acceso que protege tus finanzas.
        </p>

        <form onSubmit={handleChangePin} className="space-y-3.5 sm:space-y-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              PIN Actual
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value)}
              placeholder="••••"
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Nuevo PIN (Mínimo 4 caracteres)
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="••••"
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

      {/* 3. Base de Datos & Copias de Seguridad */}
      <div className="rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />
          <span>Respaldo & Portabilidad</span>
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 font-medium mb-4 sm:mb-5">
          Tus datos se guardan en tu base de datos segura. Descargá o restaurá copias en 1 clic.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleDownloadBackup}
            className="flex w-full h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition"
          >
            <Download className="h-4 w-4 text-[#1656DB]" />
            <span>Descargar Respaldo Completo (JSON)</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic("light");
              window.location.href = "/api/transactions/export";
            }}
            className="flex w-full h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Exportar Movimientos a Excel (CSV)</span>
          </button>

          <label className="flex w-full h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 cursor-pointer transition">
            <Upload className="h-4 w-4 text-cyan-600" />
            <span>Restaurar Copia desde JSON</span>
            <input type="file" accept=".json" onChange={handleUploadBackup} className="hidden" />
          </label>
        </div>
      </div>

      {/* 4. Datos de Prueba & Sesión */}
      <div className="rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900 flex flex-col justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 mb-1">
            <Database className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 shrink-0" />
            <span>Datos de Ejemplo & Limpieza</span>
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium mb-3">
            Cargá números de demostración en Guaraníes o limpialos para usar la app con tus datos reales.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => {
                triggerHaptic("light");
                handleSeedDemo();
              }}
              disabled={seeding || clearing}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-orange-50 border border-orange-200 px-4 text-xs font-black text-orange-700 hover:bg-orange-100 active:scale-95 transition"
            >
              <Database className="h-4 w-4 text-orange-500" />
              <span>{seeding ? "Cargando..." : "Cargar Demo Paraguay"}</span>
            </button>

            <button
              onClick={handleClearAllTransactions}
              disabled={clearing || seeding}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 text-xs font-black text-rose-700 hover:bg-rose-100 active:scale-95 transition"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              <span>{clearing ? "Vaciando..." : "Limpiar Movimientos"}</span>
            </button>
          </div>

          {seedSuccess && (
            <p className="mt-2 text-xs font-bold text-emerald-600">
              ¡Datos de ejemplo cargados con éxito!
            </p>
          )}

          {clearSuccess && (
            <p className="mt-2 text-xs font-bold text-emerald-600">
              ¡Movimientos eliminados! Base limpia para tus finanzas reales.
            </p>
          )}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-3">
          <button
            onClick={() => {
              triggerHaptic("medium");
              onLogout();
            }}
            className="flex items-center gap-2 text-xs font-black text-rose-600 hover:text-rose-700 active:scale-95 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar Sesión Segura</span>
          </button>
        </div>
      </div>

      {/* 5. Guía Interactiva & Tour del Sistema */}
      <div className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 p-4 sm:p-6 shadow-[0_4px_24px_rgba(22,86,219,0.06)] text-slate-900 md:col-span-2">
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
    </div>
  );
}
