"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  Flame,
  LoaderCircle,
  RefreshCw,
  Share2,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  UserRoundPlus,
} from "lucide-react";

interface FriendStreak {
  friend_code: string;
  friend_name: string;
  connected: boolean;
  streak_count: number | null;
}

interface StreaksData {
  myFriendCode: string;
  myStreakDays: number;
  streakSource: "last_al_pedo" | "tracking_start" | "unknown";
  friends: FriendStreak[];
}

async function readApiError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export default function StreaksTab() {
  const [data, setData] = useState<StreaksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const [inputFriendCode, setInputFriendCode] = useState("");
  const [inputFriendName, setInputFriendName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [pendingDeleteCode, setPendingDeleteCode] = useState<string | null>(null);

  const fetchStreaksData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/streaks", { cache: "no-store" });
      if (!response.ok) throw new Error(await readApiError(response, "No pudimos cargar Rachas."));
      setData((await response.json()) as StreaksData);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No pudimos cargar Rachas.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchStreaksData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchStreaksData]);

  const shareCode = async () => {
    if (!data?.myFriendCode) return;
    setActionError("");
    const inviteText = `Sumate a mi desafío de Rachas en alpedo.app. Mi código es ${data.myFriendCode}.`;

    try {
      if (navigator.share) {
        await navigator.share({ title: "Mi código de Rachas", text: inviteText });
        setFeedback("Invitación lista para compartir.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteText);
        setCopied(true);
        setFeedback("Invitación copiada.");
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = inviteText;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const didCopy = document.execCommand("copy");
        textArea.remove();
        if (!didCopy) throw new Error("No se pudo copiar. Probá de nuevo.");
        setCopied(true);
        setFeedback("Invitación copiada.");
      }
      window.setTimeout(() => {
        setCopied(false);
        setFeedback("");
      }, 2500);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setActionError(error instanceof Error ? error.message : "No se pudo compartir el código.");
    }
  };

  const handleAddFriend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAdding(true);
    setActionError("");
    setFeedback("");

    try {
      const response = await fetch("/api/streaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_friend",
          friend_code: inputFriendCode,
          friend_name: inputFriendName,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "No se pudo conectar el duelo."));

      setInputFriendCode("");
      setInputFriendName("");
      setFeedback("Duelo conectado. Ya podés comparar sus días de racha.");
      await fetchStreaksData(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo conectar el duelo.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteFriend = async (friend: FriendStreak) => {
    if (!window.confirm(`¿Eliminar el duelo con ${friend.friend_name}?`)) return;
    setPendingDeleteCode(friend.friend_code);
    setActionError("");
    setFeedback("");
    try {
      const response = await fetch("/api/streaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_friend", friend_code: friend.friend_code }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "No se pudo eliminar el duelo."));
      setFeedback(`Se eliminó el duelo con ${friend.friend_name}.`);
      await fetchStreaksData(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo eliminar el duelo.");
    } finally {
      setPendingDeleteCode(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-64 max-w-4xl items-center justify-center" role="status" aria-label="Cargando Rachas">
        <LoaderCircle className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-4xl rounded-3xl border border-rose-100 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-700">{loadError || "No pudimos cargar Rachas."}</p>
        <button
          type="button"
          onClick={() => void fetchStreaksData()}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    );
  }

  const friendCount = data.friends.length;

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8 text-slate-900 sm:space-y-6 sm:pb-12">
      <section
        id="tour-streaks-card"
        className="overflow-hidden rounded-[26px] border border-orange-200/80 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4 shadow-[0_4px_24px_rgba(249,115,22,0.06)] sm:rounded-[28px] sm:p-8"
      >
        <div className="inline-flex min-h-8 items-center gap-2 rounded-full border border-orange-200 bg-orange-100 px-3 text-[11px] font-extrabold text-orange-800">
          <Flame className="h-3.5 w-3.5 text-orange-600" />
          Rachas y desafíos
        </div>

        <div className="mt-3 grid gap-4 sm:mt-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
          <div>
            <h2 className="text-[22px] font-black leading-tight tracking-tight sm:text-3xl">
              Sumá días de autocontrol
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              Cada día sin un gasto marcado como “Al Pedo” suma a tu racha. Tus movimientos y montos quedan privados.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-orange-200 bg-white px-4 py-3 shadow-sm sm:min-w-44 sm:flex-col sm:justify-center sm:px-6 sm:py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-700 sm:text-center">Tu racha actual</p>
              <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-500 sm:text-center">
                {data.streakSource === "last_al_pedo"
                  ? "Días desde el último gasto Al Pedo"
                  : data.streakSource === "tracking_start"
                    ? "Desde que activaste el seguimiento"
                    : "Se inicia al registrar tu actividad"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Flame className={`h-6 w-6 ${data.myStreakDays > 0 ? "fill-orange-500 text-orange-500" : "text-slate-300"}`} />
              <span className="font-mono text-3xl font-black tabular-nums text-slate-900">{data.myStreakDays}</span>
              <span className="text-xs font-bold text-orange-700">días</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 border-t border-orange-200/70 pt-4 sm:mt-6 sm:grid-cols-3 sm:gap-3 sm:pt-5">
          <div className="rounded-2xl border border-orange-100 bg-white/85 p-2.5 sm:p-3">
            <p className="flex items-center gap-2 text-[11px] font-extrabold text-orange-800 sm:text-xs">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px]">1</span>
              El registro marca la racha
            </p>
            <p className="mt-0.5 pl-8 text-[10px] leading-snug text-slate-600 sm:text-[11px] sm:leading-relaxed">
              Un gasto Al Pedo reinicia tu contador.
            </p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white/85 p-2.5 sm:p-3">
            <p className="flex items-center gap-2 text-[11px] font-extrabold text-amber-800 sm:text-xs">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px]">2</span>
              Desafío entre amigos
            </p>
            <p className="mt-0.5 pl-8 text-[10px] leading-snug text-slate-600 sm:text-[11px] sm:leading-relaxed">
              Con código, comparás solo los días de racha.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white/85 p-2.5 sm:p-3">
            <p className="flex items-center gap-2 text-[11px] font-extrabold text-emerald-800 sm:text-xs">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px]">3</span>
              Privacidad
            </p>
            <p className="mt-0.5 pl-8 text-[10px] leading-snug text-slate-600 sm:text-[11px] sm:leading-relaxed">
              Tus montos y movimientos no se comparten.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Tu código para invitar</h3>
          </div>

          <div className="mt-3 flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="min-w-0 break-all font-mono text-sm font-black tracking-[0.08em] text-slate-900 sm:text-base">
              {data.myFriendCode}
            </span>
            <button
              type="button"
              onClick={() => void shareCode()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white transition hover:bg-blue-700 active:scale-[0.97]"
              aria-label="Compartir tu código de Rachas"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Copiado" : "Compartir"}
            </button>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            Compartilo solo con quien quieras sumar. El código permite ver tus días de racha, nunca tus montos.
          </p>
        </section>

        <form onSubmit={handleAddFriend} className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
          <div className="flex items-center gap-2">
            <UserRoundPlus className="h-4 w-4 text-orange-600" />
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Sumar a un amigo</h3>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block text-[11px] font-bold text-slate-500">
              Código de invitación
              <input
                type="text"
                required
                maxLength={30}
                value={inputFriendCode}
                onChange={(event) => setInputFriendCode(event.target.value.toUpperCase())}
                placeholder="ALPEDO-ABC123"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold uppercase tracking-wide text-slate-900 outline-none transition placeholder:normal-case placeholder:font-medium placeholder:tracking-normal focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-[11px] font-bold text-slate-500">
              Apodo para identificarlo
              <input
                type="text"
                required
                maxLength={40}
                value={inputFriendName}
                onChange={(event) => setInputFriendName(event.target.value)}
                placeholder="Ej.: Juan"
                autoComplete="off"
                className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-medium focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isAdding}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-extrabold text-white transition hover:bg-orange-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-65"
          >
            {isAdding ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            {isAdding ? "Conectando…" : "Conectar duelo"}
          </button>
        </form>
      </div>

      {(actionError || feedback) && (
        <p
          role={actionError ? "alert" : "status"}
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${actionError ? "border border-rose-100 bg-rose-50 text-rose-700" : "border border-emerald-100 bg-emerald-50 text-emerald-700"}`}
        >
          {actionError || feedback}
        </p>
      )}

      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <Swords className="h-5 w-5 shrink-0 text-orange-500" />
            <h3 className="text-sm font-black text-slate-900 sm:text-base">Mis duelos</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">{friendCount}</span>
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-slate-400">Solo vos ves esta lista</span>
        </div>

        {friendCount === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <Swords className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-800">Todavía no tenés duelos</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
              Pedile a un amigo su código de invitación y conectalo arriba para comparar sus rachas.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {data.friends.map((friend) => (
              <article key={friend.friend_code} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                      <Swords className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-900">{friend.friend_name}</p>
                      <p className="truncate font-mono text-[10px] text-slate-500">{friend.friend_code}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {friend.connected && friend.streak_count !== null ? (
                      <p className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 font-mono text-sm font-black tabular-nums text-orange-700">
                        <Flame className="h-4 w-4 fill-orange-500 text-orange-500" />
                        {friend.streak_count} <span className="font-sans text-[10px]">días</span>
                      </p>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                        {friend.connected ? "Sin racha iniciada" : "Sin cuenta vinculada"}
                      </span>
                    )}
                  </div>
                </div>

                {!friend.connected && (
                  <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                    Este código no está vinculado a una cuenta. Pedile a tu amigo que te envíe el código vigente.
                  </p>
                )}

                <div className="mt-3 flex justify-end border-t border-slate-200/70 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleDeleteFriend(friend)}
                    disabled={pendingDeleteCode === friend.friend_code}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 active:scale-[0.98] disabled:opacity-60"
                    aria-label={`Eliminar duelo con ${friend.friend_name}`}
                  >
                    {pendingDeleteCode === friend.friend_code ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Eliminar duelo
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-800">Ranking comunitario</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            La clasificación todavía no está conectada a participantes reales. Por ahora, tus comparaciones son privadas y solo incluyen los amigos que agregues.
          </p>
        </div>
      </section>
    </div>
  );
}
