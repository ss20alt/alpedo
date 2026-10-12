"use client";

import { type FormEvent, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { trapDialogTab } from "@/lib/dialog-keyboard";

interface AccountDeletionDialogProps {
  email: string;
  userId: number;
  onCancel: () => void;
  onComplete: () => void;
}

export default function AccountDeletionDialog({ email, userId, onCancel, onComplete }: AccountDeletionDialogProps) {
  const [typedEmail, setTypedEmail] = useState("");
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isReady = typedEmail.trim().toLowerCase() === email.toLowerCase()
    && confirmation.trim() === "ELIMINAR MI CUENTA"
    && /^\d{6,12}$/.test(pin);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isReady || busy) return;
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: typedEmail.trim(), pin, confirmation: confirmation.trim() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || "No se pudo eliminar la cuenta. Intentá de nuevo.");
        return;
      }

      try {
        localStorage.removeItem(`alpedo_privacy_mode_${userId}`);
        localStorage.removeItem(`alpedo_tour_completed_${userId}`);
        localStorage.removeItem(`alpedo_transaction_draft_${userId}`);
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (key?.startsWith(`reviewed_month_${userId}_`)) localStorage.removeItem(key);
        }
        if (localStorage.getItem("alpedo_last_email")?.toLowerCase() === email.toLowerCase()) {
          localStorage.removeItem("alpedo_last_email");
        }
      } catch {
        // Browser storage may be disabled; server-side account deletion remains complete.
      }
      onComplete();
    } catch {
      setError("Sin conexión. No se eliminó la cuenta. Verificá internet e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center" role="presentation" onClick={() => { if (!busy) onCancel(); }}>
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        aria-busy={busy}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onCancel();
          else trapDialogTab(event);
        }}
        className="max-h-[min(92dvh,780px)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-900 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><AlertTriangle className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 id="delete-account-title" className="text-lg font-black">Eliminar cuenta permanentemente</h2>
            <p id="delete-account-description" className="mt-1 text-sm leading-relaxed text-slate-600">Esta acción es definitiva. Descargá antes un respaldo desde Ajustes si querés conservar una copia.</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Cerrar" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/70 p-3 text-xs leading-relaxed text-rose-950">
          <p className="font-black">Se eliminarán de forma permanente:</p>
          <p className="mt-1">Tu perfil, movimientos, simulaciones, reto de ahorro, rachas, código de recuperación y metas que hayas creado con todos sus aportes.</p>
          <p className="mt-2">Si participás en la meta de otra persona, se quitará tu vínculo y tus aportes quedarán como «Cuenta eliminada», conservando el total de esa meta.</p>
          <p className="mt-2">Los borradores guardados en otros dispositivos no se pueden borrar desde acá; eliminá esos datos localmente en cada dispositivo.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="delete-account-email" className="mb-1 block text-xs font-bold text-slate-700">Escribí el correo de la cuenta</label>
            <input id="delete-account-email" type="email" autoComplete="off" value={typedEmail} onChange={(event) => setTypedEmail(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-rose-400 focus:bg-white" />
          </div>
          <div>
            <label htmlFor="delete-account-pin" className="mb-1 block text-xs font-bold text-slate-700">Confirmá con tu PIN actual</label>
            <input id="delete-account-pin" type="password" inputMode="numeric" autoComplete="current-password" minLength={6} maxLength={12} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 12))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-base tracking-[0.25em] text-slate-900 outline-none focus:border-rose-400 focus:bg-white" />
          </div>
          <div>
            <label htmlFor="delete-account-phrase" className="mb-1 block text-xs font-bold text-slate-700">Escribí <span className="font-black text-rose-700">ELIMINAR MI CUENTA</span> para confirmar</label>
            <input id="delete-account-phrase" type="text" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-rose-400 focus:bg-white" />
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={onCancel} disabled={busy} className="h-11 rounded-xl bg-slate-100 text-sm font-bold text-slate-800 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={!isReady || busy} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
              <Trash2 className="h-4 w-4" />{busy ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
