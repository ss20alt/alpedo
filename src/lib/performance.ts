export type PerformanceName = "LCP" | "INP" | "CLS" | "DATA";
export type PerformanceSample = { id: string; value: number; at: number };
export type PerformanceSamples = Partial<Record<PerformanceName, PerformanceSample[]>>;

const STORAGE_KEY = "alpedo_perf_samples";

export function recordPerformanceSample(name: PerformanceName, value: number, id: string) {
  if (!Number.isFinite(value) || value < 0) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const samples: PerformanceSamples = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    const current = Array.isArray(samples[name]) ? samples[name]! : [];
    samples[name] = [...current.filter((sample) => sample.id !== id), { id, value, at: Date.now() }].slice(-30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch { /* La medición es opcional. */ }
}

export function readPerformanceSamples(): PerformanceSamples {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function percentile75(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * 0.75) - 1] : null;
}
