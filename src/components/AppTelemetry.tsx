"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { recordPerformanceSample } from "@/lib/performance";

const recordMetric = (metric: { id: string; name: string; value: number }) => {
  if (!["LCP", "INP", "CLS"].includes(metric.name)) return;
  recordPerformanceSample(metric.name as "LCP" | "INP" | "CLS", metric.value, metric.id);
};

export default function AppTelemetry() {
  useReportWebVitals(recordMetric);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
