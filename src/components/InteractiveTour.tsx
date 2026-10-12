"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Wallet,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Eye,
  Flame,
  Gauge,
  Heart,
  TrendingUp,
  Calculator,
  Trophy,
  Layers,
  Calendar,
  Zap,
  MessageCircle,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import FinanceIcon, { type FinanceIconName } from "@/components/FinanceIcon";
import { trapDialogTab } from "@/lib/dialog-keyboard";

export interface TourStep {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  headline: string;
  description: string;
  tip: string;
  targetTab: "dashboard" | "transactions" | "couples" | "streaks" | "loans" | "challenge" | "grouped" | "settings";
  targetSelector?: string;
  spotlightPadding?: number;
  isCircular?: boolean;
}

export const TAB_METADATA: Record<
  string,
  { label: string; icon: FinanceIconName; color: string; badgeBg: string }
> = {
  dashboard: {
    label: "Tablero mensual",
    icon: "trend",
    color: "#1656DB",
    badgeBg: "bg-blue-50 text-[#1656DB] border-blue-200",
  },
  transactions: {
    label: "Movimientos",
    icon: "receipt",
    color: "#2563EB",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  grouped: {
    label: "Comercios",
    icon: "store",
    color: "#0891B2",
    badgeBg: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  couples: {
    label: "Metas en Pareja",
    icon: "heart",
    color: "#9333EA",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
  },
  challenge: {
    label: "Reto 1%",
    icon: "target",
    color: "#059669",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  streaks: {
    label: "Rachas & Duelos",
    icon: "trophy",
    color: "#D97706",
    badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
  },
  loans: {
    label: "Préstamos",
    icon: "creditCard",
    color: "#2563EB",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  settings: {
    label: "Ajustes & PIN",
    icon: "settings",
    color: "#475569",
    badgeBg: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Bienvenido a alpedo.app",
    badge: "Finanzas personales",
    badgeColor: "bg-blue-50 text-[#1656DB] border-blue-200",
    icon: <Wallet className="h-4 w-4 text-[#1656DB]" />,
    headline: "Tu dinero con un propósito claro",
    description:
      "La app paraguaya para ordenar tus gastos, cuidar tu presupuesto y tener tus cuentas claras.",
    tip: "Podés volver a esta guía desde Ayuda cuando quieras.",
    targetTab: "dashboard",
    targetSelector: "#tour-header-logo",
    spotlightPadding: 6,
  },
  {
    id: "hero_balance",
    title: "Saldo restante y curva",
    badge: "Tablero mensual",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
    headline: "Sabé exactamente cuánto podés gastar hoy",
    description:
      "Presupuesto disponible en tiempo real, curva de gastos del mes y tu puntuación de Salud Financiera (0 a 100).",
    tip: "Verde es superávit; rojo alerta sobregasto.",
    targetTab: "dashboard",
    targetSelector: "#tour-hero-card",
    spotlightPadding: 8,
  },
  {
    id: "spending_pace",
    title: "Ritmo de gasto mensual",
    badge: "Velocímetro Financiero",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    icon: <Gauge className="h-4 w-4 text-rose-600" />,
    headline: "Evitá quedarte sin plata antes del 30",
    description:
      "Compara días transcurridos contra presupuesto consumido para diagnosticar si tu ritmo es Óptimo o Acelerado.",
    tip: "Compartí tu resumen a WhatsApp con 1 clic.",
    targetTab: "dashboard",
    targetSelector: "#tour-spending-pace",
    spotlightPadding: 8,
  },
  {
    id: "quick_spend",
    title: "Gasto rápido en un toque",
    badge: "Registro Ágil",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <Zap className="h-4 w-4 text-amber-500" />,
    headline: "Bolt, Biggie o Lomito en 2 segundos",
    description:
      "Atajos directos para cargar consumos frecuentes al instante. Los gastos prescindibles se marcan como 'Al Pedo'.",
    tip: "Un solo toque para registrar al paso.",
    targetTab: "dashboard",
    targetSelector: "#tour-quick-spend",
    spotlightPadding: 8,
  },
  {
    id: "cuero_ai",
    title: "¿Me da el cuero?",
    badge: "Consejo Kape",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    icon: <MessageCircle className="h-4 w-4 text-[#1656DB]" />,
    headline: "Consultale al Kape antes de gastar",
    description:
      "El botón de chat abre al Kape para consultar cómo una compra impactaría en tu presupuesto.",
    tip: "Podés consultar antes de decidir.",
    targetTab: "dashboard",
    targetSelector: "#tour-cuero-header-button",
    spotlightPadding: 8,
    isCircular: true,
  },
  {
    id: "transactions_swipe",
    title: "Movimientos y gestos táctiles",
    badge: "Lista & Swipe",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Flame className="h-4 w-4 text-orange-500" />,
    headline: "Deslizá para categorizar al instante",
    description:
      "Tocá Opciones en un movimiento para editar, marcar 'Al Pedo' o borrar. También podés deslizarlo hacia los lados.",
    tip: "Usá el botón o el gesto que te resulte más cómodo.",
    targetTab: "transactions",
    targetSelector: "#tour-transactions-list",
    spotlightPadding: 8,
  },
  {
    id: "grouped_merchants",
    title: "Gastos por comercio",
    badge: "Comercios Agrupados",
    badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
    icon: <Layers className="h-4 w-4 text-cyan-600" />,
    headline: "Detectá a dónde se va tu plata",
    description:
      "Agrupa tus gastos cuando escribís el mismo concepto para que puedas ver cuánto suma.",
    tip: "Usá nombres consistentes al cargar movimientos para agruparlos.",
    targetTab: "grouped",
    targetSelector: "#tour-grouped-view",
    spotlightPadding: 8,
  },
  {
    id: "couples_goals",
    title: "Metas en pareja",
    badge: "Ahorro Compartido",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <Heart className="h-4 w-4 text-purple-600" />,
    headline: "Un chanchito común sin perder privacidad",
    description:
      "Registrá una meta y los aportes que hacen juntos. Los gastos personales de cada cuenta quedan separados.",
    tip: "La otra persona acepta el código una vez y ambas cuentas ven la misma meta y sus aportes.",
    targetTab: "couples",
    targetSelector: "#tour-couples-card",
    spotlightPadding: 8,
  },
  {
    id: "challenge_saving",
    title: "Reto progresivo del 1%",
    badge: "Método de Ahorro",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: <Calendar className="h-4 w-4 text-emerald-600" />,
    headline: "Ahorrá un sueldo extra casi sin darte cuenta",
    description:
      "Ahorro progresivo mensual del 1% al 12% de tu sueldo para acumular un fondo de emergencia sólido en un año.",
    tip: "Marcá cada mes cumplido y superá la meta.",
    targetTab: "challenge",
    targetSelector: "#tour-challenge-card",
    spotlightPadding: 8,
  },
  {
    id: "streaks_leaderboard",
    title: "Rachas y duelos",
    badge: "Gamificación Kp",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    icon: <Trophy className="h-4 w-4 text-amber-600" />,
    headline: "¿Quién aguanta más días sin tirar plata?",
    description:
      "Compartí tu código con un amigo: cuando lo ingrese, ambos quedarán vinculados para comparar sus días de racha. Cada uno puede cambiar el apodo visible.",
    tip: "El código solo comparte los días de racha, nunca los gastos ni los saldos.",
    targetTab: "streaks",
    targetSelector: "#tour-streaks-card",
    spotlightPadding: 8,
  },
  {
    id: "loan_simulator",
    title: "Simulador de préstamos",
    badge: "Capacidad de Cuota",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Calculator className="h-4 w-4 text-blue-600" />,
    headline: "Calculá si una cuota cabe en tu bolsillo",
    description:
      "Estimá la cuota con el Sistema Francés y comparala con tus ingresos. La oferta final puede incluir cargos adicionales.",
    tip: "Guardá simulaciones para comparar bancos.",
    targetTab: "loans",
    targetSelector: "#tour-loans-card",
    spotlightPadding: 8,
  },
  {
    id: "privacy_pin",
    title: "Privacidad en un toque",
    badge: "Ocultar importes",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
    icon: <Eye className="h-4 w-4 text-[#1656DB]" />,
    headline: "Ocultá tus números en 1 toque",
    description:
      "El botón del ojo oculta tus saldos; volvé a usarlo cuando quieras mostrarlos.",
    tip: "Práctico cuando mirás la app en público.",
    targetTab: "dashboard",
    targetSelector: "#tour-privacy-btn",
    spotlightPadding: 6,
    isCircular: true,
  },
];

interface InteractiveTourProps {
  userId: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TourStep["targetTab"]) => void;
}

interface TargetBox {
  top: number;
  left: number;
  width: number;
  height: number;
  isCircular?: boolean;
}

export default function InteractiveTour({
  userId,
  isOpen,
  onClose,
  onNavigateTab,
}: InteractiveTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetBox, setTargetBox] = useState<TargetBox | null>(null);
  const [swipeDeltaX, setSwipeDeltaX] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const animFrameRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);
  const onNavigateTabRef = useRef(onNavigateTab);
  const activeTabRef = useRef<string>(TOUR_STEPS[0].targetTab);

  // Touch gesture refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    onNavigateTabRef.current = onNavigateTab;
  }, [onNavigateTab]);

  // RESET TO STEP 0 ONLY ON OPENING TRANSITION
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setCurrentStepIndex(0);
      setTargetBox(null);
      activeTabRef.current = TOUR_STEPS[0].targetTab;
      if (TOUR_STEPS[0]?.targetTab) {
        onNavigateTabRef.current(TOUR_STEPS[0].targetTab);
      }
    } else if (!isOpen && wasOpenRef.current) {
      setTargetBox(null);
      setIsTransitioning(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;
  const currentTabMeta = TAB_METADATA[currentStep.targetTab] || TAB_METADATA.dashboard;

  // Measure sticky header bottom edge dynamically
  const getHeaderBottom = useCallback(() => {
    if (typeof document === "undefined") return 100;
    const header = document.querySelector("header");
    if (header) {
      const rect = header.getBoundingClientRect();
      return Math.max(rect.bottom, 94);
    }
    return 100;
  }, []);

  // Measure and locate target in DOM with pixel-perfect viewport clamping
  const measureTarget = useCallback(() => {
    if (!isOpen) return false;
    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return false;

    const selector = step.targetSelector;
    if (!selector) {
      setTargetBox(null);
      return true;
    }

    const element = document.querySelector(selector);
    if (!element) {
      setTargetBox(null);
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setTargetBox(null);
      return false;
    }

    const pad = step.spotlightPadding || 8;
    const vpW = typeof window !== "undefined" ? window.innerWidth : 400;
    const vpH = typeof window !== "undefined" ? window.innerHeight : 800;
    const isMobile = vpW < 640;

    const isHeaderTarget = !!element.closest("header");
    const isFixedTarget =
      typeof window !== "undefined" &&
      window.getComputedStyle(element).position === "fixed";
    const headerBottom = getHeaderBottom();

    let safeTop: number;
    let safeHeight: number;

    if (isHeaderTarget) {
      // Elements inside sticky header (logo or privacy toggle)
      safeTop = Math.max(4, rect.top - pad);
      safeHeight = rect.height + pad * 2;
    } else if (isFixedTarget) {
      // Floating button at bottom (Cuero button)
      safeTop = Math.max(headerBottom + 6, rect.top - pad);
      safeHeight = rect.height + pad * 2;
    } else {
      // Standard page cards/lists
      const rawTop = rect.top - pad;
      // NEVER allow spotlight to overlap the sticky header:
      safeTop = Math.max(headerBottom + 4, rawTop);

      // On mobile, clamp height so spotlight stops cleanly above the bottom tooltip card
      if (isMobile) {
        const maxAllowedBottom = vpH - 245;
        const maxFitHeight = Math.max(140, maxAllowedBottom - safeTop);
        safeHeight = Math.min(rect.height + pad * 2, maxFitHeight);
      } else {
        safeHeight = rect.height + pad * 2;
      }
    }

    const clampLeft = Math.max(6, Math.min(rect.left - pad, vpW - 40));
    const clampWidth = Math.min(vpW - clampLeft - 6, rect.width + pad * 2);

    const box: TargetBox = {
      top: safeTop,
      left: clampLeft,
      width: clampWidth,
      height: safeHeight,
      isCircular: step.isCircular,
    };

    setTargetBox((previous) => {
      if (
        previous &&
        Math.abs(previous.top - box.top) < 0.5 &&
        Math.abs(previous.left - box.left) < 0.5 &&
        Math.abs(previous.width - box.width) < 0.5 &&
        Math.abs(previous.height - box.height) < 0.5 &&
        previous.isCircular === box.isCircular
      ) {
        return previous;
      }
      return box;
    });
    return true;
  }, [isOpen, currentStepIndex, getHeaderBottom]);

  // When step changes: handle automatic tab switch, smooth scroll to section, and tracking
  useEffect(() => {
    if (!isOpen) return;

    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;

    const isDifferentTab = step.targetTab !== activeTabRef.current;

    // 1. If tab changes: switch parent tab and briefly fade spotlight
    if (isDifferentTab) {
      activeTabRef.current = step.targetTab;
      setIsTransitioning(true);
      setTargetBox(null);
      triggerHaptic("medium");
      onNavigateTabRef.current(step.targetTab);
    }

    // 2. Locate element and automatically scroll so section is perfectly framed
    let canceled = false;
    let attempts = 0;

    const runLocate = () => {
      if (canceled) return;
      const selector = step.targetSelector;
      if (!selector) {
        setTargetBox(null);
        setIsTransitioning(false);
        return;
      }

      const el = document.querySelector(selector);
      if (el) {
        const isHeaderTarget = !!el.closest("header");
        const isFixedTarget =
          typeof window !== "undefined" &&
          window.getComputedStyle(el).position === "fixed";

        if (isHeaderTarget) {
          // If in header, scroll to top 0
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
        } else if (!isFixedTarget) {
          // Automatic adaptive scrolling:
          // Place the top of the element exactly 14px below the bottom edge of the sticky header
          const headerBottom = getHeaderBottom();
          const desiredViewportTop = headerBottom + 14;
          const currentRect = el.getBoundingClientRect();
          const elementAbsoluteY = window.scrollY + currentRect.top;
          const targetScrollY = Math.max(0, elementAbsoluteY - desiredViewportTop);
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

          window.scrollTo({
            top: targetScrollY,
            behavior: reducedMotion ? "instant" : "smooth",
          });
        }

        // Keep the spotlight attached to its target until smooth scrolling settles.
        setIsTransitioning(false);
        const startTime = performance.now();
        let previousScrollY = window.scrollY;
        let stableFrames = 0;
        const trackLoop = () => {
          if (canceled) return;
          measureTarget();
          const currentScrollY = window.scrollY;
          stableFrames = Math.abs(currentScrollY - previousScrollY) < 0.5 ? stableFrames + 1 : 0;
          previousScrollY = currentScrollY;
          const elapsed = performance.now() - startTime;
          if (elapsed < 1500 && (elapsed < 180 || stableFrames < 3)) {
            animFrameRef.current = requestAnimationFrame(trackLoop);
          } else {
            measureTarget();
            setIsTransitioning(false);
          }
        };
        trackLoop();
      } else if (attempts < 30) {
        attempts++;
        setTimeout(runLocate, 70);
      } else {
        setIsTransitioning(false);
      }
    };

    const initialDelay = isDifferentTab ? 130 : 60;
    const initialTimer = setTimeout(runLocate, initialDelay);

    return () => {
      canceled = true;
      clearTimeout(initialTimer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, currentStepIndex, measureTarget, getHeaderBottom]);

  // Handle window scroll & resize events
  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => {
      measureTarget();
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, { passive: true });
    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate);
    };
  }, [isOpen, measureTarget]);

  if (!isOpen) return null;

  const goToStep = (index: number) => {
    triggerHaptic("selection");
    setSwipeDeltaX(0);
    setCurrentStepIndex(index);
  };

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      goToStep(currentStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      goToStep(currentStepIndex - 1);
    }
  };

  const handleComplete = () => {
    triggerHaptic("success");
    if (typeof window !== "undefined") {
      localStorage.setItem(`alpedo_tour_completed_${userId}`, "true");
    }
    setCurrentStepIndex(0);
    onNavigateTab("dashboard");
    onClose();
  };

  // Touch Swipe Gesture Handlers on Tooltip Card
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipeDeltaX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(diffX) < 120) {
      setSwipeDeltaX(diffX * 0.3);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe (swipe left = next, swipe right = prev)
    if (Math.abs(diffX) > 45 && Math.abs(diffY) < 65) {
      if (diffX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    // Pull down to dismiss (> 80px)
    else if (diffY > 80 && Math.abs(diffX) < 60) {
      handleComplete();
    }

    touchStartX.current = null;
    touchStartY.current = null;
    setSwipeDeltaX(0);
  };

  const winH = typeof window !== "undefined" ? window.innerHeight : 800;
  const headerBottom = getHeaderBottom();

  // Keep the guide card anchored on mobile; desktop can use the more spacious side of the target.
  const isTargetInUpperHalf = targetBox ? targetBox.top < winH * 0.48 : false;
  const radius = targetBox?.isCircular ? Math.max(targetBox.width, targetBox.height) / 2 : 24;

  // Safe placement for the "MIRÁ ACÁ" badge so it never hits the header:
  const isRightBelowHeader = targetBox ? targetBox.top < headerBottom + 26 : false;
  const isNearRight = targetBox
    ? targetBox.left > (typeof window !== "undefined" ? window.innerWidth : 400) - 120
    : false;
  const progressPercent = Math.round(((currentStepIndex + 1) / TOUR_STEPS.length) * 100);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden select-none animate-in fade-in duration-200"
      role="dialog" aria-modal="true" aria-label={`Guía paso ${currentStepIndex + 1} de ${TOUR_STEPS.length}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") handleComplete();
        trapDialogTab(event);
      }}
    >
      {/* 1. Dynamic SVG Cutout Mask (Spotlight on Target Element) */}
      <svg
        className={`fixed inset-0 w-full h-full pointer-events-none z-40 transition-opacity duration-200 ease-out ${
          isTransitioning ? "opacity-30" : "opacity-100"
        }`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="alpedo-spotlight-mask">
            {/* White fills whole screen */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black punches spotlight hole */}
            {targetBox && !isTransitioning && (
              <rect
                x={targetBox.left}
                y={targetBox.top}
                width={targetBox.width}
                height={targetBox.height}
                rx={radius}
                ry={radius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(2, 6, 23, 0.72)"
          mask="url(#alpedo-spotlight-mask)"
        />
      </svg>

      {/* Dismiss backdrop on click outside card */}
      <div className="fixed inset-0 z-40" onClick={handleComplete} />

      {/* 2. Glowing Halo Ring & Directional Beacon on Target Box */}
      {targetBox && !isTransitioning && (
        <div
          style={{
            top: `${targetBox.top}px`,
            left: `${targetBox.left}px`,
            width: `${targetBox.width}px`,
            height: `${targetBox.height}px`,
            borderRadius: `${radius}px`,
          }}
          className="fixed pointer-events-none z-45 ring-4 ring-[#1656DB] shadow-[0_0_35px_rgba(22,86,219,0.55)] transition-[box-shadow,opacity] duration-200 ease-out"
        >
          {/* Animated Attention Badge with screen safe-clamping */}
          <div
            className={`absolute flex items-center gap-1 rounded-full bg-[#104BC9] px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black tracking-wider text-white shadow-md ${
              isRightBelowHeader
                ? "top-2 left-2.5"
                : "-top-3.5"
            } ${isNearRight ? "right-1" : "left-2"}`}
          >
            <><ArrowDown className="h-3 w-3" /> {currentStep.isCircular ? "Control señalado" : "Ver sección"}</>
          </div>
        </div>
      )}

      {/* 3. Smart Floating Compact Tooltip HUD (Discreet, Non-Intrusive) */}
      <div
        style={{
          transform: `translateX(${swipeDeltaX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 max-w-[400px] w-auto sm:w-full transition-transform duration-200 ease-out ${
          targetBox
            ? isTargetInUpperHalf
              ? "sm:top-auto sm:bottom-4"
              : "sm:top-14 sm:bottom-auto"
            : "sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2"
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/95 bg-white/96 backdrop-blur-xl px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-[0_12px_36px_rgba(0,0,0,0.22)] text-slate-900">
          <div aria-hidden="true" className="mx-auto mb-1.5 h-1 w-9 rounded-full bg-slate-200 sm:hidden" />

          {/* Top Hairline Progress Bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#104BC9] via-[#1656DB] to-[#1C5FE6] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Top Row: Section Badge + Step Counter + Close button */}
          <div key={`${currentStep.id}-header`} className="flex items-center justify-between pt-0.5 pb-0.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 truncate ${currentStep.badgeColor}`}
              >
                <FinanceIcon name={currentTabMeta.icon} className="h-4 w-4" />
                <span className="truncate">{currentStep.badge}</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 shrink-0">
                {currentStepIndex + 1}/{TOUR_STEPS.length}
              </span>
            </div>

            <button
              onClick={handleComplete}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition active:scale-95 shrink-0 ml-1"
              title="Omitir Guía"
              aria-label="Cerrar Guía"
              autoFocus
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Middle Row: Title + Inline Concise Description */}
          <div key={`${currentStep.id}-copy`} className="my-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5 leading-snug">
              <span className="shrink-0">{currentStep.icon}</span>
              <span className="truncate">{currentStep.title}</span>
            </h3>

            <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1">
              {currentStep.description}
            </p>
          </div>

          {/* Bottom Row: Compact Navigation Controls in a Single Line */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100/90 mt-1">
            {/* Left: Back button or subtle hint */}
            <div className="flex items-center gap-1">
              {!isFirstStep ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition flex items-center gap-0.5"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Atrás</span>
                </button>
              ) : (
                <span className="text-[10px] text-slate-500 font-semibold px-1">
                  Guía paso a paso
                </span>
              )}
            </div>

            {/* Center: Mini dots */}
            <div className="flex items-center justify-center gap-1 py-0.5">
              {TOUR_STEPS.map((step, idx) => (
                <span
                  key={step.id}
                  className={`rounded-full transition-all duration-300 ${
                    idx === currentStepIndex
                      ? "w-3 h-1.5 bg-[#1656DB]"
                      : "w-1.5 h-1.5 bg-slate-300"
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>

            {/* Right: Next / Finish button */}
            <button
              type="button"
              onClick={handleNext}
              className="h-10 px-3 rounded-lg bg-[#1656DB] text-xs font-black text-white hover:bg-blue-600 active:scale-95 transition shadow-sm shadow-blue-600/20 flex items-center gap-1 shrink-0"
            >
              {isLastStep ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                  <span>Comenzar</span>
                </>
              ) : (
                <>
                  <span>Siguiente</span>
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
