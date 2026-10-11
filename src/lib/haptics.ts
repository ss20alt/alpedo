/**
 * Native Haptic Feedback Utility for Mobile (PWA, Capacitor, iOS WebView, Android)
 * Emulates native Taptic Engine & Android vibrator pulses.
 */

type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

export function triggerHaptic(type: HapticType = "light"): void {
  if (typeof window === "undefined" || !("navigator" in window)) return;

  try {
    if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
      switch (type) {
        case "light":
        case "selection":
          navigator.vibrate(8);
          break;
        case "medium":
          navigator.vibrate(18);
          break;
        case "heavy":
          navigator.vibrate(30);
          break;
        case "success":
          navigator.vibrate([10, 40, 20]);
          break;
        case "warning":
          navigator.vibrate([30, 50, 30]);
          break;
        case "error":
          navigator.vibrate([40, 60, 40]);
          break;
      }
    }
  } catch {
    // Ignore environments where vibration is blocked or not supported
  }
}
