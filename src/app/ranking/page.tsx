"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHitRate } from "@/lib/utils";
import type { RankingMember, RankingResponse } from "@/app/api/analysis/ranking/route";

const TYPE_OPTIONS = [
  { value: "ALL", label: "すべて" },
  { value: "PUBLIC", label: "公式戦" },
  { value: "PRACTICE", label: "練習試合" },
  { value: "SELECTION", label: "校内選考" },
] as const;

type SortKey = "hitRate" | "hits";

function gradeLabel(grade: number | null) {
  if (grade === null) return "-";
  return `${grade}年`;
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-500 font-bold">🥇</span>;
  if (rank === 2) return <span className="text-slate-400 font-bold">🥈</span>;
  if (rank === 3) return <span className="text-amber-600 font-bold">🥉</span>;
  return <span className="text-stone-400 font-semibold">{rank}</span>;
}

interface RankingTableProps {
  title: string;
  members: RankingMember[];
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
}

function RankingTable({ title, members, sortKey, onSortChange }: RankingTableProps) {
  const sorted = useMemo(() => {
    return [...members].sort((a, b) =>
      sortKey === "hitRate" ? b.hitRate - a.hitRate : b.hits - a.hits
    );
  }, [members, sortKey]);

  const SortHeader = ({
    label,
    sortValue,
  }: {
    label: string;
    sortValue: SortKey;
  }) => (
    <th
      className={`px-3 py-2 text-right cursor-pointer select-none whitespace-nowrap ${
        sortKey === sortValue
          ? "text-stone-800 font-bold underline underline-offset-2"
          : "text-stone-400 hover:text-stone-600"
      }`}
      onClick={() => onSortChange(sortValue)}
    >
      {label}
      {sortKey === sortValue && (
        <span className="ml-1 text-xs">▼</span>
      )}
    </th>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {members.length === 0 ? (
          <p className="text-sm text-stone-400 px-4 py-6 text-center">
            条件に該当する部員がいません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-xs">
                  <th className="px-3 py-2 text-left text-stone-500 w-10">順位</th>
                  <th className="px-3 py-2 text-left text-stone-500">番号</th>
                  <th className="px-3 py-2 text-left text-stone-500">学年</th>
                  <SortHeader label="的中率" sortValue="hitRate" />
                  <SortHeader label="的中数" sortValue="hits" />
                  <th className="px-3 py-2 text-right text-stone-500 whitespace-nowrap">
                    射数
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sorted.map((m, i) => {
                  const rank = i + 1;
                  return (
                    <tr
                      key={m.memberNumber}
                      className={`hover:bg-stone-50 transition-colors ${
                        rank <= 3 ? "font-medium" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center w-10">
                        <Medal rank={rank} />
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        No.{m.memberNumber}
                      </td>
                      <td className="px-3 py-2.5 text-stone-500">
                        {gradeLabel(m.grade)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-semibold ${
                          sortKey === "hitRate" ? "text-stone-800" : "text-stone-500"
                        }`}
                      >
                        {formatHitRate(m.hitRate)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums ${
                          sortKey === "hits" ? "text-stone-800 font-semibold" : "text-stone-500"
                        }`}
                      >
                        {m.hits}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-stone-400">
                        {m.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RankingPage() {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [minShots, setMinShots] = useState(8);
  const [inputMinShots, setInputMinShots] = useState("8");
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [maleSortKey, setMaleSortKey] = useState<SortKey>("hitRate");
  const [femaleSortKey, setFemaleSortKey] = useState<SortKey>("hitRate");

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analysis/ranking?type=${typeFilter}&minShots=${minShots}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, minShots]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  function applyMinShots() {
    const n = parseInt(inputMinShots, 10);
    if (!isNaN(n) && n >= 0) setMinShots(n);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">的中ランキング</h1>
        <p className="text-stone-500 text-sm mt-1">
          部員の的中率・的中数を比較
        </p>
      </div>

      {/* フィルター */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-4 items-end">
            {/* 大会種別 */}
            <div className="space-y-1">
              <p className="text-xs text-stone-500">大会種別</p>
              <div className="flex gap-1.5">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTypeFilter(opt.value)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      typeFilter === opt.value
                        ? "bg-stone-800 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 最低射数 */}
            <div className="space-y-1">
              <p className="text-xs text-stone-500">最低射数（これ未満は除外）</p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={4}
                  value={minShots}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMinShots(v);
                    setInputMinShots(String(v));
                  }}
                  className="w-32 accent-stone-700"
                />
                <input
                  type="number"
                  min={0}
                  value={inputMinShots}
                  onChange={(e) => setInputMinShots(e.target.value)}
                  onBlur={applyMinShots}
                  onKeyDown={(e) => e.key === "Enter" && applyMinShots()}
                  className="w-16 border rounded px-2 py-1 text-sm text-center"
                />
                <span className="text-sm text-stone-500">射</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-16 text-stone-400">読み込み中...</div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RankingTable
            title={`男子 (${data.male.length}名)`}
            members={data.male}
            sortKey={maleSortKey}
            onSortChange={setMaleSortKey}
          />
          <RankingTable
            title={`女子 (${data.female.length}名)`}
            members={data.female}
            sortKey={femaleSortKey}
            onSortChange={setFemaleSortKey}
          />
        </div>
      ) : null}

      <p className="text-xs text-stone-400">
        ※ 列ヘッダー「的中率」「的中数」をクリックするとソート順を切り替えられます
      </p>
    </div>
  );
}
