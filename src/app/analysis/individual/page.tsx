"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

interface RoundResult {
  roundId: number;
  roundNumber: number;
  label: string | null;
  hits: number;
  total: number;
  arrowResults: string[];
}

interface ChartDataPoint {
  tournamentId: number;
  name: string;
  date: string;
  type: string;
  hitRate: number;
  hits: number;
  total: number;
  rounds: RoundResult[];
}

interface ArrowStat {
  arrowNumber: number;
  hits: number;
  total: number;
}

type TournamentTypeFilter = "ALL" | "PUBLIC" | "PRACTICE" | "SELECTION";

const TYPE_FILTER_OPTIONS: { value: TournamentTypeFilter; label: string; color: string }[] = [
  { value: "ALL",       label: "すべて",   color: "" },
  { value: "PUBLIC",    label: "公式戦",   color: "#2563eb" },
  { value: "PRACTICE",  label: "練習試合", color: "#059669" },
  { value: "SELECTION", label: "校内選考", color: "#d97706" },
];

const TYPE_COLOR: Record<string, string> = {
  PUBLIC:    "#2563eb",
  PRACTICE:  "#059669",
  SELECTION: "#d97706",
};

const LIMIT_OPTIONS = [5, 10, 20, 50];

/** chartData からクライアント側で射順別的中を集計 */
function computeArrowStatsFromData(data: ChartDataPoint[]): ArrowStat[] {
  return [1, 2, 3, 4].map((n) => {
    let hits = 0;
    let total = 0;
    for (const t of data) {
      for (const r of t.rounds) {
        const result = r.arrowResults[n - 1];
        if (result !== undefined) {
          total++;
          if (result === "HIT") hits++;
        }
      }
    }
    return { arrowNumber: n, hits, total };
  });
}

