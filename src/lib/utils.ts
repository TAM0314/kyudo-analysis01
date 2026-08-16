import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function tournamentTypeLabel(
  type: "PUBLIC" | "PRACTICE" | "SELECTION" | string
): string {
  const map: Record<string, string> = {
    PUBLIC: "\u516c\u5f0f\u6226",
    PRACTICE: "\u7df4\u7fd2\u8a66\u5408",
    SELECTION: "\u6821\u5185\u9078\u8003",
  };
  return map[type] ?? type;
}

export function shotResultLabel(
  result: "HIT" | "MISS" | "SHITSU" | string
): string {
  if (result === "HIT") return "\u25cb";
  if (result === "SHITSU") return "/";
  return "\u00d7";
}

export function shotResultColor(
  result: "HIT" | "MISS" | "SHITSU" | string
): string {
  if (result === "HIT") return "text-emerald-600 font-bold";
  if (result === "SHITSU") return "text-amber-500 font-bold";
  return "text-red-500 font-bold";
}

/** 的中率（%）を小数第3位まで算出 */
export function computeHitRatePercent(hits: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((hits / total) * 100000) / 1000;
}

/** 的中率表示: 0%は「0%」、0%超は最大小数第3位（末尾0は省略） */
export function formatHitRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return "0%";
  const trimmed = Number(rate).toFixed(3).replace(/\.?0+$/, "");
  return `${trimmed}%`;
}
