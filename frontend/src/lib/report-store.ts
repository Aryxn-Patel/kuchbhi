import type { ReportRequest, ReportResponse } from "./api";

const KEY = "ud-report";

export type StoredReport = { request: ReportRequest; response: ReportResponse };

export function saveReport(data: StoredReport) {
  window.sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function loadReport(): StoredReport | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredReport;
  } catch {
    return null;
  }
}

export function formatINR(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return "₹" + Math.round(value).toLocaleString("en-IN");
}

export function formatNum(value: number | undefined | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: digits });
}
