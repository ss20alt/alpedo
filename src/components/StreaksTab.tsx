"use client";

import React, { useState, useEffect } from "react";
import {
  Flame,
  Trophy,
  Users,
  Copy,
  Check,
  Share2,
  ShieldCheck,
  Zap,
  Swords,
  Crown,
  Medal,
  Trash2,
} from "lucide-react";

interface LeaderboardItem {
  rank: number;
  name: string;
  badge: string;
  streak: number;
  city: string;
  isMe?: boolean;
}

interface StreaksTabProps {
  currencySymbol?: string;
}

export default function StreaksTab({ currencySymbol = "₲" }: StreaksTabProps) {
  const [friendCode, setFriendCode] = useState("");
  const [myStreak, setMyStreak] = useState(7);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [cheeredCode, setCheeredCode] = useState<string | null>(null);

  // Add friend state
  const [inputFriendCode, setInputFriendCode] = useState("");
  const [inputFriendName, setInputFriendName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchStreaksData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/streaks");
      if (res.ok) {
        const data = await res.json();
        setFriendCode(data.myFriendCode);
        setMyStreak(data.myStreakDays);
        setLeaderboard(data.leaderboard || []);
        setFriends(data.friends || []);
      }
    } catch (err) {
      console.error("Error fetching streaks:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFriend = async (code: string) => {
    try {
      const res = await fetch("/api/streaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_friend", friend_code: code }),
      });
      if (res.ok) {
        await fetchStreaksData();
      }
    } catch (err) {
      console.error("Error deleting friend:", err);
    }
  };

  const handleCheerFriend = (code: string) => {
    setCheeredCode(code);
    setTimeout(() => setCheeredCode(null), 2500);
  };

  useEffect(() => {
    fetchStreaksData();
  }, []);

  const copyCode = () => {
    if (!friendCode) return;
    const shareText = `¡Che kp! Te desafío en alpedo.app a ver quién aguanta más días sin gastar al pedo. Agregame con mi código: ${friendCode}`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFriendCode || !inputFriendName) return;

    try {
      setIsAdding(true);
      const res = await fetch("/api/streaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_friend",
          friend_code: inputFriendCode,
          friend_name: inputFriendName,
        }),
      });

      if (res.ok) {
        setInputFriendCode("");
        setInputFriendName("");
        setSuccessMsg("¡Amigo agregado al duelo con éxito!");
        setTimeout(() => setSuccessMsg(""), 3000);
        await fetchStreaksData();
      }
    } catch (err) {
      console.error("Error adding friend:", err);
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Hero Banner */}
      <div id="tour-streaks-card" className="relative overflow-hidden rounded-[28px] border border-orange-200/80 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/80 p-6 sm:p-8 shadow-[0_4px_24px_rgba(249,115,22,0.06)] text-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-xs font-black text-orange-700 mb-3 shadow-sm">
              <Flame className="h-3.5 w-3.5 text-orange-500 animate-bounce" />
              Gamificación • Comunidad Kape
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Rachas de Autocontrol & Duelos
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-xl font-medium">
              Nadie ve tu saldo ni tus números reales. Competí con tus amigos o la comunidad por ver quién mantiene más días invictos sin gastos al pedo.
            </p>
          </div>

          {/* User Streak Pill */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-orange-200 bg-white px-6 py-4 shadow-sm text-slate-900">
            <span className="text-[11px] font-black uppercase tracking-wider text-orange-600">
              Tu Racha Actual
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Flame className="h-7 w-7 text-orange-500 fill-orange-500" />
              <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
                {myStreak}
              </span>
              <span className="text-xs font-bold text-orange-600">días</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 mt-0.5">
              ¡Invicto sin gastos al pedo!
            </span>
          </div>
        </div>

        {/* 3-Step Interactive Rules */}
        <div className="mt-6 pt-5 border-t border-orange-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/80 border border-orange-100 p-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-orange-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px]">1</span>
              <span>Día invicto (+1)</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Cada día que no marcás ningún gasto como "Al Pedo 🔥", tu racha avanza automáticamente.
            </p>
          </div>

          <div className="rounded-2xl bg-white/80 border border-orange-100 p-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-amber-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px]">2</span>
              <span>Duelo con amigos</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Agregá a tus amigos con su código Kp y compitan por quién resiste más días en la calle.
            </p>
          </div>

          <div className="rounded-2xl bg-white/80 border border-orange-100 p-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-emerald-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px]">3</span>
              <span>Ranking Nacional</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              Subí en la tabla de Asunción, Luque, CDE y Encarnación con total privacidad de tus montos.
            </p>
          </div>
        </div>
      </div>

      {/* Friend Code & Invite Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tu Código */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 space-y-3 shadow-sm text-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Tu Código de Desafío Kape
            </span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="font-mono text-lg font-black tracking-widest text-emerald-700">
              {friendCode || "ALPEDO-7489"}
            </span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-100 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "¡Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Compartí este código por WhatsApp con tus amigos para retarlos a no gastar al pedo.
          </p>
        </div>

        {/* Desafiar a un Amigo */}
        <form
          onSubmit={handleAddFriend}
          className="rounded-[28px] border border-slate-100 bg-white p-5 space-y-3 shadow-sm text-slate-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Desafiar a un Amigo
            </span>
            <Swords className="h-4 w-4 text-rose-500" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={inputFriendCode}
              onChange={(e) => setInputFriendCode(e.target.value)}
              placeholder="Código (Ej: ALPEDO-1234)"
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 uppercase font-mono font-bold focus:bg-white focus:border-orange-500 focus:outline-none transition"
            />
            <input
              type="text"
              required
              value={inputFriendName}
              onChange={(e) => setInputFriendName(e.target.value)}
              placeholder="Apodo (Ej: Kp Juan)"
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 font-semibold focus:bg-white focus:border-orange-500 focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={isAdding}
            className="w-full h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-black text-white hover:opacity-95 shadow-md shadow-orange-500/20 transition active:scale-[0.98]"
          >
            {isAdding ? "Agregando..." : "Lanzar Duelo de Ahorro ⚔️"}
          </button>
          {successMsg && <span className="text-[11px] font-bold text-emerald-600 block">{successMsg}</span>}
        </form>
      </div>

      {/* Mis Duelos con Amigos (1v1) */}
      <div className="rounded-[28px] border border-orange-200/80 bg-white p-4 sm:p-6 space-y-4 shadow-[0_4px_24px_rgba(249,115,22,0.04)] text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-orange-500" />
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              Mis Duelos Activos con Amigos ({friends.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-bold">1 vs 1</span>
        </div>

        {friends.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Aún no agregaste amigos a tu lista de duelos. Ingresá el código de un amigo arriba para competir.
          </div>
        ) : (
          <div className="space-y-2.5">
            {friends.map((f: any) => {
              const diff = myStreak - f.streak_count;
              const isWinning = diff >= 0;
              return (
                <div
                  key={f.friend_code}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4 hover:border-orange-200 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 font-black text-sm">
                      ⚔️
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-black text-slate-900 truncate">
                        {f.friend_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Cód: {f.friend_code} • {isWinning ? `Vas ganando por +${diff}d` : `Te gana por +${Math.abs(diff)}d`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1 font-mono font-black text-orange-600 text-sm sm:text-base">
                        <Flame className="h-4 w-4 fill-orange-500 text-orange-500" />
                        <span>{f.streak_count}</span>
                        <span className="text-[10px] text-slate-400 font-sans">días</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCheerFriend(f.friend_code)}
                      className="p-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 transition active:scale-95 text-xs font-bold"
                      title="Alentar al kape"
                    >
                      {cheeredCode === f.friend_code ? "👏 ¡Mbarete!" : "🔥"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteFriend(f.friend_code)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 transition active:scale-95"
                      title="Eliminar duelo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Community Leaderboard (Top Paraguayo) */}
      <div className="rounded-[28px] border border-slate-100 bg-white p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
            <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
              Top Comunitario Paraguayo (Mayor Racha)
            </h3>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold shrink-0">
            Actualizado en vivo
          </span>
        </div>

        <div className="space-y-2">
          {leaderboard.map((item) => (
            <div
              key={item.rank}
              className={`flex items-center justify-between rounded-2xl border px-3 sm:px-4 py-2.5 sm:py-3 transition gap-2 ${
                item.isMe
                  ? "border-emerald-200 bg-emerald-50/50 shadow-sm"
                  : "border-slate-100 bg-slate-50/50 hover:bg-slate-100/70"
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                {/* Rank medal */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-mono text-xs sm:text-sm font-black">
                  {item.rank === 1 ? (
                    <Crown className="h-5 w-5 text-amber-500" />
                  ) : item.rank === 2 ? (
                    <Medal className="h-5 w-5 text-slate-400" />
                  ) : item.rank === 3 ? (
                    <Medal className="h-5 w-5 text-amber-700" />
                  ) : (
                    <span className="text-slate-400 font-bold">#{item.rank}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-xs sm:text-sm font-extrabold truncate ${item.isMe ? "text-emerald-700" : "text-slate-900"}`}>
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-semibold">
                      ({item.city})
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate block mt-0.5">
                    {item.badge}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pl-1.5">
                <Flame className="h-4 w-4 text-orange-500 fill-orange-500 shrink-0" />
                <span className="font-mono text-sm sm:text-base font-black text-slate-900">
                  {item.streak}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-500 font-bold">días</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
