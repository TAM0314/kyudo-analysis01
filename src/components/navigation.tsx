"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "ダッシュボード" },
  { href: "/input", label: "データ入力" },
  { href: "/analysis/individual", label: "個人分析" },
  { href: "/analysis/team", label: "チーム分析" },
  { href: "/members", label: "部員管理" },
  { href: "/settings", label: "設定" },
];

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* タイトル */}
          <span className="font-bold text-lg text-stone-800 shrink-0">
            🏹 弓道的中管理
          </span>

          {/* デスクトップ：横並びタブ */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  pathname === link.href
                    ? "bg-stone-800 text-white"
                    : "text-stone-600 hover:bg-stone-100"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* モバイル：ハンバーガーボタン */}
          <button
            className="md:hidden p-2 rounded-md text-stone-600 hover:bg-stone-100 transition-colors"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "メニューを閉じる" : "メニューを開く"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* モバイル：ドロップダウンメニュー */}
      {open && (
        <div className="md:hidden border-t border-stone-100 bg-white">
          <nav className="max-w-5xl mx-auto px-2 py-2 flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-3 rounded-md text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-stone-800 text-white"
                    : "text-stone-700 hover:bg-stone-100"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
