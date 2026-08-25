"use client";

export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;
  return (
    <div className="bg-amber-400 text-amber-950 text-sm font-medium text-center py-2 px-4">
      🎯 デモ版 — 閲覧のみ可能です。データの追加・変更・削除はできません。
    </div>
  );
}
