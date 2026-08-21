"use client";

import { useState, useEffect, useCallback } from "react";
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { tournamentTypeLabel, formatHitRate, computeHitRatePercent } from "@/lib/utils";
import { streamAiCoachComment } from "@/lib/ai-coach";

interface Member {
  id: number;
  number: number;
  gender: "MALE" | "FEMALE";
  grade: number | null;
}

interface ChartDataPoint {
  tournamentId: number;
  name: string;
  date: string;
  type: string;
  hitRate: number;
  hits: number;
  total: number;
}

interface ArrowStat {
  arrowNumber: number;
  hits: number;
  total: number;
}

type TournamentTypeFilter = "ALL" | "PUBLIC" | "PRACTICE" | "SELECTION";

const TYPE_FILTER_OPTIONS: { value: TournamentTypeFilter; label: string }[] = [
  { value: "ALL", label: "すべて" },
  { value: "PUBLIC", label: "公式戦" },
  { value: "PRACTICE", label: "練習試合" },
  { value: "SELECTION", label: "校内選考" },
];

const LIMIT_OPTIONS = [5, 10, 20, 50];

export default function IndividualAnalysisPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [limit, setLimit] = useState(10);
  const [typeFilter, setTypeFilter] = useState<TournamentTypeFilter>("ALL");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [arrowStats, setArrowStats] = useState<ArrowStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [completion, setCompletion] = useState("");

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then(setMembers);
  }, []);

  const fetchAnalysis = useCallback(async () => {
    if (!selectedMemberId) return;
    setLoading(true);
    const typeParam = typeFilter !== "ALL" ? `&type=${typeFilter}` : "";
    const res = await fetch(
      `/api/analysis/individual?memberId=${selectedMemberId}&limit=${limit}${typeParam}`
    );
    const data = await res.json();
    setChartData(data.chartData);
    setArrowStats(data.arrowStats);
    setLoading(false);
  }, [selectedMemberId, limit, typeFilter]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  useEffect(() => {
    setCompletion("");
    setAiError(null);
  }, [selectedMemberId, typeFilter]);

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  async function runAiAnalysis() {
    if (!selectedMember || chartData.length === 0) {
      setAiError("部員を選び、的中データがある状態で実行してください");
      return;
    }
    setAiError(null);
    setCompletion("");
    setAiLoading(true);
    try {
      await streamAiCoachComment({
        type: "individual",
        data: {
          memberNumber: selectedMember.number,
          gender: selectedMember.gender,
          chartData,
          arrowStats,
        },
        onChunk: setCompletion,
      });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI分析に失敗しました");
    } finally {
      setAiLoading(false);
    }
  }

  const avgHitRate =
    chartData.length > 0
      ? chartData.reduce((sum, d) => sum + d.hitRate, 0) / chartData.length
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">個人分析</h1>
        <p className="text-stone-500 text-sm mt-1">
          部員ごとの的中率推移と射順傾向
        </p>
      </div>

      {/* 選択UI */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-40">
              <label className="text-sm font-medium text-stone-600 block mb-1">
                部員
              </label>
              <Select
                value={selectedMemberId?.toString() ?? ""}
                onValueChange={(v) => setSelectedMemberId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="部員を選択..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      No.{m.number}（
                      {m.gender === "MALE" ? "男" : "女"}
                      {m.grade ? `・${m.grade}年` : ""}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-32">
              <label className="text-sm font-medium text-stone-600 block mb-1">
                直近N試合
              </label>
              <Select
                value={limit.toString()}
                onValueChange={(v) => setLimit(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIMIT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      直近{n}試合
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 大会種別フィルター */}
          <div>
            <label className="text-sm font-medium text-stone-600 block mb-2">
              大会種別
            </label>
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTypeFilter(value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    typeFilter === value
                      ? "bg-stone-800 text-white border-stone-800"
                      : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50 hover:border-stone-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <p className="text-center text-stone-400 py-8">読み込み中...</p>
      )}

      {!loading && selectedMemberId && chartData.length === 0 && (
        <p className="text-center text-stone-400 py-8">
          この部員のデータがありません
        </p>
      )}

      {!loading && chartData.length > 0 && (
        <>
          {/* サマリー */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-3xl font-bold text-stone-800">
                  {formatHitRate(avgHitRate)}
                </p>
                <p className="text-sm text-stone-500 mt-1">平均的中率</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-3xl font-bold text-stone-800">
                  {formatHitRate(chartData[chartData.length - 1]?.hitRate)}
                </p>
                <p className="text-sm text-stone-500 mt-1">直近試合</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-3xl font-bold text-stone-800">
                  {chartData.length}
                </p>
                <p className="text-sm text-stone-500 mt-1">試合数</p>
              </CardContent>
            </Card>
          </div>

          {/* 的中率推移グラフ */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">的中率推移</CardTitle>
                {typeFilter === "ALL" && (
                  <div className="flex gap-3 text-xs text-stone-500">
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-2.5 rounded-full bg-blue-600" />公式戦
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-2.5 rounded-full bg-emerald-600" />練習試合
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-2.5 rounded-full bg-amber-600" />校内選考
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 16, bottom: 40, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => formatHitRate(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value, _name, props) => {
                      const d = props.payload as ChartDataPoint;
                      return [
                        `${formatHitRate(Number(value))}（${d.hits}/${d.total}中）`,
                        "的中率",
                      ];
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload?.[0]) {
                        const d = payload[0].payload as ChartDataPoint;
                        return `${label}（${tournamentTypeLabel(d.type)}）`;
                      }
                      return label;
                    }}
                  />
                  {avgHitRate !== null && (
                    <ReferenceLine
                      y={avgHitRate}
                      stroke="#a8a29e"
                      strokeDasharray="4 4"
                      label={{
                        value: `平均 ${formatHitRate(avgHitRate)}`,
                        fill: "#a8a29e",
                        fontSize: 11,
                        position: "right",
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="hitRate"
                    stroke="#292524"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const colors: Record<string, string> = {
                        PUBLIC: "#2563eb",
                        PRACTICE: "#059669",
                        SELECTION: "#d97706",
                      };
                      const fill = typeFilter === "ALL"
                        ? (colors[payload.type] ?? "#292524")
                        : "#292524";
                      return <circle key={`dot-${payload.tournamentId}`} cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={1.5} />;
                    }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 射順別的中 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">射順別的中率（全試合集計）</CardTitle>
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
                    tickFormatter={(v) => formatHitRate(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(_, __, props) => {
                      const d = props.payload as ArrowStat;
                      const rate = computeHitRatePercent(d.hits, d.total);
                      return [
                        `${formatHitRate(rate)}（${d.hits}/${d.total}中）`,
                        "的中率",
                      ];
                    }}
                    labelFormatter={(v) => `${v}射目`}
                  />
                  <Bar
                    dataKey={(d: ArrowStat) =>
                      computeHitRatePercent(d.hits, d.total)
                    }
                    name="的中率"
                    radius={[4, 4, 0, 0]}
                  >
                    {arrowStats.map((d, i) => {
                      const rate = computeHitRatePercent(d.hits, d.total);
                      return (
                        <Cell
                          key={i}
                          fill={
                            rate >= 75
                              ? "#059669"
                              : rate >= 50
                              ? "#78716c"
                              : "#dc2626"
                          }
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3">
                {arrowStats.map((d) => {
                  const rate = computeHitRatePercent(d.hits, d.total);
                  return (
                    <div key={d.arrowNumber} className="text-center flex-1">
                      <p className="text-xs text-stone-500">{d.arrowNumber}射目</p>
                      <p className="font-bold text-stone-800">
                        {formatHitRate(rate)}
                      </p>
                      <p className="text-xs text-stone-400">
                        {d.hits}/{d.total}中
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* AI分析 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">AIコーチコメント</CardTitle>
                <Button
                  size="sm"
                  onClick={runAiAnalysis}
                  disabled={aiLoading}
                >
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
              {aiLoading && !completion && (
                <p className="text-sm text-stone-500 mb-3">AIが分析中です...</p>
              )}
              {completion ? (
                <div className="bg-stone-50 rounded-md p-4 text-sm text-stone-700 leading-relaxed border">
                  {completion}
                </div>
              ) : (
                <p className="text-stone-400 text-sm">
                  「AI分析を実行」ボタンを押すと、データをもとにAIがコーチ視点でコメントします。
                  <br />
                  ※ Google Gemini APIキーの設定が必要です（設定ページで設定）
                </p>
              )}
              {/* 統計ベースの自動コメント */}
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  統計パターン検出
                </p>
                {generatePatternComments(chartData, arrowStats).map(
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

function generatePatternComments(
  chartData: ChartDataPoint[],
  arrowStats: ArrowStat[]
): string[] {
  const comments: string[] = [];

  if (chartData.length >= 3) {
    const last3 = chartData.slice(-3).map((d) => d.hitRate);
    if (last3[2] > last3[1] && last3[1] > last3[0]) {
      comments.push("直近3試合で連続上昇中");
    } else if (last3[2] < last3[1] && last3[1] < last3[0]) {
      comments.push("直近3試合で連続下降 → 要注意");
    }
  }

  const weakArrow = arrowStats
    .filter((a) => a.total > 0)
    .sort(
      (a, b) => a.hits / a.total - b.hits / b.total
    )[0];
  if (weakArrow && weakArrow.total > 0) {
    const rate = computeHitRatePercent(weakArrow.hits, weakArrow.total);
    if (rate < 50) {
      comments.push(
        `${weakArrow.arrowNumber}射目が弱点（${formatHitRate(rate)}）`
      );
    }
  }

  const strongArrow = arrowStats
    .filter((a) => a.total > 0)
    .sort(
      (a, b) => b.hits / b.total - a.hits / a.total
    )[0];
  if (strongArrow && strongArrow.total > 0) {
    const rate = computeHitRatePercent(strongArrow.hits, strongArrow.total);
    if (rate >= 75) {
      comments.push(
        `${strongArrow.arrowNumber}射目が得意（${formatHitRate(rate)}）`
      );
    }
  }

  if (chartData.length > 0) {
    const latest = chartData[chartData.length - 1].hitRate;
    const avg =
      chartData.reduce((s, d) => s + d.hitRate, 0) / chartData.length;
    if (latest > avg + 15) comments.push("直近の調子が平均を大きく上回っている");
    if (latest < avg - 15) comments.push("直近の調子が平均を大きく下回っている");
  }

  if (comments.length === 0) comments.push("特段の傾向なし");
  return comments;
}
