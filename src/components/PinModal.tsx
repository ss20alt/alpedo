"use client";

import React, { useState } from "react";
import {
  Lock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Delete,
  UserPlus,
  LogIn,
  Mail,
  User,
  CheckCircle2,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import FinanceIcon from "@/components/FinanceIcon";

interface PinModalProps {
  isConfigured: boolean;
  onAuthenticated: () => void;
}

export default function PinModal({ isConfigured, onAuthenticated }: PinModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [useEmailLogin, setUseEmailLogin] = useState(false);

  // Login states
  const [loginEmail, setLoginEmail] = useState("");
  const [pin, setPin] = useState("");

  // Register states
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPin, setRegPin] = useState("");
  const [regConfirmPin, setRegConfirmPin] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    triggerHaptic("warning");
    setTimeout(() => setShake(false), 500);
  };

  // Direct PIN verification
  const verifyAndSubmit = async (pinToTest: string, emailToTest?: string) => {
    setError(null);
    setLoading(true);
    try {
      const payload: { action: string; pin: string; email?: string } = {
        action: "login",
        pin: pinToTest,
      };
      if (emailToTest && emailToTest.trim().length > 0) {
        payload.email = emailToTest.trim();
      }

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "PIN incorrecto");
        triggerShake();
        setPin("");
      } else {
        triggerHaptic("success");
        onAuthenticated();
      }
    } catch {
      setError("Error al conectar con el servidor");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Handle Login Form Submit
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length < 4) {
      setError("El PIN debe tener al menos 4 números");
      triggerShake();
      return;
    }
    await verifyAndSubmit(pin, useEmailLogin ? loginEmail : undefined);
  };

  // Handle Register Form Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regName.trim() || regName.trim().length < 2) {
      setError("Ingresá tu nombre o apodo (mínimo 2 letras)");
      triggerShake();
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setError("Ingresá un correo electrónico válido");
      triggerShake();
      return;
    }
    if (regPin.length < 4) {
      setError("El PIN debe tener al menos 4 números");
      triggerShake();
      return;
    }
    if (regPin !== regConfirmPin) {
      setError("Los PINs no coinciden. Verificalos.");
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          name: regName.trim(),
          email: regEmail.trim(),
          pin: regPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear la cuenta");
        triggerShake();
      } else {
        triggerHaptic("success");
        // Reset tour state so the new tester gets the interactive guided tour
        if (typeof window !== "undefined") {
          localStorage.removeItem("alpedo_tour_completed");
        }
        onAuthenticated();
      }
    } catch {
      setError("Error al registrarse. Verificá tu conexión.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Touch Keypad for Login
  const handleKeyPress = (num: string) => {
    if (pin.length < 12) {
      triggerHaptic("light");
      const next = pin + num;
      setPin(next);
      setError(null);

      // Instant native auto-submit on 4th digit if in direct PIN mode
      if (!useEmailLogin && next.length === 4) {
        setTimeout(() => {
          verifyAndSubmit(next);
        }, 120);
      }
    }
  };

  const handleBackspace = () => {
    triggerHaptic("medium");
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  // Quick Demo Login Shortcut
  const handleDemoLogin = () => {
    triggerHaptic("selection");
    setPin("1234");
    setTimeout(() => {
      verifyAndSubmit("1234");
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 select-none overflow-y-auto">
      <div
        className={`w-full max-w-sm rounded-[32px] border border-slate-100 bg-white p-6 sm:p-7 shadow-2xl text-slate-900 animate-in fade-in zoom-in-95 duration-200 my-auto ${
          shake ? "animate-shake" : ""
        }`}
      >
        {/* Logo and Header */}
        <div className="text-center">
          <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#104BC9] to-[#1656DB] text-white shadow-md shadow-blue-600/25">
            <FinanceIcon name="brand" className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
            <span>alpedo</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5">
            Finanzas Inteligentes Paraguay
          </p>
        </div>

        {/* Mode Switcher Segmented Control */}
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-100 p-1 flex gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setMode("login");
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition active:scale-95 ${
              mode === "login"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Iniciar Sesión</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setMode("register");
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition active:scale-95 ${
              mode === "register"
                ? "bg-[#1656DB] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Registrarse</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-3.5 flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-bold animate-in fade-in duration-150">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {/* ================= MODE 1: LOGIN ================= */}
        {mode === "login" && (
          <form onSubmit={handleLoginSubmit} className="mt-3.5 space-y-3">
            {/* Optional Email input */}
            {useEmailLogin && (
              <div className="animate-in fade-in duration-200">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="tu-correo@ejemplo.com"
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-2.5 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-[#1656DB] focus:outline-none transition"
                  />
                  <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>
            )}

            {/* PIN Input Display */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  PIN de Acceso (4 dígitos)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setUseEmailLogin(!useEmailLogin);
                    setError(null);
                  }}
                  className="text-[10px] font-bold text-[#1656DB] hover:underline"
                >
                  {useEmailLogin ? "Entrar solo con PIN" : "Entrar con correo"}
                </button>
              </div>

              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full text-center tracking-widest text-2xl font-mono rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-[#1656DB] focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition"
                  autoFocus
                />
                <KeyRound className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Quick Touch Keypad */}
            {!useEmailLogin && (
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleKeyPress(n.toString())}
                    className="flex h-11 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-900 hover:bg-slate-200 active:bg-slate-300 active:scale-95 transition"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="flex h-11 items-center justify-center rounded-2xl bg-slate-100/70 text-slate-600 hover:bg-slate-200 active:bg-slate-300 active:scale-95 transition"
                  aria-label="Borrar"
                >
                  <Delete className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleKeyPress("0")}
                  className="flex h-11 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-900 hover:bg-slate-200 active:bg-slate-300 active:scale-95 transition"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("medium");
                    setPin("");
                  }}
                  className="flex h-11 items-center justify-center rounded-2xl bg-slate-100/70 text-[11px] font-bold text-slate-500 hover:bg-slate-200 active:bg-slate-300 active:scale-95 transition"
                >
                  Limpiar
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full h-11 rounded-2xl bg-[#1656DB] text-xs font-black text-white hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50 transition shadow-md shadow-blue-600/25 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Entrar al Sistema</span>
                </>
              )}
            </button>

            {/* Quick Demo Test Access Button */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleDemoLogin}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-[11px] font-black text-[#1656DB] hover:bg-blue-100 active:scale-95 transition"
              >
                <span className="inline-flex items-center gap-1.5"><FinanceIcon name="zap" className="h-3.5 w-3.5" /> Entrar como demo (PIN 1234)</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= MODE 2: REGISTER ================= */}
        {mode === "register" && (
          <form onSubmit={handleRegisterSubmit} className="mt-3.5 space-y-2.5 animate-in fade-in duration-200">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Tu Nombre o Apodo
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Ej: Santi, Vale, Kp"
                  required
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-2 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-[#1656DB] focus:outline-none transition"
                />
                <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="tu-correo@ejemplo.com"
                  required
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-2 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-[#1656DB] focus:outline-none transition"
                />
                <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Elegí tu PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={regPin}
                  onChange={(e) => setRegPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  required
                  className="w-full text-center tracking-widest text-lg font-mono rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-2 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-[#1656DB] focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Confirmar PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={regConfirmPin}
                  onChange={(e) => setRegConfirmPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  required
                  className="w-full text-center tracking-widest text-lg font-mono rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-2 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-[#1656DB] focus:outline-none transition"
                />
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2 text-[10px] text-blue-900 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1656DB] shrink-0" />
              <span>Tus movimientos y saldo estarán 100% aislados en tu propia cuenta.</span>
            </div>

            <button
              type="submit"
              disabled={loading || regPin.length < 4 || regName.length < 2 || !regEmail.includes("@")}
              className="w-full h-11 rounded-2xl bg-[#1656DB] text-xs font-black text-white hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50 transition shadow-md shadow-blue-600/25 flex items-center justify-center gap-1.5 mt-2"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Crear mi Cuenta y Comenzar</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