export default function IndividualAnalysisPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [limit, setLimit] = useState(10);
  const [typeFilter, setTypeFilter] = useState<TournamentTypeFilter>("ALL");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
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
    const res = await fetch(
      `/api/analysis/individual?memberId=${selectedMemberId}&limit=${limit}`
    );
    const data = await res.json();
    setChartData(data.chartData ?? []);
    setLoading(false);
  }, [selectedMemberId, limit]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  useEffect(() => {
    setCompletion("");
    setAiError(null);
  }, [selectedMemberId, typeFilter]);

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  /** フィルター後の表示データ（全データは保持し、ハイライト判定に使う） */
  const filteredData = useMemo(
    () => typeFilter === "ALL" ? chartData : chartData.filter((d) => d.type === typeFilter),
    [chartData, typeFilter]
  );

  /** 射順統計：フィルターに応じてクライアント側で再集計 */
  const arrowStats = useMemo(
    () => computeArrowStatsFromData(filteredData),
    [filteredData]
  );

  /** サマリー（フィルター後） */
  const avgHitRate = filteredData.length > 0
    ? filteredData.reduce((sum, d) => sum + d.hitRate, 0) / filteredData.length
    : null;

  /**
   * 種別ごとに別々の dataKey を持つ形式に変換。
   * connectNulls と組み合わせて「同種別の点だけをつなぐ折れ線」を3本描く。
   */
  const multiLineData = useMemo(() => chartData.map((d) => ({
    ...d,
    hitRatePUBLIC:    d.type === "PUBLIC"    ? d.hitRate : null,
    hitRatePRACTICE:  d.type === "PRACTICE"  ? d.hitRate : null,
    hitRateSELECTION: d.type === "SELECTION" ? d.hitRate : null,
  })), [chartData]);

  async function runAiAnalysis() {
    if (!selectedMember || filteredData.length === 0) {
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
          chartData: filteredData,
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
        <CardContent className="pt-5">
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
          {/* ── 大会種別フィルター ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide mr-1">
              大会種別
            </span>
            {TYPE_FILTER_OPTIONS.map(({ value, label, color }) => {
              const active = typeFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setTypeFilter(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    active
                      ? "text-white border-transparent shadow-sm"
                      : "bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-700"
                  }`}
                  style={active ? { backgroundColor: color || "#292524", borderColor: color || "#292524" } : {}}
                >
                  {color && (
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: active ? "rgba(255,255,255,0.7)" : color }}
                    />
                  )}
                  {label}
                </button>
              );
            })}
          </div>

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
                  {formatHitRate(filteredData[filteredData.length - 1]?.hitRate)}
                </p>
                <p className="text-sm text-stone-500 mt-1">直近試合</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-3xl font-bold text-stone-800">
                  {filteredData.length}
                </p>
                <p className="text-sm text-stone-500 mt-1">試合数</p>
              </CardContent>
            </Card>
          </div>

          {/* 的中率推移グラフ */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">的中率推移</CardTitle>
                <div className="flex gap-3 text-xs text-stone-500">
                  {TYPE_FILTER_OPTIONS.filter((o) => o.color).map((o) => {
                    const active = typeFilter === "ALL" || typeFilter === o.value;
                    return (
                      <span
                        key={o.value}
                        className="flex items-center gap-1 transition-opacity"
                        style={{ opacity: active ? 1 : 0.35 }}
                      >
                        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: o.color }} />
                        {o.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={typeFilter === "ALL" ? chartData : multiLineData}
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
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const entry = payload.find((p) => p.value != null);
                      if (!entry) return null;
                      const d = entry.payload as ChartDataPoint;
                      return (
                        <div className="bg-white border border-stone-200 rounded-md shadow-sm px-3 py-2 text-xs">
                          <p className="font-medium text-stone-600 mb-1">
                            {label}（{tournamentTypeLabel(d.type)}）
                          </p>
                          <p className="font-bold" style={{ color: TYPE_COLOR[d.type] ?? "#292524" }}>
                            {formatHitRate(Number(entry.value))}　{d.hits}/{d.total}中
                          </p>
                        </div>
                      );
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

                  {/* すべて：全点を1本の線でつなぎ、点は種別カラーで色分け */}
                  {typeFilter === "ALL" && (
                    <Line
                      type="monotone"
                      dataKey="hitRate"
                      stroke="#d6d3d1"
                      strokeWidth={2}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        const fill = TYPE_COLOR[payload.type] ?? "#78716c";
                        return (
                          <circle
                            key={`all-${payload.tournamentId}`}
                            cx={cx} cy={cy} r={5}
                            fill={fill}
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={(props) => {
                        const { cx, cy, payload } = props as { cx: number; cy: number; payload: ChartDataPoint };
                        const fill = TYPE_COLOR[payload.type] ?? "#78716c";
                        return <circle cx={cx} cy={cy} r={7} fill={fill} stroke="#fff" strokeWidth={2} />;
                      }}
                    />
                  )}

                  {/* 種別選択時：各種別を別線で描画（connectNulls で同種別の点だけをつなぐ） */}
                  {typeFilter !== "ALL" && (["PUBLIC", "PRACTICE", "SELECTION"] as const).map((type) => {
                    const color = TYPE_COLOR[type];
                    const active = typeFilter === type;
                    return (
                      <Line
                        key={type}
                        type="monotone"
                        dataKey={`hitRate${type}` as "hitRatePUBLIC" | "hitRatePRACTICE" | "hitRateSELECTION"}
                        stroke={color}
                        strokeWidth={active ? 2.5 : 1}
                        strokeOpacity={active ? 1 : 0.2}
                        connectNulls
                        dot={(props) => {
                          const { cx, cy, value } = props;
                          // null 値のとき cy が NaN になるので描画しない
                          if (value == null || !isFinite(cy)) return <g key={`${type}-${props.index}`} />;
                          if (active) {
                            return (
                              <circle
                                key={`${type}-${props.index}`}
                                cx={cx} cy={cy} r={5}
                                fill={color}
                                stroke="#fff"
                                strokeWidth={2}
                              />
                            );
                          }
                          return (
                            <circle
                              key={`${type}-${props.index}`}
                              cx={cx} cy={cy} r={3}
                              fill={color}
                              opacity={0.25}
                            />
                          );
                        }}
                        activeDot={active ? {
                          r: 7,
                          fill: color,
                          stroke: "#fff",
                          strokeWidth: 2,
                        } : false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 射順別的中 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                射順別的中率
                {typeFilter !== "ALL" && (
                  <span className="ml-2 text-xs font-normal text-stone-400">
                    （{TYPE_FILTER_OPTIONS.find((o) => o.value === typeFilter)?.label}のみ集計）
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredData.length === 0 ? (
                <p className="text-center text-stone-400 py-6 text-sm">
                  該当する試合データがありません
                </p>
              ) : (
                <>
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
                </>
              )}
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
                {generatePatternComments(filteredData, arrowStats).map(
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
    .sort((a, b) => a.hits / a.total - b.hits / b.total)[0];
  if (weakArrow && weakArrow.total > 0) {
    const rate = computeHitRatePercent(weakArrow.hits, weakArrow.total);
    if (rate < 50) {
      comments.push(`${weakArrow.arrowNumber}射目が弱点（${formatHitRate(rate)}）`);
    }
  }

  const strongArrow = arrowStats
    .filter((a) => a.total > 0)
    .sort((a, b) => b.hits / b.total - a.hits / a.total)[0];
  if (strongArrow && strongArrow.total > 0) {
    const rate = computeHitRatePercent(strongArrow.hits, strongArrow.total);
    if (rate >= 75) {
      comments.push(`${strongArrow.arrowNumber}射目が得意（${formatHitRate(rate)}）`);
    }
  }

  if (chartData.length > 0) {
    const latest = chartData[chartData.length - 1].hitRate;
    const avg = chartData.reduce((s, d) => s + d.hitRate, 0) / chartData.length;
    if (latest > avg + 15) comments.push("直近の調子が平均を大きく上回っている");
    if (latest < avg - 15) comments.push("直近の調子が平均を大きく下回っている");
  }

  if (comments.length === 0) comments.push("特段の傾向なし");
  return comments;
}
