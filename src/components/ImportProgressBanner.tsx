"use client";

import { useImport } from "@/contexts/ImportContext";

export function ImportProgressBanner() {
  const { importing, result, clearResult } = useImport();

  if (!importing && !result) return null;

  if (importing) {
    return (
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2 text-sm text-amber-800">
          <span className="inline-block animate-spin">⏳</span>
          <span>Excelインポート処理中… 他のページに移動しても処理は継続されます</span>
        </div>
      </div>
    );
  }

  if (result) {
    const isError =
      !result.ok ||
      result.message.includes("失敗") ||
      result.message.includes("エラー");

    return (
      <div
        className={`border-b ${
          isError
            ? "bg-red-50 border-red-200"
            : "bg-emerald-50 border-emerald-200"
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-start justify-between gap-3 text-sm">
          <span
            className={`flex-1 ${isError ? "text-red-800" : "text-emerald-800"}`}
          >
            {result.message}
          </span>
          <button
            onClick={clearResult}
            className="shrink-0 text-stone-400 hover:text-stone-600 leading-none mt-0.5"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return null;
}
