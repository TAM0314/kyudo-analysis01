"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
  return (
    <header className="bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-1 h-14">
          <span className="font-bold text-lg text-stone-800 mr-4 shrink-0">
            🏹 弓道的中管理
          </span>
          <nav className="flex items-center gap-1 overflow-x-auto">
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
        </div>
      </div>
    </header>
  );
}
