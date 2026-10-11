"use client";

import { useEffect, useRef } from "react";
import { trapDialogTab } from "@/lib/dialog-keyboard";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  destructive?: boolean;
}

export default function ConfirmDialog({ title, description, confirmLabel, onCancel, onConfirm, busy = false, destructive = false }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-3 sm:items-center" onClick={onCancel} role="presentation">
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); else trapDialogTab(e); }} className="w-full max-w-sm rounded-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-900 shadow-2xl">
      <h2 id="confirm-title" className="text-lg font-black">{title}</h2>
      <p id="confirm-description" className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="h-11 rounded-xl bg-slate-100 text-sm font-bold text-slate-800 disabled:opacity-50">Cancelar</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={`h-11 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${destructive ? "bg-rose-600" : "bg-[#1656DB]"}`}>{busy ? "Procesando…" : confirmLabel}</button>
      </div>
    </div>
  </div>;
}
