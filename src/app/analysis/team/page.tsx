"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { tournamentTypeLabel, shotResultLabel, shotResultColor } from "@/lib/utils";
import { useCompletion } from "@ai-sdk/react";

interface Tournament {
  id: number;
  name: string;
  type: string;
  date: string;
}

interface RoundStat {
  roundId: number;
  roundNumber: number;
  label: string;
  hits: number;
  total: number;
  hitRate: number;
  memberResults: {
    memberNumber: number;
    gender: string;
    grade: number | null;
    arrowResults: string[];
    hits: number;
    total: number;
  }[];
}

interface ArrowStat {
  arrowNumber: number;
  hits: number;
  total: number;
  hitRate: number;
}

export default function TeamAnalysisPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [roundStats, setRoundStats] = useState<RoundStat[]>([]);
  const [arrowStats, setArrowStats] = useState<ArrowStat[]>([]);
  const [tournamentInfo, setTournamentInfo] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);

  const [aiError, setAiError] = useState<string | null>(null);

  const { completion, complete, isLoading: aiLoading } = useCompletion({
    api: "/api/analysis/ai",
    onError: (err) => {
      setAiError(err.message || "AI分析に失敗しました");
    },
  });

  useEffect(() => {
    fetch("/api/tournaments")
      .then((r) => r.json())
      .then(setTournaments);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetch(`/api/analysis/team?tournamentId=${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        setRoundStats(data.roundStats ?? []);
        setArrowStats(data.arrowStats ?? []);
        setTournamentInfo(data.tournament ?? null);
        setLoading(false);
      });
  }, [selectedId]);

  async function runAiAnalysis() {
    if (!tournamentInfo || roundStats.length === 0) return;
    setAiError(null);
    await complete("", {
      body: {
        type: "team",
        data: {
          tournamentName: tournamentInfo.name,
          roundStats,
          arrowStats,
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">チーム分析</h1>
        <p className="text-stone-500 text-sm mt-1">
          大会・試合ごとの立ち別・射順別的中集計
        </p>
      </div>

      {/* 大会選択 */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex-1 max-w-sm">
            <label className="text-sm font-medium text-stone-600 block mb-1">
              大会を選択
            </label>
            <Select
              value={selectedId?.toString() ?? ""}
              onValueChange={(v) => setSelectedId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="大会を選択..." />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.name}（{tournamentTypeLabel(t.type)}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <p className="text-center text-stone-400 py-8">読み込み中...</p>
      )}

      {!loading && selectedId && roundStats.length === 0 && (
        <p className="text-center text-stone-400 py-8">
          この大会のデータがありません
        </p>
      )}

      {!loading && roundStats.length > 0 && (
        <>
          {/* 立ち別的中バー */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">立ち別的中率</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={roundStats}
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(_, __, props) => {
                      const d = props.payload as RoundStat;
                      return [
                        `${d.hitRate}%（${d.hits}/${d.total}中）`,
                        "的中率",
                      ];
                    }}
                  />
                  <Bar dataKey="hitRate" radius={[4, 4, 0, 0]}>
                    {roundStats.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.hitRate >= 75
                            ? "#059669"
                            : d.hitRate >= 50
                            ? "#78716c"
                            : "#dc2626"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 射順別的中バー */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">射順別的中率</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={arrowStats}
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="arrowNumber"
                    tickFormatter={(v) => `${v}射目`}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(_, __, props) => {
                      const d = props.payload as ArrowStat;
                      return [
                        `${d.hitRate}%（${d.hits}/${d.total}中）`,
                        "的中率",
                      ];
                    }}
                    labelFormatter={(v) => `${v}射目`}
                  />
                  <Bar dataKey="hitRate" radius={[4, 4, 0, 0]}>
                    {arrowStats.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.hitRate >= 75
                            ? "#059669"
                            : d.hitRate >= 50
                            ? "#78716c"
                            : "#dc2626"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 個人別詳細テーブル */}
          {roundStats.map((round) => (
            <Card key={round.roundId}>
              <CardHeader>
                <CardTitle className="text-base">
                  {round.label} — {round.hits}/{round.total}中（{round.hitRate}%）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 font-medium text-stone-600">
                        部員
                      </th>
                      {[1, 2, 3, 4].map((n) => (
                        <th
                          key={n}
                          className="text-center py-2 px-2 font-medium text-stone-600"
                        >
                          {n}射
                        </th>
                      ))}
                      <th className="text-center py-2 font-medium text-stone-600">
                        計
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {round.memberResults.map((mr, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          No.{mr.memberNumber}（
                          {mr.gender === "MALE" ? "男" : "女"}
                          {mr.grade ? `・${mr.grade}年` : ""}）
                        </td>
                        {mr.arrowResults.map((r, j) => (
                          <td
                            key={j}
                            className={`text-center py-2 px-2 font-bold ${shotResultColor(r)}`}
                          >
                            {shotResultLabel(r)}
                          </td>
                        ))}
                        {/* 矢が足りない場合は空白 */}
                        {Array.from({
                          length: Math.max(0, 4 - mr.arrowResults.length),
                        }).map((_, j) => (
                          <td key={`empty-${j}`} className="text-center py-2" />
                        ))}
                        <td className="text-center py-2 font-bold">
                          {mr.hits}/{mr.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}

          {/* AI分析 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">AIコーチコメント</CardTitle>
                <Button size="sm" onClick={runAiAnalysis} disabled={aiLoading}>
                  {aiLoading ? "分析中..." : "AI分析を実行"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {aiError && (
                <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                  {aiError}
                </div>
              )}
              {completion ? (
                <div className="bg-stone-50 rounded-md p-4 text-sm text-stone-700 leading-relaxed border">
                  {completion}
                </div>
              ) : (
                <p className="text-stone-400 text-sm">
                  「AI分析を実行」ボタンを押すと、AIがチームデータを分析してコメントします。
                  <br />
                  ※ OpenAI APIキーの設定が必要です（設定ページで設定）
                </p>
              )}
              {/* 統計パターン検出 */}
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  統計パターン検出
                </p>
                {generateTeamPatternComments(roundStats, arrowStats).map(
                  (comment, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-xs mr-2 mb-1"
                    >
                      {comment}
                    </Badge>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function generateTeamPatternComments(
  roundStats: RoundStat[],
  arrowStats: ArrowStat[]
): string[] {
  const comments: string[] = [];

  if (roundStats.length >= 2) {
    const first = roundStats[0].hitRate;
    const last = roundStats[roundStats.length - 1].hitRate;
    if (last > first + 10) comments.push("後半の立ちほど的中率が上昇");
    if (last < first - 10) comments.push("後半の立ちで的中率が低下 → 集中力管理に注意");
  }

  const weakArrow = arrowStats
    .filter((a) => a.total > 0)
    .sort((a, b) => a.hitRate - b.hitRate)[0];
  if (weakArrow && weakArrow.hitRate < 50) {
    comments.push(`${weakArrow.arrowNumber}射目がチーム全体の弱点（${weakArrow.hitRate}%）`);
  }

  const overallRate =
    roundStats.reduce((s, r) => s + r.hits, 0) /
    Math.max(1, roundStats.reduce((s, r) => s + r.total, 0));
  if (overallRate >= 0.75) comments.push("全体的中率が良好（75%以上）");
  if (overallRate < 0.5) comments.push("全体的中率が50%未満 → 重点強化が必要");

  if (comments.length === 0) comments.push("特段の傾向なし");
  return comments;
}
